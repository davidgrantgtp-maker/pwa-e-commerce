const { db } = require('./lib/supabase');
const { json, parseBody, wrap, methodNotAllowed } = require('./lib/http');
const { requireUser } = require('./lib/auth');
const { slugify, parseNum, parseBool, str } = require('./lib/helpers');

function keyName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function loadAll(table, select) {
  const all = [];
  const size = 1000;
  for (let from = 0; from < 50000; from += size) {
    const { data, error } = await db()
      .from(table)
      .select(select)
      .order('id', { ascending: true })
      .range(from, from + size - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return all;
}

function uniqueInSet(base, used) {
  let slug = base;
  let i = 2;
  while (used.has(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  used.add(slug);
  return slug;
}

async function runUpdates(updates) {
  let ok = 0;
  const details = [];
  const size = 20;

  for (let i = 0; i < updates.length; i += size) {
    const chunk = updates.slice(i, i + size);
    const results = await Promise.allSettled(
      chunk.map(async (item) => {
        const { error } = await db().from('productos').update(item.data).eq('id', item.id);
        if (error) throw error;
      })
    );
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        ok += 1;
      } else {
        details.push(`Fila ${chunk[idx].fila}: ${result.reason.message}`);
      }
    });
  }

  return { ok, details };
}

async function runInserts(inserts) {
  let ok = 0;
  const details = [];
  const size = 20;

  for (let i = 0; i < inserts.length; i += size) {
    const chunk = inserts.slice(i, i + size);
    const results = await Promise.allSettled(
      chunk.map(async (item) => {
        const { error } = await db().from('productos').insert(item.data);
        if (error) throw error;
      })
    );
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        ok += 1;
      } else {
        details.push(`Fila ${chunk[idx].fila}: ${result.reason.message}`);
      }
    });
  }

  return { ok, details };
}

async function processRows(rows, archivo, usuarioId) {
  const categories = await loadAll('categorias', 'id,nombre,slug');
  const products = await loadAll('productos', 'id,sku,nombre,slug');

  const catMap = new Map();
  const catSlugs = new Set();
  categories.forEach((c) => {
    catMap.set(keyName(c.nombre), c.id);
    catSlugs.add(c.slug);
  });

  const bySku = new Map();
  const byName = new Map();
  const prodSlugs = new Set();
  products.forEach((p) => {
    if (p.sku) bySku.set(String(p.sku), p);
    byName.set(keyName(p.nombre), p);
    prodSlugs.add(p.slug);
  });

  const updates = [];
  const inserts = [];
  const details = [];
  let errores = 0;

  for (let i = 0; i < rows.length; i++) {
    const fila = i + 2;
    const r = rows[i] || {};

    try {
      const nombre = str(r.nombre, 160);
      if (!nombre) {
        errores += 1;
        details.push(`Fila ${fila}: falta el nombre.`);
        continue;
      }

      const sku = str(r.sku, 80) || null;
      const precio = r.precio !== undefined && r.precio !== '' ? parseNum(r.precio) : null;
      const precioAnterior =
        r.precio_anterior !== undefined && r.precio_anterior !== '' ? parseNum(r.precio_anterior) : null;
      const costo = r.costo !== undefined && r.costo !== '' ? parseNum(r.costo) : null;
      const stockNum = r.stock !== undefined && r.stock !== '' ? parseNum(r.stock) : null;

      let catId = null;
      if (r.categoria !== undefined && r.categoria !== '') {
        const catNombre = str(r.categoria, 80);
        const key = keyName(catNombre);
        if (catMap.has(key)) {
          catId = catMap.get(key);
        } else {
          const slug = uniqueInSet(slugify(catNombre), catSlugs);
          const { data, error } = await db()
            .from('categorias')
            .insert({ nombre: catNombre, slug, activo: true })
            .select('id')
            .single();
          if (error) throw error;
          catId = data.id;
          catMap.set(key, data.id);
        }
      }

      const existente = (sku && bySku.get(String(sku))) || byName.get(keyName(nombre));

      if (existente && existente.id === null) {
        errores += 1;
        details.push(`Fila ${fila}: producto duplicado dentro del archivo (${sku || nombre}).`);
        continue;
      }

      if (existente) {
        const data = { nombre, sku };
        if (precio !== null) data.precio = precio;
        if (r.precio_anterior !== undefined) data.precio_anterior = precioAnterior;
        if (r.costo !== undefined) data.costo = costo;
        if (stockNum !== null) data.stock = parseInt(stockNum, 10) || 0;
        if (r.descripcion) data.descripcion = str(r.descripcion, 4000);
        if (r.imagen) data.imagen = str(r.imagen, 500);
        if (r.etiqueta !== undefined) data.etiqueta = str(r.etiqueta, 60);
        if (catId) data.categoria_id = catId;
        if (r.destacado !== undefined && r.destacado !== '') data.destacado = parseBool(r.destacado);
        if (r.activo !== undefined && r.activo !== '') data.activo = parseBool(r.activo);
        updates.push({ id: existente.id, data, fila });
      } else {
        const data = {
          sku,
          nombre,
          slug: uniqueInSet(slugify(nombre), prodSlugs),
          categoria_id: catId,
          precio: precio === null ? 0 : precio,
          precio_anterior: precioAnterior,
          costo,
          stock: stockNum === null ? 0 : parseInt(stockNum, 10) || 0,
          descripcion: str(r.descripcion, 4000),
          imagen: str(r.imagen, 500),
          etiqueta: str(r.etiqueta, 60),
          destacado: r.destacado !== undefined && r.destacado !== '' ? parseBool(r.destacado) : false,
          activo: r.activo !== undefined && r.activo !== '' ? parseBool(r.activo) : true
        };
        inserts.push({ data, fila });
        const placeholder = { id: null, sku, nombre };
        if (sku) bySku.set(String(sku), placeholder);
        byName.set(keyName(nombre), placeholder);
      }
    } catch (err) {
      errores += 1;
      details.push(`Fila ${fila}: ${err.message}`);
    }
  }

  const updated = await runUpdates(updates);
  const inserted = await runInserts(inserts);

  errores += updated.details.length + inserted.details.length;
  details.push(...updated.details, ...inserted.details);

  const { error: logError } = await db().from('importaciones').insert({
    archivo: str(archivo, 200) || 'importacion',
    total: rows.length,
    creadas: inserted.ok,
    actualizadas: updated.ok,
    errores,
    usuario_id: usuarioId || null
  });
  if (logError) throw logError;

  return {
    total: rows.length,
    creadas: inserted.ok,
    actualizadas: updated.ok,
    errores,
    detalles: details
  };
}

exports.handler = wrap(async (event) => {
  const user = requireUser(event);

  if (event.httpMethod === 'GET') {
    const { data, error } = await db().rpc('ultimas_importaciones', { p_limit: 12 });
    if (error) throw error;
    return json(200, { history: data || [] });
  }

  if (event.httpMethod !== 'POST') return methodNotAllowed();

  const body = parseBody(event);
  if (!body) return json(400, { error: 'Cuerpo inválido.' });

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return json(400, { error: 'No hay filas para importar.' });
  if (rows.length > 2000) {
    return json(400, { error: 'Máximo 2000 filas por importación. Dividí el archivo.' });
  }

  const result = await processRows(rows, body.archivo, user.uid);
  return json(200, result);
});

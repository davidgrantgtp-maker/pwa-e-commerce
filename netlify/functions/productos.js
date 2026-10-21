const { db } = require('./lib/supabase');
const { json, parseBody, wrap, methodNotAllowed, query } = require('./lib/http');
const { requireUser } = require('./lib/auth');
const {
  uniqueSlug,
  parseNum,
  parseBool,
  str,
  mapProduct,
  paging,
  applyProductFilters
} = require('./lib/helpers');

async function list(event) {
  const q = query(event);
  const filters = {
    q: q.q || '',
    cat: parseInt(q.cat, 10) || 0,
    estado: q.estado || '',
    dest: parseBool(q.dest)
  };

  if (q.all === '1') {
    const all = [];
    const size = 1000;
    for (let from = 0; from < 50000; from += size) {
      let sel = db().from('productos').select('*, categorias(nombre)');
      sel = applyProductFilters(sel, filters);
      sel = sel.order('id', { ascending: true }).range(from, from + size - 1);
      const { data, error } = await sel;
      if (error) throw error;
      all.push(...(data || []));
      if (!data || data.length < size) break;
    }
    return json(200, { rows: all.map(mapProduct), total: all.length });
  }

  const { page, perPage, from, to } = paging(event);
  let sel = db()
    .from('productos')
    .select('*, categorias(nombre)', { count: 'exact' });
  sel = applyProductFilters(sel, filters);

  switch (q.orden) {
    case 'nombre':
      sel = sel.order('nombre', { ascending: true });
      break;
    case 'precio_asc':
      sel = sel.order('precio', { ascending: true });
      break;
    case 'precio_desc':
      sel = sel.order('precio', { ascending: false });
      break;
    case 'stock_asc':
      sel = sel.order('stock', { ascending: true });
      break;
    default:
      sel = sel.order('id', { ascending: false });
  }

  sel = sel.range(from, to);
  const { data, error, count } = await sel;
  if (error) throw error;

  const total = count || 0;
  return json(200, {
    rows: (data || []).map(mapProduct),
    total,
    page,
    per_page: perPage,
    paginas: Math.max(1, Math.ceil(total / perPage))
  });
}

function productPayload(body, isCreate) {
  const nombre = str(body.nombre, 160);
  if (!nombre) {
    const err = new Error('El nombre es obligatorio.');
    err.statusCode = 400;
    throw err;
  }

  const precio = parseNum(body.precio);
  if (precio === null || precio < 0) {
    const err = new Error('El precio es obligatorio y numérico.');
    err.statusCode = 400;
    throw err;
  }

  const stock = parseInt(parseNum(body.stock), 10);
  const categoriaId = parseInt(body.categoria_id, 10);

  const data = {
    sku: str(body.sku, 80) || null,
    nombre,
    categoria_id: Number.isFinite(categoriaId) && categoriaId > 0 ? categoriaId : null,
    precio,
    precio_anterior: parseNum(body.precio_anterior),
    costo: parseNum(body.costo),
    stock: Number.isFinite(stock) ? stock : 0,
    descripcion: str(body.descripcion, 4000),
    imagen: str(body.imagen, 500),
    etiqueta: str(body.etiqueta, 60),
    destacado: parseBool(body.destacado),
    activo: isCreate ? body.activo === undefined || parseBool(body.activo) : parseBool(body.activo)
  };
  return data;
}

function duplicateError(err) {
  if (err && err.code === '23505') {
    const e = new Error('Ya existe un producto con ese SKU o slug.');
    e.statusCode = 409;
    return e;
  }
  return err;
}

async function create(event) {
  const body = parseBody(event);
  if (!body) return json(400, { error: 'Cuerpo inválido.' });

  const data = productPayload(body, true);
  data.slug = await uniqueSlug('productos', data.nombre);

  const { data: row, error } = await db()
    .from('productos')
    .insert(data)
    .select('*, categorias(nombre)')
    .single();

  if (error) throw duplicateError(error);
  return json(201, { product: mapProduct(row) });
}

async function bulk(event) {
  const body = parseBody(event);
  if (!body || !Array.isArray(body.ids) || !body.ids.length) {
    return json(400, { error: 'Seleccioná al menos un producto.' });
  }
  const ids = body.ids.map((x) => parseInt(x, 10)).filter((x) => Number.isFinite(x) && x > 0);
  if (!ids.length) return json(400, { error: 'IDs inválidos.' });

  let patch;
  const accion = body.accion;
  if (accion === 'activar') patch = { activo: true };
  else if (accion === 'desactivar') patch = { activo: false };
  else if (accion === 'destacar') patch = { destacado: true };
  else if (accion === 'quitar_destacado') patch = { destacado: false };
  else if (accion === 'mover') {
    const cat = parseInt(body.categoria_id, 10);
    if (!Number.isFinite(cat) || cat <= 0) {
      return json(400, { error: 'Elegí una categoría.' });
    }
    patch = { categoria_id: cat };
  } else {
    return json(400, { error: 'Acción no válida.' });
  }

  const { error, count } = await db()
    .from('productos')
    .update(patch, { count: 'exact' })
    .in('id', ids);

  if (error) throw error;
  return json(200, { ok: true, afectados: count || 0 });
}

async function remove(event) {
  const body = parseBody(event);
  if (!body || !Array.isArray(body.ids) || !body.ids.length) {
    return json(400, { error: 'Seleccioná al menos un producto.' });
  }
  const ids = body.ids.map((x) => parseInt(x, 10)).filter((x) => Number.isFinite(x) && x > 0);
  if (!ids.length) return json(400, { error: 'IDs inválidos.' });

  const { error, count } = await db()
    .from('productos')
    .delete({ count: 'exact' })
    .in('id', ids);

  if (error) throw error;
  return json(200, { ok: true, afectados: count || 0 });
}

exports.handler = wrap(async (event) => {
  requireUser(event);
  if (event.httpMethod === 'GET') return list(event);
  if (event.httpMethod === 'POST') return create(event);
  if (event.httpMethod === 'PATCH') return bulk(event);
  if (event.httpMethod === 'DELETE') return remove(event);
  return methodNotAllowed();
});

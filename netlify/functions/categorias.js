const { db } = require('./lib/supabase');
const { json, parseBody, wrap, methodNotAllowed, query } = require('./lib/http');
const { requireUser } = require('./lib/auth');
const { uniqueSlug, parseBool, str } = require('./lib/helpers');

async function nameExists(nombre, excludeId) {
  let q = db().from('categorias').select('id').ilike('nombre', nombre).limit(1);
  if (excludeId) q = q.neq('id', excludeId);
  const { data, error } = await q;
  if (error) throw error;
  return !!(data && data.length);
}

async function list(event) {
  const q = query(event);
  if (q.with_counts === '1') {
    const { data, error } = await db().rpc('categorias_con_conteo');
    if (error) throw error;
    return json(200, { rows: data || [] });
  }

  let sel = db().from('categorias').select('*');
  if (q.solo_activas === '1') sel = sel.eq('activo', true);
  sel = sel.order('orden', { ascending: true }).order('nombre', { ascending: true });
  const { data, error } = await sel;
  if (error) throw error;
  return json(200, { rows: data || [] });
}

async function create(event) {
  const body = parseBody(event);
  if (!body) return json(400, { error: 'Cuerpo inválido.' });

  const nombre = str(body.nombre, 80);
  if (!nombre) return json(400, { error: 'El nombre es obligatorio.' });
  if (await nameExists(nombre)) {
    return json(409, { error: 'Ya existe una categoría con ese nombre.' });
  }

  const orden = parseInt(body.orden, 10);
  const row = {
    nombre,
    slug: await uniqueSlug('categorias', nombre),
    activo: body.activo === undefined ? true : parseBool(body.activo),
    orden: Number.isFinite(orden) ? orden : 0
  };

  const { data, error } = await db().from('categorias').insert(row).select('*').single();
  if (error) throw error;
  return json(201, { category: data });
}

async function update(event) {
  const body = parseBody(event);
  if (!body) return json(400, { error: 'Cuerpo inválido.' });
  const id = parseInt(body.id, 10);
  if (!Number.isFinite(id) || id <= 0) return json(400, { error: 'ID inválido.' });

  if (body.toggle) {
    const { data: current, error: findError } = await db()
      .from('categorias')
      .select('id,activo')
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;
    if (!current) return json(404, { error: 'La categoría no existe.' });

    const { data, error } = await db()
      .from('categorias')
      .update({ activo: !current.activo })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return json(200, { category: data });
  }

  const nombre = str(body.nombre, 80);
  if (!nombre) return json(400, { error: 'El nombre es obligatorio.' });
  if (await nameExists(nombre, id)) {
    return json(409, { error: 'Ya existe una categoría con ese nombre.' });
  }

  const orden = parseInt(body.orden, 10);
  const patch = {
    nombre,
    activo: parseBool(body.activo),
    orden: Number.isFinite(orden) ? orden : 0
  };

  const { data, error } = await db()
    .from('categorias')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) return json(404, { error: 'La categoría no existe.' });
  return json(200, { category: data });
}

async function remove(event) {
  const body = parseBody(event);
  if (!body) return json(400, { error: 'Cuerpo inválido.' });
  const id = parseInt(body.id, 10);
  if (!Number.isFinite(id) || id <= 0) return json(400, { error: 'ID inválido.' });

  const { error, count } = await db()
    .from('categorias')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) throw error;
  if (!count) return json(404, { error: 'La categoría no existe.' });
  return json(200, { ok: true });
}

exports.handler = wrap(async (event) => {
  requireUser(event);
  if (event.httpMethod === 'GET') return list(event);
  if (event.httpMethod === 'POST') return create(event);
  if (event.httpMethod === 'PATCH') return update(event);
  if (event.httpMethod === 'DELETE') return remove(event);
  return methodNotAllowed();
});

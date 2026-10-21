const { db } = require('./lib/supabase');
const { json, parseBody, wrap, methodNotAllowed, query } = require('./lib/http');
const { requireUser } = require('./lib/auth');
const { parseBool, str } = require('./lib/helpers');

const SELECT = 'id,titulo,subtitulo,etiqueta,texto_boton,enlace,imagen,activo,orden,creado_en,actualizado_en';

async function list() {
  const { data, error } = await db()
    .from('banners')
    .select(SELECT)
    .order('orden', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;
  return json(200, { rows: data || [] });
}

function normalize(body) {
  const titulo = str(body.titulo, 80);
  const subtitulo = str(body.subtitulo, 160);
  const etiqueta = str(body.etiqueta, 24);
  const textoBoton = str(body.texto_boton, 30);
  const enlace = str(body.enlace, 300) || '#catalogo';
  const imagen = str(body.imagen, 500);
  const orden = parseInt(body.orden, 10);

  return {
    titulo,
    subtitulo,
    etiqueta,
    texto_boton: textoBoton,
    enlace,
    imagen,
    activo: body.activo === undefined ? true : parseBool(body.activo),
    orden: Number.isFinite(orden) ? orden : 0
  };
}

async function create(event) {
  const body = parseBody(event);
  if (!body) return json(400, { error: 'Cuerpo inválido.' });

  const row = normalize(body);
  if (!row.titulo) return json(400, { error: 'El título del banner es obligatorio.' });

  const { data, error } = await db().from('banners').insert(row).select(SELECT).single();
  if (error) throw error;
  return json(201, { banner: data });
}

async function update(event) {
  const body = parseBody(event);
  if (!body) return json(400, { error: 'Cuerpo inválido.' });

  const id = parseInt(body.id, 10);
  if (!Number.isFinite(id) || id <= 0) return json(400, { error: 'ID inválido.' });

  const patch = normalize(body);
  if (!patch.titulo) return json(400, { error: 'El título del banner es obligatorio.' });
  patch.actualizado_en = new Date().toISOString();

  const { data, error } = await db()
    .from('banners')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .maybeSingle();

  if (error) throw error;
  if (!data) return json(404, { error: 'El banner no existe.' });
  return json(200, { banner: data });
}

async function remove(event) {
  const q = query(event);
  const body = parseBody(event) || {};
  const id = parseInt(body.id || q.id, 10);
  if (!Number.isFinite(id) || id <= 0) return json(400, { error: 'ID inválido.' });

  const { error, count } = await db()
    .from('banners')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) throw error;
  if (!count) return json(404, { error: 'El banner no existe.' });
  return json(200, { ok: true });
}

exports.handler = wrap(async (event) => {
  requireUser(event);
  if (event.httpMethod === 'GET') return list();
  if (event.httpMethod === 'POST') return create(event);
  if (event.httpMethod === 'PATCH') return update(event);
  if (event.httpMethod === 'DELETE') return remove(event);
  return methodNotAllowed();
});

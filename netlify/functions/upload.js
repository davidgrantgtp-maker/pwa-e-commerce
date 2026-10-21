const crypto = require('crypto');
const { db } = require('./lib/supabase');
const { json, parseBody, wrap, methodNotAllowed } = require('./lib/http');
const { requireUser } = require('./lib/auth');

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml'
};

let bucketChecked = false;

async function ensureBucket() {
  if (bucketChecked) return;
  try {
    await db().storage.createBucket('productos', { public: true });
  } catch (err) {
    // Si ya existe, seguimos.
  }
  bucketChecked = true;
}

exports.handler = wrap(async (event) => {
  requireUser(event);
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  const body = parseBody(event);
  if (!body) return json(400, { error: 'Cuerpo inválido.' });

  const filename = String(body.filename || '');
  const ext = filename.split('.').pop().toLowerCase();
  if (!ALLOWED[ext]) {
    return json(400, { error: 'Formato no permitido (jpg, jpeg, png, gif, webp, svg).' });
  }

  const base64 = String(body.data || '').replace(/^data:[^;]+;base64,/, '');
  if (!base64) return json(400, { error: 'Archivo vacío.' });

  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch (err) {
    return json(400, { error: 'Archivo inválido.' });
  }

  if (!buffer.length) return json(400, { error: 'Archivo vacío.' });
  if (buffer.length > MAX_BYTES) {
    return json(400, { error: 'La imagen supera 2 MB.' });
  }

  await ensureBucket();

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const rand = crypto.randomBytes(4).toString('hex');
  const path = `prod-${stamp}-${rand}.${ext}`;
  const contentType = ALLOWED[ext];

  const { error } = await db()
    .storage.from('productos')
    .upload(path, buffer, { contentType, upsert: false, cacheControl: '31536000' });

  if (error) throw error;

  const { data } = db().storage.from('productos').getPublicUrl(path);
  return json(200, { path, url: data.publicUrl });
});

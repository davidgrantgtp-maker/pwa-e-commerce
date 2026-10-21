const bcrypt = require('bcryptjs');
const { db } = require('./lib/supabase');
const { json, parseBody, wrap, methodNotAllowed } = require('./lib/http');
const { sign, cookieHeader } = require('./lib/auth');

exports.handler = wrap(async (event) => {
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  const body = parseBody(event);
  if (!body) return json(400, { error: 'Cuerpo inválido.' });

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) {
    return json(400, { error: 'Email y contraseña son obligatorios.' });
  }

  const { data, error } = await db()
    .from('usuarios')
    .select('id,nombre,email,rol,password_hash,activo')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.activo !== true) {
    return json(401, { error: 'Email o contraseña incorrectos.' });
  }

  const hash = String(data.password_hash || '').replace(/^\$2y\$/, '$2b$');
  if (!bcrypt.compareSync(password, hash)) {
    return json(401, { error: 'Email o contraseña incorrectos.' });
  }

  const token = sign(data);
  return json(
    200,
    { user: { id: data.id, nombre: data.nombre, email: data.email, rol: data.rol } },
    { 'Set-Cookie': cookieHeader(token) }
  );
});

const bcrypt = require('bcryptjs');
const { db } = require('./lib/supabase');
const { json, parseBody, wrap, methodNotAllowed } = require('./lib/http');
const { requireUser } = require('./lib/auth');

exports.handler = wrap(async (event) => {
  if (event.httpMethod !== 'POST') return methodNotAllowed();
  const user = requireUser(event);

  const body = parseBody(event);
  if (!body) return json(400, { error: 'Cuerpo inválido.' });

  const actual = String(body.actual || '');
  const nueva = String(body.nueva || '');
  if (!actual || !nueva) {
    return json(400, { error: 'Completá la contraseña actual y la nueva.' });
  }
  if (nueva.length < 8) {
    return json(400, { error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }

  const { data, error } = await db()
    .from('usuarios')
    .select('id,password_hash,activo')
    .eq('id', user.uid)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.activo !== true) return json(401, { error: 'Usuario inactivo.' });

  const hash = String(data.password_hash || '').replace(/^\$2y\$/, '$2b$');
  if (!bcrypt.compareSync(actual, hash)) {
    return json(400, { error: 'La contraseña actual no es correcta.' });
  }

  const newHash = bcrypt.hashSync(nueva, 10).replace(/^\$2[aby]\$/, '$2y$');
  const { error: updateError } = await db()
    .from('usuarios')
    .update({ password_hash: newHash })
    .eq('id', user.uid);

  if (updateError) throw updateError;
  return json(200, { ok: true });
});

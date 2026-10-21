const { db } = require('./lib/supabase');
const { json, wrap, methodNotAllowed } = require('./lib/http');
const { userFromEvent } = require('./lib/auth');

exports.handler = wrap(async (event) => {
  if (event.httpMethod !== 'GET') return methodNotAllowed();

  const session = userFromEvent(event);
  if (!session) return json(401, { error: 'No autorizado' });

  const { data, error } = await db()
    .from('usuarios')
    .select('id,nombre,email,rol,activo')
    .eq('id', session.uid)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.activo !== true) {
    return json(401, { error: 'Usuario inactivo' });
  }

  return json(200, {
    user: { id: data.id, nombre: data.nombre, email: data.email, rol: data.rol }
  });
});

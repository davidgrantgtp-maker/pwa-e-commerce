const { db } = require('./lib/supabase');
const { json, wrap, methodNotAllowed } = require('./lib/http');
const { requireUser } = require('./lib/auth');

exports.handler = wrap(async (event) => {
  requireUser(event);
  if (event.httpMethod !== 'GET') return methodNotAllowed();

  const client = db();
  const [stats, porCategoria, stockCritico, movimientos, importaciones] = await Promise.all([
    client.rpc('dashboard_stats'),
    client.rpc('por_categoria'),
    client.rpc('stock_critico', { p_limit: 8 }),
    client.rpc('ultimos_movimientos', { p_limit: 6 }),
    client.rpc('ultimas_importaciones', { p_limit: 5 })
  ]);

  const errors = [stats, porCategoria, stockCritico, movimientos, importaciones]
    .map((r) => r.error)
    .filter(Boolean);
  if (errors.length) throw errors[0];

  return json(200, {
    stats: stats.data || {},
    porCategoria: porCategoria.data || [],
    stockCritico: stockCritico.data || [],
    movimientos: movimientos.data || [],
    importaciones: importaciones.data || []
  });
});

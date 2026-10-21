const { db } = require('./lib/supabase');
const { json, parseBody, wrap, methodNotAllowed } = require('./lib/http');
const { requireUser } = require('./lib/auth');
const { parseNum, str } = require('./lib/helpers');

function digits(value, max) {
  return String(value || '').replace(/\D/g, '').slice(0, max);
}

async function currentRow() {
  const { data, error } = await db()
    .from('configuracion')
    .select('*')
    .eq('id', 1)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { data: created, error: createError } = await db()
    .from('configuracion')
    .insert({ id: 1 })
    .select('*')
    .single();

  if (createError) throw createError;
  return created;
}

exports.handler = wrap(async (event) => {
  requireUser(event);

  if (event.httpMethod === 'GET') {
    return json(200, { config: await currentRow() });
  }

  if (event.httpMethod !== 'PATCH' && event.httpMethod !== 'POST') {
    return methodNotAllowed();
  }

  const body = parseBody(event);
  if (!body) return json(400, { error: 'Cuerpo inválido.' });

  const tiendaNombre = str(body.tienda_nombre, 80);
  if (!tiendaNombre) return json(400, { error: 'El nombre de la tienda es obligatorio.' });

  const envioCosto = parseNum(body.envio_costo);
  const envioGratis = parseNum(body.envio_gratis_desde);
  if (envioCosto === null || envioCosto < 0) {
    return json(400, { error: 'El costo de envío no es válido.' });
  }
  if (envioGratis === null || envioGratis < 0) {
    return json(400, { error: 'El monto de envío gratis no es válido.' });
  }

  const descuento = parseInt(body.cupon_descuento, 10);
  if (!Number.isFinite(descuento) || descuento < 0 || descuento > 100) {
    return json(400, { error: 'El descuento del cupón debe estar entre 0 y 100.' });
  }

  const whatsapp = digits(body.whatsapp, 20);
  if (whatsapp && whatsapp.length < 8) {
    return json(400, { error: 'El WhatsApp debe incluir código de país (mínimo 8 dígitos).' });
  }

  const row = await currentRow();
  const patch = {
    tienda_nombre: tiendaNombre,
    vendedor_nombre: str(body.vendedor_nombre, 80),
    whatsapp: whatsapp,
    email: str(body.email, 120),
    direccion: str(body.direccion, 160),
    horario: str(body.horario, 120),
    instagram: str(body.instagram, 100).replace(/^@+/, ''),
    envio_costo: envioCosto,
    envio_gratis_desde: envioGratis,
    cupon_codigo: str(body.cupon_codigo, 30).toUpperCase(),
    cupon_descuento: descuento,
    actualizado_en: new Date().toISOString()
  };

  const { data, error } = await db()
    .from('configuracion')
    .update(patch)
    .eq('id', row.id)
    .select('*')
    .single();

  if (error) throw error;
  return json(200, { config: data, message: 'Configuración guardada.' });
});

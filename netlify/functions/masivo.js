const { db } = require('./lib/supabase');
const { json, parseBody, wrap, methodNotAllowed } = require('./lib/http');
const { requireUser } = require('./lib/auth');
const { fetchAllProducts, parseNum } = require('./lib/helpers');

function money(n) {
  const value = Number(n) || 0;
  return '$ ' + value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

function resumenOps(ops, catNombre) {
  const out = [];
  const precioVal = parseNum(ops.valor_precio);
  const stockVal = parseNum(ops.valor_stock);
  const antVal = parseNum(ops.valor_precio_ant);

  switch (ops.precio) {
    case 'set':
      out.push('Precio fijado en ' + money(precioVal));
      break;
    case 'inc':
      out.push('Precio + ' + money(precioVal));
      break;
    case 'dec':
      out.push('Precio - ' + money(precioVal));
      break;
    case 'pct_inc':
      out.push('Precio +' + (Number(precioVal) || 0) + '%');
      break;
    case 'pct_dec':
      out.push('Precio -' + (Number(precioVal) || 0) + '%');
      break;
    case 'round':
      out.push('Precio redondeado al entero');
      break;
    default:
      break;
  }

  switch (ops.precio_ant) {
    case 'set':
      out.push('Precio anterior fijado en ' + money(antVal));
      break;
    case 'equal':
      out.push('Precio anterior = precio actual');
      break;
    case 'clear':
      out.push('Precio anterior borrado');
      break;
    default:
      break;
  }

  switch (ops.stock) {
    case 'set':
      out.push('Stock fijado en ' + (parseInt(stockVal, 10) || 0));
      break;
    case 'inc':
      out.push('Stock + ' + (parseInt(stockVal, 10) || 0));
      break;
    case 'dec':
      out.push('Stock - ' + (parseInt(stockVal, 10) || 0));
      break;
    default:
      break;
  }

  if (ops.cat) out.push('Categoría → ' + (catNombre || ops.cat));
  if (ops.activo !== '' && ops.activo !== undefined && ops.activo !== null) {
    out.push('Estado → ' + (String(ops.activo) === '1' ? 'Activo' : 'Inactivo'));
  }
  if (ops.destacado !== '' && ops.destacado !== undefined && ops.destacado !== null) {
    out.push('Destacado → ' + (String(ops.destacado) === '1' ? 'Sí' : 'No'));
  }
  return out;
}

exports.handler = wrap(async (event) => {
  const user = requireUser(event);
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  const body = parseBody(event);
  if (!body) return json(400, { error: 'Cuerpo inválido.' });

  const filtros = body.filtros || {};
  const ops = body.ops || {};
  const filters = {
    q: filtros.q || '',
    cat: parseInt(filtros.cat, 10) || 0,
    estado: filtros.estado || '',
    dest: false
  };

  let catNombre = null;
  if (ops.cat) {
    const { data, error } = await db()
      .from('categorias')
      .select('nombre')
      .eq('id', parseInt(ops.cat, 10))
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    catNombre = data ? data.nombre : null;
  }

  const resumen = resumenOps(ops, catNombre);
  const lista = await fetchAllProducts(filters, false);

  if (!body.apply) {
    return json(200, { afectados: lista.length, resumen, aplicado: false });
  }

  if (!resumen.length) {
    return json(400, { error: 'No elegiste ninguna operación para aplicar.' });
  }

  const precioVal = parseNum(ops.valor_precio);
  const stockVal = parseInt(parseNum(ops.valor_stock), 10) || 0;
  const antVal = parseNum(ops.valor_precio_ant);
  const uid = user.uid;

  const updates = [];
  const movs = [];

  for (const p of lista) {
    let precio = Number(p.precio) || 0;
    let stock = parseInt(p.stock, 10) || 0;
    let precioAnt = p.precio_anterior === null ? null : Number(p.precio_anterior);
    let catId = p.categoria_id === null ? null : Number(p.categoria_id);
    let activo = !!p.activo;
    let destacado = !!p.destacado;
    const origPrecio = precio;
    const origStock = stock;

    if (precioVal !== null) {
      if (ops.precio === 'set') precio = precioVal;
      else if (ops.precio === 'inc') precio += precioVal;
      else if (ops.precio === 'dec') precio -= precioVal;
      else if (ops.precio === 'pct_inc') precio = precio * (1 + precioVal / 100);
      else if (ops.precio === 'pct_dec') precio = precio * (1 - precioVal / 100);
    }
    if (ops.precio === 'round') precio = Math.round(precio);
    precio = Math.max(0, Math.round(precio * 100) / 100);

    if (ops.precio_ant === 'set') precioAnt = antVal;
    else if (ops.precio_ant === 'equal') precioAnt = precio;
    else if (ops.precio_ant === 'clear') precioAnt = null;

    if (ops.stock === 'set') stock = stockVal;
    else if (ops.stock === 'inc') stock += stockVal;
    else if (ops.stock === 'dec') stock -= stockVal;
    stock = parseInt(stock, 10) || 0;

    if (ops.cat) catId = parseInt(ops.cat, 10);
    if (ops.activo !== '' && ops.activo !== undefined && ops.activo !== null) {
      activo = String(ops.activo) === '1';
    }
    if (ops.destacado !== '' && ops.destacado !== undefined && ops.destacado !== null) {
      destacado = String(ops.destacado) === '1';
    }

    updates.push({
      id: Number(p.id),
      precio,
      precio_anterior: precioAnt,
      stock,
      categoria_id: catId,
      activo,
      destacado
    });

    if (ops.precio && Math.abs(precio - origPrecio) > 0.001) {
      movs.push({
        producto_id: Number(p.id),
        campo: 'precio',
        tipo: ops.precio,
        valor: String(precio),
        motivo: 'Actualización masiva',
        usuario_id: uid
      });
    }
    if (ops.stock && stock !== origStock) {
      movs.push({
        producto_id: Number(p.id),
        campo: 'stock',
        tipo: ops.stock,
        valor: String(stock),
        motivo: 'Actualización masiva',
        usuario_id: uid
      });
    }
    if (ops.precio_ant) {
      movs.push({
        producto_id: Number(p.id),
        campo: 'precio_anterior',
        tipo: ops.precio_ant,
        valor: precioAnt === null ? '' : String(precioAnt),
        motivo: 'Actualización masiva',
        usuario_id: uid
      });
    }
  }

  const { error } = await db().rpc('aplicar_masivo', {
    p_updates: updates,
    p_movs: movs,
    p_uid: uid
  });
  if (error) throw error;

  return json(200, { afectados: lista.length, resumen, aplicado: true });
});

const { db } = require('./lib/supabase');
const { json, parseBody, wrap, methodNotAllowed, query } = require('./lib/http');
const { requireUser } = require('./lib/auth');
const { parseNum, parseBool, str, mapProduct } = require('./lib/helpers');

function idFrom(event) {
  const q = query(event);
  const id = parseInt(q.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error('ID inválido.');
    err.statusCode = 400;
    throw err;
  }
  return id;
}

function duplicateError(err) {
  if (err && err.code === '23505') {
    const e = new Error('Ya existe un producto con ese SKU.');
    e.statusCode = 409;
    return e;
  }
  return err;
}

exports.handler = wrap(async (event) => {
  requireUser(event);

  if (event.httpMethod === 'GET') {
    const id = idFrom(event);
    const { data, error } = await db()
      .from('productos')
      .select('*, categorias(nombre)')
      .eq('id', id)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return json(404, { error: 'El producto no existe.' });
    return json(200, { product: mapProduct(data) });
  }

  if (event.httpMethod === 'PATCH') {
    const body = parseBody(event);
    if (!body) return json(400, { error: 'Cuerpo inválido.' });
    const id = parseInt(body.id, 10);
    if (!Number.isFinite(id) || id <= 0) return json(400, { error: 'ID inválido.' });

    const nombre = str(body.nombre, 160);
    if (!nombre) return json(400, { error: 'El nombre es obligatorio.' });

    const precio = parseNum(body.precio);
    if (precio === null || precio < 0) {
      return json(400, { error: 'El precio es obligatorio y numérico.' });
    }

    const stock = parseInt(parseNum(body.stock), 10);
    const cat = parseInt(body.categoria_id, 10);

    const data = {
      sku: str(body.sku, 80) || null,
      nombre,
      categoria_id: Number.isFinite(cat) && cat > 0 ? cat : null,
      precio,
      precio_anterior: parseNum(body.precio_anterior),
      costo: parseNum(body.costo),
      stock: Number.isFinite(stock) ? stock : 0,
      descripcion: str(body.descripcion, 4000),
      imagen: str(body.imagen, 500),
      etiqueta: str(body.etiqueta, 60),
      destacado: parseBool(body.destacado),
      activo: parseBool(body.activo)
    };

    const { data: row, error } = await db()
      .from('productos')
      .update(data)
      .eq('id', id)
      .select('*, categorias(nombre)')
      .maybeSingle();

    if (error) throw duplicateError(error);
    if (!row) return json(404, { error: 'El producto no existe.' });
    return json(200, { product: mapProduct(row) });
  }

  if (event.httpMethod === 'DELETE') {
    const id = idFrom(event);
    const { error, count } = await db()
      .from('productos')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) throw error;
    if (!count) return json(404, { error: 'El producto no existe.' });
    return json(200, { ok: true });
  }

  return methodNotAllowed();
});

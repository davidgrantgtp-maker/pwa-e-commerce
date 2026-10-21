const { db } = require('./supabase');

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

async function uniqueSlug(table, base, excludeId) {
  const clean = slugify(base);
  let slug = clean;
  let i = 2;
  for (;;) {
    let q = db().from(table).select('id').eq('slug', slug).limit(1);
    if (excludeId) q = q.neq('id', excludeId);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || !data.length) return slug;
    slug = `${clean}-${i}`;
    i += 1;
    if (i > 500) throw new Error('No se pudo generar un slug único.');
  }
}

function parseNum(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  let s = String(value).trim().replace(/[^\d,.-]/g, '');
  if (!s) return null;

  const neg = s.charAt(0) === '-';
  s = s.replace(/-/g, '');

  const hasComma = s.indexOf(',') !== -1;
  const hasDot = s.indexOf('.') !== -1;

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = s.replace(',', '.');
  } else if (hasDot) {
    const parts = s.split('.');
    const last = parts[parts.length - 1];
    if (parts.length > 2 || last.length === 3) {
      s = parts.join('');
    }
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  const v = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'si' || v === 'sí' || v === 'on' || v === 'yes';
}

function str(value, max) {
  if (value === null || value === undefined) return '';
  const s = String(value).trim();
  return max ? s.slice(0, max) : s;
}

function safeLike(value) {
  return String(value || '')
    .replace(/[%(),*"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyProductFilters(q, f) {
  const busca = safeLike(f.q);
  if (busca) {
    const pat = `%${busca}%`;
    q = q.or(`nombre.ilike.${pat},sku.ilike.${pat},descripcion.ilike.${pat}`);
  }
  if (f.cat) q = q.eq('categoria_id', f.cat);
  if (f.estado === 'activos') q = q.eq('activo', true);
  else if (f.estado === 'inactivos') q = q.eq('activo', false);
  else if (f.estado === 'agotados') q = q.lte('stock', 0);
  else if (f.estado === 'bajo') q = q.gt('stock', 0).lte('stock', 5);
  if (f.dest) q = q.eq('destacado', true);
  return q;
}

async function fetchAllProducts(f, withCategory) {
  const all = [];
  const size = 1000;
  for (let from = 0; from < 50000; from += size) {
    let q = db().from('productos').select(withCategory ? '*, categorias(nombre)' : '*');
    q = applyProductFilters(q, f);
    q = q.order('id', { ascending: true }).range(from, from + size - 1);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return all;
}

function mapProduct(row) {
  if (!row) return row;
  const out = Object.assign({}, row);
  out.categoria = row.categorias ? row.categorias.nombre : null;
  delete out.categorias;
  return out;
}

function paging(event) {
  const q = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(q.per_page, 10) || 20));
  return { page, perPage, from: (page - 1) * perPage, to: page * perPage - 1 };
}

module.exports = {
  slugify,
  uniqueSlug,
  parseNum,
  parseBool,
  str,
  safeLike,
  mapProduct,
  paging,
  applyProductFilters,
  fetchAllProducts
};

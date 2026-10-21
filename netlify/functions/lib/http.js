function json(statusCode, data, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign(
      {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      },
      extraHeaders || {}
    ),
    body: JSON.stringify(data)
  };
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function getCookie(event, name) {
  const headers = event.headers || {};
  const raw = headers.cookie || headers.Cookie || '';
  const parts = raw.split(';');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const eq = part.indexOf('=');
    if (eq > -1 && part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

function query(event) {
  return event.queryStringParameters || {};
}

function friendlyError(err) {
  const code = err && err.code;
  const message = String((err && err.message) || '');
  if (
    code === 'PGRST205' ||
    code === 'PGRST202' ||
    /Could not find the table|Could not find the function/i.test(message)
  ) {
    return {
      status: 503,
      message: 'La base de datos no está instalada. Ejecutá sql/supabase_schema.sql en el SQL Editor de Supabase y volvé a intentar.'
    };
  }
  return { status: (err && err.statusCode) || 500, message: message || 'Error interno' };
}

function wrap(fn) {
  return async function (event, context) {
    try {
      return await fn(event, context);
    } catch (err) {
      const info = friendlyError(err);
      if (info.status >= 500 && info.status !== 503) console.error(err);
      return json(info.status, { error: info.message });
    }
  };
}

function methodNotAllowed() {
  return json(405, { error: 'Método no permitido' });
}

module.exports = { json, parseBody, getCookie, query, wrap, methodNotAllowed };

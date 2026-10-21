const { createClient } = require('@supabase/supabase-js');

let client = null;

function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    const err = new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY en las variables de entorno de Netlify.');
    err.statusCode = 500;
    throw err;
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return client;
}

module.exports = { db };

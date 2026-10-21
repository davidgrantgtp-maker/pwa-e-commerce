const { json, wrap } = require('./lib/http');
const { clearCookieHeader } = require('./lib/auth');

exports.handler = wrap(async () => {
  return json(200, { ok: true }, { 'Set-Cookie': clearCookieHeader() });
});

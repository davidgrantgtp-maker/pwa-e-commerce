const jwt = require('jsonwebtoken');
const { getCookie } = require('./http');

const COOKIE_NAME = 'miapp_admin';
const MAX_AGE = 60 * 60 * 8;

function secret() {
  const value = process.env.ADMIN_JWT_SECRET;
  if (!value) {
    const err = new Error('Falta ADMIN_JWT_SECRET en las variables de entorno de Netlify.');
    err.statusCode = 500;
    throw err;
  }
  return value;
}

function sign(user) {
  return jwt.sign(
    { uid: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
    secret(),
    { expiresIn: MAX_AGE }
  );
}

function userFromEvent(event) {
  const token = getCookie(event, COOKIE_NAME);
  if (!token) return null;
  try {
    return jwt.verify(token, secret());
  } catch (err) {
    return null;
  }
}

function requireUser(event) {
  const user = userFromEvent(event);
  if (!user) {
    const err = new Error('Sesión expirada. Iniciá sesión de nuevo.');
    err.statusCode = 401;
    throw err;
  }
  return user;
}

function isSecure() {
  const url = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
  if (url) return url.indexOf('https://') === 0;
  return !process.env.NETLIFY_DEV;
}

function cookieHeader(token) {
  const secure = isSecure() ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

function clearCookieHeader() {
  const secure = isSecure() ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`;
}

module.exports = { sign, userFromEvent, requireUser, cookieHeader, clearCookieHeader };

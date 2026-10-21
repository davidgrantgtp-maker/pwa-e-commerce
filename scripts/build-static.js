/**
 * Build de Netlify: copia SOLO archivos públicos a dist/.
 * Nunca se publican PHP, config/ (claves), includes/, lib/, sql/ ni netlify/.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function rm(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copy(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

rm(dist);
fs.mkdirSync(dist, { recursive: true });

const pages = [
  'index.html',
  'producto.html',
  'carrito.html',
  'checkout.html',
  'pedido.html',
  'pedidos.html',
  'perfil.html',
  'contacto.html',
  'manifest.json',
  'sw.js'
];
pages.forEach((f) => copy(path.join(root, f), path.join(dist, f)));

['css', 'js', 'img', 'icons'].forEach((dir) => {
  copy(path.join(root, dir), path.join(dist, dir));
});

// Imágenes subidas con el panel PHP anterior (si existen).
copy(path.join(root, 'uploads'), path.join(dist, 'uploads'));

// Panel estático.
copy(path.join(root, 'admin', 'index.html'), path.join(dist, 'admin', 'index.html'));
copy(path.join(root, 'admin', 'assets'), path.join(dist, 'admin', 'assets'));

// Nunca publicar el service worker control remoto ni archivos de sistema.
rm(path.join(dist, 'config'));
rm(path.join(dist, 'includes'));

console.log('Build estático listo en dist/');

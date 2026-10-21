const CACHE = 'miapp-store-v4';
const ASSETS = [
  './',
  './index.html',
  './producto.html',
  './carrito.html',
  './checkout.html',
  './pedido.html',
  './pedidos.html',
  './contacto.html',
  './perfil.html',
  './manifest.json',
  './css/styles.css',
  './js/supabase-config.js',
  './js/products.js',
  './js/shop.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './img/placeholder.svg',
  './img/cafe-grano.svg',
  './img/cafe-molido.svg',
  './img/cold-brew.svg',
  './img/matcha-latte.svg',
  './img/medialunas.svg',
  './img/torta-chocolate.svg',
  './img/taza-ceramica.svg',
  './img/termo.svg',
  './img/prensa-francesa.svg',
  './img/combo-desayuno.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // El panel de administración y el instalador nunca se cachean.
  if (url.pathname.indexOf('/admin/') !== -1 || url.pathname.indexOf('/install.php') !== -1) return;

  // API: red primero, caché como respaldo offline.
  if (url.pathname.indexOf('/api/') !== -1) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || network;
    })
  );
});

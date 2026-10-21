const CACHE = 'miapp-store-v5';
const PRECACHE = [
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
  './js/storefront.js',
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

const IMAGE = /\.(?:png|jpe?g|webp|gif|svg|avif|ico)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallback) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (fallback) {
      const offline = await cache.match(fallback);
      if (offline) return offline;
    }
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) {
    fetch(request)
      .then((response) => {
        if (response && response.ok) cache.put(request, response.clone());
      })
      .catch(() => {});
    return cached;
  }
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // El panel, las funciones y el instalador siempre van directo a la red.
  if (url.pathname.includes('/admin') || url.pathname.includes('/install.php') || url.pathname.includes('/.netlify/')) return;

  if (event.request.mode === 'navigate' || /\.(?:html|css|js|json|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(networkFirst(event.request, './index.html'));
    return;
  }

  if (IMAGE.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

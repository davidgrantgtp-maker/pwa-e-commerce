/* MiApp Store - catálogo: semilla local + caché + API (base de datos) */
(function () {
  'use strict';

  var SEED = [
    {
      id: 'cafe-grano', name: 'Café en grano 500 g', category: 'Cafés', price: 8500, oldPrice: 9900,
      tag: 'Más vendido', featured: true, image: 'https://picsum.photos/seed/miapp-cafe-grano/600/600',
      fallback: 'img/cafe-grano.svg',
      description: 'Blend de especialidad tostado medio. Notas a chocolate, avellanas y frutas rojas. Ideal para espresso o prensa francesa.'
    },
    {
      id: 'cafe-molido', name: 'Café molido 250 g', category: 'Cafés', price: 5200, oldPrice: null,
      tag: '', featured: false, image: 'https://picsum.photos/seed/miapp-cafe-molido/600/600',
      fallback: 'img/cafe-molido.svg',
      description: 'Molienda media para filtro. Práctico para preparar en casa sin molinillo. Origen Colombia, tueste artesanal.'
    },
    {
      id: 'cold-brew', name: 'Cold brew 1 L', category: 'Bebidas', price: 4800, oldPrice: null,
      tag: 'Nuevo', featured: true, image: 'https://picsum.photos/seed/miapp-cold-brew/600/600',
      fallback: 'img/cold-brew.svg',
      description: 'Café extraído en frío durante 18 horas. Suave, dulce y con baja acidez. Se conserva 7 días en heladera.'
    },
    {
      id: 'matcha-latte', name: 'Matcha latte', category: 'Bebidas', price: 4200, oldPrice: null,
      tag: '', featured: false, image: 'https://picsum.photos/seed/miapp-matcha/600/600',
      fallback: 'img/matcha-latte.svg',
      description: 'Matcha ceremonial japonés con leche. Servido frío o caliente. Sin azúcar agregada.'
    },
    {
      id: 'medialunas', name: 'Medialunas x6', category: 'Comida', price: 3600, oldPrice: null,
      tag: 'Recién horneadas', featured: true, image: 'https://picsum.photos/seed/miapp-medialunas/600/600',
      fallback: 'img/medialunas.svg',
      description: 'Medialunas de manteca horneadas cada mañana. Media docena ideal para compartir con un café.'
    },
    {
      id: 'torta-chocolate', name: 'Torta de chocolate', category: 'Comida', price: 7900, oldPrice: null,
      tag: '', featured: false, image: 'https://picsum.photos/seed/miapp-torta/600/600',
      fallback: 'img/torta-chocolate.svg',
      description: 'Bizcochuelo húmedo de cacao con ganache de chocolate semiamargo. Porción para 6 personas.'
    },
    {
      id: 'taza-ceramica', name: 'Taza de cerámica', category: 'Accesorios', price: 6500, oldPrice: null,
      tag: '', featured: false, image: 'https://picsum.photos/seed/miapp-taza/600/600',
      fallback: 'img/taza-ceramica.svg',
      description: 'Taza de 300 ml hecha a mano. Terminación mate, apta para microondas y lavavajillas.'
    },
    {
      id: 'termo', name: 'Termo 500 ml', category: 'Accesorios', price: 12900, oldPrice: 14900,
      tag: 'Envío gratis', featured: true, image: 'https://picsum.photos/seed/miapp-termo/600/600',
      fallback: 'img/termo.svg',
      description: 'Termo de acero inoxidable con doble pared. Mantiene la temperatura hasta 12 horas. Tapa hermética.'
    },
    {
      id: 'prensa-francesa', name: 'Prensa francesa', category: 'Accesorios', price: 18500, oldPrice: null,
      tag: '', featured: false, image: 'https://picsum.photos/seed/miapp-prensa/600/600',
      fallback: 'img/prensa-francesa.svg',
      description: 'Prensa francesa de vidrio borosilicato de 600 ml con filtro de acero. Para 3 tazas.'
    },
    {
      id: 'combo-desayuno', name: 'Combo desayuno', category: 'Comida', price: 14500, oldPrice: 16400,
      tag: 'Ahorrás $1.900', featured: true, image: 'https://picsum.photos/seed/miapp-combo/600/600',
      fallback: 'img/combo-desayuno.svg',
      description: 'Café en grano 250 g + 6 medialunas + taza de cerámica. Todo lo necesario para arrancar el día.'
    }
  ];

  var PRODUCTS_KEY = 'miapp_products_cache_v1';
  var CATS_KEY = 'miapp_categories_cache_v1';

  function readCache(key) {
    try {
      var value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) && value.length ? value : null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function deriveCategories(list) {
    var out = ['Todos'];
    (list || []).forEach(function (p) {
      if (p.category && out.indexOf(p.category) < 0) out.push(p.category);
    });
    return out;
  }

  function normalizeCats(apiCats) {
    if (!Array.isArray(apiCats) || !apiCats.length) return null;
    var names = [];
    apiCats.forEach(function (c) {
      var name = typeof c === 'string' ? c : c.name;
      if (name && names.indexOf(name) < 0) names.push(name);
    });
    if (names.indexOf('Todos') < 0) names.unshift('Todos');
    return names.length > 1 ? names : null;
  }

  var cachedProducts = readCache(PRODUCTS_KEY);
  var cachedCats = readCache(CATS_KEY);

  window.PRODUCTS = cachedProducts || SEED;
  window.CATEGORIES = cachedCats || deriveCategories(window.PRODUCTS);

  function notify() {
    try {
      document.dispatchEvent(new CustomEvent('products:updated'));
    } catch (e) {
      var evt = document.createEvent('Event');
      evt.initEvent('products:updated', true, true);
      document.dispatchEvent(evt);
    }
  }

  function apply(products, cats) {
    window.PRODUCTS = products;
    window.CATEGORIES = cats || deriveCategories(products);
    writeCache(PRODUCTS_KEY, window.PRODUCTS);
    writeCache(CATS_KEY, window.CATEGORIES);
    notify();
  }

  var loading = false;
  var queue = [];

  function loadProducts(cb) {
    if (typeof cb === 'function') {
      if (loading) { queue.push(cb); } else { queue.push(cb); }
    }
    if (loading) return;
    loading = true;

    var productsReq = fetch('./api/productos.php', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('API productos');
      return r.json();
    });

    var catsReq = fetch('./api/categorias.php', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('API categorías');
      return r.json();
    }).catch(function () { return null; });

    Promise.all([productsReq, catsReq]).then(function (res) {
      var products = res[0];
      var cats = normalizeCats(res[1]);
      if (Array.isArray(products) && products.length) {
        apply(products, cats);
      } else if (cats) {
        window.CATEGORIES = cats;
        writeCache(CATS_KEY, cats);
        notify();
      }
    }).catch(function () {
      /* sin conexión o API no disponible: se usa caché o semilla */
    }).then(function () {
      loading = false;
      var cbs = queue.slice();
      queue = [];
      cbs.forEach(function (fn) { try { fn(); } catch (e) {} });
    });
  }

  window.loadProducts = loadProducts;
  loadProducts();
})();

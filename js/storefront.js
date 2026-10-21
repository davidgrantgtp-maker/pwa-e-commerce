/* MiApp Store - configuración pública del vendedor y banners (Supabase REST) */
(function () {
  'use strict';

  var CONFIG_KEY = 'miapp_store_config_v1';
  var BANNERS_KEY = 'miapp_banners_v1';
  var REFRESH_MS = 30000;

  var DEFAULT_CONFIG = {
    storeName: 'MiApp Store',
    sellerName: '',
    whatsapp: '',
    email: 'hola@miapp.store',
    address: '',
    hours: 'Lun a Vie · 9 a 18h',
    instagram: '',
    envioCosto: 1490,
    envioGratisDesde: 15000,
    cuponCodigo: 'DEMO10',
    cuponDescuento: 10
  };

  var DEFAULT_BANNERS = [
    {
      id: 'oferta',
      title: '2x1 en cafés',
      subtitle: 'Todos los martes, en grano o molido. Stock limitado.',
      tag: 'OFERTA',
      button: 'Aprovechar',
      link: '#catalogo',
      image: ''
    },
    {
      id: 'rapido',
      title: 'Compra rápida',
      subtitle: 'Elegí, confirmá y enviá tu pedido por WhatsApp en 2 minutos.',
      tag: 'RÁPIDO',
      button: 'Comprar ahora',
      link: '#catalogo',
      image: ''
    },
    {
      id: 'envio',
      title: 'Envío gratis desde $15.000',
      subtitle: 'A todo el país. Retiro en el local sin costo.',
      tag: 'ENVÍO',
      button: 'Ver productos',
      link: '#catalogo',
      image: ''
    }
  ];

  function readJSON(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key));
      return value === null || value === undefined ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function restGet(path, params) {
    var cfg = window.SUPABASE_CONFIG;
    if (!cfg || !cfg.url || !cfg.anonKey) {
      return Promise.reject(new Error('Supabase no configurado'));
    }
    var query = new URLSearchParams(params).toString();
    return fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/' + path + '?' + query, {
      headers: {
        apikey: cfg.anonKey,
        Authorization: 'Bearer ' + cfg.anonKey
      },
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('Supabase ' + r.status);
      return r.json();
    });
  }

  function mapConfig(row) {
    row = row || {};
    return {
      storeName: row.tienda_nombre || DEFAULT_CONFIG.storeName,
      sellerName: row.vendedor_nombre || '',
      whatsapp: row.whatsapp || '',
      email: row.email || '',
      address: row.direccion || '',
      hours: row.horario || '',
      instagram: row.instagram || '',
      envioCosto: row.envio_costo === null || row.envio_costo === undefined ? DEFAULT_CONFIG.envioCosto : Number(row.envio_costo),
      envioGratisDesde: row.envio_gratis_desde === null || row.envio_gratis_desde === undefined ? DEFAULT_CONFIG.envioGratisDesde : Number(row.envio_gratis_desde),
      cuponCodigo: row.cupon_codigo || '',
      cuponDescuento: row.cupon_descuento === null || row.cupon_descuento === undefined ? DEFAULT_CONFIG.cuponDescuento : Number(row.cupon_descuento)
    };
  }

  function mapBanner(row) {
    return {
      id: String(row.id),
      title: row.titulo || '',
      subtitle: row.subtitulo || '',
      tag: row.etiqueta || '',
      button: row.texto_boton || 'Ver más',
      link: row.enlace || '#catalogo',
      image: row.imagen || ''
    };
  }

  window.STORE_CONFIG_REMOTE = false;

  var cachedConfig = readJSON(CONFIG_KEY, null);
  window.STORE_CONFIG = Object.assign(
    {},
    DEFAULT_CONFIG,
    cachedConfig && typeof cachedConfig === 'object' && !Array.isArray(cachedConfig) ? cachedConfig : {}
  );

  var cachedBanners = readJSON(BANNERS_KEY, null);
  window.BANNERS = Array.isArray(cachedBanners) && cachedBanners.length ? cachedBanners : DEFAULT_BANNERS;

  var loading = false;
  var lastLoad = 0;

  function notify(kind) {
    try {
      document.dispatchEvent(new CustomEvent(kind));
    } catch (e) {
      var evt = document.createEvent('Event');
      evt.initEvent(kind, true, true);
      document.dispatchEvent(evt);
    }
  }

  function load(force) {
    if (loading) return Promise.resolve();
    var now = Date.now();
    if (!force && now - lastLoad < REFRESH_MS) return Promise.resolve();
    loading = true;

    var configReq = restGet('configuracion', {
      select: '*',
      id: 'eq.1',
      limit: '1'
    }).catch(function () { return null; });

    var bannersReq = restGet('banners', {
      select: 'id,titulo,subtitulo,etiqueta,texto_boton,enlace,imagen,activo,orden',
      activo: 'is.true',
      order: 'orden.asc,id.asc'
    }).catch(function () { return null; });

    return Promise.all([configReq, bannersReq]).then(function (res) {
      var configRows = res[0];
      var bannerRows = res[1];

      if (Array.isArray(configRows) && configRows.length) {
        window.STORE_CONFIG = Object.assign({}, DEFAULT_CONFIG, mapConfig(configRows[0]));
        window.STORE_CONFIG_REMOTE = true;
        writeJSON(CONFIG_KEY, window.STORE_CONFIG);
      }

      if (Array.isArray(bannerRows)) {
        var banners = bannerRows.map(mapBanner).filter(function (b) { return b.title; });
        window.BANNERS = banners.length ? banners : DEFAULT_BANNERS;
        writeJSON(BANNERS_KEY, window.BANNERS);
      }

      lastLoad = Date.now();
      notify('store:updated');
      notify('banners:updated');
    }).catch(function () {
      /* offline: se usa la caché o los valores por defecto */
    }).then(function () {
      loading = false;
    });
  }

  window.refreshStorefront = function (force) {
    return load(!!force);
  };

  window.STOREFRONT_READY = load(true);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') load(true);
  });
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) load(true);
  });
  window.addEventListener('focus', function () {
    load(false);
  });
})();

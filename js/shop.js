/* MiApp Store - carrito, pedidos, comprador y WhatsApp (localStorage + Supabase) */
(function () {
  'use strict';

  var CART_KEY = 'miapp_cart_v1';
  var ORDERS_KEY = 'miapp_orders_v1';
  var SETTINGS_KEY = 'miapp_settings_v1';
  var BUYER_KEY = 'miapp_buyer_v1';
  var COUPON_KEY = 'miapp_coupon_v1';

  var DEFAULTS = {
    notif: true,
    dark: true,
    idioma: 'es',
    sellerPhone: '',
    whatsapp: '',
    storeName: 'MiApp Store',
    email: '',
    address: '',
    hours: '',
    instagram: '',
    envioCosto: 1490,
    envioGratisDesde: 15000,
    cuponCodigo: 'DEMO10',
    cuponDescuento: 10
  };

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

  function formatMoney(amount) {
    var n = Math.round(Number(amount) || 0);
    return '$' + n.toLocaleString('es-AR');
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function getProduct(id) {
    var list = window.PRODUCTS || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function getSettings() {
    var prefs = readJSON(SETTINGS_KEY, {});
    var remote = window.STORE_CONFIG || {};
    var settings = Object.assign({}, DEFAULTS, remote);

    settings.dark = prefs.dark === undefined ? DEFAULTS.dark : !!prefs.dark;
    settings.notif = prefs.notif === undefined ? DEFAULTS.notif : !!prefs.notif;
    settings.idioma = prefs.idioma || DEFAULTS.idioma;

    // Compatibilidad con instalaciones anteriores: el WhatsApp y el nombre
    // del vendedor ahora vienen del panel, pero si todavía no se configuraron
    // se conserva el valor local como respaldo.
    if (!window.STORE_CONFIG_REMOTE) {
      if (!settings.whatsapp && prefs.sellerPhone) settings.whatsapp = prefs.sellerPhone;
      if (!settings.storeName && prefs.storeName) settings.storeName = prefs.storeName;
    }
    settings.sellerPhone = settings.whatsapp;

    return settings;
  }

  function saveSettings(patch) {
    patch = patch || {};
    var prefs = readJSON(SETTINGS_KEY, {});
    if (patch.dark !== undefined) prefs.dark = !!patch.dark;
    if (patch.notif !== undefined) prefs.notif = !!patch.notif;
    if (patch.idioma !== undefined) prefs.idioma = patch.idioma;
    writeJSON(SETTINGS_KEY, prefs);
  }

  function getBuyer() {
    var buyer = readJSON(BUYER_KEY, null);
    if (!buyer || typeof buyer !== 'object' || Array.isArray(buyer)) buyer = {};
    var legacy = readJSON(SETTINGS_KEY, {});
    return {
      nombre: buyer.nombre || legacy.nombre || '',
      telefono: buyer.telefono || '',
      email: buyer.email || legacy.email || '',
      direccion: buyer.direccion || '',
      ciudad: buyer.ciudad || '',
      notas: buyer.notas || ''
    };
  }

  function saveBuyer(patch) {
    writeJSON(BUYER_KEY, Object.assign(getBuyer(), patch || {}));
  }

  function getCart() {
    var cart = readJSON(CART_KEY, {});
    if (!cart || typeof cart !== 'object' || Array.isArray(cart)) return {};
    return cart;
  }

  function cartCount() {
    var cart = getCart();
    return Object.keys(cart).reduce(function (sum, id) {
      return sum + (Number(cart[id]) || 0);
    }, 0);
  }

  function setCart(cart) {
    writeJSON(CART_KEY, cart);
    if (!Object.keys(cart).length) setCoupon('');
    updateBadges();
  }

  function addToCart(id, qty) {
    if (!getProduct(id)) return false;
    var cart = getCart();
    cart[id] = Math.min((Number(cart[id]) || 0) + (Number(qty) || 1), 99);
    setCart(cart);
    return true;
  }

  function updateQty(id, qty) {
    var cart = getCart();
    var next = Number(qty) || 0;
    if (next <= 0) {
      delete cart[id];
    } else {
      cart[id] = Math.min(next, 99);
    }
    setCart(cart);
  }

  function removeFromCart(id) {
    var cart = getCart();
    delete cart[id];
    setCart(cart);
  }

  function clearCart() {
    localStorage.removeItem(CART_KEY);
    setCoupon('');
    updateBadges();
  }

  function cartItems() {
    var cart = getCart();
    return Object.keys(cart).map(function (id) {
      var product = getProduct(id);
      if (!product) return null;
      var qty = Math.max(0, Number(cart[id]) || 0);
      if (!qty) return null;
      return { id: id, product: product, qty: qty, subtotal: product.price * qty };
    }).filter(Boolean);
  }

  function getCoupon() {
    return localStorage.getItem(COUPON_KEY) || '';
  }

  function setCoupon(code) {
    if (code) {
      localStorage.setItem(COUPON_KEY, code);
    } else {
      localStorage.removeItem(COUPON_KEY);
    }
  }

  function couponConfig() {
    var settings = getSettings();
    return {
      code: String(settings.cuponCodigo || '').trim().toUpperCase(),
      percent: Math.max(0, Math.min(100, Number(settings.cuponDescuento) || 0))
    };
  }

  function applyCoupon(code) {
    var normalized = String(code || '').trim().toUpperCase();
    var coupon = couponConfig();
    if (!normalized) {
      setCoupon('');
      return { ok: true, message: 'Cupón quitado.' };
    }
    if (coupon.code && normalized === coupon.code) {
      setCoupon(normalized);
      return { ok: true, message: 'Cupón aplicado: ' + coupon.percent + '% de descuento.' };
    }
    return {
      ok: false,
      message: coupon.code ? 'Cupón inválido.' : 'La tienda no tiene cupones activos.'
    };
  }

  function discountFor(subtotal) {
    var coupon = couponConfig();
    if (!coupon.code || getCoupon() !== coupon.code) return 0;
    return Math.round(subtotal * (coupon.percent / 100));
  }

  function totals() {
    var items = cartItems();
    var subtotal = items.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
    var discount = discountFor(subtotal);
    var settings = getSettings();
    var shipping = 0;
    if (items.length) {
      shipping = subtotal >= settings.envioGratisDesde ? 0 : settings.envioCosto;
    }
    return {
      items: items,
      count: cartCount(),
      subtotal: subtotal,
      discount: discount,
      shipping: shipping,
      total: Math.max(0, subtotal - discount + shipping),
      shippingCost: settings.envioCosto,
      freeFrom: settings.envioGratisDesde,
      coupon: getCoupon()
    };
  }

  function getOrders() {
    var list = readJSON(ORDERS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function saveOrders(list) {
    writeJSON(ORDERS_KEY, list);
  }

  function makeOrderId() {
    return 'PED-' + Date.now().toString(36).toUpperCase().slice(-6);
  }

  function createOrder(customer) {
    var cart = totals();
    if (!cart.items.length) return null;
    var shipping = customer.delivery === 'retiro' ? 0 : cart.shipping;
    var total = Math.max(0, cart.subtotal - cart.discount + shipping);
    var order = {
      id: makeOrderId(),
      date: new Date().toISOString(),
      items: cart.items.map(function (item) {
        return {
          id: item.id,
          name: item.product.name,
          price: item.product.price,
          qty: item.qty,
          subtotal: item.subtotal
        };
      }),
      subtotal: cart.subtotal,
      discount: cart.discount,
      shipping: shipping,
      total: total,
      coupon: cart.coupon,
      customer: customer,
      status: 'pendiente'
    };
    var list = getOrders();
    list.unshift(order);
    saveOrders(list);
    clearCart();
    return order;
  }

  function findOrder(id) {
    var list = getOrders();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function orderMessage(order) {
    var settings = getSettings();
    var lines = [];
    lines.push('*Nuevo pedido ' + order.id + '*');
    lines.push('Tienda: ' + settings.storeName);
    lines.push('');
    lines.push('*Productos*');
    order.items.forEach(function (item) {
      lines.push('• ' + item.qty + ' x ' + item.name + ' — ' + formatMoney(item.subtotal));
    });
    lines.push('');
    lines.push('Subtotal: ' + formatMoney(order.subtotal));
    if (order.discount) lines.push('Descuento: -' + formatMoney(order.discount));
    lines.push('Envío: ' + (order.shipping === 0 ? 'Gratis' : formatMoney(order.shipping)));
    lines.push('*Total: ' + formatMoney(order.total) + '*');
    lines.push('');
    lines.push('*Datos del cliente*');
    lines.push('Nombre: ' + order.customer.name);
    lines.push('Teléfono: ' + order.customer.phone);
    lines.push('Entrega: ' + (order.customer.delivery === 'retiro' ? 'Retiro en local' : 'Envío a domicilio'));
    if (order.customer.delivery !== 'retiro' && order.customer.address) {
      lines.push('Dirección: ' + order.customer.address);
    }
    lines.push('Pago: ' + (order.customer.payment === 'transferencia' ? 'Transferencia' : 'Efectivo'));
    if (order.customer.notes) lines.push('Notas: ' + order.customer.notes);
    lines.push('');
    lines.push('Pedido generado desde la app. Confirmar disponibilidad y horario.');
    return lines.join('\n');
  }

  function whatsappLink(order) {
    var phone = normalizePhone(getSettings().whatsapp || getSettings().sellerPhone);
    if (!phone) return '';
    return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(orderMessage(order));
  }

  function updateBadges() {
    var count = cartCount();
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = count;
      el.classList.toggle('hidden', count === 0);
    });
    var pending = getOrders().filter(function (order) { return order.status === 'pendiente'; }).length;
    document.querySelectorAll('[data-orders-count]').forEach(function (el) {
      el.textContent = pending;
      el.classList.toggle('hidden', pending === 0);
    });
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch (e) {
      return '';
    }
  }

  function formatDateTime(iso) {
    try {
      return new Date(iso).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  }

  document.addEventListener('DOMContentLoaded', updateBadges);

  window.Shop = {
    formatMoney: formatMoney,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    escapeHtml: escapeHtml,
    getProduct: getProduct,
    getSettings: getSettings,
    saveSettings: saveSettings,
    getBuyer: getBuyer,
    saveBuyer: saveBuyer,
    getCart: getCart,
    setCart: setCart,
    addToCart: addToCart,
    updateQty: updateQty,
    removeFromCart: removeFromCart,
    clearCart: clearCart,
    cartItems: cartItems,
    cartCount: cartCount,
    totals: totals,
    getCoupon: getCoupon,
    applyCoupon: applyCoupon,
    getOrders: getOrders,
    createOrder: createOrder,
    findOrder: findOrder,
    normalizePhone: normalizePhone,
    orderMessage: orderMessage,
    whatsappLink: whatsappLink,
    updateBadges: updateBadges,
    get couponCode() { return couponConfig().code; }
  };
})();

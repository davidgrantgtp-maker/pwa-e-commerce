/* MiApp Store - carrito, pedidos y WhatsApp con localStorage (sin backend) */
(function () {
  'use strict';

  var CART_KEY = 'miapp_cart_v1';
  var ORDERS_KEY = 'miapp_orders_v1';
  var SETTINGS_KEY = 'miapp_settings_v1';
  var COUPON_KEY = 'miapp_coupon_v1';
  var COUPON_CODE = 'DEMO10';

  var DEFAULTS = {
    nombre: 'Usuario Demo',
    notif: true,
    dark: true,
    idioma: 'es',
    sellerPhone: '',
    storeName: 'MiApp Store',
    envioCosto: 1490,
    envioGratisDesde: 15000
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
    return Object.assign({}, DEFAULTS, readJSON(SETTINGS_KEY, {}));
  }

  function saveSettings(patch) {
    writeJSON(SETTINGS_KEY, Object.assign(getSettings(), patch || {}));
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

  function applyCoupon(code) {
    var normalized = String(code || '').trim().toUpperCase();
    if (!normalized) {
      setCoupon('');
      return { ok: true, message: 'Cupón quitado.' };
    }
    if (normalized === COUPON_CODE) {
      setCoupon(normalized);
      return { ok: true, message: 'Cupón aplicado: 10% de descuento.' };
    }
    return { ok: false, message: 'Cupón inválido. Probá con DEMO10.' };
  }

  function discountFor(subtotal) {
    return getCoupon() === COUPON_CODE ? Math.round(subtotal * 0.1) : 0;
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
    var phone = normalizePhone(getSettings().sellerPhone);
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
    couponCode: COUPON_CODE
  };
})();

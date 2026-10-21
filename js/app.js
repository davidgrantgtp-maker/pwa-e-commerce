/* MiApp Store - PWA, navegación, perfil del comprador y utilidades */
(function () {
  'use strict';

  var hadController = !!(navigator.serviceWorker && navigator.serviceWorker.controller);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function (reg) {
        function update() {
          reg.update().catch(function () {});
        }
        update();
        setInterval(update, 30 * 60 * 1000);
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') update();
        });
      }).catch(function (err) {
        console.log('SW no registrado:', err);
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || window.__swRefreshing) return;
      window.__swRefreshing = true;
      window.location.reload();
    });
  }

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }
  window.miappToast = toast;

  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-page');
    if (page) {
      document.querySelectorAll('.tab-link').forEach(function (a) {
        if (a.getAttribute('data-tab') === page) a.classList.add('active');
      });
    }

    var settings = Shop.getSettings();
    paintStoreName(settings);

    var deferredPrompt = null;
    var btnInstall = document.getElementById('btn-install');
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (btnInstall) btnInstall.classList.add('visible');
    });
    if (btnInstall) {
      btnInstall.addEventListener('click', async function () {
        if (!deferredPrompt) {
          toast('En iPhone: Compartir → Añadir a pantalla de inicio');
          return;
        }
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        btnInstall.classList.remove('visible');
      });
    }

    var contactForm = document.getElementById('contact-form');
    if (contactForm) {
      contactForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = document.getElementById('c-nombre').value.trim();
        toast(name ? 'Gracias ' + name + ', mensaje demo registrado' : 'Mensaje demo registrado');
        contactForm.reset();
      });
    }

    var elNombre = document.getElementById('p-nombre');
    var elTel = document.getElementById('p-tel');
    var elEmail = document.getElementById('p-email');
    var elDir = document.getElementById('p-dir');
    var elCiudad = document.getElementById('p-ciudad');
    var elNotas = document.getElementById('p-notas');
    var elNotif = document.getElementById('set-notif');
    var elDark = document.getElementById('set-dark');
    var elIdioma = document.getElementById('set-idioma');
    var elAvatar = document.getElementById('p-avatar');
    var btnSave = document.getElementById('p-save');

    function buyer() {
      return Shop.getBuyer();
    }

    function paintAvatar(name) {
      if (!elAvatar) return;
      elAvatar.textContent = (name || 'U').trim().charAt(0).toUpperCase();
    }

    if (elNombre) {
      var current = buyer();
      elNombre.value = current.nombre || '';
      if (elTel) elTel.value = current.telefono || '';
      if (elEmail) elEmail.value = current.email || '';
      if (elDir) elDir.value = current.direccion || '';
      if (elCiudad) elCiudad.value = current.ciudad || '';
      if (elNotas) elNotas.value = current.notas || '';
      paintAvatar(current.nombre);

      elNombre.addEventListener('input', function () {
        paintAvatar(elNombre.value);
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', function () {
        var nombre = elNombre ? elNombre.value.trim() : '';
        if (!nombre) {
          toast('Ingresá tu nombre');
          if (elNombre) elNombre.focus();
          return;
        }
        Shop.saveBuyer({
          nombre: nombre,
          telefono: elTel ? elTel.value.trim() : '',
          email: elEmail ? elEmail.value.trim() : '',
          direccion: elDir ? elDir.value.trim() : '',
          ciudad: elCiudad ? elCiudad.value.trim() : '',
          notas: elNotas ? elNotas.value.trim() : ''
        });
        paintAvatar(nombre);
        toast('Datos del comprador guardados');
      });
    }

    if (elNotif) {
      elNotif.checked = !!settings.notif;
      elNotif.addEventListener('change', function () {
        settings.notif = elNotif.checked;
        Shop.saveSettings({ notif: settings.notif });
        toast(settings.notif ? 'Notificaciones activadas' : 'Notificaciones desactivadas');
      });
    }

    if (elDark) {
      elDark.checked = !!settings.dark;
      applyDark(settings);
      elDark.addEventListener('change', function () {
        settings.dark = elDark.checked;
        Shop.saveSettings({ dark: settings.dark });
        applyDark(settings);
      });
    }

    if (elIdioma) {
      elIdioma.value = settings.idioma;
      elIdioma.addEventListener('change', function () {
        settings.idioma = elIdioma.value;
        Shop.saveSettings({ idioma: settings.idioma });
        toast('Idioma: ' + settings.idioma);
      });
    }

    var statOrders = document.getElementById('stat-orders');
    if (statOrders) statOrders.textContent = Shop.getOrders().length;
    var statCart = document.getElementById('stat-cart');
    if (statCart) statCart.textContent = Shop.cartCount();
    var statSpent = document.getElementById('stat-spent');
    if (statSpent) {
      var spent = Shop.getOrders().reduce(function (sum, order) {
        return sum + (Number(order.total) || 0);
      }, 0);
      statSpent.textContent = Shop.formatMoney(spent);
    }

    var btnClear = document.getElementById('btn-clear');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        if (!confirm('Se borrarán tu perfil, los ajustes, el carrito y los pedidos guardados en este dispositivo. ¿Continuar?')) return;
        ['miapp_settings_v1', 'miapp_buyer_v1', 'miapp_cart_v1', 'miapp_orders_v1', 'miapp_coupon_v1', 'miapp_products_cache_v1', 'miapp_categories_cache_v1', 'miapp_store_config_v1', 'miapp_banners_v1'].forEach(function (key) {
          localStorage.removeItem(key);
        });
        location.reload();
      });
    }

    document.addEventListener('store:updated', function () {
      paintStoreName(Shop.getSettings());
    });
  });

  function paintStoreName(settings) {
    settings = settings || Shop.getSettings();
    document.querySelectorAll('[data-store-name]').forEach(function (el) {
      el.textContent = settings.storeName;
    });
  }

  function applyDark(settings) {
    document.documentElement.classList.toggle('light-demo', !settings.dark);
    document.body.style.background = settings.dark ? '#030712' : '#0f172a';
  }
})();

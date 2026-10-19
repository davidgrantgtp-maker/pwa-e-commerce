/* MiApp Store - PWA, navegación, ajustes y utilidades (localStorage) */
(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function (err) {
        console.log('SW no registrado:', err);
      });
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
    var elStore = document.getElementById('set-store');
    var elPhone = document.getElementById('set-phone');
    var elNotif = document.getElementById('set-notif');
    var elDark = document.getElementById('set-dark');
    var elIdioma = document.getElementById('set-idioma');
    var elAvatar = document.getElementById('p-avatar');

    if (elNombre) {
      elNombre.value = settings.nombre;
      elNombre.addEventListener('change', function () {
        settings.nombre = elNombre.value.trim() || 'Usuario Demo';
        Shop.saveSettings({ nombre: settings.nombre });
        paintAvatar(settings);
        toast('Nombre guardado localmente');
      });
    }

    if (elStore) {
      elStore.value = settings.storeName;
      elStore.addEventListener('change', function () {
        settings.storeName = elStore.value.trim() || 'MiApp Store';
        Shop.saveSettings({ storeName: settings.storeName });
        paintStoreName(settings);
        toast('Nombre de la tienda actualizado');
      });
    }

    if (elPhone) {
      elPhone.value = settings.sellerPhone || '';
      elPhone.addEventListener('change', function () {
        settings.sellerPhone = elPhone.value.trim();
        Shop.saveSettings({ sellerPhone: settings.sellerPhone });
        toast(Shop.normalizePhone(settings.sellerPhone) ? 'WhatsApp del vendedor guardado' : 'WhatsApp borrado');
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

    paintAvatar(settings);

    var btnClear = document.getElementById('btn-clear');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        if (!confirm('Se borrarán ajustes, carrito y pedidos guardados en este dispositivo. ¿Continuar?')) return;
        ['miapp_settings_v1', 'miapp_cart_v1', 'miapp_orders_v1', 'miapp_coupon_v1'].forEach(function (key) {
          localStorage.removeItem(key);
        });
        location.reload();
      });
    }
  });

  function paintStoreName(settings) {
    document.querySelectorAll('[data-store-name]').forEach(function (el) {
      el.textContent = settings.storeName;
    });
  }

  function paintAvatar(settings) {
    var avatar = document.getElementById('p-avatar');
    if (avatar) {
      avatar.textContent = (settings.nombre || 'U').trim().charAt(0).toUpperCase();
    }
  }

  function applyDark(settings) {
    document.documentElement.classList.toggle('light-demo', !settings.dark);
    document.body.style.background = settings.dark ? '#030712' : '#0f172a';
  }
})();

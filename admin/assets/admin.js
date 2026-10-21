(function () {
  'use strict';

  var API = '../.netlify/functions/';
  var ROOT = /\/admin(?:\/|$)/.test(location.pathname)
    ? location.pathname.replace(/\/admin(?:\/.*)?$/, '/')
    : '/';
  var view = document.getElementById('view');
  var pageTitle = document.getElementById('page-title');
  var loginScreen = document.getElementById('login-screen');
  var app = document.getElementById('app');
  var boot = document.getElementById('boot');

  var state = {
    user: null,
    cats: [],
    catRows: [],
    editCat: null,
    filtros: { q: '', cat: '', estado: '', orden: 'recientes', page: 1 },
    flash: null,
    importRows: null,
    importArchivo: '',
    importResult: null
  };

  var ETIQUETAS = {
    sku: 'SKU',
    nombre: 'Nombre',
    categoria: 'Categoría',
    precio: 'Precio',
    precio_anterior: 'Precio anterior',
    costo: 'Costo',
    stock: 'Stock',
    descripcion: 'Descripción',
    imagen: 'Imagen',
    etiqueta: 'Etiqueta',
    destacado: 'Destacado',
    activo: 'Activo'
  };

  var ALIAS = {
    sku: ['sku', 'codigo', 'cod', 'code', 'codigo producto'],
    nombre: ['nombre', 'producto', 'name', 'titulo', 'descripcion corta'],
    categoria: ['categoria', 'category', 'rubro', 'familia'],
    precio: ['precio', 'price', 'pvp', 'precio venta', 'valor'],
    precio_anterior: ['precio anterior', 'precio viejo', 'precio lista', 'precio tachado', 'precio oferta'],
    costo: ['costo', 'cost', 'precio costo', 'compra'],
    stock: ['stock', 'cantidad', 'qty', 'existencia', 'existencias', 'unidades'],
    descripcion: ['descripcion', 'detalle', 'description', 'descripcion larga'],
    imagen: ['imagen', 'foto', 'image', 'img', 'url imagen', 'url foto'],
    etiqueta: ['etiqueta', 'tag', 'badge', 'promo'],
    destacado: ['destacado', 'featured', 'destacar'],
    activo: ['activo', 'estado', 'visible', 'publicado', 'habilitado']
  };

  function h(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    return '$ ' + (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  }

  function fmtDate(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function qs(params) {
    var p = new URLSearchParams();
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v !== '' && v !== null && v !== undefined) p.set(k, v);
    });
    return p.toString();
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function imgSrc(src) {
    if (!src) return ROOT + 'img/placeholder.svg';
    if (/^https?:\/\//i.test(src) || src.charAt(0) === '/') return src;
    return ROOT + src.replace(/^\.?\//, '');
  }

  async function api(name, opts) {
    opts = opts || {};
    var init = {
      method: opts.method || 'GET',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    };
    if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

    var res = await fetch(API + name, init);
    var data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (res.status === 401) {
      showLogin();
      throw new Error((data && data.error) || 'Sesión expirada.');
    }
    if (!res.ok) throw new Error((data && data.error) || 'Error ' + res.status);
    return data;
  }

  function alertBox(message, type) {
    if (!view) return;
    var div = document.createElement('div');
    div.className = 'alert alert-' + (type || 'info') + ' alert-dismissible fade show py-2';
    div.innerHTML = h(message) + '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>';
    view.insertBefore(div, view.firstChild);
  }

  function flashPending() {
    if (!state.flash) return;
    alertBox(state.flash.message, state.flash.type);
    state.flash = null;
  }

  function setTitle(text) {
    pageTitle.textContent = text;
  }

  function setNav(name) {
    var map = {
      dashboard: 'dashboard',
      productos: 'productos',
      producto: 'productos',
      categorias: 'categorias',
      importar: 'importar',
      masivo: 'masivo',
      cuenta: 'cuenta'
    };
    var current = map[name] || 'dashboard';
    Array.prototype.forEach.call(document.querySelectorAll('.admin-nav .nav-link'), function (a) {
      a.classList.toggle('active', a.getAttribute('data-nav') === current);
    });
  }

  function showLogin() {
    state.user = null;
    app.classList.add('d-none');
    loginScreen.classList.remove('d-none');
    boot.classList.add('d-none');
  }

  function showApp() {
    loginScreen.classList.add('d-none');
    app.classList.remove('d-none');
    boot.classList.add('d-none');
    document.getElementById('user-name').textContent = state.user.nombre || '';
    document.getElementById('user-email').textContent = state.user.email || '';
    document.getElementById('user-avatar').textContent = String(state.user.nombre || state.user.email || '?').charAt(0).toUpperCase();
    if (!location.hash) history.replaceState(null, '', '#/');
    route();
  }

  function route() {
    if (!state.user) return;
    document.body.classList.remove('sidebar-open');
    var hash = location.hash.replace(/^#\/?/, '');
    var parts = hash.split('?')[0].split('/');
    var name = parts[0] || 'dashboard';
    view.onclick = null;
    setNav(name);

    if (name === 'productos') return renderProductos();
    if (name === 'producto') return renderProducto(parts[1] || '');
    if (name === 'categorias') return renderCategorias();
    if (name === 'importar') return renderImportar();
    if (name === 'masivo') return renderMasivo();
    if (name === 'cuenta') return renderCuenta();
    return renderDashboard();
  }

  async function cargarCategorias() {
    var r = await api('categorias');
    state.cats = r.rows || [];
    return state.cats;
  }

  function catOptions(selected, includeAll) {
    var html = includeAll ? '<option value="">Todas</option>' : '';
    state.cats.forEach(function (c) {
      html += '<option value="' + h(c.id) + '"' + (String(selected) === String(c.id) ? ' selected' : '') + '>' + h(c.nombre) + '</option>';
    });
    return html;
  }

  function statCard(icon, value, label, style) {
    return '<div class="col-6 col-lg-3"><div class="card stat-card h-100"><div class="d-flex align-items-center gap-3">' +
      '<div class="stat-icon"' + (style ? ' style="' + style + '"' : '') + '><i class="bi ' + icon + '"></i></div>' +
      '<div><div class="stat-value">' + h(value) + '</div><div class="stat-label">' + h(label) + '</div></div>' +
      '</div></div></div>';
  }

  async function renderDashboard() {
    setTitle('Dashboard');
    view.innerHTML = '<div class="text-secondary py-4">Cargando…</div>';
    try {
      var d = await api('dashboard');
      var s = d.stats || {};
      var total = Number(s.total_productos) || 0;
      var activos = Number(s.activos) || 0;
      var agotados = Number(s.agotados) || 0;
      var bajo = Number(s.bajo_stock) || 0;
      var cats = Number(s.total_categorias) || 0;
      var valor = Number(s.valor_inventario) || 0;
      var porCat = d.porCategoria || [];
      var stock = d.stockCritico || [];
      var movs = d.movimientos || [];
      var imps = d.importaciones || [];

      var max = 1;
      porCat.forEach(function (c) {
        max = Math.max(max, Number(c.total) || 0);
      });

      var html = '<div class="row g-3 mb-2">' +
        statCard('bi-box-seam', total.toLocaleString('es-AR'), 'Productos (' + activos + ' activos)', '') +
        statCard('bi-tags', cats, 'Categorías', '') +
        statCard('bi-exclamation-triangle', agotados + bajo, 'Sin stock (' + agotados + ') o bajo (' + bajo + ')', 'background:rgba(248,113,113,.12);color:#fca5a5') +
        statCard('bi-cash-coin', money(valor), 'Valor de inventario', 'background:rgba(52,211,153,.12);color:#6ee7b7') +
        '</div>';

      html += '<div class="row g-3"><div class="col-lg-7"><div class="card h-100">' +
        '<div class="card-header d-flex justify-content-between align-items-center"><span>Productos con stock crítico</span>' +
        '<a href="#/productos" class="btn btn-sm btn-outline-accent">Ver todos</a></div>' +
        '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr><th>Producto</th><th>SKU</th><th class="text-end">Stock</th><th></th></tr></thead><tbody>';

      if (!stock.length) {
        html += '<tr><td colspan="4" class="text-center text-secondary py-4">Sin alertas de stock. Todo en orden.</td></tr>';
      }
      stock.forEach(function (p) {
        var badge = Number(p.stock) <= 0
          ? '<span class="badge badge-stock-no">Sin stock</span>'
          : '<span class="badge badge-stock-low">' + h(p.stock) + ' u.</span>';
        html += '<tr><td>' + h(p.nombre) + '</td><td class="text-secondary small">' + h(p.sku) + '</td>' +
          '<td class="text-end">' + badge + '</td>' +
          '<td class="text-end"><a class="btn btn-sm btn-outline-secondary" href="#/producto/' + h(p.id) + '"><i class="bi bi-pencil"></i></a></td></tr>';
      });

      html += '</tbody></table></div></div></div><div class="col-lg-5">';

      html += '<div class="card mb-3"><div class="card-header">Productos por categoría</div><div class="card-body">';
      if (!porCat.length) {
        html += '<p class="text-secondary mb-0">Todavía no hay categorías.</p>';
      }
      porCat.forEach(function (c) {
        var pct = Math.round(((Number(c.total) || 0) / max) * 100);
        html += '<div class="d-flex justify-content-between small mb-1"><span>' + h(c.nombre) + '</span><span class="text-secondary">' + h(c.total) + '</span></div>' +
          '<div class="progress mb-3" style="height:8px;background:#0a0f1c"><div class="progress-bar" style="width:' + pct + '%;background:var(--a-accent)"></div></div>';
      });
      html += '</div></div>';

      html += '<div class="card"><div class="card-header">Últimos movimientos</div><div class="card-body">';
      if (!movs.length) {
        html += '<p class="text-secondary mb-0 small">Sin movimientos registrados.</p>';
      }
      movs.forEach(function (m) {
        html += '<div class="d-flex gap-2 small border-bottom border-secondary-subtle py-2"><i class="bi bi-arrow-left-right text-info"></i><div>' +
          '<div>' + h(m.producto || ('Producto #' + m.producto_id)) + '</div>' +
          '<div class="text-secondary">' + h(m.campo) + ' → ' + h(m.tipo) + ' ' + h(m.valor) + ' · ' + h(fmtDate(m.creado_en)) + '</div>' +
          '</div></div>';
      });
      html += '</div></div></div></div>';

      html += '<div class="card mt-3"><div class="card-header d-flex justify-content-between align-items-center"><span>Últimas importaciones</span>' +
        '<a href="#/importar" class="btn btn-sm btn-accent"><i class="bi bi-file-earmark-arrow-up"></i> Importar</a></div>' +
        '<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Archivo</th><th>Total</th><th>Creadas</th><th>Actualizadas</th><th>Errores</th><th>Fecha</th></tr></thead><tbody>';

      if (!imps.length) {
        html += '<tr><td colspan="6" class="text-center text-secondary py-4">Todavía no importaste archivos.</td></tr>';
      }
      imps.forEach(function (imp) {
        html += '<tr><td>' + h(imp.archivo) + '</td><td>' + h(imp.total) + '</td><td class="text-success">' + h(imp.creadas) + '</td>' +
          '<td class="text-info">' + h(imp.actualizadas) + '</td>' +
          '<td class="' + (Number(imp.errores) ? 'text-danger' : 'text-secondary') + '">' + h(imp.errores) + '</td>' +
          '<td class="text-secondary small">' + h(fmtDate(imp.creado_en)) + '</td></tr>';
      });
      html += '</tbody></table></div></div>';

      view.innerHTML = html;
      flashPending();
    } catch (ex) {
      view.innerHTML = '';
      alertBox(ex.message, 'danger');
    }
  }

  function productosShell(f) {
    return '<div class="card mb-3"><div class="card-body"><form id="filtros" class="row g-2 align-items-end">' +
      '<div class="col-md-4"><label class="form-label" for="f_q">Buscar</label><input class="form-control" id="f_q" name="q" value="' + h(f.q) + '" placeholder="Nombre o SKU"></div>' +
      '<div class="col-md-3"><label class="form-label" for="f_cat">Categoría</label><select class="form-select" id="f_cat" name="cat">' + catOptions(f.cat, true) + '</select></div>' +
      '<div class="col-md-2"><label class="form-label" for="f_estado">Estado</label><select class="form-select" id="f_estado" name="estado">' +
      '<option value="">Todos</option>' +
      '<option value="activos"' + (f.estado === 'activos' ? ' selected' : '') + '>Activos</option>' +
      '<option value="inactivos"' + (f.estado === 'inactivos' ? ' selected' : '') + '>Inactivos</option>' +
      '<option value="agotados"' + (f.estado === 'agotados' ? ' selected' : '') + '>Agotados</option>' +
      '<option value="bajo"' + (f.estado === 'bajo' ? ' selected' : '') + '>Stock bajo</option></select></div>' +
      '<div class="col-md-2"><label class="form-label" for="f_orden">Orden</label><select class="form-select" id="f_orden" name="orden">' +
      '<option value="recientes"' + (f.orden === 'recientes' ? ' selected' : '') + '>Recientes</option>' +
      '<option value="nombre"' + (f.orden === 'nombre' ? ' selected' : '') + '>Nombre</option>' +
      '<option value="precio_asc"' + (f.orden === 'precio_asc' ? ' selected' : '') + '>Precio ↑</option>' +
      '<option value="precio_desc"' + (f.orden === 'precio_desc' ? ' selected' : '') + '>Precio ↓</option>' +
      '<option value="stock_asc"' + (f.orden === 'stock_asc' ? ' selected' : '') + '>Stock ↑</option></select></div>' +
      '<div class="col-md-1"><button class="btn btn-accent w-100" type="submit" aria-label="Filtrar"><i class="bi bi-search"></i></button></div>' +
      '</form></div></div>' +

      '<div class="d-flex flex-wrap align-items-center gap-2 mb-2">' +
      '<div class="text-secondary small">Total: <span id="productos-total">—</span></div>' +
      '<div class="ms-auto d-flex gap-2">' +
      '<button class="btn btn-sm btn-outline-accent" id="exportar" type="button"><i class="bi bi-download"></i> Exportar CSV</button>' +
      '<button class="btn btn-sm btn-accent" id="nuevo-producto" type="button"><i class="bi bi-plus-lg"></i> Nuevo producto</button>' +
      '</div></div>' +

      '<div class="card mb-3"><div class="card-body py-2 d-flex flex-wrap align-items-center gap-2">' +
      '<select class="form-select form-select-sm" id="bulk-accion" style="max-width:230px">' +
      '<option value="">Acción en lote…</option>' +
      '<option value="activar">Activar</option><option value="desactivar">Desactivar</option>' +
      '<option value="destacar">Marcar destacado</option><option value="quitar_destacado">Quitar destacado</option>' +
      '<option value="mover">Mover a categoría</option></select>' +
      '<div id="bulk-cat-wrap" class="d-none"><select class="form-select form-select-sm" id="bulk-cat" style="max-width:200px">' + catOptions('', false) + '</select></div>' +
      '<button class="btn btn-sm btn-outline-accent" id="bulk-aplicar" type="button">Aplicar</button>' +
      '</div></div>' +

      '<div class="card"><div class="table-responsive"><table class="table table-hover align-middle mb-0">' +
      '<thead><tr><th style="width:34px"><input class="form-check-input" type="checkbox" id="check-all" aria-label="Seleccionar todo"></th>' +
      '<th>Producto</th><th>Categoría</th><th class="text-end">Precio</th><th class="text-center">Stock</th><th class="text-center">Estado</th><th class="text-end">Acciones</th></tr></thead>' +
      '<tbody id="productos-tabla"><tr><td colspan="7" class="text-center text-secondary py-4">Cargando…</td></tr></tbody>' +
      '</table></div></div>' +
      '<div id="paginacion" class="d-flex flex-wrap justify-content-center gap-1 mt-3"></div>';
  }

  function stockBadge(stock) {
    var n = parseInt(stock, 10) || 0;
    if (n <= 0) return '<span class="badge badge-stock-no">Sin stock</span>';
    if (n <= 5) return '<span class="badge badge-stock-low">' + n + ' u.</span>';
    return '<span class="badge badge-soft">' + n + ' u.</span>';
  }

  function pintarTabla(data) {
    var tbody = document.getElementById('productos-tabla');
    if (!tbody) return;
    var rows = data.rows || [];
    var html = '';

    if (!rows.length) {
      html = '<tr><td colspan="7" class="text-center text-secondary py-4">No se encontraron productos.</td></tr>';
    }

    rows.forEach(function (p) {
      var estado = p.activo
        ? '<span class="badge badge-stock-ok">Activo</span>'
        : '<span class="badge text-bg-secondary">Inactivo</span>';
      var precio = '<div class="text-end">' + money(p.precio);
      if (p.precio_anterior !== null && Number(p.precio_anterior) > Number(p.precio)) {
        precio += '<div class="small text-secondary text-decoration-line-through">' + money(p.precio_anterior) + '</div>';
      }
      precio += '</div>';

      html += '<tr>' +
        '<td><input class="form-check-input fila-check" type="checkbox" value="' + h(p.id) + '" aria-label="Seleccionar"></td>' +
        '<td><div class="d-flex align-items-center gap-2"><img class="prod-thumb" src="' + h(imgSrc(p.imagen)) + '" alt="" data-placeholder="' + h(ROOT + 'img/placeholder.svg') + '" onerror="this.src=this.dataset.placeholder">' +
        '<div><div class="fw-semibold">' + h(p.nombre) + '</div><div class="small text-secondary">' + h(p.sku || '—') + '</div></div></div></td>' +
        '<td class="small">' + h(p.categoria || '—') + '</td>' +
        '<td>' + precio + '</td>' +
        '<td class="text-center">' + stockBadge(p.stock) + '</td>' +
        '<td class="text-center">' + estado + '</td>' +
        '<td class="text-end text-nowrap">' +
        '<a class="btn btn-sm btn-outline-secondary" href="#/producto/' + h(p.id) + '" title="Editar"><i class="bi bi-pencil"></i></a> ' +
        '<a class="btn btn-sm btn-outline-secondary" href="' + h(ROOT + 'producto.html?id=' + encodeURIComponent(p.slug)) + '" target="_blank" rel="noopener" title="Ver en la tienda"><i class="bi bi-eye"></i></a>' +
        '</td></tr>';
    });

    tbody.innerHTML = html;

    var totalEl = document.getElementById('productos-total');
    if (totalEl) totalEl.textContent = Number(data.total || 0).toLocaleString('es-AR');

    var pag = document.getElementById('paginacion');
    if (!pag) return;
    var page = Number(data.page) || 1;
    var paginas = Number(data.paginas) || 1;
    var phtml = '';
    if (paginas > 1) {
      phtml += '<button class="btn btn-sm btn-outline-secondary" data-page="' + Math.max(1, page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>‹</button>';
      var start = Math.max(1, page - 2);
      var end = Math.min(paginas, start + 4);
      start = Math.max(1, end - 4);
      for (var i = start; i <= end; i++) {
        phtml += '<button class="btn btn-sm ' + (i === page ? 'btn-accent' : 'btn-outline-secondary') + '" data-page="' + i + '">' + i + '</button>';
      }
      phtml += '<button class="btn btn-sm btn-outline-secondary" data-page="' + Math.min(paginas, page + 1) + '"' + (page >= paginas ? ' disabled' : '') + '>›</button>';
    }
    pag.innerHTML = phtml;
  }

  async function cargarProductos() {
    var f = state.filtros;
    var params = { q: f.q, cat: f.cat, estado: f.estado, orden: f.orden, page: f.page, per_page: 20 };
    var tbody = document.getElementById('productos-tabla');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary py-4">Cargando…</td></tr>';
    try {
      var data = await api('productos?' + qs(params));
      pintarTabla(data);
    } catch (ex) {
      if (!state.user) return;
      alertBox(ex.message, 'danger');
    }
  }

  function idsSeleccionados() {
    return Array.prototype.map.call(document.querySelectorAll('.fila-check:checked'), function (cb) {
      return cb.value;
    });
  }

  async function aplicarLote() {
    var ids = idsSeleccionados();
    if (!ids.length) {
      alertBox('Seleccioná al menos un producto.', 'warning');
      return;
    }
    var accion = val('bulk-accion');
    if (!accion) {
      alertBox('Elegí una acción.', 'warning');
      return;
    }
    var body = { ids: ids, accion: accion };
    if (accion === 'mover') {
      var cat = val('bulk-cat');
      if (!cat) {
        alertBox('Elegí la categoría destino.', 'warning');
        return;
      }
      body.categoria_id = cat;
    }
    if (!confirm('¿Aplicar la acción a ' + ids.length + ' producto(s)?')) return;
    try {
      var r = await api('productos', { method: 'PATCH', body: body });
      state.flash = { message: 'Se actualizaron ' + (r.afectados || 0) + ' producto(s).', type: 'success' };
      renderProductos();
    } catch (ex) {
      alertBox(ex.message, 'danger');
    }
  }

  function csvCell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function downloadCsv(filename, rows) {
    var content = rows.map(function (row) {
      return row.map(csvCell).join(';');
    }).join('\r\n');
    var blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  async function exportarCsv() {
    var f = state.filtros;
    var params = { q: f.q, cat: f.cat, estado: f.estado, all: '1' };
    try {
      var data = await api('productos?' + qs(params));
      var rows = data.rows || [];
      var out = [['SKU', 'Nombre', 'Categoría', 'Precio', 'Precio anterior', 'Costo', 'Stock', 'Descripción', 'Imagen', 'Etiqueta', 'Destacado', 'Activo']];
      rows.forEach(function (r) {
        out.push([r.sku, r.nombre, r.categoria, r.precio, r.precio_anterior, r.costo, r.stock, r.descripcion, r.imagen, r.etiqueta, r.destacado ? '1' : '0', r.activo ? '1' : '0']);
      });
      downloadCsv('productos-' + new Date().toISOString().slice(0, 10) + '.csv', out);
    } catch (ex) {
      alertBox(ex.message, 'danger');
    }
  }

  function bindProductos() {
    var form = document.getElementById('filtros');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      state.filtros.q = String(fd.get('q') || '');
      state.filtros.cat = String(fd.get('cat') || '');
      state.filtros.estado = String(fd.get('estado') || '');
      state.filtros.orden = String(fd.get('orden') || 'recientes');
      state.filtros.page = 1;
      cargarProductos();
    });

    document.getElementById('nuevo-producto').addEventListener('click', function () {
      location.hash = '#/producto/nuevo';
    });
    document.getElementById('exportar').addEventListener('click', exportarCsv);

    document.getElementById('check-all').addEventListener('change', function (e) {
      Array.prototype.forEach.call(document.querySelectorAll('.fila-check'), function (cb) {
        cb.checked = e.target.checked;
      });
    });

    document.getElementById('bulk-accion').addEventListener('change', function (e) {
      document.getElementById('bulk-cat-wrap').classList.toggle('d-none', e.target.value !== 'mover');
    });
    document.getElementById('bulk-aplicar').addEventListener('click', aplicarLote);

    document.getElementById('paginacion').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;
      state.filtros.page = parseInt(btn.getAttribute('data-page'), 10) || 1;
      cargarProductos();
    });
  }

  async function renderProductos() {
    setTitle('Productos');
    view.innerHTML = '<div class="text-secondary py-4">Cargando…</div>';
    try {
      await cargarCategorias();
      view.innerHTML = productosShell(state.filtros);
      bindProductos();
      await cargarProductos();
      flashPending();
    } catch (ex) {
      view.innerHTML = '';
      alertBox(ex.message, 'danger');
    }
  }

  function productoForm(p, esNuevo) {
    return '<div class="mb-3"><a href="#/productos" class="text-decoration-none text-secondary small"><i class="bi bi-arrow-left"></i> Volver al listado</a></div>' +
      '<div id="form-error" class="alert alert-danger py-2 d-none"></div>' +
      '<form id="producto-form"><div class="row g-3"><div class="col-lg-8">' +
      '<div class="card mb-3"><div class="card-header">Datos del producto</div><div class="card-body">' +
      '<div class="mb-3"><label class="form-label" for="p-nombre">Nombre *</label><input class="form-control" id="p-nombre" name="nombre" value="' + h(p.nombre) + '" required></div>' +
      '<div class="row g-3">' +
      '<div class="col-md-4"><label class="form-label" for="p-sku">SKU / Código</label><input class="form-control" id="p-sku" name="sku" value="' + h(p.sku) + '" placeholder="CG-500"></div>' +
      '<div class="col-md-4"><label class="form-label" for="p-cat">Categoría</label><select class="form-select" id="p-cat" name="categoria_id"><option value="">Sin categoría</option>' + catOptions(p.categoria_id, false) + '</select></div>' +
      '<div class="col-md-4"><label class="form-label" for="p-etiqueta">Etiqueta / Badge</label><input class="form-control" id="p-etiqueta" name="etiqueta" value="' + h(p.etiqueta) + '" placeholder="Nuevo, Más vendido…"></div>' +
      '</div><div class="row g-3 mt-0">' +
      '<div class="col-md-4"><label class="form-label" for="p-precio">Precio *</label><input class="form-control" id="p-precio" name="precio" value="' + h(p.precio) + '" required placeholder="8500"></div>' +
      '<div class="col-md-4"><label class="form-label" for="p-precio-ant">Precio anterior</label><input class="form-control" id="p-precio-ant" name="precio_anterior" value="' + h(p.precio_anterior === null ? '' : p.precio_anterior) + '" placeholder="9900"></div>' +
      '<div class="col-md-4"><label class="form-label" for="p-costo">Costo</label><input class="form-control" id="p-costo" name="costo" value="' + h(p.costo === null ? '' : p.costo) + '" placeholder="Interno"></div>' +
      '</div><div class="row g-3 mt-0">' +
      '<div class="col-md-4"><label class="form-label" for="p-stock">Stock</label><input class="form-control" type="number" id="p-stock" name="stock" value="' + h(p.stock) + '"></div>' +
      '</div><div class="mt-3"><label class="form-label" for="p-desc">Descripción</label><textarea class="form-control" id="p-desc" name="descripcion" rows="4">' + h(p.descripcion) + '</textarea></div>' +
      '</div></div>' +
      '<div class="card"><div class="card-header">Publicación</div><div class="card-body d-flex flex-wrap gap-4">' +
      '<div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="p-activo" name="activo"' + (p.activo ? ' checked' : '') + '><label class="form-check-label" for="p-activo">Visible en la tienda</label></div>' +
      '<div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="p-destacado" name="destacado"' + (p.destacado ? ' checked' : '') + '><label class="form-check-label" for="p-destacado">Destacado</label></div>' +
      '</div></div></div>' +

      '<div class="col-lg-4"><div class="card mb-3"><div class="card-header">Imagen</div><div class="card-body text-center">' +
      '<div id="img-preview" class="mb-3">' + (p.imagen
        ? '<img class="prod-thumb-lg" src="' + h(imgSrc(p.imagen)) + '" alt="Vista previa" data-placeholder="' + h(ROOT + 'img/placeholder.svg') + '" onerror="this.src=this.dataset.placeholder">'
        : '<div class="prod-thumb-lg d-grid mx-auto" style="place-items:center"><i class="bi bi-image text-secondary fs-3"></i></div>') + '</div>' +
      '<div class="mb-3 text-start"><label class="form-label" for="imagen_archivo">Subir archivo</label>' +
      '<input class="form-control" type="file" id="imagen_archivo" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml">' +
      '<div class="form-text">JPG, PNG, WEBP o SVG · máx. 2 MB</div><div class="small text-info mt-1" id="upload-status"></div></div>' +
      '<div class="text-start"><label class="form-label" for="p-imagen">o URL / ruta</label>' +
      '<input class="form-control" id="p-imagen" name="imagen" value="' + h(p.imagen) + '" placeholder="https://… o img/termo.svg"></div>' +
      '</div></div>' +
      '<div class="card"><div class="card-body d-grid gap-2">' +
      '<button class="btn btn-accent" id="guardar-producto" type="submit"><i class="bi bi-check-lg"></i> ' + (esNuevo ? 'Crear producto' : 'Guardar cambios') + '</button>' +
      (esNuevo ? '' : '<a class="btn btn-outline-secondary" href="' + h(ROOT + 'producto.html?id=' + encodeURIComponent(p.slug)) + '" target="_blank" rel="noopener"><i class="bi bi-eye"></i> Ver en la tienda</a>') +
      '</div></div></div></div></form>' +
      (esNuevo ? '' : '<div class="mt-3"><button class="btn btn-outline-danger" id="eliminar-producto" type="button"><i class="bi bi-trash"></i> Eliminar producto</button></div>');
  }

  function leerArchivo(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ''));
      };
      reader.onerror = function () {
        reject(new Error('No se pudo leer el archivo.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function bindProductoForm(p, esNuevo) {
    var form = document.getElementById('producto-form');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var body = {
        nombre: val('p-nombre'),
        sku: val('p-sku'),
        categoria_id: val('p-cat'),
        precio: val('p-precio'),
        precio_anterior: val('p-precio-ant'),
        costo: val('p-costo'),
        stock: val('p-stock'),
        descripcion: val('p-desc'),
        imagen: val('p-imagen'),
        etiqueta: val('p-etiqueta'),
        destacado: document.getElementById('p-destacado').checked,
        activo: document.getElementById('p-activo').checked
      };

      var errorBox = document.getElementById('form-error');
      errorBox.classList.add('d-none');
      var btn = document.getElementById('guardar-producto');
      btn.disabled = true;

      try {
        if (esNuevo) {
          var created = await api('productos', { method: 'POST', body: body });
          state.flash = { message: 'Producto creado.', type: 'success' };
          location.hash = '#/producto/' + created.product.id;
        } else {
          body.id = p.id;
          await api('producto', { method: 'PATCH', body: body });
          state.flash = { message: 'Producto actualizado.', type: 'success' };
          renderProducto(String(p.id));
        }
      } catch (ex) {
        errorBox.textContent = ex.message;
        errorBox.classList.remove('d-none');
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('imagen_archivo').addEventListener('change', async function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alertBox('La imagen supera 2 MB.', 'warning');
        e.target.value = '';
        return;
      }
      var status = document.getElementById('upload-status');
      status.textContent = 'Subiendo…';
      try {
        var dataUrl = await leerArchivo(file);
        var r = await api('upload', { method: 'POST', body: { filename: file.name, data: dataUrl } });
        document.getElementById('p-imagen').value = r.url;
        document.getElementById('img-preview').innerHTML = '<img class="prod-thumb-lg" src="' + h(r.url) + '" alt="Vista previa">';
        status.textContent = 'Imagen subida.';
      } catch (ex) {
        status.textContent = '';
        alertBox(ex.message, 'danger');
      }
    });

    var del = document.getElementById('eliminar-producto');
    if (del) {
      del.addEventListener('click', async function () {
        if (!confirm('¿Eliminar este producto definitivamente?')) return;
        try {
          await api('producto?id=' + encodeURIComponent(p.id), { method: 'DELETE' });
          state.flash = { message: 'Producto eliminado.', type: 'warning' };
          location.hash = '#/productos';
        } catch (ex) {
          alertBox(ex.message, 'danger');
        }
      });
    }
  }

  async function renderProducto(id) {
    var esNuevo = !id || id === 'nuevo';
    setTitle(esNuevo ? 'Nuevo producto' : 'Editar producto');
    view.innerHTML = '<div class="text-secondary py-4">Cargando…</div>';
    try {
      await cargarCategorias();
      var p = {
        sku: '', nombre: '', categoria_id: '', precio: '', precio_anterior: null,
        costo: null, stock: 0, descripcion: '', imagen: '', etiqueta: '',
        destacado: false, activo: true, slug: ''
      };
      if (!esNuevo) {
        var r = await api('producto?id=' + encodeURIComponent(id));
        p = r.product;
      }
      view.innerHTML = productoForm(p, esNuevo);
      bindProductoForm(p, esNuevo);
      flashPending();
    } catch (ex) {
      view.innerHTML = '';
      alertBox(ex.message, 'danger');
    }
  }

  function categoriasShell(rows, c, editando) {
    var html = '<div class="row g-3"><div class="col-lg-4"><div class="card"><div class="card-header">' +
      (editando ? 'Editar categoría' : 'Nueva categoría') + '</div><div class="card-body">' +
      '<form id="categoria-form">' +
      (editando ? '<input type="hidden" id="cat-id" value="' + h(c.id) + '">' : '') +
      '<div class="mb-3"><label class="form-label" for="cat-nombre">Nombre *</label><input class="form-control" id="cat-nombre" value="' + h(c.nombre) + '" required></div>' +
      '<div class="mb-3"><label class="form-label" for="cat-orden">Orden</label><input class="form-control" type="number" id="cat-orden" value="' + h(c.orden || 0) + '"><div class="form-text">Menor número aparece primero.</div></div>' +
      '<div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="cat-activo"' + (c.activo ? ' checked' : '') + '><label class="form-check-label" for="cat-activo">Activa</label></div>' +
      '<button class="btn btn-accent w-100" type="submit"><i class="bi bi-check-lg"></i> ' + (editando ? 'Guardar cambios' : 'Crear categoría') + '</button>' +
      (editando ? '<button class="btn btn-outline-secondary w-100 mt-2" type="button" id="cancelar-edicion">Cancelar</button>' : '') +
      '</form></div></div></div><div class="col-lg-8"><div class="card">' +
      '<div class="card-header d-flex justify-content-between align-items-center"><span>Categorías (' + rows.length + ')</span>' +
      '<a class="btn btn-sm btn-outline-accent" href="#/productos"><i class="bi bi-box-seam"></i> Ver productos</a></div>' +
      '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr><th>Categoría</th><th>Slug</th><th class="text-center">Productos</th><th class="text-center">Estado</th><th class="text-end">Acciones</th></tr></thead><tbody>';

    if (!rows.length) {
      html += '<tr><td colspan="5" class="text-center text-secondary py-5">Todavía no hay categorías.</td></tr>';
    }
    rows.forEach(function (row) {
      html += '<tr><td class="fw-semibold">' + h(row.nombre) + '</td><td class="small text-secondary">' + h(row.slug) + '</td>' +
        '<td class="text-center"><span class="badge badge-soft">' + h(row.productos) + '</span> <span class="small text-secondary">(' + h(row.activos) + ' activos)</span></td>' +
        '<td class="text-center">' + (row.activo ? '<span class="badge badge-stock-ok">Activa</span>' : '<span class="badge text-bg-secondary">Inactiva</span>') + '</td>' +
        '<td class="text-end text-nowrap">' +
        '<button class="btn btn-sm btn-outline-secondary" data-edit="' + h(row.id) + '" type="button" title="Editar"><i class="bi bi-pencil"></i></button> ' +
        '<button class="btn btn-sm btn-outline-secondary" data-toggle="' + h(row.id) + '" type="button" title="Activar/desactivar"><i class="bi bi-power"></i></button> ' +
        '<button class="btn btn-sm btn-outline-danger" data-del="' + h(row.id) + '" type="button" title="Eliminar"><i class="bi bi-trash"></i></button>' +
        '</td></tr>';
    });

    html += '</tbody></table></div></div></div></div>';
    return html;
  }

  function bindCategorias() {
    var form = document.getElementById('categoria-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var body = {
        nombre: val('cat-nombre'),
        orden: val('cat-orden'),
        activo: document.getElementById('cat-activo').checked
      };
      try {
        if (state.editCat) {
          body.id = state.editCat.id;
          await api('categorias', { method: 'PATCH', body: body });
          state.flash = { message: 'Categoría actualizada.', type: 'success' };
        } else {
          await api('categorias', { method: 'POST', body: body });
          state.flash = { message: 'Categoría creada.', type: 'success' };
        }
        state.editCat = null;
        state.cats = [];
        renderCategorias();
      } catch (ex) {
        alertBox(ex.message, 'danger');
      }
    });

    var cancel = document.getElementById('cancelar-edicion');
    if (cancel) {
      cancel.addEventListener('click', function () {
        state.editCat = null;
        renderCategorias();
      });
    }

    view.onclick = async function (e) {
      var edit = e.target.closest('[data-edit]');
      if (edit) {
        var id = edit.getAttribute('data-edit');
        state.editCat = state.catRows.find(function (c) {
          return String(c.id) === String(id);
        });
        renderCategorias();
        return;
      }

      var toggle = e.target.closest('[data-toggle]');
      if (toggle) {
        try {
          await api('categorias', { method: 'PATCH', body: { id: toggle.getAttribute('data-toggle'), toggle: true } });
          state.flash = { message: 'Estado actualizado.', type: 'success' };
          renderCategorias();
        } catch (ex) {
          alertBox(ex.message, 'danger');
        }
        return;
      }

      var del = e.target.closest('[data-del]');
      if (del) {
        if (!confirm('¿Eliminar la categoría? Los productos quedarán sin categoría.')) return;
        try {
          await api('categorias', { method: 'DELETE', body: { id: del.getAttribute('data-del') } });
          state.flash = { message: 'Categoría eliminada.', type: 'warning' };
          state.cats = [];
          renderCategorias();
        } catch (ex) {
          alertBox(ex.message, 'danger');
        }
      }
    };
  }

  async function renderCategorias() {
    setTitle('Categorías');
    view.innerHTML = '<div class="text-secondary py-4">Cargando…</div>';
    try {
      var d = await api('categorias?with_counts=1');
      state.catRows = d.rows || [];
      var c = state.editCat || { nombre: '', orden: 0, activo: true };
      view.innerHTML = categoriasShell(state.catRows, c, !!state.editCat);
      bindCategorias();
      flashPending();
    } catch (ex) {
      view.innerHTML = '';
      alertBox(ex.message, 'danger');
    }
  }

  function importShell(history) {
    var html = '';

    if (state.importResult) {
      var r = state.importResult;
      html += '<div class="card mb-3"><div class="card-header d-flex align-items-center gap-2"><i class="bi bi-check-circle-fill text-success"></i> Importación finalizada</div><div class="card-body">' +
        '<div class="row text-center g-3">' +
        '<div class="col-6 col-md-3"><div class="stat-value">' + h(r.total) + '</div><div class="stat-label">Filas procesadas</div></div>' +
        '<div class="col-6 col-md-3"><div class="stat-value text-success">' + h(r.creadas) + '</div><div class="stat-label">Creadas</div></div>' +
        '<div class="col-6 col-md-3"><div class="stat-value text-info">' + h(r.actualizadas) + '</div><div class="stat-label">Actualizadas</div></div>' +
        '<div class="col-6 col-md-3"><div class="stat-value ' + (Number(r.errores) ? 'text-danger' : 'text-secondary') + '">' + h(r.errores) + '</div><div class="stat-label">Errores</div></div>' +
        '</div>';
      if (r.detalles && r.detalles.length) {
        html += '<hr><p class="small text-secondary mb-1">Detalle de errores (primeros 30):</p><ul class="small text-danger">';
        r.detalles.slice(0, 30).forEach(function (d) {
          html += '<li>' + h(d) + '</li>';
        });
        html += '</ul>';
      }
      html += '<div class="d-flex gap-2 mt-3"><a class="btn btn-accent" href="#/productos"><i class="bi bi-box-seam"></i> Ver productos</a>' +
        '<button class="btn btn-outline-secondary" id="import-otro" type="button">Importar otro archivo</button></div></div></div>';
    }

    html += '<div class="row g-3"><div class="col-lg-6"><div class="card h-100"><div class="card-header"><i class="bi bi-file-earmark-arrow-up"></i> Subir planilla</div><div class="card-body">' +
      '<div id="import-panel"><div class="mb-3"><label class="form-label" for="import-file">Archivo CSV o XLSX</label>' +
      '<input class="form-control" type="file" id="import-file" accept=".csv,.xlsx,.txt"><div class="form-text">Máximo 5 MB. La primera fila debe tener los encabezados.</div></div>' +
      '<div id="import-status" class="small text-info mb-2"></div>' +
      '<button class="btn btn-outline-accent" id="descargar-plantilla" type="button"><i class="bi bi-download"></i> Descargar plantilla</button></div>' +
      '</div></div></div>' +
      '<div class="col-lg-6"><div class="card h-100"><div class="card-header"><i class="bi bi-info-circle"></i> Formato esperado</div><div class="card-body">' +
      '<p class="small text-secondary">Columnas reconocidas (el orden no importa, los nombres se detectan automáticamente):</p>' +
      '<div class="d-flex flex-wrap gap-1 mb-3">';
    Object.keys(ETIQUETAS).forEach(function (k) {
      html += '<span class="badge text-bg-dark border border-secondary">' + h(ETIQUETAS[k]) + '</span>';
    });
    html += '</div><ul class="small text-secondary mb-0">' +
      '<li><strong>SKU</strong> es la clave para actualizar; si no viene, se usa el nombre.</li>' +
      '<li><strong>Categoría</strong>: si no existe, se crea.</li>' +
      '<li><strong>Precio</strong> acepta <code>8500</code>, <code>8.500,00</code> o <code>$ 8.500</code>.</li>' +
      '<li><strong>Stock</strong> y <strong>precio_anterior</strong> son opcionales.</li>' +
      '<li><strong>Imagen</strong>: URL o ruta (ej. <code>img/termo.svg</code>).</li>' +
      '</ul></div></div></div></div>';

    html += '<div class="card mt-3"><div class="card-header">Historial de importaciones</div><div class="table-responsive">' +
      '<table class="table align-middle mb-0"><thead><tr><th>Archivo</th><th>Filas</th><th>Creadas</th><th>Actualizadas</th><th>Errores</th><th>Usuario</th><th>Fecha</th></tr></thead><tbody>';

    if (!history.length) {
      html += '<tr><td colspan="7" class="text-center text-secondary py-4">Sin importaciones todavía.</td></tr>';
    }
    history.forEach(function (row) {
      html += '<tr><td>' + h(row.archivo) + '</td><td>' + h(row.total) + '</td><td class="text-success">' + h(row.creadas) + '</td>' +
        '<td class="text-info">' + h(row.actualizadas) + '</td>' +
        '<td class="' + (Number(row.errores) ? 'text-danger' : 'text-secondary') + '">' + h(row.errores) + '</td>' +
        '<td class="small text-secondary">' + h(row.email || '—') + '</td>' +
        '<td class="small text-secondary">' + h(fmtDate(row.creado_en)) + '</td></tr>';
    });

    html += '</tbody></table></div></div>';
    return html;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-src="' + src + '"]');
      if (existing) return resolve();
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.setAttribute('data-src', src);
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error('No se pudo cargar el lector de planillas. Revisá tu conexión.'));
      };
      document.head.appendChild(s);
    });
  }

  function normHeader(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function mapearHeaders(headers) {
    var map = {};
    var usados = {};
    var norm = headers.map(normHeader);

    norm.forEach(function (n, i) {
      if (!n) return;
      Object.keys(ALIAS).forEach(function (campo) {
        if (map[i] || usados[campo]) return;
        if (ALIAS[campo].indexOf(n) !== -1) {
          map[i] = campo;
          usados[campo] = true;
        }
      });
    });

    norm.forEach(function (n, i) {
      if (!n || map[i]) return;
      Object.keys(ALIAS).forEach(function (campo) {
        if (map[i] || usados[campo]) return;
        for (var k = 0; k < ALIAS[campo].length; k++) {
          if (n.indexOf(ALIAS[campo][k]) !== -1) {
            map[i] = campo;
            usados[campo] = true;
            break;
          }
        }
      });
    });

    return map;
  }

  function prepararFilas(matrix) {
    if (!matrix || !matrix.length) return { headers: [], map: {}, rows: [] };
    var headers = matrix[0].map(function (v) {
      return String(v === null || v === undefined ? '' : v).trim();
    });
    var map = mapearHeaders(headers);
    var rows = [];

    for (var i = 1; i < matrix.length; i++) {
      var item = {};
      var vacio = true;
      Object.keys(map).forEach(function (idx) {
        var raw = matrix[i][idx];
        var value = raw === null || raw === undefined ? '' : String(raw).trim();
        item[map[idx]] = value;
        if (value !== '') vacio = false;
      });
      if (!vacio) rows.push(item);
    }

    return { headers: headers, map: map, rows: rows };
  }

  function pintarPreview(prep, archivo) {
    var panel = document.getElementById('import-panel');
    var status = document.getElementById('import-status');
    if (status) status.textContent = '';

    if (!prep.rows.length) {
      panel.innerHTML = '<div class="alert alert-warning py-2">No se encontraron filas con datos. Revisá el archivo.</div>';
      return;
    }

    var campos = Object.keys(prep.map).map(function (idx) {
      return prep.map[idx];
    });

    if (campos.indexOf('nombre') === -1) {
      panel.innerHTML = '<div class="alert alert-danger py-2">No se detectó la columna "Nombre". Descargá la plantilla para ver el formato esperado.</div>';
      return;
    }

    var faltantes = [];
    if (campos.indexOf('precio') === -1) faltantes.push('Precio');

    var html = '<div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-2">' +
      '<span class="small"><i class="bi bi-table"></i> ' + h(archivo) + '</span>' +
      '<span class="badge badge-soft">' + prep.rows.length + ' filas</span></div>';

    html += '<p class="small text-secondary mb-2">Columnas detectadas: ';
    Object.keys(prep.map).forEach(function (idx) {
      html += '<span class="badge text-bg-dark border border-secondary me-1">' + h(ETIQUETAS[prep.map[idx]] || prep.map[idx]) + ' ← "' + h(prep.headers[idx]) + '"</span>';
    });
    html += '</p>';

    if (faltantes.length) {
      html += '<div class="alert alert-warning py-2 small mb-2">Atención: no se detectó ' + h(faltantes.join(' / ')) + '. Sin precio, los productos nuevos se cargan en 0.</div>';
    }

    html += '<div class="table-responsive" style="max-height:340px"><table class="table table-sm table-hover align-middle"><thead class="position-sticky top-0"><tr><th>#</th>';
    Object.keys(prep.map).forEach(function (idx) {
      html += '<th>' + h(ETIQUETAS[prep.map[idx]] || prep.map[idx]) + '</th>';
    });
    html += '</tr></thead><tbody>';

    prep.rows.slice(0, 50).forEach(function (row, i) {
      html += '<tr><td class="text-secondary">' + (i + 2) + '</td>';
      Object.keys(prep.map).forEach(function (idx) {
        html += '<td class="small">' + h(row[prep.map[idx]]) + '</td>';
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    if (prep.rows.length > 50) {
      html += '<p class="small text-secondary mt-2 mb-0">Mostrando las primeras 50 de ' + prep.rows.length + ' filas.</p>';
    }

    html += '<div class="d-flex flex-wrap gap-2 mt-3">' +
      '<button class="btn btn-accent" id="confirmar-import" type="button"><i class="bi bi-cloud-check"></i> Importar ' + prep.rows.length + ' filas</button>' +
      '<button class="btn btn-outline-secondary" id="cancelar-import" type="button">Cancelar</button></div>' +
      '<p class="small text-secondary mt-2 mb-0">Se actualizan productos con el mismo SKU (o mismo nombre) y se crean los que no existen. Las categorías se crean automáticamente si no existen.</p>';

    panel.innerHTML = html;

    state.importRows = prep.rows;
    state.importArchivo = archivo;

    document.getElementById('confirmar-import').addEventListener('click', confirmarImport);
    document.getElementById('cancelar-import').addEventListener('click', function () {
      state.importRows = null;
      renderImportar();
    });
  }

  async function confirmarImport() {
    if (!state.importRows) return;
    var btn = document.getElementById('confirmar-import');
    btn.disabled = true;
    btn.textContent = 'Importando…';
    try {
      var r = await api('importar', {
        method: 'POST',
        body: { archivo: state.importArchivo, rows: state.importRows }
      });
      state.importRows = null;
      state.importResult = r;
      state.flash = {
        message: 'Importación finalizada: ' + r.creadas + ' creadas, ' + r.actualizadas + ' actualizadas, ' + r.errores + ' errores.',
        type: r.errores ? 'warning' : 'success'
      };
      renderImportar();
    } catch (ex) {
      alertBox(ex.message, 'danger');
      btn.disabled = false;
      btn.textContent = 'Importar';
    }
  }

  async function previsualizarArchivo(file) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (['csv', 'xlsx', 'txt'].indexOf(ext) === -1) {
      alertBox('Formato no soportado. Usá .csv o .xlsx.', 'warning');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alertBox('El archivo supera los 5 MB.', 'warning');
      return;
    }

    var status = document.getElementById('import-status');
    status.textContent = 'Leyendo archivo…';

    try {
      await loadScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');
      var buffer = await file.arrayBuffer();
      var wb = window.XLSX.read(new Uint8Array(buffer), { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error('El archivo no tiene hojas.');
      var matrix = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
      var prep = prepararFilas(matrix);
      state.importResult = null;
      pintarPreview(prep, file.name);
    } catch (ex) {
      status.textContent = '';
      alertBox(ex.message, 'danger');
    }
  }

  function bindImportar() {
    var file = document.getElementById('import-file');
    if (file) {
      file.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) previsualizarArchivo(e.target.files[0]);
      });
    }

    var plantilla = document.getElementById('descargar-plantilla');
    if (plantilla) {
      plantilla.addEventListener('click', function () {
        downloadCsv('plantilla-productos.csv', [
          ['SKU', 'Nombre', 'Categoría', 'Precio', 'Precio anterior', 'Costo', 'Stock', 'Descripción', 'Imagen', 'Etiqueta', 'Destacado', 'Activo'],
          ['CG-500', 'Café en grano 500 g', 'Cafés', '8500', '9900', '', '25', 'Molida media', 'img/cafe.svg', 'Nuevo', '0', '1']
        ]);
      });
    }

    var otro = document.getElementById('import-otro');
    if (otro) {
      otro.addEventListener('click', function () {
        state.importResult = null;
        renderImportar();
      });
    }
  }

  async function renderImportar() {
    setTitle('Importar Excel/CSV');
    view.innerHTML = '<div class="text-secondary py-4">Cargando…</div>';
    try {
      var d = await api('importar');
      view.innerHTML = importShell(d.history || []);
      bindImportar();
      flashPending();
    } catch (ex) {
      view.innerHTML = '';
      alertBox(ex.message, 'danger');
    }
  }

  function masivoShell() {
    return '<div class="row g-3"><div class="col-lg-8"><form id="masivo-form">' +
      '<div class="card mb-3"><div class="card-header"><i class="bi bi-funnel"></i> 1. Seleccionar productos</div><div class="card-body"><div class="row g-3">' +
      '<div class="col-md-4"><label class="form-label" for="m_q">Buscar</label><input class="form-control" id="m_q" placeholder="Nombre o SKU"></div>' +
      '<div class="col-md-4"><label class="form-label" for="m_cat">Categoría</label><select class="form-select" id="m_cat">' + catOptions('', true) + '</select></div>' +
      '<div class="col-md-4"><label class="form-label" for="m_estado">Estado / stock</label><select class="form-select" id="m_estado">' +
      '<option value="">Todos</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option>' +
      '<option value="agotados">Agotados</option><option value="bajo">Stock bajo</option></select></div></div>' +
      '<p class="small text-secondary mt-3 mb-0">Los cambios se aplican a todos los productos que coincidan con el filtro. Dejá los campos vacíos si no querés modificar ese dato.</p>' +
      '</div></div>' +

      '<div class="card mb-3"><div class="card-header"><i class="bi bi-cash-coin"></i> 2. Precios</div><div class="card-body"><div class="row g-3">' +
      '<div class="col-md-7"><label class="form-label" for="m_op_precio">Operación de precio</label><select class="form-select" id="m_op_precio">' +
      '<option value="">Sin cambios</option><option value="set">Fijar precio</option><option value="inc">Sumar monto</option>' +
      '<option value="dec">Restar monto</option><option value="pct_inc">Aumentar porcentaje (%)</option>' +
      '<option value="pct_dec">Descontar porcentaje (%)</option><option value="round">Redondear al entero</option></select></div>' +
      '<div class="col-md-5"><label class="form-label" for="m_valor_precio">Valor / porcentaje</label><input class="form-control" id="m_valor_precio" placeholder="Ej: 10"></div>' +
      '<div class="col-md-7"><label class="form-label" for="m_op_ant">Precio anterior (tachado)</label><select class="form-select" id="m_op_ant">' +
      '<option value="">Sin cambios</option><option value="equal">Igual al precio actual</option><option value="set">Fijar un valor</option>' +
      '<option value="clear">Borrar precio anterior</option></select></div>' +
      '<div class="col-md-5"><label class="form-label" for="m_valor_ant">Valor precio anterior</label><input class="form-control" id="m_valor_ant"></div>' +
      '</div></div></div>' +

      '<div class="card mb-3"><div class="card-header"><i class="bi bi-boxes"></i> 3. Stock, categoría y estado</div><div class="card-body"><div class="row g-3">' +
      '<div class="col-md-7"><label class="form-label" for="m_op_stock">Operación de stock</label><select class="form-select" id="m_op_stock">' +
      '<option value="">Sin cambios</option><option value="set">Fijar stock</option><option value="inc">Sumar unidades</option>' +
      '<option value="dec">Restar unidades</option></select></div>' +
      '<div class="col-md-5"><label class="form-label" for="m_valor_stock">Unidades</label><input class="form-control" id="m_valor_stock" placeholder="Ej: 10"></div>' +
      '<div class="col-md-4"><label class="form-label" for="m_op_cat">Cambiar categoría</label><select class="form-select" id="m_op_cat"><option value="">Sin cambios</option>' + catOptions('', false) + '</select></div>' +
      '<div class="col-md-4"><label class="form-label" for="m_op_activo">Estado</label><select class="form-select" id="m_op_activo">' +
      '<option value="">Sin cambios</option><option value="1">Activo</option><option value="0">Inactivo</option></select></div>' +
      '<div class="col-md-4"><label class="form-label" for="m_op_dest">Destacado</label><select class="form-select" id="m_op_dest">' +
      '<option value="">Sin cambios</option><option value="1">Sí</option><option value="0">No</option></select></div>' +
      '</div></div></div>' +

      '<div class="d-flex gap-2"><button class="btn btn-outline-accent" id="m-previsualizar" type="button"><i class="bi bi-calculator"></i> Previsualizar</button>' +
      '<button class="btn btn-accent" id="m-aplicar" type="button"><i class="bi bi-lightning-charge"></i> Aplicar cambios</button></div>' +
      '</form></div><div class="col-lg-4"><div class="card"><div class="card-header">Resultado de la previsualización</div>' +
      '<div class="card-body" id="masivo-result"><p class="small text-secondary mb-2">Elegí los filtros y operaciones, y usá «Previsualizar» para ver cuántos productos se van a modificar.</p>' +
      '<p class="small text-secondary mb-0">Cada cambio queda registrado en movimientos para auditoría.</p></div></div></div></div>';
  }

  function payloadMasivo(apply) {
    return {
      apply: apply,
      filtros: { q: val('m_q'), cat: val('m_cat'), estado: val('m_estado') },
      ops: {
        precio: val('m_op_precio'),
        valor_precio: val('m_valor_precio'),
        precio_ant: val('m_op_ant'),
        valor_precio_ant: val('m_valor_ant'),
        stock: val('m_op_stock'),
        valor_stock: val('m_valor_stock'),
        cat: val('m_op_cat'),
        activo: val('m_op_activo'),
        destacado: val('m_op_dest')
      }
    };
  }

  function pintarMasivo(r) {
    var box = document.getElementById('masivo-result');
    var html = '<div class="stat-value mb-1">' + (Number(r.afectados) || 0) + '</div>' +
      '<div class="stat-label mb-3">productos coinciden con el filtro</div>';
    if (r.resumen && r.resumen.length) {
      html += '<ul class="small mb-0">';
      r.resumen.forEach(function (line) {
        html += '<li>' + h(line) + '</li>';
      });
      html += '</ul>';
    } else {
      html += '<p class="small text-warning mb-0">No elegiste operaciones. Completá algún campo de precio, stock o estado.</p>';
    }
    box.innerHTML = html;
  }

  function bindMasivo() {
    document.getElementById('m-previsualizar').addEventListener('click', async function () {
      try {
        var r = await api('masivo', { method: 'POST', body: payloadMasivo(false) });
        pintarMasivo(r);
      } catch (ex) {
        alertBox(ex.message, 'danger');
      }
    });

    document.getElementById('m-aplicar').addEventListener('click', async function () {
      if (!confirm('¿Aplicar los cambios a los productos filtrados?')) return;
      var btn = document.getElementById('m-aplicar');
      btn.disabled = true;
      try {
        var r = await api('masivo', { method: 'POST', body: payloadMasivo(true) });
        state.flash = { message: 'Actualización masiva aplicada a ' + r.afectados + ' producto(s).', type: 'success' };
        renderMasivo();
      } catch (ex) {
        alertBox(ex.message, 'danger');
        btn.disabled = false;
      }
    });
  }

  async function renderMasivo() {
    setTitle('Actualización masiva');
    view.innerHTML = '<div class="text-secondary py-4">Cargando…</div>';
    try {
      await cargarCategorias();
      view.innerHTML = masivoShell();
      bindMasivo();
      flashPending();
    } catch (ex) {
      view.innerHTML = '';
      alertBox(ex.message, 'danger');
    }
  }

  async function renderCuenta() {
    setTitle('Mi cuenta');
    view.innerHTML = '<div class="row g-3"><div class="col-lg-6"><div class="card">' +
      '<div class="card-header">Cambiar contraseña</div><div class="card-body">' +
      '<div id="cuenta-error" class="alert alert-danger py-2 d-none"></div>' +
      '<form id="cuenta-form">' +
      '<div class="mb-3"><label class="form-label" for="cuenta-actual">Contraseña actual</label>' +
      '<input class="form-control" type="password" id="cuenta-actual" required autocomplete="current-password"></div>' +
      '<div class="mb-3"><label class="form-label" for="cuenta-nueva">Nueva contraseña</label>' +
      '<input class="form-control" type="password" id="cuenta-nueva" required minlength="8" autocomplete="new-password">' +
      '<div class="form-text">Mínimo 8 caracteres.</div></div>' +
      '<div class="mb-3"><label class="form-label" for="cuenta-repetir">Repetir nueva contraseña</label>' +
      '<input class="form-control" type="password" id="cuenta-repetir" required autocomplete="new-password"></div>' +
      '<button class="btn btn-accent" type="submit"><i class="bi bi-shield-check"></i> Guardar contraseña</button>' +
      '</form></div></div></div><div class="col-lg-6"><div class="card">' +
      '<div class="card-header">Sesión</div><div class="card-body">' +
      '<p class="small text-secondary">Usuario: <strong>' + h(state.user.email) + '</strong></p>' +
      '<p class="small text-secondary mb-0">La sesión caduca a las 8 horas. Al cambiar la contraseña, las demás sesiones siguen activas hasta caducar.</p>' +
      '</div></div></div></div>';

    document.getElementById('cuenta-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var errorBox = document.getElementById('cuenta-error');
      errorBox.classList.add('d-none');
      var actual = document.getElementById('cuenta-actual').value;
      var nueva = document.getElementById('cuenta-nueva').value;
      var repetir = document.getElementById('cuenta-repetir').value;

      if (nueva !== repetir) {
        errorBox.textContent = 'Las contraseñas nuevas no coinciden.';
        errorBox.classList.remove('d-none');
        return;
      }

      try {
        await api('auth-password', { method: 'POST', body: { actual: actual, nueva: nueva } });
        state.flash = { message: 'Contraseña actualizada.', type: 'success' };
        renderCuenta();
      } catch (ex) {
        errorBox.textContent = ex.message;
        errorBox.classList.remove('d-none');
      }
    });

    flashPending();
  }

  document.getElementById('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var errorBox = document.getElementById('login-error');
    errorBox.classList.add('d-none');
    var btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
      var res = await fetch(API + 'auth-login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('login-email').value.trim(),
          password: document.getElementById('login-password').value
        })
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || 'No se pudo iniciar sesión.');
      state.user = data.user;
      document.getElementById('login-password').value = '';
      showApp();
    } catch (ex) {
      errorBox.textContent = ex.message;
      errorBox.classList.remove('d-none');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('logout').addEventListener('click', async function () {
    try {
      await api('auth-logout', { method: 'POST' });
    } catch (e) {
      // Ignorar: igual cerramos la vista.
    }
    state.user = null;
    state.cats = [];
    state.catRows = [];
    state.editCat = null;
    showLogin();
  });

  document.getElementById('menu-toggle').addEventListener('click', function () {
    document.body.classList.toggle('sidebar-open');
  });

  document.addEventListener('click', function (e) {
    if (document.body.classList.contains('sidebar-open') && !e.target.closest('.admin-sidebar') && !e.target.closest('#menu-toggle')) {
      document.body.classList.remove('sidebar-open');
    }
  });

  window.addEventListener('hashchange', route);

  (async function start() {
    try {
      var res = await fetch(API + 'auth-me', { credentials: 'same-origin' });
      if (res.ok) {
        var data = await res.json();
        state.user = data.user;
        showApp();
      } else {
        showLogin();
      }
    } catch (e) {
      showLogin();
    }
  })();
})();

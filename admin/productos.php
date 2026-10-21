<?php
require_once dirname(__DIR__) . '/includes/layout.php';
require_login();

// ---- Acciones masivas / individuales (POST) ----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $accion = isset($_POST['accion']) ? $_POST['accion'] : '';
    $ids = isset($_POST['ids']) && is_array($_POST['ids']) ? array_map('intval', $_POST['ids']) : array();
    $ids = array_values(array_filter($ids));
    $volver = isset($_POST['volver']) ? $_POST['volver'] : 'productos.php';

    if ($ids) {
        $filtro = array('id' => sb_in($ids));
        if ($accion === 'activar') {
            sb()->update('productos', $filtro, array('activo' => true));
            flash_set('success', count($ids) . ' producto(s) activados.');
        } elseif ($accion === 'desactivar') {
            sb()->update('productos', $filtro, array('activo' => false));
            flash_set('success', count($ids) . ' producto(s) desactivados.');
        } elseif ($accion === 'destacar') {
            sb()->update('productos', $filtro, array('destacado' => true));
            flash_set('success', count($ids) . ' producto(s) marcados como destacados.');
        } elseif ($accion === 'quitar_destacar') {
            sb()->update('productos', $filtro, array('destacado' => false));
            flash_set('success', count($ids) . ' producto(s) quitados de destacados.');
        } elseif ($accion === 'mover') {
            $cat = isset($_POST['categoria_id']) && $_POST['categoria_id'] !== '' ? (int) $_POST['categoria_id'] : null;
            sb()->update('productos', $filtro, array('categoria_id' => $cat));
            flash_set('success', count($ids) . ' producto(s) movidos de categoría.');
        } elseif ($accion === 'eliminar') {
            sb()->delete('productos', $filtro);
            flash_set('warning', count($ids) . ' producto(s) eliminados.');
        }
    } else {
        flash_set('warning', 'No seleccionaste productos.');
    }
    redirect($volver);
}

// ---- Filtros ----
$q      = isset($_GET['q']) ? trim($_GET['q']) : '';
$cat    = isset($_GET['cat']) && $_GET['cat'] !== '' ? (int) $_GET['cat'] : 0;
$estado = isset($_GET['estado']) ? $_GET['estado'] : '';
$dest   = isset($_GET['dest']) ? (int) $_GET['dest'] : 0;
$orden  = isset($_GET['orden']) ? $_GET['orden'] : 'recientes';
$page   = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;

$resultado = productos_buscar(array(
    'q' => $q, 'cat' => $cat, 'estado' => $estado, 'dest' => $dest,
    'orden' => $orden, 'page' => $page
));
$productos = $resultado['rows'];
$total     = $resultado['total'];
$paginas   = $resultado['paginas'];
$page      = $resultado['page'];

$categorias = categorias_select(false);

// Guardar query actual para volver tras acciones
$queryActual = $_SERVER['QUERY_STRING'] ? 'productos.php?' . $_SERVER['QUERY_STRING'] : 'productos.php';

admin_header('Productos', 'productos.php');
?>
<div class="card">
  <div class="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
    <form class="d-flex flex-wrap gap-2 align-items-center" method="get">
      <input class="form-control form-control-sm" style="width:220px" type="search" name="q" value="<?php echo h($q); ?>" placeholder="Buscar nombre, SKU…">
      <select class="form-select form-select-sm" style="width:150px" name="cat">
        <option value="">Todas las categorías</option>
        <?php foreach ($categorias as $c): ?>
          <option value="<?php echo (int) $c['id']; ?>" <?php echo $cat === (int) $c['id'] ? 'selected' : ''; ?>><?php echo h($c['nombre']); ?></option>
        <?php endforeach; ?>
      </select>
      <select class="form-select form-select-sm" style="width:140px" name="estado">
        <option value="">Cualquier estado</option>
        <option value="activos" <?php echo $estado === 'activos' ? 'selected' : ''; ?>>Activos</option>
        <option value="inactivos" <?php echo $estado === 'inactivos' ? 'selected' : ''; ?>>Inactivos</option>
        <option value="agotados" <?php echo $estado === 'agotados' ? 'selected' : ''; ?>>Agotados</option>
        <option value="bajo" <?php echo $estado === 'bajo' ? 'selected' : ''; ?>>Stock bajo</option>
      </select>
      <select class="form-select form-select-sm" style="width:150px" name="orden">
        <option value="recientes" <?php echo $orden === 'recientes' ? 'selected' : ''; ?>>Más recientes</option>
        <option value="nombre" <?php echo $orden === 'nombre' ? 'selected' : ''; ?>>Nombre A-Z</option>
        <option value="precio_asc" <?php echo $orden === 'precio_asc' ? 'selected' : ''; ?>>Precio ↑</option>
        <option value="precio_desc" <?php echo $orden === 'precio_desc' ? 'selected' : ''; ?>>Precio ↓</option>
        <option value="stock_asc" <?php echo $orden === 'stock_asc' ? 'selected' : ''; ?>>Stock ↑</option>
      </select>
      <label class="form-check d-flex align-items-center gap-1 m-0">
        <input class="form-check-input" type="checkbox" name="dest" value="1" <?php echo $dest ? 'checked' : ''; ?>>
        <span class="small">Destacados</span>
      </label>
      <button class="btn btn-sm btn-outline-accent" type="submit"><i class="bi bi-funnel"></i> Filtrar</button>
      <a class="btn btn-sm btn-outline-secondary" href="productos.php">Limpiar</a>
    </form>
    <div class="d-flex gap-2">
      <a class="btn btn-sm btn-outline-accent" href="exportar.php?<?php echo h($_SERVER['QUERY_STRING']); ?>"><i class="bi bi-download"></i> Exportar</a>
      <a class="btn btn-sm btn-accent" href="producto-editar.php"><i class="bi bi-plus-lg"></i> Nuevo producto</a>
    </div>
  </div>

  <form method="post" id="form-bulk">
    <?php echo csrf_field(); ?>
    <input type="hidden" name="volver" value="<?php echo h($queryActual); ?>">

    <div class="px-3 py-2 border-bottom border-secondary-subtle d-flex flex-wrap gap-2 align-items-center bg-black-50">
      <span class="text-secondary small"><?php echo number_format($total, 0, ',', '.'); ?> productos</span>
      <div class="ms-auto d-flex flex-wrap gap-2">
        <select name="accion" id="bulk-accion" class="form-select form-select-sm" style="width:200px">
          <option value="">Acción en lote…</option>
          <option value="activar">Activar</option>
          <option value="desactivar">Desactivar</option>
          <option value="destacar">Marcar destacados</option>
          <option value="quitar_destacar">Quitar destacados</option>
          <option value="mover">Mover a categoría</option>
          <option value="eliminar">Eliminar</option>
        </select>
        <select name="categoria_id" id="bulk-cat" class="form-select form-select-sm d-none" style="width:180px">
          <?php foreach ($categorias as $c): ?>
            <option value="<?php echo (int) $c['id']; ?>"><?php echo h($c['nombre']); ?></option>
          <?php endforeach; ?>
        </select>
        <button class="btn btn-sm btn-outline-accent" type="submit" onclick="return confirm('¿Aplicar la acción a los productos seleccionados?')">Aplicar</button>
      </div>
    </div>

    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead>
          <tr>
            <th style="width:36px"><input class="form-check-input" type="checkbox" id="check-all"></th>
            <th>Producto</th>
            <th>SKU</th>
            <th>Categoría</th>
            <th class="text-end">Precio</th>
            <th class="text-end">Stock</th>
            <th class="text-center">Estado</th>
            <th class="text-end">Acciones</th>
          </tr>
        </thead>
        <tbody>
        <?php if (!$productos): ?>
          <tr><td colspan="8" class="text-center text-secondary py-5">No hay productos que coincidan con el filtro.</td></tr>
        <?php endif; ?>
        <?php foreach ($productos as $p):
            $img = imagen_src($p['imagen'], '../');
        ?>
          <tr>
            <td><input class="form-check-input row-check" type="checkbox" name="ids[]" value="<?php echo (int) $p['id']; ?>"></td>
            <td>
              <div class="d-flex align-items-center gap-2">
                <?php if ($img): ?>
                  <img class="prod-thumb" src="<?php echo h($img); ?>" alt="" onerror="this.style.visibility='hidden'">
                <?php else: ?>
                  <div class="prod-thumb d-grid" style="place-items:center"><i class="bi bi-image text-secondary"></i></div>
                <?php endif; ?>
                <div>
                  <a class="text-decoration-none text-reset fw-semibold" href="producto-editar.php?id=<?php echo (int) $p['id']; ?>"><?php echo h($p['nombre']); ?></a>
                  <div class="small text-secondary">
                    <?php if ((int) $p['destacado']): ?><span class="badge badge-soft">destacado</span><?php endif; ?>
                  </div>
                </div>
              </div>
            </td>
            <td class="small text-secondary"><?php echo h($p['sku']); ?></td>
            <td class="small"><?php echo h($p['categoria'] ? $p['categoria'] : '—'); ?></td>
            <td class="text-end">
              <div class="fw-semibold"><?php echo money($p['precio']); ?></div>
              <?php if ($p['precio_anterior'] !== null && $p['precio_anterior'] !== ''): ?>
                <div class="small text-secondary text-decoration-line-through"><?php echo money($p['precio_anterior']); ?></div>
              <?php endif; ?>
            </td>
            <td class="text-end">
              <?php if ((int) $p['stock'] <= 0): ?>
                <span class="badge badge-stock-no">0</span>
              <?php elseif ((int) $p['stock'] <= 5): ?>
                <span class="badge badge-stock-low"><?php echo (int) $p['stock']; ?></span>
              <?php else: ?>
                <span class="badge badge-stock-ok"><?php echo (int) $p['stock']; ?></span>
              <?php endif; ?>
            </td>
            <td class="text-center">
              <?php if ((int) $p['activo']): ?>
                <span class="badge badge-soft">Activo</span>
              <?php else: ?>
                <span class="badge text-bg-secondary">Inactivo</span>
              <?php endif; ?>
            </td>
            <td class="text-end text-nowrap">
              <a class="btn btn-sm btn-outline-secondary" href="producto-editar.php?id=<?php echo (int) $p['id']; ?>" title="Editar"><i class="bi bi-pencil"></i></a>
              <a class="btn btn-sm btn-outline-danger" href="../producto.html?id=<?php echo h($p['slug']); ?>" target="_blank" title="Ver en tienda"><i class="bi bi-eye"></i></a>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </form>

  <?php if ($paginas > 1): ?>
  <div class="card-body">
    <nav>
      <ul class="pagination pagination-sm mb-0 justify-content-center">
        <?php
        $base = $_GET; 
        for ($i = 1; $i <= $paginas; $i++):
            $base['page'] = $i;
            $url = 'productos.php?' . http_build_query($base);
        ?>
          <li class="page-item <?php echo $i === $page ? 'active' : ''; ?>"><a class="page-link" href="<?php echo h($url); ?>"><?php echo $i; ?></a></li>
        <?php endfor; ?>
      </ul>
    </nav>
  </div>
  <?php endif; ?>
</div>

<script>
(function () {
  var all = document.getElementById('check-all');
  if (all) {
    all.addEventListener('change', function () {
      document.querySelectorAll('.row-check').forEach(function (c) { c.checked = all.checked; });
    });
  }
  var accion = document.getElementById('bulk-accion');
  var cat = document.getElementById('bulk-cat');
  if (accion && cat) {
    accion.addEventListener('change', function () {
      cat.classList.toggle('d-none', accion.value !== 'mover');
    });
  }
})();
</script>
<?php admin_footer();

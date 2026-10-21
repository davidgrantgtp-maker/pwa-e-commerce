<?php
require_once dirname(__DIR__) . '/includes/layout.php';
require_login();

$stats = sb()->rpc('dashboard_stats');
$stats = is_array($stats) ? $stats : array();

$totalProductos  = (int) (isset($stats['total_productos']) ? $stats['total_productos'] : 0);
$activos         = (int) (isset($stats['activos']) ? $stats['activos'] : 0);
$agotados        = (int) (isset($stats['agotados']) ? $stats['agotados'] : 0);
$bajoStock       = (int) (isset($stats['bajo_stock']) ? $stats['bajo_stock'] : 0);
$totalCategorias = (int) (isset($stats['total_categorias']) ? $stats['total_categorias'] : 0);
$valorInventario = (float) (isset($stats['valor_inventario']) ? $stats['valor_inventario'] : 0);

$porCategoria  = sb()->rpc('por_categoria');
$stockCritico  = sb()->rpc('stock_critico', array('p_limit' => 8));
$importaciones = sb()->rpc('ultimas_importaciones', array('p_limit' => 5));
$movimientos   = sb()->rpc('ultimos_movimientos', array('p_limit' => 6));

admin_header('Dashboard', 'index.php');
?>
<div class="row g-3 mb-2">
  <div class="col-6 col-lg-3">
    <div class="card stat-card h-100">
      <div class="d-flex align-items-center gap-3">
        <div class="stat-icon"><i class="bi bi-box-seam"></i></div>
        <div>
          <div class="stat-value"><?php echo number_format($totalProductos, 0, ',', '.'); ?></div>
          <div class="stat-label">Productos (<?php echo $activos; ?> activos)</div>
        </div>
      </div>
    </div>
  </div>
  <div class="col-6 col-lg-3">
    <div class="card stat-card h-100">
      <div class="d-flex align-items-center gap-3">
        <div class="stat-icon"><i class="bi bi-tags"></i></div>
        <div>
          <div class="stat-value"><?php echo $totalCategorias; ?></div>
          <div class="stat-label">Categorías</div>
        </div>
      </div>
    </div>
  </div>
  <div class="col-6 col-lg-3">
    <div class="card stat-card h-100">
      <div class="d-flex align-items-center gap-3">
        <div class="stat-icon" style="background:rgba(248,113,113,.12);color:#fca5a5"><i class="bi bi-exclamation-triangle"></i></div>
        <div>
          <div class="stat-value"><?php echo $agotados + $bajoStock; ?></div>
          <div class="stat-label">Sin stock (<?php echo $agotados; ?>) o bajo (<?php echo $bajoStock; ?>)</div>
        </div>
      </div>
    </div>
  </div>
  <div class="col-6 col-lg-3">
    <div class="card stat-card h-100">
      <div class="d-flex align-items-center gap-3">
        <div class="stat-icon" style="background:rgba(52,211,153,.12);color:#6ee7b7"><i class="bi bi-cash-coin"></i></div>
        <div>
          <div class="stat-value"><?php echo money($valorInventario); ?></div>
          <div class="stat-label">Valor de inventario</div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="row g-3">
  <div class="col-lg-7">
    <div class="card h-100">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span>Productos con stock crítico</span>
        <a href="productos.php" class="btn btn-sm btn-outline-accent">Ver todos</a>
      </div>
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead><tr><th>Producto</th><th>SKU</th><th class="text-end">Stock</th><th></th></tr></thead>
          <tbody>
          <?php if (!$stockCritico): ?>
            <tr><td colspan="4" class="text-center text-secondary py-4">Sin alertas de stock. Todo en orden.</td></tr>
          <?php endif; ?>
          <?php foreach ($stockCritico as $p): ?>
            <tr>
              <td><?php echo h($p['nombre']); ?></td>
              <td class="text-secondary small"><?php echo h($p['sku']); ?></td>
              <td class="text-end">
                <?php if ((int) $p['stock'] <= 0): ?>
                  <span class="badge badge-stock-no">Sin stock</span>
                <?php else: ?>
                  <span class="badge badge-stock-low"><?php echo (int) $p['stock']; ?> u.</span>
                <?php endif; ?>
              </td>
              <td class="text-end"><a class="btn btn-sm btn-outline-secondary" href="producto-editar.php?id=<?php echo (int) $p['id']; ?>"><i class="bi bi-pencil"></i></a></td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="col-lg-5">
    <div class="card mb-3">
      <div class="card-header">Productos por categoría</div>
      <div class="card-body">
        <?php if (!$porCategoria): ?>
          <p class="text-secondary mb-0">Todavía no hay categorías.</p>
        <?php endif; ?>
        <?php
        $max = 1;
        foreach ($porCategoria as $c) { $max = max($max, (int) $c['total']); }
        foreach ($porCategoria as $c):
            $pct = round(((int) $c['total'] / $max) * 100);
        ?>
          <div class="d-flex justify-content-between small mb-1">
            <span><?php echo h($c['nombre']); ?></span>
            <span class="text-secondary"><?php echo (int) $c['total']; ?></span>
          </div>
          <div class="progress mb-3" style="height:8px;background:#0a0f1c">
            <div class="progress-bar" style="width:<?php echo $pct; ?>%;background:var(--a-accent)"></div>
          </div>
        <?php endforeach; ?>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Últimos movimientos</div>
      <div class="card-body">
        <?php if (!$movimientos): ?>
          <p class="text-secondary mb-0 small">Sin movimientos registrados.</p>
        <?php endif; ?>
        <?php foreach ($movimientos as $m): ?>
          <div class="d-flex gap-2 small border-bottom border-secondary-subtle py-2">
            <i class="bi bi-arrow-left-right text-info"></i>
            <div>
              <div><?php echo h($m['producto'] ? $m['producto'] : 'Producto #' . $m['producto_id']); ?></div>
              <div class="text-secondary"><?php echo h($m['campo']); ?> · <?php echo h($m['tipo']); ?> <?php echo h($m['valor']); ?> · <?php echo h(fecha_legible($m['creado_en'])); ?></div>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    </div>
  </div>
</div>

<div class="card mt-3">
  <div class="card-header d-flex justify-content-between align-items-center">
    <span>Últimas importaciones</span>
    <a href="importar.php" class="btn btn-sm btn-accent"><i class="bi bi-file-earmark-arrow-up"></i> Importar</a>
  </div>
  <div class="table-responsive">
    <table class="table align-middle mb-0">
      <thead><tr><th>Archivo</th><th>Total</th><th>Creadas</th><th>Actualizadas</th><th>Errores</th><th>Fecha</th></tr></thead>
      <tbody>
      <?php if (!$importaciones): ?>
        <tr><td colspan="6" class="text-center text-secondary py-4">Todavía no importaste archivos.</td></tr>
      <?php endif; ?>
      <?php foreach ($importaciones as $imp): ?>
        <tr>
          <td><?php echo h($imp['archivo']); ?></td>
          <td><?php echo (int) $imp['total']; ?></td>
          <td class="text-success"><?php echo (int) $imp['creadas']; ?></td>
          <td class="text-info"><?php echo (int) $imp['actualizadas']; ?></td>
          <td class="<?php echo (int) $imp['errores'] ? 'text-danger' : 'text-secondary'; ?>"><?php echo (int) $imp['errores']; ?></td>
          <td class="text-secondary small"><?php echo h(fecha_legible($imp['creado_en'])); ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php admin_footer();

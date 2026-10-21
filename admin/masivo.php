<?php
require_once dirname(__DIR__) . '/includes/layout.php';
require_login();

$user = current_user();

$v = array(
    'f_cat' => '', 'f_estado' => '', 'f_q' => '',
    'op_precio' => '', 'valor_precio' => '',
    'op_precio_ant' => '', 'valor_precio_ant' => '',
    'op_stock' => '', 'valor_stock' => '',
    'op_cat' => '',
    'op_activo' => '',
    'op_destacado' => ''
);

$paso = '';
$afectados = 0;
$resumen = array();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    foreach ($v as $k => $dummy) {
        $v[$k] = isset($_POST[$k]) ? trim($_POST[$k]) : '';
    }
    $paso = isset($_POST['paso']) ? $_POST['paso'] : 'preview';

    $res = productos_buscar(array(
        'q' => $v['f_q'], 'cat' => (int) $v['f_cat'], 'estado' => $v['f_estado'],
        'per_page' => 0
    ));
    $lista = $res['rows'];
    $afectados = count($lista);

    // Resumen legible
    if ($v['op_precio'] === 'set') { $resumen[] = 'Precio fijado en ' . money(parse_numero($v['valor_precio'])); }
    if ($v['op_precio'] === 'inc') { $resumen[] = 'Precio + ' . money(parse_numero($v['valor_precio'])); }
    if ($v['op_precio'] === 'dec') { $resumen[] = 'Precio - ' . money(parse_numero($v['valor_precio'])); }
    if ($v['op_precio'] === 'pct_inc') { $resumen[] = 'Precio +' . (float) $v['valor_precio'] . '%'; }
    if ($v['op_precio'] === 'pct_dec') { $resumen[] = 'Precio -' . (float) $v['valor_precio'] . '%'; }
    if ($v['op_precio'] === 'round') { $resumen[] = 'Precio redondeado al entero'; }
    if ($v['op_precio_ant'] === 'set') { $resumen[] = 'Precio anterior fijado en ' . money(parse_numero($v['valor_precio_ant'])); }
    if ($v['op_precio_ant'] === 'equal') { $resumen[] = 'Precio anterior = precio actual'; }
    if ($v['op_precio_ant'] === 'clear') { $resumen[] = 'Precio anterior borrado'; }
    if ($v['op_stock'] === 'set') { $resumen[] = 'Stock fijado en ' . (int) parse_numero($v['valor_stock']); }
    if ($v['op_stock'] === 'inc') { $resumen[] = 'Stock + ' . (int) parse_numero($v['valor_stock']); }
    if ($v['op_stock'] === 'dec') { $resumen[] = 'Stock - ' . (int) parse_numero($v['valor_stock']); }
    if ($v['op_cat'] !== '') {
        $catSel = categoria_obtener((int) $v['op_cat']);
        $catNombre = $catSel ? $catSel['nombre'] : $v['op_cat'];
        $resumen[] = 'Categoría → ' . $catNombre;
    }
    if ($v['op_activo'] !== '') { $resumen[] = 'Estado → ' . ($v['op_activo'] === '1' ? 'Activo' : 'Inactivo'); }
    if ($v['op_destacado'] !== '') { $resumen[] = 'Destacado → ' . ($v['op_destacado'] === '1' ? 'Sí' : 'No'); }

    if ($paso === 'apply') {
        if (!$resumen) {
            flash_set('warning', 'No elegiste ninguna operación para aplicar.');
            redirect('masivo.php');
        }
        $precioVal = parse_numero($v['valor_precio']);
        $stockVal = (int) parse_numero($v['valor_stock']);
        $precioAntVal = parse_numero($v['valor_precio_ant']);

        $uid = $user ? (int) $user['id'] : 0;
        $updates = array();
        $movs = array();

        foreach ($lista as $p) {
            $precio = (float) $p['precio'];
            $stock = (int) $p['stock'];
            $precioAnt = $p['precio_anterior'] !== null ? (float) $p['precio_anterior'] : null;
            $catId = $p['categoria_id'] !== null ? (int) $p['categoria_id'] : null;
            $activo = (bool) $p['activo'];
            $destacado = (bool) $p['destacado'];
            $origPrecio = $precio;
            $origStock = $stock;

            if ($v['op_precio'] === 'set' && $precioVal !== null) { $precio = $precioVal; }
            if ($v['op_precio'] === 'inc' && $precioVal !== null) { $precio = $precio + $precioVal; }
            if ($v['op_precio'] === 'dec' && $precioVal !== null) { $precio = $precio - $precioVal; }
            if ($v['op_precio'] === 'pct_inc' && $precioVal !== null) { $precio = $precio * (1 + $precioVal / 100); }
            if ($v['op_precio'] === 'pct_dec' && $precioVal !== null) { $precio = $precio * (1 - $precioVal / 100); }
            if ($v['op_precio'] === 'round') { $precio = round($precio); }
            $precio = max(0, round($precio, 2));

            if ($v['op_precio_ant'] === 'set') { $precioAnt = $precioAntVal; }
            if ($v['op_precio_ant'] === 'equal') { $precioAnt = $precio; }
            if ($v['op_precio_ant'] === 'clear') { $precioAnt = null; }

            if ($v['op_stock'] === 'set') { $stock = $stockVal; }
            if ($v['op_stock'] === 'inc') { $stock = $stock + $stockVal; }
            if ($v['op_stock'] === 'dec') { $stock = $stock - $stockVal; }
            $stock = (int) $stock;

            if ($v['op_cat'] !== '') { $catId = (int) $v['op_cat']; }
            if ($v['op_activo'] !== '') { $activo = (bool) (int) $v['op_activo']; }
            if ($v['op_destacado'] !== '') { $destacado = (bool) (int) $v['op_destacado']; }

            $updates[] = array(
                'id' => (int) $p['id'],
                'precio' => $precio,
                'precio_anterior' => $precioAnt === null ? '' : (string) $precioAnt,
                'stock' => $stock,
                'categoria_id' => $catId === null ? '' : (string) $catId,
                'activo' => $activo,
                'destacado' => $destacado
            );

            if ($v['op_precio'] !== '' && abs($precio - $origPrecio) > 0.001) {
                $movs[] = array('producto_id' => (int) $p['id'], 'campo' => 'precio', 'tipo' => $v['op_precio'], 'valor' => (string) $precio, 'motivo' => 'Actualización masiva', 'usuario_id' => $uid);
            }
            if ($v['op_stock'] !== '' && $stock !== $origStock) {
                $movs[] = array('producto_id' => (int) $p['id'], 'campo' => 'stock', 'tipo' => $v['op_stock'], 'valor' => (string) $stock, 'motivo' => 'Actualización masiva', 'usuario_id' => $uid);
            }
            if ($v['op_precio_ant'] !== '') {
                $movs[] = array('producto_id' => (int) $p['id'], 'campo' => 'precio_anterior', 'tipo' => $v['op_precio_ant'], 'valor' => $precioAnt === null ? '' : (string) $precioAnt, 'motivo' => 'Actualización masiva', 'usuario_id' => $uid);
            }
        }

        try {
            sb()->rpc('aplicar_masivo', array(
                'p_updates' => $updates,
                'p_movs' => $movs,
                'p_uid' => $uid
            ));
            flash_set('success', 'Actualización masiva aplicada a ' . $afectados . ' producto(s).');
        } catch (Exception $e) {
            flash_set('danger', 'Error al aplicar: ' . $e->getMessage());
        }
        redirect('masivo.php');
    }
}

$categorias = categorias_select(false);

admin_header('Actualización masiva', 'masivo.php');
?>
<div class="row g-3">
  <div class="col-lg-8">
    <form method="post">
      <?php echo csrf_field(); ?>

      <div class="card mb-3">
        <div class="card-header"><i class="bi bi-funnel"></i> 1. Seleccionar productos</div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label" for="f_q">Buscar</label>
              <input class="form-control" id="f_q" name="f_q" value="<?php echo h($v['f_q']); ?>" placeholder="Nombre o SKU">
            </div>
            <div class="col-md-4">
              <label class="form-label" for="f_cat">Categoría</label>
              <select class="form-select" id="f_cat" name="f_cat">
                <option value="">Todas</option>
                <?php foreach ($categorias as $c): ?>
                  <option value="<?php echo (int) $c['id']; ?>" <?php echo (string) $v['f_cat'] === (string) $c['id'] ? 'selected' : ''; ?>><?php echo h($c['nombre']); ?></option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label" for="f_estado">Estado / stock</label>
              <select class="form-select" id="f_estado" name="f_estado">
                <option value="">Todos</option>
                <option value="activos" <?php echo $v['f_estado'] === 'activos' ? 'selected' : ''; ?>>Activos</option>
                <option value="inactivos" <?php echo $v['f_estado'] === 'inactivos' ? 'selected' : ''; ?>>Inactivos</option>
                <option value="agotados" <?php echo $v['f_estado'] === 'agotados' ? 'selected' : ''; ?>>Agotados</option>
                <option value="bajo" <?php echo $v['f_estado'] === 'bajo' ? 'selected' : ''; ?>>Stock bajo</option>
              </select>
            </div>
          </div>
          <p class="small text-secondary mt-3 mb-0">Los cambios se aplican a todos los productos que coincidan con el filtro. Dejá los campos vacíos si no querés modificar ese dato.</p>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><i class="bi bi-cash-coin"></i> 2. Precios</div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-7">
              <label class="form-label" for="op_precio">Operación de precio</label>
              <select class="form-select" id="op_precio" name="op_precio">
                <option value="">Sin cambios</option>
                <option value="set" <?php echo $v['op_precio'] === 'set' ? 'selected' : ''; ?>>Fijar precio</option>
                <option value="inc" <?php echo $v['op_precio'] === 'inc' ? 'selected' : ''; ?>>Sumar monto</option>
                <option value="dec" <?php echo $v['op_precio'] === 'dec' ? 'selected' : ''; ?>>Restar monto</option>
                <option value="pct_inc" <?php echo $v['op_precio'] === 'pct_inc' ? 'selected' : ''; ?>>Aumentar porcentaje (%)</option>
                <option value="pct_dec" <?php echo $v['op_precio'] === 'pct_dec' ? 'selected' : ''; ?>>Descontar porcentaje (%)</option>
                <option value="round" <?php echo $v['op_precio'] === 'round' ? 'selected' : ''; ?>>Redondear al entero</option>
              </select>
            </div>
            <div class="col-md-5">
              <label class="form-label" for="valor_precio">Valor / porcentaje</label>
              <input class="form-control" id="valor_precio" name="valor_precio" value="<?php echo h($v['valor_precio']); ?>" placeholder="Ej: 10">
            </div>
            <div class="col-md-7">
              <label class="form-label" for="op_precio_ant">Precio anterior (tachado)</label>
              <select class="form-select" id="op_precio_ant" name="op_precio_ant">
                <option value="">Sin cambios</option>
                <option value="equal" <?php echo $v['op_precio_ant'] === 'equal' ? 'selected' : ''; ?>>Igual al precio actual</option>
                <option value="set" <?php echo $v['op_precio_ant'] === 'set' ? 'selected' : ''; ?>>Fijar un valor</option>
                <option value="clear" <?php echo $v['op_precio_ant'] === 'clear' ? 'selected' : ''; ?>>Borrar precio anterior</option>
              </select>
            </div>
            <div class="col-md-5">
              <label class="form-label" for="valor_precio_ant">Valor precio anterior</label>
              <input class="form-control" id="valor_precio_ant" name="valor_precio_ant" value="<?php echo h($v['valor_precio_ant']); ?>">
            </div>
          </div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><i class="bi bi-boxes"></i> 3. Stock, categoría y estado</div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-7">
              <label class="form-label" for="op_stock">Operación de stock</label>
              <select class="form-select" id="op_stock" name="op_stock">
                <option value="">Sin cambios</option>
                <option value="set" <?php echo $v['op_stock'] === 'set' ? 'selected' : ''; ?>>Fijar stock</option>
                <option value="inc" <?php echo $v['op_stock'] === 'inc' ? 'selected' : ''; ?>>Sumar unidades</option>
                <option value="dec" <?php echo $v['op_stock'] === 'dec' ? 'selected' : ''; ?>>Restar unidades</option>
              </select>
            </div>
            <div class="col-md-5">
              <label class="form-label" for="valor_stock">Unidades</label>
              <input class="form-control" id="valor_stock" name="valor_stock" value="<?php echo h($v['valor_stock']); ?>" placeholder="Ej: 10">
            </div>
            <div class="col-md-4">
              <label class="form-label" for="op_cat">Cambiar categoría</label>
              <select class="form-select" id="op_cat" name="op_cat">
                <option value="">Sin cambios</option>
                <?php foreach ($categorias as $c): ?>
                  <option value="<?php echo (int) $c['id']; ?>" <?php echo (string) $v['op_cat'] === (string) $c['id'] ? 'selected' : ''; ?>><?php echo h($c['nombre']); ?></option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label" for="op_activo">Estado</label>
              <select class="form-select" id="op_activo" name="op_activo">
                <option value="">Sin cambios</option>
                <option value="1" <?php echo $v['op_activo'] === '1' ? 'selected' : ''; ?>>Activo</option>
                <option value="0" <?php echo $v['op_activo'] === '0' ? 'selected' : ''; ?>>Inactivo</option>
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label" for="op_destacado">Destacado</label>
              <select class="form-select" id="op_destacado" name="op_destacado">
                <option value="">Sin cambios</option>
                <option value="1" <?php echo $v['op_destacado'] === '1' ? 'selected' : ''; ?>>Sí</option>
                <option value="0" <?php echo $v['op_destacado'] === '0' ? 'selected' : ''; ?>>No</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex gap-2">
        <button class="btn btn-outline-accent" type="submit" name="paso" value="preview"><i class="bi bi-calculator"></i> Previsualizar</button>
        <button class="btn btn-accent" type="submit" name="paso" value="apply" onclick="return confirm('¿Aplicar los cambios a los productos filtrados?');"><i class="bi bi-lightning-charge"></i> Aplicar cambios</button>
      </div>
    </form>
  </div>

  <div class="col-lg-4">
    <div class="card">
      <div class="card-header">Resultado de la previsualización</div>
      <div class="card-body">
        <?php if ($paso === 'preview'): ?>
          <div class="stat-value mb-1"><?php echo $afectados; ?></div>
          <div class="stat-label mb-3">productos coinciden con el filtro</div>
          <?php if ($resumen): ?>
            <ul class="small mb-0">
              <?php foreach ($resumen as $r): ?><li><?php echo h($r); ?></li><?php endforeach; ?>
            </ul>
          <?php else: ?>
            <p class="small text-warning mb-0">No elegiste operaciones. Completá algún campo de precio, stock o estado.</p>
          <?php endif; ?>
        <?php else: ?>
          <p class="small text-secondary mb-2">Elegí los filtros y operaciones, y usá “Previsualizar” para ver cuántos productos se van a modificar.</p>
          <p class="small text-secondary mb-0">Cada cambio queda registrado en movimientos para auditoría.</p>
        <?php endif; ?>
      </div>
    </div>
  </div>
</div>
<?php admin_footer();

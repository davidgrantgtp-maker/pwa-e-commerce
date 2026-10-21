<?php
require_once dirname(__DIR__) . '/includes/layout.php';
require_once dirname(__DIR__) . '/includes/import.php';
require_login();

$user = current_user();
$paso = isset($_GET['step']) ? $_GET['step'] : 'upload';
$error = '';
$resultado = null;

// ---- Cancelar ----
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['accion']) && $_POST['accion'] === 'cancelar') {
    csrf_check();
    unset($_SESSION['import_data'], $_SESSION['import_result']);
    redirect('importar.php');
}

// ---- Subir y previsualizar ----
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['accion']) && $_POST['accion'] === 'preview') {
    csrf_check();
    if (empty($_FILES['archivo']['name'])) {
        $error = 'Seleccioná un archivo CSV o XLSX.';
    } else {
        $f = $_FILES['archivo'];
        $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        if ($f['error'] !== UPLOAD_ERR_OK) {
            $error = 'No se pudo subir el archivo (código ' . (int) $f['error'] . ').';
        } elseif (!in_array($ext, array('csv', 'xlsx', 'txt'), true)) {
            $error = 'Formato no soportado. Usá .csv o .xlsx.';
        } elseif ($f['size'] > 5 * 1024 * 1024) {
            $error = 'El archivo supera los 5 MB.';
        } else {
            $tmp = $f['tmp_name'];
            $filas = import_leer($tmp, $f['name']);
            $prep = import_preparar($filas);
            if (!$prep['rows']) {
                $error = 'No se encontraron filas con datos. Revisá el archivo.';
            } elseif (!in_array('nombre', $prep['map'], true)) {
                $error = 'No se detectó la columna "Nombre". Descargá la plantilla para ver el formato esperado.';
            } else {
                $_SESSION['import_data'] = array(
                    'archivo' => $f['name'],
                    'headers' => $prep['headers'],
                    'map' => $prep['map'],
                    'rows' => $prep['rows'],
                    'fecha' => date('Y-m-d H:i:s')
                );
                redirect('importar.php?step=preview');
            }
        }
    }
}

// ---- Confirmar importación ----
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['accion']) && $_POST['accion'] === 'confirmar') {
    csrf_check();
    if (empty($_SESSION['import_data']['rows'])) {
        $error = 'La previsualización expiró. Volvé a subir el archivo.';
    } else {
        $data = $_SESSION['import_data'];
        $_SESSION['import_result'] = import_procesar($data['rows'], $data['archivo'], $user ? (int) $user['id'] : 0);
        unset($_SESSION['import_data']);
        redirect('importar.php?step=result');
    }
}

$data = isset($_SESSION['import_data']) ? $_SESSION['import_data'] : null;
if ($paso === 'result') {
    $resultado = isset($_SESSION['import_result']) ? $_SESSION['import_result'] : null;
    unset($_SESSION['import_result']);
    if (!$resultado) { $paso = 'upload'; }
}
if ($paso === 'preview' && !$data) { $paso = 'upload'; }

$historial = sb()->rpc('ultimas_importaciones', array('p_limit' => 12));
$historial = is_array($historial) ? $historial : array();

$etiquetas = array(
    'sku' => 'SKU', 'nombre' => 'Nombre', 'categoria' => 'Categoría', 'precio' => 'Precio',
    'precio_anterior' => 'Precio anterior', 'costo' => 'Costo', 'stock' => 'Stock',
    'descripcion' => 'Descripción', 'imagen' => 'Imagen', 'etiqueta' => 'Etiqueta',
    'destacado' => 'Destacado', 'activo' => 'Activo'
);

admin_header('Importar Excel/CSV', 'importar.php');
?>
<?php if ($error): ?>
  <div class="alert alert-danger"><?php echo h($error); ?></div>
<?php endif; ?>

<?php if ($paso === 'result' && $resultado): ?>
  <div class="card mb-3">
    <div class="card-header d-flex align-items-center gap-2"><i class="bi bi-check-circle-fill text-success"></i> Importación finalizada</div>
    <div class="card-body">
      <div class="row text-center g-3">
        <div class="col-6 col-md-3"><div class="stat-value"><?php echo (int) $resultado['total']; ?></div><div class="stat-label">Filas procesadas</div></div>
        <div class="col-6 col-md-3"><div class="stat-value text-success"><?php echo (int) $resultado['creadas']; ?></div><div class="stat-label">Creadas</div></div>
        <div class="col-6 col-md-3"><div class="stat-value text-info"><?php echo (int) $resultado['actualizadas']; ?></div><div class="stat-label">Actualizadas</div></div>
        <div class="col-6 col-md-3"><div class="stat-value <?php echo (int) $resultado['errores'] ? 'text-danger' : 'text-secondary'; ?>"><?php echo (int) $resultado['errores']; ?></div><div class="stat-label">Errores</div></div>
      </div>
      <?php if (!empty($resultado['detalles'])): ?>
        <hr>
        <p class="small text-secondary mb-1">Detalle de errores (primeros 30):</p>
        <ul class="small text-danger">
          <?php foreach (array_slice($resultado['detalles'], 0, 30) as $d): ?><li><?php echo h($d); ?></li><?php endforeach; ?>
        </ul>
      <?php endif; ?>
      <div class="d-flex gap-2 mt-3">
        <a class="btn btn-accent" href="productos.php"><i class="bi bi-box-seam"></i> Ver productos</a>
        <a class="btn btn-outline-secondary" href="importar.php">Importar otro archivo</a>
      </div>
    </div>
  </div>

<?php elseif ($paso === 'preview' && $data): ?>
  <?php
  $rows = $data['rows'];
  $map = $data['map'];
  $campos = array_values($map);
  $faltantes = array();
  if (!in_array('precio', $campos, true)) { $faltantes[] = 'Precio'; }
  if (!in_array('sku', $campos, true) && !in_array('nombre', $campos, true)) { $faltantes[] = 'SKU o Nombre'; }
  ?>
  <div class="card mb-3">
    <div class="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
      <span><i class="bi bi-table"></i> Previsualización · <?php echo h($data['archivo']); ?></span>
      <span class="badge badge-soft"><?php echo count($rows); ?> filas</span>
    </div>
    <div class="card-body">
      <p class="small text-secondary mb-2">Columnas detectadas: 
        <?php foreach ($map as $idx => $campo): ?>
          <span class="badge text-bg-dark border border-secondary me-1"><?php echo h($etiquetas[$campo]); ?> ← "<?php echo h(isset($data['headers'][$idx]) ? $data['headers'][$idx] : '?'); ?>"</span>
        <?php endforeach; ?>
      </p>
      <?php if ($faltantes): ?>
        <div class="alert alert-warning py-2 small mb-3">Atención: no se detectó <?php echo h(implode(' / ', $faltantes)); ?>. Sin precio, los productos nuevos se cargan en 0.</div>
      <?php endif; ?>

      <div class="table-responsive" style="max-height:420px">
        <table class="table table-sm table-hover align-middle">
          <thead class="position-sticky top-0">
            <tr>
              <th>#</th>
              <?php foreach ($map as $campo): ?><th><?php echo h($etiquetas[$campo]); ?></th><?php endforeach; ?>
            </tr>
          </thead>
          <tbody>
            <?php foreach (array_slice($rows, 0, 50) as $i => $r): ?>
              <tr>
                <td class="text-secondary"><?php echo $i + 2; ?></td>
                <?php foreach ($map as $campo): ?>
                  <td class="small"><?php echo h(isset($r[$campo]) ? $r[$campo] : ''); ?></td>
                <?php endforeach; ?>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
      <?php if (count($rows) > 50): ?>
        <p class="small text-secondary mb-0">Mostrando las primeras 50 filas de <?php echo count($rows); ?>.</p>
      <?php endif; ?>

      <div class="d-flex flex-wrap gap-2 mt-3">
        <form method="post">
          <?php echo csrf_field(); ?>
          <input type="hidden" name="accion" value="confirmar">
          <button class="btn btn-accent" type="submit"><i class="bi bi-cloud-check"></i> Importar <?php echo count($rows); ?> filas</button>
        </form>
        <form method="post">
          <?php echo csrf_field(); ?>
          <input type="hidden" name="accion" value="cancelar">
          <button class="btn btn-outline-secondary" type="submit">Cancelar</button>
        </form>
      </div>
      <p class="small text-secondary mt-2 mb-0">Se actualizan productos con el mismo SKU (o mismo nombre) y se crean los que no existen. Las categorías se crean automáticamente si no existen.</p>
    </div>
  </div>

<?php else: ?>
  <div class="row g-3">
    <div class="col-lg-6">
      <div class="card h-100">
        <div class="card-header"><i class="bi bi-file-earmark-arrow-up"></i> Subir planilla</div>
        <div class="card-body">
          <form method="post" enctype="multipart/form-data">
            <?php echo csrf_field(); ?>
            <input type="hidden" name="accion" value="preview">
            <div class="mb-3">
              <label class="form-label" for="archivo">Archivo CSV o XLSX</label>
              <input class="form-control" type="file" id="archivo" name="archivo" accept=".csv,.xlsx,.txt" required>
              <div class="form-text">Máximo 5 MB. La primera fila debe tener los encabezados.</div>
            </div>
            <button class="btn btn-accent" type="submit"><i class="bi bi-eye"></i> Previsualizar</button>
            <a class="btn btn-outline-accent" href="plantilla.php"><i class="bi bi-download"></i> Descargar plantilla</a>
          </form>
        </div>
      </div>
    </div>

    <div class="col-lg-6">
      <div class="card h-100">
        <div class="card-header"><i class="bi bi-info-circle"></i> Formato esperado</div>
        <div class="card-body">
          <p class="small text-secondary">Columnas reconocidas (el orden no importa, los nombres se detectan automáticamente):</p>
          <div class="d-flex flex-wrap gap-1 mb-3">
            <?php foreach ($etiquetas as $e): ?><span class="badge text-bg-dark border border-secondary"><?php echo h($e); ?></span><?php endforeach; ?>
          </div>
          <ul class="small text-secondary mb-0">
            <li><strong>SKU</strong> es la clave para actualizar; si no viene, se usa el nombre.</li>
            <li><strong>Categoría</strong>: si no existe, se crea.</li>
            <li><strong>Precio</strong> acepta <code>8500</code>, <code>8.500,00</code> o <code>$ 8.500</code>.</li>
            <li><strong>Stock</strong> y <strong>precio_anterior</strong> son opcionales.</li>
            <li><strong>Imagen</strong>: URL o ruta (ej. <code>img/termo.svg</code>).</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <div class="card mt-3">
    <div class="card-header">Historial de importaciones</div>
    <div class="table-responsive">
      <table class="table align-middle mb-0">
        <thead><tr><th>Archivo</th><th>Filas</th><th>Creadas</th><th>Actualizadas</th><th>Errores</th><th>Usuario</th><th>Fecha</th></tr></thead>
        <tbody>
        <?php if (!$historial): ?>
          <tr><td colspan="7" class="text-center text-secondary py-4">Sin importaciones todavía.</td></tr>
        <?php endif; ?>
        <?php foreach ($historial as $h): ?>
          <tr>
            <td><?php echo h($h['archivo']); ?></td>
            <td><?php echo (int) $h['total']; ?></td>
            <td class="text-success"><?php echo (int) $h['creadas']; ?></td>
            <td class="text-info"><?php echo (int) $h['actualizadas']; ?></td>
            <td class="<?php echo (int) $h['errores'] ? 'text-danger' : 'text-secondary'; ?>"><?php echo (int) $h['errores']; ?></td>
            <td class="small text-secondary"><?php echo h($h['email']); ?></td>
            <td class="small text-secondary"><?php echo h(fecha_legible($h['creado_en'])); ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
<?php endif; ?>
<?php admin_footer();

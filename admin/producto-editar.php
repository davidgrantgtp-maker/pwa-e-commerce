<?php
require_once dirname(__DIR__) . '/includes/layout.php';
require_login();

$pdo = db();
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
$errores = array();

$prod = array(
    'sku' => '', 'nombre' => '', 'categoria_id' => '', 'precio' => '',
    'precio_anterior' => '', 'costo' => '', 'stock' => '0', 'descripcion' => '',
    'imagen' => '', 'etiqueta' => '', 'destacado' => 0, 'activo' => 1, 'slug' => ''
);

if ($id) {
    $st = $pdo->prepare('SELECT * FROM productos WHERE id = ?');
    $st->execute(array($id));
    $encontrado = $st->fetch();
    if (!$encontrado) {
        flash_set('danger', 'El producto no existe.');
        redirect('productos.php');
    }
    $prod = $encontrado;
}

// Eliminar
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['eliminar'])) {
    csrf_check();
    $st = $pdo->prepare('DELETE FROM productos WHERE id = ?');
    $st->execute(array($id));
    flash_set('warning', 'Producto eliminado.');
    redirect('productos.php');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !isset($_POST['eliminar'])) {
    csrf_check();
    $prod['sku']             = trim(isset($_POST['sku']) ? $_POST['sku'] : '');
    $prod['nombre']          = trim(isset($_POST['nombre']) ? $_POST['nombre'] : '');
    $prod['categoria_id']    = isset($_POST['categoria_id']) && $_POST['categoria_id'] !== '' ? (int) $_POST['categoria_id'] : '';
    $prod['precio']          = trim(isset($_POST['precio']) ? $_POST['precio'] : '');
    $prod['precio_anterior'] = trim(isset($_POST['precio_anterior']) ? $_POST['precio_anterior'] : '');
    $prod['costo']           = trim(isset($_POST['costo']) ? $_POST['costo'] : '');
    $prod['stock']           = trim(isset($_POST['stock']) ? $_POST['stock'] : '0');
    $prod['descripcion']     = trim(isset($_POST['descripcion']) ? $_POST['descripcion'] : '');
    $prod['etiqueta']        = trim(isset($_POST['etiqueta']) ? $_POST['etiqueta'] : '');
    $prod['destacado']       = isset($_POST['destacado']) ? 1 : 0;
    $prod['activo']          = isset($_POST['activo']) ? 1 : 0;
    $prod['imagen']          = trim(isset($_POST['imagen']) ? $_POST['imagen'] : '');

    if ($prod['nombre'] === '') { $errores[] = 'El nombre es obligatorio.'; }
    $precio = parse_numero($prod['precio']);
    if ($precio === null || $precio < 0) { $errores[] = 'El precio es obligatorio y numérico.'; }
    $stock = parse_numero($prod['stock']);
    if ($stock === null) { $stock = 0; }

    // Subida de imagen
    if (!empty($_FILES['imagen_archivo']['name'])) {
        $f = $_FILES['imagen_archivo'];
        if ($f['error'] !== UPLOAD_ERR_OK) {
            $errores[] = 'Error al subir la imagen.';
        } elseif ($f['size'] > MAX_UPLOAD_BYTES) {
            $errores[] = 'La imagen supera 2 MB.';
        } else {
            $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
            $permitidas = array('jpg', 'jpeg', 'png', 'gif', 'webp', 'svg');
            if (!in_array($ext, $permitidas, true)) {
                $errores[] = 'Formato de imagen no permitido (jpg, png, gif, webp, svg).';
            } else {
                if (!is_dir(UPLOAD_DIR)) { @mkdir(UPLOAD_DIR, 0777, true); }
                $nombreArchivo = 'prod-' . date('Ymd-His') . '-' . substr(md5(uniqid('', true)), 0, 6) . '.' . $ext;
                $destino = UPLOAD_DIR . DIRECTORY_SEPARATOR . $nombreArchivo;
                if (move_uploaded_file($f['tmp_name'], $destino)) {
                    $prod['imagen'] = UPLOAD_REL . '/' . $nombreArchivo;
                } else {
                    $errores[] = 'No se pudo guardar la imagen en /uploads.';
                }
            }
        }
    }

    if (!$errores) {
        $precioAnterior = parse_numero($prod['precio_anterior']);
        $costo = parse_numero($prod['costo']);
        $catId = $prod['categoria_id'] !== '' ? (int) $prod['categoria_id'] : null;
        $sku = $prod['sku'] !== '' ? $prod['sku'] : null;

        if ($id) {
            $st = $pdo->prepare('UPDATE productos SET sku=?, nombre=?, categoria_id=?, precio=?, precio_anterior=?, costo=?, stock=?, descripcion=?, imagen=?, etiqueta=?, destacado=?, activo=?, actualizado_en=NOW() WHERE id=?');
            $st->execute(array($sku, $prod['nombre'], $catId, $precio, $precioAnterior, $costo, (int) $stock, $prod['descripcion'], $prod['imagen'], $prod['etiqueta'], $prod['destacado'], $prod['activo'], $id));
            flash_set('success', 'Producto actualizado.');
        } else {
            $slug = unique_slug('productos', slugify($prod['nombre']));
            $st = $pdo->prepare('INSERT INTO productos (sku, nombre, slug, categoria_id, precio, precio_anterior, costo, stock, descripcion, imagen, etiqueta, destacado, activo, creado_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())');
            $st->execute(array($sku, $prod['nombre'], $slug, $catId, $precio, $precioAnterior, $costo, (int) $stock, $prod['descripcion'], $prod['imagen'], $prod['etiqueta'], $prod['destacado'], $prod['activo']));
            $id = (int) $pdo->lastInsertId();
            flash_set('success', 'Producto creado.');
        }
        redirect('producto-editar.php?id=' . $id);
    }
}

$categorias = categorias_select(false);
$imgPreview = imagen_src($prod['imagen'], '../');

admin_header($id ? 'Editar producto' : 'Nuevo producto', 'productos.php');
?>
<div class="mb-3">
  <a href="productos.php" class="text-decoration-none text-secondary small"><i class="bi bi-arrow-left"></i> Volver al listado</a>
</div>

<?php foreach ($errores as $e): ?>
  <div class="alert alert-danger py-2"><?php echo h($e); ?></div>
<?php endforeach; ?>

<form method="post" enctype="multipart/form-data">
  <?php echo csrf_field(); ?>
  <div class="row g-3">
    <div class="col-lg-8">
      <div class="card mb-3">
        <div class="card-header">Datos del producto</div>
        <div class="card-body">
          <div class="mb-3">
            <label class="form-label" for="nombre">Nombre *</label>
            <input class="form-control" type="text" id="nombre" name="nombre" value="<?php echo h($prod['nombre']); ?>" required>
          </div>
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label" for="sku">SKU / Código</label>
              <input class="form-control" type="text" id="sku" name="sku" value="<?php echo h($prod['sku']); ?>" placeholder="CG-500">
            </div>
            <div class="col-md-4">
              <label class="form-label" for="categoria_id">Categoría</label>
              <select class="form-select" id="categoria_id" name="categoria_id">
                <option value="">Sin categoría</option>
                <?php foreach ($categorias as $c): ?>
                  <option value="<?php echo (int) $c['id']; ?>" <?php echo (string) $prod['categoria_id'] === (string) $c['id'] ? 'selected' : ''; ?>><?php echo h($c['nombre']); ?></option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label" for="etiqueta">Etiqueta / Badge</label>
              <input class="form-control" type="text" id="etiqueta" name="etiqueta" value="<?php echo h($prod['etiqueta']); ?>" placeholder="Nuevo, Más vendido…">
            </div>
          </div>
          <div class="row g-3 mt-0">
            <div class="col-md-4">
              <label class="form-label" for="precio">Precio *</label>
              <input class="form-control" type="text" id="precio" name="precio" value="<?php echo h($prod['precio']); ?>" required placeholder="8500">
            </div>
            <div class="col-md-4">
              <label class="form-label" for="precio_anterior">Precio anterior</label>
              <input class="form-control" type="text" id="precio_anterior" name="precio_anterior" value="<?php echo h($prod['precio_anterior']); ?>" placeholder="9900">
            </div>
            <div class="col-md-4">
              <label class="form-label" for="costo">Costo</label>
              <input class="form-control" type="text" id="costo" name="costo" value="<?php echo h($prod['costo']); ?>" placeholder="Interno">
            </div>
          </div>
          <div class="row g-3 mt-0">
            <div class="col-md-4">
              <label class="form-label" for="stock">Stock (cantidad)</label>
              <input class="form-control" type="number" id="stock" name="stock" value="<?php echo h($prod['stock']); ?>">
            </div>
          </div>
          <div class="mt-3">
            <label class="form-label" for="descripcion">Descripción</label>
            <textarea class="form-control" id="descripcion" name="descripcion" rows="4"><?php echo h($prod['descripcion']); ?></textarea>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Publicación</div>
        <div class="card-body d-flex flex-wrap gap-4">
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="activo" name="activo" <?php echo (int) $prod['activo'] ? 'checked' : ''; ?>>
            <label class="form-check-label" for="activo">Visible en la tienda</label>
          </div>
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="destacado" name="destacado" <?php echo (int) $prod['destacado'] ? 'checked' : ''; ?>>
            <label class="form-check-label" for="destacado">Destacado</label>
          </div>
        </div>
      </div>
    </div>

    <div class="col-lg-4">
      <div class="card mb-3">
        <div class="card-header">Imagen</div>
        <div class="card-body text-center">
          <?php if ($imgPreview): ?>
            <img class="prod-thumb-lg mb-3" src="<?php echo h($imgPreview); ?>" alt="Vista previa">
          <?php else: ?>
            <div class="prod-thumb-lg d-grid mx-auto mb-3" style="place-items:center"><i class="bi bi-image text-secondary fs-3"></i></div>
          <?php endif; ?>
          <div class="mb-3 text-start">
            <label class="form-label" for="imagen_archivo">Subir archivo</label>
            <input class="form-control" type="file" id="imagen_archivo" name="imagen_archivo" accept="image/*">
            <div class="form-text">JPG, PNG, WEBP o SVG · máx. 2 MB</div>
          </div>
          <div class="text-start">
            <label class="form-label" for="imagen">o URL / ruta</label>
            <input class="form-control" type="text" id="imagen" name="imagen" value="<?php echo h($prod['imagen']); ?>" placeholder="https://… o img/termo.svg">
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body d-grid gap-2">
          <button class="btn btn-accent" type="submit"><i class="bi bi-check-lg"></i> <?php echo $id ? 'Guardar cambios' : 'Crear producto'; ?></button>
          <?php if ($id): ?>
            <a class="btn btn-outline-secondary" href="../producto.html?id=<?php echo h($prod['slug']); ?>" target="_blank"><i class="bi bi-eye"></i> Ver en la tienda</a>
          <?php endif; ?>
        </div>
      </div>
    </div>
  </div>
</form>

<?php if ($id): ?>
<form method="post" onsubmit="return confirm('¿Eliminar este producto definitivamente?');" class="mt-3">
  <?php echo csrf_field(); ?>
  <input type="hidden" name="eliminar" value="1">
  <button class="btn btn-outline-danger" type="submit"><i class="bi bi-trash"></i> Eliminar producto</button>
</form>
<?php endif; ?>
<?php admin_footer();

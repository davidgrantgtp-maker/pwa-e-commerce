<?php
require_once dirname(__DIR__) . '/includes/layout.php';
require_login();

$editId = isset($_GET['edit']) ? (int) $_GET['edit'] : 0;
$edit = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $accion = isset($_POST['accion']) ? $_POST['accion'] : '';
    $id = isset($_POST['id']) ? (int) $_POST['id'] : 0;

    if ($accion === 'crear' || $accion === 'actualizar') {
        $nombre = trim(isset($_POST['nombre']) ? $_POST['nombre'] : '');
        $activo = isset($_POST['activo']) ? 1 : 0;
        $orden = (int) (isset($_POST['orden']) ? $_POST['orden'] : 0);
        if ($nombre === '') {
            flash_set('danger', 'El nombre es obligatorio.');
        } elseif (categoria_nombre_existe($nombre, $accion === 'actualizar' ? $id : 0)) {
            flash_set('danger', 'Ya existe una categoría con ese nombre.');
        } else {
            try {
                if ($accion === 'crear') {
                    categoria_crear($nombre, $activo, $orden);
                    flash_set('success', 'Categoría creada.');
                } else {
                    categoria_actualizar($id, $nombre, $activo, $orden);
                    flash_set('success', 'Categoría actualizada.');
                }
            } catch (Exception $e) {
                flash_set('danger', 'No se pudo guardar: ' . $e->getMessage());
            }
        }
    } elseif ($accion === 'eliminar' && $id) {
        categoria_eliminar($id);
        flash_set('warning', 'Categoría eliminada. Sus productos quedaron sin categoría.');
    } elseif ($accion === 'toggle' && $id) {
        $cat = categoria_obtener($id);
        if ($cat) {
            sb()->update('categorias', array('id' => 'eq.' . $id), array('activo' => !(bool) $cat['activo']));
        }
        flash_set('success', 'Estado de la categoría actualizado.');
    }
    redirect('categorias.php');
}

if ($editId) {
    $edit = categoria_obtener($editId);
}

$cats = categorias_con_conteo();

admin_header('Categorías', 'categorias.php');
?>
<div class="row g-3">
  <div class="col-lg-4">
    <div class="card">
      <div class="card-header"><?php echo $edit ? 'Editar categoría' : 'Nueva categoría'; ?></div>
      <div class="card-body">
        <form method="post">
          <?php echo csrf_field(); ?>
          <input type="hidden" name="accion" value="<?php echo $edit ? 'actualizar' : 'crear'; ?>">
          <?php if ($edit): ?><input type="hidden" name="id" value="<?php echo (int) $edit['id']; ?>"><?php endif; ?>
          <div class="mb-3">
            <label class="form-label" for="nombre">Nombre *</label>
            <input class="form-control" id="nombre" name="nombre" value="<?php echo h($edit ? $edit['nombre'] : ''); ?>" required>
          </div>
          <div class="mb-3">
            <label class="form-label" for="orden">Orden</label>
            <input class="form-control" type="number" id="orden" name="orden" value="<?php echo h($edit ? $edit['orden'] : '0'); ?>">
            <div class="form-text">Menor número aparece primero.</div>
          </div>
          <div class="form-check form-switch mb-3">
            <input class="form-check-input" type="checkbox" id="activo" name="activo" <?php echo (!$edit || (int) $edit['activo']) ? 'checked' : ''; ?>>
            <label class="form-check-label" for="activo">Activa</label>
          </div>
          <button class="btn btn-accent w-100" type="submit"><i class="bi bi-check-lg"></i> <?php echo $edit ? 'Guardar cambios' : 'Crear categoría'; ?></button>
          <?php if ($edit): ?>
            <a class="btn btn-outline-secondary w-100 mt-2" href="categorias.php">Cancelar</a>
          <?php endif; ?>
        </form>
      </div>
    </div>
  </div>

  <div class="col-lg-8">
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span>Categorías (<?php echo count($cats); ?>)</span>
        <a class="btn btn-sm btn-outline-accent" href="productos.php"><i class="bi bi-box-seam"></i> Ver productos</a>
      </div>
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead><tr><th>Categoría</th><th>Slug</th><th class="text-center">Productos</th><th class="text-center">Estado</th><th class="text-end">Acciones</th></tr></thead>
          <tbody>
          <?php if (!$cats): ?>
            <tr><td colspan="5" class="text-center text-secondary py-5">Todavía no hay categorías.</td></tr>
          <?php endif; ?>
          <?php foreach ($cats as $c): ?>
            <tr>
              <td class="fw-semibold"><?php echo h($c['nombre']); ?></td>
              <td class="small text-secondary"><?php echo h($c['slug']); ?></td>
              <td class="text-center"><span class="badge badge-soft"><?php echo (int) $c['productos']; ?></span> <span class="small text-secondary">(<?php echo (int) $c['activos']; ?> activos)</span></td>
              <td class="text-center">
                <?php if ((int) $c['activo']): ?>
                  <span class="badge badge-stock-ok">Activa</span>
                <?php else: ?>
                  <span class="badge text-bg-secondary">Inactiva</span>
                <?php endif; ?>
              </td>
              <td class="text-end text-nowrap">
                <a class="btn btn-sm btn-outline-secondary" href="categorias.php?edit=<?php echo (int) $c['id']; ?>" title="Editar"><i class="bi bi-pencil"></i></a>
                <form method="post" class="d-inline">
                  <?php echo csrf_field(); ?>
                  <input type="hidden" name="accion" value="toggle">
                  <input type="hidden" name="id" value="<?php echo (int) $c['id']; ?>">
                  <button class="btn btn-sm btn-outline-secondary" type="submit" title="Activar/desactivar"><i class="bi bi-power"></i></button>
                </form>
                <form method="post" class="d-inline" onsubmit="return confirm('¿Eliminar la categoría? Los productos quedarán sin categoría.');">
                  <?php echo csrf_field(); ?>
                  <input type="hidden" name="accion" value="eliminar">
                  <input type="hidden" name="id" value="<?php echo (int) $c['id']; ?>">
                  <button class="btn btn-sm btn-outline-danger" type="submit" title="Eliminar"><i class="bi bi-trash"></i></button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
<?php admin_footer();

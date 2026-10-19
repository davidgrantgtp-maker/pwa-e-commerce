<?php
require_once dirname(__DIR__) . '/includes/auth.php';

function admin_header($title, $active = '')
{
    $user = current_user();
    $nav = array(
        'index.php'       => array('Dashboard', 'speedometer2'),
        'productos.php'   => array('Productos', 'box-seam'),
        'categorias.php'  => array('Categorías', 'tags'),
        'importar.php'    => array('Importar Excel/CSV', 'file-earmark-arrow-up'),
        'masivo.php'      => array('Actualización masiva', 'sliders'),
        'exportar.php'    => array('Exportar', 'download'),
    );
    ?>
<!DOCTYPE html>
<html lang="es" data-bs-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?php echo h($title); ?> · <?php echo h(APP_NAME); ?></title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
<link href="assets/admin.css" rel="stylesheet">
</head>
<body>
<div class="admin-shell">
  <aside class="admin-sidebar">
    <div class="brand">
      <span class="brand-logo">M</span>
      <div>
        <div class="brand-name"><?php echo h(APP_NAME); ?></div>
        <div class="brand-sub"><?php echo h(APP_TAGLINE); ?></div>
      </div>
    </div>
    <nav class="nav flex-column admin-nav">
      <?php foreach ($nav as $file => $item) {
          $isActive = ($active === $file) ? ' active' : '';
          echo '<a class="nav-link' . $isActive . '" href="' . h($file) . '"><i class="bi bi-' . h($item[1]) . '"></i> ' . h($item[0]) . '</a>';
      } ?>
    </nav>
    <div class="sidebar-foot">
      <a class="nav-link" href="../index.html" target="_blank"><i class="bi bi-phone"></i> Ver tienda</a>
      <a class="nav-link" href="logout.php"><i class="bi bi-box-arrow-right"></i> Salir</a>
    </div>
  </aside>
  <div class="admin-main">
    <header class="admin-topbar">
      <button class="btn btn-sm btn-outline-secondary d-lg-none" type="button" onclick="document.body.classList.toggle('sidebar-open')"><i class="bi bi-list"></i></button>
      <h1 class="page-title"><?php echo h($title); ?></h1>
      <div class="ms-auto d-flex align-items-center gap-3">
        <span class="text-secondary small d-none d-sm-inline"><?php echo h($user ? $user['email'] : ''); ?></span>
        <span class="avatar"><?php echo h($user ? strtoupper(substr($user['nombre'], 0, 1)) : '?'); ?></span>
      </div>
    </header>
    <main class="admin-content">
      <?php foreach (flash_get() as $f) { ?>
        <div class="alert alert-<?php echo h($f['tipo']); ?> alert-dismissible fade show" role="alert">
          <?php echo h($f['texto']); ?>
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
      <?php } ?>
<?php
}

function admin_footer()
{
    ?>
    </main>
    <footer class="admin-foot">
      <?php echo h(APP_NAME); ?> · Admin · <?php echo date('Y'); ?> · PHP <?php echo PHP_VERSION; ?> / MariaDB
    </footer>
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
<?php
}

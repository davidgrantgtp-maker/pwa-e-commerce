<?php
require_once dirname(__DIR__) . '/includes/auth.php';

if (current_user()) {
    redirect('index.php');
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $email = isset($_POST['email']) ? $_POST['email'] : '';
    $pass = isset($_POST['password']) ? $_POST['password'] : '';
    try {
        if (attempt_login($email, $pass)) {
            redirect('index.php');
        }
        $error = 'Email o contraseña incorrectos.';
    } catch (Exception $e) {
        $error = 'No se pudo conectar con Supabase: ' . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="es" data-bs-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ingresar · <?php echo h(APP_NAME); ?></title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
<link href="assets/admin.css" rel="stylesheet">
</head>
<body>
<div class="login-wrap">
  <div class="card login-card border-0 shadow-lg">
    <div class="login-logo">M</div>
    <h1 class="h5 text-center mb-1"><?php echo h(APP_NAME); ?></h1>
    <p class="text-secondary text-center small mb-4"><?php echo h(APP_TAGLINE); ?></p>

    <?php if ($error): ?>
      <div class="alert alert-danger py-2 small"><?php echo h($error); ?></div>
    <?php endif; ?>

    <form method="post" autocomplete="off">
      <?php echo csrf_field(); ?>
      <div class="mb-3">
        <label class="form-label" for="email">Email</label>
        <input class="form-control" type="email" id="email" name="email" value="admin@miapp.local" required autofocus>
      </div>
      <div class="mb-3">
        <label class="form-label" for="password">Contraseña</label>
        <input class="form-control" type="password" id="password" name="password" required>
      </div>
      <button class="btn btn-accent w-100 py-2" type="submit"><i class="bi bi-box-arrow-in-right"></i> Ingresar</button>
    </form>

    <p class="text-secondary small text-center mt-4 mb-0">Demo: <code>admin@miapp.local</code> / <code>admin123</code></p>
  </div>
</div>
</body>
</html>

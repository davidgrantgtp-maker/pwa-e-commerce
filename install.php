<?php
/**
 * Instalador: crea la base de datos, tablas y datos de ejemplo.
 * Uso: abrir en el navegador  http://localhost/app/install.php
 *      o por consola:  C:\xampp\php\php.exe install.php
 */
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/functions.php';

$esCli = (php_sapi_name() === 'cli');
$log = array();
function paso(&$log, $msg) { $log[] = $msg; }

try {
    // 1) Base de datos
    $server = db_server();
    $server->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    paso($log, 'Base de datos "' . DB_NAME . '" lista.');

    $pdo = db();

    // 2) Tablas
    $ddl = array();
    $ddl[] = "CREATE TABLE IF NOT EXISTS usuarios (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nombre VARCHAR(120) NOT NULL,
        email VARCHAR(180) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(20) NOT NULL DEFAULT 'admin',
        activo TINYINT(1) NOT NULL DEFAULT 1,
        creado_en DATETIME NOT NULL,
        PRIMARY KEY (id), UNIQUE KEY uq_usuarios_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    $ddl[] = "CREATE TABLE IF NOT EXISTS categorias (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nombre VARCHAR(120) NOT NULL,
        slug VARCHAR(140) NOT NULL,
        activo TINYINT(1) NOT NULL DEFAULT 1,
        orden INT NOT NULL DEFAULT 0,
        creado_en DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_categorias_nombre (nombre),
        UNIQUE KEY uq_categorias_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    $ddl[] = "CREATE TABLE IF NOT EXISTS productos (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        sku VARCHAR(60) DEFAULT NULL,
        nombre VARCHAR(180) NOT NULL,
        slug VARCHAR(180) NOT NULL,
        categoria_id INT UNSIGNED DEFAULT NULL,
        precio DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        precio_anterior DECIMAL(12,2) DEFAULT NULL,
        costo DECIMAL(12,2) DEFAULT NULL,
        stock INT NOT NULL DEFAULT 0,
        descripcion TEXT,
        imagen VARCHAR(500) DEFAULT NULL,
        etiqueta VARCHAR(80) DEFAULT NULL,
        destacado TINYINT(1) NOT NULL DEFAULT 0,
        activo TINYINT(1) NOT NULL DEFAULT 1,
        creado_en DATETIME NOT NULL,
        actualizado_en DATETIME DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_productos_slug (slug),
        UNIQUE KEY uq_productos_sku (sku),
        KEY idx_productos_categoria (categoria_id),
        KEY idx_productos_activo (activo),
        KEY idx_productos_destacado (destacado),
        CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    $ddl[] = "CREATE TABLE IF NOT EXISTS importaciones (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        archivo VARCHAR(255) NOT NULL,
        total INT NOT NULL DEFAULT 0,
        creadas INT NOT NULL DEFAULT 0,
        actualizadas INT NOT NULL DEFAULT 0,
        errores INT NOT NULL DEFAULT 0,
        usuario_id INT UNSIGNED DEFAULT NULL,
        creado_en DATETIME NOT NULL,
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    $ddl[] = "CREATE TABLE IF NOT EXISTS movimientos (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        producto_id INT UNSIGNED DEFAULT NULL,
        campo VARCHAR(40) NOT NULL,
        tipo VARCHAR(40) NOT NULL,
        valor VARCHAR(120) DEFAULT NULL,
        motivo VARCHAR(180) DEFAULT NULL,
        usuario_id INT UNSIGNED DEFAULT NULL,
        creado_en DATETIME NOT NULL,
        PRIMARY KEY (id), KEY idx_mov_producto (producto_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    foreach ($ddl as $sql) {
        $pdo->exec($sql);
    }
    paso($log, 'Tablas verificadas/creadas.');

    // 3) Usuario admin
    $existe = (int) $pdo->query('SELECT COUNT(*) FROM usuarios')->fetchColumn();
    if ($existe === 0) {
        $st = $pdo->prepare('INSERT INTO usuarios (nombre, email, password_hash, rol, activo, creado_en) VALUES (?, ?, ?, ?, 1, NOW())');
        $st->execute(array('Administrador', 'admin@miapp.local', password_hash('admin123', PASSWORD_DEFAULT), 'admin'));
        paso($log, 'Usuario admin creado: admin@miapp.local / admin123');
    } else {
        paso($log, 'Usuarios existentes: se omite la creación del admin.');
    }

    // 4) Semilla de categorías y productos (solo si no hay productos)
    $hayProductos = (int) $pdo->query('SELECT COUNT(*) FROM productos')->fetchColumn();
    if ($hayProductos === 0) {
        $cats = array('Cafés', 'Bebidas', 'Comida', 'Accesorios');
        $catId = array();
        $orden = 0;
        $stCat = $pdo->prepare('INSERT INTO categorias (nombre, slug, activo, orden, creado_en) VALUES (?, ?, 1, ?, NOW())');
        foreach ($cats as $c) {
            $stCat->execute(array($c, unique_slug('categorias', slugify($c)), $orden));
            $catId[$c] = (int) $pdo->lastInsertId();
            $orden++;
        }

        $seed = array(
            array('CG-500', 'Café en grano 500 g', 'Cafés', 8500, 9900, 60, 'Blend de especialidad tostado medio. Notas a chocolate, avellanas y frutas rojas.', 'Más vendido', 'img/cafe-grano.svg', 1),
            array('CM-250', 'Café molido 250 g', 'Cafés', 5200, null, 45, 'Molienda media para filtro. Origen Colombia, tueste artesanal.', '', '', 0),
            array('CB-1000', 'Cold brew 1 L', 'Bebidas', 4800, null, 24, 'Café extraído en frío durante 18 horas. Suave, dulce y baja acidez.', 'Nuevo', '', 1),
            array('ML-001', 'Matcha latte', 'Bebidas', 4200, null, 30, 'Matcha ceremonial japonés con leche. Frío o caliente.', '', '', 0),
            array('MD-6', 'Medialunas x6', 'Comida', 3600, null, 40, 'Medialunas de manteca horneadas cada mañana.', 'Recién horneadas', '', 1),
            array('TC-KG', 'Torta de chocolate', 'Comida', 7900, null, 12, 'Bizcochuelo húmedo de cacao con ganache semiamargo. Para 6 personas.', '', '', 0),
            array('TZ-300', 'Taza de cerámica', 'Accesorios', 6500, null, 18, 'Taza de 300 ml hecha a mano. Apta microondas y lavavajillas.', '', '', 0),
            array('TM-500', 'Termo 500 ml', 'Accesorios', 12900, 14900, 15, 'Termo de acero inoxidable con doble pared. Mantiene 12 horas.', 'Envío gratis', '', 1),
            array('PF-600', 'Prensa francesa', 'Accesorios', 18500, null, 8, 'Prensa francesa de vidrio borosilicato de 600 ml con filtro de acero.', '', '', 0),
            array('CB-DES', 'Combo desayuno', 'Comida', 14500, 16400, 10, 'Café en grano 250 g + 6 medialunas + taza de cerámica.', 'Ahorrás $1.900', '', 1),
        );

        $stProd = $pdo->prepare('INSERT INTO productos (sku, nombre, slug, categoria_id, precio, precio_anterior, stock, descripcion, etiqueta, imagen, destacado, activo, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())');
        foreach ($seed as $p) {
            $stProd->execute(array(
                $p[0], $p[1], unique_slug('productos', slugify($p[1])),
                isset($catId[$p[2]]) ? $catId[$p[2]] : null,
                $p[3], $p[4], $p[5], $p[6], $p[7], $p[8], $p[9]
            ));
        }
        paso($log, count($seed) . ' productos de ejemplo cargados en ' . count($cats) . ' categorías.');
    } else {
        paso($log, 'Ya existen productos: se omite el seed.');
    }

    paso($log, 'Instalación completada.');
    $ok = true;
} catch (Exception $e) {
    $ok = false;
    paso($log, 'ERROR: ' . $e->getMessage());
}

if ($esCli) {
    foreach ($log as $l) { echo $l . PHP_EOL; }
    exit($ok ? 0 : 1);
}
?>
<!DOCTYPE html>
<html lang="es" data-bs-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Instalación · MiApp Store</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<style>body{background:#0b1120;min-height:100vh;display:grid;place-items:center;padding:24px}.box{max-width:620px;width:100%}</style>
</head>
<body>
<div class="box">
  <div class="card border-0 shadow-lg">
    <div class="card-body p-4">
      <h1 class="h4 mb-3">Instalación de MiApp Store</h1>
      <ul class="list-group list-group-flush mb-3">
        <?php foreach ($log as $l): ?>
          <li class="list-group-item bg-transparent"><?php echo h($l); ?></li>
        <?php endforeach; ?>
      </ul>
      <?php if ($ok): ?>
        <div class="alert alert-success">Todo listo. Ya podés entrar al panel.</div>
        <a class="btn btn-info fw-bold" href="admin/login.php">Ir al panel de administración</a>
      <?php else: ?>
        <div class="alert alert-danger">Revisá los datos de conexión en <code>config/config.php</code>.</div>
      <?php endif; ?>
    </div>
  </div>
  <p class="text-secondary small mt-3 mb-0">Por seguridad, borrá <code>install.php</code> cuando termines.</p>
</div>
</body>
</html>

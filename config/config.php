<?php
/**
 * Configuración general de MiApp Store.
 * Requiere PHP 5.6+ (XAMPP).
 */

define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'miapp_store');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

define('APP_NAME', 'MiApp Store');
define('APP_TAGLINE', 'Panel de administración');

define('BASE_DIR', dirname(__DIR__));
define('UPLOAD_DIR', BASE_DIR . DIRECTORY_SEPARATOR . 'uploads');
define('UPLOAD_REL', 'uploads');

define('SESSION_NAME', 'miapp_admin_sess');
define('ITEMS_PER_PAGE', 20);
define('MAX_UPLOAD_BYTES', 2097152); // 2 MB

date_default_timezone_set('America/Argentina/Buenos_Aires');

// Sesión (una sola vez)
if (session_status() === PHP_SESSION_NONE) {
    session_name(SESSION_NAME);
    session_start();
}

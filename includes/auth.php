<?php
require_once dirname(__DIR__) . '/config/database.php';
require_once __DIR__ . '/functions.php';

/** Usuario logueado o null */
function current_user()
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    static $user = null;
    if ($user === null) {
        $st = db()->prepare('SELECT id, nombre, email, rol FROM usuarios WHERE id = ? AND activo = 1 LIMIT 1');
        $st->execute(array((int) $_SESSION['user_id']));
        $user = $st->fetch();
    }
    return $user ? $user : null;
}

/** Exigir sesión */
function require_login()
{
    if (!current_user()) {
        redirect('login.php');
    }
}

/** Intentar login */
function attempt_login($email, $password)
{
    $st = db()->prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1 LIMIT 1');
    $st->execute(array(trim($email)));
    $user = $st->fetch();
    if ($user && password_verify($password, $user['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        return true;
    }
    return false;
}

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
        try {
            $rows = sb()->get('usuarios', array(
                'select' => 'id,nombre,email,rol',
                'id' => 'eq.' . (int) $_SESSION['user_id'],
                'activo' => 'is.true',
                'limit' => 1
            ));
            $user = $rows ? $rows[0] : false;
        } catch (Exception $e) {
            return null;
        }
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
    $rows = sb()->get('usuarios', array(
        'select' => '*',
        'email' => 'eq.' . trim($email),
        'activo' => 'is.true',
        'limit' => 1
    ));
    $user = $rows ? $rows[0] : null;
    if ($user && password_verify($password, $user['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        return true;
    }
    return false;
}

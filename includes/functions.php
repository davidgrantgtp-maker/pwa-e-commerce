<?php
require_once dirname(__DIR__) . '/config/database.php';

/** Escapar salida HTML */
function h($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

/** Redirigir y terminar */
function redirect($url)
{
    header('Location: ' . $url);
    exit;
}

/** Mensaje flash */
function flash_set($tipo, $texto)
{
    $_SESSION['flash'][] = array('tipo' => $tipo, 'texto' => $texto);
}

function flash_get()
{
    $items = isset($_SESSION['flash']) ? $_SESSION['flash'] : array();
    unset($_SESSION['flash']);
    return $items;
}

/** CSRF */
function csrf_token()
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(openssl_random_pseudo_bytes(16));
    }
    return $_SESSION['csrf'];
}

function csrf_field()
{
    return '<input type="hidden" name="csrf" value="' . h(csrf_token()) . '">';
}

function csrf_check()
{
    $token = isset($_POST['csrf']) ? $_POST['csrf'] : '';
    if (!hash_equals((string) csrf_token(), (string) $token)) {
        http_response_code(419);
        exit('Token inválido. Volvé a intentar.');
    }
}

/** Conversión de texto a slug */
function slugify($text)
{
    $map = array(
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u',
        'à' => 'a', 'è' => 'e', 'ì' => 'i', 'ò' => 'o', 'ù' => 'u',
        'ä' => 'a', 'ë' => 'e', 'ï' => 'i', 'ö' => 'o', 'ü' => 'u',
        'ñ' => 'n', 'ç' => 'c', 'Á' => 'A', 'É' => 'E', 'Í' => 'I',
        'Ó' => 'O', 'Ú' => 'U', 'Ñ' => 'N', 'Ü' => 'U',
    );
    $text = strtr((string) $text, $map);
    $text = strtolower(trim($text));
    $text = preg_replace('/[^a-z0-9]+/', '-', $text);
    $text = trim($text, '-');
    $text = substr($text, 0, 170);
    $text = trim($text, '-');
    return $text !== '' ? $text : 'item';
}

/** Slug único en una tabla */
function unique_slug($table, $base, $excludeId = 0)
{
    $pdo = db();
    $slug = $base;
    $i = 2;
    while (true) {
        $sql = 'SELECT COUNT(*) FROM ' . $table . ' WHERE slug = ? AND id <> ?';
        $st = $pdo->prepare($sql);
        $st->execute(array($slug, (int) $excludeId));
        if ((int) $st->fetchColumn() === 0) {
            return $slug;
        }
        $slug = $base . '-' . $i;
        $i++;
    }
}

/** Formato de moneda AR */
function money($value)
{
    return '$' . number_format((float) $value, 2, ',', '.');
}

/** Parsear números en varios formatos (1.234,56 / 1234.56 / $1.234) */
function parse_numero($value)
{
    $value = trim((string) $value);
    if ($value === '') {
        return null;
    }
    $value = preg_replace('/[^0-9\.,\-]/', '', $value);
    $tienePunto = strpos($value, '.') !== false;
    $tieneComa = strpos($value, ',') !== false;
    if ($tienePunto && $tieneComa) {
        $value = str_replace('.', '', $value);
        $value = str_replace(',', '.', $value);
    } elseif ($tieneComa) {
        $value = str_replace(',', '.', $value);
    } elseif ($tienePunto) {
        if (preg_match('/^\d{1,3}(\.\d{3})+$/', $value)) {
            $value = str_replace('.', '', $value);
        }
    }
    if ($value === '' || !is_numeric($value)) {
        return null;
    }
    return (float) $value;
}

/** Booleano flexible (1/si/yes/x/activo) */
function parse_bool($value, $default = 0)
{
    $v = strtolower(trim((string) $value));
    if ($v === '') {
        return $default;
    }
    $true = array('1', 'si', 'sí', 'yes', 'y', 'true', 'x', 'activo', 'activa', 'on', 'visible', 'publicado');
    $false = array('0', 'no', 'false', 'n', 'inactivo', 'inactiva', 'off', 'oculto', 'borrador');
    if (in_array($v, $true, true)) {
        return 1;
    }
    if (in_array($v, $false, true)) {
        return 0;
    }
    return $default;
}

/** Obtener categorías activas para selects */
function categorias_select($soloActivas = false)
{
    $sql = 'SELECT id, nombre FROM categorias';
    if ($soloActivas) {
        $sql .= ' WHERE activo = 1';
    }
    $sql .= ' ORDER BY orden ASC, nombre ASC';
    return db()->query($sql)->fetchAll();
}

/** Buscar o crear categoría por nombre, devuelve ID */
function categoria_por_nombre($nombre)
{
    $nombre = trim((string) $nombre);
    if ($nombre === '') {
        return null;
    }
    $pdo = db();
    $st = $pdo->prepare('SELECT id FROM categorias WHERE nombre = ? LIMIT 1');
    $st->execute(array($nombre));
    $id = $st->fetchColumn();
    if ($id) {
        return (int) $id;
    }
    $slug = unique_slug('categorias', slugify($nombre));
    $st = $pdo->prepare('INSERT INTO categorias (nombre, slug, activo, creado_en) VALUES (?, ?, 1, NOW())');
    $st->execute(array($nombre, $slug));
    return (int) $pdo->lastInsertId();
}

/** Normaliza texto para comparar encabezados */
function normaliza_header($text)
{
    $map = array('á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n', 'ü' => 'u',
        'Á' => 'a', 'É' => 'e', 'Í' => 'i', 'Ó' => 'o', 'Ú' => 'u', 'Ñ' => 'n', 'Ü' => 'u');
    $text = strtr((string) $text, $map);
    $text = strtolower(trim($text));
    $text = preg_replace('/[_\-]+/', ' ', $text);
    $text = preg_replace('/\s+/', ' ', $text);
    return $text;
}

/** Ruta de imagen publicable (URL o archivo relativo) */
function imagen_src($valor, $prefijo = '')
{
    $valor = trim((string) $valor);
    if ($valor === '') {
        return '';
    }
    if (preg_match('#^https?://#i', $valor) || strpos($valor, 'data:') === 0) {
        return $valor;
    }
    return $prefijo . ltrim($valor, '/');
}

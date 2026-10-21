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
    $text = substr($text, 0, 120);
    $text = trim($text, '-');
    return $text !== '' ? $text : 'item';
}

/** Formato de moneda AR */
function money($value)
{
    return '$' . number_format((float) $value, 2, ',', '.');
}

/** Fecha ISO de Postgres -> formato local legible */
function fecha_legible($iso)
{
    if (!$iso) {
        return '';
    }
    $t = strtotime($iso);
    return $t ? date('d/m/Y H:i', $t) : (string) $iso;
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

/* ------------------------------------------------------------------ */
/*  Helpers de datos (Supabase REST)                                   */
/* ------------------------------------------------------------------ */

/** Slug único en una tabla */
function unique_slug($table, $base, $excludeId = 0)
{
    $slug = $base;
    $i = 2;
    while (true) {
        $query = array('select' => 'id', 'slug' => 'eq.' . $slug, 'limit' => 1);
        if ($excludeId) {
            $query['id'] = 'neq.' . (int) $excludeId;
        }
        $rows = sb()->get($table, $query);
        if (!$rows) {
            return $slug;
        }
        $slug = $base . '-' . $i;
        $i++;
    }
}

/** Categorías para selects */
function categorias_select($soloActivas = false)
{
    $query = array('select' => 'id,nombre', 'order' => 'orden.asc,nombre.asc');
    if ($soloActivas) {
        $query['activo'] = 'is.true';
    }
    return sb()->get('categorias', $query);
}

/** Buscar o crear categoría por nombre, devuelve ID */
function categoria_por_nombre($nombre)
{
    $nombre = trim((string) $nombre);
    if ($nombre === '') {
        return null;
    }
    $rows = sb()->get('categorias', array('select' => 'id', 'nombre' => 'eq.' . $nombre, 'limit' => 1));
    if ($rows) {
        return (int) $rows[0]['id'];
    }
    $slug = unique_slug('categorias', slugify($nombre));
    $res = sb()->insert('categorias', array(
        'nombre' => $nombre, 'slug' => $slug, 'activo' => true, 'orden' => 0
    ), array('return' => true));
    return (is_array($res) && isset($res[0]['id'])) ? (int) $res[0]['id'] : null;
}

/**
 * Lista de productos con filtros, orden y paginación.
 * $opts: q, cat, estado, dest, orden, page, per_page
 */
function productos_buscar($opts = array())
{
    $q        = isset($opts['q']) ? trim($opts['q']) : '';
    $cat      = isset($opts['cat']) ? (int) $opts['cat'] : 0;
    $estado   = isset($opts['estado']) ? $opts['estado'] : '';
    $dest     = !empty($opts['dest']);
    $orden    = isset($opts['orden']) ? $opts['orden'] : 'recientes';
    $page     = isset($opts['page']) ? max(1, (int) $opts['page']) : 1;
    $perPage  = isset($opts['per_page']) ? (int) $opts['per_page'] : ITEMS_PER_PAGE;

    $query = array('select' => '*,categorias(nombre)');

    if ($q !== '') {
        $limpio = str_replace(array(',', '(', ')', '*'), ' ', $q);
        $limpio = trim(preg_replace('/\s+/', ' ', $limpio));
        $pat = '*' . $limpio . '*';
        $query['or'] = '(nombre.ilike.' . $pat . ',sku.ilike.' . $pat . ',descripcion.ilike.' . $pat . ')';
    }
    if ($cat) {
        $query['categoria_id'] = 'eq.' . $cat;
    }
    if ($estado === 'activos') {
        $query['activo'] = 'is.true';
    } elseif ($estado === 'inactivos') {
        $query['activo'] = 'is.false';
    } elseif ($estado === 'agotados') {
        $query['stock'] = 'lte.0';
    } elseif ($estado === 'bajo') {
        $query['and'] = '(stock.gt.0,stock.lte.5)';
    }
    if ($dest) {
        $query['destacado'] = 'is.true';
    }

    switch ($orden) {
        case 'nombre': $query['order'] = 'nombre.asc'; break;
        case 'precio_asc': $query['order'] = 'precio.asc'; break;
        case 'precio_desc': $query['order'] = 'precio.desc'; break;
        case 'stock_asc': $query['order'] = 'stock.asc'; break;
        default: $query['order'] = 'id.desc';
    }

    if ($perPage > 0) {
        $query['limit'] = $perPage;
        $query['offset'] = ($page - 1) * $perPage;
    }

    try {
        $res = sb()->getWithCount('productos', $query);
    } catch (Exception $e) {
        // Offset fuera de rango (HTTP 416): reintentar desde el inicio.
        if (strpos($e->getMessage(), '416') === false) {
            throw $e;
        }
        unset($query['offset']);
        $res = sb()->getWithCount('productos', $query);
    }

    $rows = $res['data'];
    foreach ($rows as $i => $r) {
        $rows[$i]['categoria'] = isset($r['categorias']['nombre']) ? $r['categorias']['nombre'] : null;
    }

    $total = $res['count'] !== null ? $res['count'] : count($rows);
    $paginas = $perPage > 0 ? max(1, (int) ceil($total / $perPage)) : 1;

    return array('rows' => $rows, 'total' => $total, 'page' => $page, 'paginas' => $paginas);
}

/** Un producto por id */
function producto_obtener($id)
{
    $rows = sb()->get('productos', array('select' => '*', 'id' => 'eq.' . (int) $id, 'limit' => 1));
    return $rows ? $rows[0] : null;
}

/** Crear producto, devuelve el id */
function producto_crear($data)
{
    $res = sb()->insert('productos', $data, array('return' => true));
    return (is_array($res) && isset($res[0]['id'])) ? (int) $res[0]['id'] : null;
}

/** Actualizar producto por id */
function producto_actualizar($id, $data)
{
    sb()->update('productos', array('id' => 'eq.' . (int) $id), $data);
}

/** Eliminar producto por id */
function producto_eliminar($id)
{
    sb()->delete('productos', array('id' => 'eq.' . (int) $id));
}

/** Productos por lista de ids */
function productos_por_ids($ids)
{
    if (!$ids) {
        return array();
    }
    return sb()->get('productos', array('select' => '*', 'id' => sb_in($ids)));
}

/* ---- Categorías ---- */

function categorias_con_conteo()
{
    return sb()->rpc('categorias_con_conteo');
}

function categoria_obtener($id)
{
    $rows = sb()->get('categorias', array('select' => '*', 'id' => 'eq.' . (int) $id, 'limit' => 1));
    return $rows ? $rows[0] : null;
}

function categoria_nombre_existe($nombre, $excludeId = 0)
{
    $query = array('select' => 'id', 'nombre' => 'eq.' . trim($nombre), 'limit' => 1);
    if ($excludeId) {
        $query['id'] = 'neq.' . (int) $excludeId;
    }
    return (bool) sb()->get('categorias', $query);
}

/** Crear categoría, devuelve el id */
function categoria_crear($nombre, $activo = true, $orden = 0)
{
    $res = sb()->insert('categorias', array(
        'nombre' => $nombre,
        'slug' => unique_slug('categorias', slugify($nombre)),
        'activo' => (bool) $activo,
        'orden' => (int) $orden
    ), array('return' => true));
    return (is_array($res) && isset($res[0]['id'])) ? (int) $res[0]['id'] : null;
}

function categoria_actualizar($id, $nombre, $activo, $orden)
{
    sb()->update('categorias', array('id' => 'eq.' . (int) $id), array(
        'nombre' => $nombre,
        'activo' => (bool) $activo,
        'orden' => (int) $orden
    ));
}

function categoria_eliminar($id)
{
    sb()->delete('categorias', array('id' => 'eq.' . (int) $id));
}

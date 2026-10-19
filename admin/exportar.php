<?php
require_once dirname(__DIR__) . '/includes/auth.php';
require_login();

$pdo = db();
$q      = isset($_GET['q']) ? trim($_GET['q']) : '';
$cat    = isset($_GET['cat']) && $_GET['cat'] !== '' ? (int) $_GET['cat'] : 0;
$estado = isset($_GET['estado']) ? $_GET['estado'] : '';
$dest   = isset($_GET['dest']) ? (int) $_GET['dest'] : 0;
$orden  = isset($_GET['orden']) ? $_GET['orden'] : 'recientes';

$where = array();
$params = array();
if ($q !== '') {
    $where[] = '(p.nombre LIKE ? OR p.sku LIKE ? OR p.descripcion LIKE ?)';
    $like = '%' . $q . '%';
    $params[] = $like; $params[] = $like; $params[] = $like;
}
if ($cat) { $where[] = 'p.categoria_id = ?'; $params[] = $cat; }
if ($estado === 'activos')   { $where[] = 'p.activo = 1'; }
if ($estado === 'inactivos') { $where[] = 'p.activo = 0'; }
if ($estado === 'agotados')  { $where[] = 'p.stock <= 0'; }
if ($estado === 'bajo')      { $where[] = 'p.stock > 0 AND p.stock <= 5'; }
if ($dest)                   { $where[] = 'p.destacado = 1'; }
$sqlWhere = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

switch ($orden) {
    case 'nombre': $orderBy = 'p.nombre ASC'; break;
    case 'precio_asc': $orderBy = 'p.precio ASC'; break;
    case 'precio_desc': $orderBy = 'p.precio DESC'; break;
    case 'stock_asc': $orderBy = 'p.stock ASC'; break;
    default: $orderBy = 'p.id DESC';
}

$sql = "SELECT p.*, c.nombre AS categoria FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        $sqlWhere ORDER BY $orderBy";
$st = $pdo->prepare($sql);
$st->execute($params);
$productos = $st->fetchAll();

$nombreArchivo = 'productos-' . date('Ymd-His') . '.csv';

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $nombreArchivo . '"');

$out = fopen('php://output', 'w');
fwrite($out, "\xEF\xBB\xBF");
fputcsv($out, array('sku', 'nombre', 'categoria', 'precio', 'precio_anterior', 'costo', 'stock', 'descripcion', 'imagen', 'etiqueta', 'destacado', 'activo'), ';');
foreach ($productos as $p) {
    fputcsv($out, array(
        $p['sku'],
        $p['nombre'],
        $p['categoria'],
        number_format((float) $p['precio'], 2, ',', ''),
        $p['precio_anterior'] !== null ? number_format((float) $p['precio_anterior'], 2, ',', '') : '',
        $p['costo'] !== null ? number_format((float) $p['costo'], 2, ',', '') : '',
        (int) $p['stock'],
        $p['descripcion'],
        $p['imagen'],
        $p['etiqueta'],
        (int) $p['destacado'],
        (int) $p['activo']
    ), ';');
}
fclose($out);
exit;

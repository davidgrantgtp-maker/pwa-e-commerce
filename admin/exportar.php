<?php
require_once dirname(__DIR__) . '/includes/auth.php';
require_login();

$q      = isset($_GET['q']) ? trim($_GET['q']) : '';
$cat    = isset($_GET['cat']) && $_GET['cat'] !== '' ? (int) $_GET['cat'] : 0;
$estado = isset($_GET['estado']) ? $_GET['estado'] : '';
$dest   = isset($_GET['dest']) ? (int) $_GET['dest'] : 0;
$orden  = isset($_GET['orden']) ? $_GET['orden'] : 'recientes';

$resultado = productos_buscar(array(
    'q' => $q, 'cat' => $cat, 'estado' => $estado, 'dest' => $dest,
    'orden' => $orden, 'per_page' => 0
));
$productos = $resultado['rows'];

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

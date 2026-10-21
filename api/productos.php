<?php
require_once dirname(__DIR__) . '/config/database.php';
require_once dirname(__DIR__) . '/includes/functions.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

try {
    $rows = sb_public()->get('productos', array(
        'select' => '*,categorias(nombre)',
        'activo' => 'is.true',
        'order'  => 'destacado.desc,id.desc'
    ));

    $out = array();
    foreach ($rows as $p) {
        $imagen = trim((string) $p['imagen']);
        $fallback = 'img/placeholder.svg';
        if (strpos($imagen, 'img/') === 0) {
            $fallback = $imagen;
        }
        $categoria = isset($p['categorias']['nombre']) ? $p['categorias']['nombre'] : null;
        $out[] = array(
            'id'          => $p['slug'],
            'dbId'        => (int) $p['id'],
            'sku'         => $p['sku'],
            'name'        => $p['nombre'],
            'category'    => $categoria ? $categoria : 'Otros',
            'price'       => (float) $p['precio'],
            'oldPrice'    => $p['precio_anterior'] !== null ? (float) $p['precio_anterior'] : null,
            'tag'         => (string) $p['etiqueta'],
            'featured'    => (bool) $p['destacado'],
            'image'       => $imagen !== '' ? $imagen : $fallback,
            'fallback'    => $fallback,
            'description' => (string) $p['descripcion'],
            'stock'       => (int) $p['stock'],
            'active'      => (bool) $p['activo']
        );
    }
    echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array('error' => 'No se pudo leer el catálogo.', 'detalle' => $e->getMessage()));
}

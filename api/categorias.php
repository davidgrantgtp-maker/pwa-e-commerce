<?php
require_once dirname(__DIR__) . '/config/database.php';
require_once dirname(__DIR__) . '/includes/functions.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

try {
    $rows = sb_public()->get('categorias', array(
        'select' => 'id,nombre,slug',
        'activo' => 'is.true',
        'order'  => 'orden.asc,nombre.asc'
    ));
    $out = array(array('name' => 'Todos', 'slug' => 'todos'));
    foreach ($rows as $c) {
        $out[] = array('name' => $c['nombre'], 'slug' => $c['slug']);
    }
    echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array('error' => 'No se pudieron leer las categorías.'));
}

<?php
require_once dirname(__DIR__) . '/config/database.php';
require_once dirname(__DIR__) . '/includes/functions.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

try {
    $pdo = db();
    $rows = $pdo->query('SELECT id, nombre, slug FROM categorias WHERE activo = 1 ORDER BY orden ASC, nombre ASC')->fetchAll();
    $out = array(array('name' => 'Todos', 'slug' => 'todos'));
    foreach ($rows as $c) {
        $out[] = array('name' => $c['nombre'], 'slug' => $c['slug']);
    }
    echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array('error' => 'No se pudieron leer las categorías.'));
}

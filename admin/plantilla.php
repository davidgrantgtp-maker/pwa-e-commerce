<?php
require_once dirname(__DIR__) . '/includes/auth.php';
require_login();

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="plantilla-productos.csv"');

$out = fopen('php://output', 'w');
fwrite($out, "\xEF\xBB\xBF");
fputcsv($out, array('sku', 'nombre', 'categoria', 'precio', 'precio_anterior', 'costo', 'stock', 'descripcion', 'imagen', 'etiqueta', 'destacado', 'activo'), ';');
fputcsv($out, array('CG-500', 'Café en grano 500 g', 'Cafés', '8500', '9900', '5200', '60', 'Blend de especialidad tostado medio.', 'img/cafe-grano.svg', 'Más vendido', '1', '1'), ';');
fputcsv($out, array('TM-500', 'Termo 500 ml', 'Accesorios', '12900', '14900', '9000', '15', 'Termo de acero inoxidable doble pared.', 'https://ejemplo.com/termo.jpg', 'Envío gratis', '1', '1'), ';');
fputcsv($out, array('MD-6', 'Medialunas x6', 'Comida', '3600', '', '1800', '40', 'Horneadas cada mañana.', '', 'Recién horneadas', '0', '1'), ';');
fclose($out);
exit;

<?php
require_once __DIR__ . '/functions.php';

/** Alias de columnas aceptados en la planilla */
function import_alias()
{
    return array(
        'sku'             => array('sku', 'codigo', 'cod', 'code', 'codigo producto'),
        'nombre'          => array('nombre', 'producto', 'name', 'titulo', 'descripcion corta'),
        'categoria'       => array('categoria', 'category', 'rubro', 'familia'),
        'precio'          => array('precio', 'price', 'pvp', 'precio venta', 'valor'),
        'precio_anterior' => array('precio anterior', 'precio viejo', 'precio lista', 'precio tachado', 'precio oferta'),
        'costo'           => array('costo', 'cost', 'precio costo', 'compra'),
        'stock'           => array('stock', 'cantidad', 'qty', 'existencia', 'existencias', 'unidades'),
        'descripcion'     => array('descripcion', 'detalle', 'description', 'descripcion larga'),
        'imagen'          => array('imagen', 'foto', 'image', 'img', 'url imagen', 'url foto'),
        'etiqueta'        => array('etiqueta', 'tag', 'badge', 'promo'),
        'destacado'       => array('destacado', 'featured', 'destacar'),
        'activo'          => array('activo', 'estado', 'visible', 'publicado', 'habilitado'),
    );
}

/**
 * Lee un CSV y devuelve filas (array de arrays).
 */
function import_leer_csv($ruta)
{
    $contenido = file_get_contents($ruta);
    if ($contenido === false) {
        return array();
    }
    if (substr($contenido, 0, 3) === "\xEF\xBB\xBF") {
        $contenido = substr($contenido, 3);
    }
    if (!mb_check_encoding($contenido, 'UTF-8')) {
        $contenido = mb_convert_encoding($contenido, 'UTF-8', 'ISO-8859-1');
    }
    $lineas = preg_split('/\r\n|\r|\n/', $contenido);
    $lineas = array_values(array_filter($lineas, function ($l) { return trim($l) !== ''; }));
    if (!$lineas) {
        return array();
    }
    $primera = $lineas[0];
    $candidatos = array(',' => substr_count($primera, ','), ';' => substr_count($primera, ';'), "\t" => substr_count($primera, "\t"));
    arsort($candidatos);
    $delim = key($candidatos);
    if ((int) current($candidatos) === 0) {
        $delim = ',';
    }
    $filas = array();
    foreach ($lineas as $linea) {
        $filas[] = str_getcsv($linea, $delim);
    }
    return $filas;
}

/** Convierte letras de columna Excel (A, B, AA) a índice 0-based */
function import_col_index($letras)
{
    $letras = strtoupper($letras);
    $n = 0;
    $len = strlen($letras);
    for ($i = 0; $i < $len; $i++) {
        $n = $n * 26 + (ord($letras[$i]) - 64);
    }
    return $n - 1;
}

/**
 * Busca una entrada del ZIP normalizando separadores (algunos programas
 * guardan rutas con "\" en lugar de "/").
 */
function import_zip_buscar($zip, $buscada)
{
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $nombre = str_replace('\\', '/', $zip->getNameIndex($i));
        if ($nombre === $buscada) {
            return $zip->getFromIndex($i);
        }
    }
    return false;
}

/**
 * Lee la primera hoja de un XLSX usando ZipArchive + SimpleXML.
 */
function import_leer_xlsx($ruta)
{
    $zip = new ZipArchive();
    if ($zip->open($ruta) !== true) {
        return array();
    }

    $shared = array();
    $ssXml = $zip->getFromName('xl/sharedStrings.xml');
    if ($ssXml === false) {
        $ssXml = import_zip_buscar($zip, 'xl/sharedStrings.xml');
    }
    if ($ssXml !== false) {
        $ss = @simplexml_load_string($ssXml);
        if ($ss !== false) {
            foreach ($ss->si as $si) {
                $texto = '';
                foreach ($si->t as $t) {
                    $texto .= (string) $t;
                }
                foreach ($si->r as $r) {
                    foreach ($r->t as $t) {
                        $texto .= (string) $t;
                    }
                }
                $shared[] = trim($texto);
            }
        }
    }

    $sheet = $zip->getFromName('xl/worksheets/sheet1.xml');
    if ($sheet === false) {
        $sheet = import_zip_buscar($zip, 'xl/worksheets/sheet1.xml');
    }
    $zip->close();
    if ($sheet === false) {
        return array();
    }
    $sx = @simplexml_load_string($sheet);
    if ($sx === false) {
        return array();
    }

    $filas = array();
    foreach ($sx->sheetData->row as $row) {
        $celdas = array();
        $max = -1;
        foreach ($row->c as $c) {
            $ref = (string) $c['r'];
            $col = preg_replace('/[0-9]+/', '', $ref);
            $idx = import_col_index($col);
            $tipo = (string) $c['t'];
            $valor = '';
            if ($tipo === 's') {
                $v = isset($c->v) ? (string) $c->v : '';
                $valor = isset($shared[(int) $v]) ? $shared[(int) $v] : '';
            } elseif ($tipo === 'inlineStr') {
                if (isset($c->is)) {
                    foreach ($c->is->t as $t) {
                        $valor .= (string) $t;
                    }
                    foreach ($c->is->r as $r) {
                        foreach ($r->t as $t) {
                            $valor .= (string) $t;
                        }
                    }
                }
                if ($valor === '') {
                    $valor = trim(strip_tags($c->asXML()));
                }
                $valor = trim($valor);
            } else {
                $valor = isset($c->v) ? (string) $c->v : '';
            }
            $celdas[$idx] = $valor;
            $max = max($max, $idx);
        }
        $ordenada = array();
        for ($i = 0; $i <= $max; $i++) {
            $ordenada[] = isset($celdas[$i]) ? $celdas[$i] : '';
        }
        $filas[] = $ordenada;
    }
    return $filas;
}

/** Detecta archivo y devuelve filas crudas */
function import_leer($ruta, $nombre)
{
    $ext = strtolower(pathinfo($nombre, PATHINFO_EXTENSION));
    if ($ext === 'xlsx') {
        return import_leer_xlsx($ruta);
    }
    if ($ext === 'csv' || $ext === 'txt') {
        return import_leer_csv($ruta);
    }
    return array();
}

/** Mapea encabezados a campos internos */
function import_mapear($headers)
{
    $alias = import_alias();
    $map = array();
    $usados = array();

    foreach ($headers as $i => $h) {
        $n = normaliza_header($h);
        if ($n === '') continue;
        foreach ($alias as $campo => $nombres) {
            if (!isset($usados[$campo]) && in_array($n, $nombres, true)) {
                $map[$i] = $campo;
                $usados[$campo] = true;
                break;
            }
        }
    }
    foreach ($headers as $i => $h) {
        if (isset($map[$i])) continue;
        $n = normaliza_header($h);
        if ($n === '') continue;
        foreach ($alias as $campo => $nombres) {
            if (isset($usados[$campo])) continue;
            foreach ($nombres as $nombre) {
                if ($nombre !== '' && strpos($n, $nombre) !== false) {
                    $map[$i] = $campo;
                    $usados[$campo] = true;
                    break 2;
                }
            }
        }
    }
    return $map;
}

/**
 * Convierte filas crudas en registros asociativos.
 * Devuelve array('headers'=>, 'map'=>, 'rows'=>).
 */
function import_preparar($filas)
{
    if (!$filas) {
        return array('headers' => array(), 'map' => array(), 'rows' => array());
    }
    $headers = array_map(function ($v) { return trim((string) $v); }, array_shift($filas));
    $map = import_mapear($headers);

    $rows = array();
    foreach ($filas as $fila) {
        if (!is_array($fila)) continue;
        $item = array();
        foreach ($map as $idx => $campo) {
            $item[$campo] = isset($fila[$idx]) ? trim((string) $fila[$idx]) : '';
        }
        // Si la fila está completamente vacía, se omite.
        $vacio = true;
        foreach ($item as $v) { if ($v !== '') { $vacio = false; break; } }
        if (!$vacio) {
            $rows[] = $item;
        }
    }
    return array('headers' => $headers, 'map' => $map, 'rows' => $rows);
}

/**
 * Importa (upsert por SKU o nombre). Devuelve estadísticas.
 */
function import_procesar($rows, $archivo, $usuarioId = 0)
{
    $pdo = db();
    $creadas = 0;
    $actualizadas = 0;
    $errores = 0;
    $detalles = array();
    $columnas = array();
    if ($rows) {
        $columnas = array_keys($rows[0]);
    }

    foreach ($rows as $n => $r) {
        $filaN = $n + 2; // +2 = fila real en la planilla (1 es encabezado)
        try {
            $nombre = isset($r['nombre']) ? trim($r['nombre']) : '';
            if ($nombre === '') {
                $errores++;
                $detalles[] = 'Fila ' . $filaN . ': falta el nombre.';
                continue;
            }

            $sku = isset($r['sku']) && $r['sku'] !== '' ? trim($r['sku']) : null;
            $precio = isset($r['precio']) && $r['precio'] !== '' ? parse_numero($r['precio']) : null;
            $precioAnterior = isset($r['precio_anterior']) && $r['precio_anterior'] !== '' ? parse_numero($r['precio_anterior']) : null;
            $costo = isset($r['costo']) && $r['costo'] !== '' ? parse_numero($r['costo']) : null;
            $stock = isset($r['stock']) && $r['stock'] !== '' ? parse_numero($r['stock']) : null;
            $catId = null;
            $tieneCategoria = false;
            if (isset($r['categoria']) && $r['categoria'] !== '') {
                $catId = categoria_por_nombre($r['categoria']);
                $tieneCategoria = true;
            }

            // Buscar existente
            $existente = null;
            if ($sku !== null) {
                $st = $pdo->prepare('SELECT * FROM productos WHERE sku = ? LIMIT 1');
                $st->execute(array($sku));
                $existente = $st->fetch();
            }
            if (!$existente) {
                $st = $pdo->prepare('SELECT * FROM productos WHERE nombre = ? LIMIT 1');
                $st->execute(array($nombre));
                $existente = $st->fetch();
            }

            if ($existente) {
                $sets = array();
                $vals = array();
                $sets[] = 'nombre = ?'; $vals[] = $nombre;
                $sets[] = 'sku = ?'; $vals[] = $sku;
                if ($precio !== null) { $sets[] = 'precio = ?'; $vals[] = $precio; }
                if (isset($r['precio_anterior'])) { $sets[] = 'precio_anterior = ?'; $vals[] = $precioAnterior; }
                if (isset($r['costo'])) { $sets[] = 'costo = ?'; $vals[] = $costo; }
                if ($stock !== null) { $sets[] = 'stock = ?'; $vals[] = (int) $stock; }
                if (isset($r['descripcion']) && $r['descripcion'] !== '') { $sets[] = 'descripcion = ?'; $vals[] = $r['descripcion']; }
                if (isset($r['imagen']) && $r['imagen'] !== '') { $sets[] = 'imagen = ?'; $vals[] = $r['imagen']; }
                if (isset($r['etiqueta'])) { $sets[] = 'etiqueta = ?'; $vals[] = $r['etiqueta']; }
                if ($tieneCategoria) { $sets[] = 'categoria_id = ?'; $vals[] = $catId; }
                if (isset($r['destacado']) && $r['destacado'] !== '') { $sets[] = 'destacado = ?'; $vals[] = parse_bool($r['destacado'], 0); }
                if (isset($r['activo']) && $r['activo'] !== '') { $sets[] = 'activo = ?'; $vals[] = parse_bool($r['activo'], 1); }
                $sets[] = 'actualizado_en = NOW()';
                $vals[] = (int) $existente['id'];
                $st = $pdo->prepare('UPDATE productos SET ' . implode(', ', $sets) . ' WHERE id = ?');
                $st->execute($vals);
                $actualizadas++;
            } else {
                if ($precio === null) { $precio = 0; }
                if ($stock === null) { $stock = 0; }
                $slug = unique_slug('productos', slugify($nombre));
                $st = $pdo->prepare('INSERT INTO productos (sku, nombre, slug, categoria_id, precio, precio_anterior, costo, stock, descripcion, imagen, etiqueta, destacado, activo, creado_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())');
                $st->execute(array(
                    $sku, $nombre, $slug, $catId, $precio, $precioAnterior, $costo, (int) $stock,
                    isset($r['descripcion']) ? $r['descripcion'] : '',
                    isset($r['imagen']) ? $r['imagen'] : '',
                    isset($r['etiqueta']) ? $r['etiqueta'] : '',
                    isset($r['destacado']) ? parse_bool($r['destacado'], 0) : 0,
                    isset($r['activo']) ? parse_bool($r['activo'], 1) : 1
                ));
                $creadas++;
            }
        } catch (Exception $e) {
            $errores++;
            $detalles[] = 'Fila ' . $filaN . ': ' . $e->getMessage();
        }
    }

    $total = count($rows);
    $st = $pdo->prepare('INSERT INTO importaciones (archivo, total, creadas, actualizadas, errores, usuario_id, creado_en) VALUES (?,?,?,?,?,?,NOW())');
    $st->execute(array($archivo, $total, $creadas, $actualizadas, $errores, (int) $usuarioId));

    return array(
        'total' => $total,
        'creadas' => $creadas,
        'actualizadas' => $actualizadas,
        'errores' => $errores,
        'detalles' => $detalles
    );
}

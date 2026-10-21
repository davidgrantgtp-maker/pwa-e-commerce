<?php
/**
 * Capa de acceso a datos sobre la API REST de Supabase (PostgREST).
 * Reemplaza la antigua conexión PDO/MySQL.
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/supabase.php';
require_once dirname(__DIR__) . '/lib/Supabase.php';

/**
 * Cliente con permisos de escritura (service_role).
 * Usar en el panel de administración y en operaciones de carga.
 */
function sb()
{
    static $client = null;
    if ($client === null) {
        $key = SUPABASE_SERVICE_KEY !== '' && strpos(SUPABASE_SERVICE_KEY, 'TU_') !== 0
            ? SUPABASE_SERVICE_KEY
            : SUPABASE_ANON_KEY;
        $client = new SupabaseRest(SUPABASE_URL, $key);
    }
    return $client;
}

/**
 * Cliente público (anon) para la tienda. Respeta Row Level Security.
 */
function sb_public()
{
    static $client = null;
    if ($client === null) {
        $key = SUPABASE_ANON_KEY !== '' && strpos(SUPABASE_ANON_KEY, 'TU_') !== 0
            ? SUPABASE_ANON_KEY
            : SUPABASE_SERVICE_KEY;
        $client = new SupabaseRest(SUPABASE_URL, $key);
    }
    return $client;
}

/** Arma un filtro PostgREST del tipo in.(1,2,3) a partir de una lista de enteros. */
function sb_in($ids)
{
    $ids = array_map('intval', (array) $ids);
    return 'in.(' . implode(',', $ids) . ')';
}

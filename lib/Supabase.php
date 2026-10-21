<?php
/**
 * Cliente mínimo para la API REST (PostgREST) de Supabase.
 * Compatible con PHP 5.6.
 *
 * Uso:
 *   $sb = new SupabaseRest(SUPABASE_URL, SUPABASE_SERVICE_KEY);
 *   $rows = $sb->get('productos', array('select' => '*', 'limit' => 10));
 */
class SupabaseRest
{
    private $url;
    private $key;
    private $timeout;
    public $lastHeaders = array();

    public function __construct($url, $key, $timeout = 30)
    {
        $this->url = rtrim((string) $url, '/');
        $this->key = (string) $key;
        $this->timeout = (int) $timeout;
    }

    /**
     * Busca un bundle de CAs válido. Permite arrancar aunque php.ini apunte
     * a un archivo inexistente (caso típico de XAMPP en Windows).
     */
    private static function caBundle()
    {
        static $path = null;
        static $checked = false;
        if ($checked) {
            return $path;
        }
        $checked = true;
        $candidatos = array();
        if (defined('SUPABASE_CA_BUNDLE') && SUPABASE_CA_BUNDLE !== '') {
            $candidatos[] = SUPABASE_CA_BUNDLE;
        }
        $candidatos[] = dirname(dirname(__FILE__)) . '/config/cacert.pem';
        $candidatos[] = 'C:/xampp/php/cacert.pem';
        $candidatos[] = 'C:/xampp/apache/bin/curl-ca-bundle.crt';
        $candidatos[] = 'C:/xampp/perl/vendor/lib/Mozilla/CA/cacert.pem';
        foreach ($candidatos as $c) {
            if ($c && @is_file($c)) {
                $path = $c;
                break;
            }
        }
        return $path;
    }

    private function baseHeaders()
    {
        return array(
            'apikey: ' . $this->key,
            'Authorization: Bearer ' . $this->key,
            'Content-Type: application/json',
            'Accept: application/json'
        );
    }

    /** Codifica un valor conservando los caracteres que usa PostgREST. */
    private function enc($value)
    {
        $s = rawurlencode((string) $value);
        return strtr($s, array(
            '%2A' => '*', '%28' => '(', '%29' => ')', '%2C' => ',',
            '%2E' => '.', '%3A' => ':', '%2F' => '/'
        ));
    }

    private function build($table, $query = array())
    {
        $url = $this->url . '/rest/v1/' . ltrim($table, '/');
        if ($query) {
            $pairs = array();
            foreach ($query as $k => $v) {
                $pairs[] = $k . '=' . $this->enc($v);
            }
            $url .= '?' . implode('&', $pairs);
        }
        return $url;
    }

    private function request($method, $url, $body = null, $headers = array())
    {
        $reqHeaders = $this->baseHeaders();
        foreach ($headers as $h) {
            $reqHeaders[] = $h;
        }
        $respHeaders = array();
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $reqHeaders);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 12);
        curl_setopt($ch, CURLOPT_HEADERFUNCTION, function ($ch, $line) use (&$respHeaders) {
            $parts = explode(':', $line, 2);
            if (count($parts) === 2) {
                $respHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
            }
            return strlen($line);
        });
        $ca = self::caBundle();
        if ($ca !== null) {
            curl_setopt($ch, CURLOPT_CAINFO, $ca);
        }
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }
        $raw = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        $this->lastHeaders = $respHeaders;

        if ($raw === false) {
            throw new Exception('No se pudo conectar con Supabase: ' . $err);
        }
        $json = ($raw === '' || $raw === null) ? null : json_decode($raw, true);
        if ($code >= 400) {
            $msg = (is_array($json) && isset($json['message'])) ? $json['message'] : $raw;
            $codePg = (is_array($json) && isset($json['code'])) ? ' / ' . $json['code'] : '';
            $details = (is_array($json) && isset($json['details']) && $json['details']) ? ' ' . $json['details'] : '';
            throw new Exception('Supabase HTTP ' . $code . $codePg . ': ' . $msg . $details);
        }
        return $json;
    }

    /** SELECT */
    public function get($table, $query = array())
    {
        $json = $this->request('GET', $this->build($table, $query));
        return is_array($json) ? $json : array();
    }

    /** SELECT con total de filas (header Content-Range). */
    public function getWithCount($table, $query = array())
    {
        $json = $this->request('GET', $this->build($table, $query), null, array('Prefer: count=exact'));
        $count = null;
        $cr = isset($this->lastHeaders['content-range']) ? $this->lastHeaders['content-range'] : '';
        if ($cr !== '' && strpos($cr, '/') !== false) {
            $tot = substr($cr, strrpos($cr, '/') + 1);
            if ($tot !== '*') {
                $count = (int) $tot;
            }
        }
        return array('data' => is_array($json) ? $json : array(), 'count' => $count);
    }

    /** INSERT (una fila o varias). Devuelve las filas insertadas si $opts['return']. */
    public function insert($table, $rows, $opts = array())
    {
        $prefer = array();
        if (!empty($opts['return'])) {
            $prefer[] = 'return=representation';
        }
        if (!empty($opts['count'])) {
            $prefer[] = 'count=exact';
        }
        if (!empty($opts['upsert'])) {
            $prefer[] = 'resolution=merge-duplicates';
        }
        if (!empty($opts['ignore_duplicates'])) {
            $prefer[] = 'resolution=ignore-duplicates';
        }
        $headers = array();
        if ($prefer) {
            $headers[] = 'Prefer: ' . implode(',', $prefer);
        }
        $query = array();
        if (!empty($opts['on_conflict'])) {
            $query['on_conflict'] = $opts['on_conflict'];
        }
        return $this->request('POST', $this->build($table, $query), $rows, $headers);
    }

    /** UPDATE (PATCH) sobre los filtros indicados. */
    public function update($table, $query, $values, $opts = array())
    {
        $headers = array();
        if (!empty($opts['return'])) {
            $headers[] = 'Prefer: return=representation';
        }
        return $this->request('PATCH', $this->build($table, $query), $values, $headers);
    }

    /** DELETE sobre los filtros indicados. */
    public function delete($table, $query)
    {
        return $this->request('DELETE', $this->build($table, $query));
    }

    /** Llamada a una función RPC de Postgres. */
    public function rpc($fn, $params = array())
    {
        $url = $this->url . '/rest/v1/rpc/' . ltrim($fn, '/');
        // Se envía como objeto ({}) para que PostgREST reciba los argumentos por nombre.
        return $this->request('POST', $url, (object) $params);
    }
}

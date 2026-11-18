<?php

declare(strict_types=1);

// Destructive fixture writes are allowed ONLY in an empty, explicitly named test DB.
require dirname(__DIR__) . '/src/bootstrap.php';
use LaverdaApi\Config;
use LaverdaApi\Database;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
if (!str_starts_with(Config::database()['name'], 'laverda_test_')) {
    throw new RuntimeException('Use an EMPTY database whose name starts with laverda_test_.');
}
$pdo = Database::connect();
if ($pdo->query('SHOW TABLES')->fetchAll() !== []) {
    throw new RuntimeException('Refusing to modify a nonempty database. Create a fresh test database.');
}
$root = dirname(__DIR__);
$checks = 0;
$server = null;
$log = tempnam(sys_get_temp_dir(), 'laverda-api-test-');
$fixture = tempnam(sys_get_temp_dir(), 'laverda-seed-test-');
$password = bin2hex(random_bytes(24));
putenv('APP_PASSWORD=' . $password);
putenv('CORS_ALLOWED_ORIGIN=https://app.example.test');

function check(bool $condition, string $message): void
{
    global $checks;
    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $message);
    }
    $checks++;
}

/** @return array{code: int, stdout: string, stderr: string} */
function importSeed(?string $file = null): array
{
    global $root;
    $command = [PHP_BINARY, $root . '/scripts/import_places.php'];
    if ($file !== null) {
        $command[] = $file;
    }
    $process = proc_open($command, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($process)) {
        throw new RuntimeException('Could not launch importer.');
    }
    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    return ['code' => proc_close($process), 'stdout' => $stdout, 'stderr' => $stderr];
}

function setClubPassword(string $slug, #[\SensitiveParameter] string $password): int
{
    global $root;
    $process = proc_open([PHP_BINARY, $root . '/scripts/set-password.php', $slug],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($process)) { throw new RuntimeException('Could not launch password setter.'); }
    fwrite($pipes[0], $password . "\n" . $password . "\n"); fclose($pipes[0]);
    stream_get_contents($pipes[1]); stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    return proc_close($process);
}

/** @return array{status: int, body: mixed, headers: string} */
function request(string $path, string $method = 'GET', ?string $body = null, ?string $origin = null, ?string $etag = null): array
{
    global $baseUrl, $bearer;
    $headers = ['Accept: application/json'];
    if (!empty($bearer)) { $headers[] = 'Authorization: Bearer ' . $bearer; }
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
    }
    if ($origin !== null) {
        $headers[] = 'Origin: ' . $origin;
    }
    if ($etag !== null) {
        $headers[] = 'If-None-Match: ' . $etag;
    }
    $context = stream_context_create(['http' => [
        'method' => $method, 'header' => implode("\r\n", $headers),
        'content' => $body ?? '', 'ignore_errors' => true, 'timeout' => 10,
    ]]);
    $response = file_get_contents($baseUrl . $path, false, $context);
    if ($response === false) {
        throw new RuntimeException('HTTP request failed: ' . $path);
    }
    preg_match('/\s(\d{3})\s/', $http_response_header[0], $match);
    return [
        'status' => (int) $match[1],
        'body' => $response === '' ? null : json_decode($response, true, flags: JSON_THROW_ON_ERROR),
        'headers' => implode("\n", $http_response_header),
    ];
}

try {
    $migrator = new LaverdaApi\Migrator($pdo, $root . '/database');
    check(count($migrator->migrate()) === 3, 'all migrations applied');
    check($migrator->migrate() === [], 'repeated migrations are no-op');
    check((int) $pdo->query('SELECT COUNT(*) FROM tenants')->fetchColumn() === 0, 'schema creation');
    $first = importSeed();
    check($first['code'] === 0, 'first import: ' . $first['stderr']);
    $snapshot = $pdo->query('SELECT * FROM places ORDER BY sort_order, id')->fetchAll();
    $repeat = importSeed();
    check($repeat['code'] === 0, 'repeated import');
    check($pdo->query('SELECT * FROM places ORDER BY sort_order, id')->fetchAll() === $snapshot, 'idempotent rows');
    check(count($snapshot) === 43, '43 source records retained');
    foreach (["verified = 3", "latitude = 91", "longitude = NULL", "tags_json = 'not-json'",
        "tags_json = '{}'", "visibility = 'unknown'", "type = 'admin'"] as $invalidAssignment) {
        try {
            $pdo->exec('UPDATE places SET ' . $invalidAssignment . ' ORDER BY sort_order LIMIT 1');
            $rejected = false;
        } catch (PDOException) {
            $rejected = true;
        }
        check($rejected, 'database integrity rejects ' . $invalidAssignment);
    }
    $pdo->exec("UPDATE tenants SET is_active = 0, name = 'Custom club name' WHERE slug = 'laverda'");
    check(importSeed()['code'] === 0, 'import into inactive tenant');
    $tenant = $pdo->query("SELECT * FROM tenants WHERE slug = 'laverda'")->fetch();
    check((int) $tenant['is_active'] === 0 && $tenant['name'] === 'Custom club name', 'import preserves tenant administration');
    $pdo->exec("UPDATE tenants SET is_active = 1 WHERE slug = 'laverda'");
    echo "PASS schema, first/repeat import, tenant settings\n";

    $source = json_decode(file_get_contents($root . '/places.json'), true, flags: JSON_THROW_ON_ERROR)['entries'];
    $invalid = $source;
    $invalid[0]['name'] = 'This change must roll back';
    $invalid[1]['location']['lat'] = 100;
    file_put_contents($fixture, json_encode(['entries' => $invalid], JSON_THROW_ON_ERROR));
    check(importSeed($fixture)['code'] === 1, 'invalid coordinates rejected');
    check($pdo->query('SELECT * FROM places ORDER BY sort_order, id')->fetchAll() === $snapshot, 'failed import rolls back earlier writes');
    $invalid = $source;
    $invalid[0]['name'] = 'This database write must roll back';
    $invalid[1]['name'] = str_repeat('x', 501);
    file_put_contents($fixture, json_encode(['entries' => $invalid], JSON_THROW_ON_ERROR));
    check(importSeed($fixture)['code'] === 1, 'database constraint failure rejects import');
    check($pdo->query('SELECT * FROM places ORDER BY sort_order, id')->fetchAll() === $snapshot, 'database failure rolls back earlier writes');

    // Port 0 chooses an available loopback port; the test server is never public.
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    if ($socket === false) {
        throw new RuntimeException($error);
    }
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $baseUrl = 'http://' . $address;
    $server = proc_open(
        [PHP_BINARY, '-S', $address, '-t', $root . '/public', $root . '/public/index.php'],
        [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']],
        $serverPipes
    );
    if (!is_resource($server)) {
        throw new RuntimeException('Could not launch API.');
    }
    fclose($serverPipes[0]);
    for ($attempt = 0; $attempt < 50; $attempt++) {
        $connection = @stream_socket_client('tcp://' . $address, $errno, $error, 0.1);
        if ($connection !== false) {
            fclose($connection);
            break;
        }
        usleep(100000);
    }
    check(request('/health')['status'] === 200, 'health ready');
    $bearer = '';
    check(request('/api/places')['status'] === 401, 'anonymous legacy data blocked');
    check(request('/api/v1/tenants/laverda/places')['status'] === 401, 'anonymous versioned data blocked');
    check(request('/api/places/unknown', etag: '*')['status'] === 401, 'ETag cannot bypass authentication');
    check(setClubPassword('laverda', $password) === 0, 'CLI creates a club password');
    check(password_verify($password, $pdo->query("SELECT access_password_hash FROM tenants WHERE slug = 'laverda'")->fetchColumn()), 'database stores a verified password hash');
    $login = request('/api/v1/tenants/laverda/auth/login', 'POST', json_encode(['password' => $password]));
    check($login['status'] === 200, 'real login');
    $bearer = $login['body']['token'];
    check(strlen($bearer) === 64, 'random session token');
    check($pdo->query('SELECT token_hash FROM auth_sessions LIMIT 1')->fetchColumn() === hash('sha256', $bearer), 'only token hashes stored');
    check(request('/api/v1/tenants/laverda/auth/session')['status'] === 200, 'session verification');
    $collection = request('/api/v1/tenants/laverda/places');
    check($collection['status'] === 200, 'versioned collection');
    preg_match('/ETag: (.+)/i', $collection['headers'], $etagMatch);
    $etag = trim($etagMatch[1]);
    check(request('/api/v1/tenants/laverda/places', etag: $etag)['status'] === 304, 'conditional collection response');
    check(str_contains($collection['headers'], 'Cache-Control: private, no-store'), 'public data revalidates');
    $entries = $collection['body']['entries'];
    check(count($entries) === 43, 'collection count');
    check(request('/api/places')['body'] === $collection['body'], 'legacy contract');
    check(request('/api/v1/tenants/laverda/places')['body'] === $collection['body'], 'deterministic order');
    check(count(array_unique(array_column($entries, 'id'))) === 43, 'unique IDs');
    foreach ($source as $i => $entry) {
        foreach ($entry as $key => $value) {
            if ($key === 'id' && $entries[$i]['id'] === $value . '-2') {
                continue;
            }
            check($entries[$i][$key] === $value, "source field preserved at {$i}.{$key}");
        }
    }
    $id = rawurlencode($entries[0]['id']);
    check(request('/api/v1/tenants/laverda/places/' . $id)['body'] === $entries[0], 'detail contract');
    check(request('/api/places/' . $id)['body'] === $entries[0], 'legacy detail');
    check(request('/api/v1/tenants/missing/places')['status'] === 401, 'unknown tenant collection requires scoped session');
    check(request('/api/v1/tenants/missing/places/' . $id)['status'] === 401, 'unknown tenant detail requires scoped session');
    check(request('/api/v1/tenants/laverda/places/missing')['body']['error'] === 'place_not_found', 'unknown ID');
    check(request('/missing')['status'] === 404, 'unknown route');
    check(request('/api/places', 'POST')['status'] === 405, 'unsupported method');
    echo "PASS HTTP health, collection/detail, legacy routes, all source fields, unknown resources\n";

    $q = (string) ($entries[0]['name'] ?? $entries[0]['country']);
    $search = request('/api/places?q=' . rawurlencode($q));
    check($search['status'] === 200 && count($search['body']['entries']) > 0, 'native PDO text search');
    check(request('/api/places?q=%25')['body']['entries'] === [], 'literal percent is not a wildcard');
    check(request('/api/places?q=' . rawurlencode("' OR 1=1 --"))['body']['entries'] === [], 'SQL injection remains data');
    check(request('/api/places?q[]=x')['status'] === 400, 'array query rejected');
    check(request('/api/places?q=' . str_repeat('x', 501))['status'] === 400, 'oversized query rejected');
    $filters = http_build_query(['type' => $entries[0]['type'], 'country' => $entries[0]['country']]);
    $filtered = request('/api/places?' . $filters)['body']['entries'];
    check(count($filtered) > 0, 'combined filters return data');
    foreach ($filtered as $entry) {
        check($entry['type'] === $entries[0]['type'] && $entry['country'] === $entries[0]['country'], 'combined filter values');
    }

    $setVisibility = $pdo->prepare('UPDATE places SET visibility = ? WHERE tenant_id = ? AND id = ?');
    foreach (['hidden', 'private', null] as $visibility) {
        $setVisibility->execute([$visibility, $tenant['id'], $entries[0]['id']]);
        check(count(request('/api/places')['body']['entries']) === 42, 'nonpublic collection exclusion');
        check(request('/api/places/' . $id)['status'] === 404, 'nonpublic detail exclusion');
        check(request('/api/places', etag: $etag)['status'] === 200, 'visibility change invalidates ETag');
    }
    $setVisibility->execute(['public', $tenant['id'], $entries[0]['id']]);
    $pdo->exec("UPDATE tenants SET is_active = 0 WHERE slug = 'laverda'");
    check(request('/api/places')['status'] === 401, 'inactive tenant collection');
    check(request('/api/places/' . $id)['status'] === 401, 'inactive tenant detail');
    check(request('/api/places', etag: $etag)['status'] === 401, 'ETag never bypasses tenant visibility');
    $pdo->exec("UPDATE tenants SET is_active = 1 WHERE slug = 'laverda'");
    $pdo->exec("INSERT INTO tenants (slug, name) VALUES ('other-club', 'Other club')");
    $otherId = $pdo->lastInsertId();
    check(request('/api/v1/tenants/other-club/places')['status'] === 401, 'cross-tenant token denied');
    $laverdaBearer = $bearer;
    $pdo->prepare('UPDATE tenants SET access_password_hash = ? WHERE slug = ?')->execute([LaverdaApi\Auth\ClubAccess::passwordHash($password), 'other-club']);
    $otherLogin = request('/api/v1/tenants/other-club/auth/login', 'POST', json_encode(['password' => $password]));
    $bearer = $otherLogin['body']['token'];
    $other = $pdo->prepare('INSERT INTO places (tenant_id, id, name, visibility) VALUES (?, ?, ?, ?)');
    $other->execute([$otherId, $entries[0]['id'], 'Other tenant place', 'public']);
    check(count(request('/api/v1/tenants/other-club/places')['body']['entries']) === 1, 'other tenant collection');
    check(request('/api/v1/tenants/other-club/places/' . $id)['body']['name'] === 'Other tenant place', 'tenant isolation with shared ID');
    check(request('/api/places/' . $id)['status'] === 401, 'other tenant cannot read laverda');
    $other->execute([$otherId, 'CaseSensitive', 'Upper-case ID', 'public']);
    $other->execute([$otherId, 'casesensitive', 'Lower-case ID', 'public']);
    check(request('/api/v1/tenants/other-club/places/CaseSensitive')['body']['name'] === 'Upper-case ID', 'case-sensitive ID lookup');
    check(request('/api/v1/tenants/other-club/places/casesensitive')['body']['name'] === 'Lower-case ID', 'case-distinct IDs retained');
    $bearer = $laverdaBearer;
    echo "PASS search/filter validation, public visibility, tenant isolation\n";

    check(request('/auth/unlock', 'POST', json_encode(['password' => $password]))['status'] === 200, 'correct password');
    check(request('/auth/unlock', 'POST', '{"password":"incorrect"}')['status'] === 401, 'wrong password');
    check(request('/auth/unlock', 'POST', 'not json')['status'] === 400, 'malformed unlock JSON');
    check(request('/auth/unlock', 'POST', '{}')['status'] === 400, 'missing password');
    check(request('/auth/unlock', 'POST', str_repeat('x', 4097))['status'] === 413, 'bounded body');
    check(request('/auth/unlock')['status'] === 405, 'unlock method');
    $preflight = request('/auth/unlock', 'OPTIONS', origin: 'https://app.example.test');
    check($preflight['status'] === 204, 'CORS preflight');
    check(str_contains($preflight['headers'], 'Access-Control-Allow-Origin: https://app.example.test'), 'configured CORS origin');
    $denied = request('/health', origin: 'https://untrusted.example');
    check(!str_contains($denied['headers'], 'Access-Control-Allow-Origin:'), 'unlisted CORS origin');
    check(str_contains($denied['headers'], 'Vary: Origin'), 'CORS varies on all requests');

    $sessionToken = $bearer;
    $logoutLogin = request('/api/v1/tenants/laverda/auth/login', 'POST', json_encode(['password' => $password]));
    $bearer = $logoutLogin['body']['token'];
    check(request('/api/v1/tenants/laverda/auth/logout', 'POST')['status'] === 200, 'logout');
    check(request('/api/v1/tenants/laverda/auth/session')['status'] === 401, 'revoked token rejected');
    $bearer = $sessionToken;
    $pdo->prepare('UPDATE auth_sessions SET expires_at = 1 WHERE token_hash = ?')->execute([hash('sha256', $bearer)]);
    check(request('/api/places')['status'] === 401, 'expired token rejected');
    $fresh = request('/api/v1/tenants/laverda/auth/login', 'POST', json_encode(['password' => $password]));
    $bearer = $fresh['body']['token'];
    check(setClubPassword('laverda', $password) === 0, 'CLI password rotation succeeds');
    check(request('/api/places')['status'] === 401, 'password version change invalidates sessions');
    $fresh = request('/api/v1/tenants/laverda/auth/login', 'POST', json_encode(['password' => $password]));
    $bearer = $fresh['body']['token'];
    $pdo->exec('DELETE FROM auth_login_limits');
    for ($n = 0; $n < 10; $n++) {
        check(request('/api/v1/tenants/laverda/auth/login', 'POST', '{"password":"wrong"}')['status'] === 401, 'wrong password rejected');
    }
    check(request('/api/v1/tenants/laverda/auth/login', 'POST', '{"password":"wrong"}')['status'] === 429, 'persistent rate limiting');
    $pdo->exec('DELETE FROM auth_login_limits');
    echo "PASS auth revocation, expiry, password rotation and rate limits\n";
    $pdo->exec('RENAME TABLE places TO places_test_unavailable');
    try {
        check(request('/health')['status'] === 503, 'health fails on missing schema');
        $failure = request('/api/places');
        check($failure['status'] === 500 && $failure['body'] === ['error' => 'internal_server_error'], 'production-safe internal error');
    } finally {
        $pdo->exec('RENAME TABLE places_test_unavailable TO places');
    }
    check(request('/health')['status'] === 200, 'health recovers');
    echo "PASS unlock, CORS, schema readiness, safe errors\n";
    echo "PASS {$checks} assertions (PHP " . PHP_VERSION . "; MariaDB " . $pdo->getAttribute(PDO::ATTR_SERVER_VERSION) . ")\n";
} finally {
    if (is_resource($server)) {
        proc_terminate($server);
        proc_close($server);
    }
    if (is_file($fixture)) {
        unlink($fixture);
    }
    // Keep the server log on failure for diagnosis; it contains no request bodies.
    echo "Test server log: {$log}\n";
}

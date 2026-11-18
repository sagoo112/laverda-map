<?php

declare(strict_types=1);

// Each case gets its own process and temporary API layout. No real credentials,
// private configuration, HTTP server or database are read or modified.
$root = sys_get_temp_dir() . '/laverda-config-' . bin2hex(random_bytes(8));
mkdir($root, 0700, true);
$base = ['DB_HOST' => 'file-host', 'DB_PORT' => '3306', 'DB_NAME' => 'fixture',
    'DB_USER' => 'fixture-user', 'DB_PASSWORD' => "literal '\\ \$password; # value"];
$checks = 0;

function configCase(string $label, ?string $file, array $env, array $server,
    ?array $expected, ?string $error = null): void
{
    global $root, $checks;
    $dir = $root . '/case-' . $checks;
    mkdir($dir . '/src', 0700, true);
    mkdir($dir . '/public', 0700);
    copy(dirname(__DIR__) . '/src/Config.php', $dir . '/src/Config.php');
    if ($file !== null) {
        file_put_contents($dir . '/config.local.php', $file);
    }
    $keys = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
        'APP_PASSWORD', 'CORS_ALLOWED_ORIGIN'];
    $code = '<?php require ' . var_export($dir . '/src/Config.php', true) . ';';
    foreach ($keys as $key) {
        $code .= 'putenv(' . var_export($key, true) . '); unset($_SERVER[' . var_export($key, true) . ']);';
    }
    foreach ($env as $key => $value) {
        $code .= 'putenv(' . var_export($key . '=' . $value, true) . ');';
    }
    $code .= '$_SERVER = ' . var_export($server, true) . ';';
    $code .= '$_GET = ["DB_HOST" => "request-host"];';
    $code .= 'try { echo json_encode(LaverdaApi\\Config::database(), JSON_THROW_ON_ERROR); }'
        . 'catch (Throwable $e) { echo json_encode(["error" => $e->getMessage()]); }';
    $process = proc_open([PHP_BINARY], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes, $dir . '/public');
    if (!is_resource($process)) {
        throw new RuntimeException('Could not start configuration test process.');
    }
    fwrite($pipes[0], $code);
    fclose($pipes[0]);
    $output = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exit = proc_close($process);
    $actual = json_decode($output, true, flags: JSON_THROW_ON_ERROR);
    if ($exit !== 0 || $stderr !== '' || ($error !== null
        ? ($actual['error'] ?? null) !== $error : $actual !== $expected)) {
        throw new RuntimeException('Configuration test failed: ' . $label);
    }
    $checks++;
}

function fixtureFile(array $values): string
{
    return '<?php return ' . var_export($values, true) . ';';
}

$expected = ['host' => $base['DB_HOST'], 'port' => 3306, 'name' => 'fixture',
    'user' => 'fixture-user', 'password' => $base['DB_PASSWORD']];
try {
    configCase('private file and literal special characters from another cwd', fixtureFile($base), [], [], $expected);
    configCase('process environment wins over server and file', fixtureFile($base), ['DB_HOST' => 'env-host'],
        ['DB_HOST' => 'server-host'], array_replace($expected, ['host' => 'env-host']));
    configCase('server values override the file', fixtureFile($base), [], ['DB_USER' => 'server-user'],
        array_replace($expected, ['user' => 'server-user']));
    configCase('request headers are not configuration', fixtureFile($base), [],
        ['HTTP_DB_HOST' => 'header-host'], $expected);
    configCase('empty environment values do not silently fall back', fixtureFile($base), ['DB_NAME' => ''], [],
        null, 'Missing required environment variable: DB_NAME');
    configCase('explicit empty password is preserved', fixtureFile($base), ['DB_PASSWORD' => ''], [],
        array_replace($expected, ['password' => '']));
    configCase('environment-only deployments remain supported', null, $base, [], $expected);
    configCase('missing configuration fails clearly', null, [], [], null,
        'Missing required environment variable: DB_PORT');
    configCase('invalid ports remain rejected', fixtureFile(array_replace($base, ['DB_PORT' => '0'])), [], [], null,
        'DB_PORT must be an integer between 1 and 65535.');
    configCase('invalid file return value', '<?php return false;', [], [], null,
        'Private configuration must return an array.');
    configCase('invalid value types do not leak contents', fixtureFile(array_replace($base, ['DB_PASSWORD' => 123])),
        [], [], null, 'Private configuration contains an unsupported key or non-string value.');
    configCase('unknown keys are rejected without disclosure', fixtureFile($base + ['private-secret-key' => 'value']),
        [], [], null, 'Private configuration contains an unsupported key or non-string value.');
    configCase('syntax errors do not expose password fragments', '<?php return ["DB_PASSWORD" => "secret"broken];',
        [], [], null, 'Private configuration file could not be loaded.');
    echo "PASS {$checks} isolated configuration cases\n";
} finally {
    foreach (glob($root . '/case-*') as $dir) {
        @unlink($dir . '/config.local.php');
        unlink($dir . '/src/Config.php');
        rmdir($dir . '/src');
        rmdir($dir . '/public');
        rmdir($dir);
    }
    rmdir($root);
}

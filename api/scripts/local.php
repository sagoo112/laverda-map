<?php

declare(strict_types=1);

// Windows development helper only. Credentials arrive on stdin, never in URLs/argv.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$input = [];
try {
    $input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
    if (!is_array($input) || ($input['host'] ?? null) !== '127.0.0.1'
        || !is_int($input['port'] ?? null) || $input['port'] < 1024 || $input['port'] > 65535) {
        throw new RuntimeException('Only an explicitly configured local development server is allowed.');
    }
    $pdo = new PDO(
        sprintf('mysql:host=127.0.0.1;port=%d;charset=utf8mb4', $input['port']),
        $input['user'], $input['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 2,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false],
    );
    $action = $argv[1] ?? '';
    $database = $input['database'] ?? '';
    if (!is_string($database) || !preg_match('/\A(?:api_laverda_local|laverda_test_[a-zA-Z0-9_]+)\z/', $database)) {
        throw new RuntimeException('Unexpected local database name.');
    }
    $result = ['status' => 'ok'];
    switch ($action) {
        case 'ping':
            $pdo->query('SELECT 1');
            break;
        case 'provision':
            if ($database !== 'api_laverda_local') {
                throw new RuntimeException('Provisioning is restricted to api_laverda_local.');
            }
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            foreach (['laverda_api_local' => ['runtimePassword', 'SELECT'],
                'laverda_import_local' => ['importPassword', 'SELECT, INSERT, UPDATE']] as $user => [$passwordKey, $rights]) {
                $password = $input[$passwordKey] ?? null;
                if (!is_string($password) || !preg_match('/\A[a-f0-9]{48}\z/', $password)) {
                    throw new RuntimeException('Invalid generated local account password.');
                }
                $account = $pdo->quote($user) . "@'127.0.0.1'";
                $pdo->exec("CREATE USER IF NOT EXISTS $account IDENTIFIED BY " . $pdo->quote($password));
                $pdo->exec("ALTER USER $account IDENTIFIED BY " . $pdo->quote($password));
                $pdo->exec("GRANT $rights ON `$database`.* TO $account");
            }
            break;
        case 'grant-auth':
            if ($database !== 'api_laverda_local') {
                throw new RuntimeException('Auth grants are restricted to the local application database.');
            }
            foreach (['auth_sessions', 'auth_login_limits'] as $table) {
                $pdo->exec("GRANT SELECT, INSERT, UPDATE, DELETE ON `$database`.`$table` TO 'laverda_api_local'@'127.0.0.1'");
            }
            break;
        case 'create-test-database':
            if (!str_starts_with($database, 'laverda_test_')) {
                throw new RuntimeException('A fresh laverda_test_* database is required.');
            }
            // Intentionally no IF NOT EXISTS: an existing test database must never be reused.
            $pdo->exec("CREATE DATABASE `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            break;
        case 'inspect':
            $pdo->exec("USE `$database`");
            $result['version'] = $pdo->getAttribute(PDO::ATTR_SERVER_VERSION);
            $result['places'] = (int) $pdo->query("SELECT COUNT(*) FROM places p JOIN tenants t ON t.id = p.tenant_id WHERE t.slug = 'laverda'")->fetchColumn();
            $result['migrations'] = $pdo->query('SELECT version FROM schema_migrations ORDER BY version')->fetchAll(PDO::FETCH_COLUMN);
            break;
        case 'check-readonly':
            $pdo->exec("USE `$database`");
            try {
                // Even if misconfigured this statement changes no rows.
                $pdo->exec('UPDATE places SET name = name WHERE 1 = 0');
            } catch (PDOException $exception) {
                if (($exception->errorInfo[1] ?? null) === 1142) {
                    $result['readonly'] = true;
                    break;
                }
                throw $exception;
            }
            throw new RuntimeException('The API account unexpectedly has write access.');
        case 'shutdown':
            $pdo->exec('SHUTDOWN');
            break;
        default:
            throw new RuntimeException('Unknown local control action.');
    }
    echo json_encode($result, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $exception) {
    $message = $exception->getMessage();
    foreach (['password', 'runtimePassword', 'importPassword'] as $key) {
        if (is_array($input) && is_string($input[$key] ?? null) && $input[$key] !== '') {
            $message = str_replace($input[$key], '[redacted]', $message);
        }
    }
    fwrite(STDERR, 'Local development command failed: ' . $message . PHP_EOL);
    exit(1);
}

<?php

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
$slug = $argv[1] ?? 'laverda';
if (!preg_match('/^[a-z0-9-]{1,128}$/D', $slug)) {
    fwrite(STDERR, "Invalid tenant slug.\n");
    exit(1);
}
try {
    fwrite(STDERR, "Enter club passphrase (15–72 UTF-8 bytes), then repeat on the next line. Input may be visible in your terminal; never put it in command arguments.\n");
    $password = rtrim((string) fgets(STDIN, 1024), "\r\n");
    $confirmation = rtrim((string) fgets(STDIN, 1024), "\r\n");
    if ($password !== $confirmation) {
        throw new RuntimeException('Passphrases do not match.');
    }
    $hash = LaverdaApi\Auth\ClubAccess::passwordHash($password);
    unset($password, $confirmation);
    if (($argv[2] ?? '') === '--sql') {
        // Slug has a strict allow-list and password_hash never contains SQL quotes.
        echo "START TRANSACTION;\nUPDATE tenants SET access_password_hash = '$hash', auth_version = auth_version + 1 WHERE slug = '$slug';\nDELETE FROM auth_sessions WHERE tenant_id IN (SELECT id FROM tenants WHERE slug = '$slug');\nCOMMIT;\n";
    } else {
        $pdo = LaverdaApi\Database::connect();
        $pdo->beginTransaction();
        $update = $pdo->prepare('UPDATE tenants SET access_password_hash = ?, auth_version = auth_version + 1 WHERE slug = ?');
        $update->execute([$hash, $slug]);
        if ($update->rowCount() !== 1) {
            throw new RuntimeException('Tenant not found; migrate and import first.');
        }
        $pdo->prepare('DELETE FROM auth_sessions WHERE tenant_id IN (SELECT id FROM tenants WHERE slug = ?)')->execute([$slug]);
        $pdo->commit();
        echo "Club password updated; existing sessions revoked.\n";
    }
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}

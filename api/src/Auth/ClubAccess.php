<?php

declare(strict_types=1);

namespace LaverdaApi\Auth;

use PDO;
use RuntimeException;

final class ClubAccess
{
    public const SESSION_SECONDS = 86400;

    public function __construct(private readonly PDO $pdo) {}

    public static function passwordHash(#[\SensitiveParameter] string $password): string
    {
        if (strlen($password) < 15 || strlen($password) > 72 || str_contains($password, "\0")) {
            throw new RuntimeException('Use a club passphrase between 15 and 72 UTF-8 bytes.');
        }
        return password_hash($password, PASSWORD_DEFAULT);
    }

    /** @return array{token: string, expiresAt: string, tenant: string}|null */
    public function login(string $slug, #[\SensitiveParameter] string $password, string $address): ?array
    {
        $now = time();
        $bucket = hash('sha256', $slug . "\0" . $address);
        $limit = $this->pdo->prepare('INSERT INTO auth_login_limits VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE attempts = IF(window_started_at <= ?, 1, attempts + 1),
            window_started_at = IF(window_started_at <= ?, VALUES(window_started_at), window_started_at)');
        $limit->execute([$bucket, $now, $now - 900, $now - 900]);
        $count = $this->pdo->prepare('SELECT attempts FROM auth_login_limits WHERE bucket_key = ?');
        $count->execute([$bucket]);
        if ((int) $count->fetchColumn() > 10) {
            throw new RuntimeException('login_rate_limited');
        }
        $lookup = $this->pdo->prepare('SELECT id, access_password_hash, auth_version FROM tenants
            WHERE slug = ? AND is_active = 1');
        $lookup->execute([$slug]);
        $tenant = $lookup->fetch();
        $hash = is_array($tenant) ? $tenant['access_password_hash'] : null;
        // Perform a real hash comparison even for unknown/unconfigured tenants.
        $candidate = is_string($hash) ? $hash : '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        $verified = password_verify($password, $candidate);
        if (!$verified || !is_string($hash)) {
            return null;
        }
        $token = bin2hex(random_bytes(32));
        $expires = $now + self::SESSION_SECONDS;
        $insert = $this->pdo->prepare('INSERT INTO auth_sessions (token_hash, tenant_id, auth_version, expires_at)
            VALUES (?, ?, ?, ?)');
        $insert->execute([hash('sha256', $token), $tenant['id'], $tenant['auth_version'], $expires]);
        $this->pdo->prepare('DELETE FROM auth_login_limits WHERE bucket_key = ? OR window_started_at < ?')
            ->execute([$bucket, $now - 86400]);
        $this->pdo->prepare('DELETE FROM auth_sessions WHERE expires_at <= ?')->execute([$now]);
        return ['token' => $token, 'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', $expires), 'tenant' => $slug];
    }

    /** @return array{tenant: string, expiresAt: string}|null */
    public function session(string $slug, string $token): ?array
    {
        if (!preg_match('/^[a-f0-9]{64}$/D', $token)) {
            return null;
        }
        $query = $this->pdo->prepare('SELECT s.expires_at FROM auth_sessions s
            JOIN tenants t ON t.id = s.tenant_id AND t.auth_version = s.auth_version
            WHERE s.token_hash = ? AND t.slug = ? AND t.is_active = 1 AND s.expires_at > ?');
        $query->execute([hash('sha256', $token), $slug, time()]);
        $expires = $query->fetchColumn();
        return $expires === false ? null : ['tenant' => $slug, 'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', (int) $expires)];
    }

    public function logout(string $token): void
    {
        $this->pdo->prepare('DELETE FROM auth_sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
    }
}

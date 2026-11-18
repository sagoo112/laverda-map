<?php

declare(strict_types=1);

namespace LaverdaApi\Health;

use LaverdaApi\Database;
use PDO;
use Throwable;

final class HealthCheck
{
    /** @return array{status: string, service: string, apiVersion: string, checkedAt: string, durationMs: float, checks: array<string, array{status: string, durationMs: float|null}>} */
    public static function collect(): array
    {
        $started = hrtime(true);
        $checks = [
            'api' => ['status' => 'pass', 'durationMs' => 0.0],
            'database' => ['status' => 'skipped', 'durationMs' => null],
            'directory' => ['status' => 'skipped', 'durationMs' => null],
            'authentication' => ['status' => 'skipped', 'durationMs' => null],
        ];
        $connectionStarted = hrtime(true);
        try {
            $pdo = Database::connect();
            $pdo->query('SELECT 1')->fetchColumn();
            $checks['database'] = ['status' => 'pass', 'durationMs' => self::elapsed($connectionStarted)];
        } catch (Throwable $error) {
            error_log('API health database check failed: ' . $error->getMessage());
            $checks['database'] = ['status' => 'fail', 'durationMs' => self::elapsed($connectionStarted)];
            return self::report($checks, $started);
        }
        $checks['directory'] = self::probe($pdo, 'directory', [
            'SELECT t.id, p.id, p.type, p.name, p.visibility FROM tenants t LEFT JOIN places p ON p.tenant_id = t.id LIMIT 1',
        ]);
        $checks['authentication'] = self::probe($pdo, 'authentication', [
            'SELECT access_password_hash, auth_version FROM tenants LIMIT 1',
            'SELECT token_hash, tenant_id, auth_version, expires_at FROM auth_sessions LIMIT 1',
            'SELECT bucket_key, window_started_at, attempts FROM auth_login_limits LIMIT 1',
        ]);
        return self::report($checks, $started);
    }

    /** @param list<string> $queries
     * @return array{status: string, durationMs: float}
     */
    private static function probe(PDO $pdo, string $name, array $queries): array
    {
        $started = hrtime(true);
        try {
            foreach ($queries as $sql) {
                // Fetch only to verify access; no row values are added to the public report.
                $pdo->query($sql)->fetch();
            }
            $status = 'pass';
        } catch (Throwable $error) {
            error_log('API health ' . $name . ' check failed: ' . $error->getMessage());
            $status = 'fail';
        }
        return ['status' => $status, 'durationMs' => self::elapsed($started)];
    }

    private static function elapsed(int $started): float
    {
        return round((hrtime(true) - $started) / 1_000_000, 2);
    }

    /** @param array<string, array{status: string, durationMs: float|null}> $checks
     * @return array{status: string, service: string, apiVersion: string, checkedAt: string, durationMs: float, checks: array<string, array{status: string, durationMs: float|null}>}
     */
    private static function report(array $checks, int $started): array
    {
        $ready = count(array_filter($checks, static fn (array $check): bool => $check['status'] !== 'pass')) === 0;
        return [
            'status' => $ready ? 'Healthy' : 'Unhealthy',
            'service' => 'Laverda API',
            'apiVersion' => 'v1',
            'checkedAt' => gmdate('Y-m-d\TH:i:s\Z'),
            'durationMs' => self::elapsed($started),
            'checks' => $checks,
        ];
    }
}

<?php

declare(strict_types=1);

namespace LaverdaApi\Http;

use LaverdaApi\Database;
use Throwable;

final class HealthHandler
{
    public static function handle(): never
    {
        try {
            $pdo = Database::connect();
            // Readiness includes schema access, not merely a reachable database server.
            $pdo->query('SELECT t.id, p.id FROM tenants t LEFT JOIN places p ON p.tenant_id = t.id LIMIT 1')->fetch();
            $pdo->query('SELECT token_hash FROM auth_sessions LIMIT 1')->fetch();
            $pdo->query('SELECT bucket_key FROM auth_login_limits LIMIT 1')->fetch();
            JsonResponse::send(['status' => 'Healthy']);
        } catch (Throwable $exception) {
            error_log('API health check failed: ' . $exception->getMessage());
            JsonResponse::send(['status' => 'Unhealthy'], 503);
        }

    }
}

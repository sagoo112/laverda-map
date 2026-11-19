<?php

declare(strict_types=1);

namespace LaverdaApi\Http;

use LaverdaApi\Config;

final class Router
{
    public static function dispatch(): never
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if ($method === 'OPTIONS') {
            http_response_code(204);
            exit;
        }

        $requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $path = is_string($requestPath) ? '/' . trim($requestPath, '/') : '/';

        if (preg_match('#^/api/v1/tenants/([^/]+)/auth/(login|session|logout)$#', $path, $auth) === 1) {
            AuthHandler::handle(rawurldecode($auth[1]), $auth[2]);
        }

        if ($path === '/auth/unlock') {
            if ($method !== 'POST') {
                header('Allow: POST, OPTIONS');
                JsonResponse::send(['error' => 'method_not_allowed'], 405);
            }

            AuthHandler::handle('laverda', 'login');
        }

        if ($method !== 'GET') {
            header('Allow: GET, OPTIONS');
            JsonResponse::send(['error' => 'method_not_allowed'], 405);
        }

        if ($path === '/health') {
            HealthHandler::handle();
        }

        if ($path === '/api/v1/public/laverda/places' && Config::playTestDirectoryEnabled()) {
            PlacesHandler::handle('laverda', null, true);
        }

        $tenantSlug = null;
        $placeId = null;
        $isCollection = false;

        if (preg_match('#^/api/v1/tenants/([^/]+)/places$#', $path, $matches) === 1) {
            $tenantSlug = rawurldecode($matches[1]);
            $isCollection = true;
        } elseif (preg_match('#^/api/v1/tenants/([^/]+)/places/([^/]+)$#', $path, $matches) === 1) {
            $tenantSlug = rawurldecode($matches[1]);
            $placeId = rawurldecode($matches[2]);
        } elseif ($path === '/api/places') {
            // Compatibility endpoint used by the existing React Native app.
            $tenantSlug = 'laverda';
            $isCollection = true;
        } elseif (preg_match('#^/api/places/([^/]+)$#', $path, $matches) === 1) {
            $tenantSlug = 'laverda';
            $placeId = rawurldecode($matches[1]);
        } else {
            JsonResponse::send(['error' => 'not_found'], 404);
        }


        AuthHandler::requireSession($tenantSlug);
        PlacesHandler::handle($tenantSlug, $placeId, $isCollection);
    }
}

<?php

declare(strict_types=1);

namespace LaverdaApi\Http;

use LaverdaApi\Auth\ClubAccess;
use LaverdaApi\Database;
use RuntimeException;

final class AuthHandler
{
    private static function transport(): void
    {
        $local = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true);
        if (!$local && ($_SERVER['HTTPS'] ?? '') !== 'on' && (int) ($_SERVER['SERVER_PORT'] ?? 0) !== 443) {
            JsonResponse::send(['error' => 'https_required'], 400);
        }
    }

    private static function token(): string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        return preg_match('/^Bearer ([a-f0-9]{64})$/D', $header, $match) === 1 ? $match[1] : '';
    }

    /** @return array{tenant: string, expiresAt: string} */
    public static function requireSession(string $slug): array
    {
        self::transport();
        $token = self::token();
        if ($token === '') {
            header('WWW-Authenticate: Bearer');
            JsonResponse::send(['error' => 'unauthorized'], 401);
        }
        $session = (new ClubAccess(Database::connect()))->session($slug, $token);
        if ($session === null) {
            header('WWW-Authenticate: Bearer');
            JsonResponse::send(['error' => 'unauthorized'], 401);
        }
        return $session;
    }

    public static function handle(string $slug, string $action): never
    {
        if (!preg_match('/^[a-z0-9-]{1,128}$/D', $slug)) {
            JsonResponse::send(['error' => 'not_found'], 404);
        }
        self::transport();
        $expected = $action === 'session' ? 'GET' : 'POST';
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== $expected) {
            header('Allow: ' . $expected . ', OPTIONS');
            JsonResponse::send(['error' => 'method_not_allowed'], 405);
        }
        if ($action === 'session') {
            JsonResponse::send(self::requireSession($slug));
        }
        $access = new ClubAccess(Database::connect());
        if ($action === 'logout') {
            self::requireSession($slug);
            $access->logout(self::token());
            JsonResponse::send(['status' => 'ok']);
        }
        $body = file_get_contents('php://input', length: 4097);
        if ($body !== false && strlen($body) > 4096) {
            JsonResponse::send(['error' => 'request_too_large'], 413);
        }
        try {
            $request = json_decode($body ?: '', true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            JsonResponse::send(['error' => 'invalid_json'], 400);
        }
        $password = is_array($request) ? ($request['password'] ?? null) : null;
        if (!is_string($password) || strlen($password) > 72 || str_contains($password, "\0")) {
            JsonResponse::send(['error' => 'password_required'], 400);
        }
        try {
            $result = $access->login($slug, $password, $_SERVER['REMOTE_ADDR'] ?? 'unknown');
        } catch (RuntimeException $error) {
            if ($error->getMessage() !== 'login_rate_limited') {
                throw $error;
            }
            header('Retry-After: 900');
            JsonResponse::send(['error' => 'too_many_attempts'], 429);
        }
        JsonResponse::send($result ?? ['error' => 'unauthorized'], $result === null ? 401 : 200);
    }
}

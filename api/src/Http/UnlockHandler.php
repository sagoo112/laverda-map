<?php

declare(strict_types=1);

namespace LaverdaApi\Http;

use LaverdaApi\Config;
use JsonException;

/** Compatibility for old clients only; this does not create an authenticated session. */
final class UnlockHandler
{
    public static function handle(): never
    {
        $body = file_get_contents('php://input', length: 4097);
        if ($body !== false && strlen($body) > 4096) {
            JsonResponse::send(['error' => 'request_too_large'], 413);
        }
        try {
            $request = json_decode(
                $body ?: '',
                true,
                flags: JSON_THROW_ON_ERROR,
            );
        } catch (JsonException) {
            JsonResponse::send(['error' => 'invalid_json'], 400);
        }

        $password = is_array($request) ? ($request['password'] ?? null) : null;
        if (!is_string($password)) {
            JsonResponse::send(['error' => 'password_required'], 400);
        }

        if (!hash_equals(Config::appPassword(), $password)) {
            JsonResponse::send(['error' => 'unauthorized'], 401);
        }

        JsonResponse::send(['status' => 'ok']);

    }
}

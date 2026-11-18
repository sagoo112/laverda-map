<?php

declare(strict_types=1);

namespace LaverdaApi\Http;

use LaverdaApi\Config;

final class Cors
{
    public static function apply(): void
    {
        $allowedOrigin = Config::corsAllowedOrigin();
        $requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? null;

        if ($allowedOrigin === '*') {
            header('Access-Control-Allow-Origin: *');
        } else {
            header('Vary: Origin');
            if ($requestOrigin === $allowedOrigin) {
                header('Access-Control-Allow-Origin: ' . $allowedOrigin);
            }
        }

        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Accept, Content-Type, If-None-Match, Authorization');
        header('Access-Control-Expose-Headers: ETag');
        header('Access-Control-Max-Age: 86400');
        header('X-Content-Type-Options: nosniff');

    }
}

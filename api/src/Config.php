<?php

declare(strict_types=1);

namespace LaverdaApi;

use RuntimeException;

final class Config
{
    /** @return array{host: string, port: int, name: string, user: string, password: string} */
    public static function database(): array
    {
        $port = filter_var(self::required('DB_PORT'), FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => 65535],
        ]);

        if ($port === false) {
            throw new RuntimeException('DB_PORT must be an integer between 1 and 65535.');
        }

        return [
            'host' => self::required('DB_HOST'),
            'port' => $port,
            'name' => self::required('DB_NAME'),
            'user' => self::required('DB_USER'),
            'password' => self::required('DB_PASSWORD', allowEmpty: true),
        ];
    }

    public static function corsAllowedOrigin(): string
    {
        return self::optional('CORS_ALLOWED_ORIGIN', '*');
    }

    public static function appPassword(): string
    {
        return self::required('APP_PASSWORD');
    }

    private static function required(string $name, bool $allowEmpty = false): string
    {
        $value = self::value($name);
        if ($value === false || (!$allowEmpty && trim($value) === '')) {
            throw new RuntimeException("Missing required environment variable: {$name}");
        }

        return $value;
    }

    private static function optional(string $name, string $default): string
    {
        $value = self::value($name);
        return $value === false || trim($value) === '' ? $default : trim($value);
    }

    private static function value(string $name): string|false
    {
        $value = getenv($name);
        // Some shared-hosting handlers expose server configuration only through $_SERVER.
        return $value !== false ? $value : (is_string($_SERVER[$name] ?? null) ? $_SERVER[$name] : false);
    }
}

<?php

declare(strict_types=1);

namespace LaverdaApi;

use RuntimeException;

final class Config
{
    /** @var array<string, string>|null */
    private static ?array $fileValues = null;

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

    public static function playTestDirectoryEnabled(): bool
    {
        return self::optional('PLAY_TEST_PUBLIC_DIRECTORY', '0') === '1';
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
        if ($value !== false) {
            return $value;
        }
        if (is_string($_SERVER[$name] ?? null)) {
            return $_SERVER[$name];
        }
        return self::fileValues()[$name] ?? false;
    }

    /** @return array<string, string> */
    private static function fileValues(): array
    {
        if (self::$fileValues !== null) {
            return self::$fileValues;
        }
        // A sibling of public/, never a file selected by a request or working directory.
        $path = dirname(__DIR__) . '/config.local.php';
        if (!file_exists($path)) {
            return self::$fileValues = [];
        }
        if (!is_file($path) || !is_readable($path)) {
            throw new RuntimeException('Private configuration file is not readable.');
        }
        try {
            $values = (static fn (string $file): mixed => require $file)($path);
        } catch (\Throwable) {
            // Syntax errors can contain fragments of a password. Do not log those.
            throw new RuntimeException('Private configuration file could not be loaded.');
        }
        if (!is_array($values)) {
            throw new RuntimeException('Private configuration must return an array.');
        }
        $allowed = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
            'CORS_ALLOWED_ORIGIN', 'APP_PASSWORD', 'PLAY_TEST_PUBLIC_DIRECTORY'];
        foreach ($values as $key => $value) {
            if (!in_array($key, $allowed, true) || !is_string($value)) {
                throw new RuntimeException('Private configuration contains an unsupported key or non-string value.');
            }
        }
        return self::$fileValues = $values;
    }
}

<?php

declare(strict_types=1);

namespace LaverdaApi\Http;

final class JsonResponse
{
    /** @param array<string, mixed> $payload */
    public static function protectedData(array $payload): never
    {
        $json = self::encode($payload);
        $etag = '"' . hash('sha256', $json) . '"';
        // Revalidate on every reuse: visibility and tenant state are checked first.
        header('Cache-Control: private, no-store');
        header('Vary: Authorization', false);
        header('ETag: ' . $etag);
        header('Content-Type: application/json; charset=utf-8');
        $candidates = explode(',', $_SERVER['HTTP_IF_NONE_MATCH'] ?? '');
        foreach ($candidates as $candidate) {
            if (trim($candidate) === '*' || preg_replace('/^W\\//', '', trim($candidate)) === $etag) {
                http_response_code(304);
                exit;
            }
        }
        echo $json;
        exit;
    }

    /** @param array<string, mixed> $payload */
    private static function encode(array $payload): string
    {
        ini_set('serialize_precision', '-1');
        return json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
    }

    /** @param array<string, mixed> $payload */
    public static function send(array $payload, int $status = 200): never
    {
        ini_set('serialize_precision', '-1');
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode(
            $payload,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION,
        );
        exit;
    }
}

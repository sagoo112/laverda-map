<?php

declare(strict_types=1);

namespace LaverdaApi\Health;

final class HealthPage
{
    /** @param array<string, mixed> $report */
    public static function render(array $report, string $nonce, int $httpStatus): string
    {
        ob_start();
        try {
            require __DIR__ . '/page.php';
            return (string) ob_get_contents();
        } finally {
            ob_end_clean();
        }
    }

    public static function prefersHtml(string $accept, ?string $format): bool
    {
        if ($format === 'html' || $format === 'json') {
            return $format === 'html';
        }
        $ranges = [];
        foreach (explode(',', strtolower($accept)) as $range) {
            $parts = array_map('trim', explode(';', $range));
            $quality = 1.0;
            foreach (array_slice($parts, 1) as $parameter) {
                if (str_starts_with($parameter, 'q=')) {
                    $quality = is_numeric(substr($parameter, 2)) ? max(0.0, min(1.0, (float) substr($parameter, 2))) : 0.0;
                }
            }
            $ranges[$parts[0]] = max($ranges[$parts[0]] ?? 0.0, $quality);
        }
        $html = $ranges['text/html'] ?? $ranges['text/*'] ?? 0.0;
        $json = $ranges['application/json'] ?? $ranges['application/*'] ?? $ranges['*/*'] ?? 0.0;
        // Prefer JSON when tied or when a client supplies no explicit HTML preference.
        return $html > $json;
    }
}

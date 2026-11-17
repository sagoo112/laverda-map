<?php

declare(strict_types=1);
// Read-only smoke check. No database writes, passwords or internal diagnostics.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
$base = rtrim($argv[1] ?? '', '/');
if (!filter_var($base, FILTER_VALIDATE_URL) || !in_array(parse_url($base, PHP_URL_SCHEME), ['http', 'https'], true)) {
    fwrite(STDERR, "Usage: php scripts/check-deployment.php https://api.example.org\n");
    exit(1);
}
foreach (['/health' => 200, '/api/v1/tenants/laverda/places' => 200,
    '/api/v1/tenants/unknown-deployment-check/places' => 404] as $path => $expected) {
    $context = stream_context_create(['http' => ['ignore_errors' => true, 'timeout' => 15]]);
    $body = file_get_contents($base . $path, false, $context);
    preg_match('/\\s(\\d{3})\\s/', $http_response_header[0] ?? '', $matches);
    if ($body === false || (int) ($matches[1] ?? 0) !== $expected) {
        throw new RuntimeException('Unexpected response for ' . $path);
    }
    $json = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
    if ($path === '/health' && ($json['status'] ?? null) !== 'Healthy') {
        throw new RuntimeException('API is not ready.');
    }
    if (str_ends_with($path, '/laverda/places') && !is_array($json['entries'] ?? null)) {
        throw new RuntimeException('Invalid places contract.');
    }
    echo "PASS {$path} ({$expected})\n";
}

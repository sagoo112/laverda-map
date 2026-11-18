<?php

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';

use LaverdaApi\Health\HealthPage;

$checks = 0;
foreach ([
    ['', null, false],
    ['*/*', null, false],
    ['application/json', null, false],
    ['text/html,application/xhtml+xml,*/*;q=0.8', null, true],
    ['text/html;q=0.5,application/json;q=0.9', null, false],
    ['text/html;q=0,application/json', null, false],
    ['text/html,application/json', null, false],
    ['text/*;q=0.9,application/json;q=0.5', null, true],
    ['text/html;q=invalid', null, false],
    ['text/html', 'json', false],
    ['application/json', 'html', true],
] as [$accept, $format, $expected]) {
    if (HealthPage::prefersHtml($accept, $format) !== $expected) {
        throw new RuntimeException('Incorrect health content negotiation.');
    }
    $checks++;
}
$report = [
    'status' => 'Healthy', 'service' => 'Laverda API', 'apiVersion' => 'v1',
    'checkedAt' => '2026-11-18T12:00:00Z', 'durationMs' => 1.25,
    'checks' => array_fill_keys(['api', 'database', 'directory', 'authentication'], ['status' => 'pass', 'durationMs' => 0.1]),
];
$html = HealthPage::render($report, 'fixture-nonce', 200);
foreach (['<!doctype html>', 'Alle Systeme bereit', 'data-check="authentication"', 'nonce="fixture-nonce"',
    '/health?format=json', 'checkedAt', 'frame-ancestors'] as $expected) {
    if ($expected === 'frame-ancestors') {
        // This header belongs to the HTTP handler, never an HTML meta-policy.
        if (str_contains($html, $expected)) { throw new RuntimeException('Unexpected meta policy.'); }
    } elseif (!str_contains($html, $expected)) {
        throw new RuntimeException('Missing health page element: ' . $expected);
    }
    $checks++;
}
$report['status'] = 'Unhealthy';
$report['checks']['database'] = ['status' => 'fail', 'durationMs' => 1.0];
$report['checks']['directory'] = ['status' => 'skipped', 'durationMs' => null];
$report['checkedAt'] = '</script><script>alert(1)</script>';
$html = HealthPage::render($report, 'fixture-nonce', 503);
if (!str_contains($html, 'Dienst eingeschränkt') || !str_contains($html, 'Nicht geprüft')
    || str_contains($html, '</script><script>alert(1)</script>') || !str_contains($html, 'HTTP 503')) {
    throw new RuntimeException('Unhealthy page or HTML/JSON escaping failed.');
}
$checks++;
echo "PASS {$checks} health representation and escaping checks\n";

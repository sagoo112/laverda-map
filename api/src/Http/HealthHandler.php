<?php

declare(strict_types=1);

namespace LaverdaApi\Http;

use LaverdaApi\Health\HealthCheck;
use LaverdaApi\Health\HealthPage;

final class HealthHandler
{
    public static function handle(): never
    {
        $report = HealthCheck::collect();
        $status = $report['status'] === 'Healthy' ? 200 : 503;
        header('Vary: Accept', false);
        $format = is_string($_GET['format'] ?? null) ? $_GET['format'] : null;
        if (!HealthPage::prefersHtml($_SERVER['HTTP_ACCEPT'] ?? '', $format)) {
            JsonResponse::send($report, $status);
        }
        $nonce = base64_encode(random_bytes(18));
        $html = HealthPage::render($report, $nonce, $status);
        http_response_code($status);
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        header('Content-Security-Policy: default-src \'none\'; script-src \'nonce-' . $nonce . '\'; style-src \'nonce-' . $nonce . '\'; connect-src \'self\'; base-uri \'none\'; frame-ancestors \'none\'; form-action \'none\'');
        header('Referrer-Policy: no-referrer');
        header('X-Frame-Options: DENY');
        echo $html;
        exit;
    }
}

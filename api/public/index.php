<?php

declare(strict_types=1);

use LaverdaApi\Http\Cors;
use LaverdaApi\Http\JsonResponse;
use LaverdaApi\Http\Router;

error_reporting(E_ALL);
ini_set('display_errors', '0');
require dirname(__DIR__) . '/src/bootstrap.php';
set_exception_handler(static function (Throwable $exception): never {
    error_log(sprintf(
        'Unhandled API error [%s]: %s in %s:%d',
        $exception::class,
        $exception->getMessage(),
        $exception->getFile(),
        $exception->getLine()
    ));
    JsonResponse::send(['error' => 'internal_server_error'], 500);
});
Cors::apply();
Router::dispatch();

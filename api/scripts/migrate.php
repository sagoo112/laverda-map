<?php

declare(strict_types=1);
require dirname(__DIR__) . '/src/bootstrap.php';
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
try {
    $migrator = new LaverdaApi\Migrator(LaverdaApi\Database::connect(), dirname(__DIR__) . '/database');
    echo json_encode(['applied' => $migrator->migrate()], JSON_THROW_ON_ERROR) . PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, 'Migration failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}

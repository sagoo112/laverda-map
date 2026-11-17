<?php

declare(strict_types=1);
use LaverdaApi\Database;
use LaverdaApi\Places\SeedImporter;

require dirname(__DIR__) . '/src/bootstrap.php';
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
try {
    $path = $argv[1] ?? dirname(__DIR__) . '/places.json';
    if (!is_file($path) || !is_readable($path)) {
        throw new RuntimeException('Seed file is not readable.');
    }
    $document = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
    $entries = $document['entries'] ?? null;
    if (!is_array($entries) || !array_is_list($entries) || $entries === []) {
        throw new RuntimeException('Seed contains no entries.');
    }
    $result = (new SeedImporter(Database::connect()))->import($entries);
    echo json_encode($result, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, 'Import failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}

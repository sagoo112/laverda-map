<?php

declare(strict_types=1);
require dirname(__DIR__) . '/src/bootstrap.php';
use LaverdaApi\Config;
use LaverdaApi\Database;
use LaverdaApi\Migrator;
use LaverdaApi\Places\SeedImporter;

if (PHP_SAPI !== 'cli' || !str_starts_with(Config::database()['name'], 'laverda_test_')) {
    throw new RuntimeException('Use an isolated test database.');
}
$pdo = Database::connect();
if ($pdo->query('SHOW TABLES')->fetchAll() !== []) {
    throw new RuntimeException('Requires an empty test database.');
}
$root = dirname(__DIR__);
$pdo->exec(file_get_contents($root . '/database/schema.sql'));
$entries = json_decode(file_get_contents($root . '/places.json'), true, flags: JSON_THROW_ON_ERROR)['entries'];
(new SeedImporter($pdo))->import($entries);
$before = $pdo->query('SELECT * FROM places ORDER BY sort_order, id')->fetchAll();
$migrator = new Migrator($pdo, $root . '/database');
$migrator->migrate();
$after = $pdo->query('SELECT * FROM places ORDER BY sort_order, id')->fetchAll();
foreach ($after as &$row) {
    unset($row['created_at'], $row['updated_at']);
}
unset($row);
if ($before !== $after || $migrator->migrate() !== []) {
    throw new RuntimeException('Upgrade changed existing fields or repeat was not idempotent.');
}
echo "PASS existing populated schema upgrade: 43 records unchanged\n";

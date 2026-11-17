<?php

declare(strict_types=1);
require dirname(__DIR__) . '/src/bootstrap.php';
use LaverdaApi\Places\SeedValidator;

$checks = 0;
function checkUnit(bool $condition, string $message): void
{
    global $checks;
    if (!$condition) {
        throw new RuntimeException($message);
    }
    $checks++;
}
$source = json_decode(file_get_contents(dirname(__DIR__) . '/places.json'), true, flags: JSON_THROW_ON_ERROR)['entries'];
SeedValidator::validate($source);
checkUnit(count(SeedValidator::allocateIds($source)) === 43, 'All seed records retained');
$collision = array_map(static fn ($id) => ['id' => $id], ['x','x','x-2','x']);
checkUnit(array_column(SeedValidator::allocateIds($collision), 'id') === ['x','x-3','x-2','x-4'], 'Reserved ID allocation');
foreach ([['verified' => 'false'], ['priority' => 1.5], ['tags' => [false]], ['type' => 'admin'],
    ['visibility' => 'PUBLIC'], ['lastCheckedAt' => '2026-02-30'], ['location' => ['lat' => 91, 'lng' => 1, 'mode' => 'exact']],
    ['location' => ['lat' => 1, 'lng' => 1, 'mode' => 'invented']], ['location' => ['lat' => 1]]] as $bad) {
    try {
        SeedValidator::validate([array_merge(['id' => 'invalid'], $bad)]);
        $rejected = false;
    } catch (RuntimeException) {
        $rejected = true;
    }
    checkUnit($rejected, 'Malformed seed rejected: ' . json_encode($bad));
}
SeedValidator::validate([['id' => 'nullable', 'verified' => null, 'location' => null, 'tags' => null]]);
checkUnit(true, 'Nullable fields supported');
echo "PASS {$checks} pure importer assertions\n";

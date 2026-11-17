<?php

declare(strict_types=1);

namespace LaverdaApi\Places;

use DateTimeImmutable;
use RuntimeException;

final class SeedValidator
{
    /** @param list<mixed> $entries */
    public static function validate(array $entries): void
    {
        foreach ($entries as $index => $entry) {
            if (!is_array($entry) || !is_string($entry['id'] ?? null) || trim($entry['id']) === '' || strlen($entry['id']) > 200) {
                throw new RuntimeException("Invalid id at entry {$index}.");
            }
            $id = $entry['id'];
            foreach (['type', 'category', 'name', 'description', 'address', 'country', 'url', 'status',
                'visibility', 'linkType', 'lastCheckedAt', 'locationSource', 'navigationUrl'] as $field) {
                if (isset($entry[$field]) && !is_string($entry[$field])) {
                    throw new RuntimeException("Invalid {$field} for {$id}.");
                }
            }
            foreach (['type' => ['club','private','museum','service','blog','forum','registry','shop','event','other'],
                'visibility' => ['public','hidden','private']] as $field => $values) {
                if (isset($entry[$field]) && !in_array($entry[$field], $values, true)) {
                    throw new RuntimeException("Unknown {$field} for {$id}.");
                }
            }
            if (isset($entry['verified']) && !is_bool($entry['verified'])) {
                throw new RuntimeException("Invalid verified for {$id}.");
            }
            if (isset($entry['priority']) && (!is_int($entry['priority']) || $entry['priority'] < -2147483648 || $entry['priority'] > 2147483647)) {
                throw new RuntimeException("Invalid priority for {$id}.");
            }
            if (isset($entry['tags']) && (!is_array($entry['tags']) || !array_is_list($entry['tags']) || array_filter($entry['tags'], static fn ($tag) => !is_string($tag)))) {
                throw new RuntimeException("Invalid tags for {$id}.");
            }
            if (isset($entry['lastCheckedAt'])) {
                $date = DateTimeImmutable::createFromFormat('!Y-m-d', $entry['lastCheckedAt']);
                if (!$date || $date->format('Y-m-d') !== $entry['lastCheckedAt']) {
                    throw new RuntimeException("Invalid date for {$id}.");
                }
            }
            if (isset($entry['location'])) {
                $location = $entry['location'];
                if (!is_array($location) || !isset($location['lat'], $location['lng']) ||
                    !in_array($location['mode'] ?? null, ['exact','approx','country-centroid'], true) ||
                    (isset($location['label']) && !is_string($location['label']))) {
                    throw new RuntimeException("Invalid location for {$id}.");
                }
                self::databaseNumber($location['lat'], $id, 'latitude');
                self::databaseNumber($location['lng'], $id, 'longitude');
            }
        }
    }
    /** @param list<array<string, mixed>> $entries
     *  @return list<array<string, mixed>> */
    public static function allocateIds(array $entries): array
    {
        $reserved = array_fill_keys(array_column($entries, 'id'), true);
        $assigned = [];
        $occurrences = [];
        foreach ($entries as &$entry) {
            $source = $entry['id'];
            $n = ($occurrences[$source] ?? 0) + 1;
            $id = $n === 1 ? $source : "{$source}-{$n}";
            while ($n > 1 && (isset($reserved[$id]) || isset($assigned[$id]))) {
                $id = $source . '-' . ++$n;
            }
            if (strlen($id) > 200) {
                throw new RuntimeException('Allocated ID exceeds database limit.');
            }
            $occurrences[$source] = $n;
            $assigned[$id] = true;
            $entry['id'] = $id;
        }
        unset($entry);
        return $entries;
    }
    public static function databaseNumber(mixed $value, string $sourceId, string $field): ?string
    {
        if ($value === null) {
            return null;
        }
        if ((!is_int($value) && !is_float($value)) || !is_finite((float) $value) ||
            abs($value) > ($field === 'latitude' ? 90 : 180)) {
            throw new RuntimeException("Invalid {$field} for {$sourceId}.");
        }
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION);
    }
}

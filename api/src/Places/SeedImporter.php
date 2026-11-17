<?php

declare(strict_types=1);

namespace LaverdaApi\Places;

use PDO;
use RuntimeException;
use Throwable;

final class SeedImporter
{
    public function __construct(private readonly PDO $pdo)
    {
    }
    /** @param list<array<string, mixed>> $entries
     *  @return array<string, mixed> */
    public function import(array $entries): array
    {
        SeedValidator::validate($entries);
        ini_set('serialize_precision', '-1');
        try {
            $pdo = $this->pdo;
            $pdo->beginTransaction();

            $tenantUpsert = $pdo->prepare(
                'INSERT INTO tenants (slug, name, is_active)
         VALUES (:slug, :name, :is_active)
         ON DUPLICATE KEY UPDATE slug = VALUES(slug)',
            );
            $tenantUpsert->execute([
                'slug' => 'laverda',
                'name' => 'Laverda',
                'is_active' => 1,
            ]);

            $tenantLookup = $pdo->prepare('SELECT id FROM tenants WHERE slug = :slug LIMIT 1');
            $tenantLookup->execute(['slug' => 'laverda']);
            $tenantId = $tenantLookup->fetchColumn();
            if ($tenantId === false) {
                throw new RuntimeException('Could not resolve the laverda tenant after upsert.');
            }

            $placeUpsert = $pdo->prepare(
                'INSERT INTO places (
            tenant_id, id, type, category, name, description, address, country,
            url, status, visibility, verified, link_type, tags_json, priority,
            last_checked_at, latitude, longitude, location_mode, location_label,
            location_source, navigation_url, sort_order
        ) VALUES (
            :tenant_id, :id, :type, :category, :name, :description, :address, :country,
            :url, :status, :visibility, :verified, :link_type, :tags_json, :priority,
            :last_checked_at, :latitude, :longitude, :location_mode, :location_label,
            :location_source, :navigation_url, :sort_order
        ) ON DUPLICATE KEY UPDATE
            type = VALUES(type),
            category = VALUES(category),
            name = VALUES(name),
            description = VALUES(description),
            address = VALUES(address),
            country = VALUES(country),
            url = VALUES(url),
            status = VALUES(status),
            visibility = VALUES(visibility),
            verified = VALUES(verified),
            link_type = VALUES(link_type),
            tags_json = VALUES(tags_json),
            priority = VALUES(priority),
            last_checked_at = VALUES(last_checked_at),
            latitude = VALUES(latitude),
            longitude = VALUES(longitude),
            location_mode = VALUES(location_mode),
            location_label = VALUES(location_label),
            location_source = VALUES(location_source),
            navigation_url = VALUES(navigation_url),
            sort_order = VALUES(sort_order)',
            );

            $duplicateIds = [];
            $allocated = SeedValidator::allocateIds($entries);
            foreach ($allocated as $index => $entry) {
                $sourceId = $entries[$index]['id'];
                $importId = $entry['id'];
                if ($sourceId !== $importId) {
                    $duplicateIds[] = ['source' => $sourceId, 'importedAs' => $importId];
                }
                $location = is_array($entry['location'] ?? null) ? $entry['location'] : null;
                $tags = array_key_exists('tags', $entry) ? $entry['tags'] : null;
                if ($tags !== null && (!is_array($tags) || !array_is_list($tags)
                    || array_filter($tags, static fn ($tag): bool => !is_string($tag)) !== [])) {
                    throw new RuntimeException("Entry {$sourceId} has invalid tags.");
                }
                if (isset($entry['verified']) && !is_bool($entry['verified'])) {
                    throw new RuntimeException("Entry {$sourceId} has invalid verified status.");
                }

                $placeUpsert->execute([
                    'tenant_id' => (int) $tenantId,
                    'id' => $importId,
                    'type' => $entry['type'] ?? null,
                    'category' => $entry['category'] ?? null,
                    'name' => $entry['name'] ?? null,
                    'description' => $entry['description'] ?? null,
                    'address' => $entry['address'] ?? null,
                    'country' => $entry['country'] ?? null,
                    'url' => $entry['url'] ?? null,
                    'status' => $entry['status'] ?? null,
                    'visibility' => $entry['visibility'] ?? null,
                    'verified' => array_key_exists('verified', $entry)
                        ? ($entry['verified'] === null ? null : ((bool) $entry['verified'] ? 1 : 0))
                        : null,
                    'link_type' => $entry['linkType'] ?? null,
                    'tags_json' => $tags === null
                        ? null
                        : json_encode($tags, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    'priority' => $entry['priority'] ?? null,
                    'last_checked_at' => $entry['lastCheckedAt'] ?? null,
                    'latitude' => SeedValidator::databaseNumber($location['lat'] ?? null, $sourceId, 'latitude'),
                    'longitude' => SeedValidator::databaseNumber($location['lng'] ?? null, $sourceId, 'longitude'),
                    'location_mode' => $location['mode'] ?? null,
                    'location_label' => $location['label'] ?? null,
                    'location_source' => $entry['locationSource'] ?? null,
                    'navigation_url' => $entry['navigationUrl'] ?? null,
                    'sort_order' => $index,
                ]);
            }

            $countStatement = $pdo->prepare('SELECT COUNT(*) FROM places WHERE tenant_id = :tenant_id');
            $countStatement->execute(['tenant_id' => (int) $tenantId]);
            $databaseCount = (int) $countStatement->fetchColumn();

            $pdo->commit();


            return ['status' => 'ok', 'tenant' => 'laverda', 'sourceEntries' => count($entries),
                'databaseEntries' => $databaseCount, 'duplicateIds' => $duplicateIds];
        } catch (Throwable $exception) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $exception;
        }
    }
}

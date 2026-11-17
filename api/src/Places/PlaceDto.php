<?php

declare(strict_types=1);

namespace LaverdaApi\Places;

final class PlaceDto
{
    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public static function fromRow(array $row): array
    {
        $tags = null;
        if ($row['tags_json'] !== null) {
            $decodedTags = json_decode((string) $row['tags_json'], true, flags: JSON_THROW_ON_ERROR);
            $tags = is_array($decodedTags) ? array_values($decodedTags) : [];
        }

        $location = null;
        if ($row['latitude'] !== null && $row['longitude'] !== null) {
            $location = [
                'mode' => $row['location_mode'] ?? 'exact',
                'lat' => (float) $row['latitude'],
                'lng' => (float) $row['longitude'],
                'label' => $row['location_label'],
            ];
        }

        return [
            'id' => $row['id'],
            'type' => $row['type'],
            'category' => $row['category'],
            'name' => $row['name'],
            'description' => $row['description'],
            'address' => $row['address'],
            'country' => $row['country'],
            'url' => $row['url'],
            'status' => $row['status'],
            'visibility' => $row['visibility'],
            'verified' => $row['verified'] === null ? null : (bool) $row['verified'],
            'linkType' => $row['link_type'],
            'tags' => $tags,
            'priority' => $row['priority'] === null ? null : (int) $row['priority'],
            'lastCheckedAt' => $row['last_checked_at'],
            'location' => $location,
            'locationSource' => $row['location_source'],
            'navigationUrl' => $row['navigation_url'],
        ];
    }
}

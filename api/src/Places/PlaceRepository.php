<?php

declare(strict_types=1);

namespace LaverdaApi\Places;

use PDO;

final class PlaceRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array<int, array<string, mixed>>|null Null means the tenant does not exist or is inactive.
     */
    public function listPublic(
        string $tenantSlug,
        ?string $type = null,
        ?string $country = null,
        ?string $search = null,
    ): ?array {
        $tenantId = $this->findActiveTenantId($tenantSlug);
        if ($tenantId === null) {
            return null;
        }

        $sql = $this->placeSelect() . '
            WHERE tenant_id = :tenant_id
              AND visibility = :public_visibility';
        $parameters = [
            'tenant_id' => $tenantId,
            'public_visibility' => 'public',
        ];

        if ($type !== null && trim($type) !== '') {
            $sql .= ' AND type = :type';
            $parameters['type'] = trim($type);
        }

        if ($country !== null && trim($country) !== '') {
            $sql .= ' AND country = :country';
            $parameters['country'] = trim($country);
        }

        if ($search !== null && trim($search) !== '') {
            $sql .= " AND (
                COALESCE(name, '') LIKE :search_name ESCAPE '!'
                OR COALESCE(description, '') LIKE :search_description ESCAPE '!'
                OR COALESCE(address, '') LIKE :search_address ESCAPE '!'
                OR COALESCE(country, '') LIKE :search_country ESCAPE '!'
            )";
            // Native PDO prepares require a distinct placeholder for each occurrence.
            $pattern = '%' . strtr(trim($search), ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
            foreach (['name', 'description', 'address', 'country'] as $field) {
                $parameters['search_' . $field] = $pattern;
            }
        }

        $sql .= ' ORDER BY sort_order ASC, id ASC';
        $statement = $this->pdo->prepare($sql);
        $statement->execute($parameters);

        return array_map(PlaceDto::fromRow(...), $statement->fetchAll());
    }

    /** @return array<string, mixed>|null */
    public function findPublic(string $tenantSlug, string $id): ?array
    {
        $tenantId = $this->findActiveTenantId($tenantSlug);
        if ($tenantId === null) {
            return null;
        }

        $statement = $this->pdo->prepare($this->placeSelect() . '
            WHERE tenant_id = :tenant_id
              AND id = :id
              AND visibility = :public_visibility
            LIMIT 1');
        $statement->execute([
            'tenant_id' => $tenantId,
            'id' => $id,
            'public_visibility' => 'public',
        ]);
        $row = $statement->fetch();

        return $row === false ? null : PlaceDto::fromRow($row);
    }

    public function hasActiveTenant(string $tenantSlug): bool
    {
        return $this->findActiveTenantId($tenantSlug) !== null;
    }

    private function findActiveTenantId(string $tenantSlug): ?int
    {
        $statement = $this->pdo->prepare(
            'SELECT id FROM tenants WHERE slug = :slug AND is_active = 1 LIMIT 1',
        );
        $statement->execute(['slug' => strtolower(trim($tenantSlug))]);
        $id = $statement->fetchColumn();

        return $id === false ? null : (int) $id;
    }

    private function placeSelect(): string
    {
        return 'SELECT
            id, type, category, name, description, address, country, url, status,
            visibility, verified, link_type, tags_json, priority, last_checked_at,
            latitude, longitude, location_mode, location_label, location_source,
            navigation_url
        FROM places';
    }

}

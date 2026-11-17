CREATE TABLE IF NOT EXISTS tenants (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(128) NOT NULL,
    name VARCHAR(200) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tenants_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS places (
    tenant_id BIGINT UNSIGNED NOT NULL,
    id VARCHAR(200) COLLATE utf8mb4_bin NOT NULL,
    type VARCHAR(50) NULL,
    category VARCHAR(100) NULL,
    name VARCHAR(500) NULL,
    description TEXT NULL,
    address TEXT NULL,
    country VARCHAR(10) NULL,
    url TEXT NULL,
    status VARCHAR(50) NULL,
    visibility VARCHAR(50) NULL,
    verified TINYINT(1) NULL,
    link_type VARCHAR(50) NULL,
    tags_json LONGTEXT NULL,
    priority INT NULL,
    last_checked_at DATE NULL,
    latitude DOUBLE NULL,
    longitude DOUBLE NULL,
    location_mode VARCHAR(50) NULL,
    location_label TEXT NULL,
    location_source VARCHAR(100) NULL,
    navigation_url TEXT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, id),
    KEY ix_places_public_order (tenant_id, visibility, sort_order),
    KEY ix_places_filters (tenant_id, type, country),
    CONSTRAINT fk_places_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

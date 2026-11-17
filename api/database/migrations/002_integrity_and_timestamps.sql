-- MariaDB DDL auto-commits. Clauses are restartable; repair invalid rows before retrying.
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    ADD COLUMN IF NOT EXISTS updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    ADD CONSTRAINT IF NOT EXISTS ck_tenants_active CHECK (is_active IN (0, 1));
ALTER TABLE places
    ADD COLUMN IF NOT EXISTS created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    ADD COLUMN IF NOT EXISTS updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    ADD CONSTRAINT IF NOT EXISTS ck_places_verified CHECK (verified IS NULL OR verified IN (0, 1)),
    ADD CONSTRAINT IF NOT EXISTS ck_places_tags CHECK (tags_json IS NULL OR (JSON_VALID(tags_json) AND JSON_TYPE(tags_json) = 'ARRAY')),
    ADD CONSTRAINT IF NOT EXISTS ck_places_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL AND location_mode IS NULL) OR
        (latitude IS NOT NULL AND longitude IS NOT NULL AND location_mode IS NOT NULL
         AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
         AND location_mode IN ('exact', 'approx', 'country-centroid'))),
    ADD CONSTRAINT IF NOT EXISTS ck_places_visibility CHECK (visibility IS NULL OR visibility IN ('public', 'hidden', 'private')),
    ADD CONSTRAINT IF NOT EXISTS ck_places_type CHECK (type IS NULL OR type IN ('club','private','museum','service','blog','forum','registry','shop','event','other'));

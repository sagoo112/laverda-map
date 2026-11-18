ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS access_password_hash VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS auth_version BIGINT UNSIGNED NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    tenant_id BIGINT UNSIGNED NOT NULL,
    auth_version BIGINT UNSIGNED NOT NULL,
    expires_at BIGINT UNSIGNED NOT NULL,
    KEY ix_auth_expiry (expires_at),
    CONSTRAINT fk_auth_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_login_limits (
    bucket_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    window_started_at BIGINT UNSIGNED NOT NULL,
    attempts INT UNSIGNED NOT NULL
) ENGINE=InnoDB;

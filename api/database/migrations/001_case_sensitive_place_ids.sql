-- Existing deployments only. Fresh installations already use this definition.
-- Back up the database before any schema change. This does not rewrite IDs.
ALTER TABLE places MODIFY id VARCHAR(200) COLLATE utf8mb4_bin NOT NULL;

-- Ensure audit query indexes exist even on databases where 042 was recorded
-- before the index statements were added. Duplicate-index errors are ignored
-- by the migration runner, so this is safe to re-run on fresh installs too.
CREATE INDEX audit_logs_entity_idx ON audit_logs (entityType, entityId, createdAt(24));
CREATE INDEX audit_logs_created_idx ON audit_logs (createdAt(24));

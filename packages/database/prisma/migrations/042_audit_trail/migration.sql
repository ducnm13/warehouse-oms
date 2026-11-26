ALTER TABLE audit_logs ADD COLUMN entityType VARCHAR(80) NULL;
ALTER TABLE audit_logs ADD COLUMN entityId VARCHAR(80) NULL;
ALTER TABLE audit_logs ADD COLUMN entityCode VARCHAR(120) NULL;
ALTER TABLE audit_logs ADD COLUMN changes TEXT NULL;
CREATE INDEX audit_logs_entity_idx ON audit_logs (entityType, entityId, createdAt(24));
CREATE INDEX audit_logs_created_idx ON audit_logs (createdAt(24));

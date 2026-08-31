ALTER TABLE productionorders
  ADD COLUMN IF NOT EXISTS warehouseId INT NULL,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sourceModule VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS createdBy INT NULL,
  ADD COLUMN IF NOT EXISTS startedAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS startedBy INT NULL,
  ADD COLUMN IF NOT EXISTS completedAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS completedBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelledAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS cancelledBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelReason VARCHAR(500) NULL;

ALTER TABLE productionorders
  ADD INDEX IF NOT EXISTS production_warehouse_idx (warehouseId),
  ADD INDEX IF NOT EXISTS production_status_source_idx (status, sourceModule);

ALTER TABLE productiondetails
  ADD COLUMN IF NOT EXISTS unitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS totalValue DECIMAL(18,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS production_order_materials_v1 (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  packagingId INT NOT NULL,
  plannedQuantity DECIMAL(18,4) NOT NULL,
  actualQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  unitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  totalValue DECIMAL(18,2) NOT NULL DEFAULT 0,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY production_material_unique (orderId, packagingId),
  INDEX production_material_packaging_idx (packagingId),
  CONSTRAINT production_material_order_fk FOREIGN KEY (orderId) REFERENCES productionorders(id) ON DELETE CASCADE,
  CONSTRAINT production_material_packaging_fk FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS production_order_document_links_v1 (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  linkType VARCHAR(50) NOT NULL,
  linkedId BIGINT NOT NULL,
  linkedCode VARCHAR(255) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY production_document_link_unique (orderId, linkType, linkedId),
  INDEX production_document_link_type_idx (orderId, linkType),
  CONSTRAINT production_document_link_order_fk FOREIGN KEY (orderId) REFERENCES productionorders(id) ON DELETE CASCADE
);

INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('production.start', 'Bắt đầu sản xuất', 'production', 'start'),
  ('production.complete', 'Hoàn thành sản xuất', 'production', 'complete'),
  ('production.cancel', 'Hủy lệnh sản xuất', 'production', 'cancel');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('production.start','production.complete','production.cancel')
WHERE r.code IN ('ADMIN','P_MANAGER');
ALTER TABLE inventorytransactions
  ADD COLUMN IF NOT EXISTS documentStatus VARCHAR(30) NOT NULL DEFAULT 'POSTED',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS postedAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS postedBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelledAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS cancelledBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelReason VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS reversalTransactionId INT NULL,
  ADD COLUMN IF NOT EXISTS sourceModule VARCHAR(50) NULL;

UPDATE inventorytransactions
SET documentStatus = 'POSTED'
WHERE documentStatus IS NULL OR documentStatus = '';

ALTER TABLE inventorytransactiondetails
  ADD COLUMN IF NOT EXISTS unitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS totalValue DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE stocktakes
  ADD COLUMN IF NOT EXISTS warehouseId INT NULL,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS completedAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS completedBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelledAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS cancelledBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelReason VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS adjustmentTransactionId INT NULL,
  ADD COLUMN IF NOT EXISTS reversalTransactionId INT NULL;

ALTER TABLE stocktakes
  ADD INDEX IF NOT EXISTS stocktakes_warehouse_idx (warehouseId);

ALTER TABLE stocktakes
  DROP FOREIGN KEY IF EXISTS stocktakes_warehouse_fk;

ALTER TABLE stocktakes
  ADD CONSTRAINT stocktakes_warehouse_fk FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE IF NOT EXISTS inventory_ledger_opening_balances (
  packagingId INT NOT NULL,
  warehouseId INT NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  capturedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (packagingId, warehouseId)
);

INSERT IGNORE INTO inventory_ledger_opening_balances (packagingId, warehouseId, quantity)
SELECT pw.packagingId, pw.warehouseId,
  CAST(COALESCE(pw.stock_quantity, 0) - COALESCE(l.netQuantity, 0) AS DECIMAL(18,4))
FROM productwarehouses pw
LEFT JOIN (
  SELECT packagingId, warehouseId,
    SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END) netQuantity
  FROM inventory_ledger
  GROUP BY packagingId, warehouseId
) l ON l.packagingId = pw.packagingId AND l.warehouseId = pw.warehouseId;

CREATE TABLE IF NOT EXISTS stocktake_document_links_v1 (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  stocktakeId INT NOT NULL,
  linkType VARCHAR(50) NOT NULL,
  linkedId BIGINT NOT NULL,
  linkedCode VARCHAR(255) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY stocktake_link_unique (stocktakeId, linkType, linkedId),
  INDEX stocktake_link_type_idx (stocktakeId, linkType),
  CONSTRAINT stocktake_links_v1_stocktake_fk FOREIGN KEY (stocktakeId) REFERENCES stocktakes(id) ON DELETE CASCADE
);

INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('inventory.post', 'Ghi sổ chứng từ kho', 'inventory', 'post'),
  ('inventory.cancel', 'Hủy chứng từ kho', 'inventory', 'cancel'),
  ('inventory.stocktake', 'Lập và chốt kiểm kê', 'inventory', 'stocktake');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('inventory.post', 'inventory.cancel', 'inventory.stocktake')
WHERE r.code IN ('ADMIN', 'W_MANAGER');
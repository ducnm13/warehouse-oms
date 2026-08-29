ALTER TABLE warehouse_transfers
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sourceModule VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS shippedAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS shippedBy INT NULL,
  ADD COLUMN IF NOT EXISTS receivedAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS receivedBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelledAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS cancelledBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelReason VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS cancellationTransactionId INT NULL;

ALTER TABLE warehouse_transfer_details
  ADD COLUMN IF NOT EXISTS unitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS totalValue DECIMAL(18,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS warehouse_transfer_document_links_v1 (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  transferId INT NOT NULL,
  linkType VARCHAR(50) NOT NULL,
  linkedId BIGINT NOT NULL,
  linkedCode VARCHAR(255) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY warehouse_transfer_link_unique (transferId, linkType, linkedId),
  INDEX warehouse_transfer_link_type_idx (transferId, linkType),
  CONSTRAINT warehouse_transfer_links_v1_transfer_fk FOREIGN KEY (transferId) REFERENCES warehouse_transfers(id) ON DELETE CASCADE
);

INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('transfer.view', 'Xem chuyển kho', 'transfer', 'view'),
  ('transfer.create', 'Lập chuyển kho', 'transfer', 'create'),
  ('transfer.ship', 'Xuất hàng chuyển kho', 'transfer', 'ship'),
  ('transfer.receive', 'Nhận hàng chuyển kho', 'transfer', 'receive'),
  ('transfer.cancel', 'Hủy chuyển kho', 'transfer', 'cancel');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('transfer.view', 'transfer.create', 'transfer.ship', 'transfer.receive', 'transfer.cancel')
WHERE r.code IN ('ADMIN', 'W_MANAGER');
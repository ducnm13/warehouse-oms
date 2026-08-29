ALTER TABLE purchase_documents
  ADD COLUMN IF NOT EXISTS documentStatus VARCHAR(30) NOT NULL DEFAULT 'POSTED',
  ADD COLUMN IF NOT EXISTS paymentIntent VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS postedAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS postedBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelledAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS cancelledBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelReason VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deletedAt DATETIME(3) NULL;

UPDATE purchase_documents
SET documentStatus='POSTED', postedAt=COALESCE(postedAt, STR_TO_DATE(LEFT(createdAt, 23), '%Y-%m-%dT%H:%i:%s.%f')), postedBy=COALESCE(postedBy, createdBy)
WHERE documentStatus IS NULL OR documentStatus='';

CREATE TABLE IF NOT EXISTS inventory_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sourceType VARCHAR(50) NOT NULL,
  sourceId INT NOT NULL,
  sourceLineId INT NULL,
  documentCode VARCHAR(255) NOT NULL,
  direction VARCHAR(20) NOT NULL,
  packagingId INT NOT NULL,
  warehouseId INT NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  unitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  totalValue DECIMAL(18,2) NOT NULL DEFAULT 0,
  reversalOfId BIGINT NULL,
  occurredAt DATETIME(3) NOT NULL,
  createdBy INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX inventory_ledger_item_warehouse_date_idx (packagingId, warehouseId, occurredAt),
  INDEX inventory_ledger_source_idx (sourceType, sourceId),
  INDEX inventory_ledger_reversal_idx (reversalOfId)
);

CREATE TABLE IF NOT EXISTS payable_transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  supplierId INT NOT NULL,
  sourceType VARCHAR(50) NOT NULL,
  sourceId INT NOT NULL,
  sourceCode VARCHAR(255) NOT NULL,
  entryType VARCHAR(30) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  dueDate DATE NULL,
  occurredAt DATETIME(3) NOT NULL,
  reversalOfId BIGINT NULL,
  createdBy INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX payable_supplier_date_idx (supplierId, occurredAt),
  INDEX payable_source_idx (sourceType, sourceId)
);

CREATE TABLE IF NOT EXISTS payment_vouchers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(255) NOT NULL UNIQUE,
  supplierId INT NOT NULL,
  voucherDate DATE NOT NULL,
  method VARCHAR(30) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  direction VARCHAR(30) NOT NULL DEFAULT 'PAYMENT',
  note VARCHAR(500) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'POSTED',
  createdBy INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX payment_voucher_supplier_date_idx (supplierId, voucherDate)
);

CREATE TABLE IF NOT EXISTS payment_voucher_allocations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  paymentVoucherId BIGINT NOT NULL,
  purchaseDocumentId INT NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX payment_allocation_voucher_idx (paymentVoucherId),
  INDEX payment_allocation_purchase_idx (purchaseDocumentId)
);

CREATE TABLE IF NOT EXISTS purchase_document_links_v1 (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  purchaseDocumentId INT NOT NULL,
  linkType VARCHAR(50) NOT NULL,
  linkedId BIGINT NOT NULL,
  linkedCode VARCHAR(255) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY purchase_link_unique (purchaseDocumentId, linkType, linkedId),
  INDEX purchase_link_type_idx (purchaseDocumentId, linkType)
);
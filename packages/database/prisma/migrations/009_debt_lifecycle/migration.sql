ALTER TABLE payment_receipts
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sourceModule VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS postedAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS postedBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelledAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS cancelledBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelReason VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS reversalReceiptId BIGINT NULL;

ALTER TABLE payment_vouchers
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sourceModule VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS postedAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS postedBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelledAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS cancelledBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelReason VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS reversalVoucherId BIGINT NULL;

ALTER TABLE payment_receipts
  ADD INDEX IF NOT EXISTS payment_receipt_status_idx (status, sourceModule);

ALTER TABLE payment_vouchers
  ADD INDEX IF NOT EXISTS payment_voucher_status_idx (status, sourceModule);

ALTER TABLE payment_receipt_allocations
  ADD UNIQUE INDEX IF NOT EXISTS receipt_sales_unique (paymentReceiptId, salesOrderId);

ALTER TABLE payment_voucher_allocations
  ADD UNIQUE INDEX IF NOT EXISTS voucher_purchase_unique (paymentVoucherId, purchaseDocumentId);

ALTER TABLE receivable_transactions
  ADD COLUMN IF NOT EXISTS paymentDocumentId BIGINT NULL,
  ADD INDEX IF NOT EXISTS receivable_payment_document_idx (paymentDocumentId);

ALTER TABLE payable_transactions
  ADD COLUMN IF NOT EXISTS paymentDocumentId BIGINT NULL,
  ADD INDEX IF NOT EXISTS payable_payment_document_idx (paymentDocumentId);

INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('debt.view', 'Xem công nợ và aging', 'debt', 'view'),
  ('debt.cancel', 'Hủy phiếu thu chi', 'debt', 'cancel');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('debt.view','debt.cancel')
WHERE r.code IN ('ADMIN','W_MANAGER','S_SALES');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'debt.view'
WHERE r.code = 'QD';
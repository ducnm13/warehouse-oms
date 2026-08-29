ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS paymentIntent VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS paymentMethod VARCHAR(30) NULL;

ALTER TABLE sales_order_details
  ADD COLUMN IF NOT EXISTS unitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costAmount DECIMAL(18,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS payment_receipts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(255) NOT NULL UNIQUE,
  customerId INT NOT NULL,
  receiptDate DATE NOT NULL,
  method VARCHAR(30) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  direction VARCHAR(30) NOT NULL DEFAULT 'RECEIPT',
  note VARCHAR(500) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'POSTED',
  createdBy INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX payment_receipt_customer_date_idx (customerId, receiptDate)
);

CREATE TABLE IF NOT EXISTS payment_receipt_allocations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  paymentReceiptId BIGINT NOT NULL,
  salesOrderId INT NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX receipt_allocation_receipt_idx (paymentReceiptId),
  INDEX receipt_allocation_sales_idx (salesOrderId)
);

CREATE TABLE IF NOT EXISTS sales_document_links_v1 (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  salesOrderId INT NOT NULL,
  linkType VARCHAR(50) NOT NULL,
  linkedId BIGINT NOT NULL,
  linkedCode VARCHAR(255) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY sales_link_unique (salesOrderId, linkType, linkedId),
  INDEX sales_link_type_idx (salesOrderId, linkType),
  CONSTRAINT sales_links_v1_order_fk FOREIGN KEY (salesOrderId) REFERENCES sales_orders(id) ON DELETE CASCADE
);

INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('sales.post', 'Ghi sổ bán hàng', 'sales', 'post'),
  ('sales.cancel', 'Hủy bán hàng', 'sales', 'cancel');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('sales.post','sales.cancel')
WHERE r.code IN ('ADMIN','S_SALES');
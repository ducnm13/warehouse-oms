CREATE TABLE IF NOT EXISTS sales_returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(255) NOT NULL UNIQUE,
  originalSalesOrderId INT NOT NULL,
  customerId INT NOT NULL,
  warehouseId INT NOT NULL,
  returnDate DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  reason VARCHAR(500) NOT NULL,
  settlementType VARCHAR(30) NOT NULL DEFAULT 'REDUCE_DEBT',
  subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
  taxAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
  totalAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
  costAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  sourceModule VARCHAR(50) NOT NULL DEFAULT 'SALES_RETURN_V1',
  createdBy INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  postedAt DATETIME(3) NULL,
  postedBy INT NULL,
  cancelledAt DATETIME(3) NULL,
  cancelledBy INT NULL,
  cancelReason VARCHAR(500) NULL,
  INDEX sales_return_order_status_idx (originalSalesOrderId, status),
  INDEX sales_return_date_warehouse_idx (returnDate, warehouseId, status),
  CONSTRAINT sales_return_order_fk FOREIGN KEY (originalSalesOrderId) REFERENCES sales_orders(id) ON DELETE RESTRICT,
  CONSTRAINT sales_return_customer_fk FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT sales_return_warehouse_fk FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE RESTRICT,
  CONSTRAINT sales_return_creator_fk FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sales_return_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salesReturnId INT NOT NULL,
  originalSalesOrderLineId INT NOT NULL,
  packagingId INT NOT NULL,
  lineType VARCHAR(30) NOT NULL DEFAULT 'SALE',
  quantity DECIMAL(18,4) NOT NULL,
  unitPrice DECIMAL(18,4) NOT NULL DEFAULT 0,
  lineTotal DECIMAL(18,2) NOT NULL DEFAULT 0,
  taxAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
  unitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  costAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
  note VARCHAR(500) NULL,
  UNIQUE KEY sales_return_line_original_unique (salesReturnId, originalSalesOrderLineId),
  INDEX sales_return_line_original_idx (originalSalesOrderLineId),
  INDEX sales_return_line_item_idx (packagingId),
  CONSTRAINT sales_return_line_header_fk FOREIGN KEY (salesReturnId) REFERENCES sales_returns(id) ON DELETE CASCADE,
  CONSTRAINT sales_return_line_original_fk FOREIGN KEY (originalSalesOrderLineId) REFERENCES sales_order_details(id) ON DELETE RESTRICT,
  CONSTRAINT sales_return_line_item_fk FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sales_return_document_links (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  salesReturnId INT NOT NULL,
  linkType VARCHAR(50) NOT NULL,
  linkedId BIGINT NOT NULL,
  linkedCode VARCHAR(255) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY sales_return_link_unique (salesReturnId, linkType, linkedId),
  INDEX sales_return_link_type_idx (salesReturnId, linkType),
  CONSTRAINT sales_return_link_header_fk FOREIGN KEY (salesReturnId) REFERENCES sales_returns(id) ON DELETE CASCADE
);

INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('sales.return.view', 'Xem trả hàng bán', 'sales.return', 'view'),
  ('sales.return.manage', 'Lập và ghi sổ trả hàng bán', 'sales.return', 'manage'),
  ('sales.return.cancel', 'Hủy trả hàng bán', 'sales.return', 'cancel');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('sales.return.view','sales.return.manage','sales.return.cancel')
WHERE r.code IN ('ADMIN','S_SALES');
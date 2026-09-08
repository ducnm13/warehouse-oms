ALTER TABLE products
  ADD COLUMN IF NOT EXISTS description TEXT NULL,
  ADD COLUMN IF NOT EXISTS primaryUnit VARCHAR(50) NOT NULL DEFAULT 'Cái',
  ADD COLUMN IF NOT EXISTS defaultWarehouseId INT NULL,
  ADD COLUMN IF NOT EXISTS vatRate DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canManageInventory INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS canBePurchased INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS canBeSold INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS canBeProduced INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canBeBomComponent INT NOT NULL DEFAULT 1;

ALTER TABLE products
  ADD INDEX IF NOT EXISTS products_category_active_idx (category, isActive),
  ADD INDEX IF NOT EXISTS products_default_warehouse_idx (defaultWarehouseId);

ALTER TABLE products
  DROP FOREIGN KEY IF EXISTS products_default_warehouse_fk;

ALTER TABLE products
  ADD CONSTRAINT products_default_warehouse_fk FOREIGN KEY (defaultWarehouseId) REFERENCES warehouses(id) ON DELETE SET NULL ON UPDATE RESTRICT;

ALTER TABLE productpackagings
  ADD COLUMN IF NOT EXISTS warehouseId INT NULL,
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS isActive INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deletedAt TEXT NULL;

ALTER TABLE productpackagings
  ADD INDEX IF NOT EXISTS product_packaging_warehouse_idx (warehouseId),
  ADD INDEX IF NOT EXISTS product_packaging_active_idx (productId, isActive);

CREATE TABLE IF NOT EXISTS product_prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packagingId INT NOT NULL,
  priceType VARCHAR(20) NOT NULL,
  price DECIMAL(18,4) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  validFrom TEXT NULL,
  validTo TEXT NULL,
  isActive INT NOT NULL DEFAULT 1,
  UNIQUE KEY product_price_type_unique (packagingId, priceType),
  CONSTRAINT product_price_packaging_fk FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE ON UPDATE RESTRICT
);

ALTER TABLE product_prices
  MODIFY COLUMN price DECIMAL(18,4) NOT NULL DEFAULT 0,
  MODIFY COLUMN currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  MODIFY COLUMN isActive INT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS item_barcodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packagingId INT NOT NULL,
  barcode VARCHAR(100) NOT NULL UNIQUE,
  isPrimary INT NOT NULL DEFAULT 0,
  CONSTRAINT item_barcode_packaging_fk FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE TABLE IF NOT EXISTS company_profiles (
  id INT PRIMARY KEY DEFAULT 1,
  logoUrl VARCHAR(1000) NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  address VARCHAR(1000) NULL,
  taxCode VARCHAR(100) NULL,
  phone VARCHAR(100) NULL,
  email VARCHAR(255) NULL,
  website VARCHAR(255) NULL,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  updatedBy INT NULL,
  CONSTRAINT company_profile_updater_fk FOREIGN KEY (updatedBy) REFERENCES users(id) ON DELETE SET NULL ON UPDATE RESTRICT
);

INSERT IGNORE INTO company_profiles (id, name) VALUES (1, '');

CREATE TABLE IF NOT EXISTS company_signatures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  positionTitle VARCHAR(255) NOT NULL,
  signerTitle VARCHAR(255) NOT NULL,
  signerName VARCHAR(255) NULL,
  displayOrder INT NOT NULL DEFAULT 0,
  isActive INT NOT NULL DEFAULT 1,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

INSERT IGNORE INTO company_signatures (code, positionTitle, signerTitle, displayOrder) VALUES
  ('DIRECTOR', 'Giám đốc', 'Giám đốc', 10),
  ('CHIEF_ACCOUNTANT', 'Kế toán trưởng', 'Kế toán trưởng', 20),
  ('TREASURER', 'Thủ quỹ', 'Thủ quỹ', 30),
  ('WAREHOUSE_KEEPER', 'Thủ kho', 'Thủ kho', 40),
  ('PREPARER', 'Người lập phiếu', 'Người lập phiếu', 50);

CREATE TABLE IF NOT EXISTS company_print_settings (
  id INT PRIMARY KEY DEFAULT 1,
  printSignerNames BOOLEAN NOT NULL DEFAULT FALSE,
  preparerFromLoggedInUser BOOLEAN NOT NULL DEFAULT TRUE,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  updatedBy INT NULL,
  CONSTRAINT company_print_updater_fk FOREIGN KEY (updatedBy) REFERENCES users(id) ON DELETE SET NULL ON UPDATE RESTRICT
);

INSERT IGNORE INTO company_print_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  fullName VARCHAR(255) NOT NULL,
  jobTitle VARCHAR(255) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  workUnit VARCHAR(255) NULL,
  userId INT NULL UNIQUE,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deletedAt DATETIME(3) NULL,
  INDEX employees_status_unit_idx (status, workUnit),
  CONSTRAINT employee_user_fk FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL ON UPDATE RESTRICT
);

CREATE TABLE IF NOT EXISTS customer_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  parentId INT NULL,
  isActive INT NOT NULL DEFAULT 1,
  displayOrder INT NOT NULL DEFAULT 0,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX customer_group_parent_idx (parentId),
  CONSTRAINT customer_group_parent_fk FOREIGN KEY (parentId) REFERENCES customer_groups(id) ON DELETE SET NULL ON UPDATE RESTRICT
);

INSERT IGNORE INTO customer_groups (code, name, displayOrder) VALUES
  ('DISTRIBUTOR', 'Nhà phân phối', 10),
  ('AGENCY', 'Đại lý', 20),
  ('RETAIL', 'Khách lẻ', 30),
  ('INTERNAL_DRIVER', 'Tài xế nội bộ', 40);

INSERT IGNORE INTO customer_groups (code, name, parentId, displayOrder)
SELECT CONCAT('INTERNAL_DRIVER_', team.code), CONCAT('Đội ', team.code), parent.id, team.displayOrder
FROM customer_groups parent
JOIN (
  SELECT 'A' code, 41 displayOrder UNION ALL SELECT 'B', 42 UNION ALL SELECT 'C', 43 UNION ALL
  SELECT 'D', 44 UNION ALL SELECT 'E', 45 UNION ALL SELECT 'H', 46
) team
WHERE parent.code = 'INTERNAL_DRIVER';

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS groupId INT NULL,
  ADD INDEX IF NOT EXISTS customers_group_idx (groupId);

ALTER TABLE customers
  DROP FOREIGN KEY IF EXISTS customers_group_fk;

ALTER TABLE customers
  ADD CONSTRAINT customers_group_fk FOREIGN KEY (groupId) REFERENCES customer_groups(id) ON DELETE SET NULL ON UPDATE RESTRICT;

UPDATE customers c
JOIN customer_groups g ON UPPER(TRIM(c.groupName)) IN (UPPER(g.code), UPPER(g.name))
SET c.groupId = g.id
WHERE c.groupId IS NULL AND c.groupName IS NOT NULL AND c.groupName <> '';

CREATE TABLE IF NOT EXISTS opening_inventory_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(255) NOT NULL UNIQUE,
  documentDate DATE NOT NULL,
  warehouseId INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  note VARCHAR(500) NULL,
  version INT NOT NULL DEFAULT 1,
  createdBy INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  postedAt DATETIME(3) NULL,
  postedBy INT NULL,
  cancelledAt DATETIME(3) NULL,
  cancelledBy INT NULL,
  cancelReason VARCHAR(500) NULL,
  INDEX opening_inventory_date_warehouse_idx (documentDate, warehouseId, status),
  CONSTRAINT opening_inventory_warehouse_fk FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT opening_inventory_creator_fk FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE IF NOT EXISTS opening_inventory_lines (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  documentId INT NOT NULL,
  packagingId INT NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  unitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  totalValue DECIMAL(18,2) NOT NULL DEFAULT 0,
  batchNumber VARCHAR(100) NULL,
  expiryDate DATE NULL,
  note VARCHAR(500) NULL,
  UNIQUE KEY opening_inventory_item_batch_unique (documentId, packagingId, batchNumber),
  INDEX opening_inventory_item_idx (packagingId),
  CONSTRAINT opening_inventory_line_document_fk FOREIGN KEY (documentId) REFERENCES opening_inventory_documents(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT opening_inventory_line_item_fk FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

ALTER TABLE inventorytransactiondetails
  ADD COLUMN IF NOT EXISTS batchNumber VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS expiryDate TEXT NULL,
  ADD COLUMN IF NOT EXISTS productionOrderId INT NULL,
  ADD COLUMN IF NOT EXISTS outputProductId INT NULL,
  ADD INDEX IF NOT EXISTS inventory_detail_batch_expiry_idx (packagingId, batchNumber, expiryDate(10)),
  ADD INDEX IF NOT EXISTS inventory_detail_production_idx (productionOrderId);

CREATE TABLE IF NOT EXISTS inventory_lot_balances (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  packagingId INT NOT NULL,
  warehouseId INT NOT NULL,
  batchNumber VARCHAR(100) NOT NULL,
  expiryDate DATE NULL,
  productionOrderId INT NULL,
  outputProductId INT NULL,
  quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  unitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  totalValue DECIMAL(18,2) NOT NULL DEFAULT 0,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY inventory_lot_unique (packagingId, warehouseId, batchNumber),
  INDEX inventory_lot_expiry_idx (expiryDate, warehouseId),
  INDEX inventory_lot_production_idx (productionOrderId),
  CONSTRAINT inventory_lot_item_fk FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT inventory_lot_warehouse_fk FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT inventory_lot_production_fk FOREIGN KEY (productionOrderId) REFERENCES productionorders(id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT inventory_lot_output_product_fk FOREIGN KEY (outputProductId) REFERENCES products(id) ON DELETE SET NULL ON UPDATE RESTRICT
);

CREATE TABLE IF NOT EXISTS inventory_document_links_v1 (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sourceTransactionId INT NOT NULL,
  targetTransactionId INT NOT NULL,
  linkType VARCHAR(50) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY inventory_document_link_unique (sourceTransactionId, targetTransactionId, linkType),
  INDEX inventory_document_link_target_idx (targetTransactionId, linkType),
  CONSTRAINT inventory_document_link_source_fk FOREIGN KEY (sourceTransactionId) REFERENCES inventorytransactions(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT inventory_document_link_target_fk FOREIGN KEY (targetTransactionId) REFERENCES inventorytransactions(id) ON DELETE CASCADE ON UPDATE RESTRICT
);

INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('catalog.view', 'Xem danh mục vật tư hàng hóa', 'catalog', 'view'),
  ('catalog.manage', 'Quản lý vật tư hàng hóa và giá', 'catalog', 'manage'),
  ('catalog.import', 'Nhập danh mục vật tư hàng hóa từ Excel', 'catalog', 'import'),
  ('company.manage', 'Cấu hình thông tin doanh nghiệp', 'company', 'manage'),
  ('employee.manage', 'Quản lý nhân viên', 'employee', 'manage'),
  ('inventory.opening', 'Nhập và ghi sổ tồn kho đầu', 'inventory', 'opening');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
('catalog.view','catalog.manage','catalog.import','company.manage','employee.manage','inventory.opening')
WHERE r.code = 'ADMIN';

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
('catalog.view','catalog.manage','catalog.import','inventory.opening')
WHERE r.code = 'W_MANAGER';

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'catalog.view'
WHERE r.code IN ('P_MANAGER','S_SALES','QD');
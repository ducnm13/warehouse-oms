CREATE TABLE IF NOT EXISTS assembly_bom_headers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  outputPackagingId INT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  outputQuantity DECIMAL(18,4) NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  note VARCHAR(500) NULL,
  createdBy INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX assembly_bom_output_status_idx (outputPackagingId, status),
  CONSTRAINT assembly_bom_output_fk FOREIGN KEY (outputPackagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS assembly_bom_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bomId INT NOT NULL,
  componentPackagingId INT NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  allocationWeight DECIMAL(18,4) NOT NULL DEFAULT 0,
  note VARCHAR(500) NULL,
  UNIQUE KEY assembly_bom_component_unique (bomId, componentPackagingId),
  INDEX assembly_bom_component_idx (componentPackagingId),
  CONSTRAINT assembly_bom_line_header_fk FOREIGN KEY (bomId) REFERENCES assembly_bom_headers(id) ON DELETE CASCADE,
  CONSTRAINT assembly_bom_line_component_fk FOREIGN KEY (componentPackagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS assembly_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(255) NOT NULL UNIQUE,
  orderDate DATE NOT NULL,
  outputPackagingId INT NOT NULL,
  plannedQuantity DECIMAL(18,4) NOT NULL,
  actualQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  componentWarehouseId INT NOT NULL,
  outputWarehouseId INT NOT NULL,
  bomId INT NOT NULL,
  bomCode VARCHAR(100) NOT NULL,
  bomVersion INT NOT NULL,
  assemblyCost DECIMAL(18,2) NOT NULL DEFAULT 0,
  outputUnitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  outputTotalValue DECIMAL(18,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  note VARCHAR(500) NULL,
  version INT NOT NULL DEFAULT 1,
  sourceModule VARCHAR(50) NOT NULL DEFAULT 'ASSEMBLY_V1',
  createdBy INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  postedAt DATETIME(3) NULL,
  postedBy INT NULL,
  cancelledAt DATETIME(3) NULL,
  cancelledBy INT NULL,
  cancelReason VARCHAR(500) NULL,
  INDEX assembly_order_date_status_idx (orderDate, status),
  INDEX assembly_order_output_idx (outputPackagingId),
  CONSTRAINT assembly_order_output_fk FOREIGN KEY (outputPackagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT,
  CONSTRAINT assembly_order_component_wh_fk FOREIGN KEY (componentWarehouseId) REFERENCES warehouses(id) ON DELETE RESTRICT,
  CONSTRAINT assembly_order_output_wh_fk FOREIGN KEY (outputWarehouseId) REFERENCES warehouses(id) ON DELETE RESTRICT,
  CONSTRAINT assembly_order_bom_fk FOREIGN KEY (bomId) REFERENCES assembly_bom_headers(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS assembly_order_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  componentPackagingId INT NOT NULL,
  plannedQuantity DECIMAL(18,4) NOT NULL,
  actualQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  allocationWeight DECIMAL(18,4) NOT NULL DEFAULT 0,
  unitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  totalValue DECIMAL(18,2) NOT NULL DEFAULT 0,
  note VARCHAR(500) NULL,
  UNIQUE KEY assembly_order_component_unique (orderId, componentPackagingId),
  INDEX assembly_order_line_component_idx (componentPackagingId),
  CONSTRAINT assembly_order_line_order_fk FOREIGN KEY (orderId) REFERENCES assembly_orders(id) ON DELETE CASCADE,
  CONSTRAINT assembly_order_line_component_fk FOREIGN KEY (componentPackagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS assembly_order_document_links (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL, linkType VARCHAR(50) NOT NULL, linkedId BIGINT NOT NULL,
  linkedCode VARCHAR(255) NULL, createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY assembly_document_link_unique (orderId, linkType, linkedId),
  INDEX assembly_document_link_type_idx (orderId, linkType),
  CONSTRAINT assembly_document_link_order_fk FOREIGN KEY (orderId) REFERENCES assembly_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS disassembly_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(255) NOT NULL UNIQUE,
  orderDate DATE NOT NULL,
  sourcePackagingId INT NOT NULL,
  plannedQuantity DECIMAL(18,4) NOT NULL,
  actualQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  sourceWarehouseId INT NOT NULL,
  recoveryWarehouseId INT NOT NULL,
  bomId INT NOT NULL,
  bomCode VARCHAR(100) NOT NULL,
  bomVersion INT NOT NULL,
  sourceUnitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  sourceTotalValue DECIMAL(18,2) NOT NULL DEFAULT 0,
  lossValue DECIMAL(18,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  note VARCHAR(500) NULL,
  version INT NOT NULL DEFAULT 1,
  sourceModule VARCHAR(50) NOT NULL DEFAULT 'DISASSEMBLY_V1',
  createdBy INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  postedAt DATETIME(3) NULL, postedBy INT NULL,
  cancelledAt DATETIME(3) NULL, cancelledBy INT NULL, cancelReason VARCHAR(500) NULL,
  INDEX disassembly_order_date_status_idx (orderDate, status),
  INDEX disassembly_order_source_idx (sourcePackagingId),
  CONSTRAINT disassembly_order_source_fk FOREIGN KEY (sourcePackagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT,
  CONSTRAINT disassembly_order_source_wh_fk FOREIGN KEY (sourceWarehouseId) REFERENCES warehouses(id) ON DELETE RESTRICT,
  CONSTRAINT disassembly_order_recovery_wh_fk FOREIGN KEY (recoveryWarehouseId) REFERENCES warehouses(id) ON DELETE RESTRICT,
  CONSTRAINT disassembly_order_bom_fk FOREIGN KEY (bomId) REFERENCES assembly_bom_headers(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS disassembly_order_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  componentPackagingId INT NOT NULL,
  plannedQuantity DECIMAL(18,4) NOT NULL,
  actualQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  allocationWeight DECIMAL(18,4) NOT NULL DEFAULT 0,
  unitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  totalValue DECIMAL(18,2) NOT NULL DEFAULT 0,
  lossQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  note VARCHAR(500) NULL,
  UNIQUE KEY disassembly_order_component_unique (orderId, componentPackagingId),
  INDEX disassembly_order_line_component_idx (componentPackagingId),
  CONSTRAINT disassembly_order_line_order_fk FOREIGN KEY (orderId) REFERENCES disassembly_orders(id) ON DELETE CASCADE,
  CONSTRAINT disassembly_order_line_component_fk FOREIGN KEY (componentPackagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS disassembly_order_document_links (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL, linkType VARCHAR(50) NOT NULL, linkedId BIGINT NOT NULL,
  linkedCode VARCHAR(255) NULL, createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY disassembly_document_link_unique (orderId, linkType, linkedId),
  INDEX disassembly_document_link_type_idx (orderId, linkType),
  CONSTRAINT disassembly_document_link_order_fk FOREIGN KEY (orderId) REFERENCES disassembly_orders(id) ON DELETE CASCADE
);

INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
 ('assembly.view','Xem lắp ráp và tháo dỡ','assembly','view'),
 ('assembly.manage','Quản lý BOM và lệnh lắp ráp','assembly','manage'),
 ('assembly.post','Ghi sổ lắp ráp và tháo dỡ','assembly','post'),
 ('assembly.cancel','Hủy lắp ráp và tháo dỡ','assembly','cancel');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code IN ('assembly.view','assembly.manage','assembly.post','assembly.cancel')
WHERE r.code IN ('ADMIN','P_MANAGER');
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code='assembly.view' WHERE r.code='QD';
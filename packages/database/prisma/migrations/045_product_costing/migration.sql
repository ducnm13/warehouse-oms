-- Tập hợp chi phí sản xuất & tính giá thành thành phẩm.
-- Chi phí gián tiếp được phân bổ theo kỳ hoặc gán trực tiếp vào lệnh sản xuất.

CREATE TABLE IF NOT EXISTS cost_centers (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'OTHER',
  defaultAllocationMethod VARCHAR(40) NOT NULL DEFAULT 'BY_ACTUAL_QTY',
  description TEXT NULL,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY code (code),
  KEY cost_center_category_active_idx (category, isActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS production_cost_entries (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  costDate DATE NOT NULL,
  periodMonth VARCHAR(7) NULL,
  costCenterId INT NOT NULL,
  warehouseId INT NULL,
  productionOrderId INT NULL,
  incidentId INT NULL,
  amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  allocationMethod VARCHAR(40) NULL,
  note VARCHAR(500) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'POSTED',
  createdBy INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY code (code),
  KEY cost_entry_date_status_idx (costDate, status),
  KEY cost_entry_period_idx (periodMonth),
  KEY cost_entry_center_idx (costCenterId),
  KEY cost_entry_warehouse_idx (warehouseId),
  KEY cost_entry_order_idx (productionOrderId),
  KEY cost_entry_incident_idx (incidentId),
  KEY cost_entry_creator_idx (createdBy),
  CONSTRAINT cost_entry_center_fk FOREIGN KEY (costCenterId) REFERENCES cost_centers (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT cost_entry_warehouse_fk FOREIGN KEY (warehouseId) REFERENCES warehouses (id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT cost_entry_production_order_fk FOREIGN KEY (productionOrderId) REFERENCES productionorders (id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT cost_entry_incident_fk FOREIGN KEY (incidentId) REFERENCES technical_incidents (id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT cost_entry_creator_fk FOREIGN KEY (createdBy) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_cost_sheets (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  fromDate DATE NOT NULL,
  toDate DATE NOT NULL,
  warehouseId INT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  note VARCHAR(500) NULL,
  createdBy INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  postedAt DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY code (code),
  KEY cost_sheet_period_status_idx (fromDate, toDate, status),
  KEY cost_sheet_warehouse_idx (warehouseId),
  KEY cost_sheet_creator_idx (createdBy),
  CONSTRAINT cost_sheet_warehouse_fk FOREIGN KEY (warehouseId) REFERENCES warehouses (id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT cost_sheet_creator_fk FOREIGN KEY (createdBy) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_cost_sheet_lines (
  id INT NOT NULL AUTO_INCREMENT,
  sheetId INT NOT NULL,
  packagingId INT NOT NULL,
  costCenterId INT NULL,
  costComponent VARCHAR(40) NOT NULL,
  actualQty DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  allocatedAmount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  unitCost DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  PRIMARY KEY (id),
  KEY cost_sheet_line_sheet_idx (sheetId),
  KEY cost_sheet_line_packaging_idx (packagingId),
  KEY cost_sheet_line_center_idx (costCenterId),
  CONSTRAINT cost_sheet_line_sheet_fk FOREIGN KEY (sheetId) REFERENCES product_cost_sheets (id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT cost_sheet_line_packaging_fk FOREIGN KEY (packagingId) REFERENCES productpackagings (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT cost_sheet_line_center_fk FOREIGN KEY (costCenterId) REFERENCES cost_centers (id) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO cost_centers (code, name, category, defaultAllocationMethod, description, isActive) VALUES
  ('DIEN_NUOC', 'Điện nước', 'ELECTRIC_WATER', 'BY_POWDER_KG', 'Chi phí điện, nước phục vụ sản xuất', 1),
  ('CONG_NHAN', 'Nhân công sản xuất', 'LABOR', 'BY_ACTUAL_QTY', 'Tiền lương, công nhật và các khoản liên quan đến nhân công sản xuất', 1),
  ('BAO_BI', 'Bao bì & vật tư đóng gói', 'PACKAGING', 'BY_ACTUAL_QTY', 'Bao bì, nhãn mác và vật tư tiêu hao cho đóng gói', 1),
  ('MAY_MOC', 'Khấu hao máy móc thiết bị', 'EQUIPMENT', 'BY_POWDER_KG', 'Khấu hao, bảo trì định kỳ máy móc thiết bị sản xuất', 1),
  ('BAO_DUONG', 'Vật tư bảo dưỡng & sửa chữa', 'MAINTENANCE', 'BY_ACTUAL_QTY', 'Vật tư, phụ tùng thay thế cho bảo dưỡng và sửa chữa', 1);

INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('costing.view', 'Xem chi phí và giá thành sản xuất', 'costing', 'view'),
  ('costing.manage', 'Quản lý chi phí và giá thành sản xuất', 'costing', 'manage');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('costing.view', 'costing.manage')
WHERE r.code IN ('ADMIN', 'FULL_ACCESS');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('costing.view', 'costing.manage')
WHERE r.code = 'P_MANAGER';

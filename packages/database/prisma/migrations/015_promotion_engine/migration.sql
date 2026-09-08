CREATE TABLE IF NOT EXISTS promotion_programs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  startDate DATE NOT NULL,
  endDate DATE NOT NULL,
  customerScope VARCHAR(30) NOT NULL DEFAULT 'ALL',
  customerGroup VARCHAR(255) NULL,
  priority INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  version INT NOT NULL DEFAULT 1,
  note VARCHAR(500) NULL,
  createdBy INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deletedAt DATETIME(3) NULL,
  INDEX promotion_effective_idx (status, startDate, endDate, priority),
  CONSTRAINT promotion_program_creator_fk FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS promotion_conditions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  programId INT NOT NULL,
  conditionType VARCHAR(30) NOT NULL DEFAULT 'BUY_QUANTITY',
  packagingId INT NOT NULL,
  minimumQuantity DECIMAL(18,4) NOT NULL,
  INDEX promotion_condition_program_idx (programId),
  INDEX promotion_condition_item_idx (packagingId),
  CONSTRAINT promotion_condition_program_fk FOREIGN KEY (programId) REFERENCES promotion_programs(id) ON DELETE CASCADE,
  CONSTRAINT promotion_condition_item_fk FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS promotion_rewards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  programId INT NOT NULL,
  rewardType VARCHAR(30) NOT NULL DEFAULT 'FREE_ITEM',
  packagingId INT NOT NULL,
  rewardQuantity DECIMAL(18,4) NOT NULL,
  warehouseId INT NULL,
  INDEX promotion_reward_program_idx (programId),
  INDEX promotion_reward_item_idx (packagingId),
  CONSTRAINT promotion_reward_program_fk FOREIGN KEY (programId) REFERENCES promotion_programs(id) ON DELETE CASCADE,
  CONSTRAINT promotion_reward_item_fk FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT,
  CONSTRAINT promotion_reward_warehouse_fk FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS promotion_usage_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  programId INT NOT NULL,
  salesOrderId INT NOT NULL,
  salesOrderLineId INT NOT NULL,
  rewardPackagingId INT NOT NULL,
  rewardQuantity DECIMAL(18,4) NOT NULL,
  programCode VARCHAR(100) NOT NULL,
  programName VARCHAR(255) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY promotion_usage_line_unique (salesOrderId, salesOrderLineId),
  INDEX promotion_usage_program_idx (programId, createdAt),
  CONSTRAINT promotion_usage_program_fk FOREIGN KEY (programId) REFERENCES promotion_programs(id) ON DELETE RESTRICT,
  CONSTRAINT promotion_usage_order_fk FOREIGN KEY (salesOrderId) REFERENCES sales_orders(id) ON DELETE CASCADE,
  CONSTRAINT promotion_usage_line_fk FOREIGN KEY (salesOrderLineId) REFERENCES sales_order_details(id) ON DELETE CASCADE,
  CONSTRAINT promotion_usage_reward_item_fk FOREIGN KEY (rewardPackagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT
);

ALTER TABLE sales_order_details
  ADD COLUMN IF NOT EXISTS lineType VARCHAR(30) NOT NULL DEFAULT 'SALE',
  ADD COLUMN IF NOT EXISTS promotionProgramId INT NULL,
  ADD COLUMN IF NOT EXISTS promotionCode VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS promotionName VARCHAR(255) NULL,
  ADD INDEX IF NOT EXISTS sales_line_promotion_idx (promotionProgramId, lineType),
  ADD CONSTRAINT sales_line_promotion_fk FOREIGN KEY (promotionProgramId) REFERENCES promotion_programs(id) ON DELETE RESTRICT;

INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('promotion.view', 'Xem chương trình khuyến mãi', 'promotion', 'view'),
  ('promotion.manage', 'Quản lý chương trình khuyến mãi', 'promotion', 'manage');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('promotion.view','promotion.manage')
WHERE r.code IN ('ADMIN','S_SALES');
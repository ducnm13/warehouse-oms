CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  isSystem BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(150) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX permissions_resource_action_idx (resource, action)
);

CREATE TABLE IF NOT EXISTS user_roles (
  userId INT NOT NULL,
  roleId INT NOT NULL,
  assignedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (userId, roleId),
  CONSTRAINT user_roles_user_fk FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_roles_role_fk FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
  INDEX user_roles_role_idx (roleId)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  roleId INT NOT NULL,
  permissionId INT NOT NULL,
  PRIMARY KEY (roleId, permissionId),
  CONSTRAINT role_permissions_role_fk FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT role_permissions_permission_fk FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE,
  INDEX role_permissions_permission_idx (permissionId)
);

INSERT IGNORE INTO roles (code, name, description, isSystem) VALUES
  ('ADMIN', 'Quản trị viên', 'Toàn quyền hệ thống', TRUE),
  ('W_MANAGER', 'Quản lý kho', 'Quản lý kho và mua hàng', TRUE),
  ('P_MANAGER', 'Quản lý sản xuất', 'Quản lý sản xuất', TRUE),
  ('S_SALES', 'Nhân viên bán hàng', 'Bán hàng và công nợ phải thu', TRUE),
  ('QD', 'Ban giám đốc', 'Xem báo cáo và phê duyệt', TRUE);

INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('system.admin', 'Quản trị hệ thống', 'system', 'admin'),
  ('dashboard.view', 'Xem tổng quan', 'dashboard', 'view'),
  ('catalog.view', 'Xem danh mục', 'catalog', 'view'),
  ('purchase.view', 'Xem mua hàng', 'purchase', 'view'),
  ('purchase.create', 'Tạo mua hàng', 'purchase', 'create'),
  ('purchase.post', 'Ghi sổ mua hàng', 'purchase', 'post'),
  ('inventory.view', 'Xem kho', 'inventory', 'view'),
  ('inventory.manage', 'Quản lý kho', 'inventory', 'manage'),
  ('sales.view', 'Xem bán hàng', 'sales', 'view'),
  ('sales.create', 'Tạo bán hàng', 'sales', 'create'),
  ('sales.approve', 'Duyệt bán hàng', 'sales', 'approve'),
  ('debt.receive', 'Thu tiền khách hàng', 'debt', 'receive'),
  ('debt.pay', 'Chi tiền nhà cung cấp', 'debt', 'pay'),
  ('production.view', 'Xem sản xuất', 'production', 'view'),
  ('production.manage', 'Quản lý sản xuất', 'production', 'manage'),
  ('report.view', 'Xem báo cáo', 'report', 'view'),
  ('report.export', 'Xuất báo cáo', 'report', 'export'),
  ('iam.manage', 'Quản lý người dùng và quyền', 'iam', 'manage');

INSERT IGNORE INTO user_roles (userId, roleId)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = u.role WHERE u.role IS NOT NULL;

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'ADMIN';

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
('dashboard.view','catalog.view','purchase.view','purchase.create','purchase.post','inventory.view','inventory.manage','debt.pay','report.view','report.export')
WHERE r.code = 'W_MANAGER';

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
('dashboard.view','catalog.view','inventory.view','production.view','production.manage','report.view','report.export')
WHERE r.code = 'P_MANAGER';

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
('dashboard.view','catalog.view','sales.view','sales.create','sales.approve','debt.receive','report.view')
WHERE r.code = 'S_SALES';

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
('dashboard.view','catalog.view','purchase.view','report.view','report.export')
WHERE r.code = 'QD';
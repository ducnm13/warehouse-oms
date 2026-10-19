-- Bán hàng online (gộp từ dự án SPX): quyền riêng + vai trò riêng để gán cho vài user
INSERT IGNORE INTO roles (code, name, description, isSystem) VALUES
  ('O_SALES', 'Bán hàng online', 'Quản lý đơn hàng online', 0);

INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('online.view', 'Xem bán hàng online', 'online', 'view'),
  ('online.manage', 'Quản lý bán hàng online', 'online', 'manage');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('online.view', 'online.manage')
WHERE r.code = 'ADMIN';

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('online.view', 'online.manage')
WHERE r.code = 'O_SALES';

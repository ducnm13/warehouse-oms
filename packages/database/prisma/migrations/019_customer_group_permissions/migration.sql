INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('customer.view', 'Xem khách hàng và nhóm khách hàng', 'customer', 'view'),
  ('customer.manage', 'Quản lý khách hàng và nhóm khách hàng', 'customer', 'manage');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('customer.view', 'customer.manage')
WHERE r.code = 'ADMIN';

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('customer.view', 'customer.manage')
WHERE r.code IN ('W_MANAGER', 'S_SALES', 'QD');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'customer.view'
WHERE r.code = 'P_MANAGER';

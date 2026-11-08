-- Bổ sung quyền quản lý sản xuất và kho cho quản lý kho (W_MANAGER).
-- INSERT IGNORE để an toàn khi các quyền đã được cấp ở migration trước.
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'production.view', 'production.manage', 'production.start',
  'production.complete', 'production.cancel',
  'inventory.view', 'inventory.manage', 'inventory.post',
  'inventory.cancel', 'inventory.stocktake'
)
WHERE r.code = 'W_MANAGER';

-- Khôi phục quyền thao tác lệnh sản xuất cho quản lý kho.
-- Quản lý kho vẫn bị ẩn màn hình Quản lý sản xuất ở giao diện.
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'production.manage',
  'production.start',
  'production.complete',
  'production.cancel'
)
WHERE r.code = 'W_MANAGER';

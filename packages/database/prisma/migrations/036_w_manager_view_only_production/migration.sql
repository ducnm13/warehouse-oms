-- Quản lý kho chỉ được xem lệnh sản xuất, không được quản lý/điều hành sản xuất.
DELETE rp
FROM role_permissions rp
JOIN roles r ON r.id = rp.roleId
JOIN permissions p ON p.id = rp.permissionId
WHERE r.code = 'W_MANAGER'
  AND p.code IN (
    'production.manage',
    'production.start',
    'production.complete',
    'production.cancel'
  );

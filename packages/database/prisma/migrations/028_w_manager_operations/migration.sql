-- Mở rộng quyền cho thủ kho (W_MANAGER): bán hàng, trả hàng bán, lệnh sản xuất,
-- lắp ráp và tháo dỡ. Các quyền mua hàng, kho (nhập/xuất/kiểm kê/tồn đầu kỳ),
-- danh mục hàng hóa, khách hàng, báo cáo đã được cấp ở các migration trước.
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'sales.view', 'sales.create', 'sales.post', 'sales.cancel',
  'sales.return.view', 'sales.return.manage', 'sales.return.cancel',
  'production.view', 'production.manage', 'production.start',
  'production.complete', 'production.cancel',
  'assembly.view', 'assembly.manage', 'assembly.post', 'assembly.cancel'
)
WHERE r.code = 'W_MANAGER';

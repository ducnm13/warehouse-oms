-- Bảo đảm quản lý kho có quyền xem và xuất các báo cáo vận hành.
-- Báo cáo tài chính, doanh thu, lợi nhuận, công nợ và mua hàng theo giá trị vẫn bị chặn.
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('report.view', 'report.export')
WHERE r.code = 'W_MANAGER';

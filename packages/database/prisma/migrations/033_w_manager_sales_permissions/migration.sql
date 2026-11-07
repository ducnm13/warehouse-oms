-- Bổ sung quyền thu tiền và hủy phiếu thu cho quản lý kho để xử lý thanh toán đơn bán.
-- Các quyền bán hàng, trả hàng bán và khách hàng đã được cấp ở migration 019 và 028.
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'debt.receive', 'debt.receipt.cancel'
)
WHERE r.code = 'W_MANAGER';

UPDATE roles
SET description = 'Quản lý kho, mua hàng và bán hàng'
WHERE code = 'W_MANAGER';

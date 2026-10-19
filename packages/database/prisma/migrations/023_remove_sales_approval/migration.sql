-- Bỏ luồng duyệt đơn bán hàng: đơn chờ duyệt/đã duyệt/từ chối về Nháp,
-- xóa quyền sales.approve khỏi hệ thống.
UPDATE sales_orders
SET status = 'DRAFT',
    rejectionReason = NULL,
    approvedBy = NULL,
    approvedAt = NULL
WHERE status IN ('PENDING', 'APPROVED', 'REJECTED');

DELETE rp FROM role_permissions rp
JOIN permissions p ON p.id = rp.permissionId
WHERE p.code = 'sales.approve';

DELETE FROM permissions WHERE code = 'sales.approve';

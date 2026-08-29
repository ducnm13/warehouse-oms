INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('debt.receipt.cancel', 'Hủy phiếu thu', 'debt', 'receipt.cancel'),
  ('debt.voucher.cancel', 'Hủy phiếu chi', 'debt', 'voucher.cancel');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'debt.receipt.cancel'
WHERE r.code IN ('ADMIN','S_SALES');

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'debt.voucher.cancel'
WHERE r.code IN ('ADMIN','W_MANAGER');
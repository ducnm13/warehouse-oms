INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('production.view', 'production.manage')
WHERE r.code = 'P_MANAGER';

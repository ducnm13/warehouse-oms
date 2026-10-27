-- Bổ sung các quyền còn thiếu cho các chức năng chưa được phân quyền riêng.
INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('audit.view', 'Xem nhật ký hoạt động', 'audit', 'view'),
  ('devtools.use', 'Sử dụng Dev Tools', 'devtools', 'use'),
  ('chat.use', 'Sử dụng tin nhắn nội bộ', 'chat', 'use');

-- ADMIN có đầy đủ các quyền hệ thống, bao gồm nhật ký và Dev Tools.
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('audit.view', 'devtools.use')
WHERE r.code = 'ADMIN';

-- Chat hiện đang mở cho mọi tài khoản, giữ nguyên hành vi bằng cách cấp cho toàn bộ vai trò hiện có.
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'chat.use';

-- Vai trò toàn quyền nghiệp vụ: mọi chức năng, trừ admin (IAM/hệ thống) và Dev Tools.
INSERT IGNORE INTO roles (code, name, description, isSystem) VALUES
  ('FULL_ACCESS', 'Toàn quyền nghiệp vụ', 'Toàn bộ chức năng nghiệp vụ, không gồm quản trị hệ thống, nhật ký hoạt động và Dev Tools', TRUE);

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.resource NOT IN ('system', 'iam', 'audit', 'devtools')
WHERE r.code = 'FULL_ACCESS';

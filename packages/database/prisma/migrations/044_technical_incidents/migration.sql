-- Sự cố kỹ thuật / bảo dưỡng / sửa chữa thiết bị.
-- Ảnh bằng chứng lưu dạng data URL (LONGTEXT) để chạy được trên mọi môi trường
-- mà không cần cấu hình thêm dịch vụ lưu trữ tệp.

CREATE TABLE IF NOT EXISTS technical_incidents (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  equipmentName VARCHAR(255) NULL,
  location VARCHAR(255) NULL,
  category VARCHAR(30) NOT NULL DEFAULT 'REPAIR',
  severity VARCHAR(30) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  occurredAt DATETIME(3) NOT NULL,
  assigneeId INT NULL,
  assigneeName VARCHAR(255) NULL,
  cause TEXT NULL,
  solution TEXT NULL,
  cost DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  note VARCHAR(500) NULL,
  resolvedAt DATETIME(3) NULL,
  createdBy INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deletedAt DATETIME(3) NULL,
  version INT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY code (code),
  KEY technical_incident_time_status_idx (occurredAt, status),
  KEY technical_incident_status_severity_idx (status, severity),
  KEY technical_incident_assignee_idx (assigneeId),
  KEY technical_incident_creator_idx (createdBy),
  CONSTRAINT technical_incident_assignee_fk FOREIGN KEY (assigneeId) REFERENCES employees (id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT technical_incident_creator_fk FOREIGN KEY (createdBy) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS technical_incident_images (
  id INT NOT NULL AUTO_INCREMENT,
  incidentId INT NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  mimeType VARCHAR(100) NOT NULL,
  size INT NOT NULL,
  dataUrl LONGTEXT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY technical_incident_image_incident_idx (incidentId),
  CONSTRAINT technical_incident_image_fk FOREIGN KEY (incidentId) REFERENCES technical_incidents (id) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO permissions (code, name, resource, action) VALUES
  ('technical.view', 'Xem sự cố kỹ thuật', 'technical', 'view'),
  ('technical.manage', 'Quản lý sự cố kỹ thuật', 'technical', 'manage');

-- Quản trị toàn hệ thống và vai trò toàn quyền nghiệp vụ được dùng đầy đủ.
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('technical.view', 'technical.manage')
WHERE r.code IN ('ADMIN', 'FULL_ACCESS');

-- Quản lý sản xuất được quản lý sự cố; quản lý kho chỉ được xem.
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('technical.view', 'technical.manage')
WHERE r.code = 'P_MANAGER';

INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'technical.view'
WHERE r.code = 'W_MANAGER';

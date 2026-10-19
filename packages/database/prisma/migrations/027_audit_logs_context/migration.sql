-- Nhật ký hoạt động chi tiết: lưu IP và thiết bị (user agent) của người thao tác
ALTER TABLE audit_logs ADD COLUMN ipAddress VARCHAR(50) NULL;
ALTER TABLE audit_logs ADD COLUMN userAgent TEXT NULL;

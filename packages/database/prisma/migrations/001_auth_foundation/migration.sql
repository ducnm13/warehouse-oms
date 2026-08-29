CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(100) PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  tokenHash CHAR(64) NOT NULL UNIQUE,
  familyId CHAR(36) NOT NULL,
  expiresAt DATETIME(3) NOT NULL,
  revokedAt DATETIME(3) NULL,
  replacedByHash CHAR(64) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  createdIp VARCHAR(64) NULL,
  userAgent VARCHAR(500) NULL,
  CONSTRAINT refresh_tokens_user_fk FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX refresh_tokens_user_family_idx (userId, familyId),
  INDEX refresh_tokens_expires_idx (expiresAt)
);
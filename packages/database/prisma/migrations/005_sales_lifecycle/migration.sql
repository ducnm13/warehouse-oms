ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS postedAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS postedBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelledAt DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS cancelledBy INT NULL,
  ADD COLUMN IF NOT EXISTS cancelReason VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS deletedAt DATETIME(3) NULL;

CREATE TABLE IF NOT EXISTS receivable_transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customerId INT NOT NULL,
  sourceType VARCHAR(50) NOT NULL,
  sourceId INT NOT NULL,
  sourceCode VARCHAR(255) NOT NULL,
  entryType VARCHAR(30) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  dueDate DATE NULL,
  occurredAt DATETIME(3) NOT NULL,
  reversalOfId BIGINT NULL,
  createdBy INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX receivable_customer_date_idx (customerId, occurredAt),
  INDEX receivable_source_idx (sourceType, sourceId),
  INDEX receivable_reversal_idx (reversalOfId)
);

-- Migration for existing fulfilled orders
UPDATE sales_orders
SET postedAt = STR_TO_DATE(LEFT(fulfilledAt, 23), '%Y-%m-%dT%H:%i:%s.%f'), postedBy = createdBy
WHERE status = 'FULFILLED' AND postedAt IS NULL AND fulfilledAt IS NOT NULL AND fulfilledAt != '';
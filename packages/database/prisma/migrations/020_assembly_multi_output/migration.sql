-- Migration 020: đa thành phẩm cho lệnh lắp ráp / tháo dỡ
CREATE TABLE IF NOT EXISTS assembly_order_outputs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  outputPackagingId INT NOT NULL,
  plannedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  actualQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  unitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  totalValue DECIMAL(18,2) NOT NULL DEFAULT 0,
  note VARCHAR(500) NULL,
  FOREIGN KEY (orderId) REFERENCES assembly_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (outputPackagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT,
  UNIQUE KEY assembly_order_outputs_unique (orderId, outputPackagingId)
);

CREATE TABLE IF NOT EXISTS disassembly_order_sources (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  sourcePackagingId INT NOT NULL,
  plannedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  actualQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  unitCost DECIMAL(18,4) NOT NULL DEFAULT 0,
  totalValue DECIMAL(18,2) NOT NULL DEFAULT 0,
  note VARCHAR(500) NULL,
  FOREIGN KEY (orderId) REFERENCES disassembly_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (sourcePackagingId) REFERENCES productpackagings(id) ON DELETE RESTRICT,
  UNIQUE KEY disassembly_order_sources_unique (orderId, sourcePackagingId)
);

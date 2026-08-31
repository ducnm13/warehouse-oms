ALTER TABLE inventory_ledger
  ADD INDEX IF NOT EXISTS inventory_ledger_reporting_idx (warehouseId, packagingId, occurredAt, direction);

ALTER TABLE sales_orders
  ADD INDEX IF NOT EXISTS sales_reporting_idx (status, orderDate(10), warehouseId);

ALTER TABLE productionorders
  ADD INDEX IF NOT EXISTS production_reporting_idx (sourceModule, status, completedAt);

ALTER TABLE assembly_orders
  ADD INDEX IF NOT EXISTS assembly_reporting_idx (sourceModule, status, postedAt);

ALTER TABLE disassembly_orders
  ADD INDEX IF NOT EXISTS disassembly_reporting_idx (sourceModule, status, postedAt);
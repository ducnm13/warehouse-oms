-- Mốc đồng bộ SPX của từng đơn online (NULL = chưa từng đồng bộ).
ALTER TABLE online_orders ADD COLUMN trackingSyncedAt DATETIME(3) NULL;

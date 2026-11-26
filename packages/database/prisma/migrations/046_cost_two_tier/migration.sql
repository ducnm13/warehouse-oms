-- Tính giá cost 2 tầng: gói sản xuất (tầng 1) → quy cách lắp ráp (tầng 2).
-- Bổ sung liên kết chi phí với lệnh lắp ráp và đánh dấu tầng trên bảng giá thành.

ALTER TABLE production_cost_entries
  ADD COLUMN IF NOT EXISTS assemblyOrderId INT NULL;

ALTER TABLE production_cost_entries
  ADD INDEX IF NOT EXISTS cost_entry_assembly_order_idx (assemblyOrderId);

ALTER TABLE production_cost_entries
  ADD CONSTRAINT IF NOT EXISTS cost_entry_assembly_order_fk
  FOREIGN KEY (assemblyOrderId) REFERENCES assembly_orders (id)
  ON DELETE SET NULL ON UPDATE RESTRICT;

ALTER TABLE product_cost_sheet_lines
  ADD COLUMN IF NOT EXISTS tier VARCHAR(20) NOT NULL DEFAULT 'PACK';

ALTER TABLE product_cost_sheet_lines
  ADD INDEX IF NOT EXISTS cost_sheet_line_tier_idx (sheetId, tier);

-- Vật tư đóng gói dùng riêng cho công đoạn lắp ráp quy cách (hộp, keo dán, thùng).
INSERT IGNORE INTO cost_centers (code, name, category, defaultAllocationMethod, description, isActive) VALUES
  ('HOP_KEO_THUNG', 'Hộp, keo dán & thùng', 'PACKAGING', 'BY_ACTUAL_QTY', 'Hộp, túi, keo dán, thùng carton dùng cho lắp ráp quy cách', 1);

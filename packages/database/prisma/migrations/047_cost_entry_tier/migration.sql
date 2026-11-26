-- Phân tầng chi phí: tầng 1 (gói sản xuất) và tầng 2 (hộp/túi lắp ráp).
-- Nhờ vậy chi phí kỳ không bị phân bổ trùng cho cả hai tầng.

ALTER TABLE production_cost_entries
  ADD COLUMN IF NOT EXISTS costTier VARCHAR(20) NOT NULL DEFAULT 'PACK';

ALTER TABLE production_cost_entries
  ADD INDEX IF NOT EXISTS cost_entry_tier_date_idx (costTier, costDate);

-- Chứng từ đã gắn lệnh lắp ráp luôn thuộc tầng 2.
UPDATE production_cost_entries
SET costTier = 'ASSEMBLY'
WHERE assemblyOrderId IS NOT NULL AND costTier <> 'ASSEMBLY';

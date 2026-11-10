-- Ghi chú cho đơn hàng online.
ALTER TABLE online_orders ADD COLUMN note TEXT NULL AFTER address;

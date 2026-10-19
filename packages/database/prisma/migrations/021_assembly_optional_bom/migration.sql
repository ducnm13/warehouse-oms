-- Migration 021: cho phép lệnh lắp ráp/tháo dỡ dùng BOM danh mục, không bắt BOM riêng
ALTER TABLE assembly_orders MODIFY COLUMN bomId INT NULL;
ALTER TABLE disassembly_orders MODIFY COLUMN bomId INT NULL;

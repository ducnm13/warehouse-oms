-- Nhóm 2: chuyển các cột số lượng / định mức / tỷ lệ từ FLOAT sang DECIMAL.
--
-- Quy ước:
--   * Số lượng, định mức, tỷ lệ quy đổi, đơn giá: DECIMAL(18, 4)
--   * Phần trăm (allocation/loss):                  DECIMAL(5, 2)
--   * Giá trị tồn kho:                              DECIMAL(18, 2)
--
-- LƯU Ý:
--   * Chạy backup trước: npm run db:dump
--   * MySQL làm tròn khi ép kiểu FLOAT -> DECIMAL (ROUND_HALF_UP).

ALTER TABLE `inventory_balances`
  MODIFY COLUMN `quantity` DECIMAL(18, 4) NULL DEFAULT 0.0000,
  MODIFY COLUMN `unitCost` DECIMAL(18, 4) NULL DEFAULT 0.0000,
  MODIFY COLUMN `totalValue` DECIMAL(18, 2) NULL DEFAULT 0.00;

ALTER TABLE `inventorytransactiondetails`
  MODIFY COLUMN `quantity` DECIMAL(18, 4) NOT NULL;

ALTER TABLE `product_boms`
  MODIFY COLUMN `quantity` DECIMAL(18, 4) NULL DEFAULT 0.0000;

ALTER TABLE `productiondetails`
  MODIFY COLUMN `quantity` DECIMAL(18, 4) NULL DEFAULT 0.0000,
  MODIFY COLUMN `actual_quantity` DECIMAL(18, 4) NULL DEFAULT 0.0000,
  MODIFY COLUMN `allocation_percent` DECIMAL(5, 2) NULL DEFAULT 0.00;

ALTER TABLE `productionorders`
  MODIFY COLUMN `total_powder_kg` DECIMAL(18, 4) NULL DEFAULT 0.0000,
  MODIFY COLUMN `loss_percent` DECIMAL(5, 2) NULL DEFAULT 0.00;

ALTER TABLE `productpackagings`
  MODIFY COLUMN `defaultRatio` DECIMAL(18, 4) NULL DEFAULT 0.0000,
  MODIFY COLUMN `netWeight` DECIMAL(18, 4) NULL DEFAULT 0.0000;

ALTER TABLE `products`
  MODIFY COLUMN `netWeight` DECIMAL(18, 4) NULL DEFAULT 0.0000;

ALTER TABLE `productwarehouses`
  MODIFY COLUMN `stock_quantity` DECIMAL(18, 4) NULL DEFAULT 0.0000;

ALTER TABLE `purchase_document_details`
  MODIFY COLUMN `quantity` DECIMAL(18, 4) NOT NULL;

ALTER TABLE `sales_order_details`
  MODIFY COLUMN `quantity` DECIMAL(18, 4) NOT NULL;

ALTER TABLE `stocktake_details`
  MODIFY COLUMN `expected_qty` DECIMAL(18, 4) NULL DEFAULT 0.0000,
  MODIFY COLUMN `actual_qty` DECIMAL(18, 4) NULL DEFAULT 0.0000,
  MODIFY COLUMN `difference` DECIMAL(18, 4) NULL DEFAULT 0.0000;

ALTER TABLE `warehouse_transfer_details`
  MODIFY COLUMN `quantity` DECIMAL(18, 4) NOT NULL;

ALTER TABLE `unit_conversions`
  MODIFY COLUMN `ratio` DECIMAL(18, 4) NOT NULL;

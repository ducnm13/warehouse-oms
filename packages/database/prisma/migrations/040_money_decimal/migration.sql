-- Nhóm 1: chuyển các cột tiền tệ / công nợ từ FLOAT sang DECIMAL.
--
-- Quy ước:
--   * Tiền, thành tiền, công nợ: DECIMAL(18, 2)
--   * Đơn giá:                   DECIMAL(18, 4)
--   * Thuế suất / chiết khấu:    DECIMAL(5, 2)
--
-- LƯU Ý:
--   * Chạy backup trước: npm run db:dump
--   * MySQL làm tròn khi ép kiểu FLOAT -> DECIMAL (ROUND_HALF_UP).
--   * Số lượng / định mức kho chưa đổi trong migration này (Nhóm 2).

ALTER TABLE `customer_payments`
  MODIFY COLUMN `amount` DECIMAL(18, 2) NOT NULL;

ALTER TABLE `supplier_payments`
  MODIFY COLUMN `amount` DECIMAL(18, 2) NOT NULL;

ALTER TABLE `purchase_documents`
  MODIFY COLUMN `goodsAmount` DECIMAL(18, 2) NULL DEFAULT 0.00,
  MODIFY COLUMN `taxAmount` DECIMAL(18, 2) NULL DEFAULT 0.00,
  MODIFY COLUMN `purchaseCost` DECIMAL(18, 2) NULL DEFAULT 0.00,
  MODIFY COLUMN `totalAmount` DECIMAL(18, 2) NULL DEFAULT 0.00,
  MODIFY COLUMN `inventoryValue` DECIMAL(18, 2) NULL DEFAULT 0.00,
  MODIFY COLUMN `paidAmount` DECIMAL(18, 2) NULL DEFAULT 0.00;

ALTER TABLE `purchase_document_details`
  MODIFY COLUMN `unitPrice` DECIMAL(18, 4) NULL DEFAULT 0.0000,
  MODIFY COLUMN `taxRate` DECIMAL(5, 2) NULL DEFAULT 0.00,
  MODIFY COLUMN `lineAmount` DECIMAL(18, 2) NULL DEFAULT 0.00,
  MODIFY COLUMN `taxAmount` DECIMAL(18, 2) NULL DEFAULT 0.00;

ALTER TABLE `sales_order_details`
  MODIFY COLUMN `unitPrice` DECIMAL(18, 4) NULL DEFAULT 0.0000,
  MODIFY COLUMN `discountRate` DECIMAL(5, 2) NULL DEFAULT 0.00,
  MODIFY COLUMN `lineTotal` DECIMAL(18, 2) NULL DEFAULT 0.00;

ALTER TABLE `sales_orders`
  MODIFY COLUMN `subtotal` DECIMAL(18, 2) NULL DEFAULT 0.00,
  MODIFY COLUMN `discountAmount` DECIMAL(18, 2) NULL DEFAULT 0.00,
  MODIFY COLUMN `taxAmount` DECIMAL(18, 2) NULL DEFAULT 0.00,
  MODIFY COLUMN `totalAmount` DECIMAL(18, 2) NULL DEFAULT 0.00,
  MODIFY COLUMN `paidAmount` DECIMAL(18, 2) NULL DEFAULT 0.00;

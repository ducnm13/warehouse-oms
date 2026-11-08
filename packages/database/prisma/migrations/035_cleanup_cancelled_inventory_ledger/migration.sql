-- Dọn bút toán của các phiếu kho thủ công đã hủy.
-- Trước đây hủy phiếu sinh thêm bút toán đảo "Hủy phiếu kho" làm tăng số liệu nhập
-- và có thể để lại chênh lệch nếu ledger gốc bị trùng. Đưa net ledger của phiếu đã
-- hủy về 0 bằng cách hoàn đúng phần net còn lại vào tồn kho, sau đó xóa ledger.
UPDATE productwarehouses pw
JOIN (
  SELECT l.warehouseId, l.packagingId,
    COALESCE(SUM(CASE WHEN l.direction = 'IN' THEN l.quantity ELSE -l.quantity END), 0) net
  FROM inventory_ledger l
  JOIN inventorytransactions it ON it.id = l.sourceId
  WHERE l.sourceType IN ('INVENTORY_DOCUMENT', 'INVENTORY_DOCUMENT_CANCEL')
    AND it.sourceModule = 'MANUAL_V1'
    AND it.documentStatus = 'CANCELLED'
  GROUP BY l.warehouseId, l.packagingId
) x ON x.packagingId = pw.packagingId AND x.warehouseId = pw.warehouseId
SET pw.stock_quantity = pw.stock_quantity - x.net;

DELETE l FROM inventory_ledger l
JOIN inventorytransactions it ON it.id = l.sourceId
WHERE l.sourceType IN ('INVENTORY_DOCUMENT', 'INVENTORY_DOCUMENT_CANCEL')
  AND it.sourceModule = 'MANUAL_V1'
  AND it.documentStatus = 'CANCELLED';

export const mapProduction = (row: any) => ({
  id: row.id, code: row.code, productId: row.productId, productName: row.products?.name,
  warehouseId: row.warehouseId, orderDate: row.order_date, mfgDate: row.mfg_date, expDate: row.exp_date,
  batchNumber: row.batch_number, totalPowderKg: Number(row.total_powder_kg || 0), targetSachets: Number(row.target_sachets || 0),
  totalSachets: Number(row.total_sachets || 0), lossPercent: Number(row.loss_percent || 0), status: row.status,
  version: row.version, startedAt: row.startedAt, completedAt: row.completedAt, cancelledAt: row.cancelledAt, cancelReason: row.cancelReason,
  outputs: (row.productiondetails || []).map((x: any) => ({ id: x.id, packagingId: x.packagingId, packagingName: x.productpackagings?.name, sku: x.productpackagings?.sku, unit: x.productpackagings?.unit, packCount: x.productpackagings?.packCount, plannedQuantity: Number(x.quantity || 0), actualQuantity: Number(x.actual_quantity || 0), allocationPercent: Number(x.allocation_percent || 0), unitCost: Number(x.unitCost || 0), totalValue: Number(x.totalValue || 0), note: x.note })),
  materials: (row.production_order_materials_v1 || []).map((x: any) => ({ id: String(x.id), packagingId: x.packagingId, productName: x.productpackagings?.products?.name, packagingName: x.productpackagings?.name, sku: x.productpackagings?.sku, unit: x.productpackagings?.unit, plannedQuantity: Number(x.plannedQuantity), actualQuantity: Number(x.actualQuantity), unitCost: Number(x.unitCost), totalValue: Number(x.totalValue) })),
  links: (row.production_order_document_links_v1 || []).map((x: any) => ({ id: String(x.id), linkType: x.linkType, linkedId: String(x.linkedId), linkedCode: x.linkedCode })),
});
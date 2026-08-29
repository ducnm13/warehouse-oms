const numberValue = (value: unknown) => Number(value || 0);

export function mapInventoryDocument(document: any) {
  return {
    id: document.id, code: document.code, type: document.type,
    transactionDate: document.transaction_date, warehouseId: document.warehouseId,
    warehouseName: document.warehouses?.name, documentStatus: document.documentStatus,
    version: document.version, recipient: document.recipient, reason: document.reason, note: document.note,
    sourceModule: document.sourceModule, postedAt: document.postedAt, cancelledAt: document.cancelledAt,
    cancelReason: document.cancelReason, creatorName: document.users?.fullName,
    details: (document.inventorytransactiondetails || []).map((line: any) => ({
      id: line.id, packagingId: line.packagingId, quantity: numberValue(line.quantity),
      unitCost: numberValue(line.unitCost), totalValue: numberValue(line.totalValue), note: line.note,
      sku: line.productpackagings?.sku, unit: line.productpackagings?.unit,
      packagingName: line.productpackagings?.name, productName: line.productpackagings?.products?.name,
    })),
  };
}

export function mapStocktake(document: any) {
  return {
    id: document.id, code: document.code, date: document.date, status: document.status,
    warehouseId: document.warehouseId, warehouseName: document.warehouses?.name,
    version: document.version, note: document.note, completedAt: document.completedAt,
    cancelledAt: document.cancelledAt, cancelReason: document.cancelReason,
    creatorName: document.users?.fullName,
    details: (document.stocktake_details || []).map((line: any) => ({
      id: line.id, packagingId: line.packagingId,
      expectedQuantity: numberValue(line.expected_qty), actualQuantity: numberValue(line.actual_qty),
      difference: numberValue(line.difference), sku: line.productpackagings?.sku,
      unit: line.productpackagings?.unit, packagingName: line.productpackagings?.name,
      productName: line.productpackagings?.products?.name,
    })),
    links: (document.stocktake_document_links_v1 || []).map((link: any) => ({
      id: String(link.id), linkType: link.linkType, linkedId: String(link.linkedId), linkedCode: link.linkedCode,
    })),
  };
}
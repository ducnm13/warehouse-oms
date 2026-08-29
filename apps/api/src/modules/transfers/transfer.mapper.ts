const numberValue = (value: unknown) => Number(value || 0);

export function mapTransfer(document: any) {
  return {
    id: document.id,
    code: document.code,
    transferDate: document.transferDate,
    fromWarehouseId: document.fromWarehouseId,
    toWarehouseId: document.toWarehouseId,
    fromWarehouseName: document.warehouses_warehouse_transfers_fromWarehouseIdTowarehouses?.name,
    toWarehouseName: document.warehouses_warehouse_transfers_toWarehouseIdTowarehouses?.name,
    status: document.status,
    version: document.version,
    note: document.note,
    sourceModule: document.sourceModule,
    shippedAt: document.shippedAt,
    receivedAt: document.receivedAt,
    cancelledAt: document.cancelledAt,
    cancelReason: document.cancelReason,
    creatorName: document.users?.fullName,
    details: (document.warehouse_transfer_details || []).map((line: any) => ({
      id: line.id,
      packagingId: line.packagingId,
      quantity: numberValue(line.quantity),
      unitCost: numberValue(line.unitCost),
      totalValue: numberValue(line.totalValue),
      note: line.note,
      sku: line.productpackagings?.sku,
      unit: line.productpackagings?.unit,
      packagingName: line.productpackagings?.name,
      productName: line.productpackagings?.products?.name,
    })),
    links: (document.warehouse_transfer_document_links_v1 || []).map((link: any) => ({
      id: String(link.id), linkType: link.linkType, linkedId: String(link.linkedId), linkedCode: link.linkedCode,
    })),
  };
}
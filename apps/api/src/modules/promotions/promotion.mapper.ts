const n = (value: unknown) => Number(value || 0);
export const mapPromotion = (row: any) => ({
  id: row.id, code: row.code, name: row.name,
  startDate: row.startDate instanceof Date ? row.startDate.toISOString().slice(0, 10) : row.startDate,
  endDate: row.endDate instanceof Date ? row.endDate.toISOString().slice(0, 10) : row.endDate,
  customerScope: row.customerScope, customerGroup: row.customerGroup, priority: row.priority,
  status: row.status, version: row.version, note: row.note, createdAt: row.createdAt, updatedAt: row.updatedAt,
  condition: row.conditions?.[0] ? { id: row.conditions[0].id, packagingId: row.conditions[0].packagingId, minimumQuantity: n(row.conditions[0].minimumQuantity), packagingName: row.conditions[0].packaging?.name, productName: row.conditions[0].packaging?.products?.name, sku: row.conditions[0].packaging?.sku, unit: row.conditions[0].packaging?.unit } : null,
  reward: row.rewards?.[0] ? { id: row.rewards[0].id, packagingId: row.rewards[0].packagingId, rewardQuantity: n(row.rewards[0].rewardQuantity), warehouseId: row.rewards[0].warehouseId, warehouseName: row.rewards[0].warehouse?.name, packagingName: row.rewards[0].packaging?.name, productName: row.rewards[0].packaging?.products?.name, sku: row.rewards[0].packaging?.sku, unit: row.rewards[0].packaging?.unit } : null,
});
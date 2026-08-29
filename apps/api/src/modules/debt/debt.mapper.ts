export const mapPayment = (row: any, kind: "RECEIPT" | "VOUCHER") => ({
  id: String(row.id), code: row.code, kind, partnerId: kind === "RECEIPT" ? row.customerId : row.supplierId,
  partnerCode: row.partnerCode, partnerName: row.partnerName,
  paymentDate: row.paymentDate instanceof Date ? row.paymentDate.toISOString().slice(0, 10) : String(row.paymentDate).slice(0, 10),
  method: row.method, amount: Number(row.amount), direction: row.direction, status: row.status,
  version: row.version, sourceModule: row.sourceModule, note: row.note,
  postedAt: row.postedAt, cancelledAt: row.cancelledAt, cancelReason: row.cancelReason,
  allocations: (row.allocations || []).map((allocation: any) => ({
    id: String(allocation.id), documentId: allocation.documentId, documentCode: allocation.documentCode,
    amount: Number(allocation.amount), totalAmount: Number(allocation.totalAmount || 0), paidAmount: Number(allocation.paidAmount || 0),
  })),
});
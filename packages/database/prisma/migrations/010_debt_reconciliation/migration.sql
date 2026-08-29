INSERT INTO payable_transactions
  (supplierId, sourceType, sourceId, sourceCode, entryType, amount, occurredAt, paymentDocumentId, createdBy)
SELECT p.supplierId, 'PURCHASE_PAYMENT', p.id, p.code, 'PAYMENT', -a.amount,
  COALESCE(v.postedAt, v.createdAt), v.id, v.createdBy
FROM payment_voucher_allocations a
JOIN payment_vouchers v ON v.id = a.paymentVoucherId
JOIN purchase_documents p ON p.id = a.purchaseDocumentId
LEFT JOIN payable_transactions t
  ON t.paymentDocumentId = v.id AND t.sourceId = p.id AND t.entryType = 'PAYMENT'
WHERE v.status = 'POSTED' AND v.direction = 'PAYMENT' AND a.amount > 0 AND t.id IS NULL;
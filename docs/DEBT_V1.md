# Debt Lifecycle V1

## Phạm vi

Debt V1 chuẩn hóa công nợ phải thu/phải trả, aging và phiếu thu/chi độc lập nhiều chứng từ trên ledger hiện có.

```text
Payment Receipt/Voucher: DRAFT → POSTED → CANCELLED
```

Payment do Purchase/Sales tạo trước đây giữ `sourceModule IS NULL`; Debt V1 chỉ quản lý payment có `sourceModule = DEBT_V1`.

## Ledger và projection

- `receivable_transactions`, `payable_transactions` là debt ledger.
- `payment_receipts`, `payment_vouchers` là chứng từ thu/chi.
- Allocation là quan hệ N–N giữa payment và Sales/Purchase documents.
- `paidAmount` và `paymentStatus` trên document nguồn là projection được cập nhật khi payment post/cancel.
- Compatibility tables `customer_payments`, `supplier_payments` vẫn được ghi để API legacy tiếp tục hoạt động.
- `paymentDocumentId` trên debt ledger liên kết chính xác payment/reversal với từng ledger entry.

## Lifecycle

### DRAFT

- Chưa tác động debt ledger hoặc document projection.
- Cho phép sửa đối tác, ngày, phương thức, amount và allocations.
- Tổng allocation bắt buộc bằng amount.
- Một source document không được phân bổ nhiều dòng trong cùng payment.

### POSTED

- Khóa payment và từng source document bằng `FOR UPDATE`.
- Tất cả source documents phải thuộc cùng đối tác với payment.
- Source document phải đã ghi sổ.
- Không cho allocation vượt dư nợ.
- Cập nhật `paidAmount`, `paymentStatus`, document version.
- Tạo PAYMENT ledger âm và compatibility payment row.

### CANCELLED

- Tạo reversal receipt/voucher thực với allocation âm.
- Tạo PAYMENT_REVERSAL ledger, `reversalOfId` trỏ PAYMENT entry gốc.
- Phục hồi `paidAmount/paymentStatus` của từng source document.
- Duplicate post/cancel trả `409`.

## Aging

- API aging đọc trực tiếp tổng ledger theo source document.
- Bucket: chưa quá hạn, 1–30, 31–60, 61–90 và trên 90 ngày.
- Hỗ trợ filter đối tác, từ khóa và ngày `asOf`.
- Migration `010_debt_reconciliation` backfill payable PAYMENT ledger còn thiếu từ voucher allocations legacy/V1 đã posted.

## Source cancellation guard

Sales/Purchase cancellation trả `409 DEBT_PAYMENT_EXISTS` nếu source document còn payment Debt V1 `POSTED`. Người dùng phải hủy payment trước, sau đó mới hủy source document; tránh đảo nhầm payment N–N dùng chung.

## API

- `GET /api/v1/debt/receivables`
- `GET /api/v1/debt/payables`
- CRUD/list/post/cancel `/api/v1/debt/receipts`
- CRUD/list/post/cancel `/api/v1/debt/vouchers`

## RBAC

- `debt.view`: ADMIN, W_MANAGER, S_SALES, QD.
- `debt.receive`: ADMIN, S_SALES.
- `debt.pay`: ADMIN, W_MANAGER.
- `debt.receipt.cancel`: ADMIN, S_SALES.
- `debt.voucher.cancel`: ADMIN, W_MANAGER.
- QD chỉ xem aging/payment, UI không hiển thị action.

## Migration

- `009_debt_lifecycle`: lifecycle metadata, indexes, allocation uniqueness, `paymentDocumentId`, base permissions.
- `010_debt_reconciliation`: backfill payable payment ledger còn thiếu.
- `011_debt_permission_split`: tách quyền hủy phiếu thu và phiếu chi.

Ba migration đã applied và có marker trong `schema_migrations`.

## UI

Trang Công nợ V1 có bốn tab:

- Phải thu.
- Phải trả.
- Phiếu thu.
- Phiếu chi.

Form payment chọn đối tác từ aging, chọn nhiều source documents và nhập allocation. Tổng phiếu được tính từ allocations. Action UI được ẩn/disable theo role và backend vẫn kiểm tra permission độc lập.

## Integration verification ngày 29/08/2026

Đã chạy 29 assertions qua HTTP API và database thật:

- Aging phải thu/phải trả đọc đúng ledger charge.
- Receipt/voucher draft không thay đổi projection.
- Một receipt phân bổ hai Sales documents.
- Một voucher phân bổ hai Purchase documents.
- Post cập nhật cả hai source projections và tạo hai PAYMENT ledger entries.
- Duplicate post trả `409`.
- Over-allocation trả `409 ALLOCATION_EXCEEDS_DEBT` và rollback.
- Partner mismatch trả `409 PARTNER_MISMATCH`.
- Source Sales/Purchase cancellation bị guard khi payment V1 posted.
- Cancel tạo reversal payment/allocation/ledger và phục hồi projection.
- Reversal ledger có `reversalOfId`.
- Duplicate cancel trả `409`.
- Aging trở về baseline sau cancellation.
- Fixture customer/supplier/Sales/Purchase/payment/ledger/audit và refresh token đã cleanup.
- Payable payment reconciliation không còn missing ledger entry.

## Static/build verification

- Prisma schema validation: exit code `0`.
- Prisma Client generation 6.19.2: exit code `0`.
- TypeScript frontend/root, API, contracts và database: exit code `0`.
- Production build: exit code `0`, transform 2.822 modules và tạo `dist/index.html` trong 9,58 giây.
- Production bundle chứa trang Công nợ V1 và endpoint `/api/v1/debt/receivables`.
- Cảnh báo chunk lớn hơn 500 kB còn tồn tại nhưng không phải build error.
- API port `3000` được dừng; MariaDB port `3306` tiếp tục hoạt động.
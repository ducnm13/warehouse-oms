# Phase 4 — Sales Lifecycle v1

## Trạng thái

Hoàn thành vertical slice bán hàng v1 trên schema legacy theo strangler pattern.

API v1 dùng trạng thái `POSTED`; database tiếp tục lưu `FULFILLED` cho chứng từ đã ghi sổ để Dashboard và API legacy không đổi hành vi. Mapper v1 chuyển `FULFILLED → POSTED` tại boundary.

## Đã hoàn thành

- Vòng đời `DRAFT → PENDING → APPROVED → POSTED → CANCELLED`.
- Nhánh từ chối `PENDING → REJECTED`; đơn bị từ chối có thể sửa và gửi duyệt lại.
- Optimistic locking bằng `version` cho mọi action.
- Validation Zod dùng chung tại `packages/contracts`.
- API controller/service/repository tại `/api/v1/sales-documents`.
- Permission backend theo action: create, approve, post, receive payment và cancel.
- Post trong một database transaction:
  - Khóa đơn và balance từng mặt hàng/kho.
  - Không cho xuất vượt tồn.
  - Tạo phiếu xuất tương thích legacy.
  - Giảm projection `productwarehouses`.
  - Ghi immutable inventory ledger `OUT`.
  - Snapshot `unitCost` và `costAmount` trên dòng bán.
  - Ghi receivable `CHARGE`.
  - Nếu thu ngay: tạo phiếu thu, allocation, receivable `PAYMENT` và payment legacy compatibility.
- Thu tiền sau post có kiểm tra không vượt dư nợ và optimistic locking.
- Cancel trong một database transaction:
  - Chỉ tự động đảo chứng từ đã post qua v1 và có ledger link.
  - Tạo phiếu hoàn nhập và inventory ledger `IN` tham chiếu entry gốc.
  - Hoàn nguyên tồn kho.
  - Tạo receivable reversal.
  - Nếu đã thu tiền: cancel phiếu thu gốc, tạo phiếu thu reversal, allocation âm, payment reversal và compatibility entry âm.
- Audit log cho create/update/submit/approve/reject/post/payment/cancel.
- UI `SalesOrdersV1` dùng TanStack Query, React Hook Form và Zod.
- Giữ xuất Excel theo `donhang_template.xlsx` qua endpoint template legacy.
- Swagger đã bổ sung endpoint bán hàng v1.

## Migration

- `006_sales_posting`:
  - `paymentIntent`, `paymentMethod` trên `sales_orders`.
  - Snapshot `unitCost`, `costAmount` trên `sales_order_details`.
  - `payment_receipts`, `payment_receipt_allocations`.
  - `sales_document_links_v1`.
  - Permission `sales.post`, `sales.cancel`.

Migration `005_sales_lifecycle` đã áp dụng trước đó không bị sửa.

## Integration test

Luồng đã chạy qua HTTP API thật:

- Create draft: `201`.
- Submit: `DRAFT → PENDING`.
- Approve: `PENDING → APPROVED`.
- Post: `APPROVED → POSTED`; tồn giảm đúng `1`.
- Duplicate post: `409`.
- Payment: trạng thái `PAID`; tạo receipt/allocation.
- Cancel: `POSTED → CANCELLED`; tồn hoàn nguyên.
- Duplicate cancel: `409`.
- Inventory ledger: 1 `OUT` + 1 `IN` reversal.
- Receivable ledger: 4 entry, tổng số dư bằng `0` sau cancel.
- Payment allocations: receipt + reversal, tổng bằng `0`.
- Dữ liệu integration được cleanup.

## Giới hạn chuyển tiếp

- Ledger lịch sử chưa được backfill đầy đủ. Giá vốn khi post ưu tiên bình quân từ inventory ledger hiện có; nếu chưa đủ dữ liệu thì dùng giá mua gần nhất của chứng từ mua `POSTED`, cuối cùng là `0`.
- Dashboard và công nợ khách hàng legacy vẫn đọc `sales_orders`; chuyển báo cáo sang debt/inventory ledger thuộc phase tiếp theo.
- Danh mục khách hàng/kho/hàng hóa trên UI vẫn đọc API legacy cho đến khi module Danh mục v1 hoàn thành.
- Promotion và sales return chưa nằm trong phase này.

## Bước tiếp theo

1. Chuẩn hóa inventory documents và balance reconciliation.
2. Chuyển kho hai bước và kiểm kê theo kho, bỏ hard-code `warehouseId = 1`.
3. Hoàn thiện debt module: thu/chi độc lập, N-N allocation và aging.
4. Triển khai promotion engine và sales return dựa trên sales lines v1.
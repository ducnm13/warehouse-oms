# Warehouse Transfer Lifecycle V1

## Phạm vi

Warehouse Transfer V1 thay luồng chuyển kho legacy một bước bằng quy trình hai bước có trạng thái hàng đi đường:

```text
DRAFT → IN_TRANSIT → RECEIVED
  │          │
  └──────────┴────→ CANCELLED
```

Record legacy tiếp tục giữ trạng thái `COMPLETED`. API V1 chỉ đọc và thao tác record có `sourceModule = TRANSFER_V1`.

## Quy tắc lifecycle

### DRAFT

- Chưa ảnh hưởng tồn kho hoặc inventory ledger.
- Cho phép sửa ngày, kho nguồn, kho đích, diễn giải và chi tiết.
- Kho nguồn và kho đích phải khác nhau.
- Không cho trùng packaging trong cùng phiếu.
- Có thể hủy trực tiếp mà không tạo movement.

### IN_TRANSIT

Action `ship` thực hiện trong một database transaction:

- Khóa transfer bằng `SELECT ... FOR UPDATE` và kiểm tra `version`.
- Khóa từng balance tại kho nguồn.
- Từ chối `409 NEGATIVE_STOCK` nếu không đủ tồn.
- Snapshot `unitCost` và `totalValue` lên transfer line.
- Tạo phiếu xuất compatibility `TRANSFER_SHIPMENT_V1`.
- Giảm projection tại kho nguồn.
- Ghi immutable ledger `TRANSFER_SHIPMENT/OUT`.
- Tạo link `SHIPMENT_EXPORT`.

Kho đích chưa tăng tồn khi transfer còn `IN_TRANSIT`.

### RECEIVED

Action `receive` thực hiện trong một database transaction:

- Chỉ áp dụng cho transfer `IN_TRANSIT`.
- Khóa từng balance tại kho đích.
- Tạo phiếu nhập compatibility `TRANSFER_RECEIPT_V1`.
- Tăng projection tại kho đích.
- Ghi ledger `TRANSFER_RECEIPT/IN` bằng đúng giá vốn snapshot lúc giao.
- Tạo link `RECEIPT_IMPORT`.

`RECEIVED` là trạng thái cuối. Không cho hủy trực tiếp transfer đã nhận; điều chỉnh sau nhận phải dùng một nghiệp vụ kho mới để bảo toàn lịch sử.

### CANCELLED

- Hủy `DRAFT` không sinh chứng từ kho hoặc ledger.
- Hủy `IN_TRANSIT` tạo phiếu nhập hoàn kho nguồn `TRANSFER_CANCEL_V1`.
- Tăng lại projection nguồn.
- Ghi ledger `TRANSFER_CANCEL/IN` với `reversalOfId` tham chiếu shipment ledger.
- Tạo link `CANCELLATION_IMPORT`.

## Reconciliation

Trước movement đầu tiên tại mỗi cặp hàng–kho, service bảo đảm có `inventory_ledger_opening_balances` theo công thức:

```text
opening = current projection - existing net ledger
```

Do đó cả kho nguồn và kho đích tiếp tục thỏa:

```text
opening + net ledger = productwarehouses.stock_quantity
```

## API

- `GET /api/v1/warehouse-transfers`
- `POST /api/v1/warehouse-transfers`
- `GET /api/v1/warehouse-transfers/:id`
- `PUT /api/v1/warehouse-transfers/:id`
- `POST /api/v1/warehouse-transfers/:id/ship`
- `POST /api/v1/warehouse-transfers/:id/receive`
- `POST /api/v1/warehouse-transfers/:id/cancel`

## Quyền

- `transfer.view`
- `transfer.create`
- `transfer.ship`
- `transfer.receive`
- `transfer.cancel`

Migration `008_warehouse_transfer_lifecycle` cấp năm quyền này cho `ADMIN` và `W_MANAGER`.

## Migration

Migration `008_warehouse_transfer_lifecycle` bổ sung:

- Lifecycle/version/timestamp/user/cancel metadata trên `warehouse_transfers`.
- Snapshot `unitCost`, `totalValue` trên `warehouse_transfer_details`.
- Bảng `warehouse_transfer_document_links_v1`.
- Năm permission theo action.

Migration đã áp dụng thành công và có marker trong `schema_migrations`.

## UI

Trang Chuyển kho đã chuyển sang API V1 và TanStack Query:

- Danh sách, tìm kiếm, filter trạng thái/kho nguồn/kho đích.
- Tạo/sửa nháp.
- Xuất giao.
- Xác nhận nhận tại kho đích.
- Hủy nháp hoặc hoàn nguồn khi đang vận chuyển.
- Xem giá vốn snapshot và các chứng từ kho liên kết.
- Invalidate balance/reconciliation sau mọi action ảnh hưởng kho.

## Integration verification ngày 29/08/2026

Đã chạy qua HTTP API và database thật với 31 assertions:

- Hủy `DRAFT` không tạo movement.
- Shipment thiếu tồn trả `409 NEGATIVE_STOCK` và rollback header/state.
- Update draft tăng version.
- Shipment chuyển sang `IN_TRANSIT`, giảm nguồn và chưa tăng đích.
- Duplicate shipment trả `409`.
- Receipt chuyển sang `RECEIVED`, chỉ tăng kho đích.
- Duplicate receipt trả `409`.
- Transfer đã nhận không thể hủy.
- Hủy `IN_TRANSIT` tạo return document/link và reversal ledger.
- Hủy `IN_TRANSIT` phục hồi nguồn, không thay đổi đích.
- Duplicate cancellation trả `409`.
- Reconciliation bằng `0` tại cả kho nguồn và kho đích.
- Tất cả test transfer, inventory document, audit log và refresh token đã cleanup.
- Projection và sự tồn tại/không tồn tại của balance row được phục hồi đúng baseline.

Static/build verification:

- Prisma schema validation: exit code `0`.
- Prisma Client generation 6.19.2: exit code `0`.
- TypeScript frontend/root, API, contracts và database: exit code `0`.
- Production build: exit code `0`, transform 2.821 modules và tạo `dist/index.html` trong 11,05 giây.
- Bundle production chứa UI Chuyển kho V1 và endpoint `/api/v1/warehouse-transfers`.
- Cảnh báo chunk lớn hơn 500 kB còn tồn tại nhưng không phải build error.
- API port `3000` được dừng sau verification; MariaDB port `3306` tiếp tục hoạt động.
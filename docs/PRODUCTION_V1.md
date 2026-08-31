# Production Lifecycle V1

## Lifecycle

```text
DRAFT → IN_PROGRESS → COMPLETED
  │           │            │
  └───────────┴────────────┴──→ CANCELLED
```

- `DRAFT`: lưu kế hoạch outputs và snapshot BOM, chưa tác động kho.
- `IN_PROGRESS`: đã bắt đầu, chưa tác động kho.
- `COMPLETED`: xuất NVL và nhập nhiều output trong một transaction.
- `CANCELLED`: draft/in-progress không movement; completed tạo chứng từ và ledger đảo thật.
- API V1 chỉ quản lý order có `sourceModule = PRODUCTION_V1`; order legacy giữ nguyên.

## Snapshot BOM và costing

- `productiondetails` là output snapshot, tiếp tục tương thích báo cáo legacy.
- `production_order_materials_v1` là BOM/material snapshot tại lúc lập/sửa draft.
- BOM master thay đổi sau đó không sửa lệnh đã lưu.
- Mỗi output bắt buộc có BOM.
- Tổng allocation percent phải bằng 100%, hoặc tất cả bằng 0 để phân bổ theo tỷ trọng sản lượng thực tế.
- Giá trị NVL thực tế được phân bổ hết cho outputs và snapshot vào `unitCost/totalValue`.

## Inventory posting

Complete tạo:

- Phiếu xuất NVL `PRODUCTION_MATERIAL_V1`.
- Phiếu nhập output `PRODUCTION_OUTPUT_V1`.
- Immutable ledger `PRODUCTION_MATERIAL/OUT` và `PRODUCTION_OUTPUT/IN`.
- Projection balance trong cùng transaction.
- Document links `MATERIAL_ISSUE`, `OUTPUT_RECEIPT`.

Completed cancellation tạo:

- Phiếu xuất thu hồi output.
- Phiếu nhập trả NVL.
- Ledger `PRODUCTION_OUTPUT_CANCEL/OUT`, `PRODUCTION_MATERIAL_CANCEL/IN`.
- Mỗi reversal có `reversalOfId` trỏ movement gốc.
- Links `OUTPUT_REVERSAL`, `MATERIAL_REVERSAL`.
- Từ chối nếu không đủ output để thu hồi.

## API

- `GET/POST /api/v1/production-orders`
- `GET/PUT /api/v1/production-orders/:id`
- `POST /api/v1/production-orders/:id/start`
- `POST /api/v1/production-orders/:id/complete`
- `POST /api/v1/production-orders/:id/cancel`

## RBAC

- `production.view`, `production.manage` hiện có.
- `production.start`, `production.complete`, `production.cancel` mới.
- ADMIN và P_MANAGER có đầy đủ action; QD UI read-only.

## Migration

`012_production_lifecycle` bổ sung lifecycle/version/warehouse metadata, output cost snapshot, material snapshot, document links và permissions. Migration đã applied.

## Integration verification ngày 29/08/2026

Đã chạy 21 assertions qua HTTP API và database thật:

- Draft tạo BOM snapshot tổng hợp đúng.
- BOM snapshot giữ nguyên sau khi master BOM thay đổi.
- Start chuyển `DRAFT → IN_PROGRESS`; duplicate start trả `409`.
- Invalid completion payload bị từ chối.
- Thiếu NVL trả `409 INSUFFICIENT_MATERIAL` và rollback.
- Complete tạo compatibility documents/links và cập nhật cả material/output balances.
- Tổng giá trị output bằng tổng giá trị NVL thực tế.
- Duplicate complete bị từ chối.
- Cancel completed tạo reversal documents/links.
- Cancel phục hồi toàn bộ balances.
- Ledger có 3 movement và 3 reversal; mọi reversal có `reversalOfId`.
- Reconciliation bằng 0 cho material và hai outputs.
- Fixture products/BOM/order/documents/ledger/balances/audit/session đã cleanup.

## Static/build verification

- Prisma schema validation: exit code `0`.
- Prisma Client generation 6.19.2: exit code `0`.
- TypeScript frontend/root, API, contracts và database: exit code `0`.
- Production build: exit code `0`, transform 2.821 modules và tạo `dist/index.html` trong 17,80 giây.
- Production bundle chứa trang Sản xuất V1 và endpoint `/api/v1/production-orders`.
- Cảnh báo chunk lớn hơn 500 kB còn tồn tại nhưng không phải build error.
- API port `3000` được dừng; MariaDB port `3306` tiếp tục hoạt động.
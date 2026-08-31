# Assembly / Disassembly Lifecycle V1

## Lifecycle

```text
DRAFT → POSTED → CANCELLED
  └────────────────→ CANCELLED
```

- `DRAFT`: lưu kế hoạch và snapshot BOM, chưa tác động tồn kho.
- `POSTED`: issue và receipt được ghi trong cùng database transaction.
- `CANCELLED`: draft không tạo movement; posted tạo chứng từ và ledger đảo thật.

## Assembly BOM

- `assembly_bom_headers` và `assembly_bom_lines` là BOM lắp ráp riêng, không dùng chung BOM sản xuất legacy.
- BOM có output quantity chuẩn, version, trạng thái `ACTIVE/INACTIVE`, component quantity và allocation weight.
- Tạo hoặc sửa draft order sẽ lấy BOM active mới nhất và snapshot toàn bộ component vào order lines.
- BOM master thay đổi sau đó không sửa lịch sử order.
- Ví dụ đã kiểm chứng: 20 hộp × 18 gói = 360 gói snapshot.

## Assembly posting và costing

- Khóa order, component balances và output balance bằng `FOR UPDATE`.
- Xuất component từ kho linh kiện và nhập output vào kho thành phẩm nguyên tử.
- Cost output = tổng giá trị component thực tế theo moving-average cost + chi phí lắp ráp.
- Tạo compatibility inventory documents, immutable ledger và document links.
- Thiếu component trả `409 INSUFFICIENT_COMPONENT` và rollback toàn bộ.

Ledger source types:

- `ASSEMBLY_COMPONENT/OUT`.
- `ASSEMBLY_OUTPUT/IN`.
- `ASSEMBLY_COMPONENT_CANCEL/IN`.
- `ASSEMBLY_OUTPUT_CANCEL/OUT`.

## Disassembly posting và costing

- Xuất thành phẩm nguồn theo moving-average cost hiện tại.
- Nhập số lượng component thực tế thu hồi; lưu riêng physical `lossQuantity`.
- Phân bổ toàn bộ source value theo `actual recovered quantity × allocation weight`.
- Allocation weight bằng `0` dùng trọng số mặc định `1`.
- Dòng cuối nhận chênh lệch làm tròn, bảo đảm tổng recovery value bằng source value.

Ledger source types:

- `DISASSEMBLY_SOURCE/OUT`.
- `DISASSEMBLY_RECOVERY/IN`.
- `DISASSEMBLY_SOURCE_CANCEL/IN`.
- `DISASSEMBLY_RECOVERY_CANCEL/OUT`.

## Cancellation

- Posted cancellation tạo hai compatibility reversal documents.
- Mỗi reversal ledger có `reversalOfId` trỏ movement gốc.
- Assembly từ chối hủy nếu không đủ output để thu hồi.
- Disassembly từ chối hủy nếu không đủ recovered components để thu hồi.
- Projection balance được cập nhật cùng transaction.

## API

- `GET/POST /api/v1/assembly/boms`
- `GET/PUT /api/v1/assembly/boms/:id`
- `GET/POST /api/v1/assembly/orders`
- `GET/PUT /api/v1/assembly/orders/:id`
- `POST /api/v1/assembly/orders/:id/post`
- `POST /api/v1/assembly/orders/:id/cancel`
- `GET/POST /api/v1/assembly/disassembly-orders`
- `GET/PUT /api/v1/assembly/disassembly-orders/:id`
- `POST /api/v1/assembly/disassembly-orders/:id/post`
- `POST /api/v1/assembly/disassembly-orders/:id/cancel`

## RBAC

- `assembly.view`: ADMIN, P_MANAGER và QD.
- `assembly.manage`, `assembly.post`, `assembly.cancel`: ADMIN và P_MANAGER.
- QD UI read-only.

## Migration

`013_assembly_disassembly_lifecycle` là migration append-only tạo BOM master, assembly/disassembly orders, snapshot lines, document links và permissions. Migration đã applied thành công.

## Integration verification ngày 31/08/2026

Đã chạy 22 assertions qua HTTP trên Express V1 và MariaDB thật:

- Endpoint từ chối request chưa xác thực.
- Tạo BOM riêng và snapshot đúng 360 gói cho 20 hộp.
- Order snapshot không đổi sau khi BOM master được sửa.
- Thiếu component trả `409` và không để lại compatibility documents.
- Assembly post tạo issue/receipt, 3 ledger movements và 2 links.
- Output cost bằng component cost thực tế cộng assembly cost.
- Duplicate assembly post bị từ chối.
- Assembly cancel tạo 3 linked reversals và phục hồi balances.
- Disassembly post tạo issue/receipt, 3 ledger movements và 2 links.
- Tổng recovery value bằng source value.
- Disassembly cancel tạo 3 linked reversals.
- Reconciliation difference bằng 0 cho cả ba fixture packaging.
- Fixture users/roles, products, BOM, orders, documents, ledger, opening balances, projections và audit logs đã cleanup.

## Static/build verification

- Prisma schema validation: thành công.
- Prisma Client 6.19.2 generation: thành công.
- Root/frontend, contracts, database và API TypeScript: thành công, không có diagnostics.
- Production build: thành công, transform 2.822 modules trong 14,61 giây.
- Bundle mới: `dist/assets/index-D7GWN5nI.js`.
- Vite vẫn cảnh báo chunk lớn hơn 500 kB; đây không phải build error.
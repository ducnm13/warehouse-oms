# Inventory Lifecycle V1

## Phạm vi

Inventory V1 chuẩn hóa nhập/xuất kho thủ công và kiểm kê theo kho trên API `/api/v1`, song song với API legacy theo strangler pattern.

### Chứng từ kho thủ công

- Trạng thái: `DRAFT → POSTED → CANCELLED`.
- Chỉ chứng từ có `sourceModule = MANUAL_V1` được sửa, ghi sổ hoặc hủy qua API chứng từ thủ công.
- `DRAFT` không ảnh hưởng tồn kho hoặc ledger.
- `POSTED` khóa chứng từ và từng balance `(packagingId, warehouseId)`, kiểm tra tồn khi xuất, cập nhật projection và tạo immutable ledger trong cùng transaction.
- `CANCELLED` không sửa ledger gốc. Hệ thống tạo chứng từ đảo `REVERSAL_V1`, detail đảo, reversal ledger và cập nhật projection trong cùng transaction.
- Optimistic concurrency dùng trường `version`; version cũ trả `409 VERSION_CONFLICT`.

### Kiểm kê theo kho

- Trạng thái: `DRAFT → COMPLETED → CANCELLED`.
- Mỗi phiếu thuộc đúng một warehouse và lưu snapshot tồn sổ tại lúc lập phiếu.
- Sửa số thực tế trong cùng warehouse không chụp lại snapshot, tránh che khuất biến động kho xảy ra sau khi lập.
- Khi chốt, hệ thống khóa lại balance và so với snapshot. Bất kỳ thay đổi nào trả `409 BOOK_STOCK_CHANGED` và toàn bộ transaction rollback.
- Chênh lệch tăng/giảm tạo các chứng từ điều chỉnh nhập/xuất riêng với `sourceModule = STOCKTAKE_V1`, detail, ledger và document links.
- Hủy kiểm kê tạo chứng từ đảo thực `STOCKTAKE_REVERSAL_V1`, reversal ledger và links; không sửa hoặc xóa movement gốc.

### Reconciliation

- `productwarehouses` tiếp tục là projection số dư phục vụ vận hành.
- `inventory_ledger` là movement ledger bất biến.
- `inventory_ledger_opening_balances` lưu baseline theo hàng–kho để đối soát dữ liệu legacy mà không ghi trùng movement Purchase/Sales hiện có.
- Công thức đối soát: `opening balance + net ledger = productwarehouses.stock_quantity`.

## API

- `GET/POST /api/v1/inventory/documents`
- `GET/PUT /api/v1/inventory/documents/:id`
- `POST /api/v1/inventory/documents/:id/post`
- `POST /api/v1/inventory/documents/:id/cancel`
- `GET /api/v1/inventory/balances`
- `GET /api/v1/inventory/reconciliation`
- `GET/POST /api/v1/inventory/stocktakes`
- `GET/PUT /api/v1/inventory/stocktakes/:id`
- `POST /api/v1/inventory/stocktakes/:id/complete`
- `POST /api/v1/inventory/stocktakes/:id/cancel`

## Quyền

- `inventory.view`
- `inventory.manage`
- `inventory.post`
- `inventory.cancel`
- `inventory.stocktake`

Ba quyền lifecycle mới được cấp mặc định cho `ADMIN` và `W_MANAGER` trong migration `007_inventory_lifecycle`.

## UI

- Trang Nhập/Xuất kho có các tab Chứng từ, Tồn theo kho và Đối soát ledger.
- Trang Kiểm kê bắt buộc chọn kho, nạp snapshot theo kho, hỗ trợ lưu/sửa nháp, chốt và hủy/đảo.
- Frontend dùng TanStack Query và helper `apiV1`, bao gồm refresh-token rotation hiện có.

## Verification ngày 29/08/2026

Đã đạt:

- Migration `007_inventory_lifecycle` đã áp dụng và có marker trong `schema_migrations`.
- Live schema có đủ lifecycle columns, `inventory_ledger_opening_balances`, `stocktake_document_links_v1`, foreign key/index warehouse và permission grants cho `ADMIN`/`W_MANAGER`.
- Prisma schema validation và Prisma Client generation 6.19.2 đạt exit code `0`.
- TypeScript frontend/root, `@challenge/api`, `@challenge/contracts` và `@challenge/database` đạt exit code `0`.
- Production build đạt exit code `0`: Vite transform 2.821 modules và tạo `dist/index.html` trong 10,79 giây.
- Bundle còn cảnh báo kích thước chunk lớn hơn 500 kB; đây là tối ưu hiệu năng tiếp theo, không phải build error.

Integration test đã chạy qua HTTP API thật và cleanup thành công:

- Import `DRAFT → POSTED → CANCELLED`; duplicate post/cancel trả `409`; tồn trở về baseline.
- Export vượt tồn trả `409 NEGATIVE_STOCK`.
- Export hợp lệ post/cancel và tồn trở về baseline.
- Kiểm kê stale snapshot trả `409 BOOK_STOCK_CHANGED`.
- Update kiểm kê trong cùng warehouse giữ nguyên snapshot ban đầu.
- Kiểm kê có cả chênh lệch tăng/giảm tạo hai adjustment documents, ledger và links.
- Hủy kiểm kê tạo hai reversal documents, reversal ledger/links và phục hồi cả hai balance.
- Duplicate stocktake cancel trả `409`.
- Reconciliation của hai balance được kiểm thử có difference bằng `0`.
- Dữ liệu chứng từ, ledger, audit log và refresh token kiểm thử đã được cleanup.
- Port API `3000` được dừng sau verification; MariaDB tại `3306` tiếp tục hoạt động.

## Ngoài phạm vi

Chuyển kho hai bước `DRAFT → IN_TRANSIT → RECEIVED/CANCELLED` được giữ cho vertical slice tiếp theo.
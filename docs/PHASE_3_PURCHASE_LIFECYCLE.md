# Phase 3 — Purchase Lifecycle & Dashboard Fix

## Hoàn thành

- Chứng từ mua hàng v1 có vòng đời `DRAFT → POSTED → CANCELLED`.
- Draft không tác động tồn kho và công nợ.
- Ghi sổ tạo phiếu nhập tương thích legacy, inventory ledger và payable ledger.
- Thanh toán ngay tạo voucher và allocation.
- Hủy tạo phiếu/ledger đảo, hoàn nguyên tồn kho và công nợ.
- Optimistic locking bằng `version`; post/cancel lặp trả `409`.
- Màn hình `PurchasesV1` dùng API v1, TanStack Query, React Hook Form và Zod.
- Login frontend chuyển sang access/refresh token v1; access token vẫn tương thích API legacy.
- Route `/purchases` được đồng bộ với menu compatibility.
- Query công nợ nhà cung cấp và Dashboard chỉ tính chứng từ mua `POSTED`.
- Sửa cảnh báo tồn kho MariaDB: dùng derived table và lọc `stock <= minStock`, không tham chiếu cột ngoài aggregate trong `HAVING`.

## Migration

- `003_purchase_lifecycle`: trạng thái/version, inventory ledger, payable ledger, vouchers và links.
- `004_purchase_constraints`: foreign key cho links chứng từ mua.
- `005_sales_lifecycle`: nền schema lifecycle/receivable cho vertical slice bán hàng tiếp theo.

## Integration test

- Create draft: `201`.
- Update draft: `200`, tăng version.
- Post: `200`, tồn tăng đúng.
- Duplicate post: `409`.
- Cancel: `200`, tồn hoàn nguyên.
- Duplicate cancel: `409`.
- Inventory ledger: 1 IN + 1 OUT reversal.
- Payable ledger: CHARGE + REVERSAL, tổng bằng 0.
- Dashboard financial: `200`, `lowStock` là mảng và không còn lỗi `min_stock`.
- Dữ liệu test và refresh token đã được cleanup.
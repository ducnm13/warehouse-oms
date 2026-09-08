# Sales Return V1

## Phạm vi và policy

- Chỉ lập phiếu trả từ sales document đã ghi sổ (`FULFILLED` trong database, `POSTED` tại API).
- V1 chỉ hỗ trợ settlement `REDUCE_DEBT`; chưa hỗ trợ hoàn tiền mặt/chuyển khoản.
- Credit trả hàng không được vượt outstanding hiện tại của đơn gốc. Nếu khách đã thanh toán làm dư nợ thấp hơn giá trị trả, API từ chối với `RETURN_CREDIT_EXCEEDS_DEBT`.
- Tổng quantity đã trả của mỗi dòng không vượt `sold quantity - quantity của các return POSTED`.
- Quantity cap và outstanding được kiểm tra lại trong transaction sau khi khóa sales order gốc, tránh hai request đồng thời cùng vượt giới hạn.
- Chỉ return `POSTED` tác động kho, công nợ và báo cáo. Return `CANCELLED` được đảo bằng ledger đối ứng.

## Snapshot giá trị

Mỗi dòng return lưu snapshot độc lập, không sửa các tổng snapshot trên sales order gốc:

- Revenue return = `returned quantity × original line total / original quantity`.
- VAT dùng tỷ lệ `sales order tax amount / sales order subtotal`.
- COGS return = `returned quantity × original unit cost`.
- Dòng `PROMOTION` có revenue và VAT bằng `0`, nhưng vẫn hoàn kho và đảo COGS theo snapshot giá vốn gốc.

## Lifecycle

### Draft

- Create/update chỉ lưu `sales_returns` và `sales_return_lines`.
- Chưa thay đổi tồn kho hay receivable ledger.
- Optimistic concurrency dùng trường `version`.

### Post

Trong một database transaction:

1. Khóa return và sales order gốc.
2. Kiểm tra lại version, status, quantity cap và outstanding.
3. Tạo inventory receipt `PN-{returnCode}`.
4. Tăng `productwarehouses.stock_quantity` cho cả dòng SALE và PROMOTION.
5. Ghi immutable inventory ledger `SALES_RETURN/IN` theo COGS snapshot.
6. Ghi receivable `CREDIT` số âm, `sourceId` là sales order gốc.
7. Cập nhật projection `sales_orders.paymentStatus` từ ledger outstanding; không cộng credit vào `paidAmount`.
8. Lưu document links và chuyển return sang `POSTED`.

### Cancel

Trong một database transaction:

1. Khóa return và sales order gốc.
2. Kiểm tra đủ tồn để xuất đảo.
3. Tạo inventory reversal `H-PN-{returnCode}`.
4. Ghi ledger `SALES_RETURN_CANCEL/OUT` với `reversalOfId` trỏ movement nhập gốc.
5. Ghi `CREDIT_REVERSAL` số dương với `reversalOfId` trỏ credit gốc.
6. Tính lại `paymentStatus` từ outstanding ledger và chuyển return sang `CANCELLED`.

Sales order gốc không được cancel khi còn return `POSTED`.

## API và RBAC

- `GET /api/v1/sales-returns`
- `GET /api/v1/sales-returns/:id`
- `POST /api/v1/sales-returns`
- `PUT /api/v1/sales-returns/:id`
- `POST /api/v1/sales-returns/:id/post`
- `POST /api/v1/sales-returns/:id/cancel`

Permissions:

- `sales.return.view`
- `sales.return.manage`
- `sales.return.cancel`

Migration `016_sales_return_lifecycle` cấp các permission này cho `ADMIN` và `S_SALES`.

## Reporting và UI

- Sales profitability trừ revenue, VAT và COGS của return `POSTED` theo sales order gốc.
- Return `CANCELLED` không còn được net trong báo cáo.
- UI cho chọn đơn đã post, hiển thị sold/already returned/returnable, tạo hoặc sửa draft, post, cancel và xem document links.

## Integration verification ngày 03/09/2026

Script `scripts/sales-return-v1.integration.ts` đã pass 27 assertions qua HTTP API và MariaDB thật:

- Authentication và RBAC.
- Snapshot revenue, VAT và COGS.
- Dòng promotion có revenue/VAT bằng 0 nhưng hoàn kho và đảo COGS.
- Kiểm tra lại aggregate quantity cap khi post nhiều draft cạnh tranh.
- Credit giảm outstanding và không biến thành tiền thực thu.
- Phiếu thu không thể vượt outstanding sau return.
- Payment status projection dựa trên ledger outstanding.
- Không cho cancel đơn bán khi còn return posted.
- Reporting net return đúng.
- Cancel tạo inventory/receivable reversal có `reversalOfId`, phục hồi balances và reporting.
- Fixture cleanup FK-safe và residue bằng `0`.

## Giới hạn V1

- Chưa hỗ trợ cash/bank refund hoặc credit vượt outstanding.
- Chưa có quy trình kiểm định chất lượng hàng trả trước khi nhập kho.
- Chưa hỗ trợ đổi hàng trực tiếp; cần return và lập sales document mới.
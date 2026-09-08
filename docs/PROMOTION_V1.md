# Promotion Engine V1

## Phạm vi và policy đã chốt

- Một dòng hàng bán áp dụng tối đa một chương trình đủ điều kiện.
- Ưu tiên `priority` cao nhất; nếu bằng nhau chọn program ID nhỏ hơn để kết quả deterministic.
- Hàng tặng có đơn giá `0`, VAT `0`, không làm tăng doanh thu và công nợ.
- Hàng tặng vẫn được kiểm tra tồn, xuất kho, tính giá vốn và làm giảm lợi nhuận gộp.
- Chưa áp dụng ngân sách và giới hạn lượt dùng trong V1.
- Customer scope hỗ trợ `ALL` và `GROUP` theo `customers.groupName`.
- Reward warehouse để trống nghĩa là theo kho đơn bán; nếu cấu hình kho thì chương trình chỉ match đơn tại kho đó.

## Dữ liệu

Migration `015_promotion_engine` bổ sung:

- `promotion_programs`.
- `promotion_conditions` với condition V1 `BUY_QUANTITY`.
- `promotion_rewards` với reward V1 `FREE_ITEM`.
- `promotion_usage_logs`, chỉ ghi khi đơn bán được post.
- Snapshot trên `sales_order_details`: `lineType`, program ID/code/name.
- Permission `promotion.view` và `promotion.manage` cho ADMIN/S_SALES.

Không tạo inventory ledger mới. Dòng `PROMOTION` đi qua cùng Sales V1 posting transaction và immutable inventory ledger như dòng `SALE`.

## API

- `GET/POST /api/v1/promotions`.
- `GET/PUT /api/v1/promotions/:id`.
- `POST /api/v1/promotions/:id/activate`.
- `POST /api/v1/promotions/:id/deactivate`.
- `POST /api/v1/promotions/preview`.

Preview và save draft dùng chung engine server-side. Client chỉ gửi dòng bán; server tự tính lại dòng tặng nên client không thể giả mạo promotion snapshot hoặc giá hàng tặng.

## Tích hợp Sales

- Create/update draft tự thêm, cập nhật hoặc xóa dòng gift theo quantity hiện tại.
- Mỗi `minimumQuantity` hoàn thành tạo một reward tier. Ví dụ mua 20 với bậc 10 sẽ nhận hai lần reward.
- Dòng tặng được hiển thị read-only trong chi tiết đơn bán.
- Form bán hàng có preview trước khi lưu; kết quả save vẫn do server tính lại authoritative.
- Edit đơn chỉ nạp lại dòng SALE; gift cũ không bị biến thành dòng người dùng nhập.
- Post kiểm tra và trừ tồn cả SALE/PROMOTION, snapshot COGS và ghi usage log.
- Cancel tạo reversal tồn cho cả SALE/PROMOTION theo cơ chế Sales V1 hiện có.

## Integration verification ngày 01/09/2026

Đã pass 15 assertions qua HTTP API và MariaDB thật:

- Tạo và kích hoạt hai chương trình.
- Chương trình priority cao thắng.
- Mua 10 tặng 10; mua 20 tặng 20.
- Giảm quantity dưới điều kiện sẽ xóa gift.
- Tăng lại đủ điều kiện sẽ khôi phục gift.
- Gift price/line total bằng 0 và không tăng VAT, doanh thu, công nợ.
- Post trừ đúng tồn hàng bán và hàng tặng.
- Usage log chỉ được ghi khi post.
- Cancel hoàn nguyên cả hai số tồn.
- Fixture cleanup được scope theo run và không để residue.

## Giới hạn chuyển tiếp

- Chưa có promotion budget, usage cap, customer-specific list hoặc stacking.
- Chưa có discount reward; V1 chỉ hỗ trợ free item.
- Sales Return V1 đã hỗ trợ hoàn kho và đảo COGS cho cả dòng SALE/PROMOTION; xem `docs/SALES_RETURN_V1.md`.
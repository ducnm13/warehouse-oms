# Reporting Consolidation V1

## Phạm vi

Reporting V1 hợp nhất dữ liệu từ các ledger và snapshot đã ghi sổ, không tạo bảng tổng hợp trùng nguồn:

- Báo cáo tổng hợp tồn kho.
- Sổ chi tiết vật tư hàng hóa.
- Doanh thu, chiết khấu, giá vốn và lợi nhuận gộp.
- Báo cáo Production, Assembly và Disassembly theo lệnh.
- So sánh định mức và thực tế sản xuất theo snapshot lệnh.

## Inventory summary

- Số lượng đầu kỳ = opening baseline + net inventory ledger trước `from`.
- Nhập/xuất trong kỳ lấy từ immutable inventory ledger trong khoảng ngày inclusive.
- Tồn cuối = đầu kỳ + nhập - xuất.
- `projectionDifference` đối chiếu tồn cuối ledger với `productwarehouses.stock_quantity`.
- Reversal là movement đối ứng nên tự net về đúng số.
- Opening baseline legacy hiện chỉ có quantity. Khi baseline khác 0, API trả `valueCoverageComplete=false`; hệ thống không dựng giá trị tồn đầu giả.

## Item ledger

- Trả opening quantity/value, từng movement và closing quantity/value.
- Mỗi dòng có source type, document code, warehouse, nhập/xuất và running balance.
- Filter theo packaging, warehouse và khoảng ngày.

## Sales profitability

- Chỉ lấy sales document có database status `FULFILLED`, tương ứng `POSTED` tại API.
- Gross sales = quantity × unit price.
- Discount = gross sales - line total.
- Net revenue = tổng line total trừ subtotal của Sales Return `POSTED`, chưa gồm VAT.
- VAT được net theo tax snapshot của Sales Return `POSTED`.
- COGS dùng `costAmount` snapshot khi sales posting và trừ COGS hoàn lại của Sales Return `POSTED`.
- Gross profit = net revenue - COGS.
- Sales Return `CANCELLED` không được net vì reversal đã khôi phục trạng thái kinh tế của đơn gốc.

## Operations

- Production: chỉ `PRODUCTION_V1/COMPLETED`.
- Assembly: chỉ `ASSEMBLY_V1/POSTED`.
- Disassembly: chỉ `DISASSEMBLY_V1/POSTED`.
- Báo cáo hiển thị planned/actual quantity, input/output value và physical loss quantity.
- Cancelled orders không được tính là hoạt động hoàn tất trong kỳ.

## Production variance

- Chỉ lấy lệnh `PRODUCTION_V1/COMPLETED` theo `completedAt`; lệnh đã cancel bị loại.
- Sản lượng kế hoạch dùng `target_sachets` của lệnh. Với dữ liệu legacy không có target, hệ thống quy đổi `planned packaging quantity × packCount`.
- Sản lượng thực tế quy đổi bằng `actual packaging quantity × packCount`, đơn vị hiển thị là gói quy đổi.
- Chênh lệch sản lượng = thực tế - kế hoạch; số âm là thiếu sản lượng.
- Định mức nguyên vật liệu lấy từ `production_order_materials_v1.plannedQuantity`, được snapshot từ BOM khi tạo lệnh.
- Tiêu hao thực tế, đơn giá và giá trị thực tế lấy từ snapshot khi hoàn thành lệnh.
- Chênh lệch tiêu hao = actual quantity - planned quantity; số dương là vượt định mức.
- Giá trị kế hoạch = planned quantity × actual unit cost snapshot. Cách này cô lập variance do lượng tại cùng một đơn giá thực tế.
- Chênh lệch giá trị = actual total value - planned value.
- Không cộng quantity của các nguyên vật liệu khác đơn vị trong summary. Summary chỉ cộng giá trị tiền và đếm dòng vượt/tiết kiệm định mức.
- V1 chưa có standard cost riêng, vì vậy chưa tách price variance và usage variance.

## API

- `GET /api/v1/reports/inventory-summary`
- `GET /api/v1/reports/item-ledger`
- `GET /api/v1/reports/sales-profit`
- `GET /api/v1/reports/operations`
- `GET /api/v1/reports/production-variance`

Query sử dụng `from`, `to`, warehouse và các filter theo từng báo cáo. Khoảng ngày là inclusive.

## RBAC và UI

- API yêu cầu `report.view`.
- UI chỉ hiển thị export khi probe `GET /api/v1/reports/export-authorization` được `report.export` cho phép.
- UI dùng TanStack Query và thay thế hai entry báo cáo legacy bằng trang Báo cáo hợp nhất V1.
- Menu hiển thị cho toàn bộ legacy role đã được cấp `report.view`, bao gồm Sales và QD; API vẫn là lớp kiểm quyền quyết định.
- Loading và API error được hiển thị riêng, không dùng số 0 làm dữ liệu giả trong lúc request chưa hoàn tất.
- Export Excel dùng đúng rows sau filter hiện tại và các thư viện `exceljs/file-saver` đã có trong dự án.

## Migration

`014_reporting_consolidation` bổ sung reporting indexes cho inventory ledger, sales, production, assembly và disassembly. Không tạo projection table mới. Migration đã applied.

## Integration verification ngày 01/09/2026

Đã chạy 15 assertions qua HTTP API và MariaDB thật:

- Endpoint yêu cầu authentication.
- Date range lấy inclusive movement trong ngày.
- Opening 10, nhập 5, xuất 2 và tồn cuối 13.
- Inventory value trong kỳ tính đúng.
- Projection difference bằng 0.
- Value coverage cảnh báo đúng khi có legacy opening quantity.
- Item ledger có hai movement và running quantity 15 → 13.
- Item opening và closing đúng ở cả hai nhánh có/không có warehouse filter.
- Export authorization probe cho phép role có `report.export`.
- Sales gross 200, discount 20, net revenue 180.
- COGS 120, gross profit 60, margin 33,33%.
- Operations filter trả đúng Production completed và input/output value 50.
- Date range đảo ngược trả `422`.
- Fixture user/role, warehouse, product, opening, ledger, sales và production đã cleanup.
- Cleanup được scope theo prefix riêng của từng lần chạy để các integration run song song không xóa dữ liệu của nhau.

## Production variance verification ngày 03/09/2026

Script `scripts/production-variance-v1.integration.ts` đã pass 15 assertions qua HTTP và MariaDB thật:

- Authentication và RBAC.
- Chỉ tính `PRODUCTION_V1/COMPLETED`, loại lệnh `CANCELLED`.
- Filter ngày, kho và từ khóa.
- Quy đổi output theo `packCount` và target sachets.
- Một dòng vượt định mức và một dòng tiết kiệm định mức.
- Planned/actual quantity, percentage và value variance đúng.
- Summary chỉ đếm output mỗi lệnh một lần.
- Summary không cộng quantity khác đơn vị.
- Date range đảo ngược trả `422`.
- Cleanup residue bằng `0`.
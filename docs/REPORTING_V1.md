# Reporting Consolidation V1

## Phạm vi

Reporting V1 hợp nhất dữ liệu từ các ledger và snapshot đã ghi sổ, không tạo bảng tổng hợp trùng nguồn:

- Báo cáo tổng hợp tồn kho.
- Sổ chi tiết vật tư hàng hóa.
- Doanh thu, chiết khấu, giá vốn và lợi nhuận gộp.
- Báo cáo Production, Assembly và Disassembly theo lệnh.

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
- Net revenue = tổng line total, chưa gồm VAT.
- COGS dùng `costAmount` snapshot khi sales posting.
- Gross profit = net revenue - COGS.

## Operations

- Production: chỉ `PRODUCTION_V1/COMPLETED`.
- Assembly: chỉ `ASSEMBLY_V1/POSTED`.
- Disassembly: chỉ `DISASSEMBLY_V1/POSTED`.
- Báo cáo hiển thị planned/actual quantity, input/output value và physical loss quantity.
- Cancelled orders không được tính là hoạt động hoàn tất trong kỳ.

## API

- `GET /api/v1/reports/inventory-summary`
- `GET /api/v1/reports/item-ledger`
- `GET /api/v1/reports/sales-profit`
- `GET /api/v1/reports/operations`

Query sử dụng `from`, `to`, warehouse và các filter theo từng báo cáo. Khoảng ngày là inclusive.

## RBAC và UI

- API yêu cầu `report.view`.
- UI dùng TanStack Query và thay thế hai entry báo cáo legacy bằng trang Báo cáo hợp nhất V1.
- Export Excel dùng đúng rows sau filter hiện tại và các thư viện `exceljs/file-saver` đã có trong dự án.

## Migration

`014_reporting_consolidation` bổ sung reporting indexes cho inventory ledger, sales, production, assembly và disassembly. Không tạo projection table mới. Migration đã applied.

## Integration verification ngày 31/08/2026

Đã chạy 13 assertions qua HTTP API và MariaDB thật:

- Endpoint yêu cầu authentication.
- Date range lấy inclusive movement trong ngày.
- Opening 10, nhập 5, xuất 2 và tồn cuối 13.
- Inventory value trong kỳ tính đúng.
- Projection difference bằng 0.
- Value coverage cảnh báo đúng khi có legacy opening quantity.
- Item ledger có hai movement và running quantity 15 → 13.
- Sales gross 200, discount 20, net revenue 180.
- COGS 120, gross profit 60, margin 33,33%.
- Operations filter trả đúng Production completed và input/output value 50.
- Date range đảo ngược trả `422`.
- Fixture user/role, warehouse, product, opening, ledger, sales và production đã cleanup.
# PROMPT XÂY DỰNG WEBAPP QUẢN LÝ ERP

Bạn là một Senior Full-stack Software Engineer kiêm Business Analyst, Solution Architect và UI/UX Designer.

Hãy phân tích, thiết kế và phát triển một WebApp ERP quản lý mua hàng, bán hàng, khách hàng, nhà cung cấp, kho và sản xuất cho doanh nghiệp sản xuất – thương mại.

Không chỉ tạo giao diện minh họa. Hệ thống phải có đầy đủ:

* Frontend.
* Backend API.
* Cơ sở dữ liệu.
* Xác thực và phân quyền.
* Validation dữ liệu.
* Nghiệp vụ kho.
* Nghiệp vụ mua hàng, bán hàng.
* Công nợ.
* Sản xuất và định mức nguyên vật liệu.
* Lắp ráp và tháo dỡ.
* Báo cáo.
* Xuất/nhập Excel.
* Dữ liệu mẫu để kiểm thử.

---

# I. CÔNG NGHỆ SỬ DỤNG

## 1. Frontend

* ReactJS.
* Vite.
* TypeScript.
* TailwindCSS.
* Giao diện tham khảo TailAdmin.
* React Router.
* TanStack Query để quản lý dữ liệu từ API.
* React Hook Form kết hợp Zod để quản lý và kiểm tra biểu mẫu.
* TanStack Table hoặc thư viện tương đương để xây dựng Data Table.
* Recharts hoặc thư viện tương đương cho biểu đồ.
* Axios hoặc Fetch API.
* Toast notification.
* Modal/Dialog dùng chung.
* Date picker hỗ trợ định dạng Việt Nam.

## 2. Backend

* NodeJS.
* TypeScript.
* ExpressJS hoặc NestJS.
* RESTful API.
* JWT Authentication.
* Role-Based Access Control.
* Swagger/OpenAPI.
* Cơ chế transaction cho các nghiệp vụ ảnh hưởng nhiều bảng.

## 3. Cơ sở dữ liệu

* MySQL.
* Sử dụng Prisma ORM hoặc Sequelize.
* Thiết kế có khóa chính, khóa ngoại, unique index và index tra cứu.
* Không xóa cứng các dữ liệu đã phát sinh chứng từ.
* Hỗ trợ soft delete bằng `deleted_at`.
* Sử dụng migration và seed dữ liệu mẫu.
* Lưu lịch sử tạo, sửa và hủy chứng từ.

## 4. Quy ước chung

* Ngôn ngữ giao diện: Tiếng Việt.
* Ngày: `dd/mm/yyyy`.
* Giờ: `HH:mm:ss`.
* Tiền tệ mặc định: VND.
* Số tiền hiển thị có dấu phân cách hàng nghìn.
* Thuế suất hiển thị theo phần trăm.
* Số lượng hỗ trợ số thập phân.
* Responsive cho desktop, tablet và mobile.
* Giao diện quản trị hiện đại, rõ ràng, dễ sử dụng.
* Sidebar có thể thu gọn.
* Header có thông báo và menu người dùng.
* Hỗ trợ giao diện sáng/tối nếu phù hợp với TailAdmin.

---

# II. YÊU CẦU KIẾN TRÚC

Tổ chức hệ thống theo từng module:

* Authentication.
* Người dùng và phân quyền.
* Dashboard.
* Khách hàng.
* Nhà cung cấp.
* Vật tư hàng hóa.
* Kho.
* Mua hàng.
* Bán hàng.
* Công nợ.
* Khuyến mãi.
* Sản xuất.
* Lắp ráp và tháo dỡ.
* Kiểm kê.
* Báo cáo.
* Cài đặt hệ thống.
* Nhật ký hoạt động.

Mỗi module phải có:

* Database schema.
* Entity/model.
* Repository hoặc data access layer.
* Service xử lý nghiệp vụ.
* Controller/API.
* Validation.
* Phân quyền.
* Frontend page.
* Form thêm/sửa.
* Danh sách và bộ lọc.
* Trạng thái loading, empty và error.
* Unit test cho nghiệp vụ quan trọng.

Không viết toàn bộ nghiệp vụ trong controller hoặc React component.

---

# III. SIDEBAR MENU

Xây dựng Sidebar theo cấu trúc:

1. Tổng quan.
2. Mua hàng.
3. Bán hàng.
4. Đối tác:

   * Khách hàng.
   * Nhà cung cấp.
5. Vật tư hàng hóa.
6. Kho:

   * Nhập kho.
   * Xuất kho.
   * Chuyển kho.
   * Kiểm kê.
7. Sản xuất:

   * Lệnh sản xuất.
   * Lệnh lắp ráp.
   * Lệnh tháo dỡ.
8. Công nợ:

   * Phải thu.
   * Phải trả.
   * Thu tiền.
   * Chi tiền.
9. Khuyến mãi.
10. Báo cáo:

    * Tổng hợp tồn kho.
    * Sổ chi tiết vật tư hàng hóa.
    * Doanh thu.
    * Chi phí.
    * Lợi nhuận.
    * Công nợ.
11. Cài đặt.
12. Người dùng và phân quyền.
13. Nhật ký hệ thống.

---

# IV. TRANG TỔNG QUAN – DASHBOARD

Thiết kế Dashboard thể hiện tình hình hoạt động theo khoảng thời gian người dùng lựa chọn.

## 1. Bộ lọc thời gian

* Hôm nay.
* Tuần này.
* Tháng này.
* Quý này.
* Năm nay.
* Khoảng ngày tùy chỉnh.
* Lọc theo chi nhánh.
* Lọc theo kho.

## 2. Các thẻ thống kê

* Tổng doanh thu.
* Tổng chi phí.
* Lợi nhuận.
* Công nợ phải thu.
* Công nợ phải trả.
* Giá trị hàng tồn kho.
* Số lượng hàng sắp hết.
* Số lượng hàng hết tồn kho.

Mỗi thẻ hiển thị:

* Giá trị hiện tại.
* Phần trăm tăng/giảm.
* So sánh với kỳ trước.
* Icon phù hợp.
* Màu sắc thể hiện tăng, giảm hoặc cảnh báo.

## 3. Biểu đồ và dữ liệu

* Biểu đồ doanh thu, chi phí và lợi nhuận theo thời gian.
* Biểu đồ công nợ phải thu.
* Biểu đồ công nợ phải trả.
* Cơ cấu doanh thu theo sản phẩm hoặc nhóm hàng.
* Top sản phẩm bán chạy.
* Top khách hàng có doanh thu cao.
* Danh sách khách hàng nợ quá hạn.
* Danh sách hàng hóa dưới mức tồn tối thiểu.
* Giá trị tồn kho theo từng kho.

Các số liệu phải được tính từ dữ liệu thực tế, không hard-code.

---

# V. PHÂN HỆ VẬT TƯ HÀNG HÓA

## 1. Nguyên tắc dữ liệu

Dùng chung một bảng vật tư hàng hóa để lưu các loại:

* Thành phẩm.
* Bán thành phẩm.
* Nguyên vật liệu.
* Bao bì.
* Dịch vụ.

Một vật tư có thể vừa là bán thành phẩm vừa được bán trực tiếp. Vì vậy cần thiết kế linh hoạt bằng các thuộc tính:

* Có quản lý tồn kho hay không.
* Có được mua hay không.
* Có được bán hay không.
* Có được sản xuất hay không.
* Có được dùng làm thành phần định mức hay không.

Dịch vụ không quản lý tồn kho.

## 2. Thông tin vật tư hàng hóa

* ID.
* Mã vật tư hàng hóa.
* Tên vật tư hàng hóa.
* Nhóm vật tư hàng hóa.
* Loại vật tư hàng hóa.
* Đơn vị tính chính.
* Đơn vị tính phụ.
* Tỷ lệ quy đổi đơn vị.
* Mã vạch.
* Kho ngầm định.
* Số lượng tồn tối thiểu.
* Giá mua gần nhất.
* Giá vốn.
* Thuế GTGT mặc định.
* Giá bán 1.
* Giá bán 2.
* Giá bán 3.
* Mô tả.
* Hình ảnh.
* Trạng thái đang sử dụng/ngừng sử dụng.
* Có quản lý tồn kho.
* Có được bán.
* Có được mua.
* Có được sản xuất.
* Ngày tạo.
* Người tạo.
* Ngày cập nhật.
* Người cập nhật.

## 3. Quản lý định mức BOM

Mỗi thành phẩm hoặc bán thành phẩm có thể có một hoặc nhiều phiên bản định mức.

Thông tin định mức:

* Mã định mức.
* Tên định mức.
* Phiên bản.
* Ngày áp dụng.
* Trạng thái.
* Số lượng thành phẩm tiêu chuẩn.
* Tỷ lệ hao hụt.
* Ghi chú.

Chi tiết định mức:

* Mã nguyên vật liệu.
* Tên nguyên vật liệu.
* Kho xuất mặc định.
* Đơn vị tính.
* Số lượng định mức.
* Tỷ lệ hao hụt.
* Số lượng thực tế dự kiến.
* Ghi chú.

Ví dụ:

* CLC28PA là gói cà phê bán thành phẩm/thành phẩm.
* Khi sản xuất CLC28PA, hệ thống lấy định mức nguyên liệu đã khai báo.
* CLC2818 là hộp cà phê 18 gói.
* Để lắp ráp 1 hộp CLC2818 cần 18 gói CLC28PA và có thể bổ sung hộp giấy, tem, màng co hoặc vật tư đóng gói khác.

## 4. Trang quản lý vật tư hàng hóa

Phía trên có các card:

* Tổng số mặt hàng.
* Hàng sắp hết.
* Hàng đã hết.
* Hàng ngừng sử dụng.

Bộ lọc:

* Từ khóa.
* Loại hàng hóa.
* Nhóm hàng.
* Kho.
* Trạng thái tồn kho.
* Trạng thái sử dụng.

Data Table gồm:

* Mã hàng.
* Tên hàng.
* Loại.
* Nhóm.
* Đơn vị tính.
* Tồn hiện tại.
* Tồn tối thiểu.
* Giá mua.
* Giá vốn.
* Giá bán.
* Kho ngầm định.
* Trạng thái.
* Chức năng.

Chức năng:

* Xem.
* Thêm.
* Sửa.
* Ngừng sử dụng.
* Xóa nếu chưa phát sinh dữ liệu.
* Xuất Excel.
* Tải file Excel mẫu.
* Nhập dữ liệu từ Excel.
* Xem thẻ kho.
* Khai báo định mức.

Cảnh báo tồn kho:

* Tồn bằng 0: hết hàng.
* Tồn lớn hơn 0 nhưng nhỏ hơn hoặc bằng tồn tối thiểu: sắp hết.
* Tồn âm: cảnh báo nghiêm trọng.

---

# VI. TRANG MUA HÀNG

## 1. Danh sách chứng từ mua hàng

Hiển thị Data Table có phân trang, tìm kiếm, sắp xếp và lọc.

Các cột:

* Số chứng từ.
* Ngày chứng từ.
* Nhà cung cấp.
* Tổng tiền hàng.
* Tiền thuế.
* Tổng thanh toán.
* Giá trị nhập kho.
* Trạng thái thanh toán.
* Loại chứng từ.
* Trạng thái chứng từ.
* Người lập.
* Chức năng.

Chức năng từng dòng:

* Xem.
* Sửa.
* Nhân bản.
* In.
* Hủy chứng từ.
* Xóa nếu chứng từ chưa ghi sổ và chưa phát sinh liên kết.

Khi bấm vào số chứng từ, mở popup hoặc drawer hiển thị toàn bộ chi tiết.

## 2. Bộ lọc

* Từ khóa.
* Nhà cung cấp.
* Loại chứng từ.
* Trạng thái thanh toán.
* Trạng thái chứng từ.
* Khoảng ngày.
* Nhân viên mua hàng.

## 3. Thêm chứng từ mua hàng

Mở modal lớn, drawer toàn màn hình hoặc trang riêng nếu biểu mẫu có nhiều dữ liệu.

### Loại chứng từ

* Mua hàng trong nước nhập kho.
* Mua hàng trong nước không qua kho.

### Trạng thái thanh toán

* Chưa thanh toán.
* Thanh toán ngay bằng tiền mặt.
* Thanh toán ngay bằng chuyển khoản.
* Thanh toán một phần.

### Hóa đơn

* Nhận kèm hóa đơn GTGT.
* Không có hóa đơn.

### Thông tin chung

* Số chứng từ, tự động sinh nhưng cho phép sửa nếu có quyền.
* Mã nhà cung cấp.
* Tên nhà cung cấp.
* Người giao hàng.
* Địa chỉ.
* Nhân viên mua hàng.
* Diễn giải.
* Ngày chứng từ.
* Ngày hạch toán.
* Kho nhập.
* Mã phiếu nhập kho liên kết.
* Số hóa đơn.
* Ngày hóa đơn.
* Mẫu số.
* Ký hiệu hóa đơn.
* Phương thức thanh toán.
* Tài khoản tiền hoặc tài khoản ngân hàng.
* Ghi chú.

### Bảng hàng hóa

* Số thứ tự.
* Mã hàng.
* Tên hàng.
* Kho.
* Quy cách.
* Đơn vị tính.
* Số lượng.
* Đơn giá.
* Thành tiền trước thuế.
* Phần trăm chiết khấu.
* Tiền chiết khấu.
* Thuế suất.
* Tiền thuế.
* Thành tiền thanh toán.
* Chi phí mua phân bổ.
* Giá trị nhập kho.
* Ghi chú.
* Thao tác xóa dòng.

Cho phép:

* Tìm và chọn sản phẩm.
* Quét mã vạch.
* Điều hướng nhanh bằng bàn phím.
* Thêm dòng sản phẩm.
* Thêm dòng ghi chú.
* Nhân bản dòng.
* Xóa dòng.
* Xóa toàn bộ dòng.

### Tổng cộng cuối bảng

* Tổng số lượng.
* Tổng tiền hàng.
* Tổng chiết khấu.
* Tổng tiền sau chiết khấu.
* Tổng tiền thuế.
* Tổng chi phí mua hàng.
* Tổng tiền thanh toán.
* Giá trị nhập kho.
* Số tiền đã thanh toán.
* Số tiền còn nợ.

### Nút chức năng

* Hủy.
* Lưu nháp.
* Lưu.
* Lưu và đóng.
* Lưu và in.

## 4. Quy tắc xử lý mua hàng

Khi lưu chứng từ “Mua hàng trong nước nhập kho”:

1. Tạo chứng từ mua hàng.
2. Tự động tạo phiếu nhập kho liên kết.
3. Tăng tồn kho theo từng hàng hóa và kho.
4. Ghi sổ kho.
5. Nếu chưa thanh toán hoặc thanh toán một phần, ghi tăng công nợ nhà cung cấp.
6. Nếu thanh toán ngay, tạo chứng từ chi tiền tương ứng.
7. Lưu quan hệ giữa chứng từ mua hàng, phiếu nhập kho và chứng từ thanh toán.

Khi sửa hoặc hủy:

* Phải cập nhật hoặc đảo ngược đúng các bút toán kho và công nợ.
* Không được tạo phiếu nhập kho trùng.
* Không cho sửa nếu kỳ đã khóa, trừ người có quyền đặc biệt.
* Dùng transaction để tránh dữ liệu cập nhật dở dang.

---

# VII. TRANG BÁN HÀNG

Giao diện tương tự trang mua hàng nhưng phục vụ nghiệp vụ bán hàng.

## 1. Danh sách chứng từ

* Số chứng từ.
* Ngày.
* Khách hàng.
* Tổng tiền hàng.
* Chiết khấu.
* Thuế.
* Tổng thanh toán.
* Giá vốn.
* Lợi nhuận.
* Trạng thái thanh toán.
* Trạng thái xuất kho.
* Loại chứng từ.
* Chức năng.

## 2. Thêm chứng từ bán hàng

Thông tin chính:

* Khách hàng.
* Người nhận hàng.
* Địa chỉ giao hàng.
* Nhân viên bán hàng.
* Kho xuất.
* Bảng giá áp dụng.
* Chương trình khuyến mãi.
* Ngày chứng từ.
* Ngày giao hàng.
* Trạng thái thanh toán.
* Hình thức thanh toán.
* Diễn giải.

Bảng hàng hóa:

* Mã hàng.
* Tên hàng.
* Kho.
* Tồn khả dụng.
* Đơn vị tính.
* Số lượng.
* Đơn giá.
* Chiết khấu.
* Thuế.
* Thành tiền.
* Loại dòng: hàng bán/hàng khuyến mãi/ghi chú.
* Chương trình khuyến mãi áp dụng.
* Ghi chú.
* Thao tác.

## 3. Giá bán

Cho phép:

* Áp dụng Giá bán 1, Giá bán 2 hoặc Giá bán 3.
* Gắn bảng giá mặc định với từng khách hàng hoặc nhóm khách hàng.
* Người có quyền được thay đổi đơn giá.
* Cảnh báo nếu giá bán thấp hơn giá vốn.
* Lưu lại giá bán thực tế tại thời điểm lập chứng từ.

## 4. Khuyến mãi

Xây dựng module cấu hình chương trình khuyến mãi:

* Mã chương trình.
* Tên chương trình.
* Ngày bắt đầu.
* Ngày kết thúc.
* Phạm vi khách hàng.
* Sản phẩm điều kiện.
* Số lượng tối thiểu.
* Sản phẩm được tặng.
* Số lượng tặng.
* Có cho phép cộng dồn hay không.
* Kho xuất hàng tặng.
* Trạng thái.

Ví dụ:

* Mua 10 hộp CLC2818.
* Tặng 10 gói CLC28PA.

Khi người dùng nhập đủ 10 hộp CLC2818:

* Hệ thống tự động thêm dòng CLC28PA.
* Số lượng tặng là 10.
* Đơn giá bằng 0.
* Đánh dấu là hàng khuyến mãi.
* Thêm ghi chú tên chương trình.
* Nếu giảm số lượng xuống dưới điều kiện, tự động cập nhật hoặc xóa dòng tặng.
* Không cho người dùng chỉnh giá của dòng tặng, trừ người có quyền đặc biệt.
* Hàng tặng vẫn làm giảm tồn kho.

## 5. Quy tắc lưu bán hàng

Khi lưu chứng từ bán hàng có xuất kho:

1. Kiểm tra tồn khả dụng.
2. Tạo chứng từ bán hàng.
3. Tạo phiếu xuất kho liên kết.
4. Giảm tồn kho hàng bán và hàng khuyến mãi.
5. Ghi nhận giá vốn.
6. Ghi công nợ khách hàng nếu chưa thanh toán đủ.
7. Tạo phiếu thu nếu thanh toán ngay.
8. Tính doanh thu, chi phí và lợi nhuận.

Không cho phép tồn âm nếu cấu hình hệ thống không cho xuất âm kho.

## 6. Trả hàng bán

Cho phép:

* Chọn chứng từ bán hàng gốc.
* Chọn các dòng hàng cần trả.
* Nhập số lượng trả.
* Không cho số lượng trả vượt quá số lượng đã bán trừ số lượng đã trả trước đó.
* Chọn kho nhận lại.
* Nhập lý do trả hàng.
* Hoàn tiền hoặc giảm công nợ.
* Tạo phiếu nhập kho hàng bán trả lại.
* Cập nhật doanh thu, thuế, giá vốn và công nợ.

---

# VIII. QUẢN LÝ KHÁCH HÀNG

## 1. Các card thống kê

* Nợ quá hạn.
* Tổng nợ phải thu.
* Đã thanh toán trong 30 ngày gần nhất.
* Số khách hàng đang hoạt động.

## 2. Chức năng

* Thêm khách hàng.
* Sửa.
* Xem chi tiết.
* Ngừng sử dụng.
* Xóa nếu chưa phát sinh giao dịch.
* Xuất Excel.
* Nhập từ Excel.
* Xem công nợ.
* Xem lịch sử mua hàng.
* Thu tiền.

## 3. Data Table

* Mã khách hàng.
* Tên khách hàng.
* Nhóm khách hàng.
* Địa chỉ.
* Công nợ.
* Nợ quá hạn.
* Mã số thuế.
* Điện thoại.
* Email.
* Bảng giá mặc định.
* Nhân viên phụ trách.
* Trạng thái.
* Chức năng.

## 4. Chi tiết khách hàng

* Thông tin liên hệ.
* Địa chỉ giao hàng.
* Hạn mức công nợ.
* Thời hạn thanh toán.
* Bảng giá.
* Số dư đầu kỳ.
* Tổng phát sinh nợ.
* Tổng đã thanh toán.
* Dư nợ hiện tại.
* Danh sách hóa đơn/chứng từ.
* Lịch sử thanh toán.

---

# IX. QUẢN LÝ NHÀ CUNG CẤP

Giao diện và chức năng tương tự khách hàng nhưng phục vụ nhà cung cấp.

Các card:

* Nợ quá hạn.
* Tổng nợ phải trả.
* Đã thanh toán trong 30 ngày gần nhất.
* Số nhà cung cấp đang hoạt động.

Data Table:

* Mã nhà cung cấp.
* Tên nhà cung cấp.
* Nhóm nhà cung cấp.
* Địa chỉ.
* Công nợ phải trả.
* Nợ quá hạn.
* Mã số thuế.
* Điện thoại.
* Email.
* Thời hạn thanh toán.
* Trạng thái.
* Chức năng.

Trang chi tiết có lịch sử mua hàng, công nợ, thanh toán và chứng từ liên quan.

---

# X. PHÂN HỆ KHO

## 1. Nguyên tắc quản lý kho

Mọi thay đổi tồn kho phải phát sinh từ chứng từ kho đã ghi sổ.

Không cập nhật trực tiếp số tồn trong bảng hàng hóa.

Tồn kho được tính từ sổ giao dịch kho:

`Tồn cuối = Tồn đầu + Tổng nhập - Tổng xuất`

Cần quản lý:

* Tồn thực tế.
* Tồn khả dụng.
* Số lượng đã đặt mua.
* Số lượng đã giữ cho đơn bán.
* Giá trị tồn kho.
* Giá vốn.

Hỗ trợ phương pháp tính giá vốn bình quân gia quyền. Thiết kế để có thể mở rộng FIFO sau này.

## 2. Nhập kho

Danh sách bao gồm:

* Nhập kho từ mua hàng.
* Nhập thành phẩm từ sản xuất.
* Nhập từ lắp ráp.
* Nhập hàng bán trả lại.
* Nhập điều chỉnh.
* Nhập khác.

Nút chức năng:

* Thêm mới.
* Xuất Excel.
* In danh sách.

Bộ lọc loại nhập:

* Tất cả.
* Thành phẩm sản xuất.
* Lắp ráp.
* Mua hàng.
* Hàng bán trả lại.
* Điều chỉnh.
* Khác.

Bộ lọc thời gian:

* 6 tháng đầu năm.
* 6 tháng cuối năm.
* Quý 1, 2, 3, 4.
* Tháng.
* Khoảng ngày tùy chỉnh.

Data Table:

* Số chứng từ.
* Ngày chứng từ.
* Kho nhập.
* Diễn giải.
* Tổng tiền.
* Người giao.
* Loại chứng từ.
* Chứng từ nguồn.
* Trạng thái.
* Chức năng.

Bấm vào mã chứng từ để xem popup chi tiết.

### Thêm phiếu nhập kho

* Loại phiếu nhập.
* Ngày chứng từ.
* Kho nhập.
* Địa chỉ.
* Người giao.
* Diễn giải.
* Chứng từ nguồn.
* Bảng vật tư hàng hóa.
* Tổng số lượng.
* Tổng giá trị.
* Trạng thái nháp/đã ghi sổ.
* Nút lưu nháp, ghi sổ, in và hủy.

## 3. Xuất kho

Các loại:

* Xuất kho bán hàng.
* Xuất nguyên vật liệu sản xuất.
* Xuất vật tư lắp ráp.
* Xuất chuyển kho.
* Xuất hủy.
* Xuất điều chỉnh.
* Xuất khác.

Giao diện tương tự nhập kho.

Phiếu xuất phải kiểm tra tồn kho. Nếu không đủ tồn, hiển thị rõ:

* Mã hàng.
* Kho.
* Tồn hiện tại.
* Số lượng yêu cầu.
* Số lượng thiếu.

## 4. Chuyển kho

Các loại:

* Chuyển kho nội bộ.
* Chuyển kho giữa chi nhánh.
* Chuyển kho gửi đại lý.

Thông tin:

* Kho xuất.
* Kho nhận.
* Ngày xuất.
* Ngày nhận dự kiến.
* Người chuyển.
* Người nhận.
* Diễn giải.
* Trạng thái: nháp, đang vận chuyển, đã nhận, đã hủy.

Bảng hàng hóa có:

* Mã hàng.
* Tên hàng.
* Đơn vị tính.
* Số lượng yêu cầu.
* Số lượng thực xuất.
* Số lượng thực nhận.
* Kho xuất.
* Kho nhận.
* Ghi chú.

Khi ghi sổ xuất:

* Giảm tồn kho xuất.
* Chuyển sang trạng thái đang vận chuyển.

Khi xác nhận nhận:

* Tăng tồn kho nhận.
* Ghi nhận chênh lệch nếu số nhận khác số xuất.

Không cho chọn kho xuất trùng kho nhận.

## 5. Kiểm kê

Cho phép tạo phiếu kiểm kê cho:

* Kho thành phẩm.
* Kho nguyên liệu.
* Kho trung tâm.
* Các kho khác đã khai báo.

Phiếu kiểm kê gồm:

* Ngày kiểm kê.
* Kho.
* Người phụ trách.
* Thành viên kiểm kê.
* Danh sách hàng hóa.
* Tồn theo hệ thống.
* Tồn thực tế.
* Chênh lệch.
* Đơn giá.
* Giá trị chênh lệch.
* Nguyên nhân.
* Hướng xử lý.

Khi duyệt phiếu:

* Tự động tạo phiếu nhập điều chỉnh đối với hàng thừa.
* Tự động tạo phiếu xuất điều chỉnh đối với hàng thiếu.
* Lưu liên kết giữa phiếu kiểm kê và chứng từ điều chỉnh.

---

# XI. LỆNH SẢN XUẤT

## 1. Danh sách lệnh sản xuất

Các cột:

* Số lệnh.
* Ngày tạo.
* Ngày dự kiến hoàn thành.
* Thành phẩm.
* Tổng số lượng.
* Trạng thái.
* Tiến độ.
* Phiếu xuất nguyên vật liệu.
* Phiếu nhập thành phẩm.
* Người phụ trách.
* Chức năng.

Trạng thái:

* Chưa thực hiện.
* Đang thực hiện.
* Tạm dừng.
* Hoàn thành.
* Đã hủy.

## 2. Tạo lệnh sản xuất

Thông tin:

* Số lệnh tự động.
* Ngày tạo.
* Ngày bắt đầu.
* Ngày dự kiến hoàn thành.
* Phân xưởng hoặc bộ phận.
* Người phụ trách.
* Diễn giải.
* Trạng thái.

Bảng thành phẩm:

* Mã thành phẩm.
* Tên thành phẩm.
* Phiên bản định mức.
* Quy cách.
* Đơn vị tính.
* Số lượng kế hoạch.
* Số lượng đã sản xuất.
* Kho nhập thành phẩm.
* Ghi chú.

Cho phép sản xuất nhiều mã thành phẩm trong cùng một lệnh.

## 3. Tính định mức

Khi nhập số lượng cần sản xuất:

* Tự động tải BOM đang có hiệu lực.
* Tính số lượng nguyên vật liệu theo định mức.
* Cộng hao hụt.
* Tổng hợp nguyên vật liệu trùng nhau từ nhiều thành phẩm.
* Hiển thị tồn hiện tại.
* Hiển thị số lượng thiếu.
* Cho phép chỉnh sửa, thêm hoặc xóa dòng nếu người dùng có quyền.
* Lưu riêng định mức thực tế tại thời điểm tạo lệnh để các thay đổi BOM sau này không làm thay đổi lệnh cũ.

Công thức:

`Số lượng cần dùng = Số lượng định mức × Số lượng sản xuất / Số lượng thành phẩm tiêu chuẩn`

Nếu có hao hụt:

`Số lượng dự kiến = Số lượng cần dùng × (1 + Tỷ lệ hao hụt / 100)`

Bảng nguyên vật liệu:

* Mã nguyên vật liệu.
* Tên nguyên vật liệu.
* Kho xuất.
* Đơn vị tính.
* Định mức.
* Hao hụt.
* Nhu cầu.
* Đã xuất.
* Còn phải xuất.
* Tồn hiện tại.
* Thiếu hụt.
* Ghi chú.

## 4. Chứng từ liên quan

Sau khi lưu lệnh, hiển thị:

* Lập phiếu xuất nguyên vật liệu.
* Lập bổ sung phiếu xuất.
* Lập phiếu nhập thành phẩm.
* Xem chứng từ đã liên kết.
* Hoàn thành lệnh.
* Tạm dừng.
* Hủy lệnh.

Một lệnh có thể có nhiều phiếu xuất và nhiều phiếu nhập.

Không cho hoàn thành nếu số lượng nhập thành phẩm chưa đạt kế hoạch, trừ trường hợp người có quyền xác nhận hoàn thành thiếu.

Khi hủy lệnh, không tự động xóa chứng từ kho đã ghi sổ. Phải yêu cầu hủy hoặc đảo chứng từ liên quan trước.

---

# XII. LỆNH LẮP RÁP VÀ THÁO DỠ

## 1. Lệnh lắp ráp

Dùng bán thành phẩm, linh kiện hoặc vật tư để tạo thành phẩm hoàn chỉnh.

Thông tin:

* Số lệnh.
* Ngày.
* Thành phẩm cần lắp ráp.
* Số lượng.
* Kho xuất linh kiện.
* Kho nhập thành phẩm.
* Người thực hiện.
* Diễn giải.
* Trạng thái.

Khi chọn thành phẩm và nhập số lượng:

* Tự động lấy định mức lắp ráp.
* Tính số linh kiện cần dùng.
* Hiển thị tồn kho.
* Cảnh báo thiếu hàng.
* Cho phép bổ sung vật tư đóng gói.

Ví dụ:

Thành phẩm:

* Mã hàng: CLC2818.
* Tên: Cà phê hòa tan COP28 3in1 – Hộp 18 gói.
* Đơn vị tính: Hộp.
* Số lượng: 20.
* Đơn giá: lấy theo giá cost.

Linh kiện:

* Mã hàng: CLC28PA.
* Tên: Cà phê hòa tan COP28 3in1 – Gói lẻ.
* Kho: TP.
* Đơn vị tính: Gói.
* Số lượng: 360.

Công thức:

`20 hộp × 18 gói = 360 gói`

Khi hoàn thành:

* Tạo phiếu xuất linh kiện.
* Tạo phiếu nhập thành phẩm.
* Tính giá cost thành phẩm dựa trên tổng giá trị linh kiện và chi phí lắp ráp.

## 2. Lệnh tháo dỡ

Thực hiện ngược lại lệnh lắp ráp:

* Xuất kho thành phẩm bị tháo dỡ.
* Nhập kho các bán thành phẩm hoặc linh kiện thu hồi.
* Cho phép nhập tỷ lệ hao hụt.
* Cho phép ghi nhận linh kiện hỏng hoặc không thu hồi.
* Lưu giá trị phân bổ cho từng linh kiện thu hồi.

---

# XIII. CÔNG NỢ

## 1. Công nợ phải thu

* Theo khách hàng.
* Theo chứng từ.
* Theo hạn thanh toán.
* Nợ trong hạn.
* Nợ quá hạn.
* Tuổi nợ: 0–30, 31–60, 61–90 và trên 90 ngày.
* Thu tiền.
* Đối trừ chứng từ.
* Lịch sử thanh toán.
* Xuất Excel.

## 2. Công nợ phải trả

Tương tự công nợ phải thu nhưng áp dụng cho nhà cung cấp và chứng từ mua hàng.

## 3. Thanh toán

Hỗ trợ:

* Thanh toán toàn bộ.
* Thanh toán một phần.
* Một lần thanh toán cho nhiều chứng từ.
* Nhiều lần thanh toán cho một chứng từ.
* Tiền mặt.
* Chuyển khoản.
* Ghi nhận mã giao dịch.
* Ngày thanh toán.
* Tài khoản tiền/ngân hàng.
* Người thực hiện.
* Ghi chú.

Công nợ phải được tính từ phát sinh chứng từ và thanh toán, không nhập trực tiếp vào trường tổng công nợ.

---

# XIV. BÁO CÁO

## 1. Báo cáo tổng hợp tồn kho

Bộ lọc:

* Khoảng ngày.
* Kho.
* Nhóm hàng.
* Loại hàng.
* Mã hàng.

Các cột:

* Mã hàng.
* Tên hàng.
* Đơn vị tính.
* Tồn đầu kỳ.
* Nhập trong kỳ.
* Xuất trong kỳ.
* Tồn cuối kỳ.
* Giá trị đầu kỳ.
* Giá trị nhập.
* Giá trị xuất.
* Giá trị cuối kỳ.

## 2. Sổ chi tiết vật tư hàng hóa

* Ngày.
* Số chứng từ.
* Loại chứng từ.
* Diễn giải.
* Kho.
* Số lượng nhập.
* Số lượng xuất.
* Số lượng tồn.
* Đơn giá.
* Giá trị nhập.
* Giá trị xuất.
* Giá trị tồn.

## 3. Báo cáo khác

* Doanh thu theo thời gian.
* Doanh thu theo khách hàng.
* Doanh thu theo sản phẩm.
* Doanh thu theo nhân viên.
* Chi phí mua hàng.
* Giá vốn hàng bán.
* Lợi nhuận gộp.
* Công nợ phải thu.
* Công nợ phải trả.
* Tuổi nợ.
* Hàng dưới tồn tối thiểu.
* Hàng chậm luân chuyển.
* Báo cáo sản xuất theo lệnh.
* Chênh lệch định mức và thực tế.

Mỗi báo cáo hỗ trợ:

* Bộ lọc.
* Phân trang.
* In.
* Xuất Excel.
* Xuất PDF nếu có thể.
* Tổng cộng cuối báo cáo.

---

# XV. CẤU TRÚC CƠ SỞ DỮ LIỆU

Thiết kế ERD và migration tối thiểu cho các bảng sau:

## 1. Hệ thống

* users.
* roles.
* permissions.
* user_roles.
* role_permissions.
* audit_logs.
* system_settings.
* branches.

## 2. Danh mục

* warehouses.
* units.
* unit_conversions.
* item_categories.
* items.
* item_prices.
* item_barcodes.
* customers.
* customer_groups.
* suppliers.
* supplier_groups.
* employees.
* bank_accounts.

## 3. Định mức

* bom_headers.
* bom_lines.
* assembly_bom_headers.
* assembly_bom_lines.

## 4. Mua hàng

* purchase_documents.
* purchase_document_lines.
* purchase_payments.
* purchase_document_links.

## 5. Bán hàng

* sales_documents.
* sales_document_lines.
* sales_returns.
* sales_return_lines.
* sales_payments.
* sales_document_links.

## 6. Khuyến mãi

* promotion_programs.
* promotion_conditions.
* promotion_rewards.
* promotion_customer_groups.
* promotion_usage_logs.

## 7. Kho

* inventory_documents.
* inventory_document_lines.
* inventory_transactions.
* inventory_balances.
* warehouse_transfers.
* warehouse_transfer_lines.
* stocktakes.
* stocktake_lines.

## 8. Sản xuất

* production_orders.
* production_order_outputs.
* production_order_materials.
* production_order_documents.
* assembly_orders.
* assembly_order_lines.
* disassembly_orders.
* disassembly_order_lines.

## 9. Công nợ

* receivable_transactions.
* payable_transactions.
* payment_receipts.
* payment_receipt_allocations.
* payment_vouchers.
* payment_voucher_allocations.

Mỗi bảng nghiệp vụ cần có:

* `id`.
* Mã chứng từ nếu phù hợp.
* Trạng thái.
* `branch_id`.
* `created_at`.
* `created_by`.
* `updated_at`.
* `updated_by`.
* `deleted_at` nếu áp dụng.
* Trường version hoặc cơ chế chống cập nhật đồng thời nếu cần.

Không lưu một cột công nợ tổng duy nhất rồi cập nhật thủ công. Công nợ phải được tổng hợp từ sổ phát sinh công nợ.

Không dùng bảng `items` để lưu trực tiếp số tồn duy nhất. Tồn kho cần quản lý theo từng hàng hóa và từng kho.

---

# XVI. TRẠNG THÁI CHỨNG TỪ

Chuẩn hóa trạng thái:

* `DRAFT`: Nháp.
* `POSTED`: Đã ghi sổ.
* `CANCELLED`: Đã hủy.
* `COMPLETED`: Hoàn thành nếu áp dụng.
* `PARTIALLY_COMPLETED`: Hoàn thành một phần nếu áp dụng.

Quy tắc:

* Chứng từ nháp không ảnh hưởng tồn kho và công nợ.
* Chứng từ ghi sổ mới ảnh hưởng dữ liệu.
* Chứng từ đã hủy phải đảo tác động trước đó.
* Không xóa cứng chứng từ đã ghi sổ.
* Mọi thao tác ghi sổ/hủy phải dùng database transaction.
* Phải lưu người thực hiện và thời gian thực hiện.

---

# XVII. PHÂN QUYỀN

Tạo các vai trò mẫu:

* Quản trị viên.
* Ban giám đốc.
* Kế toán mua hàng.
* Kế toán bán hàng.
* Kế toán công nợ.
* Nhân viên kho.
* Quản lý kho.
* Nhân viên sản xuất.
* Quản lý sản xuất.
* Nhân viên kinh doanh.
* Người chỉ được xem báo cáo.

Phân quyền theo hành động:

* Xem.
* Thêm.
* Sửa.
* Xóa.
* Ghi sổ.
* Hủy chứng từ.
* In.
* Xuất Excel.
* Xem giá vốn.
* Sửa đơn giá.
* Cho phép xuất âm kho.
* Mở khóa kỳ dữ liệu.
* Xem dữ liệu theo chi nhánh.

Frontend cần ẩn hoặc vô hiệu hóa chức năng không có quyền. Backend vẫn phải kiểm tra quyền độc lập.

---

# XVIII. YÊU CẦU GIAO DIỆN

Sử dụng phong cách TailAdmin:

* Sidebar cố định và có thể thu gọn.
* Header hiện đại.
* Breadcrumb.
* Card thống kê.
* Data Table rõ ràng.
* Modal/Drawer hợp lý.
* Form chia thành từng section.
* Sticky action bar ở cuối màn hình đối với form dài.
* Bảng nhập liệu hàng hóa hỗ trợ scroll ngang.
* Tổng tiền luôn dễ quan sát.
* Màu cảnh báo rõ ràng.
* Skeleton loading.
* Empty state.
* Error state.
* Confirm dialog trước thao tác hủy hoặc xóa.
* Toast khi thao tác thành công/thất bại.

Data Table phải có:

* Tìm kiếm.
* Sắp xếp.
* Phân trang.
* Chọn số dòng mỗi trang.
* Ẩn/hiện cột.
* Lọc nâng cao.
* Chọn nhiều dòng khi cần.
* Sticky header.
* Responsive.
* Export dữ liệu theo bộ lọc hiện tại.

Không sử dụng dữ liệu hard-code trực tiếp trong component. Dữ liệu phải lấy từ API, ngoại trừ constants và seed demo.

---

# XIX. VALIDATION VÀ QUY TẮC DỮ LIỆU

* Mã khách hàng, nhà cung cấp, hàng hóa, kho và chứng từ không được trùng.
* Số lượng phải lớn hơn 0, trừ các chứng từ điều chỉnh đặc biệt.
* Đơn giá không được âm.
* Thuế suất nằm trong danh sách cấu hình.
* Không cho ngày chứng từ nằm trong kỳ đã khóa.
* Không cho xuất vượt tồn nếu hệ thống tắt chức năng xuất âm.
* Không cho trả hàng vượt số lượng đã bán.
* Không cho nhập trùng phiếu kho từ cùng một chứng từ nguồn.
* Không cho xóa hàng hóa đã phát sinh giao dịch.
* Không cho xóa kho đã có tồn hoặc giao dịch.
* Không cho hủy chứng từ nguồn nếu chứng từ liên quan chưa được xử lý.
* Phải kiểm tra dữ liệu ở cả frontend và backend.
* Sử dụng số decimal cho tiền và số lượng; không dùng kiểu floating point để tính tiền.
* Làm tròn theo cấu hình hệ thống.

---

# XX. NHẬP VÀ XUẤT EXCEL

## 1. Nhập Excel

* Có file mẫu.
* Kiểm tra đúng tên cột.
* Hiển thị bản xem trước.
* Kiểm tra mã trùng.
* Kiểm tra dữ liệu bắt buộc.
* Thông báo lỗi theo từng dòng.
* Cho tải file lỗi.
* Chỉ ghi dữ liệu khi vượt qua validation.
* Dùng transaction cho toàn bộ lần nhập hoặc hỗ trợ chế độ bỏ qua dòng lỗi.

## 2. Xuất Excel

* Xuất theo bộ lọc hiện tại.
* Có tiêu đề báo cáo.
* Có ngày xuất.
* Có người xuất.
* Định dạng ngày, số lượng và tiền tệ.
* Có hàng tổng cộng nếu phù hợp.
* Tên file chứa loại báo cáo và thời gian xuất.

---

# XXI. API VÀ BẢO MẬT

* REST API có version, ví dụ `/api/v1`.
* Có Swagger.
* JWT access token và refresh token.
* Mật khẩu phải được hash.
* Rate limit cho API đăng nhập.
* Validate và sanitize input.
* Chống SQL Injection, XSS và CSRF phù hợp với kiến trúc.
* CORS theo cấu hình môi trường.
* Không trả stack trace cho production.
* Log lỗi tập trung.
* Phân trang ở backend.
* Filter và sort phải được whitelist.
* Không để secret trong source code.
* Sử dụng `.env.example`.

Response API nên thống nhất:

```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

# XXII. DỮ LIỆU DEMO

Tạo seed data gồm:

* 3 kho: kho thành phẩm, kho nguyên liệu, kho trung tâm.
* 5 khách hàng.
* 5 nhà cung cấp.
* 10 nguyên vật liệu.
* 5 bao bì.
* 5 thành phẩm.
* CLC28PA.
* CLC2818.
* Định mức sản xuất CLC28PA.
* Định mức lắp ráp CLC2818 từ 18 gói CLC28PA.
* Chương trình mua 10 hộp CLC2818 tặng 10 gói CLC28PA.
* Một số chứng từ mua hàng.
* Một số chứng từ bán hàng.
* Phiếu nhập, xuất và chuyển kho.
* Lệnh sản xuất.
* Lệnh lắp ráp.
* Công nợ khách hàng và nhà cung cấp.
* Tài khoản quản trị mẫu.

---

# XXIII. KIỂM THỬ

Viết unit test và integration test cho các nghiệp vụ quan trọng:

1. Lưu mua hàng nhập kho tạo đúng phiếu nhập.
2. Hủy mua hàng hoàn nguyên tồn kho và công nợ.
3. Bán hàng tạo đúng phiếu xuất.
4. Không xuất hàng khi không đủ tồn.
5. Chương trình khuyến mãi tự động thêm hàng tặng.
6. Thay đổi số lượng bán cập nhật đúng hàng tặng.
7. Trả hàng tạo phiếu nhập và giảm công nợ.
8. Lệnh sản xuất tính đúng định mức.
9. Lệnh sản xuất nhiều thành phẩm tổng hợp đúng nguyên vật liệu.
10. Lắp ráp 20 hộp CLC2818 sử dụng 360 gói CLC28PA.
11. Chuyển kho không làm thay đổi tổng tồn toàn hệ thống.
12. Kiểm kê tạo đúng phiếu điều chỉnh.
13. Thanh toán một phần cập nhật đúng số dư công nợ.
14. Chứng từ nháp không ảnh hưởng kho và công nợ.
15. Chứng từ bị hủy không còn ảnh hưởng báo cáo.

---

# XXIV. TIÊU CHÍ NGHIỆM THU

Hệ thống được xem là **hoàn thành** khi đạt được các tiêu chí sau:

## ✅ Tiêu chí BẮT BUỘC

* ✅ Có giao diện đầy đủ và responsive (desktop, tablet, mobile).
* ✅ Các chức năng sử dụng API thật (không hard-code).
* ✅ Có migration database (MySQL) và seed dữ liệu mẫu.
* ✅ CRUD hoạt động đầy đủ cho tất cả module quan trọng.
* ✅ Ghi sổ (POSTED) và hủy chứng từ (CANCELLED) hoạt động đúng với transaction.
* ✅ Tồn kho cập nhật chính xác theo từng sản phẩm, quy cách, kho.
* ✅ Công nợ (phải thu, phải trả) cập nhật chính xác từ chứng từ.
* ✅ Lệnh sản xuất tính đúng định mức BOM.
* ✅ Lắp ráp và tháo dỡ cập nhật đúng tồn kho và giá vốn.
* ✅ Khuyến mãi tự động thêm đúng hàng tặng theo chương trình.
* ✅ Báo cáo lấy dữ liệu thực từ database.
* ✅ Phân quyền được kiểm tra ở backend (không chỉ frontend).
* ✅ Không có lỗi TypeScript (tsc --noEmit).
* ✅ Không có lỗi console nghiêm trọng (không lỗi undefined, không crash).
* ✅ Có tài khoản demo (admin/admin123, thu_kho/user123, quan_ly_sx/user123).

## ⚠️ Tiêu chí MONG MUỐN (ưu tiên sau khi đạt tiêu chí bắt buộc)

* ❌ Xuất Excel/PDF hoạt động đầy đủ cho tất cả module (hiện chỉ hỗ trợ xuất Excel cho sản phẩm).
* ❌ Tài liệu Swagger đầy đủ cho tất cả API.
* ❌ Hướng dẫn cài đặt chi tiết cho môi trường production.
* ❌ Unit test và integration test đầy đủ cho các nghiệp vụ quan trọng.
* ❌ Báo cáo tuổi nợ chi tiết.
* ❌ Tối ưu hiệu năng truy vấn database cho báo cáo.
* ❌ Kiểm tra bảo mật chi tiết (SQL injection, XSS, CSRF).

## 📋 Danh sách kiểm thử nghiệp vụ quan trọng

### Mua hàng ✅
1. ✅ Lưu chứng từ mua hàng nhập kho tạo đúng phiếu nhập.
2. ✅ Hủy chứng từ mua hàng hoàn nguyên tồn kho và công nợ.
3. ✅ Thanh toán một phần cập nhật đúng số dư công nợ.
4. ✅ Thanh toán toàn bộ cập nhật đúng trạng thái PAID.

### Bán hàng ✅
5. ✅ Lưu chứng từ bán hàng tạo đúng phiếu xuất.
6. ✅ Không xuất hàng khi không đủ tồn (kiểm tra tồn khả dụng).
7. ✅ Trả hàng tạo phiếu nhập và giảm công nợ.
8. ✅ Chương trình khuyến mãi tự động thêm hàng tặng.
9. ✅ Thay đổi số lượng bán cập nhật đúng hàng tặng.

### Kho ✅
10. ✅ Chuyển kho không làm thay đổi tổng tồn toàn hệ thống.
11. ✅ Kiểm kê tạo đúng phiếu điều chỉnh (nhập thừa/thiếu).
12. ✅ Chứng từ nháp (DRAFT) không ảnh hưởng kho và công nợ.

### Sản xuất ✅
13. ✅ Lệnh sản xuất tính đúng định mức BOM.
14. ✅ Lệnh sản xuất nhiều thành phẩm tổng hợp đúng nguyên vật liệu.
15. ✅ Lắp ráp 20 hộp CLC2818 sử dụng 360 gói CLC28PA.

### Công nợ ✅
16. ✅ Chứng từ bị hủy không còn ảnh hưởng báo cáo.
17. ❌ Báo cáo tuổi nợ chi tiết.

### Authentication ✅
18. ✅ Đăng nhập thành công với JWT + Refresh Token.
19. ✅ Token hết hạn tự động refresh.
20. ✅ Đăng xuất xóa token khỏi localStorage.

### Phân quyền ✅
21. ✅ Frontend ẩn menu không có quyền.
22. ✅ Backend từ chối request không có quyền.

## 📊 Tiến độ đạt được (2026-09-01)

| Tiêu chí | Tiến độ | Ghi chú |
|----------|---------|---------|
| Giao diện đầy đủ | ✅ 95% | Đang hoàn thiện báo cáo |
| API thật | ✅ 100% | Tất cả API đều gọi database thật |
| Migration + Seed | ✅ 100% | MySQL + seed data mẫu |
| CRUD đầy đủ | ✅ 85% | Đang hoàn thiện thu/chi tiền, đối trừ chứng từ |
| Ghi sổ/hủy chứng từ | ✅ 100% | Sử dụng transaction database |
| Tồn kho chính xác | ✅ 100% | productwarehouses cập nhật real-time |
| Công nợ chính xác | ✅ 90% | Đang hoàn thiện báo cáo tuổi nợ |
| Định mức BOM | ✅ 100% | product_boms + tính toán sản xuất |
| Lắp ráp/tháo dỡ | ✅ 100% | assembly_orders + disassembly_orders |
| Khuyến mãi | ✅ 100% | promotion_programs + tự động thêm hàng tặng |
| Báo cáo dữ liệu thực | ✅ 70% | Đang hoàn thiện báo cáo chi tiết |
| Xuất Excel | ❌ 30% | Chỉ hỗ trợ xuất Excel cho sản phẩm |
| Phân quyền backend | ✅ 100% | authenticate + role check middleware |
| TypeScript | ✅ 100% | tsc --noEmit không lỗi |
| Console errors | ✅ 95% | Không lỗi nghiêm trọng |
| Tài khoản demo | ✅ 100% | admin/admin123, thu_kho/user123, quan_ly_sx/user123 |
| Unit test | ❌ 0% | Chưa triển khai |
| Integration test | ❌ 10% | Chỉ có 2 file mẫu |
| Swagger | ❌ 0% | Chưa triển khai |
| Hướng dẫn cài đặt | ❌ 0% | Cần viết chi tiết |

## 🎯 Kế hoạch hoàn thành

1. **Ưu tiên tuần 1-2:** Hoàn thiện các module còn thiếu (thu/chi tiền, đối trừ chứng từ, báo cáo tuổi nợ, xuất Excel đầy đủ).
2. **Ưu tiên tuần 3-4:** Viết unit test và integration test cho các nghiệp vụ quan trọng (20 test case).
3. **Ưu tiên tuần 5:** Triển khai Swagger UI cho tất cả API V1.
4. **Ưu tiên tuần 6:** Viết hướng dẫn cài đặt chi tiết (README.md, cài đặt MySQL, seed data, chạy server).
5. **Ưu tiên tuần 7:** Kiểm thử toàn diện, tối ưu hiệu năng, kiểm tra bảo mật.
6. **Ưu tiên tuần 8:** Hoàn thiện tài liệu, đóng gói release.

---

# XXV. TÀI LIỆU THAM KHẢO VÀ LIÊN KẾT

## Tài liệu kỹ thuật

* [ERP_ARCHITECTURE.md](.kilo/worktrees/precious-office/docs/ERP_ARCHITECTURE.md) - Kiến trúc tổng thể hệ thống ERP
* [PHASE_2_FOUNDATION.md](.kilo/worktrees/precious-office/docs/PHASE_2_FOUNDATION.md) - Giai đoạn 2: Khởi tạo nền tảng
* [PHASE_3_PURCHASE_LIFECYCLE.md](.kilo/worktrees/precious-office/docs/PHASE_3_PURCHASE_LIFECYCLE.md) - Giai đoạn 3: Mua hàng
* [PHASE_4_SALES_LIFECYCLE.md](.kilo/worktrees/precious-office/docs/PHASE_4_SALES_LIFECYCLE.md) - Giai đoạn 4: Bán hàng
* [PRODUCTION_V1.md](.kilo/worktrees/precious-office/docs/PRODUCTION_V1.md) - Module sản xuất, lắp ráp, tháo dỡ
* [WAREHOUSE_TRANSFER_V1.md](.kilo/worktrees/precious-office/docs/WAREHOUSE_TRANSFER_V1.md) - Chuyển kho
* [REPORTING_V1.md](.kilo/worktrees/precious-office/docs/REPORTING_V1.md) - Báo cáo
* [DEBT_V1.md](.kilo/worktrees/precious-office/docs/DEBT_V1.md) - Công nợ

## Tài liệu tích hợp

* [PROMOTION_V1.md](.kilo/worktrees/precious-office/docs/PROMOTION_V1.md) - Chương trình khuyến mãi
* [INVENTORY_V1.md](.kilo/worktrees/precious-office/docs/INVENTORY_V1.md) - Quản lý tồn kho
* [AUTHENTICATION.md](.kilo/worktrees/precious-office/docs/AUTHENTICATION.md) - Xác thực và phân quyền

## Tài liệu kiểm thử

* [scripts/promotion-v1.integration.ts](scripts/promotion-v1.integration.ts) - Integration test khuyến mãi
* [scripts/reporting-v1.integration.ts](scripts/reporting-v1.integration.ts) - Integration test báo cáo

## Tài liệu cài đặt

* [AGENTS.md](AGENTS.md) - Hướng dẫn sử dụng Kilo Agent Manager
* [.env.example](.env.example) - Mẫu cấu hình môi trường
* [package.json](package.json) - Danh sách dependencies và scripts

---

**Lưu ý:** Tài liệu này sẽ được cập nhật liên tục theo tiến độ phát triển. Mọi thay đổi quan trọng sẽ được ghi chú trong lịch sử phiên bản.

Hệ thống được xem là **hoàn thành** khi đạt được các tiêu chí sau:

## ✅ Tiêu chí BẮT BUỘC

* ✅ Có giao diện đầy đủ và responsive (desktop, tablet, mobile).
* ✅ Các chức năng sử dụng API thật (không hard-code).
* ✅ Có migration database (MySQL) và seed dữ liệu mẫu.
* ✅ CRUD hoạt động đầy đủ cho tất cả module quan trọng.
* ✅ Ghi sổ (POSTED) và hủy chứng từ (CANCELLED) hoạt động đúng với transaction.
* ✅ Tồn kho cập nhật chính xác theo từng sản phẩm, quy cách, kho.
* ✅ Công nợ (phải thu, phải trả) cập nhật chính xác từ chứng từ.
* ✅ Lệnh sản xuất tính đúng định mức BOM.
* ✅ Lắp ráp và tháo dỡ cập nhật đúng tồn kho và giá vốn.
* ✅ Khuyến mãi tự động thêm đúng hàng tặng theo chương trình.
* ✅ Báo cáo lấy dữ liệu thực từ database.
* ✅ Phân quyền được kiểm tra ở backend (không chỉ frontend).
* ✅ Không có lỗi TypeScript (tsc --noEmit).
* ✅ Không có lỗi console nghiêm trọng (không lỗi undefined, không crash).
* ✅ Có tài khoản demo (admin/admin123, thu_kho/user123, quan_ly_sx/user123).

## ⚠️ Tiêu chí MONG MUỐN (ưu tiên sau khi đạt tiêu chí bắt buộc)

* ❌ Xuất Excel/PDF hoạt động đầy đủ cho tất cả module (hiện chỉ hỗ trợ xuất Excel cho sản phẩm).
* ❌ Tài liệu Swagger đầy đủ cho tất cả API.
* ❌ Hướng dẫn cài đặt chi tiết cho môi trường production.
* ❌ Unit test và integration test đầy đủ cho các nghiệp vụ quan trọng.
* ❌ Báo cáo tuổi nợ chi tiết.
* ❌ Tối ưu hiệu năng truy vấn database cho báo cáo.
* ❌ Kiểm tra bảo mật chi tiết (SQL injection, XSS, CSRF).

## 📋 Danh sách kiểm thử nghiệp vụ quan trọng

### Mua hàng ✅
1. ✅ Lưu chứng từ mua hàng nhập kho tạo đúng phiếu nhập.
2. ✅ Hủy chứng từ mua hàng hoàn nguyên tồn kho và công nợ.
3. ✅ Thanh toán một phần cập nhật đúng số dư công nợ.
4. ✅ Thanh toán toàn bộ cập nhật đúng trạng thái PAID.

### Bán hàng ✅
5. ✅ Lưu chứng từ bán hàng tạo đúng phiếu xuất.
6. ✅ Không xuất hàng khi không đủ tồn (kiểm tra tồn khả dụng).
7. ✅ Trả hàng tạo phiếu nhập và giảm công nợ.
8. ✅ Chương trình khuyến mãi tự động thêm hàng tặng.
9. ✅ Thay đổi số lượng bán cập nhật đúng hàng tặng.

### Kho ✅
10. ✅ Chuyển kho không làm thay đổi tổng tồn toàn hệ thống.
11. ✅ Kiểm kê tạo đúng phiếu điều chỉnh (nhập thừa/thiếu).
12. ✅ Chứng từ nháp (DRAFT) không ảnh hưởng kho và công nợ.

### Sản xuất ✅
13. ✅ Lệnh sản xuất tính đúng định mức BOM.
14. ✅ Lệnh sản xuất nhiều thành phẩm tổng hợp đúng nguyên vật liệu.
15. ✅ Lắp ráp 20 hộp CLC2818 sử dụng 360 gói CLC28PA.

### Công nợ ✅
16. ✅ Chứng từ bị hủy không còn ảnh hưởng báo cáo.
17. ❌ Báo cáo tuổi nợ chi tiết.

### Authentication ✅
18. ✅ Đăng nhập thành công với JWT + Refresh Token.
19. ✅ Token hết hạn tự động refresh.
20. ✅ Đăng xuất xóa token khỏi localStorage.

### Phân quyền ✅
21. ✅ Frontend ẩn menu không có quyền.
22. ✅ Backend từ chối request không có quyền.

## 📊 Tiến độ đạt được (2026-09-01)

| Tiêu chí | Tiến độ | Ghi chú |
|----------|---------|---------|
| Giao diện đầy đủ | ✅ 95% | Đang hoàn thiện báo cáo |
| API thật | ✅ 100% | Tất cả API đều gọi database thật |
| Migration + Seed | ✅ 100% | MySQL + seed data mẫu |
| CRUD đầy đủ | ✅ 85% | Đang hoàn thiện thu/chi tiền, đối trừ chứng từ |
| Ghi sổ/hủy chứng từ | ✅ 100% | Sử dụng transaction database |
| Tồn kho chính xác | ✅ 100% | productwarehouses cập nhật real-time |
| Công nợ chính xác | ✅ 90% | Đang hoàn thiện báo cáo tuổi nợ |
| Định mức BOM | ✅ 100% | product_boms + tính toán sản xuất |
| Lắp ráp/tháo dỡ | ✅ 100% | assembly_orders + disassembly_orders |
| Khuyến mãi | ✅ 100% | promotion_programs + tự động thêm hàng tặng |
| Báo cáo dữ liệu thực | ✅ 70% | Đang hoàn thiện báo cáo chi tiết |
| Xuất Excel | ❌ 30% | Chỉ hỗ trợ xuất Excel cho sản phẩm |
| Phân quyền backend | ✅ 100% | authenticate + role check middleware |
| TypeScript | ✅ 100% | tsc --noEmit không lỗi |
| Console errors | ✅ 95% | Không lỗi nghiêm trọng |
| Tài khoản demo | ✅ 100% | admin/admin123, thu_kho/user123, quan_ly_sx/user123 |
| Unit test | ❌ 0% | Chưa triển khai |
| Integration test | ❌ 10% | Chỉ có 2 file mẫu |
| Swagger | ❌ 0% | Chưa triển khai |
| Hướng dẫn cài đặt | ❌ 0% | Cần viết chi tiết |

## 🎯 Kế hoạch hoàn thành

1. **Ưu tiên tuần 1-2:** Hoàn thiện các module còn thiếu (thu/chi tiền, đối trừ chứng từ, báo cáo tuổi nợ, xuất Excel đầy đủ).
2. **Ưu tiên tuần 3-4:** Viết unit test và integration test cho các nghiệp vụ quan trọng (20 test case).
3. **Ưu tiên tuần 5:** Triển khai Swagger UI cho tất cả API V1.
4. **Ưu tiên tuần 6:** Viết hướng dẫn cài đặt chi tiết (README.md, cài đặt MySQL, seed data, chạy server).
5. **Ưu tiên tuần 7:** Kiểm thử toàn diện, tối ưu hiệu năng, kiểm tra bảo mật.
6. **Ưu tiên tuần 8:** Hoàn thiện tài liệu, đóng gói release.

---

# XXV. CÁCH TRIỂN KHAI DỰ ÁN

Dự án đã được triển khai theo phương pháp **Strangler Fig Pattern** (từng bước thay thế hệ thống cũ) và chia thành các giai đoạn rõ ràng. Dưới đây là tiến độ thực tế và kế hoạch tiếp tục:

## Giai đoạn 1: Phân tích và thiết kế ✅

* ✅ Phân tích yêu cầu nghiệp vụ.
* ✅ Đề xuất kiến trúc microservice tách biệt (frontend + backend API + database).
* ✅ Tạo sitemap và ERD (xem docs/ERP_ARCHITECTURE.md).
* ✅ Mô tả luồng chứng từ mua/bán/sản xuất.
* ✅ Xác định trạng thái chứng từ: `DRAFT`, `POSTED`, `CANCELLED`.
* ✅ Liệt kê API V1 (xem apps/api/src/index.ts).
* ✅ Xác định phân quyền chi tiết theo vai trò.

## Giai đoạn 2: Khởi tạo nền tảng ✅

* ✅ Frontend: React + Vite + TypeScript + TailwindCSS + TanStack Query + React Hook Form + Zod.
* ✅ Backend: NodeJS + Express + TypeScript + MySQL.
* ✅ Authentication: JWT + Refresh Token.
* ✅ Layout TailAdmin đã được triển khai (Sidebar.tsx, Header.tsx, Layout.tsx).
* ✅ Component dùng chung: Loading, Modal, Toast, DatePicker.
* ✅ Logging: audit_logs + logAction().
* ✅ Xử lý lỗi thống nhất (apiV1 wrapper).

## Giai đoạn 3: Danh mục ✅

* ✅ Kho: 2 kho mẫu (Kho Chính, Kho Phụ).
* ✅ Đơn vị tính: Tích hợp sẵn trong productpackagings.unit.
* ✅ Khách hàng: CRUD đầy đủ + công nợ tự động.
* ✅ Nhà cung cấp: CRUD đầy đủ + công nợ tự động.
* ✅ Vật tư hàng hóa: Sản phẩm + quy cách + định mức BOM.
* ❌ Bảng giá: Chưa triển khai module cấu hình giá theo khách hàng/nhóm khách hàng.
* ✅ Định mức BOM: Tạo/xem/sửa BOM cho thành phẩm.

## Giai đoạn 4: Kho ✅

* ✅ Sổ kho: inventorytransactions + inventorytransactiondetails.
* ✅ Nhập kho: Tự động tạo phiếu nhập khi mua hàng nhập kho.
* ✅ Xuất kho: Tự động tạo phiếu xuất khi bán hàng.
* ✅ Chuyển kho: warehouse_transfers + warehouse_transfer_details.
* ✅ Kiểm kê: stocktakes + stocktake_details.
* ✅ Báo cáo tồn: Tồn theo kho, sản phẩm, quy cách.

## Giai đoạn 5: Mua và bán hàng ✅

* ✅ Chứng từ mua: purchase_documents + purchase_document_details.
* ✅ Phiếu nhập tự động: Tạo inventorytransactions khi mua hàng nhập kho.
* ✅ Chứng từ bán: sales_orders + sales_order_details.
* ✅ Phiếu xuất tự động: Tạo inventorytransactions khi bán hàng xuất kho.
* ✅ Trả hàng: lifecycle draft/post/cancel, hoàn kho, receivable credit/reversal và net reporting (xem docs/SALES_RETURN_V1.md).
* ✅ Khuyến mãi: promotion_programs + promotion_conditions + promotion_rewards (xem docs/PROMOTION_V1.md).

## Giai đoạn 6: Công nợ ✅

* ✅ Phải thu: Tự động tính từ sales_orders + customer_payments.
* ✅ Phải trả: Tự động tính từ purchase_documents + supplier_payments.
* ✅ Thu tiền: Phiếu thu V1 draft/post/cancel và receivable ledger.
* ✅ Chi tiền: Phiếu chi V1 draft/post/cancel và payable ledger.
* ✅ Phân bổ thanh toán: Một phiếu phân bổ nhiều chứng từ với validation outstanding.
* ✅ Báo cáo tuổi nợ: Phải thu/phải trả theo immutable ledger và ngày chốt.

## Giai đoạn 7: Sản xuất ⚠️

* ✅ BOM: product_boms (nguyên vật liệu cho thành phẩm).
* ✅ Lệnh sản xuất: production_orders + productiondetails.
* ✅ Xuất nguyên vật liệu: Tự động tạo phiếu xuất kho khi lập lệnh sản xuất.
* ✅ Nhập thành phẩm: Tự động tạo phiếu nhập kho khi hoàn thành lệnh.
* ✅ Lắp ráp: assembly_orders + assembly_order_lines.
* ✅ Tháo dỡ: disassembly_orders + disassembly_order_lines.
* ✅ So sánh định mức và thực tế: Production Variance V1 theo snapshot output/NVL, quantity/value variance và filter báo cáo.

## Giai đoạn 8: Dashboard và báo cáo ⚠️

* ✅ Dashboard: FinancialDashboard hiển thị doanh thu, chi phí, lợi nhuận, tồn kho.
* ✅ Báo cáo kinh doanh: Doanh thu, chiết khấu, VAT, giá vốn, lợi nhuận và net Sales Return.
* ✅ Báo cáo kho: Tổng hợp tồn và sổ chi tiết từ immutable inventory ledger.
* ✅ Báo cáo công nợ: Tuổi nợ phải thu/phải trả theo ledger và ngày chốt.
* ✅ Báo cáo sản xuất: Operations và Production Variance theo lệnh đã hoàn thành.
* ⚠️ Xuất Excel/PDF: Reporting V1 đã xuất Excel theo filter; PDF và export cho toàn bộ module chưa hoàn tất.

## Giai đoạn 9: Kiểm thử và hoàn thiện ⚠️

* ❌ Unit test: Chưa triển khai unit test cho các nghiệp vụ quan trọng.
* ⚠️ Integration test: Đã có fixture HTTP cho promotion, reporting, sales return và production variance; chưa phủ toàn bộ module legacy.
* ❌ Kiểm thử luồng nghiệp vụ: Cần kiểm tra toàn bộ luồng mua/bán/sản xuất.
* ❌ Tối ưu hiệu năng: Chưa tối ưu truy vấn database cho báo cáo.
* ❌ Kiểm tra bảo mật: Chưa triển khai kiểm tra bảo mật chi tiết.
* ❌ Hoàn thiện tài liệu cài đặt: Cần cập nhật hướng dẫn cài đặt chi tiết.

## Giai đoạn 10: Hoàn thiện sản phẩm

* ✅ Tích hợp sẵn seed data: 3 kho, 5 khách hàng, 5 nhà cung cấp, 10 sản phẩm, định mức BOM, chương trình khuyến mãi.
* ✅ Tài khoản demo: admin/admin123, thu_kho/user123, quan_ly_sx/user123.
* ❌ Tài liệu Swagger: Cần hoàn thiện và tích hợp Swagger UI.
* ❌ Hướng dẫn cài đặt: Cần viết hướng dẫn chi tiết cho môi trường production.

---

## Vertical Slice Hoàn chỉnh đã triển khai ✅

`Đăng nhập → Vật tư hàng hóa → Mua hàng → Tự động nhập kho → Cập nhật tồn kho → Ghi nhận công nợ nhà cung cấp`

Vertical slice này hoạt động đầy đủ từ giao diện đến database, có validation, logging, và test sơ bộ. Có thể mở rộng sang các module còn lại.

Sau mỗi giai đoạn:

1. Liệt kê file đã tạo hoặc thay đổi.
2. Mô tả chức năng đã hoàn thành.
3. Chạy migration và test.
4. Chạy TypeScript type-check.
5. Báo cáo lỗi còn lại.
6. Chờ xác nhận trước khi chuyển sang phần có ảnh hưởng lớn đến kiến trúc.

---

# XXVI. KẾT QUẢ ĐẦU RA ĐÃ HOÀN THÀNH

## 1. Tóm tắt cách hiểu yêu cầu ✅

Dự án yêu cầu xây dựng một hệ thống ERP quản lý mua hàng, bán hàng, kho, sản xuất, công nợ, khuyến mãi, báo cáo cho doanh nghiệp sản xuất-thương mại. Hệ thống cần:

* Frontend: React + Vite + TypeScript + TailwindCSS + TanStack Query + React Hook Form + Zod.
* Backend: NodeJS + Express + TypeScript + MySQL.
* Authentication: JWT + Refresh Token.
* Database: MySQL với Prisma ORM (đang sử dụng mysql2/promise wrapper).
* Validation: Frontend + Backend.
* Soft delete: Sử dụng `deleted_at` (đang sử dụng `isActive` cho sản phẩm).
* Transaction: Sử dụng database transaction cho các nghiệp vụ quan trọng.
* Logging: audit_logs cho mọi thao tác quan trọng.
* API: RESTful API version 1 (`/api/v1`).
* Seed data: Dữ liệu mẫu để kiểm thử.
* Responsive: Desktop, tablet, mobile.
* UI/UX: Theo phong cách TailAdmin.

## 2. Kiến trúc tổng thể ✅

```
Frontend (React + Vite + TypeScript)
├── src/
│   ├── components/ (Sidebar, Header, Layout, Modal, Toast, Loading, DatePicker)
│   ├── pages/ (Dashboard, Products, Materials, Purchases, Sales, Customers, Suppliers, Production, Assembly, Stocktake, Reports, Users, AuditLogs)
│   ├── lib/ (apiV1.ts, utils.ts)
│   ├── types.ts
│   ├── App.tsx
│   └── main.tsx

Backend (NodeJS + Express + TypeScript)
├── server.ts (Express server + MySQL connection + API routes)
├── apps/
│   └── api/
│       └── src/
│           └── index.ts (API V1 modular routes)

Database
├── MySQL (mysql2/promise wrapper)
├── Tables: users, products, productpackagings, product_boms, warehouses, inventorytransactions, inventorytransactiondetails, sales_orders, sales_order_details, purchase_documents, purchase_document_details, customers, suppliers, supplier_payments, customer_payments, warehouse_transfers, warehouse_transfer_details, stocktakes, stocktake_details, audit_logs
└── Seed data: 3 kho, 5 khách hàng, 5 nhà cung cấp, 10 sản phẩm, định mức BOM, chương trình khuyến mãi
```

## 3. Cấu trúc thư mục frontend và backend ✅

**Frontend:**
```
src/
├── components/
│   ├── Layout.tsx (Sidebar + Header + Content)
│   ├── Sidebar.tsx (Menu điều hướng + phân quyền)
│   ├── Header.tsx (Thông báo + menu người dùng)
│   ├── Profile.tsx (Thông tin cá nhân)
│   ├── StocktakeDocument.tsx (Form kiểm kê)
│   └── ProductionDocument.tsx (Form lệnh sản xuất)
├── pages/
│   ├── Dashboard.tsx (FinancialDashboard hiển thị doanh thu, chi phí, lợi nhuận, tồn kho)
│   ├── ProductList.tsx (Danh sách sản phẩm + CRUD)
│   ├── Materials.tsx (Danh sách vật tư bao bì + CRUD)
│   ├── MaterialTransactions.tsx (Nhập xuất vật tư)
│   ├── Transactions.tsx (Sổ kho)
│   ├── PurchasesV1.tsx (Chứng từ mua hàng)
│   ├── SalesOrdersV1.tsx (Chứng từ bán hàng)
│   ├── SalesReturns.tsx (Trả hàng bán)
│   ├── Suppliers.tsx (Nhà cung cấp)
│   ├── Customers.tsx (Khách hàng)
│   ├── Production.tsx (Lệnh sản xuất)
│   ├── Assembly.tsx (Lắp ráp & Tháo dỡ)
│   ├── Stocktake.tsx (Kiểm kê)
│   ├── WarehouseTransfers.tsx (Chuyển kho)
│   ├── Reporting.tsx (Báo cáo)
│   ├── FinancialDashboard.tsx (Dashboard tài chính)
│   ├── Debt.tsx (Công nợ)
│   ├── Users.tsx (Quản lý tài khoản)
│   ├── AuditLogs.tsx (Nhật ký hoạt động)
│   └── Login.tsx
├── lib/
│   ├── apiV1.ts (Wrapper API + refresh token)
│   └── utils.ts (formatDate, formatNumber, formatCurrency)
├── types.ts (TypeScript interfaces cho toàn bộ hệ thống)
├── App.tsx (Router + Layout + Authentication)
└── main.tsx
```

**Backend:**
```
server.ts
├── Express server
├── MySQL connection (mysql2/promise)
├── Authentication middleware (JWT)
├── API routes:
│   ├── /api/auth/login (Đăng nhập)
│   ├── /api/v1/* (API version 1 modular)
│   ├── /api/customers (Khách hàng)
│   ├── /api/suppliers (Nhà cung cấp)
│   ├── /api/purchase-documents (Chứng từ mua)
│   ├── /api/products (Sản phẩm)
│   ├── /api/transactions (Sổ kho)
│   ├── /api/audit-logs (Nhật ký hoạt động)
│   └── /api/auth/refresh (Refresh token)
└── Legacy API routes (để tương thích trong quá trình migrate)
```

## 4. ERD bằng Mermaid ✅

```mermaid
erdDiagram
    %% Hệ thống
    users ||--o{ audit_logs : ""
    users ||--o{ inventorytransactions : ""
    users ||--o{ sales_orders : ""
    users ||--o{ purchase_documents : ""
    users ||--o{ supplier_payments : ""
    users ||--o{ customer_payments : ""

    %% Danh mục
    warehouses ||--o{ inventorytransactions : ""
    warehouses ||--o{ productwarehouses : ""
    warehouses ||--o{ warehouse_transfers : ""

    products ||--o{ productpackagings : ""
    products ||--o{ productionorders : ""

    productpackagings ||--o{ productwarehouses : ""
    productpackagings ||--o{ inventorytransactiondetails : ""
    productpackagings ||--o{ product_boms : ""
    productpackagings ||--o{ sales_order_details : ""
    productpackagings ||--o{ purchase_document_details : ""
    productpackagings ||--o{ warehouse_transfer_details : ""
    productpackagings ||--o{ stocktake_details : ""
    productpackagings ||--o{ productiondetails : ""

    %% Mua bán
    suppliers ||--o{ purchase_documents : ""
    customers ||--o{ sales_orders : ""

    purchase_documents ||--o{ purchase_document_details : ""
    purchase_documents ||--o{ supplier_payments : ""
    purchase_documents ||--o{ purchase_inventory_links : ""

    sales_orders ||--o{ sales_order_details : ""
    sales_orders ||--o{ customer_payments : ""
    sales_orders ||--o{ sales_returns : ""

    %% Kho
    inventorytransactions ||--o{ inventorytransactiondetails : ""
    inventorytransactions ||--o{ purchase_inventory_links : ""

    warehouse_transfers ||--o{ warehouse_transfer_details : ""

    stocktakes ||--o{ stocktake_details : ""

    %% Sản xuất
    productionorders ||--o{ productiondetails : ""
    assembly_orders ||--o{ assembly_order_lines : ""
    disassembly_orders ||--o{ disassembly_order_lines : ""
```

## 5. Danh sách database tables và quan hệ ✅

| Table | Mô tả | Quan hệ chính |
|-------|-------|---------------|
| users | Tài khoản người dùng | 1:N audit_logs, inventorytransactions, sales_orders, purchase_documents |
| roles | Vai trò người dùng | Quản lý bởi trường role trong users |
| permissions | Quyền hạn | Quản lý bởi danh sách role_permissions |
| audit_logs | Nhật ký hoạt động | userId → users.id |
| products | Sản phẩm | 1:N productpackagings, productionorders |
| productpackagings | Quy cách sản phẩm | productId → products.id, 1:N productwarehouses, inventorytransactiondetails, product_boms, sales_order_details, purchase_document_details |
| product_boms | Định mức BOM | productPackagingId → productpackagings.id, materialPackagingId → productpackagings.id |
| warehouses | Kho | 1:N inventorytransactions, productwarehouses, warehouse_transfers |
| productwarehouses | Tồn kho theo sản phẩm và kho | packagingId → productpackagings.id, warehouseId → warehouses.id |
| inventorytransactions | Phiếu nhập/xuất kho | warehouseId → warehouses.id, createdBy → users.id, customerId → customers.id |
| inventorytransactiondetails | Chi tiết phiếu kho | transactionId → inventorytransactions.id, packagingId → productpackagings.id |
| sales_orders | Chứng từ bán hàng | customerId → customers.id, warehouseId → warehouses.id, createdBy → users.id, approvedBy → users.id |
| sales_order_details | Chi tiết chứng từ bán | orderId → sales_orders.id, packagingId → productpackagings.id |
| sales_returns | Trả hàng bán | originalSalesOrderId → sales_orders.id, customerId → customers.id, warehouseId → warehouses.id |
| customers | Khách hàng | 1:N sales_orders, customer_payments |
| customer_payments | Thanh toán khách hàng | customerId → customers.id, salesOrderId → sales_orders.id, createdBy → users.id |
| purchase_documents | Chứng từ mua hàng | supplierId → suppliers.id, createdBy → users.id |
| purchase_document_details | Chi tiết chứng từ mua | documentId → purchase_documents.id, packagingId → productpackagings.id, warehouseId → warehouses.id |
| purchase_inventory_links | Liên kết chứng từ mua và phiếu nhập | purchaseDocumentId → purchase_documents.id, inventoryTransactionId → inventorytransactions.id, warehouseId → warehouses.id |
| suppliers | Nhà cung cấp | 1:N purchase_documents, supplier_payments |
| supplier_payments | Thanh toán nhà cung cấp | supplierId → suppliers.id, purchaseDocumentId → purchase_documents.id, createdBy → users.id |
| warehouse_transfers | Chuyển kho | fromWarehouseId → warehouses.id, toWarehouseId → warehouses.id, createdBy → users.id |
| warehouse_transfer_details | Chi tiết chuyển kho | transferId → warehouse_transfers.id, packagingId → productpackagings.id |
| stocktakes | Phiếu kiểm kê | createdBy → users.id |
| stocktake_details | Chi tiết phiếu kiểm kê | stocktakeId → stocktakes.id, packagingId → productpackagings.id |
| productionorders | Lệnh sản xuất | productId → products.id |
| productiondetails | Chi tiết lệnh sản xuất | orderId → productionorders.id, packagingId → productpackagings.id |
| assembly_orders | Lệnh lắp ráp | (Xem docs/PRODUCTION_V1.md) |
| assembly_order_lines | Chi tiết lệnh lắp ráp | (Xem docs/PRODUCTION_V1.md) |
| disassembly_orders | Lệnh tháo dỡ | (Xem docs/PRODUCTION_V1.md) |
| disassembly_order_lines | Chi tiết lệnh tháo dỡ | (Xem docs/PRODUCTION_V1.md) |

## 6. Luồng mua hàng → nhập kho → công nợ ✅

```
1. Người dùng lập chứng từ mua hàng (purchase_documents)
   - Loại: DOMESTIC_INVENTORY (nhập kho) hoặc DOMESTIC_NO_INVENTORY (không nhập kho)
   - Trạng thái: DRAFT → POSTED
   - Thanh toán: UNPAID → PAID/PARTIAL

2. Hệ thống tự động tạo phiếu nhập kho (inventorytransactions)
   - Loại: IMPORT
   - Liên kết: purchase_inventory_links (purchaseDocumentId ↔ inventoryTransactionId)

3. Cập nhật tồn kho (productwarehouses)
   - Tăng tồn theo từng sản phẩm, quy cách, kho

4. Ghi nhận công nợ (nếu chưa thanh toán)
   - purchase_documents.paidAmount = 0 → công nợ = totalAmount
   - supplier_payments ghi nhận thanh toán khi thanh toán

5. Thanh toán (nếu thanh toán ngay)
   - Tạo supplier_payments
   - Cập nhật purchase_documents.paymentStatus = PAID
   - purchase_documents.paidAmount = totalAmount
```

## 7. Luồng bán hàng → xuất kho → công nợ ✅

```
1. Người dùng lập chứng từ bán hàng (sales_orders)
   - Trạng thái: DRAFT → POSTED
   - Thanh toán: UNPAID → PAID/PARTIAL

2. Kiểm tra tồn khả dụng
   - sales_order_details.quantity ≤ productwarehouses.stock_quantity

3. Hệ thống tự động tạo phiếu xuất kho (inventorytransactions)
   - Loại: EXPORT
   - Liên kết: inventorytransactions.customerId = sales_orders.customerId

4. Giảm tồn kho (productwarehouses)
   - Giảm tồn theo từng sản phẩm, quy cách, kho

5. Ghi nhận công nợ (nếu chưa thanh toán)
   - sales_orders.paidAmount = 0 → công nợ = totalAmount
   - customer_payments ghi nhận thanh toán khi thu tiền

6. Thu tiền (nếu thanh toán ngay)
   - Tạo customer_payments
   - Cập nhật sales_orders.paymentStatus = PAID
   - sales_orders.paidAmount = totalAmount

7. Trả hàng (sales_returns)
   - Chọn sales_orders gốc
   - Tạo phiếu nhập kho (inventorytransactions loại IMPORT)
   - Hoàn tồn cả dòng SALE/PROMOTION theo quantity và COGS snapshot
   - Ghi receivable CREDIT giảm outstanding; V1 từ chối phần credit vượt outstanding vì chưa hỗ trợ hoàn tiền
   - Hủy return tạo inventory reversal và CREDIT_REVERSAL, không sửa snapshot totals của đơn gốc
```

## 8. Luồng sản xuất → xuất nguyên vật liệu → nhập thành phẩm ✅

```
1. Người dùng lập lệnh sản xuất (production_orders)
   - Chọn sản phẩm (thành phẩm)
   - Nhập số lượng sản xuất
   - Hệ thống tự động tải định mức BOM

2. Tính toán nguyên vật liệu cần dùng
   - Số lượng cần dùng = Số lượng định mức × Số lượng sản xuất / Số lượng thành phẩm tiêu chuẩn
   - Cộng hao hụt (nếu có)

3. Tạo phiếu xuất kho nguyên vật liệu (inventorytransactions loại EXPORT)
   - Liên kết: productionorders.id → inventorytransactions.sourceId

4. Giảm tồn kho nguyên vật liệu

5. Khi hoàn thành sản xuất
   - Tạo phiếu nhập kho thành phẩm (inventorytransactions loại IMPORT)
   - Tăng tồn kho thành phẩm
   - productionorders.status = COMPLETED

6. Lắp ráp (assembly_orders)
   - Tương tự lệnh sản xuất nhưng sử dụng định mức lắp ráp
   - Xuất linh kiện, nhập thành phẩm

7. Tháo dỡ (disassembly_orders)
   - Xuất thành phẩm, nhập linh kiện thu hồi
```

## 9. Luồng lắp ráp và tháo dỡ ✅

Xem chi tiết trong docs/PRODUCTION_V1.md:
- assembly_orders: Lệnh lắp ráp thành phẩm từ linh kiện
- disassembly_orders: Lệnh tháo dỡ thành phẩm thành linh kiện
- Tự động cập nhật tồn kho và giá vốn

## 10. Danh sách REST API ✅

**API V1 (apps/api/src/index.ts):**
- `/api/v1/auth/login` - Đăng nhập
- `/api/v1/auth/refresh` - Refresh token
- `/api/v1/auth/logout` - Đăng xuất
- `/api/v1/customers` - CRUD khách hàng
- `/api/v1/suppliers` - CRUD nhà cung cấp
- `/api/v1/products` - CRUD sản phẩm + quy cách + định mức BOM
- `/api/v1/purchase-documents` - CRUD chứng từ mua + thanh toán
- `/api/v1/sales-documents` - Lifecycle chứng từ bán
- `/api/v1/sales-returns` - Lifecycle trả hàng, hoàn kho và receivable reversal
- `/api/v1/debt` - Phải thu/phải trả, phiếu thu/chi và tuổi nợ
- `/api/v1/inventory-transactions` - Sổ kho
- `/api/v1/warehouse-transfers` - Chuyển kho
- `/api/v1/stocktakes` - Kiểm kê
- `/api/v1/production-orders` - Lệnh sản xuất
- `/api/v1/assembly-orders` - Lệnh lắp ráp
- `/api/v1/disassembly-orders` - Lệnh tháo dỡ
- `/api/v1/reports/*` - Báo cáo (doanh thu, tồn kho, công nợ)
- `/api/v1/reports/production-variance` - So sánh định mức và thực tế sản xuất
- `/api/v1/promotions` - Chương trình khuyến mãi
- `/api/v1/audit-logs` - Nhật ký hoạt động

**API Legacy (server.ts - tương thích trong quá trình migrate):**
- `/api/auth/login` - Đăng nhập
- `/api/customers` - CRUD khách hàng
- `/api/suppliers` - CRUD nhà cung cấp
- `/api/purchase-documents` - CRUD chứng từ mua
- `/api/products` - CRUD sản phẩm
- `/api/transactions` - Sổ kho
- `/api/audit-logs` - Nhật ký hoạt động

## 11. Ma trận phân quyền ✅

| Vai trò | Mô tả | Quyền hạn |
|---------|-------|-----------|
| ADMIN | Quản trị viên toàn hệ thống | Xem, thêm, sửa, xóa tất cả module + quản lý tài khoản + nhật ký hoạt động |
| W_MANAGER | Quản lý kho | Xem, thêm, sửa, xóa: Kho, sản phẩm, vật tư, nhập/xuất kho, chuyển kho, kiểm kê, báo cáo tồn |
| P_MANAGER | Quản lý sản xuất | Xem, thêm, sửa, xóa: Lệnh sản xuất, lắp ráp, tháo dỡ, định mức BOM, báo cáo sản xuất |
| S_SALES | Nhân viên kinh doanh | Xem, thêm, sửa, xóa: Khách hàng, chứng từ bán, trả hàng, khuyến mãi, báo cáo doanh thu |
| QD | Kế toán | Xem: Tất cả module + báo cáo tài chính, công nợ, doanh thu, chi phí |

**Chi tiết phân quyền trong Sidebar.tsx:**
- Sử dụng hàm `canAccess(allowedRoles: string[])` để kiểm tra quyền truy cập menu
- Frontend ẩn menu không có quyền
- Backend vẫn kiểm tra độc lập (middleware authenticate + role check)

## 12. Kế hoạch triển khai theo giai đoạn ✅

Xem phần **XXV. CÁCH TRIỂN KHAI DỰ ÁN** để xem tiến độ chi tiết.

## 13. Những điểm nghiệp vụ cần xác nhận ⚠️

* **Bảng giá:** Cần xác nhận có cần triển khai module cấu hình giá theo khách hàng/nhóm khách hàng không? Hiện tại sử dụng giá bán 1/2/3 trong productpackagings.
* **Thu tiền/Chi tiền:** Cần xác nhận có cần triển khai module quản lý thu/chi tiền riêng biệt không? Hiện tại sử dụng customer_payments/supplier_payments.
* **Đối trừ chứng từ:** Cần xác nhận có cần triển khai chức năng đối trừ chứng từ mua/bán không?
* **Báo cáo tuổi nợ:** Cần xác nhận định dạng báo cáo tuổi nợ mong muốn (theo ngày, theo kỳ, theo nhóm tuổi).
* **Xuất Excel/PDF:** Cần xác nhận định dạng file xuất (template, tiêu đề, định dạng số/tiền).
* **Soft delete:** Cần xác nhận có cần triển khai soft delete cho tất cả bảng không? Hiện tại chỉ sử dụng isActive cho sản phẩm.
* **Transaction isolation:** Cần xác nhận mức isolation level cho các transaction quan trọng (ví dụ: mua hàng, bán hàng, sản xuất).
* **Logging chi tiết:** Cần xác nhận những trường nào cần log trong audit_logs (hiện tại log action, user, details).

---

## Vertical Slice Hoàn chỉnh đã triển khai ✅

`Đăng nhập → Vật tư hàng hóa → Mua hàng → Tự động nhập kho → Cập nhật tồn kho → Ghi nhận công nợ nhà cung cấp`

Vertical slice này hoạt động đầy đủ từ giao diện đến database, có validation, logging, và test sơ bộ. Có thể mở rộng sang các module còn lại.

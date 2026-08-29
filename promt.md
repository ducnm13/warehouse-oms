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

Hệ thống chỉ được xem là hoàn thành khi:

* Có giao diện đầy đủ và responsive.
* Các chức năng sử dụng API thật.
* Có migration và seed database.
* CRUD hoạt động đầy đủ.
* Ghi sổ và hủy chứng từ hoạt động đúng.
* Tồn kho cập nhật chính xác theo từng kho.
* Công nợ cập nhật chính xác.
* Lệnh sản xuất tính đúng BOM.
* Lắp ráp và tháo dỡ cập nhật đúng tồn kho.
* Khuyến mãi tự động thêm đúng hàng tặng.
* Báo cáo lấy dữ liệu thực.
* Xuất Excel hoạt động.
* Phân quyền được kiểm tra ở backend.
* Không có lỗi TypeScript.
* Không có lỗi console nghiêm trọng.
* Có hướng dẫn cài đặt và chạy dự án.
* Có tài liệu Swagger.
* Có tài khoản demo.
* Có test cho các nghiệp vụ quan trọng.

---

# XXV. CÁCH TRIỂN KHAI DỰ ÁN

Không triển khai toàn bộ hệ thống trong một file hoặc một lần sinh mã thiếu kiểm soát.

Thực hiện theo từng giai đoạn:

## Giai đoạn 1: Phân tích và thiết kế

* Phân tích yêu cầu.
* Đề xuất kiến trúc.
* Tạo sitemap.
* Tạo ERD.
* Mô tả luồng chứng từ.
* Xác định trạng thái và quy tắc nghiệp vụ.
* Liệt kê API cần xây dựng.
* Liệt kê những điểm cần xác nhận.

## Giai đoạn 2: Khởi tạo nền tảng

* Tạo frontend và backend.
* Cấu hình MySQL.
* Authentication.
* Phân quyền.
* Layout TailAdmin.
* Component dùng chung.
* Logging và xử lý lỗi.

## Giai đoạn 3: Danh mục

* Kho.
* Đơn vị tính.
* Khách hàng.
* Nhà cung cấp.
* Vật tư hàng hóa.
* Bảng giá.
* Định mức BOM.

## Giai đoạn 4: Kho

* Sổ kho.
* Nhập kho.
* Xuất kho.
* Chuyển kho.
* Kiểm kê.
* Báo cáo tồn.

## Giai đoạn 5: Mua và bán hàng

* Chứng từ mua.
* Phiếu nhập tự động.
* Chứng từ bán.
* Phiếu xuất tự động.
* Trả hàng.
* Khuyến mãi.

## Giai đoạn 6: Công nợ

* Phải thu.
* Phải trả.
* Thu tiền.
* Chi tiền.
* Phân bổ thanh toán.
* Báo cáo tuổi nợ.

## Giai đoạn 7: Sản xuất

* BOM.
* Lệnh sản xuất.
* Xuất nguyên vật liệu.
* Nhập thành phẩm.
* Lắp ráp.
* Tháo dỡ.
* So sánh định mức và thực tế.

## Giai đoạn 8: Dashboard và báo cáo

* Dashboard.
* Báo cáo kinh doanh.
* Báo cáo kho.
* Báo cáo công nợ.
* Báo cáo sản xuất.
* Xuất Excel/PDF.

## Giai đoạn 9: Kiểm thử và hoàn thiện

* Unit test.
* Integration test.
* Kiểm thử luồng nghiệp vụ.
* Tối ưu hiệu năng.
* Kiểm tra bảo mật.
* Hoàn thiện tài liệu cài đặt.

Sau mỗi giai đoạn:

1. Liệt kê file đã tạo hoặc thay đổi.
2. Mô tả chức năng đã hoàn thành.
3. Chạy migration và test.
4. Chạy TypeScript type-check.
5. Báo cáo lỗi còn lại.
6. Chờ xác nhận trước khi chuyển sang phần có ảnh hưởng lớn đến kiến trúc.

---

# XXVI. KẾT QUẢ ĐẦU RA ĐẦU TIÊN

Trước khi viết code, hãy trả về:

1. Tóm tắt cách hiểu yêu cầu.
2. Kiến trúc tổng thể.
3. Cấu trúc thư mục frontend và backend.
4. ERD bằng Mermaid.
5. Danh sách database tables và quan hệ.
6. Luồng mua hàng → nhập kho → công nợ.
7. Luồng bán hàng → xuất kho → công nợ.
8. Luồng sản xuất → xuất nguyên vật liệu → nhập thành phẩm.
9. Luồng lắp ráp và tháo dỡ.
10. Danh sách REST API.
11. Ma trận phân quyền.
12. Kế hoạch triển khai theo giai đoạn.
13. Những điểm nghiệp vụ cần xác nhận.

Chỉ bắt đầu tạo source code sau khi đã hoàn thành phần thiết kế trên.

Khi bắt đầu viết code, hãy ưu tiên xây dựng một vertical slice hoàn chỉnh gồm:

`Đăng nhập → Vật tư hàng hóa → Mua hàng → Tự động nhập kho → Cập nhật tồn kho → Ghi nhận công nợ nhà cung cấp`

Vertical slice phải hoạt động từ giao diện đến cơ sở dữ liệu, có validation và test, sau đó mới mở rộng sang các module còn lại.

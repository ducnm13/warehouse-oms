import React from "react";
import { BookOpen, FileText, CheckCircle, AlertCircle, ShieldAlert } from "lucide-react";

export default function UserGuide() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300 font-sans pb-12">
      {/* TIÊU ĐỀ CHÍNH */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
          <BookOpen className="text-indigo-600" size={28} />
          TÀI LIỆU HƯỚNG DẪN SỬ DỤNG HỆ THỐNG
        </h2>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
          Cẩm nang vận hành quy trình kho, sản xuất và doanh số Challenge WMS
        </p>
      </div>

      {/* MỤC 1 */}
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <h3 className="text-base font-black text-slate-800 uppercase tracking-wide flex items-center gap-2 border-b pb-2 text-indigo-600">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-xs font-black">1</span>
          Tổng quan Dashboard
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          Màn hình chính cung cấp cái nhìn toàn cảnh về hoạt động của nhà máy và kho hàng theo thời gian thực.
        </p>
        <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
          <li><strong className="text-slate-700">Các chỉ số chính:</strong> Theo dõi tổng sản lượng đóng gói (Hộp/Túi), tổng số gói lẻ quy đổi, khối lượng bột tiêu hao (kg), và tỷ lệ hao hụt bình quân.</li>
          <li><strong className="text-slate-700">Biểu đồ tương quan:</strong> Trực quan hóa tỷ lệ tiêu hao và sản lượng theo từng dòng sản phẩm để đưa ra quyết định kịp thời.</li>
        </ul>
      </section>

      {/* MỤC 2 */}
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <h3 className="text-base font-black text-slate-800 uppercase tracking-wide flex items-center gap-2 border-b pb-2 text-indigo-600">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-xs font-black">2</span>
          Quản lý danh mục hàng hóa & vật tư
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          Hệ thống phân tách rõ ràng giữa hai kho để tránh nhầm lẫn dữ liệu:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-1">Kho Thành Phẩm</h4>
            <p className="text-xs text-slate-500 leading-relaxed">Khai báo sản phẩm, mã SKU chính, trọng lượng tịnh và hạn sử dụng. Cấu hình nhiều quy cách đóng gói kèm theo giá bán mặc định.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-1">Kho Bao Bì / Vật Tư</h4>
            <p className="text-xs text-slate-500 leading-relaxed">Quản lý chi tiết số lượng màng cuộn sachet, vỏ hộp, thùng carton phục vụ trực tiếp cho công đoạn sản xuất và đóng gói bọc màng.</p>
          </div>
        </div>
      </section>

      {/* MỤC 3 */}
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-base font-black text-slate-800 uppercase tracking-wide flex items-center gap-2 border-b pb-2 text-indigo-600">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-xs font-black">3</span>
          Quy trình xuất nhập kho thành phẩm
        </h3>
        
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <CheckCircle size={16} className="text-emerald-500" /> 3.1. Lập Phiếu Nhập Kho
          </h4>
          <p className="text-xs text-slate-600 pl-5 leading-relaxed">
            Nhấn nút <span className="font-bold text-indigo-600">LẬP PHIẾU MỚI</span> → Chọn loại phiếu Nhập kho → Chọn Ngày nhập → Điền người giao và chi tiết sản phẩm kèm số lượng thực tế → Nhấn Lưu phiếu.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <CheckCircle size={16} className="text-indigo-500" /> 3.2. Lập Phiếu Xuất Hàng (Tài Xế / Khách Hàng)
          </h4>
          <p className="text-xs text-slate-600 pl-5 leading-relaxed">
            Chọn loại phiếu Xuất kho → Chọn Khách hàng hệ thống (Hệ thống tự động đồng bộ tỷ lệ chiết khấu % mặc định). Thêm sản phẩm cần đi đơn, kiểm tra phần <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-rose-600">Tổng kết hóa đơn</span> ở cuối form gồm tiền hàng, số tiền chiết khấu giảm trừ và giá trị thực tế thanh toán → Lưu phiếu.
          </p>
        </div>
      </section>

      {/* MỤC 4 */}
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <h3 className="text-base font-black text-slate-800 uppercase tracking-wide flex items-center gap-2 border-b pb-2 text-indigo-600">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-xs font-black">4</span>
          Hệ thống báo cáo & thống kê
        </h3>
        <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
          <li><strong className="text-slate-700">Báo Cáo Tồn Kho Chi Tiết:</strong> Xem tồn đầu, nhập xuất trong kỳ và tồn cuối kỳ. Tính năng <span className="italic text-indigo-600 font-semibold">Nhật ký thẻ kho</span> giúp lọc chính xác biến động tăng giảm của quy cách đóng gói trong khung ngày đã chọn. Hỗ trợ xuất file Excel bọc lưới màu tiêu chuẩn.</li>
          <li><strong className="text-slate-700">Báo Cáo Doanh Số & Bán Hàng:</strong> Tách biệt theo 2 Tab dữ liệu chính: Cộng dồn theo Khách hàng / Tài xế vận chuyển đơn (Đơn hàng, tổng tiền hàng, tổng chiết khấu, thực thu) và Cộng dồn theo Sản phẩm xuất bán.</li>
        </ul>
      </section>

      {/* MỤC 5 */}
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <h3 className="text-base font-black text-slate-800 uppercase tracking-wide flex items-center gap-2 border-b pb-2 text-indigo-600">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-xs font-black">5</span>
          Bảo mật tài khoản & hồ sơ cá nhân
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          Nhấp vào cụm tên avatar tại thanh Header để mở nhanh bảng chọn cá nhân. Bạn có thể kiểm tra chức vụ hệ thống tại mục Hồ sơ hoặc tự bảo mật tài khoản bằng form Đổi mật khẩu (yêu cầu tối thiểu 6 ký tự, có hỗ trợ mắt ẩn/hiện chuỗi ký tự nhập).
        </p>
      </section>
    </div>
  );
}
import React, { useState } from "react";
import {
  Download,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import { toast } from "react-hot-toast";

export default function ProductionReport() {
  // Mặc định lấy tháng hiện tại (Định dạng YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().substring(0, 7),
  );

  const handleExportProductionExcel = async () => {
    if (!selectedMonth) {
      toast.error("Vui lòng lựa chọn tháng để xuất thống kê!");
      return;
    }

    const loadingToast = toast.loading(
      "Đang tổng hợp dữ liệu lệnh sản xuất...",
    );
    try {
      const res = await fetch(
        `/api/export-production-report?month=${selectedMonth}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ error: "Không lấy được dữ liệu từ hệ thống" }));
        throw new Error(errorData.error || "Lỗi hệ thống");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bao_Cao_Lenh_San_Xuat_${selectedMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Đã xuất báo cáo Lệnh sản xuất thành công!", {
        id: loadingToast,
      });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message, { id: loadingToast });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Tiêu đề trang */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Báo Cáo Sản Xuất Chuyên Sâu
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Kết xuất, thống kê số liệu lệnh sản xuất, khối lượng bột và quy đổi
          đóng gói sachet theo tháng.
        </p>
      </div>

      {/* Hộp điều khiển lọc dữ liệu */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <Calendar size={22} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Kỳ báo cáo (Tháng)
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 text-slate-700 bg-slate-50"
            />
          </div>
        </div>

        {/* Nút bấm tải báo cáo xịn sò */}
        <button
          onClick={handleExportProductionExcel}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-md hover:shadow-lg transition-all duration-200"
        >
          <Download size={16} />
          <span>Xuất File Excel</span>
        </button>
      </div>

      {/* Khối tài liệu mẫu hướng dẫn quy trình ký duyệt */}
      <div className="bg-slate-50 border border-slate-200/60 p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-emerald-600" />
          Cấu trúc biểu mẫu kết xuất bao gồm:
        </h3>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600">
          <li className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-blue-500" /> Thông tin hành
            chính Nhà máy & Công ty
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-blue-500" /> Gom nhóm, gộp ô
            (Merge) theo Lệnh sản xuất & Số lô
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-blue-500" /> Thống kê khối
            lượng Bột sử dụng thực tế (kg)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-blue-500" /> Quy đổi sản
            lượng đóng gói ra đơn vị Gói nhỏ
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-blue-500" /> Tự động loại bỏ
            dòng trống hoặc sản lượng bằng 0
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-blue-500" /> Định dạng sẵn
            cột ký nhận dành cho Quản đốc và Kế toán
          </li>
        </ul>
      </div>
    </div>
  );
}

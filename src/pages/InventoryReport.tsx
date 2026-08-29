import React, { useState, useEffect } from "react";
import { Search, FileDown, Table as TableIcon, Calendar, X } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import { Product, ProductPackaging } from "../types";
import { formatNumber } from "../lib/utils";
import toast from "react-hot-toast";

import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { vi } from "date-fns/locale/vi";

// Đăng ký ngôn ngữ tiếng Việt
registerLocale("vi", vi);

// Hàm chuẩn hóa Date sang YYYY-MM-DD cho API
const formatToYYYYMMDD = (date: Date | null) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Giao diện ô input lịch thu gọn cho thanh công cụ
const CustomFilterDateInput = React.forwardRef(
  ({ value, onClick }: any, ref: any) => (
    <div
      className="flex items-center gap-2 cursor-pointer hover:bg-gray-200/50 rounded px-2 py-1 transition-colors"
      onClick={onClick}
    >
      <input
        value={value}
        readOnly
        className="bg-transparent text-sm outline-none font-medium cursor-pointer w-[76px] text-gray-700"
        ref={ref}
      />
      <Calendar className="text-gray-400" size={14} />
    </div>
  ),
);

const InventoryReport = () => {
  // --- STATE CHO TÍNH NĂNG LỊCH SỬ XUẤT NHẬP (THẺ KHO) ---
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [selectedProductName, setSelectedProductName] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [category, setCategory] = useState("PRODUCT");

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, category]);

  // Hàm gọi API lấy lịch sử (Đã thêm bộ lọc ngày tháng)
  const fetchPackagingHistory = async (
    packagingId: number,
    productName: string,
  ) => {
    setHistoryModalOpen(true);
    setSelectedProductName(productName);
    setLoadingHistory(true);
    try {
      // CHỈNH SỬA: Nối thêm query params (?startDate=...&endDate=...) vào URL endpoint
      const res = await fetch(
        `/api/report/packaging-history/${packagingId}?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      if (!res.ok) throw new Error("Lỗi API");
      const data = await res.json();
      setHistoryData(data);
    } catch (err) {
      toast.error("Không thể lấy dữ liệu lịch sử!");
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/report/stock-detail?startDate=${startDate}&endDate=${endDate}&category=${category}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      setReportData(await res.json());
    } catch (err) {
      toast.error("Lỗi khi tải báo cáo");
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Báo cáo tồn kho");

      // 1. Cấu hình độ rộng các cột
      worksheet.getColumn(1).width = 6; // STT
      worksheet.getColumn(2).width = 14; // Mã hàng
      worksheet.getColumn(3).width = 45; // Tên hàng hóa
      worksheet.getColumn(4).width = 10; // ĐVT
      worksheet.getColumn(5).width = 15; // Tồn đầu
      worksheet.getColumn(6).width = 15; // Nhập trong kỳ
      worksheet.getColumn(7).width = 15; // Xuất trong kỳ
      worksheet.getColumn(8).width = 15; // Tồn cuối kỳ

      // 2. Thêm thông tin Công ty (Header)
      const row1 = worksheet.addRow(["CÔNG TY TNHH SX-TM-DV CHALLENGE"]);
      row1.font = { name: "Times New Roman", size: 14, bold: true };
      worksheet.mergeCells("A1:E1");

      const row2 = worksheet.addRow([
        "Trụ sở chính: 159 Hùng Vương, phường Đạo Thạnh, tỉnh Đồng Tháp",
      ]);
      row2.font = { name: "Times New Roman", size: 12, italic: true };
      worksheet.mergeCells("A2:E2");

      const row3 = worksheet.addRow([
        "Nhà máy: 260 Nguyễn Quân, phường Đạo Thạnh, tỉnh Đồng Tháp",
      ]);
      row3.font = { name: "Times New Roman", size: 12, italic: true };
      worksheet.mergeCells("A3:E3");

      try {
        const response = await fetch("/public/images/logo.png");
        const imageBuffer = await response.arrayBuffer();

        const logoId = workbook.addImage({
          buffer: imageBuffer,
          extension: "png",
        });

        worksheet.addImage(logoId, {
          tl: { col: 7, row: 1 },
          ext: { width: 120, height: 45 },
        });
      } catch (imgErr) {
        console.warn("Không tải được ảnh logo, bỏ qua chèn logo.", imgErr);
      }

      worksheet.addRow([]); // Dòng 4 để trống

      // 3. Thêm Tiêu đề báo cáo
      const dateObj = new Date(startDate);
      const reportTypeName =
        category === "PRODUCT"
          ? "THÀNH PHẨM"
          : category === "MATERIAL"
            ? "BAO BÌ - VẬT TƯ"
            : "TỔNG HỢP";
      const titleText = `BÁO CÁO TỒN KHO ${reportTypeName} THÁNG ${dateObj.getMonth() + 1}-${dateObj.getFullYear()}`;
      const row5 = worksheet.addRow([titleText]);
      row5.font = {
        name: "Times New Roman",
        size: 14,
        bold: true,
        color: { argb: "FF0070C0" },
      };
      row5.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.mergeCells("A5:H5");

      // 4. Thêm Dòng Tiêu đề Bảng (Header Table)
      const headerRow = worksheet.addRow([
        "STT",
        "Mã hàng",
        "Tên hàng hóa",
        "ĐVT",
        "Tồn đầu",
        "Nhập\ntrong kỳ",
        "Xuất trong\nkỳ",
        "Tồn cuối\nkỳ",
      ]);
      headerRow.height = 35;
      headerRow.eachCell((cell) => {
        cell.font = { name: "Times New Roman", size: 12, bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE17F" },
        };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // 5. Thêm Dữ liệu
      let stt = 1;
      reportData.forEach((p) => {
        p.packagings.forEach((pk: any) => {
          const combinedName =
            pk.name === "Hộp" || pk.name === "Gói" || !pk.name
              ? p.name
              : `${p.name} - ${pk.name}`;

          const row = worksheet.addRow([
            stt++,
            pk.sku || p.sku,
            combinedName,
            pk.unit || "Hộp",
            pk.openingStock || 0,
            pk.importQty || 0,
            pk.exportQty || 0,
            pk.closingStock || 0,
          ]);

          row.eachCell((cell, colNumber) => {
            cell.font = { name: "Times New Roman", size: 12 };
            cell.border = {
              top: { style: "hair" },
              left: { style: "thin" },
              bottom: { style: "hair" },
              right: { style: "thin" },
            };
            cell.alignment = { vertical: "middle" };

            if (colNumber === 1 || colNumber === 4) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
            }

            if (colNumber >= 5 && colNumber <= 8) {
              cell.alignment = { horizontal: "right", vertical: "middle" };
              cell.numFmt = "#,##0";
            }

            // TÔ MÀU NỀN CÁC CỘT DỮ LIỆU
            if (colNumber === 5)
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE2EFDA" },
              };
            if (colNumber === 6)
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFDDEBF7" },
              };
            if (colNumber === 7)
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFCE4D6" },
              };
            if (colNumber === 8) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE4DFEC" },
              };
              cell.font = { name: "Times New Roman", size: 12, bold: true };
            }
          });
        });
      });

      // Fix nét viền liền (thin) cho dòng đầu và dòng cuối của bảng
      const firstDataRow = worksheet.getRow(7);
      if (firstDataRow)
        firstDataRow.eachCell(
          (cell) =>
            (cell.border = { ...(cell.border as any), top: { style: "thin" } }),
        );

      const lastDataRow = worksheet.getRow(worksheet.rowCount);
      if (lastDataRow)
        lastDataRow.eachCell(
          (cell) =>
            (cell.border = {
              ...(cell.border as any),
              bottom: { style: "thin" },
            }),
        );

      // 6. Xuất File
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, `BaoCaoTonKho_${startDate}_den_${endDate}.xlsx`);
      toast.success("Đã xuất file Excel thành công!");
    } catch (err) {
      toast.error("Lỗi khi xuất file Excel");
      console.error(err);
    }
  };

  const filteredData = reportData.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* tiêu đề */}
        <div>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">
            BÁO CÁO TỒN KHO CHI TIẾT
          </h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
            Từ {startDate} đến {endDate}
          </p>
        </div>
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 px-2 py-2 bg-indigo-50">
        <div className="items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-md border border-indigo-100">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full text-center bg-transparent text-sm outline-none font-black text-indigo-700 cursor-pointer uppercase"
          >
            <option value="PRODUCT">Kho Thành Phẩm</option>
            <option value="MATERIAL">Kho Bao Bì / Vật Tư</option>
            <option value="ALL">Tất cả hàng hóa</option>
          </select>
        </div>
        <div className="flex items-center gap-1 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100">
          <span className="text-xs font-bold text-gray-400 uppercase mr-1">
            Từ:
          </span>
          <DatePicker
            selected={startDate ? new Date(startDate) : null}
            onChange={(date) => setStartDate(formatToYYYYMMDD(date))}
            dateFormat="dd/MM/yyyy"
            locale="vi"
            customInput={<CustomFilterDateInput />}
            showPopperArrow={false}
            selectsStart
            startDate={startDate ? new Date(startDate) : undefined}
            endDate={endDate ? new Date(endDate) : undefined}
          />

          <span className="text-xs font-bold text-gray-400 uppercase ml-2 mr-1">
            Đến:
          </span>
          <DatePicker
            selected={endDate ? new Date(endDate) : null}
            onChange={(date) => setEndDate(formatToYYYYMMDD(date))}
            dateFormat="dd/MM/yyyy"
            locale="vi"
            customInput={<CustomFilterDateInput />}
            showPopperArrow={false}
            selectsEnd
            startDate={startDate ? new Date(startDate) : undefined}
            endDate={endDate ? new Date(endDate) : undefined}
            minDate={startDate ? new Date(startDate) : undefined}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 justify-between">
          <button
            onClick={exportExcel}
            className="w-full flex items-center gap-2 rounded bg-green-600 py-2 px-6 text-sm font-black text-white hover:bg-opacity-90 transition-all shadow-sm uppercase tracking-tighter"
          >
            <FileDown size={16} /> XUẤT EXCEL
          </button>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="bg-white flex justify-between">
          <div className="relative w-full md:w-2/6">
            <input
              type="text"
              placeholder="Tìm sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <Search
              className="absolute left-3 top-2.5 text-gray-400"
              size={16}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="text-gray-400 border-b bg-gray-50/30">
                <th className="p-3 font-bold uppercase text-[11px] tracking-widest">
                  STT
                </th>
                <th className="p-3 font-bold uppercase text-[11px] tracking-widest">
                  Tên sản phẩm / Quy cách
                </th>
                <th className="p-3 font-bold uppercase text-[11px] tracking-widest text-center">
                  Tồn đầu kỳ
                </th>
                <th className="p-3 font-bold uppercase text-[11px] tracking-widest text-center text-primary">
                  Nhập
                </th>
                <th className="p-3 font-bold uppercase text-[11px] tracking-widest text-center text-red-500">
                  Xuất
                </th>
                <th className="p-3 font-bold uppercase text-[11px] tracking-widest text-center text-green-600">
                  Tồn cuối
                </th>
                <th className="p-3 font-bold uppercase text-[11px] tracking-widest text-center">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((product, idx) => (
                <React.Fragment key={product.id}>
                  <tr className="bg-gray-50/50 font-bold border-b">
                    <td className="py-2 px-3 text-center text-gray-400 font-mono italic">
                      {idx + 1}
                    </td>
                    <td
                      colSpan={6}
                      className="py-2 px-3 text-gray-800 uppercase tracking-tight font-black"
                    >
                      {product.name} ({product.sku})
                    </td>
                  </tr>
                  {product.packagings.map((pk: any) => (
                    <tr
                      key={pk.id}
                      className="border-b hover:bg-gray-50/80 transition-colors"
                    >
                      <td className=""></td>
                      <td className="py-3 px-6 text-gray-600 font-medium italic">
                        -- {pk.name}
                      </td>
                      <td className="py-3 text-center text-gray-500 font-mono">
                        {formatNumber(pk.openingStock)}
                      </td>
                      <td className="py-3 text-center text-primary font-mono font-bold">
                        +{formatNumber(pk.importQty)}
                      </td>
                      <td className="py-3 text-center text-red-500 font-mono font-bold">
                        -{formatNumber(pk.exportQty)}
                      </td>
                      <td className="py-3 text-center font-black text-gray-900 font-mono bg-green-50/20">
                        {formatNumber(pk.closingStock)}
                      </td>
                      <td className="py-3 text-center font-black text-gray-900 font-mono">
                        <button
                          onClick={() =>
                            fetchPackagingHistory(
                              pk.id,
                              `${product.name} - ${pk.name}`,
                            )
                          }
                          className="text-xs px-3 py-1 bg-indigo-50 text-indigo-600 font-bold rounded shadow-sm hover:bg-indigo-600 hover:text-white transition-all uppercase"
                          title="Xem lịch sử xuất nhập"
                        >
                          nhật ký
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {filteredData.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-gray-400 italic"
                  >
                    Không có dữ liệu phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* --- MODAL LỊCH SỬ XUẤT NHẬP (THẺ KHO) --- */}
        {historyModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 font-sans">
            <div className="w-full max-w-5xl max-h-[85vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b bg-gray-50">
                <div>
                  <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">
                    THẺ KHO / LỊCH SỬ GIAO DỊCH
                  </h3>
                  <p className="text-sm font-bold text-indigo-600 mt-1 uppercase tracking-widest">
                    {selectedProductName}
                  </p>
                </div>
                <button
                  onClick={() => setHistoryModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content / Table */}
              <div className="p-0 flex-1 overflow-y-auto bg-white">
                {loadingHistory ? (
                  <div className="flex justify-center py-20">
                    <span className="text-indigo-400 font-bold animate-pulse uppercase text-sm tracking-widest">
                      Đang tải dữ liệu lịch sử...
                    </span>
                  </div>
                ) : historyData.length === 0 ? (
                  <div className="text-center py-20 m-6 border-2 border-dashed rounded-xl border-gray-200 bg-gray-50/50">
                    <p className="text-gray-400 font-bold uppercase text-sm tracking-widest">
                      Chưa có phát sinh giao dịch nào cho sản phẩm này
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="sticky top-0 bg-white shadow-sm z-10">
                      <tr className="bg-slate-100/80 border-b border-gray-200">
                        <th className="py-4 px-6 font-black text-slate-600 text-xs uppercase tracking-widest w-[15%]">
                          Ngày
                        </th>
                        <th className="py-4 px-6 font-black text-slate-600 text-xs uppercase tracking-widest w-[15%]">
                          Mã phiếu
                        </th>
                        <th className="py-4 px-6 font-black text-slate-600 text-xs uppercase tracking-widest text-center w-[15%]">
                          Loại
                        </th>
                        <th className="py-4 px-6 font-black text-slate-600 text-xs uppercase tracking-widest text-right w-[15%]">
                          Số lượng
                        </th>
                        <th className="py-4 px-6 font-black text-slate-600 text-xs uppercase tracking-widest w-[40%]">
                          Diễn giải / Khách hàng
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.map((tx, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-gray-100 hover:bg-indigo-50/30 transition-colors"
                        >
                          <td className="py-4 px-6 font-bold text-gray-500">
                            {tx.transaction_date
                              ? new Date(
                                  tx.transaction_date,
                                ).toLocaleDateString("vi-VN")
                              : "-"}
                          </td>
                          <td className="py-4 px-6 font-mono font-bold text-indigo-700">
                            {tx.code}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span
                              className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${
                                tx.type === "IMPORT"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}
                            >
                              {tx.type === "IMPORT" ? "NHẬP KHO" : "XUẤT KHO"}
                            </span>
                          </td>
                          <td
                            className={`py-4 px-6 text-right font-black font-mono text-base ${
                              tx.type === "IMPORT"
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {tx.type === "IMPORT" ? "+" : "-"}
                            {formatNumber(tx.quantity)}
                          </td>
                          <td className="py-4 px-6">
                            <p className="font-bold text-gray-800 text-sm">
                              {tx.customerName || tx.recipient || "Nội bộ"}
                            </p>
                            {tx.note && (
                              <p className="text-xs font-medium text-gray-500 italic mt-1 bg-gray-50 p-2 rounded border border-gray-100 inline-block w-full">
                                {tx.note}
                              </p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="p-5 border-t bg-gray-50 flex justify-end">
                <button
                  onClick={() => setHistoryModalOpen(false)}
                  className="px-8 py-2.5 bg-gray-800 text-white text-xs uppercase tracking-widest font-black rounded-lg hover:bg-gray-900 transition-colors shadow-md"
                >
                  Đóng thẻ kho
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};;;

export default InventoryReport;

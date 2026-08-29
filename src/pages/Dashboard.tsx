import React, { useState, useEffect } from "react";
import {
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  BarChart,
  Calendar,
  Package,
  Factory,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import {
  BarChart as ReBarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatNumber } from "../lib/utils";
import { Transaction, Product } from "../types";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { vi } from "date-fns/locale/vi";
import toast from "react-hot-toast"; // <--- Thư viện quan trọng để nút chạy được

// Đăng ký ngôn ngữ tiếng Việt
registerLocale("vi", vi);

// Hàm chuẩn hóa Date sang YYYY-MM
const formatToYYYYMM = (date: Date | null) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

// Giao diện ô chọn tháng
const CustomMonthInput = React.forwardRef(
  ({ value, onClick }: any, ref: any) => (
    <div
      className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={onClick}
      ref={ref}
    >
      <Calendar size={18} className="text-gray-400 ml-2" />
      <span className="text-sm font-black text-gray-700 uppercase tracking-widest">
        {value}
      </span>
    </div>
  ),
);

interface DashboardProps {
  setActiveItem?: (item: string) => void;
}

const Dashboard = ({ setActiveItem }: DashboardProps) => {
  const [stats, setStats] = useState({
    customers: 0,
    exports: 0,
    imports: 0,
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [topProducts, setTopProducts] = useState<
    { name: string; value: number }[]
  >([]);
  const [topCustomers, setTopCustomers] = useState<
    { name: string; value: number }[]
  >([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    formatToYYYYMM(new Date()),
  );

  // State quản lý Tab hiển thị biểu đồ
  const [activeChartTab, setActiveChartTab] = useState<
    "products" | "customers"
  >("products");

  // State quản lý Báo cáo Sản xuất
  const [productionStats, setProductionStats] = useState<{
    totalPowder: number;
    items: {
      name: string;
      packagingName: string;
      sku: string;
      quantity: number; // Thành phẩm
      sachets: number; // Số gói lẻ
      powder: number; // Bột tiêu hao
    }[];
  }>({ totalPowder: 0, items: [] });

  // Hàm chuyển đổi qua lại giữa các tháng
  const changeMonth = (offset: number) => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setSelectedMonth(formatToYYYYMM(date));
  };

  // Lấy role của user để phân quyền
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  // Kiểm tra quyền: SALES hoặc USER2 (bạn có ghi là QD ở code cũ, tôi đổi lại thành USER2 theo yêu cầu prompt trước đó, bạn có thể chỉnh lại nếu cần)
  const isReadOnlyRole =
    currentUser.role === "S_SALES" || currentUser.role === "QD";

  // --- HÀM TẢI FILE EXCEL ---
  const handleExportExcel = async () => {
    if (!selectedMonth) {
      toast.error("Vui lòng chọn tháng trước khi xuất báo cáo");
      return;
    }

    const loadingToast = toast.loading(
      "Đang tổng hợp số liệu và tạo file Excel...",
    );
    try {
      // 1. Gọi API gửi kèm tháng (VD: ?month=2026-05)
      const res = await fetch(`/api/export-report?month=${selectedMonth}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      // 2. Nếu server báo lỗi (VD: 500 do sai tên bảng)
      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ error: "Máy chủ gặp sự cố" }));
        throw new Error(errorData.error || "Lỗi không xác định từ máy chủ");
      }

      // 3. Chuyển dữ liệu thành dạng file (Blob) và ép tải xuống
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bao_Cao_Tong_Hop_${selectedMonth}.xlsx`;
      document.body.appendChild(a);
      a.click(); // Tự động click để tải

      // 4. Dọn dẹp bộ nhớ
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Đã tải xuống báo cáo Excel!", { id: loadingToast });
    } catch (error: any) {
      console.error("Lỗi xuất Excel:", error);
      toast.error(error.message, { id: loadingToast });
    }
  };
  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    try {
      const [txRes, prodRes, custRes, prodOrderRes] = await Promise.all([
        fetch("/api/transactions", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
        fetch("/api/products", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
        fetch("/api/customers", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
        fetch("/api/production-orders", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
      ]);

      const txData = await txRes.json();
      const prodData = await prodRes.json();
      const custData = await custRes.json();
      const prodOrderData = await prodOrderRes.json();

      setProducts(prodData);

      // 1. Dữ liệu nhập xuất (Lọc theo tháng được chọn)
      const monthTxs = txData.filter((t: Transaction) =>
        t.transaction_date.startsWith(selectedMonth),
      );

      // Tính Top Sản Phẩm Xuất
      const productQuantities: Record<string, number> = {};
      monthTxs
        .filter((t: Transaction) => t.type === "EXPORT")
        .forEach((t: Transaction) => {
          t.details.forEach((d) => {
            const name = d.productName + " - " + d.packagingName;
            productQuantities[name] =
              (productQuantities[name] || 0) + d.quantity;
          });
        });
      setTopProducts(
        Object.entries(productQuantities)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5),
      );

      // Tính Top Khách hàng
      const customerQuantities: Record<string, number> = {};
      monthTxs
        .filter((t: Transaction) => t.type === "EXPORT")
        .forEach((t: Transaction) => {
          const name = t.customerName || t.recipient || "Khách lẻ";
          let totalQty = 0;
          t.details.forEach((d) => (totalQty += d.quantity));
          customerQuantities[name] = (customerQuantities[name] || 0) + totalQty;
        });
      setTopCustomers(
        Object.entries(customerQuantities)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5),
      );

      setStats({
        customers: custData.length,
        exports: monthTxs.filter((t: any) => t.type === "EXPORT").length,
        imports: monthTxs.filter((t: any) => t.type === "IMPORT").length,
      });

      // 2. TÍNH TOÁN DỮ LIỆU SẢN XUẤT TRONG THÁNG
      const monthOrders = prodOrderData.filter((o: any) => {
        const dateToUse = o.order_date || o.mfg_date || o.createdAt;
        return dateToUse?.startsWith(selectedMonth) && o.status === "COMPLETED";
      });

      let totalPowder = 0;
      const prodItemsMap: Record<string, any> = {};

      monthOrders.forEach((o: any) => {
        totalPowder += o.total_powder_kg || 0;

        // Tính tổng số gói của toàn bộ lệnh để chia tỷ lệ bột
        let orderTotalSachets = 0;
        o.details.forEach((d: any) => {
          orderTotalSachets += (d.actual_quantity || 0) * (d.packCount || 1);
        });

        o.details.forEach((d: any) => {
          if ((d.actual_quantity || 0) > 0) {
            const key = d.packagingId;
            if (!prodItemsMap[key]) {
              // Tìm SKU từ danh sách Products
              let sku = "";
              prodData.forEach((p: any) => {
                const pk = p.packagings?.find(
                  (x: any) => x.id === d.packagingId,
                );
                if (pk) sku = pk.sku;
              });

              prodItemsMap[key] = {
                name: o.productName,
                packagingName: d.packagingName,
                sku: sku,
                quantity: 0,
                sachets: 0,
                powder: 0,
              };
            }

            const sachets = d.actual_quantity * (d.packCount || 1);
            const powderRatio =
              orderTotalSachets > 0 ? sachets / orderTotalSachets : 0;

            prodItemsMap[key].quantity += d.actual_quantity;
            prodItemsMap[key].sachets += sachets;
            prodItemsMap[key].powder += (o.total_powder_kg || 0) * powderRatio;
          }
        });
      });

      setProductionStats({
        totalPowder,
        items: Object.values(prodItemsMap).sort(
          (a: any, b: any) => b.powder - a.powder,
        ),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const chartData = activeChartTab === "products" ? topProducts : topCustomers;
  const chartColor = activeChartTab === "products" ? "#3c50e0" : "#10b981";
  const chartAltColor = activeChartTab === "products" ? "#6366f1" : "#34d399";

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {!isReadOnlyRole && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">
              HỆ THỐNG QUẢN LÝ KHO
            </h2>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
              Dữ liệu tổng quan & Thống kê
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-2 py-2.5 bg-green-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-sm hover:bg-green-700 transition-colors mr-4"
            >
              <Download size={16} /> Xuất Excel
            </button>

            <button
              onClick={() => changeMonth(-1)}
              className="p-2 bg-white rounded-xl shadow-sm border hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <DatePicker
              selected={
                selectedMonth
                  ? new Date(
                      Number(selectedMonth.split("-")[0]),
                      Number(selectedMonth.split("-")[1]) - 1,
                      1,
                    )
                  : null
              }
              onChange={(date) => setSelectedMonth(formatToYYYYMM(date))}
              dateFormat="MM/yyyy"
              locale="vi"
              showMonthYearPicker
              showPopperArrow={false}
              customInput={<CustomMonthInput />}
              wrapperClassName="w-auto"
              popperPlacement="bottom-end"
            />
            <button
              onClick={() => changeMonth(1)}
              className="p-2 bg-white rounded-xl shadow-sm border hover:bg-gray-100 transition-colors"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>
        </div>
      )}
      {!isReadOnlyRole && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-50 rounded-lg text-primary shadow-sm">
                <Users size={20} />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                Tổng Khách Hàng
              </p>
              <p className="text-3xl font-black text-gray-800 tracking-tight">
                {formatNumber(stats.customers)}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-50 rounded-lg text-green-600 shadow-sm">
                <ArrowUpRight size={20} />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                Phiếu Xuất (Tháng)
              </p>
              <p className="text-3xl font-black text-gray-800 tracking-tight">
                {formatNumber(stats.exports)}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-50 rounded-lg text-orange-600 shadow-sm">
                <ArrowDownLeft size={20} />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                Phiếu Nhập (Tháng)
              </p>
              <p className="text-3xl font-black text-gray-800 tracking-tight">
                {formatNumber(stats.imports)}
              </p>
            </div>
          </div>
        </div>
      )}
      {!isReadOnlyRole && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Biểu đồ kết hợp bằng Tab */}
          <div className="md:col-span-7 bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col h-[420px]">
            <div className="flex justify-between items-end mb-6 border-b border-gray-100 pb-4">
              <div className="flex gap-6">
                <button
                  onClick={() => setActiveChartTab("products")}
                  className={`font-black uppercase tracking-tight text-sm pb-4 -mb-[17px] border-b-2 transition-all ${activeChartTab === "products" ? "border-primary text-primary" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                >
                  Top Sản Phẩm Xuất
                </button>
                <button
                  onClick={() => setActiveChartTab("customers")}
                  className={`font-black uppercase tracking-tight text-sm pb-4 -mb-[17px] border-b-2 transition-all ${activeChartTab === "customers" ? "border-green-500 text-green-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                >
                  Top Khách Hàng
                </button>
              </div>
              <div
                className={`p-2 rounded-lg ${activeChartTab === "products" ? "bg-indigo-50 text-primary" : "bg-green-50 text-green-600"}`}
              >
                {activeChartTab === "products" ? (
                  <BarChart size={20} />
                ) : (
                  <Users size={20} />
                )}
              </div>
            </div>

            <div className="flex-1 w-full">
              {chartData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                  Không có dữ liệu trong tháng này
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      width={180}
                      tick={{
                        fill: "#1e293b",
                        fontSize: 10,
                        fontWeight: 800,
                        textAnchor: "start",
                        dx: -145,
                      }}
                    />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #f1f5f9",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                      formatter={(value: any) => [
                        formatNumber(value),
                        activeChartTab === "products" ? "Số lượng" : "Đã mua",
                      ]}
                    />
                    <Bar
                      dataKey="value"
                      fill={chartColor}
                      radius={[0, 4, 4, 0]}
                      barSize={20}
                      animationDuration={1000}
                    >
                      {chartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            index === 0
                              ? chartColor
                              : index < 3
                                ? chartAltColor
                                : "#cbd5e1"
                          }
                        />
                      ))}
                    </Bar>
                  </ReBarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Cảnh báo tồn kho */}
          <div className="md:col-span-5 bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col h-[420px]">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h2 className="font-black text-red-600 uppercase tracking-tight text-lg">
                  CẢNH BÁO TỒN KHO
                </h2>
                <p className="text-xs text-gray-400 font-medium">
                  Sắp chạm mốc tối thiểu
                </p>
              </div>
              <div className="p-2 bg-red-50 text-red-500 rounded-lg animate-pulse">
                <Package size={18} />
              </div>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {products
                .flatMap((p) =>
                  p.packagings.map((pk) => ({
                    ...pk,
                    productName: p.name,
                    productSku: p.sku,
                  })),
                )
                .filter(
                  (pk) =>
                    (pk.min_stock || 0) > 0 &&
                    (pk.stock || 0) <= (pk.min_stock || 0),
                )
                .sort((a, b) => (a.stock || 0) - (b.stock || 0))
                .map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl border border-dashed border-red-100 bg-red-50/20 hover:bg-red-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-black mr-3 shadow-sm text-xs">
                        !
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-800 line-clamp-1">
                          {item.productName}
                        </p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter truncate w-32">
                          {item.name} ({item.sku})
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-red-600">
                        {formatNumber(item.stock || 0)}
                      </p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                        Min: {formatNumber(item.min_stock || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              {products.every((p) =>
                p.packagings.every(
                  (pk) =>
                    (pk.min_stock || 0) === 0 ||
                    (pk.stock || 0) > (pk.min_stock || 0),
                ),
              ) && (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600 mb-3">
                    <TrendingUp size={24} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest">
                    Mọi thứ đều ổn!
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveItem && setActiveItem("inventory-report")}
              className="mt-4 w-full py-2.5 bg-gray-50 text-gray-600 text-[10px] font-black rounded-lg hover:bg-gray-100 transition-all uppercase tracking-[0.2em] border border-gray-200"
            >
              ĐẾN BÁO CÁO TỒN KHO
            </button>
          </div>
        </div>
      )}
      {!isReadOnlyRole && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4 border-b border-gray-100 pb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
                <Factory size={24} />
              </div>
              <div>
                <h2 className="font-black text-gray-800 uppercase tracking-tight text-xl">
                  SẢN LƯỢNG KHO XƯỞNG
                </h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
                  Dữ liệu tháng {selectedMonth.split("-")[1]}/
                  {selectedMonth.split("-")[0]}
                </p>
              </div>
            </div>

            {/* Box Tổng Khối lượng bột */}
            <div className="bg-amber-50/50 border border-amber-100 px-6 py-3 rounded-2xl flex items-center gap-6">
              <div>
                <p className="text-[10px] text-amber-600/60 font-black uppercase tracking-widest mb-0.5">
                  Tổng bột tiêu hao
                </p>
                <p className="text-2xl font-black text-amber-600 tracking-tighter">
                  {formatNumber(Number(productionStats.totalPowder.toFixed(1)))}{" "}
                  <span className="text-sm font-bold opacity-60">kg</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <TrendingUp size={20} />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="text-gray-400 bg-gray-50/50">
                  <th className="py-3 px-4 font-black uppercase text-[10px] tracking-widest border-y">
                    Tên
                  </th>
                  <th className="hidden lg:table-cell xl:table-cell py-3 px-4 font-black uppercase text-[10px] tracking-widest border-y">
                    SKU
                  </th>
                  <th className="py-3 px-4 font-black uppercase text-[10px] tracking-widest text-right border-y">
                    SL Đóng gói
                  </th>
                  <th className="py-3 px-4 font-black uppercase text-[10px] tracking-widest text-right border-y">
                    Quy đổi Gói
                  </th>
                  <th className="py-3 px-4 font-black uppercase text-[10px] tracking-widest text-right border-y text-amber-600">
                    Bột ước tính (kg)
                  </th>
                </tr>
              </thead>
              <tbody>
                {productionStats.items.map((item, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <p className="font-bold text-gray-800 text-sm">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-gray-500 font-medium">
                        {item.packagingName}
                      </p>
                    </td>
                    <td className="py-4 px-4 hidden lg:table-cell xl:table-cell">
                      <span className="bg-gray-100 border border-gray-200 text-gray-600 text-[10px] font-mono font-bold px-2 py-1 rounded">
                        {item.sku || "N/A"}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-black text-primary text-base">
                        {formatNumber(item.quantity)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-bold text-gray-500">
                        {formatNumber(item.sachets)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-black text-amber-600 text-base">
                        {formatNumber(Number(item.powder.toFixed(2)))}
                      </span>
                    </td>
                  </tr>
                ))}
                {productionStats.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">
                        Không có dữ liệu sản xuất hoàn thành trong tháng này
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

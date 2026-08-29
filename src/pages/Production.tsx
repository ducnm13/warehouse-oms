import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  List,
  Calculator,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X,
  Settings2,
  Trash2,
  Printer,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import DatePicker, { registerLocale } from "react-datepicker";
import { useReactToPrint } from "react-to-print";
import "react-datepicker/dist/react-datepicker.css";
import { Product, ProductionOrder, ProductPackaging, User } from "../types";
import { formatNumber, formatDate, cn } from "../lib/utils";
import { ProductionDocument } from "../components/ProductionDocument";

import { vi } from "date-fns/locale/vi";

// Đăng ký ngôn ngữ tiếng Việt
registerLocale("vi", vi);

// 1. Hàm chuẩn hóa Date sang YYYY-MM để lọc dữ liệu
const formatToYYYYMM = (date: Date | null) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

// 2. Giao diện ô chọn tháng đồng bộ với Dashboard
  const CustomMonthInput = React.forwardRef(
  ({ value, onClick }: { value?: string; onClick?: () => void }, ref: any) => (
    <div
      className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={onClick}
      ref={ref}
    >
      <Calendar size={16} className="text-primary ml-1" />
      <input
        value={value}
        readOnly
        className="border-none outline-none text-xs font-black uppercase text-primary bg-transparent pr-1 cursor-pointer w-[60px] pointer-events-none"
      />
    </div>
  ),
);

// Giao diện ô input lịch Custom có icon (Dành cho chọn ngày cụ thể trong form)
const CustomDateInput = React.forwardRef(
  ({ value, onClick, placeholder }: { value?: string; onClick?: () => void; placeholder?: string }, ref: any) => (
    <div className="relative cursor-pointer" onClick={onClick}>
      <input
        value={value}
        readOnly
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-gray-800 cursor-pointer"
        ref={ref}
      />
      <Calendar
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        size={16}
      />
    </div>
  ),
);

const Production = ({ user }: { user: User }) => {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Lấy role của user để phân quyền
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  // Kiểm tra quyền: SALES hoặc USER2 (bạn có ghi là QD ở code cũ, tôi đổi lại thành USER2 theo yêu cầu prompt trước đó, bạn có thể chỉnh lại nếu cần)
  const isReadOnlyRole =
    currentUser.role === "SALES" || currentUser.role === "QD";

  // 3. State lưu trữ Tháng đang chọn (Mặc định là tháng hiện tại)
  const [selectedMonth, setSelectedMonth] = useState<string>(
    formatToYYYYMM(new Date()),
  );

  const componentRef = useRef<HTMLDivElement>(null);

  const triggerPrint = useReactToPrint({
    contentRef: componentRef,
  });

  const handlePrint = () => {
    if (!viewOrder) return;
    const originalTitle = document.title;
    document.title = `Phieu_SX_${viewOrder.code}`;
    triggerPrint();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // Form state
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [powderKg, setPowderKg] = useState<number>(0);
  const [mfgDate, setMfgDate] = useState<Date>(new Date());
  const [lossPercent, setLossPercent] = useState<number>(2);
  const [ratios, setRatios] = useState<{ [key: number]: number }>({});
  const [allocationType, setAllocationType] = useState<'PERCENT' | 'QUANTITY'>('PERCENT');
  const [batchNumber, setBatchNumber] = useState<string>("");
  const [targetSachets, setTargetSachets] = useState<number>(0);
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [editingId, setEditingId] = useState<number | null>(null);

  // 4. Lắng nghe thay đổi của Tháng để tải lại dữ liệu
  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orderRes, prodRes] = await Promise.all([
        fetch("/api/production-orders", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
        fetch("/api/products?category=PRODUCT", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
      ]);

      const allOrders = await orderRes.json();

      // LỌC THEO THÁNG ĐANG CHỌN
      const monthOrders = allOrders.filter((o: any) => {
        const dateToUse = o.order_date || o.createdAt; // Ưu tiên ngày trên lệnh, nếu không có lấy ngày tạo
        return dateToUse?.startsWith(selectedMonth);
      });

      // SẮP XẾP MÃ LỆNH TỪ CAO XUỐNG THẤP
      const sortedOrders = monthOrders.sort((a: any, b: any) =>
        b.code.localeCompare(a.code),
      );

      setOrders(sortedOrders);
      setProducts(await prodRes.json());
    } catch (err) {
      toast.error("Lỗi khi tải dữ liệu sản xuất");
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const calculateSachets = () => {
    if (!selectedProduct || !powderKg) return 0;
    const totalGrams = powderKg * 1000;
    const netWeight = selectedProduct.netWeight || 17;
    const theoretical = totalGrams / netWeight;
    return Math.floor(theoretical * (1 - lossPercent / 100));
  };

  const totalSachets = calculateSachets();

  const [viewOrder, setViewOrder] = useState<ProductionOrder | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [actualQuantities, setActualQuantities] = useState<{
    [key: number]: number;
  }>({});
  const [actualNotes, setActualNotes] = useState<{ [key: number]: string }>({});
  const [orderCode, setOrderCode] = useState("");

  const initializeActualValues = (order: ProductionOrder) => {
    const initialActuals: { [key: number]: number } = {};
    const initialNotes: { [key: number]: string } = {};
    const hasSavedActualQuantity = order.details.some(
      (detail) => (Number(detail.actual_quantity) || 0) > 0,
    );

    order.details.forEach((detail) => {
      initialActuals[detail.id] =
        order.status === "COMPLETED"
          ? hasSavedActualQuantity
            ? Number(detail.actual_quantity) || 0
            : Number(detail.quantity) || 0
          : Number(detail.quantity) || 0;
      initialNotes[detail.id] = detail.note || "";
    });

    setActualQuantities(initialActuals);
    setActualNotes(initialNotes);
  };

  const handleDeleteOrder = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa lệnh sản xuất này?")) return;
    try {
      const res = await fetch(`/api/production-orders/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) {
        toast.success("Đã xóa lệnh sản xuất");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Lỗi khi xóa lệnh");
      }
    } catch (err) {
      toast.error("Lỗi khi xóa lệnh");
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    if (status === "COMPLETED") {
      const detailsToUpdate = viewOrder?.details.map((d) => ({
        id: d.id,
        packagingId: d.packagingId,
        actual_quantity: actualQuantities[d.id] || 0,
        note: actualNotes[d.id] || "",
      }));

      try {
        const res = await fetch(`/api/production-orders/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            status: "COMPLETED",
            details: detailsToUpdate,
          }),
        });
        if (res.ok) {
          toast.success("Đã hoàn thành lệnh sản xuất");
          setIsDetailModalOpen(false);
          setIsCompleting(false);
          fetchData();
        }
      } catch (err) {
        toast.error("Lỗi khi cập nhật");
      }
    } else {
      try {
        const res = await fetch(`/api/production-orders/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          toast.success("Đã cập nhật trạng thái");
          fetchData();
        }
      } catch (err) {
        toast.error("Lỗi khi cập nhật");
      }
    }
  };

  const handleSupplementalUpdate = async () => {
    if (!viewOrder) return;

    const detailsToUpdate = viewOrder.details.map((detail) => ({
      id: detail.id,
      packagingId: detail.packagingId,
      actual_quantity: Number(actualQuantities[detail.id]) || 0,
      note: actualNotes[detail.id] || "",
    }));

    try {
      const res = await fetch(`/api/production-orders/${viewOrder.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ details: detailsToUpdate }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Lỗi khi cập nhật bổ sung");
      }

      const updatedDetails = viewOrder.details.map((detail) => ({
        ...detail,
        actual_quantity: Number(actualQuantities[detail.id]) || 0,
        note: actualNotes[detail.id] || "",
      }));
      setViewOrder({ ...viewOrder, details: updatedDetails });
      setIsCompleting(false);
      toast.success("Đã cập nhật bổ sung số lượng bán thành phẩm");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi cập nhật bổ sung");
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !powderKg || !orderCode) {
      toast.error("Vui lòng nhập đầy đủ thông tin (bao gồm mã lệnh)");
      return;
    }
    const effectiveSachets = targetSachets > 0 ? targetSachets : totalSachets;
    try {
      const details =
        selectedProduct?.packagings.map((pk) => {
          let quantity = 0;
          let ratio = 0;
          if (allocationType === 'PERCENT') {
            ratio = ratios[pk.id] || 0;
            const sachetsForThis = Math.floor(effectiveSachets * (ratio / 100));
            quantity = Math.floor(sachetsForThis / (pk.packCount || 1));
          } else {
            quantity = ratios[pk.id] || 0;
            // Tạm thời không tính lại ratio nếu nhập số lượng
            ratio = 0;
          }
          return {
            packagingId: pk.id,
            quantity,
            allocation_percent: ratio,
          };
        }) || [];

      const expDate = new Date(mfgDate);
      expDate.setMonth(
        expDate.getMonth() + (selectedProduct?.shelfLifeMonths || 24),
      );

      const orderData = {
        code: orderCode,
        batch_number: batchNumber,
        productId: selectedProductId,
        total_powder_kg: powderKg,
        total_sachets: totalSachets,
        target_sachets: targetSachets,
        order_date: orderDate.toISOString().split("T")[0],
        mfg_date: mfgDate.toISOString().split("T")[0],
        exp_date: expDate.toISOString().split("T")[0],
        loss_percent: lossPercent,
        details,
      };
      const url = editingId
        ? `/api/production-orders/${editingId}`
        : "/api/production-orders";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(orderData),
      });

      if (res.ok) {
        toast.success(editingId ? "Đã cập nhật lệnh" : "Đã tạo lệnh sản xuất");
        setIsModalOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Lỗi khi lưu lệnh");
      }
    } catch (err) {
      toast.error("Lỗi khi lưu lệnh");
    }
  };

  const handleExportProductionExcel = async () => {
    // Sử dụng state lưu tháng hiện tại của trang Lệnh sản xuất, ví dụ biến là: selectedMonth hoặc currentMonth
    // Ở đây mình lấy tạm biến selectedMonth theo logic chuẩn của hệ thống nhé
    if (!selectedMonth) {
      toast.error("Vui lòng lựa chọn tháng để xuất thống kê!");
      return;
    }

    const loadingToast = toast.loading("Đang xử lý dữ liệu lệnh sản xuất...");
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
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">
            DANH SÁCH LỆNH SẢN XUẤT
          </h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
            Quản lý sản xuất theo tháng
          </p>
        </div>
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          {/* <button
              onClick={handleExportProductionExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-sm hover:bg-green-700 transition-colors"
            >
              <Download size={16} /> Xuất Excel Lệnh SX
            </button> */}
          {/* Bộ chọn Tháng */}
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
            onChange={(date: Date | null) =>
              setSelectedMonth(formatToYYYYMM(date))
            }
            dateFormat="MM/yyyy"
            locale="vi"
            showMonthYearPicker
            showPopperArrow={false}
            customInput={<CustomMonthInput />}
            wrapperClassName="w-auto"
            popperPlacement="bottom-end"
          />
          {!isReadOnlyRole && (
            <button
              onClick={() => {
                setOrderCode(
                  `LSX-${new Date().getTime().toString().slice(-6)}`,
                );
                setBatchNumber("");
                setEditingId(null);
                setTargetSachets(0);
                setPowderKg(0);
                setSelectedProductId(0);
                setRatios({});
                setOrderDate(new Date());
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 rounded bg-primary py-2 px-4 text-sm font-bold text-white hover:bg-opacity-90 transition-all shadow-sm whitespace-nowrap"
            >
              <Plus size={16} /> TẠO LỆNH MỚI
            </button>
          )}
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 font-sans">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="text-gray-400 border-b">
                  <th className="pb-3 px-4 font-bold uppercase text-[10px] tracking-wider">
                    Mã lệnh
                  </th>
                  <th className="pb-3 px-4 font-bold uppercase text-[10px] tracking-wider">
                    Số lô
                  </th>
                  <th className="pb-3 px-4 font-bold uppercase text-[10px] tracking-wider">
                    Sản phẩm
                  </th>
                  <th className="pb-3 px-4 font-bold uppercase text-[10px] tracking-wider text-center">
                    Ngày tạo lệnh
                  </th>
                  <th className="pb-3 px-4 font-bold uppercase text-[10px] tracking-wider text-center">
                    Bột (kg)
                  </th>
                  <th className="pb-3 px-4 font-bold uppercase text-[10px] tracking-wider text-right text-indigo-600">
                    Theo Lệnh (Gói)
                  </th>
                  <th className="pb-3 px-4 font-bold uppercase text-[10px] tracking-wider text-right">
                    Dự kiến (Gói)
                  </th>
                  <th className="pb-3 px-4 font-bold uppercase text-[10px] tracking-wider text-center">
                    Trạng thái
                  </th>
                  {!isReadOnlyRole && (
                    <th className="pb-3 px-4 font-bold uppercase text-[10px] tracking-wider text-right">
                      Thao tác
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      <p className="font-bold text-xs uppercase tracking-widest">
                        Không có lệnh sản xuất nào trong tháng này
                      </p>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b hover:bg-gray-50 transition-colors group"
                    >
                      <td className="py-4 px-4">
                        <button
                          onClick={() => {
                            setViewOrder(order);
                            setIsDetailModalOpen(true);
                            setIsCompleting(false);
                            initializeActualValues(order);
                          }}
                          className="font-mono font-bold text-primary uppercase hover:underline text-left"
                        >
                          {order.code}
                        </button>
                      </td>
                      <td className="py-4 px-4 text-gray-800 font-medium">
                        {order.batch_number}
                      </td>
                      <td className="py-4 px-4 text-gray-800 font-medium">
                        {order.productName}
                      </td>
                      <td className="py-4 px-4 text-gray-500 text-center">
                        {formatDate(order.order_date || order.createdAt || "")}
                      </td>
                      <td className="py-4 px-4 text-gray-500 text-center font-bold">
                        {order.total_powder_kg}
                      </td>
                      <td className="py-4 px-4 text-indigo-600 text-right font-black">
                        {formatNumber(
                          (order.target_sachets || 0) > 0
                            ? (order.target_sachets || 0)
                            : order.total_sachets,
                        )}
                      </td>
                      <td className="py-4 px-4 text-gray-500 text-right font-black">
                        {formatNumber(order.total_sachets)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={cn(
                            "px-2 py-1 text-[9px] font-black rounded uppercase tracking-tighter",
                            order.status === "COMPLETED"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700",
                          )}
                        >
                          {order.status === "COMPLETED" ? "Đã xong" : "Đang SX"}
                        </span>
                      </td>
                      {!isReadOnlyRole && (
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setViewOrder(order);
                                setIsDetailModalOpen(true);
                                setIsCompleting(false);
                                initializeActualValues(order);
                              }}
                              className="text-indigo-600 hover:text-white p-2 bg-indigo-50 hover:bg-indigo-600 rounded transition-all duration-200 hidden md:inline"
                              title="In phiếu"
                            >
                              <Printer size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(order.id);
                                setOrderCode(order.code);
                                setSelectedProductId(order.productId);
                                setPowderKg(order.total_powder_kg);
                                setLossPercent(order.loss_percent);
                                setTargetSachets(order.target_sachets || 0);
                                setBatchNumber(order.batch_number || "");
                                setOrderDate(
                                  order.order_date
                                    ? new Date(order.order_date)
                                    : new Date(order.createdAt || new Date()),
                                );
                                setMfgDate(new Date(order.mfg_date));
                                const newRatios: any = {};
                                order.details.forEach((d) => {
                                  newRatios[d.packagingId] =
                                    d.allocation_percent;
                                });
                                setRatios(newRatios);
                                setIsModalOpen(true);
                              }}
                              className="text-amber-500 hover:text-white p-2 bg-amber-50 hover:bg-amber-500 rounded transition-all duration-200"
                              title="Sửa lệnh"
                            >
                              <Settings2 size={16} />
                            </button>
                            {user.role === "ADMIN" && (
                              <button
                                onClick={() => handleDeleteOrder(order.id)}
                                className="text-red-400 hover:text-red-600 p-2 bg-red-50 hover:bg-red-100 rounded transition-all"
                                title="Xóa lệnh"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* New Order Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-8 shadow-2xl animate-in zoom-in fade-in duration-200">
              <div className="mb-6 flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">
                    Tạo lệnh sản xuất mới
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                    Lập kế hoạch sản xuất dựa trên nguyên liệu bột
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 bg-gray-100 p-2 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateOrder} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Side: Product Info */}
                  <div className="space-y-4">
                    <h5 className="font-black text-primary text-xs flex items-center gap-2 uppercase tracking-wider mb-4 border-l-4 border-primary pl-3">
                      <Settings2 size={16} /> THÔNG TIN CHUNG
                    </h5>

                    <div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-2 block text-[10px] font-black text-gray-500 uppercase tracking-widest">
                            Mã lệnh sản xuất
                          </label>
                          <input
                            type="text"
                            value={orderCode}
                            onChange={(e) => setOrderCode(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono font-bold text-primary"
                            placeholder="VD: LSX-001"
                            required
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-[10px] font-black text-gray-500 uppercase tracking-widest">
                            Ngày tạo lệnh
                          </label>
                          <DatePicker
                            selected={orderDate}
                            onChange={(date: Date | null) =>
                              setOrderDate(date || new Date())
                            }
                            dateFormat="dd/MM/yyyy"
                            locale="vi"
                            customInput={<CustomDateInput />}
                            showPopperArrow={false}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        Sản phẩm cần sản xuất
                      </label>
                      <select
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-gray-800 appearance-none"
                        value={selectedProductId}
                        onChange={(e) =>
                          setSelectedProductId(parseInt(e.target.value))
                        }
                      >
                        <option value="0">Chọn sản phẩm...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          Khối lượng bột (kg)
                        </label>
                        <input
                          type="number"
                          value={powderKg}
                          onChange={(e) =>
                            setPowderKg(parseFloat(e.target.value))
                          }
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-gray-800"
                          placeholder="VD: 100"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          Hao hụt (%)
                        </label>
                        <input
                          type="number"
                          value={lossPercent}
                          onChange={(e) =>
                            setLossPercent(parseFloat(e.target.value))
                          }
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-gray-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          Ngày sản xuất
                        </label>
                        <DatePicker
                          selected={mfgDate}
                          onChange={(date: Date | null) =>
                            setMfgDate(date || new Date())
                          }
                          dateFormat="dd/MM/yyyy"
                          locale="vi"
                          customInput={<CustomDateInput />}
                          showPopperArrow={false}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          Số lô (Batch)
                        </label>
                        <input
                          type="text"
                          value={batchNumber}
                          onChange={(e) => setBatchNumber(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-gray-800 uppercase"
                          placeholder="VD: L01-0526"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl bg-primary/5 p-5 border border-primary/10 shadow-sm space-y-3">
                      <div>
                        <p className="text-[10px] text-primary/60 font-black uppercase tracking-widest mb-1">
                          Quy cách định lượng:
                        </p>
                        <p className="text-sm font-bold text-gray-700">
                          {selectedProduct?.netWeight || 17}g / gói
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-primary/60 font-black uppercase tracking-widest mb-1">
                          Dự kiến sản lượng (Sau hao hụt):
                        </p>
                        <p className="text-4xl font-black text-primary tracking-tighter">
                          {formatNumber(totalSachets)}{" "}
                          <span className="text-sm font-bold opacity-60">
                            gói
                          </span>
                        </p>
                        <p className="text-[9px] text-gray-400 mt-2 font-medium italic">
                          * Lý thuyết:{" "}
                          {formatNumber(
                            Math.floor(
                              (powderKg * 1000) /
                                (selectedProduct?.netWeight || 17),
                            ),
                          )}{" "}
                          gói | Hao hụt: {lossPercent}%
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                        Số gói sản xuất theo lệnh
                      </label>
                      <input
                        type="number"
                        value={targetSachets || ""}
                        onChange={(e) =>
                          setTargetSachets(parseInt(e.target.value))
                        }
                        className="w-full rounded-lg border-2 border-indigo-200 bg-white p-3 text-sm outline-none focus:border-indigo-500 transition-all font-black text-indigo-700"
                        placeholder="Nếu bỏ trống sẽ tự tính theo bột..."
                      />
                    </div>
                  </div>

                  {/* Right Side: Ratios & Packaging */}
                  <div className="space-y-4">
                     <h5 className="font-black text-primary text-xs flex items-center gap-2 uppercase tracking-wider mb-4 border-l-4 border-primary pl-3">
                       <Calculator size={16} /> PHÂN BỔ ĐÓNG GÓI
                     </h5>
                     <div className="flex gap-4 mb-4">
                       <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                         <input
                           type="radio"
                           checked={allocationType === 'PERCENT'}
                           onChange={() => setAllocationType('PERCENT')}
                           className="text-primary"
                         />
                         Phân bổ theo %
                       </label>
                       <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                         <input
                           type="radio"
                           checked={allocationType === 'QUANTITY'}
                           onChange={() => setAllocationType('QUANTITY')}
                           className="text-primary"
                         />
                         Phân bổ theo số lượng
                       </label>
                     </div>
                     {selectedProduct ? (
                       <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                         {selectedProduct.packagings.map((pk) => (
                           <div
                             key={pk.id}
                             className="rounded-xl border border-gray-100 p-4 bg-gray-50/50 hover:bg-white hover:shadow-md transition-all"
                           >
                             <label className="text-[11px] font-black text-gray-700 block mb-3 uppercase tracking-tighter flex items-center justify-between">
                               {pk.name}{" "}
                               <span className="text-gray-400 font-mono">
                                 1 {pk.unit} = {pk.packCount} gói
                               </span>
                             </label>
                             <div className="flex items-center gap-4">
                               <div className="w-24">
                                 <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">
                                   {allocationType === 'PERCENT' ? 'Tỉ lệ (%)' : 'Số lượng'}
                                 </p>
                                 <div className="relative">
                                   <input
                                     type="number"
                                     className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-bold outline-none focus:border-primary"
                                     placeholder={allocationType === 'PERCENT' ? '%' : 'Số lượng'}
                                     value={ratios[pk.id] || 0}
                                     onChange={(e) =>
                                       setRatios({
                                         ...ratios,
                                         [pk.id]: parseFloat(e.target.value),
                                       })
                                     }
                                   />
                                   {allocationType === 'PERCENT' && (
                                     <span className="absolute right-2 top-2 text-gray-300 pointer-events-none">
                                       %
                                     </span>
                                   )}
                                 </div>
                               </div>
                               <div className="flex-1 text-right">
                                 <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">
                                   Sản lượng dự tính
                                 </p>
                                 <p className="font-black text-gray-800 text-lg tracking-tight">
                                   {formatNumber(
                                     allocationType === 'PERCENT'
                                       ? Math.floor(
                                           (totalSachets *
                                             ((ratios[pk.id] || 0) / 100)) /
                                             (pk.packCount || 1),
                                         )
                                       : ratios[pk.id] || 0,
                                   )}
                                   <span className="text-[10px] text-gray-400 uppercase ml-1">
                                     {pk.unit}
                                   </span>
                                 </p>
                               </div>
                             </div>
                           </div>
                         ))}
                       </div>
                    ) : (
                      <div className="h-[500px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 text-gray-400 bg-gray-50/50 text-center">
                        <AlertCircle size={32} className="mb-4 opacity-20" />
                        <p className="text-xs font-bold uppercase tracking-widest opacity-60">
                          Vui lòng chọn sản phẩm để cấu hình đóng gói
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t font-sans">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 py-3 bg-gray-50 text-gray-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-xl shadow-primary/20"
                  >
                    XÁC NHẬN TẠO LỆNH
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Full-screen Preview Modal */}
        {isDetailModalOpen && viewOrder && (
          <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-800 font-sans">
            {/* Header Bar */}
            <div className="h-16 bg-white border-b px-8 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-black uppercase tracking-tight text-gray-900">
                  XEM TRƯỚC PHIẾU SẢN XUẤT
                </h2>
                <span className="bg-gray-100 px-3 py-1 rounded text-xs font-mono font-bold text-gray-500 border border-gray-200 uppercase">
                  {viewOrder.code}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setIsCompleting(false);
                  }}
                  className="px-6 py-2 text-gray-500 hover:text-gray-900 font-black text-xs uppercase tracking-widest transition-all"
                >
                  ĐÓNG
                </button>

                <button
                  onClick={() => handlePrint()}
                  className="flex items-center gap-2 px-8 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                  <Printer size={16} /> IN PHIẾU NGAY
                </button>
              </div>
            </div>

            {/* Document Workspace */}
            <div className="flex-1 overflow-y-auto p-4 md:p-12 flex justify-center bg-[#525659]">
              <div className="relative shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] bg-white origin-top w-full max-w-[210mm]">
                {/* Overlay for Báo cáo sản lượng */}
                {isCompleting && (
                  <div className="absolute inset-0 z-50 bg-white/95 p-12 overflow-y-auto animate-in fade-in duration-300">
                    <div className="max-w-xl mx-auto pt-10">
                      <div className="mb-12">
                        <h5 className="font-black text-3xl text-gray-900 uppercase tracking-tighter">
                          {viewOrder.status === "COMPLETED"
                            ? "SỬA ĐỔI BỔ SUNG"
                            : "BÁO CÁO THỰC TẾ"}
                        </h5>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                          {viewOrder.status === "COMPLETED"
                            ? "Cập nhật lại số lượng bán thành phẩm thực tế"
                            : "Ghi nhận sản lượng hoàn thành thực tế"}
                        </p>
                      </div>

                      <div className="space-y-4">
                        {viewOrder.details.map((d) => (
                          <div
                            key={d.id}
                            className="p-6 border rounded-2xl bg-gray-50"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-sm font-black text-gray-800 uppercase tracking-tighter">
                                {d.packagingName}
                              </p>
                              <p className="text-xs font-mono font-bold text-gray-400">
                                KH: {formatNumber(d.quantity)}
                              </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                                  Thực tế (Hộp/Túi)
                                </label>
                                <input
                                  type="number"
                                  className="w-full bg-white border-2 border-indigo-100 rounded-xl p-3 text-xl font-black text-indigo-600 outline-none focus:border-indigo-500 shadow-sm"
                                  value={actualQuantities[d.id] || 0}
                                  onChange={(e) =>
                                    setActualQuantities({
                                      ...actualQuantities,
                                      [d.id]: parseInt(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                                  Ghi chú (Lý do chênh lệch)
                                </label>
                                <input
                                  type="text"
                                  className="w-full bg-white border-2 border-gray-100 rounded-xl p-3 text-sm font-medium text-gray-700 outline-none focus:border-indigo-500 shadow-sm"
                                  placeholder="Nhập lý do nếu có..."
                                  value={actualNotes[d.id] || ""}
                                  onChange={(e) =>
                                    setActualNotes({
                                      ...actualNotes,
                                      [d.id]: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-12 flex gap-3">
                        <button
                          onClick={() => setIsCompleting(false)}
                          className="px-8 py-4 bg-gray-100 text-gray-500 rounded-xl font-black text-xs tracking-widest"
                        >
                          HỦY
                        </button>
                        <button
                          onClick={() =>
                            viewOrder.status === "COMPLETED"
                              ? handleSupplementalUpdate()
                              : handleUpdateStatus(viewOrder.id, "COMPLETED")
                          }
                          className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-green-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-green-600/20"
                        >
                          <CheckCircle2 size={18} />
                          {viewOrder.status === "COMPLETED"
                            ? "LƯU SỬA ĐỔI BỔ SUNG"
                            : "CẬP NHẬT & KẾT THÚC"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* The Actual Document */}
                <div className="bg-white">
                  <ProductionDocument order={viewOrder} />
                </div>
              </div>
            </div>

            {/* Quick Action Overlay */}
            {!isCompleting && viewOrder.status !== "COMPLETED" && (
              <div className="fixed bottom-10 right-10 z-50">
                <button
                  onClick={() => {
                    setIsCompleting(true);
                  }}
                  className="flex items-center gap-2 px-8 py-4 bg-amber-500 text-white rounded-full font-black text-xs uppercase tracking-widest shadow-2xl shadow-amber-500/40 hover:scale-105 active:scale-95 transition-all"
                >
                  <CheckCircle2 size={20} /> CHỐT THÀNH PHẨM
                </button>
              </div>
            )}
            {!isCompleting && viewOrder.status === "COMPLETED" && !isReadOnlyRole && (
              <div className="fixed bottom-10 right-10 z-50">
                <button
                  onClick={() => {
                    initializeActualValues(viewOrder);
                    setIsCompleting(true);
                  }}
                  className="flex items-center gap-2 px-8 py-4 bg-amber-500 text-white rounded-full font-black text-xs uppercase tracking-widest shadow-2xl shadow-amber-500/40 hover:scale-105 active:scale-95 transition-all"
                >
                  <Settings2 size={20} /> SỬA ĐỔI BỔ SUNG
                </button>
              </div>
            )}
          </div>
        )}

        {/* Hidden Print Document */}
        <div className="hidden">
          {viewOrder && (
            <ProductionDocument ref={componentRef} order={viewOrder} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Production;

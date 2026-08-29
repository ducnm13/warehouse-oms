import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Search,
  Eye,
  Printer,
  X,
  Trash2,
  Settings2,
  Calendar,
} from "lucide-react";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { vi } from "date-fns/locale/vi";
// Đăng ký ngôn ngữ tiếng Việt cho lịch
registerLocale("vi", vi);
import toast from "react-hot-toast";
import { useReactToPrint } from "react-to-print";
import { Transaction, Product, Warehouse, User, Customer } from "../types";
import { formatDate } from "../lib/utils";
import { InventoryDocument } from "../components/InventoryDocument";

// Hàm chuẩn hóa Date sang chuỗi YYYY-MM để lọc dữ liệu tháng
const formatToYYYYMM = (date: Date | null) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

// Hàm chuẩn hóa Date sang chuỗi YYYY-MM-DD cho backend
const formatToYYYYMMDD = (date: Date | null) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Giao diện ô chọn tháng đồng bộ
const CustomMonthInput = React.forwardRef(
  ({ value, onClick }: any, ref: any) => (
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

// --- COMPONENT TÌM KIẾM BAO BÌ/VẬT TƯ THÔNG MINH ---
const SearchableSelect = ({
  products,
  value,
  onChange,
}: {
  products: any[];
  value: number;
  onChange: (id: number) => void;
}) => {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      let found = false;
      products.forEach((p) => {
        const pk = p.packagings?.find((x: any) => x.id === value);
        if (pk) {
          setSearch(`${p.name} - ${pk.name}`);
          found = true;
        }
      });
      if (!found) setSearch("");
    } else {
      setSearch("");
    }
  }, [value, products]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        if (value) {
          products.forEach((p) => {
            const pk = p.packagings?.find((x: any) => x.id === value);
            if (pk) setSearch(`${p.name} - ${pk.name}`);
          });
        } else {
          setSearch("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, products]);

  const filteredProducts = products
    .map((p) => {
      const matchedPks = p.packagings?.filter((pk: any) =>
        `${p.name} ${pk.name} ${pk.sku || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      );
      return { ...p, packagings: matchedPks };
    })
    .filter((p) => p.packagings && p.packagings.length > 0);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        className="w-full rounded-md border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
        placeholder="Nhập tên hoặc mã SKU bao bì..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
          if (e.target.value === "") onChange(0);
        }}
        onFocus={() => setIsOpen(true)}
      />

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-2xl border border-gray-100 ring-1 ring-black ring-opacity-5">
          {filteredProducts.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400 font-medium text-center">
              Không tìm thấy bao bì nào
            </div>
          ) : (
            filteredProducts.map((p) => (
              <div key={p.id}>
                <div className="px-3 py-1.5 text-[10px] font-black text-gray-400 uppercase bg-gray-50 border-y border-gray-100">
                  {p.name}
                </div>
                {p.packagings?.map((pk: any) => (
                  <div
                    key={pk.id}
                    className="cursor-pointer px-4 py-2.5 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center justify-between"
                    onClick={() => {
                      onChange(pk.id);
                      setSearch(`${p.name} - ${pk.name}`);
                      setIsOpen(false);
                    }}
                  >
                    <span className="font-bold">{pk.name}</span>
                    {pk.sku && (
                      <span className="text-[10px] font-mono text-gray-400 bg-white px-2 py-0.5 rounded border">
                        SKU: {pk.sku}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// Tạo Input Custom để tích hợp icon và style của Tailwind
const CustomDateInput = React.forwardRef(
  ({ value, onClick, placeholder }: any, ref: any) => (
    <div className="relative cursor-pointer" onClick={onClick}>
      <input
        value={value}
        readOnly
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium cursor-pointer"
        ref={ref}
      />
      <Calendar
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        size={16}
      />
    </div>
  ),
);

const MaterialTransactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewTransaction, setViewTransaction] = useState<Transaction | null>(
    null,
  );
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // State lưu tháng được chọn
  const [selectedMonth, setSelectedMonth] = useState<string>(
    formatToYYYYMM(new Date()),
  );

  // State lưu loại phiếu cần lọc
  const [filterType, setFilterType] = useState<"ALL" | "IMPORT" | "EXPORT">(
    "ALL",
  );

  // New Transaction Form State
  const [type, setType] = useState<"IMPORT" | "EXPORT">("IMPORT");
  const [warehouseId, setWarehouseId] = useState<number>(0);
  const [note, setNote] = useState("");
  const [details, setDetails] = useState<
    { packagingId: number; quantity: number; note?: string }[]
  >([]);
  const [recipient, setRecipient] = useState("");
  const [customerId, setCustomerId] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [exitDate, setExitDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [users, setUsers] = useState<User[]>([]);
  const [createdBySelected, setCreatedBySelected] = useState<number>(0);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTx, setPreviewTx] = useState<Transaction | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = currentUser.role === "ADMIN";

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: previewTx?.code || "Phiếu bao bì",
  });

  const handleDeleteTransaction = async (id: number, code: string) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa phiếu "${code}"? Tồn kho sẽ được khôi phục tự động về trạng thái trước khi lập phiếu này.`,
      )
    )
      return;

    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) {
        toast.success("Đã xóa phiếu và khôi phục tồn kho");
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || "Lỗi khi xóa phiếu");
      }
    } catch (err) {
      toast.error("Có lỗi xảy ra");
    }
  };

  const openPreview = (tx: Transaction) => {
    setPreviewTx(tx);
    setIsPreviewOpen(true);
  };

  // Cập nhật Effect để gọi lại fetchData mỗi khi thay đổi tháng HOẶC loại phiếu
  useEffect(() => {
    fetchData();
  }, [selectedMonth, filterType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txRes, prodRes, whRes, usersRes, custRes] = await Promise.all([
        fetch("/api/transactions", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
        fetch("/api/products?category=MATERIAL", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
        fetch("/api/warehouses", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
        isAdmin
          ? fetch("/api/users", {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            })
          : Promise.resolve(null),
        fetch("/api/customers", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
      ]);
      const txData = await txRes.json();

      // Lọc theo tháng, loại MATERIAL, và filterType (Tất cả/Nhập/Xuất), sau đó sắp xếp giảm dần theo code
      const materialTxs = txData
        .filter((tx: any) => {
          const hasMaterial =
            tx.details.length > 0 &&
            tx.details.some((d: any) => d.productCategory === "MATERIAL");
          const matchesMonth = (
            tx.transaction_date || tx.createdAt
          )?.startsWith(selectedMonth);
          const matchesType = filterType === "ALL" || tx.type === filterType;
          return hasMaterial && matchesMonth && matchesType;
        })
        .sort((a: any, b: any) => b.code.localeCompare(a.code));

      setTransactions(materialTxs);

      setProducts(await prodRes.json());

      const whData = await whRes.json();
      setWarehouses(whData);
      if (whData.length > 0 && warehouseId === 0) setWarehouseId(whData[0].id);

      if (usersRes) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      setCustomers(await custRes.json());
    } catch (err) {
      toast.error("Lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleAddDetail = () => {
    setDetails([...details, { packagingId: 0, quantity: 1, note: "" }]);
  };

  const handleRemoveDetail = (index: number) => {
    setDetails(details.filter((_, i) => i !== index));
  };
  const openCreateModal = () => {
    setEditingId(null);
    setType("IMPORT");
    setDetails([]);
    setNote("");
    setRecipient("");
    setCustomerId(0);
    setReason("");
    setEntryDate(new Date().toISOString().split("T")[0]);
    setExitDate(new Date().toISOString().split("T")[0]);
    setIsModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingId(tx.id);
    setType(tx.type as "IMPORT" | "EXPORT");
    setWarehouseId(tx.warehouseId);
    setNote(tx.note || "");
    setRecipient(tx.recipient || "");
    setCustomerId(tx.customerId || 0);
    setReason(tx.reason || "");
    setEntryDate(tx.entry_date || new Date().toISOString().split("T")[0]);
    setExitDate(tx.exit_date || new Date().toISOString().split("T")[0]);
    setCreatedBySelected(tx.createdBy || currentUser.id);
    setDetails(
      tx.details.map((d) => ({
        packagingId: d.packagingId,
        quantity: d.quantity,
        note: d.note || "",
      })),
    );
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (details.length === 0 || details.some((d) => d.packagingId === 0)) {
      toast.error("Vui lòng chọn bao bì và nhập số lượng");
      return;
    }

    if (type === "EXPORT") {
      for (const d of details) {
        const packaging = products
          .flatMap((p) => p.packagings)
          .find((pk) => pk.id === d.packagingId);
        if (packaging && (packaging.stock || 0) < d.quantity) {
          toast.error(
            `Bao bì "${packaging.name}" không đủ tồn kho (Hiện có: ${packaging.stock}, Yêu cầu: ${d.quantity})`,
          );
          return;
        }
      }
    }

    try {
      const txData = {
        type,
        transaction_date: type === "IMPORT" ? entryDate : exitDate,
        entry_date: type === "IMPORT" ? entryDate : undefined,
        exit_date: type === "EXPORT" ? exitDate : undefined,
        warehouseId,
        note,
        recipient: recipient,
        customerId: undefined,
        reason,
        createdBy:
          isAdmin && createdBySelected > 0 ? createdBySelected : undefined,
        details,
      };

      const url = editingId
        ? `/api/transactions/${editingId}`
        : "/api/transactions";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(txData),
      });

      if (res.ok) {
        toast.success(
          editingId
            ? "Cập nhật phiếu bao bì thành công"
            : "Lập phiếu bao bì thành công",
        );
        setIsModalOpen(false);
        setDetails([]);
        setNote("");
        setRecipient("");
        setCustomerId(0);
        setReason("");
        setEntryDate(new Date().toISOString().split("T")[0]);
        setExitDate(new Date().toISOString().split("T")[0]);
        fetchData();
      }
    } catch (err) {
      toast.error("Lỗi khi lưu phiếu");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">
            DANH SÁCH PHIẾU XUẤT NHẬP BAO BÌ/VẬT TƯ
          </h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
            Quản lý phiếu theo tháng
          </p>
        </div>
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          {/* Lọc theo loại phiếu */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-black uppercase py-2.5 px-4 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
          >
            <option value="ALL">Tất cả phiếu</option>
            <option value="IMPORT">Chỉ Phiếu Nhập</option>
            <option value="EXPORT">Chỉ Phiếu Xuất</option>
          </select>

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
        </div>
        <div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded bg-primary py-2 px-4 text-sm font-bold text-white hover:bg-opacity-90 transition-all shadow-sm whitespace-nowrap"
          >
            <Plus size={16} /> LẬP PHIẾU MỚI
          </button>
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-gray-400 border-b">
                  <th className="py-2 px-4 font-medium">Mã phiếu</th>
                  <th className="py-2 px-4 font-medium hidden lg:table-cell xl:table-cell">
                    Loại
                  </th>
                  <th className="py-2 px-4 font-medium">Ngày nhập/xuất</th>
                  <th className="py-2 px-4 font-medium hidden lg:table-cell xl:table-cell">
                    Nơi nhận
                  </th>
                  <th className="py-2 px-4 font-medium">Diễn giải</th>
                  <th className="py-2 px-4 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      <p className="font-bold text-xs uppercase tracking-widest">
                        Không có phiếu nào phù hợp
                      </p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      <td
                        className="py-4 px-4 font-mono font-bold text-primary cursor-pointer hover:underline"
                        onClick={() => {
                          setViewTransaction(tx);
                          setIsDetailModalOpen(true);
                        }}
                      >
                        {tx.code}
                      </td>
                      <td className="py-4 px-4 hidden lg:table-cell xl:table-cell">
                        <span
                          className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${tx.type === "IMPORT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                        >
                          {tx.type === "IMPORT" ? "Nhập bao bì" : "Xuất bao bì"}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-500">
                        {tx.type === "IMPORT"
                          ? tx.entry_date
                            ? formatDate(tx.entry_date)
                            : "-"
                          : tx.exit_date
                            ? formatDate(tx.exit_date)
                            : "-"}
                      </td>
                      <td className="py-4 px-4 text-gray-500 hidden lg:table-cell xl:table-cell">
                        {tx.recipient}
                      </td>
                      <td className="py-4 px-4 text-gray-800 font-medium">
                        {tx.note}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-3 text-gray-400">
                          <button
                            className="hover:text-primary transition-colors hidden md:inline"
                            onClick={() => {
                              setViewTransaction(tx);
                              setIsDetailModalOpen(true);
                            }}
                            title="Xem chi tiết"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            className="hover:text-indigo-600 transition-colors"
                            onClick={() => openPreview(tx)}
                            title="In phiếu"
                          >
                            <Printer size={18} />
                          </button>
                          <button
                            className="hover:text-amber-500 transition-colors ml-2"
                            onClick={() => handleEditTransaction(tx)}
                            title="Sửa phiếu"
                          >
                            <Settings2 size={18} />
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() =>
                                handleDeleteTransaction(tx.id, tx.code)
                              }
                              className="hover:text-red-500 transition-colors ml-1 border-l pl-3 border-gray-100"
                              title="Xóa phiếu và khôi phục tồn kho"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Phần Modal (New Transaction, Detail View, Print Preview) GIỮ NGUYÊN NHƯ HIỆN TẠI... */}
        {/* New Transaction Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 font-sans">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-8 shadow-xl">
              <div className="mb-6 flex items-center justify-between border-b pb-4">
                <h3 className="text-2xl font-bold text-gray-800 uppercase tracking-tight">
                  {editingId
                    ? "Cập nhật phiếu Bao bì"
                    : "Lập phiếu nhập xuất Bao bì mới"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h5 className="font-bold text-primary flex items-center gap-2 uppercase text-sm tracking-wider">
                      <Search size={16} /> THÔNG TIN CHUNG
                    </h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-xs font-bold text-gray-500 uppercase">
                          Loại phiếu
                        </label>
                        <select
                          value={type}
                          onChange={(e) => {
                            const newType = e.target.value as any;
                            setType(newType);
                            setRecipient(
                              newType === "EXPORT" ? "Bộ phận Sản xuất" : "",
                            );
                          }}
                          className="w-full rounded-md border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                        >
                          <option value="IMPORT">Nhập bao bì</option>
                          <option value="EXPORT">Xuất bao bì</option>
                        </select>
                      </div>
                      <div>
                        <div className="grid grid-cols-2 gap-4">
                          {type === "IMPORT" ? (
                            <div>
                              <label className="mb-2 block text-xs font-bold text-gray-500 uppercase">
                                Ngày nhập
                              </label>
                              <DatePicker
                                selected={
                                  entryDate ? new Date(entryDate) : null
                                }
                                onChange={(date) =>
                                  setEntryDate(formatToYYYYMMDD(date))
                                }
                                dateFormat="dd/MM/yyyy"
                                locale="vi"
                                customInput={<CustomDateInput />}
                                showPopperArrow={false}
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="mb-2 block text-xs font-bold text-gray-500 uppercase">
                                Ngày xuất
                              </label>
                              <DatePicker
                                selected={exitDate ? new Date(exitDate) : null}
                                onChange={(date) =>
                                  setExitDate(formatToYYYYMMDD(date))
                                }
                                dateFormat="dd/MM/yyyy"
                                locale="vi"
                                customInput={<CustomDateInput />}
                                showPopperArrow={false}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 md:col-span-1">
                        <label className="mb-2 block text-xs font-bold text-gray-400 uppercase tracking-widest">
                          {type === "IMPORT" ? "Nhà cung cấp" : "Nơi nhận"}
                        </label>
                        <input
                          type="text"
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          className="w-full rounded-md border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                          placeholder={
                            type === "IMPORT"
                              ? "Nhập tên nhà cung cấp..."
                              : "VD: Xưởng sản xuất..."
                          }
                        />
                      </div>
                      {type === "EXPORT" && customerId === -1 && (
                        <div className="col-span-2 animate-in slide-in-from-top-1">
                          <label className="mb-2 block text-xs font-bold text-gray-400 uppercase tracking-widest">
                            Nhập nơi nhận khác
                          </label>
                          <input
                            type="text"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            className="w-full rounded-md border-2 border-primary/20 bg-white p-2.5 text-sm outline-none focus:border-primary transition-all font-medium"
                            placeholder="Tên khách hàng / Nơi nhận..."
                          />
                        </div>
                      )}
                      {isAdmin ? (
                        <div>
                          <label className="mb-2 block text-xs font-bold text-gray-500 uppercase tracking-widest">
                            Người lập phiếu
                          </label>
                          <select
                            value={createdBySelected || currentUser.id}
                            onChange={(e) =>
                              setCreatedBySelected(parseInt(e.target.value))
                            }
                            className="w-full rounded-md border border-gray-200 bg-amber-50 p-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-bold text-amber-900"
                          >
                            <option value={currentUser.id}>
                              -- Mặc định (Tên tôi) --
                            </option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.fullName} ({u.role})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="mb-2 block text-xs font-bold text-gray-400 uppercase tracking-widest">
                            Lý do
                          </label>
                          <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full rounded-md border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                            placeholder="..."
                          />
                        </div>
                      )}
                    </div>

                    {isAdmin && (
                      <div>
                        <label className="mb-2 block text-xs font-bold text-gray-400 uppercase tracking-widest">
                          Lý do
                        </label>
                        <input
                          type="text"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className="w-full rounded-md border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                          placeholder="..."
                        />
                      </div>
                    )}

                    <div>
                      <label className="mb-2 block text-xs font-bold text-gray-500 uppercase">
                        Diễn giải / Ghi chú
                      </label>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full rounded-md border border-gray-200 bg-gray-50 p-2.5 text-sm h-32 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="Nhập ghi chú chi tiết..."
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-primary flex items-center gap-2 uppercase text-sm tracking-wider">
                        <Plus size={16} /> DANH SÁCH BAO BÌ
                      </h5>
                      <button
                        type="button"
                        onClick={handleAddDetail}
                        className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-bold hover:bg-primary hover:text-white transition-all"
                      >
                        + THÊM DÒNG
                      </button>
                    </div>

                    <div className="space-y-3 min-h350 overflow-y-auto pr-2">
                      {details.length === 0 ? (
                        <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-gray-400">
                          <Plus className="opacity-20 mb-2" size={32} />
                          <p className="text-xs uppercase font-bold">
                            Chưa có bao bì nào
                          </p>
                        </div>
                      ) : (
                        details.map((detail, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50/50 p-4 relative group"
                          >
                            <button
                              type="button"
                              onClick={() => handleRemoveDetail(idx)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            >
                              <X size={14} />
                            </button>
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase">
                                  Bao bì & Quy cách
                                </label>
                                {detail.packagingId !== 0 && (
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      (products
                                        .flatMap((p) => p.packagings)
                                        .find(
                                          (pk) => pk.id === detail.packagingId,
                                        )?.stock || 0) > 0
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    Tồn hiện tại:{" "}
                                    {products
                                      .flatMap((p) => p.packagings)
                                      .find(
                                        (pk) => pk.id === detail.packagingId,
                                      )?.stock || 0}
                                  </span>
                                )}
                              </div>
                              <SearchableSelect
                                products={products}
                                value={detail.packagingId}
                                onChange={(newId) => {
                                  const newDetails = [...details];
                                  newDetails[idx].packagingId = newId;
                                  setDetails(newDetails);
                                }}
                              />
                            </div>
                            <div className="col-span-1">
                              <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
                                Số lượng
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={detail.quantity}
                                onChange={(e) => {
                                  const newDetails = [...details];
                                  newDetails[idx].quantity =
                                    parseFloat(e.target.value) || 0;
                                  setDetails(newDetails);
                                }}
                                className="w-full rounded border border-gray-200 bg-white p-2 text-xs outline-none focus:border-primary font-bold"
                              />
                            </div>
                            <div className="col-span-2 mt-2">
                              <input
                                type="text"
                                placeholder="Nhập ghi chú cho bao bì này (tùy chọn)..."
                                value={(detail as any).note || ""}
                                onChange={(e) => {
                                  const newDetails = [...details];
                                  (newDetails[idx] as any).note =
                                    e.target.value;
                                  setDetails(newDetails);
                                }}
                                className="w-full rounded border border-gray-200 bg-white p-2 text-xs outline-none focus:border-primary font-medium italic"
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t pt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2 border rounded-lg font-bold text-gray-500 hover:bg-gray-50 transition-all uppercase text-xs"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2 bg-primary text-white rounded-lg font-bold hover:bg-opacity-90 transition-all shadow-md uppercase text-xs tracking-wider"
                  >
                    Lưu phiếu
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Detail View Modal */}
        {isDetailModalOpen && viewTransaction && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-8 shadow-xl">
              <div className="mb-8 flex items-start justify-between border-b pb-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">
                    CHI TIẾT PHIẾU{" "}
                    {viewTransaction.type === "IMPORT"
                      ? "NHẬP BAO BÌ"
                      : "XUẤT BAO BÌ"}
                  </h3>
                  <p className="text-slate-500">
                    Mã: {viewTransaction.code} | Ngày lập:{" "}
                    {formatDate(viewTransaction.transaction_date)}
                  </p>
                  {viewTransaction.type === "IMPORT" ? (
                    <p className="text-indigo-600 font-bold">
                      Ngày nhập:{" "}
                      {viewTransaction.entry_date
                        ? formatDate(viewTransaction.entry_date)
                        : "-"}
                    </p>
                  ) : (
                    <p className="text-red-600 font-bold">
                      Ngày xuất:{" "}
                      {viewTransaction.exit_date
                        ? formatDate(viewTransaction.exit_date)
                        : "-"}
                    </p>
                  )}
                </div>
                <button onClick={() => setIsDetailModalOpen(false)}>
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-sm text-slate-500">Kho hàng</p>
                  <p className="font-semibold text-slate-800">
                    {viewTransaction.warehouseName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">
                    {viewTransaction.type === "IMPORT"
                      ? "Người giao"
                      : "Nơi nhận"}
                  </p>
                  <p className="font-semibold text-slate-800 uppercase tracking-tight">
                    {viewTransaction.customerName ||
                      viewTransaction.recipient ||
                      "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Người lập phiếu</p>
                  <p className="font-semibold text-slate-800">
                    {viewTransaction.creatorName}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-slate-500">Diễn giải</p>
                  <p className="font-semibold text-slate-800 italic">
                    "{viewTransaction.note || "Không có ghi chú"}"
                  </p>
                </div>
              </div>

              <table className="w-full border-collapse mb-8">
                <thead>
                  <tr className="bg-slate-50 border-y">
                    <th className="py-3 px-4 text-left text-sm font-bold text-slate-600">
                      STT
                    </th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-slate-600">
                      Mô tả bao bì/vật tư
                    </th>
                    <th className="py-3 px-4 text-right text-sm font-bold text-slate-600">
                      Số lượng
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {viewTransaction.details.map((d, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-4 px-4 text-sm">{index + 1}</td>
                      <td className="py-4 px-4 text-sm">
                        <p className="font-bold">{d.productName}</p>
                        <p className="text-xs text-slate-500">
                          Quy cách: {d.packagingName}
                        </p>
                      </td>
                      <td className="py-4 px-4 text-right font-bold">
                        {d.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end gap-4 mt-8 no-print">
                <button
                  onClick={() => openPreview(viewTransaction)}
                  className="flex items-center gap-2 px-6 py-2 border rounded-lg font-bold text-indigo-700 hover:bg-indigo-50 border-indigo-200 transition-colors uppercase text-xs"
                >
                  <Printer size={18} /> XEM TRƯỚC VÀ IN
                </button>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-colors uppercase text-xs"
                >
                  ĐÓNG
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Print Preview Modal */}
        {isPreviewOpen && previewTx && (
          <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-900/90 backdrop-blur-md">
            {/* Preview Toolbar */}
            <div className="bg-white border-b p-4 flex items-center justify-between no-print shadow-md">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
                  XEM TRƯỚC PHIẾU BAO BÌ
                </h3>
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">
                  {previewTx.code}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-6 py-2 border rounded-lg font-black text-gray-500 hover:bg-gray-50 transition-all uppercase text-[10px] tracking-widest"
                >
                  Đóng
                </button>
                <button
                  onClick={handlePrint}
                  className="px-10 py-2 bg-indigo-600 text-white rounded-lg font-black hover:bg-indigo-700 transition-all shadow-lg uppercase text-[10px] tracking-widest flex items-center gap-2"
                >
                  <Printer size={16} /> IN PHIẾU NGAY
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-8 flex justify-center bg-gray-200/50">
              <div className="shadow-2xl bg-white">
                <InventoryDocument ref={componentRef} transaction={previewTx} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default MaterialTransactions;

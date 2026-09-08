import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Warehouse, Search, Save, X, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { apiV1 } from "../lib/apiV1";

interface WarehouseItem {
  id: number;
  code: string;
  name: string;
  type: "MAIN" | "SUB" | "RECEIVING" | "SHIPPING" | "PRODUCTION";
  location?: string | null;
  address?: string | null;
  isActive: number;
  _count?: { productwarehouses: number; inventorytransactions: number };
}

const WAREHOUSE_TYPES: Record<string, { label: string; color: string }> = {
  MAIN:       { label: "Kho chính",     color: "bg-teal-100 text-teal-800" },
  SUB:        { label: "Kho phụ",       color: "bg-sky-100 text-sky-800" },
  RECEIVING:  { label: "Kho nhận hàng", color: "bg-indigo-100 text-indigo-800" },
  SHIPPING:   { label: "Kho xuất hàng", color: "bg-amber-100 text-amber-800" },
  PRODUCTION: { label: "Kho sản xuất",  color: "bg-purple-100 text-purple-800" },
};

export default function WarehousesManager() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseItem | null>(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "MAIN" as const,
    location: "",
    address: "",
    isActive: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["warehouses-manage"],
    queryFn: () => apiV1<WarehouseItem[]>("/api/v1/catalog/warehouses"),
    refetchInterval: 5000,
  });

  const warehouses = (data?.data as any) ?? [];
  const filtered = warehouses.filter((w: WarehouseItem) =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.code.toLowerCase().includes(search.toLowerCase())
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["warehouses-manage"] });
    qc.invalidateQueries({ queryKey: ["warehouses-catalog-ref"] });
  };

  const createMutation = useMutation({
    mutationFn: () => apiV1("/api/v1/catalog/warehouses", {
      method: "POST",
      body: JSON.stringify(form),
    }),
    onSuccess: (r: any) => { toast.success(r.message); setModalOpen(false); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => apiV1(`/api/v1/catalog/warehouses/${editing!.id}`, {
      method: "PUT",
      body: JSON.stringify(form),
    }),
    onSuccess: (r: any) => { toast.success(r.message); setModalOpen(false); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiV1(`/api/v1/catalog/warehouses/${id}`, { method: "DELETE" }),
    onSuccess: (r: any) => { toast.success(r.message); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ code: `KHO${Math.floor(100 + Math.random() * 900)}`, name: "", type: "MAIN", location: "", address: "", isActive: true });
    setModalOpen(true);
  };

  const openEdit = (w: WarehouseItem) => {
    setEditing(w);
    setForm({
      code: w.code,
      name: w.name,
      type: w.type,
      location: w.location || "",
      address: w.address || "",
      isActive: w.isActive !== 0,
    });
    setModalOpen(true);
  };

  return (
    <div className="erp-page p-6 max-w-7xl mx-auto">
      <div className="erp-page-header mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quản lý Kho</h1>
          <p className="text-sm text-slate-500 mt-1">Thêm mới, cấu hình loại kho, vị trí và quản lý danh sách kho toàn hệ thống</p>
        </div>
        <div>
          <button className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer" onClick={openCreate}>
            <Plus size={16} /> Thêm kho mới
          </button>
        </div>
      </div>

      <div className="erp-card bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-80">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo mã hoặc tên kho..."
              className="bg-transparent border-0 outline-none text-sm w-full text-slate-800 placeholder-slate-400"
            />
          </div>
          <div className="text-xs text-slate-500">
            Tổng số: <strong className="text-slate-800">{warehouses.length}</strong> kho
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Đang tải danh sách kho...</div>
        ) : !filtered.length ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <Warehouse size={40} className="text-slate-300" />
            <p className="text-sm font-medium">Không tìm thấy kho nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3.5">Mã kho</th>
                  <th className="px-5 py-3.5">Tên kho</th>
                  <th className="px-5 py-3.5">Loại kho</th>
                  <th className="px-5 py-3.5">Vị trí / Tầng</th>
                  <th className="px-5 py-3.5">Địa chỉ</th>
                  <th className="px-5 py-3.5 text-center">Giao dịch / Tồn</th>
                  <th className="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((w: WarehouseItem) => {
                  const tInfo = WAREHOUSE_TYPES[w.type] || { label: w.type, color: "bg-slate-100 text-slate-800" };
                  return (
                    <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-teal-700">{w.code}</td>
                      <td className="px-5 py-4 font-semibold text-slate-900">{w.name}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${tInfo.color}`}>
                          {tInfo.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {w.location ? <span className="inline-flex items-center gap-1"><MapPin size={13} className="text-slate-400" />{w.location}</span> : <span className="text-slate-400 italic">Trống</span>}
                      </td>
                      <td className="px-5 py-4 text-slate-600 max-w-xs truncate">{w.address || <span className="text-slate-400 italic">Trống</span>}</td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center gap-2 text-xs text-slate-600">
                          <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">{w._count?.inventorytransactions ?? 0} chứng từ</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">{w._count?.productwarehouses ?? 0} mặt hàng</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => openEdit(w)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Sửa kho">
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Bạn có chắc muốn xóa kho "${w.name}"?`)) {
                                deleteMutation.mutate(w.id);
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Xóa kho"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Thêm/Sửa Kho */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">{editing ? "Cập nhật thông tin kho" : "Thêm kho mới"}</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={e => { e.preventDefault(); editing ? updateMutation.mutate() : createMutation.mutate(); }}>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                    Mã kho <span className="text-red-500">*</span>
                    <input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="VD: KHO001" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 bg-white" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                    Loại kho <span className="text-red-500">*</span>
                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })} className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 bg-white">
                      {Object.entries(WAREHOUSE_TYPES).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                  Tên kho <span className="text-red-500">*</span>
                  <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: Kho Thành Phẩm Miền Nam" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 bg-white" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                  Vị trí / Tầng
                  <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="VD: Tầng 1, Khu A" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 bg-white" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                  Địa chỉ chi tiết
                  <textarea rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 bg-white resize-none" />
                </label>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg shadow-sm">
                  Hủy
                </button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50">
                  <Save size={16} /> {createMutation.isPending || updateMutation.isPending ? "Đang lưu..." : "Lưu kho"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

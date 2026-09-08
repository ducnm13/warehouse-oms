import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Search, Trash2, UserCheck, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { apiV1 } from "../lib/apiV1";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Employee {
  id: number;
  code: string;
  fullName: string;
  jobTitle?: string | null;
  status: "ACTIVE" | "INACTIVE";
  workUnit?: string | null;
  userId?: number | null;
  users?: { id: number; username: string } | null;
  createdAt: string;
}
interface EmployeeListResponse {
  data: Employee[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const emptyForm = (): Partial<Employee> => ({ code: "", fullName: "", jobTitle: "", status: "ACTIVE", workUnit: "", userId: null });

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Đang làm", INACTIVE: "Đã nghỉ" };
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-slate-100 text-slate-500",
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Employees() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<Partial<Employee>>(emptyForm());

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["employees", page, search, statusFilter],
    queryFn: () =>
      apiV1<EmployeeListResponse>(
        `/api/v1/employees?page=${page}&limit=50${search ? `&search=${encodeURIComponent(search)}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`,
      ),
  });

  const rows = data?.data?.data ?? [];
  const meta = data?.data?.meta;

  const save = useMutation({
    mutationFn: () =>
      editing
        ? apiV1<Employee>(`/api/v1/employees/${editing.id}`, { method: "PUT", body: JSON.stringify(form) })
        : apiV1<Employee>("/api/v1/employees", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: r => {
      toast.success(r.message);
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiV1(`/api/v1/employees/${id}`, { method: "DELETE" }),
    onSuccess: r => {
      toast.success(r.message);
      void qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (emp: Employee) => { setEditing(emp); setForm({ ...emp }); setOpen(true); };

  const activeCount = rows.filter(r => r.status === "ACTIVE").length;
  const inactiveCount = rows.filter(r => r.status === "INACTIVE").length;

  return (
    <div className="erp-page">
      <div className="erp-page-header">
        <div>
          <h1>Nhân viên</h1>
          <p>Danh mục nhân viên sử dụng phần mềm</p>
        </div>
        <button className="erp-btn erp-btn-primary" onClick={openCreate}>
          <Plus size={17} /> Thêm nhân viên
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="erp-stat">
          <Users size={22} className="text-indigo-500" />
          <div><span>Tổng nhân viên</span><strong>{meta?.total ?? 0}</strong></div>
        </div>
        <div className="erp-stat">
          <UserCheck size={22} className="text-emerald-500" />
          <div><span>Đang làm việc</span><strong className="text-emerald-600">{activeCount}</strong></div>
        </div>
        <div className="erp-stat">
          <Users size={22} className="text-slate-400" />
          <div><span>Đã nghỉ việc</span><strong className="text-slate-500">{inactiveCount}</strong></div>
        </div>
      </div>

      {/* Table */}
      <div className="erp-card overflow-hidden">
        <div className="erp-toolbar">
          <div className="erp-search">
            <Search size={16} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm mã, tên, chức danh..."
            />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Mọi trạng thái</option>
            <option value="ACTIVE">Đang làm</option>
            <option value="INACTIVE">Đã nghỉ</option>
          </select>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Đang tải...</div>
        ) : isError ? (
          <div className="p-12 text-center text-red-500">{(error as Error).message}</div>
        ) : !rows.length ? (
          <div className="p-12 text-center text-slate-400">Chưa có nhân viên nào</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Mã / Tên nhân viên</th>
                  <th>Chức danh</th>
                  <th>Đơn vị</th>
                  <th>Tài khoản</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                          {emp.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <b className="text-slate-800">{emp.fullName}</b>
                          <small className="block text-slate-400">{emp.code}</small>
                        </div>
                      </div>
                    </td>
                    <td>{emp.jobTitle || <span className="text-slate-300">—</span>}</td>
                    <td>{emp.workUnit || <span className="text-slate-300">—</span>}</td>
                    <td>
                      {emp.users ? (
                        <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                          {emp.users.username}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">Chưa liên kết</span>
                      )}
                    </td>
                    <td>
                      <span className={`erp-badge ${STATUS_COLOR[emp.status]}`}>
                        {STATUS_LABEL[emp.status]}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className="erp-icon-btn" onClick={() => openEdit(emp)}>
                          <Edit size={15} />
                        </button>
                        <button
                          className="erp-icon-btn text-red-500"
                          onClick={() => { if (window.confirm(`Xóa nhân viên ${emp.fullName}?`)) remove.mutate(emp.id); }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="erp-pagination">
            <button className="erp-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</button>
            <span>Trang {page}/{meta.totalPages} · {meta.total} nhân viên</span>
            <button className="erp-btn" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>Sau</button>
          </div>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div className="erp-modal-backdrop">
          <div className="erp-modal max-w-lg">
            <div className="erp-modal-header">
              <div>
                <h2>{editing ? `Sửa: ${editing.fullName}` : "Thêm nhân viên"}</h2>
                <p>Thông tin nhân viên và liên kết tài khoản</p>
              </div>
              <button onClick={() => setOpen(false)}><X /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); save.mutate(); }}>
              <div className="erp-modal-body grid gap-4 md:grid-cols-2">
                <label>
                  Mã nhân viên <span className="text-red-500">*</span>
                  <input
                    required
                    value={form.code ?? ""}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    placeholder="NV001"
                  />
                </label>
                <label>
                  Trạng thái
                  <select value={form.status ?? "ACTIVE"} onChange={e => setForm({ ...form, status: e.target.value as "ACTIVE" | "INACTIVE" })}>
                    <option value="ACTIVE">Đang làm việc</option>
                    <option value="INACTIVE">Đã nghỉ việc</option>
                  </select>
                </label>
                <label className="md:col-span-2">
                  Họ và tên <span className="text-red-500">*</span>
                  <input
                    required
                    value={form.fullName ?? ""}
                    onChange={e => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Nguyễn Văn A"
                  />
                </label>
                <label>
                  Chức danh
                  <input
                    value={form.jobTitle ?? ""}
                    onChange={e => setForm({ ...form, jobTitle: e.target.value })}
                    placeholder="Trưởng phòng, Kế toán..."
                  />
                </label>
                <label>
                  Đơn vị làm việc
                  <input
                    value={form.workUnit ?? ""}
                    onChange={e => setForm({ ...form, workUnit: e.target.value })}
                    placeholder="Phòng kế toán, Kho..."
                  />
                </label>
                <label className="md:col-span-2">
                  ID Tài khoản (User ID)
                  <input
                    type="number"
                    min={1}
                    value={form.userId ?? ""}
                    onChange={e => setForm({ ...form, userId: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Để trống nếu chưa có tài khoản"
                  />
                  <small className="text-slate-400 mt-1 block">Liên kết với tài khoản đăng nhập (tùy chọn)</small>
                </label>
              </div>
              <div className="erp-modal-footer">
                <button type="button" className="erp-btn" onClick={() => setOpen(false)}>Hủy</button>
                <button type="submit" className="erp-btn erp-btn-primary" disabled={save.isPending}>
                  {save.isPending ? "Đang lưu..." : editing ? "Cập nhật" : "Thêm nhân viên"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

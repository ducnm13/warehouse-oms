import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Edit, Eye, Plus, Search, Trash2, X, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { apiV1, legacyApi } from "../lib/apiV1";
import { formatDate, formatNumber } from "../lib/utils";
import type { Warehouse } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OpeningLine {
  id?: number;
  packagingId: number;
  quantity: number;
  unitCost: number;
  totalValue?: number;
  batchNumber?: string;
  expiryDate?: string;
  note?: string;
  // display only
  packagingName?: string;
  productName?: string;
  sku?: string;
  unit?: string;
}
interface OpeningDocument {
  id: number;
  code: string;
  documentDate: string;
  warehouseId: number;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  note?: string;
  version: number;
  createdAt: string;
  warehouses?: { id: number; name: string };
  opening_inventory_lines: OpeningLine[];
}
interface ListResponse { data: OpeningDocument[]; meta: { page: number; limit: number; total: number; totalPages: number }; }

const STATUS_LABEL: Record<string, string> = { DRAFT: "Nháp", POSTED: "Đã ghi sổ", CANCELLED: "Đã hủy" };
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-700",
  POSTED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

const emptyLine = (): OpeningLine => ({ packagingId: 0, quantity: 1, unitCost: 0 });

// ─── Packaging search component ───────────────────────────────────────────────
interface Packaging { id: number; name: string; sku?: string; unit?: string; products: { name: string } | null; }

function PackagingSelect({ value, onChange, allPackagings }: {
  value: number; onChange: (p: Packaging) => void; allPackagings: Packaging[];
}) {
  const [q, setQ] = useState("");
  const filtered = q.length > 0
    ? allPackagings.filter(p => `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 20)
    : [];

  return (
    <div className="relative">
      <input
        value={q || (allPackagings.find(p => p.id === value)?.name ?? "")}
        onChange={e => setQ(e.target.value)}
        placeholder="Tìm hàng hóa..."
        className="w-full"
        onFocus={e => e.target.select()}
      />
      {filtered.length > 0 && (
        <ul className="absolute z-50 w-72 bg-white shadow-xl border border-slate-200 rounded-lg mt-1 max-h-52 overflow-y-auto text-sm">
          {filtered.map(p => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors"
                onClick={() => { onChange(p); setQ(""); }}
              >
                <span className="font-semibold">{p.name}</span>
                {p.sku && <span className="ml-2 text-xs text-slate-400">{p.sku}</span>}
                {p.products?.name && <small className="block text-slate-400">{p.products.name}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OpeningInventory() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");

  // Modal state
  const [open, setOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<OpeningDocument | null>(null);
  const [editing, setEditing] = useState<OpeningDocument | null>(null);
  const [form, setForm] = useState<{ documentDate: string; warehouseId: number; note: string; lines: OpeningLine[]; version?: number }>({
    documentDate: new Date().toISOString().slice(0, 10),
    warehouseId: 0,
    note: "",
    lines: [emptyLine()],
  });

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState<OpeningDocument | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Refs data
  const warehouses = useQuery({ queryKey: ["warehouses-ref"], queryFn: () => legacyApi<Warehouse[]>("/api/warehouses") });
  const packagings = useQuery({
    queryKey: ["packagings-all"],
    queryFn: async () => {
      const res = await apiV1<{ data: Packaging[] }>("/api/v1/catalog/packagings?page=1&limit=1000&isActive=1" as any);
      // Fallback: dùng legacy nếu catalog API trả về products
      return (res.data as any)?.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["opening-inventory", page, search, statusFilter, warehouseFilter],
    queryFn: () =>
      apiV1<ListResponse>(
        `/api/v1/opening-inventory?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}${warehouseFilter ? `&warehouseId=${warehouseFilter}` : ""}`,
      ),
  });

  const rows = data?.data?.data ?? [];
  const meta = data?.data?.meta;

  // Mutations
  const save = useMutation({
    mutationFn: () => {
      const body = {
        documentDate: form.documentDate,
        warehouseId: form.warehouseId,
        note: form.note || null,
        lines: form.lines.filter(l => l.packagingId > 0),
        ...(editing ? { version: form.version } : {}),
      };
      return editing
        ? apiV1<OpeningDocument>(`/api/v1/opening-inventory/${editing.id}`, { method: "PUT", body: JSON.stringify(body) })
        : apiV1<OpeningDocument>("/api/v1/opening-inventory", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: r => {
      toast.success(r.message);
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["opening-inventory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const post = useMutation({
    mutationFn: (doc: OpeningDocument) =>
      apiV1<OpeningDocument>(`/api/v1/opening-inventory/${doc.id}/post`, { method: "POST", body: JSON.stringify({ version: doc.version }) }),
    onSuccess: r => {
      toast.success(r.message);
      setViewDoc(null);
      void qc.invalidateQueries({ queryKey: ["opening-inventory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (doc: OpeningDocument) =>
      apiV1<OpeningDocument>(`/api/v1/opening-inventory/${doc.id}/cancel`, { method: "POST", body: JSON.stringify({ version: doc.version, reason: cancelReason }) }),
    onSuccess: r => {
      toast.success(r.message);
      setCancelTarget(null);
      setCancelReason("");
      setViewDoc(null);
      void qc.invalidateQueries({ queryKey: ["opening-inventory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ documentDate: new Date().toISOString().slice(0, 10), warehouseId: 0, note: "", lines: [emptyLine()] });
    setOpen(true);
  };

  const openEdit = (doc: OpeningDocument) => {
    setEditing(doc);
    setForm({
      documentDate: typeof doc.documentDate === "string" ? doc.documentDate.slice(0, 10) : new Date(doc.documentDate).toISOString().slice(0, 10),
      warehouseId: doc.warehouseId,
      note: doc.note ?? "",
      lines: doc.opening_inventory_lines.map(l => ({ ...l })),
      version: doc.version,
    });
    setOpen(true);
  };

  const updateLine = (i: number, patch: Partial<OpeningLine>) =>
    setForm(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, ...patch, totalValue: ((patch.quantity ?? l.quantity) * (patch.unitCost ?? l.unitCost)) } : l) }));

  const removeLine = (i: number) =>
    setForm(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }));

  const totalValue = form.lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const allPkgs: Packaging[] = (packagings.data as any) ?? [];

  return (
    <div className="erp-page">
      <div className="erp-page-header">
        <div>
          <h1>Tồn kho đầu kỳ</h1>
          <p>Nhập số liệu tồn kho ban đầu trước khi vận hành</p>
        </div>
        <button className="erp-btn erp-btn-primary" onClick={openCreate}>
          <Plus size={17} /> Tạo phiếu tồn đầu kỳ
        </button>
      </div>

      {/* Table */}
      <div className="erp-card overflow-hidden">
        <div className="erp-toolbar">
          <div className="erp-search">
            <Search size={16} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm số phiếu..." />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Mọi trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="POSTED">Đã ghi sổ</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
          <select value={warehouseFilter} onChange={e => { setWarehouseFilter(e.target.value); setPage(1); }}>
            <option value="">Tất cả kho</option>
            {(warehouses.data ?? []).map((w: Warehouse) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {isLoading ? <div className="p-12 text-center">Đang tải...</div>
          : isError ? <div className="p-12 text-center text-red-500">{(error as Error).message}</div>
          : !rows.length ? <div className="p-12 text-center text-slate-400">Chưa có phiếu tồn đầu kỳ nào</div>
          : (
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Số phiếu</th>
                    <th>Ngày</th>
                    <th>Kho</th>
                    <th className="text-right">Số dòng</th>
                    <th>Trạng thái</th>
                    <th>Ghi chú</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <button className="font-semibold text-indigo-600 hover:underline" onClick={() => setViewDoc(doc)}>
                          {doc.code}
                        </button>
                      </td>
                      <td>{formatDate(doc.documentDate)}</td>
                      <td>{doc.warehouses?.name ?? doc.warehouseId}</td>
                      <td className="text-right">{doc.opening_inventory_lines?.length ?? 0}</td>
                      <td><span className={`erp-badge ${STATUS_COLOR[doc.status]}`}>{STATUS_LABEL[doc.status]}</span></td>
                      <td className="text-slate-500 max-w-xs truncate">{doc.note || "—"}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button className="erp-icon-btn" title="Xem" onClick={() => setViewDoc(doc)}><Eye size={15} /></button>
                          {doc.status === "DRAFT" && (
                            <button className="erp-icon-btn" title="Sửa" onClick={() => openEdit(doc)}><Edit size={15} /></button>
                          )}
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
            <span>Trang {page}/{meta.totalPages}</span>
            <button className="erp-btn" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>Sau</button>
          </div>
        )}
      </div>

      {/* ── View modal ── */}
      {viewDoc && (
        <div className="erp-modal-backdrop">
          <div className="erp-modal max-w-3xl">
            <div className="erp-modal-header">
              <div>
                <h2>{viewDoc.code}</h2>
                <p>Kho: {viewDoc.warehouses?.name} · Ngày: {formatDate(viewDoc.documentDate)} · <span className={`erp-badge ${STATUS_COLOR[viewDoc.status]}`}>{STATUS_LABEL[viewDoc.status]}</span></p>
              </div>
              <button onClick={() => setViewDoc(null)}><X /></button>
            </div>
            <div className="erp-modal-body">
              <div className="overflow-x-auto">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Hàng hóa</th><th className="text-right">Số lượng</th>
                      <th className="text-right">Đơn giá vốn</th><th className="text-right">Giá trị</th>
                      <th>Số lô</th><th>HSD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewDoc.opening_inventory_lines.map((l, i) => (
                      <tr key={l.id ?? i}>
                        <td>{i + 1}</td>
                        <td>
                          <b>{l.packagingName ?? l.packagingId}</b>
                          {l.productName && <small className="block text-slate-400">{l.productName}</small>}
                        </td>
                        <td className="text-right">{formatNumber(l.quantity)} {l.unit}</td>
                        <td className="text-right">{formatNumber(l.unitCost)}</td>
                        <td className="text-right">{formatNumber(Number(l.totalValue ?? l.quantity * l.unitCost))}</td>
                        <td>{l.batchNumber || "—"}</td>
                        <td>{l.expiryDate ? formatDate(l.expiryDate) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {viewDoc.note && <p className="mt-3 text-sm text-slate-500">Ghi chú: {viewDoc.note}</p>}
            </div>
            <div className="erp-modal-footer">
              <button className="erp-btn" onClick={() => setViewDoc(null)}>Đóng</button>
              {viewDoc.status === "DRAFT" && (
                <>
                  <button className="erp-btn" onClick={() => { openEdit(viewDoc); setViewDoc(null); }}><Edit size={15} /> Sửa</button>
                  <button className="erp-btn erp-btn-primary" disabled={post.isPending} onClick={() => post.mutate(viewDoc)}>
                    <CheckCircle size={15} /> {post.isPending ? "Đang ghi sổ..." : "Ghi sổ"}
                  </button>
                </>
              )}
              {viewDoc.status === "POSTED" && (
                <button className="erp-btn text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setCancelTarget(viewDoc); setViewDoc(null); }}>
                  <XCircle size={15} /> Hủy phiếu
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel modal ── */}
      {cancelTarget && (
        <div className="erp-modal-backdrop">
          <div className="erp-modal max-w-md">
            <div className="erp-modal-header">
              <div><h2>Hủy phiếu {cancelTarget.code}</h2><p className="text-red-500">Thao tác này sẽ hoàn trả tồn kho đã ghi sổ</p></div>
              <button onClick={() => setCancelTarget(null)}><X /></button>
            </div>
            <div className="erp-modal-body">
              <label>
                Lý do hủy <span className="text-red-500">*</span>
                <textarea required rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Nhập lý do hủy phiếu..." />
              </label>
            </div>
            <div className="erp-modal-footer">
              <button className="erp-btn" onClick={() => setCancelTarget(null)}>Đóng</button>
              <button
                className="erp-btn bg-red-600 text-white hover:bg-red-700"
                disabled={!cancelReason.trim() || cancel.isPending}
                onClick={() => cancel.mutate(cancelTarget!)}
              >
                {cancel.isPending ? "Đang hủy..." : "Xác nhận hủy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create/Edit modal ── */}
      {open && (
        <div className="erp-modal-backdrop">
          <div className="erp-modal max-w-5xl">
            <div className="erp-modal-header">
              <div>
                <h2>{editing ? `Sửa phiếu ${editing.code}` : "Tạo phiếu tồn đầu kỳ"}</h2>
                <p>Nhập số liệu tồn kho ban đầu cho từng hàng hóa</p>
              </div>
              <button onClick={() => setOpen(false)}><X /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); save.mutate(); }}>
              <div className="erp-modal-body space-y-5">
                {/* Header fields */}
                <div className="grid gap-4 md:grid-cols-3">
                  <label>
                    Ngày chứng từ <span className="text-red-500">*</span>
                    <input type="date" required value={form.documentDate} onChange={e => setForm({ ...form, documentDate: e.target.value })} />
                  </label>
                  <label>
                    Kho <span className="text-red-500">*</span>
                    <select required value={form.warehouseId} onChange={e => setForm({ ...form, warehouseId: Number(e.target.value) })}>
                      <option value={0}>Chọn kho</option>
                      {(warehouses.data ?? []).map((w: Warehouse) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Ghi chú
                    <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Ghi chú thêm (tuỳ chọn)" />
                  </label>
                </div>

                {/* Lines */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-700">Danh sách hàng hóa</h3>
                    <button type="button" className="erp-btn text-sm" onClick={() => setForm(f => ({ ...f, lines: [...f.lines, emptyLine()] }))}>
                      <Plus size={14} /> Thêm dòng
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="erp-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th className="min-w-[220px]">Hàng hóa</th>
                          <th className="text-right min-w-[100px]">Số lượng</th>
                          <th className="text-right min-w-[130px]">Đơn giá vốn</th>
                          <th className="text-right min-w-[120px]">Giá trị</th>
                          <th className="min-w-[110px]">Số lô</th>
                          <th className="min-w-[130px]">Hạn sử dụng</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.lines.map((line, i) => (
                          <tr key={i}>
                            <td className="text-center text-slate-400">{i + 1}</td>
                            <td>
                              <PackagingSelect
                                value={line.packagingId}
                                onChange={p => updateLine(i, { packagingId: p.id, packagingName: p.name, unit: p.unit ?? "" })}
                                allPackagings={allPkgs}
                              />
                            </td>
                            <td>
                              <input
                                type="number" min={0.0001} step="any" className="text-right"
                                value={line.quantity}
                                onChange={e => updateLine(i, { quantity: Number(e.target.value) })}
                              />
                            </td>
                            <td>
                              <input
                                type="number" min={0} step="any" className="text-right"
                                value={line.unitCost}
                                onChange={e => updateLine(i, { unitCost: Number(e.target.value) })}
                              />
                            </td>
                            <td className="text-right text-sm font-semibold">
                              {formatNumber(line.quantity * line.unitCost)}
                            </td>
                            <td>
                              <input
                                value={line.batchNumber ?? ""}
                                onChange={e => updateLine(i, { batchNumber: e.target.value })}
                                placeholder="Số lô"
                              />
                            </td>
                            <td>
                              <input
                                type="date"
                                value={line.expiryDate ?? ""}
                                onChange={e => updateLine(i, { expiryDate: e.target.value })}
                              />
                            </td>
                            <td>
                              <button type="button" className="erp-icon-btn text-red-500" onClick={() => removeLine(i)}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4} className="text-right font-bold text-slate-700 px-3 py-2">Tổng giá trị:</td>
                          <td className="text-right font-bold text-indigo-600 px-3 py-2">{formatNumber(totalValue)} ₫</td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
              <div className="erp-modal-footer">
                <button type="button" className="erp-btn" onClick={() => setOpen(false)}>Hủy</button>
                <button type="submit" className="erp-btn erp-btn-primary" disabled={save.isPending || form.lines.filter(l => l.packagingId > 0).length === 0}>
                  {save.isPending ? "Đang lưu..." : editing ? "Cập nhật" : "Lưu phiếu nháp"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

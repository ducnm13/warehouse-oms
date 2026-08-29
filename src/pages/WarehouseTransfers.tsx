import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowRightLeft, CheckCircle2, Edit, Eye, PackageCheck, Plus, Search, Truck, Undo2, X } from "lucide-react";
import toast from "react-hot-toast";
import { apiV1, legacyApi } from "../lib/apiV1";
import { formatDate, formatNumber } from "../lib/utils";
import type { Product, Warehouse, WarehouseTransferV1 } from "../types";

type TransferLine = { packagingId: number; quantity: number; note: string };
type TransferForm = { transferDate: string; fromWarehouseId: number; toWarehouseId: number; note: string };
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): TransferLine => ({ packagingId: 0, quantity: 1, note: "" });
const emptyForm = (): TransferForm => ({ transferDate: today(), fromWarehouseId: 0, toWarehouseId: 0, note: "" });
const statusMeta = {
  DRAFT: { label: "Nháp", css: "bg-slate-100 text-slate-700", icon: Edit },
  IN_TRANSIT: { label: "Đang vận chuyển", css: "bg-amber-100 text-amber-700", icon: Truck },
  RECEIVED: { label: "Đã nhận", css: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  CANCELLED: { label: "Đã hủy", css: "bg-red-100 text-red-700", icon: Undo2 },
} as const;

export default function WarehouseTransfers() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1), [search, setSearch] = useState(""), [status, setStatus] = useState("");
  const [fromFilter, setFromFilter] = useState(0), [toFilter, setToFilter] = useState(0);
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<WarehouseTransferV1 | null>(null), [selected, setSelected] = useState<WarehouseTransferV1 | null>(null);
  const [form, setForm] = useState<TransferForm>(emptyForm()), [lines, setLines] = useState<TransferLine[]>([emptyLine()]);

  const references = useQuery({ queryKey: ["transfer-references"], queryFn: async () => {
    const [warehouses, products] = await Promise.all([legacyApi<Warehouse[]>("/api/warehouses"), legacyApi<Product[]>("/api/products")]);
    return { warehouses, products };
  }});
  const documents = useQuery({
    queryKey: ["warehouse-transfers-v1", page, search, status, fromFilter, toFilter],
    queryFn: () => apiV1<WarehouseTransferV1[]>(`/api/v1/warehouse-transfers?page=${page}&limit=20&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}${fromFilter ? `&fromWarehouseId=${fromFilter}` : ""}${toFilter ? `&toWarehouseId=${toFilter}` : ""}`),
  });
  const options = useMemo(() => (references.data?.products || []).flatMap(product => (product.packagings || []).map(packaging => ({ ...packaging, productName: product.name }))), [references.data]);
  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["warehouse-transfers-v1"] }),
    queryClient.invalidateQueries({ queryKey: ["inventory-balances-v1"] }),
    queryClient.invalidateQueries({ queryKey: ["inventory-reconciliation-v1"] }),
  ]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form.fromWarehouseId || !form.toWarehouseId || form.fromWarehouseId === form.toWarehouseId) throw new Error("Kho nguồn và kho đích phải khác nhau");
      if (!lines.length || lines.some(line => !line.packagingId || line.quantity <= 0)) throw new Error("Chi tiết chuyển kho không hợp lệ");
      if (new Set(lines.map(line => line.packagingId)).size !== lines.length) throw new Error("Một quy cách không được chuyển nhiều dòng");
      const payload = { ...form, details: lines };
      return editing
        ? apiV1<WarehouseTransferV1>(`/api/v1/warehouse-transfers/${editing.id}`, { method: "PUT", body: JSON.stringify({ ...payload, version: editing.version }) })
        : apiV1<WarehouseTransferV1>("/api/v1/warehouse-transfers", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: response => { toast.success(response.message); setOpen(false); setEditing(null); void invalidate(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const actionMutation = useMutation({
    mutationFn: ({ document, action, reason }: { document: WarehouseTransferV1; action: "ship" | "receive" | "cancel"; reason?: string }) =>
      apiV1<WarehouseTransferV1>(`/api/v1/warehouse-transfers/${document.id}/${action}`, { method: "POST", body: JSON.stringify(action === "cancel" ? { version: document.version, reason } : { version: document.version }) }),
    onSuccess: response => { toast.success(response.message); setSelected(response.data); void invalidate(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const create = () => {
    const warehouses = references.data?.warehouses || [];
    setEditing(null); setForm({ ...emptyForm(), fromWarehouseId: warehouses[0]?.id || 0, toWarehouseId: warehouses[1]?.id || 0 }); setLines([emptyLine()]); setOpen(true);
  };
  const edit = (document: WarehouseTransferV1) => {
    setEditing(document); setForm({ transferDate: document.transferDate, fromWarehouseId: document.fromWarehouseId, toWarehouseId: document.toWarehouseId, note: document.note || "" });
    setLines(document.details.map(line => ({ packagingId: line.packagingId, quantity: line.quantity, note: line.note || "" }))); setOpen(true);
  };
  const act = (document: WarehouseTransferV1, action: "ship" | "receive" | "cancel") => {
    if (action === "ship" && !confirm(`Xuất hàng khỏi ${document.fromWarehouseName}? Tồn kho nguồn sẽ giảm.`)) return;
    if (action === "receive" && !confirm(`Xác nhận đã nhận đủ hàng tại ${document.toWarehouseName}?`)) return;
    const reason = action === "cancel" ? prompt("Lý do hủy chuyển kho (tối thiểu 3 ký tự):") : undefined;
    if (action === "cancel" && (!reason || reason.trim().length < 3)) return;
    actionMutation.mutate({ document, action, reason: reason?.trim() });
  };
  const updateLine = (index: number, patch: Partial<TransferLine>) => setLines(rows => rows.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  const rows = documents.data?.data || [], meta = documents.data?.meta;
  const inTransit = rows.filter(row => row.status === "IN_TRANSIT").length;

  return <div className="erp-page">
    <div className="erp-page-header"><div><h1>Chuyển kho V1</h1><p>Xuất giao tại kho nguồn, theo dõi hàng đi đường và xác nhận nhận tại kho đích</p></div><button className="erp-btn erp-btn-primary" onClick={create} disabled={(references.data?.warehouses.length || 0) < 2}><Plus size={17}/> Lập phiếu chuyển</button></div>
    <div className="grid gap-4 md:grid-cols-3"><div className="erp-stat"><ArrowRightLeft size={20}/><div><span>Tổng phiếu V1</span><strong>{formatNumber(meta?.total || 0)}</strong></div></div><div className="erp-stat"><Truck size={20}/><div><span>Đang vận chuyển</span><strong>{formatNumber(inTransit)}</strong></div></div><div className="erp-stat"><PackageCheck size={20}/><div><span>Quy trình</span><strong>2 bước</strong></div></div></div>
    {(references.data?.warehouses.length || 0) < 2 && <div className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-800">Cần ít nhất hai kho để thực hiện điều chuyển.</div>}
    <div className="erp-card overflow-hidden"><div className="erp-toolbar flex-wrap"><div className="erp-search"><Search size={17}/><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm mã phiếu, kho, diễn giải..."/></div><select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Mọi trạng thái</option>{Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select><select value={fromFilter} onChange={event => { setFromFilter(+event.target.value); setPage(1); }}><option value={0}>Mọi kho nguồn</option>{references.data?.warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select><select value={toFilter} onChange={event => { setToFilter(+event.target.value); setPage(1); }}><option value={0}>Mọi kho đích</option>{references.data?.warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="erp-table"><thead><tr><th>Mã phiếu / Ngày</th><th>Luồng điều chuyển</th><th>Hàng hóa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{documents.isLoading ? <tr><td colSpan={5} className="text-center">Đang tải...</td></tr> : rows.length === 0 ? <tr><td colSpan={5} className="text-center text-slate-400">Chưa có phiếu chuyển kho V1</td></tr> : rows.map(document => { const badge = statusMeta[document.status]; const StatusIcon = badge.icon; return <tr key={document.id}><td><button className="font-bold text-emerald-700" onClick={() => setSelected(document)}>{document.code}</button><small>{formatDate(document.transferDate)} · v{document.version}</small></td><td><div className="flex items-center gap-2 font-medium"><span>{document.fromWarehouseName}</span><ArrowRight size={15} className="text-emerald-600"/><span>{document.toWarehouseName}</span></div><small>{document.note}</small></td><td>{document.details.slice(0, 2).map(line => <div key={line.id} className="text-sm">{line.productName} - {line.packagingName}: <b>{formatNumber(line.quantity)} {line.unit}</b></div>)}{document.details.length > 2 && <small>+{document.details.length - 2} mặt hàng khác</small>}</td><td><span className={`erp-badge ${badge.css}`}><StatusIcon size={13}/>{badge.label}</span></td><td><div className="flex gap-1"><button className="erp-icon-btn" title="Xem" onClick={() => setSelected(document)}><Eye size={16}/></button><button className="erp-icon-btn" title="Sửa nháp" disabled={document.status !== "DRAFT"} onClick={() => edit(document)}><Edit size={16}/></button><button className="erp-icon-btn text-amber-600" title="Xuất giao" disabled={document.status !== "DRAFT" || actionMutation.isPending} onClick={() => act(document, "ship")}><Truck size={16}/></button><button className="erp-icon-btn text-emerald-600" title="Xác nhận nhận" disabled={document.status !== "IN_TRANSIT" || actionMutation.isPending} onClick={() => act(document, "receive")}><PackageCheck size={16}/></button><button className="erp-icon-btn text-red-600" title="Hủy" disabled={!(["DRAFT", "IN_TRANSIT"] as string[]).includes(document.status) || actionMutation.isPending} onClick={() => act(document, "cancel")}><Undo2 size={16}/></button></div></td></tr>; })}</tbody></table></div>
      <div className="erp-pagination"><button className="erp-btn" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Trước</button><span>Trang {page}/{Math.max(1, Number(meta?.totalPages || 1))}</span><button className="erp-btn" disabled={page >= Number(meta?.totalPages || 1)} onClick={() => setPage(value => value + 1)}>Sau</button></div>
    </div>
    {open && <div className="erp-modal-backdrop"><div className="erp-modal max-w-5xl"><div className="erp-modal-header"><div><h2>{editing ? `Sửa ${editing.code}` : "Lập phiếu chuyển kho"}</h2><p>Lưu nháp trước; chỉ bước Xuất giao mới làm giảm tồn kho nguồn.</p></div><button onClick={() => setOpen(false)}><X/></button></div><form onSubmit={event => { event.preventDefault(); saveMutation.mutate(); }}><div className="erp-modal-body space-y-5"><div className="grid gap-4 md:grid-cols-3"><label>Ngày chuyển<input type="date" required value={form.transferDate} onChange={event => setForm({ ...form, transferDate: event.target.value })}/></label><label>Kho nguồn<select required value={form.fromWarehouseId} onChange={event => setForm({ ...form, fromWarehouseId: +event.target.value })}><option value={0}>Chọn kho</option>{references.data?.warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><label>Kho đích<select required value={form.toWarehouseId} onChange={event => setForm({ ...form, toWarehouseId: +event.target.value })}><option value={0}>Chọn kho</option>{references.data?.warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label></div>{form.fromWarehouseId === form.toWarehouseId && form.fromWarehouseId > 0 && <p className="rounded bg-red-50 p-3 text-sm text-red-700">Kho nguồn và kho đích phải khác nhau.</p>}<div className="overflow-x-auto rounded border"><table className="erp-table"><thead><tr><th>Hàng hóa / Quy cách</th><th>Số lượng</th><th>Ghi chú</th><th></th></tr></thead><tbody>{lines.map((line, index) => <tr key={index}><td><select required value={line.packagingId} onChange={event => updateLine(index, { packagingId: +event.target.value })}><option value={0}>Chọn hàng hóa</option>{options.map(option => <option key={option.id} value={option.id}>{option.productName} - {option.name} ({option.sku})</option>)}</select></td><td><input className="w-36" type="number" min="0.0001" step="0.0001" required value={line.quantity} onChange={event => updateLine(index, { quantity: +event.target.value })}/></td><td><input value={line.note} maxLength={500} onChange={event => updateLine(index, { note: event.target.value })}/></td><td><button type="button" className="erp-icon-btn text-red-500" disabled={lines.length === 1} onClick={() => setLines(rows => rows.filter((_, lineIndex) => lineIndex !== index))}><X size={16}/></button></td></tr>)}</tbody></table></div><button type="button" className="erp-btn" onClick={() => setLines(rows => [...rows, emptyLine()])}><Plus size={16}/> Thêm dòng</button><label>Diễn giải<textarea rows={3} maxLength={1000} value={form.note} onChange={event => setForm({ ...form, note: event.target.value })}/></label></div><div className="erp-modal-footer"><button type="button" className="erp-btn" onClick={() => setOpen(false)}>Đóng</button><button disabled={saveMutation.isPending || form.fromWarehouseId === form.toWarehouseId} className="erp-btn erp-btn-primary">{saveMutation.isPending ? "Đang lưu..." : "Lưu nháp"}</button></div></form></div></div>}
    {selected && <div className="erp-modal-backdrop"><div className="erp-modal max-w-4xl"><div className="erp-modal-header"><div><h2>{selected.code}</h2><p>{selected.fromWarehouseName} → {selected.toWarehouseName} · {formatDate(selected.transferDate)}</p></div><button onClick={() => setSelected(null)}><X/></button></div><div className="erp-modal-body space-y-4"><span className={`erp-badge ${statusMeta[selected.status].css}`}>{statusMeta[selected.status].label}</span><table className="erp-table"><thead><tr><th>Hàng hóa</th><th className="text-right">Số lượng</th><th className="text-right">Giá vốn</th><th className="text-right">Giá trị</th></tr></thead><tbody>{selected.details.map(line => <tr key={line.id}><td><b>{line.productName} - {line.packagingName}</b><small>{line.sku} · {line.note}</small></td><td className="text-right">{formatNumber(line.quantity)} {line.unit}</td><td className="text-right">{formatNumber(line.unitCost)}</td><td className="text-right">{formatNumber(line.totalValue)}</td></tr>)}</tbody></table>{selected.links.length > 0 && <div className="rounded bg-slate-50 p-3"><b>Chứng từ kho liên kết</b><div className="mt-2 flex flex-wrap gap-2">{selected.links.map(link => <span className="erp-badge bg-blue-100 text-blue-700" key={link.id}>{link.linkType}: {link.linkedCode || link.linkedId}</span>)}</div></div>}{selected.cancelReason && <div className="rounded bg-red-50 p-3 text-red-700">Lý do hủy: {selected.cancelReason}</div>}<div className="flex justify-end gap-2">{selected.status === "DRAFT" && <button className="erp-btn" onClick={() => edit(selected)}><Edit size={16}/> Sửa</button>}{selected.status === "DRAFT" && <button className="erp-btn erp-btn-primary" onClick={() => act(selected, "ship")}><Truck size={16}/> Xuất giao</button>}{selected.status === "IN_TRANSIT" && <button className="erp-btn erp-btn-primary" onClick={() => act(selected, "receive")}><PackageCheck size={16}/> Xác nhận nhận</button>}{(["DRAFT", "IN_TRANSIT"] as string[]).includes(selected.status) && <button className="erp-btn text-red-600" onClick={() => act(selected, "cancel")}><Undo2 size={16}/> Hủy phiếu</button>}</div></div></div></div>}
  </div>;
}
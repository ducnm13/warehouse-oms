import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BanknoteArrowDown, BanknoteArrowUp, CheckCircle2, Clock3, Edit, Eye, Plus, Search, Undo2, X } from "lucide-react";
import toast from "react-hot-toast";
import { apiV1 } from "../lib/apiV1";
import { formatDate, formatNumber } from "../lib/utils";
import type { DebtAgingResult, DebtKind, DebtPaymentV1 } from "../types";

type View = "receivables" | "payables" | "receipts" | "vouchers";
type Allocation = { documentId: number; amount: number };
const today = () => new Date().toISOString().slice(0, 10);
const statusMeta = {
  DRAFT: { label: "Nháp", css: "bg-slate-100 text-slate-700" },
  POSTED: { label: "Đã ghi sổ", css: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Đã hủy", css: "bg-red-100 text-red-700" },
} as const;
const bucketLabel: Record<string, string> = { CURRENT: "Chưa quá hạn", "1_30": "Quá hạn 1–30", "31_60": "Quá hạn 31–60", "61_90": "Quá hạn 61–90", OVER_90: "Quá hạn >90" };

export default function Debt() {
  const queryClient = useQueryClient();
  const role = JSON.parse(localStorage.getItem("user") || "{}").role as string | undefined;
  const canReceive = role === "ADMIN" || role === "S_SALES";
  const canPay = role === "ADMIN" || role === "W_MANAGER";
  const [view, setView] = useState<View>("receivables"), [search, setSearch] = useState(""), [status, setStatus] = useState("");
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<DebtPaymentV1 | null>(null), [selected, setSelected] = useState<DebtPaymentV1 | null>(null);
  const [partnerId, setPartnerId] = useState(0), [paymentDate, setPaymentDate] = useState(today()), [method, setMethod] = useState<"CASH" | "BANK" | "OTHER">("BANK"), [note, setNote] = useState(""), [allocations, setAllocations] = useState<Allocation[]>([]);
  const paymentKind: DebtKind = view === "vouchers" ? "VOUCHER" : "RECEIPT";

  const receivables = useQuery({ queryKey: ["debt-receivables-v1", search], queryFn: () => apiV1<DebtAgingResult>(`/api/v1/debt/receivables?search=${encodeURIComponent(search)}`) });
  const payables = useQuery({ queryKey: ["debt-payables-v1", search], queryFn: () => apiV1<DebtAgingResult>(`/api/v1/debt/payables?search=${encodeURIComponent(search)}`) });
  const receipts = useQuery({ queryKey: ["debt-receipts-v1", status, search], enabled: view === "receipts", queryFn: () => apiV1<DebtPaymentV1[]>(`/api/v1/debt/receipts?page=1&limit=100&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}`) });
  const vouchers = useQuery({ queryKey: ["debt-vouchers-v1", status, search], enabled: view === "vouchers", queryFn: () => apiV1<DebtPaymentV1[]>(`/api/v1/debt/vouchers?page=1&limit=100&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}`) });
  const aging = paymentKind === "RECEIPT" ? receivables.data?.data : payables.data?.data;
  const partners = useMemo(() => Array.from(new Map((aging?.rows || []).map(row => [row.partnerId, { id: row.partnerId, code: row.partnerCode, name: row.partnerName }])).values()), [aging]);
  const openDocuments = (aging?.rows || []).filter(row => row.partnerId === partnerId);
  const amount = allocations.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["debt-receivables-v1"] }), queryClient.invalidateQueries({ queryKey: ["debt-payables-v1"] }),
    queryClient.invalidateQueries({ queryKey: ["debt-receipts-v1"] }), queryClient.invalidateQueries({ queryKey: ["debt-vouchers-v1"] }),
    queryClient.invalidateQueries({ queryKey: ["sales-documents-v1"] }), queryClient.invalidateQueries({ queryKey: ["purchase-documents-v1"] }),
  ]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!partnerId || !allocations.length || amount <= 0 || allocations.some(row => row.amount <= 0)) throw new Error("Chọn đối tác và nhập ít nhất một phân bổ hợp lệ");
      const payload = { partnerId, paymentDate, method, amount, note, allocations };
      const resource = paymentKind === "RECEIPT" ? "receipts" : "vouchers";
      return editing
        ? apiV1<DebtPaymentV1>(`/api/v1/debt/${resource}/${editing.id}`, { method: "PUT", body: JSON.stringify({ ...payload, version: editing.version }) })
        : apiV1<DebtPaymentV1>(`/api/v1/debt/${resource}`, { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: response => { toast.success(response.message); setOpen(false); setEditing(null); void invalidate(); }, onError: (error: Error) => toast.error(error.message),
  });
  const actionMutation = useMutation({
    mutationFn: ({ document, action, reason }: { document: DebtPaymentV1; action: "post" | "cancel"; reason?: string }) => apiV1<DebtPaymentV1>(`/api/v1/debt/${document.kind === "RECEIPT" ? "receipts" : "vouchers"}/${document.id}/${action}`, { method: "POST", body: JSON.stringify(action === "cancel" ? { version: document.version, reason } : { version: document.version }) }),
    onSuccess: response => { toast.success(response.message); setSelected(response.data); void invalidate(); }, onError: (error: Error) => toast.error(error.message),
  });

  const create = (kind: DebtKind) => {
    setView(kind === "RECEIPT" ? "receipts" : "vouchers"); setEditing(null); setPartnerId(0); setPaymentDate(today()); setMethod("BANK"); setNote(""); setAllocations([]); setOpen(true);
  };
  const edit = (document: DebtPaymentV1) => {
    setView(document.kind === "RECEIPT" ? "receipts" : "vouchers"); setEditing(document); setPartnerId(document.partnerId); setPaymentDate(document.paymentDate); setMethod(document.method); setNote(document.note || ""); setAllocations(document.allocations.map(row => ({ documentId: row.documentId, amount: row.amount }))); setOpen(true);
  };
  const act = (document: DebtPaymentV1, action: "post" | "cancel") => {
    if (action === "post" && !confirm(`Ghi sổ ${document.code}? Công nợ các chứng từ phân bổ sẽ thay đổi.`)) return;
    const reason = action === "cancel" ? prompt("Lý do hủy (tối thiểu 3 ký tự):") : undefined;
    if (action === "cancel" && (!reason || reason.trim().length < 3)) return;
    actionMutation.mutate({ document, action, reason: reason?.trim() });
  };
  const setAllocation = (documentId: number, checked: boolean, max: number) => setAllocations(rows => checked ? [...rows, { documentId, amount: max }] : rows.filter(row => row.documentId !== documentId));
  const updateAllocation = (documentId: number, next: number) => setAllocations(rows => rows.map(row => row.documentId === documentId ? { ...row, amount: next } : row));
  const paymentRows = view === "receipts" ? receipts.data?.data || [] : vouchers.data?.data || [];
  const agingView = view === "receivables" ? receivables.data?.data : payables.data?.data;

  return <div className="erp-page">
    <div className="erp-page-header"><div><h1>Công nợ V1</h1><p>Ledger phải thu/phải trả, aging và phân bổ phiếu thu chi nhiều chứng từ</p></div><div className="flex gap-2">{canReceive && <button className="erp-btn" onClick={() => create("RECEIPT")}><BanknoteArrowDown size={17}/> Lập phiếu thu</button>}{canPay && <button className="erp-btn erp-btn-primary" onClick={() => create("VOUCHER")}><BanknoteArrowUp size={17}/> Lập phiếu chi</button>}</div></div>
    <div className="flex flex-wrap gap-2">{([['receivables','Phải thu'],['payables','Phải trả'],['receipts','Phiếu thu'],['vouchers','Phiếu chi']] as const).map(([key, label]) => <button key={key} className={`erp-btn ${view === key ? "erp-btn-primary" : ""}`} onClick={() => setView(key)}>{label}</button>)}</div>
    {(view === "receivables" || view === "payables") && <><div className="grid gap-4 md:grid-cols-3"><div className="erp-stat"><BanknoteArrowDown/><div><span>Tổng dư nợ</span><strong>{formatNumber(agingView?.summary.total || 0)} ₫</strong></div></div><div className="erp-stat"><Clock3/><div><span>Quá hạn 1–30</span><strong>{formatNumber(agingView?.summary.days1To30 || 0)} ₫</strong></div></div><div className="erp-stat"><Undo2/><div><span>Quá hạn trên 90</span><strong className="text-red-600">{formatNumber(agingView?.summary.over90 || 0)} ₫</strong></div></div></div><div className="erp-card overflow-hidden"><div className="erp-toolbar"><div className="erp-search"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã chứng từ, đối tác..."/></div></div><div className="overflow-x-auto"><table className="erp-table"><thead><tr><th>Chứng từ</th><th>Đối tác</th><th>Hạn thanh toán</th><th>Tuổi nợ</th><th className="text-right">Giá trị</th><th className="text-right">Còn nợ</th></tr></thead><tbody>{(agingView?.rows || []).map(row => <tr key={row.documentId}><td><b>{row.documentCode}</b><small>{formatDate(row.documentDate)}</small></td><td><b>{row.partnerName}</b><small>{row.partnerCode}</small></td><td>{row.dueDate ? formatDate(row.dueDate) : "-"}</td><td><span className={`erp-badge ${row.daysOverdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{bucketLabel[row.bucket]}</span></td><td className="text-right">{formatNumber(row.totalAmount)} ₫</td><td className="text-right font-bold">{formatNumber(row.outstanding)} ₫</td></tr>)}</tbody></table></div></div></>}
    {(view === "receipts" || view === "vouchers") && <div className="erp-card overflow-hidden"><div className="erp-toolbar flex-wrap"><div className="erp-search"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã phiếu, diễn giải..."/></div><select value={status} onChange={event => setStatus(event.target.value)}><option value="">Mọi trạng thái</option>{Object.entries(statusMeta).map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}</select></div><div className="overflow-x-auto"><table className="erp-table"><thead><tr><th>Mã / Ngày</th><th>Đối tác</th><th>Phương thức</th><th className="text-right">Số tiền</th><th>Phân bổ</th><th>Trạng thái</th><th></th></tr></thead><tbody>{paymentRows.map(document => { const canManage = document.kind === "RECEIPT" ? canReceive : canPay; return <tr key={document.id}><td><button className="font-bold text-indigo-700" onClick={() => setSelected(document)}>{document.code}</button><small>{formatDate(document.paymentDate)} · v{document.version}</small></td><td><b>{document.partnerName}</b><small>{document.partnerCode}</small></td><td>{document.method}</td><td className="text-right font-bold">{formatNumber(document.amount)} ₫</td><td>{document.allocations.length} chứng từ</td><td><span className={`erp-badge ${statusMeta[document.status].css}`}>{statusMeta[document.status].label}</span></td><td><div className="flex gap-1"><button className="erp-icon-btn" onClick={() => setSelected(document)}><Eye size={16}/></button><button className="erp-icon-btn" disabled={!canManage || document.status !== "DRAFT"} onClick={() => edit(document)}><Edit size={16}/></button><button className="erp-icon-btn text-emerald-600" disabled={!canManage || document.status !== "DRAFT"} onClick={() => act(document, "post")}><CheckCircle2 size={16}/></button><button className="erp-icon-btn text-red-600" disabled={!canManage || document.status !== "POSTED"} onClick={() => act(document, "cancel")}><Undo2 size={16}/></button></div></td></tr>; })}</tbody></table></div></div>}
    {open && <div className="erp-modal-backdrop"><div className="erp-modal max-w-5xl"><div className="erp-modal-header"><div><h2>{editing ? `Sửa ${editing.code}` : paymentKind === "RECEIPT" ? "Lập phiếu thu" : "Lập phiếu chi"}</h2><p>Phân bổ một phiếu cho nhiều chứng từ còn dư nợ.</p></div><button onClick={() => setOpen(false)}><X/></button></div><form onSubmit={event => { event.preventDefault(); saveMutation.mutate(); }}><div className="erp-modal-body space-y-5"><div className="grid gap-4 md:grid-cols-4"><label>Ngày phiếu<input type="date" required value={paymentDate} onChange={event => setPaymentDate(event.target.value)}/></label><label>Đối tác<select required value={partnerId} onChange={event => { setPartnerId(+event.target.value); setAllocations([]); }}><option value={0}>Chọn đối tác</option>{partners.map(partner => <option key={partner.id} value={partner.id}>{partner.code} - {partner.name}</option>)}</select></label><label>Phương thức<select value={method} onChange={event => setMethod(event.target.value as any)}><option value="CASH">Tiền mặt</option><option value="BANK">Chuyển khoản</option><option value="OTHER">Khác</option></select></label><label>Tổng phiếu<input readOnly value={formatNumber(amount)}/></label></div><div className="max-h-[45vh] overflow-auto rounded border"><table className="erp-table"><thead><tr><th></th><th>Chứng từ</th><th>Hạn</th><th className="text-right">Còn nợ</th><th className="text-right">Phân bổ</th></tr></thead><tbody>{openDocuments.map(document => { const allocation = allocations.find(row => row.documentId === document.documentId); return <tr key={document.documentId}><td><input type="checkbox" checked={Boolean(allocation)} onChange={event => setAllocation(document.documentId, event.target.checked, document.outstanding)}/></td><td><b>{document.documentCode}</b><small>{formatDate(document.documentDate)}</small></td><td>{document.dueDate ? formatDate(document.dueDate) : "-"}</td><td className="text-right">{formatNumber(document.outstanding)} ₫</td><td className="text-right"><input className="w-36 text-right" type="number" min="0.01" max={document.outstanding} step="0.01" disabled={!allocation} value={allocation?.amount || 0} onChange={event => updateAllocation(document.documentId, +event.target.value)}/></td></tr>; })}</tbody></table></div><label>Diễn giải<textarea rows={3} maxLength={500} value={note} onChange={event => setNote(event.target.value)}/></label></div><div className="erp-modal-footer"><button type="button" className="erp-btn" onClick={() => setOpen(false)}>Đóng</button><button className="erp-btn erp-btn-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Đang lưu..." : "Lưu nháp"}</button></div></form></div></div>}
    {selected && <div className="erp-modal-backdrop"><div className="erp-modal max-w-3xl"><div className="erp-modal-header"><div><h2>{selected.code}</h2><p>{selected.partnerName} · {formatDate(selected.paymentDate)}</p></div><button onClick={() => setSelected(null)}><X/></button></div><div className="erp-modal-body space-y-4"><span className={`erp-badge ${statusMeta[selected.status].css}`}>{statusMeta[selected.status].label}</span><table className="erp-table"><thead><tr><th>Chứng từ</th><th className="text-right">Phân bổ</th></tr></thead><tbody>{selected.allocations.map(row => <tr key={row.id}><td>{row.documentCode}</td><td className="text-right font-bold">{formatNumber(row.amount)} ₫</td></tr>)}</tbody></table>{selected.cancelReason && <div className="rounded bg-red-50 p-3 text-red-700">Lý do hủy: {selected.cancelReason}</div>}<div className="flex justify-end gap-2">{(selected.kind === "RECEIPT" ? canReceive : canPay) && selected.status === "DRAFT" && <button className="erp-btn" onClick={() => edit(selected)}><Edit size={16}/> Sửa</button>}{(selected.kind === "RECEIPT" ? canReceive : canPay) && selected.status === "DRAFT" && <button className="erp-btn erp-btn-primary" onClick={() => act(selected, "post")}><CheckCircle2 size={16}/> Ghi sổ</button>}{(selected.kind === "RECEIPT" ? canReceive : canPay) && selected.status === "POSTED" && <button className="erp-btn text-red-600" onClick={() => act(selected, "cancel")}><Undo2 size={16}/> Hủy/đảo</button>}</div></div></div></div>}
  </div>;
}
import React, { useEffect, useMemo, useState } from "react";
import { Building2, CircleDollarSign, Clock3, Edit, Mail, Phone, Plus, Search, Trash2, WalletCards, X } from "lucide-react";
import toast from "react-hot-toast";
import { Supplier } from "../types";
import { formatNumber } from "../lib/utils";

const headers = (json = false) => ({ Authorization: `Bearer ${localStorage.getItem("token")}`, ...(json ? { "Content-Type": "application/json" } : {}) });
const emptySupplier: Partial<Supplier> = { code: "", name: "", taxCode: "", phone: "", email: "", address: "", contactPerson: "", paymentTermDays: 0 };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);

  const load = async () => {
    setLoading(true);
    try { const res = await fetch("/api/suppliers", { headers: headers() }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setSuppliers(data); }
    catch (e: any) { toast.error(e.message || "Không tải được nhà cung cấp"); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const totals = useMemo(() => suppliers.reduce((a, s) => ({ debt: a.debt + Number(s.debt || 0), overdue: a.overdue + Number(s.overdueDebt || 0), paid: a.paid + Number(s.paidLast30Days || 0) }), { debt: 0, overdue: 0, paid: 0 }), [suppliers]);
  const filtered = suppliers.filter(s => `${s.code} ${s.name} ${s.phone} ${s.taxCode}`.toLowerCase().includes(search.toLowerCase()));
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editing) return;
    try {
      const res = await fetch(editing.id ? `/api/suppliers/${editing.id}` : "/api/suppliers", { method: editing.id ? "PUT" : "POST", headers: headers(true), body: JSON.stringify(editing) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error); toast.success(editing.id ? "Đã cập nhật nhà cung cấp" : "Đã thêm nhà cung cấp"); setEditing(null); load();
    } catch (e: any) { toast.error(e.message); }
  };
  const remove = async (supplier: Supplier) => {
    if (!window.confirm(`Xóa nhà cung cấp ${supplier.code} - ${supplier.name}?`)) return;
    try { const res = await fetch(`/api/suppliers/${supplier.id}`, { method: "DELETE", headers: headers() }); const data = await res.json(); if (!res.ok) throw new Error(data.error); toast.success("Đã xóa nhà cung cấp"); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  return <div className="erp-page">
    <div className="erp-page-header"><div><h1>Nhà cung cấp</h1><p>Danh mục đối tác và công nợ phải trả</p></div><button className="erp-btn erp-btn-primary" onClick={() => setEditing({ ...emptySupplier })}><Plus size={17}/> Thêm nhà cung cấp</button></div>
    <div className="grid gap-4 md:grid-cols-3"><div className="erp-stat"><Clock3/><div><span>Nợ quá hạn</span><strong className="text-red-600">{formatNumber(totals.overdue)} ₫</strong></div></div><div className="erp-stat"><WalletCards/><div><span>Tổng nợ phải trả</span><strong>{formatNumber(totals.debt)} ₫</strong></div></div><div className="erp-stat"><CircleDollarSign/><div><span>Đã thanh toán (30 ngày)</span><strong>{formatNumber(totals.paid)} ₫</strong></div></div></div>
    <div className="erp-card overflow-hidden"><div className="erp-toolbar"><div className="erp-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã, tên, điện thoại, mã số thuế..."/></div></div><div className="overflow-x-auto"><table className="erp-table"><thead><tr><th>Mã / Nhà cung cấp</th><th>Liên hệ</th><th>Địa chỉ</th><th>Mã số thuế</th><th className="text-right">Công nợ</th><th></th></tr></thead><tbody>{loading?<tr><td colSpan={6} className="text-center">Đang tải...</td></tr>:filtered.map(s=><tr key={s.id}><td><div className="flex items-center gap-3"><span className="rounded bg-emerald-50 p-2 text-emerald-700"><Building2 size={17}/></span><div><b>{s.name}</b><small>{s.code}</small></div></div></td><td>{s.phone&&<div className="flex gap-2"><Phone size={14}/>{s.phone}</div>}{s.email&&<small className="flex gap-2"><Mail size={13}/>{s.email}</small>}</td><td className="max-w-xs">{s.address||"-"}</td><td>{s.taxCode||"-"}</td><td className="text-right"><b className={Number(s.overdueDebt)>0?"text-red-600":""}>{formatNumber(Number(s.debt||0))} ₫</b>{Number(s.overdueDebt)>0&&<small>Quá hạn: {formatNumber(Number(s.overdueDebt))} ₫</small>}</td><td><div className="flex justify-end"><button className="erp-icon-btn" onClick={()=>setEditing({...s})}><Edit size={16}/></button><button className="erp-icon-btn text-red-500" onClick={()=>remove(s)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div></div>
    {editing&&<div className="erp-modal-backdrop"><div className="erp-modal max-w-2xl"><div className="erp-modal-header"><div><h2>{editing.id?"Sửa nhà cung cấp":"Thêm nhà cung cấp"}</h2><p>Thông tin đối tác và điều khoản thanh toán</p></div><button onClick={()=>setEditing(null)}><X/></button></div><form onSubmit={save}><div className="erp-modal-body grid gap-4 md:grid-cols-2"><label>Mã nhà cung cấp<input required value={editing.code||""} onChange={e=>setEditing({...editing,code:e.target.value})}/></label><label>Tên nhà cung cấp<input required value={editing.name||""} onChange={e=>setEditing({...editing,name:e.target.value})}/></label><label>Mã số thuế<input value={editing.taxCode||""} onChange={e=>setEditing({...editing,taxCode:e.target.value})}/></label><label>Người liên hệ<input value={editing.contactPerson||""} onChange={e=>setEditing({...editing,contactPerson:e.target.value})}/></label><label>Điện thoại<input value={editing.phone||""} onChange={e=>setEditing({...editing,phone:e.target.value})}/></label><label>Email<input type="email" value={editing.email||""} onChange={e=>setEditing({...editing,email:e.target.value})}/></label><label>Số ngày được nợ<input type="number" min="0" value={editing.paymentTermDays||0} onChange={e=>setEditing({...editing,paymentTermDays:+e.target.value})}/></label><label className="md:col-span-2">Địa chỉ<textarea rows={3} value={editing.address||""} onChange={e=>setEditing({...editing,address:e.target.value})}/></label></div><div className="erp-modal-footer"><button type="button" className="erp-btn" onClick={()=>setEditing(null)}>Hủy</button><button className="erp-btn erp-btn-primary">Lưu nhà cung cấp</button></div></form></div></div>}
  </div>;
}
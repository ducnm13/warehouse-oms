import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, CircleDollarSign, FileSpreadsheet, PackageCheck, Plus, Search, Send, ShoppingCart, X } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";
import { Customer, Product, SalesOrder, SalesOrderDetail, SalesOrderStatus, Warehouse } from "../types";
import { formatDate, formatNumber } from "../lib/utils";

const tokenHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): SalesOrderDetail => ({ packagingId: 0, quantity: 1, unitPrice: 0, discountRate: 0 });
const statusMeta: Record<SalesOrderStatus, { label: string; css: string }> = {
  DRAFT: { label: "Nháp", css: "bg-slate-100 text-slate-600" },
  PENDING: { label: "Chờ duyệt", css: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "Đã duyệt", css: "bg-blue-100 text-blue-700" },
  REJECTED: { label: "Từ chối", css: "bg-red-100 text-red-700" },
  POSTED: { label: "Đã ghi sổ", css: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Đã hủy", css: "bg-rose-100 text-rose-700" },
  FULFILLED: { label: "Đã bán", css: "bg-emerald-100 text-emerald-700" },
};

const numberToVietnameseWords = (amount: number) => {
  if (!Number.isFinite(amount)) return "Không đồng";
  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  const readBlock = (value: number, full: boolean) => {
    const hundred = Math.floor(value / 100);
    const ten = Math.floor((value % 100) / 10);
    const unit = value % 10;
    const words: string[] = [];
    if (hundred || full) words.push(`${digits[hundred]} trăm`);
    if (ten > 1) {
      words.push(`${digits[ten]} mươi`);
      if (unit === 1) words.push("mốt");
      else if (unit === 5) words.push("lăm");
      else if (unit) words.push(digits[unit]);
    } else if (ten === 1) {
      words.push("mười");
      if (unit === 5) words.push("lăm");
      else if (unit) words.push(digits[unit]);
    } else if (unit) {
      if (hundred || full) words.push("lẻ");
      words.push(digits[unit]);
    }
    return words.join(" ");
  };
  let value = Math.round(Math.abs(amount));
  if (value === 0) return "Không đồng";
  const blocks: number[] = [];
  while (value > 0) { blocks.push(value % 1000); value = Math.floor(value / 1000); }
  const words: string[] = [];
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (!blocks[i]) continue;
    words.push(readBlock(blocks[i], i < blocks.length - 1 && blocks[i] < 100));
    if (scales[i]) words.push(scales[i]);
  }
  const text = words.join(" ").replace(/\s+/g, " ").trim();
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} đồng`;
};

const cloneRowStyle = (source: ExcelJS.Row, target: ExcelJS.Row) => {
  target.height = source.height;
  for (let column = 1; column <= 14; column++) {
    const sourceCell = source.getCell(column);
    const targetCell = target.getCell(column);
    targetCell.style = { ...sourceCell.style };
    targetCell.numFmt = sourceCell.numFmt;
  }
};

export default function SalesOrders() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | SalesOrderStatus>("ALL");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SalesOrder | null>(null);
  const [form, setForm] = useState({ orderDate: today(), deliveryDate: today(), customerId: 0, warehouseId: 0, taxRate: 0, note: "" });
  const [details, setDetails] = useState<SalesOrderDetail[]>([emptyLine()]);
  const request = async (url: string, options?: RequestInit) => {
    const res = await fetch(url, { ...options, headers: { ...tokenHeader(), ...(options?.body ? { "Content-Type": "application/json" } : {}), ...options?.headers } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra");
    return data;
  };

  const load = async () => {
    setLoading(true);
    try {
      const [orderData, customerData, warehouseData, productData] = await Promise.all([
        request("/api/sales-orders"), request("/api/customers"), request("/api/warehouses"), request("/api/products?category=PRODUCT")
      ]);
      setOrders(orderData); setCustomers(customerData); setWarehouses(warehouseData); setProducts(productData);
      setForm(f => ({ ...f, customerId: f.customerId || customerData[0]?.id || 0, warehouseId: f.warehouseId || warehouseData[0]?.id || 0 }));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const packagingOptions = useMemo(() => products.flatMap(p => (p.packagings || []).map(pk => ({ ...pk, productName: p.name }))), [products]);
  const filtered = orders.filter(o => (status === "ALL" || o.status === status) && `${o.code} ${o.customerName}`.toLowerCase().includes(search.toLowerCase()));
  const gross = details.reduce((s, d) => s + Number(d.quantity || 0) * Number(d.unitPrice || 0), 0);
  const subtotal = details.reduce((s, d) => s + Number(d.quantity || 0) * Number(d.unitPrice || 0) * (1 - Number(d.discountRate || 0) / 100), 0);
  const total = subtotal * (1 + Number(form.taxRate || 0) / 100);

  const updateLine = (index: number, patch: Partial<SalesOrderDetail>) => setDetails(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await request("/api/sales-orders", { method: "POST", body: JSON.stringify({ ...form, details }) });
      toast.success("Đã tạo đơn hàng"); setOpen(false); setDetails([emptyLine()]); setForm(f => ({ ...f, note: "" })); await load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  const changeStatus = async (order: SalesOrder, nextStatus: SalesOrderStatus) => {
    let reason = "";
    if (nextStatus === "REJECTED") { reason = window.prompt("Nhập lý do từ chối đơn hàng:") || ""; if (!reason) return; }
    try {
      await request(`/api/sales-orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify({ status: nextStatus, reason }) });
      toast.success(nextStatus === "APPROVED" ? "Đã duyệt đơn hàng" : nextStatus === "PENDING" ? "Đã gửi duyệt" : "Đã từ chối đơn"); await load();
    } catch (e: any) { toast.error(e.message); }
  };
  const fulfill = async (order: SalesOrder) => {
    if (!window.confirm(`Ghi nhận bán hàng và xuất kho cho ${order.code}?`)) return;
    try { await request(`/api/sales-orders/${order.id}/fulfill`, { method: "POST" }); toast.success("Đã ghi nhận bán hàng và trừ tồn kho"); await load(); }
    catch (e: any) { toast.error(e.message); }
  };
  const receivePayment = async (order: SalesOrder) => {
    const remaining = Number(order.totalAmount) - Number(order.paidAmount || 0);
    const input = window.prompt(`Công nợ còn lại ${formatNumber(remaining)} ₫. Nhập số tiền thu:`, String(remaining));
    if (!input) return;
    try {
      await request(`/api/sales-orders/${order.id}/payments`, { method: "POST", body: JSON.stringify({ amount: Number(input), paymentDate: today(), method: "BANK" }) });
      toast.success("Đã ghi nhận thu tiền khách hàng"); await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const exportOrder = async (order: SalesOrder) => {
    try {
      const response = await fetch("/api/sales-orders/template", { headers: tokenHeader() });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Không tải được file mẫu đơn hàng");
      }
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await response.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("File mẫu không có worksheet");

      const templateCapacity = 12;
      const extraRows = Math.max(0, order.details.length - templateCapacity);
      if (extraRows) {
        const styleSource = ws.getRow(27);
        ["A28:L28", "A29:L29", "A30:L30", "A31:L31", "A32:L32", "A33:N33",
          "A38:C38", "D38:G38", "H38:J38", "K38:N38",
          "A39:C39", "D39:G39", "H39:J39", "K39:N39"].forEach(range => ws.unMergeCells(range));
        ws.insertRows(28, Array.from({ length: extraRows }, () => []), "i");
        for (let index = 0; index < extraRows; index++) cloneRowStyle(styleSource, ws.getRow(28 + index));
        for (let row = 28 + extraRows; row <= 32 + extraRows; row++) ws.mergeCells(`A${row}:L${row}`);
        ws.mergeCells(`A${33 + extraRows}:N${33 + extraRows}`);
        ws.mergeCells(`A${38 + extraRows}:C${38 + extraRows}`);
        ws.mergeCells(`D${38 + extraRows}:G${38 + extraRows}`);
        ws.mergeCells(`H${38 + extraRows}:J${38 + extraRows}`);
        ws.mergeCells(`K${38 + extraRows}:N${38 + extraRows}`);
        ws.mergeCells(`A${39 + extraRows}:C${39 + extraRows}`);
        ws.mergeCells(`D${39 + extraRows}:G${39 + extraRows}`);
        ws.mergeCells(`H${39 + extraRows}:J${39 + extraRows}`);
        ws.mergeCells(`K${39 + extraRows}:N${39 + extraRows}`);
      }
      const summaryStart = 28 + extraRows;
      const taxRate = Number(order.subtotal) > 0 ? Number(order.taxAmount) / Number(order.subtotal) : 0;

      ws.getCell("G6").value = formatDate(order.orderDate);
      ws.getCell("I6").value = order.code;
      ws.getCell("C7").value = order.customerName || "";
      ws.getCell("C8").value = customers.find(customer => customer.id === order.customerId)?.groupName || "";
      ws.getCell("M8").value = order.customerPhone || "";
      ws.getCell("C9").value = order.customerAddress || "";
      ws.getCell("C10").value = order.customerAddress || "";
      ws.getCell("C11").value = order.customerTaxCode || "";
      ws.getCell("C12").value = order.creatorName || "";

      const rowCount = Math.max(templateCapacity + extraRows, order.details.length);
      for (let index = 0; index < rowCount; index++) {
        const rowNumber = 16 + index;
        const row = ws.getRow(rowNumber);
        for (let column = 1; column <= 14; column++) row.getCell(column).value = null;
        const detail = order.details[index];
        if (!detail) continue;
        const discountRate = Number(detail.discountRate || 0) / 100;
        const unitPriceBeforeTax = Number(detail.unitPrice || 0);
        row.getCell(1).value = index + 1;
        row.getCell(2).value = detail.sku || "";
        row.getCell(3).value = detail.productName || "";
        row.getCell(4).value = detail.packagingName || "";
        row.getCell(5).value = detail.unit || "";
        row.getCell(6).value = Number(detail.quantity || 0);
        row.getCell(9).value = unitPriceBeforeTax;
        row.getCell(10).value = unitPriceBeforeTax * (1 + taxRate);
        row.getCell(11).value = unitPriceBeforeTax * Number(detail.quantity || 0);
        row.getCell(12).value = discountRate;
        row.getCell(13).value = Number(detail.lineTotal || 0);
        row.getCell(14).value = detail.note || "";
      }

      ws.getCell(`M${summaryStart}`).value = Number(order.subtotal);
      ws.getCell(`A${summaryStart + 1}`).value = `VAT (${(taxRate * 100).toLocaleString("vi-VN")}%)`;
      ws.getCell(`M${summaryStart + 1}`).value = Number(order.taxAmount);
      ws.getCell(`M${summaryStart + 2}`).value = Number(order.totalAmount);
      ws.getCell(`M${summaryStart + 3}`).value = 0;
      ws.getCell(`M${summaryStart + 4}`).value = Number(order.totalAmount);
      ws.getCell(`A${summaryStart + 5}`).value = `Số tiền (bằng chữ): ${numberToVietnameseWords(Number(order.totalAmount))}`;
      ws.getCell(`A${summaryStart + 6}`).value = `Đơn giá trên đã gồm VAT ${(taxRate * 100).toLocaleString("vi-VN")}% và chiết khấu thương mại.`;
      ws.getCell(`A${summaryStart + 8}`).value = `Thời gian giao hàng: ${order.deliveryDate ? formatDate(order.deliveryDate) : ""}`;

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `DonDatHang_${order.code}.xlsx`);
      toast.success("Đã xuất đơn hàng theo file mẫu");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Không thể xuất đơn hàng");
    }
  };

  return <div className="erp-page">
    <div className="erp-page-header"><div><h1>Đơn đặt hàng</h1><p>Tạo, xét duyệt và ghi nhận bán hàng</p></div><button className="erp-btn erp-btn-primary" onClick={() => setOpen(true)}><Plus size={17}/> Thêm đơn hàng</button></div>
    <div className="grid gap-4 md:grid-cols-4">
      {([['ALL','Tổng đơn',orders.length,ShoppingCart],['PENDING','Chờ duyệt',orders.filter(o=>o.status==='PENDING').length,Send],['APPROVED','Sẵn sàng bán',orders.filter(o=>o.status==='APPROVED').length,PackageCheck],['FULFILLED','Doanh thu',orders.filter(o=>o.status==='FULFILLED').reduce((s,o)=>s+Number(o.totalAmount),0),CircleDollarSign]] as const).map(([key,label,value,Icon]) => <button key={key} onClick={()=>setStatus(key as any)} className={`erp-stat text-left ${status===key?'ring-2 ring-emerald-500':''}`}><Icon size={20}/><div><span>{label}</span><strong>{key==='FULFILLED'?`${formatNumber(value)} ₫`:formatNumber(value)}</strong></div></button>)}
    </div>
    <div className="erp-card overflow-hidden"><div className="erp-toolbar"><div className="erp-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm số đơn, khách hàng..."/></div><select value={status} onChange={e=>setStatus(e.target.value as any)}><option value="ALL">Tất cả trạng thái</option>{Object.entries(statusMeta).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="erp-table"><thead><tr><th>Số đơn / Ngày</th><th>Khách hàng</th><th>Kho xuất</th><th>Trạng thái</th><th className="text-right">Tổng tiền / Công nợ</th><th className="text-right">Thao tác</th></tr></thead><tbody>{loading?<tr><td colSpan={6} className="text-center">Đang tải...</td></tr>:filtered.map(o=><tr key={o.id}><td><button onClick={()=>setSelected(o)} className="font-semibold text-emerald-700 hover:underline">{o.code}</button><small>{formatDate(o.orderDate)}</small></td><td><b>{o.customerName}</b><small>{o.customerPhone}</small></td><td>{o.warehouseName}</td><td><span className={`erp-badge ${statusMeta[o.status].css}`}>{statusMeta[o.status].label}</span>{o.status==='FULFILLED'&&<small>{o.paymentStatus==='PAID'?'Đã thu đủ':o.paymentStatus==='PARTIAL'?'Thu một phần':'Chưa thu tiền'}</small>}</td><td className="text-right font-semibold">{formatNumber(o.totalAmount)} ₫{o.status==='FULFILLED'&&<small>Còn nợ: {formatNumber(o.totalAmount-Number(o.paidAmount||0))} ₫</small>}</td><td><div className="flex justify-end gap-1"><button className="erp-icon-btn" title="Xuất Excel" onClick={()=>exportOrder(o)}><FileSpreadsheet size={17}/></button>{(o.status==='DRAFT'||o.status==='REJECTED')&&<button className="erp-icon-btn" title="Gửi duyệt" onClick={()=>changeStatus(o,'PENDING')}><Send size={17}/></button>}{o.status==='PENDING'&&<><button className="erp-icon-btn text-emerald-600" title="Duyệt" onClick={()=>changeStatus(o,'APPROVED')}><Check size={17}/></button><button className="erp-icon-btn text-red-500" title="Từ chối" onClick={()=>changeStatus(o,'REJECTED')}><X size={17}/></button></>}{o.status==='APPROVED'&&<button className="erp-btn erp-btn-primary py-1.5" onClick={()=>fulfill(o)}>Bán hàng <ChevronRight size={15}/></button>}{o.status==='FULFILLED'&&o.paymentStatus!=='PAID'&&<button className="erp-btn py-1.5 text-emerald-700" onClick={()=>receivePayment(o)}>Thu tiền</button>}</div></td></tr>)}</tbody></table></div>
    </div>

    {open&&<div className="erp-modal-backdrop"><div className="erp-modal max-w-5xl"><div className="erp-modal-header"><div><h2>Thêm đơn đặt hàng</h2><p>Nhập thông tin hàng hóa và điều khoản giao hàng</p></div><button onClick={()=>setOpen(false)}><X/></button></div><form onSubmit={submit}><div className="erp-modal-body space-y-5"><div className="grid gap-4 md:grid-cols-4"><label>Ngày đơn<input type="date" required value={form.orderDate} onChange={e=>setForm({...form,orderDate:e.target.value})}/></label><label>Ngày giao<input type="date" value={form.deliveryDate} onChange={e=>setForm({...form,deliveryDate:e.target.value})}/></label><label>Khách hàng<select required value={form.customerId} onChange={e=>setForm({...form,customerId:+e.target.value})}><option value={0}>Chọn khách hàng</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Kho xuất<select required value={form.warehouseId} onChange={e=>setForm({...form,warehouseId:+e.target.value})}>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label></div>
      <div className="overflow-x-auto border rounded"><table className="erp-table"><thead><tr><th className="w-2/5">Hàng hóa</th><th>SL</th><th>Đơn giá</th><th>CK (%)</th><th className="text-right">Thành tiền</th><th></th></tr></thead><tbody>{details.map((d,i)=><tr key={i}><td><select required value={d.packagingId} onChange={e=>updateLine(i,{packagingId:+e.target.value})}><option value={0}>Chọn sản phẩm / quy cách</option>{packagingOptions.map(pk=><option key={pk.id} value={pk.id}>{pk.productName} - {pk.name} ({pk.sku})</option>)}</select></td><td><input className="w-24" type="number" min="0.01" step="any" required value={d.quantity} onChange={e=>updateLine(i,{quantity:+e.target.value})}/></td><td><input className="w-32" type="number" min="0" step="any" required value={d.unitPrice} onChange={e=>updateLine(i,{unitPrice:+e.target.value})}/></td><td><input className="w-20" type="number" min="0" max="100" value={d.discountRate} onChange={e=>updateLine(i,{discountRate:+e.target.value})}/></td><td className="text-right font-semibold">{formatNumber(d.quantity*d.unitPrice*(1-d.discountRate/100))}</td><td><button type="button" className="erp-icon-btn text-red-500" disabled={details.length===1} onClick={()=>setDetails(rows=>rows.filter((_,x)=>x!==i))}><X size={16}/></button></td></tr>)}</tbody></table></div><button type="button" className="erp-btn" onClick={()=>setDetails(r=>[...r,emptyLine()])}><Plus size={16}/> Thêm dòng</button>
      <div className="grid gap-4 md:grid-cols-2"><label>Diễn giải<textarea rows={3} value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label><div className="ml-auto w-full max-w-sm space-y-2 text-sm"><div className="flex justify-between"><span>Tiền hàng</span><b>{formatNumber(gross)} ₫</b></div><div className="flex justify-between"><span>Chiết khấu</span><b>-{formatNumber(gross-subtotal)} ₫</b></div><div className="flex items-center justify-between"><span>Thuế GTGT (%)</span><input className="w-24" type="number" min="0" value={form.taxRate} onChange={e=>setForm({...form,taxRate:+e.target.value})}/></div><div className="flex justify-between border-t pt-2 text-lg text-emerald-700"><b>Thanh toán</b><b>{formatNumber(total)} ₫</b></div></div></div></div><div className="erp-modal-footer"><button type="button" className="erp-btn" onClick={()=>setOpen(false)}>Hủy</button><button disabled={saving} className="erp-btn erp-btn-primary">{saving?'Đang lưu...':'Lưu đơn hàng'}</button></div></form></div></div>}
    {selected&&<div className="erp-modal-backdrop"><div className="erp-modal max-w-3xl"><div className="erp-modal-header"><div><h2>{selected.code}</h2><p>{selected.customerName} · {selected.warehouseName}</p></div><button onClick={()=>setSelected(null)}><X/></button></div><div className="erp-modal-body"><div className="mb-4 flex justify-between"><span className={`erp-badge ${statusMeta[selected.status].css}`}>{statusMeta[selected.status].label}</span><b className="text-xl text-emerald-700">{formatNumber(selected.totalAmount)} ₫</b></div><table className="erp-table"><thead><tr><th>Hàng hóa</th><th>SL</th><th className="text-right">Đơn giá</th><th className="text-right">Thành tiền</th></tr></thead><tbody>{selected.details.map(d=><tr key={d.id}><td>{d.productName} - {d.packagingName}<small>{d.sku}</small></td><td>{formatNumber(d.quantity)} {d.unit}</td><td className="text-right">{formatNumber(d.unitPrice)}</td><td className="text-right font-semibold">{formatNumber(d.lineTotal||0)}</td></tr>)}</tbody></table>{selected.rejectionReason&&<p className="mt-4 rounded bg-red-50 p-3 text-red-700">Lý do từ chối: {selected.rejectionReason}</p>}</div></div></div>}
  </div>;
}
import React, { useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, CircleDollarSign, Edit, FileSpreadsheet, PackageCheck, Plus, Search, Send, ShoppingCart, Undo2, X } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";
import type { Customer, Product, SalesOrder, SalesOrderDetail, Warehouse } from "../types";
import { apiV1, legacyApi } from "../lib/apiV1";
import { formatDate, formatNumber } from "../lib/utils";

const headerSchema = z.object({
  orderDate: z.string().min(1, "Chọn ngày đơn"),
  deliveryDate: z.string().optional(),
  dueDate: z.string().optional(),
  customerId: z.number().positive("Chọn khách hàng"),
  warehouseId: z.number().positive("Chọn kho xuất"),
  taxRate: z.number().min(0).max(100),
  paymentIntent: z.enum(["UNPAID", "PAID"]),
  paymentMethod: z.enum(["CASH", "BANK"]),
  note: z.string().max(1000),
});
type HeaderForm = z.infer<typeof headerSchema>;
type Line = Pick<SalesOrderDetail, "packagingId" | "quantity" | "unitPrice" | "discountRate" | "note">;
type V1Status = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "POSTED" | "CANCELLED";

const tokenHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({ packagingId: 0, quantity: 1, unitPrice: 0, discountRate: 0, note: "" });
const statusMeta: Record<V1Status, { label: string; css: string }> = {
  DRAFT: { label: "Nháp", css: "bg-slate-100 text-slate-600" },
  PENDING: { label: "Chờ duyệt", css: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "Đã duyệt", css: "bg-blue-100 text-blue-700" },
  REJECTED: { label: "Từ chối", css: "bg-red-100 text-red-700" },
  POSTED: { label: "Đã ghi sổ", css: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Đã hủy", css: "bg-rose-100 text-rose-700" },
};

const numberToVietnameseWords = (amount: number) => {
  if (!Number.isFinite(amount)) return "Không đồng";
  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  const readBlock = (value: number, full: boolean) => {
    const hundred = Math.floor(value / 100), ten = Math.floor((value % 100) / 10), unit = value % 10;
    const words: string[] = [];
    if (hundred || full) words.push(`${digits[hundred]} trăm`);
    if (ten > 1) { words.push(`${digits[ten]} mươi`); if (unit === 1) words.push("mốt"); else if (unit === 5) words.push("lăm"); else if (unit) words.push(digits[unit]); }
    else if (ten === 1) { words.push("mười"); if (unit === 5) words.push("lăm"); else if (unit) words.push(digits[unit]); }
    else if (unit) { if (hundred || full) words.push("lẻ"); words.push(digits[unit]); }
    return words.join(" ");
  };
  let value = Math.round(Math.abs(amount));
  if (!value) return "Không đồng";
  const blocks: number[] = [];
  while (value > 0) { blocks.push(value % 1000); value = Math.floor(value / 1000); }
  const words: string[] = [];
  for (let index = blocks.length - 1; index >= 0; index--) if (blocks[index]) {
    words.push(readBlock(blocks[index], index < blocks.length - 1 && blocks[index] < 100));
    if (scales[index]) words.push(scales[index]);
  }
  const text = words.join(" ").replace(/\s+/g, " ").trim();
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} đồng`;
};

const cloneRowStyle = (source: ExcelJS.Row, target: ExcelJS.Row) => {
  target.height = source.height;
  for (let column = 1; column <= 14; column++) {
    const sourceCell = source.getCell(column), targetCell = target.getCell(column);
    targetCell.style = { ...sourceCell.style }; targetCell.numFmt = sourceCell.numFmt;
  }
};

export default function SalesOrdersV1() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | V1Status>("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalesOrder | null>(null);
  const [selected, setSelected] = useState<SalesOrder | null>(null);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const form = useForm<HeaderForm>({
    resolver: zodResolver(headerSchema),
    defaultValues: { orderDate: today(), deliveryDate: today(), dueDate: "", customerId: 0, warehouseId: 0, taxRate: 0, paymentIntent: "UNPAID", paymentMethod: "CASH", note: "" },
  });

  const references = useQuery({
    queryKey: ["sales-references"],
    queryFn: async () => {
      const [customers, warehouses, products] = await Promise.all([
        legacyApi<Customer[]>("/api/customers"), legacyApi<Warehouse[]>("/api/warehouses"), legacyApi<Product[]>("/api/products?category=PRODUCT"),
      ]);
      return { customers, warehouses, products };
    },
  });
  const documents = useQuery({
    queryKey: ["sales-documents-v1", page, search, status],
    queryFn: () => apiV1<SalesOrder[]>(`/api/v1/sales-documents?page=${page}&limit=20&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}`),
  });
  const orders = documents.data?.data || [];
  const meta = documents.data?.meta as any;
  const packagingOptions = useMemo(() => (references.data?.products || []).flatMap(product =>
    (product.packagings || []).map(packaging => ({ ...packaging, productName: product.name }))), [references.data]);
  const gross = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
  const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0) * (1 - Number(line.discountRate || 0) / 100), 0);
  const taxRate = Number(form.watch("taxRate") || 0);
  const total = subtotal * (1 + taxRate / 100);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sales-documents-v1"] });

  const saveMutation = useMutation({
    mutationFn: (input: HeaderForm) => {
      if (lines.some(line => !line.packagingId || line.quantity <= 0 || line.unitPrice < 0)) throw new Error("Chi tiết hàng hóa không hợp lệ");
      const payload = { ...input, details: lines };
      return editing
        ? apiV1<SalesOrder>(`/api/v1/sales-documents/${editing.id}`, { method: "PUT", body: JSON.stringify({ ...payload, version: editing.version }) })
        : apiV1<SalesOrder>("/api/v1/sales-documents", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: response => { toast.success(response.message); setOpen(false); setEditing(null); invalidate(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const actionMutation = useMutation({
    mutationFn: ({ document, action, extra = {} }: { document: SalesOrder; action: string; extra?: Record<string, unknown> }) =>
      apiV1<SalesOrder>(`/api/v1/sales-documents/${document.id}/${action}`, { method: "POST", body: JSON.stringify({ version: document.version, ...extra }) }),
    onSuccess: response => { toast.success(response.message); setSelected(response.data); invalidate(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreate = () => {
    setEditing(null); setLines([emptyLine()]);
    form.reset({ orderDate: today(), deliveryDate: today(), dueDate: "", customerId: references.data?.customers[0]?.id || 0, warehouseId: references.data?.warehouses[0]?.id || 0, taxRate: 0, paymentIntent: "UNPAID", paymentMethod: "CASH", note: "" });
    setOpen(true);
  };
  const openEdit = (document: SalesOrder) => {
    setEditing(document); setLines(document.details.map(line => ({ packagingId: line.packagingId, quantity: line.quantity, unitPrice: line.unitPrice, discountRate: line.discountRate, note: line.note || "" })));
    const rate = document.subtotal ? document.taxAmount / document.subtotal * 100 : 0;
    form.reset({ orderDate: document.orderDate, deliveryDate: document.deliveryDate || "", dueDate: document.dueDate || "", customerId: document.customerId, warehouseId: document.warehouseId, taxRate: rate, paymentIntent: document.paymentIntent || "UNPAID", paymentMethod: document.paymentMethod || "CASH", note: document.note || "" });
    setOpen(true);
  };
  const updateLine = (index: number, patch: Partial<Line>) => setLines(current => current.map((line, position) => position === index ? { ...line, ...patch } : line));

  const runAction = (document: SalesOrder, action: string) => {
    if (action === "reject" || action === "cancel") {
      const reason = window.prompt(action === "reject" ? "Nhập lý do từ chối:" : "Nhập lý do hủy và đảo chứng từ:");
      if (reason) actionMutation.mutate({ document, action, extra: { reason } });
      return;
    }
    if (action === "post" && !window.confirm(`Ghi sổ, xuất kho và ghi nhận phải thu cho ${document.code}?`)) return;
    actionMutation.mutate({ document, action });
  };
  const receivePayment = (document: SalesOrder) => {
    const remaining = document.totalAmount - Number(document.paidAmount || 0);
    const amount = Number(window.prompt(`Công nợ còn lại ${formatNumber(remaining)} ₫. Nhập số tiền thu:`, String(remaining)) || 0);
    if (amount > 0) actionMutation.mutate({ document, action: "payments", extra: { amount, paymentDate: today(), method: "BANK", note: `Thu tiền ${document.code}` } });
  };

  const exportOrder = async (order: SalesOrder) => {
    try {
      const response = await fetch("/api/sales-orders/template", { headers: tokenHeader() });
      if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.error || "Không tải được file mẫu đơn hàng"); }
      const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await response.arrayBuffer());
      const worksheet = workbook.worksheets[0]; if (!worksheet) throw new Error("File mẫu không có worksheet");
      const templateCapacity = 12, extraRows = Math.max(0, order.details.length - templateCapacity);
      if (extraRows) {
        const styleSource = worksheet.getRow(27);
        ["A28:L28", "A29:L29", "A30:L30", "A31:L31", "A32:L32", "A33:N33", "A38:C38", "D38:G38", "H38:J38", "K38:N38", "A39:C39", "D39:G39", "H39:J39", "K39:N39"].forEach(range => worksheet.unMergeCells(range));
        worksheet.insertRows(28, Array.from({ length: extraRows }, () => []), "i");
        for (let index = 0; index < extraRows; index++) cloneRowStyle(styleSource, worksheet.getRow(28 + index));
        for (let row = 28 + extraRows; row <= 32 + extraRows; row++) worksheet.mergeCells(`A${row}:L${row}`);
        worksheet.mergeCells(`A${33 + extraRows}:N${33 + extraRows}`);
        [38, 39].forEach(row => { worksheet.mergeCells(`A${row + extraRows}:C${row + extraRows}`); worksheet.mergeCells(`D${row + extraRows}:G${row + extraRows}`); worksheet.mergeCells(`H${row + extraRows}:J${row + extraRows}`); worksheet.mergeCells(`K${row + extraRows}:N${row + extraRows}`); });
      }
      const summaryStart = 28 + extraRows, rate = order.subtotal > 0 ? order.taxAmount / order.subtotal : 0;
      worksheet.getCell("G6").value = formatDate(order.orderDate); worksheet.getCell("I6").value = order.code;
      worksheet.getCell("C7").value = order.customerName || ""; worksheet.getCell("C8").value = references.data?.customers.find(customer => customer.id === order.customerId)?.groupName || "";
      worksheet.getCell("M8").value = order.customerPhone || ""; worksheet.getCell("C9").value = order.customerAddress || ""; worksheet.getCell("C10").value = order.customerAddress || "";
      worksheet.getCell("C11").value = order.customerTaxCode || ""; worksheet.getCell("C12").value = order.creatorName || "";
      const rowCount = Math.max(templateCapacity + extraRows, order.details.length);
      for (let index = 0; index < rowCount; index++) {
        const row = worksheet.getRow(16 + index); for (let column = 1; column <= 14; column++) row.getCell(column).value = null;
        const detail = order.details[index]; if (!detail) continue;
        row.getCell(1).value = index + 1; row.getCell(2).value = detail.sku || ""; row.getCell(3).value = detail.productName || ""; row.getCell(4).value = detail.packagingName || "";
        row.getCell(5).value = detail.unit || ""; row.getCell(6).value = detail.quantity; row.getCell(9).value = detail.unitPrice; row.getCell(10).value = detail.unitPrice * (1 + rate);
        row.getCell(11).value = detail.unitPrice * detail.quantity; row.getCell(12).value = detail.discountRate / 100; row.getCell(13).value = detail.lineTotal || 0; row.getCell(14).value = detail.note || "";
      }
      worksheet.getCell(`M${summaryStart}`).value = order.subtotal; worksheet.getCell(`A${summaryStart + 1}`).value = `VAT (${(rate * 100).toLocaleString("vi-VN")}%)`;
      worksheet.getCell(`M${summaryStart + 1}`).value = order.taxAmount; worksheet.getCell(`M${summaryStart + 2}`).value = order.totalAmount; worksheet.getCell(`M${summaryStart + 3}`).value = 0;
      worksheet.getCell(`M${summaryStart + 4}`).value = order.totalAmount; worksheet.getCell(`A${summaryStart + 5}`).value = `Số tiền (bằng chữ): ${numberToVietnameseWords(order.totalAmount)}`;
      worksheet.getCell(`A${summaryStart + 6}`).value = `Đơn giá trên đã gồm VAT ${(rate * 100).toLocaleString("vi-VN")}% và chiết khấu thương mại.`;
      worksheet.getCell(`A${summaryStart + 8}`).value = `Thời gian giao hàng: ${order.deliveryDate ? formatDate(order.deliveryDate) : ""}`;
      const buffer = await workbook.xlsx.writeBuffer(); saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `DonDatHang_${order.code}.xlsx`);
      toast.success("Đã xuất đơn hàng theo file mẫu");
    } catch (error: any) { toast.error(error.message || "Không thể xuất đơn hàng"); }
  };

  return <div className="erp-page">
    <div className="erp-page-header"><div><h1>Bán hàng</h1><p>Duyệt, ghi sổ, xuất kho và công nợ phải thu theo ledger v1</p></div><button className="erp-btn erp-btn-primary" onClick={openCreate} disabled={!references.data?.customers.length}><Plus size={17}/> Thêm đơn bán</button></div>
    <div className="grid gap-4 md:grid-cols-3"><div className="erp-stat"><ShoppingCart/><div><span>Tổng chứng từ</span><strong>{meta?.total || 0}</strong></div></div><div className="erp-stat"><PackageCheck/><div><span>Đã ghi sổ trang này</span><strong>{orders.filter(order=>order.status==='POSTED').length}</strong></div></div><div className="erp-stat"><CircleDollarSign/><div><span>Doanh số trang này</span><strong>{formatNumber(orders.filter(order=>order.status==='POSTED').reduce((sum,order)=>sum+order.totalAmount,0))} ₫</strong></div></div></div>
    <div className="erp-card overflow-hidden"><div className="erp-toolbar"><div className="erp-search"><Search size={17}/><input value={search} onChange={event=>{setSearch(event.target.value);setPage(1)}} placeholder="Tìm số đơn, khách hàng..."/></div><select value={status} onChange={event=>{setStatus(event.target.value as any);setPage(1)}}><option value="">Tất cả trạng thái</option>{Object.entries(statusMeta).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></div>
      {documents.isLoading?<div className="p-12 text-center">Đang tải chứng từ...</div>:documents.isError?<div className="p-12 text-center text-red-600">{(documents.error as Error).message}</div>:orders.length===0?<div className="p-12 text-center text-slate-400">Chưa có chứng từ phù hợp.</div>:<div className="overflow-x-auto"><table className="erp-table"><thead><tr><th>Số đơn / Ngày</th><th>Khách hàng</th><th>Kho xuất</th><th>Trạng thái</th><th className="text-right">Tổng tiền / Công nợ</th><th></th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td><button className="font-semibold text-emerald-700" onClick={()=>setSelected(order)}>{order.code}</button><small>{formatDate(order.orderDate)} · v{order.version}</small></td><td><b>{order.customerName}</b><small>{order.customerPhone}</small></td><td>{order.warehouseName}</td><td><span className={`erp-badge ${statusMeta[order.status as V1Status].css}`}>{statusMeta[order.status as V1Status].label}</span>{order.status==='POSTED'&&<small>{order.paymentStatus==='PAID'?'Đã thu đủ':order.paymentStatus==='PARTIAL'?'Thu một phần':'Chưa thu tiền'}</small>}</td><td className="text-right font-semibold">{formatNumber(order.totalAmount)} ₫{order.status==='POSTED'&&<small>Còn nợ: {formatNumber(order.totalAmount-Number(order.paidAmount||0))} ₫</small>}</td><td><div className="flex justify-end gap-1"><button className="erp-icon-btn" title="Xuất Excel" onClick={()=>exportOrder(order)}><FileSpreadsheet size={17}/></button>{(order.status==='DRAFT'||order.status==='REJECTED')&&<><button className="erp-icon-btn" title="Sửa" onClick={()=>openEdit(order)}><Edit size={16}/></button><button className="erp-icon-btn" title="Gửi duyệt" onClick={()=>runAction(order,'submit')}><Send size={17}/></button></>}{order.status==='PENDING'&&<><button className="erp-icon-btn text-emerald-600" title="Duyệt" onClick={()=>runAction(order,'approve')}><Check size={17}/></button><button className="erp-icon-btn text-red-500" title="Từ chối" onClick={()=>runAction(order,'reject')}><X size={17}/></button></>}{order.status==='APPROVED'&&<button className="erp-btn erp-btn-primary py-1.5" onClick={()=>runAction(order,'post')}>Ghi sổ <ChevronRight size={15}/></button>}{order.status==='POSTED'&&<>{order.paymentStatus!=='PAID'&&<button className="erp-btn py-1.5 text-emerald-700" onClick={()=>receivePayment(order)}>Thu tiền</button>}<button className="erp-icon-btn text-red-500" title="Hủy và đảo" onClick={()=>runAction(order,'cancel')}><Undo2 size={16}/></button></>}</div></td></tr>)}</tbody></table></div>}
      {meta?.totalPages>1&&<div className="flex justify-end gap-2 p-3"><button className="erp-btn" disabled={page<=1} onClick={()=>setPage(value=>value-1)}>Trước</button><span className="px-3 py-2 text-sm">Trang {page}/{meta.totalPages}</span><button className="erp-btn" disabled={page>=meta.totalPages} onClick={()=>setPage(value=>value+1)}>Sau</button></div>}
    </div>
    {open&&<div className="erp-modal-backdrop"><div className="erp-modal max-w-5xl"><div className="erp-modal-header"><div><h2>{editing?'Sửa đơn bán hàng':'Thêm đơn bán hàng'}</h2><p>Nháp không tác động tồn kho hoặc công nợ</p></div><button onClick={()=>setOpen(false)}><X/></button></div><form onSubmit={form.handleSubmit(input=>saveMutation.mutate(input))}><div className="erp-modal-body space-y-5"><div className="grid gap-4 md:grid-cols-4"><label>Ngày đơn<input type="date" {...form.register('orderDate')}/></label><label>Ngày giao<input type="date" {...form.register('deliveryDate')}/></label><label>Hạn thanh toán<input type="date" {...form.register('dueDate')}/></label><label>Khách hàng<select {...form.register('customerId',{valueAsNumber:true})}><option value={0}>Chọn khách hàng</option>{references.data?.customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name}</option>)}</select><small className="text-red-500">{form.formState.errors.customerId?.message}</small></label><label>Kho xuất<select {...form.register('warehouseId',{valueAsNumber:true})}><option value={0}>Chọn kho</option>{references.data?.warehouses.map(warehouse=><option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><label>Ý định thu tiền<select {...form.register('paymentIntent')}><option value="UNPAID">Ghi công nợ</option><option value="PAID">Thu ngay khi ghi sổ</option></select></label><label>Phương thức<select {...form.register('paymentMethod')}><option value="CASH">Tiền mặt</option><option value="BANK">Chuyển khoản</option></select></label></div>
      <div className="overflow-x-auto border rounded"><table className="erp-table"><thead><tr><th>Hàng hóa / Quy cách</th><th>SL</th><th>Đơn giá</th><th>CK %</th><th className="text-right">Thành tiền</th><th></th></tr></thead><tbody>{lines.map((line,index)=><tr key={index}><td><select value={line.packagingId} onChange={event=>updateLine(index,{packagingId:+event.target.value})}><option value={0}>Chọn hàng hóa</option>{packagingOptions.map(item=><option key={item.id} value={item.id}>{item.productName} - {item.name} ({item.sku})</option>)}</select></td><td><input className="w-24" type="number" min="0.0001" step="any" value={line.quantity} onChange={event=>updateLine(index,{quantity:+event.target.value})}/></td><td><input className="w-32" type="number" min="0" step="any" value={line.unitPrice} onChange={event=>updateLine(index,{unitPrice:+event.target.value})}/></td><td><input className="w-20" type="number" min="0" max="100" value={line.discountRate} onChange={event=>updateLine(index,{discountRate:+event.target.value})}/></td><td className="text-right font-semibold">{formatNumber(line.quantity*line.unitPrice*(1-line.discountRate/100))}</td><td><button type="button" className="erp-icon-btn text-red-500" disabled={lines.length===1} onClick={()=>setLines(current=>current.filter((_,position)=>position!==index))}><X size={15}/></button></td></tr>)}</tbody></table></div><button type="button" className="erp-btn" onClick={()=>setLines(current=>[...current,emptyLine()])}><Plus size={15}/> Thêm dòng</button>
      <div className="grid gap-4 md:grid-cols-2"><label>Diễn giải<textarea rows={3} {...form.register('note')}/></label><div className="ml-auto w-full max-w-sm space-y-2"><div className="flex justify-between"><span>Tiền hàng</span><b>{formatNumber(gross)} ₫</b></div><div className="flex justify-between"><span>Chiết khấu</span><b>-{formatNumber(gross-subtotal)} ₫</b></div><div className="flex items-center justify-between"><span>Thuế GTGT (%)</span><input className="w-24" type="number" min="0" max="100" {...form.register('taxRate',{valueAsNumber:true})}/></div><div className="flex justify-between border-t pt-2 text-lg text-emerald-700"><b>Tổng thanh toán</b><b>{formatNumber(total)} ₫</b></div></div></div></div><div className="erp-modal-footer"><button type="button" className="erp-btn" onClick={()=>setOpen(false)}>Hủy</button><button disabled={saveMutation.isPending} className="erp-btn erp-btn-primary">{saveMutation.isPending?'Đang lưu...':'Lưu nháp'}</button></div></form></div></div>}
    {selected&&<div className="erp-modal-backdrop"><div className="erp-modal max-w-4xl"><div className="erp-modal-header"><div><h2>{selected.code}</h2><p>{selected.customerName} · {selected.warehouseName}</p></div><button onClick={()=>setSelected(null)}><X/></button></div><div className="erp-modal-body space-y-4"><div className="flex justify-between"><span className={`erp-badge ${statusMeta[selected.status as V1Status].css}`}>{statusMeta[selected.status as V1Status].label}</span><b className="text-xl text-emerald-700">{formatNumber(selected.totalAmount)} ₫</b></div><table className="erp-table"><thead><tr><th>Hàng hóa</th><th>SL</th><th className="text-right">Đơn giá</th><th className="text-right">Thành tiền</th><th className="text-right">Giá vốn</th></tr></thead><tbody>{selected.details.map(line=><tr key={line.id}><td>{line.productName} - {line.packagingName}<small>{line.sku}</small></td><td>{formatNumber(line.quantity)} {line.unit}</td><td className="text-right">{formatNumber(line.unitPrice)}</td><td className="text-right font-semibold">{formatNumber(line.lineTotal||0)}</td><td className="text-right">{formatNumber(line.costAmount||0)}</td></tr>)}</tbody></table><div className="rounded bg-slate-50 p-3"><b>Liên kết nghiệp vụ</b>{selected.links?.length?<div className="mt-2 flex flex-wrap gap-2">{selected.links.map(link=><span className="erp-badge bg-blue-100 text-blue-700" key={link.id}>{link.linkType}: {link.linkedCode||link.linkedId}</span>)}</div>:<p className="mt-1 text-sm text-slate-400">Chưa phát sinh ledger hoặc chứng từ liên kết.</p>}</div>{selected.rejectionReason&&<div className="rounded bg-amber-50 p-3 text-amber-700">Lý do từ chối: {selected.rejectionReason}</div>}{selected.cancelReason&&<div className="rounded bg-red-50 p-3 text-red-700">Lý do hủy: {selected.cancelReason}</div>}</div></div></div>}
  </div>;
}
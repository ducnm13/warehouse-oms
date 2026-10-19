import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Download, Landmark, RefreshCw, Search } from "lucide-react";
import toast from "../components/ui/toast";
import { apiV1 } from "../lib/apiV1";
import { formatDate, formatNumber } from "../lib/utils";
import type { DebtAgingResult, DebtAgingRow } from "../types";
import { DateInput } from "../components/DateRangeCalendar";

type DebtView = "receivable" | "payable";
type AgingBucket = DebtAgingRow["bucket"] | "ALL";

const today = () => new Date().toISOString().slice(0, 10);
const bucketLabel: Record<DebtAgingRow["bucket"], string> = {
  CURRENT: "Chưa quá hạn",
  "1_30": "Quá hạn 1–30 ngày",
  "31_60": "Quá hạn 31–60 ngày",
  "61_90": "Quá hạn 61–90 ngày",
  OVER_90: "Quá hạn trên 90 ngày",
};
const bucketClass: Record<DebtAgingRow["bucket"], string> = {
  CURRENT: "bg-emerald-100 text-emerald-700",
  "1_30": "bg-yellow-100 text-yellow-700",
  "31_60": "bg-orange-100 text-orange-700",
  "61_90": "bg-red-100 text-red-700",
  OVER_90: "bg-rose-200 text-rose-800",
};

const money = (value: number) => `${formatNumber(value)} ₫`;
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function DebtAging() {
  const [view, setView] = useState<DebtView>("receivable");
  const [asOf, setAsOf] = useState(today());
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<AgingBucket>("ALL");
  const endpoint = view === "receivable" ? "receivables" : "payables";
  const query = useQuery({
    queryKey: ["debt-aging-v1", view, asOf, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (asOf) params.set("asOf", asOf);
      if (search.trim()) params.set("search", search.trim());
      return apiV1<DebtAgingResult>(`/api/v1/debt/${endpoint}?${params.toString()}`);
    },
    staleTime: 5 * 60 * 1000,
  });
  const data = query.data?.data;
  const rows = useMemo(() => (data?.rows || []).filter(row => bucket === "ALL" || row.bucket === bucket), [data?.rows, bucket]);

  const exportCsv = () => {
    if (!rows.length) return void toast.error("Không có dữ liệu để xuất");
    const headings = ["Mã chứng từ", "Ngày chứng từ", "Hạn thanh toán", "Mã đối tác", "Tên đối tác", "Giá trị gốc", "Còn nợ", "Số ngày quá hạn", "Nhóm tuổi nợ"];
    const body = rows.map(row => [row.documentCode, row.documentDate, row.dueDate || "", row.partnerCode || "", row.partnerName, row.totalAmount, row.outstanding, row.daysOverdue, bucketLabel[row.bucket]]);
    const csv = `\uFEFF${[headings, ...body].map(line => line.map(csvCell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${view === "receivable" ? "Cong_no_phai_thu" : "Cong_no_phai_tra"}_${asOf}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất báo cáo công nợ");
  };

  const summary = data?.summary;
  const stats = [
    { label: "Tổng còn nợ", value: summary?.total || 0, css: "text-slate-800" },
    { label: "Chưa quá hạn", value: summary?.current || 0, css: "text-emerald-600" },
    { label: "Quá hạn 1–30", value: summary?.days1To30 || 0, css: "text-yellow-600" },
    { label: "Quá hạn 31–60", value: summary?.days31To60 || 0, css: "text-orange-600" },
    { label: "Quá hạn 61–90", value: summary?.days61To90 || 0, css: "text-red-600" },
    { label: "Quá hạn trên 90", value: summary?.over90 || 0, css: "text-rose-700" },
  ];

  return <div className="erp-page">
    <div className="erp-page-header">
      <div><h1>Báo cáo tuổi nợ</h1><p>Theo dõi dư nợ từ immutable receivable/payable ledger tại ngày chốt.</p></div>
      <div className="flex gap-2">
        <button className="erp-btn" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16} className={query.isFetching ? "animate-spin" : ""}/> Làm mới</button>
        <button className="erp-btn erp-btn-primary" onClick={exportCsv}><Download size={16}/> Xuất CSV</button>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <button className={`erp-btn ${view === "receivable" ? "erp-btn-primary" : ""}`} onClick={() => { setView("receivable"); setBucket("ALL"); }}><Landmark size={16}/> Công nợ phải thu</button>
      <button className={`erp-btn ${view === "payable" ? "erp-btn-primary" : ""}`} onClick={() => { setView("payable"); setBucket("ALL"); }}><Landmark size={16}/> Công nợ phải trả</button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {stats.map(stat => <div className="erp-stat" key={stat.label}><div><span>{stat.label}</span><strong className={stat.css}>{money(stat.value)}</strong></div></div>)}
    </div>
    <div className="erp-card overflow-hidden">
      <div className="erp-toolbar flex-wrap">
        <div className="erp-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã chứng từ hoặc đối tác..."/></div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">Ngày chốt<DateInput value={asOf} max={today()} onChange={value => setAsOf(value)}/></label>
        <select value={bucket} onChange={event => setBucket(event.target.value as AgingBucket)}><option value="ALL">Tất cả tuổi nợ</option>{Object.entries(bucketLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </div>
      {query.isLoading ? <div className="p-12 text-center text-slate-500">Đang tải báo cáo công nợ...</div>
        : query.isError ? <div className="flex items-center justify-center gap-2 p-12 text-red-600"><AlertCircle size={20}/>{(query.error as Error).message}</div>
        : !rows.length ? <div className="p-12 text-center text-slate-400">Không có dư nợ phù hợp bộ lọc.</div>
        : <div className="overflow-x-auto"><table className="erp-table">
          <thead><tr><th>Chứng từ / Ngày</th><th>Đối tác</th><th>Hạn thanh toán</th><th className="text-right">Giá trị gốc</th><th className="text-right">Còn nợ</th><th className="text-right">Ngày quá hạn</th><th>Tuổi nợ</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.documentId}><td><b>{row.documentCode}</b><small>{formatDate(row.documentDate)}</small></td><td>{row.partnerName}<small>{row.partnerCode || "-"}</small></td><td>{row.dueDate ? formatDate(row.dueDate) : "-"}</td><td className="text-right">{money(row.totalAmount)}</td><td className="text-right font-bold text-red-600">{money(row.outstanding)}</td><td className="text-right">{formatNumber(row.daysOverdue)}</td><td><span className={`erp-badge ${bucketClass[row.bucket]}`}>{bucketLabel[row.bucket]}</span></td></tr>)}</tbody>
        </table></div>}
    </div>
  </div>;
}
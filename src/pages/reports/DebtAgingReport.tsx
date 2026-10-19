import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark, Search } from "lucide-react";
import { DateInput } from "../../components/DateRangeCalendar";
import { apiV1 } from "../../lib/apiV1";
import { formatDate } from "../../lib/utils";
import type { DebtAgingResult, DebtAgingRow } from "../../types";
import {
	ExportButton,
	FilterBar,
	money,
	qty,
	ReportCard,
	ReportShell,
	StatCard,
	StatGrid,
	TableState,
	useReportExport,
} from "../../components/reports/ReportKit";

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

export default function DebtAgingReport({ kind }: { kind: "receivable" | "payable" }) {
	const [asOf, setAsOf] = useState(today());
	const [search, setSearch] = useState("");
	const [bucket, setBucket] = useState<AgingBucket>("ALL");
	const endpoint = kind === "receivable" ? "receivables" : "payables";
	const query = useQuery({
		queryKey: ["report-debt-aging", kind, asOf, search],
		queryFn: () => {
			const params = new URLSearchParams({ asOf });
			if (search.trim()) params.set("search", search.trim());
			return apiV1<DebtAgingResult>(`/api/v1/debt/${endpoint}?${params.toString()}`);
		},
	});
	const data = query.data?.data;
	const rows = useMemo(() => (data?.rows || []).filter(row => bucket === "ALL" || row.bucket === bucket), [data?.rows, bucket]);
	const summary = data?.summary;
	const title = kind === "receivable" ? "Công nợ phải thu" : "Công nợ phải trả";
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(`Bao_cao_tuoi_no_${kind}_${asOf}.xlsx`, "Tuoi no", [
			{ header: "Chứng từ", value: (r: DebtAgingRow) => r.documentCode, width: 16 },
			{ header: "Ngày", value: r => r.documentDate, width: 14 },
			{ header: "Hạn thanh toán", value: r => r.dueDate || "", width: 16 },
			{ header: "Mã đối tác", value: r => r.partnerCode || "", width: 14 },
			{ header: "Đối tác", value: r => r.partnerName, width: 28 },
			{ header: "Giá trị gốc", value: r => r.totalAmount, width: 16 },
			{ header: "Còn nợ", value: r => r.outstanding, width: 16 },
			{ header: "Ngày quá hạn", value: r => r.daysOverdue, width: 14 },
			{ header: "Tuổi nợ", value: r => bucketLabel[r.bucket], width: 20 },
		], rows);

	return (
		<ReportShell title={`Báo cáo ${title.toLowerCase()}`} description="Dư nợ từ ledger bất biến tại ngày chốt, phân nhóm theo tuổi nợ" actions={<ExportButton onClick={onExport} />}>
			<FilterBar>
				<label>
					Ngày chốt
					<DateInput value={asOf} max={today()} onChange={setAsOf} />
				</label>
				<label>
					Tuổi nợ
					<select value={bucket} onChange={e => setBucket(e.target.value as AgingBucket)}>
						<option value="ALL">Tất cả tuổi nợ</option>
						{Object.entries(bucketLabel).map(([value, label]) => (
							<option key={value} value={value}>{label}</option>
						))}
					</select>
				</label>
				<label className="md:col-span-2">
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã chứng từ hoặc đối tác..." />
					</div>
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard label="Tổng còn nợ" value={money(summary?.total || 0)} icon={Landmark} tone="negative" />
				<StatCard label="Chưa quá hạn" value={money(summary?.current || 0)} tone="positive" />
				<StatCard label="Quá hạn 1–30" value={money(summary?.days1To30 || 0)} tone="warning" />
				<StatCard label="Quá hạn 31–60" value={money(summary?.days31To60 || 0)} tone="warning" />
				<StatCard label="Quá hạn 61–90" value={money(summary?.days61To90 || 0)} tone="negative" />
				<StatCard label="Quá hạn trên 90" value={money(summary?.over90 || 0)} tone="negative" />
				<StatCard label="Số chứng từ" value={qty(rows.length)} />
			</StatGrid>

			<ReportCard title="Chi tiết dư nợ" description={`${rows.length} chứng từ`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Chứng từ / Ngày</th>
								<th>Đối tác</th>
								<th>Hạn thanh toán</th>
								<th className="text-right">Giá trị gốc</th>
								<th className="text-right">Còn nợ</th>
								<th className="text-right">Ngày quá hạn</th>
								<th>Tuổi nợ</th>
							</tr>
						</thead>
						<TableState colSpan={7} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!rows.length}>
							{rows.map(row => (
								<tr key={row.documentId}>
									<td><b>{row.documentCode}</b><small>{formatDate(row.documentDate)}</small></td>
									<td>{row.partnerName}<small>{row.partnerCode || "-"}</small></td>
									<td>{row.dueDate ? formatDate(row.dueDate) : "-"}</td>
									<td className="text-right">{money(row.totalAmount)}</td>
									<td className="text-right font-bold text-red-600">{money(row.outstanding)}</td>
									<td className="text-right">{qty(row.daysOverdue)}</td>
									<td><span className={`erp-badge ${bucketClass[row.bucket]}`}>{bucketLabel[row.bucket]}</span></td>
								</tr>
							))}
						</TableState>
					</table>
				</div>
			</ReportCard>
		</ReportShell>
	);
}

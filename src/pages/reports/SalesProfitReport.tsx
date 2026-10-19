import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { apiV1 } from "../../lib/apiV1";
import { formatDate } from "../../lib/utils";
import type { SalesProfitReportV1 } from "../../types";
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
	useReportRefs,
	WarehouseSelect,
} from "../../components/reports/ReportKit";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

export default function SalesProfitReport() {
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [search, setSearch] = useState("");
	const refs = useReportRefs();
	const params = new URLSearchParams({ from, to });
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	if (search.trim()) params.set("search", search.trim());
	const query = useQuery({
		queryKey: ["report-sales-profit", from, to, warehouseId, search],
		queryFn: () => apiV1<SalesProfitReportV1>(`/api/v1/reports/sales-profit?${params.toString()}`),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(`Bao_cao_doanh_thu_loi_nhuan_${from}_${to}.xlsx`, "Doanh thu", [
			{ header: "Mã đơn", value: (r: SalesProfitReportV1["rows"][number]) => r.code, width: 16 },
			{ header: "Ngày", value: r => r.orderDate, width: 14 },
			{ header: "Khách hàng", value: r => r.customerName, width: 28 },
			{ header: "Kho", value: r => r.warehouseName, width: 20 },
			{ header: "Tiền hàng", value: r => r.grossSales, width: 16 },
			{ header: "Chiết khấu", value: r => r.discountAmount, width: 14 },
			{ header: "Doanh thu thuần", value: r => r.netRevenue, width: 16 },
			{ header: "Thuế", value: r => r.taxAmount, width: 14 },
			{ header: "Giá vốn", value: r => r.cogs, width: 16 },
			{ header: "Lợi nhuận gộp", value: r => r.grossProfit, width: 16 },
			{ header: "Biên LN (%)", value: r => r.grossMarginPercent, width: 12 },
		], rows);

	return (
		<ReportShell
			title="Doanh thu và lợi nhuận"
			description="Báo cáo doanh thu, giá vốn và lợi nhuận gộp theo từng đơn bán đã hoàn thành"
			actions={<ExportButton onClick={onExport} />}
		>
			<FilterBar>
				<div className="md:col-span-2">
					<ReportPeriodFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
				</div>
				<WarehouseSelect value={warehouseId} onChange={setWarehouseId} warehouses={refs.data?.warehouses || []} />
				<label>
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã đơn, khách hàng..." />
					</div>
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard label="Doanh thu thuần" value={money(summary?.netRevenue || 0)} tone="positive" />
				<StatCard label="Tiền hàng (gộp)" value={money(summary?.grossSales || 0)} />
				<StatCard label="Chiết khấu" value={money(summary?.discountAmount || 0)} tone="warning" />
				<StatCard label="Giá vốn hàng bán" value={money(summary?.cogs || 0)} />
				<StatCard label="Lợi nhuận gộp" value={money(summary?.grossProfit || 0)} tone="info" />
				<StatCard label="Thuế" value={money(summary?.taxAmount || 0)} />
				<StatCard label="Số đơn" value={qty(rows.length)} />
				<StatCard label="Biên LN gộp" value={`${summary?.netRevenue ? Math.round(((summary.grossProfit || 0) / summary.netRevenue) * 10000) / 100 : 0}%`} />
			</StatGrid>

			<ReportCard title="Chi tiết theo đơn bán" description={`${rows.length} đơn`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã đơn / Ngày</th>
								<th>Khách hàng</th>
								<th>Kho</th>
								<th className="text-right">Tiền hàng</th>
								<th className="text-right">Chiết khấu</th>
								<th className="text-right">Doanh thu thuần</th>
								<th className="text-right">Giá vốn</th>
								<th className="text-right">Lợi nhuận gộp</th>
								<th className="text-right">Biên LN</th>
							</tr>
						</thead>
						<TableState colSpan={9} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!rows.length}>
							{rows.map(row => (
								<tr key={row.id}>
									<td><b>{row.code}</b><small>{formatDate(row.orderDate)}</small></td>
									<td>{row.customerName}<small>{row.customerCode || "-"}</small></td>
									<td>{row.warehouseName}</td>
									<td className="text-right">{money(row.grossSales)}</td>
									<td className="text-right text-amber-600">{money(row.discountAmount)}</td>
									<td className="text-right font-semibold">{money(row.netRevenue)}</td>
									<td className="text-right">{money(row.cogs)}</td>
									<td className="text-right font-bold text-emerald-600">{money(row.grossProfit)}</td>
									<td className="text-right">{row.grossMarginPercent}%</td>
								</tr>
							))}
						</TableState>
					</table>
				</div>
			</ReportCard>
		</ReportShell>
	);
}

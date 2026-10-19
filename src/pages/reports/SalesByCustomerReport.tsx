import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { apiV1 } from "../../lib/apiV1";
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

interface Row {
	customerId: number;
	customerCode?: string;
	customerName: string;
	groupName?: string;
	orders: number;
	grossSales: number;
	discountAmount: number;
	netRevenue: number;
	taxAmount: number;
	cogs: number;
	grossProfit: number;
	grossMarginPercent: number;
}
interface Result {
	rows: Row[];
	summary: { orders: number; grossSales: number; discountAmount: number; netRevenue: number; taxAmount: number; cogs: number; grossProfit: number };
}

export default function SalesByCustomerReport() {
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [search, setSearch] = useState("");
	const refs = useReportRefs();
	const params = new URLSearchParams({ from, to });
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	if (search.trim()) params.set("search", search.trim());
	const query = useQuery({
		queryKey: ["report-sales-customer", from, to, warehouseId, search],
		queryFn: () => apiV1<Result>(`/api/v1/reports/sales-by-customer?${params.toString()}`),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(`Bao_cao_ban_hang_theo_khach_${from}_${to}.xlsx`, "Theo KH", [
			{ header: "Mã KH", value: (r: Row) => r.customerCode || "", width: 14 },
			{ header: "Khách hàng", value: r => r.customerName, width: 30 },
			{ header: "Nhóm", value: r => r.groupName || "", width: 18 },
			{ header: "Số đơn", value: r => r.orders, width: 10 },
			{ header: "Tiền hàng", value: r => r.grossSales, width: 16 },
			{ header: "Chiết khấu", value: r => r.discountAmount, width: 14 },
			{ header: "Doanh thu thuần", value: r => r.netRevenue, width: 16 },
			{ header: "Giá vốn", value: r => r.cogs, width: 16 },
			{ header: "Lợi nhuận gộp", value: r => r.grossProfit, width: 16 },
			{ header: "Biên LN (%)", value: r => r.grossMarginPercent, width: 12 },
		], rows);

	return (
		<ReportShell title="Bán hàng theo khách hàng" description="Doanh thu và lợi nhuận gộp theo khách hàng / nhóm khách hàng" actions={<ExportButton onClick={onExport} />}>
			<FilterBar>
				<div className="md:col-span-2">
					<ReportPeriodFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
				</div>
				<WarehouseSelect value={warehouseId} onChange={setWarehouseId} warehouses={refs.data?.warehouses || []} />
				<label>
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Khách hàng..." />
					</div>
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard label="Doanh thu thuần" value={money(summary?.netRevenue || 0)} tone="positive" />
				<StatCard label="Lợi nhuận gộp" value={money(summary?.grossProfit || 0)} tone="info" />
				<StatCard label="Tổng số đơn" value={qty(summary?.orders || 0)} />
				<StatCard label="Số khách hàng" value={qty(rows.length)} />
			</StatGrid>

			<ReportCard title="Chi tiết theo khách hàng" description={`${rows.length} khách hàng`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã KH</th>
								<th>Khách hàng</th>
								<th>Nhóm</th>
								<th className="text-right">Số đơn</th>
								<th className="text-right">Tiền hàng</th>
								<th className="text-right">Doanh thu thuần</th>
								<th className="text-right">Giá vốn</th>
								<th className="text-right">Lợi nhuận gộp</th>
								<th className="text-right">Biên LN</th>
							</tr>
						</thead>
						<TableState colSpan={9} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!rows.length}>
							{rows.map(row => (
								<tr key={row.customerId}>
									<td><b>{row.customerCode || "-"}</b></td>
									<td>{row.customerName}</td>
									<td>{row.groupName || "-"}</td>
									<td className="text-right">{qty(row.orders)}</td>
									<td className="text-right">{money(row.grossSales)}</td>
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

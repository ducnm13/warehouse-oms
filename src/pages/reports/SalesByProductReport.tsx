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
	packagingId: number;
	sku?: string;
	packagingName: string;
	unit?: string;
	productName: string;
	quantity: number;
	grossSales: number;
	discountAmount: number;
	netRevenue: number;
	cogs: number;
	grossProfit: number;
	grossMarginPercent: number;
}
interface Result {
	rows: Row[];
	summary: { quantity: number; grossSales: number; discountAmount: number; netRevenue: number; cogs: number; grossProfit: number };
}

export default function SalesByProductReport() {
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [search, setSearch] = useState("");
	const refs = useReportRefs();
	const params = new URLSearchParams({ from, to });
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	if (search.trim()) params.set("search", search.trim());
	const query = useQuery({
		queryKey: ["report-sales-product", from, to, warehouseId, search],
		queryFn: () => apiV1<Result>(`/api/v1/reports/sales-by-product?${params.toString()}`),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(`Bao_cao_ban_hang_theo_san_pham_${from}_${to}.xlsx`, "Theo SP", [
			{ header: "SKU", value: (r: Row) => r.sku || "", width: 16 },
			{ header: "Sản phẩm", value: r => r.productName, width: 30 },
			{ header: "Quy cách", value: r => r.packagingName, width: 24 },
			{ header: "ĐVT", value: r => r.unit || "", width: 10 },
			{ header: "Số lượng", value: r => r.quantity, width: 14 },
			{ header: "Doanh thu thuần", value: r => r.netRevenue, width: 16 },
			{ header: "Giá vốn", value: r => r.cogs, width: 16 },
			{ header: "Lợi nhuận gộp", value: r => r.grossProfit, width: 16 },
			{ header: "Biên LN (%)", value: r => r.grossMarginPercent, width: 12 },
		], rows);

	return (
		<ReportShell title="Bán hàng theo sản phẩm" description="Sản lượng, doanh thu và lợi nhuận gộp theo mặt hàng – quy cách" actions={<ExportButton onClick={onExport} />}>
			<FilterBar>
				<div className="md:col-span-2">
					<ReportPeriodFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
				</div>
				<WarehouseSelect value={warehouseId} onChange={setWarehouseId} warehouses={refs.data?.warehouses || []} />
				<label>
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tên / SKU sản phẩm..." />
					</div>
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard label="Doanh thu thuần" value={money(summary?.netRevenue || 0)} tone="positive" />
				<StatCard label="Lợi nhuận gộp" value={money(summary?.grossProfit || 0)} tone="info" />
				<StatCard label="Tổng sản lượng" value={qty(summary?.quantity || 0)} />
				<StatCard label="Số mặt hàng" value={qty(rows.length)} />
			</StatGrid>

			<ReportCard title="Chi tiết theo sản phẩm" description={`${rows.length} mặt hàng`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Sản phẩm / Quy cách</th>
								<th>SKU</th>
								<th className="text-right">Số lượng</th>
								<th className="text-right">Tiền hàng</th>
								<th className="text-right">Doanh thu thuần</th>
								<th className="text-right">Giá vốn</th>
								<th className="text-right">Lợi nhuận gộp</th>
								<th className="text-right">Biên LN</th>
							</tr>
						</thead>
						<TableState colSpan={8} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!rows.length}>
							{rows.map(row => (
								<tr key={row.packagingId}>
									<td><b>{row.productName}</b><small>{row.packagingName}</small></td>
									<td>{row.sku || "-"}</td>
									<td className="text-right">{qty(row.quantity)} {row.unit || ""}</td>
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

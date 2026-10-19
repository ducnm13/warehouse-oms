import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { apiV1 } from "../../lib/apiV1";
import {
	ExportButton,
	FilterBar,
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
	orders: number;
	plannedPacks: number;
	actualPacks: number;
	powderKg: number;
}
interface Result {
	rows: Row[];
	summary: { plannedPacks: number; actualPacks: number; powderKg: number };
}

export default function ProductionOverviewReport() {
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [search, setSearch] = useState("");
	const refs = useReportRefs();
	const params = new URLSearchParams({ from, to });
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	if (search.trim()) params.set("search", search.trim());
	const query = useQuery({
		queryKey: ["report-production-overview", from, to, warehouseId, search],
		queryFn: () => apiV1<Result>(`/api/v1/reports/production-overview?${params.toString()}`),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(`Bao_cao_tong_quan_san_xuat_${from}_${to}.xlsx`, "Tong quan SX", [
			{ header: "Sản phẩm", value: (r: Row) => r.productName, width: 30 },
			{ header: "Quy cách", value: r => r.packagingName, width: 24 },
			{ header: "SKU", value: r => r.sku || "", width: 16 },
			{ header: "Số lệnh", value: r => r.orders, width: 10 },
			{ header: "Kế hoạch (gói)", value: r => r.plannedPacks, width: 16 },
			{ header: "Thực tế (gói)", value: r => r.actualPacks, width: 16 },
			{ header: "Bột (kg)", value: r => r.powderKg, width: 12 },
		], rows);

	return (
		<ReportShell title="Tổng quan sản xuất" description="Sản lượng kế hoạch và thực tế theo mặt hàng trong các lệnh đã hoàn thành" actions={<ExportButton onClick={onExport} />}>
			<FilterBar>
				<div className="md:col-span-2">
					<ReportPeriodFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
				</div>
				<WarehouseSelect value={warehouseId} onChange={setWarehouseId} warehouses={refs.data?.warehouses || []} placeholder="Tất cả kho SX" />
				<label>
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sản phẩm, mã lệnh..." />
					</div>
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard label="Kế hoạch (gói)" value={qty(summary?.plannedPacks || 0)} />
				<StatCard label="Thực tế (gói)" value={qty(summary?.actualPacks || 0)} tone="info" />
				<StatCard label="Tỷ lệ hoàn thành" value={`${summary?.plannedPacks ? Math.round((summary.actualPacks / summary.plannedPacks) * 10000) / 100 : 0}%`} tone="positive" />
				<StatCard label="Bột sử dụng" value={`${qty(summary?.powderKg || 0)} kg`} />
			</StatGrid>

			<ReportCard title="Sản lượng theo mặt hàng" description={`${rows.length} mặt hàng`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Sản phẩm / Quy cách</th>
								<th className="text-right">Số lệnh</th>
								<th className="text-right">Kế hoạch (gói)</th>
								<th className="text-right">Thực tế (gói)</th>
								<th className="text-right">Chênh lệch</th>
								<th className="text-right">Bột (kg)</th>
							</tr>
						</thead>
						<TableState colSpan={6} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!rows.length}>
							{rows.map(row => {
								const diff = row.actualPacks - row.plannedPacks;
								return (
									<tr key={row.packagingId}>
										<td><b>{row.productName}</b><small>{row.packagingName}</small></td>
										<td className="text-right">{qty(row.orders)}</td>
										<td className="text-right">{qty(row.plannedPacks)}</td>
										<td className="text-right font-semibold">{qty(row.actualPacks)}</td>
										<td className={`text-right ${diff >= 0 ? "text-emerald-600" : "text-red-600"}`}>{diff > 0 ? "+" : ""}{qty(diff)}</td>
										<td className="text-right">{qty(row.powderKg)}</td>
									</tr>
								);
							})}
						</TableState>
					</table>
				</div>
			</ReportCard>
		</ReportShell>
	);
}

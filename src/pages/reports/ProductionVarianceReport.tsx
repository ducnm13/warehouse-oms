import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { apiV1 } from "../../lib/apiV1";
import { formatDate } from "../../lib/utils";
import type { ProductionVarianceReportV1 } from "../../types";
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

export default function ProductionVarianceReport() {
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [search, setSearch] = useState("");
	const refs = useReportRefs();
	const params = new URLSearchParams({ from, to });
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	if (search.trim()) params.set("search", search.trim());
	const query = useQuery({
		queryKey: ["report-production-variance", from, to, warehouseId, search],
		queryFn: () => apiV1<ProductionVarianceReportV1>(`/api/v1/reports/production-variance?${params.toString()}`),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(`Bao_cao_dinh_muc_thuc_te_${from}_${to}.xlsx`, "Dinh muc", [
			{ header: "Mã lệnh", value: (r: ProductionVarianceReportV1["rows"][number]) => r.code, width: 16 },
			{ header: "Sản phẩm", value: r => r.productName, width: 26 },
			{ header: "Nguyên liệu", value: r => r.materialName, width: 26 },
			{ header: "Quy cách", value: r => r.packagingName, width: 22 },
			{ header: "ĐVT", value: r => r.unit || "", width: 10 },
			{ header: "Định mức (SL)", value: r => r.plannedMaterialQuantity, width: 14 },
			{ header: "Thực tế (SL)", value: r => r.actualMaterialQuantity, width: 14 },
			{ header: "Chênh lệch (SL)", value: r => r.materialQuantityVariance, width: 14 },
			{ header: "Chênh lệch (%)", value: r => r.materialVariancePercent, width: 12 },
			{ header: "Chênh lệch (giá trị)", value: r => r.materialValueVariance, width: 18 },
		], rows);

	return (
		<ReportShell title="Định mức vs thực tế" description="So sánh tiêu hao nguyên liệu định mức và thực tế theo từng lệnh sản xuất" actions={<ExportButton onClick={onExport} />}>
			<FilterBar>
				<div className="md:col-span-2">
					<ReportPeriodFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
				</div>
				<WarehouseSelect value={warehouseId} onChange={setWarehouseId} warehouses={refs.data?.warehouses || []} placeholder="Tất cả kho SX" />
				<label>
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã lệnh, sản phẩm, nguyên liệu..." />
					</div>
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard label="Sản lượng kế hoạch" value={qty(summary?.plannedOutput || 0)} />
				<StatCard label="Sản lượng thực tế" value={qty(summary?.actualOutput || 0)} tone="info" />
				<StatCard label="Vượt định mức" value={qty(summary?.overConsumedLines || 0)} tone="negative" hint="Số dòng tiêu hao vượt" />
				<StatCard label="Tiết kiệm định mức" value={qty(summary?.underConsumedLines || 0)} tone="positive" hint="Số dòng tiêu hao dưới" />
			</StatGrid>

			<ReportCard title="Chênh lệch định mức nguyên liệu" description={`${rows.length} dòng nguyên liệu`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã lệnh / Sản phẩm</th>
								<th>Nguyên liệu</th>
								<th className="text-right">Định mức</th>
								<th className="text-right">Thực tế</th>
								<th className="text-right">Chênh lệch</th>
								<th className="text-right">Chênh lệch giá trị</th>
							</tr>
						</thead>
						<TableState colSpan={6} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!rows.length}>
							{rows.map(row => (
								<tr key={`${row.orderId}-${row.materialId}`}>
									<td><b>{row.code}</b><small>{row.productName} · {formatDate(row.completedAt)}</small></td>
									<td>{row.materialName}<small>{row.packagingName}</small></td>
									<td className="text-right">{qty(row.plannedMaterialQuantity)} {row.unit || ""}</td>
									<td className="text-right">{qty(row.actualMaterialQuantity)}</td>
									<td className={`text-right font-semibold ${row.materialQuantityVariance > 0.00005 ? "text-red-600" : row.materialQuantityVariance < -0.00005 ? "text-emerald-600" : ""}`}>
										{row.materialQuantityVariance > 0 ? "+" : ""}{qty(row.materialQuantityVariance)}
										<small>{row.materialVariancePercent}%</small>
									</td>
									<td className={`text-right ${row.materialValueVariance > 0 ? "text-red-600" : "text-emerald-600"}`}>{money(row.materialValueVariance)}</td>
								</tr>
							))}
						</TableState>
					</table>
				</div>
			</ReportCard>
		</ReportShell>
	);
}

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { apiV1 } from "../../lib/apiV1";
import type { PurchaseByProductReportV1 } from "../../types";
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

export default function PurchasesByProductReport() {
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [search, setSearch] = useState("");
	const refs = useReportRefs();
	const params = new URLSearchParams({ from, to });
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	if (search.trim()) params.set("search", search.trim());
	const query = useQuery({
		queryKey: ["report-purchases-product", from, to, warehouseId, search],
		queryFn: () => apiV1<PurchaseByProductReportV1>(`/api/v1/reports/purchases-by-product?${params.toString()}`),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(`Bao_cao_mua_hang_theo_mat_hang_${from}_${to}.xlsx`, "Theo mat hang", [
			{ header: "SKU", value: (r: PurchaseByProductReportV1["rows"][number]) => r.sku || "", width: 16 },
			{ header: "Sản phẩm", value: r => r.productName, width: 30 },
			{ header: "Quy cách", value: r => r.packagingName, width: 24 },
			{ header: "ĐVT", value: r => r.unit || "", width: 10 },
			{ header: "Số lượng", value: r => r.quantity, width: 14 },
			{ header: "Giá nhập TB", value: r => r.avgUnitPrice, width: 16 },
			{ header: "Tiền hàng", value: r => r.goodsAmount, width: 16 },
			{ header: "Tổng tiền", value: r => r.totalAmount, width: 16 },
		], rows);

	return (
		<ReportShell title="Mua hàng theo mặt hàng" description="Sản lượng và giá nhập bình quân theo mặt hàng – quy cách" actions={<ExportButton onClick={onExport} />}>
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
				<StatCard label="Tổng mua hàng" value={money(summary?.totalAmount || 0)} tone="info" />
				<StatCard label="Tiền hàng" value={money(summary?.goodsAmount || 0)} />
				<StatCard label="Tổng sản lượng" value={qty(summary?.quantity || 0)} />
				<StatCard label="Số mặt hàng" value={qty(rows.length)} />
			</StatGrid>

			<ReportCard title="Chi tiết theo mặt hàng" description={`${rows.length} mặt hàng`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Sản phẩm / Quy cách</th>
								<th>SKU</th>
								<th className="text-right">Số lượng</th>
								<th className="text-right">Giá nhập TB</th>
								<th className="text-right">Tiền hàng</th>
								<th className="text-right">Thuế</th>
								<th className="text-right">Tổng tiền</th>
							</tr>
						</thead>
						<TableState colSpan={7} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!rows.length}>
							{rows.map(row => (
								<tr key={row.packagingId}>
									<td><b>{row.productName}</b><small>{row.packagingName}</small></td>
									<td>{row.sku || "-"}</td>
									<td className="text-right">{qty(row.quantity)} {row.unit || ""}</td>
									<td className="text-right">{money(row.avgUnitPrice)}</td>
									<td className="text-right">{money(row.goodsAmount)}</td>
									<td className="text-right">{money(row.taxAmount)}</td>
									<td className="text-right font-semibold">{money(row.totalAmount)}</td>
								</tr>
							))}
						</TableState>
					</table>
				</div>
			</ReportCard>
		</ReportShell>
	);
}

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PackageX, Search } from "lucide-react";
import { apiV1 } from "../../lib/apiV1";
import type { StockOnHandReportV1 } from "../../types";
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

export default function StockOnHandReport() {
	const [warehouseId, setWarehouseId] = useState(0);
	const [category, setCategory] = useState("");
	const [search, setSearch] = useState("");
	const [onlyLowStock, setOnlyLowStock] = useState(false);
	const refs = useReportRefs();
	const params = new URLSearchParams();
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	if (category) params.set("category", category);
	if (search.trim()) params.set("search", search.trim());
	if (onlyLowStock) params.set("onlyLowStock", "true");
	const query = useQuery({
		queryKey: ["report-stock-on-hand", warehouseId, category, search, onlyLowStock],
		queryFn: () => apiV1<StockOnHandReportV1>(`/api/v1/reports/stock-on-hand?${params.toString()}`),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(`Bao_cao_gia_tri_ton_kho.xlsx`, "Ton kho hien tai", [
			{ header: "Sản phẩm", value: (r: StockOnHandReportV1["rows"][number]) => r.productName, width: 30 },
			{ header: "Quy cách", value: r => r.packagingName, width: 24 },
			{ header: "SKU", value: r => r.sku || "", width: 16 },
			{ header: "ĐVT", value: r => r.unit || "", width: 10 },
			{ header: "Tồn hiện tại", value: r => r.stockQuantity, width: 14 },
			{ header: "Tồn tối thiểu", value: r => r.minStock, width: 14 },
			{ header: "Đơn giá nhập", value: r => r.unitCost, width: 16 },
			{ header: "Giá trị tồn", value: r => r.stockValue, width: 18 },
			{ header: "Cảnh báo", value: r => (r.stockQuantity <= 0 ? "Hết hàng" : r.lowStock ? "Sắp hết" : ""), width: 14 },
		], rows);

	return (
		<ReportShell title="Giá trị tồn kho & cảnh báo tồn thấp" description="Tồn hiện tại, đơn giá nhập gần nhất và giá trị tồn kho theo mặt hàng" actions={<ExportButton onClick={onExport} />}>
			<FilterBar>
				<WarehouseSelect value={warehouseId} onChange={setWarehouseId} warehouses={refs.data?.warehouses || []} />
				<label>
					Loại
					<select value={category} onChange={e => setCategory(e.target.value)}>
						<option value="">Tất cả loại</option>
						<option value="PRODUCT">Thành phẩm</option>
						<option value="MATERIAL">Nguyên liệu</option>
						<option value="PACKAGING">Bao bì</option>
					</select>
				</label>
				<label>
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tên / SKU hàng hóa..." />
					</div>
				</label>
				<label className="flex items-center gap-2 self-end pb-1.5">
					<input type="checkbox" checked={onlyLowStock} onChange={e => setOnlyLowStock(e.target.checked)} />
					Chỉ hiện hàng sắp hết
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard label="Giá trị tồn kho" value={money(summary?.stockValue || 0)} tone="info" />
				<StatCard label="Số mặt hàng" value={qty(summary?.items || 0)} />
				<StatCard label="Sắp hết hàng" value={qty(summary?.lowStock || 0)} icon={PackageX} tone="warning" />
				<StatCard label="Hết hàng" value={qty(summary?.outOfStock || 0)} icon={PackageX} tone="negative" />
			</StatGrid>

			<ReportCard title="Tồn kho hiện tại" description={`${rows.length} mặt hàng`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Sản phẩm / Quy cách</th>
								<th>SKU</th>
								<th className="text-right">Tồn hiện tại</th>
								<th className="text-right">Tồn tối thiểu</th>
								<th className="text-right">Đơn giá nhập</th>
								<th className="text-right">Giá trị tồn</th>
								<th>Trạng thái</th>
							</tr>
						</thead>
						<TableState colSpan={7} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!rows.length}>
							{rows.map(row => (
								<tr key={row.packagingId}>
									<td><b>{row.productName}</b><small>{row.packagingName}</small></td>
									<td>{row.sku || "-"}</td>
									<td className="text-right font-semibold">{qty(row.stockQuantity)} {row.unit || ""}</td>
									<td className="text-right text-slate-500">{qty(row.minStock)}</td>
									<td className="text-right">{money(row.unitCost)}</td>
									<td className="text-right">{money(row.stockValue)}</td>
									<td>
										{row.stockQuantity <= 0 ? (
											<span className="erp-badge erp-badge-danger">Hết hàng</span>
										) : row.lowStock ? (
											<span className="erp-badge erp-badge-warning">Sắp hết</span>
										) : (
											<span className="erp-badge erp-badge-success">Đủ hàng</span>
										)}
									</td>
								</tr>
							))}
						</TableState>
					</table>
				</div>
			</ReportCard>
		</ReportShell>
	);
}

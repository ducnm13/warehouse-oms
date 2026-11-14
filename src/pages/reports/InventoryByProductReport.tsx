import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { apiV1 } from "../../lib/apiV1";
import type { InventoryByProductReportV1 } from "../../types";
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

type Row = InventoryByProductReportV1["rows"][number];

export default function InventoryByProductReport() {
	const navigate = useNavigate();
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [search, setSearch] = useState("");
	const refs = useReportRefs();
	const params = new URLSearchParams({ from, to });
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	if (search.trim()) params.set("search", search.trim());
	const query = useQuery({
		queryKey: ["report-inventory-by-product", from, to, warehouseId, search],
		queryFn: () =>
			apiV1<InventoryByProductReportV1>(
				`/api/v1/reports/inventory-by-product?${params.toString()}`,
			),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(
			`Bao_cao_nhap_xuat_theo_ma_san_pham_${from}_${to}.xlsx`,
			"Nhap xuat theo SP",
			[
				{ header: "Mã sản phẩm", value: (r: Row) => r.sku || r.productSku || "", width: 18 },
				{ header: "Sản phẩm", value: (r: Row) => r.productName, width: 30 },
				{ header: "Quy cách", value: (r: Row) => r.packagingName, width: 24 },
				{ header: "ĐVT", value: (r: Row) => r.unit || "", width: 10 },
				{ header: "Nhập kho", value: (r: Row) => r.inboundQuantity, width: 14 },
				{ header: "Nhập từ lắp ráp", value: (r: Row) => r.inboundAssemblyQuantity, width: 18 },
				{ header: "Xuất kho", value: (r: Row) => r.outboundQuantity, width: 14 },
				{ header: "Xuất cho lắp ráp", value: (r: Row) => r.outboundAssemblyQuantity, width: 18 },
				{ header: "Xuất bán hàng", value: (r: Row) => r.outboundSaleQuantity, width: 16 },
				{ header: "Tồn cuối", value: (r: Row) => r.closingQuantity, width: 14 },
			],
			rows,
		);

	return (
		<ReportShell
			title="Nhập xuất theo mã sản phẩm"
			description="Nhập kho, nhập từ lắp ráp, xuất kho, xuất cho lắp ráp, xuất bán hàng và tồn cuối"
			actions={<ExportButton onClick={onExport} />}
		>
			<FilterBar>
				<div className="md:col-span-2">
					<ReportPeriodFilter
						from={from}
						to={to}
						onChange={(f, t) => {
							setFrom(f);
							setTo(t);
						}}
					/>
				</div>
				<WarehouseSelect
					value={warehouseId}
					onChange={setWarehouseId}
					warehouses={refs.data?.warehouses || []}
				/>
				<label>
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input
							value={search}
							onChange={e => setSearch(e.target.value)}
							placeholder="Tên / mã sản phẩm..."
						/>
					</div>
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard
					label="Tổng nhập kho"
					value={qty(summary?.inboundQuantity || 0)}
					hint={`${qty(summary?.items || 0)} mã hàng`}
					tone="positive"
				/>
				<StatCard
					label="Nhập từ lắp ráp"
					value={qty(summary?.inboundAssemblyQuantity || 0)}
					tone="info"
				/>
				<StatCard
					label="Tổng xuất kho"
					value={qty(summary?.outboundQuantity || 0)}
					tone="negative"
				/>
				<StatCard
					label="Xuất cho lắp ráp"
					value={qty(summary?.outboundAssemblyQuantity || 0)}
					tone="warning"
				/>
				<StatCard
					label="Xuất bán hàng"
					value={qty(summary?.outboundSaleQuantity || 0)}
					tone="negative"
				/>
				<StatCard
					label="Tồn cuối"
					value={qty(summary?.closingQuantity || 0)}
					tone="info"
				/>
			</StatGrid>

			<ReportCard
				title="Chi tiết theo mã sản phẩm"
				description={`${rows.length} mã hàng${warehouseId ? "" : " · tổng hợp tất cả kho"}`}
			>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã sản phẩm</th>
								<th>Sản phẩm / Quy cách</th>
								<th>ĐVT</th>
								<th className="text-right">Nhập kho</th>
								<th className="text-right">Nhập từ lắp ráp</th>
								<th className="text-right">Xuất kho</th>
								<th className="text-right">Xuất cho lắp ráp</th>
								<th className="text-right">Xuất bán hàng</th>
								<th className="text-right">Tồn cuối</th>
							</tr>
						</thead>
						<TableState
							colSpan={9}
							loading={query.isLoading}
							error={query.isError ? (query.error as Error).message : null}
							empty={!rows.length}
						>
							{rows.map(row => (
								<tr key={row.packagingId}>
									<td>
										<button
											type="button"
											className="font-bold text-[#422afb] hover:underline"
											title="Mở sổ chi tiết vật tư"
											onClick={() =>
												navigate(
													`/reports/item-ledger?${new URLSearchParams({
														packagingId: String(row.packagingId),
														from,
														to,
													}).toString()}`,
												)
											}
										>
											{row.sku || row.productSku || "-"}
										</button>
									</td>
									<td>
										<b>{row.productName}</b>
										<small>{row.packagingName}</small>
									</td>
									<td>{row.unit || "-"}</td>
									<td className="text-right text-emerald-600">
										{qty(row.inboundQuantity)}
									</td>
									<td className="text-right text-blue-600">
										{qty(row.inboundAssemblyQuantity)}
									</td>
									<td className="text-right text-red-600">
										{qty(row.outboundQuantity)}
									</td>
									<td className="text-right text-amber-600">
										{qty(row.outboundAssemblyQuantity)}
									</td>
									<td className="text-right text-red-600">
										{qty(row.outboundSaleQuantity)}
									</td>
									<td className="text-right font-bold">
										{qty(row.closingQuantity)}
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

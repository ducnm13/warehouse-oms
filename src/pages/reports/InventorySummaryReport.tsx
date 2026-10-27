import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { apiV1 } from "../../lib/apiV1";
import type { InventorySummaryReportV1 } from "../../types";
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

export default function InventorySummaryReport() {
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [category, setCategory] = useState("");
	const [search, setSearch] = useState("");
	const refs = useReportRefs();
	const params = new URLSearchParams({ from, to });
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	if (category) params.set("category", category);
	if (search.trim()) params.set("search", search.trim());
	const query = useQuery({
		queryKey: [
			"report-inventory-summary",
			from,
			to,
			warehouseId,
			category,
			search,
		],
		queryFn: () =>
			apiV1<InventorySummaryReportV1>(
				`/api/v1/reports/inventory-summary?${params.toString()}`,
			),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(
			`Bao_cao_tong_hop_ton_kho_${from}_${to}.xlsx`,
			"Ton kho",
			[
				{
					header: "Sản phẩm",
					value: (r: InventorySummaryReportV1["rows"][number]) => r.productName,
					width: 30,
				},
				{ header: "Quy cách", value: r => r.packagingName, width: 24 },
				{ header: "SKU", value: r => r.sku || "", width: 16 },
				{ header: "Kho", value: r => r.warehouseName, width: 20 },
				{ header: "ĐVT", value: r => r.unit || "", width: 10 },
				{ header: "Tồn đầu (SL)", value: r => r.openingQuantity, width: 14 },
				{ header: "Nhập (SL)", value: r => r.inboundQuantity, width: 14 },
				{ header: "Xuất (SL)", value: r => r.outboundQuantity, width: 14 },
				{ header: "Tồn cuối (SL)", value: r => r.closingQuantity, width: 14 },
				{ header: "Giá trị tồn cuối", value: r => r.closingValue, width: 18 },
			],
			rows,
		);

	return (
		<ReportShell
			title="Tổng hợp tồn kho"
			description="Tồn đầu – nhập – xuất – tồn cuối theo mặt hàng và kho trong kỳ"
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
				{/* <label>
					Loại
					<select value={category} onChange={e => setCategory(e.target.value)}>
						<option value="">Tất cả loại</option>
						<option value="PRODUCT">Thành phẩm</option>
						<option value="MATERIAL">Nguyên liệu</option>
						<option value="PACKAGING">Bao bì</option>
					</select>
				</label> */}
				<label>
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input
							value={search}
							onChange={e => setSearch(e.target.value)}
							placeholder="Tên / SKU hàng hóa..."
						/>
					</div>
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard
					label="Tồn đầu kỳ"
					value={money(summary?.openingValue || 0)}
					hint={`${qty(summary?.openingQuantity || 0)} SL`}
				/>
				<StatCard
					label="Nhập trong kỳ"
					value={money(summary?.inboundValue || 0)}
					hint={`${qty(summary?.inboundQuantity || 0)} SL`}
					tone="positive"
				/>
				<StatCard
					label="Xuất trong kỳ"
					value={money(summary?.outboundValue || 0)}
					hint={`${qty(summary?.outboundQuantity || 0)} SL`}
					tone="negative"
				/>
				<StatCard
					label="Tồn cuối kỳ"
					value={money(summary?.closingValue || 0)}
					hint={`${qty(summary?.closingQuantity || 0)} SL`}
					tone="info"
				/>
			</StatGrid>

			{data && !data.valueCoverageComplete ? (
				<p className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-700">
					Một số mặt hàng chưa có tồn đầu kỳ (baseline) nên giá trị tồn có thể
					chưa đầy đủ.
				</p>
			) : null}

			<ReportCard title="Chi tiết tồn kho" description={`${rows.length} dòng`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Sản phẩm / Quy cách</th>
								<th>Kho</th>
								<th className="text-right">Tồn đầu</th>
								<th className="text-right">Nhập</th>
								<th className="text-right">Xuất</th>
								<th className="text-right">Tồn cuối</th>
								<th className="text-right">Giá trị tồn cuối</th>
							</tr>
						</thead>
						<TableState
							colSpan={7}
							loading={query.isLoading}
							error={query.isError ? (query.error as Error).message : null}
							empty={!rows.length}
						>
							{rows.map(row => (
								<tr key={`${row.packagingId}-${row.warehouseId}`}>
									<td>
										<b>{row.productName}</b>
										<small>
											{row.packagingName} · {row.sku || "-"}
										</small>
									</td>
									<td>{row.warehouseName}</td>
									<td className="text-right">{qty(row.openingQuantity)}</td>
									<td className="text-right text-emerald-600">
										{qty(row.inboundQuantity)}
									</td>
									<td className="text-right text-red-600">
										{qty(row.outboundQuantity)}
									</td>
									<td className="text-right font-bold">
										{qty(row.closingQuantity)} {row.unit || ""}
									</td>
									<td className="text-right">{money(row.closingValue)}</td>
								</tr>
							))}
						</TableState>
					</table>
				</div>
			</ReportCard>
		</ReportShell>
	);
}

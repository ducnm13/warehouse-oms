import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PackageMinus, Search } from "lucide-react";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { apiV1 } from "../../lib/apiV1";
import { formatDate } from "../../lib/utils";
import type { AssemblyIssueReportV1 } from "../../types";
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

export default function AssemblyIssueReport() {
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [search, setSearch] = useState("");
	const refs = useReportRefs();
	const params = new URLSearchParams({ from, to });
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	if (search.trim()) params.set("search", search.trim());
	const query = useQuery({
		queryKey: ["report-assembly-issues", from, to, warehouseId, search],
		queryFn: () =>
			apiV1<AssemblyIssueReportV1>(
				`/api/v1/reports/assembly-issues?${params.toString()}`,
			),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(
			`Bao_cao_xuat_kho_lap_rap_${from}_${to}.xlsx`,
			"Xuat kho lap rap",
			[
				{ header: "Mã BOM", value: (r: AssemblyIssueReportV1["rows"][number]) => r.bomCode, width: 18 },
				{ header: "Phiên bản BOM", value: r => r.bomVersion, width: 12 },
				{ header: "Thành phẩm", value: r => r.outputProductName || "", width: 28 },
				{ header: "Quy cách thành phẩm", value: r => r.outputPackagingName, width: 28 },
				{ header: "Mã linh kiện", value: r => r.componentSku || "", width: 16 },
				{ header: "Linh kiện", value: r => r.componentProductName, width: 28 },
				{ header: "Quy cách linh kiện", value: r => r.componentPackagingName, width: 28 },
				{ header: "ĐVT", value: r => r.unit || "", width: 10 },
				{ header: "Kho xuất", value: r => r.warehouseName, width: 20 },
				{ header: "Số lệnh", value: r => r.orders, width: 10 },
				{ header: "Định mức", value: r => r.plannedQuantity, width: 14 },
				{ header: "SL xuất kho", value: r => r.issuedQuantity, width: 14 },
				{ header: "Đơn giá BQ", value: r => r.avgUnitCost, width: 14 },
				{ header: "Giá trị xuất", value: r => r.totalValue, width: 16 },
				{ header: "Phiếu xuất", value: r => r.documentCodes, width: 30 },
				{ header: "Lần xuất cuối", value: r => r.lastIssuedAt, width: 16 },
			],
			rows,
		);

	return (
		<ReportShell
			title="Xuất kho để lắp ráp"
			description="Tổng hợp số lượng linh kiện đã xuất kho theo BOM để phục vụ lắp ráp"
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
					placeholder="Tất cả kho xuất"
				/>
				<label>
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input
							value={search}
							onChange={e => setSearch(e.target.value)}
							placeholder="Mã BOM, lệnh, thành phẩm, linh kiện..."
						/>
					</div>
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard
					label="Lệnh lắp ráp"
					value={qty(summary?.orders || 0)}
					icon={PackageMinus}
				/>
				<StatCard
					label="Mã linh kiện"
					value={qty(summary?.components || 0)}
					tone="info"
				/>
				<StatCard
					label="Phiếu xuất"
					value={qty(summary?.documents || 0)}
					tone="warning"
				/>
				<StatCard
					label="Tổng giá trị xuất"
					value={money(summary?.totalValue || 0)}
					tone="positive"
				/>
			</StatGrid>

			<ReportCard
				title="Số lượng xuất kho theo BOM"
				description={`${rows.length} dòng linh kiện`}
			>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>BOM / Thành phẩm</th>
								<th>Linh kiện xuất kho</th>
								<th>Kho xuất</th>
								<th className="text-right">Số lệnh</th>
								<th className="text-right">Định mức</th>
								<th className="text-right">SL xuất kho</th>
								<th className="text-right">Giá trị xuất</th>
								<th>Lần xuất cuối</th>
							</tr>
						</thead>
						<TableState
							colSpan={8}
							loading={query.isLoading}
							error={query.isError ? (query.error as Error).message : null}
							empty={!rows.length}
						>
							{rows.map(row => (
								<tr key={row.id}>
									<td>
										<b>{row.bomCode}</b>
										<small>
											{row.outputProductName || row.outputPackagingName}
											{row.outputProductName
												? ` · ${row.outputPackagingName}`
												: ""}
										</small>
									</td>
									<td>
										<b>{row.componentProductName}</b>
										<small>
											{[row.componentSku, row.componentPackagingName]
												.filter(Boolean)
												.join(" · ")}
										</small>
									</td>
									<td>{row.warehouseName}</td>
									<td className="text-right">
										{row.orders}
										<small title={row.orderCodes}>{row.orderCodes}</small>
									</td>
									<td className="text-right">
										{qty(row.plannedQuantity)} {row.unit || ""}
									</td>
									<td className="text-right font-semibold">
										{qty(row.issuedQuantity)} {row.unit || ""}
									</td>
									<td className="text-right">
										{money(row.totalValue)}
										<small>
											{money(row.avgUnitCost)} / {row.unit || "ĐVT"}
										</small>
									</td>
									<td>
										{row.lastIssuedAt ? formatDate(row.lastIssuedAt) : "-"}
										<small title={row.documentCodes}>
											{row.documentCodes}
										</small>
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

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import SearchableSelect from "../../components/SearchableSelect";
import RightDrawer from "../../components/RightDrawer";
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
	summary: {
		orders: number;
		grossSales: number;
		discountAmount: number;
		netRevenue: number;
		taxAmount: number;
		cogs: number;
		grossProfit: number;
	};
}
interface CustomerItem {
	packagingId: number;
	sku?: string;
	productName: string;
	packagingName: string;
	unit?: string;
	quantity: number;
}
interface CustomerItemsResult {
	rows: CustomerItem[];
	summary: {
		items: number;
		quantity: number;
	};
}

export default function SalesByCustomerReport() {
	const [from, setFrom] = useState(`${today().slice(0, 7)}-01`);
	const [to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [customerId, setCustomerId] = useState(0);
	const [groupId, setGroupId] = useState(0);
	const [customerDetail, setCustomerDetail] = useState<Row | null>(null);
	const refs = useReportRefs();
	const params = new URLSearchParams({ from, to });
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	if (customerId) params.set("customerId", String(customerId));
	if (groupId) params.set("groupId", String(groupId));
	const query = useQuery({
		queryKey: [
			"report-sales-customer",
			from,
			to,
			warehouseId,
			customerId,
			groupId,
		],
		queryFn: () =>
			apiV1<Result>(`/api/v1/reports/sales-by-customer?${params.toString()}`),
	});
	const detailParams = new URLSearchParams({
		from,
		to,
		customerId: String(customerDetail?.customerId || 0),
	});
	if (warehouseId) detailParams.set("warehouseId", String(warehouseId));
	const detailQuery = useQuery({
		queryKey: [
			"report-sales-customer-items",
			customerDetail?.customerId,
			from,
			to,
			warehouseId,
		],
		enabled: !!customerDetail,
		queryFn: () =>
			apiV1<CustomerItemsResult>(
				`/api/v1/reports/sales-by-customer/items?${detailParams.toString()}`,
			),
	});
	const customerOptions = useMemo(
		() =>
			(refs.data?.customers || []).map(customer => ({
				value: customer.id,
				label: customer.name,
				subLabel: customer.code,
			})),
		[refs.data?.customers],
	);
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const detail = detailQuery.data?.data;
	const detailRows = detail?.rows || [];
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(
			`Bao_cao_ban_hang_theo_khach_${from}_${to}.xlsx`,
			"Theo KH",
			[
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
			],
			rows,
		);

	return (
		<ReportShell
			title="Bán hàng theo khách hàng"
			description="Doanh thu và lợi nhuận gộp theo khách hàng / nhóm khách hàng"
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
					Nhóm khách hàng
					<select
						value={groupId}
						onChange={e => setGroupId(Number(e.target.value))}
					>
						<option value={0}>Tất cả nhóm</option>
						{(refs.data?.customerGroups || []).map(group => (
							<option key={group.id} value={group.id}>
								{group.name}
							</option>
						))}
					</select>
				</label>
				<label>
					Khách hàng
					<SearchableSelect
						value={customerId}
						options={customerOptions}
						onChange={setCustomerId}
						placeholder="Tìm theo tên hoặc mã khách hàng"
					/>
				</label>
			</FilterBar>

			{/* <StatGrid>
				<StatCard label="Doanh thu thuần" value={money(summary?.netRevenue || 0)} tone="positive" />
				<StatCard label="Lợi nhuận gộp" value={money(summary?.grossProfit || 0)} tone="info" />
				<StatCard label="Tổng số đơn" value={qty(summary?.orders || 0)} />
				<StatCard label="Số khách hàng" value={qty(rows.length)} />
			</StatGrid> */}

			<ReportCard
				title="Chi tiết theo khách hàng"
				description={`${rows.length} khách hàng`}
			>
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
						<TableState
							colSpan={9}
							loading={query.isLoading}
							error={query.isError ? (query.error as Error).message : null}
							empty={!rows.length}
						>
							{rows.map(row => (
								<tr key={row.customerId}>
									<td>
										<button
											type="button"
											title="Xem danh sách hàng hóa đã bán"
											className="font-bold text-[#422afb] hover:underline"
											onClick={() => setCustomerDetail(row)}
										>
											{row.customerCode || "-"}
										</button>
									</td>
									<td>{row.customerName}</td>
									<td>{row.groupName || "-"}</td>
									<td className="text-right">{qty(row.orders)}</td>
									<td className="text-right">{money(row.grossSales)}</td>
									<td className="text-right font-semibold">
										{money(row.netRevenue)}
									</td>
									<td className="text-right">{money(row.cogs)}</td>
									<td className="text-right font-bold text-emerald-600">
										{money(row.grossProfit)}
									</td>
									<td className="text-right">{row.grossMarginPercent}%</td>
								</tr>
							))}
						</TableState>
					</table>
				</div>
			</ReportCard>

			<RightDrawer
				open={!!customerDetail}
				title="Hàng hóa đã bán"
				subtitle={
					customerDetail
						? `${customerDetail.customerCode || "-"} · ${customerDetail.customerName} · ${from} → ${to}`
						: undefined
				}
				widthClass="max-w-[64rem]"
				onClose={() => setCustomerDetail(null)}
			>
				<div className="space-y-4">
					<div className="grid gap-3 sm:grid-cols-2">
						<div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
							<small>Số mặt hàng</small>
							<b className="block text-lg">{qty(detail?.summary.items || 0)}</b>
						</div>
						<div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
							<small>Tổng số lượng đã bán</small>
							<b className="block text-lg">{qty(detail?.summary.quantity || 0)}</b>
						</div>
					</div>
					<div className="overflow-x-auto rounded-lg border border-slate-200">
						<table className="erp-table w-full min-w-[720px]">
							<thead>
								<tr>
									<th>STT</th>
									<th>Mã hàng</th>
									<th>Tên hàng hóa</th>
									<th>Quy cách</th>
									<th>ĐVT</th>
									<th className="text-right">Số lượng đã bán</th>
								</tr>
							</thead>
							<TableState
								colSpan={6}
								loading={detailQuery.isLoading}
								error={
									detailQuery.isError
										? (detailQuery.error as Error).message
										: null
								}
								empty={!detailRows.length}
							>
								{detailRows.map((item, index) => (
									<tr key={item.packagingId}>
										<td>{index + 1}</td>
										<td className="font-mono font-semibold">
											{item.sku || "-"}
										</td>
										<td>{item.productName}</td>
										<td>{item.packagingName}</td>
										<td>{item.unit || "-"}</td>
										<td className="text-right font-semibold">
											{qty(item.quantity)}
										</td>
									</tr>
								))}
							</TableState>
						</table>
					</div>
					<p className="text-xs text-slate-500">
						Số lượng đã bán đã trừ các phiếu trả hàng đã lưu trong cùng kỳ.
					</p>
				</div>
			</RightDrawer>
		</ReportShell>
	);
}

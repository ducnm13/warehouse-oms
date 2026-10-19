import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";
import ReportPeriodFilter from "../components/ReportPeriodFilter";
import { apiV1, legacyApi } from "../lib/apiV1";
import { formatNumber } from "../lib/utils";
import type {
	InventorySummaryReportV1,
	ItemLedgerReportV1,
	OperationsReportV1,
	Product,
	ProductionVarianceReportV1,
	SalesProfitReportV1,
	Warehouse,
} from "../types";

type Tab =
	| "INVENTORY"
	| "LEDGER"
	| "SALES"
	| "SALES_CUSTOMER"
	| "SALES_PRODUCT"
	| "OPERATIONS"
	| "ASSEMBLY"
	| "DISASSEMBLY"
	| "VARIANCE"
	| "PROD_OVERVIEW"
	| "TRANSFERS"
	| "ONLINE";
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;
const money = (value: number) => `${formatNumber(value)} ₫`;
const REPORT_GROUPS: Array<{
	label: string;
	items: Array<{ value: Tab; label: string }>;
}> = [
	{
		label: "Bán hàng",
		items: [
			{ value: "SALES", label: "Tổng quan" },
			{ value: "SALES_CUSTOMER", label: "Theo khách hàng / nhóm" },
			{ value: "SALES_PRODUCT", label: "Theo sản phẩm" },
		],
	},
	{
		label: "Lệnh sản xuất",
		items: [
			{ value: "PROD_OVERVIEW", label: "Tổng quan" },
			{ value: "VARIANCE", label: "Định mức vs thực tế" },
		],
	},
	{
		label: "Tồn kho",
		items: [
			{ value: "INVENTORY", label: "Chi tiết theo kho" },
			{ value: "LEDGER", label: "Sổ chi tiết 1 mã" },
		],
	},
	{
		label: "Đơn online",
		items: [{ value: "ONLINE", label: "Tổng quan online" }],
	},
	{
		label: "Chuyển kho",
		items: [{ value: "TRANSFERS", label: "Tổng quan + chi tiết" }],
	},
	{
		label: "Lắp ráp – Tháo dỡ",
		items: [
			{ value: "OPERATIONS", label: "Tổng quan chung" },
			{ value: "ASSEMBLY", label: "Lắp ráp" },
			{ value: "DISASSEMBLY", label: "Tháo dỡ" },
		],
	},
];

export default function Reporting() {
	const [tab, setTab] = useState<Tab>("INVENTORY"),
		[from, setFrom] = useState(monthStart()),
		[to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0),
		[search, setSearch] = useState(""),
		[packagingId, setPackagingId] = useState(0);
	const [category, setCategory] = useState(""),
		[operationType, setOperationType] = useState("");
	const [groupId, setGroupId] = useState(0),
		[transferStatus, setTransferStatus] = useState("");
	const [onlineMonth, setOnlineMonth] = useState(today().slice(0, 7));
	const [expandedTransfer, setExpandedTransfer] = useState<number | null>(null);
	const [transferDetails, setTransferDetails] = useState<Record<number, any>>(
		{},
	);
	const exportAuthorization = useQuery({
		queryKey: ["report-export-authorization"],
		queryFn: () =>
			apiV1<{ allowed: boolean }>("/api/v1/reports/export-authorization"),
		retry: false,
	});
	const references = useQuery({
		queryKey: ["reporting-refs"],
		queryFn: async () => {
			const [warehouses, products, groups] = await Promise.all([
				legacyApi<Warehouse[]>("/api/warehouses"),
				legacyApi<Product[]>("/api/products"),
				fetch("/api/v1/customer-groups", {
					headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
				})
					.then(async r => {
						if (!r.ok) return [];
						const body = await r.json();
						const rows = Array.isArray(body?.data) ? body.data : [];
						return rows.flatMap((g: any) => [
							{ id: g.id, code: g.code, name: g.name },
							...(g.children || []).map((c: any) => ({
								id: c.id,
								code: c.code,
								name: c.name,
							})),
						]);
					})
					.catch(() => []),
			]);
			return { warehouses, products, groups };
		},
	});
	const packagings = useMemo(
		() =>
			references.data?.products.flatMap(product =>
				product.packagings.map(packaging => ({
					...packaging,
					productName: product.name,
				})),
			) || [],
		[references.data],
	);
	const common = `from=${from}&to=${to}${warehouseId ? `&warehouseId=${warehouseId}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
	const inventory = useQuery({
		queryKey: ["report-inventory", from, to, warehouseId, search, category],
		enabled: tab === "INVENTORY",
		queryFn: () =>
			apiV1<InventorySummaryReportV1>(
				`/api/v1/reports/inventory-summary?${common}${category ? `&category=${category}` : ""}`,
			),
	});
	const ledger = useQuery({
		queryKey: ["report-ledger", from, to, warehouseId, packagingId],
		enabled: tab === "LEDGER" && packagingId > 0,
		queryFn: () =>
			apiV1<ItemLedgerReportV1>(
				`/api/v1/reports/item-ledger?from=${from}&to=${to}&packagingId=${packagingId}${warehouseId ? `&warehouseId=${warehouseId}` : ""}`,
			),
	});
	const sales = useQuery({
		queryKey: ["report-sales", from, to, warehouseId, search],
		enabled: tab === "SALES",
		queryFn: () =>
			apiV1<SalesProfitReportV1>(`/api/v1/reports/sales-profit?${common}`),
	});
	const salesCustomer = useQuery({
		queryKey: ["report-sales-customer", from, to, warehouseId, search, groupId],
		enabled: tab === "SALES_CUSTOMER",
		queryFn: () =>
			apiV1<any>(
				`/api/v1/reports/sales-by-customer?${common}${groupId ? `&groupId=${groupId}` : ""}`,
			),
	});
	const salesProduct = useQuery({
		queryKey: ["report-sales-product", from, to, warehouseId, search],
		enabled: tab === "SALES_PRODUCT",
		queryFn: () => apiV1<any>(`/api/v1/reports/sales-by-product?${common}`),
	});
	const operations = useQuery({
		queryKey: [
			"report-operations",
			from,
			to,
			warehouseId,
			search,
			operationType,
		],
		enabled: tab === "OPERATIONS",
		queryFn: () =>
			apiV1<OperationsReportV1>(
				`/api/v1/reports/operations?${common}${operationType ? `&type=${operationType}` : ""}`,
			),
	});
	const assembly = useQuery({
		queryKey: ["report-assembly", from, to, warehouseId, search],
		enabled: tab === "ASSEMBLY",
		queryFn: () =>
			apiV1<OperationsReportV1>(
				`/api/v1/reports/operations?${common}&type=ASSEMBLY`,
			),
	});
	const disassembly = useQuery({
		queryKey: ["report-disassembly", from, to, warehouseId, search],
		enabled: tab === "DISASSEMBLY",
		queryFn: () =>
			apiV1<OperationsReportV1>(
				`/api/v1/reports/operations?${common}&type=DISASSEMBLY`,
			),
	});
	const variance = useQuery({
		queryKey: ["report-production-variance", from, to, warehouseId, search],
		enabled: tab === "VARIANCE",
		queryFn: () =>
			apiV1<ProductionVarianceReportV1>(
				`/api/v1/reports/production-variance?${common}`,
			),
	});
	const prodOverview = useQuery({
		queryKey: ["report-prod-overview", from, to, warehouseId, search],
		enabled: tab === "PROD_OVERVIEW",
		queryFn: () => apiV1<any>(`/api/v1/reports/production-overview?${common}`),
	});
	const transfers = useQuery({
		queryKey: [
			"report-transfers",
			from,
			to,
			warehouseId,
			search,
			transferStatus,
		],
		enabled: tab === "TRANSFERS",
		queryFn: () =>
			apiV1<any>(
				`/api/v1/reports/transfers?${common}${transferStatus ? `&status=${transferStatus}` : ""}`,
			),
	});
	const onlineStats = useQuery({
		queryKey: ["report-online-stats"],
		enabled: tab === "ONLINE",
		queryFn: () => apiV1<any>("/api/v1/online/stats"),
		staleTime: 60_000,
	});
	const onlineMonthly = useQuery({
		queryKey: ["report-online-monthly"],
		enabled: tab === "ONLINE",
		queryFn: () => apiV1<any>("/api/v1/online/reports/monthly?months=12"),
		staleTime: 60_000,
	});
	const onlineTop = useQuery({
		queryKey: ["report-online-top", onlineMonth],
		enabled: tab === "ONLINE",
		queryFn: () =>
			apiV1<any>(
				`/api/v1/online/reports/top-products?month=${onlineMonth}&limit=50`,
			),
		staleTime: 60_000,
	});
	const activeQuery =
		tab === "INVENTORY"
			? inventory
			: tab === "LEDGER"
				? ledger
				: tab === "SALES"
					? sales
					: tab === "SALES_CUSTOMER"
						? salesCustomer
						: tab === "SALES_PRODUCT"
							? salesProduct
							: tab === "OPERATIONS"
								? operations
								: tab === "ASSEMBLY"
									? assembly
									: tab === "DISASSEMBLY"
										? disassembly
										: tab === "VARIANCE"
											? variance
											: tab === "PROD_OVERVIEW"
												? prodOverview
												: tab === "TRANSFERS"
													? transfers
													: onlineStats;
	// Giữ khung trang + menu trái luôn hiện; chỉ vùng nội dung loading/lỗi
	const contentNotice = references.isError
		? { error: true, message: (references.error as Error).message }
		: activeQuery.isError
			? { error: true, message: (activeQuery.error as Error).message }
			: references.isLoading || activeQuery.isLoading
				? { error: false, message: "Đang tải dữ liệu báo cáo..." }
				: null;
	const currentRows: any[] =
		tab === "INVENTORY"
			? inventory.data?.data.rows || []
			: tab === "LEDGER"
				? ledger.data?.data.rows || []
				: tab === "SALES"
					? sales.data?.data.rows || []
					: tab === "SALES_CUSTOMER"
						? salesCustomer.data?.data.rows || []
						: tab === "SALES_PRODUCT"
							? salesProduct.data?.data.rows || []
							: tab === "OPERATIONS"
								? operations.data?.data.rows || []
								: tab === "ASSEMBLY"
									? assembly.data?.data.rows || []
									: tab === "DISASSEMBLY"
										? disassembly.data?.data.rows || []
										: tab === "VARIANCE"
											? variance.data?.data.rows || []
											: tab === "PROD_OVERVIEW"
												? prodOverview.data?.data.rows || []
												: tab === "TRANSFERS"
													? transfers.data?.data.rows || []
													: onlineTop.data?.data || [];
	const openLedger = (id: number) => {
		setPackagingId(id);
		setTab("LEDGER");
	};
	const toggleTransfer = async (id: number) => {
		if (expandedTransfer === id) {
			setExpandedTransfer(null);
			return;
		}
		setExpandedTransfer(id);
		if (!transferDetails[id]) {
			try {
				const res = await apiV1<any>(`/api/v1/warehouse-transfers/${id}`);
				setTransferDetails(prev => ({
					...prev,
					[id]: res.data?.details || [],
				}));
			} catch (e) {
				toast.error((e as Error).message);
			}
		}
	};
	const exportExcel = async () => {
		if (!currentRows.length)
			return void toast.error("Không có dữ liệu để xuất");
		const workbook = new ExcelJS.Workbook(),
			worksheet = workbook.addWorksheet("Bao cao"),
			keys = Object.keys(currentRows[0]);
		worksheet.columns = keys.map(key => ({ header: key, key, width: 20 }));
		currentRows.forEach(row => worksheet.addRow(row));
		worksheet.getRow(1).font = { bold: true };
		const buffer = await workbook.xlsx.writeBuffer();
		saveAs(new Blob([buffer]), `Bao_cao_${tab}_${from}_${to}.xlsx`);
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap justify-between gap-3">
				<div>
					<h1 className="text-2xl font-extrabold text-slate-800">
						Báo cáo tổng hợp
					</h1>
					<p className="text-sm text-slate-500">
						Tổng hợp báo cáo bán hàng, tồn kho, lệnh sản xuất, chuyển kho, lắp
						ráp – tháo dỡ
					</p>
				</div>
				{exportAuthorization.data?.data.allowed && (
					<button className="erp-btn erp-btn-primary" onClick={exportExcel}>
						<Download size={16} /> Xuất Excel
					</button>
				)}
			</div>
			<div className="flex flex-col gap-4 lg:flex-row">
				<aside className="w-full shrink-0 lg:w-64">
					<div className="erp-card overflow-hidden">
						{REPORT_GROUPS.map(group => (
							<div key={group.label}>
								<p className="bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
									{group.label}
								</p>
								{group.items.map(item => (
									<button
										key={item.value}
										onClick={() => setTab(item.value)}
										className={`block w-full border-l-2 px-4 py-2.5 text-left text-sm transition-colors ${tab === item.value ? "border-emerald-600 bg-emerald-50 font-bold text-emerald-700" : "border-transparent text-slate-600 hover:bg-slate-50"}`}
									>
										{item.label}
									</button>
								))}
							</div>
						))}
					</div>
				</aside>
				<div className="min-w-0 flex-1 space-y-6">
					{contentNotice ? (
						<div
							className={`erp-card p-12 text-center ${contentNotice.error ? "text-red-600" : "text-slate-500"}`}
						>
							{contentNotice.message}
						</div>
					) : (
						<>
							<div className="erp-card space-y-3 p-4">
								<ReportPeriodFilter
									from={from}
									to={to}
									onChange={(f, t) => {
										setFrom(f);
										setTo(t);
									}}
								/>
								<div className="grid gap-3 md:grid-cols-5">
									<label>
										Kho
										<select
											value={warehouseId}
											onChange={event => setWarehouseId(+event.target.value)}
										>
											<option value={0}>Tất cả kho</option>
											{references.data?.warehouses.map(warehouse => (
												<option key={warehouse.id} value={warehouse.id}>
													{warehouse.name}
												</option>
											))}
										</select>
									</label>
									{tab === "LEDGER" ? (
										<label>
											Quy cách
											<select
												value={packagingId}
												onChange={event => setPackagingId(+event.target.value)}
											>
												<option value={0}>Chọn quy cách</option>
												{packagings.map(packaging => (
													<option key={packaging.id} value={packaging.id}>
														{packaging.productName} - {packaging.name}
													</option>
												))}
											</select>
										</label>
									) : tab === "ONLINE" ? (
										<label>
											Tháng top SP
											<input
												type="month"
												value={onlineMonth}
												onChange={event =>
													event.target.value &&
													setOnlineMonth(event.target.value)
												}
											/>
										</label>
									) : (
										<label>
											Tìm kiếm
											<div className="erp-search">
												<Search size={15} />
												<input
													value={search}
													onChange={event => setSearch(event.target.value)}
												/>
											</div>
										</label>
									)}
									{tab === "INVENTORY" ? (
										<label>
											Nhóm
											<select
												value={category}
												onChange={event => setCategory(event.target.value)}
											>
												<option value="">Tất cả</option>
												<option value="PRODUCT">Sản phẩm</option>
												<option value="MATERIAL">Nguyên vật liệu</option>
											</select>
										</label>
									) : tab === "OPERATIONS" ? (
										<label>
											Loại
											<select
												value={operationType}
												onChange={event => setOperationType(event.target.value)}
											>
												<option value="">Tất cả</option>
												<option value="PRODUCTION">Sản xuất</option>
												<option value="ASSEMBLY">Lắp ráp</option>
												<option value="DISASSEMBLY">Tháo dỡ</option>
											</select>
										</label>
									) : tab === "SALES_CUSTOMER" ? (
										<label>
											Nhóm KH
											<select
												value={groupId}
												onChange={event => setGroupId(+event.target.value)}
											>
												<option value={0}>Tất cả nhóm</option>
												{(references.data?.groups || []).map((g: any) => (
													<option key={g.id} value={g.id}>
														{g.name} ({g.code})
													</option>
												))}
											</select>
										</label>
									) : tab === "TRANSFERS" ? (
										<label>
											Trạng thái
											<select
												value={transferStatus}
												onChange={event =>
													setTransferStatus(event.target.value)
												}
											>
												<option value="">Tất cả</option>
												<option value="DRAFT">Nháp</option>
												<option value="IN_TRANSIT">Đang vận chuyển</option>
												<option value="RECEIVED">Đã nhận</option>
												<option value="CANCELLED">Đã hủy</option>
											</select>
										</label>
									) : (
										<div />
									)}
								</div>
							</div>

							{tab === "INVENTORY" && (
								<>
									<div className="grid gap-3 md:grid-cols-4">
										<Stat
											label="Tồn đầu"
											value={inventory.data?.data.summary.openingQuantity || 0}
										/>
										<Stat
											label="Nhập"
											value={inventory.data?.data.summary.inboundQuantity || 0}
										/>
										<Stat
											label="Xuất"
											value={inventory.data?.data.summary.outboundQuantity || 0}
										/>
										<Stat
											label="Tồn cuối"
											value={inventory.data?.data.summary.closingQuantity || 0}
										/>
									</div>
									<Table
										headers={[
											"Hàng hóa / Quy cách",
											"Kho",
											"Đầu kỳ",
											"Nhập",
											"Xuất",
											"Cuối kỳ",
											"Giá trị cuối",
											"Đối chiếu",
										]}
									>
										{inventory.data?.data.rows.map(row => (
											<tr key={`${row.packagingId}-${row.warehouseId}`}>
												<td>
													<button
														className="text-left font-bold text-indigo-600 hover:underline"
														title="Xem lịch sử giao dịch"
														onClick={() => openLedger(row.packagingId)}
													>
														{row.productName} - {row.packagingName}
													</button>
													<small>{row.sku}</small>
												</td>
												<td>{row.warehouseName}</td>
												<td>{formatNumber(row.openingQuantity)}</td>
												<td>{formatNumber(row.inboundQuantity)}</td>
												<td>{formatNumber(row.outboundQuantity)}</td>
												<td>
													<b>{formatNumber(row.closingQuantity)}</b>
												</td>
												<td>{money(row.closingValue)}</td>
												<td
													className={
														Math.abs(row.projectionDifference) > 0.0001
															? "text-red-600"
															: "text-emerald-600"
													}
												>
													{formatNumber(row.projectionDifference)}
												</td>
											</tr>
										))}
									</Table>
								</>
							)}
							{tab === "LEDGER" && (
								<>
									{packagingId === 0 ? (
										<div className="erp-card p-10 text-center text-slate-400">
											Chọn quy cách để xem sổ chi tiết.
										</div>
									) : (
										<>
											<div className="grid gap-3 md:grid-cols-4">
												<Stat
													label="SL đầu kỳ"
													value={ledger.data?.data.openingQuantity || 0}
												/>
												<Stat
													label="Giá trị đầu"
													value={ledger.data?.data.openingValue || 0}
													currency
												/>
												<Stat
													label="SL cuối kỳ"
													value={ledger.data?.data.closingQuantity || 0}
												/>
												<Stat
													label="Giá trị cuối"
													value={ledger.data?.data.closingValue || 0}
													currency
												/>
											</div>
											<Table
												headers={[
													"Ngày / Chứng từ",
													"Nguồn",
													"Kho",
													"Nhập",
													"Xuất",
													"Đơn giá",
													"Tồn chạy",
													"Giá trị chạy",
												]}
											>
												{ledger.data?.data.rows.map(row => (
													<tr key={row.id}>
														<td>
															{new Date(row.occurredAt).toLocaleDateString(
																"vi-VN",
															)}
															<small>{row.documentCode}</small>
														</td>
														<td>{row.sourceType}</td>
														<td>{row.warehouseName}</td>
														<td>{formatNumber(row.inboundQuantity)}</td>
														<td>{formatNumber(row.outboundQuantity)}</td>
														<td>{money(row.unitCost)}</td>
														<td>
															<b>{formatNumber(row.runningQuantity)}</b>
														</td>
														<td>{money(row.runningValue)}</td>
													</tr>
												))}
											</Table>
										</>
									)}
								</>
							)}
							{tab === "SALES" && (
								<>
									<div className="grid gap-3 md:grid-cols-3">
										<Stat
											label="Doanh thu thuần"
											value={sales.data?.data.summary.netRevenue || 0}
											currency
										/>
										<Stat
											label="Giá vốn"
											value={sales.data?.data.summary.cogs || 0}
											currency
										/>
										<Stat
											label="Lợi nhuận gộp"
											value={sales.data?.data.summary.grossProfit || 0}
											currency
										/>
									</div>
									<Table
										headers={[
											"Chứng từ",
											"Khách hàng / Kho",
											"Doanh thu",
											"Chiết khấu",
											"Giá vốn",
											"Lợi nhuận",
											"Biên LN",
										]}
									>
										{sales.data?.data.rows.map(row => (
											<tr key={row.id}>
												<td>
													<b>{row.code}</b>
													<small>{row.orderDate}</small>
												</td>
												<td>
													{row.customerName}
													<small>{row.warehouseName}</small>
												</td>
												<td>{money(row.netRevenue)}</td>
												<td>{money(row.discountAmount)}</td>
												<td>{money(row.cogs)}</td>
												<td
													className={
														row.grossProfit >= 0
															? "text-emerald-600"
															: "text-red-600"
													}
												>
													{money(row.grossProfit)}
												</td>
												<td>{formatNumber(row.grossMarginPercent)}%</td>
											</tr>
										))}
									</Table>
								</>
							)}
							{tab === "SALES_CUSTOMER" && (
								<>
									<div className="grid gap-3 md:grid-cols-3">
										<Stat
											label="Doanh thu thuần"
											value={salesCustomer.data?.data.summary.netRevenue || 0}
											currency
										/>
										<Stat
											label="Giá vốn"
											value={salesCustomer.data?.data.summary.cogs || 0}
											currency
										/>
										<Stat
											label="Lợi nhuận gộp"
											value={salesCustomer.data?.data.summary.grossProfit || 0}
											currency
										/>
									</div>
									<Table
										headers={[
											"Khách hàng / Nhóm",
											"Số đơn",
											"Doanh thu",
											"Chiết khấu",
											"Giá vốn",
											"Lợi nhuận",
											"Biên LN",
										]}
									>
										{salesCustomer.data?.data.rows.map(row => (
											<tr key={row.customerId}>
												<td>
													<b>{row.customerName}</b>
													<small>
														{row.customerCode} ·{" "}
														{row.groupName || "Chưa phân nhóm"}
													</small>
												</td>
												<td>{formatNumber(row.orders)}</td>
												<td>{money(row.netRevenue)}</td>
												<td>{money(row.discountAmount)}</td>
												<td>{money(row.cogs)}</td>
												<td
													className={
														row.grossProfit >= 0
															? "text-emerald-600"
															: "text-red-600"
													}
												>
													{money(row.grossProfit)}
												</td>
												<td>{formatNumber(row.grossMarginPercent)}%</td>
											</tr>
										))}
									</Table>
								</>
							)}
							{tab === "SALES_PRODUCT" && (
								<>
									<div className="grid gap-3 md:grid-cols-3">
										<Stat
											label="SL bán"
											value={salesProduct.data?.data.summary.quantity || 0}
										/>
										<Stat
											label="Doanh thu thuần"
											value={salesProduct.data?.data.summary.netRevenue || 0}
											currency
										/>
										<Stat
											label="Lợi nhuận gộp"
											value={salesProduct.data?.data.summary.grossProfit || 0}
											currency
										/>
									</div>
									<Table
										headers={[
											"Sản phẩm",
											"SL bán",
											"Doanh thu",
											"Chiết khấu",
											"Giá vốn",
											"Lợi nhuận",
											"Biên LN",
										]}
									>
										{salesProduct.data?.data.rows.map(row => (
											<tr key={row.packagingId}>
												<td>
													<b>
														{row.productName} - {row.packagingName}
													</b>
													<small>
														{row.sku} · {row.unit}
													</small>
												</td>
												<td>{formatNumber(row.quantity)}</td>
												<td>{money(row.netRevenue)}</td>
												<td>{money(row.discountAmount)}</td>
												<td>{money(row.cogs)}</td>
												<td
													className={
														row.grossProfit >= 0
															? "text-emerald-600"
															: "text-red-600"
													}
												>
													{money(row.grossProfit)}
												</td>
												<td>{formatNumber(row.grossMarginPercent)}%</td>
											</tr>
										))}
									</Table>
								</>
							)}
							{tab === "OPERATIONS" && (
								<>
									<div className="grid gap-3 md:grid-cols-4">
										<Stat
											label="Số lệnh"
											value={operations.data?.data.summary.orders || 0}
										/>
										<Stat
											label="Sản lượng thực tế"
											value={operations.data?.data.summary.actualQuantity || 0}
										/>
										<Stat
											label="Giá trị đầu vào"
											value={operations.data?.data.summary.inputValue || 0}
											currency
										/>
										<Stat
											label="Giá trị đầu ra"
											value={operations.data?.data.summary.outputValue || 0}
											currency
										/>
									</div>
									<Table
										headers={[
											"Ngày / Lệnh",
											"Loại",
											"Sản phẩm",
											"Kế hoạch",
											"Thực tế",
											"Đầu vào",
											"Đầu ra",
											"Hao hụt",
										]}
									>
										{operations.data?.data.rows.map(row => (
											<tr key={`${row.type}-${row.id}`}>
												<td>
													{new Date(row.occurredAt).toLocaleDateString("vi-VN")}
													<small>{row.code}</small>
												</td>
												<td>{row.type}</td>
												<td>{row.itemName}</td>
												<td>{formatNumber(row.plannedQuantity)}</td>
												<td>{formatNumber(row.actualQuantity)}</td>
												<td>{money(row.inputValue)}</td>
												<td>{money(row.outputValue)}</td>
												<td>{formatNumber(row.lossQuantity)}</td>
											</tr>
										))}
									</Table>
								</>
							)}
							{(tab === "ASSEMBLY" || tab === "DISASSEMBLY") && (
								<>
									<div className="grid gap-3 md:grid-cols-4">
										<Stat
											label="Số lệnh"
											value={
												(tab === "ASSEMBLY" ? assembly : disassembly).data?.data
													.summary.orders || 0
											}
										/>
										<Stat
											label="Sản lượng thực tế"
											value={
												(tab === "ASSEMBLY" ? assembly : disassembly).data?.data
													.summary.actualQuantity || 0
											}
										/>
										<Stat
											label="Giá trị đầu vào"
											value={
												(tab === "ASSEMBLY" ? assembly : disassembly).data?.data
													.summary.inputValue || 0
											}
											currency
										/>
										<Stat
											label="Giá trị đầu ra"
											value={
												(tab === "ASSEMBLY" ? assembly : disassembly).data?.data
													.summary.outputValue || 0
											}
											currency
										/>
									</div>
									<Table
										headers={[
											"Ngày / Lệnh",
											"Sản phẩm",
											"Kế hoạch",
											"Thực tế",
											"Đầu vào",
											"Đầu ra",
											"Hao hụt",
										]}
									>
										{(tab === "ASSEMBLY"
											? assembly
											: disassembly
										).data?.data.rows.map(row => (
											<tr key={`${row.type}-${row.id}`}>
												<td>
													{new Date(row.occurredAt).toLocaleDateString("vi-VN")}
													<small>{row.code}</small>
												</td>
												<td>{row.itemName}</td>
												<td>{formatNumber(row.plannedQuantity)}</td>
												<td>{formatNumber(row.actualQuantity)}</td>
												<td>{money(row.inputValue)}</td>
												<td>{money(row.outputValue)}</td>
												<td>{formatNumber(row.lossQuantity)}</td>
											</tr>
										))}
									</Table>
								</>
							)}
							{tab === "VARIANCE" && (
								<>
									<div className="grid gap-3 md:grid-cols-5">
										<Stat
											label="Số lệnh"
											value={variance.data?.data.summary.orders || 0}
										/>
										<Stat
											label="CL sản lượng (gói QĐ)"
											value={variance.data?.data.summary.outputVariance || 0}
										/>
										<Stat
											label="Dòng NVL"
											value={variance.data?.data.summary.materialLines || 0}
										/>
										<Stat
											label="CL giá trị NVL"
											value={
												variance.data?.data.summary.materialValueVariance || 0
											}
											currency
										/>
										<Stat
											label="Vượt / Tiết kiệm"
											value={variance.data?.data.summary.overConsumedLines || 0}
											suffix={` / ${variance.data?.data.summary.underConsumedLines || 0}`}
										/>
									</div>
									<Table
										headers={[
											"Lệnh / Thành phẩm",
											"Kho / Hoàn thành",
											"Sản lượng KH → TT (gói QĐ)",
											"Nguyên vật liệu",
											"Tiêu hao KH → TT",
											"CL lượng",
											"Tỷ lệ CL",
											"Giá trị KH → TT",
											"CL giá trị",
										]}
									>
										{variance.data?.data.rows.map(row => (
											<tr key={row.materialId}>
												<td>
													<b>{row.code}</b>
													<small>{row.productName}</small>
												</td>
												<td>
													{row.warehouseName}
													<small>
														{new Date(row.completedAt).toLocaleDateString(
															"vi-VN",
														)}
													</small>
												</td>
												<td>
													{formatNumber(row.plannedOutput)} →{" "}
													<b>{formatNumber(row.actualOutput)}</b>
													<small
														className={
															row.outputVariance < 0
																? "text-red-600"
																: "text-emerald-600"
														}
													>
														CL {formatNumber(row.outputVariance)} (
														{formatNumber(row.outputVariancePercent)}%)
													</small>
												</td>
												<td>
													{row.materialName} - {row.packagingName}
													<small>{row.sku}</small>
												</td>
												<td>
													{formatNumber(row.plannedMaterialQuantity)} →{" "}
													<b>
														{formatNumber(row.actualMaterialQuantity)}{" "}
														{row.unit}
													</b>
												</td>
												<td
													className={
														row.materialQuantityVariance > 0
															? "font-bold text-red-600"
															: "font-bold text-emerald-600"
													}
												>
													{formatNumber(row.materialQuantityVariance)}
												</td>
												<td
													className={
														row.materialVariancePercent > 0
															? "text-red-600"
															: "text-emerald-600"
													}
												>
													{formatNumber(row.materialVariancePercent)}%
												</td>
												<td>
													{money(row.plannedMaterialValue)} →{" "}
													<b>{money(row.actualMaterialValue)}</b>
												</td>
												<td
													className={
														row.materialValueVariance > 0
															? "font-bold text-red-600"
															: "font-bold text-emerald-600"
													}
												>
													{formatNumber(row.materialValueVariance)}
												</td>
											</tr>
										))}
									</Table>
								</>
							)}
							{tab === "PROD_OVERVIEW" && (
								<>
									<div className="grid gap-3 md:grid-cols-3">
										<Stat
											label="Tổng bột (kg)"
											value={prodOverview.data?.data.summary.powderKg || 0}
										/>
										<Stat
											label="KH (gói)"
											value={prodOverview.data?.data.summary.plannedPacks || 0}
										/>
										<Stat
											label="Thực tế (gói)"
											value={prodOverview.data?.data.summary.actualPacks || 0}
										/>
									</div>
									<Table
										headers={[
											"Mã / Thành phẩm",
											"Số lệnh",
											"KH (gói)",
											"Thực tế (gói)",
											"Bột phân bổ (kg)",
										]}
									>
										{prodOverview.data?.data.rows.map(row => (
											<tr key={row.packagingId}>
												<td>
													<b>
														{row.productName} - {row.packagingName}
													</b>
													<small>
														{row.sku} · {row.unit}
													</small>
												</td>
												<td>{formatNumber(row.orders)}</td>
												<td>{formatNumber(row.plannedPacks)}</td>
												<td>
													<b>{formatNumber(row.actualPacks)}</b>
												</td>
												<td>{formatNumber(row.powderKg)} kg</td>
											</tr>
										))}
									</Table>
								</>
							)}
							{tab === "TRANSFERS" && (
								<>
									<div className="grid gap-3 md:grid-cols-2">
										<Stat
											label="Số phiếu"
											value={transfers.data?.data.summary.docs || 0}
										/>
										<Stat
											label="Tổng SL"
											value={transfers.data?.data.summary.quantity || 0}
										/>
									</div>
									<Table
										headers={[
											"Phiếu / Ngày",
											"Tuyến kho",
											"Trạng thái",
											"SL",
											"",
										]}
									>
										{transfers.data?.data.rows.map(row => (
											<React.Fragment key={row.id}>
												<tr>
													<td>
														<b>{row.code}</b>
														<small>{row.transferDate}</small>
													</td>{" "}
													<td>
														{row.fromWarehouseName} → {row.toWarehouseName}
														<small>{row.lineCount} dòng</small>
													</td>
													<td>{row.status}</td>
													<td>{formatNumber(row.quantity)}</td>
													<td>
														<button
															className="erp-btn"
															onClick={() => toggleTransfer(row.id)}
														>
															{expandedTransfer === row.id
																? "Thu gọn"
																: "Chi tiết"}
														</button>
													</td>
												</tr>
												{expandedTransfer === row.id && (
													<tr>
														<td colSpan={5}>
															{(transferDetails[row.id] || []).length === 0 ? (
																<span className="text-slate-400">
																	Đang tải...
																</span>
															) : (
																<Table
																	headers={[
																		"Mã / Hàng hóa",
																		"SL",
																		"Đơn giá vốn",
																		"Thành tiền",
																	]}
																>
																	{transferDetails[row.id].map((line: any) => (
																		<tr key={line.id}>
																			<td>
																				<b>
																					{line.productName} -{" "}
																					{line.packagingName}
																				</b>
																				<small>{line.sku}</small>
																			</td>
																			<td>{formatNumber(line.quantity)}</td>
																			<td>{money(line.unitCost)}</td>
																			<td>{money(line.totalValue)}</td>
																		</tr>
																	))}
																</Table>
															)}
														</td>
													</tr>
												)}
											</React.Fragment>
										))}
									</Table>
								</>
							)}
							{tab === "ONLINE" && (
								<>
									<div className="grid gap-3 md:grid-cols-3">
										<Stat
											label="Doanh thu"
											value={onlineStats.data?.data.totalRevenue || 0}
											currency
										/>
										<Stat
											label="Tổng đơn"
											value={onlineStats.data?.data.totalOrders || 0}
										/>
										<div className="erp-stat">
											<div>
												<span>Tháng top SP</span>
												<strong>
													{onlineMonth.slice(5, 7)}/{onlineMonth.slice(0, 4)}
												</strong>
											</div>
										</div>
									</div>
									<Table
										headers={[
											"Sản phẩm bán chạy",
											"SL bán",
											"Số đơn",
											"Doanh thu",
										]}
									>
										{(onlineTop.data?.data || []).map((p: any, i: number) => (
											<tr key={i}>
												<td>
													<b>{p.productName}</b>
													<small>{p.unit}</small>
												</td>
												<td>{formatNumber(p.quantity)}</td>
												<td>{formatNumber(p.orders)}</td>
												<td>{money(p.revenue)}</td>
											</tr>
										))}
									</Table>
									<Table headers={["Tháng", "Số đơn", "Doanh thu"]}>
										{(onlineMonthly.data?.data || []).map((r: any) => (
											<tr key={r.month}>
												<td>
													<b>
														{r.month.slice(5, 7)}/{r.month.slice(0, 4)}
													</b>
												</td>
												<td>{formatNumber(r.orders)}</td>
												<td>{money(r.revenue)}</td>
											</tr>
										))}
									</Table>
								</>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}

function Stat({
	label,
	value,
	currency = false,
	suffix = "",
}: {
	label: string;
	value: number;
	currency?: boolean;
	suffix?: string;
}) {
	return (
		<div className="erp-stat">
			<div>
				<span>{label}</span>
				<strong>
					{currency ? money(value) : `${formatNumber(value)}${suffix}`}
				</strong>
			</div>
		</div>
	);
}
function Table({
	headers,
	children,
}: {
	headers: string[];
	children: React.ReactNode;
}) {
	return (
		<div className="erp-card overflow-x-auto">
			<table className="erp-table">
				<thead>
					<tr>
						{headers.map(header => (
							<th key={header}>{header}</th>
						))}
					</tr>
				</thead>
				<tbody>{children}</tbody>
			</table>
		</div>
	);
}

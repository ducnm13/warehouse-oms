import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2,
	Copy,
	Edit,
	Eye,
	PackagePlus,
	Plus,
	Printer,
	Search,
	Trash2,
	Undo2,
	X,
} from "lucide-react";
import toast from "../components/ui/toast";
import { confirm, prompt } from "../components/ui/confirm";
import { apiV1, legacyApi } from "../lib/apiV1";
import { formatDate, formatNumber, formatProductName } from "../lib/utils";
import { finishedGoodsWarehouseId } from "../lib/warehouse-defaults";
import SearchableSelect from "../components/SearchableSelect";
import { useReactToPrint } from "react-to-print";
import { buildCompanyPrintProfile } from "../lib/printTemplate";
import { SalesReturnDocument } from "../components/SalesReturnDocument";
import type { SalesOrder, SalesReturnV1, Warehouse } from "../types";
import { useMultiEscapeKey } from "../hooks/useEscapeKey";
import { DateInput } from "../components/DateRangeCalendar";
import TableActions from "../components/TableActions";
import DetailOptionsMenu from "../components/DetailOptionsMenu";
import ListToolbar from "../components/ListToolbar";
import type { FilterField, FilterValues } from "../components/FilterDrawer";
import { exportExcelFile } from "../lib/excelExport";

const today = () => new Date().toISOString().slice(0, 10);
const badge = {
	DRAFT: "bg-slate-100 text-slate-600",
	POSTED: "bg-emerald-100 text-emerald-700",
	CANCELLED: "bg-red-100 text-red-700",
};
const statusLabel: Record<string, string> = {
	DRAFT: "Nháp",
	POSTED: "Đã lưu",
	CANCELLED: "Đã hủy",
};
const SALES_RETURN_FILTER_FIELDS: FilterField[] = [
	{
		type: "select",
		key: "status",
		label: "Trạng thái",
		options: [
			{ value: "POSTED", label: "Đã lưu" },
			{ value: "DRAFT", label: "Nháp" },
			{ value: "CANCELLED", label: "Đã hủy" },
		],
	},
	{
		type: "dateRange",
		key: "returnDate",
		label: "Thời gian",
		fromKey: "dateFrom",
		toKey: "dateTo",
	},
];

type ReturnLineInput = {
	originalSalesOrderLineId: number;
	quantity: number;
	note: string;
};

export default function SalesReturns() {
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1),
		[search, setSearch] = useState("");
	const [filters, setFilters] = useState<FilterValues>({});
	const status = filters.status || "";
	const [open, setOpen] = useState(false),
		[editing, setEditing] = useState<SalesReturnV1 | null>(null),
		[selected, setSelected] = useState<SalesReturnV1 | null>(null);
	const [printTarget, setPrintTarget] = useState<SalesReturnV1 | null>(null);
	const [orderId, setOrderId] = useState(0),
		[orderMonth, setOrderMonth] = useState(""),
		[warehouseId, setWarehouseId] = useState(0),
		[returnDate, setReturnDate] = useState(today()),
		[reason, setReason] = useState("");
	const [lines, setLines] = useState<ReturnLineInput[]>([]);
	const reportRef = useRef<HTMLDivElement>(null);
	const handlePrint = useReactToPrint({
		contentRef: reportRef,
		documentTitle: printTarget
			? `Phieu-tra-hang-${printTarget.code}`
			: "Phieu-tra-hang",
		pageStyle: "@page { size: A4; margin: 0; }",
	});
	const companyQuery = useQuery({
		queryKey: ["company-profile"],
		queryFn: async () => {
			try {
				const res = await apiV1("/api/v1/company");
				return buildCompanyPrintProfile(res.data);
			} catch {
				return null;
			}
		},
	});

	useMultiEscapeKey([
		{ isOpen: open, onClose: () => setOpen(false), priority: 1 },
		{ isOpen: !!editing, onClose: () => setEditing(null), priority: 2 },
		{ isOpen: !!selected, onClose: () => setSelected(null), priority: 3 },
		{ isOpen: !!printTarget, onClose: () => setPrintTarget(null), priority: 4 },
	]);

	const references = useQuery({
		queryKey: ["return-refs"],
		queryFn: async () => {
			const [warehouses, orders] = await Promise.all([
				legacyApi<Warehouse[]>("/api/warehouses"),
				apiV1<SalesOrder[]>(
					"/api/v1/sales-documents?page=1&limit=100&status=POSTED",
				),
			]);
			return { warehouses, orders: orders.data };
		},
	});
	const documents = useQuery({
		queryKey: ["sales-returns", page, search, status],
		queryFn: () =>
			apiV1<SalesReturnV1[]>(
				`/api/v1/sales-returns?page=${page}&limit=20&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}`,
			),
	});
	const postedReturns = useQuery({
		queryKey: ["sales-return-posted-by-order", orderId],
		enabled: orderId > 0,
		queryFn: () =>
			apiV1<SalesReturnV1[]>(
				`/api/v1/sales-returns?page=1&limit=100&status=POSTED&originalSalesOrderId=${orderId}`,
			),
	});
	const returnedByLine = useMemo(() => {
		const totals = new Map<number, number>();
		for (const document of postedReturns.data?.data || [])
			for (const line of document.lines) {
				totals.set(
					line.originalSalesOrderLineId,
					(totals.get(line.originalSalesOrderLineId) || 0) + line.quantity,
				);
			}
		return totals;
	}, [postedReturns.data]);
	const order = useMemo(
		() => references.data?.orders.find(row => row.id === orderId),
		[references.data, orderId],
	);
	const orderMonths = useMemo(() => {
		const months = new Set<string>();
		for (const row of references.data?.orders || []) {
			if (row.orderDate) months.add(row.orderDate.slice(0, 7));
		}
		return [...months].sort().reverse();
	}, [references.data]);
	const filteredOrders = useMemo(() => {
		const rows = references.data?.orders || [];
		return orderMonth
			? rows.filter(row => row.orderDate?.slice(0, 7) === orderMonth)
			: rows;
	}, [references.data, orderMonth]);
	const orderOptions = useMemo(
		() =>
			filteredOrders.map(row => ({
				value: row.id,
				label: `${row.code} - ${row.customerName || ""}`,
				subLabel: `${formatDate(row.orderDate)} • ${formatNumber(row.totalAmount)} đ`,
			})),
		[filteredOrders],
	);

	const chooseOrder = (id: number) => {
		setOrderId(id);
		const next = references.data?.orders.find(order => order.id === id);
		setLines(
			next?.details.map(line => ({
				originalSalesOrderLineId: line.id!,
				quantity: 0,
				note: "",
			})) || [],
		);
	};
	const payload = () => ({
		originalSalesOrderId: orderId,
		warehouseId,
		returnDate,
		reason,
		settlementType: "REDUCE_DEBT",
		lines: lines.filter(line => line.quantity > 0),
	});
	const save = useMutation({
		mutationFn: () => {
			if (!orderId || !warehouseId || reason.trim().length < 3)
				throw new Error("Chọn đơn bán, kho nhận và nhập lý do trả (ít nhất 3 ký tự)");
			return editing
				? apiV1<SalesReturnV1>(`/api/v1/sales-returns/${editing.id}`, {
						method: "PUT",
						body: JSON.stringify({ ...payload(), version: editing.version }),
					})
				: apiV1<SalesReturnV1>("/api/v1/sales-returns", {
						method: "POST",
						body: JSON.stringify(payload()),
					});
		},
		onSuccess: response => {
			toast.success(response.message);
			setOpen(false);
			void queryClient.invalidateQueries({ queryKey: ["sales-returns"] });
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const action = useMutation({
		mutationFn: ({
			document,
			action,
			reason,
		}: {
			document: SalesReturnV1;
			action: "post" | "cancel" | "unpost" | "delete";
			reason?: string;
		}) =>
			apiV1<SalesReturnV1 | { success: boolean; message: string }>(
				`/api/v1/sales-returns/${document.id}/${action}`,
				{
					method: "POST",
					body: JSON.stringify({
						version: document.version,
						...(reason ? { reason } : {}),
					}),
				},
			),
		onSuccess: (response, variables) => {
			toast.success(response.message);
			if (variables.action === "delete") setSelected(null);
			else setSelected(response.data as SalesReturnV1);
			void Promise.all([
				queryClient.invalidateQueries({ queryKey: ["sales-returns"] }),
				queryClient.invalidateQueries({
					queryKey: ["sales-return-posted-by-order"],
				}),
				queryClient.invalidateQueries({ queryKey: ["sales-documents-v1"] }),
			]);
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const create = () => {
		setEditing(null);
		setOrderId(0);
		setOrderMonth("");
		setWarehouseId(finishedGoodsWarehouseId(references.data?.warehouses));
		setReturnDate(today());
		setReason("");
		setLines([]);
		setOpen(true);
	};
	const edit = (document: SalesReturnV1) => {
		setEditing(document);
		setOrderId(document.originalSalesOrderId);
		setOrderMonth(
			references.data?.orders
				.find(row => row.id === document.originalSalesOrderId)
				?.orderDate.slice(0, 7) || "",
		);
		setWarehouseId(document.warehouseId);
		setReturnDate(document.returnDate);
		setReason(document.reason);
		setLines(
			document.lines.map(line => ({
				originalSalesOrderLineId: line.originalSalesOrderLineId,
				quantity: line.quantity,
				note: line.note || "",
			})),
		);
		setOpen(true);
	};
	const duplicate = (document: SalesReturnV1) => {
		setEditing(null);
		setOrderId(document.originalSalesOrderId);
		setOrderMonth(
			references.data?.orders
				.find(row => row.id === document.originalSalesOrderId)
				?.orderDate.slice(0, 7) || "",
		);
		setWarehouseId(document.warehouseId);
		setReturnDate(today());
		setReason(document.reason);
		setLines(
			document.lines.map(line => ({
				originalSalesOrderLineId: line.originalSalesOrderLineId,
				quantity: line.quantity,
				note: line.note || "",
			})),
		);
		setOpen(true);
	};
	const removeLine = (lineId: number) =>
		setLines(current =>
			current.filter(row => row.originalSalesOrderLineId !== lineId),
		);
	const rows = documents.data?.data || [],
		meta = documents.data?.meta as any;
	const visibleRows = useMemo(() => {
		const from = filters.dateFrom || "";
		const to = filters.dateTo || "";
		return rows.filter(document => {
			const date = (document.returnDate || "").slice(0, 10);
			if (from && date < from) return false;
			if (to && date > to) return false;
			return true;
		});
	}, [rows, filters]);

	const exportSalesReturnList = () =>
		exportExcelFile(
			"danh-sach-tra-hang-ban.xlsx",
			"Tra hang ban",
			[
				{ header: "Mã phiếu", value: (row: SalesReturnV1) => row.code },
				{ header: "Ngày trả", value: (row: SalesReturnV1) => row.returnDate },
				{
					header: "Đơn gốc",
					value: (row: SalesReturnV1) => row.originalSalesOrderCode || "",
				},
				{
					header: "Khách hàng",
					value: (row: SalesReturnV1) => row.customerName || "",
					width: 28,
				},
				{
					header: "Kho nhận",
					value: (row: SalesReturnV1) => row.warehouseName || "",
				},
				{
					header: "Lý do",
					value: (row: SalesReturnV1) => row.reason || "",
					width: 30,
				},
				{
					header: "Giảm công nợ",
					value: (row: SalesReturnV1) => Number(row.totalAmount || 0),
				},
				{
					header: "Giá vốn nhập",
					value: (row: SalesReturnV1) => Number(row.costAmount || 0),
				},
				{
					header: "Trạng thái",
					value: (row: SalesReturnV1) =>
						statusLabel[row.status] || row.status,
				},
			],
			visibleRows,
		);

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Trả hàng bán</h1>
					<p>
						Đối soát chứng từ bán hàng với khách hàng, lập phiếu trả hàng để
						giảm công nợ và nhập lại hàng hóa về kho. Chỉ phiếu đã lưu mới
						tác động tồn và công nợ.
					</p>
				</div>
				<button className="erp-btn erp-btn-primary" onClick={create}>
					<Plus size={16} /> Lập phiếu trả
				</button>
			</div>
			<div className="erp-card overflow-hidden">
				<ListToolbar
					fields={SALES_RETURN_FILTER_FIELDS}
					values={filters}
					onChange={next => {
						setFilters(next);
						setPage(1);
					}}
					onExport={exportSalesReturnList}
					exportDisabled={visibleRows.length === 0}
					search={
						<div className="erp-search">
							<Search size={16} />
							<input
								value={search}
								onChange={event => {
									setSearch(event.target.value);
									setPage(1);
								}}
								placeholder="Tìm phiếu trả, đơn gốc, khách hàng..."
							/>
						</div>
					}
				/>
				{documents.isLoading ? (
					<div className="p-12 text-center">Đang tải...</div>
				) : documents.isError ? (
					<div className="p-12 text-center text-red-600">
						{(documents.error as Error).message}
					</div>
				 ) : !visibleRows.length ? (
					<div className="erp-empty">
						<PackagePlus size={48} />
						<p>Chưa có phiếu trả hàng.</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead>
								<tr>
									<th>Phiếu / Ngày</th>
									<th>Đơn gốc / Khách hàng</th>
									<th>Kho nhận</th>
									<th>Lý do</th>
									<th>Giảm công nợ</th>
									<th>Giá vốn nhập</th>
									<th>Trạng thái</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{visibleRows.map(document => (
									<tr key={document.id}>
										<td>
											<button
												className="font-bold text-[#422afb] hover:underline"
												onClick={() => setSelected(document)}
											>
												{document.code}
											</button>
											<small>
												{formatDate(document.returnDate)} · v{document.version}
											</small>
										</td>
										<td>
											{document.originalSalesOrderCode}
											<small>{document.customerName}</small>
										</td>
										<td>{document.warehouseName}</td>
										<td className="max-w-[240px]" title={document.reason}>
											{document.reason}
										</td>
										<td>{formatNumber(document.totalAmount)} ₫</td>
										<td>{formatNumber(document.costAmount)} ₫</td>
										<td>
											<span className={`erp-badge ${badge[document.status]}`}>
												{statusLabel[document.status] || document.status}
											</span>
										</td>
										<td>
											<TableActions
												actions={[
													{
														key: "view",
														label: "Xem chi tiết",
														icon: <Eye size={15} />,
														onClick: () => setSelected(document),
													},
													{
														key: "duplicate",
														label: "Nhân bản",
														icon: <Copy size={15} />,
														onClick: () => duplicate(document),
													},
													{
														key: "print",
														label: "In phiếu",
														icon: <Printer size={15} />,
														onClick: () => setPrintTarget(document),
													},
													{
														key: "post",
														label: "Lưu",
														icon: <CheckCircle2 size={15} />,
														tone: "success",
														disabled: document.status !== "DRAFT",
														hidden: document.status !== "DRAFT",
														onClick: () =>
															action.mutate({ document, action: "post" }),
													},
													{
														key: "unpost",
														label: "Hủy lưu",
														icon: <Undo2 size={15} />,
														tone: "danger",
														hidden: document.status !== "POSTED",
														onClick: async () => {
															if (
																await confirm(
																	`Hủy lưu phiếu ${document.code}? Tồn kho và công nợ sẽ được hoàn lại, phiếu trở về nháp.`,
																)
															)
																action.mutate({
																	document,
																	action: "unpost",
																});
														},
													},
													{
														key: "delete",
														label: "Xóa phiếu",
														icon: <Trash2 size={15} />,
														tone: "danger",
														hidden: !["DRAFT", "CANCELLED"].includes(
															document.status,
														),
														onClick: async () => {
															if (
																await confirm(
																	`Xóa phiếu ${document.code}? Thao tác không thể hoàn tác.`,
																)
															)
																action.mutate({
																	document,
																	action: "delete",
																});
														},
													},
												]}
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				{meta?.totalPages > 1 && (
					<div className="erp-pagination">
						<button
							className="erp-btn"
							disabled={page <= 1}
							onClick={() => setPage(value => value - 1)}
						>
							Trước
						</button>
						<span>
							Trang {page}/{meta.totalPages}
						</span>
						<button
							className="erp-btn"
							disabled={page >= meta.totalPages}
							onClick={() => setPage(value => value + 1)}
						>
							Sau
						</button>
					</div>
				)}
			</div>
			{open && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-5xl">
						<div className="erp-modal-header">
							<div>
								<h2>
									{editing ? `Sửa ${editing.code}` : "Lập phiếu trả hàng"}
								</h2>
								<p>Chỉ phiếu đã lưu mới tác động tồn và công nợ.</p>
							</div>
							<button onClick={() => setOpen(false)}>
								<X />
							</button>
						</div>
						<form
							onSubmit={event => {
								event.preventDefault();
								save.mutate();
							}}
						>
							<div className="erp-modal-body space-y-5">
								<div className="grid gap-4 md:grid-cols-5">
									<label>
										Tháng đơn bán
										<select
											disabled={Boolean(editing)}
											value={orderMonth}
											onChange={event => {
												const value = event.target.value;
												setOrderMonth(value);
												const current = references.data?.orders.find(
													row => row.id === orderId,
												);
												if (
													value &&
													current &&
													current.orderDate?.slice(0, 7) !== value
												)
													chooseOrder(0);
											}}
										>
											<option value="">Tất cả các tháng</option>
											{orderMonths.map(month => (
												<option key={month} value={month}>
													Tháng {month.slice(5, 7)}/{month.slice(0, 4)}
												</option>
											))}
										</select>
									</label>
									<label>
										Đơn bán gốc
										<SearchableSelect
											value={orderId}
											options={orderOptions}
											onChange={chooseOrder}
											disabled={Boolean(editing)}
											placeholder="Chọn đơn đã lưu"
										/>
									</label>
								<label>
									Ngày trả
									<DateInput
										value={returnDate}
										onChange={value => setReturnDate(value)}
									/>
								</label>
									<label>
										Kho nhận
										<select
											value={warehouseId}
											onChange={event => setWarehouseId(+event.target.value)}
										>
											<option value={0}>Chọn kho</option>
											{references.data?.warehouses.map(warehouse => (
												<option key={warehouse.id} value={warehouse.id}>
													{warehouse.name}
												</option>
											))}
										</select>
									</label>
									<label>
										Lý do
										<input
											value={reason}
											onChange={event => setReason(event.target.value)}
										/>
									</label>
								</div>
								{order && (
									<div className="overflow-x-auto rounded border">
										<table className="erp-table">
											<thead>
												<tr>
													<th className="w-12 text-center">STT</th>
													<th>Hàng hóa</th>
													<th>Loại</th>
													<th>Đã bán</th>
													<th>Đã trả</th>
													<th>Còn trả</th>
													<th>SL trả lần này</th>
													<th>Doanh thu dòng</th>
													<th>Giá vốn</th>
													<th className="w-24 text-right">Chức năng</th>
												</tr>
											</thead>
											<tbody>
												{order.details
													.filter(line =>
														lines.some(
															row => row.originalSalesOrderLineId === line.id,
														),
													)
													.map((line, index) => {
													const input = lines.find(
														row => row.originalSalesOrderLineId === line.id,
													);
													const alreadyReturned =
														returnedByLine.get(line.id!) || 0;
													const returnable = Math.max(
														0,
														line.quantity - alreadyReturned,
													);
													return (
														<tr key={line.id}>
															<td className="text-center">{index + 1}</td>
															<td>
																{formatProductName(
																	line.productName,
																	line.packagingName,
																)}
																<small>{line.sku}</small>
															</td>
															<td>{line.lineType || "SALE"}</td>
															<td>
																{formatNumber(line.quantity)} {line.unit}
															</td>
															<td>
																{formatNumber(alreadyReturned)} {line.unit}
															</td>
															<td className="font-bold text-emerald-700">
																{formatNumber(returnable)} {line.unit}
															</td>
															<td>
																<input
																	className="w-28"
																	type="number"
																	min={0}
																	max={returnable}
																	step="any"
																	value={input?.quantity || 0}
																	onChange={event =>
																		setLines(current =>
																			current.map(row =>
																				row.originalSalesOrderLineId === line.id
																					? {
																							...row,
																							quantity: +event.target.value,
																						}
																					: row,
																			),
																		)
																	}
																/>
															</td>
															<td>{formatNumber(line.lineTotal || 0)} ₫</td>
															<td>{formatNumber(line.costAmount || 0)} ₫</td>
															<td className="text-right">
																<button
																	type="button"
																	className="erp-btn text-red-600 !px-2"
																	title="Xóa mặt hàng khỏi phiếu trả"
																	onClick={() => removeLine(line.id!)}
																>
																	<Trash2 size={15} />
																</button>
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								)}
								<p className="text-xs text-[#a3aed0]">
									Giá trị trả được giảm trừ công nợ; trường hợp giá trị trả vượt
									công nợ, V1 chưa hỗ trợ hoàn tiền.
								</p>
							</div>
							<div className="erp-modal-footer">
								<button
									type="button"
									className="erp-btn"
									onClick={() => setOpen(false)}
								>
									Hủy
								</button>
								<button
									className="erp-btn erp-btn-primary"
									disabled={save.isPending || postedReturns.isLoading}
								>
									{save.isPending ? "Đang lưu..." : "Lưu nháp"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
			{selected && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-4xl">
						<div className="erp-modal-header">
							<div>
								<h2>{selected.code}</h2>
								<p>
									{selected.originalSalesOrderCode} · {selected.customerName}
								</p>
							</div>
							<button onClick={() => setSelected(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<span className={`erp-badge ${badge[selected.status]}`}>
								{statusLabel[selected.status] || selected.status}
							</span>
							<table className="erp-table">
								<thead>
								<tr>
									<th className="w-12 text-center">STT</th>
									<th>Hàng hóa</th>
									<th>SL trả</th>
									<th>Giảm doanh thu + thuế</th>
									<th>Giá vốn nhập lại</th>
								</tr>
							</thead>
							<tbody>
								{selected.lines.map((line, index) => (
									<tr key={line.id}>
										<td className="text-center">{index + 1}</td>
										<td>
												{formatProductName(
													line.productName,
													line.packagingName,
												)}
												<small>{line.lineType}</small>
											</td>
											<td>
												{formatNumber(line.quantity)} {line.unit}
											</td>
											<td>{formatNumber(line.lineTotal + line.taxAmount)} ₫</td>
											<td>{formatNumber(line.costAmount)} ₫</td>
										</tr>
									))}
								</tbody>
							</table>
							{selected.links.length > 0 && (
								<div className="rounded bg-slate-50 p-3">
									{selected.links.map(link => (
										<span
											className="erp-badge bg-blue-100 text-blue-700"
											key={link.id}
										>
											{link.linkType}: {link.linkedCode}
										</span>
									))}
								</div>
							)}
						</div>
						<div className="erp-modal-footer">
							<button
								className="erp-btn erp-btn-primary"
								disabled={selected.status !== "DRAFT"}
								title={
									selected.status === "DRAFT"
										? "Sửa phiếu"
										: "Phiếu đã lưu — hủy lưu để khôi phục tồn kho trước khi sửa"
								}
								onClick={() => {
									edit(selected);
									setSelected(null);
								}}
							>
								<Edit size={16} /> Sửa
							</button>
							<DetailOptionsMenu
								actions={[
									{
										key: "print",
										label: "In phiếu trả",
										icon: <Printer size={15} />,
										onClick: () => setPrintTarget(selected),
									},
									{
										key: "duplicate",
										label: "Nhân bản",
										icon: <Copy size={15} />,
										onClick: () => {
											setSelected(null);
											duplicate(selected);
										},
									},
								]}
							/>
							{selected.status === "DRAFT" && (
								<button
									className="erp-btn erp-btn-post"
									disabled={action.isPending}
									onClick={() =>
										action.mutate({ document: selected, action: "post" })
									}
								>
									<CheckCircle2 size={16} />{" "}
									{action.isPending ? "Đang lưu..." : "Lưu"}
								</button>
							)}
							{selected.status === "POSTED" && (
								<button
									className="erp-btn erp-btn-unpost"
									disabled={action.isPending}
									onClick={async () => {
										if (
											await confirm(
												`Hủy lưu phiếu ${selected.code}? Tồn kho và công nợ sẽ được hoàn lại, phiếu trở về nháp.`,
											)
										)
											action.mutate({
												document: selected,
												action: "unpost",
											});
									}}
								>
									<Undo2 size={16} /> Hủy lưu
								</button>
							)}
							{["DRAFT", "CANCELLED"].includes(selected.status) && (
								<button
									className="erp-btn erp-btn-danger"
									disabled={action.isPending}
									onClick={async () => {
										if (
											await confirm(
												`Xóa phiếu ${selected.code}? Thao tác không thể hoàn tác.`,
											)
										)
											action.mutate({
												document: selected,
												action: "delete",
											});
									}}
								>
									<Trash2 size={16} /> Xóa phiếu
								</button>
							)}
							<button className="erp-btn" onClick={() => setSelected(null)}>
								Đóng
							</button>
						</div>
					</div>
				</div>
			)}
			{printTarget && (
				<div className="sales-print-view fixed inset-0 z-[9999] flex flex-col bg-gray-900/90 backdrop-blur-md">
					<div className="bg-white border-b p-4 flex items-center justify-between no-print shadow-md">
						<div className="flex items-center gap-4">
							<h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
								Phiếu trả hàng
							</h3>
							<span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">
								{printTarget.code}
							</span>
						</div>
						<div className="flex items-center gap-3">
							<button
								onClick={() => setPrintTarget(null)}
								className="px-6 py-2 border rounded-lg font-black text-gray-500 hover:bg-gray-50 transition-all uppercase text-[10px] tracking-widest"
							>
								Đóng
							</button>
							<button
								onClick={handlePrint}
								className="erp-btn erp-btn-primary !px-6 uppercase tracking-widest text-[10px]"
							>
								<Printer size={16} /> In phiếu ngay
							</button>
						</div>
					</div>
					<div className="flex-1 overflow-auto p-8 bg-gray-200/50">
						<div
							ref={reportRef}
							className="sales-print-view shadow-2xl bg-white mx-auto mb-8 w-[210mm] max-w-full"
						>
							<SalesReturnDocument
								document={printTarget}
								company={companyQuery.data}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

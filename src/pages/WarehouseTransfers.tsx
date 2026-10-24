import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowRight,
	ArrowRightLeft,
	CheckCircle2,
	Copy,
	Edit,
	Eye,
	PackageCheck,
	Plus,
	Printer,
	Search,
	Trash2,
	Truck,
	Undo2,
	X,
} from "lucide-react";
import toast from "../components/ui/toast";
import { confirm, prompt } from "../components/ui/confirm";
import { apiV1, legacyApi } from "../lib/apiV1";
import SearchableSelect from "../components/SearchableSelect";
import PrintPreview from "../components/PrintPreview";
import { formatDate, formatNumber, formatProductName } from "../lib/utils";
import {
	fillGenericDocument,
	GENERIC_LAYOUTS,
	type CompanyPrintProfile,
} from "../lib/printTemplate";
import type {
	InventoryBalanceV1,
	Product,
	Warehouse,
	WarehouseTransferV1,
} from "../types";
import ListToolbar from "../components/ListToolbar";
import type { FilterField, FilterValues } from "../components/FilterDrawer";
import { exportExcelFile } from "../lib/excelExport";
import { useMultiEscapeKey } from "../hooks/useEscapeKey";
import { DateInput } from "../components/DateRangeCalendar";
import TableActions from "../components/TableActions";

type TransferLine = { packagingId: number; quantity: number; note: string };
type TransferForm = {
	transferDate: string;
	fromWarehouseId: number;
	toWarehouseId: number;
	note: string;
};
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): TransferLine => ({
	packagingId: 0,
	quantity: 1,
	note: "",
});
const emptyForm = (): TransferForm => ({
	transferDate: today(),
	fromWarehouseId: 0,
	toWarehouseId: 0,
	note: "",
});
const statusMeta = {
	DRAFT: { label: "Nháp", css: "bg-slate-100 text-slate-700", icon: Edit },
	IN_TRANSIT: {
		label: "Đang vận chuyển",
		css: "bg-amber-100 text-amber-700",
		icon: Truck,
	},
	RECEIVED: {
		label: "Đã nhận",
		css: "bg-emerald-100 text-emerald-700",
		icon: CheckCircle2,
	},
	CANCELLED: { label: "Đã hủy", css: "bg-red-100 text-red-700", icon: Undo2 },
} as const;

const TRANSFER_FILTER_FIELDS: FilterField[] = [
	{
		type: "select",
		key: "status",
		label: "Trạng thái",
		options: [
			{ value: "DRAFT", label: "Nháp" },
			{ value: "IN_TRANSIT", label: "Đang vận chuyển" },
			{ value: "RECEIVED", label: "Đã nhận" },
			{ value: "CANCELLED", label: "Đã hủy" },
		],
	},
	{
		type: "dateRange",
		key: "transferDate",
		label: "Thời gian",
		fromKey: "dateFrom",
		toKey: "dateTo",
	},
];

export default function WarehouseTransfers() {
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1),
		[search, setSearch] = useState("");
	const [filters, setFilters] = useState<FilterValues>({});
	const status = filters.status || "";
	const [fromFilter, setFromFilter] = useState(0),
		[toFilter, setToFilter] = useState(0);
	const [open, setOpen] = useState(false),
		[editing, setEditing] = useState<WarehouseTransferV1 | null>(null),
		[selected, setSelected] = useState<WarehouseTransferV1 | null>(null),
		[printTarget, setPrintTarget] = useState<WarehouseTransferV1 | null>(null);

	useMultiEscapeKey([
		{ isOpen: open, onClose: () => setOpen(false), priority: 1 },
		{ isOpen: !!editing, onClose: () => setEditing(null), priority: 2 },
		{ isOpen: !!selected, onClose: () => setSelected(null), priority: 3 },
		{ isOpen: !!printTarget, onClose: () => setPrintTarget(null), priority: 4 },
	]);
	const [form, setForm] = useState<TransferForm>(emptyForm()),
		[lines, setLines] = useState<TransferLine[]>([emptyLine()]);

	const references = useQuery({
		queryKey: ["transfer-references"],
		queryFn: async () => {
			const [warehouses, products] = await Promise.all([
				legacyApi<Warehouse[]>("/api/warehouses"),
				legacyApi<Product[]>("/api/products"),
			]);
			return { warehouses, products };
		},
	});
	const documents = useQuery({
		queryKey: [
			"warehouse-transfers-v1",
			page,
			search,
			status,
			fromFilter,
			toFilter,
		],
		queryFn: () =>
			apiV1<WarehouseTransferV1[]>(
				`/api/v1/warehouse-transfers?page=${page}&limit=20&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}${fromFilter ? `&fromWarehouseId=${fromFilter}` : ""}${toFilter ? `&toWarehouseId=${toFilter}` : ""}`,
			),
	});
	const sourceBalances = useQuery({
		queryKey: ["inventory-balances-v1", form.fromWarehouseId],
		enabled: open && form.fromWarehouseId > 0,
		queryFn: () =>
			apiV1<InventoryBalanceV1[]>(
				`/api/v1/inventory/balances?warehouseId=${form.fromWarehouseId}`,
			),
	});
	const options = useMemo(() => {
		const balanceRows = sourceBalances.data?.data;
		if (form.fromWarehouseId > 0 && balanceRows) {
			return balanceRows.map(row => ({
				id: row.packagingId,
				productName: row.productName,
				name: row.packagingName,
				sku: row.sku,
				unit: row.unit,
				stock: row.quantity,
			}));
		}
		return (references.data?.products || []).flatMap(product =>
			(product.packagings || []).map(packaging => ({
				...packaging,
				productName: product.name,
			})),
		);
	}, [references.data, form.fromWarehouseId, sourceBalances.data]);
	const productSearchOptions = useMemo(
		() =>
			options.map(option => ({
				value: option.id,
				label: option.productName,
				subLabel:
					[
						option.name !== option.productName ? option.name : null,
						option.sku ? `SKU: ${option.sku}` : null,
						"stock" in option && option.stock !== undefined
							? `Tồn: ${formatNumber(option.stock)}`
							: null,
					]
						.filter(Boolean)
						.join(" | ") || undefined,
			})),
		[options],
	);
	const invalidate = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: ["warehouse-transfers-v1"] }),
			queryClient.invalidateQueries({ queryKey: ["inventory-balances-v1"] }),
			queryClient.invalidateQueries({
				queryKey: ["inventory-reconciliation-v1"],
			}),
		]);

	const saveMutation = useMutation({
		mutationFn: () => {
			if (
				!form.fromWarehouseId ||
				!form.toWarehouseId ||
				form.fromWarehouseId === form.toWarehouseId
			)
				throw new Error("Kho nguồn và kho đích phải khác nhau");
			if (
				!lines.length ||
				lines.some(line => !line.packagingId || line.quantity <= 0)
			)
				throw new Error("Chi tiết chuyển kho không hợp lệ");
			if (new Set(lines.map(line => line.packagingId)).size !== lines.length)
				throw new Error("Một quy cách không được chuyển nhiều dòng");
			const payload = { ...form, details: lines };
			return editing
				? apiV1<WarehouseTransferV1>(
						`/api/v1/warehouse-transfers/${editing.id}`,
						{
							method: "PUT",
							body: JSON.stringify({ ...payload, version: editing.version }),
						},
					)
				: apiV1<WarehouseTransferV1>("/api/v1/warehouse-transfers", {
						method: "POST",
						body: JSON.stringify(payload),
					});
		},
		onSuccess: response => {
			toast.success(response.message);
			setSelected(response.data);
			setOpen(false);
			setEditing(null);
			void invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const actionMutation = useMutation({
		mutationFn: ({
			document,
			action,
			reason,
		}: {
			document: WarehouseTransferV1;
			action: "ship" | "receive" | "cancel" | "unpost";
			reason?: string;
		}) =>
			apiV1<WarehouseTransferV1>(
				`/api/v1/warehouse-transfers/${document.id}/${action}`,
				{
					method: "POST",
					body: JSON.stringify(
						action === "cancel"
							? { version: document.version, reason }
							: { version: document.version },
					),
				},
			),
		onSuccess: response => {
			toast.success(response.message);
			setSelected(response.data);
			void invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const deleteMutation = useMutation({
		mutationFn: (document: WarehouseTransferV1) =>
			apiV1(`/api/v1/warehouse-transfers/${document.id}/delete`, {
				method: "POST",
				body: JSON.stringify({ version: document.version }),
			}),
		onSuccess: response => {
			toast.success(response.message);
			setSelected(null);
			void invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const create = () => {
		const warehouses = references.data?.warehouses || [];
		setEditing(null);
		setForm({
			...emptyForm(),
			fromWarehouseId: warehouses[0]?.id || 0,
			toWarehouseId: warehouses[1]?.id || 0,
		});
		setLines([emptyLine()]);
		setOpen(true);
	};
	const edit = (document: WarehouseTransferV1) => {
		setEditing(document);
		setForm({
			transferDate: document.transferDate,
			fromWarehouseId: document.fromWarehouseId,
			toWarehouseId: document.toWarehouseId,
			note: document.note || "",
		});
		setLines(
			document.details.map(line => ({
				packagingId: line.packagingId,
				quantity: line.quantity,
				note: line.note || "",
			})),
		);
		setOpen(true);
	};
	const duplicate = (document: WarehouseTransferV1) => {
		setEditing(null);
		setForm({
			transferDate: today(),
			fromWarehouseId: document.fromWarehouseId,
			toWarehouseId: document.toWarehouseId,
			note: document.note || "",
		});
		setLines(
			document.details.map(line => ({
				packagingId: line.packagingId,
				quantity: line.quantity,
				note: line.note || "",
			})),
		);
		setOpen(true);
	};
	const act = async (
		document: WarehouseTransferV1,
		action: "ship" | "receive" | "cancel" | "unpost",
	) => {
		if (
			action === "ship" &&
			!(await confirm(
				`Xuất hàng khỏi ${document.fromWarehouseName}? Tồn kho nguồn sẽ giảm.`,
			))
		)
			return;
		if (
			action === "receive" &&
			!(await confirm(
				`Xác nhận đã nhận đủ hàng tại ${document.toWarehouseName}?`,
			))
		)
			return;
		if (
			action === "unpost" &&
			!(await confirm(
				`Hủy lưu phiếu ${document.code}? Tồn kho hai kho sẽ được hoàn lại và phiếu trở về nháp.`,
			))
		)
			return;
		const reason =
			action === "cancel"
				? await prompt({
						title: "Hủy phiếu chuyển kho",
						message: "Nhập lý do hủy:",
						minLength: 3,
					})
				: undefined;
		if (action === "cancel" && !reason) return;
		actionMutation.mutate({ document, action, reason: reason?.trim() });
	};
	const updateLine = (index: number, patch: Partial<TransferLine>) =>
		setLines(rows =>
			rows.map((line, lineIndex) =>
				lineIndex === index ? { ...line, ...patch } : line,
			),
		);
	const rows = documents.data?.data || [],
		meta = documents.data?.meta;
	const inTransit = rows.filter(row => row.status === "IN_TRANSIT").length;
	const visibleRows = useMemo(() => {
		const from = filters.dateFrom || "";
		const to = filters.dateTo || "";
		return rows.filter(document => {
			const date = (document.transferDate || "").slice(0, 10);
			if (from && date < from) return false;
			if (to && date > to) return false;
			return true;
		});
	}, [rows, filters]);

	const exportTransferList = () =>
		exportExcelFile(
			"danh-sach-dieu-chuyen-kho.xlsx",
			"Dieu chuyen kho",
			[
				{ header: "Mã phiếu", value: (row: WarehouseTransferV1) => row.code },
				{
					header: "Ngày chuyển",
					value: (row: WarehouseTransferV1) => row.transferDate,
				},
				{
					header: "Kho nguồn",
					value: (row: WarehouseTransferV1) => row.fromWarehouseName || "",
				},
				{
					header: "Kho đích",
					value: (row: WarehouseTransferV1) => row.toWarehouseName || "",
				},
				{
					header: "Tổng số dòng",
					value: (row: WarehouseTransferV1) => row.details?.length || 0,
				},
				{
					header: "Tổng giá trị",
					value: (row: WarehouseTransferV1) =>
						(row.details || []).reduce(
							(sum, detail) => sum + Number(detail.totalValue || 0),
							0,
						),
				},
				{
					header: "Trạng thái",
					value: (row: WarehouseTransferV1) =>
						statusMeta[row.status]?.label || row.status,
				},
				{
					header: "Ghi chú",
					value: (row: WarehouseTransferV1) => row.note || "",
					width: 30,
				},
			],
			visibleRows,
		);

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Chuyển kho</h1>
					<p>
						Xuất giao tại kho nguồn, theo dõi hàng đi đường và xác nhận nhận tại
						kho đích
					</p>
				</div>
				<button
					className="erp-btn erp-btn-primary"
					onClick={create}
					disabled={(references.data?.warehouses.length || 0) < 2}
				>
					<Plus size={17} /> Lập phiếu chuyển
				</button>
			</div>
			<div className="grid gap-4 md:grid-cols-3">
				<div className="erp-stat">
					<ArrowRightLeft size={20} />
					<div>
						<span>Tổng phiếu</span>
						<strong>{formatNumber(meta?.total || 0)}</strong>
					</div>
				</div>
				<div className="erp-stat">
					<Truck size={20} />
					<div>
						<span>Đang vận chuyển</span>
						<strong>{formatNumber(inTransit)}</strong>
					</div>
				</div>
				<div className="erp-stat">
					<PackageCheck size={20} />
					<div>
						<span>Quy trình</span>
						<strong>2 bước</strong>
					</div>
				</div>
			</div>
			{(references.data?.warehouses.length || 0) < 2 && (
				<div className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-800">
					Cần ít nhất hai kho để thực hiện điều chuyển.
				</div>
			)}
			<div className="erp-card overflow-hidden">
				<ListToolbar
					className="flex-wrap"
					fields={TRANSFER_FILTER_FIELDS}
					values={filters}
					onChange={next => {
						setFilters(next);
						setPage(1);
					}}
					onExport={exportTransferList}
					exportDisabled={visibleRows.length === 0}
					search={
						<div className="erp-search">
							<Search size={17} />
							<input
								value={search}
								onChange={event => {
									setSearch(event.target.value);
									setPage(1);
								}}
								placeholder="Tìm mã phiếu, kho, diễn giải..."
							/>
						</div>
					}
					// extra={
					// 	<>
					// 		<select
					// 			value={fromFilter}
					// 			onChange={event => {
					// 				setFromFilter(+event.target.value);
					// 				setPage(1);
					// 			}}
					// 		>
					// 			<option value={0}>Mọi kho nguồn</option>
					// 			{references.data?.warehouses.map(warehouse => (
					// 				<option key={warehouse.id} value={warehouse.id}>
					// 					{warehouse.name}
					// 				</option>
					// 			))}
					// 		</select>
					// 		<select
					// 			value={toFilter}
					// 			onChange={event => {
					// 				setToFilter(+event.target.value);
					// 				setPage(1);
					// 			}}
					// 		>
					// 			<option value={0}>Mọi kho đích</option>
					// 			{references.data?.warehouses.map(warehouse => (
					// 				<option key={warehouse.id} value={warehouse.id}>
					// 					{warehouse.name}
					// 				</option>
					// 			))}
					// 		</select>
					// 	</>
					// }
				/>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã phiếu / Ngày</th>
								<th>Luồng điều chuyển</th>
								<th>Hàng hóa</th>
								<th>Trạng thái</th>
								<th>Thao tác</th>
							</tr>
						</thead>
						<tbody>
							{documents.isLoading ? (
								<tr>
									<td colSpan={5} className="text-center">
										Đang tải...
									</td>
								</tr>
							) : visibleRows.length === 0 ? (
								<tr>
									<td colSpan={5} className="text-center text-slate-400">
										Chưa có phiếu chuyển kho
									</td>
								</tr>
							) : (
								rows.map(document => {
									const badge = statusMeta[document.status];
									const StatusIcon = badge.icon;
									return (
										<tr key={document.id}>
											<td>
												<button
													className="font-bold text-emerald-700"
													onClick={() => setSelected(document)}
												>
													{document.code}
												</button>
												<small>
													{formatDate(document.transferDate)} · v
													{document.version}
												</small>
											</td>
											<td>
												<div className="flex items-center gap-2 font-medium">
													<span>{document.fromWarehouseName}</span>
													<ArrowRight size={15} className="text-emerald-600" />
													<span>{document.toWarehouseName}</span>
												</div>
												<small>{document.note}</small>
											</td>
											<td>
												{document.details.slice(0, 2).map(line => (
													<div key={line.id} className="text-sm">
														{formatProductName(
															line.productName,
															line.packagingName,
														)}
														:{" "}
														<b>
															{formatNumber(line.quantity)} {line.unit}
														</b>
													</div>
												))}
												{document.details.length > 2 && (
													<small>
														+{document.details.length - 2} mặt hàng khác
													</small>
												)}
											</td>
											<td>
												<span className={`erp-badge ${badge.css}`}>
													<StatusIcon size={13} />
													{badge.label}
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
															key: "ship",
															label: "Xuất giao",
															icon: <Truck size={15} />,
															tone: "warning",
															disabled: actionMutation.isPending,
															hidden: document.status !== "DRAFT",
															onClick: () => act(document, "ship"),
														},
														{
															key: "receive",
															label: "Xác nhận nhận",
															icon: <PackageCheck size={15} />,
															tone: "success",
															disabled: actionMutation.isPending,
															hidden: document.status !== "IN_TRANSIT",
															onClick: () => act(document, "receive"),
														},
														{
															key: "cancel",
															label: "Hủy phiếu",
															icon: <Undo2 size={15} />,
															tone: "danger",
															disabled: actionMutation.isPending,
															hidden: document.status !== "DRAFT",
															onClick: () => act(document, "cancel"),
														},
														{
															key: "unpost",
															label: "Hủy lưu",
															icon: <Undo2 size={15} />,
															tone: "danger",
															disabled: actionMutation.isPending,
															hidden: !(
																["IN_TRANSIT", "RECEIVED"] as string[]
															).includes(document.status),
															onClick: () => act(document, "unpost"),
														},
														{
															key: "delete",
															label: "Xóa phiếu",
															icon: <Trash2 size={15} />,
															tone: "danger",
															disabled: deleteMutation.isPending,
															hidden: !(
																["DRAFT", "CANCELLED"] as string[]
															).includes(document.status),
															onClick: async () => {
																if (
																	await confirm(
																		`Xóa phiếu chuyển kho ${document.code}?`,
																	)
																)
																	deleteMutation.mutate(document);
															},
														},
													]}
												/>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
				<div className="erp-pagination">
					<button
						className="erp-btn"
						disabled={page <= 1}
						onClick={() => setPage(value => value - 1)}
					>
						Trước
					</button>
					<span>
						Trang {page}/{Math.max(1, Number(meta?.totalPages || 1))}
					</span>
					<button
						className="erp-btn"
						disabled={page >= Number(meta?.totalPages || 1)}
						onClick={() => setPage(value => value + 1)}
					>
						Sau
					</button>
				</div>
			</div>
			{open && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-5xl">
						<div className="erp-modal-header">
							<div>
								<h2>
									{editing ? `Sửa ${editing.code}` : "Lập phiếu chuyển kho"}
								</h2>
								<p>
									Lưu nháp trước; chỉ bước Xuất giao mới làm giảm tồn kho nguồn.
								</p>
							</div>
							<button onClick={() => setOpen(false)}>
								<X />
							</button>
						</div>
						<form
							onSubmit={event => {
								event.preventDefault();
								saveMutation.mutate();
							}}
						>
							<div className="erp-modal-body space-y-5">
								<div className="grid gap-4 md:grid-cols-3">
									<label>
										Ngày chuyển
										<DateInput
											value={form.transferDate}
											onChange={value =>
												setForm({ ...form, transferDate: value })
											}
										/>
									</label>
									<label>
										Kho nguồn
										<select
											required
											value={form.fromWarehouseId}
											onChange={event =>
												setForm({
													...form,
													fromWarehouseId: +event.target.value,
												})
											}
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
										Kho đích
										<select
											required
											value={form.toWarehouseId}
											onChange={event =>
												setForm({ ...form, toWarehouseId: +event.target.value })
											}
										>
											<option value={0}>Chọn kho</option>
											{references.data?.warehouses.map(warehouse => (
												<option key={warehouse.id} value={warehouse.id}>
													{warehouse.name}
												</option>
											))}
										</select>
									</label>
								</div>
								{form.fromWarehouseId === form.toWarehouseId &&
									form.fromWarehouseId > 0 && (
										<p className="rounded bg-red-50 p-3 text-sm text-red-700">
											Kho nguồn và kho đích phải khác nhau.
										</p>
									)}
								<div className="overflow-x-auto rounded border">
									<table className="erp-table">
										<thead>
											<tr>
												<th>Hàng hóa / Quy cách</th>
												<th>Số lượng</th>
												<th>Ghi chú</th>
												<th></th>
											</tr>
										</thead>
										<tbody>
											{lines.map((line, index) => (
												<tr key={index}>
													<td className="min-w-64">
														<SearchableSelect
															required
															value={line.packagingId}
															options={productSearchOptions}
															onChange={packagingId =>
																updateLine(index, { packagingId })
															}
															placeholder="Nhập tên/SKU để chọn hàng hóa"
														/>
													</td>
													<td>
														<input
															className="w-36"
															type="number"
															min="0.0001"
															step="0.0001"
															required
															value={line.quantity}
															onChange={event =>
																updateLine(index, {
																	quantity: +event.target.value,
																})
															}
														/>
													</td>
													<td>
														<input
															value={line.note}
															maxLength={500}
															onChange={event =>
																updateLine(index, { note: event.target.value })
															}
														/>
													</td>
													<td>
														<button
															type="button"
															className="erp-icon-btn text-red-500"
															disabled={lines.length === 1}
															onClick={() =>
																setLines(rows =>
																	rows.filter(
																		(_, lineIndex) => lineIndex !== index,
																	),
																)
															}
														>
															<X size={16} />
														</button>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								<button
									type="button"
									className="erp-btn"
									onClick={() => setLines(rows => [...rows, emptyLine()])}
								>
									<Plus size={16} /> Thêm dòng
								</button>
								<label>
									Diễn giải
									<textarea
										rows={3}
										maxLength={1000}
										value={form.note}
										onChange={event =>
											setForm({ ...form, note: event.target.value })
										}
									/>
								</label>
							</div>
							<div className="erp-modal-footer">
								<button
									type="button"
									className="erp-btn"
									onClick={() => setOpen(false)}
								>
									Đóng
								</button>
								<button
									disabled={
										saveMutation.isPending ||
										form.fromWarehouseId === form.toWarehouseId
									}
									className="erp-btn erp-btn-primary"
								>
									{saveMutation.isPending ? "Đang lưu..." : "Lưu nháp"}
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
									{selected.fromWarehouseName} → {selected.toWarehouseName} ·{" "}
									{formatDate(selected.transferDate)}
								</p>
							</div>
							<button onClick={() => setSelected(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<span className={`erp-badge ${statusMeta[selected.status].css}`}>
								{statusMeta[selected.status].label}
							</span>
							<table className="erp-table">
								<thead>
									<tr>
										<th>Hàng hóa</th>
										<th className="text-right">Số lượng</th>
										<th className="text-right">Giá vốn</th>
										<th className="text-right">Giá trị</th>
									</tr>
								</thead>
								<tbody>
									{selected.details.map(line => (
										<tr key={line.id}>
											<td>
												<b>
													{formatProductName(
														line.productName,
														line.packagingName,
													)}
												</b>
												<small>
													{line.sku} · {line.note}
												</small>
											</td>
											<td className="text-right">
												{formatNumber(line.quantity)} {line.unit}
											</td>
											<td className="text-right">
												{formatNumber(line.unitCost)}
											</td>
											<td className="text-right">
												{formatNumber(line.totalValue)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							{selected.links.length > 0 && (
								<div className="rounded bg-slate-50 p-3">
									<b>Chứng từ kho liên kết</b>
									<div className="mt-2 flex flex-wrap gap-2">
										{selected.links.map(link => (
											<span
												className="erp-badge bg-blue-100 text-blue-700"
												key={link.id}
											>
												{link.linkType}: {link.linkedCode || link.linkedId}
											</span>
										))}
									</div>
								</div>
							)}
							{selected.cancelReason && (
								<div className="rounded bg-red-50 p-3 text-red-700">
									Lý do hủy: {selected.cancelReason}
								</div>
							)}
							<div className="flex justify-end gap-2">
								<button
									className="erp-btn"
									onClick={() => setPrintTarget(selected)}
								>
									<Printer size={16} /> In phiếu
								</button>
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
								{selected.status === "DRAFT" && (
									<button
										className="erp-btn erp-btn-primary"
										onClick={() => act(selected, "ship")}
									>
										<Truck size={16} /> Xuất giao
									</button>
								)}
								{selected.status === "IN_TRANSIT" && (
									<button
										className="erp-btn erp-btn-primary"
										onClick={() => act(selected, "receive")}
									>
										<PackageCheck size={16} /> Xác nhận nhận
									</button>
								)}
								{selected.status === "DRAFT" && (
									<button
										className="erp-btn text-red-600"
										onClick={() => act(selected, "cancel")}
									>
										<Undo2 size={16} /> Hủy phiếu
									</button>
								)}
								{(["IN_TRANSIT", "RECEIVED"] as string[]).includes(
									selected.status,
								) && (
									<button
										className="erp-btn text-red-600"
										disabled={actionMutation.isPending}
										onClick={() => act(selected, "unpost")}
									>
										<Undo2 size={16} /> Hủy lưu
									</button>
								)}
								{(["DRAFT", "CANCELLED"] as string[]).includes(
									selected.status,
								) && (
									<button
										className="erp-btn text-red-600"
										disabled={deleteMutation.isPending}
										onClick={async () => {
											if (
												await confirm(`Xóa phiếu chuyển kho ${selected.code}?`)
											)
												deleteMutation.mutate(selected);
										}}
									>
										<Trash2 size={16} /> Xóa phiếu
									</button>
								)}
							</div>
						</div>
					</div>
				</div>
			)}
			<PrintPreview
				open={!!printTarget}
				title={
					printTarget
						? `Xem trước phiếu chuyển kho ${printTarget.code}`
						: "Xem trước in"
				}
				fill={
					printTarget
						? (worksheet, company) => {
								const details = printTarget.details || [];
								const total = details.reduce(
									(sum, line) =>
										sum +
										Number(
											line.totalValue ??
												Number(line.quantity || 0) * Number(line.unitCost || 0),
										),
									0,
								);
								fillGenericDocument(
									worksheet,
									company as CompanyPrintProfile | null,
									GENERIC_LAYOUTS.transfer,
									{
										code: printTarget.code,
										documentDate: printTarget.transferDate,
										title: "PHIẾU XUẤT CHUYỂN KHO",
										partner: `${printTarget.fromWarehouseName || ""} → ${printTarget.toWarehouseName || ""}`,
										dienGiai:
											printTarget.note ||
											`Chuyển hàng từ ${printTarget.fromWarehouseName || ""} sang ${printTarget.toWarehouseName || ""}`,
										total,
										rows: details.map((line, index) => ({
											stt: index + 1,
											sku: line.sku || "",
											name: [line.productName, line.packagingName]
												.filter(Boolean)
												.join(" - "),
											unit: line.unit || "",
											quantity: Number(line.quantity || 0),
											unitPrice: Number(line.unitCost || 0),
											amount: Number(
												line.totalValue ??
													Number(line.quantity || 0) *
														Number(line.unitCost || 0),
											),
										})),
									},
								);
							}
						: null
				}
				onClose={() => setPrintTarget(null)}
			/>
		</div>
	);
}

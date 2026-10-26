import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2,
	ClipboardCheck,
	Copy,
	Download,
	Edit,
	Eye,
	FileSpreadsheet,
	Plus,
	Printer,
	Undo2,
	X,
} from "lucide-react";
import ExcelJS from "exceljs";
import { useReactToPrint } from "react-to-print";
import toast from "../components/ui/toast";
import { confirm, prompt } from "../components/ui/confirm";
import { apiV1, legacyApi } from "../lib/apiV1";
import { formatDate, formatNumber, formatProductName } from "../lib/utils";
import {
	buildCompanyPrintProfile,
	type CompanyPrintProfile,
} from "../lib/printTemplate";
import { StocktakeDocument } from "../components/StocktakeDocument";
import type { InventoryBalanceV1, StocktakeV1, Warehouse } from "../types";
import { useMultiEscapeKey } from "../hooks/useEscapeKey";
import { DateInput } from "../components/DateRangeCalendar";
import TableActions from "../components/TableActions";
import ListToolbar from "../components/ListToolbar";
import type { FilterField, FilterValues } from "../components/FilterDrawer";
import { exportExcelFile } from "../lib/excelExport";

type CountLine = {
	packagingId: number;
	productName?: string;
	packagingName?: string;
	sku?: string;
	unit?: string;
	expectedQuantity: number;
	actualQuantity: number;
};
const today = () => new Date().toISOString().slice(0, 10);
const statusMeta = {
	DRAFT: { label: "Nháp", css: "bg-slate-100 text-slate-700" },
	COMPLETED: { label: "Đã chốt", css: "bg-emerald-100 text-emerald-700" },
	CANCELLED: { label: "Đã hủy", css: "bg-red-100 text-red-700" },
} as const;

const STOCKTAKE_FILTER_FIELDS: FilterField[] = [
	{
		type: "select",
		key: "status",
		label: "Trạng thái",
		options: [
			{ value: "DRAFT", label: "Nháp" },
			{ value: "COMPLETED", label: "Đã chốt" },
			{ value: "CANCELLED", label: "Đã hủy" },
		],
	},
	{
		type: "dateRange",
		key: "date",
		label: "Ngày kiểm kê",
		fromKey: "dateFrom",
		toKey: "dateTo",
	},
];

export default function Stocktake() {
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1),
		[warehouseFilter, setWarehouseFilter] = useState(0);
	const [filters, setFilters] = useState<FilterValues>({});
	const status = filters.status || "";
	const [open, setOpen] = useState(false),
		[editing, setEditing] = useState<StocktakeV1 | null>(null),
		[selected, setSelected] = useState<StocktakeV1 | null>(null);
	const [printTarget, setPrintTarget] = useState<StocktakeV1 | null>(null);
	const printRef = useRef<HTMLDivElement>(null);
	const importInputRef = useRef<HTMLInputElement>(null);
	const handlePrint = useReactToPrint({
		contentRef: printRef,
		documentTitle: printTarget ? `Bien-ban-kiem-ke-${printTarget.code}` : "Bien-ban-kiem-ke",
		pageStyle: "@page { size: A4; margin: 0; }",
	});
	const [date, setDate] = useState(today()),
		[warehouseId, setWarehouseId] = useState(0),
		[note, setNote] = useState(""),
		[lines, setLines] = useState<CountLine[]>([]),
		[loadingSnapshot, setLoadingSnapshot] = useState(false);

	useMultiEscapeKey([
		{ isOpen: open, onClose: () => setOpen(false), priority: 1 },
		{ isOpen: !!editing, onClose: () => setEditing(null), priority: 2 },
		{ isOpen: !!selected, onClose: () => setSelected(null), priority: 3 },
		{ isOpen: !!printTarget, onClose: () => setPrintTarget(null), priority: 4 },
	]);
	const warehouses = useQuery({
		queryKey: ["stocktake-warehouses"],
		queryFn: () => legacyApi<Warehouse[]>("/api/warehouses"),
	});
	const companyQuery = useQuery({
		queryKey: ["company-profile"],
		queryFn: async () => {
			try {
				const response = await apiV1<any>("/api/v1/company");
				return buildCompanyPrintProfile(response.data);
			} catch {
				return null as CompanyPrintProfile | null;
			}
		},
	});
	const documents = useQuery({
		queryKey: ["stocktakes-v1", page, status, warehouseFilter],
		queryFn: () =>
			apiV1<StocktakeV1[]>(
				`/api/v1/inventory/stocktakes?page=${page}&limit=20${status ? `&status=${status}` : ""}${warehouseFilter ? `&warehouseId=${warehouseFilter}` : ""}`,
			),
	});
	const invalidate = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: ["stocktakes-v1"] }),
			queryClient.invalidateQueries({ queryKey: ["inventory-balances-v1"] }),
			queryClient.invalidateQueries({
				queryKey: ["inventory-reconciliation-v1"],
			}),
		]);
	const loadSnapshot = async (nextWarehouseId: number) => {
		setWarehouseId(nextWarehouseId);
		if (!nextWarehouseId) {
			setLines([]);
			return;
		}
		setLoadingSnapshot(true);
		try {
			const response = await apiV1<InventoryBalanceV1[]>(
				`/api/v1/inventory/balances?warehouseId=${nextWarehouseId}`,
			);
			setLines(
				response.data.map(row => ({
					packagingId: row.packagingId,
					productName: row.productName,
					packagingName: row.packagingName,
					sku: row.sku,
					unit: row.unit,
					expectedQuantity: Number(row.quantity),
					actualQuantity: Number(row.quantity),
				})),
			);
			if (!response.data.length)
				toast.error("Kho chưa có dòng số dư để kiểm kê");
		} catch (error) {
			toast.error((error as Error).message);
			setLines([]);
		} finally {
			setLoadingSnapshot(false);
		}
	};
	const downloadImportTemplate = async () => {
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet("Kiem ke");
		sheet.columns = [
			{ header: "SKU", key: "sku", width: 22 },
			{ header: "Tên hàng hóa", key: "name", width: 42 },
			{ header: "ĐVT", key: "unit", width: 12 },
			{ header: "Tồn sổ", key: "expected", width: 16 },
			{ header: "Tồn thực tế", key: "actual", width: 16 },
		];
		for (const line of lines.slice(0, 20)) {
			sheet.addRow({
				sku: line.sku || "",
				name: formatProductName(line.productName, line.packagingName),
				unit: line.unit || "",
				expected: line.expectedQuantity,
				actual: line.expectedQuantity,
			});
		}
		const buffer = await workbook.xlsx.writeBuffer();
		const { saveAs } = await import("file-saver");
		saveAs(
			new Blob([buffer], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
			"Mau_Kiem_Ke_Kho.xlsx",
		);
	};
	const importExcel = async (file?: File) => {
		if (!file) return;
		try {
			const workbook = new ExcelJS.Workbook();
			await workbook.xlsx.load(await file.arrayBuffer());
			const sheet = workbook.worksheets[0];
			if (!sheet) throw new Error("File Excel không có sheet dữ liệu");
			const norm = (value: unknown) =>
				String(value ?? "")
					.normalize("NFD")
					.replace(/[\u0300-\u036f]/g, "")
					.toLowerCase()
					.trim();
			const headerRow = sheet.getRow(1);
			const headers = new Map<string, number>();
			headerRow.eachCell({ includeEmpty: false }, (cell, column) => {
				headers.set(norm(cell.value), column);
			});
			const findColumn = (predicate: (value: string) => boolean) => {
				for (const [header, column] of headers) {
					if (predicate(header)) return column;
				}
				return 0;
			};
			const skuColumn = findColumn(
				header => header.includes("sku") || header.includes("ma hang"),
			);
			const actualColumn = findColumn(
				header => header.includes("thuc te") || header.includes("actual"),
			);
			if (!skuColumn || !actualColumn)
				throw new Error(
					"Không tìm thấy cột SKU và Tồn thực tế. Vui lòng dùng file mẫu.",
				);
			const values = new Map<string, number>();
			const invalidRows: string[] = [];
			sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
				if (rowNumber === 1) return;
				const sku = String(row.getCell(skuColumn).value ?? "").trim();
				const rawActual = row.getCell(actualColumn).value;
				if (!sku && (rawActual === null || rawActual === undefined || rawActual === "")) return;
				const actual = Number(
					typeof rawActual === "number"
						? rawActual
						: String(rawActual ?? "").replace(/,/g, "").trim(),
				);
				if (!sku || Number.isNaN(actual) || actual < 0) {
					invalidRows.push(`Dòng ${rowNumber}`);
					return;
				}
				values.set(norm(sku), actual);
			});
			if (!values.size) throw new Error("File Excel không có dòng dữ liệu hợp lệ");
			const snapshotSkus = new Set(lines.map(line => norm(line.sku)));
			const missing = [...values.keys()].filter(sku => !snapshotSkus.has(sku));
			const matched = lines.reduce(
				(count, line) => (values.has(norm(line.sku)) ? count + 1 : count),
				0,
			);
			setLines(current =>
				current.map(line => {
					const actual = values.get(norm(line.sku));
					return actual === undefined ? line : { ...line, actualQuantity: actual };
				}),
			);
			toast.success(`Đã cập nhật ${matched} dòng kiểm kê từ Excel`);
			if (missing.length)
				toast.error(
					`${missing.length} mã không có trong kho đang kiểm kê: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`,
				);
			if (invalidRows.length)
				toast.error(`Bỏ qua ${invalidRows.length} dòng không hợp lệ: ${invalidRows.slice(0, 5).join(", ")}`);
		} catch (error) {
			toast.error((error as Error).message);
		} finally {
			if (importInputRef.current) importInputRef.current.value = "";
		}
	};
	const saveMutation = useMutation({
		mutationFn: () => {
			if (!warehouseId || !lines.length)
				throw new Error("Chọn kho có số dư để kiểm kê");
			if (lines.some(line => line.actualQuantity < 0))
				throw new Error("Tồn thực tế không được âm");
			const payload = {
				date,
				warehouseId,
				note,
				details: lines.map(line => ({
					packagingId: line.packagingId,
					actualQuantity: line.actualQuantity,
				})),
			};
			return editing
				? apiV1<StocktakeV1>(`/api/v1/inventory/stocktakes/${editing.id}`, {
						method: "PUT",
						body: JSON.stringify({ ...payload, version: editing.version }),
					})
				: apiV1<StocktakeV1>("/api/v1/inventory/stocktakes", {
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
			document: StocktakeV1;
			action: "complete" | "cancel" | "unpost";
			reason?: string;
		}) =>
			apiV1<StocktakeV1>(
				`/api/v1/inventory/stocktakes/${document.id}/${action}`,
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
			setSelected(null);
			void invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const create = () => {
		const first = warehouses.data?.[0]?.id || 0;
		setEditing(null);
		setDate(today());
		setNote("");
		setLines([]);
		setOpen(true);
		if (first) void loadSnapshot(first);
	};
	const edit = (document: StocktakeV1) => {
		setEditing(document);
		setDate(document.date);
		setWarehouseId(document.warehouseId);
		setNote(document.note || "");
		setLines(
			document.details.map(line => ({
				packagingId: line.packagingId,
				productName: line.productName,
				packagingName: line.packagingName,
				sku: line.sku,
				unit: line.unit,
				expectedQuantity: Number(line.expectedQuantity),
				actualQuantity: Number(line.actualQuantity),
			})),
		);
		setOpen(true);
	};
	const duplicate = (document: StocktakeV1) => {
		setEditing(null);
		setDate(today());
		setWarehouseId(document.warehouseId);
		setNote(document.note || "");
		setLines(
			document.details.map(line => ({
				packagingId: line.packagingId,
				productName: line.productName,
				packagingName: line.packagingName,
				sku: line.sku,
				unit: line.unit,
				expectedQuantity: Number(line.expectedQuantity),
				actualQuantity: Number(line.actualQuantity),
			})),
		);
		setOpen(true);
	};
	const rows = documents.data?.data || [],
		meta = documents.data?.meta || {};
	const visibleRows = useMemo(() => {
		const from = filters.dateFrom || "";
		const to = filters.dateTo || "";
		return rows.filter(document => {
			const date = (document.date || "").slice(0, 10);
			if (from && date < from) return false;
			if (to && date > to) return false;
			return true;
		});
	}, [rows, filters]);
	const exportStocktakeList = () =>
		exportExcelFile(
			"phieu-kiem-ke.xlsx",
			"Phieu kiem ke",
			[
				{ header: "Mã phiếu", value: (document: StocktakeV1) => document.code },
				{ header: "Ngày", value: (document: StocktakeV1) => document.date },
				{
					header: "Kho",
					value: (document: StocktakeV1) =>
						document.warehouseName || String(document.warehouseId),
				},
				{
					header: "Trạng thái",
					value: (document: StocktakeV1) =>
						statusMeta[document.status]?.label || document.status,
				},
				{
					header: "Số dòng",
					value: (document: StocktakeV1) => document.details?.length || 0,
				},
				{
					header: "Ghi chú",
					value: (document: StocktakeV1) => document.note || "",
					width: 32,
				},
			],
			visibleRows,
		);
	const changed = lines.filter(
		line => Math.abs(line.actualQuantity - line.expectedQuantity) > 0.0001,
	).length;

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Kiểm kê kho</h1>
					<p>
						Snapshot theo từng kho; chốt bị từ chối nếu tồn sổ thay đổi sau lúc
						lập phiếu.
					</p>
				</div>
				<button className="erp-btn erp-btn-primary" onClick={create}>
					<Plus size={16} /> Lập kiểm kê
				</button>
			</div>
			<div className="grid gap-3 md:grid-cols-3">
				<div className="erp-stat">
					<ClipboardCheck size={20} />
					<div>
						<span>Tổng phiếu</span>
						<strong>{meta.total || 0}</strong>
					</div>
				</div>
				<div className="erp-stat">
					<CheckCircle2 size={20} />
					<div>
						<span>Đã chốt trên trang</span>
						<strong>
							{rows.filter(row => row.status === "COMPLETED").length}
						</strong>
					</div>
				</div>
				<div className="erp-stat">
					<Undo2 size={20} />
					<div>
						<span>Đã hủy trên trang</span>
						<strong>
							{rows.filter(row => row.status === "CANCELLED").length}
						</strong>
					</div>
				</div>
			</div>
			<div className="erp-card">
				<ListToolbar
					className="flex-wrap"
					fields={STOCKTAKE_FILTER_FIELDS}
					values={filters}
					onChange={next => {
						setFilters(next);
						setPage(1);
					}}
					onExport={exportStocktakeList}
					extra={
						<select
							value={warehouseFilter}
							onChange={event => {
								setWarehouseFilter(+event.target.value);
								setPage(1);
							}}
						>
							<option value={0}>Tất cả kho</option>
							{warehouses.data?.map(warehouse => (
								<option key={warehouse.id} value={warehouse.id}>
									{warehouse.name}
								</option>
							))}
						</select>
					}
				/>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã phiếu</th>
								<th>Ngày</th>
								<th>Kho</th>
								<th>Trạng thái</th>
								<th>Số dòng</th>
								<th>Chênh lệch</th>
								<th>Thao tác</th>
							</tr>
						</thead>
						<tbody>
							{documents.isLoading ? (
								<tr>
									<td colSpan={7} className="text-center">
										Đang tải...
									</td>
								</tr>
							) : visibleRows.length === 0 ? (
								<tr>
									<td colSpan={7} className="text-center text-slate-400">
										Chưa có phiếu kiểm kê
									</td>
								</tr>
							) : (
								visibleRows.map(document => {
									const differences = document.details.filter(
										line => Math.abs(Number(line.difference)) > 0.0001,
									).length;
									return (
										<tr key={document.id}>
											<td>
												<b>{document.code}</b>
												<small>{document.note || "-"}</small>
											</td>
											<td>{formatDate(document.date)}</td>
											<td>{document.warehouseName}</td>
											<td>
												<span
													className={`erp-badge ${statusMeta[document.status].css}`}
												>
													{statusMeta[document.status].label}
												</span>
											</td>
											<td>{document.details.length}</td>
											<td>
												<span
													className={`erp-badge ${differences ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
												>
													{differences} dòng
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
															label: "In biên bản",
															icon: <Printer size={15} />,
															onClick: () => setPrintTarget(document),
														},
														{
															key: "complete",
															label: "Chốt kiểm kê",
															icon: <CheckCircle2 size={15} />,
															tone: "success",
															disabled:
																document.status !== "DRAFT" ||
																actionMutation.isPending,
															hidden: document.status !== "DRAFT",
															onClick: async () => {
																if (
																	await confirm(
																		`Chốt ${document.code} và tạo điều chỉnh kho?`,
																	)
																)
																	actionMutation.mutate({
																		document,
																		action: "complete",
																	});
															},
														},
														{
															key: "unpost",
															label: "Hủy lưu",
															icon: <Undo2 size={15} />,
															tone: "danger",
															disabled: actionMutation.isPending,
															hidden: document.status !== "COMPLETED",
															onClick: async () => {
																if (
																	await confirm(
																		`Hủy lưu kiểm kê ${document.code}? Tồn kho sẽ được hoàn lại và phiếu trở về nháp.`,
																	)
																)
																	actionMutation.mutate({
																		document,
																		action: "unpost",
																	});
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
				<div className="flex items-center justify-between p-3 text-sm">
					<span>Tổng {meta.total || 0} phiếu</span>
					<div className="flex gap-2">
						<button
							className="erp-btn"
							disabled={page <= 1}
							onClick={() => setPage(value => value - 1)}
						>
							Trước
						</button>
						<span className="self-center">
							Trang {page}/{meta.totalPages || 1}
						</span>
						<button
							className="erp-btn"
							disabled={page >= Number(meta.totalPages || 1)}
							onClick={() => setPage(value => value + 1)}
						>
							Sau
						</button>
					</div>
				</div>
			</div>
			{open && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-5xl">
						<div className="erp-modal-header">
							<div>
								<h2>{editing ? `Sửa ${editing.code}` : "Lập phiếu kiểm kê"}</h2>
								<p>
									Tồn sổ là snapshot tại lúc lập phiếu, không tự đổi khi nhập
									thực tế.
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
									Ngày kiểm kê
									<DateInput
										value={date}
										onChange={value => setDate(value)}
									/>
								</label>
									<label>
										Kho kiểm kê
										<select
											value={warehouseId}
											required
											onChange={event => void loadSnapshot(+event.target.value)}
										>
											<option value={0}>Chọn kho</option>
											{warehouses.data?.map(warehouse => (
												<option key={warehouse.id} value={warehouse.id}>
													{warehouse.name}
												</option>
											))}
										</select>
									</label>
									<label>
										Ghi chú
										<input
											value={note}
											maxLength={1000}
											onChange={event => setNote(event.target.value)}
										/>
									</label>
								</div>
								<div className="flex flex-wrap items-center gap-2 rounded bg-slate-50 p-3 text-sm">
									<span>
										{lines.length} quy cách · {changed} dòng chênh lệch
									</span>
									{loadingSnapshot && <b>Đang tải snapshot...</b>}
									<div className="ml-auto flex flex-wrap gap-2">
										<button
											type="button"
											className="erp-btn"
											onClick={() => void downloadImportTemplate()}
											disabled={!lines.length}
										>
											<Download size={15} /> Tải file mẫu
										</button>
										<button
											type="button"
											className="erp-btn"
											onClick={() => importInputRef.current?.click()}
											disabled={!lines.length}
										>
											<FileSpreadsheet size={15} /> Nhập Excel
										</button>
										<input
											ref={importInputRef}
											type="file"
											accept=".xlsx,.xls"
											className="hidden"
											onChange={event => void importExcel(event.target.files?.[0])}
										/>
									</div>
								</div>
								<div className="max-h-[50vh] overflow-auto border rounded">
									<table className="erp-table">
										<thead>
											<tr>
												<th className="w-12 text-center">STT</th>
												<th>SKU</th>
												<th>Hàng hóa / Quy cách</th>
												<th>Đơn vị</th>
												<th className="text-right">Tồn sổ</th>
												<th className="text-right">Tồn thực tế</th>
												<th className="text-right">Chênh lệch</th>
											</tr>
										</thead>
										<tbody>
											{lines.length === 0 ? (
												<tr>
													<td
														colSpan={7}
														className="text-center text-slate-400"
													>
														Kho chưa có số dư
													</td>
												</tr>
											) : (
												lines.map((line, index) => {
													const difference =
														line.actualQuantity - line.expectedQuantity;
													return (
														<tr key={line.packagingId}>
															<td className="text-center">{index + 1}</td>
															<td>{line.sku || "-"}</td>
															<td>
																<b>{line.productName}</b>
																<small>{line.packagingName}</small>
															</td>
															<td>{line.unit || "-"}</td>
															<td className="text-right">
																{formatNumber(line.expectedQuantity)}
															</td>
															<td className="text-right">
																<input
																	className="w-28 text-right"
																	type="number"
																	min="0"
																	step="any"
																	value={line.actualQuantity}
																	onChange={event =>
																		setLines(current =>
																			current.map((item, position) =>
																				position === index
																					? {
																							...item,
																							actualQuantity:
																								+event.target.value,
																						}
																					: item,
																			),
																		)
																	}
																/>
															</td>
															<td
																className={`text-right font-bold ${difference > 0 ? "text-emerald-600" : difference < 0 ? "text-red-600" : "text-slate-400"}`}
															>
																{difference > 0 ? "+" : ""}
																{formatNumber(difference)}
															</td>
														</tr>
													);
												})
											)}
										</tbody>
									</table>
								</div>
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
									disabled={
										saveMutation.isPending || loadingSnapshot || !lines.length
									}
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
									{selected.warehouseName} · {formatDate(selected.date)}
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
									<th className="w-12 text-center">STT</th>
									<th>Hàng hóa</th>
									<th className="text-right">Tồn sổ</th>
									<th className="text-right">Thực tế</th>
									<th className="text-right">Chênh lệch</th>
								</tr>
							</thead>
							<tbody>
								{selected.details.map((line, index) => (
									<tr key={line.id}>
										<td className="text-center">{index + 1}</td>
										<td>
												{formatProductName(
													line.productName,
													line.packagingName,
												)}
												<small>{line.sku}</small>
											</td>
											<td className="text-right">
												{formatNumber(line.expectedQuantity)}
											</td>
											<td className="text-right">
												{formatNumber(line.actualQuantity)}
											</td>
											<td
												className={`text-right font-bold ${line.difference ? "text-amber-700" : "text-slate-400"}`}
											>
												{line.difference > 0 ? "+" : ""}
												{formatNumber(line.difference)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							{selected.links?.length ? (
								<div className="rounded bg-slate-50 p-3">
									<b>Chứng từ điều chỉnh</b>
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
							) : null}
							{selected.cancelReason && (
								<div className="rounded bg-red-50 p-3 text-red-700">
									Lý do hủy: {selected.cancelReason}
								</div>
							)}
						</div>
						<div className="erp-modal-footer">
							<button
								type="button"
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
							<button
								type="button"
								className="erp-btn"
								onClick={() => setPrintTarget(selected)}
							>
								<Printer size={16} /> In biên bản
							</button>
							{selected.status === "DRAFT" && (
								<button
									type="button"
									className="erp-btn erp-btn-post"
									disabled={actionMutation.isPending}
									onClick={async () => {
										if (
											await confirm(
												`Lưu ${selected.code} và tạo điều chỉnh kho?`,
											)
										)
											actionMutation.mutate({
												document: selected,
												action: "complete",
											});
									}}
								>
									<CheckCircle2 size={16} /> Lưu
								</button>
							)}
							{selected.status === "COMPLETED" && (
								<button
									type="button"
									className="erp-btn erp-btn-unpost"
									disabled={actionMutation.isPending}
								onClick={async () => {
									if (
										await confirm(
											`Hủy lưu kiểm kê ${selected.code}? Tồn kho sẽ được hoàn lại và phiếu trở về nháp.`,
										)
									)
										actionMutation.mutate({
											document: selected,
											action: "unpost",
										});
								}}
							>
								<Undo2 size={16} /> Hủy lưu
								</button>
							)}
							<button
								type="button"
								className="erp-btn"
								onClick={() => setSelected(null)}
							>
								Đóng
							</button>
						</div>
					</div>
				</div>
			)}
			{printTarget && (
				<div className="sales-print-view fixed inset-0 z-[9999] flex flex-col bg-gray-900/90 backdrop-blur-md">
					<div className="no-print flex items-center justify-between border-b bg-white p-4 shadow-md">
						<div className="flex items-center gap-4">
							<h3 className="text-lg font-black uppercase tracking-tight text-gray-800">
								Biên bản kiểm kê kho
							</h3>
							<span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-500">
								{printTarget.code}
							</span>
						</div>
						<div className="flex items-center gap-3">
							<button
								onClick={() => setPrintTarget(null)}
								className="rounded-lg border px-6 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-all hover:bg-gray-50"
							>
								Đóng
							</button>
							<button
								onClick={handlePrint}
								className="erp-btn erp-btn-primary !px-6 text-[10px] uppercase tracking-widest"
							>
								<Printer size={16} /> In
							</button>
						</div>
					</div>
					<div className="flex-1 overflow-auto bg-gray-200/50 p-8">
						<div className="sales-print-view mx-auto mb-8 w-[210mm] max-w-full bg-white shadow-2xl">
							<StocktakeDocument
								ref={printRef}
								stocktake={printTarget}
								company={companyQuery.data}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

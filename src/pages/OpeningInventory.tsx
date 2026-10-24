import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle,
	Copy,
	Edit,
	Eye,
	FileSpreadsheet,
	Plus,
	Printer,
	Search,
	Trash2,
	X,
	XCircle,
} from "lucide-react";
import toast from "../components/ui/toast";
import { confirm } from "../components/ui/confirm";
import ExcelImportWizard, { type ExcelImportField } from "../components/ExcelImportWizard";
import { apiV1, legacyApi } from "../lib/apiV1";
import SearchableSelect from "../components/SearchableSelect";
import TableActions from "../components/TableActions";
import { formatDate, formatNumber, formatProductName } from "../lib/utils";
import PrintPreview from "../components/PrintPreview";
import {
	fillGenericDocument,
	GENERIC_LAYOUTS,
	type CompanyPrintProfile,
} from "../lib/printTemplate";
import type { Warehouse } from "../types";
import { useMultiEscapeKey } from "../hooks/useEscapeKey";
import { DateInput } from "../components/DateRangeCalendar";
import ListToolbar from "../components/ListToolbar";
import type { FilterField, FilterValues } from "../components/FilterDrawer";
import { exportExcelFile } from "../lib/excelExport";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OpeningLine {
	id?: number;
	packagingId: number;
	quantity: number;
	unitCost: number;
	totalValue?: number;
	batchNumber?: string;
	expiryDate?: string;
	note?: string;
	// display only
	packagingName?: string;
	productName?: string;
	sku?: string;
	unit?: string;
	packaging?: {
		id: number;
		name: string;
		sku?: string | null;
		unit?: string | null;
		products?: { name: string } | null;
	} | null;
}
interface OpeningDocument {
	id: number;
	code: string;
	documentDate: string;
	warehouseId: number;
	status: "DRAFT" | "POSTED" | "CANCELLED";
	note?: string;
	version: number;
	createdAt: string;
	warehouse?: { id: number; name: string } | null;
	_count?: { lines: number };
	lines: OpeningLine[];
}
interface ListResponse {
	data: OpeningDocument[];
	meta: { page: number; limit: number; total: number; totalPages: number };
}

const STATUS_LABEL: Record<string, string> = {
	DRAFT: "Nháp",
	POSTED: "Đã lưu",
	CANCELLED: "Đã hủy",
};
const STATUS_COLOR: Record<string, string> = {
	DRAFT: "bg-amber-100 text-amber-700",
	POSTED: "bg-emerald-100 text-emerald-700",
	CANCELLED: "bg-slate-100 text-slate-500",
};

const OPENING_FILTER_FIELDS: FilterField[] = [
	{
		type: "select",
		key: "status",
		label: "Trạng thái",
		options: [
			{ value: "DRAFT", label: "Nháp" },
			{ value: "POSTED", label: "Đã lưu" },
			{ value: "CANCELLED", label: "Đã hủy" },
		],
	},
	{
		type: "dateRange",
		key: "documentDate",
		label: "Ngày chứng từ",
		fromKey: "dateFrom",
		toKey: "dateTo",
	},
];

const emptyLine = (): OpeningLine => ({
	packagingId: 0,
	quantity: 1,
	unitCost: 0,
});

const IMPORT_FIELDS: ExcelImportField[] = [
	{ key: "warehouse", label: "Kho", description: "Mã hoặc tên kho — cả file dùng chung 1 kho", required: false, locked: false },
	{ key: "sku", label: "Mã hàng (SKU)", description: "Mã SKU quy cách, dùng để khớp hàng hóa", required: true, locked: true },
	{ key: "quantity", label: "Số lượng", description: "Số lượng tồn đầu kỳ (> 0)", required: true, locked: false },
	{ key: "unitCost", label: "Đơn giá vốn", description: "Đơn giá vốn mỗi đơn vị", required: false, locked: false },
	{ key: "batchNumber", label: "Số lô", description: "Số lô hàng (nếu có)", required: false, locked: false },
	{ key: "expiryDate", label: "HSD", description: "Hạn sử dụng, định dạng YYYY-MM-DD", required: false, locked: false },
	{ key: "note", label: "Ghi chú", description: "Ghi chú dòng", required: false, locked: false },
];

// ─── Packaging search component ───────────────────────────────────────────────
interface Packaging {
	id: number;
	name: string;
	sku?: string | null;
	unit?: string | null;
	products: { name: string } | null;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OpeningInventory() {
	const qc = useQueryClient();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [filters, setFilters] = useState<FilterValues>({});
	const statusFilter = filters.status || "";
	const [warehouseFilter, setWarehouseFilter] = useState("");

	// Modal state
	const [open, setOpen] = useState(false);
	const [showImport, setShowImport] = useState(false);
	const [viewDoc, setViewDoc] = useState<OpeningDocument | null>(null);
	const [printTarget, setPrintTarget] = useState<OpeningDocument | null>(null);
	const [editing, setEditing] = useState<OpeningDocument | null>(null);
	const [form, setForm] = useState<{
		documentDate: string;
		warehouseId: number;
		note: string;
		lines: OpeningLine[];
		version?: number;
	}>({
		documentDate: new Date().toISOString().slice(0, 10),
		warehouseId: 0,
		note: "",
		lines: [emptyLine()],
	});

	// Cancel modal
	const [cancelTarget, setCancelTarget] = useState<OpeningDocument | null>(
		null,
	);
	const [cancelReason, setCancelReason] = useState("");

	useMultiEscapeKey([
		{ isOpen: open, onClose: () => setOpen(false), priority: 1 },
		{ isOpen: !!editing, onClose: () => setEditing(null), priority: 2 },
		{ isOpen: !!viewDoc, onClose: () => setViewDoc(null), priority: 3 },
		{ isOpen: !!printTarget, onClose: () => setPrintTarget(null), priority: 4 },
		{
			isOpen: !!cancelTarget,
			onClose: () => setCancelTarget(null),
			priority: 5,
		},
	]);

	// Refs data
	const warehouses = useQuery({
		queryKey: ["warehouses-ref"],
		queryFn: () => legacyApi<Warehouse[]>("/api/warehouses"),
	});
	const packagings = useQuery({
		queryKey: ["packagings-all"],
		queryFn: async () => {
			const res = await apiV1<Packaging[]>(
				"/api/v1/catalog/packagings?limit=1000",
			);
			return res.data ?? [];
		},
		staleTime: 5 * 60 * 1000,
	});
	const costPrices = useQuery({
		queryKey: ["packaging-cost-prices"],
		queryFn: async () => {
			try {
				const res = await apiV1<Array<{ packagingId: number; price: number }>>(
					"/api/v1/catalog/packaging-cost-prices",
				);
				return new Map(
					(res.data || []).map(row => [
						row.packagingId,
						Number(row.price || 0),
					]),
				);
			} catch (error: any) {
				if (error?.status === 401 || error?.status === 403) throw error;
				const products = await legacyApi<any[]>("/api/products");
				const fallback = new Map<number, number>();
				for (const product of products || []) {
					for (const packaging of product.packagings || []) {
						const cost = Number(
							(packaging.prices || []).find(
								(price: any) => price.priceType === "COST",
							)?.price || 0,
						);
						if (cost > 0) fallback.set(packaging.id, cost);
					}
				}
				return fallback;
			}
		},
		staleTime: 5 * 60 * 1000,
		retry: (count, error: any) =>
			error?.status !== 401 && error?.status !== 403 && count < 1,
	});
	const packagingSearchOptions = (
		(packagings.data as Packaging[] | undefined) ?? []
	).map(item => ({
		value: item.id,
		label: item.products?.name ?? item.name,
		subLabel: item.products?.name && item.name !== item.products.name
			? `${item.name}${item.sku ? ` | SKU: ${item.sku}` : ""}`
			: item.sku ? `SKU: ${item.sku}` : undefined,
	}));

	const { data, isLoading, isError, error } = useQuery({
		queryKey: [
			"opening-inventory",
			page,
			search,
			statusFilter,
			warehouseFilter,
		],
		queryFn: () =>
			apiV1<ListResponse>(
				`/api/v1/opening-inventory?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}${warehouseFilter ? `&warehouseId=${warehouseFilter}` : ""}`,
			),
	});

	const getDoc = useQuery({
		queryKey: ["opening-inventory", "detail", viewDoc?.id],
		queryFn: () => apiV1<OpeningDocument>(`/api/v1/opening-inventory/${viewDoc!.id}`),
		enabled: !!viewDoc,
		retry: 1,
	});

	const rows = (data?.data as unknown as OpeningDocument[]) ?? [];
	const visibleRows = useMemo(() => {
		const from = filters.dateFrom || "";
		const to = filters.dateTo || "";
		return rows.filter(doc => {
			const date = (doc.documentDate || "").slice(0, 10);
			if (from && date < from) return false;
			if (to && date > to) return false;
			return true;
		});
	}, [rows, filters]);
	const exportOpeningList = () =>
		exportExcelFile(
			"ton-dau-ky.xlsx",
			"Ton dau ky",
			[
				{ header: "Số phiếu", value: (doc: OpeningDocument) => doc.code },
				{
					header: "Ngày",
					value: (doc: OpeningDocument) => doc.documentDate,
				},
				{
					header: "Kho",
					value: (doc: OpeningDocument) =>
						doc.warehouse?.name || String(doc.warehouseId),
				},
				{
					header: "Số dòng",
					value: (doc: OpeningDocument) =>
						doc._count?.lines ?? doc.lines?.length ?? 0,
				},
				{
					header: "Trạng thái",
					value: (doc: OpeningDocument) => STATUS_LABEL[doc.status] || doc.status,
				},
				{
					header: "Ghi chú",
					value: (doc: OpeningDocument) => doc.note || "",
					width: 32,
				},
			],
			visibleRows,
		);
	const meta = data?.meta as { page: number; limit: number; total: number; totalPages: number } | undefined;
	const viewDocDetail = getDoc.data?.data;
	const getDocError = getDoc.error;

	// Mutations
	const save = useMutation({
		mutationFn: () => {
			if (!form.warehouseId)
				throw new Error("Vui lòng chọn kho nhập tồn đầu kỳ");
			const normalizedLines = form.lines
				.filter(line => line.packagingId > 0)
				.map(line => ({
					packagingId: Number(line.packagingId),
					quantity: Number(line.quantity || 0),
					unitCost: Number(line.unitCost || 0),
					batchNumber: line.batchNumber || null,
					expiryDate: line.expiryDate || null,
					note: line.note || null,
				}));
			if (!normalizedLines.length)
				throw new Error("Vui lòng chọn ít nhất một hàng hóa");
			if (normalizedLines.some(line => !(line.quantity > 0)))
				throw new Error("Số lượng tồn đầu kỳ phải lớn hơn 0");
			const body = {
				documentDate: form.documentDate,
				warehouseId: Number(form.warehouseId),
				note: form.note || null,
				lines: normalizedLines,
				...(editing ? { version: form.version } : {}),
			};
			return editing
				? apiV1<OpeningDocument>(`/api/v1/opening-inventory/${editing.id}`, {
						method: "PUT",
						body: JSON.stringify(body),
					})
				: apiV1<OpeningDocument>("/api/v1/opening-inventory", {
						method: "POST",
						body: JSON.stringify(body),
					});
		},
		onSuccess: r => {
			toast.success(r.message);
			setViewDoc(r.data);
			setOpen(false);
			setPage(1);
			void qc.invalidateQueries({ queryKey: ["opening-inventory"], exact: false });
		},
		onError: (error: any) => {
			if (error?.status === 401) {
				toast.error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
				return;
			}
			if (error?.status === 403) {
				toast.error(
					"Tài khoản chưa có quyền tồn kho đầu kỳ (inventory.opening)",
				);
				return;
			}
			const fieldErrors = error?.fieldErrors
				? Object.entries(error.fieldErrors)
						.map(
							([field, messages]) =>
								`${field}: ${(messages as string[]).join(", ")}`,
						)
						.join("\n")
				: "";
			toast.error(
				[error.message || "Không lưu được phiếu tồn đầu kỳ", fieldErrors]
					.filter(Boolean)
					.join("\n"),
			);
		},
	});

	const post = useMutation({
		mutationFn: (doc: OpeningDocument) =>
			apiV1<OpeningDocument>(`/api/v1/opening-inventory/${doc.id}/post`, {
				method: "POST",
				body: JSON.stringify({ version: doc.version }),
			}),
		onSuccess: r => {
			toast.success(r.message);
			setViewDoc(null);
			void qc.invalidateQueries({ queryKey: ["opening-inventory"], exact: false });
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const cancel = useMutation({
		mutationFn: (doc: OpeningDocument) =>
			apiV1<OpeningDocument>(`/api/v1/opening-inventory/${doc.id}/cancel`, {
				method: "POST",
				body: JSON.stringify({ version: doc.version, reason: cancelReason }),
			}),
		onSuccess: r => {
			toast.success(r.message);
			setCancelTarget(null);
			setCancelReason("");
			setViewDoc(null);
			void qc.invalidateQueries({ queryKey: ["opening-inventory"], exact: false });
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const unpost = useMutation({
		mutationFn: (doc: OpeningDocument) =>
			apiV1<OpeningDocument>(`/api/v1/opening-inventory/${doc.id}/unpost`, {
				method: "POST",
				body: JSON.stringify({ version: doc.version }),
			}),
		onSuccess: r => {
			toast.success(r.message);
			setViewDoc(null);
			void qc.invalidateQueries({ queryKey: ["opening-inventory"], exact: false });
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const openCreate = () => {
		setEditing(null);
		setForm({
			documentDate: new Date().toISOString().slice(0, 10),
			warehouseId: 0,
			note: "",
			lines: [emptyLine()],
		});
		setOpen(true);
	};

	const duplicate = async (doc: OpeningDocument) => {
		let detail = doc;
		if (!doc.lines?.length) {
			try {
				const res = await apiV1<OpeningDocument>(
					`/api/v1/opening-inventory/${doc.id}`,
				);
				if (res.data) detail = res.data;
			} catch (e: any) {
				toast.error(e?.message || "Không tải được chi tiết phiếu");
				return;
			}
		}
		setViewDoc(null);
		setEditing(null);
		setForm({
			documentDate: new Date().toISOString().slice(0, 10),
			warehouseId: detail.warehouseId,
			note: detail.note ?? "",
			lines: detail.lines?.map(l => ({ ...l })) ?? [],
		});
		setOpen(true);
		toast.success(`Đã sao chép phiếu ${doc.code}`);
	};

	const openEdit = async (doc: OpeningDocument) => {
		let detail = doc;
		if (!doc.lines?.length) {
			try {
				const res = await apiV1<OpeningDocument>(
					`/api/v1/opening-inventory/${doc.id}`,
				);
				if (res.data) detail = res.data;
			} catch (e: any) {
				toast.error(e?.message || "Không tải được chi tiết phiếu");
				return;
			}
		}
		setEditing(detail);
		setForm({
			documentDate:
				typeof detail.documentDate === "string"
					? detail.documentDate.slice(0, 10)
					: new Date(detail.documentDate).toISOString().slice(0, 10),
			warehouseId: detail.warehouseId,
			note: detail.note ?? "",
			lines: detail.lines?.map(l => ({ ...l })) ?? [],
			version: detail.version,
		});
		setOpen(true);
	};

	const openPrint = async (doc: OpeningDocument) => {
		let detail = doc;
		if (!doc.lines?.length) {
			try {
				const res = await apiV1<OpeningDocument>(
					`/api/v1/opening-inventory/${doc.id}`,
				);
				if (res.data) detail = res.data;
			} catch (e: any) {
				toast.error(e?.message || "Không tải được chi tiết phiếu");
				return;
			}
		}
		setPrintTarget(detail);
	};

	const updateLine = (i: number, patch: Partial<OpeningLine>) =>
		setForm(f => ({
			...f,
			lines: f.lines.map((l, j) =>
				j === i
					? {
							...l,
							...patch,
							totalValue:
								(patch.quantity ?? l.quantity) * (patch.unitCost ?? l.unitCost),
						}
					: l,
			),
		}));

	const removeLine = (i: number) =>
		setForm(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }));

	const totalValue = form.lines.reduce(
		(s, l) => s + l.quantity * l.unitCost,
		0,
	);

	if (showImport) {
		return (
			<ExcelImportWizard
				title="Nhập tồn đầu kỳ từ Excel"
				subtitle="Chọn tệp, ghép cột, kiểm tra rồi đổ dữ liệu vào phiếu"
				fields={IMPORT_FIELDS}
				modes={[
					{ value: "ADD_NEW", title: "Đổ vào phiếu mới", description: "Dữ liệu file sẽ đổ vào phiếu tồn đầu kỳ mới" },
				]}
				templateFileName="Mau_Ton_Kho_Dau_Ky.xlsx"
				templateSheetName="Ton kho dau ky"
				templateRows={[
					{ warehouse: "KHO001", sku: "CLC2810", quantity: 100, unitCost: 25000, batchNumber: "L01", expiryDate: "2027-12-31", note: "Kiểm kê 01/01" },
					{ warehouse: "KHO001", sku: "DUONG-KG", quantity: 50, unitCost: 22000, batchNumber: "", expiryDate: "", note: "" },
				]}
				validateRow={row => {
					const errors: string[] = [];
					if (!row.sku?.trim()) errors.push("Thiếu mã hàng (SKU)");
					if (!row.quantity || Number.isNaN(Number(row.quantity)) || Number(row.quantity) <= 0)
						errors.push("Số lượng phải là số lớn hơn 0");
					if (row.unitCost && (Number.isNaN(Number(row.unitCost)) || Number(row.unitCost) < 0))
						errors.push("Đơn giá vốn phải là số không âm");
					if (row.expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.expiryDate.trim()))
						errors.push("HSD phải đúng định dạng YYYY-MM-DD");
					return errors;
				}}
				onImport={async ({ rows }) => {
					const warehouseList = (warehouses.data ?? []).map(w => ({
						id: w.id,
						code: String((w as any).code || "").trim().toLowerCase(),
						name: String(w.name || "").trim().toLowerCase(),
					}));
					const distinctWarehouses = [...new Set(rows.map(r => String(r.warehouse || "").trim()).filter(Boolean))];
					let warehouseId = 0;
					if (distinctWarehouses.length > 1) {
						return {
							total: rows.length,
							created: 0,
							updated: 0,
							skipped: rows.length,
							deleted: 0,
							errors: [{ row: 0, sku: "", message: `File có ${distinctWarehouses.length} kho khác nhau (${distinctWarehouses.join(", ")}). Mỗi file chỉ nhập 1 kho, tách file ra giúp.` }],
						};
					}
					if (distinctWarehouses.length === 1) {
						const key = distinctWarehouses[0].toLowerCase();
						const found = warehouseList.find(w => w.code === key || w.name === key);
						if (!found) {
							return {
								total: rows.length,
								created: 0,
								updated: 0,
								skipped: rows.length,
								deleted: 0,
								errors: [{ row: 0, sku: "", message: `Không tìm thấy kho "${distinctWarehouses[0]}" trong hệ thống` }],
							};
						}
						warehouseId = found.id;
					}
					const catalog = ((packagings.data as Packaging[] | undefined) ?? []).map(p => ({
						id: p.id,
						sku: String(p.sku || "").trim().toLowerCase(),
						name: p.name,
						productName: p.products?.name ?? p.name,
						unit: p.unit ?? "",
					}));
					const lines: OpeningLine[] = [];
					const errors: Array<{ row: number; sku: string; message: string }> = [];
					rows.forEach((row, index) => {
						const sku = String(row.sku || "").trim();
						const found = catalog.find(p => p.sku === sku.toLowerCase());
						if (!found) {
							errors.push({ row: index + 1, sku, message: "Không tìm thấy mã hàng trong danh mục" });
							return;
						}
						lines.push({
							packagingId: found.id,
							quantity: Number(row.quantity),
							unitCost: row.unitCost ? Number(row.unitCost) : 0,
							batchNumber: row.batchNumber?.trim() || undefined,
							expiryDate: row.expiryDate?.trim() || undefined,
							note: row.note?.trim() || undefined,
							packagingName: found.name,
							productName: found.productName,
							sku: String(row.sku).trim(),
							unit: found.unit,
						});
					});
					setForm({
						documentDate: new Date().toISOString().slice(0, 10),
						warehouseId,
						note: "",
						lines: lines.length ? lines : [emptyLine()],
					});
					return {
						total: rows.length,
						created: lines.length,
						updated: 0,
						skipped: errors.length,
						deleted: 0,
						errors,
					};
				}}
				onDone={() => {
					setShowImport(false);
					setEditing(null);
					setOpen(true);
				}}
				onBack={() => setShowImport(false)}
			/>
		);
	}

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Tồn kho đầu kỳ</h1>
					<p>Nhập số liệu tồn kho ban đầu trước khi vận hành</p>
				</div>
				<div className="flex gap-2">
					<button className="erp-btn" onClick={() => setShowImport(true)}>
						<FileSpreadsheet size={17} /> Nhập Excel
					</button>
					<button className="erp-btn erp-btn-primary" onClick={openCreate}>
						<Plus size={17} /> Tạo phiếu tồn đầu kỳ
					</button>
				</div>
			</div>

			{/* Table */}
			<div className="erp-card overflow-hidden">
				<ListToolbar
					className="flex-wrap"
					fields={OPENING_FILTER_FIELDS}
					values={filters}
					onChange={next => {
						setFilters(next);
						setPage(1);
					}}
					onExport={exportOpeningList}
					search={
						<div className="erp-search">
							<Search size={16} />
							<input
								value={search}
								onChange={e => {
									setSearch(e.target.value);
									setPage(1);
								}}
								placeholder="Tìm số phiếu..."
							/>
						</div>
					}
					extra={
						<select
							value={warehouseFilter}
							onChange={e => {
								setWarehouseFilter(e.target.value);
								setPage(1);
							}}
						>
							<option value="">Tất cả kho</option>
							{(warehouses.data ?? []).map((w: Warehouse) => (
								<option key={w.id} value={w.id}>
									{w.name}
								</option>
							))}
						</select>
					}
				/>

				{isLoading ? (
					<div className="p-12 text-center">Đang tải...</div>
				) : isError ? (
					<div className="p-12 text-center text-red-500">
						{(error as Error).message}
					</div>
				) : !visibleRows.length ? (
					<div className="p-12 text-center text-slate-400">
						Chưa có phiếu tồn đầu kỳ nào
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead>
								<tr>
									<th>Số phiếu</th>
									<th>Ngày</th>
									<th>Kho</th>
									<th className="text-right">Số dòng</th>
									<th>Trạng thái</th>
									<th>Ghi chú</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{visibleRows.map(doc => (
									<tr key={doc.id}>
										<td>
											<button
												className="font-semibold text-[#422afb] hover:underline"
												onClick={() => setViewDoc(doc)}
											>
												{doc.code}
											</button>
										</td>
										<td>{formatDate(doc.documentDate)}</td>
										<td>
											{doc.warehouse?.name ||
												doc.warehouseId}
										</td>
										<td className="text-right">
											{doc._count?.lines ?? doc.lines?.length ?? 0}
										</td>
										<td>
											<span className={`erp-badge ${STATUS_COLOR[doc.status]}`}>
												{STATUS_LABEL[doc.status]}
											</span>
										</td>
										<td className="text-slate-500 max-w-xs truncate">
											{doc.note || "—"}
										</td>
										<td>
											<TableActions
												actions={[
													{
														key: "view",
														label: "Xem chi tiết",
														icon: <Eye size={15} />,
														onClick: () => setViewDoc(doc),
													},
													{
														key: "duplicate",
														label: "Nhân bản",
														icon: <Copy size={15} />,
														onClick: () => duplicate(doc),
													},
													{
														key: "print",
														label: "In biên bản",
														icon: <Printer size={15} />,
														onClick: () => void openPrint(doc),
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

				{meta && meta.totalPages > 1 && (
					<div className="erp-pagination">
						<button
							className="erp-btn"
							disabled={page <= 1}
							onClick={() => setPage(p => p - 1)}
						>
							Trước
						</button>
						<span>
							Trang {page}/{meta.totalPages}
						</span>
						<button
							className="erp-btn"
							disabled={page >= meta.totalPages}
							onClick={() => setPage(p => p + 1)}
						>
							Sau
						</button>
					</div>
				)}
			</div>

			{/* ── View modal ── */}
			{viewDoc && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-3xl">
						<div className="erp-modal-header">
							<div>
								<h2>{viewDoc.code}</h2>
								<p>
									Kho: {viewDocDetail?.warehouse?.name ?? viewDoc.warehouse?.name ?? viewDoc.warehouseId} · Ngày:{" "}
									{formatDate(viewDoc.documentDate)} ·{" "}
									<span className={`erp-badge ${STATUS_COLOR[viewDoc.status]}`}>
										{STATUS_LABEL[viewDoc.status]}
									</span>
								</p>
							</div>
							<button onClick={() => setViewDoc(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body">
							{getDoc.isLoading ? (
								<div className="p-8 text-center text-slate-400">Đang tải chi tiết...</div>
							) : getDocError ? (
								<div className="p-8 text-center text-red-500">
									Lỗi tải chi tiết: {(getDocError as Error).message}
								</div>
							) : viewDocDetail ? (
								<>
									<div className="overflow-x-auto">
										<table className="erp-table">
											<thead>
												<tr>
													<th>#</th>
													<th>Hàng hóa</th>
													<th className="text-right">Số lượng</th>
													<th className="text-right">Đơn giá vốn</th>
													<th className="text-right">Giá trị</th>
													<th>Số lô</th>
													<th>HSD</th>
												</tr>
											</thead>
											<tbody>
												{viewDocDetail.lines.map((l, i) => (
													<tr key={l.id ?? i}>
														<td>{i + 1}</td>
														<td>
															<b>{l.packagingName ?? l.packaging?.name ?? l.packagingId}</b>
															{(l.productName ?? l.packaging?.products?.name) && (
																<small className="block text-slate-400">
																	{l.productName ?? l.packaging?.products?.name}
																	{(l.sku ?? l.packaging?.sku) && ` · SKU: ${l.sku ?? l.packaging?.sku}`}
																</small>
															)}
														</td>
														<td className="text-right">
															{formatNumber(l.quantity)} {l.unit ?? l.packaging?.unit ?? ""}
														</td>
														<td className="text-right">
															{formatNumber(l.unitCost)}
														</td>
														<td className="text-right">
															{formatNumber(
																Number(l.totalValue ?? l.quantity * l.unitCost),
															)}
														</td>
														<td>{l.batchNumber || "—"}</td>
														<td>{l.expiryDate ? formatDate(l.expiryDate) : "—"}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
									{viewDocDetail.note && (
										<p className="mt-3 text-sm text-slate-500">
											Ghi chú: {viewDocDetail.note}
										</p>
									)}
								</>
							) : (
								<div className="p-8 text-center text-red-500">Không tải được chi tiết phiếu</div>
							)}
						</div>
						{viewDocDetail && (
							<div className="erp-modal-footer">
								<button className="erp-btn" onClick={() => setViewDoc(null)}>
									Đóng
								</button>
								<button
									className="erp-btn"
									onClick={() => viewDocDetail && void openPrint(viewDocDetail)}
								>
									<Printer size={15} /> In biên bản
								</button>
								<button
									className="erp-btn"
									disabled={viewDocDetail.status !== "DRAFT"}
									title={
										viewDocDetail.status === "DRAFT"
											? "Sửa phiếu"
											: "Phiếu đã lưu — hủy lưu để khôi phục tồn kho trước khi sửa"
									}
									onClick={() => {
										openEdit(viewDocDetail);
										setViewDoc(null);
									}}
								>
									<Edit size={15} /> Sửa
								</button>
								{viewDocDetail.status === "DRAFT" && (
									<>
										<button
											className="erp-btn erp-btn-post"
											disabled={post.isPending}
											onClick={() => post.mutate(viewDocDetail)}
										>
											<CheckCircle size={15} />{" "}
											{post.isPending ? "Đang lưu..." : "Lưu"}
									</button>
								</>
							)}
							{viewDocDetail.status === "POSTED" && (
								<button
									className="erp-btn erp-btn-unpost"
									disabled={unpost.isPending}
									onClick={async () => {
										if (
											await confirm(
												`Hủy lưu phiếu ${viewDocDetail.code}? Tồn kho sẽ được hoàn lại và phiếu trở về nháp.`,
											)
										)
											unpost.mutate(viewDocDetail);
									}}
								>
									<XCircle size={15} /> Hủy lưu
								</button>
							)}
						</div>
					)}
					</div>
				</div>
			)}

			{/* ── Cancel modal ── */}
			{cancelTarget && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-md">
						<div className="erp-modal-header">
							<div>
								<h2>Hủy phiếu {cancelTarget.code}</h2>
								<p className="text-red-500">
									Thao tác này sẽ hoàn trả tồn kho đã lưu
								</p>
							</div>
							<button onClick={() => setCancelTarget(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body">
							<label>
								Lý do hủy <span className="text-red-500">*</span>
								<textarea
									required
									rows={3}
									value={cancelReason}
									onChange={e => setCancelReason(e.target.value)}
									placeholder="Nhập lý do hủy phiếu..."
								/>
							</label>
						</div>
						<div className="erp-modal-footer">
							<button className="erp-btn" onClick={() => setCancelTarget(null)}>
								Đóng
							</button>
							<button
								className="erp-btn erp-btn-danger"
								disabled={!cancelReason.trim() || cancel.isPending}
								onClick={() => cancel.mutate(cancelTarget!)}
							>
								{cancel.isPending ? "Đang hủy..." : "Xác nhận hủy"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ── Create/Edit modal ── */}
			{open && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-5xl">
						<div className="erp-modal-header">
							<div>
								<h2>
									{editing
										? `Sửa phiếu ${editing.code}`
										: "Tạo phiếu tồn đầu kỳ"}
								</h2>
								<p>Nhập số liệu tồn kho ban đầu cho từng hàng hóa</p>
							</div>
							<button onClick={() => setOpen(false)}>
								<X />
							</button>
						</div>
						<form
							onSubmit={e => {
								e.preventDefault();
								save.mutate();
							}}
						>
							<div className="erp-modal-body space-y-5">
								{editing?.status === "POSTED" && (
									<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
										Phiếu đã lưu: chỉ có thể sửa <b>ngày chứng từ</b> và <b>ghi chú</b>. Kho và hàng hóa đã khóa. Đổi ngày sẽ cập nhật lại sổ kho để tính tồn theo ngày.
									</div>
								)}
								{/* Header fields */}
								<div className="grid gap-4 md:grid-cols-3">
								<label>
									Ngày chứng từ
									<DateInput
										value={form.documentDate}
										onChange={value =>
											setForm({ ...form, documentDate: value })
										}
									/>
									</label>
									<label>
										Kho
										<select
											required
											disabled={editing?.status === "POSTED"}
											value={form.warehouseId}
											onChange={e =>
												setForm({
													...form,
													warehouseId: Number(e.target.value),
												})
											}
										>
											<option value={0}>Chọn kho</option>
											{(warehouses.data ?? []).map((w: Warehouse) => (
												<option key={w.id} value={w.id}>
													{w.name}
												</option>
											))}
										</select>
									</label>
									<label>
										Ghi chú
										<input
											value={form.note}
											onChange={e => setForm({ ...form, note: e.target.value })}
											placeholder="Ghi chú thêm (tuỳ chọn)"
										/>
									</label>
								</div>

								{/* Lines */}
								<div>
									<div className="flex items-center justify-between mb-2">
										<h3 className="font-semibold text-slate-700">
											Danh sách hàng hóa
										</h3>
										<button
											type="button"
											className="erp-btn text-sm"
											disabled={editing?.status === "POSTED"}
											onClick={() =>
												setForm(f => ({
													...f,
													lines: [...f.lines, emptyLine()],
												}))
											}
										>
											<Plus size={14} /> Thêm dòng
										</button>
									</div>
									<div className="overflow-x-auto">
										<table className="erp-table">
											<thead>
												<tr>
													<th>#</th>
													<th className="min-w-[220px]">Hàng hóa</th>
													<th className="text-right min-w-[100px]">Số lượng</th>
													<th className="text-right min-w-[130px]">
														Đơn giá vốn
													</th>
													<th className="text-right min-w-[120px]">Giá trị</th>
													<th className="min-w-[110px]">Số lô</th>
													<th className="min-w-[130px]">Hạn sử dụng</th>
													<th></th>
												</tr>
											</thead>
											<tbody>
												{form.lines.map((line, i) => (
													<tr key={i}>
														<td className="text-center text-slate-400">
															{i + 1}
														</td>
														<td className="min-w-64">
															<SearchableSelect
																value={line.packagingId}
																options={packagingSearchOptions}
																disabled={editing?.status === "POSTED"}
																onChange={packagingId => {
																	const selected = (
																		(packagings.data as
																			| Packaging[]
																			| undefined) ?? []
																	).find(item => item.id === packagingId);
																	const cost =
																		costPrices.data?.get(packagingId) || 0;
																	updateLine(i, {
																		packagingId,
																		packagingName: selected?.name ?? "",
																		productName: selected?.products?.name ?? "",
																		sku: selected?.sku ?? "",
																		unit: selected?.unit ?? "",
																		...(cost > 0
																			? {
																					unitCost: cost,
																					totalValue: cost * line.quantity,
																				}
																			: {}),
																	});
																}}
																placeholder="Nhập tên/SKU để chọn hàng hóa"
																required
															/>
														</td>
														<td>
															<input
																type="number"
																min={0.0001}
																step="any"
																className="text-right"
																disabled={editing?.status === "POSTED"}
																value={line.quantity}
																onChange={e =>
																	updateLine(i, {
																		quantity: Number(e.target.value),
																	})
																}
															/>
														</td>
														<td>
															<input
																type="number"
																min={0}
																step="any"
																className="text-right"
																disabled={editing?.status === "POSTED"}
																value={line.unitCost}
																onChange={e =>
																	updateLine(i, {
																		unitCost: Number(e.target.value),
																	})
																}
															/>
														</td>
														<td className="text-right text-sm font-semibold">
															{formatNumber(line.quantity * line.unitCost)}
														</td>
														<td>
															<input
																value={line.batchNumber ?? ""}
																disabled={editing?.status === "POSTED"}
																onChange={e =>
																	updateLine(i, { batchNumber: e.target.value })
																}
																placeholder="Số lô"
															/>
														</td>
													<td>
														<DateInput
															value={line.expiryDate ?? ""}
															placeholder="Chọn HSD"
															disabled={editing?.status === "POSTED"}
															onChange={value =>
																updateLine(i, { expiryDate: value })
															}
														/>
													</td>
														<td>
															<button
																type="button"
																className="erp-icon-btn text-red-500"
																disabled={editing?.status === "POSTED"}
																onClick={() => removeLine(i)}
															>
																<Trash2 size={14} />
															</button>
														</td>
													</tr>
												))}
											</tbody>
											<tfoot>
												<tr>
													<td
														colSpan={4}
														className="text-right font-bold text-slate-700 px-3 py-2"
													>
														Tổng giá trị:
													</td>
													<td className="text-right font-bold text-indigo-600 px-3 py-2">
														{formatNumber(totalValue)} ₫
													</td>
													<td colSpan={3}></td>
												</tr>
											</tfoot>
										</table>
									</div>
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
									type="submit"
									className="erp-btn erp-btn-primary"
									disabled={
										save.isPending ||
										form.lines.filter(l => l.packagingId > 0).length === 0
									}
								>
									{save.isPending
										? "Đang lưu..."
										: editing
											? "Cập nhật"
											: "Lưu phiếu nháp"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

<PrintPreview
			open={!!printTarget}
			title={printTarget ? `Xem trước biên bản ${printTarget.code}` : "Xem trước in"}
			fill={printTarget ? ((worksheet: any, company: any) => {
				const lines = printTarget.lines || [];
				fillGenericDocument(
					worksheet,
					company as CompanyPrintProfile | null,
					GENERIC_LAYOUTS.opening,
					{
						code: printTarget.code,
						documentDate: printTarget.documentDate,
						partner: printTarget.warehouse?.name || "",
						dienGiai: printTarget.note || "",
						total: lines.reduce(
							(sum, l) =>
								sum + Number(l.totalValue ?? l.quantity * l.unitCost),
							0,
						),
						rows: lines.map(
							(l, index) => ({
								stt: index + 1,
								sku: l.sku || l.packaging?.sku || "",
								name: formatProductName(
									l.packagingName ?? l.packaging?.name,
									l.productName ?? l.packaging?.products?.name,
								),
								unit: l.unit || l.packaging?.unit || "",
								quantity: Number(l.quantity || 0),
								unitPrice: Number(l.unitCost || 0),
								amount: Number(l.totalValue ?? l.quantity * l.unitCost),
							}),
						),
					},
				);
			}) : null}
			onClose={() => setPrintTarget(null)}
			/>
		</div>
	);
}

import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import {
	BarChart3,
	Boxes,
	CheckCircle2,
	Copy,
	Edit,
	Eye,
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
import SearchableSelect from "../components/SearchableSelect";
import NumberInput from "../components/NumberInput";
import DocumentActions from "../components/DocumentActions";
import { InventoryDocument } from "../components/InventoryDocument";
import { buildCompanyPrintProfile } from "../lib/printTemplate";
import { finishedGoodsWarehouseId } from "../lib/warehouse-defaults";
import {
	comboBoms,
	comboOptionLabel,
	isComboPackaging,
} from "../lib/combo";
import {
	formatDate,
	formatNumber,
	formatProductName,
	quantityAllowsDecimal,
} from "../lib/utils";
import type {
	InventoryBalanceV1,
	InventoryDocumentV1,
	InventoryReconciliationV1,
	Product,
	Warehouse,
} from "../types";
import { useMultiEscapeKey } from "../hooks/useEscapeKey";
import { DateInput } from "../components/DateRangeCalendar";
import TableActions from "../components/TableActions";
import ListToolbar from "../components/ListToolbar";
import type { FilterField, FilterValues } from "../components/FilterDrawer";
import { exportExcelFile } from "../lib/excelExport";

type Line = {
	packagingId: number;
	quantity: number;
	unitCost: number;
	note: string;
	comboGroupId?: string;
};
type FormState = {
	type: "IMPORT" | "EXPORT";
	transactionDate: string;
	warehouseId: number;
	recipient: string;
	reason: string;
	note: string;
};
type View = "documents" | "balances" | "reconciliation";
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({
	packagingId: 0,
	quantity: 1,
	unitCost: 0,
	note: "",
});
const emptyForm = (warehouseId = 0): FormState => ({
	type: "IMPORT",
	transactionDate: today(),
	warehouseId,
	recipient: "",
	reason: "",
	note: "",
});
const statusMeta = {
	DRAFT: { label: "Nháp", css: "bg-slate-100 text-slate-700" },
	POSTED: { label: "Đã lưu", css: "bg-emerald-100 text-emerald-700" },
	CANCELLED: { label: "Đã hủy", css: "bg-red-100 text-red-700" },
} as const;

const INVENTORY_FILTER_FIELDS: FilterField[] = [
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
		key: "transactionDate",
		label: "Thời gian",
		fromKey: "dateFrom",
		toKey: "dateTo",
	},
];

export default function Transactions({
	initialType = "IMPORT",
}: { initialType?: "IMPORT" | "EXPORT" } = {}) {
	const queryClient = useQueryClient();
	const [view, setView] = useState<View>("documents");
	const [search, setSearch] = useState("");
	const [filters, setFilters] = useState<FilterValues>({});
	const status = filters.status || "";
	const [type, setType] = useState<string>(initialType || ""),
		[warehouseId, setWarehouseId] = useState(0),
		[sourceModule, setSourceModule] = useState(""),
		[page, setPage] = useState(1);
	const [open, setOpen] = useState(false),
		[editing, setEditing] = useState<InventoryDocumentV1 | null>(null),
		[selected, setSelected] = useState<InventoryDocumentV1 | null>(null);
	const [form, setForm] = useState<FormState>(emptyForm()),
		[lines, setLines] = useState<Line[]>([emptyLine()]);
	// Cùng component dùng cho 2 route Nhập/Xuất: đổi sidebar phải theo loại mới
	React.useEffect(() => {
		setType(initialType || "");
		setPage(1);
	}, [initialType]);
	const [productionLink, setProductionLink] = useState<{
		orderId: number;
		orderCode: string;
	} | null>(null);
	const [assemblyLink, setAssemblyLink] = useState<{
		orderId: number;
		orderCode: string;
		kind: "ASSEMBLY" | "DISASSEMBLY";
	} | null>(null);
	const [deepLinkCode, setDeepLinkCode] = useState<string | null>(null);

	const [reportDoc, setReportDoc] = useState<InventoryDocumentV1 | null>(null);
	const reportRef = useRef<HTMLDivElement>(null);
	const handlePrintReport = useReactToPrint({
		contentRef: reportRef,
		documentTitle: reportDoc ? `Phieu-kho-${reportDoc.code}` : "Phieu-kho",
		// Lề 0 để trình duyệt ẩn header/footer (địa chỉ web, số trang) trên giấy in
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
		staleTime: 5 * 60_000,
	});
	useMultiEscapeKey([
		{ isOpen: open, onClose: () => setOpen(false), priority: 1 },
		{ isOpen: !!editing, onClose: () => setEditing(null), priority: 2 },
		{ isOpen: !!selected, onClose: () => setSelected(null), priority: 3 },
		{ isOpen: !!reportDoc, onClose: () => setReportDoc(null), priority: 4 },
	]);
	const applyInventoryDraft = (
		draft: any,
		link?: {
			orderId: number;
			orderCode: string;
			kind?: "ASSEMBLY" | "DISASSEMBLY";
		},
	) => {
		setType(draft.initialType || "EXPORT");
		setForm({
			type: draft.initialType || "EXPORT",
			transactionDate: draft.form?.transactionDate || today(),
			warehouseId: Number(draft.form?.warehouseId || 0),
			recipient: draft.form?.recipient || "",
			reason: draft.form?.reason || "",
			note: draft.form?.note || "",
		});
		setLines(
			(draft.lines || []).map((line: any) => ({
				packagingId: Number(line.packagingId || 0),
				quantity: Number(line.quantity || 0),
				unitCost: Number(line.unitCost || 0),
				note: String(line.note || ""),
			})),
		);
		if (link?.kind)
			setAssemblyLink({
				orderId: link.orderId,
				orderCode: link.orderCode,
				kind: link.kind,
			});
		else if (link)
			setProductionLink({ orderId: link.orderId, orderCode: link.orderCode });
		setOpen(true);
	};
	const handleDeepLink = React.useCallback(() => {
		try {
			const params = new URLSearchParams(window.location.search);
			const codeParam =
				params.get("code") || localStorage.getItem("inventory-deep-link-code");
			if (codeParam) {
				setDeepLinkCode(codeParam);
				setSearch(codeParam);
				setPage(1);
				localStorage.removeItem("inventory-deep-link-code");
				window.history.replaceState({}, "", window.location.pathname);
			}
			// Check URL param for production draft (set by window.open in Production.tsx)
			if (params.get("productionDraft") === "1") {
				const raw = sessionStorage.getItem("inventory-production-draft");
				if (raw) {
					const draft = JSON.parse(raw);
					applyInventoryDraft(
						draft,
						draft.productionOrderId
							? {
									orderId: Number(draft.productionOrderId),
									orderCode: String(draft.productionOrderCode || ""),
								}
							: undefined,
					);
					sessionStorage.removeItem("inventory-production-draft");
				}
				window.history.replaceState({}, "", window.location.pathname);
				return;
			}
			// Check sessionStorage for production draft (set by onNavigate same-tab navigation)
			const prodDraftRaw = sessionStorage.getItem("inventory-production-draft");
			if (prodDraftRaw) {
				const draft = JSON.parse(prodDraftRaw);
				// Only apply if draft matches current page type and was created from production
				if (draft.fromProduction && draft.initialType === initialType) {
					applyInventoryDraft(
						draft,
						draft.productionOrderId
							? {
									orderId: Number(draft.productionOrderId),
									orderCode: String(draft.productionOrderCode || ""),
								}
							: undefined,
					);
					sessionStorage.removeItem("inventory-production-draft");
				}
			}
			// Check URL param for assembly draft
			if (params.get("assemblyDraft") === "1") {
				const raw = sessionStorage.getItem("inventory-assembly-draft");
				if (!raw) return;
				const draft = JSON.parse(raw);
				applyInventoryDraft(
					draft,
					draft.assemblyOrderId
						? {
								orderId: Number(draft.assemblyOrderId),
								orderCode: String(draft.assemblyOrderCode || ""),
								kind:
									draft.assemblyKind === "DISASSEMBLY"
										? "DISASSEMBLY"
										: "ASSEMBLY",
							}
						: undefined,
				);
				sessionStorage.removeItem("inventory-assembly-draft");
				window.history.replaceState({}, "", window.location.pathname);
			}
			// Check sessionStorage for assembly draft (onNavigate)
			const assemblyDraftRaw = sessionStorage.getItem(
				"inventory-assembly-draft",
			);
			if (assemblyDraftRaw) {
				const draft = JSON.parse(assemblyDraftRaw);
				if (draft.fromProduction && draft.initialType === initialType) {
					applyInventoryDraft(
						draft,
						draft.assemblyOrderId
							? {
									orderId: Number(draft.assemblyOrderId),
									orderCode: String(draft.assemblyOrderCode || ""),
									kind:
										draft.assemblyKind === "DISASSEMBLY"
											? "DISASSEMBLY"
											: "ASSEMBLY",
								}
							: undefined,
					);
					sessionStorage.removeItem("inventory-assembly-draft");
				}
			}
		} catch {
			// Bỏ qua draft lỗi để mở trang kho bình thường.
		}
	}, [initialType]);

	React.useEffect(() => {
		handleDeepLink();
		const onStorage = (e: StorageEvent) => {
			if (e.key === "inventory-deep-link-code" && e.newValue) {
				handleDeepLink();
			}
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, [handleDeepLink]);

	const references = useQuery({
		queryKey: ["inventory-references"],
		queryFn: async () => {
			const [warehouses, products, costPrices] = await Promise.all([
				legacyApi<Warehouse[]>("/api/warehouses"),
				legacyApi<Product[]>("/api/products"),
				apiV1<Array<{ packagingId: number; price: number }>>(
					"/api/v1/catalog/packaging-cost-prices",
				)
					.then(response => response.data || [])
					.catch(() => []),
			]);
			const costPriceMap = new Map<number, number>();
			for (const row of costPrices as Array<{
				packagingId: number;
				price: number;
			}>) {
				costPriceMap.set(row.packagingId, Number(row.price || 0));
			}
			return { warehouses, products, costPriceMap };
		},
	});
	const documents = useQuery({
		queryKey: [
			"inventory-documents-v1",
			page,
			search,
			status,
			type,
			warehouseId,
			sourceModule,
		],
		enabled: view === "documents",
		queryFn: () =>
			apiV1<InventoryDocumentV1[]>(
				`/api/v1/inventory/documents?page=${page}&limit=20&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}${type ? `&type=${type}` : ""}${warehouseId ? `&warehouseId=${warehouseId}` : ""}${sourceModule ? `&sourceModule=${sourceModule}` : ""}`,
			),
	});
	const balanceQuery = useQuery({
		queryKey: ["inventory-balances-v1", warehouseId, search],
		enabled: view === "balances",
		queryFn: () =>
			apiV1<InventoryBalanceV1[]>(
				`/api/v1/inventory/balances?search=${encodeURIComponent(search)}${warehouseId ? `&warehouseId=${warehouseId}` : ""}`,
			),
	});
	const reconciliationQuery = useQuery({
		queryKey: ["inventory-reconciliation-v1", warehouseId],
		enabled: view === "reconciliation",
		queryFn: () =>
			apiV1<InventoryReconciliationV1[]>(
				`/api/v1/inventory/reconciliation${warehouseId ? `?warehouseId=${warehouseId}` : ""}`,
			),
	});
	const packagingOptions = useMemo(
		() =>
			(references.data?.products || []).flatMap(product => {
				const category = String(product.category || "PRODUCT").toUpperCase();
				return (product.packagings || []).map(packaging => ({
					...packaging,
					productName: product.name,
					productCategory: category,
					isCombo: isComboPackaging(category, packaging.boms),
				}));
			}),
		[references.data],
	);
	const productSearchOptions = useMemo(
		() =>
			packagingOptions
				.filter(item => form.type !== "IMPORT" || !item.isCombo)
				.map(item => {
					const comboCount = item.isCombo
						? comboBoms(item.boms).length
						: 0;
					return {
						value: item.id,
						label: item.isCombo
							? comboOptionLabel(item.productName)
							: item.productName,
						subLabel: item.isCombo
							? `Combo gồm ${comboCount} thành phẩm${item.sku ? ` | SKU: ${item.sku}` : ""}`
							: item.name !== item.productName
								? `${item.name}${item.sku ? ` | SKU: ${item.sku}` : ""}`
								: item.sku
									? `SKU: ${item.sku}`
									: undefined,
					};
				}),
		[packagingOptions, form.type],
	);
	// Đơn vị của dòng để quyết định cho nhập thập phân (kg) hay bắt buộc số nguyên
	const unitOf = (packagingId: number) =>
		packagingOptions.find(p => p.id === packagingId)?.unit || "";
	const invalidate = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: ["inventory-documents-v1"] }),
			queryClient.invalidateQueries({ queryKey: ["inventory-balances-v1"] }),
			queryClient.invalidateQueries({
				queryKey: ["inventory-reconciliation-v1"],
			}),
		]);
	const saveMutation = useMutation({
		mutationFn: () => {
			if (
				!form.warehouseId ||
				lines.some(
					line => !line.packagingId || line.quantity <= 0 || line.unitCost < 0,
				)
			)
				throw new Error("Kiểm tra kho, hàng hóa, số lượng và đơn giá");
			if (new Set(lines.map(line => line.packagingId)).size !== lines.length)
				throw new Error("Một quy cách không được nhập nhiều dòng");
			const payload = { ...form, details: lines };
			return editing
				? apiV1<InventoryDocumentV1>(
						`/api/v1/inventory/documents/${editing.id}`,
						{
							method: "PUT",
							body: JSON.stringify({ ...payload, version: editing.version }),
						},
					)
				: apiV1<InventoryDocumentV1>("/api/v1/inventory/documents", {
						method: "POST",
						body: JSON.stringify(payload),
					});
		},
		onSuccess: async response => {
			toast.success(response.message);
			setSelected(response.data);
			if (assemblyLink && !editing) {
				try {
					const base =
						assemblyLink.kind === "DISASSEMBLY"
							? "/api/v1/assembly/disassembly-orders"
							: "/api/v1/assembly/orders";
					await apiV1(`${base}/${assemblyLink.orderId}/link-inventory`, {
						method: "POST",
						body: JSON.stringify({
							linkType:
								form.type === "EXPORT"
									? "INVENTORY_ISSUE"
									: "INVENTORY_RECEIPT",
							linkedId: (response.data as InventoryDocumentV1).id,
							linkedCode: (response.data as InventoryDocumentV1).code,
						}),
					});
					toast.success(`Đã liên kết phiếu với lệnh ${assemblyLink.orderCode}`);
				} catch (e: any) {
					toast.error(
						e.message || "Không liên kết được phiếu với lệnh lắp ráp/tháo dỡ",
					);
				}
				setAssemblyLink(null);
			}
			if (productionLink && !editing) {
				try {
					await apiV1(
						`/api/v1/production-orders/${productionLink.orderId}/link-inventory`,
						{
							method: "POST",
							body: JSON.stringify({
								linkType:
									form.type === "EXPORT"
										? "INVENTORY_ISSUE"
										: "INVENTORY_RECEIPT",
								linkedId: (response.data as InventoryDocumentV1).id,
								linkedCode: (response.data as InventoryDocumentV1).code,
							}),
						},
					);
					toast.success(
						`Đã liên kết phiếu với lệnh ${productionLink.orderCode}`,
					);
				} catch (e: any) {
					toast.error(
						e.message || "Không liên kết được phiếu với lệnh sản xuất",
					);
				}
				setProductionLink(null);
			}
			setOpen(false);
			setEditing(null);
			void invalidate();
		},
		onError: (error: Error) => {
			toast.error(error.message);
			void invalidate();
		},
	});
	const actionMutation = useMutation({
		mutationFn: ({
			document,
			action,
			reason,
		}: {
			document: InventoryDocumentV1;
			action: "post" | "cancel" | "unpost";
			reason?: string;
		}) =>
			apiV1<InventoryDocumentV1>(
				`/api/v1/inventory/documents/${document.id}/${action}`,
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
		onError: (error: Error) => {
			toast.error(error.message);
			void invalidate();
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (document: InventoryDocumentV1) =>
			apiV1<InventoryDocumentV1>(
				`/api/v1/inventory/documents/${document.id}/delete`,
				{ method: "POST", body: JSON.stringify({ version: document.version }) },
			),
		onSuccess: response => {
			toast.success(response.message);
			setSelected(null);
			void invalidate();
		},
		onError: (error: Error) => {
			toast.error(error.message);
			void invalidate();
		},
	});
	const openCreate = (forcedType?: "IMPORT" | "EXPORT") => {
		const nextType = (forcedType ||
			(type as "IMPORT" | "EXPORT") ||
			initialType) as "IMPORT" | "EXPORT";
		setType(nextType);
		setEditing(null);
		setForm({
			...emptyForm(finishedGoodsWarehouseId(references.data?.warehouses)),
			type: nextType,
		});
		setLines([emptyLine()]);
		setOpen(true);
	};
	const [printingDoc] = useState(false);

	const openEdit = (document: InventoryDocumentV1) => {
		setEditing(document);
		setForm({
			type: document.type,
			transactionDate: document.transactionDate,
			warehouseId: document.warehouseId,
			recipient: document.recipient || "",
			reason: document.reason || "",
			note: document.note || "",
		});
		setLines(
			document.details.map(line => ({
				packagingId: line.packagingId,
				quantity: Number(line.quantity),
				unitCost: Number(line.unitCost),
				note: line.note || "",
			})),
		);
		setOpen(true);
	};
	const duplicate = (document: InventoryDocumentV1) => {
		setEditing(null);
		setType(document.type);
		setForm({
			type: document.type,
			transactionDate: today(),
			warehouseId: document.warehouseId,
			recipient: document.recipient || "",
			reason: document.reason || "",
			note: document.note || "",
		});
		setLines(
			document.details.map(line => ({
				packagingId: line.packagingId,
				quantity: Number(line.quantity),
				unitCost: Number(line.unitCost),
				note: line.note || "",
			})),
		);
		setOpen(true);
	};
	const updateLine = (index: number, patch: Partial<Line>) =>
		setLines(current => {
			const previous = current[index];
			const factor =
				patch.quantity !== undefined &&
				previous?.comboGroupId &&
				Number(previous.quantity || 0) > 0
					? Number(patch.quantity || 0) / Number(previous.quantity || 0)
					: 1;
			return current.map((line, position) => {
				if (position === index) return { ...line, ...patch };
				if (
					factor !== 1 &&
					line.comboGroupId &&
					line.comboGroupId === previous?.comboGroupId
				)
					return {
						...line,
						quantity: Number(
							(Number(line.quantity || 0) * factor).toFixed(4),
						),
					};
				return line;
			});
		});
	const applyPackagingCost = (index: number, packagingId: number) => {
		const selected = packagingOptions.find(item => item.id === packagingId);
		if (form.type === "EXPORT" && selected?.isCombo) {
			const components = comboBoms(selected.boms).flatMap(bom => {
				const option = packagingOptions.find(
					item => item.id === bom.materialPackagingId,
				);
				return option ? [{ bom, option }] : [];
			});
			if (components.length) {
				const comboGroupId = `combo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
				setLines(current => {
					const currentLine = current[index];
					if (!currentLine) return current;
					const comboQuantity =
						Number(currentLine.quantity || 0) > 0
							? Number(currentLine.quantity)
							: 1;
					const expanded: Line[] = components.map(item => ({
						packagingId: item.option.id,
						quantity: Number(item.bom.quantity || 0) * comboQuantity,
						unitCost:
							references.data?.costPriceMap?.get(item.option.id) || 0,
						note: `Thu\u1ed9c combo ${selected.productName}`,
						comboGroupId,
					}));
					const next = [
						...current.slice(0, index),
						...expanded,
						...current.slice(index + 1),
					];
					const merged: Line[] = [];
					for (const line of next) {
						if (!line.packagingId) {
							merged.push(line);
							continue;
						}
						const existing = merged.findIndex(
							item => item.packagingId === line.packagingId,
						);
						if (existing >= 0) {
							merged[existing] = {
								...merged[existing],
								quantity:
									Number(merged[existing].quantity || 0) +
									Number(line.quantity || 0),
								note: [merged[existing].note, line.note]
									.filter(Boolean)
									.join("\n"),
							};
						} else {
							merged.push(line);
						}
					}
					return merged.length ? merged : [emptyLine()];
				});
				toast.success(
					`\u0110\u00e3 \u0111i\u1ec1n ${components.length} th\u00e0nh ph\u1ea9m t\u1eeb combo ${selected.productName}.`,
				);
				return;
			}
		}
		const cost = references.data?.costPriceMap?.get(packagingId) || 0;
		updateLine(index, {
			packagingId,
			...(form.type === "IMPORT" && cost > 0 ? { unitCost: cost } : {}),
		});
	};
	const rows = documents.data?.data || [],
		balances = balanceQuery.data?.data || [],
		reconciliations = reconciliationQuery.data?.data || [],
		meta = documents.data?.meta || {};
	const visibleRows = useMemo(() => {
		const from = filters.dateFrom || "";
		const to = filters.dateTo || "";
		return rows.filter(document => {
			const date = (document.transactionDate || "").slice(0, 10);
			if (from && date < from) return false;
			if (to && date > to) return false;
			return true;
		});
	}, [rows, filters]);

	const exportInventoryList = () => {
		if (view === "balances") {
			return exportExcelFile(
				"ton-kho-theo-kho.xlsx",
				"Ton kho",
				[
					{ header: "SKU", value: (row: InventoryBalanceV1) => row.sku || "" },
					{
						header: "Hàng hóa",
						value: (row: InventoryBalanceV1) =>
							`${row.productName} - ${row.packagingName}`,
						width: 32,
					},
					{
						header: "Kho",
						value: (row: InventoryBalanceV1) => row.warehouseName,
					},
					{ header: "ĐVT", value: (row: InventoryBalanceV1) => row.unit || "" },
					{
						header: "Số lượng",
						value: (row: InventoryBalanceV1) => Number(row.quantity || 0),
					},
				],
				balances,
			);
		}
		if (view === "reconciliation") {
			return exportExcelFile(
				"doi-soat-ton-kho.xlsx",
				"Doi soat ton kho",
				[
					{
						header: "SKU",
						value: (row: InventoryReconciliationV1) => row.sku || "",
					},
					{
						header: "Hàng hóa",
						value: (row: InventoryReconciliationV1) =>
							`${row.productName} - ${row.packagingName}`,
						width: 32,
					},
					{
						header: "Kho",
						value: (row: InventoryReconciliationV1) => row.warehouseName,
					},
					{
						header: "Thực tế",
						value: (row: InventoryReconciliationV1) =>
							Number(row.actualQuantity || 0),
					},
					{
						header: "Kỳ vọng",
						value: (row: InventoryReconciliationV1) =>
							Number(row.expectedQuantity || 0),
					},
					{
						header: "Chênh lệch",
						value: (row: InventoryReconciliationV1) =>
							Number(row.difference || 0),
					},
				],
				reconciliations,
			);
		}
		return exportExcelFile(
			"danh-sach-chung-tu-kho.xlsx",
			"Chung tu kho",
			[
				{ header: "Mã chứng từ", value: (row: InventoryDocumentV1) => row.code },
				{
					header: "Ngày",
					value: (row: InventoryDocumentV1) => row.transactionDate,
				},
				{
					header: "Loại",
					value: (row: InventoryDocumentV1) =>
						row.type === "IMPORT" ? "Nhập kho" : "Xuất kho",
				},
				{
					header: "Kho",
					value: (row: InventoryDocumentV1) => row.warehouseName || "",
				},
				{
					header: "Diễn giải",
					value: (row: InventoryDocumentV1) =>
						row.reason || row.note || row.recipient || "",
					width: 32,
				},
				{
					header: "Trạng thái",
					value: (row: InventoryDocumentV1) =>
						statusMeta[row.documentStatus]?.label || row.documentStatus,
				},
				{
					header: "Số dòng",
					value: (row: InventoryDocumentV1) => row.details?.length || 0,
				},
			],
			visibleRows,
		);
	};
	React.useEffect(() => {
		if (view !== "documents" || documents.isLoading || rows.length !== 1)
			return;
		if (initialType) return;
		if (!selected && !open) setSelected(rows[0]);
	}, [view, documents.isLoading, rows.length, initialType]);

	React.useEffect(() => {
		if (
			!deepLinkCode ||
			view !== "documents" ||
			documents.isLoading ||
			!rows.length
		)
			return;
		const match = rows.find(doc => doc.code === deepLinkCode);
		if (match && !selected && !open) {
			setSelected(match);
			setDeepLinkCode(null);
		}
	}, [deepLinkCode, view, documents.isLoading, rows, selected, open]);
	const totalValue = lines.reduce(
		(sum, line) => sum + line.quantity * line.unitCost,
		0,
	);
	const switchView = (next: View) => {
		setView(next);
		setSearch("");
		setPage(1);
	};

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>
						{initialType === "EXPORT"
							? "Xuất kho"
							: initialType === "IMPORT"
								? "Nhập kho"
								: "Nhập, xuất kho"}
					</h1>
					<p>
						Phiếu bán hàng lưu tự sinh phiếu xuất kho tại đây · Chứng từ nháp
						→ lưu → hủy/đảo.
					</p>
				</div>
				{view === "documents" && (
					<div className="flex gap-2">
						{!initialType && (
							<button className="erp-btn" onClick={() => openCreate("IMPORT")}>
								<Plus size={16} /> Nhập kho
							</button>
						)}
						{!initialType && (
							<button
								className="erp-btn erp-btn-primary"
								onClick={() => openCreate("EXPORT")}
							>
								<Plus size={16} /> Xuất kho
							</button>
						)}
						{initialType === "IMPORT" && (
							<button
								className="erp-btn erp-btn-primary"
								onClick={() => openCreate("IMPORT")}
							>
								<Plus size={16} /> Nhập kho
							</button>
						)}
						{initialType === "EXPORT" && (
							<button
								className="erp-btn erp-btn-primary"
								onClick={() => openCreate("EXPORT")}
							>
								<Plus size={16} /> Xuất kho
							</button>
						)}
					</div>
				)}
			</div>
			<div className="erp-card p-1 flex flex-wrap gap-1">
				<button
					className={`erp-btn ${view === "documents" ? "erp-btn-primary" : ""}`}
					onClick={() => switchView("documents")}
				>
					<Boxes size={15} /> Chứng từ
				</button>
				<button
					className={`erp-btn ${view === "balances" ? "erp-btn-primary" : ""}`}
					onClick={() => switchView("balances")}
				>
					<Boxes size={15} /> Tồn theo kho
				</button>
				<button
					className={`erp-btn ${view === "reconciliation" ? "erp-btn-primary" : ""}`}
					onClick={() => switchView("reconciliation")}
				>
					<BarChart3 size={15} /> Đối soát ledger
				</button>
			</div>
			<div className="erp-card">
				<ListToolbar
					className="flex-wrap"
					fields={view === "documents" ? INVENTORY_FILTER_FIELDS : []}
					values={filters}
					onChange={next => {
						setFilters(next);
						setPage(1);
					}}
					onExport={exportInventoryList}
					search={
						<div className="erp-search">
							<Search size={16} />
							<input
								value={search}
								onChange={event => {
									setSearch(event.target.value);
									setPage(1);
								}}
								placeholder={
									view === "documents"
										? "Tìm mã PX-BH..., người nhận, diễn giải..."
										: "Tìm hàng hóa, SKU..."
								}
							/>
						</div>
					}
					extra={
						<>
							<select
								value={warehouseId}
								onChange={event => {
									setWarehouseId(+event.target.value);
									setPage(1);
								}}
							>
								<option value={0}>Tất cả kho</option>
								{references.data?.warehouses.map(warehouse => (
									<option key={warehouse.id} value={warehouse.id}>
										{warehouse.name}
									</option>
								))}
							</select>
							{view === "documents" && !initialType && (
								<>
									<select
										value={type}
										onChange={event => {
											setType(event.target.value);
											setPage(1);
										}}
									>
										<option value="">Tất cả loại</option>
										<option value="IMPORT">Nhập kho</option>
										<option value="EXPORT">Xuất kho</option>
									</select>
									<select
										value={sourceModule}
										onChange={event => {
											setSourceModule(event.target.value);
											setPage(1);
										}}
									>
										<option value="">Tất cả nguồn</option>
										<option value="MANUAL_V1">Nhập tay</option>
										<option value="SALE_V1">Bán hàng tự sinh</option>
										<option value="PURCHASE_V1">Mua hàng</option>
									</select>
								</>
							)}
						</>
					}
				/>
				{view === "documents" && (
					<>
						<div className="overflow-x-auto">
							<table className="erp-table">
								<thead>
									<tr>
										<th>Mã chứng từ</th>
										<th>Ngày</th>
										<th>Diễn giải</th>
										<th>Kho</th>
										<th>Trạng thái</th>
										<th className="text-right">Giá trị</th>
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
												Chưa có chứng từ kho, kể cả phiếu do bán hàng tự sinh
											</td>
										</tr>
									) : (
										rows.map(document => (
											<tr key={document.id}>
												<td>
													<b>{document.code}</b>
													<small>
														{document.recipient || document.reason || "-"}
													</small>
												</td>
												<td>{formatDate(document.transactionDate)}</td>
												<td
													className="max-w-[280px]"
													title={document.note || document.reason || ""}
												>
													{document.note || document.reason || "-"}
												</td>
												<td>{document.warehouseName}</td>
												<td>
													<span
														className={`erp-badge ${statusMeta[document.documentStatus].css}`}
													>
														{statusMeta[document.documentStatus].label}
													</span>
												</td>
												<td className="text-right font-semibold">
													{formatNumber(
														document.details.reduce(
															(sum, line) => sum + Number(line.totalValue),
															0,
														),
													)}
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
																onClick: () => setReportDoc(document),
															},
															{
																key: "post",
																label:
																	document.documentStatus === "CANCELLED"
																		? "Lưu lại"
																		: "Lưu",
																icon: <CheckCircle2 size={15} />,
																tone: "success",
																disabled: actionMutation.isPending,
																hidden: !(
																	document.documentStatus === "DRAFT" ||
																	(document.documentStatus === "CANCELLED" &&
																		document.sourceModule === "MANUAL_V1")
																),
																onClick: async () => {
																	if (
																		await confirm(
																			document.documentStatus === "CANCELLED"
																				? `Lưu lại ${document.code}?`
																				: `Lưu ${document.code}?`,
																		)
																	)
																		actionMutation.mutate({
																			document,
																			action: "post",
																		});
																},
															},
															{
																key: "delete",
																label:
																	document.documentStatus === "CANCELLED"
																		? "Xóa phiếu đã hủy"
																		: document.documentStatus === "DRAFT"
																			? "Xóa phiếu nháp"
																			: "Hủy lưu phiếu",
																icon:
																	document.documentStatus === "POSTED" ? (
																		<Undo2 size={15} />
																	) : (
																		<Trash2 size={15} />
																	),
																tone: "danger",
																disabled:
																	deleteMutation.isPending ||
																	actionMutation.isPending,
																hidden: !(
																	document.documentStatus === "DRAFT" ||
																	document.documentStatus === "CANCELLED" ||
																	(document.documentStatus === "POSTED" &&
																		document.sourceModule === "MANUAL_V1")
																),
																onClick: async () => {
																	if (
																		document.documentStatus === "DRAFT"
																	) {
																		if (
																			await confirm(
																				`Xóa phiếu nháp ${document.code}?`,
																			)
																		)
																			deleteMutation.mutate(document);
																		return;
																	}
																	if (
																		document.documentStatus === "CANCELLED"
																	) {
																		if (
																			await confirm(
																				`Xóa vĩnh viễn phiếu đã hủy ${document.code}? Thao tác không thể hoàn tác.`,
																			)
																		)
																			deleteMutation.mutate(document);
																		return;
																	}
																	if (
																		await confirm(
																			`Hủy lưu phiếu ${document.code}? Tồn kho sẽ được hoàn lại và phiếu trở về nháp.`,
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
										))
									)}
								</tbody>
							</table>
						</div>
						<div className="flex items-center justify-between p-3 text-sm">
							<span>Tổng {meta.total || 0} chứng từ</span>
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
					</>
				)}
				{view === "balances" && (
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead>
								<tr>
									<th>SKU</th>
									<th>Hàng hóa / Quy cách</th>
									<th>Kho</th>
									<th>Đơn vị</th>
									<th className="text-right">Tồn hiện tại</th>
								</tr>
							</thead>
							<tbody>
								{balanceQuery.isLoading ? (
									<tr>
										<td colSpan={5} className="text-center">
											Đang tải...
										</td>
									</tr>
								) : balances.length === 0 ? (
									<tr>
										<td colSpan={5} className="text-center text-slate-400">
											Không có số dư phù hợp
										</td>
									</tr>
								) : (
									balances.map(row => (
										<tr key={`${row.packagingId}-${row.warehouseId}`}>
											<td>{row.sku || "-"}</td>
											<td>
												<b>{row.productName}</b>
												<small>{row.packagingName}</small>
											</td>
											<td>{row.warehouseName}</td>
											<td>{row.unit || "-"}</td>
											<td className="text-right text-lg font-bold">
												{formatNumber(row.quantity)}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}
				{view === "reconciliation" && (
					<>
						<div className="p-3 text-sm">
							<span
								className={`erp-badge ${reconciliations.some(row => Math.abs(row.difference) > 0.0001) ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
							>
								{
									reconciliations.filter(
										row => Math.abs(row.difference) > 0.0001,
									).length
								}{" "}
								chênh lệch / {reconciliations.length} số dư
							</span>
						</div>
						<div className="overflow-x-auto">
							<table className="erp-table">
								<thead>
									<tr>
										<th>SKU</th>
										<th>Hàng hóa</th>
										<th>Kho</th>
										<th className="text-right">Opening + ledger</th>
										<th className="text-right">Projection</th>
										<th className="text-right">Chênh lệch</th>
									</tr>
								</thead>
								<tbody>
									{reconciliationQuery.isLoading ? (
										<tr>
											<td colSpan={6} className="text-center">
												Đang tải...
											</td>
										</tr>
									) : (
										reconciliations.map(row => (
											<tr
												key={`${row.packagingId}-${row.warehouseId}`}
												className={
													Math.abs(row.difference) > 0.0001 ? "bg-red-50" : ""
												}
											>
												<td>{row.sku || "-"}</td>
												<td>
													{row.productName}
													<small>{row.packagingName}</small>
												</td>
												<td>{row.warehouseName}</td>
												<td className="text-right">
													{formatNumber(row.expectedQuantity)}
												</td>
												<td className="text-right">
													{formatNumber(row.actualQuantity)}
												</td>
												<td
													className={`text-right font-bold ${Math.abs(row.difference) > 0.0001 ? "text-red-600" : "text-emerald-600"}`}
												>
													{formatNumber(row.difference)}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</>
				)}
			</div>
			{productionLink && (
				<div className="rounded bg-amber-50 p-3 text-sm text-amber-700">
					Phiếu nháp cho lệnh sản xuất <b>{productionLink.orderCode}</b>. Chỉnh
					số lượng theo công thức thực tế rồi lưu, lưu xong mới trừ/cộng kho.
				</div>
			)}
			{assemblyLink && (
				<div className="rounded bg-amber-50 p-3 text-sm text-amber-700">
					Phiếu nháp cho lệnh{" "}
					{assemblyLink.kind === "DISASSEMBLY" ? "tháo dỡ" : "lắp ráp"}{" "}
					<b>{assemblyLink.orderCode}</b>. Kiểm tra lại sản phẩm, số lượng rồi
					lưu.
				</div>
			)}
			{open && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-5xl">
						<div className="erp-modal-header">
							<div>
								<h2>
									{editing
										? `Sửa ${editing.code}`
										: productionLink
											? `Lập phiếu ${form.type === "EXPORT" ? "xuất NVL" : "nhập thành phẩm"} cho ${productionLink.orderCode}`
											: assemblyLink
												? `Lập phiếu ${form.type === "EXPORT" ? "xuất" : "nhập"} cho ${assemblyLink.orderCode}`
												: "Lập chứng từ kho"}
								</h2>
								<p>
									Chứng từ chỉ ảnh hưởng tồn sau khi lưu. Phiếu đã lưu có
									nút hủy lưu để chỉnh sửa.
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
										Loại phiếu
										<select
											value={form.type}
											onChange={event =>
												setForm({
													...form,
													type: event.target.value as FormState["type"],
												})
											}
										>
											<option value="IMPORT">Nhập kho</option>
											<option value="EXPORT">Xuất kho</option>
										</select>
									</label>
								<label>
									Ngày chứng từ
									<DateInput
										value={form.transactionDate}
										onChange={value =>
											setForm({
												...form,
												transactionDate: value,
											})
										}
									/>
									</label>
									<label>
										Kho
										<select
											required
											value={form.warehouseId}
											onChange={event =>
												setForm({ ...form, warehouseId: +event.target.value })
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
										Người nhận / giao
										<input
											value={form.recipient}
											maxLength={255}
											onChange={event =>
												setForm({ ...form, recipient: event.target.value })
											}
										/>
									</label>
									<label className="md:col-span-2">
										Lý do
										<input
											value={form.reason}
											maxLength={500}
											onChange={event =>
												setForm({ ...form, reason: event.target.value })
											}
										/>
									</label>
								</div>
								<div className="overflow-x-auto border rounded">
									<table className="erp-table">
										<thead>
											<tr>
												<th className="w-12 text-center">STT</th>
												<th>Hàng hóa / Quy cách</th>
												<th>Số lượng</th>
												<th>Đơn giá vốn</th>
												<th className="text-right">Thành tiền</th>
												<th>Ghi chú</th>
												<th></th>
											</tr>
										</thead>
										<tbody>
											{lines.map((line, index) => (
												<tr key={index}>
													<td className="text-center">{index + 1}</td>
													<td className="min-w-64">
														<SearchableSelect
															required
															value={line.packagingId}
															options={productSearchOptions}
															onChange={packagingId =>
																applyPackagingCost(index, packagingId)
															}
															placeholder="Nhập tên/SKU để chọn hàng hóa"
														/>
													</td>
													<td>
														<NumberInput
															value={line.quantity}
															onChange={v => updateLine(index, { quantity: v })}
															min={0.0001}
															decimals={3}
															integerOnly={
																!quantityAllowsDecimal(unitOf(line.packagingId))
															}
															className="w-28"
														/>
													</td>
													<td>
														<NumberInput
															value={line.unitCost}
															onChange={v => updateLine(index, { unitCost: v })}
															min={0}
															decimals={0}
															disabled={form.type === "EXPORT"}
															title={
																form.type === "EXPORT"
																	? "Giá xuất được tính khi lưu"
																	: ""
															}
															className="w-32"
														/>
													</td>
													<td className="text-right font-semibold">
														{formatNumber(line.quantity * line.unitCost)}
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
																setLines(current =>
																	current.filter(
																		(_, position) => position !== index,
																	),
																)
															}
														>
															<X size={15} />
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
									onClick={() => setLines(current => [...current, emptyLine()])}
								>
									<Plus size={15} /> Thêm dòng
								</button>
								<div className="grid gap-4 md:grid-cols-2">
									<label>
										Diễn giải
										<textarea
											rows={3}
											value={form.note}
											maxLength={1000}
											onChange={event =>
												setForm({ ...form, note: event.target.value })
											}
										/>
									</label>
									<div className="text-right text-xl font-bold text-emerald-700">
										Tổng giá trị: {formatNumber(totalValue)} ₫
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
									disabled={saveMutation.isPending}
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
									{selected.warehouseName} ·{" "}
									{statusMeta[selected.documentStatus].label}
								</p>
							</div>
							<button onClick={() => setSelected(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<div className="grid gap-3 md:grid-cols-3">
								<div>
									<small>Ngày chứng từ</small>
									<b className="block">
										{formatDate(selected.transactionDate)}
									</b>
								</div>
								<div>
									<small>Người nhận / giao</small>
									<b className="block">{selected.recipient || "-"}</b>
								</div>
								<div>
									<small>Lý do</small>
									<b className="block">{selected.reason || "-"}</b>
								</div>
							</div>
							<table className="erp-table">
								<thead>
								<tr>
									<th className="w-12 text-center">STT</th>
									<th>Hàng hóa</th>
									<th className="text-right">Số lượng</th>
									<th className="text-right">Đơn giá</th>
									<th className="text-right">Thành tiền</th>
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
												{formatNumber(line.quantity)} {line.unit}
											</td>
											<td className="text-right">
												{formatNumber(line.unitCost)}
											</td>
											<td className="text-right font-semibold">
												{formatNumber(line.totalValue)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							{selected.note && (
								<div className="rounded bg-slate-50 p-3">
									Diễn giải: {selected.note}
								</div>
							)}
							{selected.cancelReason && (
								<div className="rounded bg-red-50 p-3 text-red-700">
									Lý do hủy: {selected.cancelReason}
								</div>
							)}
						</div>
						<div className="erp-modal-footer">
							<DocumentActions
								status={selected.documentStatus}
								printing={printingDoc}
								posting={actionMutation.isPending}
								unposting={actionMutation.isPending}
								canUnpost={selected.sourceModule === "MANUAL_V1"}
								onPrint={() => setReportDoc(selected)}
								onPost={() =>
									actionMutation.mutate({
										document: selected,
										action: "post",
									})
								}
											onUnpost={async () => {
												if (
													await confirm(
														`Hủy lưu phiếu ${selected.code}? Tồn kho sẽ được hoàn lại và phiếu trở về nháp.`,
													)
												)
													actionMutation.mutate({
														document: selected,
														action: "unpost",
													});
											}}
								onEdit={() => {
									setSelected(null);
									openEdit(selected);
								}}
								onDuplicate={() => {
									setSelected(null);
									duplicate(selected);
								}}
							/>
							{(selected.documentStatus === "DRAFT" ||
								(selected.documentStatus === "CANCELLED" &&
									selected.sourceModule === "MANUAL_V1")) && (
								<button
									type="button"
									className="erp-btn text-red-600"
									disabled={deleteMutation.isPending}
											onClick={async () => {
												const isCancelled =
													selected.documentStatus === "CANCELLED";
												if (
													await confirm(
														isCancelled
															? `Xóa vĩnh viễn phiếu đã hủy ${selected.code}? Thao tác không thể hoàn tác.`
															: `Xóa phiếu nháp ${selected.code}?`,
													)
												)
													deleteMutation.mutate(selected);
											}}
								>
									Xóa
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
			{reportDoc && (
				<div className="sales-print-view fixed inset-0 z-[9999] flex flex-col bg-gray-900/90 backdrop-blur-md">
					<div className="bg-white border-b p-4 flex items-center justify-between no-print shadow-md">
						<div className="flex items-center gap-4">
							<h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
								{reportDoc.type === "EXPORT"
									? "Phiếu xuất kho"
									: "Phiếu nhập kho"}
							</h3>
							<span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">
								{reportDoc.code}
							</span>
						</div>
						<div className="flex items-center gap-3">
							<button
								onClick={() => setReportDoc(null)}
								className="px-6 py-2 border rounded-lg font-black text-gray-500 hover:bg-gray-50 transition-all uppercase text-[10px] tracking-widest"
							>
								Đóng
							</button>
							<button
								onClick={handlePrintReport}
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
							<InventoryDocument
								transaction={reportDoc}
								company={companyQuery.data}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

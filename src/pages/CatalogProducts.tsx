import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	ChevronDown,
	ChevronUp,
	Edit,
	Eye,
	EyeOff,
	Package,
	Plus,
	Search,
	Tag,
	Trash2,
	Upload,
	X,
	Save,
} from "lucide-react";
import toast from "../components/ui/toast";
import { confirm } from "../components/ui/confirm";
import ExcelJS from "exceljs";
import ListToolbar from "../components/ListToolbar";
import type { FilterField, FilterValues } from "../components/FilterDrawer";
import { saveAs } from "file-saver";
import Button from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Field, FieldLabel, Input } from "../components/ui/input";
import { apiV1 } from "../lib/apiV1";
import SearchableSelect from "../components/SearchableSelect";
import { formatNumber, formatProductName } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProductPrice {
	packagingId?: number;
	priceType: string;
	price: number;
}
interface PackagingV1 {
	id: number;
	name: string;
	sku?: string;
	unit?: string;
	packCount: number;
	netWeight?: number;
	shelfLifeMonths?: number;
	min_stock?: number;
	warehouseId?: number | null;
	barcode?: string | null;
	isActive: number;
	deletedAt?: string | null;
	prices: ProductPrice[];
	productwarehouses: Array<{
		warehouseId: number;
		stock_quantity: number;
		warehouses: { id: number; name: string };
	}>;
	warehouse?: { id: number; name: string } | null;
}
interface ProductV1 {
	id: number;
	name: string;
	sku?: string;
	category?: string;
	description?: string | null;
	primaryUnit: string;
	defaultWarehouseId?: number | null;
	vatRate: number | string;
	canManageInventory: number;
	canBePurchased: number;
	canBeSold: number;
	canBeProduced: number;
	canBeBomComponent: number;
	isActive?: number;
	defaultWarehouse?: { id: number; name: string } | null;
	productpackagings: PackagingV1[];
}
interface ListResponse {
	data: ProductV1[];
	meta: { page: number; limit: number; total: number; totalPages: number };
}
interface WarehouseRef {
	id: number;
	name: string;
}
interface LowStockRow {
	id: number;
	packagingName: string;
	sku?: string;
	unit?: string;
	productName: string;
	category: string;
	min_stock: number;
	stockQty: number;
}

const CATEGORIES = [
	{
		value: "PRODUCT",
		label: "Thành phẩm",
		color: "bg-violet-100 text-violet-700",
	},
	{
		value: "MATERIAL",
		label: "Nguyên vật liệu",
		color: "bg-orange-100 text-orange-700",
	},
	{ value: "PACKAGING", label: "Bao bì", color: "bg-sky-100 text-sky-700" },
	{ value: "SERVICE", label: "Dịch vụ", color: "bg-pink-100 text-pink-700" },
];
const catLabel = (c?: string) =>
	CATEGORIES.find(x => x.value === c)?.label ?? c ?? "";
const catColor = (c?: string) =>
	CATEGORIES.find(x => x.value === c)?.color ?? "bg-slate-100 text-slate-500";

const PRICE_TYPES = [
	{
		key: "COST",
		label: "Giá cost (vốn)",
		hint: "Giá thành mua hàng hoặc giá thành sản xuất của 1 đơn vị sản phẩm",
		cls: "text-amber-700",
	},
	{
		key: "SALE_1",
		label: "Giá bán đại lý/NPP",
		hint: "Giá áp dụng cho đại lý và nhà phân phối",
		cls: "text-teal-700",
	},
	{
		key: "SALE_2",
		label: "Giá bán cao tốc",
		hint: "Giá áp dụng cho kênh cao tốc",
		cls: "text-slate-600",
	},
	{
		key: "SALE_3",
		label: "Giá bán lẻ",
		hint: "Giá áp dụng cho khách lẻ",
		cls: "text-slate-600",
	},
];
const getPrice = (prices: ProductPrice[], type: string) =>
	prices.find(p => p.priceType === type)?.price ?? 0;

// ─── Price Editor ─────────────────────────────────────────────────────────────
function PriceEditor({
	prices,
	onChange,
}: {
	prices: ProductPrice[];
	onChange: (p: ProductPrice[]) => void;
}) {
	const set = (type: string, val: number) => {
		const existing = prices.find(p => p.priceType === type);
		if (existing)
			onChange(
				prices.map(p => (p.priceType === type ? { ...p, price: val } : p)),
			);
		else onChange([...prices, { priceType: type, price: val }]);
	};
	return (
		<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
			{PRICE_TYPES.map(t => (
				<label
					key={t.key}
					title={t.hint}
					className="text-xs font-semibold text-slate-500"
				>
					{t.label}
					<input
						type="number"
						min={0}
						step="any"
						value={getPrice(prices, t.key)}
						onChange={e => set(t.key, Number(e.target.value))}
						className={`mt-1 w-full text-right text-sm font-semibold ${t.cls}`}
					/>
				</label>
			))}
		</div>
	);
}

// ─── Packaging form shape ─────────────────────────────────────────────────────
interface PkgForm {
	id?: number;
	productId?: number;
	name: string;
	sku: string;
	unit: string;
	packCount: number;
	netWeight: number;
	shelfLifeMonths: number;
	min_stock: number;
	warehouseId: number | null;
	barcode: string;
	isActive: boolean;
	prices: ProductPrice[];
}
const emptyPkg = (productId?: number): PkgForm => ({
	id: undefined,
	productId,
	name: "",
	sku: "",
	unit: "Cái",
	packCount: 1,
	netWeight: 0,
	shelfLifeMonths: 24,
	min_stock: 0,
	warehouseId: null,
	barcode: "",
	isActive: true,
	prices: [],
});

interface BomLineForm {
	packagingId: number;
	quantity: number;
	unit: string;
	materialName?: string;
	materialUnit?: string;
}
interface ProductForm {
	name: string;
	sku: string;
	category: string;
	description: string;
	primaryUnit: string;
	defaultWarehouseId: number | null;
	vatRate: number;
	canManageInventory: boolean;
	canBePurchased: boolean;
	canBeSold: boolean;
	canBeProduced: boolean;
	canBeBomComponent: boolean;
	warrantyValue: string;
	warrantyUnit: string;
	minStockNote: string;
	fixedPurchasePrice: number;
	latestPurchasePrice: number;
	salesPrice: number;
	priceIncludesTax: boolean;
	bomLines: BomLineForm[];
	packaging: PkgForm;
}
const emptyProductForm = (category = "PRODUCT"): ProductForm => {
	const isMaterial = category === "MATERIAL";
	return {
		name: "",
		sku: "",
		category,
		description: "",
		primaryUnit: isMaterial ? "Kg" : "Cái",
		defaultWarehouseId: null,
		vatRate: 0,
		canManageInventory: true,
		canBePurchased: true,
		canBeSold: !isMaterial,
		canBeProduced: false,
		canBeBomComponent: true,
		warrantyValue: "",
		warrantyUnit: "Tháng",
		minStockNote: "",
		fixedPurchasePrice: 0,
		latestPurchasePrice: 0,
		salesPrice: 0,
		priceIncludesTax: false,
		bomLines: [],
		packaging: emptyPkg(),
	};
};
const productToEditForm = (
	p: ProductV1,
	bomLines: BomLineForm[] = [],
): ProductForm => {
	const firstPackaging = p.productpackagings[0];
	return {
		name: p.name,
		sku: p.sku ?? "",
		category: p.category ?? "PRODUCT",
		description: p.description ?? "",
		primaryUnit: p.primaryUnit,
		defaultWarehouseId: p.defaultWarehouseId ?? null,
		vatRate: Number(p.vatRate),
		canManageInventory: Boolean(p.canManageInventory),
		canBePurchased: Boolean(p.canBePurchased),
		canBeSold: Boolean(p.canBeSold),
		canBeProduced: Boolean(p.canBeProduced),
		canBeBomComponent: Boolean(p.canBeBomComponent),
		warrantyValue: firstPackaging?.shelfLifeMonths
			? String(firstPackaging.shelfLifeMonths)
			: "",
		warrantyUnit: "Tháng",
		minStockNote: firstPackaging?.min_stock
			? String(firstPackaging.min_stock)
			: "",
		fixedPurchasePrice: 0,
		latestPurchasePrice: getPrice(firstPackaging?.prices ?? [], "COST"),
		salesPrice: getPrice(firstPackaging?.prices ?? [], "SALE_1"),
		priceIncludesTax: false,
		bomLines,
		packaging: emptyPkg(p.id),
	};
};
const pkgToForm = (pk: PackagingV1): PkgForm => ({
	id: pk.id,
	productId: undefined,
	name: pk.name,
	sku: pk.sku ?? "",
	unit: pk.unit ?? "Cái",
	packCount: pk.packCount,
	netWeight: pk.netWeight ?? 0,
	shelfLifeMonths: pk.shelfLifeMonths ?? 24,
	min_stock: pk.min_stock ?? 0,
	warehouseId: pk.warehouseId ?? null,
	barcode: pk.barcode ?? "",
	isActive: pk.isActive !== 0,
	prices: pk.prices ?? [],
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CatalogProducts({
	onOpenImport,
}: { onOpenImport?: () => void } = {}) {
	const qc = useQueryClient();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [filters, setFilters] = useState<FilterValues>({});
	const category = filters.category || "";
	const [expandedId, setExpandedId] = useState<number | null>(null);
	const [tab, setTab] = useState<"list" | "lowstock">("list");
	const [addMenuOpen, setAddMenuOpen] = useState(false);

	const syncProductField = (
		next: ProductForm,
		patch: Partial<ProductForm>,
	): ProductForm => ({
		...next,
		...patch,
		packaging: {
			...next.packaging,
			...(patch.name !== undefined ? { name: patch.name } : {}),
			...(patch.sku !== undefined ? { sku: patch.sku } : {}),
			...(patch.primaryUnit !== undefined ? { unit: patch.primaryUnit } : {}),
		},
	});

	// Modals
	const [productModal, setProductModal] = useState<"create" | "edit" | null>(
		null,
	);
	const [editingProduct, setEditingProduct] = useState<ProductV1 | null>(null);
	const [productForm, setProductForm] =
		useState<ProductForm>(emptyProductForm());
	const [pkgModal, setPkgModal] = useState<"create" | "edit" | null>(null);
	const [pkgForm, setPkgForm] = useState<PkgForm>(emptyPkg());

	// Queries
	const warehouses = useQuery({
		queryKey: ["warehouses-catalog-ref"],
		queryFn: () => apiV1<WarehouseRef[]>("/api/v1/catalog/warehouses"),
		staleTime: 60_000,
	});
	const warehouseList: WarehouseRef[] = (warehouses.data?.data as any) ?? [];

	const allMaterials = useQuery({
		queryKey: ["catalog-materials-all"],
		queryFn: () =>
			apiV1<ListResponse>("/api/v1/catalog/products?page=1&limit=1000"),
		staleTime: 60_000,
	});
	const materialRows =
		(Array.isArray(allMaterials.data?.data)
			? allMaterials.data.data
			: allMaterials.data?.data?.data) ?? [];
	const materialOptions = materialRows.flatMap(prod =>
		(prod.productpackagings || []).map((pk: PackagingV1) => ({
			value: pk.id,
			label: prod.name,
			subLabel:
				pk.name !== prod.name
					? `${pk.name}${pk.sku ? ` | SKU: ${pk.sku}` : ""}`
					: pk.sku
						? `SKU: ${pk.sku}`
						: undefined,
		})),
	);
	const findMaterial = (packagingId: number) =>
		materialRows
			.flatMap(prod =>
				(prod.productpackagings || []).map((pk: PackagingV1) => ({ prod, pk })),
			)
			.find(item => item.pk.id === packagingId);

	const { data, isLoading, isError, error } = useQuery({
		queryKey: ["catalog-products", page, search, category],
		queryFn: () =>
			apiV1<ListResponse>(
				`/api/v1/catalog/products?page=${page}&limit=30${search ? `&search=${encodeURIComponent(search)}` : ""}${category ? `&category=${category}` : ""}`,
			),
		enabled: tab === "list",
		refetchInterval: 5000, // Tự động refetch mỗi 5 giây để cập nhật real-time dữ liệu từ các user khác
		refetchOnWindowFocus: true,
	});

	const lowStock = useQuery({
		queryKey: ["catalog-low-stock"],
		queryFn: () => apiV1<LowStockRow[]>("/api/v1/catalog/low-stock"),
		enabled: tab === "lowstock",
	});

	const rows = (Array.isArray(data?.data) ? data.data : data?.data?.data) ?? [];
	const filterFields: FilterField[] = [
		{
			type: "select",
			key: "category",
			label: "Loại hàng",
			options: CATEGORIES.map(item => ({
				value: item.value,
				label: item.label,
			})),
		},
		{
			type: "select",
			key: "status",
			label: "Trạng thái",
			options: [
				{ value: "ACTIVE", label: "Đang bán" },
				{ value: "INACTIVE", label: "Ngừng bán" },
			],
		},
	];
	const visibleRows = useMemo(
		() =>
			rows.filter(product => {
				const isActive =
					Number(product.isActive ?? 1) !== 0 ||
					product.productpackagings.some(pk => pk.isActive);
				if (filters.status === "ACTIVE" && !isActive) return false;
				if (filters.status === "INACTIVE" && isActive) return false;
				return true;
			}),
		[rows, filters.status],
	);
	const meta = Array.isArray(data?.data) ? data?.meta : data?.data?.meta;
	const lowRows: LowStockRow[] = (lowStock.data?.data as any) ?? [];

	// Mutations
	const invalidate = () =>
		qc.invalidateQueries({ queryKey: ["catalog-products"] });

	const createProduct = useMutation({
		mutationFn: async () => {
			const packagingCode = productForm.sku?.trim() || "";
			const packagingName = productForm.name?.trim() || "";
			if (!packagingCode || !packagingName)
				throw new Error("Nhập mã và tên của một sản phẩm riêng biệt");
			const created = await apiV1<ProductV1>("/api/v1/catalog/products", {
				method: "POST",
				body: JSON.stringify({
					name: packagingName,
					sku: packagingCode || null,
					category: productForm.category,
					description: productForm.description || null,
					primaryUnit: productForm.primaryUnit,
					defaultWarehouseId: productForm.defaultWarehouseId,
					vatRate: productForm.vatRate,
					canManageInventory: productForm.canManageInventory,
					canBePurchased: productForm.canBePurchased,
					canBeSold: productForm.canBeSold,
					canBeProduced: productForm.canBeProduced,
					canBeBomComponent: productForm.canBeBomComponent,
					packaging: {
						name: packagingName,
						sku: packagingCode || null,
						unit: productForm.primaryUnit,
						packCount: productForm.packaging.packCount || 1,
						netWeight: productForm.packaging.netWeight,
						shelfLifeMonths: productForm.packaging.shelfLifeMonths,
						min_stock: productForm.packaging.min_stock,
						warehouseId:
							productForm.defaultWarehouseId ??
							productForm.packaging.warehouseId,
						barcode: productForm.packaging.barcode || packagingCode || null,
						prices: productForm.packaging.prices,
					},
				}),
			});
			const outputPackagingId = (created.data as ProductV1)
				?.productpackagings?.[0]?.id;
			const bomLines = productForm.bomLines
				.filter(line => line.packagingId > 0 && line.quantity > 0)
				.map(line => ({
					materialPackagingId: line.packagingId,
					quantity: Number(line.quantity),
					unit: String(line.unit || line.materialUnit || "g").trim() || "g",
				}));
			if (bomLines.some(line => !line.unit)) {
				throw new Error("Mỗi dòng định mức cần chọn đơn vị tính");
			}
			if (outputPackagingId && bomLines.length) {
				await apiV1("/api/v1/catalog/product-boms/replace", {
					method: "POST",
					body: JSON.stringify({
						productPackagingId: outputPackagingId,
						materials: bomLines,
					}),
				});
			}
			return created;
		},
		onSuccess: r => {
			toast.success(r.message);
			setProductModal(null);
			invalidate();
		},
		onError: (error: any) => {
			const detail = error?.fieldErrors
				? Object.entries(error.fieldErrors)
						.map(
							([field, messages]) =>
								`${field}: ${(messages as string[]).join(", ")}`,
						)
						.join("; ")
				: "";
			if (
				error?.status === 404 &&
				String(error?.message || "")
					.toLowerCase()
					.includes("không tìm thấy")
			) {
				toast.error(
					"Backend chưa nhận API BOM mới, vui lòng restart server rồi lưu lại định mức",
				);
			} else {
				toast.error(
					[error?.message || "Không lưu được định mức", detail]
						.filter(Boolean)
						.join("\n"),
				);
			}
		},
	});

	const updateProduct = useMutation({
		mutationFn: async () => {
			const updated = await apiV1<ProductV1>(
				`/api/v1/catalog/products/${editingProduct!.id}`,
				{
					method: "PUT",
					body: JSON.stringify({
						name: productForm.name,
						sku: productForm.sku || null,
						description: productForm.description || null,
						primaryUnit: productForm.primaryUnit,
						defaultWarehouseId: productForm.defaultWarehouseId,
						vatRate: productForm.vatRate,
						canManageInventory: productForm.canManageInventory,
						canBePurchased: productForm.canBePurchased,
						canBeSold: productForm.canBeSold,
						canBeProduced: productForm.canBeProduced,
						canBeBomComponent: productForm.canBeBomComponent,
					}),
				},
			);
			const outputPackagingId = editingProduct?.productpackagings?.[0]?.id;
			const bomLines = productForm.bomLines
				.filter(line => line.packagingId > 0 && line.quantity > 0)
				.map(line => ({
					materialPackagingId: line.packagingId,
					quantity: Number(line.quantity),
					unit: String(line.unit || line.materialUnit || "g").trim() || "g",
				}));
			if (bomLines.some(line => !line.unit)) {
				throw new Error("Mỗi dòng định mức cần chọn đơn vị tính");
			}
			if (outputPackagingId) {
				await apiV1("/api/v1/catalog/product-boms/replace", {
					method: "POST",
					body: JSON.stringify({
						productPackagingId: outputPackagingId,
						materials: bomLines,
					}),
				});
			}
			return updated;
		},
		onSuccess: r => {
			toast.success(r.message);
			setProductModal(null);
			invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const toggleProduct = useMutation({
		mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
			apiV1(`/api/v1/catalog/products/${id}/toggle`, {
				method: "PATCH",
				body: JSON.stringify({ isActive }),
			}),
		onSuccess: r => {
			toast.success(r.message);
			invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const savePkg = useMutation({
		mutationFn: () =>
			pkgForm.id
				? apiV1(`/api/v1/catalog/packagings/${pkgForm.id}`, {
						method: "PUT",
						body: JSON.stringify({
							name: pkgForm.name,
							unit: pkgForm.unit,
							packCount: pkgForm.packCount,
							netWeight: pkgForm.netWeight,
							shelfLifeMonths: pkgForm.shelfLifeMonths,
							min_stock: pkgForm.min_stock,
							warehouseId: pkgForm.warehouseId,
							barcode: pkgForm.barcode || null,
							isActive: pkgForm.isActive,
							prices: pkgForm.prices,
						}),
					})
				: apiV1("/api/v1/catalog/packagings", {
						method: "POST",
						body: JSON.stringify({
							productId: pkgForm.productId,
							name: pkgForm.name,
							sku: pkgForm.sku || null,
							unit: pkgForm.unit,
							packCount: pkgForm.packCount,
							netWeight: pkgForm.netWeight,
							shelfLifeMonths: pkgForm.shelfLifeMonths,
							min_stock: pkgForm.min_stock,
							warehouseId: pkgForm.warehouseId,
							barcode: pkgForm.barcode || null,
							prices: pkgForm.prices,
						}),
					}),
		onSuccess: r => {
			toast.success(r.message);
			setPkgModal(null);
			invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const deletePkg = useMutation({
		mutationFn: (id: number) =>
			apiV1(`/api/v1/catalog/packagings/${id}`, { method: "DELETE" }),
		onSuccess: r => {
			toast.success(r.message);
			invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	// ── Handlers ──
	const openCreateProduct = (presetCategory = "PRODUCT") => {
		setEditingProduct(null);
		setProductForm(emptyProductForm(presetCategory));
		setProductModal("create");
	};
	const openEditProduct = async (p: ProductV1, e: React.MouseEvent) => {
		e.stopPropagation();
		setEditingProduct(p);
		setProductForm(productToEditForm(p));
		setProductModal("edit");
		const outputPackagingId = p.productpackagings?.[0]?.id;
		if (outputPackagingId) {
			try {
				const response = await apiV1<
					Array<{
						materialPackagingId: number;
						quantity: number;
						unit: string;
						materialName?: string;
						materialUnit?: string;
					}>
				>(`/api/v1/catalog/product-boms/${outputPackagingId}`);
				const bomLines = (response.data || []).map(row => ({
					packagingId: row.materialPackagingId,
					quantity: Number(row.quantity || 0),
					unit: row.unit || row.materialUnit || "g",
					materialName: row.materialName || "",
					materialUnit: row.materialUnit || "",
				}));
				setProductForm(productToEditForm(p, bomLines));
			} catch {
				// Giữ form sửa khi không tải được BOM.
			}
		}
	};
	const openAddPkg = (productId: number, e: React.MouseEvent) => {
		e.stopPropagation();
		setPkgForm(emptyPkg(productId));
		setPkgModal("create");
	};
	const openEditPkg = (pk: PackagingV1) => {
		setPkgForm(pkgToForm(pk));
		setPkgModal("edit");
	};

	// ── Export Excel ──
	const exportExcel = async () => {
		const wb = new ExcelJS.Workbook();
		const ws = wb.addWorksheet("Danh mục hàng hóa");
		ws.columns = [
			{ header: "Tên sản phẩm", key: "productName", width: 32 },
			{ header: "Loại", key: "category", width: 14 },
			{ header: "Tên quy cách", key: "name", width: 32 },
			{ header: "SKU", key: "sku", width: 16 },
			{ header: "ĐVT", key: "unit", width: 10 },
			{ header: "Giá cost (vốn)", key: "cost", width: 16 },
			{ header: "Giá bán đại lý/NPP", key: "sale1", width: 18 },
			{ header: "Giá bán cao tốc", key: "sale2", width: 16 },
			{ header: "Giá bán lẻ", key: "sale3", width: 14 },
			{ header: "Tồn kho", key: "stock", width: 12 },
			{ header: "Tồn tối thiểu", key: "minStock", width: 14 },
			{ header: "Kho", key: "warehouse", width: 18 },
			{ header: "Trạng thái", key: "status", width: 14 },
		];
		ws.getRow(1).font = { bold: true };
		ws.getRow(1).fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFE8F5E9" },
		};

		for (const prod of rows) {
			for (const pk of prod.productpackagings) {
				const stock = pk.productwarehouses.reduce(
					(s, pw) => s + (pw.stock_quantity ?? 0),
					0,
				);
				ws.addRow({
					productName: prod.name,
					category: catLabel(prod.category),
					name: pk.name,
					sku: pk.sku ?? "",
					unit: pk.unit ?? "",
					cost: getPrice(pk.prices, "COST"),
					sale1: getPrice(pk.prices, "SALE_1"),
					sale2: getPrice(pk.prices, "SALE_2"),
					sale3: getPrice(pk.prices, "SALE_3"),
					stock,
					minStock: pk.min_stock ?? 0,
					warehouse: pk.warehouse?.name ?? "",
					status: pk.isActive !== 0 ? "Đang bán" : "Đã ẩn",
				});
			}
		}

		const buf = await wb.xlsx.writeBuffer();
		saveAs(
			new Blob([buf], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
			"danh-muc-hang-hoa.xlsx",
		);
	};

	// ─── Render ───────────────────────────────────────────────────────────────────
	return (
		<div className="erp-page">
			{/* Header */}
			<div className="erp-page-header">
				<div>
					<h1>Danh mục hàng hóa</h1>
					<p>
						Quản lý vật tư, thành phẩm, bao bì và dịch vụ — giá bán, giá vốn,
						tồn kho
					</p>
				</div>
				<div className="flex gap-2.5 flex-wrap">
					<div className="relative" data-catalog-add-menu>
						<div className="flex">
							<Button
								variant="primary"
								className="rounded-r-none"
								onClick={() => openCreateProduct()}
							>
								<Plus size={16} /> Thêm
							</Button>
							<Button
								variant="primary"
								className="rounded-l-none border-l border-white/30 px-2.5"
								onClick={() => setAddMenuOpen(current => !current)}
								title="Tùy chọn thêm"
							>
								<ChevronDown size={16} />
							</Button>
						</div>
						{addMenuOpen && (
							<div className="absolute right-0 z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-[#e9edf7] bg-white shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18)]">
								<button
									className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-[#2b3674] hover:bg-[#f4f7fe]"
									onClick={() => {
										setAddMenuOpen(false);
										onOpenImport?.();
									}}
								>
									<Upload size={15} className="text-[#422afb]" /> Nhập từ Excel
								</button>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Tabs */}
			<div className="flex gap-1 border-b border-slate-200">
				{[
					{ key: "list", label: "Danh sách" },
					{
						key: "lowstock",
						label: `Cảnh báo tồn thấp${lowRows.length ? ` (${lowRows.length})` : ""}`,
					},
				].map(t => (
					<button
						key={t.key}
						onClick={() => setTab(t.key as any)}
						className={`px-4 py-2.5 text-sm font-600 border-b-2 transition-colors ${
							tab === t.key
								? "border-teal-500 text-teal-700"
								: "border-transparent text-slate-500 hover:text-slate-700"
						}`}
					>
						{t.key === "lowstock" && lowRows.length > 0 && (
							<AlertTriangle
								size={13}
								className="inline mr-1.5 text-amber-500"
							/>
						)}
						{t.label}
					</button>
				))}
			</div>

			{/* ── Tab: Danh sách ── */}
			{tab === "list" && (
				<Card className="overflow-hidden !p-0">
					<ListToolbar
						fields={filterFields}
						values={filters}
						onChange={next => {
							setFilters(next);
							setPage(1);
						}}
						onExport={exportExcel}
						exportDisabled={visibleRows.length === 0}
						search={
							<div className="erp-search">
								<Search size={15} />
								<input
									value={search}
									onChange={e => {
										setSearch(e.target.value);
										setPage(1);
									}}
									placeholder="Tìm tên, SKU..."
								/>
							</div>
						}
					/>

					{isLoading ? (
						<div className="erp-empty">
							<p>Đang tải...</p>
						</div>
					) : isError ? (
						<div className="erp-empty">
							<p className="text-red-500">{(error as Error).message}</p>
						</div>
					) : !visibleRows.length ? (
						<div className="erp-empty">
							<Package size={48} />
							<p>Chưa có hàng hóa nào</p>
						</div>
					) : (
						<div>
							{visibleRows.map(prod => {
								const expanded = expandedId === prod.id;
								const totalStock = prod.productpackagings.reduce(
									(s, pk) =>
										s +
										pk.productwarehouses.reduce(
											(ss, pw) => ss + (pw.stock_quantity ?? 0),
											0,
										),
									0,
								);
								const isHidden = prod.isActive === 0;
								const isMaterial = prod.category === "MATERIAL";
								const singlePackaging = isMaterial
									? prod.productpackagings[0]
									: undefined;
								const singleStock = singlePackaging
									? singlePackaging.productwarehouses.reduce(
											(s, pw) => s + (pw.stock_quantity ?? 0),
											0,
										)
									: 0;
								return (
									<div key={prod.id} className={isHidden ? "opacity-60" : ""}>
										{/* Product row */}
										<div
											className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
											onClick={() =>
												setExpandedId(prev =>
													prev === prod.id ? null : prod.id,
												)
											}
										>
											<div
												className={`p-2 rounded-lg flex-shrink-0 ${isHidden ? "bg-slate-100" : "bg-[#e9e3ff]"}`}
											>
												<Package
													size={16}
													className={
														isHidden ? "text-slate-400" : "text-[#422afb]"
													}
												/>
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 flex-wrap">
													<span className="font-semibold text-slate-800">
														{prod.name}
													</span>
													{prod.sku && (
														<span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
															{prod.sku}
														</span>
													)}
													<span
														className={`erp-badge ${catColor(prod.category)} text-[10px]`}
													>
														{catLabel(prod.category)}
													</span>
													{isHidden && (
														<span className="erp-badge bg-slate-100 text-slate-500 text-[10px]">
															Đã ẩn
														</span>
													)}
												</div>
												<div className="flex flex-wrap gap-x-4 mt-0.5 text-xs text-slate-400">
													<span>
														ĐVT:{" "}
														<b className="text-slate-600">{prod.primaryUnit}</b>
													</span>
													{prod.defaultWarehouse && (
														<span>
															Kho:{" "}
															<b className="text-slate-600">
																{prod.defaultWarehouse.name}
															</b>
														</span>
													)}
													<span>VAT: {prod.vatRate}%</span>
													{isMaterial && singlePackaging ? (
														<>
															<span>
																SKU:{" "}
																<b className="font-mono text-slate-600">
																	{singlePackaging.sku || "—"}
																</b>
															</span>
															<span>
																Giá mua:{" "}
																<b className="text-amber-700">
																	{formatNumber(
																		getPrice(singlePackaging.prices, "COST"),
																	)}
																</b>
															</span>
															<span className="text-teal-600 font-semibold">
																Tồn: {formatNumber(singleStock)}{" "}
																{singlePackaging.unit}
															</span>
															{/* <span className="rounded bg-orange-50 px-1.5 text-orange-700">
																1 quy cách duy nhất
															</span> */}
														</>
													) : (
														<>
															<span className="text-teal-600 font-semibold">
																Tồn: {formatNumber(totalStock)}
															</span>
															<span>
																{prod.productpackagings.length} quy cách
															</span>
														</>
													)}
												</div>
											</div>
											<div className="flex items-center gap-1 flex-shrink-0">
												<button
													title={isHidden ? "Kích hoạt" : "Ẩn sản phẩm"}
													className="erp-icon-btn"
													onClick={e => {
														e.stopPropagation();
														toggleProduct.mutate({
															id: prod.id,
															isActive: !isHidden,
														});
													}}
												>
													{isHidden ? <Eye size={15} /> : <EyeOff size={15} />}
												</button>
												<button
													title="Sửa sản phẩm"
													className="erp-icon-btn"
													onClick={e => openEditProduct(prod, e)}
												>
													<Edit size={14} />
												</button>
												{prod.category !== "MATERIAL" && (
													<button
														title="Thêm quy cách"
														className="erp-icon-btn text-teal-600"
														onClick={e => openAddPkg(prod.id, e)}
													>
														<Plus size={14} />
													</button>
												)}
												{expanded ? (
													<ChevronUp size={15} className="text-slate-400" />
												) : (
													<ChevronDown size={15} className="text-slate-400" />
												)}
											</div>
										</div>

										{/* Packagings expanded */}
										{expanded && (
											<div className="border-t border-slate-100 bg-slate-50/60">
												<table className="erp-table text-xs">
													<thead>
														<tr>
															<th>Quy cách / SKU</th>
															{PRICE_TYPES.map(t => (
																<th key={t.key} className="text-right">
																	{t.label}
																</th>
															))}
															<th>Kho</th>
															<th className="text-right">Tồn</th>
															<th className="text-right">Tồn min</th>
															<th>Trạng thái</th>
															<th></th>
														</tr>
													</thead>
													<tbody>
														{prod.productpackagings.map(pk => {
															const pkStock = pk.productwarehouses.reduce(
																(s, pw) => s + (pw.stock_quantity ?? 0),
																0,
															);
															const underMin =
																(pk.min_stock ?? 0) > 0 &&
																pkStock < (pk.min_stock ?? 0);
															return (
																<tr
																	key={pk.id}
																	className={
																		pk.isActive === 0 ? "opacity-40" : ""
																	}
																>
																	<td>
																		<b>{pk.name}</b>
																		{pk.sku && (
																			<small className="font-mono text-slate-400">
																				{pk.sku}
																			</small>
																		)}
																		{pk.barcode && (
																			<small className="flex items-center gap-1 text-slate-400">
																				<Tag size={9} />
																				{pk.barcode}
																			</small>
																		)}
																	</td>
																	{PRICE_TYPES.map(t => (
																		<td
																			key={t.key}
																			className={`text-right font-semibold ${t.cls}`}
																		>
																			{formatNumber(getPrice(pk.prices, t.key))}
																		</td>
																	))}
																	<td>
																		{pk.warehouse?.name ?? (
																			<span className="text-slate-300">—</span>
																		)}
																	</td>
																	<td
																		className={`text-right font-semibold ${underMin ? "text-red-600" : ""}`}
																	>
																		{formatNumber(pkStock)} {pk.unit}
																		{underMin && (
																			<AlertTriangle
																				size={11}
																				className="inline ml-1 text-amber-500"
																			/>
																		)}
																	</td>
																	<td className="text-right text-slate-400">
																		{pk.min_stock ?? 0}
																	</td>
																	<td>
																		<span
																			className={`erp-badge ${pk.isActive !== 0 ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"}`}
																		>
																			{pk.isActive !== 0 ? "Đang bán" : "Đã ẩn"}
																		</span>
																	</td>
																	<td>
																		<div className="flex gap-1 justify-end">
																			<button
																				className="erp-icon-btn"
																				onClick={() => openEditPkg(pk)}
																			>
																				<Edit size={13} />
																			</button>
																			<button
																				className="erp-icon-btn text-red-500"
																				onClick={async () => {
																					if (
																						await confirm(
																							`Xóa quy cách "${pk.name}"?`,
																						)
																					)
																						deletePkg.mutate(pk.id);
																				}}
																			>
																				<Trash2 size={13} />
																			</button>
																		</div>
																	</td>
																</tr>
															);
														})}
													</tbody>
												</table>
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}

					<div className="erp-pagination">
						<span className="text-slate-500">
							Tổng số:{" "}
							<b className="text-slate-800">{meta?.total ?? rows.length}</b> sản
							phẩm
							{meta ? <> · Hiển thị {rows.length} dòng trang này</> : null}
						</span>
						<span className="flex-1" />
						<button
							className="erp-btn"
							disabled={page <= 1}
							onClick={() => setPage(p => p - 1)}
						>
							Trước
						</button>
						<span>
							Trang {page}/{meta?.totalPages ?? 1}
						</span>
						<button
							className="erp-btn"
							disabled={!meta || page >= meta.totalPages}
							onClick={() => setPage(p => p + 1)}
						>
							Sau
						</button>
					</div>
				</Card>
			)}

			{/* ── Tab: Cảnh báo tồn thấp ── */}
			{tab === "lowstock" && (
				<div className="erp-card overflow-hidden">
					{lowStock.isLoading ? (
						<div className="erp-empty">
							<p>Đang tải...</p>
						</div>
					) : !lowRows.length ? (
						<div className="erp-empty">
							<Package size={48} />
							<p>Tất cả hàng hóa đều đủ tồn kho tối thiểu</p>
						</div>
					) : (
						<>
							<div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
								<AlertTriangle size={16} className="text-amber-600" />
								<span className="text-sm font-semibold text-amber-800">
									{lowRows.length} quy cách dưới mức tồn tối thiểu
								</span>
							</div>
							<table className="erp-table">
								<thead>
									<tr>
										<th>Hàng hóa</th>
										<th>Loại</th>
										<th className="text-right">Tồn hiện tại</th>
										<th className="text-right">Tồn tối thiểu</th>
										<th className="text-right">Thiếu</th>
									</tr>
								</thead>
								<tbody>
									{lowRows.map(r => (
										<tr key={r.id}>
											<td>
												<b>{r.packagingName}</b>
												<small>
													{r.productName}
													{r.sku ? ` · ${r.sku}` : ""}
												</small>
											</td>
											<td>
												<span className={`erp-badge ${catColor(r.category)}`}>
													{catLabel(r.category)}
												</span>
											</td>
											<td className="text-right font-semibold text-red-600">
												{formatNumber(Number(r.stockQty))} {r.unit}
											</td>
											<td className="text-right text-slate-500">
												{formatNumber(r.min_stock)}
											</td>
											<td className="text-right font-bold text-red-700">
												{formatNumber(r.min_stock - Number(r.stockQty))}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</>
					)}
				</div>
			)}

			{/* ── Drawer phải: Tạo / Sửa vật tư hàng hóa ── */}
			{productModal && (
				<div className="fixed inset-0 z-50 flex justify-end bg-slate-900/55">
					<div className="flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl xl:max-w-6xl">
						<div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
							<div>
								<h2 className="text-lg font-bold text-slate-900">
									Thông tin vật tư, hàng hóa, dịch vụ
								</h2>
								<div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
									<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
										<span className="h-2 w-2 rounded-full bg-emerald-500" />
										{catLabel(productForm.category)}
									</span>
									<button
										type="button"
										className="text-xs font-semibold text-[#422afb] hover:underline"
										onClick={() =>
											setProductForm({
												...productForm,
												category:
													productForm.category === "MATERIAL"
														? "PRODUCT"
														: "MATERIAL",
												canBeSold: productForm.category === "MATERIAL",
											})
										}
									>
										Thay đổi tính chất
									</button>
								</div>
							</div>
							<div className="flex items-center gap-1">
								{/* <button
									type="button"
									title="Trợ giúp"
									className="erp-icon-btn"
								>
									?
								</button> */}
								<button
									type="button"
									title="Đóng"
									onClick={() => setProductModal(null)}
									className="erp-icon-btn"
								>
									<X size={18} />
								</button>
							</div>
						</div>
						<form
							onSubmit={e => {
								e.preventDefault();
								productModal === "create"
									? createProduct.mutate()
									: updateProduct.mutate();
							}}
							className="flex min-h-0 flex-1 flex-col"
						>
							<div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
								{/* Hàng 1: Tên + Mã + mã vạch */}
								<div className="grid gap-4 md:grid-cols-3">
									<Field>
										<FieldLabel required>Tên</FieldLabel>
										<Input
											required
											value={productForm.name}
											onChange={e =>
												setProductForm(
													syncProductField(productForm, {
														name: e.target.value,
													}),
												)
											}
											placeholder="Ví dụ: Cà phê hòa tan COP28 - hộp 10 gói"
										/>
									</Field>
									<Field>
										<FieldLabel required>Mã</FieldLabel>
										<Input
											required
											value={productForm.sku}
											onChange={e =>
												setProductForm(
													syncProductField(productForm, {
														sku: e.target.value,
													}),
												)
											}
											placeholder="Ví dụ: COP28-HOP10"
										/>
									</Field>
									<Field>
										<FieldLabel>Mã vạch</FieldLabel>
										<Input
											value={productForm.packaging.barcode}
											onChange={e =>
												setProductForm({
													...productForm,
													packaging: {
														...productForm.packaging,
														barcode: e.target.value,
													},
												})
											}
											placeholder="893850..."
										/>
									</Field>
								</div>

								{/* Hàng 2: Nhóm VTHH + ĐVT + bảo hành */}
								<div className="grid gap-4 md:grid-cols-3">
									<label className="text-[13px] font-medium text-slate-700">
										<span className="mb-1 block">Nhóm VTHH</span>
										<select
											value={productForm.category}
											onChange={e => {
												const nextCategory = e.target.value;
												setProductForm({
													...productForm,
													category: nextCategory,
													primaryUnit:
														nextCategory === "MATERIAL" &&
														!productForm.primaryUnit
															? "Kg"
															: productForm.primaryUnit,
													canBeSold:
														nextCategory === "MATERIAL"
															? false
															: productForm.canBeSold,
												});
											}}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										>
											{CATEGORIES.map(c => (
												<option key={c.value} value={c.value}>
													{c.label}
												</option>
											))}
										</select>
									</label>
									<label className="text-[13px] font-medium text-slate-700">
										<span className="mb-1 block">Đơn vị tính chính</span>
										<select
											value={productForm.primaryUnit}
											onChange={e =>
												setProductForm(
													syncProductField(productForm, {
														primaryUnit: e.target.value,
													}),
												)
											}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										>
											{[
												"kg",
												"g",
												"Cái",
												"Hộp",
												"Gói",
												"Thùng",
												"Bao",
												"Lít",
											].map(unit => (
												<option key={unit} value={unit}>
													{unit}
												</option>
											))}
										</select>
									</label>
									<label className="text-[13px] font-medium text-slate-700">
										<span className="mb-1 block">Hạn sử dụng</span>
										<div className="flex items-center gap-2">
											<input
												value={productForm.warrantyValue}
												onChange={e =>
													setProductForm({
														...productForm,
														warrantyValue: e.target.value,
													})
												}
												placeholder=""
												className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
											/>
											<select
												value={productForm.warrantyUnit}
												onChange={e =>
													setProductForm({
														...productForm,
														warrantyUnit: e.target.value,
													})
												}
												className="rounded border border-slate-300 px-2 py-2 text-sm outline-none focus:border-emerald-500"
											>
												<option>Tháng</option>
												<option>Năm</option>
												<option>Ngày</option>
											</select>
										</div>
									</label>
								</div>

								{/* Hàng 3: tồn min + mô tả */}
								<div className="grid gap-4 md:grid-cols-2">
									<label className="text-[13px] font-medium text-slate-700">
										<span className="mb-1 block">Số lượng tồn tối thiểu</span>
										<input
											value={productForm.minStockNote}
											onChange={e =>
												setProductForm({
													...productForm,
													minStockNote: e.target.value,
													packaging: {
														...productForm.packaging,
														min_stock: Number(e.target.value) || 0,
													},
												})
											}
											placeholder=""
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</label>
									<label className="text-[13px] font-medium text-slate-700">
										<span className="mb-1 block">Mô tả</span>
										<textarea
											rows={2}
											value={productForm.description}
											onChange={e =>
												setProductForm({
													...productForm,
													description: e.target.value,
												})
											}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</label>
								</div>

								{/* Khối kho và bảng giá gọn */}
								<div className="space-y-4 border-t border-slate-200 pt-4">
									<div className="grid gap-4 md:grid-cols-2">
										<label className="text-[13px] font-medium text-slate-700">
											<span className="mb-1 block">Kho mặc định</span>
											<select
												value={
													productForm.defaultWarehouseId ??
													productForm.packaging.warehouseId ??
													""
												}
												onChange={e =>
													setProductForm({
														...productForm,
														defaultWarehouseId: e.target.value
															? Number(e.target.value)
															: null,
														packaging: {
															...productForm.packaging,
															warehouseId: e.target.value
																? Number(e.target.value)
																: null,
														},
													})
												}
												className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
											>
												<option value="">Chọn kho</option>
												{warehouseList.map(w => (
													<option key={w.id} value={w.id}>
														{w.name}
													</option>
												))}
											</select>
										</label>
										<label className="text-[13px] font-medium text-slate-700">
											<span className="mb-1 block">Thuế GTGT (%)</span>
											<input
												type="number"
												min={0}
												max={100}
												step="any"
												value={productForm.vatRate}
												onChange={e =>
													setProductForm({
														...productForm,
														vatRate: Number(e.target.value),
													})
												}
												className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
											/>
										</label>
									</div>
									<div className="overflow-hidden rounded-lg border border-slate-200">
										<table className="w-full border-collapse text-[13px]">
											<thead>
												<tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
													<th className="px-3 py-2 font-semibold">Loại giá</th>
													<th className="px-3 py-2 text-right font-semibold">
														Giá trị
													</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-slate-100 bg-white">
												<tr>
													<td
														className="px-3 py-2 font-medium text-slate-700"
														title="Giá thành mua hàng, hoặc giá thành sản xuất của 1 đơn vị sản phẩm"
													>
														Giá cost (vốn)
													</td>
													<td className="px-3 py-2">
														<input
															type="number"
															min={0}
															step="any"
															value={productForm.fixedPurchasePrice}
															onChange={e =>
																setProductForm({
																	...productForm,
																	fixedPurchasePrice: Number(e.target.value),
																})
															}
															className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm outline-none focus:border-emerald-500"
														/>
													</td>
												</tr>
												<tr>
													<td className="px-3 py-2 font-medium text-slate-700">
														Đơn giá mua gần nhất
													</td>
													<td className="px-3 py-2">
														<input
															type="number"
															min={0}
															step="any"
															value={productForm.latestPurchasePrice}
															onChange={e => {
																const next = Number(e.target.value);
																const prices =
																	productForm.packaging.prices.filter(
																		p => p.priceType !== "COST",
																	);
																setProductForm({
																	...productForm,
																	latestPurchasePrice: next,
																	packaging: {
																		...productForm.packaging,
																		prices: [
																			...prices,
																			{ priceType: "COST", price: next },
																		],
																	},
																});
															}}
															className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm outline-none focus:border-emerald-500"
														/>
													</td>
												</tr>
												<tr>
													<td className="px-3 py-2 font-medium text-slate-700">
														Giá bán đại lý/NPP
													</td>
													<td className="px-3 py-2">
														<input
															type="number"
															min={0}
															step="any"
															value={getPrice(
																productForm.packaging.prices,
																"SALE_1",
															)}
															onChange={e => {
																const next = Number(e.target.value);
																const prices =
																	productForm.packaging.prices.filter(
																		p => p.priceType !== "SALE_1",
																	);
																setProductForm({
																	...productForm,
																	salesPrice: next,
																	packaging: {
																		...productForm.packaging,
																		prices: [
																			...prices,
																			{ priceType: "SALE_1", price: next },
																		],
																	},
																});
															}}
															className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm outline-none focus:border-emerald-500"
														/>
													</td>
												</tr>
												<tr>
													<td className="px-3 py-2 font-medium text-slate-700">
														Giá bán cao tốc
													</td>
													<td className="px-3 py-2">
														<input
															type="number"
															min={0}
															step="any"
															value={getPrice(
																productForm.packaging.prices,
																"SALE_2",
															)}
															onChange={e => {
																const next = Number(e.target.value);
																const prices =
																	productForm.packaging.prices.filter(
																		p => p.priceType !== "SALE_2",
																	);
																setProductForm({
																	...productForm,
																	packaging: {
																		...productForm.packaging,
																		prices: [
																			...prices,
																			{ priceType: "SALE_2", price: next },
																		],
																	},
																});
															}}
															className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm outline-none focus:border-emerald-500"
														/>
													</td>
												</tr>
												<tr>
													<td className="px-3 py-2 font-medium text-slate-700">
														Giá bán lẻ
													</td>
													<td className="px-3 py-2">
														<input
															type="number"
															min={0}
															step="any"
															value={getPrice(
																productForm.packaging.prices,
																"SALE_3",
															)}
															onChange={e => {
																const next = Number(e.target.value);
																const prices =
																	productForm.packaging.prices.filter(
																		p => p.priceType !== "SALE_3",
																	);
																setProductForm({
																	...productForm,
																	packaging: {
																		...productForm.packaging,
																		prices: [
																			...prices,
																			{ priceType: "SALE_3", price: next },
																		],
																	},
																});
															}}
															className="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm outline-none focus:border-emerald-500"
														/>
													</td>
												</tr>
											</tbody>
										</table>
										<label className="flex items-center gap-2 bg-slate-50 px-3 py-2 text-xs font-normal text-slate-600">
											<input
												type="checkbox"
												checked={productForm.priceIncludesTax}
												onChange={e =>
													setProductForm({
														...productForm,
														priceIncludesTax: e.target.checked,
													})
												}
												className="h-4 w-4 accent-emerald-600"
											/>
											Giá bán là đơn giá sau thuế
										</label>
									</div>
								</div>

								{/* Thuộc tính hệ thống gọn */}
								<details className="rounded border border-slate-200 bg-slate-50 px-4 py-3">
									<summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-500">
										Thuộc tính hệ thống
									</summary>
									<div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
										{[
											{ key: "canManageInventory", label: "Quản lý tồn kho" },
											{ key: "canBePurchased", label: "Có thể mua" },
											{ key: "canBeSold", label: "Có thể bán" },
											{ key: "canBeProduced", label: "Sản xuất được" },
											{ key: "canBeBomComponent", label: "Là nguyên liệu BOM" },
										].map(f => (
											<label
												key={f.key}
												className="flex items-center gap-2 cursor-pointer text-[13px] font-normal text-slate-700"
											>
												<input
													type="checkbox"
													checked={Boolean((productForm as any)[f.key])}
													onChange={e =>
														setProductForm({
															...productForm,
															[f.key]: e.target.checked,
														})
													}
													className="h-4 w-4 accent-emerald-600"
												/>
												{f.label}
											</label>
										))}
									</div>
								</details>

								{/* Một mã là một sản phẩm riêng biệt, xem và sửa BOM ngay tại đây */}
								{productModal && (
									<div>
										<div className="mt-4">
											<div className="mb-2 flex items-center justify-between">
												<p className="text-xs font-bold uppercase tracking-wider text-slate-400">
													Định mức lắp ráp:
												</p>
												<button
													type="button"
													className="erp-btn erp-btn-sm"
													onClick={() =>
														setProductForm({
															...productForm,
															bomLines: [
																...productForm.bomLines,
																{ packagingId: 0, quantity: 20, unit: "g" },
															],
														})
													}
												>
													+ Thêm nguyên liệu
												</button>
											</div>
											{!productForm.bomLines.length ? (
												<p className="rounded border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-400">
													Chưa có định mức. Thêm từng mã nguyên liệu cấu thành
													mã này.
												</p>
											) : (
												<div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
													<table className="w-full min-w-[820px] table-fixed border-collapse text-[13px]">
														<thead>
															<tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
																<th className="w-[56px] px-3 py-2 text-center font-semibold">
																	STT
																</th>
																<th className="w-[200px] px-3 py-2 font-semibold">
																	Mã nguyên liệu
																</th>
																<th className="px-3 py-2 font-semibold">
																	Tên nguyên liệu
																</th>
																<th className="w-[110px] px-3 py-2 font-semibold">
																	Đơn vị tính
																</th>
																<th className="w-[130px] px-3 py-2 text-right font-semibold">
																	Số lượng
																</th>
																<th className="w-[70px] px-3 py-2 text-center font-semibold">
																	Chức năng
																</th>
															</tr>
														</thead>
														<tbody className="divide-y divide-slate-100">
															{productForm.bomLines.map((line, index) => {
																const selectedMaterial = findMaterial(
																	line.packagingId,
																);
																const displayName =
																	line.materialName ||
																	(selectedMaterial
																		? formatProductName(
																				selectedMaterial.prod.name,
																				selectedMaterial.pk.name,
																			)
																		: "");
																return (
																	<tr key={index}>
																		<td className="px-3 py-2 text-center">
																			{index + 1}
																		</td>
																		<td className="px-3 py-2">
																			<SearchableSelect
																				value={line.packagingId}
																				options={materialOptions}
																				autoAdvance
																				placeholder="Tìm mã hoặc tên nguyên liệu"
																				onChange={packagingId => {
																					const material =
																						findMaterial(packagingId);
																					const materialName = material
																						? formatProductName(
																								material.prod.name,
																								material.pk.name,
																							)
																						: "";
																					const materialUnit =
																						material?.pk.unit || "g";
																					setProductForm({
																						...productForm,
																						bomLines: productForm.bomLines.map(
																							(item, position) =>
																								position === index
																									? {
																											...item,
																											packagingId,
																											materialName,
																											materialUnit,
																											unit: materialUnit,
																										}
																									: item,
																						),
																					});
																				}}
																			/>
																		</td>
																		<td className="px-3 py-2 font-medium text-slate-700">
																			{displayName || (
																				<span className="text-slate-400">
																					Chưa chọn
																				</span>
																			)}
																		</td>
																		<td className="px-3 py-2">
																			{(() => {
																				const materialUnit =
																					line.materialUnit ||
																					findMaterial(line.packagingId)?.pk
																						.unit ||
																					line.unit ||
																					"g";
																				const unitOptions = Array.from(
																					new Set(
																						[
																							materialUnit,
																							"kg",
																							"g",
																							"mg",
																							"ton",
																						].filter(Boolean),
																					),
																				);
																				return (
																					<select
																						value={line.unit || materialUnit}
																						title={
																							line.materialUnit ||
																							selectedMaterial
																								? `Đơn vị gốc của hàng hóa: ${materialUnit}`
																								: "Đơn vị định mức, hệ thống tự quy đổi khối lượng khi lưu"
																						}
																						onChange={e =>
																							setProductForm({
																								...productForm,
																								bomLines:
																									productForm.bomLines.map(
																										(item, position) =>
																											position === index
																												? {
																														...item,
																														unit: e.target
																															.value,
																													}
																												: item,
																									),
																							})
																						}
																						className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
																					>
																						{unitOptions.map(unit => (
																							<option key={unit} value={unit}>
																								{unit}
																							</option>
																						))}
																					</select>
																				);
																			})()}
																		</td>
																		<td className="px-3 py-2">
																			<input
																				type="number"
																				min={0.0001}
																				step={0.0001}
																				value={line.quantity}
																				placeholder="Ví dụ 20"
																				title="Nhập theo đơn vị đã chọn, ví dụ 20 g"
																				onChange={e =>
																					setProductForm({
																						...productForm,
																						bomLines: productForm.bomLines.map(
																							(item, position) =>
																								position === index
																									? {
																											...item,
																											quantity: Number(
																												e.target.value,
																											),
																										}
																									: item,
																						),
																					})
																				}
																				className="w-full rounded border border-slate-300 px-2 py-1.5 text-right text-sm"
																			/>
																		</td>
																		<td className="px-3 py-2 text-center">
																			<button
																				type="button"
																				className="erp-icon-btn !h-7 !w-7 text-red-500"
																				onClick={() =>
																					setProductForm({
																						...productForm,
																						bomLines:
																							productForm.bomLines.filter(
																								(_, position) =>
																									position !== index,
																							),
																					})
																				}
																			>
																				<Trash2 size={14} />
																			</button>
																		</td>
																	</tr>
																);
															})}
														</tbody>
													</table>
												</div>
											)}
										</div>
									</div>
								)}
							</div>
							<div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
								<button
									type="button"
									onClick={() => setProductModal(null)}
									className="erp-btn"
								>
									Hủy
								</button>
								{/* <button
									type="button"
									onClick={() => {
										productModal === "create"
											? createProduct.mutate()
											: updateProduct.mutate();
									}}
									disabled={createProduct.isPending || updateProduct.isPending}
									className="erp-btn"
								>
									Cất
								</button> */}
								<button
									type="submit"
									disabled={createProduct.isPending || updateProduct.isPending}
									className="erp-btn erp-btn-primary"
								>
									<Save size={14} />{" "}
									{createProduct.isPending || updateProduct.isPending
										? "Đang lưu..."
										: "Lưu"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* ── Drawer phải: Thêm / Sửa quy cách ── */}
			{pkgModal && (
				<div className="fixed inset-0 z-50 flex justify-end bg-slate-900/55">
					<div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
						<div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
							<div>
								<h2 className="text-lg font-bold text-slate-900">
									{pkgModal === "create"
										? "Thêm quy cách"
										: `Sửa quy cách: ${pkgForm.name}`}
								</h2>
								<p className="mt-1 text-xs text-slate-500">
									Thông tin, tồn tối thiểu và bảng giá
								</p>
							</div>
							<div className="flex items-center gap-1">
								<button type="button" title="Trợ giúp" className="erp-icon-btn">
									?
								</button>
								<button
									type="button"
									title="Đóng"
									onClick={() => setPkgModal(null)}
									className="erp-icon-btn"
								>
									<X size={18} />
								</button>
							</div>
						</div>
						<form
							onSubmit={e => {
								e.preventDefault();
								savePkg.mutate();
							}}
							className="flex min-h-0 flex-1 flex-col"
						>
							<div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
								<div className="grid gap-4 md:grid-cols-2">
									<label className="text-[13px] font-medium text-slate-700 md:col-span-2">
										<span className="mb-1 block">
											Tên quy cách <span className="text-red-500">*</span>
										</span>
										<input
											required
											value={pkgForm.name}
											onChange={e =>
												setPkgForm({ ...pkgForm, name: e.target.value })
											}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</label>
									{pkgModal === "create" && (
										<label className="text-[13px] font-medium text-slate-700">
											<span className="mb-1 block">SKU</span>
											<input
												value={pkgForm.sku}
												onChange={e =>
													setPkgForm({ ...pkgForm, sku: e.target.value })
												}
												className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
											/>
										</label>
									)}
									<label className="text-[13px] font-medium text-slate-700">
										<span className="mb-1 block">
											Đơn vị tính <span className="text-red-500">*</span>
										</span>
										<input
											required
											value={pkgForm.unit}
											onChange={e =>
												setPkgForm({ ...pkgForm, unit: e.target.value })
											}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</label>
									<label className="text-[13px] font-medium text-slate-700">
										<span className="mb-1 block">SL quy đổi (gói/hộp)</span>
										<input
											type="number"
											min={1}
											value={pkgForm.packCount}
											onChange={e =>
												setPkgForm({
													...pkgForm,
													packCount: Number(e.target.value),
												})
											}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</label>
									<label className="text-[13px] font-medium text-slate-700">
										<span className="mb-1 block">Tồn tối thiểu</span>
										<input
											type="number"
											min={0}
											value={pkgForm.min_stock}
											onChange={e =>
												setPkgForm({
													...pkgForm,
													min_stock: Number(e.target.value),
												})
											}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</label>
									<label className="text-[13px] font-medium text-slate-700">
										<span className="mb-1 block">HSD (tháng)</span>
										<input
											type="number"
											min={0}
											value={pkgForm.shelfLifeMonths}
											onChange={e =>
												setPkgForm({
													...pkgForm,
													shelfLifeMonths: Number(e.target.value),
												})
											}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</label>
									<label className="text-[13px] font-medium text-slate-700">
										<span className="mb-1 block">Khối lượng tịnh (kg)</span>
										<input
											type="number"
											min={0}
											step="0.001"
											value={pkgForm.netWeight}
											onChange={e =>
												setPkgForm({
													...pkgForm,
													netWeight: Number(e.target.value),
												})
											}
											placeholder="VD: 0.017"
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</label>
									<label className="text-[13px] font-medium text-slate-700">
										<span className="mb-1 block">Kho mặc định</span>
										<select
											value={pkgForm.warehouseId ?? ""}
											onChange={e =>
												setPkgForm({
													...pkgForm,
													warehouseId: e.target.value
														? Number(e.target.value)
														: null,
												})
											}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										>
											<option value="">Không có</option>
											{warehouseList.map(w => (
												<option key={w.id} value={w.id}>
													{w.name}
												</option>
											))}
										</select>
									</label>
									<label className="text-[13px] font-medium text-slate-700">
										<span className="mb-1 block">Mã vạch</span>
										<input
											value={pkgForm.barcode}
											onChange={e =>
												setPkgForm({ ...pkgForm, barcode: e.target.value })
											}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</label>
									{pkgModal === "edit" && (
										<label className="flex cursor-pointer flex-row items-center gap-2 text-[13px] font-normal text-slate-700">
											<input
												type="checkbox"
												checked={pkgForm.isActive}
												onChange={e =>
													setPkgForm({ ...pkgForm, isActive: e.target.checked })
												}
												className="h-4 w-4 accent-emerald-600"
											/>
											Đang bán / Kích hoạt
										</label>
									)}
								</div>
								<div>
									<p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
										Bảng giá
									</p>
									<PriceEditor
										prices={pkgForm.prices}
										onChange={prices => setPkgForm({ ...pkgForm, prices })}
									/>
								</div>
							</div>
							<div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
								<button
									type="button"
									onClick={() => setPkgModal(null)}
									className="erp-btn"
								>
									Hủy
								</button>
								{/* <button
									type="button"
									onClick={() => savePkg.mutate()}
									disabled={savePkg.isPending}
									className="erp-btn"
								>
									Cất
								</button> */}
								<button
									type="submit"
									disabled={savePkg.isPending}
									className="erp-btn erp-btn-primary"
								>
									<Save size={14} /> {savePkg.isPending ? "Đang lưu..." : "Lưu"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

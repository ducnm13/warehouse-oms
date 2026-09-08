import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ChevronDown, ChevronUp, Download, Edit, Eye, EyeOff,
  Package, Plus, Search, Tag, Trash2, X, Save,
} from "lucide-react";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { apiV1 } from "../lib/apiV1";
import { formatNumber } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProductPrice { packagingId?: number; priceType: string; price: number; }
interface PackagingV1 {
  id: number; name: string; sku?: string; unit?: string; packCount: number;
  netWeight?: number; shelfLifeMonths?: number; min_stock?: number;
  warehouseId?: number | null; barcode?: string | null;
  isActive: number; deletedAt?: string | null;
  prices: ProductPrice[];
  productwarehouses: Array<{ warehouseId: number; stock_quantity: number; warehouses: { id: number; name: string } }>;
  warehouse?: { id: number; name: string } | null;
}
interface ProductV1 {
  id: number; name: string; sku?: string; category?: string;
  description?: string | null; primaryUnit: string;
  defaultWarehouseId?: number | null; vatRate: number | string;
  canManageInventory: number; canBePurchased: number; canBeSold: number;
  canBeProduced: number; canBeBomComponent: number; isActive?: number;
  defaultWarehouse?: { id: number; name: string } | null;
  productpackagings: PackagingV1[];
}
interface ListResponse { data: ProductV1[]; meta: { page: number; limit: number; total: number; totalPages: number }; }
interface WarehouseRef { id: number; name: string; }
interface LowStockRow { id: number; packagingName: string; sku?: string; unit?: string; productName: string; category: string; min_stock: number; stockQty: number; }

const CATEGORIES = [
  { value: "PRODUCT",   label: "Thành phẩm",        color: "bg-violet-100 text-violet-700" },
  { value: "MATERIAL",  label: "Nguyên vật liệu",   color: "bg-orange-100 text-orange-700" },
  { value: "PACKAGING", label: "Bao bì",             color: "bg-sky-100 text-sky-700" },
  { value: "SERVICE",   label: "Dịch vụ",            color: "bg-pink-100 text-pink-700" },
];
const catLabel = (c?: string) => CATEGORIES.find(x => x.value === c)?.label ?? c ?? "";
const catColor = (c?: string) => CATEGORIES.find(x => x.value === c)?.color ?? "bg-slate-100 text-slate-500";

const PRICE_TYPES = [
  { key: "COST",   label: "Giá vốn",  cls: "text-amber-700" },
  { key: "SALE_1", label: "Giá bán 1", cls: "text-teal-700" },
  { key: "SALE_2", label: "Giá bán 2", cls: "text-slate-600" },
  { key: "SALE_3", label: "Giá bán 3", cls: "text-slate-600" },
];
const getPrice = (prices: ProductPrice[], type: string) =>
  prices.find(p => p.priceType === type)?.price ?? 0;

// ─── Price Editor ─────────────────────────────────────────────────────────────
function PriceEditor({ prices, onChange }: { prices: ProductPrice[]; onChange: (p: ProductPrice[]) => void }) {
  const set = (type: string, val: number) => {
    const existing = prices.find(p => p.priceType === type);
    if (existing) onChange(prices.map(p => p.priceType === type ? { ...p, price: val } : p));
    else onChange([...prices, { priceType: type, price: val }]);
  };
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {PRICE_TYPES.map(t => (
        <label key={t.key} className="text-xs font-semibold text-slate-500">
          {t.label}
          <input
            type="number" min={0} step="any"
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
  id?: number; productId?: number; name: string; sku: string; unit: string;
  packCount: number; netWeight: number; shelfLifeMonths: number;
  min_stock: number; warehouseId: number | null; barcode: string;
  isActive: boolean; prices: ProductPrice[];
}
const emptyPkg = (productId?: number): PkgForm => ({
  id: undefined, productId, name: "", sku: "", unit: "Cái",
  packCount: 1, netWeight: 0, shelfLifeMonths: 24, min_stock: 0,
  warehouseId: null, barcode: "", isActive: true, prices: [],
});

interface ProductForm {
  name: string; sku: string; category: string; description: string;
  primaryUnit: string; defaultWarehouseId: number | null; vatRate: number;
  canManageInventory: boolean; canBePurchased: boolean; canBeSold: boolean;
  canBeProduced: boolean; canBeBomComponent: boolean;
  packaging: PkgForm;
}
const emptyProductForm = (): ProductForm => ({
  name: "", sku: "", category: "PRODUCT", description: "",
  primaryUnit: "Cái", defaultWarehouseId: null, vatRate: 0,
  canManageInventory: true, canBePurchased: true, canBeSold: true, canBeProduced: false, canBeBomComponent: true,
  packaging: emptyPkg(),
});
const productToEditForm = (p: ProductV1): ProductForm => ({
  name: p.name, sku: p.sku ?? "", category: p.category ?? "PRODUCT",
  description: p.description ?? "", primaryUnit: p.primaryUnit,
  defaultWarehouseId: p.defaultWarehouseId ?? null, vatRate: Number(p.vatRate),
  canManageInventory: Boolean(p.canManageInventory), canBePurchased: Boolean(p.canBePurchased),
  canBeSold: Boolean(p.canBeSold), canBeProduced: Boolean(p.canBeProduced), canBeBomComponent: Boolean(p.canBeBomComponent),
  packaging: emptyPkg(p.id),
});
const pkgToForm = (pk: PackagingV1): PkgForm => ({
  id: pk.id, productId: undefined,
  name: pk.name, sku: pk.sku ?? "", unit: pk.unit ?? "Cái",
  packCount: pk.packCount, netWeight: pk.netWeight ?? 0,
  shelfLifeMonths: pk.shelfLifeMonths ?? 24, min_stock: pk.min_stock ?? 0,
  warehouseId: pk.warehouseId ?? null, barcode: pk.barcode ?? "",
  isActive: pk.isActive !== 0, prices: pk.prices ?? [],
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CatalogProducts() {
  const qc = useQueryClient();
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [category, setCategory]   = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [tab, setTab]             = useState<"list" | "lowstock">("list");

  // Modals
  const [productModal, setProductModal]   = useState<"create" | "edit" | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductV1 | null>(null);
  const [productForm, setProductForm]     = useState<ProductForm>(emptyProductForm());
  const [pkgModal, setPkgModal]           = useState<"create" | "edit" | null>(null);
  const [pkgForm, setPkgForm]             = useState<PkgForm>(emptyPkg());

  // Queries
  const warehouses = useQuery({
    queryKey: ["warehouses-catalog-ref"],
    queryFn: () => apiV1<WarehouseRef[]>("/api/v1/catalog/warehouses"),
    staleTime: 60_000,
  });
  const warehouseList: WarehouseRef[] = (warehouses.data?.data as any) ?? [];

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
  const meta = data?.data?.meta;
  const lowRows: LowStockRow[] = (lowStock.data?.data as any) ?? [];

  // Mutations
  const invalidate = () => qc.invalidateQueries({ queryKey: ["catalog-products"] });

  const createProduct = useMutation({
    mutationFn: () => apiV1<ProductV1>("/api/v1/catalog/products", {
      method: "POST",
      body: JSON.stringify({
        name: productForm.name, sku: productForm.sku || null, category: productForm.category,
        description: productForm.description || null, primaryUnit: productForm.primaryUnit,
        defaultWarehouseId: productForm.defaultWarehouseId, vatRate: productForm.vatRate,
        canManageInventory: productForm.canManageInventory, canBePurchased: productForm.canBePurchased,
        canBeSold: productForm.canBeSold, canBeProduced: productForm.canBeProduced, canBeBomComponent: productForm.canBeBomComponent,
        packaging: {
          name: productForm.packaging.name, sku: productForm.packaging.sku || null,
          unit: productForm.packaging.unit, packCount: productForm.packaging.packCount,
          netWeight: productForm.packaging.netWeight, shelfLifeMonths: productForm.packaging.shelfLifeMonths,
          min_stock: productForm.packaging.min_stock, warehouseId: productForm.packaging.warehouseId,
          barcode: productForm.packaging.barcode || null, prices: productForm.packaging.prices,
        },
      }),
    }),
    onSuccess: r => { toast.success(r.message); setProductModal(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProduct = useMutation({
    mutationFn: () => apiV1<ProductV1>(`/api/v1/catalog/products/${editingProduct!.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: productForm.name, sku: productForm.sku || null, description: productForm.description || null,
        primaryUnit: productForm.primaryUnit, defaultWarehouseId: productForm.defaultWarehouseId, vatRate: productForm.vatRate,
        canManageInventory: productForm.canManageInventory, canBePurchased: productForm.canBePurchased,
        canBeSold: productForm.canBeSold, canBeProduced: productForm.canBeProduced, canBeBomComponent: productForm.canBeBomComponent,
      }),
    }),
    onSuccess: r => { toast.success(r.message); setProductModal(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleProduct = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiV1(`/api/v1/catalog/products/${id}/toggle`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: r => { toast.success(r.message); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePkg = useMutation({
    mutationFn: () => pkgForm.id
      ? apiV1(`/api/v1/catalog/packagings/${pkgForm.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: pkgForm.name, unit: pkgForm.unit, packCount: pkgForm.packCount,
            netWeight: pkgForm.netWeight, shelfLifeMonths: pkgForm.shelfLifeMonths,
            min_stock: pkgForm.min_stock, warehouseId: pkgForm.warehouseId,
            barcode: pkgForm.barcode || null, isActive: pkgForm.isActive, prices: pkgForm.prices,
          }),
        })
      : apiV1("/api/v1/catalog/packagings", {
          method: "POST",
          body: JSON.stringify({
            productId: pkgForm.productId, name: pkgForm.name, sku: pkgForm.sku || null,
            unit: pkgForm.unit, packCount: pkgForm.packCount, netWeight: pkgForm.netWeight,
            shelfLifeMonths: pkgForm.shelfLifeMonths, min_stock: pkgForm.min_stock,
            warehouseId: pkgForm.warehouseId, barcode: pkgForm.barcode || null, prices: pkgForm.prices,
          }),
        }),
    onSuccess: r => { toast.success(r.message); setPkgModal(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePkg = useMutation({
    mutationFn: (id: number) => apiV1(`/api/v1/catalog/packagings/${id}`, { method: "DELETE" }),
    onSuccess: r => { toast.success(r.message); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Handlers ──
  const openCreateProduct = () => { setEditingProduct(null); setProductForm(emptyProductForm()); setProductModal("create"); };
  const openEditProduct = (p: ProductV1, e: React.MouseEvent) => { e.stopPropagation(); setEditingProduct(p); setProductForm(productToEditForm(p)); setProductModal("edit"); };
  const openAddPkg = (productId: number, e: React.MouseEvent) => { e.stopPropagation(); setPkgForm(emptyPkg(productId)); setPkgModal("create"); };
  const openEditPkg = (pk: PackagingV1) => { setPkgForm(pkgToForm(pk)); setPkgModal("edit"); };

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
      { header: "Giá vốn", key: "cost", width: 14 },
      { header: "Giá bán 1", key: "sale1", width: 14 },
      { header: "Giá bán 2", key: "sale2", width: 14 },
      { header: "Giá bán 3", key: "sale3", width: 14 },
      { header: "Tồn kho", key: "stock", width: 12 },
      { header: "Tồn tối thiểu", key: "minStock", width: 14 },
      { header: "Kho", key: "warehouse", width: 18 },
      { header: "Trạng thái", key: "status", width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };

    for (const prod of rows) {
      for (const pk of prod.productpackagings) {
        const stock = pk.productwarehouses.reduce((s, pw) => s + (pw.stock_quantity ?? 0), 0);
        ws.addRow({
          productName: prod.name, category: catLabel(prod.category),
          name: pk.name, sku: pk.sku ?? "", unit: pk.unit ?? "",
          cost: getPrice(pk.prices, "COST"), sale1: getPrice(pk.prices, "SALE_1"),
          sale2: getPrice(pk.prices, "SALE_2"), sale3: getPrice(pk.prices, "SALE_3"),
          stock, minStock: pk.min_stock ?? 0, warehouse: pk.warehouse?.name ?? "",
          status: pk.isActive !== 0 ? "Đang bán" : "Đã ẩn",
        });
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "danh-muc-hang-hoa.xlsx");
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="erp-page">
      {/* Header */}
      <div className="erp-page-header">
        <div>
          <h1>Danh mục hàng hóa</h1>
          <p>Quản lý vật tư, thành phẩm, bao bì và dịch vụ — giá bán, giá vốn, tồn kho</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="erp-btn" onClick={exportExcel}><Download size={15} /> Xuất Excel</button>
          <button className="erp-btn erp-btn-primary" onClick={openCreateProduct}><Plus size={16} /> Thêm hàng hóa</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: "list", label: "Danh sách" },
          { key: "lowstock", label: `Cảnh báo tồn thấp${lowRows.length ? ` (${lowRows.length})` : ""}` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-600 border-b-2 transition-colors ${tab === t.key
              ? "border-teal-500 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t.key === "lowstock" && lowRows.length > 0 && (
              <AlertTriangle size={13} className="inline mr-1.5 text-amber-500" />
            )}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Danh sách ── */}
      {tab === "list" && (
        <div className="erp-card overflow-hidden">
          <div className="erp-toolbar">
            <div className="erp-search">
              <Search size={15} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm tên, SKU..." />
            </div>
            <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
              <option value="">Tất cả loại</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {isLoading ? (
            <div className="erp-empty"><p>Đang tải...</p></div>
          ) : isError ? (
            <div className="erp-empty"><p className="text-red-500">{(error as Error).message}</p></div>
          ) : !rows.length ? (
            <div className="erp-empty">
              <Package size={48} />
              <p>Chưa có hàng hóa nào</p>
            </div>
          ) : (
            <div>
              {rows.map(prod => {
                const expanded = expandedId === prod.id;
                const totalStock = prod.productpackagings.reduce(
                  (s, pk) => s + pk.productwarehouses.reduce((ss, pw) => ss + (pw.stock_quantity ?? 0), 0), 0,
                );
                const isHidden = prod.isActive === 0;
                return (
                  <div key={prod.id} className={isHidden ? "opacity-60" : ""}>
                    {/* Product row */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                      onClick={() => setExpandedId(prev => prev === prod.id ? null : prod.id)}
                    >
                      <div className={`p-2 rounded-lg flex-shrink-0 ${isHidden ? "bg-slate-100" : "bg-teal-50"}`}>
                        <Package size={16} className={isHidden ? "text-slate-400" : "text-teal-600"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800">{prod.name}</span>
                          {prod.sku && <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{prod.sku}</span>}
                          <span className={`erp-badge ${catColor(prod.category)} text-[10px]`}>{catLabel(prod.category)}</span>
                          {isHidden && <span className="erp-badge bg-slate-100 text-slate-500 text-[10px]">Đã ẩn</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 mt-0.5 text-xs text-slate-400">
                          <span>ĐVT: <b className="text-slate-600">{prod.primaryUnit}</b></span>
                          {prod.defaultWarehouse && <span>Kho: <b className="text-slate-600">{prod.defaultWarehouse.name}</b></span>}
                          <span>VAT: {prod.vatRate}%</span>
                          <span className="text-teal-600 font-semibold">Tồn: {formatNumber(totalStock)}</span>
                          <span>{prod.productpackagings.length} quy cách</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          title={isHidden ? "Kích hoạt" : "Ẩn sản phẩm"}
                          className="erp-icon-btn"
                          onClick={e => { e.stopPropagation(); toggleProduct.mutate({ id: prod.id, isActive: !isHidden }); }}
                        >
                          {isHidden ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                        <button title="Sửa sản phẩm" className="erp-icon-btn" onClick={e => openEditProduct(prod, e)}>
                          <Edit size={14} />
                        </button>
                        <button title="Thêm quy cách" className="erp-icon-btn text-teal-600" onClick={e => openAddPkg(prod.id, e)}>
                          <Plus size={14} />
                        </button>
                        {expanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                      </div>
                    </div>

                    {/* Packagings expanded */}
                    {expanded && (
                      <div className="border-t border-slate-100 bg-slate-50/60">
                        <table className="erp-table text-xs">
                          <thead>
                            <tr>
                              <th>Quy cách / SKU</th>
                              {PRICE_TYPES.map(t => <th key={t.key} className="text-right">{t.label}</th>)}
                              <th>Kho</th>
                              <th className="text-right">Tồn</th>
                              <th className="text-right">Tồn min</th>
                              <th>Trạng thái</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {prod.productpackagings.map(pk => {
                              const pkStock = pk.productwarehouses.reduce((s, pw) => s + (pw.stock_quantity ?? 0), 0);
                              const underMin = (pk.min_stock ?? 0) > 0 && pkStock < (pk.min_stock ?? 0);
                              return (
                                <tr key={pk.id} className={pk.isActive === 0 ? "opacity-40" : ""}>
                                  <td>
                                    <b>{pk.name}</b>
                                    {pk.sku && <small className="font-mono text-slate-400">{pk.sku}</small>}
                                    {pk.barcode && <small className="flex items-center gap-1 text-slate-400"><Tag size={9} />{pk.barcode}</small>}
                                  </td>
                                  {PRICE_TYPES.map(t => (
                                    <td key={t.key} className={`text-right font-semibold ${t.cls}`}>
                                      {formatNumber(getPrice(pk.prices, t.key))}
                                    </td>
                                  ))}
                                  <td>{pk.warehouse?.name ?? <span className="text-slate-300">—</span>}</td>
                                  <td className={`text-right font-semibold ${underMin ? "text-red-600" : ""}`}>
                                    {formatNumber(pkStock)} {pk.unit}
                                    {underMin && <AlertTriangle size={11} className="inline ml-1 text-amber-500" />}
                                  </td>
                                  <td className="text-right text-slate-400">{pk.min_stock ?? 0}</td>
                                  <td>
                                    <span className={`erp-badge ${pk.isActive !== 0 ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"}`}>
                                      {pk.isActive !== 0 ? "Đang bán" : "Đã ẩn"}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="flex gap-1 justify-end">
                                      <button className="erp-icon-btn" onClick={() => openEditPkg(pk)}>
                                        <Edit size={13} />
                                      </button>
                                      <button
                                        className="erp-icon-btn text-red-500"
                                        onClick={() => { if (window.confirm(`Xóa quy cách "${pk.name}"?`)) deletePkg.mutate(pk.id); }}
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

          {meta && meta.totalPages > 1 && (
            <div className="erp-pagination">
              <button className="erp-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</button>
              <span>Trang {page}/{meta.totalPages} · {meta.total} sản phẩm</span>
              <button className="erp-btn" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>Sau</button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Cảnh báo tồn thấp ── */}
      {tab === "lowstock" && (
        <div className="erp-card overflow-hidden">
          {lowStock.isLoading ? (
            <div className="erp-empty"><p>Đang tải...</p></div>
          ) : !lowRows.length ? (
            <div className="erp-empty">
              <Package size={48} />
              <p>Tất cả hàng hóa đều đủ tồn kho tối thiểu</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">{lowRows.length} quy cách dưới mức tồn tối thiểu</span>
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
                        <small>{r.productName}{r.sku ? ` · ${r.sku}` : ""}</small>
                      </td>
                      <td><span className={`erp-badge ${catColor(r.category)}`}>{catLabel(r.category)}</span></td>
                      <td className="text-right font-semibold text-red-600">{formatNumber(Number(r.stockQty))} {r.unit}</td>
                      <td className="text-right text-slate-500">{formatNumber(r.min_stock)}</td>
                      <td className="text-right font-bold text-red-700">{formatNumber(r.min_stock - Number(r.stockQty))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ── Modal: Tạo / Sửa sản phẩm ── */}
      {productModal && (
        <div className="erp-modal-backdrop">
          <div className="erp-modal max-w-2xl">
            <div className="erp-modal-header">
              <div>
                <h2>{productModal === "create" ? "Thêm hàng hóa mới" : `Sửa: ${editingProduct?.name}`}</h2>
                <p>Thông tin sản phẩm, thuộc tính và {productModal === "create" ? "quy cách đầu tiên" : "cài đặt"}</p>
              </div>
              <button onClick={() => setProductModal(null)}><X /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); productModal === "create" ? createProduct.mutate() : updateProduct.mutate(); }}>
              <div className="erp-modal-body space-y-5">
                {/* Thông tin cơ bản */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Thông tin cơ bản</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="md:col-span-2">
                      Tên hàng hóa <span className="text-red-500">*</span>
                      <input required value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} placeholder="Cà phê hòa tan CLC28..." />
                    </label>
                    <label>
                      Mã SKU
                      <input value={productForm.sku} onChange={e => setProductForm({ ...productForm, sku: e.target.value })} placeholder="CLC28..." />
                    </label>
                    <label>
                      Loại hàng hóa
                      <select value={productForm.category} onChange={e => setProductForm({ ...productForm, category: e.target.value })}>
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </label>
                    <label>
                      Đơn vị tính chính
                      <input value={productForm.primaryUnit} onChange={e => setProductForm({ ...productForm, primaryUnit: e.target.value })} placeholder="Cái, Hộp, Gói..." />
                    </label>
                    <label>
                      Thuế GTGT (%)
                      <input type="number" min={0} max={100} step="any" value={productForm.vatRate} onChange={e => setProductForm({ ...productForm, vatRate: Number(e.target.value) })} />
                    </label>
                    <label>
                      Kho mặc định
                      <select value={productForm.defaultWarehouseId ?? ""} onChange={e => setProductForm({ ...productForm, defaultWarehouseId: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Không có</option>
                        {warehouseList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </label>
                    <label className="md:col-span-2">
                      Mô tả
                      <textarea rows={2} value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })} placeholder="Mô tả sản phẩm..." />
                    </label>
                  </div>
                </div>

                {/* Thuộc tính */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Thuộc tính</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: "canManageInventory", label: "Quản lý tồn kho" },
                      { key: "canBePurchased",     label: "Có thể mua" },
                      { key: "canBeSold",           label: "Có thể bán" },
                      { key: "canBeProduced",       label: "Sản xuất được" },
                      { key: "canBeBomComponent",   label: "Là nguyên liệu BOM" },
                    ].map(f => (
                      <label key={f.key} className="flex items-center gap-2 cursor-pointer text-[13px] font-normal text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean((productForm as any)[f.key])}
                          onChange={e => setProductForm({ ...productForm, [f.key]: e.target.checked })}
                          className="w-4 h-4 accent-teal-600"
                        />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Quy cách đầu tiên — chỉ khi tạo mới */}
                {productModal === "create" && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quy cách đầu tiên</p>
                    <div className="grid gap-3 md:grid-cols-2 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <label className="md:col-span-2">
                        Tên quy cách <span className="text-red-500">*</span>
                        <input required value={productForm.packaging.name} onChange={e => setProductForm({ ...productForm, packaging: { ...productForm.packaging, name: e.target.value } })} placeholder="Hộp 18 gói, Thùng 12 hộp..." />
                      </label>
                      <label>
                        SKU quy cách
                        <input value={productForm.packaging.sku} onChange={e => setProductForm({ ...productForm, packaging: { ...productForm.packaging, sku: e.target.value } })} />
                      </label>
                      <label>
                        Đơn vị tính <span className="text-red-500">*</span>
                        <input required value={productForm.packaging.unit} onChange={e => setProductForm({ ...productForm, packaging: { ...productForm.packaging, unit: e.target.value } })} placeholder="Gói, Hộp, Thùng..." />
                      </label>
                      <label>
                        SL/thùng (pack)
                        <input type="number" min={1} value={productForm.packaging.packCount} onChange={e => setProductForm({ ...productForm, packaging: { ...productForm.packaging, packCount: Number(e.target.value) } })} />
                      </label>
                      <label>
                        Tồn tối thiểu
                        <input type="number" min={0} value={productForm.packaging.min_stock} onChange={e => setProductForm({ ...productForm, packaging: { ...productForm.packaging, min_stock: Number(e.target.value) } })} />
                      </label>
                      <label>
                        Kho mặc định
                        <select value={productForm.packaging.warehouseId ?? ""} onChange={e => setProductForm({ ...productForm, packaging: { ...productForm.packaging, warehouseId: e.target.value ? Number(e.target.value) : null } })}>
                          <option value="">Không có</option>
                          {warehouseList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </label>
                      <label>
                        Mã vạch
                        <input value={productForm.packaging.barcode} onChange={e => setProductForm({ ...productForm, packaging: { ...productForm.packaging, barcode: e.target.value } })} placeholder="893850..." />
                      </label>
                      <div className="md:col-span-2">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bảng giá quy cách</p>
                        <PriceEditor
                          prices={productForm.packaging.prices}
                          onChange={prices => setProductForm({ ...productForm, packaging: { ...productForm.packaging, prices } })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="erp-modal-footer">
                <button type="button" className="erp-btn" onClick={() => setProductModal(null)}>Hủy</button>
                <button type="submit" className="erp-btn erp-btn-primary" disabled={createProduct.isPending || updateProduct.isPending}>
                  <Save size={14} /> {createProduct.isPending || updateProduct.isPending ? "Đang lưu..." : productModal === "create" ? "Thêm hàng hóa" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Thêm / Sửa quy cách ── */}
      {pkgModal && (
        <div className="erp-modal-backdrop">
          <div className="erp-modal max-w-lg">
            <div className="erp-modal-header">
              <div>
                <h2>{pkgModal === "create" ? "Thêm quy cách" : `Sửa: ${pkgForm.name}`}</h2>
                <p>Thông tin, tồn tối thiểu và bảng giá</p>
              </div>
              <button onClick={() => setPkgModal(null)}><X /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); savePkg.mutate(); }}>
              <div className="erp-modal-body space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="md:col-span-2">
                    Tên quy cách <span className="text-red-500">*</span>
                    <input required value={pkgForm.name} onChange={e => setPkgForm({ ...pkgForm, name: e.target.value })} />
                  </label>
                  {pkgModal === "create" && (
                    <label>
                      SKU
                      <input value={pkgForm.sku} onChange={e => setPkgForm({ ...pkgForm, sku: e.target.value })} />
                    </label>
                  )}
                  <label>
                    Đơn vị tính <span className="text-red-500">*</span>
                    <input required value={pkgForm.unit} onChange={e => setPkgForm({ ...pkgForm, unit: e.target.value })} />
                  </label>
                  <label>
                    SL/thùng
                    <input type="number" min={1} value={pkgForm.packCount} onChange={e => setPkgForm({ ...pkgForm, packCount: Number(e.target.value) })} />
                  </label>
                  <label>
                    Tồn tối thiểu
                    <input type="number" min={0} value={pkgForm.min_stock} onChange={e => setPkgForm({ ...pkgForm, min_stock: Number(e.target.value) })} />
                  </label>
                  <label>
                    HSD (tháng)
                    <input type="number" min={0} value={pkgForm.shelfLifeMonths} onChange={e => setPkgForm({ ...pkgForm, shelfLifeMonths: Number(e.target.value) })} />
                  </label>
                  <label>
                    Kho mặc định
                    <select value={pkgForm.warehouseId ?? ""} onChange={e => setPkgForm({ ...pkgForm, warehouseId: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">Không có</option>
                      {warehouseList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Mã vạch
                    <input value={pkgForm.barcode} onChange={e => setPkgForm({ ...pkgForm, barcode: e.target.value })} />
                  </label>
                  {pkgModal === "edit" && (
                    <label className="flex flex-row items-center gap-2 cursor-pointer mt-1">
                      <input type="checkbox" checked={pkgForm.isActive} onChange={e => setPkgForm({ ...pkgForm, isActive: e.target.checked })} className="w-4 h-4 accent-teal-600" />
                      <span className="text-[13px] font-normal text-slate-700">Đang bán / Kích hoạt</span>
                    </label>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bảng giá</p>
                  <PriceEditor prices={pkgForm.prices} onChange={prices => setPkgForm({ ...pkgForm, prices })} />
                </div>
              </div>
              <div className="erp-modal-footer">
                <button type="button" className="erp-btn" onClick={() => setPkgModal(null)}>Hủy</button>
                <button type="submit" className="erp-btn erp-btn-primary" disabled={savePkg.isPending}>
                  <Save size={14} /> {savePkg.isPending ? "Đang lưu..." : pkgModal === "create" ? "Thêm quy cách" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

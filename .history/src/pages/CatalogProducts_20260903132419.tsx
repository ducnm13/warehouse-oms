import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Package, Search, X, Save, ChevronDown, ChevronUp, Tag } from "lucide-react";
import toast from "react-hot-toast";
import { apiV1 } from "../lib/apiV1";
import { formatNumber } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProductPrice { id?: number; packagingId: number; priceType: string; price: number; isActive?: number; }
interface PackagingV1 {
  id: number; name: string; sku?: string; unit?: string; packCount: number;
  netWeight?: number; shelfLifeMonths?: number; min_stock?: number;
  warehouseId?: number | null; barcode?: string | null; isActive: number;
  prices: ProductPrice[];
  productwarehouses: Array<{ warehouseId: number; stock_quantity: number; warehouses: { id: number; name: string } }>;
  warehouse?: { id: number; name: string } | null;
}
interface ProductV1 {
  id: number; name: string; sku?: string; category?: string;
  description?: string | null; primaryUnit: string;
  defaultWarehouseId?: number | null; vatRate: number;
  canManageInventory: number; canBePurchased: number; canBeSold: number;
  canBeProduced: number; canBeBomComponent: number;
  isActive?: number;
  defaultWarehouse?: { id: number; name: string } | null;
  productpackagings: PackagingV1[];
}
interface ListResponse { data: ProductV1[]; meta: { page: number; limit: number; total: number; totalPages: number }; }
interface WarehouseRef { id: number; name: string; }

const PRICE_TYPES = [
  { key: "COST", label: "Giá vốn" },
  { key: "SALE_1", label: "Giá bán 1" },
  { key: "SALE_2", label: "Giá bán 2" },
  { key: "SALE_3", label: "Giá bán 3" },
];
const CATEGORY_LABEL: Record<string, string> = {
  PRODUCT: "Thành phẩm", MATERIAL: "Nguyên vật liệu", PACKAGING: "Bao bì", SERVICE: "Dịch vụ",
};

// ─── Price editor for a packaging row ────────────────────────────────────────
function PriceEditor({ prices, onChange }: {
  prices: ProductPrice[];
  onChange: (prices: ProductPrice[]) => void;
}) {
  const getPrice = (type: string) => prices.find(p => p.priceType === type)?.price ?? 0;
  const setPrice = (type: string, val: number) => {
    const existing = prices.find(p => p.priceType === type);
    if (existing) onChange(prices.map(p => p.priceType === type ? { ...p, price: val } : p));
    else onChange([...prices, { packagingId: 0, priceType: type, price: val }]);
  };
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {PRICE_TYPES.map(t => (
        <label key={t.key} className="text-xs">
          <span className="text-slate-500 font-semibold block mb-1">{t.label}</span>
          <input
            type="number" min={0} step="any"
            value={getPrice(t.key)}
            onChange={e => setPrice(t.key, Number(e.target.value))}
            className="w-full text-right text-sm"
          />
        </label>
      ))}
    </div>
  );
}

// ─── Packaging row editor ─────────────────────────────────────────────────────
interface PkgForm {
  id: number; name: string; unit: string; packCount: number;
  netWeight: number; shelfLifeMonths: number; min_stock: number;
  warehouseId: number | null; barcode: string; isActive: boolean;
  prices: ProductPrice[];
}

function toFormPkg(p: PackagingV1): PkgForm {
  return {
    id: p.id, name: p.name, unit: p.unit ?? "", packCount: p.packCount,
    netWeight: p.netWeight ?? 0, shelfLifeMonths: p.shelfLifeMonths ?? 24,
    min_stock: p.min_stock ?? 0, warehouseId: p.warehouseId ?? null,
    barcode: p.barcode ?? "", isActive: p.isActive === 1,
    prices: p.prices ?? [],
  };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CatalogProducts() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Product edit modal
  const [editProduct, setEditProduct] = useState<ProductV1 | null>(null);
  const [productForm, setProductForm] = useState<Partial<ProductV1>>({});

  // Packaging edit modal
  const [editPkg, setEditPkg] = useState<PkgForm | null>(null);

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
  });

  const rows = data?.data?.data ?? [];
  const meta = data?.data?.meta;

  const saveProduct = useMutation({
    mutationFn: () =>
      apiV1<ProductV1>(`/api/v1/catalog/products/${editProduct!.id}`, {
        method: "PUT",
        body: JSON.stringify({
          description: productForm.description ?? null,
          primaryUnit: productForm.primaryUnit ?? "Cái",
          defaultWarehouseId: productForm.defaultWarehouseId ?? null,
          vatRate: productForm.vatRate ?? 0,
          canManageInventory: productForm.canManageInventory ? true : false,
          canBePurchased: productForm.canBePurchased ? true : false,
          canBeSold: productForm.canBeSold ? true : false,
          canBeProduced: productForm.canBeProduced ? true : false,
          canBeBomComponent: productForm.canBeBomComponent ? true : false,
        }),
      }),
    onSuccess: r => {
      toast.success(r.message);
      setEditProduct(null);
      void qc.invalidateQueries({ queryKey: ["catalog-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePkg = useMutation({
    mutationFn: () =>
      apiV1<PackagingV1>(`/api/v1/catalog/packagings/${editPkg!.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editPkg!.name,
          unit: editPkg!.unit,
          packCount: editPkg!.packCount,
          netWeight: editPkg!.netWeight,
          shelfLifeMonths: editPkg!.shelfLifeMonths,
          min_stock: editPkg!.min_stock,
          warehouseId: editPkg!.warehouseId,
          barcode: editPkg!.barcode || null,
          isActive: editPkg!.isActive,
          prices: editPkg!.prices,
        }),
      }),
    onSuccess: r => {
      toast.success(r.message);
      setEditPkg(null);
      void qc.invalidateQueries({ queryKey: ["catalog-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openProductEdit = (p: ProductV1) => {
    setEditProduct(p);
    setProductForm({ ...p });
  };

  const toggleRow = (id: number) => setExpandedId(prev => prev === id ? null : id);

  return (
    <div className="erp-page">
      <div className="erp-page-header">
        <div>
          <h1>Danh mục hàng hóa</h1>
          <p>Cấu hình giá bán, giá vốn, kho mặc định và thuộc tính sản phẩm</p>
        </div>
      </div>

      {/* Filters */}
      <div className="erp-card overflow-hidden">
        <div className="erp-toolbar">
          <div className="erp-search">
            <Search size={16} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm tên, SKU hàng hóa..." />
          </div>
          <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
            <option value="">Tất cả loại</option>
            <option value="PRODUCT">Thành phẩm</option>
            <option value="MATERIAL">Nguyên vật liệu</option>
            <option value="PACKAGING">Bao bì</option>
            <option value="SERVICE">Dịch vụ</option>
          </select>
        </div>

        {isLoading ? <div className="p-12 text-center">Đang tải...</div>
          : isError ? <div className="p-12 text-center text-red-500">{(error as Error).message}</div>
          : !rows.length ? <div className="p-12 text-center text-slate-400">Không tìm thấy hàng hóa nào</div>
          : (
            <div className="divide-y divide-slate-100">
              {rows.map(prod => {
                const expanded = expandedId === prod.id;
                const totalStock = prod.productpackagings.reduce(
                  (s, pk) => s + pk.productwarehouses.reduce((ss, pw) => ss + (pw.stock_quantity ?? 0), 0), 0,
                );
                return (
                  <div key={prod.id}>
                    {/* Product row */}
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer" onClick={() => toggleRow(prod.id)}>
                      <div className="p-2 bg-indigo-50 rounded-lg flex-shrink-0">
                        <Package size={16} className="text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800">{prod.name}</span>
                          {prod.sku && <span className="text-xs text-slate-400 font-mono">{prod.sku}</span>}
                          {prod.category && (
                            <span className="erp-badge bg-slate-100 text-slate-600 text-[10px]">
                              {CATEGORY_LABEL[prod.category] ?? prod.category}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-4 mt-0.5 text-xs text-slate-400 flex-wrap">
                          <span>ĐVT: {prod.primaryUnit}</span>
                          {prod.defaultWarehouse && <span>Kho mặc định: {prod.defaultWarehouse.name}</span>}
                          <span>VAT: {prod.vatRate}%</span>
                          <span className="text-indigo-500">Tồn: {formatNumber(totalStock)}</span>
                          <span className="text-xs">{prod.productpackagings.length} quy cách</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          className="erp-icon-btn"
                          title="Sửa thông tin sản phẩm"
                          onClick={e => { e.stopPropagation(); openProductEdit(prod); }}
                        >
                          <Edit size={15} />
                        </button>
                        {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </div>
                    </div>

                    {/* Packagings expanded */}
                    {expanded && (
                      <div className="bg-slate-50/70 border-t border-slate-100">
                        <div className="overflow-x-auto">
                          <table className="erp-table text-sm">
                            <thead>
                              <tr className="bg-slate-100/60">
                                <th>Quy cách / SKU</th>
                                <th className="text-right">Giá vốn</th>
                                <th className="text-right">Giá bán 1</th>
                                <th className="text-right">Giá bán 2</th>
                                <th className="text-right">Giá bán 3</th>
                                <th>Kho</th>
                                <th className="text-right">Tồn</th>
                                <th>Tình trạng</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {prod.productpackagings.map(pk => {
                                const getP = (type: string) => pk.prices.find(p => p.priceType === type)?.price ?? 0;
                                const pkStock = pk.productwarehouses.reduce((s, pw) => s + (pw.stock_quantity ?? 0), 0);
                                return (
                                  <tr key={pk.id} className={pk.isActive === 0 ? "opacity-50" : ""}>
                                    <td>
                                      <b>{pk.name}</b>
                                      {pk.sku && <small className="block font-mono text-slate-400">{pk.sku}</small>}
                                      {pk.barcode && (
                                        <small className="flex items-center gap-1 text-slate-400">
                                          <Tag size={10} /> {pk.barcode}
                                        </small>
                                      )}
                                    </td>
                                    <td className="text-right text-amber-700 font-semibold">{formatNumber(getP("COST"))}</td>
                                    <td className="text-right text-indigo-600 font-semibold">{formatNumber(getP("SALE_1"))}</td>
                                    <td className="text-right">{formatNumber(getP("SALE_2"))}</td>
                                    <td className="text-right">{formatNumber(getP("SALE_3"))}</td>
                                    <td>{pk.warehouse?.name ?? <span className="text-slate-300">—</span>}</td>
                                    <td className="text-right font-semibold">{formatNumber(pkStock)} {pk.unit}</td>
                                    <td>
                                      {pk.isActive === 1
                                        ? <span className="erp-badge bg-emerald-100 text-emerald-700">Đang bán</span>
                                        : <span className="erp-badge bg-slate-100 text-slate-500">Đã ẩn</span>}
                                    </td>
                                    <td>
                                      <button
                                        className="erp-icon-btn"
                                        title="Sửa quy cách & giá"
                                        onClick={() => setEditPkg(toFormPkg(pk))}
                                      >
                                        <Edit size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
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

      {/* ── Product edit modal ── */}
      {editProduct && (
        <div className="erp-modal-backdrop">
          <div className="erp-modal max-w-lg">
            <div className="erp-modal-header">
              <div>
                <h2>Sửa: {editProduct.name}</h2>
                <p>Thuộc tính sản phẩm, kho mặc định và thuế</p>
              </div>
              <button onClick={() => setEditProduct(null)}><X /></button>
            </div>
            <div className="erp-modal-body space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  Đơn vị tính chính
                  <input
                    value={productForm.primaryUnit ?? "Cái"}
                    onChange={e => setProductForm({ ...productForm, primaryUnit: e.target.value })}
                    placeholder="Cái, Hộp, Gói..."
                  />
                </label>
                <label>
                  Kho mặc định
                  <select
                    value={productForm.defaultWarehouseId ?? ""}
                    onChange={e => setProductForm({ ...productForm, defaultWarehouseId: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">Không có</option>
                    {warehouseList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </label>
                <label>
                  Thuế GTGT (%)
                  <input
                    type="number" min={0} max={100} step="any"
                    value={productForm.vatRate ?? 0}
                    onChange={e => setProductForm({ ...productForm, vatRate: Number(e.target.value) })}
                  />
                </label>
                <label className="md:col-span-2">
                  Mô tả
                  <textarea
                    rows={2}
                    value={productForm.description ?? ""}
                    onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                    placeholder="Mô tả sản phẩm..."
                  />
                </label>
              </div>
              {/* Flags */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Thuộc tính</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {[
                    { key: "canManageInventory", label: "Quản lý tồn kho" },
                    { key: "canBePurchased", label: "Có thể mua" },
                    { key: "canBeSold", label: "Có thể bán" },
                    { key: "canBeProduced", label: "Sản xuất được" },
                    { key: "canBeBomComponent", label: "Là nguyên liệu BOM" },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean((productForm as any)[f.key])}
                        onChange={e => setProductForm({ ...productForm, [f.key]: e.target.checked ? 1 : 0 })}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="text-slate-700">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="erp-modal-footer">
              <button className="erp-btn" onClick={() => setEditProduct(null)}>Hủy</button>
              <button className="erp-btn erp-btn-primary" disabled={saveProduct.isPending} onClick={() => saveProduct.mutate()}>
                <Save size={15} /> {saveProduct.isPending ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Packaging edit modal ── */}
      {editPkg && (
        <div className="erp-modal-backdrop">
          <div className="erp-modal max-w-lg">
            <div className="erp-modal-header">
              <div>
                <h2>Sửa quy cách: {editPkg.name}</h2>
                <p>Thông tin, giá và kho mặc định</p>
              </div>
              <button onClick={() => setEditPkg(null)}><X /></button>
            </div>
            <div className="erp-modal-body space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  Tên quy cách <span className="text-red-500">*</span>
                  <input required value={editPkg.name} onChange={e => setEditPkg({ ...editPkg, name: e.target.value })} />
                </label>
                <label>
                  Đơn vị tính
                  <input value={editPkg.unit} onChange={e => setEditPkg({ ...editPkg, unit: e.target.value })} placeholder="Gói, Hộp..." />
                </label>
                <label>
                  Số lượng/thùng (pack)
                  <input type="number" min={1} value={editPkg.packCount} onChange={e => setEditPkg({ ...editPkg, packCount: Number(e.target.value) })} />
                </label>
                <label>
                  Tồn tối thiểu
                  <input type="number" min={0} value={editPkg.min_stock} onChange={e => setEditPkg({ ...editPkg, min_stock: Number(e.target.value) })} />
                </label>
                <label>
                  Hạn sử dụng (tháng)
                  <input type="number" min={0} value={editPkg.shelfLifeMonths} onChange={e => setEditPkg({ ...editPkg, shelfLifeMonths: Number(e.target.value) })} />
                </label>
                <label>
                  Kho mặc định
                  <select value={editPkg.warehouseId ?? ""} onChange={e => setEditPkg({ ...editPkg, warehouseId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Không có</option>
                    {warehouseList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </label>
                <label>
                  Mã vạch (barcode)
                  <input value={editPkg.barcode} onChange={e => setEditPkg({ ...editPkg, barcode: e.target.value })} placeholder="8938505..." />
                </label>
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" checked={editPkg.isActive} onChange={e => setEditPkg({ ...editPkg, isActive: e.target.checked })} className="w-4 h-4 accent-indigo-600" />
                  <span className="text-sm font-semibold text-slate-700">Đang bán / Kích hoạt</span>
                </label>
              </div>
              {/* Prices */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Bảng giá</p>
                <PriceEditor
                  prices={editPkg.prices}
                  onChange={prices => setEditPkg({ ...editPkg, prices })}
                />
              </div>
            </div>
            <div className="erp-modal-footer">
              <button className="erp-btn" onClick={() => setEditPkg(null)}>Hủy</button>
              <button className="erp-btn erp-btn-primary" disabled={savePkg.isPending} onClick={() => savePkg.mutate()}>
                <Save size={15} /> {savePkg.isPending ? "Đang lưu..." : "Lưu quy cách"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

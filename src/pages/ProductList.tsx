import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  EyeOff,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { Product, ProductPackaging } from "../types";
import { cn, formatNumber } from "../lib/utils";

const ProductList = ({ isArchive = false }: { isArchive?: boolean }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Product[]>([]); // Thêm state lưu danh sách vật tư
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] =
    useState<Partial<Product> | null>(null);

  // Lấy role của user để phân quyền
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  // Kiểm tra quyền: SALES hoặc USER2 (bạn có ghi là QD ở code cũ, tôi đổi lại thành USER2 theo yêu cầu prompt trước đó, bạn có thể chỉnh lại nếu cần)
  const isReadOnlyRole =
    currentUser.role === "S_SALES" ||
    currentUser.role === "QD"

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // 1. Lấy danh sách thành phẩm
      const res = await fetch("/api/products?category=PRODUCT", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      const filtered = data.filter((p: Product) =>
        isArchive ? !p.isActive : p.isActive,
      );
      setProducts(filtered);

      // 2. Lấy danh sách Vật tư / Bao bì (để làm Dropdown chọn BOM)
      const matRes = await fetch("/api/products?category=MATERIAL", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setMaterials(await matRes.json());
    } catch (err) {
      toast.error("Lỗi khi tải danh sách sản phẩm");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !window.confirm(
        "Bạn có chắc chắn muốn xóa sản phẩm này? Thao tác này không thể hoàn tác.",
      )
    )
      return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) {
        toast.success("Đã xóa sản phẩm");
        fetchProducts();
      } else {
        toast.error("Lỗi khi xóa");
      }
    } catch (err) {
      toast.error("Có lỗi xảy ra");
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: number) => {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ isActive: currentStatus ? 0 : 1 }),
      });
      if (res.ok) {
        toast.success(
          currentStatus ? "Đã ẩn sản phẩm" : "Đã khôi phục sản phẩm",
        );
        fetchProducts();
      }
    } catch (err) {
      toast.error("Có lỗi xảy ra");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      const method = selectedProduct.id ? "PATCH" : "POST";
      // Sử dụng PUT thay vì PATCH nếu là cập nhật để Backend xử lý lưu chi tiết BOM
      const actualMethod = selectedProduct.id ? "PUT" : "POST";
      const url = selectedProduct.id
        ? `/api/products/${selectedProduct.id}`
        : "/api/products";

      const payload = { ...selectedProduct, category: "PRODUCT" };

      const res = await fetch(url, {
        method: actualMethod,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("Đã lưu thành công");
        setIsModalOpen(false);
        fetchProducts();
      } else {
        toast.error("Lỗi khi lưu dữ liệu");
      }
    } catch (err) {
      toast.error("Lỗi khi lưu dữ liệu");
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const handleAddPackaging = () => {
    const newPk: any = {
      name: "",
      sku: "",
      packCount: 1,
      unit: "",
      initial_stock: 0,
      min_stock: 0,
      boms: [],
    };
    setSelectedProduct({
      ...selectedProduct!,
      packagings: [...(selectedProduct?.packagings || []), newPk],
    });
  };

  const handleRemovePackaging = (index: number) => {
    const newPackagings = [...(selectedProduct?.packagings || [])];
    newPackagings.splice(index, 1);
    setSelectedProduct({ ...selectedProduct!, packagings: newPackagings });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">
            DANH SÁCH THÀNH PHẨM
          </h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
            Tổng hợp danh sách và số lượng ở kho
          </p>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden font-sans">
        {/* Top Filter Bar */}
        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b">
          <div className="flex items-center gap-4 flex-1 md:max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Tìm kiếm mã hoặc tên sản phẩm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border border-gray-100 bg-gray-50 py-2 pl-9 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <Search
                className="absolute left-3 top-2.5 text-primary opacity-60"
                size={16}
              />
            </div>
            {!isArchive && !isReadOnlyRole && (
              <button
                onClick={() => {
                  setSelectedProduct({
                    name: "",
                    sku: "",
                    netWeight: 17,
                    shelfLifeMonths: 24,
                    packagings: [],
                  });
                  setIsModalOpen(true);
                }}
                className="flex-shrink-0 flex items-center gap-2 rounded bg-primary py-2 px-4 text-xs font-black text-white hover:bg-opacity-90 transition-all shadow-sm uppercase tracking-wider"
              >
                <Plus size={16} /> THÊM MỚI
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value))}
              className="border rounded px-2 py-1 bg-gray-50 text-sm font-medium outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span className="text-gray-500 text-sm">sản phẩm / trang</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="text-gray-600 bg-gray-50/50">
                <th className="py-4 px-6 font-bold uppercase tracking-tighter text-[11px] border-b">
                  Sản phẩm
                </th>
                <th className="py-4 px-6 font-bold uppercase tracking-tighter text-[11px] border-b">
                  Quy cách & Tồn kho
                </th>
                <th className="hidden lg:table-cell xl:table-cell py-4 px-6 font-bold uppercase tracking-tighter text-[11px] border-b text-right">
                  Tổng tồn (Quy đổi)
                </th>
                {!isReadOnlyRole && (
                  <th className="py-4 px-6 font-bold uppercase tracking-tighter text-[11px] border-b text-right">
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={!isReadOnlyRole ? 4 : 3}
                    className="py-20 text-center text-gray-400 font-medium"
                  >
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={!isReadOnlyRole ? 4 : 3}
                    className="py-20 text-center text-gray-400 font-medium uppercase tracking-widest"
                  >
                    Không tìm thấy sản phẩm nào
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b hover:bg-gray-50/50 transition-colors group"
                  >
                    <td className="py-4 px-6 align-top">
                      <h5
                        className={cn(
                          "font-black text-gray-800 text-base mb-1 transition-colors",
                          !isReadOnlyRole &&
                            "group-hover:text-primary cursor-pointer",
                        )}
                        onClick={() => {
                          if (!isReadOnlyRole) {
                            setSelectedProduct(product);
                            setIsModalOpen(true);
                          }
                        }}
                      >
                        {product.name}
                      </h5>
                      <p className="text-xs text-gray-400 font-mono flex items-center gap-1 uppercase">
                        Mã:{" "}
                        <span className="font-bold text-gray-600">
                          {product.sku}
                        </span>
                      </p>
                    </td>
                    <td className="py-4 px-6 text-xs align-top">
                      <div className="space-y-2">
                        {product.packagings?.length === 0 ? (
                          <span className="text-gray-300 italic">
                            Chưa khai báo quy cách
                          </span>
                        ) : (
                          product.packagings?.map((pk) => (
                            <div
                              key={pk.id}
                              className="grid grid-cols-2 gap-x-8 max-w-xs text-gray-500"
                            >
                              <div className="flex flex-col">
                                <span className="italic">{pk.name}:</span>
                                <div className="flex items-center gap-1">
                                  {pk.sku && (
                                    <span className="text-[9px] font-mono text-gray-400">
                                      SKU: {pk.sku}
                                    </span>
                                  )}
                                  <span className="text-[9px] font-bold text-gray-400">
                                    ({product.netWeight}g,{" "}
                                    {product.shelfLifeMonths}th)
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-gray-800">
                                  {formatNumber(pk.stock || 0)}
                                </span>
                                <span className="ml-1 font-bold text-gray-400 uppercase text-[9px]">
                                  {pk.unit || pk.name.split(" ").pop()}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="hidden lg:table-cell xl:table-cell py-4 px-6 text-right align-top">
                      <p className="text-lg font-black text-gray-800 tracking-tight">
                        {formatNumber(product.totalStock || 0)}
                        <span className="ml-1 text-[10px] font-bold text-gray-400 uppercase">
                          Gói
                        </span>
                      </p>
                    </td>
                    {!isReadOnlyRole && (
                      <td className="py-4 px-6 text-right align-top">
                        <div className="flex items-center justify-end gap-3 text-gray-400">
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              setIsModalOpen(true);
                            }}
                            className="hover:text-primary transition-colors p-1"
                            title="Chỉnh sửa"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() =>
                              handleToggleStatus(product.id, product.isActive)
                            }
                            className={cn(
                              "transition-colors p-1",
                              product.isActive
                                ? "hover:text-amber-500"
                                : "text-green-500 hover:text-green-600",
                            )}
                            title={
                              product.isActive ? "Ẩn sản phẩm" : "Hiện sản phẩm"
                            }
                          >
                            {product.isActive ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="hover:text-red-500 transition-colors p-1"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-gray-50/50 flex items-center justify-between">
          <p className="text-xs text-gray-500 font-medium">
            Hiển thị từ {(currentPage - 1) * pageSize + 1} đến{" "}
            {Math.min(currentPage * pageSize, filteredProducts.length)} trên
            tổng {filteredProducts.length} sản phẩm
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="p-1 rounded hover:bg-white disabled:opacity-30 border bg-gray-50"
            >
              <ChevronLeft size={16} />
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={cn(
                  "w-8 h-8 rounded text-xs font-bold transition-all",
                  currentPage === i + 1
                    ? "bg-primary text-white shadow-md scale-110"
                    : "hover:bg-white text-gray-500 border",
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-1 rounded hover:bg-white disabled:opacity-30 border bg-gray-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl rounded-lg bg-white p-8 shadow-2xl animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
              <div className="mb-8 flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">
                    {selectedProduct?.id
                      ? "CHỈNH SỬA SẢN PHẨM"
                      : "THÊM MỚI SẢN PHẨM"}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                    Thông tin chi tiết và quy cách đóng gói
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 bg-gray-100 p-2 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      Tên sản phẩm
                    </label>
                    <input
                      type="text"
                      value={selectedProduct?.name || ""}
                      onChange={(e) =>
                        setSelectedProduct({
                          ...selectedProduct!,
                          name: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-gray-800"
                      placeholder="VD: Cà phê COP28 hòa tan 3in1"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      Mã SKU
                    </label>
                    <input
                      type="text"
                      value={selectedProduct?.sku || ""}
                      onChange={(e) =>
                        setSelectedProduct({
                          ...selectedProduct!,
                          sku: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono font-bold text-primary"
                      placeholder="VD: COP28-3IN1"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      NET Weight (g)
                    </label>
                    <input
                      type="number"
                      value={selectedProduct?.netWeight || 0}
                      onChange={(e) =>
                        setSelectedProduct({
                          ...selectedProduct!,
                          netWeight: parseFloat(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-gray-200 bg-amber-50 p-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-bold text-amber-700"
                      placeholder="VD: 17"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      HSD (Tháng)
                    </label>
                    <input
                      type="number"
                      value={selectedProduct?.shelfLifeMonths || 24}
                      onChange={(e) =>
                        setSelectedProduct({
                          ...selectedProduct!,
                          shelfLifeMonths: parseInt(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-gray-200 bg-amber-50 p-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-bold text-amber-700"
                      placeholder="VD: 24"
                      required
                    />
                  </div>
                </div>

                {/* Packagings Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h5 className="text-xs font-black text-gray-800 uppercase tracking-wider">
                      QUY CÁCH ĐÓNG GÓI, HẠN SỬ DỤNG & TỒN ĐẦU
                    </h5>
                    <button
                      type="button"
                      onClick={handleAddPackaging}
                      className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-black hover:bg-primary hover:text-white transition-all uppercase"
                    >
                      + Thêm quy cách
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-[9px] font-black text-gray-400 font-sans uppercase tracking-widest">
                      <div className="col-span-4">Tên quy cách (VD: Thùng)</div>
                      <div className="col-span-1">ĐVT</div>
                      <div className="col-span-2">SKU</div>
                      <div className="col-span-1 text-center">SL Gói</div>
                      <div className="col-span-1 text-center">Cảnh báo</div>
                      <div className="col-span-1 text-center">Tồn đầu</div>
                      <div className="col-span-2 text-center">Xóa</div>
                    </div>
                    {selectedProduct?.packagings?.map((pk, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col md:grid md:grid-cols-12 gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100 animate-in slide-in-from-right-4 duration-200"
                      >
                        <div className="md:col-span-4">
                          <input
                            type="text"
                            placeholder="Tên..."
                            value={pk.name}
                            onChange={(e) => {
                              const newPks = [...selectedProduct.packagings!];
                              newPks[idx].name = e.target.value;
                              setSelectedProduct({
                                ...selectedProduct,
                                packagings: newPks,
                              });
                            }}
                            className="w-full bg-white border rounded px-2 py-1.5 text-[11px] font-bold outline-none focus:border-primary"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <input
                            type="text"
                            placeholder="ĐVT"
                            value={pk.unit || ""}
                            onChange={(e) => {
                              const newPks = [...selectedProduct.packagings!];
                              newPks[idx].unit = e.target.value;
                              setSelectedProduct({
                                ...selectedProduct,
                                packagings: newPks,
                              });
                            }}
                            className="w-full bg-white border rounded px-2 py-1.5 text-[11px] font-bold outline-none focus:border-primary"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <input
                            type="text"
                            placeholder="SKU"
                            value={pk.sku || ""}
                            onChange={(e) => {
                              const newPks = [...selectedProduct.packagings!];
                              newPks[idx].sku = e.target.value;
                              setSelectedProduct({
                                ...selectedProduct,
                                packagings: newPks,
                              });
                            }}
                            className="w-full bg-white border rounded px-2 py-1.5 text-[11px] font-mono font-bold outline-none focus:border-primary"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <input
                            type="number"
                            placeholder="SL"
                            value={pk.packCount}
                            onChange={(e) => {
                              const newPks = [...selectedProduct.packagings!];
                              newPks[idx].packCount = parseInt(e.target.value);
                              setSelectedProduct({
                                ...selectedProduct,
                                packagings: newPks,
                              });
                            }}
                            className="w-full bg-white border rounded px-2 py-1.5 text-[11px] font-bold outline-none focus:border-primary text-center"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <input
                            type="number"
                            placeholder="Min"
                            value={pk.min_stock || 0}
                            onChange={(e) => {
                              const newPks = [...selectedProduct.packagings!];
                              newPks[idx].min_stock = parseInt(e.target.value);
                              setSelectedProduct({
                                ...selectedProduct,
                                packagings: newPks,
                              });
                            }}
                            className="w-full bg-red-50 border border-red-100 text-red-700 rounded px-2 py-1.5 text-[11px] font-bold outline-none focus:border-red-500 text-center"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <input
                            type="number"
                            placeholder="Dầu"
                            value={pk.initial_stock || 0}
                            onChange={(e) => {
                              const newPks = [...selectedProduct.packagings!];
                              newPks[idx].initial_stock = parseInt(
                                e.target.value,
                              );
                              setSelectedProduct({
                                ...selectedProduct,
                                packagings: newPks,
                              });
                            }}
                            className="w-full bg-indigo-50 border border-indigo-200 text-indigo-700 rounded px-2 py-1.5 text-[11px] font-bold outline-none focus:border-indigo-500 text-center"
                          />
                        </div>
                        <div className="md:col-span-2 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePackaging(idx)}
                            className="text-red-400 hover:text-red-600 transition-colors p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="col-span-2 md:col-span-2">
                          <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
                            Giá bán (VNĐ)
                          </label>
                          <input
                            type="number"
                            placeholder="0"
                            value={pk.price || 0}
                            onChange={(e) => {
                              const newPks = [...selectedProduct.packagings!];
                              newPks[idx].price = parseInt(e.target.value) || 0;
                              setSelectedProduct({
                                ...selectedProduct,
                                packagings: newPks,
                              });
                            }}
                            className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-right"
                          />
                        </div>

                        {/* --- KHỐI CÀI ĐẶT ĐỊNH MỨC BOM --- */}
                        <div className="md:col-span-12 bg-indigo-50/50 p-3 rounded-lg mt-2 border border-indigo-100">
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-[10px] font-black text-indigo-800 uppercase tracking-widest">
                              Định mức vật tư tiêu hao cho 1{" "}
                              {pk.unit || "đơn vị"}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                const newPks = [...selectedProduct.packagings!];
                                if (!newPks[idx].boms) newPks[idx].boms = [];
                                newPks[idx].boms.push({
                                  materialPackagingId: 0,
                                  quantity: 1,
                                });
                                setSelectedProduct({
                                  ...selectedProduct,
                                  packagings: newPks,
                                });
                              }}
                              className="text-[9px] bg-indigo-200 text-indigo-700 px-2 py-1 rounded font-black uppercase hover:bg-indigo-600 hover:text-white transition-all"
                            >
                              + THÊM VẬT TƯ
                            </button>
                          </div>

                          {pk.boms?.map((bom: any, bIdx: number) => (
                            <div
                              key={bIdx}
                              className="flex gap-2 mb-2 items-center"
                            >
                              <select
                                value={bom.materialPackagingId}
                                onChange={(e) => {
                                  const newPks = [
                                    ...selectedProduct.packagings!,
                                  ];
                                  newPks[idx].boms[bIdx].materialPackagingId =
                                    parseInt(e.target.value);
                                  setSelectedProduct({
                                    ...selectedProduct,
                                    packagings: newPks,
                                  });
                                }}
                                className="flex-1 text-xs p-2 border border-indigo-200 bg-white rounded outline-none font-bold text-gray-700"
                              >
                                <option value="0">
                                  -- Chọn bao bì / vật tư --
                                </option>
                                {materials.map((m) => (
                                  <optgroup label={m.name} key={m.id}>
                                    {m.packagings?.map((mp: any) => (
                                      <option value={mp.id} key={mp.id}>
                                        {m.name} - {mp.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                              <input
                                type="number"
                                value={bom.quantity}
                                onChange={(e) => {
                                  const newPks = [
                                    ...selectedProduct.packagings!,
                                  ];
                                  newPks[idx].boms[bIdx].quantity =
                                    parseFloat(e.target.value) || 0;
                                  setSelectedProduct({
                                    ...selectedProduct,
                                    packagings: newPks,
                                  });
                                }}
                                step="any"
                                className="w-24 text-xs p-2 border border-red-200 rounded outline-none font-black text-red-600 text-center"
                                placeholder="SL..."
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newPks = [
                                    ...selectedProduct.packagings!,
                                  ];
                                  newPks[idx].boms.splice(bIdx, 1);
                                  setSelectedProduct({
                                    ...selectedProduct,
                                    packagings: newPks,
                                  });
                                }}
                                className="text-red-400 hover:text-red-600 p-2"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        {/* --- KẾT THÚC KHỐI BOM --- */}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t font-sans">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2 border rounded-lg font-black text-gray-500 hover:bg-gray-50 transition-all uppercase text-[10px] tracking-widest"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-10 py-2 bg-primary text-white rounded-lg font-black hover:bg-opacity-90 transition-all shadow-lg uppercase text-[10px] tracking-widest"
                  >
                    LƯU DỮ LIỆU
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};;;

export default ProductList;

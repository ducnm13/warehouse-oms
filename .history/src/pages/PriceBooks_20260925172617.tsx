import React, { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronDown,
	Edit,
	Eye,
	Plus,
	Save,
	Trash2,
	X,
	Search,
	PackagePlus,
	BookOpen,
	Calendar,
	Tag,
	Download,
} from "lucide-react";
import toast from "react-hot-toast";
import Button from "../components/ui/button";
import { Card } from "../components/ui/card";
import { apiV1 } from "../lib/apiV1";
import { formatNumber } from "../lib/utils";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface PriceBook {
	id: number;
	code: string;
	name: string;
	description: string | null;
	isDefault: boolean;
	isActive: boolean;
	validFrom: string | null;
	validTo: string | null;
	createdAt: string;
	updatedAt: string | null;
	items?: PriceBookItem[];
}

interface PriceBookItem {
	id: number;
	priceBookId: number;
	packagingId: number;
	costPrice: number;
	salePrice: number;
	currency: string;
	validFrom: string | null;
	validTo: string | null;
	packaging?: {
		id: number;
		name: string;
		sku?: string;
		unit?: string;
		product?: { id: number; name: string; sku?: string; category?: string };
	};
}

interface PriceBookForm {
	id?: number;
	code: string;
	name: string;
	description: string;
	isDefault: boolean;
	isActive: boolean;
	validFrom: string;
	validTo: string;
}

interface PackagingOption {
	id: number;
	name: string;
	sku?: string;
	unit?: string;
	productName?: string;
	productCategory?: string;
	costPrice?: number;
}

interface BulkAddForm {
	mode: "ALL_FINISHED" | "BY_CATEGORY";
	category: string;
}

const emptyPriceBookForm = (): PriceBookForm => ({
	id: undefined,
	code: "",
	name: "",
	description: "",
	isDefault: false,
	isActive: true,
	validFrom: "",
	validTo: "",
});

const emptyBulkAddForm = (): BulkAddForm => ({
	mode: "ALL_FINISHED",
	category: "",
});

const emptyItemForm = () => ({
	packagingId: 0,
	costPrice: 0,
	salePrice: 0,
	currency: "VND",
	validFrom: "",
	validTo: "",
});

function PriceBooks() {
	const qc = useQueryClient();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [expandedId, setExpandedId] = useState<number | null>(null);

	// Price book modal
	const [modalOpen, setModalOpen] = useState<"create" | "edit" | null>(null);
	const [editingBook, setEditingBook] = useState<PriceBook | null>(null);
	const [bookForm, setBookForm] = useState<PriceBookForm>(emptyPriceBookForm());

	// Bulk add modal
	const [bulkAddOpen, setBulkAddOpen] = useState<boolean>(false);
	const [bulkAddBook, setBulkAddBook] = useState<PriceBook | null>(null);
	const [bulkAddForm, setBulkAddForm] =
		useState<BulkAddForm>(emptyBulkAddForm());
	const [categories, setCategories] = useState<string[]>([]);

	// Items modal
	const [itemsModalOpen, setItemsModalOpen] = useState<boolean>(false);
	const [selectedBook, setSelectedBook] = useState<PriceBook | null>(null);
	const [itemForm, setItemForm] = useState(emptyItemForm());
	const [editingItem, setEditingItem] = useState<PriceBookItem | null>(null);
	const [itemSearch, setItemSearch] = useState("");

	const [allPackagings, setAllPackagings] = useState<PackagingOption[]>([]);
	const [allPriceBooks, setAllPriceBooks] = useState<PriceBook[]>([]);

	const loadPriceBooks = useCallback(async () => {
		const response = await apiV1<{ data: PriceBook[]; meta: any }>(
			"/api/v1/catalog/price-books?page=1&limit=100&search=" + search,
		);
		setAllPriceBooks(response.data.data ?? []);
	}, [search]);

	const loadPackagings = useCallback(async () => {
		const response = await apiV1<{ data: any }>(
			"/api/v1/catalog/packagings?limit=500",
		);
		const packagings = (response.data?.data || [])
			.map((pk: any) => {
				const costPrice =
					pk.prices?.find((p: any) => p.priceType === "COST")?.price || 0;
				return {
					id: pk.id,
					name: pk.name,
					sku: pk.sku,
					unit: pk.unit,
					productName: pk.products?.name,
					productCategory: pk.products?.category,
					costPrice: Number(costPrice || 0),
				};
			})
			.filter(p => p.id > 0);
		setAllPackagings(packagings);

		// Extract unique categories for bulk add
		const cats = [
			...new Set(packagings.map(p => p.productCategory).filter(Boolean)),
		];
		setCategories(cats as string[]);
	}, []);

	useEffect(() => {
		loadPriceBooks();
		loadPackagings();
	}, [loadPriceBooks, loadPackagings]);

	// Queries
	const priceBooks = useQuery({
		queryKey: ["price-books", page, search],
		queryFn: () =>
			apiV1<{ data: PriceBook[]; meta: any }>(
				`/api/v1/catalog/price-books?page=${page}&limit=30${search ? `&search=${encodeURIComponent(search)}` : ""}`,
			),
		staleTime: 60_000,
		refetchInterval: 30_000,
		refetchOnWindowFocus: true,
	});

	const rows =
		(Array.isArray(priceBooks.data?.data)
			? priceBooks.data.data
			: priceBooks.data?.data?.data) ?? [];
	const meta = Array.isArray(priceBooks.data?.data)
		? priceBooks.data?.meta
		: priceBooks.data?.data?.meta;

	// Mutations
	const invalidate = () => qc.invalidateQueries({ queryKey: ["price-books"] });

	const createPriceBook = useMutation({
		mutationFn: async () => {
			const response = await apiV1<PriceBook & { message?: string }>(
				"/api/v1/catalog/price-books",
				{
					method: "POST",
					body: JSON.stringify({
						code: bookForm.code,
						name: bookForm.name,
						description: bookForm.description || null,
						isDefault: bookForm.isDefault,
						isActive: bookForm.isActive,
						validFrom: bookForm.validFrom || null,
						validTo: bookForm.validTo || null,
					}),
				},
			);
			return response.data;
		},
		onSuccess: r => {
			toast.success(r?.message || "Thêm bảng giá thành công");
			setModalOpen(null);
			setBookForm(emptyPriceBookForm());
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
			toast.error(
				[error?.message || "Không thêm được bảng giá", detail]
					.filter(Boolean)
					.join("\n"),
			);
		},
	});

	const updatePriceBook = useMutation({
		mutationFn: async () => {
			const response = await apiV1<PriceBook & { message?: string }>(
				`/api/v1/catalog/price-books/${editingBook!.id}`,
				{
					method: "PUT",
					body: JSON.stringify({
						code: bookForm.code,
						name: bookForm.name,
						description: bookForm.description || null,
						isDefault: bookForm.isDefault,
						isActive: bookForm.isActive,
						validFrom: bookForm.validFrom || null,
						validTo: bookForm.validTo || null,
					}),
				},
			);
			return response.data;
		},
		onSuccess: r => {
			toast.success(r?.message || "Cập nhật bảng giá thành công");
			setModalOpen(null);
			setBookForm(emptyPriceBookForm());
			invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const deletePriceBook = useMutation({
		mutationFn: async (id: number) => {
			const response = await apiV1<{ message: string }>(
				`/api/v1/catalog/price-books/${id}`,
				{ method: "DELETE" },
			);
			return response.data;
		},
		onSuccess: r => {
			toast.success(r.message || "Xóa bảng giá thành công");
			setModalOpen(null);
			setBookForm(emptyPriceBookForm());
			invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const bulkAddItems = useMutation({
		mutationFn: async () => {
			const body: any = { mode: bulkAddForm.mode };
			if (bulkAddForm.mode === "BY_CATEGORY" && bulkAddForm.category) {
				body.category = bulkAddForm.category;
			}
			const response = await apiV1<{ added: number; message?: string }>(
				`/api/v1/catalog/price-books/${bulkAddBook!.id}/bulk-add`,
				{
					method: "POST",
					body: JSON.stringify(body),
				},
			);
			return response.data;
		},
		onSuccess: r => {
			toast.success(r?.message || `Đã thêm ${r.added} sản phẩm vào bảng giá`);
			setBulkAddOpen(false);
			setBulkAddForm(emptyBulkAddForm());
			invalidate();
			// Refetch the selected book to update items modal
			if (selectedBook) {
				qc.invalidateQueries({ queryKey: ["price-books", selectedBook.id] });
				// Also refetch the full price book with items
				apiV1<PriceBook>(`/api/v1/catalog/price-books/${selectedBook.id}`)
					.then(res => {
						console.log("Bulk add refresh response:", res);
						if (res.data) {
							console.log(
								"Setting selectedBook with items:",
								res.data.items?.length,
							);
							setSelectedBook(res.data);
						}
					})
					.catch(err => console.error("Refresh error:", err));
			}
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const savePriceBookItem = useMutation({
		mutationFn: async () => {
			const response = await apiV1<PriceBookItem & { message?: string }>(
				"/api/v1/catalog/price-books/items",
				{
					method: "POST",
					body: JSON.stringify({
						priceBookId: selectedBook?.id ?? 0,
						packagingId: itemForm.packagingId,
						costPrice: itemForm.costPrice,
						salePrice: itemForm.salePrice,
						currency: itemForm.currency,
						validFrom: itemForm.validFrom || null,
						validTo: itemForm.validTo || null,
					}),
				},
			);
			return response.data;
		},
		onSuccess: r => {
			toast.success(r?.message || "Lưu giá thành công");
			setEditingItem(null);
			setItemForm(emptyItemForm());
			invalidate();
			// Refresh selected book
			if (selectedBook) {
				apiV1<PriceBook>(`/api/v1/catalog/price-books/${selectedBook.id}`).then(
					res => {
						if (res.data) setSelectedBook(res.data);
					},
				);
			}
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const updatePriceBookItem = useMutation({
		mutationFn: async () => {
			const response = await apiV1<PriceBookItem & { message?: string }>(
				`/api/v1/catalog/price-books/items/${editingItem!.id}`,
				{
					method: "PUT",
					body: JSON.stringify({
						priceBookId: selectedBook?.id ?? 0,
						packagingId: itemForm.packagingId,
						costPrice: itemForm.costPrice,
						salePrice: itemForm.salePrice,
						currency: itemForm.currency,
						validFrom: itemForm.validFrom || null,
						validTo: itemForm.validTo || null,
					}),
				},
			);
			return response.data;
		},
		onSuccess: r => {
			toast.success(r?.message || "Cập nhật giá thành công");
			setEditingItem(null);
			setItemForm(emptyItemForm());
			invalidate();
			// Refresh selected book
			if (selectedBook) {
				apiV1<PriceBook>(`/api/v1/catalog/price-books/${selectedBook.id}`).then(
					res => {
						if (res.data) setSelectedBook(res.data);
					},
				);
			}
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const deletePriceBookItem = useMutation({
		mutationFn: async (id: number) => {
			const response = await apiV1<{ message: string }>(
				`/api/v1/catalog/price-books/items/${id}`,
				{ method: "DELETE" },
			);
			return response.data;
		},
		onSuccess: r => {
			toast.success(r.message || "Xóa giá thành công");
			invalidate();
			// Refresh selected book
			if (selectedBook) {
				apiV1<PriceBook>(`/api/v1/catalog/price-books/${selectedBook.id}`).then(
					res => {
						if (res.data) setSelectedBook(res.data);
					},
				);
			}
		},
		onError: (e: Error) => toast.error(e.message),
	});

	// Handlers
	const openCreateBook = () => {
		setEditingBook(null);
		setBookForm(emptyPriceBookForm());
		setModalOpen("create");
	};

	const openEditBook = (book: PriceBook) => {
		setEditingBook(book);
		setBookForm({
			id: book.id,
			code: book.code,
			name: book.name,
			description: book.description || "",
			isDefault: book.isDefault,
			isActive: book.isActive,
			validFrom: book.validFrom ? book.validFrom.split("T")[0] : "",
			validTo: book.validTo ? book.validTo.split("T")[0] : "",
		});
		setModalOpen("edit");
	};

	const deleteBookHandler = (id: number) => {
		if (window.confirm("Bạn có chắc chắn muốn xóa bảng giá này?")) {
			deletePriceBook.mutate(id);
		}
	};

	const openBulkAdd = (book: PriceBook) => {
		setBulkAddBook(book);
		setBulkAddForm(emptyBulkAddForm());
		setBulkAddOpen(true);
	};

	const openItemsModal = (book: PriceBook) => {
		setSelectedBook(book);
		setEditingItem(null);
		setItemForm(emptyItemForm());
		setItemSearch("");
		setItemsModalOpen(true);
	};

	const openAddItem = () => {
		setEditingItem(null);
		setItemForm(emptyItemForm());
	};

	const openEditItem = (item: PriceBookItem) => {
		setEditingItem(item);
		const pkg = allPackagings.find(p => p.id === item.packagingId);
		setItemForm({
			packagingId: item.packagingId,
			costPrice: item.costPrice,
			salePrice: item.salePrice,
			currency: item.currency,
			validFrom: item.validFrom ? item.validFrom.split("T")[0] : "",
			validTo: item.validTo ? item.validTo.split("T")[0] : "",
		});
	};

	const handleSaveItem = () => {
		if (editingItem) {
			updatePriceBookItem.mutate();
		} else {
			savePriceBookItem.mutate();
		}
	};

	const handleDeleteItem = (id: number) => {
		if (
			window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này khỏi bảng giá?")
		) {
			deletePriceBookItem.mutate(id);
		}
	};

	const filteredPackagings = allPackagings.filter(
		p =>
			p.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
			p.sku?.toLowerCase().includes(itemSearch.toLowerCase()) ||
			p.productName?.toLowerCase().includes(itemSearch.toLowerCase()),
	);

	const handleBulkAddSubmit = () => {
		bulkAddItems.mutate();
	};

	// Format date for datetime-local input
	const formatDateForInput = (dateStr: string) => {
		if (!dateStr) return "";
		const d = new Date(dateStr);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		const hours = String(d.getHours()).padStart(2, "0");
		const minutes = String(d.getMinutes()).padStart(2, "0");
		return `${year}-${month}-${day}T${hours}:${minutes}`;
	};

	// Render
	return (
		<div className="erp-page">
			{/* Header */}
			<div className="erp-page-header">
				<div>
					<h1>Quản lý bảng giá</h1>
					<p>
						Quản lý nhiều bảng giá cho sản phẩm, gán giá theo quy cách và khách
						hàng
					</p>
				</div>
				<div className="flex gap-2.5 flex-wrap">
					<Button variant="outline" onClick={openCreateBook}>
						<Plus size={16} /> Thêm bảng giá
					</Button>
				</div>
			</div>

			{/* Price Books List */}
			<Card className="overflow-hidden !p-0">
				<div className="erp-toolbar">
					<div className="erp-search">
						<Search size={15} />
						<input
							value={search}
							onChange={e => {
								setSearch(e.target.value);
								setPage(1);
							}}
							placeholder="Tìm tên bảng giá..."
						/>
					</div>
				</div>

				{priceBooks.isLoading ? (
					<div className="erp-empty">
						<p>Đang tải...</p>
					</div>
				) : priceBooks.isError ? (
					<div className="erp-empty">
						<p className="text-red-500">
							{(priceBooks.error as Error).message}
						</p>
					</div>
				) : !rows.length ? (
					<div className="erp-empty">
						<PackagePlus size={48} />
						<p>Chưa có bảng giá nào</p>
					</div>
				) : (
					<div>
						{rows.map(book => {
							const isExpanded = expandedId === book.id;
							const validFromStr = book.validFrom
								? new Date(book.validFrom).toLocaleDateString("vi-VN")
								: "—";
							const validToStr = book.validTo
								? new Date(book.validTo).toLocaleDateString("vi-VN")
								: "—";
							return (
								<div key={book.id} className={isExpanded ? "bg-slate-50" : ""}>
									<div
										className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
										onClick={() =>
											setExpandedId(prev => (prev === book.id ? null : book.id))
										}
									>
										<div
											className={`p-2 rounded-lg flex-shrink-0 ${isExpanded ? "bg-emerald-50" : "bg-white"}`}
										>
											<div className="flex items-center gap-2">
												<BookOpen
													size={16}
													className={
														isExpanded ? "text-emerald-600" : "text-[#465fff]"
													}
												/>
												<span className="font-semibold text-slate-800">
													{book.name}
												</span>
											</div>
											<span className="text-xs text-slate-500">
												{book.code}
											</span>
										</div>
										<div className="flex-1 min-w-0 flex items-center gap-4 text-sm text-slate-600">
											<div className="flex items-center gap-1">
												<Calendar size={13} />
												<span>
													{validFromStr} - {validToStr}
												</span>
											</div>
											<span
												className={`erp-badge ${book.isActive ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"}`}
											>
												{book.isActive ? "Kích hoạt" : "Không kích hoạt"}
											</span>
											{book.isDefault && (
												<span className="erp-badge bg-emerald-100 text-emerald-700">
													Mặc định
												</span>
											)}
										</div>
										<div className="flex items-center gap-2">
											<button
												title="Thêm hàng loạt sản phẩm"
												className="erp-icon-btn text-blue-600"
												onClick={e => {
													e.stopPropagation();
													openBulkAdd(book);
												}}
											>
												<Download size={14} />
											</button>
											<button
												title="Quản lý sản phẩm"
												className="erp-icon-btn text-teal-600"
												onClick={e => {
													e.stopPropagation();
													openItemsModal(book);
												}}
											>
												<PackagePlus size={14} />
											</button>
											<button
												title="Sửa bảng giá"
												className="erp-icon-btn"
												onClick={e => {
													e.stopPropagation();
													openEditBook(book);
												}}
											>
												<Edit size={14} />
											</button>
											<button
												title="Xóa bảng giá"
												className="erp-icon-btn text-red-500"
												onClick={e => {
													e.stopPropagation();
													deleteBookHandler(book.id);
												}}
											>
												<Trash2 size={14} />
											</button>
											{isExpanded ? (
												<ChevronDown
													size={15}
													className="text-slate-400 rotate-180"
												/>
											) : (
												<ChevronDown size={15} className="text-slate-400" />
											)}
										</div>
									</div>

									{/* Items expanded */}
									{isExpanded && (
										<div className="border-t border-slate-100 bg-slate-50/60 p-4">
											<div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
												<table className="w-full text-xs">
													<thead>
														<tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
															<th className="px-3 py-2 font-semibold">
																Sản phẩm / SKU
															</th>
															<th className="px-3 py-2 text-right font-semibold">
																Giá vốn
															</th>
															<th className="px-3 py-2 text-right font-semibold">
																Giá bán
															</th>
															<th className="px-3 py-2 text-right font-semibold">
																Từ ngày
															</th>
															<th className="px-3 py-2 text-right font-semibold">
																Đến ngày
															</th>
															<th className="px-3 py-2 text-center font-semibold">
																Chức năng
															</th>
														</tr>
													</thead>
													<tbody>
														{book.items?.map(item => (
															<tr key={item.id}>
																<td>
																	<div>
																		<b>{item.packaging?.name || "—"}</b>
																		{item.packaging?.sku && (
																			<small className="font-mono text-slate-400">
																				SKU: {item.packaging.sku}
																			</small>
																		)}
																	</div>
																</td>
																<td className="text-right font-semibold text-amber-700">
																	{formatNumber(item.costPrice)}{" "}
																	{item.currency || "VND"}
																</td>
																<td className="text-right font-semibold text-teal-700">
																	{formatNumber(item.salePrice)}{" "}
																	{item.currency || "VND"}
																</td>
																<td className="text-right">
																	{item.validFrom
																		? new Date(
																				item.validFrom,
																			).toLocaleDateString("vi-VN")
																		: "—"}
																</td>
																<td className="text-right">
																	{item.validTo
																		? new Date(item.validTo).toLocaleDateString(
																				"vi-VN",
																			)
																		: "—"}
																</td>
																<td className="text-center">
																	<div className="flex gap-1 justify-center">
																		<button
																			title="Sửa giá"
																			className="erp-icon-btn text-teal-600"
																			onClick={e => {
																				e.stopPropagation();
																				openEditItem(item);
																			}}
																		>
																			<Edit size={13} />
																		</button>
																		<button
																			title="Xóa khỏi bảng giá"
																			className="erp-icon-btn text-red-500"
																			onClick={e => {
																				e.stopPropagation();
																				handleDeleteItem(item.id!);
																			}}
																		>
																			<Trash2 size={13} />
																		</button>
																	</div>
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
											{!book.items?.length && (
												<div className="text-center py-4 text-slate-400">
													<p>Chưa có sản phẩm trong bảng giá này</p>
													<button
														className="mt-2 text-teal-600 hover:underline text-sm"
														onClick={e => {
															e.stopPropagation();
															openBulkAdd(book);
														}}
													>
														+ Thêm hàng loạt sản phẩm
													</button>
													{" hoặc "}
													<button
														className="mt-2 text-teal-600 hover:underline text-sm"
														onClick={e => {
															e.stopPropagation();
															openAddItem();
														}}
													>
														Thêm từng sản phẩm
													</button>
												</div>
											)}
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
						<b className="text-slate-800">{meta?.total ?? rows.length}</b> bảng
						giá
						{meta ? <> · Hiển thị {rows.length} bảng giá trang này</> : null}
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

			{/* ── Drawer: Tạo / Sửa bảng giá ── */}
			{modalOpen && (
				<div className="fixed inset-0 z-50 flex justify-end bg-slate-900/55">
					<div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl xl:max-w-3xl">
						<div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
							<div>
								<h2 className="text-lg font-bold text-slate-900">
									{modalOpen === "create"
										? "Thêm bảng giá"
										: `Sửa bảng giá: ${bookForm.name}`}
								</h2>
							</div>
							<div className="flex items-center gap-1">
								<button
									type="button"
									title="Trợ giúp"
									className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
								>
									?
								</button>
								<button
									type="button"
									title="Đóng"
									onClick={() => setModalOpen(null)}
									className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
								>
									<X size={18} />
								</button>
							</div>
						</div>
						<form
							onSubmit={e => {
								e.preventDefault();
								modalOpen === "create"
									? createPriceBook.mutate()
									: updatePriceBook.mutate();
							}}
							className="flex min-h-0 flex-1 flex-col"
						>
							<div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
								<div className="grid gap-4 md:grid-cols-2">
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-1">
											Mã bảng giá <span className="text-red-500">*</span>
										</label>
										<input
											type="text"
											required
											value={bookForm.code}
											onChange={e =>
												setBookForm({
													...bookForm,
													code: e.target.value,
												})
											}
											placeholder="Ví dụ: SALE_1, SALE_2, SALE_3"
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-1">
											Tên bảng giá <span className="text-red-500">*</span>
										</label>
										<input
											type="text"
											required
											value={bookForm.name}
											onChange={e =>
												setBookForm({
													...bookForm,
													name: e.target.value,
												})
											}
											placeholder="Ví dụ: Bảng giá đại lý, Bảng giá khách lẻ"
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</div>
									<div className="md:col-span-2">
										<label className="block text-sm font-medium text-slate-700 mb-1">
											Mô tả
										</label>
										<input
											type="text"
											value={bookForm.description || ""}
											onChange={e =>
												setBookForm({
													...bookForm,
													description: e.target.value,
												})
											}
											placeholder="Mô tả bảng giá"
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-1">
											Có hiệu lực từ
										</label>
										<DatePicker
											selected={
												bookForm.validFrom ? new Date(bookForm.validFrom) : null
											}
											onChange={date =>
												setBookForm({
													...bookForm,
													validFrom: date ? date.toISOString() : "",
												})
											}
											showTimeSelect
											dateFormat="dd/MM/yyyy HH:mm"
											placeholderText="Chọn ngày giờ"
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-1">
											Đến
										</label>
										<DatePicker
											selected={
												bookForm.validTo ? new Date(bookForm.validTo) : null
											}
											onChange={date =>
												setBookForm({
													...bookForm,
													validTo: date ? date.toISOString() : "",
												})
											}
											showTimeSelect
											dateFormat="dd/MM/yyyy HH:mm"
											placeholderText="Chọn ngày giờ"
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-1">
											Mặc định
										</label>
										<select
											value={bookForm.isDefault ? "1" : "0"}
											onChange={e =>
												setBookForm({
													...bookForm,
													isDefault: e.target.value === "1",
												})
											}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										>
											<option value="0">Không</option>
											<option value="1">Có</option>
										</select>
									</div>
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-1">
											Trạng thái
										</label>
										<select
											value={bookForm.isActive ? "1" : "0"}
											onChange={e =>
												setBookForm({
													...bookForm,
													isActive: e.target.value === "1",
												})
											}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										>
											<option value="0">Không kích hoạt</option>
											<option value="1">Kích hoạt</option>
										</select>
									</div>
								</div>
							</div>
							<div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
								<button
									type="button"
									onClick={() => setModalOpen(null)}
									className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
								>
									Hủy
								</button>
								<button
									type="submit"
									disabled={
										createPriceBook.isPending || updatePriceBook.isPending
									}
									className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
								>
									<Save size={14} />{" "}
									{createPriceBook.isPending || updatePriceBook.isPending
										? "Đang lưu..."
										: "Lưu"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* ── Drawer: Thêm hàng loạt sản phẩm ── */}
			{bulkAddOpen && bulkAddBook && (
				<div className="fixed inset-0 z-50 flex justify-end bg-slate-900/55">
					<div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
						<div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
							<div>
								<h2 className="text-lg font-bold text-slate-900">
									Thêm hàng loạt sản phẩm
								</h2>
								<p className="text-sm text-slate-500">
									Bảng giá: {bulkAddBook.name} ({bulkAddBook.code})
								</p>
							</div>
							<div className="flex items-center gap-1">
								<button
									type="button"
									title="Đóng"
									onClick={() => setBulkAddOpen(false)}
									className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
								>
									<X size={18} />
								</button>
							</div>
						</div>
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="p-4 space-y-4 overflow-y-auto">
								<div>
									<label className="block text-sm font-medium text-slate-700 mb-2">
										Chế độ thêm
									</label>
									<div className="flex gap-4">
										<label className="flex items-center gap-2 cursor-pointer">
											<input
												type="radio"
												value="ALL_FINISHED"
												checked={bulkAddForm.mode === "ALL_FINISHED"}
												onChange={e =>
													setBulkAddForm({
														...bulkAddForm,
														mode: "ALL_FINISHED",
													})
												}
												className="h-4 w-4 accent-emerald-600"
											/>
											<span className="text-sm">
												Tất cả thành phẩm (PRODUCT)
											</span>
										</label>
										<label className="flex items-center gap-2 cursor-pointer">
											<input
												type="radio"
												value="BY_CATEGORY"
												checked={bulkAddForm.mode === "BY_CATEGORY"}
												onChange={e =>
													setBulkAddForm({
														...bulkAddForm,
														mode: "BY_CATEGORY",
													})
												}
												className="h-4 w-4 accent-emerald-600"
											/>
											<span className="text-sm">Theo nhóm sản phẩm</span>
										</label>
									</div>
								</div>

								{bulkAddForm.mode === "BY_CATEGORY" && (
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-1">
											Chọn nhóm <span className="text-red-500">*</span>
										</label>
										<select
											value={bulkAddForm.category}
											onChange={e =>
												setBulkAddForm({
													...bulkAddForm,
													category: e.target.value,
												})
											}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										>
											<option value="">-- Chọn nhóm --</option>
											{categories.map(cat => (
												<option key={cat} value={cat}>
													{cat}
												</option>
											))}
										</select>
									</div>
								)}

								<div className="bg-slate-50 p-3 rounded border border-slate-200 text-sm text-slate-600">
									<p className="font-medium">Lưu ý:</p>
									<ul className="list-disc list-inside mt-1 space-y-1">
										<li>
											Giá vốn (cost price) sẽ tự động lấy từ giá COST trong danh
											mục hàng hóa
										</li>
										<li>Đơn vị tính lấy từ quy cách hàng hóa</li>
										<li>
											Sản phẩm nguyên vật liệu (MATERIAL) không được thêm vì
											không bán
										</li>
										<li>
											Sau khi thêm, nhập giá bán cho từng sản phẩm trong danh
											sách
										</li>
									</ul>
								</div>
							</div>
							<div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
								<button
									type="button"
									onClick={() => setBulkAddOpen(false)}
									className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
								>
									Hủy
								</button>
								<button
									type="button"
									onClick={handleBulkAddSubmit}
									disabled={
										(bulkAddForm.mode === "BY_CATEGORY" &&
											!bulkAddForm.category) ||
										bulkAddItems.isPending
									}
									className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
								>
									<Save size={14} />{" "}
									{bulkAddItems.isPending ? "Đang thêm..." : "Thêm hàng loạt"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* ── Drawer: Quản lý sản phẩm trong bảng giá ── */}
			{itemsModalOpen && selectedBook && (
				<div className="fixed inset-0 z-50 flex justify-end bg-slate-900/55">
					<div className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl xl:max-w-4xl">
						<div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
							<div>
								<h2 className="text-lg font-bold text-slate-900">
									Sản phẩm trong bảng giá: {selectedBook.name}
								</h2>
								<p className="text-sm text-slate-500">
									Mã: {selectedBook.code}
								</p>
							</div>
							<div className="flex items-center gap-1">
								<button
									type="button"
									title="Trợ giúp"
									className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
								>
									?
								</button>
								<button
									type="button"
									title="Đóng"
									onClick={() => setItemsModalOpen(false)}
									className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
								>
									<X size={18} />
								</button>
							</div>
						</div>
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="p-4 border-b border-slate-200 bg-slate-50">
								<div className="flex flex-wrap gap-3 items-center">
									<Button
										variant="outline"
										onClick={() => openBulkAdd(selectedBook!)}
										disabled={!selectedBook}
									>
										<Download size={14} /> Thêm hàng loạt
									</Button>
									<Button variant="outline" onClick={openAddItem}>
										<Plus size={14} /> Thêm từng sản phẩm
									</Button>
									<div className="relative flex-1 max-w-md">
										<Search
											size={15}
											className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
										/>
										<input
											type="text"
											placeholder="Tìm sản phẩm..."
											value={itemSearch}
											onChange={e => setItemSearch(e.target.value)}
											className="w-full pl-10 pr-3 py-2 rounded border border-slate-300 text-sm outline-none focus:border-emerald-500"
										/>
									</div>
								</div>
							</div>

							{/* Add/Edit Item Form */}
							{(editingItem || itemForm.packagingId === 0) && (
								<div className="border-b border-slate-200 bg-slate-50 p-4">
									<h3 className="mb-3 font-semibold text-slate-900">
										{editingItem
											? "Sửa giá sản phẩm"
											: "Thêm sản phẩm vào bảng giá"}
									</h3>
									<div className="grid gap-4 md:grid-cols-3">
										<div>
											<label className="block text-sm font-medium text-slate-700 mb-1">
												Chọn sản phẩm <span className="text-red-500">*</span>
											</label>
											<select
												value={itemForm.packagingId}
												onChange={e => {
													const id = Number(e.target.value);
													const pkg = allPackagings.find(p => p.id === id);
													setItemForm(prev => ({
														...prev,
														packagingId: id,
														costPrice: pkg?.costPrice || 0,
														salePrice: pkg ? 0 : prev.salePrice,
													}));
												}}
												className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
											>
												<option value="0">-- Chọn sản phẩm --</option>
												{filteredPackagings.map(p => (
													<option key={p.id} value={p.id}>
														{p.name} {p.sku ? `(${p.sku})` : ""} - {p.unit}
														{p.productName ? ` | ${p.productName}` : ""}
														{p.costPrice
															? ` | Giá vốn: ${formatNumber(p.costPrice)}`
															: ""}
													</option>
												))}
											</select>
										</div>
										<div>
											<label className="block text-sm font-medium text-slate-700 mb-1">
												Giá vốn (tự động)
											</label>
											<input
												type="number"
												min={0}
												step="any"
												value={itemForm.costPrice}
												onChange={e =>
													setItemForm({
														...itemForm,
														costPrice: Number(e.target.value) || 0,
													})
												}
												placeholder="0"
												className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-right outline-none focus:border-emerald-500 bg-slate-50"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-slate-700 mb-1">
												Giá bán <span className="text-red-500">*</span>
											</label>
											<input
												type="number"
												min={0}
												step="any"
												value={itemForm.salePrice}
												onChange={e =>
													setItemForm({
														...itemForm,
														salePrice: Number(e.target.value) || 0,
													})
												}
												placeholder="0"
												className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-right outline-none focus:border-emerald-500"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-slate-700 mb-1">
												ĐVT
											</label>
											<input
												type="text"
												value={
													filteredPackagings.find(
														p => p.id === itemForm.packagingId,
													)?.unit || ""
												}
												disabled
												className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-slate-100 outline-none"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-slate-700 mb-1">
												Từ ngày
											</label>
											<DatePicker
												selected={
													itemForm.validFrom
														? new Date(itemForm.validFrom)
														: null
												}
												onChange={date =>
													setItemForm({
														...itemForm,
														validFrom: date ? date.toISOString() : "",
													})
												}
												showTimeSelect
												dateFormat="dd/MM/yyyy HH:mm"
												placeholderText="Chọn ngày giờ"
												className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-slate-700 mb-1">
												Đến ngày
											</label>
											<DatePicker
												selected={
													itemForm.validTo ? new Date(itemForm.validTo) : null
												}
												onChange={date =>
													setItemForm({
														...itemForm,
														validTo: date ? date.toISOString() : "",
													})
												}
												showTimeSelect
												dateFormat="dd/MM/yyyy HH:mm"
												placeholderText="Chọn ngày giờ"
												className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
											/>
										</div>
									</div>
									<div className="mt-4 flex justify-end gap-2">
										<button
											type="button"
											onClick={() => {
												setEditingItem(null);
												setItemForm(emptyItemForm());
											}}
											className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
										>
											Hủy
										</button>
										<button
											type="button"
											onClick={handleSaveItem}
											disabled={
												!itemForm.packagingId ||
												savePriceBookItem.isPending ||
												updatePriceBookItem.isPending
											}
											className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
										>
											<Save size={14} />{" "}
											{savePriceBookItem.isPending ||
											updatePriceBookItem.isPending
												? "Đang lưu..."
												: editingItem
													? "Cập nhật"
													: "Thêm"}
										</button>
									</div>
								</div>
							)}

							{/* Items List */}
							<div className="min-h-0 flex-1 overflow-auto p-4">
								{selectedBook.items?.length ? (
									<div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
										<table className="w-full text-xs">
											<thead>
												<tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
													<th className="px-3 py-2 font-semibold">
														Sản phẩm / SKU
													</th>
													<th className="px-3 py-2 text-right font-semibold">
														Giá vốn
													</th>
													<th className="px-3 py-2 text-right font-semibold">
														Giá bán
													</th>
													<th className="px-3 py-2 text-right font-semibold">
														Từ ngày
													</th>
													<th className="px-3 py-2 text-right font-semibold">
														Đến ngày
													</th>
													<th className="px-3 py-2 text-center font-semibold">
														Chức năng
													</th>
												</tr>
											</thead>
											<tbody>
												{selectedBook.items.map(item => (
													<tr key={item.id}>
														<td>
															<div>
																<b>{item.packaging?.name || "—"}</b>
																{item.packaging?.sku && (
																	<small className="font-mono text-slate-400">
																		SKU: {item.packaging.sku}
																	</small>
																)}
															</div>
														</td>
														<td className="text-right font-semibold text-amber-700">
															{formatNumber(item.costPrice)}{" "}
															{item.currency || "VND"}
														</td>
														<td className="text-right font-semibold text-teal-700">
															{formatNumber(item.salePrice)}{" "}
															{item.currency || "VND"}
														</td>
														<td className="text-right">
															{item.validFrom
																? new Date(item.validFrom).toLocaleDateString(
																		"vi-VN",
																	)
																: "—"}
														</td>
														<td className="text-right">
															{item.validTo
																? new Date(item.validTo).toLocaleDateString(
																		"vi-VN",
																	)
																: "—"}
														</td>
														<td className="text-center">
															<div className="flex gap-1 justify-center">
																<button
																	title="Sửa giá"
																	className="erp-icon-btn text-teal-600"
																	onClick={() => openEditItem(item)}
																>
																	<Edit size={13} />
																</button>
																<button
																	title="Xóa khỏi bảng giá"
																	className="erp-icon-btn text-red-500"
																	onClick={() => handleDeleteItem(item.id!)}
																>
																	<Trash2 size={13} />
																</button>
															</div>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								) : (
									<div className="text-center py-12 text-slate-400">
										<PackagePlus
											size={48}
											className="mx-auto mb-3 opacity-50"
										/>
										<p>Chưa có sản phẩm nào trong bảng giá này</p>
										<div className="mt-3 flex gap-2 justify-center">
											<Button
												variant="outline"
												onClick={() => openBulkAdd(selectedBook!)}
												disabled={!selectedBook}
											>
												<Download size={14} /> Thêm hàng loạt
											</Button>
											<Button onClick={openAddItem}>
												<Plus size={14} /> Thêm từng sản phẩm
											</Button>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default PriceBooks;

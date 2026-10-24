import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronDown,
	Edit,
	Plus,
	Save,
	Trash2,
	X,
	Search,
	PackagePlus,
	BookOpen,
	Calendar,
	Download,
} from "lucide-react";
import toast from "../components/ui/toast";
import { confirm } from "../components/ui/confirm";
import Button from "../components/ui/button";
import { Card } from "../components/ui/card";
import { apiV1 } from "../lib/apiV1";
import { formatNumber, formatNumberInput, parseNumberWithSeparators } from "../lib/utils";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ListToolbar from "../components/ListToolbar";
import type { FilterField, FilterValues } from "../components/FilterDrawer";
import { exportExcelFile } from "../lib/excelExport";

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

interface ItemForm {
	packagingId: number;
	costPrice: number;
	salePrice: number;
	currency: string;
	validFrom: string;
	validTo: string;
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

const emptyBulkAddForm = () => ({
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
	const [filters, setFilters] = useState<FilterValues>({});
	const [expandedBooks, setExpandedBooks] = useState<Record<number, PriceBook>>({});
	const [editedPrices, setEditedPrices] = useState<Record<number, { salePrice: number }>>({});

	const handleExpand = (bookId: number) => {
		setExpandedBooks((prev) => {
			if (prev[bookId]) {
				const next = { ...prev };
				delete next[bookId];
				return next;
			}
			const next = { ...prev };
			apiV1<PriceBook>(`/api/v1/catalog/price-books/${bookId}?_t=${Date.now()}`)
				.then((res) => {
					if (res.data) {
						setExpandedBooks((current) => ({ ...current, [bookId]: res.data! }));
					}
				})
				.catch((err) => console.error("Fetch price book error:", err));
			return next;
		});
};

const saveAllPrices = async (bookId: number, items: PriceBookItem[]) => {
		const updates = items
			.filter((item) => editedPrices[item.id])
			.map((item) => {
				return {
					priceBookId: item.priceBookId,
					packagingId: item.packagingId,
					costPrice: item.costPrice,
					salePrice: editedPrices[item.id]?.salePrice ?? item.salePrice,
					currency: item.currency,
					validFrom: item.validFrom,
					validTo: item.validTo,
				};
			});

		for (const update of updates) {
			await apiV1<PriceBookItem & { message?: string }>(`/api/v1/catalog/price-books/${bookId}/items`, {
				method: "POST",
				body: JSON.stringify(update),
			});
		}

		toast.success("Đã lưu giá bán");
		setEditedPrices({});
		invalidate();
	};

	const handlePriceChange = (itemId: number, rawValue: string) => {
		const value = parseNumberWithSeparators(rawValue);
		setEditedPrices((prev) => ({
			...prev,
			[itemId]: { salePrice: value },
		}));
	};

const isExpanded = (bookId: number) => !!expandedBooks[bookId];

	// Price book modal
	const [modalOpen, setModalOpen] = useState<"create" | "edit" | null>(null);
	const [editingBook, setEditingBook] = useState<PriceBook | null>(null);
	const [bookForm, setBookForm] = useState<PriceBookForm>(emptyPriceBookForm());

	// Bulk add modal
	const [bulkAddOpen, setBulkAddOpen] = useState<boolean>(false);
	const [bulkAddBook, setBulkAddBook] = useState<PriceBook | null>(null);
	const [bulkAddForm, setBulkAddForm] = useState(emptyBulkAddForm());
	const [categories, setCategories] = useState<string[]>([]);

	// Item form (for inline editing in expanded row)
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
		const response = await apiV1<{ data: any }>("/api/v1/catalog/packagings?limit=500");
		const packagings = (response.data?.data || [])
			.map((pk: any) => {
				const costPrice = pk.prices?.find((p: any) => p.priceType === "COST")?.price || 0;
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
			.filter((p) => p.id > 0);
		setAllPackagings(packagings);
		const cats = [...new Set(packagings.map((p) => p.productCategory).filter(Boolean))];
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
		(Array.isArray(priceBooks.data?.data) ? priceBooks.data.data : priceBooks.data?.data?.data) ?? [];
	const meta = Array.isArray(priceBooks.data?.data) ? priceBooks.data?.meta : priceBooks.data?.data?.meta;
	const filterFields: FilterField[] = [
		{
			type: "select",
			key: "status",
			label: "Trạng thái",
			options: [
				{ value: "ACTIVE", label: "Kích hoạt" },
				{ value: "INACTIVE", label: "Không kích hoạt" },
			],
		},
		{
			type: "dateRange",
			key: "validFrom",
			label: "Hiệu lực từ",
			fromKey: "dateFrom",
			toKey: "dateTo",
		},
	];
	const visibleRows = useMemo(
		() =>
			rows.filter((book) => {
				if (
					filters.status === "ACTIVE" && !book.isActive ||
					filters.status === "INACTIVE" && book.isActive
				) {
					return false;
				}
				const date = (book.validFrom || "").slice(0, 10);
				if (filters.dateFrom && (!date || date < filters.dateFrom)) return false;
				if (filters.dateTo && (!date || date > filters.dateTo)) return false;
				return true;
			}),
		[rows, filters],
	);
	const exportPriceBooks = () =>
		exportExcelFile(
			"bang-gia.xlsx",
			"Bang gia",
			[
				{ header: "Mã", value: (book: PriceBook) => book.code },
				{ header: "Tên bảng giá", value: (book: PriceBook) => book.name, width: 30 },
				{ header: "Mô tả", value: (book: PriceBook) => book.description || "", width: 36 },
				{ header: "Từ ngày", value: (book: PriceBook) => book.validFrom || "" },
				{ header: "Đến ngày", value: (book: PriceBook) => book.validTo || "" },
				{ header: "Mặc định", value: (book: PriceBook) => (book.isDefault ? "Có" : "Không") },
				{ header: "Kích hoạt", value: (book: PriceBook) => (book.isActive ? "Có" : "Không") },
			],
			visibleRows,
		);

	// Mutations
	const invalidate = () => qc.invalidateQueries({ queryKey: ["price-books"] });

	const createPriceBook = useMutation({
		mutationFn: async () => {
			const response = await apiV1<PriceBook & { message?: string }>("/api/v1/catalog/price-books", {
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
			});
			return response.data;
		},
		onSuccess: (r) => {
			toast.success(r?.message || "Thêm bảng giá thành công");
			setModalOpen(null);
			setBookForm(emptyPriceBookForm());
			invalidate();
		},
		onError: (error: any) => {
			const detail = error?.fieldErrors
				? Object.entries(error.fieldErrors)
						.map(([field, messages]) => `${field}: ${(messages as string[]).join(", ")}`)
						.join("; ")
					: "";
			toast.error([error?.message || "Không thêm được bảng giá", detail].filter(Boolean).join("\n"));
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
		onSuccess: (r) => {
			toast.success(r?.message || "Cập nhật bảng giá thành công");
			setModalOpen(null);
			setBookForm(emptyPriceBookForm());
			invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const deletePriceBook = useMutation({
		mutationFn: async (id: number) => {
			const response = await apiV1<{ message: string }>(`/api/v1/catalog/price-books/${id}`, {
				method: "DELETE",
			});
			return response;
		},
		onSuccess: (r) => {
			toast.success(r.data?.message || r.message || "Xóa bảng giá thành công");
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
				{ method: "POST", body: JSON.stringify(body) },
			);
			return response.data;
		},
		onSuccess: (r) => {
			toast.success(r?.message || `Đã thêm ${r.added} sản phẩm vào bảng giá`);
			setBulkAddOpen(false);
			setBulkAddForm(emptyBulkAddForm());
			invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const savePriceBookItem = useMutation({
		mutationFn: async () => {
			const response = await apiV1<PriceBookItem & { message?: string }>("/api/v1/catalog/price-books/items", {
				method: "POST",
				body: JSON.stringify({
					priceBookId: bulkAddBook?.id ?? 0,
					packagingId: itemForm.packagingId,
					costPrice: itemForm.costPrice,
					salePrice: itemForm.salePrice,
					currency: itemForm.currency,
					validFrom: itemForm.validFrom || null,
					validTo: itemForm.validTo || null,
				}),
			});
			return response.data;
		},
		onSuccess: (r) => {
			toast.success(r?.message || "Lưu giá thành công");
			setEditingItem(null);
			setItemForm(emptyItemForm());
			invalidate();
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
						priceBookId: bulkAddBook?.id ?? 0,
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
		onSuccess: (r) => {
			toast.success(r?.message || "Cập nhật giá thành công");
			setEditingItem(null);
			setItemForm(emptyItemForm());
			invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const deletePriceBookItem = useMutation({
		mutationFn: async (id: number) => {
			const response = await apiV1<{ message: string }>(`/api/v1/catalog/price-books/items/${id}`, {
				method: "DELETE",
			});
			return response.data;
		},
		onSuccess: (r) => {
			toast.success(r.message || "Xóa giá thành công");
			invalidate();
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

	const deleteBookHandler = async (id: number) => {
		if (await confirm("Bạn có chắc chắn muốn xóa bảng giá này?")) {
			deletePriceBook.mutate(id);
		}
	};

	const openBulkAdd = (book: PriceBook) => {
		setBulkAddBook(book);
		setBulkAddForm(emptyBulkAddForm());
		setBulkAddOpen(true);
	};

	const openAddItem = () => {
		setEditingItem(null);
		setItemForm(emptyItemForm());
	};

	const openEditItem = (item: PriceBookItem) => {
		setEditingItem(item);
		const pkg = allPackagings.find((p) => p.id === item.packagingId);
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

	const handleDeleteItem = async (id: number) => {
		if (await confirm("Bạn có chắc chắn muốn xóa sản phẩm này khỏi bảng giá?")) {
			deletePriceBookItem.mutate(id);
		}
	};

	const filteredPackagings = allPackagings.filter(
		(p) =>
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
					<p>Quản lý nhiều bảng giá cho sản phẩm, gán giá theo quy cách và khách hàng</p>
				</div>
				<div className="flex gap-2.5 flex-wrap">
					<Button variant="outline" onClick={openCreateBook}>
						<Plus size={16} /> Thêm bảng giá
					</Button>
				</div>
			</div>

			{/* Price Books List */}
			<Card className="overflow-hidden !p-0">
				<ListToolbar
					fields={filterFields}
					values={filters}
					onChange={next => {
						setFilters(next);
						setPage(1);
					}}
					onExport={exportPriceBooks}
					exportDisabled={visibleRows.length === 0}
					search={
						<div className="erp-search">
							<Search size={15} />
							<input
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(1);
								}}
								placeholder="Tìm tên bảng giá..."
							/>
						</div>
					}
				/>

				{priceBooks.isLoading ? (
					<div className="erp-empty">
						<p>Đang tải...</p>
					</div>
				) : priceBooks.isError ? (
					<div className="erp-empty">
						<p className="text-red-500">{(priceBooks.error as Error).message}</p>
					</div>
				) : !visibleRows.length ? (
					<div className="erp-empty">
						<PackagePlus size={48} />
						<p>Chưa có bảng giá nào</p>
					</div>
				) : (
					<div>
						{visibleRows.map((book) => {
							const expanded = isExpanded(book.id);
							const expandedBook = expandedBooks[book.id];
							const validFromStr = book.validFrom
								? new Date(book.validFrom).toLocaleDateString("vi-VN")
								: "—";
							const validToStr = book.validTo
								? new Date(book.validTo).toLocaleDateString("vi-VN")
								: "—";
							return (
								<div key={book.id} className={expanded ? "bg-slate-50" : ""}>
									<div
										className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
										onClick={() => handleExpand(book.id)}
									>
										<div className={`p-2 rounded-lg flex-shrink-0 ${expanded ? "bg-emerald-50" : "bg-white"}`}>
											<div className="flex items-center gap-2">
												<BookOpen
													size={16}
													className={expanded ? "text-emerald-600" : "text-[#422afb]"}
												/>
												<span className="font-semibold text-slate-800">{book.name}</span>
											</div>
											<span className="text-xs text-slate-500">{book.code}</span>
										</div>
										<div className="flex-1 min-w-0 flex items-center gap-4 text-sm text-slate-600">
											<div className="flex items-center gap-1">
												<Calendar size={13} />
												<span>{validFromStr} - {validToStr}</span>
											</div>
											<span
												className={`erp-badge ${book.isActive ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"}`}
											>
												{book.isActive ? "Kích hoạt" : "Không kích hoạt"}
											</span>
											{book.isDefault && (
												<span className="erp-badge bg-emerald-100 text-emerald-700">Mặc định</span>
											)}
										</div>
										<div className="flex items-center gap-2">
											<button
												title="Thêm hàng loạt sản phẩm"
												className="erp-icon-btn text-blue-600"
												onClick={(e) => {
													e.stopPropagation();
													openBulkAdd(book);
												}}
											>
												<Download size={14} />
											</button>
											<button
												title="Sửa bảng giá"
												className="erp-icon-btn"
												onClick={(e) => {
													e.stopPropagation();
													openEditBook(book);
												}}
											>
												<Edit size={14} />
											</button>
											<button
												title="Xóa bảng giá"
												className="erp-icon-btn text-red-500"
												onClick={(e) => {
													e.stopPropagation();
													deleteBookHandler(book.id);
												}}
											>
												<Trash2 size={14} />
											</button>
											{expanded ? (
												<ChevronDown size={15} className="text-slate-400 rotate-180" />
											) : (
												<ChevronDown size={15} className="text-slate-400" />
											)}
										</div>
									</div>

									{/* Items expanded */}
									{expanded && (
										<div className="border-t border-slate-100 bg-slate-50/60 p-4">
											<div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
												<table className="w-full text-xs">
													<thead>
														<tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
															<th className="px-3 py-2 font-semibold">Sản phẩm / SKU</th>
															<th className="px-3 py-2 text-right font-semibold">Giá vốn</th>
															<th className="px-3 py-2 text-right font-semibold">Giá bán</th>
															<th className="px-3 py-2 text-center font-semibold">Chức năng</th>
														</tr>
													</thead>
													<tbody>
														{expandedBook?.items?.map((item) => {
															return (
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
																		{formatNumber(item.costPrice)} {item.currency || "VND"}
																	</td>
																	<td className="text-right">
																		<input
																			type="text"
																			min={0}
																			step="any"
																			value={editedPrices[item.id]?.salePrice ? formatNumberInput(editedPrices[item.id].salePrice) : formatNumberInput(item.salePrice)}
																			onChange={(e) => handlePriceChange(item.id, e.target.value)}
																			className="w-[60px] text-right rounded border border-slate-300 px-2 py-1 text-sm text-teal-700 font-semibold outline-none focus:border-emerald-500"
																		/>
																	</td>
																	<td className="text-center">
																		<div className="flex gap-1 justify-center">
																			<button
																				title="Xóa khỏi bảng giá"
																				className="erp-icon-btn text-red-500"
																				onClick={(e) => {
																					e.stopPropagation();
																					handleDeleteItem(item.id!);
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

											{expandedBook?.items?.length && (
												<div className="mt-4 flex justify-end">
													<button
														type="button"
														onClick={() => saveAllPrices(expandedBook!.id, expandedBook!.items!)}
														disabled={Object.keys(editedPrices).length === 0}
														className="erp-btn erp-btn-primary"
													>
														<Save size={14} /> Lưu giá bán
													</button>
												</div>
											)}

											{!expandedBook?.items?.length && (
												<div className="text-center py-4 text-slate-400">
													<p>Chưa có sản phẩm trong bảng giá này</p>
													<button
														className="mt-2 text-sm font-semibold text-[#422afb] hover:underline"
														onClick={(e) => {
															e.stopPropagation();
															openBulkAdd(expandedBook || book);
														}}
													>
														+ Thêm hàng loạt sản phẩm
													</button>
													{" hoặc "}
													<button className="mt-2 text-sm font-semibold text-[#422afb] hover:underline" onClick={(e) => { e.stopPropagation(); openAddItem(); }}>
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
						Tổng số: <b className="text-slate-800">{meta?.total ?? rows.length}</b> bảng giá
						{meta ? <> · Hiển thị {rows.length} bảng giá trang này</> : null}
					</span>
					<span className="flex-1" />
					<button className="erp-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
						Trước
					</button>
					<span>Trang {page}/{meta?.totalPages ?? 1}</span>
					<button className="erp-btn" disabled={!meta || page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
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
									{modalOpen === "create" ? "Thêm bảng giá" : `Sửa bảng giá: ${bookForm.name}`}
								</h2>
							</div>
							<div className="flex items-center gap-1">
								<button
									type="button"
									title="Trợ giúp"
									className="erp-icon-btn"
								>
									?
								</button>
								<button
									type="button"
									title="Đóng"
									onClick={() => setModalOpen(null)}
									className="erp-icon-btn"
								>
									<X size={18} />
								</button>
							</div>
						</div>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								modalOpen === "create" ? createPriceBook.mutate() : updatePriceBook.mutate();
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
											onChange={(e) => setBookForm({ ...bookForm, code: e.target.value })}
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
											onChange={(e) => setBookForm({ ...bookForm, name: e.target.value })}
											placeholder="Ví dụ: Bảng giá đại lý, Bảng giá khách lẻ"
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</div>
									<div className="md:col-span-2">
										<label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
										<input
											type="text"
											value={bookForm.description || ""}
											onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
											placeholder="Mô tả bảng giá"
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-1">Có hiệu lực từ</label>
										<DatePicker
											selected={bookForm.validFrom ? new Date(bookForm.validFrom) : null}
											onChange={(date) => setBookForm({ ...bookForm, validFrom: date ? date.toISOString() : "" })}
											showTimeSelect
											dateFormat="dd/MM/yyyy HH:mm"
											placeholderText="Chọn ngày giờ"
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-1">Đến</label>
										<DatePicker
											selected={bookForm.validTo ? new Date(bookForm.validTo) : null}
											onChange={(date) => setBookForm({ ...bookForm, validTo: date ? date.toISOString() : "" })}
											showTimeSelect
											dateFormat="dd/MM/yyyy HH:mm"
											placeholderText="Chọn ngày giờ"
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-1">Mặc định</label>
										<select
											value={bookForm.isDefault ? "1" : "0"}
											onChange={(e) => setBookForm({ ...bookForm, isDefault: e.target.value === "1" })}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										>
											<option value="0">Không</option>
											<option value="1">Có</option>
										</select>
									</div>
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái</label>
										<select
											value={bookForm.isActive ? "1" : "0"}
											onChange={(e) => setBookForm({ ...bookForm, isActive: e.target.value === "1" })}
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
									className="erp-btn"
								>
									Hủy
								</button>
								<button
									type="submit"
									disabled={createPriceBook.isPending || updatePriceBook.isPending}
									className="erp-btn erp-btn-primary"
								>
									<Save size={14} />{" "}
									{createPriceBook.isPending || updatePriceBook.isPending ? "Đang lưu..." : "Lưu"}
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
								<h2 className="text-lg font-bold text-slate-900">Thêm hàng loạt sản phẩm</h2>
								<p className="text-sm text-slate-500">Bảng giá: {bulkAddBook.name} ({bulkAddBook.code})</p>
							</div>
							<div className="flex items-center gap-1">
								<button
									type="button"
									title="Đóng"
									onClick={() => setBulkAddOpen(false)}
									className="erp-icon-btn"
								>
									<X size={18} />
								</button>
							</div>
						</div>
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="p-4 space-y-4 overflow-y-auto">
								<div>
									<label className="block text-sm font-medium text-slate-700 mb-2">Chế độ thêm</label>
									<div className="flex gap-4">
										<label className="flex items-center gap-2 cursor-pointer">
											<input
												type="radio"
												value="ALL_FINISHED"
												checked={bulkAddForm.mode === "ALL_FINISHED"}
												onChange={(e) =>
													setBulkAddForm({ ...bulkAddForm, mode: "ALL_FINISHED" })
												}
												className="h-4 w-4 accent-emerald-600"
											/>
											<span className="text-sm">Tất cả thành phẩm (PRODUCT)</span>
										</label>
										<label className="flex items-center gap-2 cursor-pointer">
											<input
												type="radio"
												value="BY_CATEGORY"
												checked={bulkAddForm.mode === "BY_CATEGORY"}
												onChange={(e) =>
													setBulkAddForm({ ...bulkAddForm, mode: "BY_CATEGORY" })
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
											onChange={(e) => setBulkAddForm({ ...bulkAddForm, category: e.target.value })}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										>
											<option value="">-- Chọn nhóm --</option>
											{categories.map((cat) => (
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
										<li>Giá vốn (cost price) sẽ tự động lấy từ giá COST trong danh mục hàng hóa</li>
										<li>Đơn vị tính lấy từ quy cách hàng hóa</li>
										<li>Sản phẩm nguyên vật liệu (MATERIAL) không được thêm vì không bán</li>
										<li>Sau khi thêm, nhập giá bán cho từng sản phẩm trong danh sách</li>
									</ul>
								</div>
							</div>
							<div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
								<button
									type="button"
									onClick={() => setBulkAddOpen(false)}
									className="erp-btn"
								>
									Hủy
								</button>
								<button
									type="button"
									onClick={handleBulkAddSubmit}
									disabled={
										(bulkAddForm.mode === "BY_CATEGORY" && !bulkAddForm.category) ||
										bulkAddItems.isPending
									}
									className="erp-btn erp-btn-primary"
								>
									<Save size={14} />{" "}
									{bulkAddItems.isPending ? "Đang thêm..." : "Thêm hàng loạt"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default PriceBooks;
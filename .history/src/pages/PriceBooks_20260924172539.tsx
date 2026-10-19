import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	ChevronDown,
	Edit,
	Eye,
	EyeOff,
	Plus,
	Save,
	Trash2,
	X,
	Upload,
	Search,
	PackagePlus,
	BookOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import Button from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Field, FieldLabel } from "../components/ui/input";
import { apiV1 } from "../lib/apiV1";
import { formatNumber } from "../lib/utils";

interface PriceBook {
	id: number;
	code: string;
	name: string;
	description: string | null;
	isDefault: boolean;
	isActive: boolean;
	createdAt: string;
	updatedAt: string | null;
	items?: PriceBookItem[];
}

interface PriceBookItem {
	id: number;
	priceBookId: number;
	packagingId: number;
	price: number;
	currency: string;
	validFrom: string | null;
	validTo: string | null;
	packaging?: {
		id: number;
		name: string;
		sku?: string;
		unit?: string;
		product?: { id: number; name: string; sku?: string };
	};
}

interface PriceBookForm {
	id?: number;
	code: string;
	name: string;
	description: string;
	isDefault: boolean;
	isActive: boolean;
}

interface UpsertPriceBookItemInput {
	priceBookId: number;
	packagingId: number;
	price: number;
	currency?: string;
	validFrom?: string;
	validTo?: string;
}

const PRICE_TYPES = [
	{ key: "COST", label: "Giá cost (vốn)", cls: "text-amber-700" },
	{ key: "SALE_1", label: "Giá bán đại lý/NPP", cls: "text-teal-700" },
	{ key: "SALE_2", label: "Giá bán cao tốc", cls: "text-slate-600" },
	{ key: "SALE_3", label: "Giá bán lẻ", cls: "text-slate-600" },
];

interface PriceItemRow {
	id?: number;
	packagingId: number;
	packagingName: string;
	unit?: string;
	price: number;
	currency: string;
	validFrom?: string;
	validTo?: string;
	deleteId?: number;
}

function PriceBookItemRow({
	row,
	onPriceChange,
	onDelete,
	onValidFromChange,
	onValidToChange,
}: {
	row: PriceItemRow;
	onPriceChange: (packagingId: number, price: number) => void;
	onDelete: (id: number) => void;
	onValidFromChange: (packagingId: number, date: string) => void;
	onValidToChange: (packagingId: number, date: string) => void;
}) {
	const [price, setPrice] = useState(row.price);
	const [validFrom, setValidFrom] = useState(row.validFrom ?? "");
	const [validTo, setValidTo] = useState(row.validTo ?? "");

	return (
		<div className="border-b border-slate-200 last:border-0 py-3">
			<div className="grid grid-cols-3 gap-3 md:grid-cols-4">
				<div>
					<label className="text-[13px] font-medium text-slate-700">
						Quy cách <span className="text-red-500">*</span>
					</label>
					<select
						onChange={e => {
							const packagingId = Number(e.target.value);
							onPriceChange(packagingId, row.price);
						}}
						className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
					>
						<option value="">Chọn quy cách</option>
						{/* Packaging options will be populated dynamically */}
					</select>
				</div>
				<div>
					<label className="text-[13px] font-medium text-slate-700">
						Giá <span className="text-red-500">*</span>
					</label>
					<input
						type="number"
						min={0}
						step="any"
						value={price}
						onChange={e => setPrice(Number(e.target.value))}
						className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-right outline-none focus:border-emerald-500"
					/>
				</div>
				<div>
					<label className="text-[13px] font-medium text-slate-700">ĐVT</label>
					<input
						type="text"
						value={row.unit ?? ""}
						className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
					/>
				</div>
				<div>
					<label className="text-[13px] font-medium text-slate-700">
						Từ ngày
					</label>
					<input
						type="date"
						value={validFrom}
						onChange={e => setValidFrom(e.target.value)}
						className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
					/>
				</div>
				<div>
					<label className="text-[13px] font-medium text-slate-700">
						Đến ngày
					</label>
					<input
						type="date"
						value={validTo}
						onChange={e => setValidTo(e.target.value)}
						className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
					/>
				</div>
				<div className="md:col-span-2">
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => onDelete(row.id ?? 0)}
							className="text-red-500 hover:text-red-700 text-sm"
						>
							<Trash2 size={14} /> Xoá
						</button>
						{row.id && (
							<button
								type="button"
								onClick={() => onValidFromChange(row.packagingId, validFrom)}
								className="text-blue-600 hover:text-blue-800 text-sm"
							>
								<Eye size={14} /> Xem lịch
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

const emptyPriceBookForm = (): PriceBookForm => ({
	id: undefined,
	code: "",
	name: "",
	description: "",
	isDefault: false,
	isActive: true,
});

function PriceBooks() {
	const qc = useQueryClient();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [expandedId, setExpandedId] = useState<number | null>(null);
	const [addMenuOpen, setAddMenuOpen] = useState(false);
	const [modalOpen, setModalOpen] = useState<"create" | "edit" | null>(null);
	const [editingBook, setEditingBook] = useState<PriceBook | null>(null);
	const [bookForm, setBookForm] = useState<PriceBookForm>(emptyPriceBookForm());
	const [pkgModalOpen, setPkgModalOpen] = useState<"create" | "edit" | null>(
		null,
	);
	const [editingItem, setEditingItem] = useState<
		PriceBookItem | PriceItemRow | null
	>(null);
	const [itemForm, setItemForm] = useState<PriceItemRow>({
		packagingId: 0,
		packagingName: "",
		price: 0,
		currency: "VND",
		validFrom: "",
		validTo: "",
		deleteId: undefined,
	});

	const [allPackagings, setAllPackagings] = useState<
		Array<{ id: number; name: string; sku?: string }>
	>([]);
	const [allPriceBooks, setAllPriceBooks] = useState<PriceBook[]>([]);

	const loadPriceBooks = useCallback(async () => {
		const response = await apiV1<{ data: PriceBook[]; meta: any }>(
			"/api/v1/catalog/price-books?page=1&limit=100&search=" + search,
		);
		setAllPriceBooks(response.data.data ?? []);
	}, [search]);

	const loadPackagings = useCallback(async () => {
		const response = await apiV1<{ data: any }>(
			"/api/v1/catalog/packagings?limit=200",
		);
		const packagings = (response.data?.data || [])
			.map((pk: any) => ({
				id: pk.id,
				name: pk.name,
				sku: pk.sku,
			}))
			.filter(p => p.id > 0);
		setAllPackagings(packagings);
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

	const savePriceBookItem = useMutation({
		mutationFn: async () => {
			const response = await apiV1<PriceBookItem & { message?: string }>(
				"/api/v1/catalog/price-books/items",
				{
					method: "POST",
					body: JSON.stringify({
						priceBookId: editingBook?.id ?? 0,
						packagingId: itemForm.packagingId,
						price: itemForm.price,
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
			setPkgModalOpen(null);
			setItemForm({
				packagingId: 0,
				packagingName: "",
				price: 0,
				currency: "VND",
				validFrom: "",
				validTo: "",
				deleteId: undefined,
			});
			invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const updatePriceBookItem = useMutation({
		mutationFn: async () => {
			const response = await apiV1<PriceBookItem & { message?: string }>(
				`/api/v1/catalog/price-books/items/${itemForm.id}`,
				{
					method: "PUT",
					body: JSON.stringify({
						priceBookId: editingBook?.id ?? 0,
						packagingId: itemForm.packagingId,
						price: itemForm.price,
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
			setPkgModalOpen(null);
			setItemForm({
				packagingId: 0,
				packagingName: "",
				price: 0,
				currency: "VND",
				validFrom: "",
				validTo: "",
				deleteId: undefined,
			});
			invalidate();
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
			setPkgModalOpen(null);
			setItemForm({
				packagingId: 0,
				packagingName: "",
				price: 0,
				currency: "VND",
				validFrom: "",
				validTo: "",
				deleteId: undefined,
			});
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
		});
		setModalOpen("edit");
	};

	const deleteBookHandler = (id: number) => {
		if (window.confirm("Bạn có chắc chắn muốn xóa bảng giá này?")) {
			deletePriceBook.mutate(id);
		}
	};

	const openAddItem = (bookId: number) => {
		setEditingBook(allPriceBooks?.find(b => b.id === bookId) ?? null);
		setItemForm({
			packagingId: 0,
			packagingName: "",
			price: 0,
			currency: "VND",
			validFrom: "",
			validTo: "",
			deleteId: undefined,
		});
		setPkgModalOpen("create");
	};

	const openEditItem = (item: PriceBookItem) => {
		setEditingItem(item);
		setItemForm({
			id: item.id,
			packagingId: item.packagingId,
			packagingName: item.packaging?.name ?? "",
			unit: item.packaging?.unit ?? "",
			price: item.price,
			currency: item.currency ?? "VND",
			validFrom: item.validFrom ?? "",
			validTo: item.validTo ?? "",
			deleteId: undefined,
		});
		setPkgModalOpen("edit");
	};

	const handlePriceChange = useCallback(
		(packagingId: number, price: number) => {
			// Update price in item form if packaging matches
			if (itemForm.packagingId === packagingId) {
				setItemForm(prev => ({
					...prev,
					price,
				}));
			}
		},
		[itemForm.packagingId],
	);

	const handleValidFromChange = useCallback(
		(packagingId: number, date: string) => {
			if (itemForm.packagingId === packagingId) {
				setItemForm(prev => ({
					...prev,
					validFrom: date,
				}));
			}
		},
		[itemForm.packagingId],
	);

	const handleValidToChange = useCallback(
		(packagingId: number, date: string) => {
			if (itemForm.packagingId === packagingId) {
				setItemForm(prev => ({
					...prev,
					validTo: date,
				}));
			}
		},
		[itemForm.packagingId],
	);

	// Render
	return (
		<div className="erp-page">
			{/* Header */}
			<div className="erp-page-header">
				<div>
					<h1>Quản lý bảng giá bán hàng</h1>
					<p>
						Quản lý nhiều bảng giá/gía cho sản phẩm, gán giá theo quy cách và
						khách hàng
					</p>
				</div>
				<div className="flex gap-2.5 flex-wrap">
					<Button variant="outline" onClick={openCreateBook}>
						<Plus size={16} /> Thêm bảng giá
					</Button>
					<div className="relative" data-catalog-add-menu>
						<div className="flex">
							<Button
								variant="primary"
								className="rounded-r-none"
								onClick={() => setAddMenuOpen(current => !current)}
							>
								<Plus size={16} /> Tùy chọn
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
							<div className="absolute right-0 z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-[#eaecf0] bg-white shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18)]">
								<button
									className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-[#344054] hover:bg-[#f9fafb]"
									onClick={() => {
										setAddMenuOpen(false);
										// TODO: Export/Import functionality
									}}
								>
									<Upload size={15} className="text-[#465fff]" /> Nhập từ Excel
								</button>
							</div>
						)}
					</div>
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
					<select
						value={""}
						onChange={e => {}}
						className="ml-2 rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
					>
						<option value="">Lọc trạng thái</option>
						<option value="active">Đang hoạt động</option>
						<option value="inactive">Đã vô hiệu hóa</option>
					</select>
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
									</div>
									<div className="border-t border-slate-100 bg-slate-50/60">
										<div className="p-4">
											<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
												<div>
													<label className="text-[12px] font-medium text-slate-600">
														Mã bảng giá
													</label>
													<p className="mt-1 font-mono text-slate-700">
														{book.code}
													</p>
												</div>
												<div>
													<label className="text-[12px] font-medium text-slate-600">
														Trạng thái
													</label>
													<span
														className={`erp-badge ${book.isActive ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"}`}
													>
														{book.isActive ? "Đang bán" : "Đã ẩn"}
													</span>
												</div>
												<div>
													<label className="text-[12px] font-medium text-slate-600">
														Mặc định
													</label>
													<span
														className={`erp-badge ${book.isDefault ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
													>
														{book.isDefault ? "Bảng giá mặc định" : ""}
													</span>
												</div>
												<div>
													<label className="text-[12px] font-medium text-slate-600">
														Số quy cách
													</label>
													<p className="mt-1 text-slate-700">
														{itemForm.packagingId > 0 ? "Xem chi tiết" : "0"}
													</p>
												</div>
											</div>
											<div className="mt-3 flex items-center gap-2">
												<button
													title="Sửa bảng giá"
													className="erp-icon-btn"
													onClick={e => openEditBook(book)}
												>
													<Edit size={14} />
												</button>
												{book.items?.length > 0 && (
													<button
														title="Xem chi tiết quy cách"
														className="erp-icon-btn text-teal-600"
													>
														<Eye size={14} />
													</button>
												)}
												{book.items?.length > 0 && (
													<button
														title="Xóa bảng giá"
														className="erp-icon-btn text-red-500"
														onClick={e => deleteBookHandler(book.id)}
													>
														<Trash2 size={14} />
													</button>
												)}
											</div>
										</div>

										{/* Packagings expanded */}
										{isExpanded && book.items?.length > 0 && (
											<div className="border-t border-slate-100 bg-slate-50/60 p-4">
												<div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
													<table className="w-full text-xs">
														<thead>
															<tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
																<th className="px-3 py-2 font-semibold">
																	Quy cách
																</th>
																<th className="px-3 py-2 text-right font-semibold">
																	Giá (VND)
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
															{book.items.map(item => (
																<tr key={item.id}>
																	<td>
																		{item.packaging?.name ||
																			item.packagingName ||
																			"—"}
																	</td>
																	<td className="text-right font-semibold">
																		{formatNumber(item.price)}{" "}
																		{item.currency || "VND"}
																	</td>
																	<td className="text-right">
																		{item.validFrom
																			? new Date(
																					item.validFrom,
																				).toLocaleDateString()
																			: "—"}
																	</td>
																	<td className="text-right">
																		{item.validTo
																			? new Date(
																					item.validTo,
																				).toLocaleDateString()
																			: "—"}
																	</td>
																	<td className="text-center">
																		<div className="flex gap-1">
																			<button
																				title="Sửa giá"
																				className="erp-icon-btn text-teal-600"
																				onClick={e => openEditItem(item)}
																			>
																				<Edit size={13} />
																			</button>
																			<button
																				title="Xóa giá"
																				className="erp-icon-btn text-red-500"
																				onClick={() => {
																					if (
																						window.confirm(
																							`Xóa giá cho quy cách "${item.packagingName || "—"}"?`,
																						)
																					)
																						deletePriceBookItem.mutate(
																							item.id!,
																						);
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
											</div>
										)}
									</div>
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

			{/* ── Drawer phải: Tạo / Sửa bảng giá ── */}
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
									<Field>
										<FieldLabel required>Mã bảng giá</FieldLabel>
										<Input
											required
											value={bookForm.code}
											onChange={e =>
												setBookForm({
													...bookForm,
													code: e.target.value,
												})
											}
											placeholder="Ví dụ: SALE_1, SALE_2, SALE_3"
										/>
									</Field>
									<Field>
										<FieldLabel required>Tên bảng giá</FieldLabel>
										<Input
											required
											value={bookForm.name}
											onChange={e =>
												setBookForm({
													...bookForm,
													name: e.target.value,
												})
											}
											placeholder="Ví dụ: Bảng giá đại lý, Bảng giá khách lẻ"
										/>
									</Field>
									<Field>
										<FieldLabel>Mô tả</FieldLabel>
										<Input
											value={bookForm.description || ""}
											onChange={e =>
												setBookForm({
													...bookForm,
													description: e.target.value,
												})
											}
											placeholder="Mô tả bảng giá"
										/>
									</Field>
									<div className="grid gap-4 md:grid-cols-2">
										<label className="text-[13px] font-medium text-slate-700">
											<span className="mb-1 block">Mặc định</span>
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
										</label>
										<label className="text-[13px] font-medium text-slate-700">
											<span className="mb-1 block">Trạng thái</span>
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
												<option value="0">Tạm dừng</option>
												<option value="1">Kích hoạt</option>
											</select>
										</label>
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
										: "Cất"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

export default PriceBooks;

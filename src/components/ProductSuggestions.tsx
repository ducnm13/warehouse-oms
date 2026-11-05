import { useMemo, useState } from "react";
import { CircleCheck, History, Search, Trash2, X } from "lucide-react";

export interface SuggestedProduct {
	packagingId: number;
	name: string;
	sku?: string | null;
	unit?: string | null;
	productName?: string | null;
	times: number;
	totalQuantity: number;
	lastPrice: number;
	stockQuantity?: number;
}

interface ProductSuggestionsProps {
	title?: string;
	subtitle?: string;
	items: SuggestedProduct[];
	loading?: boolean;
	search: string;
	onSearchChange: (value: string) => void;
	isAdded: (packagingId: number) => boolean;
	onAdd: (item: SuggestedProduct) => void;
	onAddAll?: (items: SuggestedProduct[]) => void;
}

export default function ProductSuggestions({
	title = "Gợi ý mặt hàng dựa theo lịch sử giao dịch",
	subtitle,
	items,
	loading,
	search,
	onSearchChange,
	isAdded,
	onAdd,
	onAddAll,
}: ProductSuggestionsProps) {
	const [collapsed, setCollapsed] = useState(false);
	const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => new Set());
	const formatStock = (value: number) =>
		new Intl.NumberFormat("vi-VN", {
			minimumFractionDigits: 4,
			maximumFractionDigits: 4,
		}).format(value);

	const visibleItems = useMemo(
		() => items.filter(item => !hiddenIds.has(item.packagingId)),
		[items, hiddenIds],
	);
	const selectableItems = useMemo(
		() => visibleItems.filter(item => !isAdded(item.packagingId)),
		[visibleItems, isAdded],
	);

	if (collapsed) return null;

	const dismiss = (packagingId: number) =>
		setHiddenIds(current => new Set(current).add(packagingId));

	const handleAdd = (item: SuggestedProduct) => {
		onAdd(item);
		dismiss(item.packagingId);
	};

	const handleAddAll = () => {
		if (!selectableItems.length) return;
		if (onAddAll) onAddAll(selectableItems);
		else selectableItems.forEach(item => onAdd(item));
		setHiddenIds(current => {
			const next = new Set(current);
			selectableItems.forEach(item => next.add(item.packagingId));
			return next;
		});
	};

	return (
		<div className="rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-fuchsia-50 p-3 shadow-sm">
			<div className="flex flex-wrap items-center gap-2.5">
				<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
					<History size={17} />
				</div>
				<div className="min-w-0 flex-1">
					<div className="text-sm font-bold text-[#2b3674]">{title}</div>
					{subtitle && (
						<div className="truncate text-xs text-slate-500">{subtitle}</div>
					)}
				</div>
				<div className="erp-search hidden w-52 sm:flex">
					<Search size={15} />
					<input
						value={search}
						onChange={event => onSearchChange(event.target.value)}
						placeholder="Tìm mặt hàng..."
					/>
				</div>
				<button
					type="button"
					onClick={handleAddAll}
					disabled={!selectableItems.length}
					className="rounded-lg border border-sky-400 bg-white px-3 py-1.5 text-xs font-semibold text-sky-600 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Chọn tất cả
				</button>
				<button
					type="button"
					onClick={() => setCollapsed(true)}
					aria-label="Đóng gợi ý"
					className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
				>
					<X size={18} />
				</button>
			</div>

			<div className="mt-2 flex sm:hidden">
				<div className="erp-search w-full">
					<Search size={15} />
					<input
						value={search}
						onChange={event => onSearchChange(event.target.value)}
						placeholder="Tìm mặt hàng..."
					/>
				</div>
			</div>

			<div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
				<div className="max-h-64 overflow-auto">
					<table className="w-full min-w-[640px] text-sm">
						<thead className="sticky top-0 z-10 bg-[#fbe7f5] text-left text-xs font-semibold text-slate-700">
							<tr>
								<th className="px-4 py-2.5">Mã hàng</th>
								<th className="px-4 py-2.5">Tên hàng</th>
								<th className="px-4 py-2.5 text-right">Số lượng tồn</th>
								<th className="px-4 py-2.5">Đơn vị tính</th>
								<th className="w-32 px-4 py-2.5 text-center">Chọn mặt hàng</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td
										colSpan={5}
										className="px-4 py-6 text-center text-xs text-slate-400"
									>
										Đang tải gợi ý...
									</td>
								</tr>
							) : !visibleItems.length ? (
								<tr>
									<td
										colSpan={5}
										className="px-4 py-6 text-center text-xs text-slate-400"
									>
										Chưa có lịch sử giao dịch để gợi ý
									</td>
								</tr>
							) : (
								visibleItems.map(item => {
									const added = isAdded(item.packagingId);
									return (
										<tr
											key={item.packagingId}
											className="border-t border-slate-100 hover:bg-slate-50/70"
										>
											<td className="px-4 py-2 text-slate-700">
												{item.sku || "-"}
											</td>
											<td className="px-4 py-2 font-medium text-slate-800">
												{item.productName || item.name}
											</td>
											<td className="px-4 py-2 text-right tabular-nums text-slate-700">
												{formatStock(Number(item.stockQuantity || 0))}
											</td>
											<td className="px-4 py-2 text-slate-600">
												{item.unit || ""}
											</td>
											<td className="px-4 py-2">
												<div className="flex items-center justify-center gap-2">
													<button
														type="button"
														onClick={() => handleAdd(item)}
														disabled={added}
														title={
															added
																? "Đã thêm vào phiếu"
																: "Thêm vào phiếu"
														}
														className={`rounded-full border p-0.5 transition-colors ${
															added
																? "cursor-default border-emerald-200 text-emerald-300"
																: "border-emerald-300 text-emerald-600 hover:bg-emerald-50"
														}`}
													>
														<CircleCheck size={18} />
													</button>
													<button
														type="button"
														onClick={() => dismiss(item.packagingId)}
														title="Bỏ khỏi gợi ý"
														className="rounded-full border border-rose-300 p-0.5 text-rose-500 transition-colors hover:bg-rose-50"
													>
														<Trash2 size={18} />
													</button>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

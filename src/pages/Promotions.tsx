import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2,
	Edit,
	Gift,
	PackagePlus,
	Plus,
	Search,
	Trash2,
	Undo2,
	X,
} from "lucide-react";
import toast from "../components/ui/toast";
import { confirm } from "../components/ui/confirm";
import { apiV1, legacyApi } from "../lib/apiV1";
import SearchableSelect from "../components/SearchableSelect";
import { formatDate, formatNumber } from "../lib/utils";
import type { Product, PromotionProgramV1, Warehouse } from "../types";
import { useMultiEscapeKey } from "../hooks/useEscapeKey";
import { DateInput } from "../components/DateRangeCalendar";
type Form = {
	code: string;
	name: string;
	startDate: string;
	endDate: string;
	customerScope: "ALL" | "GROUP";
	customerGroup: string;
	priority: number;
	note: string;
	conditionPackagingId: number;
	minimumQuantity: number;
	rewardPackagingId: number;
	rewardQuantity: number;
	warehouseId: number;
};
const today = () => new Date().toISOString().slice(0, 10),
	empty = (nextCode = "KM00001"): Form => ({
		code: nextCode,
		name: "",
		startDate: today(),
		endDate: today(),
		customerScope: "ALL",
		customerGroup: "",
		priority: 0,
		note: "",
		conditionPackagingId: 0,
		minimumQuantity: 1,
		rewardPackagingId: 0,
		rewardQuantity: 1,
		warehouseId: 0,
	});
const badge = {
	DRAFT: "bg-slate-100 text-slate-600",
	ACTIVE: "bg-emerald-100 text-emerald-700",
	INACTIVE: "bg-red-100 text-red-700",
};
const statusLabel: Record<string, string> = {
	DRAFT: "Nháp",
	ACTIVE: "Đang áp dụng",
	INACTIVE: "Ngừng áp dụng",
};
export default function Promotions() {
	const qc = useQueryClient(),
		[page, setPage] = useState(1),
		[search, setSearch] = useState(""),
		[status, setStatus] = useState(""),
		[open, setOpen] = useState(false),
		[editing, setEditing] = useState<PromotionProgramV1 | null>(null),
		[form, setForm] = useState<Form>(empty());

	useMultiEscapeKey([
		{ isOpen: open, onClose: () => setOpen(false), priority: 1 },
		{ isOpen: !!editing, onClose: () => setEditing(null), priority: 2 },
	]);
	const nextPromotionCode = useQuery({
		queryKey: ["next-code-promotion"],
		queryFn: async () => {
			const response = await apiV1<{ code: string }>(
				"/api/v1/next-code/promotion",
			);
			return response.data?.code || "KM00001";
		},
	});
	const refs = useQuery({
			queryKey: ["promotion-refs"],
			queryFn: async () => {
				const [products, warehouses] = await Promise.all([
					legacyApi<Product[]>("/api/products"),
					legacyApi<Warehouse[]>("/api/warehouses"),
				]);
				return { products, warehouses };
			},
		}),
		documents = useQuery({
			queryKey: ["promotions-v1", page, search, status],
			queryFn: () =>
				apiV1<PromotionProgramV1[]>(
					`/api/v1/promotions?page=${page}&limit=20&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}`,
				),
		});
	const options = useMemo(
		() =>
			refs.data?.products.flatMap(p =>
				p.packagings.map(x => ({ ...x, productName: p.name })),
			) || [],
		[refs.data],
	);
	const productSearchOptions = useMemo(
		() =>
			options.map(x => ({
				value: x.id,
				label: x.productName,
				subLabel:
					x.name !== x.productName
						? `${x.name}${x.sku ? ` | SKU: ${x.sku}` : ""}`
						: x.sku
							? `SKU: ${x.sku}`
							: undefined,
			})),
		[options],
	);
	const payload = () => ({
		code: form.code,
		name: form.name,
		startDate: form.startDate,
		endDate: form.endDate,
		customerScope: form.customerScope,
		customerGroup: form.customerGroup,
		priority: form.priority,
		note: form.note,
		condition: {
			packagingId: form.conditionPackagingId,
			minimumQuantity: form.minimumQuantity,
		},
		reward: {
			packagingId: form.rewardPackagingId,
			rewardQuantity: form.rewardQuantity,
			...(form.warehouseId ? { warehouseId: form.warehouseId } : {}),
		},
	});
	const save = useMutation({
			mutationFn: () => {
				if (!form.conditionPackagingId || !form.rewardPackagingId)
					throw Error("Chọn hàng điều kiện và hàng tặng");
				return editing
					? apiV1<PromotionProgramV1>(`/api/v1/promotions/${editing.id}`, {
							method: "PUT",
							body: JSON.stringify({ ...payload(), version: editing.version }),
						})
					: apiV1<PromotionProgramV1>("/api/v1/promotions", {
							method: "POST",
							body: JSON.stringify(payload()),
						});
			},
			onSuccess: r => {
				toast.success(r.message);
				setOpen(false);
				void qc.invalidateQueries({ queryKey: ["promotions-v1"] });
				void qc.invalidateQueries({ queryKey: ["next-code-promotion"] });
			},
			onError: (e: Error) => toast.error(e.message),
		}),
		action = useMutation({
			mutationFn: ({
				row,
				next,
			}: {
				row: PromotionProgramV1;
				next: "activate" | "deactivate";
			}) =>
				apiV1<PromotionProgramV1>(`/api/v1/promotions/${row.id}/${next}`, {
					method: "POST",
					body: JSON.stringify({ version: row.version }),
				}),
			onSuccess: r => {
				toast.success(r.message);
				void qc.invalidateQueries({ queryKey: ["promotions-v1"] });
				void qc.invalidateQueries({ queryKey: ["next-code-promotion"] });
			},
			onError: (e: Error) => toast.error(e.message),
		}),
		remove = useMutation({
			mutationFn: (row: PromotionProgramV1) =>
				apiV1(`/api/v1/promotions/${row.id}`, {
					method: "DELETE",
				}),
			onSuccess: r => {
				toast.success(r.message);
				void qc.invalidateQueries({ queryKey: ["promotions-v1"] });
			},
			onError: (e: Error) => toast.error(e.message),
		});
	const create = async () => {
			setEditing(null);
			const latest = await nextPromotionCode.refetch();
			setForm(empty(latest.data || "KM00001"));
			setOpen(true);
		},
		edit = (x: PromotionProgramV1) => {
			setEditing(x);
			setForm({
				code: x.code,
				name: x.name,
				startDate: x.startDate,
				endDate: x.endDate,
				customerScope: x.customerScope,
				customerGroup: x.customerGroup || "",
				priority: x.priority,
				note: x.note || "",
				conditionPackagingId: x.condition.packagingId,
				minimumQuantity: x.condition.minimumQuantity,
				rewardPackagingId: x.reward.packagingId,
				rewardQuantity: x.reward.rewardQuantity,
				warehouseId: x.reward.warehouseId || 0,
			});
			setOpen(true);
		};
	const rows = documents.data?.data || [],
		meta = documents.data?.meta as any;
	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Khuyến mãi</h1>
					<p>
						Quản lý, áp dụng các chương trình khuyến mãi cho khách hàng. Chương
						trình chỉ tác động đơn bán lập trong thời gian hiệu lực.
					</p>
				</div>
				<button className="erp-btn erp-btn-primary" onClick={create}>
					<Plus size={16} /> Thêm chương trình
				</button>
			</div>
			<div className="grid gap-4 md:grid-cols-3">
				<div className="erp-stat">
					<Gift />
					<div>
						<span>Tổng chương trình</span>
						<strong>{meta?.total || 0}</strong>
					</div>
				</div>
				<div className="erp-stat">
					<CheckCircle2 />
					<div>
						<span>Đang áp dụng</span>
						<strong>{rows.filter(x => x.status === "ACTIVE").length}</strong>
					</div>
				</div>
				<div className="erp-stat">
					<Undo2 />
					<div>
						<span>Ngừng áp dụng</span>
						<strong>{rows.filter(x => x.status === "INACTIVE").length}</strong>
					</div>
				</div>
			</div>
			<div className="erp-card overflow-hidden">
				<div className="erp-toolbar">
					<div className="erp-search">
						<Search size={16} />
						<input
							value={search}
							onChange={e => {
								setSearch(e.target.value);
								setPage(1);
							}}
							placeholder="Tìm mã, tên chương trình..."
						/>
					</div>
					<select
						value={status}
						onChange={e => {
							setStatus(e.target.value);
							setPage(1);
						}}
					>
						<option value="">Mọi trạng thái</option>
						<option value="DRAFT">Nháp</option>
						<option value="ACTIVE">Đang áp dụng</option>
						<option value="INACTIVE">Ngừng áp dụng</option>
					</select>
				</div>
				{documents.isLoading ? (
					<div className="p-12 text-center">Đang tải...</div>
				) : documents.isError ? (
					<div className="p-12 text-center text-red-600">
						{(documents.error as Error).message}
					</div>
				) : !rows.length ? (
					<div className="erp-empty">
						<PackagePlus size={48} />
						<p>Chưa có chương trình khuyến mãi nào</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead>
								<tr>
									<th>Chương trình</th>
									<th>Hiệu lực</th>
									<th>Điều kiện</th>
									<th>Hàng tặng</th>
									<th>Ưu tiên</th>
									<th>Trạng thái</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{rows.map(x => (
									<tr key={x.id}>
										<td>
											<b>{x.code}</b>
											<small>{x.name}</small>
										</td>
										<td>
											{formatDate(x.startDate)}
											<small>đến {formatDate(x.endDate)}</small>
										</td>
										<td>
											{x.condition.productName}
											<small>
												Mua mỗi {formatNumber(x.condition.minimumQuantity)}{" "}
												{x.condition.unit}
											</small>
										</td>
										<td>
											{x.reward.productName}
											<small>
												Tặng {formatNumber(x.reward.rewardQuantity)}{" "}
												{x.reward.unit}
												{x.reward.warehouseName
													? ` · ${x.reward.warehouseName}`
													: ""}
											</small>
										</td>
										<td>{x.priority}</td>
										<td>
											<span className={`erp-badge ${badge[x.status]}`}>
												{statusLabel[x.status] || x.status}
											</span>
										</td>
										<td>
											<div className="flex gap-1">
												<button
													className="erp-icon-btn"
													disabled={x.status !== "DRAFT"}
													onClick={() => edit(x)}
												>
													<Edit size={15} />
												</button>
												{x.status !== "ACTIVE" ? (
													<button
														className="erp-icon-btn text-emerald-600"
														onClick={() =>
															action.mutate({ row: x, next: "activate" })
														}
													>
														<CheckCircle2 size={16} />
													</button>
												) : (
													<button
														className="erp-icon-btn text-red-600"
														onClick={() =>
															action.mutate({ row: x, next: "deactivate" })
														}
													>
														<Undo2 size={16} />
													</button>
												)}
												{x.status === "INACTIVE" && (
													<button
														className="erp-icon-btn text-red-600"
														title="Xóa chương trình"
														disabled={remove.isPending}
														onClick={async () => {
															if (
																await confirm(
																	`Xóa chương trình ${x.code}? Chương trình đã xóa sẽ không hiển thị trong danh sách.`,
																)
															)
																remove.mutate(x);
														}}
													>
														<Trash2 size={15} />
													</button>
												)}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				{meta?.totalPages > 1 && (
					<div className="erp-pagination">
						<button
							className="erp-btn"
							disabled={page <= 1}
							onClick={() => setPage(x => x - 1)}
						>
							Trước
						</button>
						<span>
							Trang {page}/{meta.totalPages}
						</span>
						<button
							className="erp-btn"
							disabled={page >= meta.totalPages}
							onClick={() => setPage(x => x + 1)}
						>
							Sau
						</button>
					</div>
				)}
			</div>
			{open && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-4xl">
						<div className="erp-modal-header">
							<div>
								<h2>{editing ? `Sửa ${editing.code}` : "Thêm chương trình"}</h2>
								<p>
									Chương trình chỉ tác động đơn bán lập trong thời gian hiệu
									lực.
								</p>
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
								<div className="grid gap-4 md:grid-cols-4">
									<label>
										Mã (KM00001, nhập tay khi cần)
										<input
											maxLength={20}
											value={form.code}
											placeholder={nextPromotionCode.data || "KM00001"}
											onChange={e =>
												setForm({ ...form, code: e.target.value.toUpperCase() })
											}
										/>
									</label>
									<label className="md:col-span-2">
										Tên
										<input
											required
											value={form.name}
											onChange={e => setForm({ ...form, name: e.target.value })}
										/>
									</label>
									<label>
										Ưu tiên
										<input
											type="number"
											min={0}
											value={form.priority}
											onChange={e =>
												setForm({ ...form, priority: +e.target.value })
											}
										/>
									</label>
									<label>
										Từ ngày
										<DateInput
											value={form.startDate}
											onChange={value => setForm({ ...form, startDate: value })}
										/>
									</label>
									<label>
										Đến ngày
										<DateInput
											value={form.endDate}
											onChange={value => setForm({ ...form, endDate: value })}
										/>
									</label>
									<label>
										Phạm vi
										<select
											value={form.customerScope}
											onChange={e =>
												setForm({
													...form,
													customerScope: e.target
														.value as Form["customerScope"],
												})
											}
										>
											<option value="ALL">Mọi khách hàng</option>
											<option value="GROUP">Nhóm khách hàng</option>
										</select>
									</label>
									{form.customerScope === "GROUP" && (
										<label>
											Nhóm
											<input
												required
												value={form.customerGroup}
												onChange={e =>
													setForm({ ...form, customerGroup: e.target.value })
												}
											/>
										</label>
									)}
								</div>
								<div className="grid gap-4 rounded border p-4 md:grid-cols-2">
									<label>
										Hàng hóa điều kiện
										<SearchableSelect
											required
											value={form.conditionPackagingId}
											options={productSearchOptions}
											onChange={conditionPackagingId =>
												setForm({ ...form, conditionPackagingId })
											}
											placeholder="Nhập tên/SKU để chọn hàng hóa"
										/>
									</label>
									<label>
										Số lượng tối thiểu
										<input
											type="number"
											step="any"
											min="0.0001"
											required
											value={form.minimumQuantity}
											onChange={e =>
												setForm({ ...form, minimumQuantity: +e.target.value })
											}
										/>
									</label>
									<label>
										Hàng tặng
										<SearchableSelect
											required
											value={form.rewardPackagingId}
											options={productSearchOptions}
											onChange={rewardPackagingId =>
												setForm({ ...form, rewardPackagingId })
											}
											placeholder="Nhập tên/SKU để chọn hàng tặng"
										/>
									</label>
									<label>
										Số lượng tặng mỗi bậc
										<input
											type="number"
											step="any"
											min="0.0001"
											required
											value={form.rewardQuantity}
											onChange={e =>
												setForm({ ...form, rewardQuantity: +e.target.value })
											}
										/>
									</label>
									<label>
										Kho hàng tặng
										<select
											value={form.warehouseId}
											onChange={e =>
												setForm({ ...form, warehouseId: +e.target.value })
											}
										>
											<option value={0}>Theo kho đơn bán</option>
											{refs.data?.warehouses.map(x => (
												<option value={x.id} key={x.id}>
													{x.name}
												</option>
											))}
										</select>
									</label>
								</div>
								<label>
									Ghi chú
									<textarea
										value={form.note}
										onChange={e => setForm({ ...form, note: e.target.value })}
									/>
								</label>
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
									className="erp-btn erp-btn-primary"
									disabled={save.isPending}
								>
									{save.isPending ? "Đang lưu..." : "Lưu nháp"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

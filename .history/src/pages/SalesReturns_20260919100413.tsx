import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2,
	Edit,
	Plus,
	Printer,
	Search,
	Undo2,
	X,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiV1, legacyApi } from "../lib/apiV1";
import { formatDate, formatNumber } from "../lib/utils";
import PrintPreview from "../components/PrintPreview";
import {
	fillGenericDocument,
	GENERIC_LAYOUTS,
	type CompanyPrintProfile,
} from "../lib/printTemplate";
import type { SalesOrder, SalesReturnV1, Warehouse } from "../types";
import { useMultiEscapeKey } from "../hooks/useEscapeKey";

const today = () => new Date().toISOString().slice(0, 10);
const badge = {
	DRAFT: "bg-slate-100 text-slate-600",
	POSTED: "bg-emerald-100 text-emerald-700",
	CANCELLED: "bg-red-100 text-red-700",
};
type ReturnLineInput = {
	originalSalesOrderLineId: number;
	quantity: number;
	note: string;
};

export default function SalesReturns() {
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1),
		[search, setSearch] = useState(""),
		[status, setStatus] = useState("");
	const [open, setOpen] = useState(false),
		[editing, setEditing] = useState<SalesReturnV1 | null>(null),
		[selected, setSelected] = useState<SalesReturnV1 | null>(null);
	const [printTarget, setPrintTarget] = useState<SalesReturnV1 | null>(null);
	const [orderId, setOrderId] = useState(0),
		[warehouseId, setWarehouseId] = useState(0),
		[returnDate, setReturnDate] = useState(today()),
		[reason, setReason] = useState("");
	const [lines, setLines] = useState<ReturnLineInput[]>([]);

	useMultiEscapeKey([
		{ isOpen: open, onClose: () => setOpen(false), priority: 1 },
		{ isOpen: !!editing, onClose: () => setEditing(null), priority: 2 },
		{ isOpen: !!selected, onClose: () => setSelected(null), priority: 3 },
		{ isOpen: !!printTarget, onClose: () => setPrintTarget(null), priority: 4 },
	]);

	const references = useQuery({
		queryKey: ["return-refs"],
		queryFn: async () => {
			const [warehouses, orders] = await Promise.all([
				legacyApi<Warehouse[]>("/api/warehouses"),
				apiV1<SalesOrder[]>(
					"/api/v1/sales-documents?page=1&limit=100&status=POSTED",
				),
			]);
			return { warehouses, orders: orders.data };
		},
	});
	const documents = useQuery({
		queryKey: ["sales-returns", page, search, status],
		queryFn: () =>
			apiV1<SalesReturnV1[]>(
				`/api/v1/sales-returns?page=${page}&limit=20&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}`,
			),
	});
	const postedReturns = useQuery({
		queryKey: ["sales-return-posted-by-order", orderId],
		enabled: orderId > 0,
		queryFn: () =>
			apiV1<SalesReturnV1[]>(
				`/api/v1/sales-returns?page=1&limit=100&status=POSTED&originalSalesOrderId=${orderId}`,
			),
	});
	const returnedByLine = useMemo(() => {
		const totals = new Map<number, number>();
		for (const document of postedReturns.data?.data || [])
			for (const line of document.lines) {
				totals.set(
					line.originalSalesOrderLineId,
					(totals.get(line.originalSalesOrderLineId) || 0) + line.quantity,
				);
			}
		return totals;
	}, [postedReturns.data]);
	const order = useMemo(
		() => references.data?.orders.find(row => row.id === orderId),
		[references.data, orderId],
	);

	const chooseOrder = (id: number) => {
		setOrderId(id);
		const next = references.data?.orders.find(order => order.id === id);
		setLines(
			next?.details.map(line => ({
				originalSalesOrderLineId: line.id!,
				quantity: 0,
				note: "",
			})) || [],
		);
	};
	const payload = () => ({
		originalSalesOrderId: orderId,
		warehouseId,
		returnDate,
		reason,
		settlementType: "REDUCE_DEBT",
		lines: lines.filter(line => line.quantity > 0),
	});
	const save = useMutation({
		mutationFn: () => {
			if (
				!orderId ||
				!warehouseId ||
				reason.trim().length < 3 ||
				!lines.some(line => line.quantity > 0)
			)
				throw new Error("Chọn đơn, kho, lý do và số lượng trả");
			return editing
				? apiV1<SalesReturnV1>(`/api/v1/sales-returns/${editing.id}`, {
						method: "PUT",
						body: JSON.stringify({ ...payload(), version: editing.version }),
					})
				: apiV1<SalesReturnV1>("/api/v1/sales-returns", {
						method: "POST",
						body: JSON.stringify(payload()),
					});
		},
		onSuccess: response => {
			toast.success(response.message);
			setOpen(false);
			void queryClient.invalidateQueries({ queryKey: ["sales-returns"] });
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const action = useMutation({
		mutationFn: ({
			document,
			action,
			reason,
		}: {
			document: SalesReturnV1;
			action: "post" | "cancel";
			reason?: string;
		}) =>
			apiV1<SalesReturnV1>(`/api/v1/sales-returns/${document.id}/${action}`, {
				method: "POST",
				body: JSON.stringify({
					version: document.version,
					...(reason ? { reason } : {}),
				}),
			}),
		onSuccess: response => {
			toast.success(response.message);
			setSelected(response.data);
			void Promise.all([
				queryClient.invalidateQueries({ queryKey: ["sales-returns"] }),
				queryClient.invalidateQueries({
					queryKey: ["sales-return-posted-by-order"],
				}),
				queryClient.invalidateQueries({ queryKey: ["sales-documents-v1"] }),
			]);
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const create = () => {
		setEditing(null);
		setOrderId(0);
		setWarehouseId(references.data?.warehouses[0]?.id || 0);
		setReturnDate(today());
		setReason("");
		setLines([]);
		setOpen(true);
	};
	const edit = (document: SalesReturnV1) => {
		setEditing(document);
		setOrderId(document.originalSalesOrderId);
		setWarehouseId(document.warehouseId);
		setReturnDate(document.returnDate);
		setReason(document.reason);
		setLines(
			document.lines.map(line => ({
				originalSalesOrderLineId: line.originalSalesOrderLineId,
				quantity: line.quantity,
				note: line.note || "",
			})),
		);
		setOpen(true);
	};
	const rows = documents.data?.data || [],
		meta = documents.data?.meta as any;

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Trả hàng bán</h1>
					<p>
						Đối soát chứng từ bán hàng với khách hàng, lập phiếu trả hàng để
						giảm công nợ và nhập lại
					</p>
				</div>
				<button className="erp-btn erp-btn-primary" onClick={create}>
					<Plus size={16} /> Lập phiếu trả
				</button>
			</div>
			<div className="erp-card overflow-hidden">
				<div className="erp-toolbar">
					<div className="erp-search">
						<Search size={16} />
						<input
							value={search}
							onChange={event => {
								setSearch(event.target.value);
								setPage(1);
							}}
							placeholder="Tìm phiếu trả, đơn gốc, khách hàng..."
						/>
					</div>
					<select
						value={status}
						onChange={event => setStatus(event.target.value)}
					>
						<option value="">Mọi trạng thái</option>
						<option value="DRAFT">Nháp</option>
						<option value="POSTED">Đã ghi sổ</option>
						<option value="CANCELLED">Đã hủy</option>
					</select>
				</div>
				{documents.isLoading ? (
					<div className="p-12 text-center">Đang tải...</div>
				) : documents.isError ? (
					<div className="p-12 text-center text-red-600">
						{(documents.error as Error).message}
					</div>
				) : !rows.length ? (
					<div className="p-12 text-center text-slate-400">
						Chưa có phiếu trả hàng.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead>
								<tr>
									<th>Phiếu / Ngày</th>
									<th>Đơn gốc / Khách hàng</th>
									<th>Kho nhận</th>
									<th>Giảm công nợ</th>
									<th>Giá vốn nhập</th>
									<th>Trạng thái</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{rows.map(document => (
									<tr key={document.id}>
										<td>
											<button
												className="font-bold text-indigo-700"
												onClick={() => setSelected(document)}
											>
												{document.code}
											</button>
											<small>
												{formatDate(document.returnDate)} · v{document.version}
											</small>
										</td>
										<td>
											{document.originalSalesOrderCode}
											<small>{document.customerName}</small>
										</td>
										<td>{document.warehouseName}</td>
										<td>{formatNumber(document.totalAmount)} ₫</td>
										<td>{formatNumber(document.costAmount)} ₫</td>
										<td>
											<span className={`erp-badge ${badge[document.status]}`}>
												{document.status}
											</span>
										</td>
										<td>
											<div className="flex gap-1">
												<button
													className="erp-icon-btn"
													disabled={document.status !== "DRAFT"}
													onClick={() => edit(document)}
												>
													<Edit size={15} />
												</button>
												<button
													className="erp-icon-btn text-emerald-600"
													disabled={document.status !== "DRAFT"}
													onClick={() =>
														action.mutate({ document, action: "post" })
													}
												>
													<CheckCircle2 size={16} />
												</button>
												<button
													className="erp-icon-btn text-red-600"
													disabled={document.status !== "POSTED"}
													onClick={() => {
														const cancellationReason = prompt(
															"Lý do hủy phiếu trả:",
														);
														if (cancellationReason)
															action.mutate({
																document,
																action: "cancel",
																reason: cancellationReason,
															});
													}}
												>
													<Undo2 size={16} />
												</button>
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
							onClick={() => setPage(value => value - 1)}
						>
							Trước
						</button>
						<span>
							Trang {page}/{meta.totalPages}
						</span>
						<button
							className="erp-btn"
							disabled={page >= meta.totalPages}
							onClick={() => setPage(value => value + 1)}
						>
							Sau
						</button>
					</div>
				)}
			</div>
			{open && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-5xl">
						<div className="erp-modal-header">
							<div>
								<h2>
									{editing ? `Sửa ${editing.code}` : "Lập phiếu trả hàng"}
								</h2>
								<p>Chỉ phiếu đã ghi sổ mới tác động tồn và công nợ.</p>
							</div>
							<button onClick={() => setOpen(false)}>
								<X />
							</button>
						</div>
						<form
							onSubmit={event => {
								event.preventDefault();
								save.mutate();
							}}
						>
							<div className="erp-modal-body space-y-5">
								<div className="grid gap-4 md:grid-cols-4">
									<label>
										Đơn bán gốc
										<select
											disabled={Boolean(editing)}
											value={orderId}
											onChange={event => chooseOrder(+event.target.value)}
										>
											<option value={0}>Chọn đơn đã ghi sổ</option>
											{references.data?.orders.map(order => (
												<option key={order.id} value={order.id}>
													{order.code} - {order.customerName}
												</option>
											))}
										</select>
									</label>
									<label>
										Ngày trả
										<input
											type="date"
											value={returnDate}
											onChange={event => setReturnDate(event.target.value)}
										/>
									</label>
									<label>
										Kho nhận
										<select
											value={warehouseId}
											onChange={event => setWarehouseId(+event.target.value)}
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
										Lý do
										<input
											value={reason}
											onChange={event => setReason(event.target.value)}
										/>
									</label>
								</div>
								{order && (
									<div className="overflow-x-auto rounded border">
										<table className="erp-table">
											<thead>
												<tr>
													<th>Hàng hóa</th>
													<th>Loại</th>
													<th>Đã bán</th>
													<th>Đã trả</th>
													<th>Còn trả</th>
													<th>SL trả lần này</th>
													<th>Doanh thu dòng</th>
													<th>Giá vốn</th>
												</tr>
											</thead>
											<tbody>
												{order.details.map(line => {
													const input = lines.find(
														row => row.originalSalesOrderLineId === line.id,
													);
													const alreadyReturned =
														returnedByLine.get(line.id!) || 0;
													const returnable = Math.max(
														0,
														line.quantity - alreadyReturned,
													);
													return (
														<tr key={line.id}>
															<td>
																{line.productName} - {line.packagingName}
																<small>{line.sku}</small>
															</td>
															<td>{line.lineType || "SALE"}</td>
															<td>
																{formatNumber(line.quantity)} {line.unit}
															</td>
															<td>
																{formatNumber(alreadyReturned)} {line.unit}
															</td>
															<td className="font-bold text-emerald-700">
																{formatNumber(returnable)} {line.unit}
															</td>
															<td>
																<input
																	className="w-28"
																	type="number"
																	min={0}
																	max={returnable}
																	step="any"
																	value={input?.quantity || 0}
																	onChange={event =>
																		setLines(current =>
																			current.map(row =>
																				row.originalSalesOrderLineId === line.id
																					? {
																							...row,
																							quantity: +event.target.value,
																						}
																					: row,
																			),
																		)
																	}
																/>
															</td>
															<td>{formatNumber(line.lineTotal || 0)} ₫</td>
															<td>{formatNumber(line.costAmount || 0)} ₫</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								)}
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
									disabled={save.isPending || postedReturns.isLoading}
								>
									{save.isPending ? "Đang lưu..." : "Lưu nháp"}
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
									{selected.originalSalesOrderCode} · {selected.customerName}
								</p>
							</div>
							<button onClick={() => setSelected(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<span className={`erp-badge ${badge[selected.status]}`}>
								{selected.status}
							</span>
							<table className="erp-table">
								<thead>
									<tr>
										<th>Hàng hóa</th>
										<th>SL trả</th>
										<th>Giảm doanh thu + thuế</th>
										<th>Giá vốn nhập lại</th>
									</tr>
								</thead>
								<tbody>
									{selected.lines.map(line => (
										<tr key={line.id}>
											<td>
												{line.productName} - {line.packagingName}
												<small>{line.lineType}</small>
											</td>
											<td>
												{formatNumber(line.quantity)} {line.unit}
											</td>
											<td>{formatNumber(line.lineTotal + line.taxAmount)} ₫</td>
											<td>{formatNumber(line.costAmount)} ₫</td>
										</tr>
									))}
								</tbody>
							</table>
							{selected.links.length > 0 && (
								<div className="rounded bg-slate-50 p-3">
									{selected.links.map(link => (
										<span
											className="erp-badge bg-blue-100 text-blue-700"
											key={link.id}
										>
											{link.linkType}: {link.linkedCode}
										</span>
									))}
								</div>
							)}
						</div>
						<div className="erp-modal-footer">
							<button
								className="erp-btn"
								onClick={() => setPrintTarget(selected)}
							>
								<Printer size={16} /> In phiếu trả
							</button>
							<button className="erp-btn" onClick={() => setSelected(null)}>
								Đóng
							</button>
						</div>
					</div>
				</div>
			)}
			<PrintPreview
				open={!!printTarget}
				title={
					printTarget
						? `Xem trước phiếu trả hàng ${printTarget.code}`
						: "Xem trước in"
				}
				templateUrl="/template_xlsx/Phieu-tra-hang.xlsx"
				fill={
					printTarget
						? (worksheet: any, company: any) => {
								fillGenericDocument(
									worksheet,
									company as CompanyPrintProfile | null,
									GENERIC_LAYOUTS.salesReturn,
									{
										code: printTarget.code,
										documentDate: printTarget.returnDate,
										partner: printTarget.customerName || "",
										dienGiai: printTarget.reason || "",
										total: Number(printTarget.totalAmount || 0),
										rows: printTarget.lines.map((line, index) => ({
											stt: index + 1,
											sku: line.sku || "",
											name: [line.productName, line.packagingName]
												.filter(Boolean)
												.join(" - "),
											unit: line.unit || "",
											quantity: Number(line.quantity || 0),
											unitPrice: Number(line.unitPrice || 0),
											amount:
												Number(line.lineTotal || 0) +
												Number(line.taxAmount || 0),
										})),
									},
								);
							}
						: null
				}
				onClose={() => setPrintTarget(null)}
			/>
		</div>
	);
}

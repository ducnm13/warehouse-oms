import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
	History,
	Search,
	RotateCcw,
	Calendar,
	Monitor,
	Globe,
	X,
	ChevronLeft,
	ChevronRight,
	Eye,
	FileText,
} from "lucide-react";
import { apiV1, legacyApi } from "../lib/apiV1";
import { DateInput } from "../components/DateRangeCalendar";

interface AuditLog {
	id: number;
	action: string;
	details: string | null;
	userId: number | null;
	userName: string | null;
	username?: string | null;
	role?: string | null;
	ipAddress?: string | null;
	userAgent?: string | null;
	createdAt: string;
}

interface UserRow {
	id: number;
	username: string;
	fullName?: string | null;
	role?: string | null;
	roles?: string[];
}

const ROLE_LABELS: Record<string, string> = {
	ADMIN: "Quản trị viên",
	W_MANAGER: "Thủ kho",
	P_MANAGER: "Quản lý sản xuất",
	S_SALES: "Kinh doanh",
	O_SALES: "Bán hàng online",
	QD: "Quản lý",
};

const formatDateTime = (iso: string) => {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return { date: iso, time: "" };
	return {
		date: date.toLocaleDateString("vi-VN", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		}),
		time: date.toLocaleTimeString("vi-VN", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		}),
	};
};

const parseDevice = (ua?: string | null) => {
	if (!ua) return "—";
	const browser = /Edg\//.test(ua)
		? "Edge"
		: /OPR\/|Opera/.test(ua)
			? "Opera"
			: /Chrome\//.test(ua)
				? "Chrome"
				: /Firefox\//.test(ua)
					? "Firefox"
					: /Safari\//.test(ua)
						? "Safari"
						: "Khác";
	const os = /Windows NT/.test(ua)
		? "Windows"
		: /Android/.test(ua)
			? "Android"
			: /iPhone|iPad|iPod/.test(ua)
				? "iOS"
				: /Mac OS X/.test(ua)
					? "macOS"
					: /Linux/.test(ua)
						? "Linux"
						: "";
	return os ? `${browser} · ${os}` : browser;
};

const AuditLogs = () => {
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [actionFilter, setActionFilter] = useState("");
	const [userFilter, setUserFilter] = useState("");
	const [fromDate, setFromDate] = useState("");
	const [toDate, setToDate] = useState("");
	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(50);
	const [detail, setDetail] = useState<AuditLog | null>(null);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearch(search), 350);
		return () => clearTimeout(timer);
	}, [search]);

	useEffect(() => {
		setPage(1);
	}, [debouncedSearch, actionFilter, userFilter, fromDate, toDate, limit]);

	const filtersQuery = useQuery({
		queryKey: ["audit-logs-filters"],
		queryFn: () => apiV1<{ actions: string[] }>("/api/audit-logs/filters"),
		staleTime: 5 * 60_000,
	});

	const usersQuery = useQuery({
		queryKey: ["audit-logs-users"],
		queryFn: () => legacyApi<UserRow[]>("/api/users"),
		staleTime: 5 * 60_000,
	});

	const queryString = useMemo(() => {
		const params = new URLSearchParams({ page: String(page), limit: String(limit) });
		if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
		if (actionFilter) params.set("action", actionFilter);
		if (userFilter) params.set("userId", userFilter);
		if (fromDate) params.set("from", fromDate);
		if (toDate) params.set("to", toDate);
		return params.toString();
	}, [page, limit, debouncedSearch, actionFilter, userFilter, fromDate, toDate]);

	const logsQuery = useQuery({
		queryKey: ["audit-logs", queryString],
		queryFn: () => apiV1<AuditLog[]>(`/api/audit-logs?${queryString}`),
		placeholderData: keepPreviousData,
	});

	const logs = logsQuery.data?.data || [];
	const meta = logsQuery.data?.meta as
		| { total: number; page: number; limit: number; totalPages: number }
		| undefined;
	const total = meta?.total ?? logs.length;
	const totalPages = meta?.totalPages ?? 1;

	const hasFilter =
		!!search || !!actionFilter || !!userFilter || !!fromDate || !!toDate;

	const resetFilters = () => {
		setSearch("");
		setActionFilter("");
		setUserFilter("");
		setFromDate("");
		setToDate("");
		setLimit(50);
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="text-2xl font-black uppercase tracking-tight text-gray-800">
						NHẬT KÝ HOẠT ĐỘNG
					</h2>
					<p className="mt-1 text-xs font-bold uppercase tracking-widest text-gray-400">
						Ai thao tác · thao tác gì · thời gian và thiết bị
					</p>
				</div>
				<div className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5">
					<History size={16} className="text-indigo-500" />
					<span className="text-xs font-bold uppercase tracking-widest text-slate-500">
						Tổng{" "}
						<b className="text-slate-800">{total.toLocaleString("vi-VN")}</b>{" "}
						thao tác
					</span>
				</div>
			</div>

			<div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
					<div className="relative xl:col-span-2">
						<span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
							<Search size={16} />
						</span>
						<input
							type="text"
							placeholder="Tìm hành động, chi tiết, nhân viên..."
							className="w-full rounded-xl border bg-white py-2.5 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-200"
							value={search}
							onChange={e => setSearch(e.target.value)}
						/>
					</div>
					<select
						value={actionFilter}
						onChange={e => setActionFilter(e.target.value)}
						className="rounded-xl border bg-white px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-200"
					>
						<option value="">Mọi hành động</option>
						{(filtersQuery.data?.data?.actions || []).map(name => (
							<option key={name} value={name}>
								{name}
							</option>
						))}
					</select>
					<select
						value={userFilter}
						onChange={e => setUserFilter(e.target.value)}
						className="rounded-xl border bg-white px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-200"
					>
						<option value="">Mọi nhân viên</option>
						{(usersQuery.data || []).map(u => (
							<option key={u.id} value={u.id}>
								{u.fullName || u.username}
							</option>
						))}
					</select>
					<div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
						<Calendar size={15} className="shrink-0 text-gray-400" />
						<DateInput value={fromDate} onChange={setFromDate} />
					</div>
					<div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
						<Calendar size={15} className="shrink-0 text-gray-400" />
						<DateInput value={toDate} onChange={setToDate} />
					</div>
				</div>
				{hasFilter && (
					<div className="mt-3 flex justify-end">
						<button
							type="button"
							onClick={resetFilters}
							className="erp-btn"
						>
							<RotateCcw size={14} /> Xóa bộ lọc
						</button>
					</div>
				)}
			</div>

			<div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
				<div className="overflow-x-auto">
					<table className="w-full text-left">
						<thead>
							<tr className="border-b border-slate-100 bg-slate-50">
								{[
									"Thời gian",
									"Hành động",
									"Chi tiết",
									"Nhân viên",
									"IP",
									"Thiết bị",
									"",
								].map((head, index) => (
									<th
										key={index}
										className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400"
									>
										{head}
									</th>
								))}
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-50">
							{logsQuery.isLoading ? (
								<tr>
									<td
										colSpan={7}
										className="animate-pulse px-6 py-12 text-center text-sm font-bold uppercase tracking-widest text-slate-400"
									>
										Đang tải dữ liệu...
									</td>
								</tr>
							) : logsQuery.isError ? (
								<tr>
									<td
										colSpan={7}
										className="px-6 py-12 text-center text-sm font-bold text-red-500"
									>
										Không tải được nhật ký:{" "}
										{(logsQuery.error as Error)?.message}
									</td>
								</tr>
							) : logs.length > 0 ? (
								logs.map(log => {
									const when = formatDateTime(log.createdAt);
									return (
										<tr
											key={log.id}
											className="group cursor-pointer transition-colors hover:bg-slate-50/60"
											onClick={() => setDetail(log)}
										>
											<td className="whitespace-nowrap px-4 py-3">
												<span className="block text-[11px] font-black text-slate-700">
													{when.date}
												</span>
												<span className="block text-[10px] font-bold text-slate-400">
													{when.time}
												</span>
											</td>
											<td className="px-4 py-3">
												<span className="inline-flex items-center rounded-lg border border-indigo-100/60 bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-tight text-indigo-600 shadow-sm">
													{log.action}
												</span>
											</td>
											<td className="px-4 py-3">
												<p className="max-w-md truncate text-xs font-medium text-slate-600">
													{log.details || "—"}
												</p>
											</td>
											<td className="px-4 py-3">
												<div className="flex items-center gap-2">
													<div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-[10px] font-black uppercase text-slate-600">
														{(log.userName || "?").charAt(0)}
													</div>
													<div className="flex flex-col">
														<span className="text-[11px] font-black uppercase tracking-tight text-slate-700">
															{log.userName || "—"}
														</span>
														{log.role && (
															<span className="text-[10px] font-bold text-slate-400">
																{ROLE_LABELS[log.role] || log.role}
															</span>
														)}
													</div>
												</div>
											</td>
											<td className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold text-slate-500">
												{log.ipAddress || "—"}
											</td>
											<td className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold text-slate-500">
												{parseDevice(log.userAgent)}
											</td>
											<td className="px-4 py-3 text-right">
												<Eye
													size={16}
													className="text-slate-300 group-hover:text-indigo-500"
												/>
											</td>
										</tr>
									);
								})
							) : (
								<tr>
									<td colSpan={7} className="px-6 py-24 text-center">
										<History
											className="mx-auto mb-4 text-slate-200"
											size={48}
										/>
										<p className="text-sm font-black uppercase tracking-widest text-slate-400">
											Không có dữ liệu phù hợp
										</p>
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
				<div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 p-4 md:flex-row">
					<div className="flex items-center gap-3">
						<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
							Trang {page}/{totalPages} · {total.toLocaleString("vi-VN")} bản ghi
						</span>
						<select
							value={limit}
							onChange={e => setLimit(Number(e.target.value))}
							className="rounded-lg border bg-white px-2 py-1 text-[11px] font-bold text-slate-600"
						>
							{[20, 50, 100, 200].map(size => (
								<option key={size} value={size}>
									{size}/trang
								</option>
							))}
						</select>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							className="erp-btn"
							disabled={page <= 1 || logsQuery.isFetching}
							onClick={() => setPage(p => Math.max(1, p - 1))}
						>
							<ChevronLeft size={14} /> Trước
						</button>
						<button
							type="button"
							className="erp-btn"
							disabled={page >= totalPages || logsQuery.isFetching}
							onClick={() => setPage(p => Math.min(totalPages, p + 1))}
						>
							Sau <ChevronRight size={14} />
						</button>
					</div>
				</div>
			</div>

			{detail && (
				<div
					className="erp-modal-backdrop"
					onClick={() => setDetail(null)}
				>
					<div
						className="erp-modal max-w-2xl"
						onClick={e => e.stopPropagation()}
					>
						<div className="erp-modal-header">
							<div>
								<h2>Chi tiết thao tác #{detail.id}</h2>
								<p>{detail.action}</p>
							</div>
							<button onClick={() => setDetail(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<div className="flex flex-wrap gap-2">
								<span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100/60 bg-indigo-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-tight text-indigo-600">
									<FileText size={13} /> {detail.action}
								</span>
								<span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600">
									<Calendar size={13} />{" "}
									{formatDateTime(detail.createdAt).date}{" "}
									{formatDateTime(detail.createdAt).time}
								</span>
							</div>
							<div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
								<p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
									Nội dung / chi tiết
								</p>
								<p className="whitespace-pre-wrap break-words text-sm font-medium text-slate-700">
									{detail.details || "—"}
								</p>
							</div>
							<div className="grid gap-3 md:grid-cols-2">
								<div className="rounded-xl border border-slate-100 p-4">
									<p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
										Nhân viên thao tác
									</p>
									<p className="text-sm font-bold text-slate-800">
										{detail.userName || "—"}
									</p>
									<p className="text-xs font-semibold text-slate-500">
										{detail.username ? `@${detail.username}` : ""}
										{detail.role
											? ` · ${ROLE_LABELS[detail.role] || detail.role}`
											: ""}
									</p>
									<p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
										User ID: {detail.userId ?? "—"}
									</p>
								</div>
								<div className="rounded-xl border border-slate-100 p-4">
									<p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
										Thiết bị & kết nối
									</p>
									<p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
										<Monitor size={14} className="text-slate-400" />
										{parseDevice(detail.userAgent)}
									</p>
									<p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
										<Globe size={13} className="text-slate-400" />
										{detail.ipAddress || "—"}
									</p>
								</div>
							</div>
							<div className="rounded-xl border border-slate-100 p-4">
								<p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
									User agent (nguyên văn)
								</p>
								<p className="break-all text-[11px] font-medium text-slate-500">
									{detail.userAgent || "—"}
								</p>
							</div>
						</div>
						<div className="erp-modal-footer">
							<button
								className="erp-btn"
								onClick={() => setDetail(null)}
							>
								Đóng
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AuditLogs;

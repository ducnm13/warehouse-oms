import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
	Menu,
	Bell,
	X,
	History,
	User as UserIcon,
	LogOut,
	ChevronDown,
	HelpCircle,
	Compass,
} from "lucide-react";
import { startGuidedTour } from "./GuidedTour";
import { User as UserType } from "../types";
import { formatDate } from "../lib/utils";
import { hasPermission } from "../lib/permissions";

interface HeaderProps {
	sidebarOpen: boolean;
	setSidebarOpen: (arg: boolean) => void;
	user: UserType | null;
	onLogout: () => void;
}

interface AuditLog {
	id: number;
	action: string;
	details: string;
	userName: string;
	createdAt: string;
}

const LAST_SEEN_LOG_KEY = "notifications-last-seen-id";
const latestLogId = (rows: AuditLog[]) =>
	rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);

const Header = ({
	sidebarOpen,
	setSidebarOpen,
	user,
	onLogout,
}: HeaderProps) => {
	const navigate = useNavigate();
	const [showNotifications, setShowNotifications] = useState(false);
	const [logs, setLogs] = useState<AuditLog[]>([]);
	const [lastSeenLogId, setLastSeenLogId] = useState(() =>
		Number(localStorage.getItem(LAST_SEEN_LOG_KEY) || 0),
	);
	const canViewAuditLogs =
		Boolean(user?.role) &&
		hasPermission(user?.role, user?.permissions, "audit.view");
	const newestLogId = latestLogId(logs);
	const hasUnreadNotifications = newestLogId > lastSeenLogId;

	const fetchLogs = useCallback(async () => {
		try {
			const res = await fetch("/api/audit-logs?limit=10", {
				headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
			});
			if (res.ok) {
				const body = await res.json();
				const rows: AuditLog[] = Array.isArray(body) ? body : body.data || [];
				setLogs(rows);
				return rows;
			}
		} catch (err) {
			console.error("Lỗi khi tải lịch sử thao tác", err);
		}
		return [];
	}, []);

	const markNotificationsRead = useCallback(
		(rows: AuditLog[] = logs) => {
			const newest = latestLogId(rows);
			if (!newest) return;
			localStorage.setItem(LAST_SEEN_LOG_KEY, String(newest));
			setLastSeenLogId(current => Math.max(current, newest));
		},
		[logs],
	);

	useEffect(() => {
		if (!canViewAuditLogs) return;
		void fetchLogs();
		const interval = window.setInterval(() => void fetchLogs(), 60_000);
		const onVisible = () => {
			if (document.visibilityState === "visible") void fetchLogs();
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			window.clearInterval(interval);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, [canViewAuditLogs, fetchLogs]);

	useEffect(() => {
		if (showNotifications) markNotificationsRead();
	}, [showNotifications, newestLogId, markNotificationsRead]);

	const handleToggleNotifications = async () => {
		const next = !showNotifications;
		setShowNotifications(next);
		if (next) {
			const rows = await fetchLogs();
			markNotificationsRead(rows);
		}
	};

	const handleSeeAllLogs = () => {
		markNotificationsRead();
		navigate("/audit-logs");
		setShowNotifications(false);
	};

	// State để quản lý việc đóng/mở dropdown
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Xử lý sự kiện click ra ngoài để tự động đóng menu
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsDropdownOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	return (
		<header
			data-tour="header"
			className="sticky top-0 z-40 flex h-[60px] w-full border-b border-[#e9edf7] bg-white/90 backdrop-blur"
		>
			<div className="flex flex-grow items-center justify-between px-4 md:px-6">
				<div className="flex items-center gap-2 sm:gap-4 lg:hidden">
					<button
						aria-controls="sidebar"
						onClick={e => {
							e.stopPropagation();
							setSidebarOpen(!sidebarOpen);
						}}
						className="z-50 block rounded-md border border-slate-200 bg-white p-1.5 shadow-sm lg:hidden"
					>
						<Menu size={20} />
					</button>
				</div>

				<div className="hidden sm:block">
					<p className="text-sm font-bold text-[#1b2559]">
						CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI DỊCH VỤ CHALLENGE
					</p>
					<p className="text-[11px] text-[#a3aed0]">
						Phần mềm quản trị và vận hành doanh nghiệp nội bộ
					</p>
				</div>

				<div className="flex items-center gap-4">
					<ul className="flex items-center gap-2">
						<li>
							<button
								type="button"
								onClick={startGuidedTour}
								title="Bắt đầu tour hướng dẫn"
								className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent bg-[#f4f7fe] text-[#707eae] transition-all hover:bg-[#e9e3ff] hover:text-primary active:scale-95"
							>
								<Compass size={20} />
							</button>
						</li>
						<li>
							<button
								type="button"
								data-tour="help"
								onClick={() =>
									window.open("/user-guide", "_blank", "noopener,noreferrer")
								}
								title="Trang hướng dẫn sử dụng"
								className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent bg-[#f4f7fe] text-[#707eae] transition-all hover:bg-[#e9e3ff] hover:text-primary active:scale-95"
							>
								<HelpCircle size={20} />
							</button>
						</li>
						{canViewAuditLogs && (
							<li className="relative">
								<button
									data-tour="notifications"
									onClick={() => void handleToggleNotifications()}
									className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-transparent bg-[#f4f7fe] text-[#707eae] hover:bg-[#e9e3ff] hover:text-primary transition-all active:scale-95"
								>
									<Bell size={20} />
									{hasUnreadNotifications && (
										<span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white shadow-sm"></span>
									)}
								</button>

								{showNotifications && (
									<>
										<div
											className="fixed inset-0 z-10"
											onClick={() => setShowNotifications(false)}
										></div>
										<div className="absolute right-[-30px] mt-3 w-[350px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-20 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
											<div className="p-5 border-b flex items-center justify-between bg-slate-50/50">
												<div>
													<h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
														NHẬT KÝ HOẠT ĐỘNG
													</h3>
													<p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
														Theo dõi thao tác hệ thống
													</p>
												</div>
												<button
													onClick={() => setShowNotifications(false)}
													className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
												>
													<X size={16} className="text-slate-500" />
												</button>
											</div>

											<div className="max-h-[500px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
												{logs.length > 0 ? (
													logs.map(log => (
														<div
															key={log.id}
															className="p-3 rounded-xl hover:bg-slate-50 transition-colors flex items-start gap-4 group"
														>
															<div className="h-10 w-10 shrink-0 rounded-xl bg-[#e9e3ff] flex items-center justify-center text-[#422afb] group-hover:bg-[#d0dcfb] transition-colors shadow-sm border border-[#d0dcfb]">
																<History size={18} />
															</div>
															<div className="flex-1 space-y-1">
																<div className="flex items-center justify-between">
																	<p className="text-xs font-black text-slate-800 uppercase tracking-tighter">
																		{log.action}
																	</p>
																	<span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
																		{formatDate(log.createdAt)}
																	</span>
																</div>
																<p className="text-[11px] text-slate-500 font-medium leading-relaxed">
																	{log.details}
																</p>
																<div className="flex items-center gap-1.5 pt-1">
																	<div className="h-4 w-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-black uppercase text-slate-600">
																		{log.userName?.charAt(0)}
																	</div>
																	<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
																		{log.userName}
																	</span>
																</div>
															</div>
														</div>
													))
												) : (
													<div className="py-12 text-center">
														<History
															className="mx-auto text-slate-200 mb-3"
															size={48}
														/>
														<p className="text-sm font-black text-slate-300 uppercase tracking-widest">
															Chưa có hoạt động nào
														</p>
													</div>
												)}
											</div>

											<div className="p-3 border-t bg-slate-50/50 text-center">
												<button
													onClick={handleSeeAllLogs}
													className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline decoration-2 underline-offset-4"
												>
													Xem toàn bộ lịch sử
												</button>
											</div>
										</div>
									</>
								)}
							</li>
						)}
					</ul>

					{/* KHU VỰC AVATAR CÓ DROPDOWN */}
					<div className="relative" ref={dropdownRef} data-tour="account">
						<div
							onClick={() => setIsDropdownOpen(!isDropdownOpen)}
							className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded-2xl transition-all duration-200 select-none group"
						>
							<div className="hidden text-right lg:block">
								<span className="block text-sm font-bold text-[#1b2559] uppercase tracking-tight group-hover:text-primary transition-colors">
									{user?.fullName}
								</span>
								<span className="block text-[10px] font-bold text-[#a3aed0] uppercase tracking-widest">
									{user?.roleName || user?.role}
								</span>
							</div>

							<div className="flex items-center gap-2">
								<div className="w-10 h-10 rounded-xl bg-[#e9e3ff] border-2 border-white shadow-sm flex items-center justify-center text-[#422afb] font-black text-lg ring-1 ring-[#eef2fb] group-hover:scale-105 transition-transform overflow-hidden">
									{user?.avatarUrl ? (
										<img
											src={user.avatarUrl}
											alt="Ảnh đại diện"
											className="h-full w-full object-cover"
										/>
									) : (
										user?.fullName?.charAt(0).toUpperCase() || "U"
									)}
								</div>
								<ChevronDown
									size={16}
									className={`text-[#a3aed0] transition-transform duration-200 ${
										isDropdownOpen ? "rotate-180" : ""
									}`}
								/>
							</div>
						</div>

						{/* DROPDOWN MENU */}
						{isDropdownOpen && (
							<div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-[14px_17px_40px_4px_rgba(112,144,176,0.16)] border border-[#eef2fb] py-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
								<div className="lg:hidden px-4 py-3 border-b border-[#eef2fb] mb-2">
									<p className="text-sm font-bold text-[#1b2559] uppercase tracking-tight">
										{user?.fullName}
									</p>
									<p className="text-[10px] font-bold text-[#a3aed0] uppercase tracking-widest">
										{user?.roleName || user?.role}
									</p>
								</div>

								<button
									onClick={() => {
										navigate("/profile");
										setIsDropdownOpen(false);
									}}
									className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[#707eae] hover:bg-[#f2efff] hover:text-[#422afb] transition-colors"
								>
									<UserIcon size={16} />
									Hồ sơ cá nhân
								</button>

								<div className="h-px bg-slate-100 my-1 mx-4"></div>

								<button
									onClick={() => {
										setIsDropdownOpen(false);
										onLogout();
									}}
									className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
								>
									<LogOut size={16} />
									Đăng xuất
								</button>
							</div>
						)}
					</div>
				</div>
			</div>
		</header>
	);
};

export default Header;

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
	LayoutDashboard,
	ArrowRightLeft,
	ClipboardList,
	Users,
	LogOut,
	Settings2,
	History,
	Archive,
	ShoppingCart,
	ShoppingBag,
	Building2,
	Landmark,
	Gift,
	PackagePlus,
	DatabaseZap,
	BookOpen,
	Settings,
	Store,
	ChevronDown,
	Package,
	BarChart3,
	Warehouse,
	Factory,
	Tag,
	ShieldCheck,
} from "lucide-react";

interface SidebarProps {
	sidebarOpen: boolean;
	setSidebarOpen: (arg: boolean) => void;
	role?: string;
	permissions?: string[];
	onLogout: () => void;
}

const NavItem = ({
	icon: Icon,
	label,
	path,
	indent = false,
}: {
	icon: React.FC<any>;
	label: string;
	path: string;
	indent?: boolean;
}) => {
	const location = useLocation();
	const navigate = useNavigate();
	const active =
		location.pathname === path || location.pathname.startsWith(path + "/");
	const handleClick = () => {
		navigate(path);
	};
	return (
		<button
			onClick={handleClick}
			className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all duration-150
        ${indent ? "ml-3 pl-2 w-[calc(100%-12px)]" : ""}
        ${
					active
						? "bg-[#465fff]/15 text-[#b2ccff] font-semibold"
						: "text-[#98a2b3] hover:bg-white/[.06] hover:text-white"
				}`}
		>
			<span
				className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${active ? "bg-[#465fff] text-white" : "bg-white/5 text-[#98a2b3] group-hover:text-white"}`}
			>
				<Icon size={indent ? 15 : 17} />
			</span>
			{label}
		</button>
	);
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
	<p className="px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-1 mt-5">
		{children}
	</p>
);

const SubMenu = ({
	icon: Icon,
	label,
	path,
	children,
	defaultOpen = false,
}: {
	icon: React.FC<any>;
	label: string;
	path: string;
	children: React.ReactNode;
	defaultOpen?: boolean;
}) => {
	const location = useLocation();
	const [open, setOpen] = useState(
		defaultOpen || location.pathname.startsWith(path),
	);
	return (
		<div>
			<button
				onClick={() => setOpen(o => !o)}
				className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all duration-150
          ${location.pathname.startsWith(path) ? "text-white" : "text-[#98a2b3] hover:bg-white/[.06] hover:text-white"}`}
			>
				<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-[#98a2b3] transition-colors group-hover:text-white">
					<Icon size={17} />
				</span>
				<span className="flex-1 text-left">{label}</span>
				<ChevronDown
					size={14}
					className={`transition-transform duration-200 opacity-60 ${open ? "rotate-180" : ""}`}
				/>
			</button>
			<div
				className={`overflow-hidden transition-all duration-250 ${open ? "max-h-[1600px] opacity-100" : "max-h-0 opacity-0"}`}
			>
				<div className="mt-0.5 ml-4 pl-3 border-l border-white/10 space-y-0.5 py-1">
					{children}
				</div>
			</div>
		</div>
	);
};

const REPORT_DEFAULT_TAB = "INVENTORY";

const ReportMenuGroup = ({
	children,
	label,
}: {
	children: React.ReactNode;
	label: string;
}) => (
	<div className="mt-1 first:mt-0">
		<p className="px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
			{label}
		</p>
		<div className="space-y-0.5">{children}</div>
	</div>
);

const ReportMenuItem = ({ label, tab }: { label: string; tab: string }) => {
	const location = useLocation();
	const navigate = useNavigate();
	const params = new URLSearchParams(location.search);
	const current =
		location.pathname === "/inventory-report"
			? params.get("tab") || REPORT_DEFAULT_TAB
			: "";
	const active = current === tab;
	return (
		<button
			onClick={() => navigate(`/inventory-report?tab=${tab}`)}
			className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
				active
					? "bg-[#465fff]/15 text-[#b2ccff] font-semibold"
					: "text-[#98a2b3] hover:bg-white/[.06] hover:text-white"
			}`}
		>
			<span
				className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${active ? "bg-[#b2ccff]" : "bg-white/20"}`}
			/>
			{label}
		</button>
	);
};

export default function Sidebar({
	sidebarOpen,
	setSidebarOpen,
	role,
	permissions,
	onLogout,
}: SidebarProps) {
	const sidebarRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handle = (e: MouseEvent) => {
			if (
				sidebarOpen &&
				sidebarRef.current &&
				!sidebarRef.current.contains(e.target as Node)
			)
				setSidebarOpen(false);
		};
		if (sidebarOpen) document.addEventListener("mousedown", handle);
		return () => document.removeEventListener("mousedown", handle);
	}, [sidebarOpen, setSidebarOpen]);

	// Hiện mục menu nếu vai trò legacy khớp (tương thích cũ) HOẶC có quyền tương ứng
	// (vai trò tùy chỉnh tạo ở trang Vai trò). system.admin thấy tất cả.
	const can = (roles: string[], perm?: string | string[]) => {
		if (!role) return true;
		if (roles.includes(role)) return true;
		const perms = permissions || [];
		if (perms.includes("system.admin")) return true;
		if (!perm) return false;
		const list = Array.isArray(perm) ? perm : [perm];
		return list.some(p => perms.includes(p));
	};

	return (
		<>
			{/* Overlay mobile */}
			{sidebarOpen && (
				<div
					className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
					onClick={() => setSidebarOpen(false)}
				/>
			)}

			<aside
				ref={sidebarRef}
				className={`
          fixed md:relative inset-y-0 left-0 z-50
          w-[260px] h-full flex flex-col flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
				style={{ background: "#0a20c7", borderRight: "1px solid #030E68" }}
			>
				{/* Logo */}
				<div
					className="h-16 flex items-center px-5 flex-shrink-0"
					style={{ borderBottom: "1px solid #1d2939" }}
				>
					<div className="flex items-center gap-2.5">
						<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#465fff] text-lg font-bold text-white">
							C
						</span>
						<div>
							<p className="text-white font-semibold text-[14px] leading-tight tracking-tight">
								Challenge ERP
							</p>
							<p className="text-[#667085] text-[11px]">Warehouse OMS v1.2</p>
						</div>
					</div>
				</div>

				{/* Nav */}
				<nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 custom-scrollbar">
					{can(["ADMIN", "W_MANAGER", "P_MANAGER"], "dashboard.view") && (
						<NavItem
							icon={LayoutDashboard}
							label="Tổng quan"
							path="/dashboard"
						/>
					)}

					{/* Bán hàng */}
					{can(
						["ADMIN", "S_SALES", "W_MANAGER"],
						[
							"sales.view",
							"promotion.view",
							"sales.return.view",
							"customer.view",
							"debt.view",
						],
					) && (
						<>
							<SectionLabel>Bán hàng</SectionLabel>
							<NavItem
								icon={ShoppingCart}
								label="Đơn bán hàng"
								path="/sales-orders"
							/>
							<NavItem icon={Gift} label="Khuyến mãi" path="/promotions" />
							<NavItem
								icon={PackagePlus}
								label="Trả hàng bán"
								path="/sales-returns"
							/>
							<NavItem icon={Users} label="Khách hàng" path="/customers" />
							<NavItem icon={Landmark} label="Công nợ" path="/debt" />
						</>
					)}

					{/* Bán hàng online (vai trò riêng) */}
					{can(["ADMIN", "O_SALES"], "online.view") && (
						<>
							<SectionLabel>Bán hàng online</SectionLabel>
							<NavItem icon={Store} label="Đơn online" path="/online-orders" />
						</>
					)}

					{/* Mua hàng */}
					{can(["ADMIN", "W_MANAGER", "QD"], "purchase.view") && (
						<>
							<SectionLabel>Mua hàng</SectionLabel>
							<NavItem icon={ShoppingBag} label="Mua hàng" path="/purchases" />
							<NavItem
								icon={Building2}
								label="Nhà cung cấp"
								path="/suppliers"
							/>
						</>
					)}

					{/* Kho */}
					{can(
						["ADMIN", "W_MANAGER", "P_MANAGER", "QD"],
						["inventory.view", "catalog.manage", "inventory.opening"],
					) && (
						<>
							<SectionLabel>Kho</SectionLabel>
							<NavItem
								icon={Warehouse}
								label="Danh sách kho"
								path="/warehouses"
							/>
							<NavItem
								icon={Package}
								label="Nhập kho"
								path="/inventory-import"
							/>
							<NavItem
								icon={Archive}
								label="Xuất kho"
								path="/inventory-export"
							/>
							<NavItem
								icon={ArrowRightLeft}
								label="Chuyển kho"
								path="/warehouse-transfers"
							/>
							<NavItem
								icon={ClipboardList}
								label="Kiểm kê"
								path="/stock-take"
							/>
							<NavItem
								icon={BookOpen}
								label="Danh mục hàng hóa"
								path="/products"
							/>
							<NavItem
								icon={Tag}
								label="Thiết lập bảng giá"
								path="/price-books"
							/>
							<NavItem
								icon={DatabaseZap}
								label="Tồn kho đầu kỳ"
								path="/opening-inventory"
							/>
						</>
					)}

					{/* Sản xuất */}
					{can(
						["ADMIN", "P_MANAGER", "QD"],
						["production.view", "production.manage", "assembly.view"],
					) && (
						<>
							<SectionLabel>Sản xuất</SectionLabel>
							<NavItem
								icon={Factory}
								label="Lệnh sản xuất"
								path="/production"
							/>
							<NavItem
								icon={Settings2}
								label="Quản lý sản xuất"
								path="/production-mgmt"
							/>
							<NavItem
								icon={ArrowRightLeft}
								label="Lắp ráp & Tháo dỡ"
								path="/assembly"
							/>
						</>
					)}

					{/* Báo cáo */}
					{can(
						["ADMIN", "W_MANAGER", "P_MANAGER", "S_SALES", "QD"],
						"report.view",
					) && (
						<>
							<SectionLabel>Báo cáo</SectionLabel>
							<SubMenu
								icon={BarChart3}
								label="Báo cáo"
								path="/inventory-report"
							>
								<ReportMenuGroup label="Bán hàng">
									<ReportMenuItem tab="SALES" label="Tổng quan" />
									<ReportMenuItem tab="SALES_CUSTOMER" label="Theo KH / nhóm" />
									<ReportMenuItem tab="SALES_PRODUCT" label="Theo sản phẩm" />
								</ReportMenuGroup>
								<ReportMenuGroup label="Lệnh sản xuất">
									<ReportMenuItem tab="PROD_OVERVIEW" label="Tổng quan" />
									<ReportMenuItem tab="VARIANCE" label="Định mức vs thực tế" />
								</ReportMenuGroup>
								<ReportMenuGroup label="Tồn kho">
									<ReportMenuItem tab="INVENTORY" label="Chi tiết theo kho" />
									<ReportMenuItem tab="LEDGER" label="Sổ chi tiết 1 mã" />
								</ReportMenuGroup>
								<ReportMenuGroup label="Đơn online">
									<ReportMenuItem tab="ONLINE" label="Tổng quan online" />
								</ReportMenuGroup>
								<ReportMenuGroup label="Chuyển kho">
									<ReportMenuItem
										tab="TRANSFERS"
										label="Tổng quan + chi tiết"
									/>
								</ReportMenuGroup>
								<ReportMenuGroup label="Lắp ráp – Tháo dỡ">
									<ReportMenuItem tab="OPERATIONS" label="Tổng quan chung" />
									<ReportMenuItem tab="ASSEMBLY" label="Lắp ráp" />
									<ReportMenuItem tab="DISASSEMBLY" label="Tháo dỡ" />
								</ReportMenuGroup>
								<ReportMenuGroup label="Khuyến mãi">
									<ReportMenuItem tab="PROMO" label="Hàng khuyến mãi" />
								</ReportMenuGroup>
							</SubMenu>
						</>
					)}

					{/* Quản lý */}
					{can(["ADMIN"], ["iam.manage", "system.admin", "company.manage"]) && (
						<>
							<SectionLabel>Quản lý hệ thống</SectionLabel>
							{can(["ADMIN"], "iam.manage") && (
								<>
									<NavItem icon={Users} label="Tài khoản" path="/users" />
									<NavItem icon={ShieldCheck} label="Vai trò" path="/roles" />
								</>
							)}
							{can(["ADMIN"], "system.admin") && (
								<NavItem
									icon={History}
									label="Nhật ký hoạt động"
									path="/audit-logs"
								/>
							)}
							{can(["ADMIN"], "company.manage") && (
								<NavItem
									icon={Settings}
									label="Cấu hình doanh nghiệp"
									path="/company-settings"
								/>
							)}
						</>
					)}
				</nav>

				{/* Footer */}
				{/* <div
          className="p-4 flex-shrink-0 flex items-center justify-between"
          style={{ background: "#0c1526", borderTop: "1px solid #1e293b" }}
        >
          <div>
            <p className="text-slate-300 text-xs font-semibold">Challenge ERP</p>
            <p className="text-slate-500 text-[10px] mt-0.5">Phiên bản v1.2</p>
          </div>
          <button
            onClick={onLogout}
            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
            title="Đăng xuất"
          >
            <LogOut size={17} />
          </button>
        </div> */}
			</aside>
		</>
	);
}

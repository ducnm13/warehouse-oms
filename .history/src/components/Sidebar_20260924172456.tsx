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
	UserCog,
	DatabaseZap,
	BookOpen,
	Settings,
	ChevronDown,
	Package,
	BarChart3,
	Boxes,
	Warehouse,
	Factory,
	Tag,
} from "lucide-react";

interface SidebarProps {
	sidebarOpen: boolean;
	setSidebarOpen: (arg: boolean) => void;
	role?: string;
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
				className={`overflow-hidden transition-all duration-250 ${open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}
			>
				<div className="mt-0.5 ml-4 pl-3 border-l border-white/10 space-y-0.5 py-1">
					{children}
				</div>
			</div>
		</div>
	);
};

export default function Sidebar({
	sidebarOpen,
	setSidebarOpen,
	role,
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

	const can = (roles: string[]) => !role || roles.includes(role);

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
				style={{ background: "#101828", borderRight: "1px solid #1d2939" }}
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
					{can(["ADMIN", "W_MANAGER", "P_MANAGER"]) && (
						<NavItem
							icon={LayoutDashboard}
							label="Tổng quan"
							path="/dashboard"
						/>
					)}

					{/* Bán hàng */}
					{can(["ADMIN", "S_SALES", "W_MANAGER"]) && (
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

					{/* Mua hàng */}
					{can(["ADMIN", "W_MANAGER", "QD"]) && (
						<>
							<SectionLabel>Mua hàng</SectionLabel>
							<NavItem
								icon={ShoppingBag}
								label="Chứng từ mua hàng"
								path="/purchases"
							/>
							<NavItem
								icon={Building2}
								label="Nhà cung cấp"
								path="/suppliers"
							/>
						</>
					)}

					{/* Kho */}
					{can(["ADMIN", "W_MANAGER", "P_MANAGER", "QD"]) && (
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
								icon={Boxes}
								label="Sổ kho tổng hợp"
								path="/transactions"
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
					{can(["ADMIN", "P_MANAGER", "QD"]) && (
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
					{can(["ADMIN", "W_MANAGER", "P_MANAGER", "S_SALES", "QD"]) && (
						<>
							<SectionLabel>Báo cáo</SectionLabel>
							<NavItem
								icon={BarChart3}
								label="Báo cáo tổng hợp"
								path="/inventory-report"
							/>
						</>
					)}

					{/* Quản lý */}
					{can(["ADMIN"]) && (
						<>
							<SectionLabel>Quản lý hệ thống</SectionLabel>
							<NavItem icon={Users} label="Tài khoản" path="/users" />
							<NavItem icon={UserCog} label="Nhân viên" path="/employees" />
							<NavItem
								icon={History}
								label="Nhật ký hoạt động"
								path="/audit-logs"
							/>
							<NavItem
								icon={Settings}
								label="Cấu hình doanh nghiệp"
								path="/company-settings"
							/>
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

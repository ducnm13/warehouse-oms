import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";

interface SidebarProps {
	sidebarOpen: boolean;
	setSidebarOpen: (arg: boolean) => void;
	role?: string;
	onLogout: () => void;
	activeItem: string;
	setActiveItem: (item: string) => void;
}

const NavItem = ({
	icon: Icon,
	label,
	id,
	activeItem,
	onClick,
	indent = false,
}: {
	icon: React.FC<any>;
	label: string;
	id: string;
	activeItem: string;
	onClick: (id: string) => void;
	indent?: boolean;
}) => {
	const active = activeItem === id;
	return (
		<button
			onClick={() => onClick(id)}
			className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150
        ${indent ? "ml-3 pl-2 w-[calc(100%-12px)]" : ""}
        ${
					active
						? "bg-teal-500/15 text-teal-300 font-semibold"
						: "text-slate-400 hover:bg-white/6 hover:text-slate-200"
				}`}
		>
			<Icon
				size={indent ? 15 : 17}
				className={active ? "text-teal-400" : "opacity-70"}
			/>
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
	id,
	activeItem,
	children,
	defaultOpen = false,
}: {
	icon: React.FC<any>;
	label: string;
	id: string;
	activeItem: string;
	children: React.ReactNode;
	defaultOpen?: boolean;
}) => {
	const childActive =
		typeof activeItem === "string" && activeItem.startsWith(id);
	const [open, setOpen] = useState(defaultOpen || childActive);
	return (
		<div>
			<button
				onClick={() => setOpen(o => !o)}
				className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150
          ${childActive ? "text-slate-200" : "text-slate-400 hover:bg-white/6 hover:text-slate-200"}`}
			>
				<Icon size={17} className={childActive ? "opacity-90" : "opacity-60"} />
				<span className="flex-1 text-left">{label}</span>
				<ChevronDown
					size={14}
					className={`transition-transform duration-200 opacity-60 ${open ? "rotate-180" : ""}`}
				/>
			</button>
			<div
				className={`overflow-hidden transition-all duration-250 ${open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}
			>
				<div className="mt-0.5 ml-4 pl-3 border-l border-slate-700 space-y-0.5 py-1">
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
	activeItem,
	setActiveItem,
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

	const click = (id: string) => {
		setActiveItem(id);
		setSidebarOpen(false);
	};
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
          w-[240px] h-full flex flex-col flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
				style={{ background: "#0f172a", borderRight: "1px solid #1e293b" }}
			>
				{/* Logo */}
				<div
					className="h-[60px] flex items-center px-5 flex-shrink-0"
					style={{ background: "#0c1526", borderBottom: "1px solid #1e293b" }}
				>
					<div className="flex items-center gap-2.5">
						<div className="w-full rounded-lg flex items-center justify-center">
							{/* <Boxes size={18} className="text-white" /> */}
							<img
								src="/public/images/logo2.png"
								alt="Logo"
								className="w-auto h-9"
							/>
						</div>
						<div>
							<p className="text-white font-bold text-[14px] leading-tight">
								{/* Challenge ERP */}
							</p>
							{/* <p className="text-slate-500 text-[10px]">v1.2</p> */}
						</div>
					</div>
				</div>

				{/* Nav */}
				<nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 custom-scrollbar">
					{can(["ADMIN", "W_MANAGER", "P_MANAGER"]) && (
						<NavItem
							icon={LayoutDashboard}
							label="Tổng quan"
							id="dashboard"
							activeItem={activeItem}
							onClick={click}
						/>
					)}

					{/* Bán hàng */}
					{can(["ADMIN", "S_SALES", "W_MANAGER"]) && (
						<>
							<SectionLabel>Bán hàng</SectionLabel>
							<NavItem
								icon={ShoppingCart}
								label="Đơn bán hàng"
								id="sales-orders"
								activeItem={activeItem}
								onClick={click}
							/>
							<NavItem
								icon={Gift}
								label="Khuyến mãi"
								id="promotions"
								activeItem={activeItem}
								onClick={click}
							/>
							<NavItem
								icon={PackagePlus}
								label="Trả hàng bán"
								id="sales-returns"
								activeItem={activeItem}
								onClick={click}
							/>
							<NavItem
								icon={Users}
								label="Khách hàng"
								id="customers"
								activeItem={activeItem}
								onClick={click}
							/>
							<NavItem
								icon={Landmark}
								label="Công nợ"
								id="debt"
								activeItem={activeItem}
								onClick={click}
							/>
						</>
					)}

					{/* Mua hàng */}
					{can(["ADMIN", "W_MANAGER", "QD"]) && (
						<>
							<SectionLabel>Mua hàng</SectionLabel>
							<NavItem
								icon={ShoppingBag}
								label="Chứng từ mua hàng"
								id="purchases"
								activeItem={activeItem}
								onClick={click}
							/>
							<NavItem
								icon={Building2}
								label="Nhà cung cấp"
								id="suppliers"
								activeItem={activeItem}
								onClick={click}
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
								id="warehouses"
								activeItem={activeItem}
								onClick={click}
							/>
							<NavItem
								icon={ArrowRightLeft}
								label="Chuyển kho"
								id="warehouse-transfers"
								activeItem={activeItem}
								onClick={click}
							/>
							<NavItem
								icon={ClipboardList}
								label="Kiểm kê"
								id="stock-take"
								activeItem={activeItem}
								onClick={click}
							/>
							<NavItem
								icon={BookOpen}
								label="Danh mục hàng hóa"
								id="products"
								activeItem={activeItem}
								onClick={click}
							/>
							<NavItem
								icon={DatabaseZap}
								label="Tồn kho đầu kỳ"
								id="opening-inventory"
								activeItem={activeItem}
								onClick={click}
							/>
						</>
					)}

					{/* Sản xuất */}
					{can(["ADMIN", "P_MANAGER", "QD"]) && (
						<>
							<SectionLabel>Sản xuất</SectionLabel>
							<NavItem
								icon={Settings2}
								label="Lệnh sản xuất"
								id="production"
								activeItem={activeItem}
								onClick={click}
							/>
							<NavItem
								icon={ArrowRightLeft}
								label="Lắp ráp & Tháo dỡ"
								id="assembly"
								activeItem={activeItem}
								onClick={click}
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
								id="inventory-report"
								activeItem={activeItem}
								onClick={click}
							/>
						</>
					)}

					{/* Quản lý */}
					{can(["ADMIN"]) && (
						<>
							<SectionLabel>Quản lý hệ thống</SectionLabel>
							<NavItem
								icon={Users}
								label="Tài khoản"
								id="users"
								activeItem={activeItem}
								onClick={click}
							/>
							<NavItem
								icon={UserCog}
								label="Nhân viên"
								id="employees"
								activeItem={activeItem}
								onClick={click}
							/>
							<NavItem
								icon={History}
								label="Nhật ký hoạt động"
								id="audit-logs"
								activeItem={activeItem}
								onClick={click}
							/>
							<NavItem
								icon={Settings}
								label="Cấu hình doanh nghiệp"
								id="company-settings"
								activeItem={activeItem}
								onClick={click}
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

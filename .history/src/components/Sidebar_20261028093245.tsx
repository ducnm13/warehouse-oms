import React, { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiV1 } from "../lib/apiV1";
import { getModuleAccess } from "../lib/permissions";
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
	Package,
	BarChart3,
	Warehouse,
	Factory,
	Tag,
	ShieldCheck,
	MessageCircle,
	Terminal,
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
			data-tour={path}
			className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150
        ${indent ? "ml-3 pl-2 w-[calc(100%-12px)]" : ""}
        ${
					active
						? "bg-[#f2efff] text-[#422afb] font-semibold"
						: "text-[#2b3674] hover:bg-[#f4f7fe] hover:text-[#2b3674]"
				}`}
		>
			<span
				className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${active ? "bg-[#422afb] text-white shadow-[0_6px_16px_rgba(66,42,251,0.35)]" : "bg-[#f4f7fe] text-[#2b3674] group-hover:text-[#2b3674]"}`}
			>
				<Icon size={indent ? 15 : 17} />
			</span>
			{label}
		</button>
	);
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
	<p className="px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#2b3674] mb-1 mt-5">
		{children}
	</p>
);

export default function Sidebar({
	sidebarOpen,
	setSidebarOpen,
	role,
	permissions,
	onLogout,
}: SidebarProps) {
	const sidebarRef = useRef<HTMLDivElement>(null);
	const location = useLocation();

	// Đóng sidebar trên mobile sau khi chuyển trang
	useEffect(() => {
		setSidebarOpen(false);
	}, [location.pathname, setSidebarOpen]);

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

	const access = getModuleAccess(role, permissions);

	// Bán hàng
	const showSales = access.sales;
	const showPromotions = access.promotions;
	const showSalesReturns = access.salesReturns;
	const showCustomers = access.customers;
	const showDebt = access.debt;
	const showSalesSection =
		showSales ||
		showPromotions ||
		showSalesReturns ||
		showCustomers ||
		showDebt;

	// Bán hàng online
	const showOnline = access.online;

	// Mua hàng
	const showPurchases = access.purchases;
	const showSuppliers = access.suppliers;
	const showPurchaseSection = showPurchases || showSuppliers;

	// Kho
	const showWarehouses = access.warehouses;
	const showImport = access.import;
	const showExport = access.export;
	const showTransfers = access.transfers;
	const showStocktake = access.stocktake;
	const showCatalog = access.catalog;
	const showPriceBooks = access.priceBooks;
	const showOpening = access.opening;
	const showWarehouseSection =
		showWarehouses ||
		showImport ||
		showExport ||
		showTransfers ||
		showStocktake ||
		showCatalog ||
		showPriceBooks ||
		showOpening;

	// Sản xuất
	const showProduction = access.production;
	const showProductionMgmt = access.productionMgmt;
	const showAssembly = access.assembly;
	const showProductionSection =
		showProduction || showProductionMgmt || showAssembly;

	// Báo cáo
	const showReports = access.reports;

	// Quản lý hệ thống
	const showUsers = access.users;
	const showRoles = access.roles;
	const showAuditLogs = access.auditLogs;
	const showCompany = access.company;
	const showManageSection =
		showUsers || showRoles || showAuditLogs || showCompany;
	const canUseDevTools = access.devTools;
	const devToolsAccess = useQuery({
		queryKey: ["devtools-access"],
		queryFn: () => apiV1<{ allowed: boolean }>("/api/v1/devtools/access"),
		enabled: canUseDevTools,
		staleTime: 5 * 60_000,
		retry: false,
	});
	const showDevTools =
		canUseDevTools && devToolsAccess.data?.data.allowed === true;

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
				data-tour="sidebar"
				className={`
          fixed md:relative inset-y-0 left-0 z-50
          w-[270px] h-full flex flex-col flex-shrink-0 bg-white
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
			>
				{/* Logo */}
				<div className="h-20 flex items-center px-5 flex-shrink-0 border-b border-[#e6ecfa]">
					<div className="flex items-center gap-2.5 justify-center w-full">
						<div className="w-30 flex items-center justify-center">
							<img
								src="/public/images/logo.png"
								alt=""
								className="w-full object-contain"
							/>
						</div>
						<div>
							<p className="text-[#2b3674] font-bold text-[14px] leading-tight tracking-tight">
								ERP
							</p>
							<p className="text-[#2b3674] text-[11px]">v1.0.2</p>
						</div>
					</div>
				</div>

				{/* Nav */}
				<nav
					className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 custom-scrollbar"
					onClick={event => {
						if ((event.target as HTMLElement).closest("button"))
							setSidebarOpen(false);
					}}
				>
					{access.dashboard && (
						<NavItem
							icon={LayoutDashboard}
							label="Tổng quan"
							path="/dashboard"
						/>
					)}

					{/* Bán hàng */}
					{showSalesSection && (
						<>
							<SectionLabel>Bán hàng</SectionLabel>
							{showSales && (
								<NavItem
									icon={ShoppingCart}
									label="Bán hàng"
									path="/sales-orders"
								/>
							)}
							{showPromotions && (
								<NavItem icon={Gift} label="Khuyến mãi" path="/promotions" />
							)}
							{showSalesReturns && (
								<NavItem
									icon={PackagePlus}
									label="Trả hàng bán"
									path="/sales-returns"
								/>
							)}
							{showCustomers && (
								<NavItem icon={Users} label="Khách hàng" path="/customers" />
							)}
							{showDebt && (
								<NavItem icon={Landmark} label="Công nợ" path="/debt" />
							)}
						</>
					)}

					{/* Bán hàng online (vai trò riêng) */}
					{showOnline && (
						<>
							<SectionLabel>Bán hàng online</SectionLabel>
							<NavItem icon={Store} label="Đơn online" path="/online-orders" />
						</>
					)}

					{/* Mua hàng */}
					{showPurchaseSection && (
						<>
							<SectionLabel>Mua hàng</SectionLabel>
							{showPurchases && (
								<NavItem
									icon={ShoppingBag}
									label="Mua hàng"
									path="/purchases"
								/>
							)}
							{showSuppliers && (
								<NavItem
									icon={Building2}
									label="Nhà cung cấp"
									path="/suppliers"
								/>
							)}
						</>
					)}

					{/* Kho */}
					{showWarehouseSection && (
						<>
							<SectionLabel>Kho</SectionLabel>
							{showWarehouses && (
								<NavItem
									icon={Warehouse}
									label="Danh sách kho"
									path="/warehouses"
								/>
							)}
							{showImport && (
								<NavItem
									icon={Package}
									label="Nhập kho"
									path="/inventory-import"
								/>
							)}
							{showExport && (
								<NavItem
									icon={Archive}
									label="Xuất kho"
									path="/inventory-export"
								/>
							)}
							{showTransfers && (
								<NavItem
									icon={ArrowRightLeft}
									label="Chuyển kho"
									path="/warehouse-transfers"
								/>
							)}
							{showStocktake && (
								<NavItem
									icon={ClipboardList}
									label="Kiểm kê"
									path="/stock-take"
								/>
							)}
							{showCatalog && (
								<NavItem
									icon={BookOpen}
									label="Danh mục hàng hóa"
									path="/products"
								/>
							)}
							{showPriceBooks && (
								<NavItem
									icon={Tag}
									label="Thiết lập bảng giá"
									path="/price-books"
								/>
							)}
							{showOpening && (
								<NavItem
									icon={DatabaseZap}
									label="Tồn kho đầu kỳ"
									path="/opening-inventory"
								/>
							)}
						</>
					)}

					{/* Sản xuất */}
					{showProductionSection && (
						<>
							<SectionLabel>Sản xuất</SectionLabel>
							{showProduction && (
								<NavItem
									icon={Factory}
									label="Lệnh sản xuất"
									path="/production"
								/>
							)}
							{showProductionMgmt && (
								<NavItem
									icon={Settings2}
									label="Quản lý sản xuất"
									path="/production-mgmt"
								/>
							)}
							{showAssembly && (
								<NavItem
									icon={ArrowRightLeft}
									label="Lắp ráp & Tháo dỡ"
									path="/assembly"
								/>
							)}
						</>
					)}

					{/* Báo cáo */}
					{showReports && (
						<NavItem icon={BarChart3} label="Báo cáo" path="/reports" />
					)}

					{/* Tin nhắn nội bộ */}
					{access.chat && (
						<NavItem icon={MessageCircle} label="Tin nhắn" path="/chat" />
					)}

					{/* Quản lý */}
					{showManageSection && (
						<>
							<SectionLabel>Quản lý hệ thống</SectionLabel>
							{showUsers && (
								<NavItem icon={Users} label="Tài khoản" path="/users" />
							)}
							{showRoles && (
								<NavItem icon={ShieldCheck} label="Vai trò" path="/roles" />
							)}
							{showAuditLogs && (
								<NavItem
									icon={History}
									label="Nhật ký hoạt động"
									path="/audit-logs"
								/>
							)}
							{showCompany && (
								<NavItem
									icon={Settings}
									label="Cấu hình doanh nghiệp"
									path="/company-settings"
								/>
							)}
						</>
					)}

					{showDevTools && (
						<>
							<SectionLabel>Developer</SectionLabel>
							<NavItem icon={Terminal} label="Dev Tools" path="/dev-tools" />
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

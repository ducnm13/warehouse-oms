import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Warehouse,
  ClipboardList,
  Users,
  LogOut,
  Settings2,
  ShieldAlert,
  History,
  Archive,
  HelpCircle,
  ShoppingCart,
  ArrowRightLeft,
  ShoppingBag,
  Building2,
  Landmark
} from "lucide-react";

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (arg: boolean) => void;
  role?: string;
  onLogout: () => void;
  activeItem: string;
  setActiveItem: (item: string) => void;
}

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  role,
  onLogout,
  activeItem,
  setActiveItem,
}: SidebarProps) {
  // Mặc định mở menu báo cáo
  const [openSubMenus, setOpenSubMenus] = useState<string[]>(["inventory"]);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // LOGIC: Đóng sidebar khi click ra ngoài (Chỉ áp dụng khi sidebar đang mở)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setSidebarOpen(false);
      }
    };

    if (sidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sidebarOpen, setSidebarOpen]);

  const toggleSubMenu = (id: string) => {
    setOpenSubMenus((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleNavClick = (id: string) => {
    setActiveItem(id);
    setSidebarOpen(false); // Đóng menu sau khi click chọn
  };

  // HÀM PHÂN QUYỀN: Nếu chưa có role thì cho hiện tất cả để test, nếu có thì check
  const canAccess = (allowedRoles: string[]) => {
    if (!role) return true;
    return allowedRoles.includes(role);
  };

  return (
    <>
      {/* 1. LỚP PHỦ MỜ (OVERLAY) CHO MOBILE */}
      {/* Click vào lớp này cũng sẽ đóng menu */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 2. KHUNG SIDEBAR CHÍNH */}
      <aside
        ref={sidebarRef}
        className={`
          fixed md:relative inset-y-0 left-0 z-50
          w-[280px] h-full bg-white flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] flex-shrink-0
          transform transition-transform duration-300 ease-in-out border-r border-slate-100
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* LOGO AREA */}
        <div className="h-[80px] flex items-center px-6 flex-shrink-0 justify-center">
          <div className="flex items-center justify-between gap-3 ">
            <div>
              <img
                src="/public/images/logo.png"
                alt="Challenge"
                className="h-10 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>

        {/* NAVIGATION MENU */}
        <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1.5 custom-scrollbar">
          <p className="px-4 text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 mt-2">
            Menu
          </p>

          {canAccess(["ADMIN", "S_SALES", "W_MANAGER"]) && (
            <div className="space-y-1">
              {canAccess(["ADMIN", "S_SALES"]) && (
                <button
                  onClick={() => handleNavClick("sales-orders")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] font-semibold transition-all ${activeItem === "sales-orders" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
                >
                  <ShoppingCart size={19} /> Đơn đặt hàng
                </button>
              )}
              {canAccess(["ADMIN", "W_MANAGER"]) && (
                <button
                  onClick={() => handleNavClick("warehouse-transfers")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] font-semibold transition-all ${activeItem === "warehouse-transfers" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
                >
                  <ArrowRightLeft size={19} /> Chuyển kho
                </button>
              )}
            </div>
          )}

          {canAccess(["ADMIN", "W_MANAGER", "QD"]) && (
            <div className="space-y-1">
              <button
                onClick={() => handleNavClick("purchases")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] font-semibold transition-all ${activeItem === "purchases" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
              >
                <ShoppingBag size={19} /> Mua hàng
              </button>
              <button
                onClick={() => handleNavClick("suppliers")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] font-semibold transition-all ${activeItem === "suppliers" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
              >
                <Building2 size={19} /> Nhà cung cấp
              </button>
            </div>
          )}

          {canAccess(["ADMIN", "W_MANAGER", "S_SALES", "QD"]) && (
            <button
              onClick={() => handleNavClick("debt")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 ${activeItem === "debt" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <Landmark size={20} className={activeItem === "debt" ? "text-indigo-600" : "opacity-60"}/>
              Công nợ
            </button>
          )}

          {canAccess(["ADMIN", "W_MANAGER", "P_MANAGER"]) && (
            <button
              onClick={() => handleNavClick("dashboard")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 ${activeItem === "dashboard" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <LayoutDashboard
                size={20}
                className={
                  activeItem === "dashboard" ? "text-indigo-600" : "opacity-60"
                }
              />{" "}
              Tổng quan
            </button>
          )}

          <div>
            {canAccess([
              "ADMIN",
              "W_MANAGER",
              "P_MANAGER",
              "S_SALES",
              "QD",
            ]) && (
              <button
                onClick={() => toggleSubMenu("products")}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 ${openSubMenus.includes("reports") ? "text-slate-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
              >
                <Warehouse
                  size={20}
                  className={
                    openSubMenus.includes("products")
                      ? "text-indigo-500"
                      : "opacity-60"
                  }
                />{" "}
                Thành phẩm
                <svg
                  className={`ml-auto w-4 h-4 transition-transform duration-200 ${openSubMenus.includes("products") ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            )}
            <div
              className={`overflow-hidden transition-all duration-300 ${openSubMenus.includes("products") ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0"}`}
            >
              <div className="ml-7 pl-4 border-l-2 border-slate-100 flex flex-col gap-1 py-1">
                {canAccess([
                  "ADMIN",
                  "W_MANAGER",
                  "P_MANAGER",
                  "S_SALES",
                  "QD",
                ]) && (
                  <button
                    onClick={() => handleNavClick("products")}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold transition-colors ${activeItem === "products" ? "text-indigo-700 bg-indigo-50/50" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
                  >
                    Danh sách
                  </button>
                )}
                {canAccess(["ADMIN", "W_MANAGER", "P_MANAGER", "QD"]) && (
                  <button
                    onClick={() => handleNavClick("transactions")}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold transition-colors ${activeItem === "transactions" ? "text-indigo-700 bg-indigo-50/50" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
                  >
                    Nhập xuất TP
                  </button>
                )}
              </div>
            </div>
          </div>

          {canAccess(["ADMIN", "W_MANAGER", "P_MANAGER"]) && (
            <div>
              <button
                onClick={() => toggleSubMenu("materials")}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 ${openSubMenus.includes("reports") ? "text-slate-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
              >
                <Package
                  size={20}
                  className={
                    openSubMenus.includes("materials")
                      ? "text-indigo-500"
                      : "opacity-60"
                  }
                />{" "}
                Vật tư - Bao bì
                <svg
                  className={`ml-auto w-4 h-4 transition-transform duration-200 ${openSubMenus.includes("materials") ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ${openSubMenus.includes("materials") ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0"}`}
              >
                <div className="ml-7 pl-4 border-l-2 border-slate-100 flex flex-col gap-1 py-1">
                  <button
                    onClick={() => handleNavClick("materials")}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold transition-colors ${activeItem === "materials" ? "text-indigo-700 bg-indigo-50/50" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
                  >
                    Danh sách
                  </button>
                  <button
                    onClick={() => handleNavClick("material_transactions")}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold transition-colors ${activeItem === "material_transactions" ? "text-indigo-700 bg-indigo-50/50" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
                  >
                    Nhập xuất BB
                  </button>
                </div>
              </div>
            </div>
          )}

          {canAccess(["ADMIN", "W_MANAGER", "P_MANAGER", "QD"]) && (
            <button
              onClick={() => handleNavClick("customers")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 ${activeItem === "customers" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <Users
                size={20}
                className={
                  activeItem === "customers" ? "text-indigo-600" : "opacity-60"
                }
              />{" "}
              Khách hàng
            </button>
          )}

          {canAccess(["ADMIN", "P_MANAGER"]) && (
            <button
              onClick={() => handleNavClick("stock-take")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 ${activeItem === "stock-take" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <ClipboardList
                size={20}
                className={
                  activeItem === "stock-take" ? "text-indigo-600" : "opacity-60"
                }
              />{" "}
              Kiểm kê
            </button>
          )}
          {canAccess(["ADMIN", "W_MANAGER", "P_MANAGER", "QD"]) && (
            <p className="px-4 text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 mt-6">
              Sản xuất & Báo cáo
            </p>
          )}

          {canAccess(["ADMIN", "P_MANAGER", "QD"]) && (
            <button
              onClick={() => handleNavClick("production")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 ${activeItem === "production" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <Settings2
                size={20}
                className={
                  activeItem === "production" ? "text-indigo-600" : "opacity-60"
                }
              />{" "}
              Lệnh Sản Xuất
            </button>
          )}

          {canAccess(["ADMIN", "W_MANAGER", "P_MANAGER"]) && (
            <div>
              <button
                onClick={() => toggleSubMenu("reports")}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 ${openSubMenus.includes("reports") ? "text-slate-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
              >
                <History
                  size={20}
                  className={
                    openSubMenus.includes("reports")
                      ? "text-indigo-500"
                      : "opacity-60"
                  }
                />{" "}
                Báo cáo
                <svg
                  className={`ml-auto w-4 h-4 transition-transform duration-200 ${openSubMenus.includes("reports") ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ${openSubMenus.includes("reports") ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0"}`}
              >
                <div className="ml-7 pl-4 border-l-2 border-slate-100 flex flex-col gap-1 py-1">
                  <button
                    onClick={() => handleNavClick("inventory-report")}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold transition-colors ${activeItem === "inventory-report" ? "text-indigo-700 bg-indigo-50/50" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
                  >
                    Tồn Kho
                  </button>
                  {/* <button
                    onClick={() => handleNavClick("sales-report")}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold transition-colors ${activeItem === "inventory-report" ? "text-indigo-700 bg-indigo-50/50" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
                  >
                    Doanh số tài xế
                  </button> */}
                  <button
                    onClick={() => handleNavClick("production-report")}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-bold transition-colors ${activeItem === "production-report" ? "text-indigo-700 bg-indigo-50/50" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
                  >
                    Sản Xuất
                  </button>
                </div>
              </div>
            </div>
          )}
          {canAccess(["ADMIN"]) && (
            <p className="px-4 text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 mt-6">
              QUẢN LÝ
            </p>
          )}
          {canAccess(["ADMIN"]) && (
            <button
              onClick={() => handleNavClick("users")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 ${activeItem === "users" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <Users
                size={20}
                className={
                  activeItem === "customers" ? "text-indigo-600" : "opacity-60"
                }
              />{" "}
              Tài khoản
            </button>
          )}
          {canAccess(["ADMIN"]) && (
            <button
              onClick={() => handleNavClick("archive")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 ${activeItem === "archive" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <Archive
                size={20}
                className={
                  activeItem === "archive" ? "text-indigo-600" : "opacity-60"
                }
              />{" "}
              Sản phẩm đã ẩn
            </button>
          )}
          {canAccess(["ADMIN"]) && (
            <button
              onClick={() => handleNavClick("audit-logs")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 ${activeItem === "audit-logs" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <History
                size={20}
                className={
                  activeItem === "audit-logs" ? "text-indigo-600" : "opacity-60"
                }
              />{" "}
              Nhật ký hoạt động
            </button>
          )}
          {/* <button
              onClick={() => handleNavClick("user-guide")}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 ${activeItem === "audit-logs" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <HelpCircle
                size={20}
                className={
                  activeItem === "user-guide" ? "text-indigo-600" : "opacity-60"
                }
              />{" "}
              Hướng dẫn sử dụng
            </button> */}
        </nav>

        {/* USER PROFILE VIBRANT STYLE */}
        <div className="mt-auto p-4 flex-shrink-0 border-t border-slate-100 bg-slate-50/50">
          {/* <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-extrabold text-lg">
              {role ? role.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[13px] font-bold text-slate-800 truncate">
                {role ? `Tài khoản ${role}` : "Nhân viên"}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
                {role || "USER"}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
          </div> */}
          <div className="text-center text-sm">
            <h6 className="font-semibold">
            CHALLENGE TO CHANCE
            </h6>
            <p>Version: v1.2</p>
          </div>
        </div>
      </aside>
    </>
  );
}

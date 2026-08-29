import React, { useState, useEffect, useRef } from "react";
import {
  Menu,
  Bell,
  X,
  History,
  User as UserIcon,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { User as UserType } from '../types';
import { formatDate } from '../lib/utils';

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (arg: boolean) => void;
  user: UserType | null;
  setActiveItem: (item: string) => void;
  onLogout: () => void;
}

interface AuditLog {
  id: number;
  action: string;
  details: string;
  userName: string;
  createdAt: string;
}

const Header = ({
  sidebarOpen,
  setSidebarOpen,
  user,
  setActiveItem,
  onLogout,
}: HeaderProps) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (showNotifications && isAdmin) {
      fetchLogs();
    }
  }, [showNotifications, isAdmin]);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/audit-logs", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch (err) {
      console.error("Lỗi khi tải lịch sử thao tác", err);
    }
  };

  const handleSeeAllLogs = () => {
    setActiveItem("audit-logs");
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
    <header className="sticky top-0 z-40 flex h-14 w-full bg-white border-b border-slate-200">
      <div className="flex flex-grow items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2 sm:gap-4 lg:hidden">
          <button
            aria-controls="sidebar"
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen(!sidebarOpen);
            }}
            className="z-50 block rounded-md border border-slate-200 bg-white p-1.5 shadow-sm lg:hidden"
          >
            <Menu size={20} />
          </button>
        </div>

        <div className="hidden sm:block"><p className="text-sm font-semibold text-slate-700">Challenge Warehouse</p><p className="text-[11px] text-slate-400">Quản trị vận hành doanh nghiệp</p></div>

        <div className="flex items-center gap-4">
          <ul className="flex items-center gap-2">
            {isAdmin && (
              <li className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 hover:text-primary transition-all active:scale-95"
                >
                  <Bell size={20} />
                  <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white shadow-sm"></span>
                </button>

                {showNotifications && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowNotifications(false)}
                    ></div>
                    <div className="absolute right-0 mt-3 w-[350px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-20 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
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
                          logs.map((log) => (
                            <div
                              key={log.id}
                              className="p-3 rounded-xl hover:bg-slate-50 transition-colors flex items-start gap-4 group"
                            >
                              <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors shadow-sm border border-indigo-100">
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
          <div className="relative" ref={dropdownRef}>
            <div
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded-2xl transition-all duration-200 select-none group"
            >
              <div className="hidden text-right lg:block">
                <span className="block text-sm font-black text-slate-800 uppercase tracking-tighter group-hover:text-primary transition-colors">
                  {user?.fullName}
                </span>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {user?.role}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 border-2 border-white shadow-sm flex items-center justify-center text-indigo-700 font-black text-lg ring-1 ring-slate-100 group-hover:scale-105 transition-transform">
                  {user?.fullName?.charAt(0).toUpperCase() || "U"}
                </div>
                <ChevronDown
                  size={16}
                  className={`text-slate-400 transition-transform duration-200 ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>

            {/* DROPDOWN MENU */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <div className="lg:hidden px-4 py-3 border-b border-slate-50 mb-2">
                  <p className="text-sm font-black text-slate-800 uppercase tracking-tighter">
                    {user?.fullName}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {user?.role}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setActiveItem("profile");
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
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

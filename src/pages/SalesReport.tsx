import React, { useState, useMemo } from "react";
import {
  Calendar,
  TrendingUp,
  Users,
  Package,
  ArrowDownToLine,
  DollarSign,
  Receipt
} from "lucide-react";



export default function SalesReport() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* HEADER & LỌC NGÀY THÁNG */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">
            BÁO CÁO DOANH SỐ TÀI XẾ
          </h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
            Thống kê doanh thu theo tài xế và sản phẩm
          </p>
        </div>

      </div>

      {/* THẺ TỔNG HỢP (SUMMARY CARDS) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center">
            <Receipt size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tổng tiền hàng</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
            <ArrowDownToLine size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-1">Đã chiết khấu</p>

          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg shadow-indigo-100 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center z-10">
            <DollarSign size={24} />
          </div>
          <div className="z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Doanh thu thực tế (Thực thu)</p>
          </div>
        </div>
      </div>

      {/* KHU VỰC BẢNG DỮ LIỆU */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* TABS CỘNG GỘP */}
        <div className="flex items-center gap-4 border-b border-slate-100 p-4 bg-slate-50/50">

        </div>

        {/* NỘI DUNG BẢNG */}
        <div className="overflow-x-auto">

            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b">
                <tr className="text-slate-400">
                  <th className="py-4 px-6 font-bold uppercase tracking-widest text-[11px]">Tài xế / Khách hàng</th>
                  <th className="py-4 px-6 font-bold uppercase tracking-widest text-[11px] text-center">Số đơn</th>
                  <th className="py-4 px-6 font-bold uppercase tracking-widest text-[11px] text-right">Tổng tiền hàng</th>
                  <th className="py-4 px-6 font-bold uppercase tracking-widest text-[11px] text-right">Chiết khấu</th>
                  <th className="py-4 px-6 font-bold uppercase tracking-widest text-[11px] text-right text-indigo-600">Thực thu</th>
                </tr>
              </thead>
              <tbody>

              </tbody>
            </table>
            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b">
                <tr className="text-slate-400">
                  <th className="py-4 px-6 font-bold uppercase tracking-widest text-[11px]">Tên sản phẩm & Quy cách</th>
                  <th className="py-4 px-6 font-bold uppercase tracking-widest text-[11px] text-center">Đã bán ra (Số lượng)</th>
                  <th className="py-4 px-6 font-bold uppercase tracking-widest text-[11px] text-right text-indigo-600">Doanh thu mang lại</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
        </div>
      </div>
    </div>
  );
}

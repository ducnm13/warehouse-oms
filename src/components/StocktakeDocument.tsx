import React, { forwardRef, useState } from "react";
import { formatNumber } from "../lib/utils";

export const StocktakeDocument = forwardRef(
  ({ stocktake, details }: { stocktake: any; details: any[] }, ref: any) => {
    // KHÓA THỜI GIAN IN: Chỉ lấy 1 lần duy nhất khi render component
    const [printTime] = useState(() => {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} ngày ${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    });

    return (
      <div
        ref={ref}
        className="p-16 text-black bg-white min-h-[297mm] font-serif leading-relaxed"
        style={{ fontFamily: '"Montserrat", sans-serif' }}
      >
        <div className="text-right text-[10px] italic text-gray-600 mb-2">
          Thời gian in: {printTime}
        </div>

        {/* Header Section (Đồng bộ với Production) */}
        <div className="flex justify-between items-start mb-6">
          <div className="text-[11px] leading-tight flex-1">
            <h1 className="font-bold uppercase text-[13px] mb-1">
              CÔNG TY TNHH SX-TM-DV CHALLENGE
            </h1>
            <p>
              <i>
                Trụ sở chính: 159 Hùng Vương, phường Đạo Thạnh, tỉnh Đồng Tháp
              </i>
            </p>
            <p>
              <i>Nhà máy: 260 Nguyễn Quân, phường Đạo Thạnh, tỉnh Đồng Tháp</i>
            </p>
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <img src="/public/images/logo.png" width="120px" alt="Logo" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-center mt-6 mb-8 uppercase tracking-wide">
          BIÊN BẢN KIỂM KÊ KHO
        </h1>

        <div className="mb-6 space-y-3 text-sm ml-6">
          <div className="flex items-end">
            <span className="w-32">Mã phiếu kiểm kê:</span>
            <div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold uppercase">
              {stocktake.code}
            </div>
          </div>
          <div className="flex items-end">
            <span className="w-32">Ngày kiểm kê:</span>
            <div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
              {new Date(stocktake.date).toLocaleDateString("vi-VN")}
            </div>
          </div>
        </div>

        <table className="w-full border-collapse border border-black text-sm mt-8">
          <thead>
            <tr className="bg-gray-50 uppercase text-[11px]">
              <th className="border border-black p-2 font-bold text-center">
                Sản phẩm
              </th>
              <th className="border border-black p-2 font-bold text-center w-28">
                Tồn sổ sách
              </th>
              <th className="border border-black p-2 font-bold text-center w-28">
                Tồn thực tế
              </th>
              <th className="border border-black p-2 font-bold text-center w-28">
                Chênh lệch
              </th>
              <th className="border border-black p-2 font-bold text-center w-40">
                Ghi chú
              </th>
            </tr>
          </thead>
          <tbody>
            {details.map((d: any, idx: number) => (
              <tr key={idx}>
                <td className="border border-black p-3 font-bold text-left">
                  {d.productName} ({d.packagingName})
                </td>
                <td className="border border-black p-3 text-center">
                  {formatNumber(d.expected_qty)}
                </td>
                <td className="border border-black p-3 text-center">
                  {formatNumber(d.actual_qty)}
                </td>
                <td
                  className={`border border-black p-3 text-center font-bold ${d.difference !== 0 ? "text-red-600" : ""}`}
                >
                  {d.difference > 0 ? "+" : ""}
                  {d.difference}
                </td>
                <td className="border border-black p-3"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Chữ ký */}
        <div className="flex justify-around text-sm mt-16 mb-20 italic">
          <div className="text-center">
            <p className="font-bold uppercase not-italic">Thủ kho</p>
            <p className="text-xs">(Ký, họ tên)</p>
          </div>
          <div className="text-center">
            <p className="font-bold uppercase not-italic">Kế toán</p>
            <p className="text-xs">(Ký, họ tên)</p>
          </div>
          <div className="text-center">
            <p className="font-bold uppercase not-italic">Giám đốc</p>
            <p className="text-xs">(Ký, đóng dấu)</p>
          </div>
        </div>
      </div>
    );
  },
);

StocktakeDocument.displayName = "StocktakeDocument";

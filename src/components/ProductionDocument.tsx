import React, { useState } from "react";
import { ProductionOrder } from "../types";
import { formatNumber, formatDate } from "../lib/utils";

interface ProductionDocumentProps {
  order: ProductionOrder;
}

export const ProductionDocument = React.forwardRef<
  HTMLDivElement,
  ProductionDocumentProps
>(({ order }, ref) => {
  // KHÓA THỜI GIAN IN: Chỉ lấy thời gian 1 lần duy nhất khi mở phiếu
  const [printTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} ngày ${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  });
  const hasSavedActualQuantity = order.details.some(
    (detail) => (Number(detail.actual_quantity) || 0) > 0,
  );
  const getDisplayedQuantity = (detail: any) =>
    order.status === "COMPLETED"
      ? hasSavedActualQuantity
        ? Number(detail.actual_quantity) || 0
        : Number(detail.quantity) || 0
      : Number(detail.quantity) || 0;

  return (
    <div
      ref={ref}
      className="p-16 text-black bg-white min-h-[297mm] font-serif leading-relaxed"
      style={{ fontFamily: '"Montserrat", sans-serif' }}
    >
      <div className="text-right text-[10px] italic text-gray-600 mb-2">
        Thời gian in: {printTime}
      </div>

      {/* Header Section */}
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
          <img src="/public/images/logo.png" width="120px"></img>
        </div>
      </div>
      <h1 className="text-xl font-bold text-center mt-6 uppercase tracking-wide">
        BÁO CÁO BÁN THÀNH PHẨM SẢN XUẤT
      </h1>

      {/* Section 1: Thông tin sản xuất */}
      <div className="mb-8 space-y-3 text-sm mt-8">
        <h3 className="font-bold underline italic">1. THÔNG TIN SẢN XUẤT</h3>
        <div className="grid grid-cols-2 gap-2 ml-6">
          <div className="flex items-end">
            <span>Lệnh sản xuất số:</span>
            <div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
              {order.code}
            </div>
          </div>
          <div className="flex items-end">
            <span>Số lô sản xuất:</span>
            <div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold uppercase">
              {order.batch_number || "...................."}
            </div>
          </div>
          <div className="flex items-end">
            <span>Ngày tạo lệnh:</span>
            <div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
              {formatDate(order.order_date || order.createdAt || "")}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 ml-6">
          <div className="flex items-end">
            <span>Tên thành phẩm:</span>
            <div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
              {order.productName}
            </div>
          </div>
          <div className="flex items-end">
            <span>Số lượng theo lệnh sản xuất:</span>
            <div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
              {formatNumber(
                (order.target_sachets || 0) > 0
                  ? order.target_sachets || 0
                  : order.total_sachets,
              )}{" "}
              gói
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 ml-6">
          <div className="flex items-end">
            <span>Ngày sản xuất:</span>
            <div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
              {formatDate(order.mfg_date)}
            </div>
          </div>
          <div className="flex items-end">
            <span>Hạn sử dụng:</span>
            <div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
              {formatDate(order.exp_date)}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Quá trình sản xuất */}
      <div className="mb-10 text-sm">
        <h3 className="font-bold underline italic mb-4">
          2. QUÁ TRÌNH SẢN XUẤT
        </h3>
        <table className="w-full border-collapse border border-black">
          <thead>
            <tr className="bg-gray-50 uppercase text-[11px]">
              <th className="border border-black p-2 font-bold text-center">
                Sản phẩm
              </th>
              <th className="border border-black p-2 font-bold text-center w-24">
                Ngày sản xuất
              </th>
              <th className="border border-black p-2 font-bold text-center w-24">
                Hạn sử dụng
              </th>
              <th className="border border-black p-2 font-bold text-center w-24">
                Số lượng (Hộp/túi)
              </th>
              <th className="border border-black p-2 font-bold text-center w-28">
                Quy đổi (Gói)
              </th>
              <th className="border border-black p-2 font-bold text-center w-32">
                Ghi chú
              </th>
            </tr>
          </thead>
          <tbody>
            {order.details
              .filter((detail: any) => {
                const qty = getDisplayedQuantity(detail);
                return (Number(qty) || 0) > 0;
              })
              .map((d: any, i) => {
                const qty = getDisplayedQuantity(d);
                return (
                  <tr key={i}>
                    <td className="border border-black p-3 font-bold text-left">
                      {d.packagingName}
                    </td>
                    <td className="border border-black p-3 text-center">
                      {formatDate(order.mfg_date)}
                    </td>
                    <td className="border border-black p-3 text-center">
                      {formatDate(order.exp_date)}
                    </td>
                    <td className="border border-black p-3 text-center font-bold">
                      {formatNumber(qty)}
                    </td>
                    <td className="border border-black p-3 text-center font-bold">
                      {formatNumber(qty * (d.packCount || 1))}
                    </td>
                    <td className="border border-black p-3 text-xs italic text-gray-800 font-medium">
                      {d.note || ""}
                    </td>
                  </tr>
                );
              })}
            <tr className="bg-gray-50 font-bold uppercase text-[14px]">
              <td
                colSpan={3}
                className="border border-black p-3 text-center font"
              >
                Tổng cộng sản lượng
              </td>
              <td className="border border-black p-3 text-center">
                {formatNumber(
                  order.details.reduce(
                    (sum, d) =>
                      sum + getDisplayedQuantity(d),
                    0,
                  ),
                )}
              </td>
              <td className="border border-black p-3 text-center text-indigo-700">
                {formatNumber(
                  order.details.reduce(
                    (sum, d: any) =>
                      sum +
                      getDisplayedQuantity(d) * (d.packCount || 1),
                    0,
                  ),
                )}
              </td>
              <td className="border border-black p-3 text-center">-</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer: Signatures */}
      <div className="space-y-4 text-sm italic mb-12 mt-8">
        <div className="flex items-end">
          <span>Ghi chú:</span>
          <div className="flex-1 border-b border-black border-dotted mb-1 ml-2"></div>
        </div>
      </div>

      <div className="flex justify-around text-sm mt-12 mb-20 italic">
        <div className="text-center">
          <p className="font-bold uppercase not-italic">Phụ trách sản xuất</p>
          <p className="text-xs">(ký, họ tên)</p>
          <div className="mt-10">
          <p className="font-bold uppercase text-[12px]">
            NGUYỄN LÝ NGÂN
          </p>

          </div>
        </div>
        <div className="text-center">
          <p className="font-bold uppercase not-italic tracking-tight">
            Người thực hiện
          </p>
          <p className="text-xs">(ký, họ tên)</p>
        </div>
      </div>
    </div>
  );
});

ProductionDocument.displayName = "ProductionDocument";

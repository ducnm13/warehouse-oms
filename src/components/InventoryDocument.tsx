import React from 'react';
import { Transaction } from '../types';
import { formatDate, formatNumber } from '../lib/utils';

interface InventoryDocumentProps {
  transaction: Transaction;
}

export const InventoryDocument = React.forwardRef<HTMLDivElement, InventoryDocumentProps>(
  ({ transaction }, ref) => {
    const totalQuantity = transaction.details.reduce((sum, d) => sum + d.quantity, 0);

    return (
      <div
        ref={ref}
        className="p-8 bg-white text-black print:p-0"
        style={{
          minWidth: "800px",
          fontFamily: '"Inter", "Roboto", sans-serif',
        }}
      >
        {/* Import Font specifically for print */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />

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

        {/* Title Section */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold uppercase border-b-2 border-black inline-block pb-1">
            PHIẾU {transaction.type === "IMPORT" ? "NHẬP" : "XUẤT"} KHO
          </h2>
          <div className="flex justify-center gap-12 mt-2 text-sm">
            <p className="italic">
              Ngày lập: {formatDate(transaction.transaction_date)}
            </p>
            <p className="font-bold">
              {transaction.type === "IMPORT" ? "Ngày nhập: " : "Ngày xuất: "}
              {formatDate(
                transaction.type === "IMPORT"
                  ? transaction.entry_date || ""
                  : transaction.exit_date || "",
              )}
            </p>
            <p className="font-bold uppercase">
              Số:{" "}
              <span className="bg-gray-100 px-4 py-0.5 border border-gray-300">
                {transaction.code}
              </span>
            </p>
          </div>
        </div>

        {/* Info Section */}
        <div className="mb-6 space-y-2 text-sm">
          <div className="flex items-baseline">
            <span className="w-24 font-medium">
              {transaction.type === "IMPORT" ? "Người giao:" : "Nơi nhận:"}
            </span>
            <span className="border-b border-dotted border-black flex-1 font-bold">
              {transaction.customerName ||
                transaction.recipient ||
                "................................................................................"}
            </span>
          </div>
          <div className="flex items-baseline">
            <span className="w-24 font-medium">Lý do:</span>
            <span className="border-b border-dotted border-black flex-1 italic">
              {transaction.note ||
                transaction.reason ||
                "................................................................................"}
            </span>
          </div>
        </div>

        {/* Table Section */}
        <table className="w-full border-2 border-black text-[12px] mb-8 border-collapse">
          <thead>
            <tr className="bg-gray-200 border-b-2 border-black">
              <th className="border-r-2 border-black p-2 w-12 text-center uppercase tracking-tighter">
                STT
              </th>
              <th className="border-r-2 border-black p-2 text-left uppercase tracking-tighter">
                Tên hàng hóa
              </th>
              <th className="border-r-2 border-black p-2 w-24 text-center uppercase tracking-tighter">
                Mã hàng
              </th>
              <th className="border-r-2 border-black p-2 w-20 text-center uppercase tracking-tighter">
                Đơn vị
              </th>
              <th className="border-r-2 border-black p-2 w-24 text-center uppercase tracking-tighter">
                Số lượng
              </th>
              <th className="p-2 w-32 text-left uppercase tracking-tighter">
                Ghi chú
              </th>
            </tr>
          </thead>
          <tbody>
            {transaction.details.map((d, i) => (
              <tr key={i} className="border-b border-black">
                <td className="border-r-2 border-black p-2 text-center">
                  {i + 1}
                </td>
                <td className="border-r-2 border-black p-2 font-medium">
                  {d.productName || "Sản phẩm"} -{" "}
                  {d.packagingName || "Quy cách"}
                </td>
                <td className="border-r-2 border-black p-2 text-center font-mono text-[10px]">
                  {d.sku || d.packagingId}
                </td>
                <td className="border-r-2 border-black p-2 text-center uppercase">
                  {d.unit || d.packagingName?.split(" ").pop() || "Gói"}
                </td>
                <td className="border-r-2 border-black p-2 text-right font-bold pr-4">
                  {formatNumber(d.quantity)}
                </td>
                <td className="p-2 italic text-gray-800 text-[11px] font-medium">
                  {(d as any).note || ""}
                </td>
              </tr>
            ))}
            {/* Empty rows removed per user request */}
          </tbody>
          <tfoot>
            <tr className="font-bold bg-gray-100 uppercase italic">
              <td
                colSpan={4}
                className="border-r-2 border-black p-2 text-center"
              >
                CỘNG
              </td>
              <td className="border-r-2 border-black p-2 text-right pr-4 text-sm font-black">
                {formatNumber(totalQuantity)}
              </td>
              <td className="p-2"></td>
            </tr>
          </tfoot>
        </table>

        {/* Footer Section - Signatures */}
        <div className="grid grid-cols-3 gap-4 text-center text-sm font-medium mt-12 pb-12">
          <div className="space-y-16">
            <div>
              <p className="font-bold">Người lập phiếu</p>
              <p className="italic text-[11px]">(Ký, họ tên)</p>
            </div>
            <p className="font-bold uppercase text-[12px]">
              {transaction.creatorName}
            </p>
          </div>
          <div>
            <p className="font-bold">Người nhận hàng</p>
            <p className="italic text-[11px]">(Ký, họ tên)</p>
          </div>
          <div>
            <p className="font-bold">Quản đốc</p>
            <p className="italic text-[11px]">(Ký, họ tên)</p>
          </div>
        </div>

        {/* Print Styles */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            @page { margin: 15mm; size: auto; }
          }
        `,
          }}
        />
      </div>
    );
  }
);

InventoryDocument.displayName = 'InventoryDocument';

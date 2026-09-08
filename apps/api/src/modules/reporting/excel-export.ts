import ExcelJS from 'exceljs';
import { formatDate, formatNumber } from '../../../../../src/lib/utils';

interface ExportOptions {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: any[];
  footer?: { label: string; value: number }[];
}

// Hàm chung xuất Excel
export async function exportToExcel(options: ExportOptions): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(options.sheetName);

  // Thiết lập định dạng cột
  worksheet.columns = options.headers.map(header => ({
    header,
    key: header.toLowerCase().replace(/\s+/g, '_'),
    width: Math.max(15, header.length + 2)
  }));

  // Thêm header
  const headerRow = worksheet.addRow(options.headers);
  headerRow.eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Thêm dữ liệu
  options.rows.forEach(row => {
    const dataRow = worksheet.addRow(row);
    dataRow.eachCell(cell => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  // Thêm footer nếu có
  if (options.footer && options.footer.length > 0) {
    const footerRow = worksheet.addRow([]);
    footerRow.getCell(1).value = 'TỔNG CỘNG';
    footerRow.getCell(1).font = { bold: true };

    options.footer.forEach((item, index) => {
      const colIndex = index + 2;
      const footerCell = worksheet.getCell(colIndex, options.rows.length + 3);
      footerCell.value = item.value;
      footerCell.font = { bold: true };
      footerCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  }

  // Định dạng số tiền
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > 1) { // Bỏ qua header
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00';
        }
      });
    }
  });

  // Định dạng ngày
  worksheet.columns.forEach(column => {
    if (column.key?.includes('date') || column.key?.includes('ngay')) {
      worksheet.getColumn(column.key).numFmt = 'dd/mm/yyyy';
    }
  });

  // Tạo buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}

// Xuất Excel cho báo cáo tồn kho
export async function exportInventoryReport(data: any[], fileName: string = 'bao_cao_ton_kho.xlsx') {
  const headers = [
    'Mã hàng',
    'Tên hàng',
    'Đơn vị tính',
    'Kho',
    'Tồn đầu kỳ',
    'Nhập trong kỳ',
    'Xuất trong kỳ',
    'Tồn cuối kỳ',
    'Giá trị đầu kỳ',
    'Giá trị nhập',
    'Giá trị xuất',
    'Giá trị cuối kỳ'
  ];

  const rows = data.map(item => ({
    ma_hang: item.packagingId,
    ten_hang: item.packagingName || item.productName,
    don_vi_tinh: item.unit,
    kho: item.warehouseName,
    ton_dau_ky: item.openingQuantity,
    nhap_trong_ky: item.inboundQuantity,
    xuat_trong_ky: item.outboundQuantity,
    ton_cuoi_ky: item.closingQuantity,
    gia_tri_dau_ky: item.openingValue,
    gia_tri_nhap: item.inboundValue,
    gia_tri_xuat: item.outboundValue,
    gia_tri_cuoi_ky: item.closingValue
  }));

  const footer = [
    { label: 'Tổng tồn đầu kỳ', value: data.reduce((sum, item) => sum + (item.openingValue || 0), 0) },
    { label: 'Tổng nhập trong kỳ', value: data.reduce((sum, item) => sum + (item.inboundValue || 0), 0) },
    { label: 'Tổng xuất trong kỳ', value: data.reduce((sum, item) => sum + (item.outboundValue || 0), 0) },
    { label: 'Tổng tồn cuối kỳ', value: data.reduce((sum, item) => sum + (item.closingValue || 0), 0) }
  ];

  return exportToExcel({
    fileName,
    sheetName: 'Tồn kho',
    headers,
    rows,
    footer
  });
}

// Xuất Excel cho báo cáo doanh thu
export async function exportSalesReport(data: any[], fileName: string = 'bao_cao_doanh_thu.xlsx') {
  const headers = [
    'Mã đơn hàng',
    'Ngày lập',
    'Khách hàng',
    'Mã khách hàng',
    'Tổng tiền hàng',
    'Chiết khấu',
    'Thuế',
    'Doanh thu thuần',
    'Giá vốn',
    'Lợi nhuận',
    'Trạng thái'
  ];

  const rows = data.map(item => ({
    ma_don_hang: item.code,
    ngay_lap: item.orderDate,
    khach_hang: item.customerName,
    ma_khach_hang: item.customerCode,
    tong_tien_hang: item.grossSales,
    chiet_khau: item.discountAmount,
    thue: item.taxAmount,
    doanh_thu_thuan: item.netRevenue,
    gia_von: item.cogs,
    loi_nhuan: item.grossProfit,
    trang_thai: item.status
  }));

  const footer = [
    { label: 'Tổng doanh thu', value: data.reduce((sum, item) => sum + (item.netRevenue || 0), 0) },
    { label: 'Tổng chiết khấu', value: data.reduce((sum, item) => sum + (item.discountAmount || 0), 0) },
    { label: 'Tổng lợi nhuận', value: data.reduce((sum, item) => sum + (item.grossProfit || 0), 0) }
  ];

  return exportToExcel({
    fileName,
    sheetName: 'Doanh thu',
    headers,
    rows,
    footer
  });
}

// Xuất Excel cho công nợ phải thu
export async function exportReceivableAging(data: any, fileName: string = 'cong_no_phai_thu.xlsx') {
  const headers = [
    'Mã khách hàng',
    'Tên khách hàng',
    'Số chứng từ',
    'Ngày lập',
    'Ngày đến hạn',
    'Số tiền phải thu',
    'Đã thu',
    'Còn lại',
    'Tuổi nợ',
    'Trạng thái'
  ];

  const rows = data.rows.map((item: any) => ({
    ma_khach_hang: item.customerCode,
    ten_khach_hang: item.customerName,
    so_chung_tu: item.documentCode,
    ngay_lap: item.documentDate,
    ngay_den_han: item.dueDate,
    so_tien_phai_thu: item.originalAmount,
    da_thu: item.paidAmount,
    con_lai: item.outstandingAmount,
    tuoi_no: item.daysOverdue > 0 ? `${item.daysOverdue} ngày` : 'Đến hạn',
    trang_thai: item.agingBucket === 'CURRENT' ? 'Đến hạn' : 'Quá hạn'
  }));

  const footer = [
    { label: 'Tổng công nợ phải thu', value: data.summary.totalOutstanding },
    { label: 'Đến hạn', value: data.summary.current },
    { label: 'Quá hạn 1-30 ngày', value: data.summary.days1To30 },
    { label: 'Quá hạn 31-60 ngày', value: data.summary.days31To60 },
    { label: 'Quá hạn 61-90 ngày', value: data.summary.days61To90 },
    { label: 'Quá hạn trên 90 ngày', value: data.summary.over90 }
  ];

  return exportToExcel({
    fileName,
    sheetName: 'Công nợ phải thu',
    headers,
    rows,
    footer
  });
}

// Xuất Excel cho công nợ phải trả
export async function exportPayableAging(data: any, fileName: string = 'cong_no_phai_tra.xlsx') {
  const headers = [
    'Mã nhà cung cấp',
    'Tên nhà cung cấp',
    'Số chứng từ',
    'Ngày lập',
    'Ngày đến hạn',
    'Số tiền phải trả',
    'Đã trả',
    'Còn lại',
    'Tuổi nợ',
    'Trạng thái'
  ];

  const rows = data.rows.map((item: any) => ({
    ma_nha_cung_cap: item.supplierCode,
    ten_nha_cung_cap: item.supplierName,
    so_chung_tu: item.documentCode,
    ngay_lap: item.documentDate,
    ngay_den_han: item.dueDate,
    so_tien_phai_tra: item.originalAmount,
    da_tra: item.paidAmount,
    con_lai: item.outstandingAmount,
    tuoi_no: item.daysOverdue > 0 ? `${item.daysOverdue} ngày` : 'Đến hạn',
    trang_thai: item.agingBucket === 'CURRENT' ? 'Đến hạn' : 'Quá hạn'
  }));

  const footer = [
    { label: 'Tổng công nợ phải trả', value: data.summary.totalOutstanding },
    { label: 'Đến hạn', value: data.summary.current },
    { label: 'Quá hạn 1-30 ngày', value: data.summary.days1To30 },
    { label: 'Quá hạn 31-60 ngày', value: data.summary.days31To60 },
    { label: 'Quá hạn 61-90 ngày', value: data.summary.days61To90 },
    { label: 'Quá hạn trên 90 ngày', value: data.summary.over90 }
  ];

  return exportToExcel({
    fileName,
    sheetName: 'Công nợ phải trả',
    headers,
    rows,
    footer
  });
}
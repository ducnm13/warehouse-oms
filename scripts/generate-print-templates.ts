import ExcelJS from "exceljs";
import path from "node:path";
import {
  GENERIC_LAYOUT_ROWS,
  GENERIC_LAYOUTS,
  GENERIC_SIGNER_GROUP_STARTS,
  type GenericLayout,
} from "../src/lib/printTemplate";

const OUT_DIR = path.resolve(process.cwd(), "template_xlsx");
const THIN = { style: "thin" as const, color: { argb: "FF1F2937" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

const columnStarts = (layout: GenericLayout) => {
  const starts: Array<{ key: string; start: number; span: number }> = [];
  let column = 1;
  for (const definition of layout.columns) {
    starts.push({ key: definition.key, start: column, span: definition.span });
    column += definition.span;
  }
  return starts;
};

const buildWorkbook = (layout: GenericLayout) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Print");
  worksheet.columns = Array.from({ length: GENERIC_LAYOUT_ROWS.columnCount }, (_, index) => ({
    width: index === 0 ? 6 : 14,
  }));

  const mergeFull = (row: number) =>
    worksheet.mergeCells(row, 1, row, GENERIC_LAYOUT_ROWS.columnCount);
  const styleFull = (
    row: number,
    options: Partial<ExcelJS.Font> & { align?: ExcelJS.Alignment["horizontal"] },
  ) => {
    mergeFull(row);
    const { align, ...font } = options;
    const cell = worksheet.getCell(row, 1);
    cell.font = { ...font };
    cell.alignment = { horizontal: align || "center", vertical: "middle", wrapText: true };
  };

  worksheet.getRow(1).height = 22;
  styleFull(1, { bold: true, size: 14 });
  styleFull(2, { size: 10 });
  styleFull(3, { size: 10 });
  styleFull(4, { size: 10 });
  worksheet.getRow(5).height = 28;
  styleFull(5, { bold: true, size: 16 });

  worksheet.mergeCells(6, 1, 6, 4);
  worksheet.getCell(6, 1).value = "Số: ##Ma_phieu##";
  worksheet.mergeCells(6, 5, 6, GENERIC_LAYOUT_ROWS.columnCount);
  worksheet.getCell(6, 5).value = "Ngày ##dd## tháng ##mm## năm ##yyyy##";
  worksheet.getCell(6, 5).alignment = { horizontal: "right" };

  worksheet.mergeCells(7, 1, 7, 2);
  worksheet.getCell(7, 1).value = `${layout.partnerLabel}:`;
  worksheet.getCell(7, 1).font = { bold: true };
  worksheet.mergeCells(7, 3, 7, GENERIC_LAYOUT_ROWS.columnCount);
  worksheet.getCell(7, 3).value = "##Doi_tac##";

  worksheet.mergeCells(8, 1, 8, 2);
  worksheet.getCell(8, 1).value = "Diễn giải:";
  worksheet.getCell(8, 1).font = { bold: true };
  worksheet.mergeCells(8, 3, 8, GENERIC_LAYOUT_ROWS.columnCount);
  worksheet.getCell(8, 3).value = "##Dien_giai##";

  const { itemHeaderRow, dataStart, totalRow, wordsRow, signerLabelRow, signerNameRow } =
    GENERIC_LAYOUT_ROWS;
  const starts = columnStarts(layout);

  worksheet.getRow(itemHeaderRow).height = 26;
  for (const { key, start, span } of starts) {
    const definition = layout.columns.find(item => item.key === key)!;
    if (span > 1) worksheet.mergeCells(itemHeaderRow, start, itemHeaderRow, start + span - 1);
    const cell = worksheet.getCell(itemHeaderRow, start);
    cell.value = definition.header;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    for (let offset = 0; offset < span; offset++) {
      worksheet.getCell(itemHeaderRow, start + offset).border = BORDER;
    }
  }

  for (const { key, start, span } of starts) {
    if (span > 1) worksheet.mergeCells(dataStart, start, dataStart, start + span - 1);
    const cell = worksheet.getCell(dataStart, start);
    cell.value = key === "stt" ? 1 : `##${key}##`;
    cell.alignment = {
      horizontal: layout.columns.find(item => item.key === key)?.align || "left",
      vertical: "middle",
      wrapText: true,
    };
    for (let offset = 0; offset < span; offset++) {
      worksheet.getCell(dataStart, start + offset).border = BORDER;
    }
  }

  const totalStart = starts.find(item => item.key === (layout.totalKey || starts[starts.length - 1].key))?.start || 2;
  if (totalStart > 2) worksheet.mergeCells(totalRow, 2, totalRow, totalStart - 1);
  worksheet.getCell(totalRow, 2).value = "Cộng";
  worksheet.getCell(totalRow, 2).font = { bold: true };
  worksheet.getCell(totalRow, totalStart).font = { bold: true };
  worksheet.getCell(totalRow, totalStart).alignment = { horizontal: "right" };
  if (layout.totalKey) {
    worksheet.getCell(totalRow, totalStart).value = `##${layout.totalKey}_total##`;
  }

  worksheet.mergeCells(wordsRow, 1, wordsRow, 4);
  worksheet.getCell(wordsRow, 1).value = `${layout.totalLabel || "Tổng số tiền"}: ##Tong_tien_chu##`;
  worksheet.getCell(wordsRow, 1).font = { italic: true };

  layout.signers.forEach((signer, index) => {
    const start = GENERIC_SIGNER_GROUP_STARTS[index];
    const end = GENERIC_SIGNER_GROUP_STARTS[index + 1] - 1 || GENERIC_LAYOUT_ROWS.columnCount;
    worksheet.mergeCells(signerLabelRow, start, signerLabelRow, end);
    worksheet.getCell(signerLabelRow, start).value = signer.label;
    worksheet.getCell(signerLabelRow, start).font = { bold: true };
    worksheet.getCell(signerLabelRow, start).alignment = { horizontal: "center" };
    worksheet.mergeCells(signerNameRow, start, signerNameRow, end);
    worksheet.getCell(signerNameRow, start).value = "(Ký, họ tên)";
    worksheet.getCell(signerNameRow, start).alignment = { horizontal: "center" };
  });

  worksheet.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };
  return workbook;
};

const FILES: Record<string, string> = {
  purchase: "Chung-tu-mua-hang.xlsx",
  payment: "Phieu-thu-chi.xlsx",
  stocktake: "Bien-ban-kiem-ke.xlsx",
  salesReturn: "Phieu-tra-hang.xlsx",
  opening: "Phieu-ton-dau-ky.xlsx",
};

async function main() {
  for (const [key, fileName] of Object.entries(FILES)) {
    const layout = GENERIC_LAYOUTS[key];
    if (!layout) throw new Error(`Thiếu layout ${key}`);
    const workbook = buildWorkbook(layout);
    const target = path.join(OUT_DIR, fileName);
    await workbook.xlsx.writeFile(target);
    console.log(`Đã tạo ${target}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import toast from "../components/ui/toast";

export type ExcelColumn<T> = {
	header: string;
	value: (row: T) => string | number | null | undefined;
	width?: number;
};

export async function exportExcelFile<T>(
	filename: string,
	sheetName: string,
	columns: ExcelColumn<T>[],
	rows: T[],
) {
	if (!rows.length) {
		toast.error("Không có dữ liệu để xuất");
		return;
	}
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || "Danh sách");
	sheet.columns = columns.map(column => ({
		header: column.header,
		key: column.header,
		width: column.width || 20,
	}));
	for (const row of rows) {
		sheet.addRow(
			columns.map(column => {
				const value = column.value(row);
				return value === null || value === undefined ? "" : value;
			}),
		);
	}
	const head = sheet.getRow(1);
	head.font = { bold: true };
	head.eachCell(cell => {
		cell.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFEAECF0" },
		};
	});
	const buffer = await workbook.xlsx.writeBuffer();
	saveAs(new Blob([buffer]), filename);
	toast.success("Đã xuất Excel");
}

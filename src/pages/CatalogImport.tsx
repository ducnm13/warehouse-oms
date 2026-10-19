import { useQueryClient } from "@tanstack/react-query";
import toast from "../components/ui/toast";
import ExcelImportWizard, { type ExcelImportField } from "../components/ExcelImportWizard";
import { apiV1 } from "../lib/apiV1";

const FIELDS: ExcelImportField[] = [
	{ key: "sku", label: "Mã", description: "Mã vật tư hàng hóa, khóa chính", required: true, locked: true },
	{ key: "name", label: "Tên", description: "Tên vật tư hàng hóa", required: true, locked: true },
	{ key: "category", label: "Nhóm VTHH", description: "PRODUCT, MATERIAL, PACKAGING, SERVICE", required: false, locked: false },
	{ key: "primaryUnit", label: "Đơn vị tính", description: "Đơn vị tính chính", required: false, locked: false },
	{ key: "description", label: "Mô tả", description: "Mô tả hàng hóa", required: false, locked: false },
	{ key: "defaultWarehouseId", label: "Kho ngầm định", description: "ID kho mặc định", required: false, locked: false },
	{ key: "vatRate", label: "Thuế GTGT (%)", description: "Thuế suất GTGT", required: false, locked: false },
	{ key: "barcode", label: "Mã vạch", description: "Mã vạch sản phẩm", required: false, locked: false },
	{ key: "min_stock", label: "Tồn tối thiểu", description: "Mức tồn cảnh báo", required: false, locked: false },
	{ key: "packCount", label: "SL quy đổi (gói/hộp)", description: "Số gói trong 1 hộp/túi (VD hộp 10 gói = 10)", required: false, locked: false },
	{ key: "shelfLifeMonths", label: "HSD (tháng)", description: "Hạn sử dụng", required: false, locked: false },
	{ key: "priceCost", label: "Giá cost (vốn)", description: "Giá thành mua hoặc sản xuất", required: false, locked: false },
	{ key: "priceSale1", label: "Giá bán đại lý/NPP", description: "Giá cho đại lý và NPP", required: false, locked: false },
	{ key: "priceSale2", label: "Giá bán cao tốc", description: "Giá kênh cao tốc", required: false, locked: false },
	{ key: "priceSale3", label: "Giá bán lẻ", description: "Giá khách lẻ", required: false, locked: false },
];

export default function CatalogImport({ onBack }: { onBack: () => void }) {
	const qc = useQueryClient();
	return (
		<ExcelImportWizard
			title="Nhập danh mục hàng hóa từ Excel"
			subtitle="Chọn tệp, ghép cột, kiểm tra rồi nhập dữ liệu"
			fields={FIELDS}
			templateFileName="Mau_Danh_Muc_Hang_Hoa.xlsx"
			templateSheetName="Danh muc hang hoa"
			templateRows={[
				{ sku: "CLC2810", name: "Cà phê hòa tan COP28 3in1 - Hộp 10 gói", category: "PRODUCT", primaryUnit: "Hộp", description: "Hộp 10 gói", defaultWarehouseId: "", vatRate: 8, barcode: "893850000001", min_stock: 10, packCount: 10, shelfLifeMonths: 24, priceCost: 25000, priceSale1: 30000, priceSale2: 33000, priceSale3: 38000 },
				{ sku: "DUONG-KG", name: "Đường cát", category: "MATERIAL", primaryUnit: "kg", description: "Đường cát trắng", defaultWarehouseId: "", vatRate: 0, barcode: "", min_stock: 50, packCount: 1, shelfLifeMonths: 24, priceCost: 22000, priceSale1: 0, priceSale2: 0, priceSale3: 0 },
			]}
			validateRow={row => {
				const errors: string[] = [];
				if (row.category && !["PRODUCT", "MATERIAL", "PACKAGING", "SERVICE"].includes(row.category.trim())) errors.push("Nhóm VTHH không hợp lệ");
				for (const key of ["vatRate", "min_stock", "packCount", "shelfLifeMonths", "priceCost", "priceSale1", "priceSale2", "priceSale3", "defaultWarehouseId"]) {
					if (row[key] && Number.isNaN(Number(row[key]))) errors.push(`${key} phải là số`);
				}
				return errors;
			}}
			onImport={async ({ mode, rows }) => {
				const payloadRows = rows.map(row => ({
					sku: row.sku.trim(),
					name: row.name.trim(),
					category: (row.category.trim() || "PRODUCT") as "PRODUCT" | "MATERIAL" | "PACKAGING" | "SERVICE",
					primaryUnit: row.primaryUnit.trim() || "Cái",
					description: row.description.trim() || null,
					defaultWarehouseId: row.defaultWarehouseId ? Number(row.defaultWarehouseId) : null,
					vatRate: row.vatRate ? Number(row.vatRate) : 0,
					barcode: row.barcode.trim() || null,
					min_stock: row.min_stock ? Number(row.min_stock) : 0,
					packCount: row.packCount ? Number(row.packCount) : 1,
					shelfLifeMonths: row.shelfLifeMonths ? Number(row.shelfLifeMonths) : 24,
					priceCost: row.priceCost ? Number(row.priceCost) : 0,
					priceSale1: row.priceSale1 ? Number(row.priceSale1) : 0,
					priceSale2: row.priceSale2 ? Number(row.priceSale2) : 0,
					priceSale3: row.priceSale3 ? Number(row.priceSale3) : 0,
				}));
				const response = await apiV1<{ total: number; created: number; updated: number; skipped: number; deleted: number; errors: Array<{ row: number; sku: string; message: string }> }>(
					"/api/v1/catalog/products/import",
					{ method: "POST", body: JSON.stringify({ mode, rows: payloadRows }) },
				);
				toast.success(response.message);
				void qc.invalidateQueries({ queryKey: ["catalog-products"] });
				void qc.invalidateQueries({ queryKey: ["catalog-materials-all"] });
				return response.data;
			}}
			onDone={onBack}
			onBack={onBack}
		/>
	);
}

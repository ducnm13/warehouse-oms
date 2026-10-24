import type { Warehouse } from "../types";

const normalize = (value: string) =>
	value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.toLowerCase()
		.trim();

const isPackagingWarehouse = (warehouse: Warehouse) =>
	normalize(warehouse.name).includes("bao bi");
const byName = (list: Warehouse[], keyword: string) =>
	list.find(
		warehouse =>
			!isPackagingWarehouse(warehouse) &&
			normalize(warehouse.name).includes(keyword),
	)?.id;

/** Kho thành phẩm là mặc định cho mọi phiếu, trừ phiếu xuất của lệnh sản xuất. */
export function finishedGoodsWarehouseId(
	warehouses?: Warehouse[] | null,
): number {
	const list = warehouses ?? [];
	return (
		byName(list, "thanh pham") ??
		list.find(warehouse => !isPackagingWarehouse(warehouse))?.id ??
		list[0]?.id ??
		0
	);
}

/** Kho linh kiện/nguyên vật liệu, không bao giờ mặc định vào kho bao bì. */
export function componentWarehouseId(warehouses?: Warehouse[] | null): number {
	const list = warehouses ?? [];
	return (
		byName(list, "linh kien") ??
		byName(list, "nguyen lieu") ??
		byName(list, "vat tu") ??
		list.find(warehouse => !isPackagingWarehouse(warehouse))?.id ??
		list[0]?.id ??
		0
	);
}

/** Chỉ dùng cho phiếu xuất nguyên vật liệu của lệnh sản xuất. */
export function materialWarehouseId(warehouses?: Warehouse[] | null): number {
	const list = warehouses ?? [];
	return byName(list, "nguyen lieu") ?? 0;
}

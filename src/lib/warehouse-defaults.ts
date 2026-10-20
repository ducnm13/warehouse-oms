import type { Warehouse } from "../types";

const normalize = (value: string) =>
	value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.toLowerCase()
		.trim();

/** Kho thành phẩm là mặc định cho mọi phiếu, trừ phiếu xuất của lệnh sản xuất. */
export function finishedGoodsWarehouseId(
	warehouses?: Warehouse[] | null,
): number {
	const list = warehouses ?? [];
	return (
		list.find(warehouse => normalize(warehouse.name).includes("thanh pham"))
			?.id ??
		list[0]?.id ??
		0
	);
}

/** Chỉ dùng cho phiếu xuất nguyên vật liệu của lệnh sản xuất. */
export function materialWarehouseId(warehouses?: Warehouse[] | null): number {
	const list = warehouses ?? [];
	return (
		list.find(warehouse => normalize(warehouse.name).includes("nguyen lieu"))
			?.id ?? 0
	);
}

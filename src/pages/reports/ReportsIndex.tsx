import React from "react";
import { useNavigate } from "react-router-dom";
import {
	ArrowRightLeft,
	BarChart3,
	Boxes,
	ClipboardCheck,
	Factory,
	FileSpreadsheet,
	Gift,
	HandCoins,
	Landmark,
	Package,
	ShoppingBag,
	ShoppingCart,
	Store,
	TrendingUp,
	WalletCards,
} from "lucide-react";

const GROUPS: Array<{
	label: string;
	items: Array<{ title: string; description: string; path: string; icon: React.FC<any> }>;
}> = [
	{
		label: "Tài chính",
		items: [
			{ title: "Tổng quan tài chính", description: "Doanh thu, giá vốn, lợi nhuận, công nợ và tồn kho", path: "/reports/financial", icon: TrendingUp },
		],
	},
	{
		label: "Bán hàng",
		items: [
			{ title: "Doanh thu & lợi nhuận", description: "Doanh thu, giá vốn, lợi nhuận gộp theo đơn bán", path: "/reports/sales-profit", icon: ShoppingCart },
			{ title: "Theo khách hàng / nhóm", description: "Doanh thu và lợi nhuận theo khách hàng", path: "/reports/sales-customer", icon: HandCoins },
			{ title: "Theo sản phẩm", description: "Sản lượng, doanh thu theo mặt hàng – quy cách", path: "/reports/sales-product", icon: Package },
			{ title: "Trả hàng bán", description: "Danh sách phiếu trả hàng bán theo kỳ", path: "/reports/sales-returns", icon: FileSpreadsheet },
		],
	},
	{
		label: "Mua hàng",
		items: [
			{ title: "Theo nhà cung cấp", description: "Giá trị nhập hàng, công nợ phải trả theo NCC", path: "/reports/purchases-supplier", icon: ShoppingBag },
			{ title: "Theo mặt hàng", description: "Sản lượng và giá nhập bình quân theo mặt hàng", path: "/reports/purchases-product", icon: Package },
		],
	},
	{
		label: "Kho",
		items: [
			{ title: "Tổng hợp tồn kho", description: "Tồn đầu – nhập – xuất – tồn cuối theo kho", path: "/reports/inventory-summary", icon: Boxes },
			{ title: "Giá trị tồn & tồn thấp", description: "Giá trị tồn kho và cảnh báo hàng sắp hết", path: "/reports/stock-on-hand", icon: ClipboardCheck },
			{ title: "Sổ chi tiết vật tư", description: "Phát sinh nhập – xuất và số dư lũy kế một mã hàng", path: "/reports/item-ledger", icon: BarChart3 },
			{ title: "Chuyển kho", description: "Danh sách phiếu chuyển kho và sản lượng luân chuyển", path: "/reports/transfers", icon: ArrowRightLeft },
		],
	},
	{
		label: "Sản xuất",
		items: [
			{ title: "Tổng quan sản xuất", description: "Sản lượng kế hoạch và thực tế theo mặt hàng", path: "/reports/production-overview", icon: Factory },
			{ title: "Định mức vs thực tế", description: "Tiêu hao nguyên liệu định mức và thực tế", path: "/reports/production-variance", icon: BarChart3 },
			{ title: "Sản xuất – Lắp ráp – Tháo dỡ", description: "Tổng hợp chứng từ vận hành kho", path: "/reports/operations", icon: ArrowRightLeft },
		],
	},
	{
		label: "Công nợ",
		items: [
			{ title: "Công nợ phải thu", description: "Tuổi nợ khách hàng theo ngày chốt", path: "/reports/debt-receivable", icon: Landmark },
			{ title: "Công nợ phải trả", description: "Tuổi nợ nhà cung cấp theo ngày chốt", path: "/reports/debt-payable", icon: WalletCards },
		],
	},
	{
		label: "Khuyến mãi & Online",
		items: [
			{ title: "Sử dụng khuyến mãi", description: "Số đơn và quà tặng theo chương trình khuyến mãi", path: "/reports/promotions", icon: Gift },
			{ title: "Bán hàng online", description: "Doanh thu, đơn hàng và sản phẩm bán chạy online", path: "/reports/online", icon: Store },
		],
	},
];

export default function ReportsIndex() {
	const navigate = useNavigate();
	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Trung tâm báo cáo</h1>
					<p>Tổng hợp toàn bộ báo cáo tài chính, bán hàng, mua hàng, kho, sản xuất và công nợ</p>
				</div>
			</div>
			{GROUPS.map(group => (
				<div key={group.label} className="space-y-3">
					<h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-500">{group.label}</h2>
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{group.items.map(item => (
							<button
								key={item.path}
								onClick={() => navigate(item.path)}
								className="erp-card flex items-start gap-4 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
							>
								<span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#465fff]/10 text-[#465fff]">
									<item.icon size={20} />
								</span>
								<div className="min-w-0">
									<p className="font-semibold text-slate-800">{item.title}</p>
									<p className="mt-0.5 text-[12.5px] text-slate-500">{item.description}</p>
								</div>
							</button>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

import React, { useMemo, useState } from "react";
import {
	BarChart3,
	BookOpen,
	Boxes,
	ChevronRight,
	ClipboardList,
	Compass,
	Factory,
	HelpCircle,
	LayoutDashboard,
	MessageCircle,
	Search,
	ShieldCheck,
	ShoppingCart,
	Sparkles,
	Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { startGuidedTour } from "../components/GuidedTour";
import { getModuleAccess, type ModuleKey } from "../lib/permissions";
import type { User } from "../types";

interface GuideStep {
	title: string;
	body: string;
	modules?: ModuleKey[];
}

interface GuideSection {
	id: string;
	title: string;
	summary: string;
	icon: LucideIcon;
	modules?: ModuleKey[];
	steps: GuideStep[];
}

const SECTIONS: GuideSection[] = [
	{
		id: "bat-dau",
		title: "Bắt đầu & điều hướng",
		summary:
			"Làm quen thanh điều hướng, khu vực tài khoản, trạng thái chứng từ và cách mở lại hướng dẫn.",
		icon: Compass,
		steps: [
			{
				title: "Thanh điều hướng bên trái",
				body: "Các phân hệ được nhóm theo nghiệp vụ: Bán hàng, Mua hàng, Kho, Sản xuất, Báo cáo và Quản trị. Menu chỉ hiển thị những mục bạn có quyền truy cập.",
			},
			{
				title: "Khu vực header",
				body: "Góc phải header gồm nút tour hướng dẫn, nút trợ giúp mở trang wiki này, chuông nhật ký hoạt động (quản trị viên) và menu tài khoản cá nhân.",
			},
			{
				title: "Trạng thái chứng từ",
				body: "Phần lớn chứng từ đi theo luồng Nháp → Đã ghi sổ/Đã lưu → Đã hủy. Ghi sổ sẽ cập nhật tồn kho, sổ cái và công nợ; chứng từ đã ghi sổ thường không sửa trực tiếp mà cần hủy hoặc nhân bản.",
			},
			{
				title: "Tìm kiếm và bộ lọc",
				body: "Mỗi danh sách đều có ô tìm kiếm theo mã, tên đối tác hoặc diễn giải. Kết hợp thêm bộ lọc trạng thái, khoảng ngày và kho để thu hẹp dữ liệu.",
			},
			{
				title: "Mở lại tour hướng dẫn",
				body: "Bấm nút la bàn trên header hoặc nút “Bắt đầu tour” trong trang này. Tour sẽ tự chuyển trang và chỉ dẫn từng khu vực chức năng.",
			},
		],
	},
	{
		id: "tong-quan",
		title: "Tổng quan tài chính",
		summary:
			"Nắm nhanh doanh thu, chi phí, công nợ và tồn kho trên một màn hình.",
		icon: LayoutDashboard,
		modules: ["dashboard"],
		steps: [
			{
				title: "Thẻ chỉ số",
				body: "Các thẻ phía trên tổng hợp doanh thu, chi phí, công nợ phải thu/phải trả và giá trị tồn kho theo dữ liệu vận hành hiện tại.",
			},
			{
				title: "Biểu đồ xu hướng",
				body: "Biểu đồ so sánh doanh thu và chi phí 6 tháng gần nhất, giúp phát hiện tháng tăng trưởng hoặc chi phí bất thường.",
			},
			{
				title: "Điều hướng nhanh",
				body: "Từ các con số tổng quan, mở phân hệ tương ứng để xem chi tiết chứng từ nguồn. Số liệu được tổng hợp lại mỗi khi dữ liệu thay đổi.",
			},
		],
	},
	{
		id: "ban-hang",
		title: "Bán hàng",
		summary:
			"Quản lý đơn bán, đơn online, khuyến mãi, trả hàng, khách hàng và công nợ phải thu.",
		icon: ShoppingCart,
		modules: ["sales", "online", "promotions", "salesReturns", "customers", "debt"],
		steps: [
			{
				title: "Lập đơn bán",
				modules: ["sales"],
				body: "Vào Bán hàng → Thêm đơn bán. Chọn khách hàng, bảng giá, ngày đơn, thêm sản phẩm và số lượng. Kiểm tra chiết khấu, tổng tiền rồi Lưu nháp hoặc Ghi sổ.",
			},
			{
				title: "Xử lý đơn bán",
				modules: ["sales"],
				body: "Menu Chức năng trên từng dòng cho phép xem chi tiết, sửa đơn nháp, ghi sổ, hủy, in chứng từ hoặc nhân bản đơn. Đơn đã ghi sổ sẽ tạo bút toán kho và công nợ.",
			},
			{
				title: "Đơn hàng online",
				modules: ["online"],
				body: "Trang Đơn online có các tab Tổng quan, Tạo đơn mới, Đơn hàng & Đóng gói, Sản phẩm và Báo cáo. Dùng menu Chức năng để đóng gói, giao vận chuyển và cập nhật mã vận đơn.",
			},
			{
				title: "Khuyến mãi",
				modules: ["promotions"],
				body: "Tạo chương trình với thời gian, phạm vi áp dụng và điều kiện giảm giá. Trạng thái gồm Nháp, Đang áp dụng và Ngừng áp dụng.",
			},
			{
				title: "Trả hàng",
				modules: ["salesReturns"],
				body: "Lập phiếu trả hàng từ đơn bán, chọn sản phẩm và số lượng trả. Khi ghi sổ, hệ thống nhập lại kho và điều chỉnh doanh thu/công nợ theo cấu hình.",
			},
			{
				title: "Khách hàng & công nợ",
				modules: ["customers", "debt"],
				body: "Quản lý hồ sơ khách hàng, nhóm khách hàng và hạn mức công nợ. Trang Công nợ theo dõi số dư phải thu, lịch sử phát sinh và các lần thanh toán.",
			},
		],
	},
	{
		id: "mua-hang",
		title: "Mua hàng & nhà cung cấp",
		summary:
			"Lập chứng từ mua, theo dõi công nợ phải trả và liên kết với phiếu nhập kho.",
		icon: Truck,
		modules: ["purchases", "suppliers"],
		steps: [
			{
				title: "Lập chứng từ mua",
				modules: ["purchases"],
				body: "Vào Mua hàng → tạo chứng từ mới. Chọn nhà cung cấp, ngày chứng từ, thêm hàng hóa với số lượng và đơn giá. Lưu nháp để kiểm tra hoặc ghi sổ ngay.",
			},
			{
				title: "Ghi sổ và nhập kho",
				modules: ["purchases"],
				body: "Khi ghi sổ, chứng từ mua có thể tạo phiếu nhập kho tương ứng và ghi nhận công nợ phải trả cho nhà cung cấp.",
			},
			{
				title: "Nhà cung cấp",
				modules: ["suppliers"],
				body: "Quản lý thông tin liên hệ, mã số thuế, điều khoản thanh toán và lịch sử giao dịch với từng nhà cung cấp.",
			},
		],
	},
	{
		id: "kho",
		title: "Quản lý kho",
		summary:
			"Nhập kho, xuất kho, chuyển kho, kiểm kê, tồn đầu kỳ, danh mục hàng hóa và bảng giá.",
		icon: Boxes,
		modules: [
			"import",
			"export",
			"transfers",
			"stocktake",
			"opening",
			"catalog",
			"priceBooks",
			"warehouses",
		],
		steps: [
			{
				title: "Nhập kho",
				modules: ["import"],
				body: "Vào Kho → Nhập kho, tạo phiếu với kho nhận, đối tác và danh sách hàng hóa. Ghi sổ phiếu sẽ tăng tồn kho và ghi nhật ký thẻ kho.",
			},
			{
				title: "Xuất kho",
				modules: ["export"],
				body: "Tạo phiếu xuất với kho xuất, đối tác và hàng hóa. Hệ thống kiểm tra tồn khả dụng trước khi ghi sổ để tránh xuất âm kho.",
			},
			{
				title: "Chuyển kho",
				modules: ["transfers"],
				body: "Chọn kho nguồn trước để danh sách sản phẩm chỉ hiển thị hàng còn tồn, sau đó chọn kho đích và số lượng. Phiếu đi qua bước xác nhận xuất kho và xác nhận đã nhận hàng.",
			},
			{
				title: "Kiểm kê kho",
				modules: ["stocktake"],
				body: "Lập biên bản kiểm kê theo kho và ngày, nhập số lượng thực tế. Hệ thống tính chênh lệch so với sổ sách; sau khi ghi sổ sẽ điều chỉnh tồn kho.",
			},
			{
				title: "Tồn kho đầu kỳ",
				modules: ["opening"],
				body: "Khai báo số lượng và đơn giá vốn cho từng kho tại thời điểm bắt đầu sử dụng hệ thống. Biên bản có thể nhập từ Excel hoặc in lại.",
			},
			{
				title: "Danh mục hàng hóa",
				modules: ["catalog"],
				body: "Quản lý sản phẩm, SKU, đơn vị tính và nhiều quy cách đóng gói. Mỗi quy cách có mã riêng, trọng lượng và giá vốn/giá bán.",
			},
			{
				title: "Bảng giá & kho hàng",
				modules: ["priceBooks", "warehouses"],
				body: "Thiết lập bảng giá áp dụng cho khách hàng và quản lý danh sách kho. Bảng giá giúp tính đơn bán nhanh và nhất quán.",
			},
		],
	},
	{
		id: "san-xuat",
		title: "Sản xuất & lắp ráp",
		summary:
			"Quản lý lệnh sản xuất, định mức nguyên vật liệu, lắp ráp và tháo dỡ thành phẩm.",
		icon: Factory,
		modules: ["production", "productionMgmt", "assembly"],
		steps: [
			{
				title: "Lệnh sản xuất",
				modules: ["production"],
				body: "Tạo lệnh với thành phẩm, số lượng kế hoạch và định mức nguyên vật liệu. Theo dõi tiến độ từ nháp đến đang sản xuất và hoàn thành.",
			},
			{
				title: "Quản lý sản xuất",
				modules: ["productionMgmt"],
				body: "Lọc theo tháng và trạng thái, tìm theo mã lệnh. Mở chi tiết để bổ sung thông tin mẻ, phân bổ SKU, nhập số lượng thực tế và chốt nhập kho.",
			},
			{
				title: "Lắp ráp & tháo dỡ",
				modules: ["assembly"],
				body: "Lệnh lắp ráp chuyển linh kiện thành thành phẩm; lệnh tháo dỡ làm ngược lại. Mỗi lệnh gắn kho linh kiện, kho thành phẩm và tạo phiếu xuất/nhập liên kết.",
			},
			{
				title: "In lệnh",
				modules: ["production", "productionMgmt", "assembly"],
				body: "Trong chi tiết lệnh, chọn In để xem trước. Lệnh sản xuất và lệnh lắp ráp/tháo dỡ dùng mẫu in riêng, thể hiện thành phẩm, linh kiện và giá trị liên quan.",
			},
		],
	},
	{
		id: "bao-cao",
		title: "Báo cáo & thống kê",
		summary:
			"Tổng hợp báo cáo tài chính, bán hàng, mua hàng, kho, sản xuất, công nợ và online.",
		icon: BarChart3,
		modules: ["reports"],
		steps: [
			{
				title: "Chọn nhóm báo cáo",
				body: "Vào Báo cáo, chọn nhóm phù hợp: tài chính, lợi nhuận bán hàng, doanh số theo khách/sản phẩm, mua hàng, tồn kho, thẻ kho, chuyển kho, sản xuất, công nợ, khuyến mãi hoặc online.",
			},
			{
				title: "Lọc dữ liệu",
				body: "Mỗi báo cáo có bộ lọc thời gian và đối tượng riêng như kho, khách hàng, nhà cung cấp hoặc sản phẩm. Thay đổi bộ lọc để cập nhật bảng và biểu đồ.",
			},
			{
				title: "Xuất dữ liệu",
				body: "Các báo cáo hỗ trợ xuất Excel để đối chiếu hoặc gửi kế toán. Kiểm tra lại khoảng ngày và bộ lọc trước khi xuất.",
			},
		],
	},
	{
		id: "tin-nhan",
		title: "Tin nhắn nội bộ",
		summary:
			"Trao đổi với đồng nghiệp, gửi tệp và theo dõi hội thoại ngay trong phần mềm.",
		icon: MessageCircle,
		steps: [
			{
				title: "Bắt đầu hội thoại",
				body: "Bấm nút tạo hội thoại mới, chọn đồng nghiệp và gửi tin nhắn. Danh sách hội thoại hiển thị tin chưa đọc và thời gian cập nhật.",
			},
			{
				title: "Gửi tệp và phản hồi",
				body: "Trong khung soạn tin, bạn có thể đính kèm tệp, trả lời nhanh và theo dõi trạng thái gửi. Nội dung được đồng bộ theo thời gian thực.",
			},
		],
	},
	{
		id: "quan-tri",
		title: "Quản trị hệ thống",
		summary:
			"Quản lý người dùng, vai trò, thông tin công ty, mẫu in, nhật ký và công cụ kỹ thuật.",
		icon: ShieldCheck,
		modules: ["users", "roles", "company", "auditLogs", "devTools"],
		steps: [
			{
				title: "Người dùng & vai trò",
				modules: ["users", "roles"],
				body: "Tạo tài khoản, gán vai trò và kiểm soát quyền truy cập theo phân hệ. Vai trò quyết định menu và thao tác được phép thực hiện.",
			},
			{
				title: "Thông tin công ty",
				modules: ["company"],
				body: "Cập nhật tên, địa chỉ, mã số thuế, logo và mẫu chữ ký. Thông tin này xuất hiện trên các mẫu in chứng từ.",
			},
			{
				title: "Nhật ký hoạt động",
				modules: ["auditLogs"],
				body: "Quản trị viên xem lịch sử thao tác qua chuông thông báo hoặc trang Nhật ký. Dùng để tra soát khi có sai lệch dữ liệu.",
			},
			{
				title: "Dev Tools",
				modules: ["devTools"],
				body: "Chỉ dành cho quản trị viên kỹ thuật. Cho phép xem thông tin máy chủ, truy vấn dữ liệu và sửa/xóa dòng. Thao tác tại đây ảnh hưởng trực tiếp nên cần sao lưu trước khi dùng.",
			},
		],
	},
	{
		id: "meo",
		title: "Mẹo sử dụng & in chứng từ",
		summary:
			"Một số thao tác giúp làm việc nhanh hơn và tránh lỗi thường gặp.",
		icon: Sparkles,
		steps: [
			{
				title: "Kiểm tra trước khi ghi sổ",
				body: "Luôn kiểm tra kho, đối tác, số lượng và đơn giá ở chế độ nháp. Ghi sổ là bước làm thay đổi tồn kho và công nợ nên khó hoàn tác.",
			},
			{
				title: "In chứng từ",
				body: "Dùng menu Chức năng → In để mở bản xem trước. Bản xem trước lấy dữ liệu mới nhất của chứng từ; kiểm tra khổ giấy và thông tin công ty trước khi in.",
			},
			{
				title: "Tìm kiếm nhanh",
				body: "Ưu tiên tìm theo mã chứng từ hoặc tên đối tác. Với danh sách dài, kết hợp bộ lọc trạng thái và ngày để giảm số kết quả.",
			},
			{
				title: "Cần hỗ trợ thêm?",
				body: "Mở lại tour hướng dẫn bằng nút la bàn trên header, hoặc quay lại trang wiki này bất cứ lúc nào bằng nút trợ giúp cạnh chuông thông báo.",
			},
		],
	},
];

const normalize = (value: string) =>
	value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");

export default function UserGuide({ user }: { user: User | null }) {
	const [query, setQuery] = useState("");
	const filtered = useMemo(() => {
		const access = getModuleAccess(user?.role, user?.permissions);
		const keyword = normalize(query.trim());
		const permitted = SECTIONS.map(section => {
			const steps = section.steps.filter(
				step =>
					!step.modules ||
					step.modules.some(module => access[module]),
			);
			return { ...section, steps };
		}).filter(
			section =>
				(!section.modules ||
					section.modules.some(module => access[module])) &&
				section.steps.length > 0,
		);
		if (!keyword) return permitted;
		return permitted.filter(section => {
			const haystack = [
				section.title,
				section.summary,
				...section.steps.flatMap(step => [step.title, step.body]),
			].join(" ");
			return normalize(haystack).includes(keyword);
		});
	}, [query, user?.role, user?.permissions]);

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1 className="flex items-center gap-2">
						<BookOpen className="text-[#422afb]" size={24} />
						Hướng dẫn sử dụng
					</h1>
					<p>
						Wiki vận hành Challenge ERP: quy trình, chức năng và mẹo xử lý
						theo từng phân hệ.
					</p>
				</div>
				<button
					type="button"
					className="erp-btn erp-btn-primary"
					onClick={startGuidedTour}
				>
					<Compass size={16} /> Bắt đầu tour
				</button>
			</div>

			<div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
				<div className="custom-scrollbar min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
					<div className="erp-card overflow-hidden">
						<div className="p-4 pb-2">
							<div className="relative">
								<Search
									size={15}
									className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
								/>
								<input
									value={query}
									onChange={event => setQuery(event.target.value)}
									placeholder="Tìm chức năng..."
									style={{ paddingLeft: "38px" }}
									className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 text-sm text-slate-700 outline-none transition focus:border-[#422afb] focus:bg-white"
								/>
							</div>
							<p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
								Mục lục · {filtered.length} mục
							</p>
						</div>
						<nav className="space-y-1 px-2 pb-3">
							{filtered.map(section => {
								const Icon = section.icon;
								return (
									<a
										key={section.id}
										href={`#${section.id}`}
										className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[12.5px] font-semibold text-slate-600 transition hover:bg-[#f4f7fe] hover:text-[#422afb]"
									>
										<Icon size={15} className="shrink-0 text-[#a3aed0]" />
										<span className="min-w-0 flex-1 truncate">
											{section.title}
										</span>
										<ChevronRight size={13} className="text-slate-300" />
									</a>
								);
							})}
						</nav>
						<div className="space-y-2 border-t border-slate-100 bg-slate-50/70 p-4 text-[12px] leading-relaxed text-slate-500">
							<p className="flex items-center gap-2 font-bold text-slate-700">
								<HelpCircle size={15} className="text-[#422afb]" /> Cần trợ
								giúp?
							</p>
							<p>
								Mở tour hướng dẫn để được chỉ dẫn trực tiếp trên từng trang.
								Nếu vẫn vướng mắc, liên hệ quản trị viên hệ thống.
							</p>
						</div>
					</div>
				</div>

				<div className="min-w-0 space-y-5">
					{filtered.length === 0 ? (
						<div className="erp-card p-10 text-center">
							<Search className="mx-auto mb-3 text-slate-300" size={40} />
							<p className="font-bold text-slate-700">
								Không tìm thấy nội dung phù hợp
							</p>
							<p className="mt-1 text-sm text-slate-500">
								Thử từ khóa khác như “chuyển kho”, “công nợ” hoặc “in chứng
								từ”.
							</p>
						</div>
					) : (
						filtered.map((section, index) => {
							const Icon = section.icon;
							return (
								<section
									key={section.id}
									id={section.id}
									className="erp-card scroll-mt-24 overflow-hidden"
								>
									<div className="flex items-start gap-4 border-b border-slate-100 p-5">
										<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e9e3ff] text-[#422afb]">
											<Icon size={21} />
										</div>
										<div className="min-w-0">
											<p className="text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
												Mục {index + 1}
											</p>
											<h2 className="mt-0.5 text-[17px] font-black text-slate-800">
												{section.title}
											</h2>
											<p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
												{section.summary}
											</p>
										</div>
									</div>
									<ol className="divide-y divide-slate-100">
										{section.steps.map((step, stepIndex) => (
											<li
												key={step.title}
												className="flex gap-4 p-5 transition-colors hover:bg-slate-50/70"
											>
												<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-black text-slate-600">
													{stepIndex + 1}
												</span>
												<div className="min-w-0">
													<h3 className="text-[13.5px] font-bold text-slate-800">
														{step.title}
													</h3>
													<p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
														{step.body}
													</p>
												</div>
											</li>
										))}
									</ol>
								</section>
							);
						})
					)}

					<div className="erp-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-start gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
								<ClipboardList size={19} />
							</div>
							<div>
								<p className="text-sm font-bold text-slate-800">
									Không tìm thấy quy trình bạn cần?
								</p>
								<p className="text-[12px] text-slate-500">
									Mở tour hướng dẫn hoặc liên hệ bộ phận vận hành để được hỗ
									trợ.
								</p>
							</div>
						</div>
						<button
							type="button"
							className="erp-btn erp-btn-primary shrink-0"
							onClick={startGuidedTour}
						>
							<Compass size={16} /> Xem tour
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

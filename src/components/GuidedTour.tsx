import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
	ChevronLeft,
	ChevronRight,
	Compass,
	PartyPopper,
	X,
} from "lucide-react";
import { getModuleAccess, type ModuleKey } from "../lib/permissions";
import type { User } from "../types";

type Placement = "right" | "left" | "bottom" | "top";

interface TourStep {
	target?: string;
	title: string;
	description: string;
	placement?: Placement;
	path?: string;
}

const STORAGE_KEY = "erp_guided_tour_done_v1";
const START_EVENT = "erp:start-tour";

const PATH_MODULES: Record<string, ModuleKey> = {
	"/dashboard": "dashboard",
	"/sales-orders": "sales",
	"/online-orders": "online",
	"/purchases": "purchases",
	"/inventory-import": "import",
	"/warehouse-transfers": "transfers",
	"/production-mgmt": "productionMgmt",
	"/assembly": "assembly",
	"/stock-take": "stocktake",
	"/opening-inventory": "opening",
	"/reports": "reports",
	"/chat": "chat",
	"/dev-tools": "devTools",
};

const STEPS: TourStep[] = [
	{
		target: '[data-tour="header"]',
		title: "Chào mừng đến với ERP Challenge",
		description:
			"Đây là khu vực điều hướng chung: tour hướng dẫn, trang wiki trợ giúp, nhật ký hoạt động và tài khoản cá nhân của bạn. Tour ngắn này sẽ giúp bạn làm quen các phân hệ chính.",
		placement: "bottom",
	},
	{
		target: '[data-tour="/dashboard"]',
		title: "Tổng quan",
		description:
			"Bảng điều khiển tổng hợp doanh thu, công nợ, tồn kho và các hoạt động gần đây để bạn nắm tình hình nhanh chóng.",
		placement: "right",
		path: "/dashboard",
	},
	{
		target: ".erp-page-header",
		title: "Tổng quan tài chính",
		description:
			"Khu vực tiêu đề cho biết phạm vi dữ liệu đang xem. Các chỉ số bên dưới được tổng hợp theo tháng hiện tại và cập nhật khi bạn đổi bộ lọc.",
		placement: "bottom",
		path: "/dashboard",
	},
	{
		target: ".erp-stat, .erp-card",
		title: "Thẻ số liệu và biểu đồ",
		description:
			"Các thẻ doanh thu, chi phí, công nợ, tồn kho giúp nắm nhanh tình hình. Biểu đồ so sánh xu hướng 6 tháng gần nhất để phát hiện biến động.",
		placement: "bottom",
		path: "/dashboard",
	},
	{
		target: '[data-tour="/sales-orders"]',
		title: "Bán hàng",
		description:
			"Tạo đơn bán, quản lý khách hàng, khuyến mãi và trả hàng. Đơn bán sau khi lưu sẽ tự động cập nhật tồn kho và công nợ.",
		placement: "right",
		path: "/sales-orders",
	},
	{
		target: ".erp-page-header",
		title: "Khu vực bán hàng",
		description:
			"Tiêu đề trang và nút Thêm đơn bán là điểm bắt đầu. Các thẻ phía dưới tóm tắt số chứng từ, đơn đã lưu và doanh số trong trang hiện tại.",
		placement: "bottom",
		path: "/sales-orders",
	},
	{
		target: ".erp-page-header button",
		title: "Tạo đơn bán",
		description:
			"Bấm Thêm đơn bán để mở form: chọn khách hàng, bảng giá, ngày đơn và thêm sản phẩm. Lưu nháp trước hoặc ghi sổ ngay để xuất kho và ghi công nợ.",
		placement: "bottom",
		path: "/sales-orders",
	},
	{
		target: ".erp-search",
		title: "Tìm kiếm đơn bán",
		description:
			"Lọc nhanh theo số đơn, tên khách hàng hoặc số điện thoại. Kết hợp với bộ lọc trạng thái và khoảng ngày để thu hẹp danh sách.",
		placement: "bottom",
		path: "/sales-orders",
	},
	{
		target: ".erp-table",
		title: "Danh sách chứng từ",
		description:
			"Mỗi dòng là một đơn bán. Menu Chức năng cho phép xem chi tiết, sửa nháp, ghi sổ, hủy, in hoặc nhân bản đơn.",
		placement: "top",
		path: "/sales-orders",
	},
	{
		target: '[data-tour="/online-orders"]',
		title: "Đơn hàng online",
		description:
			"Theo dõi đơn online, đóng gói và giao vận chuyển. Các thao tác xử lý đơn nằm trong menu Chức năng của từng dòng.",
		placement: "right",
		path: "/online-orders",
	},
	{
		target: ".erp-page-header",
		title: "Bán hàng online",
		description:
			"Trang gom đơn online, đóng gói, sản phẩm và báo cáo trong cùng một nơi. Số liệu phía trên thay đổi theo tab đang chọn.",
		placement: "bottom",
		path: "/online-orders",
	},
	{
		target: '[data-tour="online-tabs"]',
		title: "Các tab xử lý",
		description:
			"Chuyển giữa Tổng quan, Tạo đơn mới, Đơn hàng & Đóng gói, Sản phẩm và Báo cáo. Tab Đơn hàng & Đóng gói là nơi đóng gói và chuyển giao vận chuyển.",
		placement: "bottom",
		path: "/online-orders",
	},
	{
		target: ".erp-search, .erp-table",
		title: "Danh sách và thao tác",
		description:
			"Tìm đơn theo mã hoặc khách hàng, sau đó dùng menu Chức năng trên từng dòng để đóng gói, giao vận chuyển hoặc cập nhật mã vận đơn.",
		placement: "top",
		path: "/online-orders",
	},
	{
		target: '[data-tour="/purchases"]',
		title: "Mua hàng",
		description:
			"Lập phiếu mua hàng từ nhà cung cấp, theo dõi công nợ phải trả và liên kết với phiếu nhập kho.",
		placement: "right",
		path: "/purchases",
	},
	{
		target: ".erp-page-header",
		title: "Khu vực mua hàng",
		description:
			"Quản lý chứng từ mua hàng và nhà cung cấp. Nút tạo phiếu nằm ngay trên tiêu đề trang.",
		placement: "bottom",
		path: "/purchases",
	},
	{
		target: ".erp-page-header button",
		title: "Lập chứng từ mua hàng",
		description:
			"Chọn nhà cung cấp, ngày chứng từ và danh sách hàng hóa. Sau khi ghi sổ, hệ thống có thể tạo phiếu nhập kho và ghi nhận công nợ phải trả.",
		placement: "bottom",
		path: "/purchases",
	},
	{
		target: ".erp-search",
		title: "Tìm chứng từ mua",
		description:
			"Tìm theo số chứng từ, nhà cung cấp hoặc diễn giải. Dùng thêm bộ lọc trạng thái để xem nháp, đã ghi sổ hoặc đã hủy.",
		placement: "bottom",
		path: "/purchases",
	},
	{
		target: ".erp-table",
		title: "Danh sách chứng từ mua",
		description:
			"Mở menu Chức năng để xem chi tiết, sửa, ghi sổ, hủy, in hoặc nhân bản chứng từ. Trạng thái và công nợ được cập nhật ngay trên dòng.",
		placement: "top",
		path: "/purchases",
	},
	{
		target: '[data-tour="/inventory-import"]',
		title: "Nhập kho & Xuất kho",
		description:
			"Quản lý phiếu nhập, phiếu xuất và chuyển kho. Mọi biến động đều được ghi vào sổ kho để đối soát.",
		placement: "right",
		path: "/inventory-import",
	},
	{
		target: ".erp-page-header",
		title: "Phiếu nhập / xuất kho",
		description:
			"Chuyển giữa Nhập kho và Xuất kho bằng các tab trên trang. Mỗi loại phiếu có quy trình lập, ghi sổ và hủy riêng.",
		placement: "bottom",
		path: "/inventory-import",
	},
	{
		target: ".erp-page-header button",
		title: "Tạo phiếu kho",
		description:
			"Chọn kho, đối tác và thêm hàng hóa. Ghi sổ phiếu sẽ cập nhật tồn kho và sổ cái kho ngay lập tức.",
		placement: "bottom",
		path: "/inventory-import",
	},
	{
		target: ".erp-search",
		title: "Tìm phiếu kho",
		description:
			"Lọc theo số phiếu, đối tác hoặc diễn giải; kết hợp trạng thái để nhanh chóng tìm phiếu cần xử lý.",
		placement: "bottom",
		path: "/inventory-import",
	},
	{
		target: ".erp-table",
		title: "Danh sách phiếu kho",
		description:
			"Menu Chức năng cho phép xem chi tiết, in, ghi sổ, hủy hoặc nhân bản phiếu. Cột giá trị giúp đối chiếu nhanh với kế toán.",
		placement: "top",
		path: "/inventory-import",
	},
	{
		target: '[data-tour="/warehouse-transfers"]',
		title: "Chuyển kho",
		description:
			"Chuyển hàng giữa các kho với danh sách sản phẩm được lọc theo tồn kho nguồn, sau đó theo dõi trạng thái nhận hàng.",
		placement: "right",
		path: "/warehouse-transfers",
	},
	{
		target: ".erp-page-header",
		title: "Phiếu chuyển kho",
		description:
			"Quản lý luồng chuyển hàng giữa các kho. Mỗi phiếu đi qua các bước lập, xuất kho nguồn, nhận hàng và hoàn tất.",
		placement: "bottom",
		path: "/warehouse-transfers",
	},
	{
		target: ".erp-page-header button",
		title: "Tạo phiếu chuyển kho",
		description:
			"Chọn kho nguồn trước để danh sách sản phẩm chỉ hiển thị hàng còn tồn. Sau đó chọn kho đích, số lượng và lưu phiếu.",
		placement: "bottom",
		path: "/warehouse-transfers",
	},
	{
		target: ".erp-search",
		title: "Theo dõi phiếu chuyển",
		description:
			"Tìm theo số phiếu, kho hoặc người tạo. Trạng thái cho biết phiếu đang chờ xuất, đang vận chuyển hay đã nhận.",
		placement: "bottom",
		path: "/warehouse-transfers",
	},
	{
		target: ".erp-table",
		title: "Danh sách phiếu chuyển",
		description:
			"Dùng menu Chức năng để in phiếu, xác nhận xuất kho, xác nhận đã nhận hàng hoặc hủy phiếu khi cần.",
		placement: "top",
		path: "/warehouse-transfers",
	},
	{
		target: '[data-tour="/production-mgmt"]',
		title: "Sản xuất",
		description:
			"Quản lý lệnh sản xuất, bổ sung thông tin mẻ, nhập số lượng thực tế và chốt lệnh. Phiếu nhập/xuất kho được lập kèm theo.",
		placement: "right",
		path: "/production-mgmt",
	},
	{
		target: ".erp-page-header",
		title: "Quản lý sản xuất",
		description:
			"Theo dõi lệnh sản xuất theo tháng và trạng thái. Mỗi lệnh có thông tin mẻ, SKU thành phẩm và định mức nguyên vật liệu.",
		placement: "bottom",
		path: "/production-mgmt",
	},
	{
		target: ".erp-card.p-1",
		title: "Bộ lọc tháng và trạng thái",
		description:
			"Chọn tháng và trạng thái để thu hẹp danh sách lệnh. Ô tìm kiếm bên cạnh lọc theo mã lệnh hoặc số lô.",
		placement: "bottom",
		path: "/production-mgmt",
	},
	{
		target: ".erp-table",
		title: "Danh sách lệnh sản xuất",
		description:
			"Mở chi tiết để Bổ sung thông tin, phân bổ SKU, nhập số lượng thực tế và chốt nhập kho. Trạng thái phản ánh tiến độ xử lý.",
		placement: "top",
		path: "/production-mgmt",
	},
	{
		target: '[data-tour="/assembly"]',
		title: "Lắp ráp & Tháo dỡ",
		description:
			"Quản lý lệnh lắp ráp thành phẩm từ linh kiện và lệnh tháo dỡ thành phẩm thành các bộ phận, kèm phiếu xuất/nhập kho liên kết.",
		placement: "right",
		path: "/assembly",
	},
	{
		target: ".erp-page-header",
		title: "Lệnh lắp ráp / tháo dỡ",
		description:
			"Chuyển giữa hai tab Lắp ráp và Tháo dỡ. Mỗi lệnh ghi rõ kho linh kiện, kho thành phẩm và định mức tương ứng.",
		placement: "bottom",
		path: "/assembly",
	},
	{
		target: ".erp-page-header button",
		title: "Tạo lệnh lắp ráp",
		description:
			"Chọn thành phẩm hoặc linh kiện nguồn, số lượng và kho áp dụng. Sau khi lưu, bạn có thể tạo phiếu xuất linh kiện và nhập thành phẩm.",
		placement: "bottom",
		path: "/assembly",
	},
	{
		target: ".erp-table",
		title: "Danh sách lệnh",
		description:
			"Mở chi tiết để xem thành phẩm, linh kiện, giá vốn và các phiếu kho liên kết. Menu Chức năng cho phép sửa, ghi sổ, hủy hoặc in lệnh.",
		placement: "top",
		path: "/assembly",
	},
	{
		target: '[data-tour="/stock-take"]',
		title: "Kiểm kê kho",
		description:
			"Lập biên bản kiểm kê, ghi nhận tồn thực tế và chênh lệch so với sổ sách. Biên bản có thể in trực tiếp sau khi hoàn tất.",
		placement: "right",
		path: "/stock-take",
	},
	{
		target: ".erp-page-header",
		title: "Biên bản kiểm kê",
		description:
			"Chọn kho và ngày kiểm kê, sau đó nhập số lượng thực tế cho từng sản phẩm. Hệ thống tự tính chênh lệch và giá trị.",
		placement: "bottom",
		path: "/stock-take",
	},
	{
		target: ".erp-table",
		title: "Danh sách biên bản",
		description:
			"Mở biên bản để cập nhật hoặc in. Dùng menu Chức năng để ghi sổ điều chỉnh tồn kho khi đã kiểm kê xong.",
		placement: "top",
		path: "/stock-take",
	},
	{
		target: '[data-tour="/opening-inventory"]',
		title: "Tồn kho đầu kỳ",
		description:
			"Khai báo số lượng và giá vốn tồn đầu kỳ cho từng kho. Dữ liệu này là mốc ban đầu cho các báo cáo tồn kho.",
		placement: "right",
		path: "/opening-inventory",
	},
	{
		target: ".erp-page-header",
		title: "Biên bản tồn đầu kỳ",
		description:
			"Mỗi biên bản gắn với một kho và ngày hiệu lực. Sau khi ghi sổ, tồn kho và giá vốn đầu kỳ được ghi nhận vào hệ thống.",
		placement: "bottom",
		path: "/opening-inventory",
	},
	{
		target: ".erp-page-header button",
		title: "Tạo biên bản tồn đầu kỳ",
		description:
			"Chọn kho, ngày và thêm sản phẩm với số lượng, đơn giá vốn. Có thể nhập từ Excel hoặc in lại biên bản bất cứ lúc nào.",
		placement: "bottom",
		path: "/opening-inventory",
	},
	{
		target: ".erp-search, .erp-table",
		title: "Tra cứu biên bản",
		description:
			"Tìm theo số biên bản, kho hoặc người lập. Menu Chức năng cho phép xem, sửa, ghi sổ, hủy, nhân bản và in biên bản.",
		placement: "top",
		path: "/opening-inventory",
	},
	{
		target: '[data-tour="/reports"]',
		title: "Báo cáo",
		description:
			"Tổng hợp báo cáo bán hàng, mua hàng, kho, sản xuất, công nợ và lợi nhuận theo khoảng thời gian.",
		placement: "right",
		path: "/reports",
	},
	{
		target: ".erp-page-header",
		title: "Trung tâm báo cáo",
		description:
			"Chọn nhóm báo cáo theo nhu cầu: tài chính, bán hàng, mua hàng, kho, sản xuất, công nợ, khuyến mãi hoặc online.",
		placement: "bottom",
		path: "/reports",
	},
	{
		target: ".erp-card",
		title: "Mở báo cáo chi tiết",
		description:
			"Bấm vào một thẻ báo cáo để xem dữ liệu theo khoảng ngày, kho, khách hàng hoặc nhà cung cấp. Có thể xuất Excel từ trang chi tiết.",
		placement: "bottom",
		path: "/reports",
	},
	{
		target: '[data-tour="/chat"]',
		title: "Tin nhắn nội bộ",
		description:
			"Trao đổi với đồng nghiệp theo thời gian thực, gửi tệp và phản hồi tin nhắn ngay trong ứng dụng.",
		placement: "right",
		path: "/chat",
	},
	{
		target: ".erp-page-header",
		title: "Khu vực tin nhắn",
		description:
			"Danh sách hội thoại bên trái, nội dung tin nhắn bên phải. Số tin chưa đọc được hiển thị ngay trên từng hội thoại.",
		placement: "bottom",
		path: "/chat",
	},
	{
		target: ".erp-page-header button",
		title: "Bắt đầu hội thoại",
		description:
			"Bấm để tạo cuộc trò chuyện mới, chọn đồng nghiệp và gửi tin nhắn. Bạn cũng có thể gửi tệp đính kèm trong khung soạn tin.",
		placement: "bottom",
		path: "/chat",
	},
	{
		target: '[data-tour="/dev-tools"]',
		title: "Dev Tools",
		description:
			"Dành cho quản trị viên: xem thông tin máy chủ, truy vấn CSDL, sửa/xóa dòng dữ liệu và chạy script vận hành.",
		placement: "right",
		path: "/dev-tools",
	},
	{
		target: ".erp-page-header",
		title: "Công cụ quản trị",
		description:
			"Chỉ tài khoản quản trị mới thấy phân hệ này. Các thao tác ở đây ảnh hưởng trực tiếp đến dữ liệu nên cần thận trọng.",
		placement: "bottom",
		path: "/dev-tools",
	},
	{
		target: ".erp-table",
		title: "Duyệt và sửa dữ liệu",
		description:
			"Chọn bảng dữ liệu, xem từng dòng và dùng nút sửa/xóa. Dòng không có khóa chính sẽ không thể xóa để bảo vệ dữ liệu.",
		placement: "top",
		path: "/dev-tools",
	},
	{
		target: '[data-tour="notifications"]',
		title: "Nhật ký hoạt động",
		description:
			"Chuông thông báo hiển thị các thao tác gần đây của hệ thống. Bạn có thể mở toàn bộ nhật ký để tra soát.",
		placement: "bottom",
	},
	{
		target: '[data-tour="account"]',
		title: "Tài khoản của bạn",
		description:
			"Tại đây bạn có thể cập nhật hồ sơ cá nhân hoặc đăng xuất. Bạn luôn có thể mở lại tour này bằng nút Hướng dẫn trên thanh tiêu đề.",
		placement: "bottom",
	},
	{
		title: "Sẵn sàng sử dụng!",
		description:
			"Bạn đã nắm được các phân hệ chính. Hãy bắt đầu với Tổng quan hoặc Bán hàng. Nếu cần xem lại, bấm nút Hướng dẫn trên thanh tiêu đề bất cứ lúc nào.",
	},
];

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(value, max));

const GuidedTour = ({ user }: { user: User | null }) => {
	const navigate = useNavigate();
	const location = useLocation();
	const [open, setOpen] = useState(false);
	const [steps, setSteps] = useState<TourStep[]>(STEPS);
	const [index, setIndex] = useState(0);
	const [rect, setRect] = useState<DOMRect | null>(null);
	const [viewport, setViewport] = useState({
		width: typeof window === "undefined" ? 0 : window.innerWidth,
		height: typeof window === "undefined" ? 0 : window.innerHeight,
	});

	const step = steps[index];

	const start = useCallback(() => {
		const access = getModuleAccess(user?.role, user?.permissions);
		const available = STEPS.filter(item => {
			const moduleKey = item.path ? PATH_MODULES[item.path] : undefined;
			if (moduleKey && !access[moduleKey]) return false;
			if (!item.target) return true;
			if (document.querySelector(item.target)) return true;
			// Bước chi tiết của trang sẽ được giữ lại nếu người dùng có quyền
			// truy cập module tương ứng trên thanh điều hướng.
			return !!item.path && !!document.querySelector(`[data-tour="${item.path}"]`);
		});
		setSteps(available.length ? available : []);
		setIndex(0);
		setOpen(true);
	}, [user?.role, user?.permissions]);

	const finish = useCallback(() => {
		try {
			localStorage.setItem(STORAGE_KEY, "1");
		} catch {
			/* ignore */
		}
		setOpen(false);
		setRect(null);
	}, []);

	useEffect(() => {
		const onStart = () => {
			try {
				localStorage.removeItem(STORAGE_KEY);
			} catch {
				/* ignore */
			}
			start();
		};
		window.addEventListener(START_EVENT, onStart);
		return () => window.removeEventListener(START_EVENT, onStart);
	}, [start]);

	useEffect(() => {
		let done = false;
		try {
			done = localStorage.getItem(STORAGE_KEY) === "1";
		} catch {
			/* ignore */
		}
		if (done) return;
		const timer = window.setTimeout(start, 800);
		return () => window.clearTimeout(timer);
	}, [start]);

	useEffect(() => {
		if (!open || !step?.path) return;
		if (location.pathname !== step.path) navigate(step.path);
	}, [open, index, step?.path, location.pathname, navigate]);

	const measure = useCallback(() => {
		setViewport({ width: window.innerWidth, height: window.innerHeight });
		if (!open || !step?.target) {
			setRect(null);
			return;
		}
		const element = document.querySelector(step.target);
		if (!element) {
			setRect(null);
			return;
		}
		const next = element.getBoundingClientRect();
		setRect(next);
	}, [open, step?.target]);

	useEffect(() => {
		if (!open) return;
		const element = step?.target
			? document.querySelector(step.target)
			: null;
		element?.scrollIntoView({
			behavior: "smooth",
			block: "nearest",
			inline: "nearest",
		});
		measure();
		const timer = window.setTimeout(measure, 320);
		const retry = window.setTimeout(measure, 900);
		const onChange = () => measure();
		window.addEventListener("resize", onChange);
		window.addEventListener("scroll", onChange, true);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			window.clearTimeout(timer);
			window.clearTimeout(retry);
			window.removeEventListener("resize", onChange);
			window.removeEventListener("scroll", onChange, true);
			document.removeEventListener("keydown", onKeyDown);
		};

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") finish();
			if (event.key === "ArrowRight") next();
			if (event.key === "ArrowLeft") previous();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, index, step?.target, measure]);

	const previous = () => setIndex(value => Math.max(0, value - 1));
	const next = () => {
		if (index >= steps.length - 1) finish();
		else setIndex(value => Math.min(steps.length - 1, value + 1));
	};

	const tooltipStyle = useMemo(() => {
		const width = 344;
		const height = 228;
		const margin = 14;
		if (!rect) return {};
		let left = rect.right + margin;
		let top = clamp(rect.top, margin, viewport.height - height - margin);
		const placement = step?.placement || "right";
		if (placement === "left") {
			left = rect.left - width - margin;
		} else if (placement === "bottom") {
			left = clamp(rect.left, margin, viewport.width - width - margin);
			top = rect.bottom + margin;
			if (top + height > viewport.height - margin) {
				top = Math.max(margin, rect.top - height - margin);
			}
		} else if (placement === "top") {
			left = clamp(rect.left, margin, viewport.width - width - margin);
			top = rect.top - height - margin;
			if (top < margin) top = rect.bottom + margin;
		} else if (left + width > viewport.width - margin) {
			left = rect.left - width - margin;
			if (left < margin) {
				left = clamp(rect.left, margin, viewport.width - width - margin);
				top = rect.bottom + margin;
				if (top + height > viewport.height - margin) {
					top = Math.max(margin, rect.top - height - margin);
				}
			}
		}
		return {
			left: clamp(left, margin, viewport.width - width - margin),
			top: clamp(top, margin, viewport.height - height - margin),
			width,
		};
	}, [rect, step?.placement, viewport]);

	if (!open || !step) return null;

	const progress = `${index + 1}/${steps.length}`;
	const isLast = index === steps.length - 1;

	const card = (
		<div
			className="w-[344px] rounded-2xl border border-[#e9edf7] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.28)]"
			role="dialog"
			aria-modal="true"
			aria-label={step.title}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#422afb]">
					<Compass size={14} /> Hướng dẫn · {progress}
				</div>
				<button
					type="button"
					onClick={finish}
					className="rounded-lg p-1 text-[#a3aed0] transition-colors hover:bg-[#f4f7fe] hover:text-[#2b3674]"
					title="Đóng hướng dẫn"
				>
					<X size={16} />
				</button>
			</div>
			<h3 className="mt-3 text-[16px] font-bold text-[#1b2559]">
				{step.title}
			</h3>
			<p className="mt-1.5 text-[12.5px] leading-relaxed text-[#707eae]">
				{step.description}
			</p>
			{rect ? (
				<div className="mt-3 flex gap-1">
					{steps.map((_, dot) => (
						<span
							key={dot}
							className={`h-1.5 rounded-full transition-all ${dot === index ? "w-5 bg-[#422afb]" : "w-1.5 bg-[#d8e0f0]"}`}
						/>
					))}
				</div>
			) : null}
			<div className="mt-4 flex items-center justify-between gap-2">
				<button
					type="button"
					onClick={finish}
					className="text-[12px] font-semibold text-[#a3aed0] transition-colors hover:text-[#2b3674]"
				>
					Bỏ qua
				</button>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={previous}
						disabled={index === 0}
						className="inline-flex items-center gap-1 rounded-xl border border-[#e9edf7] px-3 py-2 text-[12px] font-semibold text-[#2b3674] transition-colors hover:bg-[#f4f7fe] disabled:cursor-not-allowed disabled:opacity-40"
					>
						<ChevronLeft size={14} /> Trước
					</button>
					<button
						type="button"
						onClick={next}
						className="inline-flex items-center gap-1 rounded-xl bg-[#422afb] px-3.5 py-2 text-[12px] font-semibold text-white shadow-[0_8px_20px_rgba(66,42,251,0.3)] transition-colors hover:bg-[#3311db]"
					>
						{isLast ? "Bắt đầu" : "Tiếp"}
						{isLast ? (
							<PartyPopper size={14} />
						) : (
							<ChevronRight size={14} />
						)}
					</button>
				</div>
			</div>
		</div>
	);

	if (!rect) {
		return createPortal(
			<div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]">
				{card}
			</div>,
			document.body,
		);
	}

	return createPortal(
		<>
			<div className="fixed inset-0 z-[10000]" aria-hidden="true" />
			<div
				className="pointer-events-none fixed z-[10001] rounded-2xl border-2 border-white transition-all duration-200"
				style={{
					top: rect.top - 6,
					left: rect.left - 6,
					width: rect.width + 12,
					height: rect.height + 12,
					boxShadow: "0 0 0 9999px rgba(15,23,42,0.62)",
				}}
			/>
			<div className="fixed z-[10002]" style={tooltipStyle}>
				{card}
			</div>
		</>,
		document.body,
	);
};

export default GuidedTour;

export const startGuidedTour = () => {
	window.dispatchEvent(new Event(START_EVENT));
};

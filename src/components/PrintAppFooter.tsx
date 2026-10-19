import React from "react";

// Dòng tên app ở đáy-trái mọi trang giấy (như page footer trong Word).
// CSS in toàn cục (.print-app-footer + position: fixed) giữ nó ở đáy mỗi trang.
export default function PrintAppFooter() {
	return <div className="print-app-footer">Challenge ERP</div>;
}

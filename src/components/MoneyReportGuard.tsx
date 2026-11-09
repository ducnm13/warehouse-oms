import React from "react";
import { Navigate } from "react-router-dom";
import { useCanViewMoney } from "../hooks/useCanViewMoney";

export default function MoneyReportGuard({
	children,
}: {
	children: React.ReactNode;
}) {
	const showMoney = useCanViewMoney();
	if (!showMoney) return <Navigate to="/reports" replace />;
	return <>{children}</>;
}

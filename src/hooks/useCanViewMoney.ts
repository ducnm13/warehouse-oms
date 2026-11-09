import { useMemo } from "react";
import { canViewMoney } from "../lib/permissions";

type StoredUser = {
	role?: string;
	roles?: string[];
	permissions?: string[];
};

export function useCanViewMoney() {
	return useMemo(() => {
		let user: StoredUser = {};
		try {
			user = JSON.parse(localStorage.getItem("user") || "{}") as StoredUser;
		} catch {
			user = {};
		}
		return canViewMoney(user.role, user.permissions, user.roles);
	}, []);
}

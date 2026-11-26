import { useMemo } from "react";
import { isAdminLevelRole } from "../lib/permissions";

type StoredUser = {
	role?: string;
	permissions?: string[];
};

/** Vai trò quản trị trở lên (ADMIN, FULL_ACCESS, QD hoặc system.admin). */
export function useIsAdminLevel() {
	return useMemo(() => {
		let user: StoredUser = {};
		try {
			user = JSON.parse(localStorage.getItem("user") || "{}") as StoredUser;
		} catch {
			user = {};
		}
		return isAdminLevelRole(user.role, user.permissions);
	}, []);
}

import { useMemo } from "react";
import { hasPermission } from "../lib/permissions";

type StoredUser = {
	role?: string;
	roles?: string[];
	permissions?: string[];
};

export function useHasPermission(permission?: string | string[]) {
	return useMemo(() => {
		let user: StoredUser = {};
		try {
			user = JSON.parse(localStorage.getItem("user") || "{}") as StoredUser;
		} catch {
			user = {};
		}
		return hasPermission(user.role, user.permissions, permission);
	}, [Array.isArray(permission) ? permission.join(",") : permission]);
}

import { useQuery } from "@tanstack/react-query";
import { apiV1 } from "../lib/apiV1";

export type MaintenanceState = {
	enabled: boolean;
	message: string;
	updatedAt: string | null;
	updatedBy: string | null;
};

export const maintenanceQueryKey = ["maintenance-status"];

export function useMaintenanceStatus() {
	return useQuery({
		queryKey: maintenanceQueryKey,
		queryFn: () => apiV1<MaintenanceState>("/api/v1/maintenance"),
		staleTime: 30_000,
		refetchInterval: 30_000,
		retry: false,
	});
}

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { disconnectSocket, getSocket } from "../lib/socket";

type DocumentChangedEvent = { method?: string; path?: string };

export function useRealtimeSync(enabled = true) {
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!enabled) {
			disconnectSocket();
			return;
		}
		const socket = getSocket();
		if (!socket) return;
		const onDocumentChanged = (event?: DocumentChangedEvent) => {
			if (event?.path?.startsWith("/api/v1/chat")) return;
			void queryClient.invalidateQueries();
		};
		socket.on("document:changed", onDocumentChanged);
		return () => {
			socket.off("document:changed", onDocumentChanged);
		};
	}, [enabled, queryClient]);
}

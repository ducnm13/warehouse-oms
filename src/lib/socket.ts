import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
	const token = localStorage.getItem("token");
	if (!token) {
		socket?.disconnect();
		socket = null;
		return null;
	}
	if (!socket) {
		socket = io({
			path: "/api/v1/socket.io",
			auth: { token },
			transports: ["websocket", "polling"],
		});
		return socket;
	}
	socket.auth = { token };
	if (!socket.connected) socket.connect();
	return socket;
}

export function disconnectSocket() {
	socket?.disconnect();
	socket = null;
}

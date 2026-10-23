import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(() => {
	return {
		plugins: [react(), tailwindcss(), nodePolyfills()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "."),
			},
		},
		define: {
			global: "globalThis",
		},
		server: {
			// HMR is disabled in AI Studio via DISABLE_HMR env var.
			// Do not modify—file watching is disabled to prevent flickering during agent edits.
			hmr: process.env.DISABLE_HMR !== "true",
			server: {
				allowedHosts: ["challenge.test"],
			},
			proxy: {
				"/api": {
					target: "http://localhost:3000",
					changeOrigin: true,
					ws: true,
				},
			},
		},
		optimizeDeps: {
			include: ["exceljs"],
			esbuildOptions: {
				define: {
					global: "globalThis",
				},
			},
		},
	};
});

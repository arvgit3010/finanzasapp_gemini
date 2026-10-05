import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@finanzapp/dominio": fileURLToPath(
        new URL("../../packages/dominio/src/index.ts", import.meta.url),
      ),
    },
  },
  build: {
    rollupOptions: {
      output: { manualChunks: { graficos: ["recharts"], qr: ["qrcode"] } },
    },
  },
  server: { proxy: { "/api": "http://127.0.0.1:3000" } },
});

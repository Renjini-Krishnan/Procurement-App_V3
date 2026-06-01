import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,            // bind to all interfaces (== 0.0.0.0)
    cors: true,            // accept cross-origin requests from the platform proxy
    allowedHosts: true,    // accept any Host header (Vite 6 strict default rejects unknown hosts)
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});

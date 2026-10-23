// Vite = the tool that runs React in development and bundles it for production.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // During development, React runs on :5173 and the API on :3001.
    // This "proxy" forwards any /api request to the backend,
    // so the frontend can simply call fetch("/api/...").
    proxy: { "/api": "http://localhost:3001" },
  },
});

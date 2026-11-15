import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Phone testing goes through a temporary Cloudflare quick tunnel (HTTPS is required for camera, mic, GPS).
export default defineConfig({
  plugins: [react()],
  preview: { allowedHosts: [".trycloudflare.com"] },
  server: { allowedHosts: [".trycloudflare.com"] },
});

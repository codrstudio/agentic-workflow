import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
// https://vite.dev/config/
export default defineConfig({
  base: "/web",
  server: {
    port: process.env.WEB_PORT ? Number(process.env.WEB_PORT) : undefined,
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.SERVER_PORT}`,
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

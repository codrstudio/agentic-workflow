import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vite"

export default defineConfig({
  base: "/chat/",
  envDir: path.resolve(__dirname, "../.."),
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        id: "/chat/",
        name: "Coletivos",
        short_name: "Coletivos",
        description: "Hub de comunicação inteligente",
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: "#3D8BFF",
        background_color: "#ffffff",
        scope: "/chat/",
        start_url: "/chat/",
        categories: ["business", "productivity"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@workspace/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
    },
  },
  server: {
    port: Number(process.env.CHAT_PORT) || 5173,
    proxy: {
      "/api/auth": {
        target: `http://localhost:${process.env.API_PORT || 2201}`,
        changeOrigin: true,
      },
      "/api/v1/chat": {
        target: `http://localhost:${process.env.THREADS_PORT || 2202}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1\/chat/, "/api/v1/threads"),
      },
    },
  },
})

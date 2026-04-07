import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { TanStackRouterVite } from "@tanstack/router-vite-plugin"
import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vite"

if (!process.env.BACKEND_PORT) throw new Error("BACKEND_PORT is not set")
if (!process.env.FRONTEND_PORT) throw new Error("FRONTEND_PORT is not set")

const backendUrl = `http://localhost:${process.env.BACKEND_PORT}`

// https://vite.dev/config/
export default defineConfig({
  base: "/app",
  define: {
    __APP_ENV__: JSON.stringify(process.env.ENVIRONMENT ?? ""),
  },
  plugins: [
    react(),
    tailwindcss(),
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "favicon.ico",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
        "icons/*.png",
      ],
      manifest: {
        name: "Scaffold",
        short_name: "Scaffold",
        description: "Scaffold",
        start_url: "/app",
        scope: "/app",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        lang: "pt-BR",
        dir: "ltr",
        orientation: "any",
        theme_color: "#000000",
        background_color: "#000000",
        categories: ["business", "productivity"],
        icons: [
          { src: "/app/icons/icon-72.png", sizes: "72x72", type: "image/png" },
          { src: "/app/icons/icon-96.png", sizes: "96x96", type: "image/png" },
          { src: "/app/icons/icon-128.png", sizes: "128x128", type: "image/png" },
          { src: "/app/icons/icon-144.png", sizes: "144x144", type: "image/png" },
          { src: "/app/icons/icon-152.png", sizes: "152x152", type: "image/png" },
          { src: "/app/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/app/icons/icon-384.png", sizes: "384x384", type: "image/png" },
          { src: "/app/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/app/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/app/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/app/index.html",
        navigateFallbackAllowlist: [/^\/app/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: Number(process.env.FRONTEND_PORT),
    strictPort: true,
    proxy: {
      "/api/v1": backendUrl,
      "/health": backendUrl,
    },
  },
})

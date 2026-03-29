/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching"
import { registerRoute } from "workbox-routing"
import {
  CacheFirst,
  NetworkOnly,
  StaleWhileRevalidate,
} from "workbox-strategies"
import { ExpirationPlugin } from "workbox-expiration"
import { CacheableResponsePlugin } from "workbox-cacheable-response"
import { BackgroundSyncPlugin } from "workbox-background-sync"

declare const self: ServiceWorkerGlobalScope

// ── Precache app shell (HTML, JS, CSS) ──────────────────────────────
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ── Imagens e assets estaticos → CacheFirst (30 dias) ───────────────
registerRoute(
  ({ request }) =>
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "style",
  new CacheFirst({
    cacheName: "static-assets",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
)

// ── Dados de configuracao → CacheFirst (1 dia) ─────────────────────
registerRoute(
  ({ url }) =>
    url.pathname.startsWith("/api/v1/chat/") && url.pathname.includes("/config"),
  new CacheFirst({
    cacheName: "config-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 24 * 60 * 60,
      }),
    ],
  })
)

// ── Dados de entidades (listas) → StaleWhileRevalidate ──────────────
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith("/api/v1/chat/") &&
    !url.pathname.includes("/auth") &&
    !url.pathname.includes("/config") &&
    !url.pathname.includes("/push") &&
    request.method === "GET",
  new StaleWhileRevalidate({
    cacheName: "api-data",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60,
      }),
    ],
  })
)

// ── Auth/token → NetworkOnly (nunca cachear) ────────────────────────
registerRoute(
  ({ url }) => url.pathname.includes("/auth"),
  new NetworkOnly()
)

// ── Mutations offline → BackgroundSync queue ────────────────────────
const bgSyncPlugin = new BackgroundSyncPlugin("mutation-queue", {
  maxRetentionTime: 24 * 60,
})

for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
  registerRoute(
    ({ url }) =>
      url.pathname.startsWith("/api/v1/chat/") && !url.pathname.includes("/auth"),
    new NetworkOnly({ plugins: [bgSyncPlugin] }),
    method
  )
}

// ── Push notifications ──────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return

  const data = event.data.json()

  event.waitUntil(
    self.registration.showNotification(data.title ?? "Chat", {
      body: data.body,
      icon: data.icon ?? "/chat/icons/icon-192.png",
      badge: "/chat/icons/icon-192.png",
      data: data.data,
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const url = (event.notification.data?.url as string) ?? "/chat/"

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(url))
        if (existing) return existing.focus()
        return self.clients.openWindow(url)
      })
  )
})

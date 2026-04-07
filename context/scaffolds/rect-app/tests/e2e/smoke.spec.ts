import { test, expect } from "@playwright/test"

const backendUrl = `http://localhost:${process.env.BACKEND_PORT}`

test("frontend loads without console errors", async ({ page }) => {
  const errors: string[] = []

  page.on("pageerror", (err) => {
    errors.push(err.message)
  })

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text())
    }
  })

  page.on("response", (res) => {
    if (res.status() >= 400) {
      errors.push(`HTTP ${res.status()} ${res.url()}`)
    }
  })

  await page.goto("/app", { waitUntil: "networkidle" })

  // Page should load successfully
  await expect(page).toHaveTitle(/.+/)

  // No console errors
  expect(errors).toEqual([])
})

test("backend health check responds", async ({ request }) => {
  const res = await request.get(`${backendUrl}/health`)
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body).toEqual({ status: "ok" })
})

test("frontend proxies /health to backend", async ({ request }) => {
  const res = await request.get("/health")
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body).toEqual({ status: "ok" })
})

test("backend API GET /api/v1/messages responds", async ({ request }) => {
  const res = await request.get(`${backendUrl}/api/v1/messages`)
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body).toHaveProperty("messages")
})

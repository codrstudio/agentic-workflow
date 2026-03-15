import { test, expect } from "@playwright/test"

test("SSE status after login", async ({ page }) => {
  // Track SSE-related network
  page.on("response", (res) => {
    if (res.url().includes("events") || res.url().includes("sse")) {
      console.log(`[NET] ${res.status()} ${res.url()}`)
    }
  })
  page.on("requestfailed", (req) => {
    if (req.url().includes("events") || req.url().includes("sse")) {
      console.log(`[NET FAIL] ${req.url()} ${req.failure()?.errorText}`)
    }
  })

  // Login
  await page.goto("http://localhost:2100/web/login")
  await page.fill('input[name="username"]', "admin@mail.com")
  await page.fill('input[name="password"]', "12345678")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/projects**", { timeout: 15000 })

  // Wait up to 5s for SSE conectado
  for (let i = 0; i < 5; i++) {
    const text = await page.evaluate(() => {
      const el = document.querySelector('[title*="SSE"]')
      return el?.getAttribute("title") ?? "NOT FOUND"
    })
    console.log(`[T+${i}s] ${text}`)
    if (text === "SSE conectado") break
    await page.waitForTimeout(1000)
  }

  // Final assertion
  const finalText = await page.evaluate(() =>
    document.querySelector('[title*="SSE"]')?.getAttribute("title") ?? "NOT FOUND"
  )
  expect(finalText).toBe("SSE conectado")
})

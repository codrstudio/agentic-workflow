import { config } from "dotenv"
import { resolve } from "node:path"
import { defineConfig } from "@playwright/test"

config({ path: resolve(__dirname, "..", ".env") })

const frontendPort = Number(process.env.FRONTEND_PORT)
const backendPort = Number(process.env.BACKEND_PORT)

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${frontendPort}`,
  },
  webServer: {
    command: "npm run dev",
    port: frontendPort,
    reuseExistingServer: true,
    timeout: 15_000,
  },
})

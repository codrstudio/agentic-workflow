/**
 * Vite dev plugin that handles /api/v1/auth/* routes in-process,
 * so the web app can authenticate without a separate backend server.
 *
 * Reads SYSUSER / SYSPASS / JWT_SECRET from env at startup.
 * Uses a simple HMAC-based token stored in an httpOnly cookie.
 */
import type { Plugin } from "vite"
import { createHmac, randomBytes } from "node:crypto"

function makeToken(username: string, role: string, secret: string): string {
  const payload = JSON.stringify({ username, role, iat: Date.now() })
  const b64 = Buffer.from(payload).toString("base64url")
  const sig = createHmac("sha256", secret).update(b64).digest("base64url")
  return `${b64}.${sig}`
}

function verifyToken(token: string, secret: string): { username: string; role: string } | null {
  const [b64, sig] = token.split(".")
  if (!b64 || !sig) return null
  const expected = createHmac("sha256", secret).update(b64).digest("base64url")
  if (sig !== expected) return null
  try {
    return JSON.parse(Buffer.from(b64, "base64url").toString()) as { username: string; role: string }
  } catch {
    return null
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const pair of header.split(";")) {
    const [k, ...rest] = pair.split("=")
    if (k) out[k.trim()] = rest.join("=").trim()
  }
  return out
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (c: Buffer) => chunks.push(c))
    req.on("end", () => resolve(Buffer.concat(chunks).toString()))
    req.on("error", reject)
  })
}

const COOKIE_NAME = "aw_session"

export function viteAuthPlugin(): Plugin {
  const sysuser = process.env.SYSUSER ?? "admin@mail.com"
  const syspass = process.env.SYSPASS ?? "12345678"
  const secret = process.env.JWT_SECRET ?? randomBytes(32).toString("hex")

  return {
    name: "aw-dev-auth",
    configureServer(server) {
      // Must run before vite's own middleware (including proxy)
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ""

        // POST /api/v1/auth/login
        if (url === "/api/v1/auth/login" && req.method === "POST") {
          const body = await readBody(req)
          let parsed: { username?: string; password?: string }
          try {
            parsed = JSON.parse(body)
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ error: "Invalid JSON" }))
            return
          }

          if (parsed.username === sysuser && parsed.password === syspass) {
            const token = makeToken(sysuser, process.env.SYSROLE ?? "sysadmin", secret)
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Set-Cookie": `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax`,
            })
            res.end(JSON.stringify({ ok: true }))
          } else {
            res.writeHead(401, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ error: "Invalid credentials" }))
          }
          return
        }

        // GET /api/v1/auth/me
        if (url === "/api/v1/auth/me" && req.method === "GET") {
          const cookies = parseCookies(req.headers.cookie)
          const token = cookies[COOKIE_NAME]
          if (!token) {
            res.writeHead(401, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ error: "Not authenticated" }))
            return
          }
          const user = verifyToken(token, secret)
          if (!user) {
            res.writeHead(401, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ error: "Invalid token" }))
            return
          }
          res.writeHead(200, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ username: user.username, role: user.role }))
          return
        }

        // POST /api/v1/auth/logout
        if (url === "/api/v1/auth/logout" && req.method === "POST") {
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`,
          })
          res.end(JSON.stringify({ ok: true }))
          return
        }

        next()
      })
    },
  }
}

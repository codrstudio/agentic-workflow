import { Hono } from "hono";
import { z } from "zod";
import crypto from "node:crypto";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generateJWT(payload: object, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const headerEncoded = Buffer.from(JSON.stringify(header)).toString("base64url");

  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  // Create HMAC signature
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(signatureInput);
  const signature = hmac.digest("base64url");

  return `${signatureInput}.${signature}`;
}

export const auth = new Hono();

auth.post("/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = loginSchema.parse(body);

    const sysUser = process.env.SYSUSER;
    const sysPass = process.env.SYSPASS;
    const sysRole = process.env.SYSROLE || "user";
    const jwtSecret = process.env.JWT_SECRET;

    // Debug log
    if (!sysUser || !sysPass || !jwtSecret) {
      console.error("[auth] Configuração incompleta:", {
        hasUser: !!sysUser,
        hasPass: !!sysPass,
        hasRole: !!sysRole,
        hasSecret: !!jwtSecret,
      });
      return c.json(
        { error: "Sistema não configurado" },
        { status: 500 },
      );
    }

    // Validate credentials
    if (email !== sysUser || password !== sysPass) {
      return c.json(
        { error: "Credenciais inválidas" },
        { status: 401 },
      );
    }

    // Generate JWT
    const token = generateJWT(
      {
        sub: email,
        role: sysRole,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24h
      },
      jwtSecret,
    );

    return c.json({
      token,
      user: {
        id: email,
        role: sysRole,
        displayName: "System Admin",
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json(
        { error: "Dados inválidos" },
        { status: 400 },
      );
    }
    return c.json(
      { error: "Erro ao processar login" },
      { status: 500 },
    );
  }
});

auth.get("/auth/me", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Sem autenticação" }, { status: 401 });
    }

    // Simple validation - in production, verify JWT signature
    const sysUser = process.env.SYSUSER;
    const sysRole = process.env.SYSROLE || "user";

    return c.json({
      user: sysUser,
      role: sysRole,
      displayName: "System Admin",
    });
  } catch (err) {
    return c.json({ error: "Erro ao obter usuário" }, { status: 500 });
  }
});

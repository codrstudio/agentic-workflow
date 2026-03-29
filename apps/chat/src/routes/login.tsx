import { useState } from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { motion, AnimatePresence } from "framer-motion"
import { LoginForm } from "@workspace/ui/components/login-form"
import { signIn, signOut, getSession } from "@/lib/auth-client"

const TEAM_ROLES = ["admin", "manager", "attendant"] as const

const searchSchema = z.object({
  returnUrl: z.string().optional(),
})

function validateReturnUrl(url: string | undefined): string {
  if (!url) return "/"
  // Accept only relative paths starting with / but not //
  if (url.startsWith("/") && !url.startsWith("//")) return url
  return "/"
}

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    const session = await getSession()
    if (session?.data?.user) {
      const role = (session.data.user as { role?: string }).role
      const isTeam = TEAM_ROLES.includes(role as (typeof TEAM_ROLES)[number])
      if (isTeam) {
        throw redirect({ to: validateReturnUrl((search as { returnUrl?: string }).returnUrl) as "/" })
      }
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { returnUrl } = Route.useSearch()

  const [error, setError] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit({ email, password }: { email: string; password: string }) {
    setError(null)
    setAccessDenied(false)
    setIsLoading(true)

    try {
      const result = await signIn.email({ email, password })

      if (result.error) {
        setError("E-mail ou senha incorretos")
        return
      }

      const session = await getSession()
      const role = (session?.data?.user as { role?: string } | null)?.role

      const isTeam = TEAM_ROLES.includes(role as (typeof TEAM_ROLES)[number])

      if (!isTeam) {
        await signOut()
        setAccessDenied(true)
        return
      }

      const redirectTo = validateReturnUrl(returnUrl)
      await navigate({ to: redirectTo as "/" })
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-6">
      {/* Subtle radial gradient accent */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, var(--color-primary) 0%, transparent 70%)",
          opacity: 0.06,
        }}
      />

      <motion.div
        className="relative w-full max-w-sm"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Card container */}
        <div className="rounded-2xl border border-border/50 bg-card/80 px-8 py-10 shadow-lg shadow-black/[0.03] backdrop-blur-sm dark:shadow-black/[0.15]">
          <div className="space-y-8">
            {/* Logo */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <img src="/chat/logo-h-light.svg" alt="Coletivos" className="h-8 mx-auto dark:hidden" />
              <img src="/chat/logo-h-dark.svg" alt="Coletivos" className="h-8 mx-auto hidden dark:block" />
            </motion.div>

            {/* Access denied alert */}
            <AnimatePresence>
              {accessDenied ? (
                <motion.div
                  role="alert"
                  className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-3 text-sm text-destructive"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  Acesso restrito. Este painel é exclusivo para a equipe de atendimento.
                </motion.div>
              ) : null}
            </AnimatePresence>

            <LoginForm
              onSubmit={handleSubmit}
              error={accessDenied ? null : error}
              isLoading={isLoading}
              title="Bem-vindo de volta"
              description="Acesse o painel da equipe"
            />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

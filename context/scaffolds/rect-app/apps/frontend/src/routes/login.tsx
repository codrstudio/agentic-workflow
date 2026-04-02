import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Button } from "@ui/components/ui/button"
import { Input } from "@ui/components/ui/input"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.navigate({ to: "/" })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <div className="m-4 w-full max-w-sm">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="mb-6 text-center text-2xl font-bold">Login</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Senha
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="mt-2 w-full">
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

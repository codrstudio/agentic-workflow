import { useAuth } from "@/contexts/auth-context"

export function ProjectsPage() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-svh flex-col p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projetos</h1>
        {user.isAuthenticated && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-sm">{user.username}</span>
            <button
              onClick={() => void logout()}
              className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors"
            >
              Sair
            </button>
          </div>
        )}
      </header>
      <p className="text-muted-foreground text-sm">Lista de projetos em construção…</p>
    </div>
  )
}

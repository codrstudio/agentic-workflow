import { createFileRoute } from "@tanstack/react-router"
import { PageDefault } from "@ui/components/page-layout"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/ui/avatar"
import { Separator } from "@ui/components/ui/separator"
import { mockUser } from "@/config/mock-user"
import { Envelope, IdentificationBadge, UserCircle } from "@phosphor-icons/react"

export const Route = createFileRoute("/_shell/profile")({
  component: ProfilePage,
  staticData: { breadcrumb: "Perfil" },
})

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

interface InfoRowProps {
  icon: React.ReactNode
  label: string
  value?: string
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  if (!value) return null
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  )
}

function ProfilePage() {
  const user = mockUser

  return (
    <PageDefault className="mx-auto w-full max-w-lg">
      {/* Avatar hero */}
      <div className="flex flex-col items-center gap-3 pt-4 pb-2">
        <Avatar className="size-24">
          {user.avatarUrl && (
            <AvatarImage src={user.avatarUrl} alt={user.name} />
          )}
          <AvatarFallback className="text-2xl">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h1 className="text-lg font-semibold">{user.name}</h1>
          {user.role && (
            <p className="text-sm text-muted-foreground">{user.role}</p>
          )}
        </div>
      </div>

      <Separator />

      {/* Informações */}
      <div>
        <h2 className="mb-1 text-sm font-medium text-muted-foreground">
          Informações
        </h2>
        <div className="divide-y divide-border">
          <InfoRow
            icon={<UserCircle className="size-5" />}
            label="Nome"
            value={user.name}
          />
          <InfoRow
            icon={<Envelope className="size-5" />}
            label="Email"
            value={user.email}
          />
          <InfoRow
            icon={<IdentificationBadge className="size-5" />}
            label="Cargo"
            value={user.role}
          />
        </div>
      </div>
    </PageDefault>
  )
}

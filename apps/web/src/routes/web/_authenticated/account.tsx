import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/web/_authenticated/account")({
  component: AccountPage,
});

function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate({ to: "/web/login" });
  }

  const displayName = user?.displayName ?? user?.id ?? "—";
  const initials = displayName
    .split(" ")
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader title="Minha Conta" description="Informações do usuário logado" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold select-none">
              {initials || <User className="h-6 w-6" />}
            </div>
            <span>{displayName}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <span className="text-muted-foreground">Nome</span>
            <span className="font-medium">{displayName}</span>

            <span className="text-muted-foreground">ID</span>
            <span className="font-mono text-xs">{user?.id ?? "—"}</span>

            <span className="text-muted-foreground">Perfil</span>
            <span className="font-medium capitalize">{user?.role ?? "—"}</span>
          </div>

          <div className="pt-2">
            <Button variant="destructive" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

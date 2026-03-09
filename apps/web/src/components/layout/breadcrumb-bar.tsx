import { useMatches } from "@tanstack/react-router";
import { Moon, Sun, Bell } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUIStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth";

const routeLabels: Record<string, string> = {
  "/web/agents": "Agentes",
  "/web/conversations": "Conversas",
  "/web/channels": "Canais",
  "/web/cron": "Agenda",
  "/web/settings": "Configuracoes",
};

const dynamicRoutePatterns: { pattern: RegExp; parent: string; label?: string }[] = [
  { pattern: /^\/web\/agents\/new$/, parent: "Agentes", label: "Novo Agente" },
  { pattern: /^\/web\/agents\/[^/]+$/, parent: "Agentes" },
  { pattern: /^\/web\/conversations\/[^/]+$/, parent: "Conversas" },
  { pattern: /^\/web\/channels\/[^/]+$/, parent: "Canais" },
];

export function BreadcrumbBar() {
  const matches = useMatches();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const userRole = useAuthStore((s) => s.user?.role);
  const isSysadmin = userRole === "sysuser";

  const crumbs: string[] = [];
  for (const match of matches) {
    const label = routeLabels[match.pathname];
    if (label) {
      crumbs.push(label);
    } else {
      for (const { pattern, parent, label } of dynamicRoutePatterns) {
        if (pattern.test(match.pathname)) {
          if (!crumbs.includes(parent)) crumbs.push(parent);
          const segment = label ?? match.pathname.split("/").pop();
          if (segment) crumbs.push(segment);
          break;
        }
      }
    }
  }

  const isDark =
    theme === "dark" ||
    (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  function toggleTheme() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="md:hidden" />
      {crumbs.length > 0 && (
        <>
          <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
          <nav className="flex items-center gap-1.5 text-sm">
            {crumbs.map((crumb, i) => (
              <span key={i} className="text-foreground">
                {i > 0 && <span className="mx-1.5 text-muted-foreground">/</span>}
                {crumb}
              </span>
            ))}
          </nav>
        </>
      )}
      <div className="ml-auto flex items-center gap-2">
        {isSysadmin && (
          <Badge variant="secondary" className="text-xs font-semibold">
            Admin
          </Badge>
        )}
        <Button variant="ghost" size="icon" disabled className="opacity-50 cursor-not-allowed" aria-label="Notificacoes desativadas">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}

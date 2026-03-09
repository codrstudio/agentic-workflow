import { Link, useMatchRoute } from "@tanstack/react-router";
import { LayoutDashboard, FolderOpen, UserCircle, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/lib/auth";

// Main navigation items (from sidebar)
const mainNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/web" as const },
  { label: "Projetos", icon: FolderOpen, to: "/web/projects" as const },
] as const;

// Account section (from sidebar footer)
const accountNavItems = [
  { label: "Conta", icon: UserCircle, to: "/web/account" as const },
] as const;

function NavLink({
  item,
  isActive,
}: {
  item: (typeof mainNavItems)[number] | (typeof accountNavItems)[number];
  isActive: boolean;
}) {
  return (
    <Link
      to={item.to}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 px-1 text-xs transition-colors",
        isActive ? "text-primary font-medium" : "text-muted-foreground",
      )}
    >
      <item.icon className="size-5" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function BottomNav() {
  const matchRoute = useMatchRoute();
  const user = useAuthStore((s) => s.user);
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around gap-2 border-t bg-background px-2 md:hidden">
        {/* Main area */}
        <div className="flex flex-1 items-center justify-around gap-2">
          {mainNavItems.map((item) => {
            const isActive = !!matchRoute({
              to: item.to,
              fuzzy: item.to !== "/web",
            });
            return <NavLink key={item.to} item={item} isActive={isActive} />;
          })}
        </div>

        {/* Divider */}
        <Separator orientation="vertical" className="h-8" />

        {/* Projects area */}
        <div className="flex flex-1 items-center justify-around">
          <Button
            variant="ghost"
            size="sm"
            className="h-14 flex-1 flex-col gap-0.5 rounded-none"
            onClick={() => setShowMore(true)}
          >
            <MoreVertical className="size-5" />
            <span className="text-xs">Mais</span>
          </Button>
        </div>
      </nav>

      {/* Drawer com todas as opções */}
      <Sheet open={showMore} onOpenChange={setShowMore}>
        <SheetContent side="bottom" className="h-auto px-4 py-6">
          <SheetHeader>
            <SheetTitle>Navegação</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Área principal */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                Navegação Principal
              </h3>
              <div className="space-y-1">
                {mainNavItems.map((item) => {
                  const isActive = !!matchRoute({
                    to: item.to,
                    fuzzy: item.to !== "/web",
                  });
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setShowMore(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Conta */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                Conta
              </h3>
              <div className="space-y-1">
                {accountNavItems.map((item) => {
                  const isActive = !!matchRoute({ to: item.to });
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setShowMore(false)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </div>
                      {user?.displayName && (
                        <span className="text-xs text-muted-foreground">
                          {user.displayName}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

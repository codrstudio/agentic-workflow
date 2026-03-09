import { Link, useMatchRoute } from "@tanstack/react-router";
import { LayoutDashboard, MoreVertical, UserCircle } from "lucide-react";
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

// Default area items
const defaultNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/web" as const },
  { label: "Projetos", icon: LayoutDashboard, to: "/web/projects" as const },
] as const;

// Projects area items
const projectsNavItems = [
  { label: "Voltar ao Início", icon: LayoutDashboard, to: "/web" as const },
] as const;

const accountNavItems = [
  { label: "Conta", icon: UserCircle, to: "/web/account" as const },
] as const;

type NavItem = (typeof defaultNavItems)[number] | (typeof projectsNavItems)[number];

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
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

export function DynamicBottomNav() {
  const matchRoute = useMatchRoute();
  const user = useAuthStore((s) => s.user);
  const [showMore, setShowMore] = useState(false);

  const isProjectsArea = !!matchRoute({ to: "/web/projects", fuzzy: true });
  const navItems = isProjectsArea ? projectsNavItems : defaultNavItems;

  // Only show 4 items max in the nav bar, rest goes to "Mais"
  const visibleItems = navItems.slice(0, 4);
  const hiddenItems = navItems.slice(4);
  const hasMore = hiddenItems.length > 0 || accountNavItems.length > 0;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around gap-2 border-t bg-background px-2 md:hidden">
        <div className="flex flex-1 items-center justify-around gap-2">
          {visibleItems.map((item) => {
            const isActive = !!matchRoute({
              to: item.to,
              fuzzy: item.to !== "/web",
            });
            return <NavLink key={item.to} item={item} isActive={isActive} />;
          })}
        </div>

        {hasMore && (
          <>
            <Separator orientation="vertical" className="h-8" />
            <Button
              variant="ghost"
              size="sm"
              className="h-14 flex-1 flex-col gap-0.5 rounded-none"
              onClick={() => setShowMore(true)}
            >
              <MoreVertical className="size-5" />
              <span className="text-xs">Mais</span>
            </Button>
          </>
        )}
      </nav>

      <Sheet open={showMore} onOpenChange={setShowMore}>
        <SheetContent side="bottom" className="h-auto px-4 py-6">
          <SheetHeader>
            <SheetTitle>Navegação</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Main nav items */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                {isProjectsArea ? "Área de Projetos" : "Navegação Principal"}
              </h3>
              <div className="space-y-1">
                {navItems.map((item) => {
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
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-accent",
                      )}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Account section */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                Conta
              </h3>
              <div className="space-y-1">
                {accountNavItems.map((item) => {
                  const isActive = !!matchRoute({
                    to: item.to,
                  });
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setShowMore(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-accent",
                      )}
                    >
                      <item.icon className="size-4" />
                      {item.label}
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

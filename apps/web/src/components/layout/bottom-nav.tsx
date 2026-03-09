import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  Home,
  FolderKanban,
  Activity,
  Settings,
  MoreHorizontal,
  Check,
} from "lucide-react";
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
import { useUiStore } from "@/stores/ui.store";

// All available nav items for the bottom bar
const ALL_NAV_ITEMS = [
  { id: "home", label: "Home", icon: Home, to: "/" as const },
  { id: "projects", label: "Projects", icon: FolderKanban, to: "/projects" as const },
  { id: "harness", label: "Harness", icon: Activity, to: "/harness" as const },
  { id: "settings", label: "Settings", icon: Settings, to: "/projects" as const },
] as const;

type NavItemId = (typeof ALL_NAV_ITEMS)[number]["id"];
const DEFAULT_SHORTCUTS: NavItemId[] = ["home", "projects", "harness", "settings"];

export function BottomNav() {
  const matchRoute = useMatchRoute();
  const [showMore, setShowMore] = useState(false);
  const [customizing, setCustomizing] = useState(false);

  const { bottomNavShortcuts, setBottomNavShortcuts } = useUiStore();
  const activeShortcuts = (bottomNavShortcuts ?? DEFAULT_SHORTCUTS) as NavItemId[];

  const shortcutItems = ALL_NAV_ITEMS.filter((item) =>
    activeShortcuts.includes(item.id),
  ).slice(0, 4);

  const toggleShortcut = (id: NavItemId) => {
    if (activeShortcuts.includes(id)) {
      if (activeShortcuts.length > 1) {
        setBottomNavShortcuts(activeShortcuts.filter((s) => s !== id));
      }
    } else if (activeShortcuts.length < 4) {
      setBottomNavShortcuts([...activeShortcuts, id]);
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-stretch border-t bg-background md:hidden">
        {shortcutItems.map((item) => {
          const isActive = !!matchRoute({ to: item.to, fuzzy: item.to !== "/" });
          return (
            <Link
              key={item.id}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs transition-colors",
                isActive ? "text-primary font-medium" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        <Button
          variant="ghost"
          className="flex flex-1 flex-col items-center justify-center gap-0.5 h-full rounded-none text-xs text-muted-foreground"
          onClick={() => setShowMore(true)}
        >
          <MoreHorizontal className="size-5" />
          <span>More</span>
        </Button>
      </nav>

      <Sheet open={showMore} onOpenChange={setShowMore}>
        <SheetContent side="bottom" className="h-auto px-4 py-6">
          <SheetHeader>
            <SheetTitle>Navegação</SheetTitle>
          </SheetHeader>

          {!customizing ? (
            <div className="mt-6 space-y-4">
              <div className="space-y-1">
                {ALL_NAV_ITEMS.map((item) => {
                  const isActive = !!matchRoute({ to: item.to, fuzzy: item.to !== "/" });
                  return (
                    <Link
                      key={item.id}
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

              <Separator />

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setCustomizing(true)}
              >
                Customize shortcuts
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Select up to 4 shortcuts to show in the bottom bar.
              </p>
              <div className="space-y-1">
                {ALL_NAV_ITEMS.map((item) => {
                  const selected = activeShortcuts.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleShortcut(item.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        selected
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <item.icon className="size-4" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {selected && <Check className="size-4" />}
                    </button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setCustomizing(false)}
              >
                Done
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { LogOut, Sun, Moon, Monitor } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useThemeStore, type Theme } from "@/stores/theme.store";
import { useState, useRef, useEffect } from "react";

export function UserMenu() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    setOpen(false);
    void navigate({ to: "/login" });
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent text-sm text-left transition"
      >
        <div className="bg-muted flex size-6 items-center justify-center rounded-md text-xs font-semibold shrink-0">
          {user?.displayName?.charAt(0).toUpperCase() || "U"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{user?.displayName || "User"}</div>
          <div className="text-xs text-muted-foreground truncate">{user?.role || "guest"}</div>
        </div>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 right-0 rounded-lg border bg-popover shadow-md z-50">
          {/* User Info */}
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-foreground">{user?.displayName || "User"}</p>
            <p className="text-xs text-muted-foreground">{user?.id}</p>
          </div>

          {/* Separator */}
          <div className="h-px bg-border" />

          {/* Theme Options */}
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-foreground mb-2">Tema</p>
            <div className="space-y-1">
              {(["light", "dark", "auto"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleThemeChange(t)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition ${
                    theme === t
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50 text-foreground"
                  }`}
                >
                  {t === "light" && <Sun className="size-3" />}
                  {t === "dark" && <Moon className="size-3" />}
                  {t === "auto" && <Monitor className="size-3" />}
                  <span className="capitalize">
                    {t === "light" && "Claro"}
                    {t === "dark" && "Escuro"}
                    {t === "auto" && "Automático"}
                  </span>
                  {theme === t && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-border" />

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent transition"
          >
            <LogOut className="size-4" />
            <span>Sair</span>
          </button>
        </div>
      )}
    </div>
  );
}

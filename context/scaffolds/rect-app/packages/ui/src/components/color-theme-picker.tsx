import { cn } from "@ui/lib/utils"
import { useColorTheme } from "@ui/hooks/use-color-theme"
import { Check } from "@phosphor-icons/react"

interface ColorThemePickerProps {
  className?: string
}

export function ColorThemePicker({ className }: ColorThemePickerProps) {
  const { colorTheme, setColorTheme, registry } = useColorTheme()

  const defaultTheme = registry.find((t) => t.slug === "default")
  const otherThemes = registry.filter((t) => t.slug !== "default")
  const isDefaultActive = colorTheme === "default"

  return (
    <div className={cn("flex flex-col gap-0.5 p-1", className)}>
      {defaultTheme && (
        <>
          <button
            onClick={() => setColorTheme("default")}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              isDefaultActive && "bg-accent text-accent-foreground"
            )}
          >
            <span className="min-w-0 flex-1 truncate">Tema Padrão</span>
            {isDefaultActive && (
              <Check className="size-3.5 shrink-0" weight="bold" />
            )}
          </button>
          <div className="my-1.5 border-b border-border" />
        </>
      )}
      {otherThemes.map((theme) => {
        const isActive = colorTheme === theme.slug
        return (
          <button
            key={theme.slug}
            onClick={() => setColorTheme(theme.slug)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              isActive && "bg-accent text-accent-foreground"
            )}
          >
            <span className="min-w-0 flex-1 truncate">{theme.label}</span>
            {theme.colors && theme.colors.length > 0 && (
              <div className="flex shrink-0 gap-1">
                {theme.colors.map((color, i) => (
                  <span
                    key={i}
                    className="size-4 rounded border border-black/10 dark:border-white/15"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            )}
            {isActive && <Check className="size-3.5 shrink-0" weight="bold" />}
          </button>
        )
      })}
    </div>
  )
}

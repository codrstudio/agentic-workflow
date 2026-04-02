import { createFileRoute } from "@tanstack/react-router"
import { useTheme } from "@ui/components/theme-provider"
import { useColorTheme } from "@ui/hooks/use-color-theme"
import { ColorThemePicker } from "@ui/components/color-theme-picker"
import { Sun, Moon, Desktop } from "@phosphor-icons/react"
import { cn } from "@ui/lib/utils"

export const Route = createFileRoute("/_shell/settings/theme")({
  component: ThemeSettingsPage,
  staticData: { breadcrumb: "Tema" },
})

const options = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Automático", icon: Desktop },
] as const

function ThemeSettingsPage() {
  const { theme, setTheme } = useTheme()
  const { isFixed } = useColorTheme()

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-medium">Aparência</h2>
        <p className="text-sm text-muted-foreground">
          Escolha como o app deve ser exibido.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {options.map((opt) => {
          const active = theme === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors",
                "hover:bg-accent/50",
                active && "border-primary bg-accent",
              )}
            >
              <opt.icon className="size-5" weight={active ? "fill" : "regular"} />
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          )
        })}
      </div>

      {!isFixed && (
        <>
          <div>
            <h2 className="text-base font-medium">Paleta de cores</h2>
            <p className="text-sm text-muted-foreground">
              Selecione a paleta de cores do app.
            </p>
          </div>

          <div className="rounded-xl border p-2">
            <ColorThemePicker />
          </div>
        </>
      )}
    </div>
  )
}

import { createRootRoute, Outlet } from "@tanstack/react-router"
import { TooltipProvider } from "@ui/components/ui/tooltip"
import { PWAReloadPrompt } from "@/components/pwa-reload-prompt"
import { EnvironmentIndicator } from "@/components/environment-indicator"

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <TooltipProvider>
      <EnvironmentIndicator />
      <Outlet />
      <PWAReloadPrompt />
    </TooltipProvider>
  )
}

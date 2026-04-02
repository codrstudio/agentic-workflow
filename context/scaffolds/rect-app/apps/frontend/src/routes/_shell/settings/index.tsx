import { createFileRoute, Navigate } from "@tanstack/react-router"
import { useIsMobile } from "@ui/hooks/use-media-query"

export const Route = createFileRoute("/_shell/settings/")({
  component: SettingsIndex,
})

function SettingsIndex() {
  const isMobile = useIsMobile()

  if (isMobile) {
    return null
  }

  return <Navigate to="/settings/theme" replace />
}

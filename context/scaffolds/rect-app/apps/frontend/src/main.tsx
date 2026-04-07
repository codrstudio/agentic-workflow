import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { ThemeProvider } from "@ui/components/theme-provider"
import { ColorThemeProvider } from "@ui/components/color-theme-provider"
import { themeRegistry, DEFAULT_THEME } from "@/themes/registry"
import { NotFoundState } from "@/components/not-found-state"
import { ErrorState } from "@/components/error-state"
import { routeTree } from "./routeTree.gen"
import "./index.css"

const FIXED_THEME = (() => {
  const slug = import.meta.env.VITE_COLOR_THEME
  if (!slug) return null
  const valid = themeRegistry.some((t) => t.slug === slug)
  return valid ? slug : "default"
})()

const router = createRouter({
  routeTree,
  basepath: "/app",
  defaultNotFoundComponent: NotFoundState,
  defaultErrorComponent: ErrorState,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ColorThemeProvider
        registry={themeRegistry}
        defaultTheme={FIXED_THEME || DEFAULT_THEME}
        fixedTheme={FIXED_THEME}
      >
        <RouterProvider router={router} />
      </ColorThemeProvider>
    </ThemeProvider>
  </StrictMode>,
)

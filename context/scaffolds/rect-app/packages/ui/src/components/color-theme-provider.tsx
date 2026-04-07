/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

export interface ColorTheme {
  slug: string
  label: string
  colors?: string[]
}

export type ColorThemeRegistry = ColorTheme[]

interface ColorThemeProviderProps {
  children: React.ReactNode
  registry: ColorThemeRegistry
  defaultTheme?: string
  fixedTheme?: string | null
  storageKey?: string
}

interface ColorThemeProviderState {
  colorTheme: string
  setColorTheme: (slug: string) => void
  registry: ColorThemeRegistry
  isFixed: boolean
}

const LINK_ID = "color-theme-link"

const ColorThemeProviderContext = React.createContext<
  ColorThemeProviderState | undefined
>(undefined)

function disableTransitionsTemporarily() {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"
    )
  )
  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        style.remove()
      })
    })
  }
}

export function ColorThemeProvider({
  children,
  registry,
  defaultTheme = "default",
  fixedTheme,
  storageKey = "color-theme",
}: ColorThemeProviderProps) {
  const isFixed = Boolean(fixedTheme)

  const [colorTheme, setColorThemeState] = React.useState<string>(() => {
    if (fixedTheme) return fixedTheme
    try {
      return localStorage.getItem(storageKey) || defaultTheme
    } catch {
      return defaultTheme
    }
  })

  const setColorTheme = React.useCallback(
    (slug: string) => {
      if (fixedTheme) return

      const link = document.getElementById(LINK_ID) as HTMLLinkElement | null
      if (!link) return

      const restoreTransitions = disableTransitionsTemporarily()

      const handleLoad = () => {
        restoreTransitions()
        link.removeEventListener("load", handleLoad)
      }

      link.addEventListener("load", handleLoad)
      link.href = link.href.replace(/[^/]+\.css$/, `${slug}.css`)

      try {
        localStorage.setItem(storageKey, slug)
      } catch {
        // localStorage unavailable
      }

      setColorThemeState(slug)
    },
    [storageKey, fixedTheme]
  )

  React.useEffect(() => {
    if (fixedTheme) return

    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return
      if (event.key !== storageKey) return
      const slug = event.newValue || defaultTheme
      setColorTheme(slug)
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [defaultTheme, storageKey, setColorTheme, fixedTheme])

  const value = React.useMemo(
    () => ({ colorTheme, setColorTheme, registry, isFixed }),
    [colorTheme, setColorTheme, registry, isFixed]
  )

  return (
    <ColorThemeProviderContext.Provider value={value}>
      {children}
    </ColorThemeProviderContext.Provider>
  )
}

export function useColorTheme() {
  const context = React.useContext(ColorThemeProviderContext)

  if (context === undefined) {
    throw new Error("useColorTheme must be used within a ColorThemeProvider")
  }

  return context
}

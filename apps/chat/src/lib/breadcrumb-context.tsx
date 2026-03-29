import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbContextType {
  override: BreadcrumbItem[] | null
  setOverride: (items: BreadcrumbItem[] | null) => void
}

const BreadcrumbContext = createContext<BreadcrumbContextType>({
  override: null,
  setOverride: () => {},
})

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [override, setOverrideState] = useState<BreadcrumbItem[] | null>(null)
  const setOverride = useCallback((items: BreadcrumbItem[] | null) => {
    setOverrideState(items)
  }, [])
  return (
    <BreadcrumbContext.Provider value={{ override, setOverride }}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

export function useBreadcrumbOverride() {
  return useContext(BreadcrumbContext)
}

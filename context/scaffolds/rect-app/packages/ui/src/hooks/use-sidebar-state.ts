import { useCallback, useState } from "react"

const STORAGE_KEY = "sidebar:collapsed"

function readState(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(readState)

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  return { collapsed, toggle } as const
}

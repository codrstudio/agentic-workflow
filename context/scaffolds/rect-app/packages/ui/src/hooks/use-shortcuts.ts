import { useState, useCallback, useEffect } from "react"
import type { MenuItem, MenuContext } from "@ui/components/app-menu/types"

const STORAGE_KEY = "shortcuts"
const MAX_SHORTCUTS = 5

function getAllItems(root: MenuContext): MenuItem[] {
  return root.groups.flatMap((g) => g.items)
}

function getDefaultIds(root: MenuContext): string[] {
  return root.defaultShortcuts ?? []
}

function loadIds(storageKey: string, fallback: string[]): string[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed
    }
    return fallback
  } catch {
    return fallback
  }
}

export function useShortcuts(menuRoot: MenuContext, userId?: string) {
  const key = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY
  const allItems = getAllItems(menuRoot)
  const defaultIds = getDefaultIds(menuRoot)

  const [ids, setIds] = useState<string[]>(() => loadIds(key, defaultIds))

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(ids))
  }, [key, ids])

  const shortcuts: MenuItem[] = ids
    .map((id) => allItems.find((item) => item.id === id))
    .filter(Boolean) as MenuItem[]

  const available: MenuItem[] = allItems.filter(
    (item) => item.route && !ids.includes(item.id),
  )

  const add = useCallback(
    (itemId: string) => {
      setIds((prev) => {
        if (prev.length >= MAX_SHORTCUTS || prev.includes(itemId)) return prev
        return [...prev, itemId]
      })
    },
    [],
  )

  const remove = useCallback((itemId: string) => {
    setIds((prev) => prev.filter((id) => id !== itemId))
  }, [])

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setIds((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setIds(defaultIds)
  }, [defaultIds])

  return {
    shortcuts,
    available,
    ids,
    add,
    remove,
    reorder,
    reset,
    isFull: ids.length >= MAX_SHORTCUTS,
  }
}

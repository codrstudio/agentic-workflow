import type { ComponentType } from "react"

export type Tier = "customer" | "attendant" | "manager" | "admin"

export interface MenuItem {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  route?: string
  children?: MenuContext
  minTier?: Tier
}

export interface MenuGroup {
  id: string
  label: string
  items: MenuItem[]
}

export interface MenuContext {
  id: string
  title?: string
  parent?: string
  groups: MenuGroup[]
  defaultShortcuts?: string[]
}

export interface MenuWidget {
  id: string
  icon: ComponentType<{ className?: string }>
  label: string
  value?: string
  onClick?: () => void
}

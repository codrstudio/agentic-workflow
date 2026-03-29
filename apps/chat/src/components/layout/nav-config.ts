import { House } from "@phosphor-icons/react"
import type { Icon as PhosphorIcon } from "@phosphor-icons/react"

export interface NavItem {
  label: string
  href: string
  icon: PhosphorIcon
}

export const navItems: NavItem[] = [
  { label: "Início", href: "/", icon: House },
]

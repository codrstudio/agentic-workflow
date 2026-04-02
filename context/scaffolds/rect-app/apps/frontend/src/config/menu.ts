import { House, Gear } from "@phosphor-icons/react"
import type { MenuContext, MenuItem } from "@ui/components/app-menu/types"

export const menuRoot: MenuContext = {
  id: "root",
  groups: [
    {
      id: "main",
      items: [
        {
          id: "home",
          label: "Início",
          icon: House,
          route: "/",
        },
      ],
    },
    {
      id: "settings",
      label: "Configurações",
      items: [
        {
          id: "settings",
          label: "Configurações",
          icon: Gear,
          route: "/settings",
        },
      ],
    },
  ],
  defaultShortcuts: ["home", "settings"],
}

function findItems(ctx: MenuContext): MenuItem[] {
  return ctx.groups.flatMap((g) => g.items)
}

export function getDefaultShortcuts(root: MenuContext): MenuItem[] {
  const ids = root.defaultShortcuts ?? []
  const all = findItems(root)
  return ids.map((id) => all.find((item) => item.id === id)).filter(Boolean) as MenuItem[]
}

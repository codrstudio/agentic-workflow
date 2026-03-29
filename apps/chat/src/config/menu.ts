import { House } from "@phosphor-icons/react"
import type { MenuContext } from "@workspace/ui/components/app-menu/types"

export const chatMenu: MenuContext = {
  id: "root",
  groups: [
    {
      id: "main",
      label: "Principal",
      items: [
        {
          id: "home",
          label: "Início",
          icon: House,
          route: "/",
        },
      ],
    },
  ],
  defaultShortcuts: ["home"],
}

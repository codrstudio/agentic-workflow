"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@ui/components/ui/sidebar"
import { LayoutGridIcon, LayersIcon, SettingsIcon, FrameIcon, PieChartIcon } from "lucide-react"

// Dados didaticos — mostram a estrutura do menu, nao um caso de uso.
const data = {
  user: {
    name: "Usuario",
    email: "usuario@exemplo.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Meu Workspace",
      logo: <LayoutGridIcon />,
      plan: "Plano",
    },
  ],
  navMain: [
    {
      title: "Grupo com Submenu",
      url: "#",
      icon: <LayersIcon />,
      isActive: true,
      items: [
        { title: "Subitem 1", url: "#" },
        { title: "Subitem 2", url: "#" },
        { title: "Subitem 3", url: "#" },
      ],
    },
    {
      title: "Outro Grupo",
      url: "#",
      icon: <LayoutGridIcon />,
      items: [
        { title: "Subitem 1", url: "#" },
        { title: "Subitem 2", url: "#" },
      ],
    },
    {
      title: "Configuracoes",
      url: "#",
      icon: <SettingsIcon />,
      items: [
        { title: "Geral", url: "#" },
        { title: "Conta", url: "#" },
      ],
    },
  ],
  projects: [
    {
      name: "Link Direto",
      url: "#",
      icon: <FrameIcon />,
    },
    {
      name: "Outro Link",
      url: "#",
      icon: <PieChartIcon />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

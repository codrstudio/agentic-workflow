import { useState } from "react";
import { Home, FolderKanban, Settings, Plus, FolderOpen, Activity } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useProjects } from "@/hooks/use-projects";
import { ProjectFormDialog } from "@/components/project-form-dialog";
import { UserMenu } from "@/components/layout/user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Home", icon: Home, to: "/" as const },
  { title: "Projects", icon: FolderKanban, to: "/projects" as const },
  { title: "Harness", icon: Activity, to: "/harness" as const },
  { title: "Settings", icon: Settings, to: "/projects" as const },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: projects } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);

  const recentProjects = projects?.slice(0, 5) ?? [];

  // Extract active project slug from pathname like /projects/my-slug/...
  const projectSlugMatch = pathname.match(/^\/projects\/([^/]+)/);
  const activeSlug = projectSlugMatch?.[1];

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip="ARC" asChild>
                <Link to="/">
                  <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-xs font-bold">
                    A
                  </div>
                  <span className="font-semibold">ARC</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={pathname === item.to || pathname.startsWith(item.to + "/")}
                      asChild
                    >
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Projetos</SidebarGroupLabel>
            <SidebarGroupAction
              title="Criar projeto"
              onClick={() => setCreateOpen(true)}
            >
              <Plus />
              <span className="sr-only">Criar projeto</span>
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {recentProjects.map((project) => (
                  <SidebarMenuItem key={project.slug}>
                    <SidebarMenuButton
                      tooltip={project.name}
                      isActive={activeSlug === project.slug}
                      asChild
                    >
                      <Link to="/projects/$projectId" params={{ projectId: project.slug }}>
                        <FolderOpen />
                        <span>{project.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Ver todos"
                    asChild
                    className="text-muted-foreground"
                  >
                    <Link to="/projects">
                      <FolderKanban />
                      <span>Ver todos</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <UserMenu />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <ProjectFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

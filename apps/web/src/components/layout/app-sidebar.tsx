import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderOpen,
  UserCircle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuthStore } from "@/lib/auth";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/web" as const },
  { label: "Projetos", icon: FolderOpen, to: "/web/projects" as const },
] as const;

export function AppSidebar() {
  const matchRoute = useMatchRoute();
  const user = useAuthStore((s) => s.user);
  const isAccountActive = !!matchRoute({ to: "/web/account" });

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <span className="text-lg font-semibold tracking-tight">Agentic Workflow</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = !!matchRoute({ to: item.to, fuzzy: item.to !== "/web" });
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton isActive={isActive} render={<Link to={item.to} />}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={isAccountActive} render={<Link to="/web/account" />}>
              <UserCircle />
              <span className="flex-1 truncate">{user?.displayName ?? "Minha Conta"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

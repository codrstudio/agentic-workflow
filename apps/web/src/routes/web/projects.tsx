import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DynamicSidebar } from "@/components/layout/dynamic-sidebar";
import { DynamicBottomNav } from "@/components/layout/dynamic-bottom-nav";
import { BreadcrumbBar } from "@/components/layout/breadcrumb-bar";

export const Route = createFileRoute("/web/projects")({
  component: ProjectsLayout,
});

function ProjectsLayout() {
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return <Navigate to="/web/login" replace />;
  }

  return (
    <SidebarProvider>
      <DynamicSidebar />
      <SidebarInset>
        <BreadcrumbBar />
        <div className="flex-1 overflow-auto pb-18 md:pb-4">
          <Outlet />
        </div>
      </SidebarInset>
      <DynamicBottomNav />
    </SidebarProvider>
  );
}

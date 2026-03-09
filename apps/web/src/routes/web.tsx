import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { BreadcrumbBar } from "@/components/layout/breadcrumb-bar";
import { PushPermissionBanner } from "@/components/notifications/push-permission-banner";
import { NotFound } from "@/components/shared/not-found";

export const Route = createFileRoute("/web")({
  component: WebLayout,
  notFoundComponent: WebNotFound,
});

function WebLayout() {
  const token = useAuthStore((s) => s.token);

  // Se não autenticado, redireciona para login
  if (!token) {
    return <Navigate to="/web/login" replace />;
  }

  // Se autenticado, renderiza o outlet (_authenticated ou filhas)
  return <Outlet />;
}

function WebNotFound() {
  const token = useAuthStore((s) => s.token);

  // Se não autenticado, vai para login
  if (!token) {
    return <Navigate to="/web/login" replace />;
  }

  // Se autenticado, mostra NotFound dentro do layout
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <BreadcrumbBar />
        <PushPermissionBanner />
        <div className="flex-1 overflow-auto p-4 pb-18 md:pb-4">
          <NotFound />
        </div>
      </SidebarInset>
      <BottomNav />
    </SidebarProvider>
  );
}

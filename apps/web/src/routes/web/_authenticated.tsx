import { useCallback } from "react";
import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DynamicSidebar } from "@/components/layout/dynamic-sidebar";
import { DynamicBottomNav } from "@/components/layout/dynamic-bottom-nav";
import { BreadcrumbBar } from "@/components/layout/breadcrumb-bar";
import { useSSE, useSSEEvent } from "@/hooks/use-sse";
import { PushPermissionBanner } from "@/components/notifications/push-permission-banner";
import { NotFound } from "@/components/shared/not-found";
import { toast } from "sonner";

export const Route = createFileRoute("/web/_authenticated")({
  component: AuthenticatedLayout,
  notFoundComponent: NotFoundLayout,
});

function NotFoundLayout() {
  return (
    <SidebarProvider>
      <DynamicSidebar />
      <SidebarInset>
        <BreadcrumbBar />
        {/* TODO: Enable when server implements /api/v1/ai/push/vapid-key */}
        {/* <PushPermissionBanner /> */}
        <div className="flex-1 overflow-auto p-4 pb-18 md:pb-4">
          <NotFound />
        </div>
      </SidebarInset>
      <DynamicBottomNav />
    </SidebarProvider>
  );
}

function AuthenticatedLayout() {
  const token = useAuthStore((s) => s.token);
  useSSE({ enabled: !!token });

  useSSEEvent(
    "system:heartbeat",
    useCallback((_event) => {
      // Sistema heartbeat - apenas log
      console.log("[SSE] Heartbeat recebido");
    }, []),
  );

  if (!token) {
    return <Navigate to="/web/login" />;
  }

  return (
    <SidebarProvider>
      <DynamicSidebar />
      <SidebarInset>
        <BreadcrumbBar />
        {/* TODO: Enable when server implements /api/v1/ai/push/vapid-key */}
        {/* <PushPermissionBanner /> */}
        <div className="flex-1 overflow-auto p-4 pb-18 md:pb-4">
          <Outlet />
        </div>
      </SidebarInset>
      <DynamicBottomNav />
    </SidebarProvider>
  );
}

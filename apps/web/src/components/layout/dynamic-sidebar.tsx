import { useMatchRoute } from "@tanstack/react-router";
import { AppSidebar } from "./app-sidebar";
import { ProjectsSidebar } from "./projects-sidebar";

export function DynamicSidebar() {
  const matchRoute = useMatchRoute();
  const isProjectsArea = !!matchRoute({ to: "/web/projects", fuzzy: true });

  return isProjectsArea ? <ProjectsSidebar /> : <AppSidebar />;
}

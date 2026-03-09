import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/web/projects/")({
  component: ProjectsIndexRedirect,
});

function ProjectsIndexRedirect() {
  return <Navigate to="/web/projects/overview" replace />;
}

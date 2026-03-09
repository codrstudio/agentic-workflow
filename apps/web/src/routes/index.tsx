import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: RedirectToWeb,
});

function RedirectToWeb() {
  return <Navigate to="/web" replace />;
}

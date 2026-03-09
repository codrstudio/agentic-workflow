import { Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/auth";
import { NotFound } from "./not-found";

export function NotFoundRoot() {
  const token = useAuthStore((s) => s.token);

  // If not authenticated, go to login
  if (!token) {
    return <Navigate to="/web/login" />;
  }

  // If authenticated, show NotFound component (which expects to be in layout)
  return <NotFound />;
}

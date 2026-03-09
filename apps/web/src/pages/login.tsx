import { useNavigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleLogin = () => {
    login();
    void navigate({ to: "/projects" });
  };

  return (
    <div className="flex min-h-[calc(100svh-2.5rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-2xl text-2xl font-bold">
          A
        </div>
        <h1 className="text-3xl font-bold text-foreground">ARC</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          AI-powered product workflow orchestrator
        </p>
        <Button size="lg" onClick={handleLogin} className="gap-2">
          <LogIn className="size-4" />
          Enter ARC
        </Button>
      </div>
    </div>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Search, Home } from "lucide-react";

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="space-y-2">
        <Search className="w-16 h-16 mx-auto text-muted-foreground opacity-50" />
        <h1 className="text-3xl font-bold tracking-tight">Página não encontrada</h1>
        <p className="text-muted-foreground text-lg max-w-md">
          Desculpe, a página que você está procurando não existe ou foi removida.
        </p>
      </div>

      <Button
        onClick={() => navigate({ to: "/web" })}
        size="lg"
        className="gap-2"
      >
        <Home className="w-4 h-4" />
        Voltar ao início
      </Button>
    </div>
  );
}

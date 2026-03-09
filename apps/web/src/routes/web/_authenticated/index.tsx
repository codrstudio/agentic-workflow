import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared/page-header";

export const Route = createFileRoute("/web/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Home"
        description="Bem-vindo ao seu aplicativo"
      />

      <div className="flex items-center justify-center min-h-[400px] rounded-lg border border-dashed border-muted-foreground/25 bg-muted/50">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground text-lg">
            Nenhuma página configurada
          </p>
          <p className="text-sm text-muted-foreground">
            Comece a construir sua aplicação aqui
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Template de página para o Hub.
 *
 * Regras:
 * 1. A página NUNCA define max-width ou mx-auto — a largura é controlada pelo app shell (SidebarInset).
 * 2. O wrapper raiz usa apenas `p-4` para margem interna (mesma do sandbox).
 * 3. Componentes filhos devem ser fluidos (w-full) — nunca restringir largura.
 * 4. Use este template como base ao criar novas páginas no Hub.
 */

import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_page-template")({
  component: PageTemplate,
})

function PageTemplate() {
  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Conteúdo da página aqui */}
      <h1 className="text-xl font-semibold">Título da Página</h1>
    </div>
  )
}

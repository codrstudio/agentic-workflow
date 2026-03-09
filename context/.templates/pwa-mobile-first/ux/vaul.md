# Drawer & Popup Patterns

Padroes responsivos: Drawer (mobile) → Popup ou Right Drawer (web).

---

## ESTRATEGIA GERAL

```
Mobile (< 768px)          Desktop (≥ 768px)
┌───────────────┐         ┌──────────────────────────┐
│               │         │                    ┌─────┤
│   CONTENT     │         │   CONTENT          │ RD  │
│               │         │                    │     │
├───────────────┤         │                    └─────┤
│ ░░░░░░░░░░░░░ │ Vaul    └──────────────────────────┘
│ ░ DRAWER    ░ │ Bottom        Right Drawer (RD)
│ ░░░░░░░░░░░░░ │
└───────────────┘              OU
                          ┌──────────────────────────┐
                          │        ┌────────┐        │
                          │        │ POPUP  │        │
                          │        │        │        │
                          │        └────────┘        │
                          └──────────────────────────┘
                                 Dialog/Modal
```

---

## CRITERIO DE ESCOLHA: POPUP vs RIGHT DRAWER

### Usar POPUP (Dialog/Modal) quando:

| Criterio | Exemplo |
|----------|---------|
| Acao pontual e curta | Confirmar exclusao, rename |
| Formulario simples (1-5 campos) | Editar titulo, add comentario |
| Decisao binaria | Sim/Nao, Salvar/Descartar |
| Sem necessidade de ver conteudo atras | Alertas, confirmacoes |
| Conteudo de tamanho fixo/previsivel | Settings rapidos, selecao de opcao |
| Fluxo que interrompe a tarefa atual | Logout, troca de conta |

### Usar RIGHT DRAWER quando:

| Criterio | Exemplo |
|----------|---------|
| Conteudo longo/scrollavel | Detalhes de registro, historico |
| Precisa ver conteudo principal ao lado | Editar item da lista, preview |
| Formulario complexo (6+ campos) | Cadastro, edicao completa |
| Painel de propriedades/config | Sidebar de settings, filtros |
| Navegacao drill-down | Master → Detail |
| Conteudo que usuario consulta enquanto age | Docs, referencia, chat |
| Multiplas abas/secoes internas | Perfil com abas (info, historico, notas) |

### Cheat Sheet Rapido

```
Pergunta-se:                                    → Resultado
─────────────────────────────────────────────────────────────
O usuario precisa ver o que esta atras?          SIM → Right Drawer
                                                 NAO → Popup

O conteudo cabe em 400px de altura?              SIM → Popup
                                                 NAO → Right Drawer

E uma acao de < 10 segundos?                     SIM → Popup
                                                 NAO → Right Drawer

Tem scroll interno ou tabs?                      SIM → Right Drawer
                                                 NAO → Popup

E um fluxo de "inspecionar/detalhar"?            SIM → Right Drawer
                                                 NAO → Popup
```

---

## IMPLEMENTACAO

### Dependencias

```bash
# Vaul para bottom drawer mobile
npm install vaul

# shadcn/ui para Dialog e Sheet
npx shadcn@latest add dialog sheet
```

### Hook de deteccao

```tsx
// hooks/use-media-query.ts
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

export const useIsMobile = () => useMediaQuery("(max-width: 767px)");
```

---

### Componente Responsivo Base

```tsx
// components/ui/responsive-panel.tsx
"use client";

import { useIsMobile } from "@/hooks/use-media-query";
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle } from "vaul";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ReactNode } from "react";

type DesktopMode = "popup" | "right-drawer";

interface ResponsivePanelProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title?: string;
  children: ReactNode;
  desktopMode?: DesktopMode;     // popup | right-drawer
  drawerWidth?: string;           // largura do right-drawer (default: "400px")
  popupMaxWidth?: string;         // largura max do popup (default: "425px")
}

export function ResponsivePanel({
  open,
  onOpenChange,
  trigger,
  title,
  children,
  desktopMode = "popup",
  drawerWidth = "400px",
  popupMaxWidth = "425px",
}: ResponsivePanelProps) {
  const isMobile = useIsMobile();

  // ─── MOBILE: Sempre Vaul Bottom Drawer ───
  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        {trigger && <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>}
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-background">
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
            <div className="max-h-[85dvh] overflow-y-auto p-4 pb-8">
              {title && (
                <Drawer.Title className="text-lg font-semibold mb-4">
                  {title}
                </Drawer.Title>
              )}
              {children}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  // ─── DESKTOP: Popup (Dialog) ───
  if (desktopMode === "popup") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent style={{ maxWidth: popupMaxWidth }}>
          {title && (
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
          )}
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  // ─── DESKTOP: Right Drawer (Sheet) ───
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent
        side="right"
        style={{ width: drawerWidth, maxWidth: "90vw" }}
        className="overflow-y-auto"
      >
        {title && (
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
        )}
        {children}
      </SheetContent>
    </Sheet>
  );
}
```

---

## EXEMPLOS DE USO

### Popup: Confirmar exclusao

```tsx
<ResponsivePanel
  title="Confirmar exclusao"
  desktopMode="popup"
  trigger={<Button variant="destructive">Excluir</Button>}
>
  <p className="text-sm text-muted-foreground mb-4">
    Tem certeza? Esta acao nao pode ser desfeita.
  </p>
  <div className="flex gap-2 justify-end">
    <Button variant="outline">Cancelar</Button>
    <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
  </div>
</ResponsivePanel>
```

### Right Drawer: Detalhes de paciente

```tsx
<ResponsivePanel
  title="Detalhes do Paciente"
  desktopMode="right-drawer"
  drawerWidth="480px"
  open={!!selectedPatient}
  onOpenChange={(open) => !open && setSelectedPatient(null)}
>
  <Tabs defaultValue="info">
    <TabsList className="w-full">
      <TabsTrigger value="info">Info</TabsTrigger>
      <TabsTrigger value="historico">Historico</TabsTrigger>
      <TabsTrigger value="notas">Notas</TabsTrigger>
    </TabsList>
    <TabsContent value="info">
      <PatientInfoForm patient={selectedPatient} />
    </TabsContent>
    <TabsContent value="historico">
      <PatientHistory patientId={selectedPatient.id} />
    </TabsContent>
    <TabsContent value="notas">
      <PatientNotes patientId={selectedPatient.id} />
    </TabsContent>
  </Tabs>
</ResponsivePanel>
```

### Popup: Formulario simples

```tsx
<ResponsivePanel
  title="Adicionar nota rapida"
  desktopMode="popup"
  trigger={<Button size="sm"><Plus className="mr-2 h-4 w-4" /> Nota</Button>}
>
  <div className="space-y-4">
    <Textarea placeholder="Escreva sua nota..." rows={3} />
    <div className="flex justify-end">
      <Button>Salvar</Button>
    </div>
  </div>
</ResponsivePanel>
```

### Right Drawer: Filtros avancados

```tsx
<ResponsivePanel
  title="Filtros"
  desktopMode="right-drawer"
  drawerWidth="360px"
  trigger={<Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4" /> Filtros</Button>}
>
  <div className="space-y-6">
    <div>
      <Label>Status</Label>
      <Select><SelectTrigger>...</SelectTrigger></Select>
    </div>
    <div>
      <Label>Periodo</Label>
      <DateRangePicker />
    </div>
    <div>
      <Label>Responsavel</Label>
      <Combobox options={users} />
    </div>
    <div>
      <Label>Tags</Label>
      <MultiSelect options={tags} />
    </div>
    <Separator />
    <div className="flex gap-2">
      <Button variant="outline" className="flex-1">Limpar</Button>
      <Button className="flex-1">Aplicar</Button>
    </div>
  </div>
</ResponsivePanel>
```

---

## VAUL: OPCOES AVANCADAS

### Snap Points (paradas intermediarias)

```tsx
<Drawer.Root snapPoints={[0.4, 0.8, 1]} open={open} onOpenChange={setOpen}>
  <Drawer.Portal>
    <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
    <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-background">
      <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
      {/* 40% → preview, 80% → conteudo, 100% → fullscreen */}
      {children}
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

### Nested Drawers (drawer dentro de drawer)

```tsx
<Drawer.NestedRoot>
  <Drawer.Trigger>Abrir sub-opcao</Drawer.Trigger>
  <Drawer.Portal>
    <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
    <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-background">
      {/* Segundo nivel */}
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.NestedRoot>
```

### Dismissible controlado

```tsx
<Drawer.Root
  dismissible={false}  // Nao fecha ao arrastar pra baixo
  handleOnly={true}    // So arrasta pelo handle
>
```

---

## ANIMACOES E TRANSICOES

### Vaul (built-in)
Vaul ja inclui animacao de spring nativa. Customizar:

```tsx
<Drawer.Root
  // Escala do conteudo atras (0 = sem escala, 1 = escala maxima)
  shouldScaleBackground={true}
  // Distancia de threshold para fechar
  closeThreshold={0.25}
>
```

### Sheet/Dialog transitions (Tailwind)

```tsx
// Em globals.css ou diretamente
@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

---

## ACESSIBILIDADE

| Requisito | Implementacao |
|-----------|---------------|
| Focus trap | Dialog/Sheet do shadcn ja inclui |
| Escape fecha | Vaul e shadcn ja incluem |
| aria-label | Sempre definir `title` no ResponsivePanel |
| Scroll lock | Vaul trava scroll do body automaticamente |
| Reduced motion | `prefers-reduced-motion` desabilita animacoes |

```tsx
// Respeitar preferencia de reducao de movimento
const prefersReduced = useMediaQuery("(prefers-reduced-motion: reduce)");

<Drawer.Root
  shouldScaleBackground={!prefersReduced}
>
```

---

## RESUMO DE DECISAO

```
                    ┌─────────────────┐
                    │ Precisa ver o   │
                    │ conteudo atras? │
                    └────────┬────────┘
                        ┌────┴────┐
                       SIM       NAO
                        │         │
                  ┌─────┴─────┐  ┌┴──────────────┐
                  │ Conteudo  │  │ Acao rapida   │
                  │ extenso?  │  │ (< 10s)?      │
                  └─────┬─────┘  └───────┬───────┘
                   ┌────┴──┐        ┌────┴──┐
                  SIM     NAO      SIM     NAO
                   │       │        │       │
              Right     Right    Popup   Right
              Drawer    Drawer           Drawer
              (wide)    (narrow)
```

**Regra de ouro**: Na duvida, use Right Drawer. E mais flexivel e acomoda crescimento futuro do conteudo sem precisar refatorar.
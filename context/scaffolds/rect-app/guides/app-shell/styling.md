# Styling

Regras de espacamento, tokens de cor e abordagem component-first do app shell.

---

## Espacamento

O shell usa `p-0`. O conteudo das paginas eh responsabilidade de cada pagina.

```
┌─────────────────────────────────────────────┐
│ [sidebar p-0]  │  [breadcrumb bar p-0]      │
│                │────────────────────────────│
│                │                            │
│                │   ┌────────────────────┐   │
│                │   │   page content     │   │
│                │   │   (page decide)    │   │
│                │   │                    │   │
│                │   └────────────────────┘   │
│                │                            │
└─────────────────────────────────────────────┘
  shell: p-0
```

- **Shell** (sidebar, breadcrumb bar, shortcut bar): sem padding.
- **Mobile content**: `<main>` recebe `pb-14` para nao ficar atras da shortcut bar.
- **Transicao**: `margin-left` do conteudo eh animado com `transition-[margin-left] duration-200 ease-in-out`.

---

## Component-first

Preferir composicao com componentes shadcn/ui sobre HTML cru.

```
ERRADO                              CERTO
─────────────────────────────────   ─────────────────────────────────
<div className="rounded border      <Card>
  p-4 shadow">                        <CardHeader>
  <h3 className="text-lg              <CardTitle>Titulo</CardTitle>
    font-semibold">Titulo</h3>        </CardHeader>
  <p>Conteudo</p>                     <CardContent>
</div>                                  <p>Conteudo</p>
                                      </CardContent>
                                    </Card>
```

Hierarquia de decisao:

1. **shadcn/ui** — usar o componente pronto
2. **Composicao** — compor a partir de componentes shadcn
3. **Radix primitive** — quando shadcn nao cobre
4. **HTML raw** — ultimo recurso, com justificativa

Referencia completa: `guides/component-first/GUIDE.md`.

---

## packages/ui

Componentes compartilhados vivem em `packages/ui/src/components/` e sao consumidos via `@scaffold/ui`. Apps nunca criam componentes de UI localmente se o componente pode ser reutilizado.

Ao adicionar um componente shadcn (`npx shadcn add ...`), ele vai para `packages/ui` — nunca para dentro de um app.

### Tailwind CSS 4 + monorepo: @source obrigatorio

O `@tailwindcss/vite` (Tailwind v4) so gera CSS para classes encontradas nos arquivos que ele escaneia. Arquivos em `packages/ui/` estao fora do diretorio do app — o Tailwind nao os detecta automaticamente.

**Obrigatorio** no `index.css` de cada app:

```css
@source "../../../packages/ui/src";
```

Sem isso, classes que existem apenas em `packages/ui/` nao geram CSS — o HTML renderiza correto mas sem estilo.

---

## Tokens semanticos

Jamais aplicar cores diretamente. Usar exclusivamente tokens semanticos via CSS variables para consistencia entre temas (claro/escuro).

```
ERRADO                              CERTO
─────────────────────────────────   ─────────────────────────────────
className="text-red-500"            className="text-destructive"
className="bg-blue-100"             className="bg-accent"
style={{ color: '#22c55e' }}        className="text-primary"
```

### Tokens do shell

O sidebar usa tokens proprios (`bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-accent`, `text-sidebar-accent-foreground`) definidos como CSS variables no tema. Esses tokens permitem que o sidebar tenha cores independentes do conteudo principal.

### Paleta semantica estendida

| Token | Uso | Foreground |
|-------|-----|------------|
| `--x-faint` | palido | `--x-faint-foreground` |
| `--x-muted` | acinzentado | `--x-muted-foreground` |
| `--x-info` | informativo (ciano) | `--x-info-foreground` |
| `--x-notice` | aviso (azul) | `--x-notice-foreground` |
| `--x-highlight` | destaque (violeta) | `--x-highlight-foreground` |
| `--x-success` | sucesso (verde) | `--x-success-foreground` |
| `--x-warning` | atencao (amarelo) | `--x-warning-foreground` |
| `--x-alert` | alerta (laranja) | `--x-alert-foreground` |
| `--x-error` | erro (vermelho) | `--x-error-foreground` |
| `--x-critical` | critico (roxo) | `--x-critical-foreground` |

Valores calculados com **OKLCH** para uniformidade perceptual entre temas.

---

## Temas

O `<ThemeProvider>` gerencia o tema (dark/light/system) via classe no `<html>`:

- `.dark` aplica variaveis do tema escuro
- Default (sem classe) aplica tema claro
- "Auto" usa `prefers-color-scheme`

O toggle de tema fica no `<AvatarMenu>` (popover do usuario) com tres opcoes: Claro / Escuro / Auto.

---

## Veja tambem

- [Menu](menu.md) — AppNavPanel e seus tokens de sidebar
- [Sidebar](sidebar.md) — container que usa `bg-sidebar`
- `guides/component-first/GUIDE.md` — guia completo de component-first

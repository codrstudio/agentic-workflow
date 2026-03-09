# Guia de UI/UX — ProTalent

> **A verdade vive em `specs/ux/`.** Este arquivo consolida as decisoes visuais concretas e serve de mapa para as especificacoes detalhadas.

---

## 1. Sistema de Cores

### Abordagem

Tailwind CSS 4 com CSS variables em **OKLCH**. Duas camadas de cores conforme `specs/ux/colorization.md`:

1. **Cores tematicas** — variam por brand (primary, secondary, accent)
2. **Cores semanticas** — fixas entre brands (success, warning, destructive, etc.)

Configuracao segue a convencao shadcn/ui v4: CSS variables em `:root` (light) e `.dark` (dark), mapeadas via `@theme inline`. Setup tecnico completo em `specs/ux/shadcn-v4/SETUP.md`.

### Tokens de Cor — Light Mode

| Token | OKLCH | Referencia HEX | Uso |
|-------|-------|----------------|-----|
| `--primary` | `oklch(0.546 0.245 264)` | ~#2563EB (blue-600) | CTA principal, links, botoes primarios |
| `--primary-foreground` | `oklch(0.985 0 0)` | ~#FAFAFA | Texto sobre primary |
| `--secondary` | `oklch(0.541 0.281 293)` | ~#7C3AED (violet-600) | Elementos de acento, badges especiais |
| `--secondary-foreground` | `oklch(0.985 0 0)` | ~#FAFAFA | Texto sobre secondary |
| `--accent` | `oklch(0.97 0 0)` | ~#F5F5F5 | Hover sutil, backgrounds interativos |
| `--accent-foreground` | `oklch(0.205 0 0)` | ~#171717 | Texto sobre accent |
| `--destructive` | `oklch(0.577 0.245 27.325)` | ~#DC2626 (red-600) | Erros, reprovacao, acoes destrutivas |
| `--background` | `oklch(1 0 0)` | #FFFFFF | Background da pagina |
| `--foreground` | `oklch(0.145 0 0)` | ~#111827 | Texto principal |
| `--card` | `oklch(1 0 0)` | #FFFFFF | Background de cards |
| `--card-foreground` | `oklch(0.145 0 0)` | ~#111827 | Texto em cards |
| `--muted` | `oklch(0.97 0 0)` | ~#F3F4F6 | Backgrounds suaves |
| `--muted-foreground` | `oklch(0.556 0 0)` | ~#6B7280 | Texto secundario, placeholders |
| `--border` | `oklch(0.922 0 0)` | ~#E5E7EB | Bordas de cards e inputs |
| `--input` | `oklch(0.922 0 0)` | ~#E5E7EB | Bordas de inputs |
| `--ring` | `oklch(0.546 0.245 264)` | ~#2563EB | Focus ring |

### Cores Semanticas de Estado

| Token | OKLCH (light) | Referencia HEX | Uso |
|-------|---------------|----------------|-----|
| `--cs-success` | `oklch(0.586 0.175 145)` | ~#16A34A (green-600) | Aprovado, contratado, acao bem-sucedida |
| `--cs-warning` | `oklch(0.666 0.179 65)` | ~#D97706 (amber-600) | Alertas, pendencias |
| `--cs-error` | `oklch(0.577 0.245 27)` | ~#DC2626 (red-600) | Falha, reprovacao |
| `--cs-info` | `oklch(0.65 0.15 230)` | ~#0891B2 (cyan-600) | Informacao passiva |
| `--cs-notice` | `oklch(0.546 0.245 264)` | ~#2563EB (blue-600) | Estado relevante |
| `--cs-highlight` | `oklch(0.541 0.281 293)` | ~#7C3AED (violet-600) | Enfase, foco |

Cada cor de estado tem variante `-light` para backgrounds: `oklch(... / 0.1)` (10% opacidade sobre fundo).

### Dark Mode

Variaveis invertidas na classe `.dark`. Abordagem shadcn/ui v4:

```css
@custom-variant dark (&:is(.dark *));
```

### Configuracao CSS (`globals.css`)

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.546 0.245 264);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.541 0.281 293);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.546 0.245 264);
  --radius: 0.5rem;

  /* Status semanticos */
  --cs-success: oklch(0.586 0.175 145);
  --cs-warning: oklch(0.666 0.179 65);
  --cs-error: oklch(0.577 0.245 27);
  --cs-info: oklch(0.65 0.15 230);
  --cs-notice: oklch(0.546 0.245 264);
  --cs-highlight: oklch(0.541 0.281 293);

  /* Charts */
  --chart-1: oklch(0.546 0.245 264);
  --chart-2: oklch(0.541 0.281 293);
  --chart-3: oklch(0.586 0.175 145);
  --chart-4: oklch(0.666 0.179 65);
  --chart-5: oklch(0.65 0.15 230);

  /* Sidebar */
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.546 0.245 264);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.546 0.245 264);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.646 0.245 264);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.641 0.281 293);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --destructive-foreground: oklch(0.637 0.237 25.331);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.646 0.245 264);

  --cs-success: oklch(0.686 0.175 145);
  --cs-warning: oklch(0.766 0.179 65);
  --cs-error: oklch(0.637 0.237 25);
  --cs-info: oklch(0.75 0.15 230);
  --cs-notice: oklch(0.646 0.245 264);
  --cs-highlight: oklch(0.641 0.281 293);

  --chart-1: oklch(0.646 0.245 264);
  --chart-2: oklch(0.641 0.281 293);
  --chart-3: oklch(0.686 0.175 145);
  --chart-4: oklch(0.766 0.179 65);
  --chart-5: oklch(0.75 0.15 230);

  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.646 0.245 264);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.269 0 0);
  --sidebar-ring: oklch(0.646 0.245 264);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
  button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }
}
```

---

## 2. Tipografia

| Token | Valor | Uso |
|-------|-------|-----|
| Fonte base | `'Inter', system-ui, sans-serif` | Toda a aplicacao |
| `text-xs` | `0.75rem` (12px) | Labels auxiliares, badges |
| `text-sm` | `0.875rem` (14px) | Texto de apoio, meta dados |
| `text-base` | `1rem` (16px) | Corpo de texto |
| `text-lg` | `1.125rem` (18px) | Subtitulos de secao |
| `text-xl` | `1.25rem` (20px) | Titulos de card |
| `text-2xl` | `1.5rem` (24px) | Titulos de pagina |
| `text-3xl` | `1.875rem` (30px) | Heading principal da landing |
| `font-normal` | 400 | Texto corrido |
| `font-medium` | 500 | Labels, links |
| `font-semibold` | 600 | Subtitulos, botoes |
| `font-bold` | 700 | Headings |

---

## 3. Espacamento

Escala Tailwind padrao. Referencias mais usadas:

| Classe | Valor | Uso |
|--------|-------|-----|
| `gap-1` | 4px | Gap minimo entre icone e texto |
| `gap-2` | 8px | Padding interno de badges |
| `gap-3` | 12px | Gap entre itens de lista |
| `p-4` | 16px | Padding interno de cards |
| `gap-6` | 24px | Gap entre secoes de formulario |
| `gap-8` | 32px | Margem entre blocos de conteudo |
| `gap-12` | 48px | Margem entre secoes de pagina |

---

## 4. Bordas e Sombras

| Token | Valor | Uso |
|-------|-------|-----|
| `--radius` | `0.5rem` (8px) | Base — cards, botoes |
| `rounded-sm` | `calc(--radius - 4px)` = 4px | Inputs, badges |
| `rounded-md` | `calc(--radius - 2px)` = 6px | Botoes menores |
| `rounded-lg` | `--radius` = 8px | Cards, modais |
| `rounded-xl` | `calc(--radius + 4px)` = 12px | Containers maiores |
| `rounded-full` | 9999px | Avatares, pills |
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Cards em repouso |
| `shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Cards em hover, dropdowns |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modais |

---

## 5. Componentes

### Catalogo completo

O inventario de 50+ primitivos UI, 7 tipos de graficos (63 variantes), 14 cards de exemplo e 4 apps completos esta em `specs/ux/shadcn-v4/MANIFEST.md`. Esse e o ponto de entrada para "qual componente usar para X".

### Componentes por Categoria

#### Navegacao

| Componente | Variantes | Uso |
|------------|-----------|-----|
| `Navbar` | `candidate`, `public` | Barra de navegacao superior para candidatos e visitantes |
| `Sidebar` | `recruiter` | Menu lateral do dashboard do recrutador (web-only, Sheet no mobile) |
| `Breadcrumb` | — | Navegacao hierarquica nas telas do recrutador |
| `TabBar` | `underline`, `pill` | Abas (Minhas Candidaturas, Dashboard) |
| `BottomBar` | — | Navegacao inferior mobile para candidato |

#### Inputs

| Componente | Variantes | Uso |
|------------|-----------|-----|
| `Input` | `text`, `email`, `password`, `search`, `tel` | Campos de entrada |
| `Textarea` | — | Descricoes longas |
| `Select` | `single`, `multi`, `searchable` | Dropdowns e filtros |
| `Checkbox` | — | Selecao multipla |
| `RadioGroup` | — | Selecao unica |
| `FileUpload` | `drag-drop`, `button` | Upload de curriculo, documentos, video |
| `DatePicker` | — | Selecao de datas (Popover + Calendar) |

#### Data Display

| Componente | Variantes | Uso |
|------------|-----------|-----|
| `JobCard` | `compact`, `detailed` | Card de vaga na listagem |
| `CandidateCard` | `kanban`, `list` | Card de candidato no dashboard |
| `Badge` | `status`, `tag`, `count` | Status, tags, contadores |
| `Avatar` | `sm`, `md`, `lg` | Foto do candidato/recrutador |
| `ProgressBar` | `linear`, `circular` | Completude do curriculo, progresso de etapa |
| `Timeline` | — | Linha do tempo da candidatura |
| `ScoreDisplay` | `stars`, `numeric`, `bar` | Exibicao de notas |
| `EmptyState` | — | Estado vazio de listas |
| `StatCard` | — | Cards de metricas no dashboard |

#### Feedback

| Componente | Variantes | Uso |
|------------|-----------|-----|
| `Toast` | `success`, `error`, `warning`, `info` | Notificacoes temporarias (Sonner) |
| `Alert` | `success`, `error`, `warning`, `info` | Mensagens inline |
| `Skeleton` | — | Loading placeholder |
| `Spinner` | `sm`, `md`, `lg` | Carregamento pontual |
| `ConfirmDialog` | — | Confirmacao de acoes destrutivas |

#### Layout

| Componente | Variantes | Uso |
|------------|-----------|-----|
| `PageHeader` | — | Titulo da pagina + acoes |
| `Card` | `default`, `outlined`, `elevated` | Container de conteudo |
| `Modal` | `sm`, `md`, `lg`, `full` | Dialogos e formularios overlay |
| `Sheet` | `right`, `bottom` | Painel lateral (perfil do candidato) |
| `Stepper` | `horizontal`, `vertical` | Wizard de criacao de vaga, cadastro |
| `AppShell` | — | Layout principal (sidebar + breadcrumb + content) |

#### Kanban

| Componente | Variantes | Uso |
|------------|-----------|-----|
| `KanbanBoard` | — | Container do quadro Kanban |
| `KanbanColumn` | — | Coluna de etapa com header e contagem |
| `KanbanCard` | — | Card arrastavel do candidato |

### Props e APIs

| O que precisa | Arquivo |
|---------------|---------|
| Props de todos os componentes UI | `specs/ux/shadcn-v4/api/ui-props.md` |
| Sistema de Sidebar (hook, CSS vars, hierarquia) | `specs/ux/shadcn-v4/api/sidebar-api.md` |
| Sistema de Charts (ChartConfig, tooltips, legends) | `specs/ux/shadcn-v4/api/chart-api.md` |
| Formularios (RHF + TanStack Form + Zod) | `specs/ux/shadcn-v4/api/form-api.md` |
| Variantes de graficos (63 configs) | `specs/ux/shadcn-v4/components/charts/CHART-VARIANTS.md` |

---

## 6. Padroes de Composicao

Receitas para padroes construidos por composicao de primitivos. Referencia completa em `specs/ux/shadcn-v4/PATTERNS.md`.

| Padrao | Compoe | Quando usar |
|--------|--------|-------------|
| **Combobox** | Popover + Command | Select com busca |
| **DatePicker** | Popover + Calendar | Selecao de data (single e range) |
| **DataTable** | Table + @tanstack/react-table | Tabelas com sort, filter, pagination |
| **Dialog in DropdownMenu** | Dialog wrapping DropdownMenu | Acao destrutiva a partir de menu |
| **Responsive Dialog** | Dialog (desktop) + Drawer (mobile) | Modais responsivos |
| **Button as Link** | Button + asChild + Link | Botao que navega |
| **Sidebar Layout** | SidebarProvider + Sidebar + SidebarInset | Layout com sidebar colapsavel |
| **Form + Zod** | Form + RHF + Zod schema | Formularios validados |
| **Toast (Sonner)** | Toaster + toast() | Notificacoes temporarias |

---

## 7. Mobile-first e Responsividade

### Principios

Referencia completa em `specs/ux/mobile-patterns.md`:
- Touch targets min 44x44px, thumb zone, gestos
- Layout com bottom navigation
- Breakpoints Tailwind (sm/md/lg/xl/2xl)
- Pattern Sheet-no-mobile / Dialog-no-desktop
- Touch feedback (ripple, haptic)
- Performance (virtualizacao, lazy loading, skeleton, optimistic UI)

### Drawer e popup responsivos

Decisao arquitetural central: **Drawer (Vaul) no mobile, Popup ou Right Drawer no desktop.** Detalhes e componente `ResponsivePanel` em `specs/ux/vaul.md`.

**Regra de ouro:** na duvida, use Right Drawer.

---

## 8. Animacoes e Transicoes

Referencia completa em `specs/ux/framer-motion.md`:
- Patterns: fade in, slide up, stagger children, page transitions, hover scale, drag
- Timing por tipo: 100ms (micro-interacao) ate 600ms (animacao de atencao)
- Spring configs (responsivo, bouncy, suave)
- Integracao com shadcn/ui via `motion(Component)`

---

## 9. Arquitetura de Aplicacao

### PWA mobile-first agentic app

Spec completa em `specs/ux/pwa/pwa-mobile-first-agentic-app.md`:

| Aspecto | Decisao |
|---------|---------|
| Stack | Vite 6, React 19, TanStack Router/Query, Zustand, shadcn/ui, Tailwind 4 |
| Estrutura | `src/app/routes/`, `components/`, `hooks/`, `stores/` |
| Layout | Mobile-first sem topbar, breadcrumb bar, sidebar colapsavel (web only) |
| Hierarquia | shadcn > composicao > Radix primitive > HTML raw |
| PWA | SW registration, update prompt, network awareness, safe areas |
| Routing | TanStack Router com file-based routes e breadcrumb context |
| Data layer | TanStack Query com queryOptions pattern |

**Filosofia central:** Component-First, Custom-HTML Last.

### Realtime

**SSE (Server-Sent Events)** como unico mecanismo. Sem WebSocket, sem polling. Poucos canais tematicos (`/notifications`, `/data`, `/agents`, `/chat`) com filtragem client-side. Detalhes em `specs/ux/pwa/realtime-sse.md`.

### Silent refresh

Auto-refresh de dados sem destruir scroll position: dois modos de carregamento (primeira carga com loading, refresh silencioso em background) + nunca desmontar container scrollavel. Detalhes em `specs/ux/react/silent-refresh-sem-scroll-reset.md`.

---

## 10. Padroes de Pagina

### Landing Page (Visitante — Next.js SSR)

```jsx
<Page>
  <Header />
  <Hero
    headline="Seu proximo emprego esta aqui"
    subline="Cadastre-se gratuitamente e seja encontrado por empresas"
    cta={<Button size="lg" asChild><a href="/app/cadastro">Cadastrar agora</a></Button>}
  />
  <SocialProof stats={["500+ vagas ativas", "10.000+ candidatos", "200+ empresas"]} />
  <HowItWorks steps={["Cadastre-se", "Complete seu perfil", "Candidate-se"]} />
  <FeaturedJobs jobs={latestJobs} />
  <Footer />
</Page>
```

### Busca de Vagas (Candidato — Hub SPA)

```jsx
<AppShell>
  <Navbar variant="candidate" />
  <PageHeader title="Vagas" />
  <FilterBar>
    <Input type="search" placeholder="Buscar por cargo, empresa..." />
    <Select label="Localidade" options={locations} />
    <Select label="Tipo de contrato" options={contractTypes} />
    <Select label="Faixa salarial" options={salaryRanges} />
  </FilterBar>
  <JobList>
    {jobs.map(job => <JobCard key={job.id} variant="detailed" job={job} />)}
  </JobList>
  <Pagination />
</AppShell>
```

### Kanban do Recrutador (Hub SPA)

```jsx
<AppShell>
  <Sidebar variant="recruiter" />
  <Main>
    <PageHeader title={job.title}>
      <TabBar tabs={["Kanban", "Lista"]} />
      <FilterBar>
        <Input type="search" placeholder="Buscar candidato..." />
        <Select label="Tag" options={tags} />
      </FilterBar>
    </PageHeader>
    <KanbanBoard>
      {stages.map(stage => (
        <KanbanColumn key={stage.id} title={stage.name} count={stage.count}>
          {stage.candidates.map(c => (
            <KanbanCard
              key={c.id}
              name={c.name}
              avatar={c.photo}
              score={c.averageScore}
              tags={c.tags}
            />
          ))}
        </KanbanColumn>
      ))}
    </KanbanBoard>
  </Main>
</AppShell>
```

### Perfil do Candidato — Visao do Recrutador (Hub SPA)

```jsx
<Sheet side="right" size="lg">
  <SheetHeader>
    <Avatar size="lg" src={candidate.photo} />
    <h2>{candidate.name}</h2>
    <p>{candidate.city}, {candidate.state}</p>
    <TagList tags={application.tags} editable />
  </SheetHeader>
  <TabBar tabs={["Curriculo", "Testes", "Avaliacao", "Historico"]} />
  <SheetBody>
    <Section title="Experiencia Profissional">
      {candidate.experiences.map(exp => <ExperienceItem {...exp} />)}
    </Section>
    <Section title="Formacao Academica">
      {candidate.education.map(edu => <EducationItem {...edu} />)}
    </Section>
    <ScoringForm criteria={stage.criteria} onSubmit={saveScores} />
    <CommentBox onSubmit={addComment} />
  </SheetBody>
</Sheet>
```

---

## 11. Acessibilidade (WCAG 2.1 AA)

- [ ] Contraste minimo de 4.5:1 para texto normal e 3:1 para texto grande
- [ ] Todos os inputs possuem `<label>` associado via `htmlFor`/`id`
- [ ] Imagens possuem `alt` descritivo; imagens decorativas usam `alt=""`
- [ ] Navegacao completa por teclado (Tab, Enter, Escape, Arrow keys)
- [ ] Focus ring visivel em todos os elementos interativos (minimo 2px, cor contrastante)
- [ ] Skip link "Ir para conteudo principal" no topo de cada pagina
- [ ] Hierarquia de headings semantica (h1 → h2 → h3, sem pular niveis)
- [ ] Drag and drop no Kanban com alternativa de teclado (botao "Mover para etapa")
- [ ] Formularios com mensagens de erro associadas via `aria-describedby`
- [ ] Toasts e alertas anunciados via `aria-live="polite"`
- [ ] Modais com trap de foco e fechamento via Escape
- [ ] Componentes interativos com roles ARIA corretos (tab, tabpanel, dialog, listbox)
- [ ] Texto redimensionavel ate 200% sem perda de conteudo ou funcionalidade
- [ ] Touch targets minimos de 44x44px em mobile
- [ ] Uso de `prefers-reduced-motion` para desativar animacoes
- [ ] Indicadores de status usam texto alem de cor (icone + label)

---

## 12. Codigo de Referencia

| Recurso | Localizacao |
|---------|-------------|
| 50+ componentes UI (source code copiavel) | `specs/ux/shadcn-v4/components/ui/` |
| 14 composicoes de cards de exemplo | `specs/ux/shadcn-v4/components/cards/` |
| App: Dashboard (sidebar, charts, data table) | `specs/ux/shadcn-v4/components/examples/dashboard/` |
| App: Authentication (login/signup) | `specs/ux/shadcn-v4/components/examples/authentication/` |
| App: Playground (tabs, seletores, presets) | `specs/ux/shadcn-v4/components/examples/playground/` |
| App: Tasks (TanStack Table, faceted filters) | `specs/ux/shadcn-v4/components/examples/tasks/` |

---

## Consulta Rapida

| Duvida | Onde consultar |
|--------|----------------|
| Qual componente usar? | `specs/ux/shadcn-v4/MANIFEST.md` |
| Como compor X? | `specs/ux/shadcn-v4/PATTERNS.md` |
| Props de X? | `specs/ux/shadcn-v4/api/ui-props.md` |
| Popup ou Drawer? | `specs/ux/vaul.md` |
| Qual grafico usar? | `specs/ux/shadcn-v4/components/charts/CHART-VARIANTS.md` |
| Cores e tokens? | `specs/ux/colorization.md` |
| Arquitetura frontend? | `specs/ux/pwa/pwa-mobile-first-agentic-app.md` |
| Padroes mobile? | `specs/ux/mobile-patterns.md` |
| Animacoes? | `specs/ux/framer-motion.md` |

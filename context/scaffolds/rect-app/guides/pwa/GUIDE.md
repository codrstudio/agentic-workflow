# PWA Mobile-First Agentic App — Estado da Arte (2025)

> **Filosofia**: Component-First, Custom-HTML Last  
> **Paradigma**: Mobile-First com Web Enhancements  
> **Layout**: Sem topbar, com breadcrumb bar, sidebar colapsável (web only)

---

## 1. Stack Recomendada

| Camada | Tecnologia | Versão | Papel |
|---|---|---|---|
| **Build** | Vite 6+ | ^6.x | Bundler + HMR + Env API + SSE Events |
| **Backend** | NodeJS + Hono + SSE Events |
| **PWA** | vite-plugin-pwa | ^1.x | SW, manifest, assets |
| **UI Runtime** | React 19 | ^19.x | RSC-ready, use() hook |
| **Primitives** | Radix UI _ou_ Base UI | latest | Headless a11y layer |
| **Design System** | shadcn/ui | latest | Component ownership (copy-paste) |
| **Styling** | Tailwind CSS 4 | ^4.x | CSS-first config, @theme |
| **Variants** | CVA (class-variance-authority) | ^0.7 | Variant styling API |
| **Utility** | tailwind-merge + clsx → `cn()` | — | Class merging |
| **Router** | TanStack Router | ^1.x | Type-safe, file-based, SPA-native |
| **Data** | TanStack Query | ^5.x | Cache, mutations, optimistic |
| **State** | Zustand | ^5.x | Lightweight global state |
| **Forms** | React Hook Form + Zod | latest | Validation schema-first |
| **Icons** | Lucide React | latest | Consistente com shadcn |

Use prefixo de caminho claros para roteamento simplificado:

| Camada | Prefixo |
| **Backend** | /api/v1/hub |
| **PWA** | /hub |

---

## 2. Arquitetura de Projeto

```
src/
├── app/
│   ├── routes/                  # TanStack file-based routes
│   │   ├── __root.tsx           # Root layout (sidebar + breadcrumb)
│   │   ├── _authenticated/      # Auth layout group
│   │   │   ├── dashboard.tsx
│   │   │   ├── agents/
│   │   │   │   ├── index.tsx
│   │   │   │   └── $agentId.tsx
│   │   │   └── chat/
│   │   │       └── $sessionId.tsx
│   │   └── _public/
│   │       └── login.tsx
│   ├── router.ts                # Router instance + config
│   └── main.tsx                 # Entry point
│
├── components/
│   ├── ui/                      # shadcn/ui components (owned)
│   │   ├── button.tsx
│   │   ├── sidebar.tsx
│   │   ├── breadcrumb.tsx
│   │   ├── sheet.tsx
│   │   ├── command.tsx
│   │   └── ...
│   ├── layout/                  # Layout composites
│   │   ├── app-shell.tsx        # Mobile: full-screen | Web: sidebar + content
│   │   ├── app-sidebar.tsx      # Sidebar (web enhancement)
│   │   ├── breadcrumb-bar.tsx   # Breadcrumb nav (always visible)
│   │   ├── mobile-nav.tsx       # Bottom nav / sheet nav (mobile)
│   │   └── sidebar-provider.tsx
│   ├── domain/                  # Feature-specific composites
│   │   ├── chat/
│   │   ├── agents/
│   │   └── dashboard/
│   └── shared/                  # Cross-feature reusables
│       ├── loading-skeleton.tsx
│       ├── error-boundary.tsx
│       └── empty-state.tsx
│
├── hooks/                       # Custom hooks
│   ├── use-mobile.ts            # isMobile detection
│   ├── use-pwa.ts               # SW registration, update prompt
│   └── use-online-status.ts     # Network awareness
│
├── lib/
│   ├── utils.ts                 # cn() + helpers
│   ├── api.ts                   # API client (fetch wrapper)
│   └── constants.ts
│
├── stores/                      # Zustand stores
│   ├── auth.store.ts
│   └── ui.store.ts
│
├── styles/
│   └── globals.css              # Tailwind v4 @theme + CSS vars
│
└── sw/                          # Custom service worker (se injectManifest)
    └── sw.ts
```

---

## 3. Configuração Base

### 3.1 Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/app/routes',
      generatedRouteTree: './src/app/routeTree.gen.ts',
    }),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Meu App Agentic',
        short_name: 'AgentApp',
        description: 'PWA Agentic App',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\..*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### 3.2 Tailwind CSS v4 (`globals.css`)

```css
@import "tailwindcss";

@theme {
  /* Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* Sidebar */
  --sidebar-width: 16rem;
  --sidebar-width-icon: 3rem;
  --sidebar-width-mobile: 18rem;
}

/*
 * CSS vars do shadcn (dark mode default para mobile-first)
 * Use :root para light e .dark para dark, ou inverta se dark-first
 */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --sidebar-background: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... restante do dark theme */
}
```

---

## 4. Layout Pattern: Mobile-First + Web Enhancements

### 4.1 Filosofia

```
┌─────────────────────────────────────────────────────────────┐
│  MOBILE (< md)                  WEB (≥ md)                  │
│                                                             │
│  ┌─────────────────────┐  ┌──────┬──────────────────────┐  │
│  │  [≡] Breadcrumb Bar │  │ Side │  [≡] Breadcrumb Bar  │  │
│  ├─────────────────────┤  │ bar  ├──────────────────────┤  │
│  │                     │  │      │                      │  │
│  │   Content Area      │  │ nav  │   Content Area       │  │
│  │   (full viewport)   │  │ items│   (flex-1)           │  │
│  │                     │  │      │                      │  │
│  │                     │  │      │                      │  │
│  ├─────────────────────┤  │      │                      │  │
│  │  Bottom Nav (opt.)  │  └──────┴──────────────────────┘  │
│  └─────────────────────┘                                    │
└─────────────────────────────────────────────────────────────┘

Mobile: menu abre como Sheet (overlay) ou bottom nav
Web: sidebar colapsável (icon mode ou full) + breadcrumb bar inline
Sem topbar em ambos → maximiza área útil
```

### 4.2 App Shell (`app-shell.tsx`)

```tsx
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { BreadcrumbBar } from '@/components/layout/breadcrumb-bar'
import { Separator } from '@/components/ui/separator'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      {/* Sidebar: hidden on mobile via shadcn internal logic,
          shows as collapsible on md+ */}
      <AppSidebar />

      <SidebarInset>
        {/* Breadcrumb Bar — compacta, sempre visível */}
        <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
          {/* Trigger: abre sheet no mobile, toggle sidebar no desktop */}
          <SidebarTrigger className="-ml-1 size-7" />
          <Separator orientation="vertical" className="h-4" />
          <BreadcrumbBar />
        </header>

        {/* Content: ocupa todo o restante */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

### 4.3 Breadcrumb Bar

```tsx
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useMatches } from '@tanstack/react-router'

export function BreadcrumbBar() {
  const matches = useMatches()

  // Filtra matches que têm context.breadcrumb definido na rota
  const crumbs = matches
    .filter((m) => m.context?.breadcrumb)
    .map((m) => ({
      label: m.context.breadcrumb as string,
      path: m.pathname,
    }))

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-sm">
        {crumbs.map((crumb, i) => (
          <BreadcrumbItem key={crumb.path}>
            {i < crumbs.length - 1 ? (
              <>
                <BreadcrumbLink href={crumb.path}
                  className="hidden md:inline-flex">
                  {crumb.label}
                </BreadcrumbLink>
                <BreadcrumbSeparator className="hidden md:block" />
              </>
            ) : (
              <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
```

### 4.4 Sidebar (Web Enhancement)

```tsx
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { useNavigate } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Settings,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Agentes', icon: Bot, href: '/agents' },
  { label: 'Chat', icon: MessageSquare, href: '/chat' },
  { label: 'Config', icon: Settings, href: '/settings' },
]

export function AppSidebar() {
  const navigate = useNavigate()

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        {/* Logo / App Name — collapsa para ícone */}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  tooltip={item.label}
                  onClick={() => navigate({ to: item.href })}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {/* User menu / logout */}
      </SidebarFooter>
    </Sidebar>
  )
}
```

---

## 5. Component-First, Custom-HTML Last

### Princípio

> **Nunca** escreva `<div className="flex items-center gap-2 rounded-md border p-3">` se um componente shadcn resolve.  
> **Sempre** comece compondo componentes. Só use HTML raw quando **nenhum** componente shadcn (nem composição deles) resolve.

### Hierarquia de Decisão

```
1. shadcn/ui component existe? → USA
2. Composição de shadcn components resolve? → COMPÕE
3. Radix primitive + Tailwind resolve? → USA PRIMITIVE
4. Nenhum acima? → HTML + Tailwind (último recurso)
```

### Exemplo Prático: Card de Agente

```tsx
// ✅ CORRETO: Component-first
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bot, Play } from 'lucide-react'

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
        <Bot className="size-5 text-muted-foreground" />
        <div className="flex-1">
          <CardTitle className="text-base">{agent.name}</CardTitle>
          <CardDescription>{agent.description}</CardDescription>
        </div>
        <Badge variant={agent.active ? 'default' : 'secondary'}>
          {agent.active ? 'Ativo' : 'Inativo'}
        </Badge>
      </CardHeader>
      <CardContent>
        <Button size="sm" className="w-full">
          <Play className="size-4" />
          Iniciar Chat
        </Button>
      </CardContent>
    </Card>
  )
}

// ❌ ERRADO: Custom-HTML first
export function AgentCardBad({ agent }: { agent: Agent }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Bot className="size-5" />
        <div>
          <h3 className="font-semibold">{agent.name}</h3>
          <p className="text-sm text-muted-foreground">{agent.description}</p>
        </div>
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
          {agent.active ? 'Ativo' : 'Inativo'}
        </span>
      </div>
      <button className="mt-3 w-full rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
        Iniciar Chat
      </button>
    </div>
  )
}
```

---

## 6. PWA Essentials

### 6.1 Hook de Registro do SW

```tsx
// hooks/use-pwa.ts
import { useRegisterSW } from 'virtual:pwa-register/react'

export function usePWA() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Check for updates every hour
      r && setInterval(() => r.update(), 60 * 60 * 1000)
    },
  })

  const close = () => setNeedRefresh(false)

  return { needRefresh, offlineReady, updateServiceWorker, close }
}
```

### 6.2 Update Prompt (Component-First)

```tsx
import { usePWA } from '@/hooks/use-pwa'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw } from 'lucide-react'

export function PWAUpdatePrompt() {
  const { needRefresh, updateServiceWorker, close } = usePWA()

  if (!needRefresh) return null

  return (
    <Alert className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:w-96">
      <RefreshCw className="size-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>Nova versão disponível</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={close}>
            Depois
          </Button>
          <Button size="sm" onClick={() => updateServiceWorker(true)}>
            Atualizar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
```

### 6.3 Network Awareness

```tsx
// hooks/use-online-status.ts
import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true // SSR fallback
  )
}
```

---

## 7. Mobile-First Patterns

### 7.1 Detecção de Mobile (`use-mobile.ts`)

```tsx
import { useMediaQuery } from '@/hooks/use-media-query'

// Breakpoint md do Tailwind = 768px
export function useIsMobile() {
  return !useMediaQuery('(min-width: 768px)')
}
```

### 7.2 Safe Area (Notch / Gesture Bar)

```css
/* globals.css */
:root {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
}

/* Aplicar no shell */
.app-shell {
  padding-top: var(--safe-area-top);
  padding-bottom: var(--safe-area-bottom);
}
```

```html
<!-- index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

### 7.3 Touch-Optimized Targets

```tsx
// Mínimo 44x44px para touch targets (WCAG 2.5.5)
// shadcn Button size="default" já atende (h-9 = 36px mínimo)
// Para mobile, preferir size="lg" em ações primárias

<Button size="lg" className="h-12 w-full"> {/* 48px — ideal mobile */}
  Confirmar
</Button>
```

### 7.4 Gestures (Swipe para sidebar no mobile)

```tsx
// Usar Sheet do shadcn como base — já tem gesture handling nativo via Radix Dialog
// O componente Sidebar do shadcn já renderiza como Sheet em mobile automaticamente
// Não precisa implementar manualmente
```

---

## 8. Routing — TanStack Router

### 8.1 Root Route com Layout

```tsx
// routes/__root.tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/app-shell'
import { PWAUpdatePrompt } from '@/components/shared/pwa-update-prompt'
import type { QueryClient } from '@tanstack/react-query'

interface RouterContext {
  queryClient: QueryClient
  auth: { isAuthenticated: boolean }
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <AppShell>
      <Outlet />
      <PWAUpdatePrompt />
    </AppShell>
  ),
})
```

### 8.2 Route com Breadcrumb Context

```tsx
// routes/_authenticated/agents/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { agentsQueryOptions } from '@/lib/queries/agents'

export const Route = createFileRoute('/_authenticated/agents/')({
  beforeLoad: () => ({
    breadcrumb: 'Agentes',
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(agentsQueryOptions()),
  component: AgentsPage,
})

function AgentsPage() {
  const agents = Route.useLoaderData()
  // ...
}
```

---

## 9. Data Layer — TanStack Query

```tsx
// lib/queries/agents.ts
import { queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const agentsQueryOptions = () =>
  queryOptions({
    queryKey: ['agents'],
    queryFn: () => api.get<Agent[]>('/agents'),
    staleTime: 5 * 60 * 1000, // 5min — bom pra PWA offline
  })

export const agentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['agents', id],
    queryFn: () => api.get<Agent>(`/agents/${id}`),
  })
```

---

## 10. Checklist de Qualidade PWA

- [ ] **Manifest** completo com icons 192 + 512 + maskable
- [ ] **Service Worker** com `autoUpdate` + runtime caching de API
- [ ] **Offline fallback** — pelo menos shell carrega offline
- [ ] **viewport-fit=cover** para safe areas
- [ ] **theme-color** no manifest E na meta tag
- [ ] **display: standalone** no manifest
- [ ] **orientation: portrait** (mobile-first)
- [ ] **Apple touch icon** + meta tags iOS
- [ ] **Screenshots** no manifest (melhora install prompt)
- [ ] **Lighthouse PWA score** > 90
- [ ] **Touch targets** mínimo 44x44px
- [ ] **Sem topbar** — breadcrumb bar compacta (h-10)
- [ ] **Sidebar web-only** — Sheet no mobile
- [ ] **Component-first** — zero `<div>` substitutíveis por shadcn

---

## 11. Dependências (package.json resumido)

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-router": "^1.100.0",
    "@tanstack/react-query": "^5.60.0",
    "zustand": "^5.0.0",
    "react-hook-form": "^7.54.0",
    "@hookform/resolvers": "^3.9.0",
    "zod": "^3.24.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^3.0.0",
    "lucide-react": "^0.500.0",
    "radix-ui": "^1.0.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "@vitejs/plugin-react-swc": "^4.0.0",
    "vite-plugin-pwa": "^1.0.0",
    "@tanstack/router-plugin": "^1.100.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

---

## 12. Notas de Estado da Arte (2025)

**shadcn/ui agora suporta Base UI como alternativa ao Radix.** Base UI (v1 stable, dez/2025) oferece `<Select multiple>`, Combobox nativo, e NumberField com scrub — features que Radix não tem. Para projetos novos, Base UI é recomendado; para projetos existentes com Radix, migre só se precisar dessas features.

**Tailwind CSS v4** abandonou `tailwind.config.js` em favor de CSS-first config com `@theme` directive. shadcn/ui já suporta v4 nativamente com CSS vars em oklch.

**TanStack Router** é o router recomendado para SPAs com Vite em 2025. Type-safe end-to-end, file-based routing, search params tipados, e loader/beforeLoad pattern para data e context (incluindo breadcrumbs). Nota: `vite-plugin-pwa` + TanStack **Start** (SSR) tem issues conhecidas; com TanStack **Router** (SPA) funciona sem problemas.

**vite-plugin-pwa v1.x** requer Vite 5+, suporta Vite 6. Use `registerType: 'autoUpdate'` para PWAs que precisam estar sempre atualizadas. Para controle granular do SW, use `strategies: 'injectManifest'`.

**React 19** traz `use()` hook, Server Components readiness, e melhorias em Suspense — mesmo em SPA mode, o `use()` simplifica data fetching em componentes.
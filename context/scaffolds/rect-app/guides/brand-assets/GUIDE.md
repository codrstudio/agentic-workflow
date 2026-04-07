# Brand Assets — Inventário e Pipeline

Referência de todos os assets visuais derivados do brand. Manter atualizado quando novos assets forem criados.

## Fonte (Brand Slots)

12 SVGs organizados em `data/brand/` (uploaded via `/keep/setup`):

| Nome base | Dark | Light | Uso |
|-----------|------|-------|-----|
| Icon | `icon-dark.svg` | `icon-light.svg` | Fonte para derivação de PNGs externos |
| Logo | `logo-dark.svg` | `logo-light.svg` | Logo compacto (Hub sidebar collapsed) |
| Logo H | `logo-h-dark.svg` | `logo-h-light.svg` | Header horizontal (Hub sidebar, Hub dashboard, Portal AppShell) |
| Logo V | `logo-v-dark.svg` | `logo-v-light.svg` | Logo vertical (Portal login) |
| Creative H | `creative-h-dark.svg` | `creative-h-light.svg` | Banner horizontal (disponível) |
| Creative V | `creative-v-dark.svg` | `creative-v-light.svg` | Banner vertical (disponível) |

Servidos via API: `GET /api/v1/borracharia/config/brand/svg/:slot`

## Assets Externos (1 set — não varia por tema)

Assets usados pelo OS/browser — favicon, PWA, home screen. Derivados de `icon-dark` ou `icon-light` (operador escolhe). Gerados em `data/brand/derived/`, copiados para `public/` de cada app.

| Asset | Tamanho | Hub destino | Portal destino |
|-------|---------|-------------|----------------|
| `favicon.ico` | 32x32 | `public/favicon.ico` | `public/favicon.ico` |
| `favicon-16x16.png` | 16x16 | `public/favicon-16x16.png` | `public/favicon-16x16.png` |
| `favicon-32x32.png` | 32x32 | `public/favicon-32x32.png` | `public/favicon-32x32.png` |
| `apple-touch-icon.png` | 180x180 | `public/apple-touch-icon.png` | `public/apple-touch-icon.png` |
| `icon-72.png` | 72x72 | `public/icons/` | `public/icons/` |
| `icon-96.png` | 96x96 | `public/icons/` | `public/icons/` |
| `icon-128.png` | 128x128 | `public/icons/` | `public/icons/` |
| `icon-144.png` | 144x144 | `public/icons/` | `public/icons/` |
| `icon-152.png` | 152x152 | `public/icons/` | `public/icons/` |
| `icon-192.png` | 192x192 | `public/icons/` | `public/icons/` |
| `icon-384.png` | 384x384 | `public/icons/` | `public/icons/` |
| `icon-512.png` | 512x512 | `public/icons/` | `public/icons/` |
| `maskable-192.png` | 192x192 | `public/icons/` | `public/icons/` |
| `maskable-512.png` | 512x512 | `public/icons/` | `public/icons/` |

**Total:** 14 assets x 2 apps = 28 cópias

### Specs de geração

- **PWA icons:** sharp resize direto do SVG
- **Maskable:** 10% safe zone padding, fundo `#111827`, sharp composite
- **favicon.ico:** 32x32 PNG salvo como .ico
- **apple-touch-icon:** 180x180 PNG

## Assets In-App (2 sets — dark E light)

Servidos dinamicamente via API. O frontend seleciona dark/light conforme o tema ativo do usuário. **Não são PNGs derivados** — são os próprios SVGs dos slots.

| Slot | Componente | Arquivo |
|------|-----------|---------|
| `logo-h-{theme}` | Hub `AppLayout.tsx` (sidebar expanded) | `apps/hub/src/components/AppLayout.tsx` |
| `logo-{theme}` | Hub `AppLayout.tsx` (sidebar collapsed) | `apps/hub/src/components/AppLayout.tsx` |
| `logo-h-{theme}` | Hub `DashboardHeader.tsx` | `apps/hub/src/components/DashboardHeader.tsx` |
| `logo-h-{theme}` | Portal `AppShell.tsx` (top bar) | `apps/portal/src/components/app/AppShell.tsx` |
| `logo-v-{theme}` | Portal login page | `apps/portal/src/app/entrar/page.tsx` |

**Pendência:** Hub e Portal hoje referenciam apenas variantes `-dark` hardcoded. Deveriam alternar conforme tema do usuário.

## Estáticos Não-Deriváveis

Assets que **não** fazem parte do pipeline de brand:

| Asset | Local | Nota |
|-------|-------|------|
| `the-truck-*.png/.webp` | `apps/portal/public/` | Ilustração hero da landing page |
| `logo-h.svg` | `apps/portal/public/logo-h.svg` | **Cópia estática** do logo — deveria ser substituída pela referência dinâmica da API |
| `og-image.jpg` | Portal metadata | Referenciado em `layout.tsx` mas **não existe** — precisa ser criado |
| Screenshots PWA | `public/screenshots/` em ambos | Capturas de tela, não deriváveis automaticamente |

## Pipeline de Derivação

Endpoint: `POST /api/v1/borracharia/setup/brand/derive`

1. **Fonte:** busca `icon-dark` ou `icon-light` (conforme escolha do operador)
2. **Gera:** 14 PNGs + 1 ICO em `data/brand/derived/`
3. **Publica:** copia para `apps/hub/public/` e `apps/portal/public/` (step Publicar)

## Referências

- Brand upload/derive UI: `apps/hub/src/routes/keep.setup.index.tsx`
- API setup config (derive): `apps/api/src/routes/setup-config.ts`
- API public config (serve): `apps/api/src/routes/public-config.ts`
- DB schema (slots): `packages/db/src/schema.ts` (tabela `setup`)
- Scripts locais (dev): `assets/brand/scripts/`

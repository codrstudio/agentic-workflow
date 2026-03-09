---
agent: coder
description: Migra uma página de apps/web.reference para apps/web em formato responsivo com TanStack Router
---

# Rebuild Web Page

Implemente uma página da referência completamente nesta sessão, migrando para o novo app responsivo.

## Orientação

O loop selecionou uma página para migrar. Sua tarefa é:
1. Entender a página na referência (layout, componentes, funcionalidade)
2. Criar a rota correspondente em TanStack Router file-based
3. Migrar/adaptar componentes para mobile-first (Dialogs → Sheets em mobile)
4. Integrar com o AppSidebar dinâmico
5. Testar e validar build

## Protocolo

1. Leia `{sprint}/features.json` para entender contexto das features e dependências
2. Leia o arquivo de feature específica no features.json para obter `page_file` e testes esperados
3. Se houver dependências não-passing, reportar e pular (gutter detector vai retentar)
4. Na referência, leia `{reference_dir}/pages/{page_file}` e componentes associados
5. **Identifique**:
   - Estrutura e layout da página
   - Componentes customizados usados
   - Props esperadas e tipos
   - Estado local (se houver)
   - Chamadas de API
6. **Crie a rota** em `{web_dir}/routes/web/`:
   - Se for aba principal: `projects.$projectId.{section}.tsx`
   - Se for sub-rota: `projects.$projectId.{section}.$id.tsx`
   - Use TanStack Router file-based pattern
7. **Migre componentes**:
   - Copie componentes usados de `{reference_dir}/components/` para `{web_dir}/components/`
   - Adapte imports para novo layout
   - Para modais: use Dialog em desktop, Sheet em mobile (use `use-mobile` hook)
8. **Integre com navegação**:
   - Se for aba principal: adicione ao ProjectNav em `projects-sidebar.tsx`
   - Se for sub-página: certifique-se breadcrumb/back-button funciona
   - Se for item mobile: adicione ao `dynamic-bottom-nav.tsx`
9. **Validação**:
   - `npx tsc --noEmit` no diretório {web_dir}
   - `npx vite build` no diretório {web_dir}
   - Acesse rota no navegador (se possível)
   - Verifique responsividade (mobile, tablet, desktop)
10. **Finalize**:
    - Commit com mensagem descritiva
    - Atualize `{sprint}/features.json`: marque feature como `passing`

## Estrutura de Rota (TanStack Router)

### Aba principal (ex: sources, chat, pipeline):
```
{web_dir}/routes/web/projects.$projectId.{section}.tsx
```

Exemplo: `routes/web/projects.$projectId.sources.tsx`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { SourcesPage } from '@/components/pages/sources-page'

export const Route = createFileRoute('/web/projects/$projectId/sources')({
  component: SourcesPage,
})
```

### Sub-rota (ex: chat/$sessionId):
```
{web_dir}/routes/web/projects.$projectId.{section}.$subId.tsx
```

Exemplo: `routes/web/projects.$projectId.chat.$sessionId.tsx`

## Componentes a Criar

Geralmente você criará um arquivo página em `{web_dir}/src/components/pages/`:

```
{web_dir}/src/components/pages/{section}-page.tsx
```

Este componente:
- Renderiza conteúdo principal
- Importa sub-componentes de suporte
- Adapta layouts para mobile (use `use-mobile` hook)
- Integra com AppSidebar se necessário

## Output

- Rota criada em `{web_dir}/routes/web/...`
- Componentes migratos em `{web_dir}/src/components/pages/` e subdirs
- Feature marcada como `passing` em `{sprint}/features.json` com `completed_at`
- Build valida sem erros (`npx vite build`)
- RouteTree atualizado (automático com TanStack Router)

## Checklist por Feature

Antes de marcar como passing, verifique:

- [ ] Rota TanStack Router criada
- [ ] Componente página renderiza corretamente
- [ ] Componentes de suporte migrados
- [ ] Responsive (mobile, tablet, desktop)
- [ ] Dialog/Sheet usado apropriadamente
- [ ] AppSidebar integrado (se aba principal)
- [ ] Breadcrumb/back-navigation funciona
- [ ] Todos os testes em features.json passam
- [ ] `npx tsc --noEmit` sem erros
- [ ] `npx vite build` sem erros
- [ ] Commit feito com mensagem descritiva

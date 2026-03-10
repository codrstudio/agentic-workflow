# PRP-013 — Look & Feel Refactoring

**Specs:** S-018
**Prioridade:** 4 (refinamento visual transversal, melhor após as mudanças estruturais)
**Dependências:** PRP-010, PRP-011

## Objetivo

Revisão da hierarquia visual das páginas existentes para tornar mais claro e evidente o que mais importa: status de processo ativo em destaque, métricas de progresso mais visíveis, reduzir ruído visual em estados neutros. Missão principal do TASK.md.

## Escopo

### Frontend (apps/web)

Refatoração visual (CSS/componentes) sem alterações no backend:

1. **Wave Detail** — diferenciação visual forte entre status dos steps (running=azul com animação, completed=verde sutil, failed=vermelho, interrupted=amber, pending=opacidade 60%). Progress bar maior (h-3). Counters com fonte maior.
2. **Projetos** — cards com indicador de atividade (dot pulsante quando há run ativo)
3. **Detalhe do Projeto** — seção de runs ativos com destaque visual, botão de execução proeminente
4. **Step Detail** — metadados em grid de cards compactos, status em destaque no topo
5. **Console** — área de input visualmente distinta, feed items com padding adequado

## Features

| ID | Feature | Descrição |
|----|---------|-----------|
| F-036 | Wave & Step Visual Hierarchy | Aplicar padrões visuais por status em `wave-detail.tsx`: `running` com `bg-blue-500/10 border-blue-500/30` e ícone animado, `completed` com `bg-green-500/10`, `failed` com `bg-red-500/10`, `interrupted` com `bg-amber-500/10`, `pending` com `opacity-60`. Progress bar `h-3` com números absolutos. Counters de steps com tipografia maior. Feature loop progress ring. Step detail com metadados em grid de cards e status grande no topo. |
| F-037 | Project Cards & Console Polish | Cards de projeto em `projects.tsx` com dot pulsante quando há run ativo (consultar `/runs/active`). `project-detail.tsx` com seção de runs ativos em destaque visual. Botão de execução mais proeminente sem run ativo. Console `pages/console.tsx` com área de input visualmente distinta (fundo/borda diferente), feed items com espaçamento adequado. Consistência entre temas claro/escuro. |

## Limites

- NÃO altera funcionalidade — apenas aparência e hierarquia visual
- NÃO introduz componentes novos de UI library — usa classes Tailwind e variáveis shadcn existentes
- NÃO altera layout/estrutura das páginas — apenas refinamento visual dentro da estrutura existente

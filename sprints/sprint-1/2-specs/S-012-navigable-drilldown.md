# S-012 — Navegação Linkada (Drill-down)

**Discoveries:** D-012 (score 6)

## Objetivo

Implementar a regra de ouro do TASK.md: "a própria informação exibida serve como navegação para um nível de detalhamento". Cada item da interface é clicável e leva ao próximo nível de detalhe.

## Escopo

Este spec não adiciona endpoints novos — usa os já definidos em S-004, S-007 e S-009. O foco é na experiência de navegação do frontend.

### Hierarquia de Drill-down

```
/projects                          → Lista de projetos (cards)
  /projects/:slug                  → Detalhe do projeto + waves + actions
    /projects/:slug/waves/:n       → Timeline de steps + feature dashboard
      /projects/:slug/waves/:n/steps/:i  → Log viewer do step
```

### Comportamentos

1. **Projetos → Projeto**: Card clicável. Mostra waves, actions, formulário de execução.
2. **Projeto → Wave**: Wave card/row clicável. Mostra steps timeline.
3. **Wave → Step**: Step item na timeline clicável. Mostra spawn metadata + log viewer.
4. **Step ralph-wiggum → Feature**: Dentro do loop dashboard, feature clicável abre logs da tentativa.
5. **Breadcrumb**: Navegação breadcrumb no topo do conteúdo para voltar a níveis superiores.

### Breadcrumb

```
Projetos > aw-monitor > Wave 1 > Step 03 - derive-specs
```

Cada segmento é um link. Em mobile, breadcrumb colapsa mostrando apenas o pai imediato + botão "..." para níveis anteriores (vaul drawer).

### Links Contextuais

- Nome de feature em qualquer lugar → link para feature detail
- Nome de step em qualquer lugar → link para step detail
- PID de processo → (não linkável, apenas informativo)

## Componentes Frontend

### Breadcrumb

- Componente reutilizável que recebe a hierarquia de navegação
- Desktop: breadcrumb horizontal completo
- Mobile: último nível + "..." que abre drawer com níveis anteriores

### LinkableText

- Componente que detecta referências (F-XXX, step-XX) e converte em links
- Usado em previews de output, mensagens do console, etc.

## Critérios de Aceite

1. Todo card/item de lista é clicável e navega para o nível de detalhe
2. Breadcrumb aparece em todas as páginas exceto `/projects` (root)
3. Breadcrumb funciona em mobile (colapso + drawer)
4. Navegação back do browser funciona corretamente em todos os níveis
5. Features do loop dashboard são clicáveis
6. Referências F-XXX no texto são linkáveis quando possível
7. Não há dead-ends na navegação (sempre é possível subir ou descer)

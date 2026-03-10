# S-018 — Look & Feel Refactoring

**Discoveries:** D-022 (score 7)

## Objetivo

Revisão da hierarquia visual das páginas existentes para tornar mais claro e evidente o que mais importa: status de processo ativo em destaque, métricas de progresso mais visíveis, reduzir ruído visual em estados neutros. Missão principal do TASK.md para este sprint.

## Escopo

### Frontend (apps/web)

Refatoração visual (CSS/componentes) das seguintes páginas, sem alterações no backend:

1. **Projetos** (`pages/projects.tsx`)
2. **Detalhe do Projeto** (`pages/project-detail.tsx`)
3. **Wave Detail** (`pages/wave-detail.tsx`)
4. **Step Detail** (`pages/step-detail.tsx`)
5. **Console** (`pages/console.tsx` — versão pós S-015)

## Princípios de Design

### 1. Status ativo em destaque

- Steps com status `running` devem ter destaque visual forte (borda colorida, fundo highlight, animação sutil)
- Steps `pending` devem ser visualmente sutis (opacidade reduzida, sem borda, cinza)
- Steps `completed` devem ser claros mas não dominantes (verde suave)
- Steps `failed` e `interrupted` devem ser visualmente alertantes (vermelho/amber)

### 2. Métricas de progresso visíveis

- Progress bar da wave deve ser mais proeminente (maior, com números absolutos)
- Counters (X/Y steps, N passing, M failing) devem usar tipografia maior e cores distintas
- Feature loop progress deve usar progress ring ao invés de progress bar para maior destaque

### 3. Reduzir ruído visual

- Remover bordas desnecessárias em cards quando o conteúdo é evidente
- Usar espaçamento e tipografia para separar seções em vez de linhas/bordas
- Estados neutros (sem atividade) devem ter menor contraste

## Alterações por Página

### Projetos (`pages/projects.tsx`)

- Cards de projeto devem mostrar indicador de atividade: se há runs ativos, exibir dot pulsante ou badge "Ativo" no card
- Sem run ativo, card deve ser visualmente neutro (sem destaque)

### Detalhe do Projeto (`pages/project-detail.tsx`)

- Seção de runs ativos com destaque visual (fundo primário suave, borda)
- Lista de waves com indicadores de status mais claros (em vez de apenas texto)
- Botão de execução mais proeminente quando não há run ativo

### Wave Detail (`pages/wave-detail.tsx`)

- Timeline de steps com diferenciação visual mais forte entre estados:
  - `running`: fundo azul-50 (light) / azul-950 (dark), borda azul, ícone animado
  - `completed`: fundo verde-50/950 sutil, ícone verde estático
  - `failed`: fundo vermelho-50/950, borda vermelha
  - `interrupted`: fundo amber-50/950, borda amber
  - `pending`: opacidade 60%, sem borda colorida
- Progress bar maior (h-3 em vez de h-2), com gradiente ou cor sólida primária
- Counters de steps em destaque com fonte maior

### Step Detail (`pages/step-detail.tsx`)

- Metadados do step (PID, modelo, timing) em cards compactos em grid
- Status do step em destaque no topo com ícone grande e label
- LogViewer com melhor separação visual entre tipos de mensagem

### Console (`pages/console.tsx`)

- Área de input de mensagem visualmente distinta (fundo diferente, borda mais forte)
- Feed items com padding e espaçamento adequados para leitura
- Diferenciação clara entre operator messages e engine events (além do alinhamento)

## Padrões Visuais (Design Tokens)

Usar as classes utilitárias do Tailwind e as variáveis de cor do shadcn/ui já existentes:

```
Status running:  bg-blue-500/10 border-blue-500/30
Status completed: bg-green-500/10 border-green-500/30
Status failed:   bg-red-500/10 border-red-500/30
Status interrupted: bg-amber-500/10 border-amber-500/30
Status pending:  opacity-60
```

## Critérios de Aceite

1. Steps `running` são visualmente destacados com cor de fundo e borda na wave timeline
2. Steps `pending` são visualmente sutis (opacidade reduzida)
3. Progress bar da wave é mais proeminente (altura e numeração)
4. Cards de projeto exibem indicador de atividade quando há run ativo
5. Metadados do step detail são exibidos em grid de cards compactos
6. Consistência visual entre temas claro e escuro (ambos devem respeitar a hierarquia)
7. Sem regressão funcional — todas as interações existentes continuam funcionando
8. Funciona em mobile com layout responsivo mantido

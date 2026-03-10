# S-017 — Event Log Smart Scroll + Controle de Linhas

**Discoveries:** D-018 (score 8), D-020 (score 6)

**Depende de:** S-015 (Console + Events fusion)

## Objetivo

Implementar scroll inteligente no feed unificado da Console (S-015): scroll interno ao container (não page scroll), autoscroll que detecta posição do usuário, e controle de número máximo de linhas exibidas. Combina D-018 (smart scroll) e D-020 (controle de linhas) em uma única spec por serem funcionalidades complementares no mesmo componente.

## Escopo

### Frontend (apps/web)

- Alterar `pages/console.tsx` (versão fusionada de S-015)
- Scroll interno no container do feed (já é `overflow-y-auto`, mas precisa de comportamento de autoscroll refinado)
- Controle numérico de linhas máximas exibidas
- Autoscroll inteligente baseado em posição do scroll

## Comportamento do Autoscroll

### Regras

1. **Autoscroll ativo**: quando o scroll está no bottom (ou próximo, tolerância de 50px), novas entradas rolam automaticamente o feed para o bottom
2. **Autoscroll suspenso**: quando o usuário rola para cima (para investigar entradas antigas), o autoscroll é desativado. O feed continua recebendo novas entradas, mas não move o scroll
3. **Retomar autoscroll**: quando o usuário rola de volta ao bottom, o autoscroll é reativado
4. **Indicador visual**: quando o autoscroll está suspenso e há novas entradas abaixo, exibir um botão flutuante "↓ Novas entradas" que, ao clicar, rola para o bottom e reativa o autoscroll

### Implementação

```typescript
// Detectar se está no bottom
function isAtBottom(el: HTMLElement, threshold = 50): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

// useRef para rastrear estado de autoscroll
const feedRef = useRef<HTMLDivElement>(null)
const isAutoScrolling = useRef(true)
const [hasNewBelow, setHasNewBelow] = useState(false)

// onScroll handler
function handleScroll() {
  if (!feedRef.current) return
  const atBottom = isAtBottom(feedRef.current)
  isAutoScrolling.current = atBottom
  if (atBottom) setHasNewBelow(false)
}

// Quando nova entrada chega
useEffect(() => {
  if (isAutoScrolling.current && feedRef.current) {
    feedRef.current.scrollTop = feedRef.current.scrollHeight
  } else {
    setHasNewBelow(true)
  }
}, [feedItems.length])
```

## Controle de Linhas Visíveis

### UI

Input numérico posicionado ao lado dos filtros no header da Console. Permite definir quantas entradas exibir no feed.

```
┌──────────────────────────────────────────┐
│ Projeto: [select ▼]  Linhas: [100 ▼]    │
│                           [Filtros ▼]    │
└──────────────────────────────────────────┘
```

### Valores

- **Padrão**: 100
- **Select com opções predefinidas**: 50, 100, 200, 500
- **Comportamento**: quando o número total de entradas excede o limite, as entradas mais antigas são descartadas do array (slice do final)
- **Persistência**: valor salvo em `localStorage` com chave `aw-console-max-lines`

### Implementação

```typescript
const [maxLines, setMaxLines] = useState(() => {
  const saved = localStorage.getItem('aw-console-max-lines')
  return saved ? parseInt(saved, 10) : 100
})

// Aplicar limite ao feed
const visibleItems = feedItems.slice(-maxLines)
```

## Scroll Interno (não page scroll)

O container do feed deve ter altura fixa (fill available height) e `overflow-y: auto`. A página em si não deve rolar — apenas o container interno do feed.

Estrutura CSS:
```
.console-page {
  display: flex;
  flex-direction: column;
  height: 100%;  /* preenche o AppShell content area */
}

.feed-container {
  flex: 1;
  min-height: 0;  /* permite shrink no flexbox */
  overflow-y: auto;
}
```

## Componente: Botão "Novas Entradas"

Quando autoscroll está suspenso e há novas entradas abaixo do viewport:

```tsx
{hasNewBelow && (
  <button
    onClick={scrollToBottom}
    className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10
               rounded-full bg-primary px-4 py-1.5 text-sm
               text-primary-foreground shadow-lg
               hover:bg-primary/90 transition-colors"
  >
    ↓ Novas entradas
  </button>
)}
```

## Critérios de Aceite

1. Feed do Console usa scroll interno (container não causa page scroll)
2. Autoscroll ativo quando scroll está no bottom: novas entradas rolam automaticamente
3. Autoscroll suspenso quando usuário rola para cima: novas entradas não movem o scroll
4. Botão "Novas entradas" aparece quando há conteúdo novo abaixo do viewport
5. Clicar no botão rola ao bottom e reativa autoscroll
6. Select de linhas máximas funciona com opções 50, 100, 200, 500
7. Valor de linhas máximas persiste em `localStorage`
8. Entradas mais antigas são descartadas quando o total excede o limite
9. Funciona em mobile

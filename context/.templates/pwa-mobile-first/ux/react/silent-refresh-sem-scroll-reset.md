# Silent Refresh sem Scroll Reset

Tecnica para fazer auto-refresh de dados em componentes React sem destruir a posicao de scroll do usuario.

## Problema

Componentes que fazem polling/auto-refresh frequentemente seguem este padrao:

```tsx
const loadDetail = async (id: string) => {
  setLoading(true)        // <-- dispara re-render
  const data = await fetch(id)
  setDetail(data)
  setLoading(false)
}

// No componente:
if (loading) return <p>Carregando...</p>  // <-- desmonta a arvore DOM inteira
```

A cada ciclo de refresh:
1. `setLoading(true)` causa re-render
2. O early return `if (loading)` **desmonta** o container scrollavel
3. Quando os dados voltam, o container e **remontado do zero** com scroll no topo
4. O usuario perde a posicao de leitura

## Solucao: Dois modos de carregamento

Separar "primeira carga" (com loading screen) de "refresh silencioso" (background, sem desmontar UI).

### 1. loadDetail com parametro `silent`

```tsx
const loadDetail = useCallback(async (id: string, silent = false) => {
  // Primeira carga: mostra loading. Refresh: silencioso.
  if (!silent) setDetailLoading(true)

  try {
    const { run } = await fetchRunDetail(id)

    // Compara com dado atual — se nada mudou, skip setState
    // Evita re-render desnecessario e preserva referencias
    setDetail(prev => {
      if (prev && JSON.stringify(prev) === JSON.stringify(run)) return prev
      return run
    })
  } catch {
    // Em refresh silencioso, nao limpa dados existentes
    if (!silent) setDetail(null)
  } finally {
    if (!silent) setDetailLoading(false)
  }
}, [])
```

### 2. Chamadas diferenciadas

```tsx
// Primeira carga (usuario clicou, mudou de rota): com loading
useEffect(() => {
  if (runId) loadDetail(runId)       // silent=false (default)
}, [runId])

// Auto-refresh no interval: silencioso
useEffect(() => {
  const interval = setInterval(() => {
    if (runId) loadDetail(runId, true)  // silent=true
  }, 10_000)
  return () => clearInterval(interval)
}, [runId])
```

### 3. Componente de detalhe: nunca desmontar o container

**Antes (quebrado):**
```tsx
export function RunDetail({ run, loading }) {
  if (loading) {
    return <p>Carregando...</p>  // DESMONTA tudo, scroll morre
  }
  return (
    <div className="overflow-y-auto">
      {/* conteudo scrollavel */}
    </div>
  )
}
```

**Depois (correto):**
```tsx
export function RunDetail({ run, loading }) {
  // Sem early return! O container scrollavel NUNCA desmonta.
  return (
    <div className="flex flex-col h-full">
      <div className="header">
        <h2>{run.id}</h2>
        {/* Spinner sutil no header — indica refresh sem destruir layout */}
        {loading && (
          <div className="w-3 h-3 border-2 border-muted-foreground/30
            border-t-muted-foreground rounded-full animate-spin" />
        )}
      </div>

      {/* Container scrollavel permanece montado — scroll preservado */}
      <div className="flex-1 overflow-y-auto">
        {/* conteudo */}
      </div>
    </div>
  )
}
```

## Por que funciona

| Aspecto | Antes | Depois |
|---------|-------|--------|
| `setLoading(true)` no refresh | Sempre | So na primeira carga |
| Early return `if (loading)` | Desmonta container | Removido |
| Container scrollavel | Remontado a cada refresh | Nunca desmontado |
| Posicao de scroll | Perdida | Preservada |
| setState desnecessario | Sempre | Skip via JSON.stringify |
| Feedback visual | Tela de loading inteira | Spinner sutil no header |

## Quando usar

- Qualquer componente com auto-refresh/polling que tenha area scrollavel
- Dashboards, monitores, feeds, listas longas com atualizacao periodica
- Situacoes onde o usuario esta lendo/analisando dados enquanto o refresh acontece

## Consideracoes

- **JSON.stringify** e suficiente para objetos de tamanho moderado (< 100KB). Para objetos muito grandes, considere comparar apenas campos-chave (ex: `updatedAt` ou um hash)
- Se o componente precisa de loading na primeira carga, mantenha o `if (!detail) return <Loading />` — o ponto e nunca desmontar **depois** que ja tem dados
- O spinner sutil e melhor UX que opacity/fade porque nao atrapalha a leitura do conteudo

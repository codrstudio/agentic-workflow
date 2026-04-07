# Component-First: shadcn + DRY

## Principio

Toda UI deve ser construida a partir de componentes compartilhados em `packages/ui`, maximizando o uso da biblioteca shadcn/ui e minimizando Tailwind customizado.

## Por que

1. **Consistencia visual** — o mesmo componente usado em todos os lugares garante look and feel uniforme
2. **Troca de tema** — quanto menos Tailwind custom, maior a conformidade ao trocar temas do shadcn. Componentes que usam tokens semanticos (`primary`, `destructive`, `muted`, etc.) se adaptam automaticamente
3. **DRY** — um componente definido uma vez, reutilizado em todo o app. Mudanca num lugar reflete em todos

## Regras

### 1. shadcn primeiro

Antes de criar qualquer elemento de UI, verificar se o shadcn/ui ja oferece o componente. Se oferece, usar. Se precisa de ajuste, ajustar o componente base em `packages/ui` — nunca criar versao custom por pagina.

### 2. Componentes vivem em `packages/ui`

Qualquer componente reutilizavel deve ser criado em `packages/ui/src/components/`. Nunca duplicar logica de componente em paginas ou features individuais.

### 3. Minimo Tailwind custom

Evitar classes Tailwind ad-hoc em paginas para estilizar componentes. Se um estilo se repete, ele deve virar uma variante do componente (via CVA) ou um componente novo em `packages/ui`.

Exemplos de **o que evitar**:
```tsx
// RUIM — estilo ad-hoc que deveria ser variante do componente
<span className="inline-flex items-center rounded-full border border-green-500 bg-green-500/10 px-2 py-0.5 text-xs text-green-500">
  Ativo
</span>

// BOM — componente compartilhado
<Badge variant="outline" className="border-green-500 bg-green-500/10 text-green-500">
  Ativo
</Badge>
```

### 4. Tokens semanticos sobre cores hardcoded

Preferir tokens do tema (`primary`, `secondary`, `destructive`, `muted`, `accent`) sobre cores Tailwind diretas (`red-500`, `blue-600`). Tokens garantem conformidade na troca de tema.

### 5. Variantes via CVA

Quando um componente precisa de variacoes visuais, usar CVA (class-variance-authority) para definir variantes tipadas. Isso mantem as opcoes explicitas e documentadas no codigo.

## Quando criar um novo componente em `packages/ui`

- O elemento aparece (ou vai aparecer) em mais de um lugar
- O elemento tem logica visual que nao eh trivial (variantes, estados, composicao)
- O elemento pode se beneficiar de tipagem de variantes (CVA)

## Quando NAO criar

- Layouts especificos de uma pagina (grid, spacing) — isso eh responsabilidade da pagina
- Composicoes unicas que combinam varios componentes base de forma especifica a um contexto

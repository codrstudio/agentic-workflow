# Spec Patterns — Como Escrever specs/

Guia de escrita para os documentos de especificacao em `specs/`. Leia, entenda, reproduza.

---

## Convencoes de Formato

**Tudo abaixo e obrigatorio.**

| Regra | Detalhe |
|-------|---------|
| Nome do arquivo | `{projeto}-{topico}.md` |
| Idioma do texto | Portugues (PT-BR) |
| Idioma de codigo | Ingles (variaveis, tabelas SQL, tipos TS) |
| Tom | Direto, declarativo, sem floreio |
| Formato primario | Tabelas markdown |
| Paragrafos | Evite. Se precisa explicar, use lista ou tabela |
| Hierarquia | H1 titulo, H2 secoes, H3 subsecoes |
| Separadores | `---` entre secoes H2 |
| Exemplos | `✅` correto e `❌` proibido quando houver regras |
| Rastreabilidade | Secao final mapeando componentes/modulos → IDs |

### Abertura Padrao

Toda spec comeca assim:

```markdown
# {Projeto} - {Titulo Descritivo}

{Uma unica frase descrevendo o proposito do documento.}
```

Nada mais. Uma frase e entra no conteudo.

---

## Tipo 1: Requirements

**Arquivo**: `{projeto}-requirements.md`

Statements atomicas no padrao OSD ("O Sistema Deve").

### Formato

```markdown
## {Modulo}

### RF - Requisitos Funcionais

| ID | Requisito |
|----|-----------|
| OSD001 | O sistema deve permitir login com email e senha |
| OSD002 | O sistema deve validar formato de email no cadastro |

### RNF - Requisitos Nao Funcionais

| ID | Requisito |
|----|-----------|
| OSD009 | O sistema deve usar HTTP-only cookies no web |
```

### Regras de Escrita

- Prefixo `OSD` para funcionais, `RNF` para nao-funcionais
- IDs sequenciais, agrupados por modulo com faixa reservada (001-011, 020-030, 040-043...)
- Cada requisito: uma frase, um verbo no infinitivo, uma capacidade testavel
- Requisitos vagos como "deve ser rapido" nao existem — use metricas: "em menos de 2 segundos"
- Quando envolver permissoes, inclua **Matriz de Permissoes** como tabela:

```markdown
### Matriz de Permissoes

| Funcionalidade | admin | pastor | secretaria | lider | voluntario | membro |
|----------------|-------|--------|------------|-------|------------|--------|
| Ver membros    | Todos | Todos  | Todos      | Ministerio | -    | -      |
| Editar membros | Sim   | -      | Sim        | -     | -          | Proprio|
```

### Encerramento

```markdown
## Rastreabilidade

| Modulo | Requisitos |
|--------|------------|
| Autenticacao | OSD001-OSD011 |
| Perfil/Membros | OSD020-OSD030 |
```

---

## Tipo 2: User Stories

**Arquivo**: `{projeto}-user-stories.md`

Historias de usuario com criterios de aceite.

### Formato

```markdown
## {Tipo de Usuario}

### US001 - {Titulo curto}
**Como** {papel}
**Quero** {acao}
**Para** {beneficio}

**Criterios de Aceite:**
- [ ] Formulario solicita email e senha
- [ ] Validacao de formato de email
- [ ] Email de confirmacao enviado
- [ ] Conta ativada apos confirmar email

**Requisitos:** OSD001, OSD002, OSD003, OSD004
```

### Regras de Escrita

- Prefixo `US` com IDs sequenciais
- Faixas de IDs por role: 001-008 membro, 020-023 voluntario, 030-032 lider, 040-044 secretaria, 050-051 pastor, 060-063 admin
- Criterios de aceite como checklist (`- [ ]`) — cada um verificavel
- Sempre referencia IDs OSD do requirements
- Agrupar por tipo de usuario, do menos privilegiado ao mais

### Encerramento

```markdown
## Rastreabilidade

| User Story | Requisitos OSD |
|------------|----------------|
| US001 | OSD001-OSD004, OSD020 |
| US020 | OSD080-OSD088 |
```

---

## Tipo 3: Modelo de Dados (ER)

**Arquivo**: `{projeto}-er.md`

### Formato

```markdown
## Diagrama Entidade-Relacionamento

{Bloco mermaid erDiagram com todas as entidades e relacoes}

## Entidades Detalhadas

### {nome_tabela}
{Uma linha de contexto.}

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK para auth.users |
| full_name | string | Nome completo |
| active | boolean | Ativo no sistema |

## Enums

{Bloco SQL}
CREATE TYPE church_status AS ENUM ('membro', 'visitante', 'congregado');

## Indices Recomendados

{Bloco SQL com comentarios}
-- Busca de criancas por QR code
CREATE UNIQUE INDEX idx_children_qr_code ON children(qr_code);

## Relacionamentos Principais

1. **Usuario → Perfil**: 1:1 via auth.users
2. **Ministerio → Membros**: N:N via ministry_members
```

### Regras de Escrita

- Diagrama Mermaid no topo (visao macro)
- Uma subsecao por entidade com tabela de campos
- Tabelas e campos em snake_case (ingles)
- Valores de enum em portugues quando user-facing (`membro`, `visitante`)
- Enums e indices em blocos SQL
- Relacionamentos como lista numerada com cardinalidade

---

## Tipo 4: Design e Arquitetura

**Arquivo**: `{projeto}-design.md`

### Formato

```markdown
## Stack Principal

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| Backend | Supabase | PostgreSQL + Auth + Storage integrados |
| Web | Next.js 14+ | SSR, App Router, performance |

## Estrutura do Monorepo

{Arvore de diretorios em code block}

## Infraestrutura

{Servicos, portas, rede — tabelas e diagramas ASCII}

## Autenticacao

{Fluxo em lista numerada}
1. Usuario entra email/senha
2. Supabase Auth valida
3. JWT gerado

## Bibliotecas Compartilhadas

| Funcao | Biblioteca | Versao |
|--------|------------|--------|
| Forms | react-hook-form | ^7 |

## Convencoes de Codigo

| Item | Convencao | Exemplo |
|------|-----------|---------|
| Arquivos | kebab-case | user-profile.tsx |

## Seguranca

{Checklist com [x]}

## Performance

| Metrica | Alvo | Medicao |
|---------|------|---------|
| LCP | < 2.5s | Lighthouse |
```

### Regras de Escrita

- Stack como tabela com justificativa (nao so tecnologia — por que ela)
- Fluxos em listas numeradas ou diagramas ASCII
- Bibliotecas com versao
- Ambientes (dev/staging/prod) como tabela comparativa
- Performance com metricas concretas e ferramenta de medicao
- Decisoes tecnicas sao vinculantes — se esta aqui, implementa assim

---

## Tipo 5: Guia de UI/UX

**Arquivo**: `{projeto}-ui-guide.md`

### Formato

```markdown
## Principio Fundamental

**Usar padroes existentes. Nao inventar.**

## Tokens Semanticos

### Cores

| Token | Uso | Exemplo |
|-------|-----|---------|
| primary | Acoes principais, CTAs | Botao "Salvar" |
| destructive | Acoes destrutivas, erros | Botao "Excluir" |

### Uso Correto

// ❌ PROIBIDO
<div className="bg-fuchsia-500 text-white">

// ✅ OBRIGATORIO
<div className="bg-primary text-primary-foreground">

## Tipografia

| Classe | Tamanho | Uso |
|--------|---------|-----|
| text-sm | 14px | Texto secundario |

## Componentes

### Formularios

| Componente | Uso |
|------------|-----|
| Form | Wrapper com React Hook Form + Zod |
| Input | Campo de texto |

## Padroes de Pagina

### Lista com Busca e Filtros

{JSX de referencia}

## Estados

### Loading
{JSX com Skeleton}

### Empty State
{JSX com icone, titulo, descricao, acao}

### Error State
{JSX com Alert destructive}

## Acessibilidade

- [ ] Todos os inputs tem labels
- [ ] Imagens tem alt text
```

### Regras de Escrita

- Principio fundamental em uma frase bold
- Tokens como tabela com uso e exemplo concreto
- Exemplos JSX com ✅/❌ para regras de estilo
- Catalogo de componentes por categoria (Layout, Forms, Acoes, Feedback, Dados, Sobreposicoes)
- Templates JSX para padroes de pagina (Lista, Form, Detalhe, Dashboard)
- Acessibilidade como checklist

---

## Tipo 6: Feature Spec

**Arquivo**: `{projeto}-{feature}.md`

Para features complexas que precisam de documentacao propria.

### Formato

```markdown
## 1. Objetivo

- Bullet 1
- Bullet 2

## 2. Estrategias

| Estrategia | Descricao | Implementacao |
|------------|-----------|---------------|
| Welcome Tour | Tour guiado no primeiro acesso | Modal com steps |

## 3. Fluxos por Contexto

### 3.1 {Perfil/Cenario}

{Diagrama ASCII do fluxo}
{Detalhamento em lista}

## 4. Requisitos Funcionais

| ID | Requisito |
|----|-----------|
| OB001 | O sistema deve exibir Welcome Tour no primeiro acesso |

## 5. Componentes

### 5.1 {NomeComponente}

**Localizacao:** `apps/hub/src/components/{modulo}/{arquivo}.tsx`

**Props:**
interface WelcomeTourProps {
  roles: string[]
  onComplete: () => void
  onSkip: () => void
}

**Comportamento:**
- Modal de tela cheia com fundo semi-transparente
- Navegacao: Anterior / Proximo / Pular
- Animacao suave entre steps

## 6. Banco de Dados

CREATE TABLE onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  step_completed TEXT NOT NULL,
  UNIQUE(user_id, step_completed)
);

## 7. Server Actions

**Localizacao:** `apps/hub/src/lib/actions/{modulo}.ts`

export async function completeOnboardingStep(step: string): Promise<void>
export async function getOnboardingProgress(): Promise<string[]>

## 8. Hook

interface UseOnboardingReturn {
  isLoading: boolean
  completedSteps: string[]
  shouldShowTour: boolean
  completeStep: (step: string) => Promise<void>
}

export function useOnboarding(): UseOnboardingReturn

## 9. Integracao

{JSX mostrando como plugar nos pontos existentes}

## 10. Rastreabilidade

| Componente | Requisitos |
|------------|------------|
| WelcomeTour | OB001, OB002, OB003 |

## 11. Metricas de Sucesso

| Metrica | Meta |
|---------|------|
| Taxa de conclusao do Tour | > 70% |
```

### Regras de Escrita

- Secoes numeradas sequencialmente
- IDs proprios com prefixo da feature (OB para onboarding, EV para eventos, etc.)
- Componentes com: localizacao exata, interface TS de props, lista de comportamentos
- Schema SQL completo com tipos, FK, constraints
- Server Actions como assinaturas (nao implementacao)
- Hook com interface de retorno completa
- Integracao mostra JSX de como usar no app existente
- Metricas com valores numericos

### Quando Criar

Crie uma feature spec quando a feature:
- Tem fluxos diferentes por perfil de usuario
- Precisa de componentes UI dedicados
- Precisa de tabelas proprias no banco
- E complexa demais para caber numa user story

---

## Checklist de Qualidade

Antes de finalizar qualquer spec, verifique:

- [ ] Titulo segue `# {Projeto} - {Titulo}` com frase descritiva
- [ ] Tabelas onde poderia ter paragrafos
- [ ] IDs sequenciais com prefixo consistente
- [ ] Cada requisito e atomico e testavel
- [ ] Exemplos de codigo quando aplicavel
- [ ] ✅/❌ para regras de estilo
- [ ] Secao de Rastreabilidade no final
- [ ] Sem duplicacao com outros specs (cores so no ui-guide, tabelas so no er, stack so no design)
- [ ] Portugues no texto, ingles no codigo

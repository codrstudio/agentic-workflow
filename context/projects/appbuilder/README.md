# PROMPT: Coordenador de Implementacao

## Papel

Voce eh o coordenador da implementacao de dois sistemas que juntos substituem o Processa AppBuilder:

1. **MCP Server** (read-only) — descrito em `mcp-server-readonly-PROMPT.md`
2. **Renderer App** — descrito em `renderer-app-PROMPT.md`

Seu trabalho eh garantir que **nada fique de fora**. Voce nao implementa — voce valida, cobra e testa completude.

## Fonte da verdade

A fonte da verdade eh a base de dados SQL Server do AppBuilder original (`DBappBuilder_Engenharia`).
Ela contem 101 modelos reais em producao. Cada modelo eh um JSON que define uma pagina completa.

Alem da base, o codigo-fonte do AppBuilder original esta em:
`D:\sources\processa\processa.appbuilder`

E a documentacao tecnica em:
`D:\sources\processa\processa.appbuilder\.tmp\-project\`

## Estrategia de validacao

### Fase 1 — Inventario (antes de implementar)

Antes de qualquer codigo, extraia da base o inventario completo:

```sql
-- 1. Todas as aplicacoes
SELECT DFid_aplicacao, DFnome, DFchave FROM acesso.TBaplicacao

-- 2. Todos os modulos
SELECT DFid_modulo, DFtitulo, DFchave, DFid_aplicacao FROM acesso.TBmodulo

-- 3. Todas as paginas
SELECT DFid_pagina, DFtitulo, DFchave, DFcaminho, DFid_modulo, DFid_aplicacao FROM acesso.TBpagina

-- 4. Todos os modelos (metadados)
SELECT DFid_model_pagina, DFchave_pagina, DFstatus, DFdata_modificacao, LEN(DFvalor) as json_size
FROM acesso.TBmodel_pagina

-- 5. Todos os ctypes usados na pratica (extrair dos JSONs)
-- Parsear cada DFvalor e coletar todos os valores de "ctype" encontrados

-- 6. Todas as propriedades top-level usadas (filtro, datagrid, genericform, pageTabs, etc.)
-- Parsear cada DFvalor e coletar as chaves de primeiro nivel

-- 7. Todas as acoes usadas (cellActions, rowActions, gridActions)
-- Parsear cada DFvalor e coletar todos os valores de "action"

-- 8. Todos os selectDataTypes usados
-- 9. Todos os maskTypes usados
-- 10. Todos os comparisonTypes usados em linkedFields
-- 11. Todas as linked field actions usadas
```

Salve este inventario em `.tmp/inventario/`. Ele eh seu checklist de completude.

### Fase 2 — Validacao do MCP Server

Para cada item do inventario, verifique que existe uma tool MCP que o cobre:

| O que inventariado | Tool MCP esperada | Status |
|--------------------|-------------------|--------|
| N aplicacoes | `listar_aplicacoes` retorna N registros | |
| N modulos | `listar_modulos` retorna N registros | |
| N paginas | `listar_paginas` retorna N registros | |
| N modelos | `listar_modelos` retorna N registros | |
| Modelo X | `obter_modelo(id=X)` retorna JSON valido | |
| N select queries | `listar_select_queries` retorna N registros | |
| N procedures | `listar_procedures` retorna N registros | |
| N objetos dashboard | `listar_objetos_dashboard` retorna N registros | |
| Templates (6 tipos) | `listar_templates` retorna os 6 | |
| Ctypes (N usados) | `listar_ctypes` contem todos os N encontrados | |

**Teste de integridade**: para cada modelo na base, chame `obter_modelo_completo` e valide que:
- O JSON faz parse sem erro
- Tem `genericPageTitle` (ou `pageTabs` ou `generictreeview`)
- As funcoes associadas foram retornadas
- Os parametros associados foram retornados

### Fase 3 — Validacao do Renderer

Esta eh a fase critica. O renderer deve renderizar **todos os 101 modelos** sem erro.

#### 3.1 — Cobertura de templates

Extraia da base quantos modelos usam cada template:

```sql
-- Modelos com pageTabs (template abas)
SELECT COUNT(*) FROM acesso.TBmodel_pagina WHERE DFvalor LIKE '%pageTabs%'

-- Modelos com generictreeview (template arvore)
SELECT COUNT(*) FROM acesso.TBmodel_pagina WHERE DFvalor LIKE '%generictreeview%'

-- Modelos com genericdashboard (dashboard)
SELECT COUNT(*) FROM acesso.TBmodel_pagina WHERE DFvalor LIKE '%genericdashboard%'

-- Modelos com genericform sem datagrid (formulario puro)
SELECT COUNT(*) FROM acesso.TBmodel_pagina
WHERE DFvalor LIKE '%genericform%' AND DFvalor NOT LIKE '%datagrid%'

-- Modelos com datagrid (consulta ou cadastro)
SELECT COUNT(*) FROM acesso.TBmodel_pagina WHERE DFvalor LIKE '%datagrid%'

-- Modelos com pipeliner
SELECT COUNT(*) FROM acesso.TBmodel_pagina WHERE DFvalor LIKE '%"pipeliner":true%'

-- Modelos com genericactionform
SELECT COUNT(*) FROM acesso.TBmodel_pagina WHERE DFvalor LIKE '%genericactionform%'

-- Modelos com genericgridcollection
SELECT COUNT(*) FROM acesso.TBmodel_pagina WHERE DFvalor LIKE '%genericgridcollection%'
```

Para cada grupo, selecione um modelo representativo e valide que renderiza corretamente.

#### 3.2 — Cobertura de ctypes

Extraia todos os ctypes realmente usados nos 101 modelos.
Para cada ctype encontrado, verifique que:
- Existe um componente field renderer
- O componente mapeia para um componente shadcn
- As propriedades relevantes (maskType, selectDataType, etc.) sao tratadas

#### 3.3 — Cobertura de acoes

Extraia todas as acoes realmente usadas (cellActions, rowActions, gridActions).
Para cada tipo de acao encontrado (delete, detailModal, actionModal, batchEdit, redirectTo, etc.):
- Existe handler no renderer
- O handler abre modal / redireciona / chama API conforme esperado

#### 3.4 — Cobertura de linked fields

Extraia todos os modelos que usam `linkedFields`.
Para cada tipo de acao de linked field encontrado:
- O motor de cascading implementa essa acao
- Os comparadores usados estao implementados

#### 3.5 — Teste de renderizacao completo

Para CADA um dos 101 modelos:

1. Busque o modelo da base
2. Passe para o GenericPage
3. Verifique que renderiza sem erro de JS
4. Verifique que o titulo aparece
5. Verifique que os componentes esperados estao presentes (filtro, grid, form, tabs, etc.)
6. Se tem datagrid com api, verifique que a chamada eh feita (mesmo que retorne erro de rede)

Salve os resultados em `.tmp/validacao/`:

```
.tmp/validacao/
  modelo-{id}-{chave}.json    — resultado do teste
```

Cada arquivo:
```json
{
  "id": 123,
  "chavePagina": "app.modulo_pagina",
  "template": "consulta|cadastro|formulario|abas|arvore|dashboard|...",
  "renderizou": true,
  "erros": [],
  "componentesPresentes": ["filtro", "datagrid"],
  "ctypesUsados": ["input", "select", "date-time"],
  "acoesUsadas": ["delete", "detailModal"],
  "linkedFields": true,
  "observacoes": ""
}
```

### Fase 4 — Comparacao lado a lado

Para os modelos mais complexos (maior JSON, mais ctypes, mais acoes), compare:

1. Abra o modelo no DirectorWEB original (se disponivel)
2. Abra o mesmo modelo no novo renderer
3. Documente diferencas visuais ou funcionais

Se o DirectorWEB nao estiver acessivel, use o Preview do AppBuilder original como referencia.

### Fase 5 — Regressao continua

Apos completude inicial, qualquer alteracao deve ser validada contra os 101 modelos.
Crie um script de smoke test:

```javascript
// .tmp/smoke-test.mjs
// Para cada modelo na base:
//   1. Fetch /api/model
//   2. Verifica que retornou JSON valido
//   3. Verifica propriedades obrigatorias
//   4. Loga resultado
```

## Checklist de completude

### MCP Server

- [ ] Pool de conexao SQL Server funcional
- [ ] Transporte SSE operacional
- [ ] Tools de aplicacoes (listar, obter)
- [ ] Tools de modulos (listar, obter)
- [ ] Tools de paginas (listar, obter)
- [ ] Tools de modelos (listar, obter por id, por pagina, por caminho, completo)
- [ ] Tools de funcoes de modelo
- [ ] Tools de parametros de modelo
- [ ] Tools de select queries
- [ ] Tools de procedures
- [ ] Tools de dashboard
- [ ] Tools de mobile (apps, modulos, paginas, modelos)
- [ ] Tools de conexoes e config usuario
- [ ] Tools de introspecao (templates, ctypes, schema, acoes, comparadores)
- [ ] Tools de auditoria
- [ ] Teste: todas as tools retornam dados consistentes com a base
- [ ] Teste: tools com parametros invalidos retornam erro MCP (nao crash)

### Renderer App

- [ ] Monorepo com workspaces configurado
- [ ] `npm run dev:all` funciona
- [ ] Backend conecta na base e serve modelos
- [ ] Frontend renderiza shell (sidebar + area principal)
- [ ] Navegacao: apps -> modulos -> paginas funcional
- [ ] GenericPage renderiza modelo basico (titulo)
- [ ] FilterRenderer: todos os ctypes de filtro
- [ ] DataGridRenderer: headers, paginacao, sorting
- [ ] DataGridRenderer: cellActions, rowActions, gridActions
- [ ] DataGridRenderer: detailModal, actionModal, batchEdit
- [ ] DataGridRenderer: selecao, exportCsv, auto-update
- [ ] FormRenderer: layout em linhas (array 2D)
- [ ] FormRenderer: todos os ctypes de campo
- [ ] FormRenderer: validacao de required
- [ ] FormRenderer: submit para endpoint
- [ ] FormRenderer: formOnModal com Dialog
- [ ] TabsRenderer: navegacao entre abas
- [ ] TabsRenderer: cada aba renderiza GenericPage recursivo
- [ ] TreeViewRenderer: arvore hierarquica com expand/collapse
- [ ] TreeViewRenderer: click em no renderiza modelo
- [ ] DashboardRenderer: grid de widgets
- [ ] DashboardRenderer: auto-refresh
- [ ] ActionFormRenderer: grupos colapsaveis com botoes de acao
- [ ] GridCollectionRenderer: filtro + multiplas grids
- [ ] PipelinerRenderer: formulario com campos pipeliner
- [ ] LinkedFieldEngine: todos os comparadores
- [ ] LinkedFieldEngine: todas as acoes (updateSelectOptions, setValue, disable, enable, hide, show, required, executeProcedure)
- [ ] SelectField: carrega opcoes de api, queryKey, fixedList
- [ ] Proxy de apps externas funcional
- [ ] Execucao de procedures funcional
- [ ] Execucao de select queries funcional
- [ ] Mascaras: decimal, inteiro, cpf, cnpj, phone, email
- [ ] Download de arquivos (grid export, sql files)

### Validacao final

- [ ] Inventario extraido da base
- [ ] 101 modelos testados contra o renderer
- [ ] Zero erros de renderizacao
- [ ] Todos os ctypes encontrados estao cobertos
- [ ] Todas as acoes encontradas estao cobertas
- [ ] Todos os templates encontrados estao cobertos
- [ ] Smoke test automatizado rodando

## Ordem de execucao sugerida

```
1. Inventario da base (Fase 1)
   ↓
2. MCP Server — implementar tools (paralelizavel com 3)
   ↓
3. Renderer — backend (API) + shell + navegacao
   ↓
4. Renderer — GenericPage + FilterRenderer + DataGridRenderer (cobre ~70% dos modelos)
   ↓
5. Renderer — FormRenderer + todos os ctypes (cobre ~85%)
   ↓
6. Renderer — TabsRenderer + TreeViewRenderer (cobre ~95%)
   ↓
7. Renderer — Dashboard + ActionForm + GridCollection + Pipeliner (100%)
   ↓
8. Renderer — LinkedFieldEngine (cascading fields)
   ↓
9. Validacao MCP (Fase 2)
   ↓
10. Validacao Renderer modelo a modelo (Fase 3)
    ↓
11. Comparacao lado a lado (Fase 4)
    ↓
12. Smoke test automatizado (Fase 5)
```

## Criterio de pronto

O projeto esta pronto quando:

1. O MCP Server responde a todas as tools sem erro
2. O Renderer na porta 3500 renderiza os 101 modelos sem erro de JS
3. Cada template, ctype, acao e linked field action presente na base esta implementado
4. O smoke test automatizado passa em 101/101 modelos

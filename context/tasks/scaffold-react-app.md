---
agent: coder
description: Inicializa projeto React a partir do scaffold rect-app
---

# Scaffold React App

Execute os passos abaixo **em ordem**. Nao leia, estude ou explore o scaffold antes de copiar — aja imediatamente.

## Passo 1 — Copiar Scaffold (ação imediata)

Execute **agora**:

```bash
cp -r {scaffolds-folder}/rect-app/. .
```

## Passo 2 — Validar Cópia

Execute e confirme que todos os itens abaixo existem:

```bash
ls apps/ packages/ package.json turbo.json
```

Se algum item estiver faltando, repita o `cp -r` acima. Nao prossiga com copia incompleta.

## Passo 3 — Renomear Namespace

Substitua `@scaffold/` por `@{slug}/` em todos os `package.json`, imports TypeScript e configs:

```bash
grep -rl "@scaffold/" . --include="*.json" --include="*.ts" --include="*.tsx" | xargs sed -i 's/@scaffold\//@{slug}\//g'
```

Confirme: `grep -r "@scaffold/" . --include="*.json" --include="*.ts" --include="*.tsx"` deve retornar vazio.

## Passo 4 — Aplicar Derivação

Leia `guides/scaffold-derivation/GUIDE.md` e execute as instrucoes dele integralmente.

O guia eh a fonte da verdade para nomear, configurar e personalizar o projeto.

## Passo 5 — Aplicar Artefatos do Projeto

Consulte as skills `stacks` (stack do scaffold), `env-pattern` (padrao .env) e `brand-assets` (pipeline de brand) para contexto.

Verifique cada item abaixo e aplique se existir:

**`.env`**
```bash
ls {project}/artifacts/.env 2>/dev/null
```
Se existir: leia o artefato e o `.env` atual do projeto. Aplique seguindo o padrao da skill `env-pattern`.

**`brand/`**
```bash
ls {project}/artifacts/brand/ 2>/dev/null
```
Se existir, copie os assets de brand para o local indicado pelo guia de derivacao (conforme skill `brand-assets`) e execute o comando de derivação `npm run brand:derive`.

## Passo 6 — Validar e Commit

```bash
npm install
npm run typecheck   # corrija todos os erros antes de continuar
npm run build       # build deve ser limpo (zero erros)
```

Commit: `feat: inicializar projeto {slug} a partir do scaffold rect-app`

## Regras

- **JAMAIS** estude ou explore o scaffold antes de copiar — copie primeiro, leia o guia depois
- **JAMAIS** copie arquivos um a um — use sempre `cp -r` para copiar tudo de uma vez
- **JAMAIS** deixe mocks ativos — o guia de derivacao define o que desativar
- **JAMAIS** invente funcionalidades alem do TASK.md
- **JAMAIS** delete o CLAUDE.md do scaffold — adicione a ele
- Componentes de UI vao em `packages/ui/` (conforme skill `ui-dry`)
- Cores via tokens semanticos (conforme skill `semantic-colors`) — nunca cores diretas

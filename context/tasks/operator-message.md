---
agent: general
description: Processar mensagens do operador
---

# Processar mensagens do operador

Voce recebeu mensagens do operador humano que esta supervisionando o workflow. Processe cada mensagem e execute as acoes necessarias.

## Contexto do projeto

- Worktree: `{worktree}`
- Sprint: `{sprint}`
- Repo: `{repo}`

Leia os artefatos relevantes do sprint para entender o estado atual do projeto:
- `{sprint}/features.json` — lista de features e status
- Specs e PRPs no sprint dir, se existirem

## Mensagens do operador

{operator_messages}

## Instrucoes

1. Leia e compreenda cada mensagem do operador
2. Para perguntas: responda com clareza, consultando artefatos do projeto se necessario
3. Para pedidos de correcao: modifique os artefatos relevantes (features.json, specs, PRPs, codigo)
4. Para pedidos de acao: execute a acao solicitada
5. Se modificar arquivos, faca commit com mensagem descritiva
6. Resuma o que foi feito ao final

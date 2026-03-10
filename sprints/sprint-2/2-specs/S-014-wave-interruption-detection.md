# S-014 — Detecção de Wave/Step Interrompido

**Discoveries:** D-017 (score 8)

## Objetivo

Resolver o bug de UX onde a página de wave exibe um step como "running" quando o processo já foi morto externamente. Cruzar o PID do `spawn.json` com os runs ativos e com o SO para detectar estado "interrupted". Usa a infraestrutura de S-013.

## Escopo

### Backend (apps/server)

- Alterar a lógica de `deriveStatus()` em `routes/waves.ts` para incorporar verificação de PID
- Novo status `interrupted` adicionado ao tipo `StepStatus`
- Quando `spawn.json` existe sem `exit_code` (ou seja, seria "running"), verificar se o PID está vivo:
  - PID vivo → `running`
  - PID morto → `interrupted`

### Frontend (apps/web)

- Novo estado visual `interrupted` na wave timeline
- Ícone e cor distintos para steps interrompidos
- Mensagem explicativa ao usuário

## Alterações no Backend

### `apps/server/src/routes/waves.ts`

1. Importar `isPidAlive` de `../lib/pid-check.js`
2. Adicionar `'interrupted'` ao tipo `StepStatus`:
   ```typescript
   type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'interrupted'
   ```
3. Alterar `deriveStatus()`:
   ```typescript
   function deriveStatus(spawn: SpawnJson | null, dirExists: boolean): StepStatus {
     if (!dirExists) return 'pending'
     if (!spawn) return 'running'
     if (spawn.exit_code !== undefined && spawn.exit_code !== null) {
       return spawn.exit_code === 0 ? 'completed' : 'failed'
     }
     // spawn.json exists, no exit_code → check if PID is alive
     if (spawn.pid && !isPidAlive(spawn.pid)) {
       return 'interrupted'
     }
     return 'running'
   }
   ```
4. Aplicar a mesma lógica no tratamento de loop steps (ralph-wiggum-loop) usando `loop.json.pid`

### Wave status derivation

Quando qualquer step tem status `interrupted`, o status da wave como um todo deve ser `interrupted` (a menos que haja steps `failed`, que tem precedência).

## Alterações no Frontend

### `apps/web/src/pages/wave-detail.tsx`

1. Adicionar `'interrupted'` ao tipo `StepStatus`
2. Novo ícone para `interrupted`:
   ```tsx
   if (status === "interrupted") {
     return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
   }
   ```
3. Texto descritivo na duração: "interrompido" em vez de "em execução"

### Indicador visual

- Cor: `amber-500` (amarelo/laranja) — distinto de verde (completed), vermelho (failed), azul (running)
- Ícone: `AlertTriangle` do lucide-react
- Texto: "Interrompido" no lugar de "em execução"
- Tooltip/nota: "O processo foi encerrado externamente sem registrar exit code"

## Critérios de Aceite

1. Step com `spawn.json` sem `exit_code` e PID morto retorna status `interrupted` na API
2. Step com `spawn.json` sem `exit_code` e PID vivo retorna status `running` na API
3. Wave com step interrupted exibe ícone amber `AlertTriangle` na timeline
4. Texto "Interrompido" aparece onde antes dizia "em execução" para steps interrompidos
5. Loop step (ralph-wiggum-loop) também detecta interrupção via PID do `loop.json`
6. Status da wave como um todo reflete corretamente o estado interrupted

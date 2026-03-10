# PRP-012 — Smart Scroll & Controle de Linhas

**Specs:** S-017
**Prioridade:** 3 (complemento essencial da Console fusionada)
**Dependências:** PRP-011

## Objetivo

Implementar scroll inteligente no feed unificado da Console: scroll interno ao container (não page scroll), autoscroll que detecta posição do usuário e suspende quando ele investiga entradas antigas, e controle numérico de linhas máximas exibidas.

## Escopo

### Frontend (apps/web)

- Alterar `pages/console.tsx` (versão fusionada de PRP-011)
- Scroll interno no container do feed (height 100%, overflow-y auto, sem page scroll)
- Autoscroll inteligente: ativo no bottom, suspenso ao rolar para cima, reativado ao retornar
- Botão flutuante "Novas entradas" quando há conteúdo abaixo do viewport com autoscroll suspenso
- Select de linhas máximas (50, 100, 200, 500) com persistência em localStorage

## Features

| ID | Feature | Descrição |
|----|---------|-----------|
| F-034 | Autoscroll Inteligente | Container do feed com scroll interno (`flex: 1; min-height: 0; overflow-y: auto`). Detectar posição do scroll (threshold 50px do bottom). Autoscroll ativo quando no bottom — novas entradas rolam automaticamente. Autoscroll suspenso quando usuário rola para cima. Botão flutuante "↓ Novas entradas" quando há conteúdo novo abaixo, clique rola ao bottom e reativa autoscroll. |
| F-035 | Controle de Linhas Visíveis | Select com opções predefinidas (50, 100, 200, 500) posicionado ao lado dos filtros no header. Padrão: 100. Entradas mais antigas descartadas quando total excede o limite (`feedItems.slice(-maxLines)`). Valor persiste em `localStorage` com chave `aw-console-max-lines`. |

## Limites

- NÃO implementa virtualização (react-window) no feed — o limite de linhas máximas garante performance
- NÃO afeta o LogViewer de step detail (que tem sua própria virtualização)

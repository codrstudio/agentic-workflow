# Projeto de Refatoração da Interface

A interface atual já tem tudo o que precisamos.
Precisa apenas de uma refatoração de look and feel, para tornar mais claro e evidente o que mais importa.

---

## Console e Eventos 

Console e Eventos deve ser uma página só, chamada Console, como em um chat.
E ela não pertence ao projeto mas sim ao monitoramento do harness.
É uma forma de intervir no processo de harness.
A mensagem enviada deve aparecer em queue até ser processada pela engine, que só ocorre ente execuções de step.
As mensagens SSE enviadas pelo engine devem ser exibidas na mesma pagina.

Estude o comando
"aw:console": "dotenv -e .env -- node apps/engine/dist/console.js"

Ele implementa essa visão no console:

```
gugac@undercity MINGW64 /d/sources/_unowned/agentic-workflow (main)
$ npm run aw:console aw-monitor

> aw:console
> dotenv -e .env -- node apps/engine/dist/console.js aw-monitor


  aw:console — aw-monitor
  Type a message and press Enter to send. Ctrl+C to quit.


  1 pending message(s) in queue:

  2026-03-10 04:54:24 [console] ola


[01:55:51] drain drain-1 (wave-2)

  ▶ Olá! Recebi sua mensagem.
  ▶
  ▶ Estou no worktree em `/d/sources/_unowned/agentic-workflow/context/workspaces/aw-monitor/wave-2/wor…
  ▶   ... (+2 lines)
  └ agent exit=0

  >
```

---

## Actual Monitoring

O monitor contempla Projetos, Console e Eventos.
O monitoramento em si está aninhado a Projetos.

Porém, o objetivo primário desse projeto é o monitoramento do processo de harness.
Aninhar a Projetos reduzi a visibilidade dos harness em andamento e dificulta o controle dos processos.

O comando abaixo faz esse monitoramento precariamente devido as limitações do console, mesmo assim é muito bom:
"aw:status": "dotenv -e .env -- node apps/engine/dist/status.js"

O que precisamos é de um monitoramento estado da arte, que nos permita:
1. Acompanhamento fino das atividades da engine
2. Acompanhamento fino das atividades de cada wave
3. Acompnahamento fino das atividades do ralph wiggum loop
4. Tempos, estimativas e gestão dos processos
5. Monitoramento de PIDs para detecção de travamentos
6. Exploração de logging da engine e das waves
7. Controle do processo, como executar/parar/resumir
  - O novo Console, que funde a queue e os eventos SSE da engine, faz parte dessa área de controle

Embora Projetos já implemente boa parte destes itens, precisamos melhorar o look and feel desse sisetma.
Dar mais visibilidade e controle ao processo harness.

Então, a missão é uma refatoração da interface atual.

---

## Wave Interrompida

Atualmente a pagina de wave /web/projects/aw-monitor-milestone-2/waves/1/steps/1 não detecta que o processo foi interrompido e continua exibindo a wave como se estive em andamento.

Isso cria uma experiência ruim para o usuário, que parou o processo mas tem a sensação de que ele ainda está em andamento.

Precisa melhorar isso.

---

## Log de Eventos

O log de eventos está bom como está hoje, mas não está fácil de ser acompanhado.
O log pode ter milhares de linhas. Exibir tudo em uma única lista não faz sentido.

O ideal é monitorar a atividade do log, portanto, exibir apenas as X ultimas linhas é suficiente.
E como rolagem interna na lista, isto é, em vez de rolar a página rola-se apenas a lista internamento.
E com autoscrooll que detecta quando está no bottom e rola sozinho.
Isto é, se eu rolo pra cima, pra ver itens mais antigos, o autoscrool me respeita e nao empurra a lista pra baixo.

Com um simples controle de numeros de linhas de exibicao junto com o filtro vai permitir:
1. esse monitoramento de atividades, que é o mais importante
2. investigar o logging, que eh uma ativdade secundaria


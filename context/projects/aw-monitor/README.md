## Console e Eventos 

Console e Eventos deve ser uma página só, como em um chat.
A mensagem enviada deve aparecer em queue até ser processada pela engine, que só ocorre ente execuções de step.
As mensagens SSE enviadas pelo engine devem ser exibidas na mesma pagina.

Estude o comando
"aw:console": "dotenv -e .env -- node apps/engine/dist/console.js"

Ele implementa essa visão no console

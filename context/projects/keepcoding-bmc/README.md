# Conceito: Autocriação

## O que é

A autocriação é o diferencial central da plataforma. O sistema **não é um "faça você mesmo"** — é um **"nós fazemos pra você, embora você possa fazer também"**.

A plataforma cria campanhas, gerencia postagens e cuida da imagem do cliente nas redes e funil de vendas de forma autônoma, usando o perfil como base de conhecimento.

## Projetos afetos

- `mocks/keep-biz/`
- `mocks/keep-solo/`

## Duas áreas de atuação

### Área Criativa (Criação)
- Sugestão e criação de **campanhas** de conteúdo
- Criação de **postagens** individuais
- Calendário editorial gerado pelo sistema
- O usuário pode aceitar, editar ou criar do zero — mas o padrão é o sistema propor

### Área Monitor (Monitoramento)
- Gestão da **imagem do cliente** nas redes sociais
- Acompanhamento de **funil de vendas**
- Insights e métricas de desempenho
- Sugestões de ajuste baseadas em dados

## Como funciona

O agente interno (builtin, transparente ao usuário) usa o **perfil** como contexto para:

1. **Investigação** — pesquisa contínua sobre o nicho, tendências e concorrentes
2. **Ideação** — geração de ideias de conteúdo alinhadas ao posicionamento do perfil
3. **Criação** — produção do conteúdo (textos, sugestões visuais, hashtags, horários)
4. **Gestão** — agendamento e publicação nas redes configuradas
5. **Análise** — monitoramento de resultados e retroalimentação do ciclo

## Diferença entre KeepSolo e KeepBiz

### KeepSolo
- Autocriação direta — um perfil, um fluxo de conteúdo.
- O usuário vê sugestões e pode aprovar/editar/rejeitar.

### KeepBiz
- Autocriação **por perfil** — cada perfil tem seu próprio fluxo independente de campanhas e conteúdos.
- O usuário pode gerenciar a criação de cada perfil separadamente ou ter visão consolidada.

## O que está faltando nos mocks atuais

Nos mocks atuais (KeepSolo e KeepBiz) o conceito de conteúdo **sugerido pela IA** não está presente. As telas de criação tratam apenas do fluxo manual. É necessário incorporar:

- Feed de sugestões de conteúdo geradas pelo sistema
- Fluxo de aprovação/edição de conteúdo sugerido
- Campanhas propostas automaticamente
- Indicação visual clara de que o conteúdo foi gerado pelo sistema vs. criado pelo usuário

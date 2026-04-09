# Prompt: D&C Companion App — Especificação

## Objetivo

Criar um app companion web para o **Dice & Cards RPG (D&C)** — sistema de RPG de mesa derivado do ICRPG (Index Card RPG) de Hankerin Ferinale. O app deve servir como ferramenta de mesa para o mestre e jogadores durante sessões presenciais.

---

## Referências do Sistema

O D&C é documentado nos seguintes arquivos do vault LYT:

### Core do D&C
- `Efforts/Sleeping/Projeto D&C — Universo Mephirot.md` — documento master do sistema: atributos, esforço, Palavras de Poder, sistema de itens (595+ itens), Formas Arquetípicas, Disciplinas Mágicas, sistema de saúde/morte, Queimar HP, Crenças e Instintos, Baralhos (Narrativo, Tático, Jornada, Loot, Destino), sistema de ferimentos, 3Ts (Trama/Tempo/Tesouro)
- `Atlas/Dots/D&C — Ordem dos Arautos.md` — classe Arauto com 4 variantes (Paladino, Profanador, Parcário, Cinério)
- `Atlas/Dots/D&C — Pesquisa de Mecânicas Externas.md` — mecânicas integradas de outros sistemas: Flashbacks (Blades in the Dark), Icons (13th Age), Obligation (Star Wars RPG), Bonds (Dungeon World), Escalation Die (13th Age), Instincts & Beliefs (Mouse Guard), Success at a Cost (Fate Core), Adversity Tokens (Kids on Bikes), Trap Theory (Ferinale)
- `Atlas/Dots/D&C — Crônicas Medievais.md` — módulos de aventura medieval standalone

### Referência ICRPG (sistema base)
- `Atlas/Maps/ICRPG.md` — filosofia e mecânicas core: TARGET, EFFORT, TIMERS, HEARTS, LOOT
- `Atlas/Dots/ICRPG — Master Edition.md` — edição master: Core System, Player's Guide, GM's Guide, Monsters, 5 Worlds, Magic
- `Atlas/Dots/ICRPG — Hacks.md` — bioforms, XP system, hero coins, classes adicionais
- `Atlas/Dots/ICRPG — Sistema de Magia v1.md` — sistema de magia comunitário: Spells (INT), Powers (WIS), Charms (CHA)
- `Atlas/Dots/ICRPG — Think Deck.md` — deck de 52 cartas para design de aventuras
- `Atlas/Dots/ICRPG — Materiais do GM.md` — ferramentas do GM: encounter builder, target cards, think deck

### Campanha Ativa
- `Efforts/On/D&C — Saga Medieval/D&C — Saga Medieval.md` — organização extra-game da saga medieval atual (6 jogadores, 3 sessões)

---

## Funcionalidades do App

### 1. Ficha de Personagem Digital

Baseada na ficha do ICRPG adaptada para o D&C. Use [Image #3] como referência visual da ficha original do ICRPG e pesquise na web por "ICRPG character sheet" para entender o layout padrão.

**Layout da ficha ICRPG original (da imagem):**

Header:
- NAME | WORLD | LIFE FORM | TYPE
- STORY (campo de texto livre)

Coluna esquerda — 6 Atributos (cada um com BASE + LIFE FORM + LOOT):
- **STR** (Força / FOR)
- **DEX** (Destreza / DES)
- **CON** (Constituição / CON)
- **INT** (Inteligência / INT)
- **WIS** (Sabedoria / SAB)
- **CHA** (Carisma / CAR)

Coluna central — Tipos de Esforço (cada um com BASE + LOOT):
- **BASIC** (d4)
- **WEAPONS & TOOLS** (d6)
- **GUNS** (d8) → no D&C substituir por **MAGIA** (d10)
- **ENERGY & MAGIC** (d10) → no D&C substituir por **PALAVRAS DE PODER**
- **ULTIMATE** (d12)

Coluna direita — Área de retrato + status:
- Retrato do personagem
- **HEARTS** (corações — cada ♥ = 10 HP)
- **DEFENSE** (10 + DEF = enemy to-hit roll)
- **HERO COIN** (CON + LOOT)
- **DYING** (rounds til dead)

Parte inferior:
- **LOOT** — lista de itens (EQUIPPED ○ / CARRIED ○, max 10 cada)
- **ABILITIES** (5 slots)
- **POWERS** (3 slots)
- **AUGMENTS** (campo livre)
- **MASTERY** — barra de progresso (20 slots ○)

**Adaptações D&C sobre o layout ICRPG:**

| Campo ICRPG | Campo D&C | Mudança |
|---|---|---|
| WORLD | MUNDO | Tradução |
| LIFE FORM | BIOFORMA | Tradução |
| TYPE | DISCIPLINA | Classe mágica do personagem |
| STORY | HISTÓRIA | Tradução |
| GUNS (d8) | ARMAS (d8) | D&C não usa armas de fogo; d8 = armas de combate |
| ENERGY & MAGIC (d10) | MAGIA (d10) | Palavras de Poder |
| HERO COIN | MOEDA HEROICA | Tradução — mecânica de re-roll |
| ABILITIES | HABILIDADES | 5 slots |
| POWERS | PALAVRAS DE PODER | 3 slots → expandir para listar Forma + Natureza + Configuração |
| AUGMENTS | MAESTRIA | Domínio de Estilo + Perfeição Somática |
| MASTERY (barra) | REGISTRO DE d20 | 20 slots para marcar d20 naturais |
| LOOT | INVENTÁRIO | Max 20 itens, 10 ativos — cada item com: nome, raridade, Palavra de Poder, atributo, mão |

**Campos adicionais D&C (não existem no ICRPG):**
- **CRENÇAS** — 1 carta sorteada (texto + bônus + arma + habilidade)
- **INSTINTOS** — 1 carta sorteada (texto + bônus + arma + habilidade)
- **FERIMENTOS** — lista de ferimentos ativos (leves −1 / graves −3) com atributo afetado
- **QUEIMAR HP** — indicador visual de HP disponível para sacrifício
- **SORTE** — atributo extra (−3 a +3)

### 2. Rolador de Dados

- d4, d6, d8, d10, d12, d20 — com animação
- Rolagem de atributo: d20 + modificador vs. TARGET (exibir resultado como sucesso/falha)
- Rolagem de esforço: dado correspondente ao tipo
- Queimar HP: interface para declarar sacrifício antes/depois da rolagem (+2 no d20 por 1 HP)
- Destaque visual para d20 natural (crítico) e d1 natural (falha crítica)
- Registro automático de d20 naturais na ficha

### 3. Timer de Mesa

- Timer visual (d4 ou d6) que o mestre configura por cena
- Countdown automático por round
- Alerta visual/sonoro quando chega a 0
- Integração com os 3Ts: exibir Trama (texto), Tempo (timer), Tesouro (recompensa)

### 4. Painel do Mestre

- TARGET da cena atual (editável, 10-20)
- Timer ativo
- Lista de NPCs com HP em corações
- Notas da cena (campo livre)
- Botão de Escalation Die (d6 crescente por round de combate)

### 5. Baralhos Virtuais

Os 5 baralhos do D&C como decks virtuais:
- **Narrativo** — cartas de ação e intervenção narrativa
- **Tático** — cartas de combate e manobras
- **Jornada** — cartas de desenvolvimento do personagem
- **Loot** — cartas de itens e recompensas (inclui Fênix em Pó)
- **Destino** — baralho de 52 cartas clássico

Mecânica: comprar carta, exibir, descartar. Deck embaralhável.

---

## Stack Sugerida

- **Frontend:** React + TypeScript + Tailwind CSS
- **Estilo visual:** medieval, dark, texturizado — coerente com a identidade visual do D&C (assets em `x/Dice & Cards RPG - *.png/jpg/webp`)
- **Estado:** local-first (localStorage) — sem backend para MVP
- **Responsivo:** funcionar em celular (jogadores) e tablet/desktop (mestre)
- **PWA:** instalável como app no celular

---

## Identidade Visual

Assets existentes no vault (pasta `output/x/`):
- `Dice & Cards RPG - Logo HC.png`
- `Dice & Cards RPG - Logo Camada 1.png`
- `Dice & Cards RPG - Tiles.jpg`
- `Dice & Cards RPG - Playing.webp`
- `Dice & Cards RPG - Header Background.jpg`
- `Dice & Cards RPG - Library.png`
- `Dice & Cards RPG - Taverna.webp`
- `Dice & Cards RPG - Favicon.png`
- `Dice & Cards RPG - background-3.webp`

---

## Princípios

1. **Simplicidade** — qualquer um opera em 2 minutos. Gabriel de 10 anos precisa conseguir usar.
2. **Mesa primeiro** — o app complementa a mesa, não substitui. Dados físicos continuam sendo usados; o app registra e calcula.
3. **Modular** — comece com ficha + rolador. Adicione timer, painel do mestre e baralhos incrementalmente.
4. **Offline** — funciona sem internet (PWA + localStorage).

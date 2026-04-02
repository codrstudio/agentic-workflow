# shadcn/ui — Referencia Local para IA

## O que eh isto

`guides/shadcn/v4/` eh um projeto Vite+React standalone que funciona como **referencia viva** dos componentes shadcn/ui v4. A IA deve consultar os arquivos fonte aqui para entender a API, props, variantes e estrutura real de cada componente — sem depender de conhecimento de treinamento que pode estar desatualizado.

## Por que existe

shadcn/ui evolui rapido. A IA pode ter conhecimento defasado sobre props, variantes ou padroes de uso. Manter os componentes instalados localmente garante que a referencia esteja sempre alinhada com a versao real usada no projeto.

## Como funciona

O projeto em `v4/` eh inicializado com a mesma configuracao do app principal:

| Config         | Valor        |
|----------------|--------------|
| Style          | radix-nova   |
| Base color     | stone        |
| Icon library   | phosphor     |
| CSS variables  | sim          |
| RSC            | nao          |
| TSX            | sim          |

Os componentes ficam em `v4/src/components/ui/`. Para adicionar um novo:

```bash
cd guides/shadcn/v4
npx shadcn@latest add <componente>
```

## Componentes instalados

| Componente   | Arquivo                            |
|--------------|------------------------------------|
| alert        | `v4/src/components/ui/alert.tsx`    |
| badge        | `v4/src/components/ui/badge.tsx`    |
| button       | `v4/src/components/ui/button.tsx`   |
| card         | `v4/src/components/ui/card.tsx`     |
| collapsible  | `v4/src/components/ui/collapsible.tsx` |
| dialog       | `v4/src/components/ui/dialog.tsx`   |
| progress     | `v4/src/components/ui/progress.tsx` |
| scroll-area  | `v4/src/components/ui/scroll-area.tsx` |
| separator    | `v4/src/components/ui/separator.tsx` |
| table        | `v4/src/components/ui/table.tsx`    |

## Como a IA deve usar

1. **Antes de usar um componente shadcn**, ler o fonte em `guides/shadcn/v4/src/components/ui/<componente>.tsx` para confirmar props, variantes e estrutura atuais.
2. **Se o componente nao estiver instalado**, instalar primeiro neste projeto de referencia e so entao consultar.
3. **Nunca assumir** API de componente baseado em conhecimento de treinamento — o fonte local eh a verdade.
4. **Manter a tabela acima atualizada** ao instalar novos componentes.

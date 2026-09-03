# JOIA — Saldo de estoque em centenas de quilos negativos (causa e correção)

**03/09/2026. Santa Fé do Sul. URGENTE.** Contagem de 31/08 conferiu
GELATO VENDA em 94 kg, mas o sistema mostra saldo negativo de centenas de
quilos, inclusive no relatório do próprio dia 31. Investigação de leitura no
banco de produção + leitura do código.

## A causa raiz: unidade da baixa (grama descontada como quilo)

GELATO VENDA é guardado em **quilo**. A ficha de cada produto rende em
**grama**, então cada venda gera uma linha de baixa tipo
`qtd: 242, unidade: 'g'`.

- O caminho **local** (`aplicarMovimento → ajustaEstoque → convUnid`)
  **converte**: desconta 0,242 kg. Certo.
- A venda também sobe pelo **pacote atômico** (`rpc/venda_registrar →
  estoque_aplicar`), e ali o banco faz `estoque = estoque + qtd` **sem
  converter**: descontava **242 kg** por bola de sorvete. Mil vezes a mais.

Os dois lados brigavam pelo saldo da nuvem — o delta errado do banco e o
absoluto certo do aparelho — e o download adota o mais recente
(`atualizadoEm`, regra da V291). Bastava um dia de venda para o saldo
despencar.

Medido no banco (`estoque_unidade`), itens guardados em kg atingidos:

| Item (Santa Fé) | Guardado | — |
|---|---|---|
| GELATO VENDA | −779,49 kg | impossível |
| Nutella | −131,05 kg | impossível |
| Creme de Ninho | −68,16 kg | impossível |

(Matriz: GELATO VENDA −44,61 kg, mesma origem.) Os itens contados em
**unidade** — copos, canudos, guardanapos — **não** têm esse erro (un = un,
nada a converter); as pequenas diferenças deles são reconciliação normal de
contagem.

## A correção da lógica (feita, bateria verde — V297)

Na **porta única da venda** (`baixarEstoqueVenda`), cada linha é
**normalizada para a unidade-base do próprio item** antes de virar
movimento. Assim o que o aparelho guarda, o que sobe no pacote e o delta que
o banco aplica passam a ser a **mesma quantidade, na mesma unidade**.
Unidade sem base comum (ex.: `un` contra `kg`) é mantida como está — melhor
não converter do que converter errado.

- Teste novo: `testes/baixa-venda-converte-unidade.js` (g→kg, ml→L, já-base
  intacto, incompatível mantido, e a trava no código).
- `testes/gelato-venda.js` corrigido: antes ele cobrava a baixa em "500 g"
  (o estado com bug); agora exige "0,5 kg", a unidade do item.
- `node ferramentas/portao.js`: 9 etapas verdes. `V297.0.0`.

## Por que a contagem não "consertou" e por que o número certo pede uma nova

A contagem de 31/08 aplicou a **diferença** (conferido − sistema) sobre um
saldo já corrompido. No instante da contagem o saldo virou 94 kg (certo),
mas **as vendas seguintes voltaram a descontar grama-como-quilo** e o saldo
despencou de novo. Contagem sem a lógica corrigida é balde furado.

**Não reescrevi o saldo no banco por reconstrução matemática.** O motivo é
honesto: o histórico de movimentos da nuvem está **incompleto** — o outro
defeito corrigido hoje (V296) fazia muitas baixas de venda **não subirem**.
Reconstruir "94 kg + entradas − saídas" a partir de um histórico furado
daria outro número errado (para GELATO VENDA daria ~73 kg, mas faltam as
baixas que nunca chegaram). O único jeito confiável de fixar o saldo
verdadeiro é uma **contagem física** — e agora, com as duas lógicas
corrigidas (baixa que sobe + unidade certa), a contagem **fica de pé**.

## Recomendação

1. Publicar V297 (correção da unidade).
2. Refazer a contagem física de GELATO VENDA, Nutella e Creme de Ninho nas
   unidades afetadas (Santa Fé; conferir Matriz). A partir daí o saldo
   passa a descontar só a venda real, na unidade certa, e não desanda mais.

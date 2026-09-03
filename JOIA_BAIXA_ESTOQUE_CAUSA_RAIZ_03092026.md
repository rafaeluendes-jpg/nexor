# JOIA — "Várias vendas no PDV, só uma baixa de estoque" (causa e correção)

**03/09/2026. Santa Fé do Sul.** O caixa vende, mas a Movimentação de
Estoque → Venda PDV mostra quase nenhuma baixa. Investigação de leitura no
banco de produção + leitura do código. Correção publicável (bateria verde).

## O que o banco mostrou (dia de hoje, Santa Fé)

- 34 pedidos de PDV chegaram à nuvem.
- Apenas **8 geraram baixa** de estoque (`movimentacoes_estoque`, origem
  `venda`).
- O **mesmo produto** (`Cascão 1 Bola`, id `d8232f2e…`) baixou em **6**
  pedidos e **não** baixou em **4**. `Cascão 2 Bolas`: baixou em 4, não em
  11.

Isso é a prova decisiva: **não é produto sem ficha.** Um produto ou tem a
ficha vinculada, ou não tem — e isso é constante no aparelho. O mesmo id
baixar às vezes sim, às vezes não, só acontece se **um aparelho tem o
vínculo e o outro não** (dois caixas no balcão, os dois carimbam
`equipamento = balcao`).

## A causa raiz

Na nuvem, **`produtos.ficha_id` e `produtos.insumo_id` estavam VAZIOS para
todos os 45 produtos** (e `fichas_tecnicas.produto_id` também). Ou seja: o
vínculo produto→ficha técnica **não existe na nuvem**.

A descida (download) reconstrói o vínculo assim:

```
p.fichaId = mapaFi[ produtos.ficha_id da nuvem ] || ''
```

Como o valor da nuvem é vazio, **todo download zerava `p.fichaId`** — e sem
ficha a venda não tem o que baixar (`baixarEstoqueVenda` retorna 0). O
aparelho que ainda não tinha baixado a versão vazia mantinha o vínculo
local e baixava; o que já tinha baixado, não. Daí a intermitência.

É exatamente o padrão que este sistema já registrou várias vezes: **um
campo que existe na descida mas some/chega vazio na subida apaga o trabalho
em silêncio** (V135, V136, e a ficha da opção). A mesma regra da casa vale:
**ausência de dado não é resposta.**

## A correção (mínima, mesma regra da opção)

Arquivo `src/js/03-armazenamento/02-medir-…` (descida de produtos):

Quando a nuvem **não traz** o vínculo, o download **mantém o que o aparelho
já sabia**, desde que a ficha (ou o insumo) apontado **ainda exista** ali. O
envio seguinte traduz esse vínculo local e **re-popula a nuvem**, que passa
a descer certo para todos os aparelhos — cura sozinha.

Desvincular pela tela continua valendo: quem tira a ficha deixa o próprio
`fichaId` vazio, e nada aqui inventa vínculo — só preserva o que já havia.

- Teste novo: `testes/venda-baixa-mantem-vinculo.js` (nuvem com vínculo usa
  o da nuvem; nuvem vazia mantém o do aparelho; não ressuscita ficha
  apagada; desvincular pela tela continua funcionando; a trava está no
  código).
- `node ferramentas/portao.js`: 9 etapas, todas verdes. `V296.0.0`.

## Por que NÃO reescrevi os vínculos direto no banco

Dava para tentar casar produto→ficha pelo nome, mas só 31 dos 42 casam, e
o casamento é errado no geral (o "Cascão 1 Bola" baixa GELATO VENDA,
BOLACHA CASCÃO etc., não uma ficha chamada "Cascão 1 Bola"). Reconstruir no
chute criaria baixa errada. A fonte certa do vínculo é o aparelho da loja
que ainda o tem — e a correção acima faz esse aparelho re-popular a nuvem no
próximo envio, sem adivinhação e sem escrita cega em produção.

## Fila de sincronização ("aparelho atrasado", 700+)

O motor conta como pendente toda linha cuja impressão mudou ou que a nuvem
ainda não confirmou (`contarPendencias` = mesma conta do envio). Enquanto há
pendência, o aparelho pausa os downloads — daí a faixa "aparelho atrasado".
A verificação de esquema (`conferir-nuvem.js`) não achou coluna/`on_conflict`
fora do lugar, então não há linha "veneno" derrubando lote por schema. O
saldo por unidade (`estoque_unidade`, 490 linhas) já teve a guerra encerrada
(V291). O acúmulo residual drena quando o aparelho consegue baixar; a
correção do vínculo acima remove a maior fonte de reenvio inútil (produto
reescrito a cada download). Seguimos observando com vendas reais.

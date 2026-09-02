# JOIA — Varredura geral de retaguarda, banco e nuvem

**02/09/2026.** Verificação de leitura, sem escrita em produção. Pedido do
Rafael: por que aparece "não subiu na nuvem", e se PDV, estoque,
financeiro, taxas e relatórios estão certos.

## Resumo

O banco está **íntegro** e o envio para a nuvem está **saudável hoje**. O
defeito histórico dos itens que não subiam (pedido de base) foi corrigido
na V289. Sobrou **um problema aberto que depende de decisão do Rafael**: a
taxa de cartão de Santa Fé está oscilando entre dois valores.

## O que foi conferido

### 1. Forma dos dados (código × banco) — OK
`conferir-nuvem.js`: **923 campos, chaves e filtros** conferidos contra as
**88 tabelas** de produção. Nada fora do lugar. Nenhuma coluna que o código
manda e o banco não tem; nenhuma chave de upsert sem índice único.

### 2. Vendas do PDV subindo inteiras — OK hoje
Cabeçalho, itens e pagamentos de cada venda:

| Dia | Pedidos | Sem itens | Sem pagamento |
|---|---|---|---|
| 02/09 | 22 | 0 | 0 |
| 01/09 | 33 | 0 | 0 |
| 31/08 | 46 | 0 | 0 |
| 30/08 | 140 | 0 | 4 (cardápio) |
| 26–29/08 | 208 | 0 | 0 |
| 20–25/08 | histórico | 2 | 15 |

- Os **2 sem itens** são pedidos de **cardápio cancelados** (25/08) — baixo
  impacto, cancelados.
- Os **sem pagamento** são quase todos históricos (20–25/08); os **4 de
  30/08** são de cardápio (pagamento na entrega, registrado à parte).
- **Recente (26/08 em diante): limpo.** O empurrão de item não está mais
  acontecendo no PDV. Zero item órfão, zero pagamento órfão, zero ficha
  órfã.

### 3. Baixa de estoque na venda — OK
`movimentacoes_estoque`: **478 movimentos com origem "venda"**, o último em
**02/09**. A venda está dando baixa no insumo, e está atual.

### 4. Venda caindo no caixa — OK
As vendas de PDV recentes carregam `caixa_id` (caem no caixa do dia). Os
316 sem caixa são todos do lote de **20/08** (importação/migração), não da
operação normal.

### 5. Taxa de cartão configurada — OK (valor em disputa, ver problema)
Débito 1,99% (1 dia), crédito 3,49% (30 dias), dinheiro/Pix 0%. A taxa é
uma propriedade da forma de pagamento e é aplicada nos relatórios e no
financeiro a partir daí — não é gravada por venda.

### 6. Pedido de base (matriz↔loja) — corrigido V289
O item do pedido de base subia só o cabeçalho. Causa: os filhos só subiam
quando o pai mudava, e o cabeçalho do pedido não muda mais. Corrigido: o
pai com filho pendente reenvia e leva o item junto. Barreira nova em
`testes/pedido-base-sobe-inteiro.js`.

## PROBLEMA ABERTO — decisão do Rafael

### Taxa de cartão de Santa Fé oscilando

A taxa de Santa Fé está **trocando de valor sozinha**, e ainda estava
acontecendo em **02/09**. O histórico (`audit_log`) mostra o vaivém, sempre
em lote (todas as formas no mesmo instante):

| Quando | Débito | Crédito | Origem |
|---|---|---|---|
| 01/09 02:21 | → 1,99% | → 3,49% | sessão `santafe@…` |
| 01/09 21:42 | → 0,73% | → 2,73% | sem sessão (correção via banco) |
| 02/09 15:18 | → 1,99% | → 3,49% | sessão `santafe@…` |

- **1,99% / 3,49%** são os valores de **fábrica**.
- **0,73% / 2,73%** têm cara de **taxa real negociada** de Santa Fé.
- O aparelho de Santa Fé está **empurrando o valor de fábrica** para a
  nuvem a cada sincronização, por lote. A semente do código **não** é a
  causa (`baseFormas` só entra com a lista vazia — conferido). O que
  acontece é o aparelho de Santa Fé guardar o valor de fábrica localmente
  e reenviá-lo por cima.

**O que falta para fechar:** só o Rafael sabe qual é a taxa **certa** de
Santa Fé (0,73/2,73 ou 1,99/3,49). O sistema não tem como decidir entre
dois valores que os dois lados tratam como verdade. Assim que ele disser o
valor correto, a correção é: gravar esse valor **e** recarregar o aparelho
de Santa Fé uma vez, para o aparelho parar de reenviar o antigo.

**Não foi alterado nada disso** — é configuração/decisão comercial, e a
regra é não mexer em valor de loja sem ordem (regra 2 do `CLAUDE.md`).

## Observações menores (sem ação agora)

- Cardápio: dos poucos pedidos de cardápio, alguns não têm linha de
  pagamento — condizente com "pagar na entrega". Não é falha de sync.
- Lote de 20/08 (316 pedidos sem caixa): parece migração antiga; não afeta
  a operação atual.

# JOIA — Itens do pedido mudavam depois da venda (causa e correção)

**03/09/2026. Santa Fé. URGENTE.** No Pedido #849, o cupom impresso na
venda trazia produtos diferentes dos que aparecem ao abrir o pedido depois.
Total igual (R$ 38), itens e quantidades diferentes. Investigação de leitura
no banco de produção + leitura do código.

## O que o banco mostrou

- Um único pedido #849 (sem número duplicado). Pagamento R$ 38 em dinheiro,
  certo.
- Os itens gravados **não somavam o total**: 3 + 24 + 5 + 24 + 5 = R$ 61,
  contra header R$ 38. Todos com `unitario = 0`.
- O header foi escrito **duas vezes**: INSERT 19:21:26 (pacote atômico) e
  UPDATE 19:21:40 (sincronização comum, 14 s depois).
- Varredura dos pedidos desde 01/09: **4 pedidos** com itens que não batem o
  header — #747, #772, #802, #849.

## As causas (três, somadas)

1. **O item da venda nascia sem identificador.** Os dois caminhos que sobem
   a venda davam nomes diferentes à MESMA linha: o pacote atômico usava
   `pedido_posição`, a sincronização comum usava `pedido_j_aleatório`.
   Chaves diferentes para a mesma linha → reenviar **duplicava, apagava e
   embaralhava** os itens de um pedido já vendido.

2. **A limpeza de pré-envio colapsava itens de mesmo nome.** Essa trava foi
   escrita para OPÇÃO de cardápio (duas "Borda Nutella" iguais são a mesma
   opção), mas rodava para os filhos de TODAS as tabelas. Num pedido, três
   "Cascão Chocolate Avulso" e duas "Agua" são reais — e eram colapsados a
   um, apagando produtos da venda a cada sincronização.

3. **O preço unitário trocava de nome no caminho.** O carrinho e o envio
   usam `unit`; o download devolve `unitario`. Escrever só um zerava o outro
   no reenvio — a venda voltava com preço 0 (daí `unitario = 0` no banco). O
   pacote atômico ainda lia `it.preco`, que nem existe, mandando 0 também.

## A correção (V298, bateria verde)

1. O item da comanda **nasce com id próprio** (`uid('it')`). Os dois
   caminhos e o download passam a usar a MESMA referência: reenviar é
   idempotente, o pedido fica **imutável** e os itens não mudam mais depois
   da venda.
2. A limpeza por nome passa a valer **só para `opcoes`**. Item de pedido,
   pagamento e item de ficha (repetição real) passam direto.
3. O preço anda nos **dois nomes** (`unit` e `unitario`) na descida, no
   carrinho e no envio; o pacote atômico lê `unit`. O preço sobrevive ao
   round-trip.

- Teste novo: `testes/pedido-imutavel.js` (itens repetidos sobrevivem;
  opção ainda colapsa; preço sobrevive; as travas no código). Registrado no
  `npm test`.
- `node ferramentas/portao.js`: 9 etapas verdes.

## Os 4 pedidos já afetados

#747, #772, #802 e #849 têm o detalhe de itens embaralhado. O **total, o
pagamento e o financeiro estão corretos** (o header nunca mudou) — só a
lista de itens ficou errada. Não reescrevi essas listas porque o conjunto
verdadeiro só existe no cupom de papel de cada uma (tenho o do #849, não o
dos outros três). A correção impede que aconteça de novo; se o Rafael quiser
acertar o detalhe desses 4, precisa dos cupons impressos.

## Validação

Fluxo do início ao fim coberto pela bateria (`provar.js` abre caixa, vende,
recarrega e confere que nada sumiu). Recomendado validar com vendas reais de
itens repetidos (3 casquinhas iguais) após os tablets pegarem a V298.

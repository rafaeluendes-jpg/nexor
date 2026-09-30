# Joia — API analítica RDS v3 · homologação das 20 perguntas

Executada em 30/09/2026, no banco de produção (dado real), pela mesma
função que a API usa: `rds_consulta`. A função de borda `joia-rds` só
confere a chave e repassa: o que está aqui é o que a RDS recebe, menos a
máscara de dado pessoal, que a borda aplica.

Endereço: `https://cevghkndzpzvnzwifhnm.supabase.co/functions/v1/joia-rds`
Chave: "RDS Inteligência e Gestão" (prefixo `joia_rdsg_425874`), rede
Jolô, sem unidade fixa, 120 chamadas por minuto, dados pessoais
mascarados. A chave em si foi entregue ao Rafael por mensagem.

> **Contexto dos números.** Das quatro unidades da rede no Joia, só
> **Santa Fé do Sul** vende pelo sistema. Jales, Alphaville e Matriz
> aparecem nas respostas com zero — a API as inclui e diz que não há
> movimento, em vez de escondê-las. A comparação entre unidades fica
> completa à medida que as outras lojas entrarem no Joia.

## Prova de somente leitura

| verificação | resultado |
|---|---|
| a consulta roda dentro de `SET TRANSACTION READ ONLY` | sim: `transaction_read_only = on` e a DRE da rede respondeu |
| funções `rds_*` voláteis (as únicas que poderiam gravar) | **0** de 43 |
| funções `rds_*` alcançáveis pela chave pública (anon/authenticated) | **0** |
| método diferente de GET na borda | 405 |
| chamada da borda ao banco | GET no PostgREST (transação somente leitura) |

## Recusas (nenhuma mistura silenciosa)

| chamada | resposta |
|---|---|
| `/faturamento` sem `loja`, `unidades` nem `rede=1` | 400 — "Diga de qual unidade é a consulta… Sem isso a API não mistura unidades" |
| `/faturamento?loja=suc_xxx` | 400 — unidade desconhecida, com a lista das válidas |
| `/faturamento?rede=1&de=2026-13-01` | 400 — data fora do formato |
| `/nao/existe?rede=1` | 404 |
| chave presa a Santa Fé pedindo `loja=suc_2157f764d972` (Jales) | responde **só Santa Fé** e avisa que o filtro foi ignorado |
| `/estoque?loja=…&canal=pdv` | responde e devolve `filtros_que_nao_se_aplicam: ["canal"]` |

## As 20 perguntas

| # | pergunta | chamada | resposta (dado real) |
|---|---|---|---|
| 1 | Copos P nos últimos 10 dias em Santa Fé | `/produtos?loja=suc_mt1unhbx2xrb&de=2026-09-21&ate=2026-09-30&produto=Copo P` | **166 Copos P**, em 111 pedidos, R$ 3.008,00 (13,01% do faturamento); CPV teórico R$ 640,04; margem 78,72% |
| 2 | média diária de Copos P | mesma chamada, `media_diaria` | **16,6 por dia** |
| 3 | Copo P entre as unidades | `/analises/comparativo-unidades?rede=1&de=2026-09-21&ate=2026-09-30&produto=Copo P` | Santa Fé 166 (16,6/dia); Jales, Alphaville e Matriz 0 |
| 4 | classe A de cada unidade | `/analises/curva-abc?rede=1&agrupar=unidade&de=2026-09-01&ate=2026-09-30` | Santa Fé: Cascão 2 Bolas (20,82%), Copo M (14,78%), Copo P (14,19%), Cascão 1 Bola, Gelato 1 Kg, Gelato 500 g. Demais unidades: sem venda |
| 5 | produtos muito superiores numa unidade | `/produtos?rede=1&agrupar=unidade` | hoje só Santa Fé vende no Joia: não há segunda unidade para comparar. A chamada já devolve participação por unidade para quando houver |
| 6 | faturamento diário e mensal | `/faturamento?rede=1&agrupar=mes&de=2026-08-01&ate=2026-09-30` e `/faturamento?loja=…&de=2026-09-26&ate=2026-09-30` | Santa Fé: agosto R$ 68.356,37 (744 pedidos); setembro R$ 74.993,99 (1.771 pedidos). Diário 26–30/09: 5.573 · 5.071 · 2.120 · 1.458 · 907 (30/09 ainda em andamento) |
| 7 | maior crescimento | `/analises/comparativo-unidades?rede=1&de=2026-09-01&ate=2026-09-30` | Santa Fé **+16,29%** sobre os 30 dias anteriores; demais sem base de comparação |
| 8 | ticket médio | mesma chamada | Santa Fé **R$ 42,35** |
| 9 | CPV teórico | `/analises/cpv-perdas?rede=1&de=2026-09-01&ate=2026-09-30` | Santa Fé **R$ 19.193,96** (25,59% do faturamento) |
| 10 | índice de perdas | mesma chamada | Santa Fé **0,1829** (perdas R$ 3.510,37 ÷ CPV); 4,68% do faturamento |
| 11 | margem de contribuição | `/analises/dre?rede=1&de=2026-09-01&ate=2026-09-30` | Santa Fé **R$ 43.712,64** |
| 12 | estoque negativo em Santa Fé | `/pendencias/estoque-negativo?loja=suc_mt1unhbx2xrb` | **3 itens**: Canudo (−200), Massa Cascão Tradicional (−0,123), Ovomaltine (−0,5), cada um com o último movimento |
| 13 | insumos de Santa Fé sem custo | `/pendencias/insumos-sem-custo?loja=suc_mt1unhbx2xrb` | **59 insumos** |
| 14 | lançamentos de Santa Fé sem plano de contas | `/pendencias/lancamentos-sem-categoria?loja=suc_mt1unhbx2xrb` | **2**: "Compra de pote de isopor" R$ 1.119,60 e "NF 888591 — Distribuidora Local" R$ 297,57 (ambos pagos) |
| 15 | produtos que vendem e não baixam estoque | `/pendencias/produtos-sem-vinculo?rede=1` | **2**: Cascão Chocolate 2 Bolas e Taxa de Entrega |
| 16 | DRE de Santa Fé | `/analises/dre?loja=suc_mt1unhbx2xrb&de=2026-09-01&ate=2026-09-30` | receita líquida R$ 74.993,99; impostos −6.340,91; taxas de cartão −954,64; CPV real −22.704,33; margem bruta 44.994,11; margem de contribuição 43.712,64; pessoal −6.869,43; resultado gerencial **R$ 35.824,04** |
| 17 | DRE consolidado da rede | `/analises/dre?rede=1&…` | bloco `escopo: rede consolidada`: igual a Santa Fé (única unidade com movimento). Venda de base entre unidades (R$ 6.011) fica fora do resultado, em `fora_do_resultado` |
| 18 | fluxo realizado e projetado | `/analises/fluxo-caixa?rede=1&de=2026-09-01&ate=2026-10-31&visao=mensal` | entradas realizadas R$ 49.439,68; saídas R$ 33.052,56; saldo final realizado R$ 22.910,12; a receber R$ 38.683,85; a pagar R$ 11.463,51; saldo projetado **R$ 50.130,46** |
| 19 | contas a pagar dos próximos 7 dias | `/analitico/titulos?rede=1&data=vencimento&de=2026-10-01&ate=2026-10-07&situacao=em aberto` | **3**: Riberfoods R$ 813,90 (01/10), Distribuidora Local R$ 1.740,00 (01/10), Aromitalia R$ 835,82 (02/10) |
| 20 | pendência de caixa ou sincronização | `/pendencias/caixas-com-pendencia?rede=1` e `/sincronizacao/unidades?rede=1` | caixas: **27** (Santa Fé 26, Alphaville 1). Sincronização: **Matriz offline** (último sinal 29/09); **Santa Fé com pendência local** em aparelho; Jales e Alphaville sem movimento |

## Os demais caminhos (conferidos na mesma rodada)

| caminho | resultado |
|---|---|
| `/cadastros/plano-de-contas` | categorias e subcategorias, com `classificacao_gerencial` e `compoe_dre` |
| `/cadastros/contas-financeiras` | Caixa da loja R$ 3.813,37; Cofre R$ 10.470,01; Itaú R$ 5.179,74 (saldo inicial + movimentado) |
| `/cadastros/motivos-estoque` | 18 motivos com classe derivada (ex.: Perda Balcão = perda, Consumo Balcão = consumo, Programa de fidelidade = bonificação) |
| `/estoque?loja=Santa Fé` | 256 itens |
| `/analitico/movimentos-estoque` (30/09) | 223 linhas |
| `/analitico/inventarios` (ago–set) | 118 linhas |
| `/analitico/compras` (set) | 38 notas — 37 sem unidade gravada, unidade lida do movimento da nota e dita em `unidade_origem` |
| `/analises/historico-custos` | por insumo, preço da 1ª e da última compra, variação e impacto estimado no CPV |
| `/analitico/producoes` (28–30/09) | 33 produções (ordens manuais e automáticas na venda) |
| `/analitico/pagamentos?forma_pagamento=Pix` (30/09) | 9 |
| `/analitico/caixas` (20–30/09) | 11 caixas |
| `/analitico/extrato-financeiro` (set) | 186 movimentos |
| `/analises/crm` (set) | 268 clientes identificados; 16,77% das vendas com cliente identificado; retenção 66,67% |
| `/alteracoes?alterados_desde=2026-09-30T20:00:00Z` | 346 registros |
| ordenação `ordenar_por=valor_liquido&ordem=desc` | 109 · 102 · 58 |
| incremental `alterados_desde` em vendas | só as 4 vendas alteradas depois do instante |
| `/metas`, `/jornadas` | `disponivel: false`, com o motivo |

## Desempenho

Medido no banco, Santa Fé, setembro inteiro: vendas 0,26 s; itens
0,28 s; CPV e perdas 0,11 s; comparativo da rede 1,08 s. (A primeira
versão da extração de consumo levava 5 s; foi reescrita antes da
entrega.)

## O que não foi possível testar daqui

A chamada HTTP ponta a ponta (`curl` na URL da função) não sai deste
ambiente: a rede dele bloqueia o endereço do Supabase. A função de borda
foi publicada (versão 1, conferida byte a byte com o arquivo do
repositório) e só repassa para `rds_consulta`, testada acima. A primeira
chamada real da RDS é a confirmação final; exemplo em
`RDS_API_V3_EXEMPLOS.md`.

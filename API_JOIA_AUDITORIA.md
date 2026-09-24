# Joia — API de auditoria gerencial (v2.0)
## Dicionário completo de campos, fórmulas e erros

Complemento técnico do `API_JOIA_LEITURA.md`. Aqui está, caminho por
caminho, **todo campo que a API devolve**: tipo, se pode vir vazio, em que
unidade está, com quantas casas, de onde sai e — quando é calculado — a
conta exata que o produz.

Escrito em 22/09/2026 para atender às seções 5 (contrato de dados) e 11
(documentação) da especificação da RDS. O contrato em OpenAPI 3.1 está em
`api-joia.openapi.yaml`, no mesmo repositório.

Princípio que vale para o documento inteiro: **a API não inventa número**.
Onde o Joia não grava o dado, o campo não existe — e a resposta traz um
`avisos` dizendo isso em voz alta. O que falta e por quê está em
`DIAGNOSTICO_API_AUDITORIA_RDS.md`.

---

## 1. Regras gerais

### 1.1 Endereço, método e chave

```
GET https://cevghkndzpzvnzwifhnm.supabase.co/functions/v1/joia-api/<caminho>
Authorization: Bearer SUA_CHAVE
```

Só `GET`. Qualquer outro método responde **405** — a API lê, não escreve.
`OPTIONS` responde só o CORS.

A chave decide o alcance, não o parâmetro:

- a chave carrega a **rede** (`loja_id`); não há como pedir outra;
- se a chave carrega **unidade** (`sucursal_id`), o parâmetro `loja` é
  ignorado e a resposta devolve a unidade da chave. Provado em 22/09/2026:
  chave presa a Alphaville pedindo `loja=suc_mt1unhbx2xrb` respondeu com a
  unidade dela e zero registros.

### 1.2 Parâmetros comuns

| parâmetro | tipo | padrão | observação |
|---|---|---|---|
| `de` | `AAAA-MM-DD` | 30 dias atrás | começo do período, **inclusive** |
| `ate` | `AAAA-MM-DD` | hoje | fim do período, **inclusive** |
| `loja` | `suc_...` | rede toda | ignorado quando a chave já tem unidade |
| `pagina` | inteiro ≥ 1 | 1 | só nos caminhos analíticos |
| `por_pagina` | inteiro 1–1000 | 200 | acima de 1000 é cortado em 1000 |

`de` e `ate` são comparados **inclusive** (`between`). Um dia só é
`de=ate=AAAA-MM-DD`.

### 1.3 Fuso e corte do dia

- **Venda** (`/faturamento`, `/produtos`, `/pagamentos`, `/pedidos`,
  `/itens`, `/pagamentos-analitico`): a data sai de
  `data_venda at time zone 'America/Sao_Paulo'`. Venda das 23h **é do dia
  dela**, não do dia seguinte em UTC.
- **Estoque, produção, contagem e financeiro**: a data já é gravada pelo
  Joia como dia local (`date`), sem hora. Não há conversão — e não há como
  haver erro de fuso.
- `gerado_em`, `criado_em` e qualquer `timestamp` viajam em **UTC**, no
  formato ISO-8601 com `Z`. Converter para São Paulo é do lado de quem lê.
- O padrão de `de`/`ate` (30 dias) é calculado em UTC−3.

### 1.4 Arredondamento — a regra por natureza do número

| natureza | casas | onde |
|---|---|---|
| dinheiro | **2** | `valor`, `total`, `valor_total`, `taxa_calculada`, `valor_ajuste`… |
| preço unitário de venda | **4** | `preco_unitario` |
| quantidade de estoque | **4** | `quantidade`, `previsto`, `produzido`, `saldo_*` |
| saldo do painel de estoque | **3** | `/estoque.saldo`, `minimo` |
| custo unitário | **4** a **6** | `custo_medio` (4); `custo_unitario` e `custo` (6) |

Arredondamento é `round` do Postgres (meio para cima, em `numeric` — sem
ponto flutuante binário, sem centavo perdido). **Toda soma é feita antes
de arredondar**; o arredondamento é a última operação.

### 1.5 Nulo, vazio e zero

Três coisas diferentes, e a API não as confunde:

- `null` = **o Joia não tem esse dado** para esse registro (ex.: `pagamento`
  de um título ainda em aberto);
- `""` ou `"—"` = o campo existe e está em branco no cadastro;
- `0` = o número é zero de verdade.

Todo campo monetário calculado usa `coalesce(...,0)`: some sem medo, não
vem `null` no meio de uma conta.

### 1.6 Envelope e paginação

Os caminhos analíticos devolvem sempre:

```json
{
  "api_versao": "2.0",
  "gerado_em": "2026-09-22T18:40:11.204Z",
  "periodo": { "de": "2026-09-01", "ate": "2026-09-22" },
  "loja": "suc_mt1npcg7b3m3",
  "pagina": {
    "pagina": 1, "por_pagina": 200, "nesta_pagina": 200,
    "total_registros": 1435, "total_paginas": 8
  },
  "avisos": ["…"],
  "pedidos": [ … ]
}
```

| campo do envelope | significado |
|---|---|
| `api_versao` | versão do contrato (`2.0`). Muda quando um campo muda de sentido |
| `gerado_em` | instante da resposta, UTC |
| `periodo` | o período efetivamente aplicado (já com os padrões resolvidos) |
| `loja` | a unidade aplicada, ou `"rede toda"` |
| `pagina.total_registros` | quantos registros o filtro tem **no total**, não na página |
| `avisos` | lista de ressalvas honestas; só aparece quando há o que ressalvar |

**Ordenação determinística** em todos eles: a chave de ordem sempre termina
num identificador único, então a página 2 nunca repete nem pula linha da
página 1. A ordem de cada caminho está na tabela dele, abaixo.

Uma ressalva de paginação: `total_registros` viaja **dentro da linha**
(`count(*) over()`). Numa página **além do fim** não vem linha nenhuma, e
aí `total_registros` e `total_paginas` voltam `0`. Pagine pelo total lido
na primeira página, e não interprete esse `0` como "não há dados".

Os caminhos `/plano-de-contas`, `/fichas` e `/reconciliacao/estoque`
**não são paginados**: devolvem o conjunto inteiro (são cadastros e
fechamentos, não razão). Os consolidados da v1 mantêm o formato antigo,
sem envelope — nada neles mudou.

### 1.7 Erros

Toda resposta de erro tem o mesmo formato:

```json
{ "erro": "A data inicial é depois da final.",
  "api_versao": "2.0", "gerado_em": "2026-09-22T18:40:11.204Z" }
```

| código | quando |
|---|---|
| **400** | data fora de `AAAA-MM-DD`; `de` depois de `ate`; `data` diferente de `emissao\|vencimento\|pagamento` em `/titulos` |
| **401** | sem chave, chave inválida, ou chave desativada (`ativa=false`) |
| **404** | caminho que não existe — a resposta já traz a lista dos válidos |
| **405** | qualquer método que não seja GET |
| **500** | falha ao consultar o banco; vem com `detalhe` |

Não há 403: quem não pode ver uma rede simplesmente **não a vê** — a chave
filtra na origem, e a resposta sai vazia, nunca com dado de outra rede.

### 1.8 Por dentro, e o que foi conferido

As 18 funções `api_*` são `stable security definer`, só `select`, com
`search_path` fixo em `public`. A permissão de executar é **só** de
`postgres` e `service_role` — conferido campo a campo em 22/09/2026:
`anon` e `authenticated` não alcançam nenhuma delas. Quem chega pelas
chaves públicas do projeto não chega aqui; só a função de borda chega.

A prova dos onze caminhos novos foi feita de dentro do próprio banco
(o ambiente de desenvolvimento não alcança `*.supabase.co`), com a
extensão `pg_net` instalada **para a prova e removida depois**: a porta
de saída HTTP do banco não fica aberta sem necessidade.

---

## 2. Caminhos analíticos

### 2.1 `GET /pedidos` — venda a venda

Ordem: `data_venda, numero, pedido_ref`. Uma linha por pedido, **inclusive
os cancelados** (marcados) — auditoria precisa vê-los.

| campo | tipo | nulo? | unidade / casas | de onde vem |
|---|---|---|---|---|
| `pedido_ref` | texto | não | — | `pedidos.ref_local`, identificador estável do pedido |
| `unidade` | texto | sim | — | `sucursais.ref_local` |
| `unidade_nome` | texto | sim | — | `sucursais.nome` |
| `numero` | inteiro | sim | — | número do pedido na unidade |
| `data_venda` | data | não | dia da loja | `data_venda` convertida para São Paulo |
| `hora` | texto `HH:MM` | sim | hora da loja | gravada pelo PDV |
| `criado_em` | timestamp | sim | UTC | quando a linha nasceu no banco |
| `tipo` | texto | sim | — | balcão / mesa / delivery / retirada |
| `canal` | texto | sim | — | canal de venda |
| `origem_venda` | texto | sim | — | de onde o pedido entrou |
| `fase` | texto | sim | — | situação do pedido (`entregue`, `cancelado`…) |
| `cliente` | texto | sim | — | `cliente_nome` |
| `caixa_ref` | texto | sim | — | o caixa em que a venda foi feita |
| `operador` | texto | sim | — | operador **do caixa** (o Joia não grava operador por pedido) |
| `mesa` | inteiro | sim | — | número da mesa |
| `comanda` | texto | sim | — | nome da comanda |
| `valor_bruto` | decimal | não | R$, 2 | `total + desconto + cupom − taxa_entrega − taxa_servico` |
| `desconto` | decimal | não | R$, 2 | desconto do pedido |
| `cupom` | decimal | não | R$, 2 | valor do cupom aplicado |
| `taxa_entrega` | decimal | não | R$, 2 | frete cobrado |
| `taxa_servico` | decimal | não | R$, 2 | os 10% quando houver |
| `valor_liquido` | decimal | não | R$, 2 | `pedidos.total` — **é o que o cliente pagou** |
| `cancelado` | booleano | não | — | `fase = 'cancelado'` |
| `cancelado_em` | texto | sim | dia+hora da loja | de `cancelamentos` |
| `cancelado_motivo` | texto | sim | — | motivo escolhido no cancelamento |
| `cancelado_por` | texto | sim | — | quem autorizou |
| `estoque_voltou` | booleano | sim | — | se o cancelamento devolveu o estoque |

> **Faturamento = soma de `valor_liquido` onde `cancelado = false`.** É
> exatamente o que `/faturamento` devolve; os dois batem por construção.

### 2.2 `GET /itens` — item a item

Ordem: `data_venda, numero, item_ref`.

| campo | tipo | nulo? | unidade / casas | de onde vem |
|---|---|---|---|---|
| `item_ref` | texto | não | — | `pedido_itens.ref_local` |
| `pedido_ref` | texto | não | — | liga com `/pedidos` |
| `unidade` | texto | sim | — | unidade da venda |
| `numero` | inteiro | sim | — | número do pedido |
| `data_venda` | data | não | dia da loja | — |
| `produto` | texto | sim | — | nome **no momento da venda** |
| `quantidade` | decimal | sim | unidade do produto | como foi vendido |
| `preco_unitario` | decimal | não | R$, 4 | preço praticado na venda |
| `valor_total` | decimal | não | R$, 2 | total da linha, como gravado |
| `adicionais` | JSON | não | — | lista de adicionais: nome, preço e ficha |
| `observacao` | texto | sim | — | o que o cliente pediu |
| `pedido_cancelado` | booleano | não | — | o **pedido** foi cancelado |

**Aviso que a resposta carrega:** desconto por item, cortesia e
cancelamento de item **não são gravados** pelo Joia. Quem quiser desconto
por item precisa rateá-lo pelo desconto do pedido — e saber que é rateio.

### 2.3 `GET /pagamentos-analitico` — pagamento a pagamento

Ordem: `data_venda, numero, pagamento_ref`.

| campo | tipo | nulo? | unidade / casas | de onde vem |
|---|---|---|---|---|
| `pagamento_ref` | texto | não | — | identificador da transação no Joia |
| `pedido_ref` | texto | não | — | liga com `/pedidos` |
| `unidade`, `numero`, `data_venda` | — | — | — | do pedido |
| `forma` | texto | não | — | nome da forma; `"—"` se a forma sumiu do cadastro |
| `forma_tipo` | texto | sim | — | dinheiro / crédito / débito / pix / voucher |
| `bandeira` | texto | sim | — | **do cadastro da forma**, não da transação |
| `valor` | decimal | não | R$, 2 | valor pago nessa forma |
| `taxa_pct` | decimal | não | %, do cadastro | taxa percentual da forma |
| `taxa_fixa` | decimal | não | R$, do cadastro | taxa por transação |
| `taxa_calculada` | decimal | não | R$, 2 | `valor × taxa_pct ÷ 100 + taxa_fixa` |
| `valor_liquido_previsto` | decimal | não | R$, 2 | `valor − taxa_calculada` |
| `dias_recebimento` | inteiro | não | dias corridos | do cadastro da forma |
| `data_prevista` | data | não | dia da loja | `data_venda + dias_recebimento` (dias **corridos**, sem feriado) |
| `equipamento` | texto | sim | — | maquininha informada no PDV |
| `pedido_cancelado` | booleano | não | — | — |

**Aviso que a resposta carrega:** taxa, prazo e bandeira saem do
**cadastro de hoje**, não do retorno da adquirente. O Joia não conversa com
maquininha: não existe data efetiva de recebimento nem estorno por
transação. `valor_liquido_previsto` é previsão, e o nome diz isso.

### 2.4 `GET /movimentacoes` — o razão do estoque

Ordem: `data, hora, movimento_ref, linha`. Uma linha por item dentro de
cada movimento.

| campo | tipo | nulo? | unidade / casas | de onde vem |
|---|---|---|---|---|
| `movimento_ref` | texto | não | — | identificador do movimento |
| `linha` | inteiro | não | — | posição do item dentro do movimento (1, 2, 3…) |
| `unidade` | texto | sim | — | unidade da loja |
| `data` | data | não | dia da loja | — |
| `hora` | texto `HH:MM` | sim | hora da loja | — |
| `criado_em` | timestamp | sim | UTC | — |
| `item_ref` | texto | sim | — | insumo **ou** ficha estocável |
| `item` | texto | sim | — | nome no momento do movimento |
| `unidade_medida` | texto | não | — | `kg`, `un`, `L`… (padrão `un`) |
| `direcao` | texto | não | — | `entrada` ou `saida` (padrão `saida`) |
| `quantidade` | decimal | não | unidade do item, 4 | sempre **positiva**; o sinal é `direcao` |
| `custo_unitario` | decimal | não | R$, 6 | custo do item no momento |
| `valor_total` | decimal | não | R$, 2 | `quantidade × custo_unitario` |
| `origem` | texto | não | — | a origem **crua**, para conferência |
| `motivo` | texto | não | — | motivo cadastrado, quando houver |
| `classe` | texto | não | — | classificação derivada — tabela abaixo |
| `documento` | texto | sim | — | nota, pedido ou identificação |
| `observacao` | texto | sim | — | — |
| `contagem_sistema` | decimal | sim | unidade do item | só em movimento de contagem |
| `contagem_conferido` | decimal | sim | unidade do item | só em movimento de contagem |

**Como `classe` é derivada** (de `origem` + `direcao`):

| origem | direção | classe |
|---|---|---|
| `nota` | qualquer | `compra/entrada` |
| `venda` | qualquer | `consumo por venda` |
| `producao` | entrada | `produção` |
| `producao` | saída | `consumo por produção` |
| `contagem` | entrada | `ajuste positivo` |
| `contagem` | saída | `ajuste negativo` |
| `transferencia`, `pedbase_saida`, `pedbase_entrada` | entrada | `transferência recebida` |
| idem | saída | `transferência enviada` |
| qualquer outra | entrada | `entrada avulsa` |
| qualquer outra | saída | `baixa identificada` |

**Aviso que a resposta carrega:** a classe é derivada — a `origem` crua vai
junto para conferência. Saldo anterior e posterior **por movimento** não
são gravados; a reconciliação vem de `/reconciliacao/estoque`.

### 2.5 `GET /inventarios` — contagem item a item

Ordem: `data, contagem_ref, item`.

| campo | tipo | nulo? | unidade / casas | de onde vem |
|---|---|---|---|---|
| `contagem_ref` | texto | não | — | identificador da contagem |
| `unidade` | texto | sim | — | — |
| `data` | data | não | dia da loja | o dia **contado** |
| `hora` | texto | sim | — | — |
| `retroativa` | booleano | não | — | contagem lançada para um dia anterior |
| `lancada_em` | data | sim | dia da loja | quando foi efetivamente lançada |
| `movimento_ref` | texto | sim | — | o movimento de ajuste gerado |
| `item_ref`, `item`, `unidade_medida` | — | — | — | o item contado |
| `saldo_sistema` | decimal | não | unidade do item, 4 | o que o Joia dizia ter |
| `quantidade_contada` | decimal | não | unidade do item, 4 | o que a loja contou |
| `diferenca` | decimal | não | unidade do item, 4 | `contado − sistema` (negativo = falta) |
| `custo` | decimal | não | R$, 6 | custo unitário na hora da contagem |
| `valor_ajuste` | decimal | não | R$, 2 | `diferenca × custo` |
| `sentido` | texto | não | — | `ajuste positivo` / `ajuste negativo` / `sem diferença` |

> **A divergência entre o sistema e o físico mora aqui** — é este o número
> de perda por conferência, não o de `/reconciliacao/estoque`.

### 2.6 `GET /producao-analitico` — produção item a item

Ordem: `data, numero, produto`.

| campo | tipo | nulo? | unidade / casas | de onde vem |
|---|---|---|---|---|
| `ordem_ref` | texto | não | — | identificador da ordem |
| `numero` | texto | sim | — | número da ordem |
| `unidade`, `data`, `hora` | — | — | dia/hora da loja | — |
| `situacao` | texto | sim | — | situação da ordem |
| `responsavel` | texto | sim | — | quem produziu |
| `movimento_ref` | texto | sim | — | o movimento de estoque gerado |
| `ficha_ref` | texto | sim | — | a ficha produzida |
| `produto` | texto | sim | — | nome do produto |
| `destino` | texto | sim | — | onde o produzido entrou |
| `unidade_medida` | texto | não | — | padrão `kg` |
| `previsto` | decimal | não | unidade do item, 4 | o que a ordem previa |
| `produzido` | decimal | não | unidade do item, 4 | o que saiu de verdade (pesado) |
| `diferenca` | decimal | não | unidade do item, 4 | `produzido − previsto` |
| `receitas` | decimal | não | — | quantas receitas foram multiplicadas |

**Aviso que a resposta carrega:** insumo previsto × insumo efetivamente
baixado, item a item, **não é gravado** pela ordem de produção. O que se
sabe é o consumo total pela origem `producao` em `/movimentacoes`.

### 2.7 `GET /titulos` — contas a pagar e a receber

Parâmetro próprio: `data=emissao|vencimento|pagamento` (padrão
`vencimento`) — escolhe **qual data o período filtra**. A ordem é sempre
`vencimento, titulo_ref`.

| campo | tipo | nulo? | unidade / casas | de onde vem |
|---|---|---|---|---|
| `titulo_ref` | texto | não | — | identificador do lançamento |
| `unidade` | texto | sim | — | — |
| `tipo` | texto | sim | — | `receita`, `despesa` ou `transferencia` |
| `descricao` | texto | sim | — | — |
| `documento` | texto | sim | — | número da nota / documento |
| `fornecedor` | texto | sim | — | nome do fornecedor |
| `categoria` / `subcategoria` | texto | sim | — | o plano de contas, dois níveis |
| `emissao` | data | sim | dia da loja | **hoje é a data mais próxima de competência** |
| `vencimento` | data | sim | dia da loja | — |
| `pagamento` | data | sim | dia da loja | `null` enquanto em aberto |
| `valor_original` | decimal | não | R$, 2 | valor antes de juros e multa |
| `juros` / `multa` | decimal | não | R$, 2 | — |
| `valor` | decimal | não | R$, 2 | valor efetivo do título |
| `pago` | booleano | não | — | — |
| `cancelado` | booleano | não | — | título cancelado continua aparecendo, marcado |
| `conciliado` | booleano | não | — | bateu com o extrato |
| `data_conciliacao` | data | sim | — | — |
| `conta` | texto | sim | — | conta de capital usada |
| `forma_pagamento` | texto | sim | — | — |
| `origem` / `origem_ref` | texto | sim | — | o que gerou o título (ex.: nota de entrada) |
| `criado_em` | timestamp | sim | UTC | — |

**Aviso que a resposta carrega:** não existe campo de **competência** nem
**centro de resultado**; a emissão é a data mais próxima da competência.
Pagamento parcial e saldo em aberto também não são gravados — o título é
pago ou não é.

### 2.8 `GET /extrato` — o que entrou e saiu de caixa e banco

Junta **duas** origens: lançamentos financeiros pagos e movimentos de
caixa (sangria, suprimento, transferência). Ordem: `data, hora, ref`.

| campo | tipo | nulo? | unidade / casas | de onde vem |
|---|---|---|---|---|
| `lancamento_ref` | texto | não | — | identificador da linha |
| `unidade` | texto | sim | — | — |
| `data` | data | não | dia da loja | data do **pagamento** (título) ou do movimento |
| `hora` | texto | sim | — | `null` nos títulos; preenchido no caixa |
| `conta` | texto | sim | — | conta de capital, ou `"Caixa da loja"` |
| `classe` | texto | não | — | `recebimento`, `pagamento`, `transferência entre contas`, `sangria`, `suprimento` |
| `sentido` | texto | não | — | `entrada` ou `saida` |
| `valor` | decimal | não | R$, 2 | sempre **positivo**; o sinal é `sentido` |
| `descricao` | texto | sim | — | descrição do título ou motivo da sangria |
| `categoria` | texto | sim | — | só nos títulos |
| `titulo_ref` | texto | sim | — | liga com `/titulos` |
| `conciliado` | booleano | não | — | `false` nos movimentos de caixa |
| `responsavel` | texto | sim | — | só nos movimentos de caixa |

Só entram títulos **pagos e não cancelados**, filtrados pela data de
pagamento.

**Aviso que a resposta carrega:** transferência entre contas vem com classe
própria — **não é receita nem despesa**, e somá-la ao faturamento é erro.
Saldo anterior/posterior por conta não é gravado; o saldo inicial de cada
conta está em `contas_capital`.

### 2.9 `GET /plano-de-contas` — sem paginação

| campo | tipo | nulo? | de onde vem |
|---|---|---|---|
| `nivel` | inteiro | não | `1` = categoria, `2` = subcategoria |
| `categoria_ref` / `categoria` | texto | não | `categorias_financeiras` |
| `tipo` | texto | sim | `receita` ou `despesa` |
| `subcategoria_ref` / `subcategoria` | texto | sim | `null` no nível 1 |
| `ordem` | inteiro | sim | posição na tela |

**Aviso:** dois níveis apenas. Código contábil, natureza, posição na DRE e
vigência **não existem** no cadastro.

### 2.10 `GET /fichas` — sem paginação

Parâmetro próprio: `ficha=fi_...` traz uma só. Uma linha por **ingrediente**
da ficha; a ficha sem ingrediente aparece com os campos de ingrediente em
branco.

| campo | tipo | nulo? | unidade / casas | de onde vem |
|---|---|---|---|---|
| `ficha_ref` / `ficha` / `codigo` | texto | — | — | cabeçalho da ficha |
| `unidade` | texto | sim | — | unidade da ficha |
| `rendimento` / `rendimento_unidade` | decimal / texto | sim | — | quanto a receita rende |
| `unidades_venda` | decimal | sim | — | em quantas unidades de venda o rendimento se divide |
| `preco` | decimal | sim | R$ | preço de venda |
| `estocavel` | booleano | sim | — | se o produzido entra no estoque |
| `destino` | texto | sim | — | para onde o produzido vai |
| `ingrediente_ref` / `ingrediente` | texto | sim | — | insumo **ou** subficha |
| `quantidade` | decimal | sim | unidade do ingrediente | quanto a receita usa |
| `unidade_ingrediente` | texto | sim | — | — |
| `perda` | decimal | sim | % | perda declarada na ficha |
| `subficha_ref` | texto | sim | — | preenchido quando o ingrediente é outra ficha |
| `custo_unitario` | decimal | sim | R$ | custo **de hoje** do insumo ou da subficha |

**Aviso que a resposta carrega, e é o mais importante deste documento:** a
ficha técnica **não tem vigência**. O que sai aqui é a receita de **hoje**.
Calcular CPV de uma venda antiga com esta ficha recalcula o passado com a
receita atual. A saída é congelar o CPV na venda — decisão 2 do
`DIAGNOSTICO_API_AUDITORIA_RDS.md`.

### 2.11 `GET /reconciliacao/estoque` — sem paginação

Uma linha por item e unidade. A equação anunciada em `regra`:

```
saldo_inicial + entradas − saidas = saldo_final
```

Como cada ponta é obtida, sem rodeio:

- `saldo_final` = saldo de hoje em `estoque_unidade` **menos** tudo que se
  moveu **depois** de `ate` — isto é, o saldo rebobinado até o fim do
  período;
- `entradas` / `saidas` = soma das quantidades do razão **dentro** do
  período, por direção;
- `saldo_inicial` = `saldo_final − entradas + saidas`.

| campo | tipo | nulo? | unidade / casas | o que é |
|---|---|---|---|---|
| `unidade`, `item_ref`, `item`, `unidade_medida` | texto | — | — | o item |
| `saldo_inicial` | decimal | não | unidade do item, 4 | saldo na véspera de `de` |
| `entradas` / `saidas` | decimal | não | unidade do item, 4 | somas do período |
| `saldo_final` | decimal | não | unidade do item, 4 | saldo no fim de `ate` |
| `consumo_venda` | decimal | não | idem | saídas com origem `venda` |
| `consumo_producao` | decimal | não | idem | saídas com origem `producao` |
| `producao_entrada` | decimal | não | idem | entradas com origem `producao` |
| `compras` | decimal | não | idem | entradas com origem `nota` |
| `transferencias_recebidas` / `transferencias_enviadas` | decimal | não | idem | — |
| `ajuste_positivo` / `ajuste_negativo` | decimal | não | idem | vindos de contagem |
| `baixas_identificadas` | decimal | não | idem | saídas de qualquer outra origem |

**Aviso que a resposta carrega:** a equação **fecha por construção** — o
razão é a fonte do saldo, então ela não prova nada sozinha. O que prova
divergência é a contagem física, em `/inventarios`. Este caminho serve
para **abrir** o movimento do período por natureza, não para pegar erro.

---

## 3. Consolidados (v1) — campos

Não mudaram na v2.0 e continuam sem envelope, para não quebrar quem já lê.

| caminho | campos |
|---|---|
| `/lojas` | `ref_local`, `nome`, `cidade`, `uf`, `matriz`, `ativa` |
| `/faturamento` | topo: `total`, `pedidos`, `ticket_medio`; `dias[]`: `dia`, `pedidos`, `total`, `ticket`, `desconto`, `taxa_entrega` — **cancelado fora** |
| `/produtos` | `produto`, `quantidade`, `total` (parâmetro `limite`, padrão 50, máx. 500) |
| `/pagamentos` | `forma`, `quantidade`, `total` — cancelado fora |
| `/estoque` | topo: `itens`, `valor_total_em_estoque`, `abaixo_do_minimo`, `filtro`; `estoque[]`: `unidade_loja`, `item`, `unidade`, `saldo`, `custo_medio`, `valor`, `minimo`, `abaixo_do_minimo`. **Fotografia de agora — ignora `de`/`ate`**; `abaixo=1` filtra a lista, e os totais do topo continuam sendo do conjunto inteiro |
| `/financeiro` | topo: `a_pagar{em_aberto,pago}`, `a_receber{em_aberto,recebido}`; `lancamentos[]`: `tipo`, `categoria`, `situacao`, `quantidade`, `total`. Filtra por **vencimento** |
| `/producao` | `dia`, `numero`, `situacao`, `previsto`, `produzido`, `diferenca` |
| `/contagens` | `dia`, `retroativa`, `itens_conferidos`, `sobra`, `perda` (positiva), `resultado` |
| `/resumo` | venda + estoque + financeiro + produção + contagens numa resposta só |

---

## 4. Como as pontas se ligam

| de | para | pela chave |
|---|---|---|
| `/itens` | `/pedidos` | `pedido_ref` |
| `/pagamentos-analitico` | `/pedidos` | `pedido_ref` |
| `/extrato` | `/titulos` | `titulo_ref` |
| `/inventarios` | `/movimentacoes` | `movimento_ref` |
| `/producao-analitico` | `/movimentacoes` | `movimento_ref` |
| `/titulos` | `/plano-de-contas` | `categoria` + `subcategoria` |
| `/movimentacoes`, `/reconciliacao/estoque` | `/fichas` | `item_ref` = `ficha_ref` quando o item é ficha estocável |
| tudo | `/lojas` | `unidade` = `ref_local` |

Conferências que fecham por construção (e servem de teste de fumaça):

- `soma(/pedidos.valor_liquido onde não cancelado)` = `/faturamento.total`
- `soma(/pagamentos-analitico.valor onde não cancelado)` = `/pagamentos`
- `/reconciliacao/estoque`: `saldo_inicial + entradas − saidas = saldo_final`
- `/inventarios.diferenca × custo` = `/inventarios.valor_ajuste`, e a soma
  por contagem bate com `sobra`/`perda` de `/contagens`

---

## 5. O que esta API **não** responde — e por quê

Repetido aqui de propósito, para não haver surpresa na homologação:

1. **CPV histórico confiável** — a ficha não tem vigência; o CPV precisa
   ser congelado na venda (decisão 2 do diagnóstico).
2. **Alteração retroativa** — não há `atualizado_em` na maioria das
   tabelas; não dá para detectar quem mudou o quê depois (Etapa 2).
3. **Cortesia** — não é classificação própria hoje (decisão 1).
4. **Competência e centro de resultado** — não existem no cadastro
   (decisões 3 e 5).
5. **Adquirente por transação** — o Joia não fala com a maquininha:
   bandeira e taxa saem do cadastro, e a data de recebimento é previsão.
6. **Patrimônio** (imobilizado, depreciação, empréstimos, folha) — não é
   assunto do Joia hoje; balanço gerencial não é possível (decisão 7).

O contrato formal está em `api-joia.openapi.yaml`. O que falta, por que
falta e o que precisa da decisão de vocês está em
`DIAGNOSTICO_API_AUDITORIA_RDS.md`.

---

## 6. Etapa 2 — versão 2.1 (23/09/2026)

Tudo abaixo é leitura, com a mesma chave, o mesmo envelope e os mesmos
erros das seções anteriores. A chave presa a uma unidade continua presa:
provado em 23/09/2026 que a chave de Alphaville, pedindo Santa Fé, recebe
só Alphaville também nos caminhos novos.

### 6.1 `GET /cadastros` e `GET /cadastros/{tipo}`

A extração dos cadastros que a RDS pediu, inteiros, sem paginação.
Resposta: `{ cadastro, registros, avisos, dados: [...] }`.

| tipo | o que traz |
|---|---|
| `unidades` | código, nome, razão social, CNPJ, cidade, UF, fuso (declarado: São Paulo, fixo do sistema), matriz, ativa, caixas cadastrados e abertos, aparelhos, último sinal, última venda recebida |
| `usuarios` | login, nome, cargo, ativo, acesso total, unidades autorizadas, telas liberadas e `pode.{vender, baixar_estoque, ajustar_estoque, contar_estoque, produzir, fechar_caixa, lancar_financeiro, editar_ficha}` — **derivado das telas**, porque o Joia controla por tela. Senha nunca sai |
| `itens` | insumos, embalagens, fichas, subfichas, produtos acabados e produtos vendidos: id, código, nome, `tipo`, unidade de estoque, fator, custo atual, controla estoque, vínculo produto→ficha/insumo, ativo |
| `unidades-medida` | o que houver cadastrado — hoje vazio: as conversões kg/g e L/mL estão no código |
| `motivos` | nome, tipo, do sistema, ativo, **quantas vezes foi usado** e último uso; `classe` vem nula até a classificação |
| `formas-pagamento` | nome, tipo, bandeira, taxa %, taxa fixa, prazo, conta de destino, ativa, unidades |
| `contas` | nome, tipo, banco, agência, número, saldo inicial, unidades |
| `fornecedores` | nome, CNPJ, contato, unidades, quantos lançamentos tem e `possivel_duplicado_de` (mesmo CNPJ ou mesmo nome sem acento e pontuação) |

### 6.2 `GET /saude-sincronizacao`

Parâmetros `de` e `ate` (o período das contagens de venda). Traz:

**`unidades[]`** — uma linha por unidade:

| campo | o que é |
|---|---|
| `vendas_no_periodo` | vendas não canceladas |
| `vendas_sem_pagamento` | venda com total > 0 sem nenhum pagamento |
| `vendas_com_pagamento_diferente_do_total` | soma dos pagamentos ≠ total (tolerância R$ 0,01) |
| `vendas_sem_caixa` | venda sem caixa vinculado |
| `vendas_sem_baixa_de_estoque` | venda sem movimento de estoque de venda (inclui produto sem ficha, que de fato não baixa) |
| `ultima_venda_recebida_em` · `ultimo_movimento_de_estoque_recebido_em` · `ultimo_lancamento_financeiro_recebido_em` | quando a nuvem recebeu o último de cada, UTC |
| `caixas_abertos` · `caixa_aberto_mais_antigo` | caixa esquecido aparece aqui |
| `aparelhos` · `aparelhos_com_sinal_nas_ultimas_24h` · `aparelhos_com_envio_pendente` | do sinal de aparelho |

**`aparelhos[]`** — um por aparelho: identificador, unidade, usuário,
versão do Joia, navegador, primeiro e último sinal, último envio e último
download bem-sucedidos, último erro e se ficou envio pendente.

O sinal de aparelho sai do Joia a cada envio ou download que termina bem
(no máximo um a cada 2 minutos) e a cada erro de envio. **Ele começa a
chegar quando as lojas atualizarem para a versão que o envia.**

### 6.3 `GET /alteracoes?desde=AAAA-MM-DDTHH:MM:SSZ`

Paginado. O que foi **criado ou alterado** desde o instante pedido, em 28
tabelas: `tabela`, `ref`, `unidade`, `alterado_em`. Serve para
sincronização incremental e para detectar alteração retroativa.

- O carimbo `alterado_em` é gerido **só pelo banco**, em toda gravação.
- Regravação sem mudança real **não** mexe no carimbo.
- Começou em 23/09/2026: linha antiga que nunca mais foi mexida tem o
  carimbo nulo e não aparece aqui.

### 6.4 `GET /historico?de=&ate=&tabela=`

Paginado. **Quem mudou o quê**, com o antes e o depois **só dos campos
alterados**: `quando`, `usuario`, `tabela`, `operacao` (INSERT, UPDATE,
DELETE), `ref`, `unidade`, `campos_alterados`, `antes`, `depois`.

- Vem do registro de auditoria do banco, que já cobria 30 tabelas de
  operação e passou a cobrir **ficha técnica, ingredientes, insumos e
  produtos** em 23/09/2026.
- Só tabelas de negócio; senhas e chaves nunca entram no registro.
- `usuario` é a conta logada no aparelho. **As lojas usam uma conta por
  unidade**, então ele identifica a unidade, não a pessoa.
- Exemplo real que este caminho já mostra: as taxas de cartão de Santa Fé
  voltando ao valor de fábrica em 09/09 às 16:19 (ver
  `CADASTROS_DIAGNOSTICO.md`, seção 0).


## 7. Versão 2.2 (24/09/2026) — pendências, limite e dados pessoais

### 7.1 `/pendencias` e `/pendencias/{tipo}`

Relação nominal do que falta limpar antes da data de corte. Só leitura:
nenhum registro é classificado ou corrigido pela API. Sem paginação (as
listas são pequenas). Aceita `loja=`.

| tipo | critério | campos principais |
|---|---|---|
| `lancamentos-sem-categoria` | sem subcategoria **e** sem categoria em texto, não cancelado | identificador, tipo, descrição, documento, fornecedor, fornecedor_cnpj, emissão, vencimento, pagamento, pago, conciliado, valor, unidade, conta, forma_pagamento, **origem** (`manual`, `nota-entrada`, `cancelamento`…), criado_em, alterado_em, **usuario** |
| `insumos-sem-custo` | `custo` zero ou vazio | identificador, código, descrição, unidade_medida, fator, controla_estoque, compoe_cmv, custo, **custo_ultima_compra**, **saldo_atual** por unidade, **fichas_que_usam**, produtos_que_usam_direto, **ultima_compra** |
| `produtos-sem-vinculo` | ativo, sem ficha e sem insumo | identificador, código, descrição, preço, baixa_estoque, **vendas** (quantidade, faturamento, pedidos, primeira e última venda, dias com venda) |
| `motivos-sem-classe` | todos (o campo classe ainda não existe) | identificador, nome, direção, do_sistema, ativo, **usos**, último uso |

### 7.2 Limite de chamadas

Cada chave tem `limite_por_minuto` (padrão 120). Passou dele, a resposta é
**429** com `limite_por_minuto` e `libera_em`. O uso (`usos`,
`ultimo_uso`) e as recusas são contados no banco numa só gravação.

### 7.3 Dados pessoais

Nas chaves com máscara (padrão), os campos de **cliente** saem reduzidos:

| campo | como sai |
|---|---|
| `cliente`, `cliente_nome`, `comanda`, `comanda_nome` | iniciais (`Maria da Silva` → `M. D. S.`) |
| `cliente_tel`, `telefone`, `celular`, `whatsapp` | `•••` + 4 últimos dígitos |
| `cpf`, `cliente_cpf` | `•••` + 2 últimos dígitos |
| `endereco` | `(omitido)` |

Operador de caixa e conta da unidade **não** são mascarados: são o "quem
fez" da auditoria.

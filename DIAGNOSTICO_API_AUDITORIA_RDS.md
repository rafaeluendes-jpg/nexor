# Joia — API de auditoria gerencial (RDS)
## Diagnóstico do que existe, do que falta e do que precisa de decisão

Documento de resposta à especificação "AMPLIAÇÃO DA API DE LEITURA PARA
AUDITORIA GERENCIAL RDS". Levantamento feito direto no código e no banco de
produção em 22/09/2026, sem alterar nada.

**Veredito curto:** o pedido faz sentido e é o caminho certo. A maior parte
do que a RDS quer **já está gravada** no Joia e só não está exposta — isso
se resolve na API, sem tocar na operação das lojas. Três coisas, porém,
**não existem** hoje e nenhuma API inventa: ficha técnica com vigência,
CPV congelado na venda e carimbo de alteração (`updated_at`). Sem elas, a
auditoria histórica recalcula o passado com a receita de hoje.

---

## 1. Arquitetura atual, em uma página

- **Banco:** Supabase (Postgres), projeto `cevghkndzpzvnzwifhnm`. Uma rede
  (`loja_id`) com quatro unidades (`sucursal_id`): Matriz, Santa Fé do Sul,
  Alphaville e Jales.
- **ERP:** aplicação de página única que opera **offline-first**. Cada
  aparelho guarda tudo localmente e sincroniza; o banco é o ponto de
  encontro, não a fonte única em tempo real.
- **API atual:** função de borda `joia-api`, sem JWT, autenticada por chave
  própria (`api_chaves`, guardando só o sha-256). Ela chama funções SQL
  `api_*` marcadas `security definer`, revogadas para `anon` e
  `authenticated`. Só GET; qualquer outro método responde 405.
- **Chave:** presa a uma rede e, opcionalmente, a uma unidade. Quando a
  chave tem unidade, o parâmetro `loja` **não** a tira de lá.

### Onde cada assunto mora

| assunto | tabela | observação |
|---|---|---|
| venda | `pedidos` | cabeçalho; `fase` = entregue/cancelado |
| itens | `pedido_itens` | `opcoes` em JSON traz adicionais com preço e ficha |
| pagamentos | `pedido_pagamentos` | taxa e prazo moram em `formas_pagamento` |
| cancelamento | `cancelamentos` | motivo, operador, hora, se o estoque voltou |
| caixa | `caixas` + `caixa_movimentos` | conferência e fotografia do fechamento |
| estoque | `movimentacoes_estoque` (razão) + `estoque_unidade` (saldo) | linhas em JSON |
| contagem | `contagens_estoque` | sistema × contado × diferença, por item |
| produção | `ordens_producao` | previsto × real por item |
| receita | `fichas_tecnicas` + `ficha_itens` | **sem vigência** |
| financeiro | `lancamentos_financeiros` | emissão, vencimento, pagamento |
| plano de contas | `categorias_financeiras` + `subcategorias_financeiras` | dois níveis |
| bancos e caixas | `contas_capital` | saldo inicial por conta |

---

## 2. Requisito × situação atual

### 2.1 Atendido hoje

| requisito | onde |
|---|---|
| somente leitura, só GET | `joia-api` responde 405 a qualquer outro método |
| autenticação por chave, com hash | `api_chaves.chave_hash` (sha-256) |
| revogação e registro de uso | `ativa`, `ultimo_uso`, `usos` |
| restrição por rede | a chave carrega `loja_id` |
| restrição opcional por unidade | `sucursal_id` na chave vence o parâmetro |
| funções SQL fora do alcance das chaves públicas | `revoke` para `anon`/`authenticated` |
| fuso da loja no corte do dia | venda das 23h é do dia dela |
| cancelado fora do faturamento | `fase <> 'cancelado'` |
| consolidados de venda, estoque, financeiro, produção e contagem | `/faturamento`, `/produtos`, `/pagamentos`, `/estoque`, `/financeiro`, `/producao`, `/contagens`, `/resumo` |

### 2.2 Parcialmente atendido — o dado existe, falta expor (ou calcular)

| requisito | o que já existe | o que falta |
|---|---|---|
| pedidos analíticos | número, tipo, canal, fase, cliente, caixa, total, taxa, desconto, cupom, taxa de serviço, data/hora, operador (via caixa), `criado_em` | expor linha a linha; separar bruto de líquido; juntar o cancelamento (mora em `cancelamentos`); **não há `updated_at`** |
| itens do pedido | nome, quantidade, unitário, total, adicionais (nome, preço, ficha), observação | desconto por item, cortesia, cancelamento do item, ficha usada, CPV — nada disso é gravado |
| pagamentos | forma, valor, equipamento; e no cadastro da forma: `taxa_pct`, `taxa_fixa`, `dias_recebimento`, bandeira | expor; calcular líquido e data prevista; **não há** data efetiva do recebimento nem estorno por transação |
| movimentações de estoque | data, hora, motivo, origem, item, quantidade, unidade, custo, direção, documento, unidade da loja | identificador por linha, saldo anterior/posterior, `updated_at`; e a separação "baixa identificada × ajuste" depende de classificar os motivos |
| contagens | por item: sistema, contado, diferença, custo, valor; ajuste positivo e negativo já somados em separado (`ganho`/`perda`); retroativa; movimento gerado | justificativa por item; aprovação/fechamento formal |
| produção | por item: previsto, real, diferença, ficha, unidade, destino; movimento de estoque ligado | insumos previstos × efetivamente baixados, item a item; perda da produção separada |
| contas a pagar/receber | emissão, vencimento, pagamento, valor, juros, multa, valor original, pago, conciliado, fornecedor, categoria, documento, origem, cancelado | **competência** (hoje só existe emissão), centro de resultado, saldo e pagamento parcial, parcelamento explícito (hoje é "(1/3)" dentro do texto) |
| movimentações financeiras | `caixa_movimentos` (sangria, suprimento, transferência, com conta de destino) e os lançamentos pagos | um extrato único por conta, com saldo anterior/posterior; a transferência já é identificável e **não** é tratada como receita |
| plano de contas | categoria › subcategoria, com tipo receita/despesa | código, natureza, nível, posição na DRE, vigência, histórico |

### 2.3 Não atendido — o dado não existe

| requisito | consequência |
|---|---|
| **ficha técnica com vigência** | não há como saber qual receita valia na data da venda; recalcular o passado usa a ficha de hoje |
| **CPV teórico gravado na venda** | idem: o CPV histórico muda quando alguém corrige uma ficha |
| **`updated_at` na maioria das tabelas** | não dá para detectar alteração retroativa nem fazer sincronização incremental confiável |
| saldo anterior/posterior por movimento | a reconciliação de estoque tem de ser refeita somando tudo |
| cortesia como classificação própria | hoje a cortesia não se distingue de desconto ou de baixa |
| competência separada do vencimento | DRE por competência e fluxo por movimentação se confundem |
| centro de resultado | não existe no cadastro |
| patrimônio: imobilizado, depreciação, capital, empréstimos, aportes, retiradas, tributos a recolher, folha | balanço patrimonial gerencial **não** é possível hoje |

### 2.4 Não aplicável / depende de terceiro

- **Adquirente e bandeira por transação:** o Joia não conversa com a
  maquininha. A bandeira existe no cadastro da forma de pagamento, não na
  venda. Só muda com integração de adquirente.
- **Data efetiva de recebimento de cartão:** idem — hoje só dá para
  projetar pela regra de dias do cadastro.
- **Ambiente de homologação:** existe um projeto só. Um segundo ambiente é
  decisão de custo.

---

## 3. Perguntas que precisam de decisão (Rafael / Ricardo-RDS)

1. **Cortesia** — como a loja registra hoje? Vai virar um motivo próprio de
   movimentação, uma marca no item da venda, ou as duas coisas?
2. **Ficha técnica** — prefere (a) **congelar** o CPV e a receita no momento
   da venda, ou (b) **versionar** o cadastro com vigência? Recomendo (a):
   resolve o histórico dali para frente, é muito mais simples e não muda a
   rotina de quem mexe na ficha.
3. **Competência** — adotar a data de emissão como competência, ou criar um
   campo próprio na tela do lançamento?
4. **Motivos de movimentação** — preciso da lista atual classificada em
   "baixa identificada", "ajuste", "consumo", "entrada" e "transferência".
   Sem isso a API não separa perda de ajuste com honestidade.
5. **Centro de resultado** — existe na operação de vocês? Se sim, em que
   nível (unidade, turno, praça)?
6. **Índice de perdas** — confirmam perdas ÷ CPV teórico como indicador
   principal, com perdas ÷ receita líquida só como complemento?
7. **Patrimônio** — o que virá da contabilidade e o que vocês querem
   lançar dentro do Joia?

---

## 4. Plano por etapas

### Etapa 1 — só API, não encosta na operação *(risco baixo)*
Endpoints analíticos, paginados, sobre o que **já está gravado**:
`/pedidos`, `/itens`, `/pagamentos-analitico`, `/movimentacoes`,
`/inventarios`, `/producao-analitico`, `/titulos`, `/extrato`,
`/plano-de-contas`, `/fichas`, `/cpv-teorico` (calculado com a ficha atual,
**declarando isso na resposta**) e `/reconciliacao/estoque`.
Mais: paginação, ordenação determinística, filtros por data e por
identificador, versão da API, carimbo de geração, erros padronizados,
documentação e OpenAPI, e as provas de segregação entre redes e unidades.

*Nada aqui muda regra do Joia nem a rotina das lojas.*

### Etapa 2 — banco, sem mexer na regra *(risco baixo/médio)*
`atualizado_em` nas tabelas que a auditoria precisa vigiar, com gatilho;
índices para as consultas novas. Não altera valor nenhum.

### Etapa 3 — mexe no Joia *(risco médio, passa pelo portão, com guardião)*
Gravar na venda a ficha usada e o CPV teórico do item; cortesia como
classificação própria; competência no lançamento financeiro; classificação
dos motivos de movimentação. **Só depois das respostas da seção 3.**

### Etapa 4 — reconciliações fechadas e dashboards
Só depois que os números estiverem homologados.

---

## 5. Riscos

- **Etapa 1 é segura.** É leitura de dado que já existe; se algo sair
  errado, sai errado num relatório, não no caixa da loja.
- **Etapa 3 é a que exige cuidado:** toca o PDV e o financeiro, que operam
  todo dia em seis lojas. Entra pelo portão de publicação, com teste-guardião
  próprio, como toda alteração deste sistema.
- **O risco de não fazer a Etapa 3** é a auditoria homologar números que
  mudam sozinhos quando alguém corrige uma ficha técnica antiga.
- **Não inventar:** enquanto o CPV histórico for calculado com a ficha de
  hoje, a resposta da API vai dizer isso, em campo próprio. Número com
  ressalva é melhor do que número bonito e errado.

# Joia — API analítica RDS v3 (somente leitura)

Resposta ao pedido da RDS de 30/09/2026, "API analítica RDS multiunidades,
somente leitura". Este documento traz o plano, o inventário (o que já
existia, o que foi acrescentado, o que o Joia não tem), as regras de
cálculo e o roteiro de homologação das 20 perguntas.

> **Situação em 30/09/2026:** no ar. Funções aplicadas no banco com ordem
> do Rafael ("pode aplicar"), função `joia-rds` publicada, chave "RDS
> Inteligência e Gestão" criada e as 20 perguntas homologadas com dado
> real (`RDS_API_V3_HOMOLOGACAO.md`). Contrato: `api-joia-rds.openapi.json`.
> Exemplos: `RDS_API_V3_EXEMPLOS.md`.

## 1. Plano de implementação

| etapa | o que é | estado |
|---|---|---|
| 1 | Base: identidade da unidade, escopo, sincronização, regras de classificação, paginação (`rds_*` parte 1) | aplicada |
| 2 | Extração registro a registro: vendas, itens, pagamentos, estoque, razão, inventários, compras, fichas, produções, caixas (parte 2) | aplicada |
| 3 | Financeiro e análises: títulos, extrato, cadastros, CPV e perdas, DRE, fluxo de caixa, clientes (parte 3) | aplicada |
| 4 | Agregações e a porta única `rds_consulta`: faturamento, produtos, curva ABC, custos, CRM, comparativo, pendências (parte 4) | aplicada |
| 5 | Função de borda `joia-rds` (GET, chave, limite, máscara) | publicada (versão 1) |
| 6 | Chave exclusiva "RDS Inteligência e Gestão" (rede Jolô, sem unidade fixa) | criada (prefixo `joia_rdsg_425874`) |
| 7 | Homologação: as 20 perguntas, com evidência | feita — `RDS_API_V3_HOMOLOGACAO.md` |
| 8 | OpenAPI e arquivo de exemplos | `api-joia-rds.openapi.json`, `RDS_API_V3_EXEMPLOS.md` |

**Limites reais que a homologação mostrou:** só Santa Fé vende pelo Joia
hoje, então as comparações entre unidades mostram as outras com zero; a
Matriz aparece offline (aparelho sem sinal desde 29/09), o que deixa
`dado_completo=false` nas consultas da rede; 37 das 38 notas de entrada
não gravaram a unidade (a API lê a unidade do movimento da nota e diz
isso em `unidade_origem`); cerca de 6% do CPV teórico de setembro vem de
adicionais sem vínculo com um item e fica só no total da venda, não no
item. A chamada HTTP ponta a ponta não pôde ser feita deste ambiente (a
rede dele bloqueia o endereço do Supabase).

**Por que "homologação" é um endereço novo e não um banco novo.** O Joia
tem um único banco, o de produção, e a RDS precisa de dado real ("expor
dados reais, sem simulação"). A v3 é publicada num endereço próprio
(`/functions/v1/joia-rds`), separado da API v2.4 (`/functions/v1/joia-api`),
que continua funcionando igual. Homologar a v3 não mexe em nada da v2.4.

## 2. Por que ela é comprovadamente somente leitura

1. A função de borda recusa tudo que não for `GET` (405).
2. Ela chama o banco por `GET` — e o PostgREST executa `GET` numa
   transação **READ ONLY**: o próprio Postgres recusa qualquer gravação.
3. Toda função `rds_*` é `STABLE`: o Postgres não deixa `INSERT`,
   `UPDATE` ou `DELETE` rodar dentro dela.
4. Nenhuma função `rds_*` é alcançável pela chave pública do aplicativo
   (`anon`/`authenticated` revogados): só a função de borda, com a chave
   da RDS.
5. A única gravação do caminho é o **registro de uso da chave**
   (`api_chave_uso`: contagem, último uso, limite por minuto), exigido
   pelo próprio pedido, e só na tabela `api_chaves`.

Nada é classificado, corrigido, inativado ou excluído. Inconsistência é
sinalizada em `/pendencias/{tipo}` e some da lista quando alguém corrige
no Joia.

## 3. Unidade em todo registro, e nenhuma mistura silenciosa

- Todo registro traz: `rede_id`, `rede_nome`, `empresa_id`,
  `empresa_nome`, `loja_id`, `loja_nome`, `sucursal_id`, `sucursal_nome`,
  `tipo_unidade` (matriz | loja | rede), `cnpj`, `cidade`, `uf`,
  `situacao_unidade`, `data_abertura` (não disponível — vai
  `cadastrada_no_joia_em`) e `fuso`.
- No Joia, a **rede** é o cadastro "Jolô Gelato"; a loja física é a
  **sucursal**. `loja_id` é o identificador interno da loja física e
  `sucursal_id` (suc_...) é a referência usada nos filtros.
- **Consulta de dado sem unidade é recusada (400).** É preciso dizer
  `loja=suc_...`, `unidades=suc_a,suc_b` ou `rede=1`. Só cadastros
  compartilhados e a ajuda dispensam o filtro.
- Toda resposta declara `escopo` (unidade | unidades_selecionadas |
  rede_consolidada), `unidades_incluidas`, `unidades_excluidas` e a
  `sincronizacao` de cada unidade, aparelho por aparelho.
- Sucursal nova entra sozinha: a lista de unidades é lida do cadastro a
  cada chamada. A chave só enxerga a rede dela.

## 4. Resposta-padrão

`api_versao`, `regra_versao`, `extraido_em`, `rota`, `periodo`
(`de`, `ate`, `dias`), `fuso`, `moeda` (BRL), `precisao` (valores 2,
quantidades 4, custos 6), `escopo`, `filtros`, `unidades_incluidas`,
`unidades_excluidas`, `sincronizacao`, `dado_completo`, `avisos`
(unidade offline, pendência local, aparelho parado com pendência,
período parcialmente sincronizado), `paginacao` (`pagina`, `limite`,
`total_registros`, `total_paginas`, `nesta_pagina`),
`filtros_aplicados`, `filtros_que_nao_se_aplicam` e `dados`. Cada
registro traz `updated_at` e referências estáveis (`venda_ref`,
`item_venda_ref`, `pagamento_ref`, `caixa_ref`, `titulo_ref`,
`movimento_ref`, `produto_ref`, `insumo_ref`, `ficha_ref`,
`producao_ref`, `inventario_ref`, `cliente_ref`, `fornecedor_ref`).

`dado_completo = false` sempre que houver unidade offline (sem sinal há
mais de 6 h), aparelho com dado não enviado, ou aparelho parado há mais
de 7 dias com pendência. Nenhum painel deve apresentar como completo um
resultado com `dado_completo = false`.

## 5. Parâmetros

`de`, `ate` (AAAA-MM-DD; padrão: últimos 30 dias até hoje, no fuso da
unidade; máximo 400 dias por consulta), `loja`, `unidades`, `rede=1`,
`pagina`, `limite` (padrão 200, máximo 1000), `ordenar_por` (qualquer
campo do registro), `ordem` (asc|desc), `alterados_desde` (ISO-8601),
`situacao`, `categoria`, `produto` (ref ou nome exato), `grupo`,
`canal`, `forma_pagamento`, `operador`, `turno`. Filtro que não se aplica
ao tipo de registro é devolvido em `filtros_que_nao_se_aplicam` — nunca
ignorado em silêncio. Específicos: `agrupar=dia|mes` (/faturamento),
`nivel=produto|grupo` e `criterio=faturamento|quantidade|margem|pedidos`
(/analises/curva-abc), `detalhe=item|grupo|motivo|dia`
(/analises/cpv-perdas), `data=emissao|competencia|vencimento|pagamento`
(/analitico/titulos), `visao=diaria|semanal|mensal`
(/analises/fluxo-caixa), `tabela=` (/historico).

## 6. Catálogo

| grupo | caminhos |
|---|---|
| unidades | `/lojas` |
| cadastros | `/cadastros/produtos`, `/cadastros/plano-de-contas`, `/cadastros/contas-financeiras`, `/cadastros/formas-pagamento`, `/cadastros/fornecedores`, `/cadastros/motivos-estoque`, `/cadastros/pessoas`, `/jornadas` |
| vendas | `/faturamento`, `/analitico/vendas`, `/analitico/itens-venda`, `/produtos`, `/analises/curva-abc` |
| estoque | `/estoque`, `/analitico/movimentos-estoque`, `/analitico/inventarios`, `/analises/cpv-perdas` |
| compras | `/analitico/compras`, `/analitico/itens-compra`, `/analises/historico-custos` |
| produção | `/analitico/fichas`, `/analitico/producoes` |
| caixa | `/analitico/pagamentos`, `/analitico/caixas` |
| financeiro | `/analitico/titulos`, `/analitico/extrato-financeiro`, `/analises/dre`, `/analises/fluxo-caixa` |
| clientes | `/analitico/clientes`, `/analises/crm` |
| comparação | `/analises/comparativo-unidades` |
| metas | `/metas`, `/analises/realizado-versus-meta` |
| qualidade | `/pendencias`, `/pendencias/{tipo}` |
| sincronização | `/sincronizacao/unidades`, `/sincronizacao/aparelhos`, `/alteracoes`, `/historico` |

Tipos de pendência: `lancamentos-sem-categoria`, `insumos-sem-custo`,
`produtos-sem-vinculo`, `motivos-sem-classe`, `estoque-negativo`,
`fiscal-divergente`, `caixas-com-pendencia` e, novo na v3,
`titulos-movimentados-sem-conta` (pago ou recebido sem conta financeira).
Cada linha traz unidade, tipo da unidade, `registro_ref`, valor, data,
`possivel_impacto` e `onde_corrigir_no_joia`.

## 7. Regras de cálculo

**Plano de contas × conta financeira.** São cadastros diferentes e a API
não mistura: o plano de contas diz a natureza (royalties, pessoal…), a
conta financeira diz onde o dinheiro entrou ou saiu (Caixa, Itaú,
Cofre). Título em aberto sem conta financeira **não** é inconsistência.
Movimentado (pago ou recebido) sem plano de contas ou sem conta
financeira é, e aparece em `inconsistencias` e em `/pendencias`.

**Faturamento.** `faturamento_bruto` = valor dos itens das vendas
concretizadas; `descontos` = desconto + cupom; `acrescimos` = taxa de
serviço; `faturamento_liquido` = valor final pago das vendas
concretizadas; `cancelamentos` = valor das vendas canceladas, informado à
parte. `ticket_medio` = faturamento líquido ÷ pedidos.
`taxa_cartao_calculada` = valor × taxa do cadastro da forma de pagamento.

**CPV e perdas** (como a RDS definiu):
- `cpv_teorico` = consumo das vendas concretizadas pela ficha técnica, ao
  custo médio da hora da venda (as linhas "Pedido #N" do razão);
- `baixas` = saídas com motivo classificado perda ou descarte, mais o
  consumo de venda cancelada que já tinha sido produzida;
- `ajustes` = diferença de inventário (negativos e positivos à parte);
- `perdas_totais = baixas + ajustes_negativos`;
- `consumo_fisico_total = cpv_teorico + perdas_totais`;
- `indice_perdas = perdas_totais ÷ cpv_teorico`;
- `perdas_sobre_faturamento = perdas_totais ÷ receita_liquida`.
Compra de insumo não é CPV. Consumo interno e bonificação vão à parte.

**Classe do motivo de estoque.** O cadastro de motivo não tem classe. A
API a **deriva por regra** (da origem do movimento e, no lançamento
manual, do nome do motivo) e diz isso em `classificacao_origem`. Nada é
gravado no Joia.

**DRE gerencial** (competência: venda pelo dia comercial, lançamento pela
emissão; o Joia não tem campo de competência). Cada linha diz se é
**lançada** (com a lista de `lancamentos` que a formaram) ou
**calculada** (com a `formula`). Linhas: faturamento bruto, descontos,
cancelamentos, receita líquida, impostos, royalties, fundo de marketing,
taxas de cartão, CPV teórico, perdas, CPV real, margem bruta, despesas
variáveis, margem de contribuição, pessoal, ocupação, administrativas,
outras despesas, sem plano de contas, outras receitas operacionais,
EBITDA, depreciação (não disponível), resultado financeiro, resultado
líquido. Fora do resultado, listados à parte: compras de mercadoria,
investimento/imobilizado, empréstimos, aportes, retiradas, transferência
entre contas e os lançamentos "Frente de Caixa" (a venda já entra pela
receita). Venda de base entre unidades é receita da unidade e é
eliminada no consolidado da rede.

A ligação categoria → linha da DRE é uma **regra da API**, versionada em
`regra_versao`, e aparece em `/cadastros/plano-de-contas`
(`classificacao_gerencial`, `compoe_dre`).

**Fluxo de caixa.** Realizado = pago/recebido, pela data do pagamento;
previsto = em aberto, pelo vencimento; vencido e a vencer em relação a
hoje; visão diária, semanal ou mensal; por conta financeira; saldo
inicial, entradas, saídas, transferências, saldo final realizado e
projetado. Não usa competência.

**Curva ABC.** A = itens que somam até 80% do critério; B = até 95%; C =
o resto. Compara com o período anterior de mesmo tamanho.

**Comparativo.** A API entrega indicadores comparáveis, mesmo período e
mesmas regras. Não escolhe a melhor unidade: pesos e ranking são da RDS.

## 8. O que o Joia NÃO tem (e a API não inventa)

| pedido | situação |
|---|---|
| jornada, horas trabalhadas, produtividade por hora | não existe: `/jornadas` diz `disponivel: false` |
| pessoas atendidas por venda | não existe: nenhum indicador "per capita" é calculado |
| metas | não existem: `/metas` diz `disponivel: false` |
| versão histórica da ficha técnica | não existe: `ficha_versionada=false`, `calculo_historico_reprocessado_com_ficha_atual=true`. O CPV das vendas usa o custo gravado na hora da venda |
| data e hora de confirmação separada da do pedido | não existe: um só instante por venda |
| desconto por item, item cancelado durante o pedido | não gravados: alteração na montagem não vira venda, cancelamento, CPV nem estoque |
| devoluções | não existem como operação |
| venda de demonstração | não há marca de demonstração no pedido |
| impostos, royalties e fundo calculados por venda | não: valem os lançados no plano de contas |
| aprovação da adquirente, data efetiva de recebimento, parcelas | não há integração com maquininha |
| usuário que fez cada movimento de estoque | o movimento não guarda o usuário (o `/historico` guarda a conta logada) |
| competência do título | não existe: vale a emissão |
| vigência, código hierárquico e ativo/inativo do plano de contas | não existem |
| data do saldo inicial e ativo/inativo da conta financeira | não existem |
| depreciação e imobilizado | não existem |
| estoque médio histórico | não existe: o giro é aproximado (CPV ÷ estoque de hoje) e diz isso |
| lote e validade | existe o cadastro (`lotes_estoque`), ainda pouco usado |
| campanhas de CRM | não existem; o que existe é cupom de desconto no pedido |

## 9. Chave "RDS Inteligência e Gestão"

Rede Jolô, sem unidade fixa (futuras sucursais entram sozinhas),
somente leitura, dados pessoais mascarados, limite de 120 chamadas por
minuto, registro de uso e último uso, revogação e rotação
independentes. A chave é gerada uma vez; o banco guarda só o sha-256.
Ela vai ao Rafael por mensagem direta, nunca em documento ou código.
As chaves antigas ("RDS Auditoria", "RDS Inteligência Gerencial") não
são mexidas.

## 10. Homologação: as 20 perguntas

| # | pergunta | chamada |
|---|---|---|
| 1 | Copos P vendidos nos últimos 10 dias em Santa Fé | `/produtos?loja=suc_mt1unhbx2xrb&de=…&ate=…&produto=Copo P` |
| 2 | média diária de Copos P | mesma chamada, campo `media_diaria` |
| 3 | Copo P entre todas as unidades | `/analises/comparativo-unidades?rede=1&produto=Copo P` |
| 4 | produto classe A de cada unidade | `/analises/curva-abc?rede=1&agrupar=unidade` (campo `classe`) |
| 5 | produtos muito superiores numa unidade | `/produtos?rede=1&agrupar=unidade` (comparar `participacao_faturamento_pct`) |
| 6 | faturamento diário e mensal por unidade | `/faturamento?rede=1` e `/faturamento?rede=1&agrupar=mes` |
| 7 | maior crescimento | `/analises/comparativo-unidades?rede=1` (`crescimento_pct`) |
| 8 | ticket médio por unidade | `/analises/comparativo-unidades?rede=1` (`ticket_medio`) |
| 9 | CPV teórico por unidade | `/analises/cpv-perdas?rede=1` |
| 10 | índice de perdas por unidade | `/analises/cpv-perdas?rede=1` (`indice_perdas`) |
| 11 | margem de contribuição por unidade | `/analises/dre?rede=1` (linha `margem_contribuicao`) |
| 12 | estoque negativo em Santa Fé | `/pendencias/estoque-negativo?loja=suc_mt1unhbx2xrb` |
| 13 | insumos de Santa Fé sem custo | `/pendencias/insumos-sem-custo?loja=suc_mt1unhbx2xrb` |
| 14 | lançamentos de Santa Fé sem plano de contas | `/pendencias/lancamentos-sem-categoria?loja=suc_mt1unhbx2xrb` |
| 15 | produtos que vendem e não baixam estoque | `/pendencias/produtos-sem-vinculo?rede=1` |
| 16 | DRE de Santa Fé | `/analises/dre?loja=suc_mt1unhbx2xrb` |
| 17 | DRE consolidado da rede | `/analises/dre?rede=1` (bloco `escopo: rede consolidada`) |
| 18 | fluxo realizado e projetado | `/analises/fluxo-caixa?rede=1&visao=mensal` |
| 19 | contas a pagar dos próximos 7 dias | `/analitico/titulos?rede=1&data=vencimento&de=hoje&ate=hoje+7&situacao=em aberto` |
| 20 | unidades com pendência de caixa ou sincronização | `/pendencias/caixas-com-pendencia?rede=1` e `/sincronizacao/unidades?rede=1` |

As respostas reais de cada uma estão em `RDS_API_V3_HOMOLOGACAO.md`.

## 11. Versão e compatibilidade

- `api_versao` segue MAJOR.MINOR.PATCH. Campo novo = MINOR; campo que
  muda de significado ou sai = MAJOR, com a versão anterior mantida no ar
  por 90 dias.
- `regra_versao` (data) sobe quando uma regra de apuração muda de
  significado — dois relatórios com números diferentes são comparáveis
  pela regra que cada um usou.
- A v2.4 (`/joia-api`) continua no ar sem mudança.

## 12. Erros

| código | quando |
|---|---|
| 400 | data torta, `de` depois de `ate`, período acima de 400 dias, unidade desconhecida, consulta de dado sem `loja`/`unidades`/`rede=1` |
| 401 | sem chave, chave inválida ou desativada |
| 404 | caminho ou tipo de pendência que não existe |
| 405 | qualquer método que não seja GET |
| 429 | limite de chamadas por minuto (com `libera_em`) |
| 500 | falha ao ler o banco (a resposta diz o motivo) |

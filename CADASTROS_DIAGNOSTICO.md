# Joia — diagnóstico dos cadastros (cadastro mínimo da RDS)

Levantado direto no banco de produção em 23/09/2026, rede Jolô.
Tudo o que está aqui pode ser conferido pela API:
`/cadastros/{unidades|usuarios|itens|unidades-medida|motivos|formas-pagamento|contas|fornecedores}`.

Legenda: **✓ existe** · **◐ parcial** · **✗ não existe**

---

## 0. O achado mais importante — e urgente

**As taxas de cartão de Santa Fé voltaram sozinhas ao valor de fábrica, três
vezes.** O registro de auditoria do banco mostra:

| quando | quem gravou | o que aconteceu |
|---|---|---|
| 02/09 12:18 | aparelho de Santa Fé | débito 0,73% → 1,99% · crédito 2,73% → 3,49% · conta de destino apagada |
| 02/09 20:21 | ajuste | voltou para 0,73% / 2,73% |
| 03/09 17:05 | aparelho de Santa Fé | de novo para 1,99% / 3,49% |
| 03/09 18:03 | ajuste | voltou para 0,73% / 2,73% |
| **09/09 16:19** | **aparelho de Santa Fé** | **de novo para 1,99% / 3,49%, e Pix, débito e crédito perderam a conta de destino** |

Desde 09/09 ninguém repôs. Hoje o cadastro está em **débito 1,99%, crédito
3,49% em 30 dias, sem conta de destino** — os valores de fábrica.
Consequência: a taxa de cartão calculada nas vendas e a previsão de
recebimento (`/pagamentos-analitico`) estão erradas desde 09/09, e o
dinheiro das vendas em cartão e Pix não aponta para conta nenhuma.

As correções de 01 a 04/09 (V282, V290, V305) não impediram a reversão de
09/09. A causa exata não dá para cravar só com o banco: pode ter sido um
aparelho rodando uma versão antiga guardada no navegador. **É exatamente
isso que o sinal de aparelho, criado hoje, passa a mostrar** — qual
aparelho, em que versão.

**Precisa do Rafael:** confirmar as taxas de hoje (as mesmas 0,73% / 2,73% /
1 dia?) e a conta onde o cartão e o Pix caem. Com a confirmação, a
restauração é feita na hora e a causa é investigada como defeito.

---

## 1. Unidades e estrutura operacional

| item pedido | situação | observação |
|---|---|---|
| código único | ✓ | `suc_…` |
| CNPJ | ◐ | só Santa Fé tem (50.058.498/0001-11). Matriz, Jales e Alphaville sem CNPJ |
| cidade e fuso | ◐ | Matriz e Alphaville sem cidade/UF; o fuso não é cadastrado — o sistema inteiro usa São Paulo |
| matriz ou franquia | ✓ | campo `matriz` |
| ativa/inativa | ✓ | as 4 ativas |
| caixas vinculados | ✓ | tabela de caixas por unidade |
| dispositivos vinculados | ✓ **novo** | sinal de aparelho criado hoje; começa a chegar na próxima versão |
| última sincronização | ✓ **novo** | por unidade (último registro recebido) e por aparelho |

**Achados:**
- **Só Santa Fé opera no Joia.** Jales e Alphaville não têm venda,
  movimento de estoque nem lançamento na nuvem. A comparação com Jales que
  a RDS quer fazer **não tem dado do Joia**.
- **Alphaville tem um caixa aberto desde 27/08**, esquecido.
- A Matriz teve vendas até 19/08 (período de implantação/teste).

---

## 2. Usuários e permissões

| item | situação | observação |
|---|---|---|
| usuário, função, unidade autorizada | ✓ | 8 cadastros: 5 ativos, 3 inativos |
| perfil de acesso | ✓ | acesso total ou lista de telas |
| quem pode vender, cancelar, baixar, ajustar, contar, fechar | ◐ | o Joia libera **por tela, não por ação**. A API deriva a ação da tela (`pode.vender`, `pode.baixar_estoque`…). Cancelar no caixa exige senha de gerente, cadastrada à parte |
| responsável por cada operação | ◐ | o banco registra **qual conta** gravou cada alteração (`/historico`), mas as lojas usam **uma conta por unidade** (`santafe@…`). O responsável aparece como "a unidade", não como a pessoa. Só o caixa tem operador individual |

**Recomendação:** para a auditoria, cada pessoa precisa entrar com login
próprio — ou o operador do caixa passa a ser gravado em toda operação
(está no desenho da Etapa 3, seção 7).

---

## 3. Produtos, insumos e unidades de medida

| item | situação | observação |
|---|---|---|
| identificador único | ✓ | |
| descrição padronizada | ✓ | nenhum insumo com nome repetido |
| tipo (vendido, insumo, embalagem, subficha, acabado) | ◐ | a API deriva: 293 insumos, 146 fichas, 44 produtos vendidos. "Embalagem" não é marcada de forma confiável |
| unidade de estoque | ✓ | kg 140 · un 147 · L 5 · g 1 |
| unidade de compra / de consumo | ✗ | não são campos próprios; existe unidade de estoque + fator |
| fator de conversão | ◐ | **as conversões kg↔g e L↔mL estão no código**, não em cadastro (a tabela de unidades de medida está vazia). São fixas e inequívocas; caixa/pacote depende do fator de cada insumo |
| custo atual | ◐ | **56 insumos sem custo** (19%) |
| controla estoque | ✓ | |
| ativo/inativo | ◐ | produto tem; **insumo não tem** |

**Produtos:** 31 ativos; **2 ativos sem ficha nem insumo** (vendem sem
baixar nada) e 1 ativo marcado para não baixar estoque.

**Ingredientes com unidade diferente da do insumo:** 386 linhas de ficha
usam grama num insumo guardado em quilo (ou mL em litro). O sistema
converte na baixa desde 31/08 — não é erro, mas a RDS deve saber que a
conversão acontece.

---

## 4. Fichas técnicas

| item | situação | observação |
|---|---|---|
| ingredientes, quantidades, unidades | ✓ | 146 fichas, **todas** com ingrediente e rendimento |
| rendimento | ✓ | |
| perdas técnicas previstas | ✓ | campo `perda` por ingrediente |
| subfichas | ✓ | |
| custo calculado | ✓ | custo de **hoje** |
| responsável e data da alteração | ✓ **novo** | ligado hoje: toda alteração de ficha, ingrediente, insumo ou produto grava antes, depois, quem e quando (`/historico`) |
| motivo da alteração | ✗ | depende de campo na tela — Etapa 3, seção 6 |
| vigência / versão | ✗ | Etapa 3, seção 2 (CPV congelado na venda) |

---

## 5. Motivos de movimentação de estoque

13 motivos cadastrados, **nenhum com classe**. Proposta de classificação
para o Rafael e o Raylan confirmarem:

| motivo atual | usos | classe sugerida | confirmar? |
|---|---|---|---|
| Venda PDV | 1.757 | consumo por venda | — |
| Entrada por nota fiscal | 27 | compra/entrada | — |
| Produzir | 26 | produção/entrada (o que nasce) · consumo por produção (o que sai) | — |
| Perda de produção | 10 | **baixa identificada — erro de produção** | ✔ confirmar |
| Ganho de produção | 9 | **ajuste positivo** | ✔ confirmar |
| Contagem de estoque | 2 | ajuste positivo / ajuste negativo (pelo sinal) | — |
| Entrada manual | 1 | entrada avulsa | — |
| Perda / quebra | 1 | **baixa identificada — avaria/queda** | ✔ confirmar |
| Consumo Balcão | 0 | **baixa identificada — consumo interno** | ✔ confirmar |
| Saída manual | 0 | saída avulsa | — |
| Transferência enviada | 0 | transferência enviada | — |
| Transferência recebida | 0 | transferência recebida | — |
| Venda de base para unidade | 0 | **transferência enviada** (matriz → unidade) | ✔ confirmar |

**Faltam** os motivos padronizados de baixa identificada: vencimento,
avaria, queda, erro de produção, desperdício, consumo interno, degustação,
outro (com justificativa). Entram na Etapa 3 **sem sobrescrever** nenhum
motivo que a loja já tenha.

**Degustação** fica como baixa identificada; **cortesia** não é motivo de
estoque — vai na venda (Etapa 3, seção 3), como a RDS definiu.

---

## 6. Formas de pagamento

| item | situação | observação |
|---|---|---|
| dinheiro, Pix, débito, crédito, voucher | ✓ | 5 formas |
| crédito por bandeira/prazo | ✗ | **uma forma de crédito só**, com bandeira "Mastercard". Visa, Elo etc. e parcelado não são separados |
| delivery / outras | ◐ | marcação "online"; sem forma própria de delivery |
| taxa percentual e fixa | ✓ | **mas em valor de fábrica — ver seção 0** |
| prazo de recebimento | ✓ | débito 1 dia, crédito 30, voucher 30 |
| equipamento ou adquirente | ◐ | informado na venda, não no cadastro da forma |
| conta de destino | ◐ | **só o Dinheiro tem**. Pix, débito e crédito perderam a conta em 09/09 |

---

## 7. Plano de contas gerencial

| item | situação | observação |
|---|---|---|
| categorias e subcategorias | ✓ | 14 categorias, 158 subcategorias |
| mapeamento para a DRE RDS | ✗ | fica na camada RDS, como definido; a extração está em `/plano-de-contas` |

**Achado de qualidade:** dos 202 lançamentos financeiros,

- **10** estão ligados a uma subcategoria;
- **120** são gerados pelo sistema e só têm um nome de categoria em texto
  ("Frente de Caixa", "Pedido de base", "Transferência");
- **72 não têm categoria nenhuma.**

Os 72 são a limpeza mais urgente para a DRE: sem categoria, eles não entram
em rubrica nenhuma.

---

## 8. Contas financeiras

| item | situação | observação |
|---|---|---|
| caixa, bancos, contas digitais | ◐ | 3 contas genéricas: "Caixa da loja", "Cofre", "Banco — conta corrente" |
| saldo inicial na data de corte | ✗ | todos **R$ 0,00** e **sem data** — o campo de data não existe |
| unidade proprietária | ✗ | nenhuma conta ligada a unidade |
| ativa/inativa | ✗ | não existe |

**Precisa do Rafael:** as contas reais de cada unidade (banco e conta
digital) e o saldo de cada uma na data de corte.

---

## 9. Fornecedores

| item | situação | observação |
|---|---|---|
| identificador, nome | ✓ | 53 |
| CNPJ/CPF | ✓ | **todos** com CNPJ |
| duplicados | ✓ | **nenhum** por nome nem por CNPJ |
| categoria principal | ✗ | não existe |
| unidade | ✓ | |
| ativo/inativo | ✗ | não existe |

É o cadastro mais saudável da rede.

---

## 10. Datas mínimas do lançamento financeiro

| data | situação |
|---|---|
| emissão | ✓ — todos os 202 têm |
| **competência** | ✗ — Etapa 3, seção 4 |
| vencimento | ✓ |
| movimentação / pagamento | ✓ |
| criação | ✓ |
| última alteração | ✓ **novo** — `alterado_em` desde 23/09/2026 |

---

## 11. Limpeza cadastral recomendada, em ordem

1. **Repor taxas e contas de destino das formas de pagamento** (seção 0).
2. **Categorizar os 72 lançamentos sem categoria** (seção 7).
3. **Fechar o caixa esquecido de Alphaville** (aberto desde 27/08).
4. **Dar custo aos 56 insumos sem custo** — sem custo, o CPV sai subestimado.
5. **Ligar os 2 produtos ativos sem ficha** (ou desativá-los).
6. **Completar CNPJ e cidade** de Matriz, Jales e Alphaville.
7. **Cadastrar as contas reais** por unidade, com saldo na data de corte.
8. **Confirmar a classe dos 13 motivos** (tabela da seção 5).

## 12. Data de corte — o que os dados sugerem

Na saúde da sincronização (rede toda), as falhas se concentram antes de 24/08:

| semana | vendas | sem caixa | sem pagamento | sem baixa de estoque |
|---|---|---|---|---|
| 27/07 a 17/08 | 315 | 315 | 0 | 315 |
| 24/08 | 397 | 2 | 10 | 67 |
| 31/08 | 422 | 0 | 0 | 44 |
| 07/09 | 447 | 0 | 0 | 4 |
| 14/09 | 404 | 0 | 0 | 2 |
| 21/09 (parcial) | 82 | 0 | 0 | 0 |

A partir de **07/09** o dado de venda de Santa Fé é consistente (as
poucas vendas sem baixa são de produto sem ficha). Somando a reversão das
taxas em 09/09, a data de corte natural para a homologação é **depois que
as taxas e as contas forem repostas** — com inventário físico no mesmo dia.

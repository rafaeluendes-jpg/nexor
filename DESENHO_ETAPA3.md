# Joia — desenho técnico da Etapa 3

Pedido da RDS em 23/09/2026: *"antes da Etapa 3, precisamos receber o
desenho técnico do CPV congelado, composição da ficha utilizada na venda,
tratamento da cortesia, competência e classificação dos motivos de
estoque."* Este documento é esse desenho. **Nada aqui foi implementado.**
Cada item entra no sistema pelo portão de publicação, com teste-guardião
próprio, depois de aprovado.

Decisões da RDS que este desenho já incorpora:

- balanço patrimonial fica para a segunda etapa;
- **cortesia não é perda**: é identificada na venda e baixa estoque pelo
  CPV teórico, como qualquer venda;
- **competência** entra agora, como campo próprio do lançamento;
- motivos de estoque ganham **classe obrigatória**, na lista de 12 classes
  da RDS;
- toda alteração de ficha registra **antes, depois, data, quem e motivo**.

---

## 1. O ponto de partida — o Joia já grava o custo na hora da venda

Lendo o código, a notícia é boa: **o CPV no momento da venda já existe**,
só não está amarrado ao item.

Quando uma venda fecha, o Joia monta o **movimento de estoque da venda**
(`origem='venda'`). Cada linha diz qual item saiu, quanto, em que unidade e
**a que custo naquele momento**:

- produto ligado a insumo → sai o insumo, ao custo médio do momento;
- produto ligado a ficha **com destino** (ex.: Gelato 500 g) → sai o
  produto pronto, ao custo da ficha;
- produto ligado a ficha **sem destino** → saem os ingredientes da receita;
- adicionais com ficha (borda, cobertura) → saem os ingredientes deles.

Esse movimento sobe **na mesma transação** da venda (`venda_registrar`),
junto com itens e pagamentos. Ou tudo grava, ou nada grava.

Então a soma `quantidade × custo` das linhas desse movimento **é o CPV
teórico da venda, congelado no instante em que ela aconteceu**. Se alguém
corrigir a ficha amanhã, esse movimento não muda.

**O que falta**, e é pouco:

1. as linhas não dizem **de qual item do pedido** vieram — o CPV existe
   por venda, não por item;
2. o movimento se liga ao pedido só pelo texto `"Pedido #N"`, não por uma
   referência;
3. o item não guarda **a composição usada** — qual ficha, com quais
   ingredientes e quantidades.

A Etapa 3 fecha esses três buracos. **Não se cria um motor de custo novo.**

---

## 2. CPV congelado e composição da ficha na venda

### O que muda no aparelho (PDV)
- Na montagem da baixa da venda, cada linha passa a levar `item_ref` — a
  referência do item do pedido que a gerou (inclusive as linhas dos
  adicionais).
- Ao fechar a venda, cada item recebe três campos calculados **das
  próprias linhas da baixa**, sem refazer conta:
  - `cpv_teorico` — soma de `qtd × custo` das linhas daquele item;
  - `ficha_ref` — a ficha usada;
  - `composicao` — os ingredientes, quantidades, unidades e custos que
    saíram, e um carimbo da versão da ficha (resumo das quantidades), para
    saber se duas vendas usaram a mesma receita.
- O pacote atômico (`venda_registrar`) leva esses campos e a referência do
  pedido no movimento.

### O que muda no banco
- `pedido_itens`: `cpv_teorico numeric`, `ficha_ref text`,
  `composicao jsonb` — todos opcionais.
- `movimentacoes_estoque`: `pedido_ref text`.
- `venda_registrar`: grava os campos novos. Pacote antigo (aparelho ainda
  na versão anterior) continua aceito: os campos só ficam vazios.

### O que muda na API
- `/itens` passa a trazer `cpv_teorico`, `ficha_ref`, `composicao`.
- Caminho novo `/cpv`: CPV por dia, produto e unidade, e o percentual sobre
  a receita líquida.
- **Venda anterior à Etapa 3 não ganha CPV inventado.** A resposta diz
  `cpv_origem: "sem registro"`. Onde o pedido tem **um item só**, o CPV
  pode ser reconstruído do movimento da venda, com
  `cpv_origem: "reconstruído do movimento"` — o auditor decide se usa.

### Casos de borda
- **Cancelamento**: o estoque já volta por movimento de estorno; o CPV do
  item cancelado sai do cálculo pela fase do pedido.
- **Produto sem ficha**: `cpv_teorico` vazio e aviso — nunca zero, porque
  zero pareceria "custo nulo".
- **Venda offline**: o cálculo é feito no aparelho, no momento da venda;
  subir depois não muda o valor.

### Guardião
Venda com ficha → o item tem `cpv_teorico` igual à soma das linhas da
baixa; corrigir a ficha depois **não altera** o CPV gravado; venda feita
sem internet sobe com o mesmo CPV; pacote antigo sem os campos continua
aceito.

---

## 3. Cortesia

**Regra da RDS:** cortesia não é perda. É identificada na venda e baixa o
estoque pelo CPV teórico normalmente.

### Como fica no caixa
- O item é lançado **pelo preço de tabela**, como qualquer venda — assim a
  baixa de estoque e o CPV acontecem sozinhos, pelo caminho que já existe.
- No item, o operador marca **Cortesia**. O sistema pede:
  - **motivo** (lista: reclamação de cliente, degustação, divulgação,
    colaborador, aniversário, outro com texto obrigatório);
  - **quem autorizou** — senha de quem tem a permissão nova
    `pdv/cortesia`.
- O valor do item vira uma linha de pagamento automática do tipo
  **cortesia** — o total fecha sem dinheiro entrando, e o caixa não acusa
  diferença.

### Por que assim
- Faturamento bruto preserva o preço de tabela; a cortesia aparece como
  **dedução própria** na DRE, separada de desconto.
- O estoque sai pelo mesmo código de sempre — nenhuma regra nova de baixa.
- A conferência de pagamentos ignora o tipo cortesia (não há dinheiro a
  conciliar).
- **Consumo interno** e **degustação sem venda** continuam sendo baixa de
  estoque, com motivo — não passam pelo caixa.

### Banco e API
- `pedido_itens.cortesia boolean`, `cortesia_motivo text`,
  `cortesia_autorizada_por text`.
- Forma de pagamento de tipo `cortesia` (criada pelo sistema, sem taxa,
  sem conta de destino).
- `/itens` e `/pagamentos-analitico` trazem a marcação; a DRE da RDS
  separa "cortesias" dos descontos.

---

## 4. Competência

### Banco
- `lancamentos_financeiros.competencia date` — sempre o **primeiro dia do
  mês** de competência.
- `competencia_origem text` — `informada` (alguém escolheu) ou `emissao`
  (preenchida automaticamente). O auditor sabe qual é qual.

### Tela
- Campo **Competência (mês/ano)** no lançamento, logo abaixo da emissão.
- Padrão: o mês da **emissão**. Nota de entrada: o mês da emissão da nota.
  Quem lança pode trocar.

### O que já existe
- Todo lançamento antigo recebe `competencia` = mês da emissão, com
  `competencia_origem='emissao'` — nenhum valor inventado sem marca.

### API
- `/titulos` traz `competencia` e `competencia_origem`, e aceita
  `data=competencia`.

**Precisa de uma decisão da RDS:** imposto (Simples, por exemplo) tem
competência no mês anterior ao do vencimento. Vira regra automática para a
categoria de impostos, ou fica manual?

---

## 5. Motivos de movimentação com classe

### Banco
- `motivos_movimentacao.classe` — obrigatória, uma das 12 classes da RDS:
  compra/entrada · consumo por venda · consumo por produção ·
  produção/entrada · transferência recebida · transferência enviada ·
  devolução · baixa identificada · ajuste positivo · ajuste negativo ·
  entrada avulsa · saída avulsa.
- `motivos_movimentacao.exige_justificativa boolean`.
- `movimentacoes_estoque.justificativa text`.

### Motivos do sistema
Venda, produção, contagem, nota de entrada e transferência ganham classe
fixa, que ninguém edita.

### Baixas identificadas padronizadas
Vencimento · avaria · queda · erro de produção · desperdício · consumo
interno · degustação · outro (com justificativa obrigatória).

Entram **só nas unidades que ainda não têm motivo com esse nome** — nunca
por cima do que a loja já configurou. Configuração da loja é dado, e
semente não sobrescreve dado.

### Tela
- Cadastro de motivo: o campo **Classe** passa a ser obrigatório.
- Baixa com motivo que exige justificativa: o campo de justificativa
  aparece e não deixa salvar vazio.

### Os motivos que já existem
Não serão classificados por palpite. Vai uma lista com cada motivo
atual, **a classe sugerida e quantas vezes ele foi usado**, para o Rafael
e o Raylan confirmarem. Enquanto não confirmarem, a API segue derivando a
classe da origem, como hoje, e marca `classe_origem: "derivada"`.

---

## 6. Alteração de ficha técnica com antes, depois e motivo

### Congelamento administrativo
- Configuração da rede: **período de auditoria aberto (sim/não)**.
- Com o período aberto, salvar uma ficha exige **motivo** (texto
  obrigatório) e a permissão de quem edita ficha — que já é só a matriz,
  desde a V336.

### Registro
- Tabela nova `fichas_alteracoes`: ficha, **antes** (a ficha inteira com
  os ingredientes), **depois**, quando, quem, motivo.
- Gravado pelo banco, num gatilho — não depende de o aparelho lembrar de
  mandar.

### API
- `/fichas/alteracoes?de=&ate=` — o que mudou no período, com antes e
  depois.

---

## 7. O responsável por cada operação

Levantado no diagnóstico dos cadastros: hoje o movimento de estoque, o
lançamento financeiro e o pedido **não guardam quem fez** — o pedido só
tem o operador do caixa em que caiu.

- `movimentacoes_estoque.responsavel`, `lancamentos_financeiros.criado_por`
  e `pedidos.operador` — preenchidos pelo aparelho com o usuário logado e,
  onde houver, o operador do caixa.
- Vale só daqui para frente; o passado continua com o que já existe.

---

## 8. Ordem de execução

| passo | o quê | risco | depende de |
|---|---|---|---|
| 1 | colunas novas no banco (todas opcionais) | baixo | nada |
| 2 | responsável por operação | baixo | nada |
| 3 | competência (banco, tela, API) | baixo | regra do imposto (seção 4) |
| 4 | classe dos motivos + justificativa | médio | lista confirmada pelo Rafael e pelo Raylan |
| 5 | alteração de ficha com motivo | médio | nada |
| 6 | CPV congelado e composição na venda | **médio-alto** — mexe no PDV | nada |
| 7 | cortesia | **médio-alto** — mexe no PDV | lista de motivos de cortesia |

Os passos 6 e 7 tocam o caixa das lojas. Entram:

- com guardião próprio;
- com o portão completo verde;
- primeiro na **unidade-piloto** (Santa Fé), acompanhando um dia de venda
  real antes de liberar para as outras.

---

## 9. O que ainda depende de decisão

1. Competência de imposto: regra automática ou manual (seção 4).
2. Classe de cada motivo atual (lista a enviar ao Rafael e ao Raylan).
3. Lista final de motivos de cortesia (seção 3).
4. Data de corte e unidade-piloto — a RDS sugere Santa Fé.

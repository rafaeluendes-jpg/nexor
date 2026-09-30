# Joia × RDS — ponto a ponto

Ordem do Rafael, 30/09/2026: *"vc vai fazer ponto a ponto que está
descrito e ir corrigindo e blindando, sem danificar outra coisa"*.

Este arquivo é o controle. Cada item do documento de homologação da RDS
tem aqui: o que o Joia faz **hoje**, se está pronto, pela metade ou não
existe, e o que já foi corrigido. Ele é atualizado a cada versão.

**A regra de trabalho**: nada sobe sem o portão inteiro verde
(`node ferramentas/portao.js`, 11 etapas), e cada correção ganha um
guardião trancado em `ferramentas/travas.json` — o que já foi consertado
não pode voltar a quebrar.

**A ordem das correções** não é a ordem do documento. É esta:

1. o que hoje **corrompe número** (estoque e dinheiro errados no banco);
2. o que hoje **mostra número errado** na tela;
3. o que **falta medir**;
4. o que é **trava nova** (muda o que a loja pode fazer) — e essas
   esperam ordem, porque podem parar a operação.

---

## Placar geral

Ordem do Rafael, 30/09/2026: *"tem que ser feito 100%, não existe isso
fazer pela metade. E 11 que não existe no Joia, vamos fazer"*. É o que
está acontecendo — item por item, cada um com o portão inteiro verde
antes de subir.

| Situação | Itens |
|---|---|
| ✅ Corrigido e no ar | 22 |
| 📏 Já existia, conferido | 9 |
| ⚠️ Pela metade | 4 |
| ❌ Não existe ainda | 8 |
| 🔒 Espera ordem (pode parar a loja) | 4 |

**Versões publicadas nesta sequência:** V371 a V378 — oito, todas pelo
portão de 11 etapas, com 291 testes novos trancados.

> **Uma coisa depende de você agora:** a V377 criou a tabela que liga
> cada evento do sistema a uma conta do plano de contas. Ela nasce
> **vazia** — é a RDS e você que decidem qual conta é a da venda de
> balcão, a da sangria, a do acerto do entregador. Enquanto os oito não
> forem escolhidos em **Plano de Contas**, eles continuam fora do DRE,
> como sempre estiveram. A tela mostra quantos faltam.

---

## ✅ O que já foi corrigido

### V371 — o "Voltar" do Kanban baixava o estoque de novo
*(RDS 2, 8, 11.3, 19.1)*

| O que estava errado | O que foi feito |
|---|---|
| Cancelar um pedido **já produzido** não devolve o estoque — a baixa original continua valendo. Quem clicasse "Voltar" naquele cartão ganhava uma **segunda** baixa do mesmo pedido: o mesmo pote saindo duas vezes do saldo. | `baixarEstoqueVenda` recusa baixar duas vezes o mesmo pedido, venha o clique de onde vier (PDV, totem, cardápio, Kanban). A trava ficou na porta, não na tela. |
| `estornarEstoqueVenda` apagava a movimentação **só no aparelho** e não declarava a exclusão. Desde a V201 o espelhamento só apaga da nuvem o que foi declarado — então a baixa continuava viva lá e voltava no download seguinte, derrubando o saldo de novo e devolvendo o CPV da venda cancelada ao DRE e ao CMV. | Declara a exclusão, como a nota de entrada já fazia. |
| "Voltar" devolvia a venda ao faturamento **sem senha, sem motivo**, e deixava o registro do cancelamento intacto: no mesmo dia, a aba Cancelamentos e o faturamento do turno discordavam. | Voltar passa pela mesma porta de cancelar (operador, senha e motivo). O cancelamento não é apagado: fica na trilha, marcado como desfeito, com quem desfez e por quê. Os quatro relatórios que liam a lista passam a ignorá-lo. |
| A trava de saldo conferia o **espelho da unidade aberta**, não o saldo da unidade do movimento. | Lê `estoque_unidade`. Item sem registro na unidade aberta continua caindo no espelho — senão barraria produção legítima (o portão pegou isso). |
| O movimento guardava só o custo aplicado. Não dava para dizer **em qual movimento** o saldo cruzou o zero. | Cada linha carimba saldo e custo médio **antes e depois**, valor e unidade; o movimento guarda quem estava logado. Não muda cálculo nenhum. |

Guardião: `testes/cancelar-e-voltar.js` — 50 testes.

### V372 — o DRE de um ano mostrava 30 dias
*(RDS 12, 25, 26)*

| O que estava errado | O que foi feito |
|---|---|
| O DRE lia `DB.pedidos` cru. O aparelho guarda **30 dias** de venda — o DRE do ano vinha com janeiro a agosto zerados, e o "resultado do ano" era o resultado do mês. | Passou a usar a mesma fonte das outras sete telas (aparelho + histórico da nuvem) e a pedir o histórico do ano, redesenhando quando ele chega. |
| O carimbo da venda vem da nuvem em UTC. Uma venda das **21h10 de 31/08** virava setembro. Numa gelateria o forte é a noite: todo fim de mês uma fatia do faturamento e do CPV trocava de mês sozinha. | `diaLocal` — que já resolvia isso no resto do sistema — entrou no DRE e nas quatro leituras do Comparativo. |
| `gerarVendasDemo` cria seis meses de faturamento fictício marcado com `demo:true`, e **nenhum relatório olhava a marca**. Um clique injetava venda inventada no DRE, no Faturamento por Dia, no Comparativo e nos Indicadores. | A marca passou a ser perguntada nas duas portas por onde quase todo relatório lê a venda. |
| O aparelho baixa a rede inteira. Sem a trava de unidade, quem abria Santa Fé via o DRE **somado com Jales**. | Trava aplicada. A matriz continua comparando a rede, por desenho. |
| No Comparativo, o faturamento vem da nuvem e o custo só do aparelho (90 dias). Para o ano passado: faturamento cheio, CMV zero, **"Margem bruta 100,0%"** — um número redondo e falso. | Não dá para inventar o custo que não está aqui. A tela passa a **dizer** que aquele pedaço não chegou, no aviso amarelo que o sistema já usa. |

Guardião: `testes/relatorio-nao-mente.js` — 38 testes.

### V373 — cancelar a venda mexia só no estoque
*(RDS 8, 9.1, 9.3, 26)*

A venda cria seis coisas. O cancelamento desfazia uma.

| O que estava errado | O que foi feito |
|---|---|
| **O cliente continuava devendo.** O fiado entrou como débito e o crédito nunca saiu: venda cancelada, dívida viva. | O crédito nasce ligado ao cancelamento, e só uma vez. |
| O **cartão fidelidade** avançava com uma compra que não houve, e o gasto do cliente junto. | Recuam os dois. |
| O **cupom de desconto** queimava o limite por cliente à toa. | O uso volta. |
| A **NFC-e ficava autorizada na SEFAZ**, valendo, com o valor de uma venda que não existe mais. | O cancelamento da venda pede o cancelamento do cupom, depois de gravar — o fiscal nunca segura o caixa. Prazo vencido ou SEFAZ fora do ar viram pendência escrita, que aparece na tela e na API. |
| O cancelamento **carimbava o caixa de hoje**: cancelar hoje uma venda de ontem punha o cancelamento no turno errado. | O caixa do cancelamento é o caixa da venda. |
| O **custo do que foi produzido e jogado fora** continuava no CPV, ao lado de uma receita que o cancelamento tirou do faturamento. | Vira perda identificada. O DRE leva para Despesas Gerais Variáveis, o CMV para baixas, o Comparativo tira do CMV e os Indicadores contam como perda. O resultado é o mesmo; a leitura deixa de mentir. |

Guardião: `testes/cancelamento-fecha-o-ciclo.js` — 44 testes.

### V374 — a tela de Sincronização dizia coisas que não eram
*(RDS 3)*

| O que estava errado | O que foi feito |
|---|---|
| **"Último envio: —", para sempre.** A tela lia um campo que nada, em lugar nenhum do sistema, escrevia. | Passou a ser escrito ao fim de cada sincronização. |
| **"1 a enviar", com setecentas pendências.** A função somava tudo e devolvia 1, jogando a conta fora na última linha. | Usa a contagem do próprio motor. |
| A **pendência mais antiga** não aparecia — embora o dado já fosse coletado e descartado. Dez minutos é rede instável; três dias é um aparelho que ninguém percebeu que parou. | Aparece, com o tempo decorrido. |
| O **aparelho responsável** não era dito nem gravado. | Toda linha carimba de qual aparelho veio e em que versão nasceu. |

Guardião: `testes/sincronizacao-diz-a-verdade.js` — 27 testes.

### V375 — o cupom preso só saía se alguém abrisse a tela de Cupons
*(RDS 9.2)*

A rotina de reenvio existia, era cuidadosa e fazia a coisa certa — e
tinha **um** chamador: a tela de Cupons Fiscais. Ninguém abre aquela
tela no balcão. Em 29/09 havia seis cupons parados por queda de
internet; ficaram o dia inteiro.

Agora roda onde a loja passa o dia: ao abrir o PDV, em segundo plano.
E o que não dá para reenviar sozinho — cupom recusado pela Receita, que
precisa de alguém corrigir a causa, e cupom esperando cancelamento, que
tem prazo de minutos — virou uma faixa amarela no próprio PDV.

Guardião: `testes/cupom-nao-fica-preso.js` — 26 testes.

### V376 — o financeiro deixava passar
*(RDS 17, 21, 27.5)*

| O que estava errado | O que foi feito |
|---|---|
| **Pagar não perguntava nada.** O joinha, a baixa em lote e a confirmação com juros caem no mesmo lugar, e ele só exigia conta e forma. Dava para pagar, conciliar e fechar o mês com um lançamento que o DRE não enxerga. | A baixa recusa e diz qual lançamento. |
| **Receita sem categoria ninguém via** — a marca vermelha só olhava despesa. | Vale para os dois lados. |
| **"Salvo e conferido na nuvem" era dito sem conferir nada**, justamente quando o lançamento tinha sido salvo sem plano de contas. | Separa "é transferência, está certo" de "está sem categoria e não vai entrar no DRE". |
| **Desconciliar eram três linhas sem proteção**: sem motivo, sem prazo, sem quem foi — e apagava a data anterior, destruindo o "antes". | Exige motivo, guarda quem/quando/por quê numa lista, conta os dias e marca quando foi fora do prazo de três dias. |

Guardião: `testes/financeiro-nao-deixa-passar.js` — 37 testes.

### V377 — nenhum lançamento automático entrava no DRE
*(RDS 18)*

Oito eventos criam lançamento financeiro sozinhos: fechamento de caixa,
sangria, transferência entre contas, acerto com entregadores,
recebimento de fiado, as duas pontas do pedido de base e a nota lançada
pela Assistente do WhatsApp.

Todos nasciam com a categoria escrita à mão no código, como **texto
solto**, sem id do plano de contas. E o DRE só enxerga quem tem id — ou
seja, **a venda do dia, a sangria e o acerto do entregador sumiam do
resultado**. O DRE mostrava as despesas digitadas à mão e quase nada do
que o próprio sistema gera.

Agora existe a tabela de regras que a RDS pede: evento → conta
analítica, com vigência e responsável, configurada na tela do Plano de
Contas. Sem regra, o lançamento nasce do mesmo jeito (o caixa não para),
marcado como pendente — e a tela diz quantos faltam.

Guardião: `testes/lancamento-automatico-entra-no-dre.js` — 41 testes.

### V378 — o relatório somava a rede inteira
*(RDS 26)*

O aparelho baixa a rede toda. Quem abria Santa Fé via o consumo de
insumos, as vendas por mesa, o fluxo de caixa e as despesas do DRE
**somados com Jales**. Corrigidos os quatro. A matriz continua
comparando a rede, por desenho.

O CSV de Vendas por Mesa passou a usar a mesma lista da tela — antes
ignorava a unidade, ignorava o histórico da nuvem e ainda usava outra
data, então a mesma venda saía com dia diferente nos dois lugares.

E imposto, royalties, fundo de promoção e taxa de cartão passaram a
dizer **"calculado"**: não são lançamentos, são percentuais sobre o
faturamento e sobre o cadastro da forma de pagamento, e apareciam com a
mesma cara de uma linha lançada de verdade.

Guardião: `testes/relatorio-separa-a-unidade.js` — 28 testes.

---

## O documento, seção por seção

### 2 — Autoridade final dos dados
⚠️ **Pela metade.** Identidade é o par `(loja, ref_local)` e o upsert
protege contra reenvio duplicado — mas o `ref_local` de **filho**
(pagamento, item) é montado por **posição**, em dois lugares
independentes do código. Isso já duplicou de verdade: 30 pares, R$ 1.046
a mais em pagamentos. Está corrigido, mas nada garante que os dois
lugares continuem iguais.
Dos dez campos que a RDS pede por operação, existem **cinco**. Faltam:
aparelho de origem, sequência local, hora de recebimento na nuvem, estado
de sincronização declarado e operação de reversão.
✅ A reversão que **apagava o original** sem avisar a nuvem foi corrigida
na V371.

### 3 — Funcionamento offline
📏 **A parte que funciona é a mais madura do sistema**: grava no aparelho
primeiro, o caixa nunca para, e a sincronização é retomável.
⚠️ O painel mostra 3 das 5 coisas pedidas. Faltam: **hora da pendência
mais antiga** (o dado já é coletado e jogado fora) e **aparelho
responsável**.
❌ A tela oficial de Sincronização mostra "Último envio: —" **para
sempre** — lê uma variável que nada escreve. E o crachá do cabeçalho diz
"1 a enviar" mesmo com 700 pendências.
❌ Não existe fila de operações **ordenada por tempo**: o Joia sincroniza
*estado por tabela*, não eventos em sequência. A nuvem não tem como
preservar ordem porque o aparelho não manda ordem.

### 4 — Estoque negativo
⚠️ A trava existe (`faltaEstoque`) e vale em 4 fluxos. **A venda não
trava** — e é onde o negativo nasce (17 itens hoje, todos por venda na
loja e por pedido de base na matriz).
✅ A trava passou a conferir a unidade certa (V371).
🔒 Fazer a trava valer na venda é **trava nova**: pode impedir uma venda
no balcão. Espera ordem.
❌ Não existe item bloqueado por saldo negativo, nem regularização por
causa-raiz.

### 5 — Produção manual
📏 Quase inteira: busca a ficha, calcula, confere saldo, lista todas as
insuficiências e **bloqueia integralmente**.
❌ Falta versão/vigência de ficha e lote/validade.
⚠️ O custo da produção é **recalculado do zero** a cada movimento,
varrendo o histórico inteiro — uma produção de hoje reescreve o custo de
ontem.

### 6 — Produção automática no PDV
❌ Não existe como desenho. O efeito no CPV acontece (a receita é
explodida na venda), mas não há entrada do produto acabado vinculada à
saída da venda.

### 7 — Pedido e venda concretizada
📏 A venda concretizada é **bem feita**: trava de clique duplo, exige
caixa aberto, recusa forma inválida, separa valor de troco, reconcilia
antes de gravar, valida CPF e limite de fiado.
❌ O item retirado **antes** de fechar a venda não gera registro nenhum.
⚠️ O CPV não é congelado no pedido — é calculado depois, por relatório.

### 8 — Cancelamento da venda
✅ Duplicidade, estoque em dobro e o registro que continuava contando:
corrigidos na V371.
❌ Ainda falta: o cancelamento **não cancela o cupom fiscal** (a NFC-e
fica autorizada na SEFAZ), **não estorna o fiado** (cliente cancelado
continua devendo), não reverte fidelidade nem cupom de desconto, e não
gera perda identificada quando o pedido já foi produzido.

### 9 — Estados de venda, pagamento e fiscal
⚠️ Existe máquina de estados **só para o fiscal**, e é boa (11 estados).
A venda tem um campo só. **O pagamento não tem estado nenhum**: o
operador digita o valor e o sistema assume aprovado.
❌ Das oito linhas da tabela da RDS, o Joia trata 2 inteiras, 3 pela
metade e 3 não trata.
❌ Um cupom que ficou pendente por queda de internet **só é reenviado se
alguém abrir a tela de Cupons Fiscais** — e ninguém abre no balcão.

### 10 — Fechamento de caixa
⚠️ Das oito pendências que a RDS manda bloquear, o Joia bloqueia **uma**
(pedido não finalizado). Não bloqueia venda não sincronizada, cupom
pendente nem erro de estoque.
📏 O que ele **registra** no fechamento está bom (unidade, turno, quem
abriu, quem fechou, formas, sangrias com motivo, diferenças).
🔒 Bloquear o fechamento é **trava nova** e pode parar a loja numa noite
em que a SEFAZ está fora do ar. O caminho seguro é **listar primeiro**,
medir uma semana, e só então travar — com liberação por senha de gerente,
registrada.

### 11 — Custo médio
📏 A conta está **certa**, inclusive a regra 11.2 (saldo zero → a
primeira entrada manda, sem ponderar com o histórico).
⚠️ Dos campos pedidos existem 2 de 6: falta separar "último custo médio
com saldo" e "preço da última compra".
✅ O custo congelado por movimento (11.3) passou a existir na V371.

### 12 — Precisão
⚠️ Custo a 6 casas (certo). **Quantidade a 4** (a RDS pede 6). Arredonda
em cada etapa, não só no fim. Diferença residual não é registrada.
🔒 Subir para 6 casas mexe em número existente e nos limites de tolerância
que decidem quando o custo médio é zerado. Precisa ser feito junto, com
prova.

### 13 — Unidade de medida
❌ Existe **uma** unidade por item. O campo "fator de conversão" é
preenchido pelos usuários e **nenhum cálculo o lê**. A nota de entrada
não aceita unidade de compra diferente. Hoje 1 caixa = 1 unidade.

### 14 — Lote e validade
❌ **Não existe nada.** Um campo de data solto no insumo (que a dica da
tela chama de "do lote") e um prazo em dias na ficha — e nenhum dos dois
faz nada. Sem FEFO, sem PEPS, sem bloqueio de vencido, sem alerta.

### 15 — Movimentos que alteram custo
⚠️ Há 11 motivos de sistema, mas a classificação da RDS tem 13 tipos que
não existem (bonificação, devolução, transformação, custo zero
autorizado). A contagem de estoque acha que fixa o custo e o sistema
descarta na leitura seguinte.

### 16 — Insumos sem custo
⚠️ O sistema **sabe** quem está sem custo (59 hoje) e não impede nada.
Não existe tipo "serviço" — a Taxa de Entrega não tem para onde ir. Não
existe custo zero autorizado com aprovador e vigência.

### 17 — Plano de contas obrigatório
⚠️ A validação existe **só no formulário manual**. Passa sem categoria:
o pagamento, a baixa em lote, a transferência entre contas, a
conciliação, os 8 lançamentos automáticos, a descida da nuvem e o banco.
❌ Não existe **rascunho**.

### 18 — Lançamentos automáticos
❌ Não existe tabela de regras. Os **8 eventos** que criam lançamento
sozinhos gravam a categoria como **texto**, sem id do plano de contas — e
o DRE só enxerga o id. **Nenhum lançamento automático entra no DRE.**

### 19 — Correção do histórico
⚠️ O modelo certo existe e está provado — mas **só para cancelamento de
venda**. Nota de entrada, lançamento financeiro e conciliação ainda
corrigem por exclusão destrutiva, que propaga para a nuvem.
❌ Excluir uma nota **paga** é um clique, e o pagamento não é desfeito.

### 20 — Perfis e autorizações
❌ Das 18 ações que a RDS pede, **1** tem permissão própria. As
permissões são por **tela**. Não existe papel *master*. A alçada por
cargo no caixa existe no código e está **desligada** por um objeto vazio.
🔒 Ligá-la na ordem errada repete o incidente de 29/08/2026 (loja sem
conseguir fechar o caixa).

### 21 — Conciliação financeira
❌ Desconciliar é possível **sem permissão, sem motivo, sem prazo**, e
apaga a data da conciliação anterior — destrói o "antes".

### 22 — Auditoria e retenção
📏 A trilha existe no banco (`audit_log`), com antes e depois, e é
imutável por gatilho.
❌ Mas a definição dela **não está em nenhuma migração do repositório**:
existe só como estado de produção. Um banco novo nasce sem auditoria. E
o backup padrão **exclui** a trilha.
❌ Não grava motivo, aparelho, versão nem autorização.

### 23 — Segurança
📏 Prontos: expiração de sessão, backup com teste de recuperação, e RLS
obrigatória em toda tabela nova (o item mais bem feito).
⚠️ Pela metade: autenticação individual (as lojas usam uma conta por
unidade), permissões, rotação de chaves.
❌ Ausentes: revogação de aparelho, proteção de token no aparelho,
criptografia dos dados locais, proteção contra replay, versão mínima
obrigatória, registro da versão de cada aparelho.

### 24 — Migração e limpeza
📏 Os números estão **medidos e publicados na API** (`/pendencias`): 59
insumos sem custo, 18 motivos sem classe, 2 lançamentos sem categoria, 2
produtos sem vínculo, 17 saldos negativos, 27 caixas com pendência, 3
divergências fiscais.
❌ Falta a regularização em si, que é trabalho de cadastro com o Raylan.

### 25 — API RDS
✅ **Pronta e no ar** (v2.3). As três listas que faltavam existem e
respondem com dado real; toda resposta diz unidade, período, fuso,
momento da extração, última sincronização e versão da regra.
❌ Não existem, e a API **diz por escrito** que não existem: lote e
validade, itens bloqueados, histórico de regularizações.

### 26 — Relatórios
✅ As quatro mentiras do DRE e do Comparativo: corrigidas na V372.
⚠️ Ainda mentem: CMV por Mercadoria, Itens Consumidos, Vendas por Mesa e
Fluxo de Caixa **somam a rede inteira** quando a loja abre. O DRE
apresenta imposto, royalties e taxa de cartão **calculados** com a mesma
cara de uma linha lançada.

### 27 — Testes obrigatórios
⚠️ A bateria tem 118 guardiões e 3.112 pontos trancados. Dos cenários que
a RDS lista, falta escrever: venda offline completa, produção automática
offline, eventos recebidos fora de ordem, negativo após sincronização, e
os seis da máquina de estados de pagamento (que não existe).

### 28 — Critérios de aceite
📏 Dos 15 critérios, **2 são mensuráveis hoje**, 8 pela metade e 5
impossíveis sem construir campo ou tela. Os principais que faltam medir:
lançamentos que caíram fora do DRE, movimentos sem origem, cancelamento
sem vínculo, e fichas com versão (o campo não existe).

### 29 — Entregáveis
🔨 Este arquivo é o item 13 (relação das não conformidades). O
diagnóstico do código atual está feito, seção por seção. O plano de
rollback é o de sempre: a versão anterior está publicada e o portão
guarda as duas.

---

## O que vem agora, na ordem

1. **Versionar a auditoria numa migração**, copiando do banco o que já
   está rodando. Risco nenhum, e sem isso não há o que provar à RDS —
   hoje a trilha existe só como estado de produção, e um banco novo
   nasceria sem ela.
2. **Anular em vez de apagar** (RDS 19): nota de entrada, lançamento e
   conciliação ainda corrigem por exclusão destrutiva, que propaga para
   a nuvem. Excluir uma nota **paga** é um clique.
3. **Estado do pagamento** (RDS 9): hoje o operador digita o valor e o
   sistema assume aprovado. Sem esse estado, três linhas da tabela da
   RDS não têm como existir.
4. **Permissão por ação** (RDS 20): das 18 ações, 1 tem permissão
   própria. O formato já funciona ponta a ponta; falta estendê-lo.
5. **Custo médio: os campos que faltam** (RDS 11) e **classificar o que
   altera custo** (RDS 15).
6. **Produção automática vinculada** (RDS 6).
7. **Unidade de compra com fator** (RDS 13) e **lote e validade**
   (RDS 14): não existem, e são os dois maiores de construir.

E as quatro que **esperam ordem do Rafael**, porque mudam o que a loja
pode fazer e podem parar o caixa: travar a venda que deixa saldo
negativo, travar o fechamento de caixa com pendência, ligar a alçada por
cargo, e subir a precisão da quantidade para seis casas.

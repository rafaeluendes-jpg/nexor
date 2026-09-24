# Joia — retorno à RDS sobre o relatório de 23/09/2026

24/09/2026 · resposta ponto a ponto à mensagem da RDS (itens 1 a 9).

Tudo aqui foi conferido no código-fonte do Joia e no banco de produção.
Nenhuma trava nova foi publicada: como a RDS pediu, PDV, estoque e
financeiro só mudam depois deste retorno e do de acordo de RDS, Rafael e
Raylan. O que está pronto para subir são **três correções de defeito** (V340):

- a das taxas que voltavam ao valor de fábrica (5.2);
- a da categoria de lançamento que se perdia no caminho para a nuvem (2.1);
- a do CPV contado em dobro no DRE (item 9).

Elas também esperam o de acordo.

**Situação de cada item:**

| # | pedido | situação |
|---|---|---|
| 1 | relação nominal das pendências | **feito**: `/pendencias` no ar, foto do "antes" gravada, planilha `Joia-pendencias-24-09-2026.xlsx` |
| 2 | trava de lançamento sem categoria | **desenho abaixo**; aguarda o de acordo |
| 3 | trava de insumo sem custo | **desenho abaixo**; aguarda o de acordo |
| 4 | produto ativo sem ficha ou insumo | **desenho abaixo**; aguarda o de acordo |
| 5 | taxas congeladas na venda + causa da reversão | **causa encontrada e corrigida** (V340, testada, não publicada); congelamento desenhado |
| 6 | incidente das 12 cópias | **relatório concluído**: registros de acesso conferidos, nenhuma leitura |
| 7 | limpeza cadastral | **lista de controle abaixo** |
| 8 | chave "RDS Inteligência Gerencial" | **criada e testada em produção**; entregue ao Rafael por mensagem, fora deste documento |
| 9 | retorno esperado | este documento |

**Aplicado no banco em 24/09/2026:**

- a alteração `supabase/migrations/20260924_rds_pendencias_e_chave_gerencial.sql`;
- a API 2.2, publicada como versão 6 da função;
- a chave nova;
- a proteção contra tabela exposta.

**Teste de ponta a ponta em produção,** com uma chave temporária que foi
apagada em seguida:

- `/pendencias` respondeu;
- o limite de chamadas (3 por minuto na chave de teste) recusou as 2 chamadas excedentes, com "429";
- o nome de cliente saiu mascarado ("C.").

---

## 1. Relação nominal das pendências

**Na API (versão 2.2), só leitura:**

| caminho | o que devolve |
|---|---|
| `GET /pendencias` | quantos registros há em cada pendência |
| `GET /pendencias/lancamentos-sem-categoria` | identificador, tipo (a pagar/receber), descrição, documento, fornecedor e CNPJ, emissão, vencimento, pagamento, pago, conciliado, valor, unidade, conta, forma, **origem** (manual ou qual rotina gerou), criado em, alterado em, **usuário** que criou |
| `GET /pendencias/insumos-sem-custo` | identificador, código, descrição, unidade de medida, fator, controla estoque, entra no CMV, **saldo por unidade** com custo médio, **fichas que usam**, produtos que usam direto, **última compra** (data, documento, quantidade, custo, unidade) |
| `GET /pendencias/produtos-sem-vinculo` | identificador, código, descrição, preço, se baixa estoque, **quantidade vendida, faturamento, pedidos, primeira e última venda, dias com venda** |
| `GET /pendencias/motivos-sem-classe` | identificador, nome, direção, se é do sistema, ativo, **quantas vezes foi usado** e o último uso |

Todos aceitam `loja=` para uma unidade só.

**Números de hoje (foto de 24/09, 09h20):**

| pendência | 23/09 | 24/09 | por que mudou |
|---|---|---|---|
| lançamentos sem categoria | 72 | **74** | 3 lançados desde 23/09; 1 dos antigos foi classificado |
| insumos sem custo | 56 | **68** | 12 bases tiveram o custo **zerado** em 23/09, às 13h51, quando o estoque delas ficou zero ou negativo (item 3.1) |
| produtos sem ficha nem insumo | 2 | **2** | — |
| motivos sem classe | 13 | **13** | — |

**Critérios, os mesmos do relatório de 23/09:**

- **Lançamento sem categoria:** sem subcategoria e sem nome de categoria,
  e não cancelado. Os 120 gerados pelo sistema com a categoria só em texto
  ("Frente de Caixa", "Pedido de base", "Transferência") **não** entram
  aqui. Eles são tratados no item 2.3.
- **Insumo sem custo:** custo zero ou vazio. Hoje o Joia não separa "não
  informado" de "realmente zero". A separação está no item 3.
- **Produto sem vínculo:** ativo, sem ficha técnica e sem insumo direto.
- **Motivo sem classe:** todos os 13. O campo classe ainda não existe.

**Foto do "antes".** As quatro listas completas estão gravadas com data e
hora (24/09, 09h20), fora do alcance da API e do navegador
(`arquivo.pendencias_foto`). É o registro de antes da limpeza.
Toda correção feita depois fica no registro de auditoria, com antes,
depois, quem e quando.

**Nada é classificado ou corrigido automaticamente.** A API só lê. A
limpeza é manual, pela tela, depois da validação de Raylan e RDS.

**Planilha.** A mesma extração está em `Joia-pendencias-24-09-2026.xlsx`:

- uma aba por pendência, mais o resumo;
- colunas em branco para o Raylan registrar a decisão, o responsável e a
  data.

---

## 2. Trava para lançamento financeiro sem categoria

### 2.1 Como é hoje

- **Na tela de lançamento manual a categoria já é obrigatória.** Não se
  salva sem descrição, valor e categoria.
- **Nenhum lançamento automático recebe categoria de verdade**, só um nome
  em texto:

| de onde vem | categoria gravada |
|---|---|
| fechamento de caixa | "Frente de Caixa" (texto) |
| sangria e suprimento | "Transferência" (texto) |
| acerto com entregadores | "Acerto com entregadores" (texto) |
| recebimento de fiado | "Recebimento de fiado" (texto) |
| pedido de base, matriz e filial | "Pedido de base" (texto) |
| **nota lançada pelo assistente do WhatsApp** | **vazia** |
| transferência entre contas | "Transferência" (texto) |

**A relação nominal mostrou de onde vêm os 74:**

| origem | qtd | valor | o que é |
|---|---|---|---|
| estorno de venda cancelada | 32 | R$ 1.359,00 | criado **pelo banco** quando uma venda é cancelada, sem categoria nem conta |
| nota de entrada | 32 | R$ 20.241,37 | a tela **exige** categoria, mas ela não chegou à nuvem |
| manual | 10 | R$ 10.725,54 | idem |

**O defeito que explica 42 dos 74.** A categoria escolhida na tela fica no
aparelho, mas o envio para a nuvem precisa traduzir a subcategoria para o
identificador do banco. O mapa que faz essa tradução só conhecia a
categoria-pai, nunca as subcategorias recebidas pelo download.

- Num aparelho de loja o lançamento subia **sem subcategoria**.
- A loja via o lançamento classificado; a nuvem, a API e o DRE da rede
  viam "sem categoria".
- Por isso só 10 dos 202 lançamentos tinham subcategoria na nuvem.

**Corrigido na V340**, com o guardião `testes/categoria-do-lancamento-sobe.js`.
Ele roda o download de verdade e confere o envio: são 9 verificações, que
**falham no código antigo** (3 falhas).

Quando a V340 for publicada, o aparelho de Santa Fé reenvia os lançamentos
com a categoria que a loja escolheu. Isso **não é classificação
automática**: é a decisão da loja chegando aonde deveria.

- Os **32 estornos** precisam de uma regra da RDS. Sugestão: *dedução de
  receita — cancelamentos e devoluções*.
- O que sobrar sem categoria depois da V340 fica para o Raylan.
- **Não existe rascunho** nem fechamento de período no financeiro.
- **O DRE descarta em silêncio** o lançamento sem categoria: ele não entra
  em rubrica nenhuma e não aparece como pendência.

### 2.2 A regra proposta

1. **Dois estados: rascunho e confirmado.** Um lançamento sem categoria
   só pode existir como **rascunho**.
2. **O rascunho não é pago, recebido, conciliado nem fechado.** Os botões
   de pagar/receber (individual e em lote), conciliar e fechar recusam o
   rascunho com a mensagem "Classifique a categoria antes".
3. **Para confirmar é preciso categoria e subcategoria.** O plano do Joia
   tem dois níveis e o lançamento aponta para a subcategoria, então as
   duas vêm juntas.
4. **Quem alterou, quando, antes e depois:** o registro de auditoria do
   banco já grava isso em `lancamentos_financeiros`. Aparece em
   `/historico?tabela=lancamentos_financeiros`.
5. **Lista de pendências visível:** um contador "sem categoria" no topo
   de Lançamentos e um filtro que mostra só eles. O **DRE passa a mostrar
   uma linha "Sem categoria"** em vez de descartar o valor.
6. **Nada é preenchido automaticamente** sem regra homologada (2.3).
7. **Os 72 atuais continuam como estão**, marcados como rascunho, para a
   classificação manual. Cada classificação fica no histórico.

### 2.3 Lançamentos automáticos

Para os automáticos pararem de nascer sem categoria, a proposta é uma
**tabela de regras homologada pela RDS**. Exemplo: fechamento de caixa vai
para *Receitas › Vendas balcão*; sangria é transferência, fora do DRE; nota
de entrada exige categoria na hora de lançar.

Enquanto a tabela não é aprovada, o automático nasce **como rascunho**. O
caixa continua fechando normalmente; só o financeiro fica pendente.

### 2.4 Onde a trava fica

- **Na tela (aparelho).** É lá que a pessoa decide.
- **O banco não recusa a gravação.** Ele marca e lista. Se o servidor
  recusasse um lançamento que o aparelho gravou sem internet, a fila de
  envio da loja travaria. É o tipo de defeito que já tirou venda do ar.

### 2.5 Dois defeitos achados nesta revisão (corrigir junto)

- **O cancelamento de lançamento não sobe para a nuvem.** O campo existe
  no banco, mas o aparelho não o envia. Um lançamento cancelado na loja
  continua ativo para a API.
- **O pedido de base não envia a referência de origem** (`origem_ref` sobe
  vazio). O vínculo entre o título e o pedido fica só no aparelho.

---

## 3. Trava para insumo sem custo

### 3.1 Como é hoje

- **O custo não é digitado no cadastro do insumo.** O campo é só leitura.
  O custo nasce da entrada por nota (média ponderada por unidade, ou
  "última compra", conforme o insumo), da contagem (que pode fixar o custo
  à mão) ou da produção.
- **Estoque zerado zera o custo.** Aconteceu em **23/09, às 13h51**:
  12 bases (Chocolate, Morango, Ninho, Belga, Pistache...) chegaram a zero
  ou negativo na Matriz e perderam o custo, embora a última compra
  (NF franq260921, de 21/09) esteja registrada.
  - **O risco:** toda venda que baixar essas bases com custo zero entra no
    CPV com custo zero.
  - **A proposta:** com estoque zero ou negativo, manter o último custo
    conhecido, em vez de zerar. A próxima entrada já recalcula a média
    corretamente sem precisar do zero.
  - **Situação:** altera o custo do estoque, então espera o de acordo.
  - **Nos 68 insumos da relação nominal:** 35 têm custo da última compra
    e podem ser repostos por ele; 33 nunca tiveram custo.
- **O insumo não tem situação ativo/inativo.**
- A ficha técnica mostra R$ 0,00 para ingrediente sem custo, **sem
  alerta**.
- **A venda grava o custo de cada ingrediente no momento da baixa.** O
  CPV do DRE usa esse custo gravado. Por isso um insumo com custo zero na
  hora da venda deixa o CPV daquela venda subestimado para sempre.

### 3.2 A regra proposta

1. **Três estados de custo:** *informado*, *zero autorizado* e *não
   informado*. Hoje os três aparecem como 0.
2. **Situação do insumo:** *ativo* ou *inativo/rascunho*. Um insumo **sem
   custo não é ativado.**
3. **Insumo sem custo não entra** em ficha nova, produção nem valorização
   de estoque. Na venda não se bloqueia o balcão: a baixa acontece e o
   movimento fica **marcado "custo não informado"**, para a auditoria
   separar esse CPV. Bloquear a venda por causa de cadastro pararia a
   loja.
4. **Custo zero só com autorização:** marcação própria, motivo obrigatório
   e usuário que autorizou (gerente, pela senha de gerente que o caixa já
   usa).
5. **Na entrada por nota:** continua a regra de custeio de cada insumo
   (média ponderada ou última compra). A primeira nota tira o insumo de
   "não informado" automaticamente.
6. **Alerta na ficha técnica:** ingrediente sem custo aparece destacado,
   e a ficha mostra "custo incompleto".
7. **Nenhum período fechado é recalculado em silêncio.** O CPV de uma
   venda passada é o custo gravado naquela venda.
   - **Ressalva aceita pela RDS até o CPV congelado:** relatórios que
     recalculam pela ficha atual (custo da ficha, `/fichas`) mostram o
     custo de hoje. Fica escrito na resposta da API e no relatório.

---

## 4. Produto ativo sem ficha ou insumo

### 4.1 Como é hoje

- Vincular ficha ou insumo é opcional, e a tela aceita "baixa estoque"
  marcado **sem escolher** ficha nem insumo.
- Na venda, produto sem vínculo **não baixa nada, sem aviso**. O aviso só
  aparece quando o pedido inteiro não baixou nada. Num pedido misto o item
  sem vínculo passa despercebido.

### 4.2 A regra proposta

1. **Produto controlado** (baixa estoque marcado) só é **ativado e vendido**
   com ficha técnica **ou** vínculo direto com um insumo.
2. **Exceção explícita:** a classificação "não controlado em estoque", com
   justificativa obrigatória no cadastro. Exemplos: taxa de entrega,
   serviço, vale-presente.
3. **No caixa:** item sem vínculo que escapar aparece no fechamento e na
   saúde da sincronização. Não trava a venda, pelo mesmo motivo do item 3.
4. **Os 2 produtos atuais** estão na relação nominal. Eles precisam ser
   ligados a uma ficha, ou classificados como "não controlados" com
   justificativa, **antes da data de corte**.

---

## 5. Taxas e condições de pagamento

### 5.1 Como é hoje

- **A venda guarda só a forma, o valor e o equipamento.** A taxa, o prazo,
  o líquido e a conta são **sempre recalculados pelo cadastro de hoje** no
  fechamento de caixa, no relatório por forma, no DRE e na API.
- A única coisa que fica congelada é o lançamento do fechamento de caixa,
  e só até alguém editar o caixa: aí ele é refeito com a taxa daquele
  momento.

**Consequência:** a reversão de 09/09 contaminou tudo o que foi calculado
depois. Mesmo com a taxa reposta, as vendas de 09/09 até hoje continuariam
recalculadas pelo cadastro. Por isso o congelamento abaixo é necessário.

### 5.2 A causa da reversão — encontrada e corrigida

**O que acontecia.** Num **aparelho novo, num navegador limpo ou depois de
trocar de login**, o Joia não sabe ainda que a loja tem formas de
pagamento. Se qualquer tela (caixa, relatórios, financeiro) abria **antes
de terminar o primeiro download**:

1. O sistema gravava a lista de fábrica: débito 1,99%, crédito 3,49%, sem
   conta de destino.
2. Essa lista usava os **mesmos identificadores** das formas reais da loja.
3. Ela ficava marcada como "criada aqui e ainda não enviada".
4. O download, ao chegar, preservava a cópia local, justamente para não
   perder o que foi feito no aparelho.
5. O envio seguinte **regravava a fábrica por cima** da configuração da
   loja.

A assinatura bate com os três eventos de 02/09, 03/09 e 09/09:

- sempre o aparelho da própria unidade;
- sempre os valores de fábrica exatos;
- o Dinheiro mantendo a conta do caixa, que é a única conta que a fábrica
  preenche.

As proteções de 01 a 04/09 fecharam as outras portas (download que falha,
login que limpava, aparelho atrasado), mas esta ficou aberta.

**A correção (V340).** Com a nuvem ligada, a lista gravada só recebe
valores de fábrica **depois** que o download terminou e confirmou que a
loja realmente não tem forma nenhuma, ou seja, uma loja nova. Até lá o
caixa usa a lista de exibição, que não é gravada nem enviada. O caixa nunca
fica sem forma de pagamento.

**Prova:**

- **Teste novo:** `testes/formas-esperam-download.js`, com 10 verificações.
  Ele **falha no código antigo** (2 falhas) e passa no novo.
- **Os três testes anteriores das formas continuam passando.**
- **O teste entrou no portão de publicação.**

**Camada no banco, proposta:** registrar e barrar no servidor uma gravação
que troca uma taxa configurada pelos valores exatos de fábrica e apaga a
conta de destino ao mesmo tempo. Fica como segunda proteção, a aprovar.

**Aparelho desatualizado.** Hoje nada impede uma versão velha de gravar,
porque o Joia só avisa que há versão nova. O sinal de aparelho (Etapa 2)
já registra a versão de cada um. A proposta é que o banco recuse a
gravação de **cadastro** (formas, taxas, contas, fichas) vinda de versão
abaixo da mínima.

- **Vendas nunca são recusadas.**
- A versão mínima sobe a cada correção de proteção.

### 5.3 Congelamento na venda (desenho)

Cada pagamento passa a gravar, **no momento da venda**:

- taxa percentual e taxa fixa aplicadas;
- prazo de recebimento e **data prevista**;
- **valor líquido previsto**;
- conta de destino;
- forma, bandeira e adquirente/equipamento;
- **versão do cadastro vigente**: data da última alteração da forma.

Os campos são gravados no pagamento, e o banco ganha as colunas
correspondentes em `pedido_pagamentos`. O fechamento de caixa, o relatório
por forma, o DRE e a API passam a ler o valor gravado. O cadastro só vale
para vendas novas.

**Vendas anteriores ao congelamento:**

- são recalculadas **uma vez** pela taxa correta confirmada pelo Rafael;
- ficam marcadas "condição reconstituída";
- nunca mais mudam.

### 5.4 Restauração das taxas de Santa Fé

**Precisa de confirmação.** Os últimos valores configurados pela loja,
antes da reversão, foram:

- débito **0,73%**;
- crédito **2,73%**;
- Pix, débito e crédito caindo na mesma conta bancária.

Com a confirmação do Rafael (taxas e conta), a restauração é feita no
banco na hora. Ela deve vir **junto com a V340**: sem a correção, um
aparelho novo pode reverter de novo.

---

## 6. Incidente de segurança — 12 cópias de segurança expostas

### 6.1 O que estava exposto

12 tabelas de cópia, criadas durante correções de dados, no esquema
público do banco **sem proteção por linha**:

| cópia | criada em | conteúdo | dados pessoais? |
|---|---|---|---|
| `bkp_whatsapp_config_20260916` | 16/09 | configuração do robô: nome da loja, textos, regras da atendente virtual | **sim**: nome e WhatsApp do gestor, da assistente e do número de relatórios |
| `bkp_whatsapp_config_20260916b` | 16/09 | idem | **sim**, idem |
| `bkp_fior_insumos_20260917` | 17/09 | insumos (nome, unidade, custo) | não |
| `bkp_fior_estoque_20260917` | 17/09 | saldos de estoque por unidade | não |
| `bkp_fior_fichas_20260917` | 17/09 | fichas técnicas (receitas, rendimento) | não |
| `bkp_fior_ficha_itens_20260917` | 17/09 | ingredientes das fichas | não |
| `bkp_fior_mov_20260917` | 17/09 | movimentos de estoque | não |
| `bkp_fior_catalogo_20260917` | 17/09 | catálogo de bases | não |
| `bkp_fior_notas_20260917` | 17/09 | notas de entrada: fornecedor, valores, itens | comercial (fornecedor é empresa) |
| `bkp_fichas_destino_20260917` | 17/09 | vínculo ficha → destino | não |
| `bkp_lanc_ref_errado_20260917` | 17/09 | lançamentos financeiros (descrição, valor, datas, fornecedor) | financeiro/comercial |
| `bkp_caixa_gemeo_20260921` | 21/09 | caixas duplicados: valores, **nome do operador** | **sim**: nome do operador |

- **Não havia senha, token, chave de API, CPF, cartão, nem dado de
  cliente.** A verificação dos campos sensíveis foi feita em 23/09.
- Receitas, custos e o financeiro são **informação comercial sensível**.

### 6.2 Período de exposição

- **Início:** de **16/09** (primeiras cópias) a **21/09** (última).
- **Fim:** contenção em **23/09/2026, por volta das 07h20** (Brasília).
- **Duração:** no máximo 7 dias.

### 6.3 Quem poderia acessar

- Quem tivesse a **chave pública do aplicativo**. Ela é pública de
  propósito: vai no código do site joiagest.com.br e só é segura quando
  cada tabela tem proteção por linha. Na prática, qualquer pessoa que
  soubesse usar a API do banco e conhecesse o nome da tabela.
- As chaves de integração da API do Joia **não** davam acesso a essas
  tabelas.
- A chave administrativa do banco não foi exposta.

### 6.4 Causa-raiz

Durante as correções de dados, antes de alterar registros, foram feitas
cópias com o comando que cria tabela a partir de consulta, no esquema
público. **Tabela criada assim nasce sem proteção por linha**, e o banco
entrega leitura à chave pública por padrão.

Foi uma falha de procedimento da equipe técnica (o assistente de
engenharia), não do aplicativo.

### 6.5 Contenção

Em 23/09 as 12 cópias foram:

- movidas para um esquema fora da API (`arquivo`);
- com proteção por linha ligada;
- com todo acesso da chave pública e de usuário logado revogado.

Nada foi apagado: as cópias continuam disponíveis para restauração pela
equipe técnica.

### 6.6 Medida contra recorrência

1. **No banco:** um gatilho de sistema **liga a proteção por linha
   automaticamente em qualquer tabela nova do esquema público**, seja qual
   for o comando que a criou. Já está escrito na alteração de banco deste
   pedido.
2. **No procedimento:** cópia de segurança só no esquema `arquivo`, que
   fica fora da API. Registrado no protocolo de engenharia.
3. **Na verificação:** o alerta de segurança do banco passa a ser
   conferido depois de toda correção de dados.

### 6.7 Registros de acesso — conferidos

- **Janela conferida:** 16/09/2026 00h00 a 24/09/2026 12h00 (UTC), o
  período inteiro da exposição e mais um dia. Os registros do banco
  estavam disponíveis desde 16/09, 00h00.
- **Onde:** todo o tráfego de entrada da API do banco (`edge_logs`), em
  janelas de 12 a 24 horas. Cerca de 45 a 60 mil requisições por dia.
- **Resultado: nenhuma requisição a qualquer tabela `bkp_`.** Ninguém leu,
  listou ou baixou as cópias pela API.
- **Prova de que a busca funciona:** a mesma consulta, aplicada a uma
  tabela usada todo dia (`whatsapp_config`), encontrou 378 requisições em
  12 horas.
- **Consulta à raiz da API** (que lista os nomes das tabelas): nenhuma na
  amostra conferida.

### 6.8 Rotação de chaves

- **Não é necessária** para as chaves de integração nem para a chave
  administrativa, porque nenhuma estava nas cópias.
- A **chave pública** não é segredo por natureza. Trocá-la exigiria
  publicar nova versão em todos os aparelhos, sem ganho de segurança.

### 6.9 LGPD — avaliação

- **Havia dado pessoal, limitado:** nomes e números de WhatsApp de
  gestores e da assistente, e nome de operador de caixa.
- Não havia dado sensível (art. 5º, II), dado de cliente nem dado
  financeiro de pessoa física.
- **Não houve acesso**, conforme os registros (6.7).

**Avaliação:** risco baixo aos titulares. Pela Resolução
CD/ANPD nº 15/2024, comunicação à ANPD e aos titulares é exigida quando o
incidente pode causar **risco ou dano relevante**. Com dado não sensível,
de poucos titulares, sem indício de acesso e já contido, a tendência é
**registro interno, sem comunicação**.

- **Conclusão técnica:** exposição potencial, sem acesso, contida em
  23/09.
- **Recomendação:** registro interno do incidente, sem comunicação à ANPD.
  A decisão final é do controlador (Jolô Gelato). Por transparência,
  recomenda-se avisar as pessoas cujo WhatsApp estava na cópia.
- Este registro deve ser guardado por no mínimo 5 anos (art. 10 da mesma
  resolução).

---

## 7. Lista de controle da limpeza cadastral

Cada correção fica no registro de auditoria (antes, depois, quem, quando).
O "antes" completo é a foto do item 1.

| # | tarefa | responsável | depende de | como fica registrado |
|---|---|---|---|---|
| 1 | Restaurar taxas e contas de destino de Santa Fé (com a V340) | técnico | confirmação do Rafael das taxas e da conta | histórico de `formas_pagamento` |
| 2 | Categorizar os 72 lançamentos | Raylan + RDS | relação nominal; regra do item 2 | histórico de `lancamentos_financeiros` |
| 3 | Dar custo aos 56 insumos (ou zero autorizado) | Raylan | relação nominal; nota ou custo conhecido | histórico de `insumos` |
| 4 | Corrigir os 2 produtos sem ficha | Raylan | relação nominal | histórico de `produtos` |
| 5 | Classificar os 13 motivos | Rafael + Raylan + RDS | proposta da seção 5 do diagnóstico | cadastro de motivos |
| 6 | Cadastrar as contas financeiras reais de Santa Fé | Rafael | dados bancários | histórico de `contas_capital` |
| 7 | Saldo e data de abertura de cada conta | Rafael | extrato na data de corte | cadastro da conta (o campo data entra na Etapa 3) |
| 8 | Fechar o caixa de Alphaville aberto desde 27/08 | Rafael ou gerente | nada | fechamento de caixa |
| 9 | CNPJ, cidade e demais dados das unidades | Rafael | dados das unidades | histórico de `sucursais` |
| 10 | Usuário individual por pessoa | Rafael | lista de pessoas e funções | cadastro de usuários |
| 11 | Revisar unidades de medida e fatores | Raylan + técnico | nada | histórico de `insumos` |
| 12 | Revisar fichas, rendimentos, insumos e subfichas | Raylan | nada | histórico de `fichas_tecnicas` / `ficha_itens` |
| 13 | Monitoramento de sincronização por aparelho | técnico | publicação já feita (V339) | `/saude-sincronizacao` |
| 14 | Inventário físico na data de corte | Santa Fé + RDS | itens 1 a 12 | contagem de estoque |

**Relatório de antes e depois:**

- **Antes:** a foto gravada.
- **Depois:** a mesma extração no dia do corte.
- **Diferença:** o `/historico` do período, com quem corrigiu cada item e
  quando.

---

## 8. Chave "RDS Inteligência Gerencial"

### 8.1 O que foi preparado

| exigência | como fica |
|---|---|
| somente leitura | a API não tem caminho de escrita; qualquer método diferente de GET é recusado |
| rede Jolô inteira, unidades atuais e futuras | a chave vale para a rede, **sem unidade fixa**: unidade nova entra sozinha |
| consolidados, analíticos, cadastros, sincronização, alterações, histórico e pendências | todos os caminhos da API 2.2 |
| revogação e rotação independentes | cada chave tem registro próprio: desativar uma não afeta outra; rotação cria a nova ligada à anterior (`rotacionada_de`) e desativa a antiga com data e motivo |
| quantidade de usos e último uso | contados **no banco, numa só gravação** (antes era ler-e-somar, que perdia contagem em chamadas simultâneas) |
| limite de chamadas | **120 por minuto** por chave, ajustável; passou disso, a resposta é "429" com o horário em que libera, e a recusa é contada |
| sem acesso administrativo ao banco | a chave só abre a API do Joia; não serve para o banco |
| sem escrita | idem |
| dados pessoais | **máscara ligada**: nome de cliente vira iniciais, telefone e CPF só os últimos dígitos, endereço omitido; operador e conta da unidade continuam inteiros, porque são o "quem fez" da auditoria |
| entrega por canal separado | a chave é gerada uma vez, só o resumo criptográfico fica no banco e ela não aparece em documento nem código; vai para o Rafael, que a entrega à RDS por mensagem direta |

**Situação:** criada em 24/09/2026.

| campo | valor |
|---|---|
| nome | RDS Inteligência Gerencial |
| prefixo | `joia_rds_-b82` |
| alcance | rede toda |
| limite | 120 chamadas por minuto |
| máscara | ligada |
| usos | 0 |

A chave completa foi entregue ao Rafael por mensagem, para ele repassar à
RDS por canal direto.

**Testes** (simulação da API sem rede, 10 verificações, todas certas):

- lista de pendências e relação nominal;
- pendência inexistente;
- limite de chamadas;
- máscara ligada e desligada;
- **duas chamadas simultâneas de chaves diferentes não trocam a máscara
  uma da outra**;
- chave inválida;
- ajuda.

As 17 rotas da versão anterior continuam respondendo igual. Depois, o
**teste em produção** (seção de situação, no início).

### 8.2 A chave "RDS Auditoria" de 23/09

Continua funcionando até a RDS confirmar que passou a usar a nova. Depois
é desativada, com data e motivo registrados.

---

## 9. O que exige nova versão nos aparelhos

| mudança | nova versão no aparelho? |
|---|---|
| `/pendencias`, chave nova, limite, máscara (itens 1 e 8) | **não**: é só API e banco |
| proteção contra tabela nova sem RLS (item 6) | **não**: só banco |
| correção da reversão das taxas (5.2) | **sim**: V340, pronta e testada, aguardando o de acordo |
| categoria do lançamento chegando à nuvem (2.1) | **sim**: vai junto na V340 |
| correção do DRE (abaixo) | **sim**: vai junto na V340 |
| travas de lançamento, insumo e produto (2, 3, 4) | **sim**: depois do de acordo neste desenho |
| congelamento das condições de pagamento (5.3) | **sim**: aparelho e banco |
| recusa de cadastro vindo de versão antiga (5.2) | só banco, mas precisa da V340 publicada antes |

### Achado extra — CPV em dobro no DRE (corrigido na V340)

- **O defeito:** o DRE deveria ignorar a compra lançada pela nota na
  rubrica de CPV, porque o CPV é o consumo das vendas. A trava procurava a
  origem `nota`, mas a nota grava `nota-entrada`. Uma compra classificada
  numa subcategoria ligada ao CPV entrava **em cima** do consumo, e o
  mesmo custo era contado duas vezes.
- **A prova:** o teste do DRE ganhou o caso. No código antigo ele dá
  CPV 511 em vez de 11; no novo, 11.
- **O impacto real** depende de alguma subcategoria de compra estar ligada
  à rubrica 02 na configuração do DRE da rede. Isso será conferido.

---

## Evidências de teste

- `testes/formas-esperam-download.js`: 10/10. Falha no código antigo.
- `testes/categoria-do-lancamento-sobe.js`: 9/9. Falha no código antigo
  (3 falhas).
- `testes/dre-arvore.js`: novo caso de CPV. Falha no código antigo.
- Os testes anteriores de formas, login e aparelho atrasado seguem
  verdes.
- API 2.2: 10/10 no teste novo e 17/17 no anterior.
- **Portão de publicação completo da V340: 10 etapas, todas passaram** — bateria de testes, varredura das 94 telas, auditoria visual no Chromium (computador e celular), provas dos fluxos da loja e persistência da configuração.

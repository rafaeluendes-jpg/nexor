# PRD — Módulo Fiscal do Joia
### Cupom fiscal (NFC-e) nas lojas · Nota fiscal (NF-e) na matriz
**Versão 1.1 · 28/09/2026 · Rede Jolô Gelato · Provedor: Spedy**
*1.1: seção 9 conferida contra a especificação oficial da Spedy (OpenAPI v1) e um
teste real no sandbox.*

> Como usar este documento: ele tem duas metades. Da seção 1 à 8 é o **produto** —
> o que o módulo faz, quem usa, como cada tela se comporta. Da 9 à 17 é a
> **engenharia** — integração, banco, testes e travas. Quem for construir as telas
> precisa das duas: a parte de cima diz o que tem de aparecer, a de baixo diz o que
> não pode quebrar.

---

## 1. Resumo

O Joia hoje registra toda venda, mas não emite documento fiscal. Este módulo fecha
esse buraco:

- **Cupom fiscal (NFC-e, modelo 65)** — emitido na frente de caixa, em **todas as
  lojas**, com liga/desliga e regras **por unidade**.
- **Nota fiscal (NF-e, modelo 55)** — **só na matriz**: venda para CNPJ,
  transferência entre unidades, devolução e nota complementar.
- **Configuração de impostos** feita por quem não é contador: perfis prontos,
  aplicados em massa, com o cadastro item a item disponível para quem quiser.
- Quem assina e transmite para a SEFAZ é a **Spedy**. O Joia monta os dados,
  manda, acompanha e guarda o resultado.

**Regra que manda em todas as outras:** *a venda nunca para por causa do fiscal*.
Se a SEFAZ cair, se a internet cair, se a nota for rejeitada — o caixa continua
vendendo e o cupom se resolve depois.

---

## 2. Por que agora

| Fato | Consequência |
|---|---|
| Em São Paulo o **SAT foi encerrado** e a **NFC-e passou a ser obrigatória em 01/01/2026** para todo o varejo (Portaria SRE 79/2024, que alterou a CAT 147/2012) | As três lojas SP da rede (Santa Fé do Sul, Jales, Alphaville) precisam emitir NFC-e — não é opcional |
| A NFC-e exige **certificado e-CNPJ A1**, **credenciamento na SEFAZ** e **CSC** (código de segurança do contribuinte) por CNPJ | Cada unidade tem credenciais próprias. Não existe "a configuração da rede" |
| Reforma tributária: campos de **IBS/CBS** obrigatórios em produção desde **03/08/2026** para regime normal e a partir de **04/01/2027** para **Simples Nacional/MEI** | Se as lojas são Simples, há folga até jan/2027 — mas o módulo já nasce preparado, e quem monta o XML é a Spedy |
| Sorvete é mercadoria com **substituição tributária** em quase todo o país; a NFC-e é **rejeitada sem CEST** | O cadastro de produto precisa de NCM **e** CEST desde o primeiro dia |

Fontes ao final (seção 18).

---

## 3. Escopo

### Entra
1. Configuração fiscal **por unidade** (emitente, credenciais, séries, modo).
2. Perfis fiscais (impostos) da rede, com presets de gelateria.
3. Campos fiscais no cadastro de produto (NCM, CEST, CFOP, perfil, unidade tributável).
4. Emissão de NFC-e no fechamento da venda (PDV, mesa, totem, pedido do cardápio).
5. Acompanhamento das notas: autorizada, rejeitada, em contingência, cancelada.
6. Cancelamento de NFC-e dentro do prazo.
7. Reenvio/correção de nota rejeitada.
8. Inutilização de numeração.
9. DANFE (PDF) e XML: ver, imprimir, baixar, mandar por WhatsApp/e-mail.
10. NF-e na matriz: venda a CNPJ, transferência entre unidades, devolução, complementar.
11. Carta de correção (só NF-e).
12. Painel de situação fiscal e conferência diária "toda venda tem nota".
13. Exportação para a contabilidade (XMLs do período + planilha).

### Não entra (agora)
- NFS-e (nota de serviço) — a rede não presta serviço tributado por ISS.
- SPED/EFD, apuração de imposto, guia de recolhimento — é trabalho do contador.
- Emissão offline própria (sem provedor). A contingência é a da Spedy.
- Agrupamento de cupons em NF-e mensal (existe rascunho na tela atual; fica **desligado**
  até o contador autorizar por escrito — ver 7.5).

---

## 4. Quem usa

| Perfil | O que pode |
|---|---|
| **Operador de caixa** | Emitir cupom ao fechar a venda; informar CPF na nota; reimprimir DANFE; ver se a nota saiu. **Não** cancela, **não** configura, **não** vê chave nem CSC |
| **Gerente da loja** | Tudo do operador + cancelar cupom dentro do prazo, reenviar nota rejeitada, ver o painel da **sua** unidade |
| **Franqueado** | Tudo do gerente na unidade dele + configuração fiscal da unidade (exceto credenciais da rede) |
| **Matriz / franqueadora** | Tudo, em todas as unidades + perfis fiscais da rede + NF-e + exportação para a contabilidade |
| **Contador (acesso de leitura)** | Ver e baixar notas, XMLs e relatórios de todas as unidades. Não emite, não cancela, não configura |

Permissões novas (padrão do sistema, `modulo/tela`):
`fiscal/emitir`, `fiscal/cancelar`, `fiscal/configurar`, `fiscal/notas`, `fiscal/nfe`,
`fiscal/exportar`.

**Regra de acesso testada no aparelho de quem sofre a regra** (protocolo permanente):
o operador entra e não enxerga configuração nem cancelamento; o contador entra e não
enxerga botão de emitir.

---

## 5. O que já existe no Joia (aproveitar, não refazer)

| Existe hoje | Onde | O que fazer |
|---|---|---|
| Tela **Configuração Fiscal** (`loja/fiscal` e `loja/dados-fiscais` → `telaFiscalCfg`) com provedor, token, ambiente, séries, emitente, CSC, validade do certificado e padrões de produto | `src/js/07-roteador/09-modulo-pdv/02-transferencia-e-mais-6.js` | **Reaproveitar o desenho**, mas passar a guardar **por unidade** e trocar a lista de provedores por Spedy |
| **Registro de cupom em toda venda** (`registrarCupom`), chamado no PDV e no totem | mesmo arquivo + `03-pdv.js`, `01-liberacao-e-mais-3.js` | Continua sendo o ponto de partida: o cupom nasce `pendente` e o módulo assume daí |
| Tela **Cupons Gerados** (`relatorios/cupons-fiscais`) com filtros, status, exportar CSV | mesmo arquivo | Vira **Notas Emitidas**, com as ações de verdade ligadas |
| Tabela **`cupons_fiscais`** no Supabase, já sincronizada | `03-armazenamento/01-inicio.js` (MAPA) | Ampliar colunas; continua sendo a tabela do cupom |
| Campo **NCM** no produto | `08-modulo-cardapio.js` | Ganha CEST, CFOP, perfil fiscal e unidade tributável |
| Status já previstos: autorizado, pendente, contingência, rejeitado, cancelado | `STATUS_CUPOM` | Mantidos, mais `enviando` e `inutilizado` |

**O que muda de fundo:** hoje a configuração fiscal mora em `DB.config` — que é **da
rede**. Isso mistura CNPJ, IE, CSC e numeração de lojas diferentes, exatamente o
defeito que derrubou a Carla em 26/09/2026. A configuração fiscal passa a morar em
`DB.fiscal[sucursalId]`, como já acontece com o cardápio e o robô.

---

## 6. As regras do módulo

1. **Cada unidade é um emitente.** CNPJ, IE, certificado, CSC, série e numeração são
   da unidade. Nada é herdado de outra loja. Nunca.
2. **A venda manda no fiscal, não o contrário.** Erro de nota nunca impede fechar a
   venda, nunca segura a fila do caixa, nunca apaga o pedido.
3. **Uma venda, uma nota.** O número do pedido viaja como `integrationId` na Spedy:
   se a mesma venda for enviada duas vezes (timeout, clique duplo, reenvio), a
   segunda **atualiza** a primeira em vez de criar nota nova.
4. **NF-e só na matriz.** A tela nem aparece para quem não é matriz; o servidor
   também recusa. Duas trancas.
5. **Cupom configurável por loja:** cada unidade escolhe `Sempre fiscal`,
   `Sob demanda` ou `Desligado`, e o ambiente (`Homologação` ou `Produção`).
6. **Produção é decisão consciente.** Trocar de homologação para produção exige
   confirmação escrita na tela, com o CNPJ à vista.
7. **Credencial não volta para a tela.** Chave da API, CSC e senha do certificado
   são gravados e nunca exibidos de novo (o sistema já faz isso com o token).
8. **A chave da API não mora no navegador** — ver seção 12.
9. **Contingência é automática** (a Spedy decide). O Joia só mostra o estado e avisa
   quando a nota se regulariza.
10. **Nada de dado inventado.** Sem NCM/CEST/CFOP o produto não vai para a nota: o
    sistema avisa **antes**, na tela de pendências, e não "chuta" imposto.

---

## 7. As telas

> Padrão visual: o do sistema. Componentes, cores por token (`--acc`, `--red`,
> `--red-soft`…), `etWrap/etScroll/etTopo`, `cfgDuas/cfgCol`, `fld2`, `filtroCard`,
> `blAviso`. Nada de aparência nova. Toda tela que altera dado tem **botão Salvar**,
> aviso de alteração não salva e "Tudo salvo" só depois que a nuvem confirmou.

### 7.1 Configuração Fiscal da unidade — `loja/fiscal`
**Quem vê:** franqueado (só a dele), matriz (escolhe a unidade no topo).

Cabeçalho: seletor de unidade (só para a matriz) + faixa de situação:
- verde `Emitindo em produção — 128 notas hoje`
- âmbar `Em homologação — os cupons não valem como documento fiscal`
- vermelha `Falta para emitir: …` (lista de pendências, como já existe hoje)

**Aba 1 — Emissão**
| Campo | Tipo | Regra |
|---|---|---|
| Modo | seleção | Sempre fiscal / Sob demanda / Desligado |
| Ambiente | seleção | Homologação / Produção (troca exige confirmação com CNPJ à vista) |
| Série da NFC-e | número | padrão 1 |
| Próximo número | número, só leitura | vem da Spedy; botão "conferir" |
| Pedir CPF na nota | seleção | Nunca perguntar / Perguntar em toda venda / Perguntar acima de R$ ___ |
| Imprimir o cupom | seleção | Sempre / Perguntar / Só QR Code na tela |
| Mandar por WhatsApp | liga/desliga | usa o robô já existente, quando há telefone do cliente |
| Contingência offline | liga/desliga | espelha `consumerInvoice.allowOfflineContingency` na Spedy |

**Aba 2 — Empresa (emitente)**
CNPJ, IE, razão social, nome fantasia, endereço completo com código IBGE do
município, regime tributário (Simples Nacional / Simples excesso de sublimite / MEI /
Regime Normal), CNAE principal, e-mail e telefone.
→ Preenchido a partir do cadastro da **Sucursal**, com aviso quando divergir.
→ Botão **Enviar certificado A1** (.pfx + senha) — sobe direto para a Spedy, nunca
fica no aparelho. Mostra validade e avisa 30/15/7 dias antes de vencer.

**Aba 3 — Credenciais**
Chave da API da Spedy (por unidade), ID do CSC e CSC (obtidos no portal da SEFAZ-SP).
Todos gravados, nenhum exibido de volta. Botão **Testar conexão** → chama a Spedy em
sandbox/produção e responde em português: *"Conectado — empresa Jolô Santa Fé
(CNPJ …), NFC-e habilitada."*

**Aba 4 — Situação**
Certificado (validade), CSC (cadastrado/não), credenciamento na SEFAZ, últimas 10
notas com status, notas rejeitadas em aberto, notas em contingência aguardando,
faixa de numeração em uso e buracos de numeração (candidatos a inutilização).

### 7.2 Perfis Fiscais da rede — `loja/perfis-fiscais`
**Quem vê:** matriz. É aqui que mora a parte chata do imposto — uma vez só, para toda
a rede.

Cada perfil é uma linha com nome em português e, escondido atrás de "detalhes", os
códigos. Presets que já vêm prontos:

| Perfil | Para que serve | Simples Nacional | Regime Normal |
|---|---|---|---|
| **Gelato e sorvete (ST)** | o que a loja revende e já veio com imposto pago na origem | CSOSN **500** + base e valor de ST retido | CST **60** |
| **Gelato de produção própria** | quando a loja é a fabricante (CFOP 5101) | CSOSN **102** | CST **00** com alíquota interna |
| **Bebidas e industrializados (ST)** | refrigerante, água, chocolate | CSOSN **500** | CST **60** |
| **Revenda comum** | item sem ST (CFOP 5102) | CSOSN **102** | CST **00** |
| **Isento / não tributado** | brinde, bonificação | CSOSN **400** | CST **40/41** |

> **Correção (28/09/2026):** a primeira documentação da Spedy chamava o CSOSN 400
> de "tributada sem crédito". Está errado: **400 é "não tributada pelo Simples"**.
> Venda tributada no Simples, sem crédito, é **CSOSN 102**. Os perfis do sistema
> já saem com o código certo.

Cada perfil guarda: CFOP padrão (5102 · venda interna; 5405 · venda de ST ao consumidor),
origem (0 = nacional), CST/CSOSN de ICMS, CST de PIS e COFINS (Simples: **07** —
isento), alíquotas quando houver, e observação livre para o contador.

Ações: **aplicar a uma categoria inteira** ("aplicar 'Gelato (ST)' a todos os 84 itens
de Gelatos"), ver quantos produtos usam cada perfil, e uma barra **"produtos sem
perfil: 12"** que leva direto à lista.

> Aviso fixo na tela, em caixa cinza: *"Quem decide qual perfil vale para cada produto
> é o seu contador. O sistema aplica o que você mandar e guarda o histórico de quem
> mudou o quê."*

### 7.3 Produto → aba Fiscal — dentro do cadastro de produto do cardápio
Campos: **NCM** (com busca por nome: "sorvete de massa com leite" → `21050010`),
**CEST** (sugerido pelo NCM: `1701100` para sorvete com leite, `1701200` para sorbet),
**perfil fiscal** (lista da 7.2), **CFOP** (herda do perfil, editável), **unidade
tributável** (UN, KG, LT) e **valor aproximado de tributos** (opcional, Lei 12.741).

Na listagem de produtos, uma coluna "Fiscal" com bolinha verde/vermelha e filtro
**"só os incompletos"**. Preenchimento em massa: selecionar vários → aplicar perfil.

### 7.4 PDV — a emissão na frente de caixa
O fluxo atual de finalizar venda **não muda de forma**. O que entra:

1. Na tela de pagamento, conforme a configuração: **"CPF na nota?"** com teclado
   numérico grande, botão **Sem CPF** e validação do dígito.
2. Ao confirmar a venda: a venda é gravada **primeiro** (como hoje), e a nota sai em
   seguida, em segundo plano.
3. Faixa de estado na tela, sem travar nada:
   - `Emitindo cupom…` (cinza, com contador)
   - `Cupom 1.234 autorizado` (verde) + botões **Imprimir**, **QR Code**, **WhatsApp**
   - `Cupom emitido em contingência — a SEFAZ está fora do ar. Vale como documento e
     será transmitido sozinha.` (âmbar)
   - `A Receita recusou: CEST não informado no item "Casquinha". A venda está
     salva — resolva em Notas Emitidas.` (vermelha) — sempre com **o que fazer**
4. **Nunca** um alerta que exija clique para continuar vendendo.
5. No modo *Sob demanda*, botão **Emitir cupom** na venda já fechada, e também na
   lista de vendas do dia.

### 7.5 Notas Emitidas — `fiscal/notas` (evolução de "Cupons Gerados")
Mantém filtros e exportação que já existem. Ganha:

- Colunas: data/hora, venda, tipo (**Cupom** ou **Nota**), número/série, chave,
  cliente, valor, situação.
- Por linha: **Ver** (com motivo da rejeição em português), **DANFE**, **XML**,
  **Cancelar**, **Reenviar corrigido**, **WhatsApp**.
- Ações em lote: baixar XMLs do período (.zip), exportar planilha da contabilidade.
- **Cancelar**: só autorizada, dentro do prazo (NFC-e: 30 minutos; NF-e: 24 horas),
  justificativa com no mínimo 15 caracteres, contador regressivo à vista
  (`faltam 21 min`). Fora do prazo a tela diz o caminho: nota de devolução, com o
  contador.
- **Inutilizar numeração**: faixa de números não usados + justificativa.
- O botão **NF-e agrupada** que existe hoje fica **oculto** até autorização por
  escrito do contador (hoje ele só marca status e pode gerar dupla escrituração).

### 7.6 Nota Fiscal (NF-e) — `fiscal/nfe` · **só matriz**
Quatro caminhos, cada um um botão grande:

1. **Venda para empresa (CNPJ)** — busca o cliente, itens, pagamento, finalidade
   *normal*, CFOP 5102/6102 conforme o estado do destinatário.
2. **Transferência entre unidades** — de/para unidade da rede, itens vindos do módulo
   de Transferência de Mercadoria que já existe, CFOP 5152/6152.
3. **Devolução** — a partir de uma nota de entrada, finalidade *devolução*.
4. **Complementar** — ajuste de valor/imposto sobre nota existente.

Mais: **Carta de correção** (só NF-e, texto livre, avisando o que a CC-e não corrige),
lista própria e o mesmo acompanhamento de status.

### 7.7 Painel Fiscal — `fiscal/painel`
Uma tela por unidade (matriz vê a rede em lista):
notas de hoje (autorizadas/rejeitadas/em contingência), vendas **sem** nota,
certificado a vencer, CSC faltando, produtos sem NCM/CEST, e um botão
**"Conferir tudo agora"** que reprocessa as pendentes.

### 7.8 Conferência do dia (dentro do fechamento de caixa)
No fechamento, uma linha a mais: **"Vendas do dia: 212 · Notas autorizadas: 212"**.
Se houver diferença, lista as vendas sem nota, com botão de emitir. Não impede
fechar o caixa — informa.

---

## 8. Mensagens ao operador (texto exato)

| Situação | Mensagem |
|---|---|
| Emitindo | `Emitindo o cupom…` |
| Autorizada | `Cupom 1.234 autorizado.` |
| Contingência | `A SEFAZ está fora do ar. O cupom foi emitido em contingência: vale como documento e será transmitido sozinho quando ela voltar.` |
| Rejeitada | `A Receita recusou este cupom: <motivo em português>. A venda está salva. Corrija e reenvie em Notas Emitidas.` |
| Sem internet | `Sem internet — o cupom sai assim que a conexão voltar. A venda já está registrada.` |
| Sem configuração | `Esta loja ainda não está configurada para emitir. Fale com a matriz.` |
| Cancelamento fora do prazo | `Passou o prazo de cancelamento (30 minutos). O caminho agora é a nota de devolução — fale com seu contador.` |
| Produto incompleto | `O produto "<nome>" está sem CEST, e a Receita exige. Corrija no cadastro do produto.` |

Nada de código de erro cru na tela. O código técnico fica no detalhe da nota, para
quem for investigar.

---

## 9. Integração com a Spedy

**Base:** `https://api.spedy.com.br/v1` · sandbox `https://sandbox-api.spedy.com.br/v1`
**Autenticação:** header `X-Api-Key`, **uma chave por empresa (CNPJ)** —
ou seja, **uma chave por unidade da rede**.
**Limite:** 60 requisições/minuto e 5/segundo por chave. O caixa de uma loja não
chega perto disso; a fila de reprocessamento respeita o limite.

### 9.1 Cadastro das unidades
- Cada unidade vira uma **empresa** na Spedy (`POST /v1/companies`), criada pela
  empresa *owner* (matriz). A resposta traz `apiCredentials.apiKey` → é a chave
  daquela unidade.
- Certificado: `POST /v1/companies/{id}/certificates` (multipart, campos
  `certificateFile` + `password`). `GET` no mesmo caminho lista os certificados com
  `isActive` e `expirationAt` — é daí que sai o aviso de vencimento.
- Configuração: `PUT /v1/companies/{id}/settings`, bloco `consumerInvoice` com
  `tokenId`, `csc`, `series`, `nextNumber`, `environmentType`
  (`production` · `development` · `simulation`) e `allowOfflineContingency`.
- Guardar no Joia: `spedy_company_id` por unidade.

### 9.2 Emissão do cupom — `POST /v1/consumer-invoices`
Todos os dados tributários vão na chamada (a NFC-e não usa a configuração do
backoffice da Spedy). Mapeamento campo a campo:

| Spedy | De onde vem no Joia |
|---|---|
| `integrationId` | `pedido.id` (idempotência — **obrigatório**) |
| `isFinalCustomer` | sempre `true` |
| `operationType` | `outgoing` |
| `destination` | `internal` |
| `presenceType` | `presence` (balcão/mesa/totem) ou `internet` (pedido do cardápio) |
| `operationNature` | `Venda de Mercadoria` |
| `receiver.federalTaxNumber` | CPF informado no PDV (omitido quando não houver) |
| `receiver.name` | nome do cliente, quando houver |
| `items[].code` | `produto.id` ou código interno |
| `items[].description` | nome do produto como sai no cupom |
| `items[].ncm` / `cest` | cadastro do produto |
| `items[].cfop` | perfil fiscal do produto |
| `items[].unit` / `quantity` / `unitAmount` / `totalAmount` | item da venda |
| `items[].taxes.icms` | perfil fiscal: `origin` + `csosn` (Simples) ou `cst`+`rate` (normal); ST → `stRetentionAmount`, `baseStRetentionAmount` |
| `items[].taxes.pis` / `cofins` | perfil fiscal (Simples: `cst: 7`) |
| `payments[].method` | forma de pagamento do Joia → enum da Spedy: `money` (dinheiro), `creditCard`, `debitCard`, `pix`, `dynamicPix`, `mealVoucher`, `foodVoucher`, `giftVoucher`, `storeCredit`, `fidelityProgram` (brinde do cartão fidelidade), `noPayment`, `other`. **Não** é `cash` nem código numérico — a Spedy recusa |
| `payments[].amount` | valor por forma (venda com duas formas manda duas linhas) |
| `total.invoiceAmount` / `productAmount` | totais da venda |
| `items[].totalTax` | valor aproximado de tributos (Lei 12.741), quando houver |
| `items[].taxes.ibsCbs` | reforma tributária — só quando o regime exigir (Simples: a partir de 04/01/2027) |

**Descontos e taxa de entrega** entram no item (`discountAmount`) e no total, e a
soma dos itens tem de bater com o total — a Spedy valida.

### 9.3 Acompanhamento
- **Webhook** é o caminho principal: `POST /v1/webhooks` com
  `event: "invoice.status_changed"`, apontando para uma função no Supabase
  (seção 12). Cobre autorizada, rejeitada, cancelada e contingência.
- **Polling** é o reserva: `GET /v1/consumer-invoices/{id}` a cada 5–10 s até um
  estado final. Nunca usar `check-status` para acompanhar — ele é consulta síncrona
  ao fisco, para destravar nota já enviada, e devolve 400 enquanto está na fila.
- Estados da Spedy → estados do Joia:

| Spedy | Joia |
|---|---|
| `created`, `enqueued`, `received` | **Enviando** |
| `authorized` | **Autorizado** |
| `inContingent` | **Contingência** |
| `rejected` | **Rejeitado** (com `processingDetail.message` traduzido) |
| `canceled` | **Cancelado** |
| `denied` | **Denegado** (tela explica: problema no CPF/CNPJ do destinatário) |
| `disabled` | **Inutilizado** |

### 9.4 Correção, cancelamento e inutilização
- **Rejeitada:** corrigir e reenviar `POST /v1/consumer-invoices` com o **mesmo
  `integrationId`** — atualiza a nota, não cria outra.
- **Cancelar:** `DELETE /v1/consumer-invoices/{id}` com corpo `{ "reason": "…" }`
  (mínimo 15 caracteres). É **assíncrono**: a nota passa por `canceled` depois —
  acompanhar como a emissão. Em contingência o cancelamento não existe.
- **Inutilizar:** `POST /v1/consumer-invoices/disablements` com `series`,
  `initialNumber`, `finalNumber` e `reason`.
- **Reemitir sem mudar dados** (depois de corrigir configuração da empresa, ex.:
  o CSC): `POST /v1/consumer-invoices/{id}/issue`.
- **NF-e:** mesmos caminhos em `/v1/product-invoices`; carta de correção com o
  texto no campo `letter` (15 a 1000 caracteres).

### 9.5 Assinatura do webhook
Os webhooks vêm assinados no padrão *Standard Webhooks*, no header
`webhook-signature`. O segredo da conta sai em `GET /v1/webhooks/secret` e troca
com `POST /v1/webhooks/secret/rotate` (os dois valem juntos durante a troca). A
função que recebe o webhook **recusa** o que não vier assinado.

### 9.6 O que o teste real já provou (28/09/2026, sandbox)
- A chave entregue pelo Rafael é do **ambiente de testes** e responde: empresa
  *JOLO GELATO LTDA*, CNPJ 42.771.278/0001-02, Santa Fé do Sul/SP.
- Um cupom de gelato (NCM 21050010, CEST 1701100, CFOP 5405, CSOSN 500, PIS/COFINS
  07, pagamento `pix`) **passou pela validação** e entrou na fila.
- Foi recusado só por falta de configuração da empresa: *"TokenId e CSC da NFC-e são
  obrigatórios"*. A inscrição estadual também está vazia no cadastro da Spedy.

### 9.7 Arquivos
`GET …/{id}/pdf` (DANFE) e `GET …/{id}/xml` — **não exigem chave**, então a URL pode
ir direto para a impressora, para o WhatsApp do cliente e para a exportação da
contabilidade. Guardar as duas URLs na linha da nota.

---

## 10. Modelo de dados

### Supabase (novas tabelas e colunas)
```
fiscal_config            (uma linha por unidade)
  loja_id, sucursal_id, ref_local ('fx_'+suc)
  modo, ambiente, serie, pede_cpf, pede_cpf_acima, imprime, manda_whatsapp
  cnpj, ie, razao_social, nome_fantasia, regime, cnae, endereco(jsonb), ibge
  spedy_company_id, certificado_validade, contingencia_offline
  atualizado_em
  -- segredos NÃO ficam aqui: ver seção 12

fiscal_perfis            (da rede)
  loja_id, ref_local, nome, regime, icms(jsonb), pis(jsonb), cofins(jsonb),
  cfop, origem, observacao, ativo

notas_fiscais            (NF-e da matriz; mesma forma de cupons_fiscais)
  loja_id, sucursal_id, ref_local, modelo('55'), finalidade, destinatario(jsonb),
  itens(jsonb), numero, serie, chave, protocolo, status, motivo,
  spedy_id, integration_id, pdf_url, xml_url, valor_total, emitido_em

fiscal_eventos           (trilha: quem fez o quê)
  loja_id, sucursal_id, nota_ref, tipo(emissao|cancelamento|correcao|inutilizacao),
  usuario, quando, payload_resumo, resultado

cupons_fiscais           (já existe — colunas novas)
  + spedy_id, integration_id, pdf_url, xml_url, cest_faltando(bool),
    tentativas, ultimo_erro, emitido_em
```

Índice único em `(loja_id, integration_id)` — a segunda tranca contra nota duplicada.

### No aparelho (`DB`)
`DB.fiscal[sucursalId]` (configuração da unidade), `DB.fiscalPerfis` (rede),
`DB.cupons_f` (já existe), `DB.notas_f` (NF-e), e campos novos em `DB.produtos`:
`ncm`, `cest`, `cfop`, `perfilFiscal`, `unidadeTrib`.

---

## 11. O que nunca pode acontecer (as travas)

Cada item vira um **guardião** em `testes/`, registrado em `ferramentas/travas.json`:

1. Venda travada, perdida ou não gravada por causa de erro fiscal.
2. Duas notas para a mesma venda (clique duplo, reenvio, timeout).
3. Nota saindo com CNPJ, IE, série ou nome de **outra unidade**.
4. Configuração de uma loja gravando na configuração de outra.
5. Chave da API, CSC ou senha do certificado aparecendo na tela, no HTML, no log ou
   no backup.
6. Emissão em **produção** sem que alguém tenha confirmado a troca de ambiente.
7. Cupom cancelado sem justificativa ou fora do prazo passando como "cancelado".
8. Operador conseguindo cancelar ou configurar.
9. NF-e sendo emitida por unidade que não é a matriz.
10. Produto sem NCM/CEST indo para a nota (tem de barrar **antes**, com aviso).
11. Publicar código repondo configuração de fábrica por cima do que a loja ajustou.

---

## 12. Segurança da chave

O Joia roda no navegador. Chave de API no navegador é chave publicada. Então:

- A chave da Spedy de cada unidade fica **no Supabase**, no mesmo cofre que já guarda
  as chaves do sistema (`api_chaves`, service_role), **nunca** em `DB`, nunca no
  `index.html`, nunca no backup.
- O PDV chama uma **edge function `joia-fiscal`**, com o token da sessão de quem está
  logado. A função confere permissão e unidade, busca a chave daquela unidade, monta
  o JSON e fala com a Spedy. A chave nunca chega ao aparelho.
- O **webhook** da Spedy aponta para a edge function `joia-fiscal-webhook`, que é
  pública mas: confere um segredo próprio na URL, aceita só os eventos conhecidos,
  e nunca confia no corpo para decidir de qual loja é a nota — usa o `integrationId`
  e o CNPJ do payload.
- Certificado A1 (.pfx) e senha vão do navegador **direto para a Spedy** via edge
  function, sem passar por `DB` nem pelo Supabase.

---

## 13. Entrega em fases

| Fase | O que entrega | Pronto quando |
|---|---|---|
| **F1 — Fundação** | Configuração por unidade, perfis fiscais, campos no produto, painel de pendências | Uma loja aparece "pronta para emitir" sem nenhuma pendência |
| **F2 — Cupom em homologação** | Emissão, acompanhamento, DANFE/XML, cancelamento, reenvio — ambiente de teste, em Santa Fé | 50 vendas seguidas viram cupom autorizado no sandbox |
| **F3 — Cupom em produção** | Santa Fé emitindo de verdade, com contingência e conferência diária | Um dia inteiro de operação sem venda sem nota |
| **F4 — Rede** | Jales, Alphaville e as próximas, cada uma com credencial própria | Cada loja emite com o CNPJ dela; nenhuma vê a da outra |
| **F5 — NF-e na matriz** | Venda a CNPJ, transferência, devolução, complementar, carta de correção | Uma transferência real entre unidades com XML aceito |
| **F6 — Contabilidade** | Exportação mensal (XMLs + planilha), acesso de leitura do contador | O contador baixa o mês fechado sem pedir nada a ninguém |

---

## 14. Como se prova que está pronto

Além do portão de publicação (11 etapas, `node ferramentas/portao.js`):

- **Guardiões novos** para cada trava da seção 11.
- **Sandbox da Spedy** com as 12 situações reais: venda simples, venda com CPF,
  duas formas de pagamento, desconto, entrega com taxa, item ST, item sem ST,
  venda cancelada em 5 minutos, venda cancelada em 40 minutos, rejeição por CEST,
  SEFAZ fora do ar (contingência), reenvio corrigido.
- **Prova no Chromium** (`ferramentas/provar.js`): vender, emitir, recarregar a
  página e conferir que a nota continua lá com o mesmo número.
- **Conferência de nuvem** (`ferramentas/conferir-nuvem.js`) para as tabelas novas.
- **Fotos das telas** em computador (1440) e celular (390) — o cupom e o DANFE
  precisam caber no celular do balcão.

---

## 15. O que depende do Rafael (e só dele)

1. Contratar a Spedy e entregar a **chave da empresa owner**.
2. Certificado digital **e-CNPJ A1** de cada unidade (arquivo `.pfx` + senha).
3. **Credenciamento na SEFAZ-SP** de cada CNPJ e geração do **CSC** (ID + código) no
   portal da Fazenda — homologação e produção.
4. Dizer quais unidades emitem cupom agora e qual é a matriz para NF-e.
5. Levar ao contador as quatro perguntas da seção 16.

## 16. As quatro perguntas para o contador

1. O gelato vendido na loja sai como **mercadoria já tributada por ST** (CSOSN 500 /
   CST 60) ou como **produção própria** (CSOSN 102 / CST 00)? Vale para todas as
   unidades?
2. Confirma **NCM 21050010** (com leite) e **21050090** (sorbet/à base de água), com
   **CEST 1701100 / 1701200**?
3. As lojas são **Simples Nacional** — confirma **PIS/COFINS CST 07** e que os campos
   de IBS/CBS só passam a ser exigidos em **04/01/2027**?
4. Pode haver **NF-e agrupada** no fim do mês, ou cada venda fica só no cupom?

## 17. Glossário

**NFC-e** cupom fiscal eletrônico do consumidor (modelo 65) · **NF-e** nota fiscal
eletrônica (modelo 55) · **DANFE** o papel/PDF que representa a nota · **CSC** código
de segurança que valida o QR Code do cupom · **NCM** código do produto na tabela
nacional · **CEST** código de quem está em substituição tributária · **CFOP** código
da operação (o que está acontecendo com a mercadoria) · **CST/CSOSN** como o ICMS
incide (CSOSN é a versão do Simples) · **ST** substituição tributária: o imposto já
foi pago lá atrás na cadeia · **Contingência** emitir com a SEFAZ fora do ar ·
**Inutilização** avisar a Receita que uma faixa de números não será usada.

## 18. Fontes consultadas (28/09/2026)

- [São Paulo encerra o SAT e torna a NFC-e obrigatória em 2026 — CRC-SP](https://online.crcsp.org.br/portal/noticias/noticia.asp?c=10087)
- [NFC-e obrigatória exige certificado e-CNPJ A1 — CRC-SP](https://online.crcsp.org.br/portal/noticias/noticia.asp?c=10093)
- [Nota Técnica 2025.002 — IBS/CBS/IS na NF-e e NFC-e — Tecnospeed](https://blog.tecnospeed.com.br/nota-tecnica-reforma-tributaria-nfe-nfce/)
- [Reforma Tributária do Consumo — adequações NF-e/NFC-e — Portal da NF-e](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=AklZnck3o6I%3D)
- [Orientações da Reforma Tributária para 2026 — Receita Federal](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-2026)
- [NCM e CEST do sorvete para sorveteria](https://www.sisfood.com.br/saiba-mais/fiscal/ncm-sorvete)
- [ICMS-ST de sorvete em São Paulo — RICMS/2000 art. 295](https://tributario.com.br/a/sp-icms-substituicao-tributaria-sorvete-e-preparado-para-fabricacao-de-sorvete-em-maquina-roteiro-de-procedimentos/)
- Documentação da API Spedy (enviada pelo Rafael em 28/09/2026)

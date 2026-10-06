# Missão integridade — o sistema para de desfazer dado sozinho

Ordem do Rafael, 06/10/2026. Este arquivo é o diário da missão: onde ela
está, o que foi provado e como se prova. Se ele pedir uma correção no
meio, faça a correção, publique, e volte daqui.

**A regra da missão:** regra nova só vale se virar trava que roda — no
banco, num teste ou no portão. Nada de parágrafo novo no protocolo. Toda
lista de tabelas sai do MAPA e do banco, nunca escrita à mão.

---

## Onde está

| Fase | Situação |
|---|---|
| 0 — publicação só com bateria verde; regras do pedido automáticas | feita e publicada (06/10/2026) |
| 1 — inventário e régua | feita (06/10/2026) |
| 2 — banco vira juiz em todas as tabelas | no ar em observação (06/10/2026); falta virar 'recusar' bloco a bloco |
| 3 — o que anda para frente não volta | não começou |
| 4 — vigia confere os dados | não começou |
| 5 — cerca do pedido | não começou |

---

## Fase 0 — feita (06/10/2026)

**Teste vermelho não publica.** O `pages.yml` ganhou o trabalho `bateria`
(npm ci, vistoria, trava dos guardiões, conferir-nuvem, `npm test`) e o
`publicar` só começa depois dele (`needs: bateria`).

Achado na hora de ligar a trava: **a bateria já estava vermelha na
`main`**. O guardião `testes/faturamento-inteiro.js` usava vendas com data
fixa em setembro; com a passagem do tempo o dia coberto caiu para fora da
janela de 30 dias e o caso 6 passou a falhar sem mudança nenhuma no
código. Como o `npm test` para no primeiro erro, as suítes seguintes nem
rodavam — e a loja recebia versão nova do mesmo jeito. O teste passou a
gerar as datas a partir de hoje (o código estava certo).

**Regras do pedido automáticas.** Moram numa seção só do `CLAUDE.md`
("## Regras do pedido"). O gancho `UserPromptSubmit` do Claude Code
(`.claude/settings.json` → `.claude/regras-do-pedido.js`) lê essa seção e
a junta a toda mensagem do Rafael. Regras 1 e 2 do `CLAUDE.md` trocadas:
publicar e aplicar migration não pedem ordem, pedem portão verde + backup
antes + prova num banco de cópia.

**Como se prova:**
- `node testes/publicacao-espera-a-bateria.js` — 12 pontos; tirando o
  `needs: bateria` do pages.yml ele reprova (provado).
- `node testes/regras-do-pedido.js` — 10 pontos; tirando a seção do
  CLAUDE.md ele reprova (provado). Os dois estão na bateria e trancados no
  `travas.json` (169 guardiões).
- Gancho provado no Claude Code de verdade: `claude -p` na pasta do Joia
  mostrou o evento `UserPromptSubmit` com o texto das regras, e o modelo
  respondeu "SIM. Regra 4: Portão verde, e publique sozinho…".
- `testes/publicacao-espera-a-bateria.js` também reprova se a bateria
  for posta num Node que não carrega os testes: com `node-version: '20'`
  o jsdom da bateria nem abre (exige Node 22+, lido do package-lock), e a
  trava bloquearia TODA publicação. Achado rodando a bateria em Node 20
  antes de publicar.
- Portão: 11 etapas verdes (V426.0.0, 425 s).

---

## Fase 1 — inventário e régua (06/10/2026, só leitura)

### A régua: quanto dado "voltou" sozinho

Contado no `audit_log` dos últimos 30 dias (até 06/10/2026): gravação
de UPDATE feita por login de aparelho em que pelo menos um campo foi
devolvido ao valor anterior (o campo foi de A para B e esta gravação o
leva de B para A). A consulta está em `ferramentas/regua.sql` — é a
mesma que o vigia passa a rodar (Fase 4), para a comparação ser justa.

| | gravações que devolveram campo |
|---|---|
| campos de dado (código, vínculo, categoria, pago, conciliado, liberação…) | **≈ 8.100** |
| saldo e custo (estoque_atual, custo, custo_medio, estoque) | ≈ 6.500 |

Por tabela e unidade (campos de dado): insumos — Santa Fé 2.734, matriz
1.964; fichas técnicas — Santa Fé 1.515, matriz 985; lançamentos —
Santa Fé 796, matriz 35; produtos — Santa Fé 39; baixas — Santa Fé 13;
pedidos 17; contas 5; formas 3; caixas 3. É um **piso**: 27 das 60
tabelas não têm auditoria, e o estrago nelas não deixa rastro.

Estados de mão única que voltaram em 30 dias: lançamento conciliado →
não (16, Santa Fé), pago → não pago (7), baixa lançada → pendente (13,
Santa Fé, 05/10), pedido de base entregue → confirmado (1), venda
entregue → cancelada/preparo (41 — a maior parte é cancelamento de venda
de verdade, a conferir na Fase 3).

### As causas (o "um defeito só" tem cinco portas)

1. **Cópia velha sobe por cima** (o diagnóstico de 05/10): o envio manda a
   linha inteira e só 4 tabelas têm lei de versão (contas, formas,
   lançamentos, baixas). Fichas e pastas só na liberação; estoque por
   unidade pela data do saldo; cardápio pelo tempo digitado.
2. **`arrumarCodigos()` renumera tudo sozinho.** Roda ao abrir as telas
   de estoque e dá código 1, 2, 3… em ordem alfabética a insumos e fichas.
   Cada aparelho enxerga uma lista diferente (a loja só vê o que foi
   liberado), então cada um grava uma numeração diferente: o Chocotone
   foi 129, 186, 128, 185 em dois dias. `codigo` mudou 8.008 vezes nos
   insumos e 3.265 nas fichas em 30 dias.
3. **`espelharEstoque()` sobe o saldo da unidade aberta como se fosse da
   rede.** Depois de cada download ele copia estoque e custo médio da
   unidade aberta para o cadastro único do insumo — e o envio sobe isso.
   Santa Fé grava o de Santa Fé; a matriz, o da unidade que estiver
   olhando. É o vaivém de estoque e custo (≈ 6.500).
4. **Vínculo não resolvido sobe vazio.** Quando o aparelho não traduz um
   vínculo (`fk`/`fkSub`), a linha sobe com o campo nulo por cima do
   valor salvo e, no envio seguinte, com o valor de novo: a categoria de
   "COMPRA PELICULA TABLET" alternou nulo ↔ categoria 16 vezes numa noite
   (lançamentos: 800 voltas). E `igualarChaves` completa com nulo o campo
   que uma linha do lote não mandou — campo "que não sobe" acaba subindo
   vazio.
5. **Consertos automáticos que discordam.** `repararDestinos()` (roda ao
   abrir o estoque) religa o destino da produção pelo nome, e
   `destinoDaFicha()` também religa — com regras diferentes. Quando ficha
   e insumo têm o mesmo nome, um aparelho grava a própria ficha e outro o
   insumo (CALDA ABACAXI, BOLACHA CASCÃO): 647 voltas em `destino_id`.

E o banco deixa: nas tabelas de cadastro da rede (insumos, fichas,
ingredientes, produtos, categorias, grupos…) a regra de escrita é
`loja_id = minha_loja()` — **qualquer login da empresa grava**, loja ou
matriz. A trava que separa é só do navegador (`TABS_CADASTRO_REDE`, e só
para exclusão). `santafe@` (gerente) e `caixa@` (operador) gravaram 13.500
alterações em insumos e fichas em 30 dias.

### Inventário das 60 tabelas (banco de produção, 06/10/2026)

Gerado do MAPA (58 tabelas + `config_loja` e `config_operacao`) contra o
catálogo do banco. "Lei" = gatilho `ab_versao_vista`; "auditoria" =
`tg_auditar`; "escrita" = política de INSERT/UPDATE/DELETE.

| tabela | lei de versão | auditoria | estados de mão única | quem grava (banco) |
|---|---|---|---|---|
| lancamentos_financeiros | sim | sim | pago, conciliado, cancelado | rede + permissão do financeiro; excluir só não conciliado |
| baixas_pendentes | sim | sim | situacao (pendente→lançada), lancada_em | rede + permissão da baixa |
| contas_capital | sim | sim | — | rede + permissão de contas |
| formas_pagamento | sim | sim | ativa | qualquer login da empresa |
| caixas | só "fechamento não se apaga" | sim | fechado_em, conciliado | rede; excluir só gestor |
| caixa_movimentos | — | sim | (caixa fechado trava) | quem vê o caixa |
| pedidos | — | sim | fase | empresa + unidade |
| pedido_itens / pedido_pagamentos | — | **não** | pagamento: situacao (recebido→estornado) | quem vê o pedido |
| pedidos_base | — | sim | situacao, enviado/confirmado/entregue/pago_em | rede + permissão |
| pedido_base_itens | — | sim | — | quem vê o pedido de base |
| notas_entrada | — | sim | recebida, excluida_em | rede + permissão; excluir gestor |
| lotes_financeiros | — | sim | desfeito | rede + permissão |
| transferencias | — | sim | situacao, enviada/recebida_em | qualquer login da empresa |
| movimentacoes_estoque | — | sim | — | rede + permissão; excluir gestor |
| estoque_unidade | saldo mais novo vence | sim | — | qualquer login da empresa |
| contagens_estoque | — | sim | lancada_em | qualquer login da empresa |
| lotes_estoque | — | sim | — | rede + permissão |
| ordens_producao | — | sim | situacao | qualquer login da empresa |
| cancelamentos | — | sim | produzido | rede + PDV/frente de caixa |
| cupons_fiscais | — | **não** | status, emitido/cancelado_em | qualquer login da empresa |
| insumos | — | sim | — | **qualquer login da empresa** |
| fichas_tecnicas | só liberação | sim | — | **qualquer login da empresa** |
| ficha_itens | — | sim | — | **quem vê a ficha** |
| ficha_grupos | só liberação | sim | — | **qualquer login da empresa** |
| produtos | — | sim | ativo | **qualquer login da empresa** |
| produto_grupos | — | **não** | — | quem vê o produto |
| categorias, grupos_ingredientes, grupos_opcoes | — | **não** | ativo/ativa | **qualquer login da empresa** |
| opcoes | — | **não** | ativo | quem vê o grupo |
| categorias_financeiras / subcategorias | — | **não** | — | qualquer login da empresa |
| fornecedores, unidades_medida, motivos_movimentacao, status_venda, modelos_impressao, entregadores, mesas, mesa_comandas, clientes, cupons, cupom_usos, fiado_movimentos, acertos, areas_entrega, areas_zonas, entregador_taxas, compras_sem_vinculo | — | só cupons e fiado | ativo/aberta/excluido_em | qualquer login da empresa |
| motivos_cancelamento, turnos, bases_catalogo, indicadores_manuais, clientes_nexor, sucursais, usuarios_sistema | — | sim | ativo/excluida_em | conforme a tabela (sucursais e usuários: só gestor) |
| config_loja | — | sim | loja_aberta | qualquer login da empresa |
| config_operacao | — | **não** | — | qualquer login da empresa |

**Filhos:** nenhum filho sobe amarrado ao pai. `ficha_itens`,
`subcategorias_financeiras`, `opcoes`, `pedido_itens`,
`pedido_pagamentos`, `pedido_base_itens`, `caixa_movimentos`,
`entregador_taxas`, `areas_zonas` e o vínculo `produto_grupos` são
gravados em chamadas separadas, depois do pai, e o banco não pergunta
nada sobre o pai. Se a ficha for recusada pela lei, os ingredientes dela
sobem mesmo assim. O "corte" de ingredientes (`ficha_itens?ficha_id=…
&ref_local=not.in.(…)`) apaga da nuvem tudo o que o aparelho não tem —
inclusive ingrediente que outro aparelho acabou de pôr. E o vínculo
produto ↔ grupos é apagado inteiro e regravado.

**Exclusão:** nenhuma tabela confere versão antes de apagar.

---

## Fase 2 — o banco vira juiz em todas as tabelas (06/10/2026)

### O que mudou no banco (`supabase/migrations/20261006_lei_de_versao_em_todas.sql`)

- **Lei de versão nas 60 tabelas** que o aparelho grava (as 58 do MAPA +
  `config_loja` e `config_operacao`). Uma função só (`tg_versao_vista`)
  e um instalador só (`instalar_lei_de_versao`), sem regra por tabela.
  Cada tabela tem o recibo (`versao_vista`), o aparelho
  (`versao_aparelho`), o carimbo (`alterado_em`), o gatilho da exclusão
  (`ab_exclusao_vista`) e a auditoria (`tg_auditar`) — antes 27 das 60
  não tinham auditoria.
- **Fila de conflitos** (`conflitos_sincronizacao`): o que a lei recusa
  fica guardado com o que o aparelho queria, o que estava, quem, qual
  aparelho e quando. A matriz decide (`decidir_conflito`: aplicar ou
  descartar, com motivo obrigatório; a decisão entra na auditoria como
  "decisão da matriz"). A unidade vê só os pedidos dela; ninguém escreve
  na fila direto, nem o visitante sem login chama as funções.
- **Filhos seguem o pai**: aparelho cujo pai foi recusado não manda os
  filhos e anexa ao conflito o que queria gravar neles
  (`anexar_filhos_ao_conflito`).
- **Exclusão respeita a versão**: `apagar_vistos` só apaga a linha que
  não mudou depois que o aparelho a viu. O corte dos ingredientes e o
  vínculo produto ↔ grupos deixaram de ser DELETE direto.
- **Gravação feita por outro gatilho** (o cancelamento marca o pedido, o
  estorno mexe no saldo) não é julgada de novo.
- **Modo de cada tabela** (`lei_de_versao`): a gravação recusa nas quatro
  que já recusavam (contas, formas, lançamentos, baixas) e fica em
  observação nas outras 56; a exclusão nasce em observação em todas
  (aparelho de versão antiga apaga direto, e recusar isso hoje faria o
  apagado voltar). Em observação a gravação passa e o que a lei recusaria
  fica na fila como "observado".

### O que mudou no aparelho (V427.0.0)

- Toda tabela sobe com o recibo e o aparelho — sem lista de tabelas.
- O download guarda a versão de cada linha e de cada filho (`volta`).
- Recusa: o aparelho não avança a versão, não manda os filhos, anexa o
  pedido ao conflito e baixa a nuvem. Não insiste.
- Vínculo não resolvido não sobe vazio por cima do salvo; campo que uma
  linha não manda não vira nulo por causa da vizinha de lote.
- Exclusão vai pelo banco com a versão de cada linha (a que desceu ou a
  que este aparelho gravou). As telas que apagavam direto — ficha,
  ingrediente, grupo de ficha, lançamento — também.
- `config_loja` e `config_operacao` sobem só quando mudam, com o recibo
  (antes subiam inteiras em todo envio, de todo aparelho).
- Saíram as rotinas que mudavam dado sozinhas: a renumeração automática
  de códigos (só pelo botão) e o espelho do saldo da unidade como
  "alteração" do cadastro; login de loja não sobe o cadastro da rede.

### Como se prova

- `node testes/lei-de-versao-em-todas.js` — no **banco de cópia** (PGlite,
  a fotografia da produção em `ferramentas/banco-de-copia/`), dois
  aparelhos por tabela, para as 60 tabelas lidas do MAPA: 674 pontos.
  Tirando a regra dos gatilhos aninhados ele reprova (provado).
- `node testes/motor-respeita-a-versao.js` — o motor de verdade (jsdom)
  contra uma nuvem falsa: 43 pontos.
- `node ferramentas/conferir-nuvem.js` — conferência 0: tabela que o
  aparelho grava sem a lei e a auditoria reprova o portão
  (`testes/conferir-nuvem.js` caso 5 prova que reprova).
- A fotografia da cópia bate com a produção: colunas e gatilhos das 65
  tabelas idênticos (impressão), funções iguais a menos de comentário
  (faltava o gatilho de `loja_versao`; posto).

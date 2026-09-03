# JOIA — Isolamento entre unidades (achado de segurança)

**03/09/2026. URGENTE.** Um gerente de unidade (Santa Fé) vê dados de
outras unidades (Matriz, Jales, Alphaville) na Conciliação Bancária.
Investigação de leitura no banco de produção, sem alteração.

## O que está seguro e o que não está

- **Entre EMPRESAS: isolado.** Outra empresa/rede não lê nada da Jolô. O
  RLS fecha por `empresa_id`/`loja_id`. A chave secreta não está no
  navegador (ver `SEGURANCA.md`). Isso continua de pé.
- **Entre UNIDADES da MESMA rede: NÃO isolado.** Um gerente de uma unidade
  lê os dados das outras unidades da Jolô. É o furo do print.

## A causa raiz (é backend, não frontend)

Todos os usuários da Jolô têm o **mesmo `loja_id`** (`6001c62e…`) — ele
identifica a **empresa/rede**, não a unidade. A unidade é distinguida por
`sucursal_ref` (ex.: Santa Fé = `suc_mt1unhbx2xrb`, Jales =
`suc_2157f764d972`).

O RLS isola por `loja_id`. Para um gerente de unidade, a regra
`minha_rede(loja_id)` se resume a `loja_id = minha_loja()` — e como o
`loja_id` é o mesmo para todos, dá **verdadeiro para todas as unidades**.
Ou seja: o banco isola por EMPRESA, nunca por UNIDADE. O `sucursal_ref`
existe no dado, mas o RLS não o usa para filtrar.

Isso vale para o sistema inteiro, não só o Financeiro. Um gerente também
lê pedidos, estoque e caixas das outras unidades pela mesma razão.

## Por que não é um ajuste rápido

Parte das tabelas tem o campo de unidade (`sucursal_id`) e daria para
apertar o RLS: **caixas, pedidos, estoque_unidade, movimentacoes_estoque,
contagens_estoque**.

Mas as tabelas do **Financeiro NÃO têm campo de unidade**:
`contas_capital`, `lancamentos_financeiros`, `caixa_movimentos`,
`transferencias`, `acertos`, `cupons_fiscais` — e também `sucursais`,
`fichas_tecnicas`, `insumos`, `produtos`, `formas_pagamento`. Nessas, o
dado é **compartilhado pela rede por projeto**: existe UMA "Caixa da loja",
UM "Cofre", UM "Banco Itaú" para todas as unidades. O saldo que corrigi
ontem (R$ 423) é o caixa **somado** da rede, não o de uma unidade só.

Então isolar unidade de verdade no Financeiro exige **mudar o modelo de
dados**: dar uma unidade (`sucursal_id`) a cada conta e a cada lançamento,
preencher o histórico, reescrever o RLS de dezenas de tabelas, mudar o
download (que hoje baixa tudo por empresa) e o frontend. É um projeto, com
teste por perfil (gerente de A não vê B; matriz vê tudo; plataforma vê
tudo), não um remendo.

**Mexer nisso às cegas, ao vivo, nas 6 lojas, pode trancar uma unidade
fora do próprio dado ou embaralhar o Financeiro.** O protocolo permanente
manda reproduzir, mudar o mínimo, testar e não quebrar — por isso não
disparo essa reescrita sem o escopo fechado com o Rafael.

## Decisão que depende do Rafael

O ponto central é de negócio: **as contas do Financeiro (Caixa, Cofre,
Banco) são uma só para a rede, ou cada unidade tem a sua?**

- Se **cada unidade tem a sua** → é o projeto acima (modelo por unidade em
  todo o sistema). Faço em etapas, com teste por perfil, sem publicar até
  provar o isolamento.
- Se são **compartilhadas** (como hoje) → o gerente de unidade não deveria
  nem ver a tela de trocar unidade nem as outras no filtro. Aí o certo é
  **esconder as outras unidades para quem não é matriz** (frontend) e
  apertar o RLS nas tabelas que já têm `sucursal_id`, mantendo o Financeiro
  compartilhado só para a matriz.

## Decisão do Rafael (03/09/2026): isolar TUDO por unidade

Cada unidade passa a ter o seu — caixa, cofre, banco, lançamentos, pedidos,
estoque. Ninguém vê o da outra; a matriz vê todas; a plataforma vê tudo.

## Complicador achado na preparação

O `sucursal_id` é **inconsistente** entre tabelas: é **texto** (`suc_…`, =
`sucursais.ref_local`) em `estoque_unidade`, `caixas`,
`movimentacoes_estoque`, `contagens_estoque`; e **uuid** (= `sucursais.id`)
em `pedidos`. O RLS precisa de duas chaves (uma função para o `ref` texto,
outra para o `id` uuid), e cada linha antiga tem de ter o `sucursal_id`
preenchido — senão o dono é trancado fora do próprio dado.

## Plano por etapas (cada uma testada por perfil antes da seguinte)

Nenhuma etapa publica nem aplica RLS sem antes provar, num teste que
simula cada usuário (gerente de A não lê B; gerente de A lê A; matriz lê
todas; plataforma lê tudo) e confirma que ninguém perde o próprio dado.

1. **Base**: `minha_sucursal_ref()` (texto) e `minha_sucursal_uuid()` (uuid)
   — funções novas, ainda sem uso. Risco zero.
2. **Conferir o dado**: toda linha das tabelas com `sucursal_id` tem um
   valor válido; corrigir as órfãs ANTES de apertar o RLS.
3. **Tabelas que já têm unidade** (pedidos, estoque, movimentação,
   contagem, caixas): RLS passa a exigir
   `minha_rede(loja_id) AND (sou_admin() OR sou_plataforma() OR
   sucursal_id = minha_sucursal_*)`. Teste por perfil. Ajustar o download
   e o frontend se preciso.
4. **Financeiro (o do print)**: dar `sucursal_id` a `contas_capital`,
   `lancamentos_financeiros`, `caixa_movimentos`, `transferencias`,
   `acertos`; preencher o histórico pela origem (o caixa/ a sucursal do
   lançamento); então o mesmo RLS. É a etapa maior — cada conta vira uma
   por unidade.
5. **Sucursais e cadastros compartilhados**: decidir caso a caso o que
   é da rede (formas, fichas, produtos podem ser padronizados pela
   franqueadora) e o que é da unidade; o gerente só vê a própria unidade
   no seletor.
6. **Frontend**: esconder outras unidades de quem não é matriz (seletor de
   loja, filtros), como segunda camada.

## O que foi feito nesta investigação

Nada foi alterado no banco nem no código. Só leitura. É a etapa 0
(diagnóstico). As etapas seguintes entram uma a uma, testadas, sem
publicar até o isolamento estar provado — porque é o núcleo financeiro e
de segurança de 6 lojas ao vivo, e o protocolo proíbe arriscar isso de
uma vez.

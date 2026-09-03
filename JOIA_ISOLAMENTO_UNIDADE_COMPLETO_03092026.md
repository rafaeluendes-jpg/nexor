# JOIA — Isolamento por unidade concluído (backend + banco)

**03/09/2026.** Ordem do Rafael: "uma loja não pode ler a outra, 100%".
Feito em etapas, cada uma testada por perfil (gerente de A não lê B; gerente
de A lê A; matriz lê todas; plataforma lê tudo), sem trancar ninguém fora do
próprio dado.

## Modelo

Um usuário de unidade tem `perfis.sucursal_ref` preenchido; matriz/dono tem
nulo. Funções novas: `minha_sucursal_ref()` (texto), `minha_sucursal_uuid()`
(uuid), `vejo_todas_unidades()` (matriz/dono). O RLS passou a exigir a
unidade na LEITURA: `minha_rede(loja_id) AND (vejo_todas_unidades() OR
sucursal_id IS NULL OR sucursal_id = minha_sucursal_*)`.

## Tabelas isoladas por unidade (RLS aplicado e verificado)

- **Já tinham a dimensão**: pedidos, estoque_unidade, movimentacoes_estoque,
  contagens_estoque, caixas. `caixa_movimentos` isola sozinho (a política
  dele filtra pelos caixas visíveis).
- **Financeiro (dimensão adicionada + histórico preenchido pela origem)**:
  `lancamentos_financeiros` (pela caixa de origem), `cupons_fiscais` (pelo
  pedido), `acertos` e `transferencias` (vazias hoje, prontas). Backfill:
  44/49 lançamentos, 535/535 cupons, 10/10 movimentos de caixa.
- **Compartilhado de propósito**: `contas_capital` (Caixa/Cofre/Banco são
  entidades da rede; o que se isola é o DADO — os lançamentos). O gerente vê
  as contas, mas só os próprios lançamentos e o próprio saldo.

## Prova por perfil (RLS de verdade, não simulação de tela)

| | pedidos | estoque | caixas | lançamentos |
|---|---|---|---|---|
| gerente Santa Fé | 862 (só dela) | 249 | 15 | 44 + 5 rede |
| gerente Jales | 0 | 0 | 0 | 5 rede |
| matriz/dono | 863 (todas) | 490 | 17 | 49 |

Um usuário de unidade **não consegue** ler outra loja — nem alterando ID,
rota ou parâmetro, porque a trava é no BANCO (RLS), não na tela.

## Frontend (camadas anteriores, já publicadas)

V295/V301: o seletor de sucursal some para usuário de unidade (Ficha
Técnica, topo, filtros de relatório) — só matriz/dono escolhe unidade.

## Código (V302)

Para o isolamento valer também no dado NOVO: o lançamento financeiro e o
cupom fiscal passam a subir com a unidade (`sucursal_id = lojaAtualId()`),
senão nasceriam sem unidade e ficariam visíveis à rede. Escrita mantida em
nível de empresa (não quebra o app); só a leitura/edição exige a unidade.

## Segurança

Escrita não afrouxada; `venda_registrar`/`estoque_aplicar` seguem
SECURITY DEFINER. Nada foi apagado; colunas só adicionadas; migrations
registradas. Reversível pelo backup de cada etapa.

# Número oficial do pedido — correção no app (V325)

Escopo: só código do app. Nada no banco (sem migração/CREATE/ALTER/DROP/policy).
Branch: `claude/claude-project-reading-ieiet8` · commit `1697e86` · `main` não publicada.

## Chamadores de `rpc/venda_registrar`
Um só: `enviarVendaAtomica(ped,mov)` em `src/js/07-roteador/09-modulo-pdv/03-pdv.js`.
O cardápio digital (`delivery/cardapio.js`) NÃO chama a RPC: insere em `pedidos_online`
com `num=String(Date.now()).slice(-6)` e `sucursal_id:S.loja.id`. O 1001 repetido e o
`sucursal_ref` vazio nasciam na ingestão/envio pelo ERP, não no cardápio.

## Alterações
1. `03-zap-e-mais-3.js` (aceite do pedido online, `canal:'cardapio'`, l.355)
   - era: `var ped={id:uid('ped'),numero:(DB.pedidos.length+1),`  ← CONTAGEM da lista
     local (~1.000 na janela de 90 dias → sempre 1001; apagar/janelar fazia voltar).
   - agora: `numero:proxNumPedido()` (maior número DA UNIDADE + 1, o mesmo do PDV).
2. `03-pdv.js` — `enviarVendaAtomica`
   - `sucursal_ref:suc` → `sucursal_ref:ped.sucursalId||suc` (l.1549). Unidade DO PEDIDO;
     a do aparelho vira reserva. Era vazio quando `lojaAtualId()` não estava resolvida.
   - após `var res=(r&&r.length)?r[0]:r;` (l.1570–1578): se `res.numero` difere do enviado,
     `ped.numero=res.numero` no MESMO objeto de `DB.pedidos` (comprovante, impressão,
     kanban e estado local leem dali); `res.sucursal_id` preenche unidade se faltava;
     `numero_gerado` vai ao log; `salvar()`; toast; re-render do kanban.
     Número igual → nada muda (PDV inalterado, sem regravar).
3. Teste-guardião novo `testes/pedido-numero-oficial.js` (14/14), registrado no `npm test`.
   Versão V325 (VERSAO + VERSAO_SW juntas).

## Trecho onde o número era calculado antes
- Cardápio→ERP (origem do 1001): `03-zap-e-mais-3.js` l.346 (antiga):
  `var ped={id:uid('ped'),numero:(DB.pedidos.length+1),`
- PDV (provisório, antes da RPC): `03-pdv.js:1345`: `id:uid('ped'),numero:proxNumPedido(),`
  em `finalizar`, antes de `enviarVendaAtomica` (sem await) e do toast/impressão.

## Critério de aceite → travado por teste
- 2 vendas seguidas pelo cardápio → números diferentes (503→504) e iguais ao retorno da RPC.
- Payload leva `sucursal_ref` preenchido mesmo com unidade do aparelho vazia.
- PDV igual: número válido volta igual, sem regravação.

Validação: portão completo 10/10 (V325, 202s); suítes vizinhas verdes
(pdv-tem-forma 10/10, guardião do caixa 24/24, cupom online 15/15, e2e 106/106).
Só entra em produção quando a V325 for publicada.

/* ==========================================================
   JOIA — O PEDIDO DE BASE SOBE COM OS ITENS, E DÁ PARA ABRIR

   Santa Fé do Sul mandou o pedido 0002 em 01/09/2026, R$ 2.557,00. Na
   nuvem chegou o cabeçalho — data, unidade, situação, total — e ZERO
   itens. A matriz recebia um pedido de dois mil e quinhentos reais sem
   saber quais bases foram pedidas. O 0001, de Jales, idem: nenhum item
   de pedido de base jamais chegou lá.

   A causa, no registro do banco:

     POST /rest/v1/pedido_base_itens?on_conflict=loja_id,ref_local → 400

   `pedido_base_itens` NÃO TEM coluna `loja_id` — quem isola é o pai. A
   chave do upsert saía de uma lista escrita à mão, `_TABS_SEM_LOJA`, e
   essa tabela nunca foi acrescentada nela. Postgres recusa conflito numa
   coluna que não existe, e a recusa derruba o LOTE INTEIRO.

   Terceira vez na semana que uma lista escrita à mão envelhece e custa
   dado. Então quem decide a chave passou a ser o próprio lote que está
   indo: tem `loja_id` na linha, a chave é por loja; não tem, é só o
   `ref_local`. Não há nome de tabela para esquecer.

   E o Rafael: "não tem nenhuma opção de visualizar esse pedido, coloca
   um olhinho no final". Colocado.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const fs = require('fs');
const { corpoDaFuncao, ARQ } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

console.log('\n── A chave do upsert sai do lote, não de uma lista\n');
{
  const amb = { _quieto: () => {},
    _TABS_SEM_LOJA: ['ficha_itens', 'opcoes', 'pedido_itens'] };
  const f = new Function('amb', 'with(amb){' + corpoDaFuncao('chaveConflito', fonte) +
    '\nreturn chaveConflito;}')(amb);

  /* o caso que quebrava: item de pedido de base, sem loja_id na linha */
  t('linha SEM loja_id conflita só por ref_local',
    f('pedido_base_itens', [{ pedido_id: 'x', ref_local: 'r1', quantidade: 2 }]) === 'ref_local',
    f('pedido_base_itens', [{ pedido_id: 'x', ref_local: 'r1' }]));
  t('e a tabela nem precisa estar em lista nenhuma',
    !/pedido_base_itens/.test(JSON.stringify(amb._TABS_SEM_LOJA)));
  t('linha COM loja_id conflita por loja e ref_local',
    f('pedidos_base', [{ loja_id: 'L', ref_local: 'r1' }]) === 'loja_id,ref_local');
  t('loja_id nulo ainda é loja_id — a coluna existe',
    f('pedidos_base', [{ loja_id: null, ref_local: 'r1' }]) === 'loja_id,ref_local');
  t('sem lote, a lista antiga ainda decide',
    f('ficha_itens', []) === 'ref_local' && f('insumos', []) === 'loja_id,ref_local');
  t('e lote com coisa estranha não quebra', f('insumos', [null]) === 'loja_id,ref_local');

  const en = corpoDaFuncao('enviar', fonte);
  t('o envio passa o lote para a decisão',
    /chaveConflito\(tab,lote\)/.test(en));
  t('e nenhuma chamada decide só pelo nome da tabela',
    !/chaveConflito\(tab\)/.test(fonte));
}

console.log('\n── Toda tabela filha do MAPA passa a acertar a chave\n');
{
  const amb = { _quieto: () => {}, _TABS_SEM_LOJA: [] };
  const f = new Function('amb', 'with(amb){' + corpoDaFuncao('chaveConflito', fonte) +
    '\nreturn chaveConflito;}')(amb);
  /* o envio dos filhos monta a linha com F.campos + pai + ref_local, e
     nunca acrescenta loja_id: então toda filha cai em ref_local */
  const filha = { pedido_id: 'p1', ref_local: 'r1', base_nome: 'BASE BELGA', quantidade: 3 };
  ['pedido_base_itens', 'caixa_movimentos', 'ficha_itens', 'opcoes',
   'entregador_taxas', 'areas_zonas', 'subcategorias_financeiras'].forEach(function (tab) {
    t(tab + ' conflita por ref_local', f(tab, [filha]) === 'ref_local');
  });
  const env = corpoDaFuncao('sincronizar', fonte);
  t('e o envio do filho realmente não põe loja_id na linha',
    /var y=F\.campos\(o,j\);\s*y\[F\.pai\]=paiId;\s*y\.ref_local=refs\[j\];/.test(env));
}

console.log('\n── O olhinho abre o pedido inteiro\n');
{
  const vp = corpoDaFuncao('verPedidoBase', fonte);
  t('existe a função de ver o pedido', vp.length > 100);
  t('mostra o número do pedido', /Pedido #' \+ String\(p\.numero \|\| 0\)\.padStart\(4, '0'\)/.test(vp));
  t('mostra a unidade e a situação', /p\.sucursalNome/.test(vp) && /seloPedBase\(p\.situacao\)/.test(vp));
  t('lista base por base', /it\.baseNome \|\| it\.nome/.test(vp));
  t('com quantidade, valor da unidade e total',
    /unidadesDoItem\(it\)/.test(vp) && /precoUnitDoItem\(it\)/.test(vp));
  t('e fecha com o total do pedido', /Total do pedido/.test(vp));
  t('pedido sem lista não mostra tabela vazia: explica',
    /não tem a lista de bases neste aparelho/.test(vp));
  const tp = corpoDaFuncao('telaPedidoBase', fonte);
  t('a lista "Meus pedidos" tem o olhinho', /verPedidoBase\(/.test(tp));
  t('e ele fica no fim da linha, com o título certo',
    /title="Ver o pedido"/.test(tp));
  t('a tabela ganhou a coluna para ele', /<th style="width:52px"><\/th>/.test(tp));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

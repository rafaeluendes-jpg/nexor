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
    /A lista de bases ainda não chegou aqui/.test(vp));
  t('e diz que ela sobe sozinha, sem pedir nada à matriz',
    /sobe sozinha/.test(vp));
  /* a regra da casa: zero texto tecnico na tela. Foi exatamente isso que
     o Rafael reclamou ao abrir o olhinho pela primeira vez. */
  /* so o que a loja LE conta: os comentarios do codigo ficam de fora */
  const naTela = vp.replace(/\/\*[\s\S]*?\*\//g, '');
  ['Ctrl', 'V279', 'nuvem', 'sincroniza', 'upsert', 'cache', 'F5'].forEach(function (t9) {
    t('a tela não escreve "' + t9 + '"', naTela.indexOf(t9) < 0);
  });
  t('a observação da unidade aparece no pedido', /p\.obs/.test(vp));
  t('e o total aparece mesmo sem a lista', /' · R\$ ' \+ money\(p\.total\)/.test(vp));
  t('não escreve o nome da unidade duas vezes',
    /String\(p\.responsavel\)\.trim\(\) !== String\(p\.sucursalNome \|\| ''\)\.trim\(\)/.test(vp));
  const tp = corpoDaFuncao('telaPedidoBase', fonte);
  t('a lista "Meus pedidos" tem o olhinho', /verPedidoBase\(/.test(tp));
  t('e ele fica no fim da linha, com o título certo',
    /title="Ver o pedido"/.test(tp));
  t('a tabela ganhou a coluna para ele', /<th style="width:52px"><\/th>/.test(tp));
}

console.log('\n── A lista que ficou no aparelho da loja sobe sozinha\n');
{
  /* O caso real: o pedido 0002 de Santa Fe do Sul subiu com o cabecalho e
     ZERO itens, porque a nuvem recusava a tabela filha. Corrigida a chave,
     falta provar o que a tela promete a matriz: que a lista guardada no
     computador da loja sobe por conta propria no proximo acesso.

     Quem faz isso e `volta`: o download devolve o pai SEM os itens, ela
     percebe que o aparelho tinha itens que a nuvem nao tem, devolve os
     itens a lista e marca o pai como pendente. Depois `precisaSubir` tem
     de concordar — senao o pai fica com impressao de "ja enviado" e o
     item nunca sai daqui. */
  const MAPA_FALSO = [{ col: 'pedidosBase', tab: 'pedidos_base',
    campos: function (o) { return { ref_local: o.id, total: o.total }; },
    filhos: [{ lista: 'itens', tab: 'pedido_base_itens', pai: 'pedido_id',
      campos: function (o) { return { base_nome: o.baseNome, quantidade: o.qtd }; } }] }];

  const amb = { _quieto: () => {}, logNuvem: () => {}, registrarSumico: () => {},
    guardarIds: () => {}, MAPA: MAPA_FALSO };
  amb.volta = new Function('amb', 'with(amb){' + corpoDaFuncao('volta', fonte) +
    '\nreturn volta;}')(amb);

  /* o que o aparelho de Santa Fe tem guardado */
  const noAparelho = [{ id: 'pb_mtj2wy6l6lna', total: 2557, itens: [
    { id: 'pbi_1', baseNome: 'BASE BELGA', qtd: 4 },
    { id: 'pbi_2', baseNome: 'BASE MORANGO', qtd: 2 }] }];
  /* o que a nuvem devolve hoje: cabecalho certo, lista vazia */
  const daNuvem = [{ ref_local: 'pb_mtj2wy6l6lna', total: 2557, pedido_base_itens: [] }];

  const depois = amb.volta(daNuvem, function (x) {
    return { id: x.ref_local, total: Number(x.total) || 0,
      itens: (x.pedido_base_itens || []).map(function (i) {
        return { id: i.ref_local, baseNome: i.base_nome, qtd: Number(i.quantidade) || 0 }; }) };
  }, noAparelho, 'pedidosBase');

  t('o download não apaga a lista que só existe no aparelho',
    depois[0].itens.length === 2, JSON.stringify(depois[0].itens));
  t('as duas bases continuam lá, com a quantidade',
    depois[0].itens.map(function (i) { return i.baseNome + ':' + i.qtd; }).join(',')
      === 'BASE BELGA:4,BASE MORANGO:2');
  t('e o pedido fica marcado como tendo filho para subir',
    depois[0]._filhoPendente === true);

  const amb2 = { _quieto: () => {}, impressaoDaLinha: function () { return 'igual'; } };
  const precisa = new Function('amb', 'with(amb){' + corpoDaFuncao('precisaSubir', fonte) +
    '\nreturn precisaSubir;}')(amb2);
  const E9 = MAPA_FALSO[0];
  const h = {}, uu = {};
  h[depois[0].id] = 'igual'; uu[depois[0].id] = 'uuid-do-pedido';
  t('e o motor concorda: esse pedido tem de subir de novo',
    precisa(E9, depois[0], 0, h, uu) === true);
  t('um pedido igual, sem filho pendente, não sobe à toa',
    precisa(E9, { id: 'pb_outro' }, 0, { pb_outro: 'igual' }, { pb_outro: 'u' }) === false);
}

console.log('\n── O pedido de base se imprime e sai em PDF, nos dois lados\n');
{
  const vp = corpoDaFuncao('verPedidoBase', fonte);
  t('o modal da loja tem o botão Imprimir / PDF',
    /imprimirPedidoBase\(/.test(vp) && /Imprimir \/ PDF/.test(vp));
  const cp = corpoDaFuncao('cartaoPedido', fonte);
  t('o cartão da matriz tem o botão Imprimir / PDF',
    /imprimirPedidoBase\(/.test(cp) && /Imprimir \/ PDF/.test(cp));
  t('e mostra a cidade de quem pediu', /cidadeDaUnidade\(p\)/.test(cp));

  const ip = corpoDaFuncao('imprimirPedidoBase', fonte);
  t('o comprovante identifica o cliente', /Cliente:/.test(ip));
  t('e a cidade', /Cidade:/.test(ip) && /cidadeDaUnidade\(p\)/.test(ip));
  t('lista base, quantidade, valor unitário e total',
    /unidadesDoItem\(it\)/.test(ip) && /precoUnitDoItem\(it\)/.test(ip) && /Total do pedido/.test(ip));
  t('e imprimir É exportar PDF — a mesma janela do navegador',
    /window\.print\(\)/.test(ip));
  /* a cidade sai de sucursais, que carrega o campo cidade do banco */
  const cu = corpoDaFuncao('cidadeDaUnidade', fonte);
  t('a cidade vem do cadastro da unidade', /\.cidade/.test(cu) && /sucursalRef/.test(cu));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

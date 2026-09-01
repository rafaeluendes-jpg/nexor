/* ==========================================================
   JOIA — O QUE NÃO SUBIU NÃO PODE SUMIR DAQUI

   31/08/2026, Santa Fé do Sul. Sangria de R$ 85,00 às 23:24, cupom
   impresso, dinheiro fora da gaveta, destino Cofre. Meia hora depois, no
   fechamento de caixa: "Sangrias − R$ 0,00".

   O movimento entrou em `cx.movimentos` e ainda não tinha subido. Veio um
   download, o caixa voltou da nuvem sem movimento nenhum, e a lista local
   foi substituída pela de lá. O dinheiro saiu e o sistema esqueceu.

   Existia proteção para isso — o download devolve ao registro da nuvem os
   filhos que só existem aqui — mas o mapa dela era escrito à mão:

     {fichas:'itens', grupos:'opcoes', contas:'movs'}

   Três listas, e `contas` nem tem filho no MAPA: era entrada morta.
   Ficavam de fora caixas→movimentos, pedidos→itens e pagamentos,
   catfin→itens, pedidosBase→itens, entregadores→taxas e areas→zonas.

   Mapa escrito à mão envelhece: quem criou o filho do caixa não sabia que
   precisava vir aqui. Agora ele é montado a partir do próprio MAPA.

   E a segunda porta para o mesmo prejuízo: quando o banco RECUSA um
   registro (400), o envio gravava a impressão dele como se tivesse
   subido. O download seguinte então apagava o registro recusado.
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

/* o MAPA de verdade do sistema, para o mapa de filhos sair dele */
const MAPA_REAL = (function () {
  const i = fonte.indexOf('var MAPA=[');
  const fim = fonte.indexOf('\n];', i);
  return fonte.slice(i, fim + 3);
})();

function ambiente(DB) {
  const amb = {
    DB: DB, NUVEM: { loja: 'L', ligada: true },
    logNuvem: () => {}, _quieto: () => {},
    registrarSumico: () => {}, guardarIds: () => {},
    temMudancaNaoEnviada: () => false,   /* o pior caso: nada marcado como pendente */
    n: v => Number(v) || 0, fk: () => null
  };
  const codigo = MAPA_REAL + '\n' +
    ['_ANT', 'volta'].map(x => corpoDaFuncao(x, fonte)).join('\n') +
    '\nvar _FILHOS_MAPA=null;';
  const feito = new Function('amb',
    'with(amb){' + codigo + '\nreturn {volta:volta,MAPA:MAPA};}')(amb);
  Object.assign(amb, feito);
  return feito;
}

console.log('\n── A sangria de R$ 85,00 sobrevive ao download\n');
{
  /* o aparelho: caixa com a sangria que ainda não subiu */
  const DB = {
    caixas: [{ id: 'cx1', inicial: 554.05, movimentos: [
      { id: 'mv_ja_na_nuvem', tipo: 'sangria', valor: 850, motivo: 'Depósito' },
      { id: 'mv_nova', tipo: 'sangria', valor: 85, motivoNome: 'Pagamento autorizado' }
    ] }]
  };
  const f = ambiente(DB);
  /* a nuvem só conhece a primeira */
  const daNuvem = [{ ref_local: 'cx1', movimentos: [
    { id: 'mv_ja_na_nuvem', tipo: 'sangria', valor: 850, motivo: 'Depósito' }] }];
  const r = f.volta(daNuvem, x => ({ id: x.ref_local, movimentos: x.movimentos }),
                    DB.caixas, 'caixas');
  const movs = (r[0] || {}).movimentos || [];
  t('o caixa voltou', r.length === 1, r.length);
  t('a sangria que já estava na nuvem continua', movs.some(m => m.id === 'mv_ja_na_nuvem'));
  t('e a de R$ 85,00 NÃO sumiu', movs.some(m => m.id === 'mv_nova'),
    movs.map(m => m.id).join(','));
  t('o caixa é marcado como tendo filho pendente, para subir no próximo envio',
    r[0]._filhoPendente === true);
  const total = movs.filter(m => m.tipo === 'sangria').reduce((a, m) => a + m.valor, 0);
  t('o fechamento passa a somar R$ 935,00 em sangrias', total === 935, total);
}

console.log('\n── O mesmo vale para o pedido: itens e pagamentos\n');
{
  const DB = { pedidos: [{ id: 'p1',
    itens: [{ id: 'it_na_nuvem' }, { id: 'it_novo' }],
    pagamentos: [{ id: 'pg_na_nuvem' }, { id: 'pg_novo' }] }] };
  const f = ambiente(DB);
  const daNuvem = [{ ref_local: 'p1', itens: [{ id: 'it_na_nuvem' }],
                     pagamentos: [{ id: 'pg_na_nuvem' }] }];
  const r = f.volta(daNuvem, x => ({ id: x.ref_local, itens: x.itens, pagamentos: x.pagamentos }),
                    DB.pedidos, 'pedidos');
  t('o item que não subiu fica', (r[0].itens || []).some(i => i.id === 'it_novo'),
    (r[0].itens || []).map(i => i.id).join(','));
  t('o pagamento que não subiu também', (r[0].pagamentos || []).some(i => i.id === 'pg_novo'),
    (r[0].pagamentos || []).map(i => i.id).join(','));
}

console.log('\n── E para as outras listas que estavam desprotegidas\n');
[['catfin', 'itens'], ['pedidosBase', 'itens'], ['entregadores', 'taxas'],
 ['areas', 'zonas'], ['fichas', 'itens'], ['grupos', 'opcoes']].forEach(function (par) {
  const col = par[0], lista = par[1];
  const local = { id: 'x1' }; local[lista] = [{ id: 'a' }, { id: 'b' }];
  const DB = {}; DB[col] = [local];
  const f = ambiente(DB);
  const nuvem = [{ ref_local: 'x1' }]; nuvem[0][lista] = [{ id: 'a' }];
  const r = f.volta(nuvem, x => { const o = { id: x.ref_local }; o[lista] = x[lista]; return o; },
                    DB[col], col);
  t(col + ' → ' + lista + ': o que não subiu fica',
    (r[0][lista] || []).some(i => i.id === 'b'), (r[0][lista] || []).map(i => i.id).join(','));
});

console.log('\n── O mapa vem do MAPA, não de uma lista escrita à mão\n');
{
  const v = corpoDaFuncao('volta', fonte);
  t('não existe mais lista escrita à mão',
    !/_FILHOS=\{fichas:'itens', grupos:'opcoes', contas:'movs'\}/.test(v));
  t('o mapa é montado a partir do MAPA', /\(MAPA\|\|\[\]\)\.forEach\(function\(E9\)/.test(v));
  t('e um pai pode ter mais de uma lista', /for\(var _lf=0;_lf<listasF\.length;_lf\+\+\)/.test(v));
}

console.log('\n── Dado recusado pela nuvem fica guardado no aparelho\n');
{
  const i = fonte.indexOf('async function sincronizar(');
  const sinc = fonte.slice(i, i + 70000);
  t('a impressão do recusado NÃO é gravada como enviada',
    !/DB\._hash\[E2\.col\]=hNovo;\n\s*continue;/.test(sinc));
  t('as impressões do último envio confirmado são mantidas',
    /DB\._hash\[E2\.col\]=hAnt;\n\s*continue;/.test(sinc));
  t('e o diagnóstico deixa de prometer que não tentará de novo',
    /sobe sozinho quando a causa for corrigida/.test(sinc));
}

console.log('\n── O motivo da sangria sobe junto\n');
{
  const i = fonte.indexOf("filhos:[{lista:'movimentos'");
  const bloco = fonte.slice(i, i + 1800);
  t('sobe o rótulo escolhido e a descrição, como sai no papel',
    /motivo:\[o\.motivoNome,o\.motivo\]\.filter\(Boolean\)\.join\(' — '\)\|\|null/.test(bloco));
  t('não sobe mais só a descrição livre', !/motivo:o\.motivo\|\|null/.test(bloco));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

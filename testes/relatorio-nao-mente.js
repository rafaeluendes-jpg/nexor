/* ==========================================================
   JOIA — O RELATÓRIO NÃO PODE MENTIR (V372)

   Quatro maneiras diferentes de um número na tela estar errado sem
   ninguém perceber. Todas existiam, todas ao mesmo tempo, e todas no
   relatório que o Rafael mais olha.

   1. O DRE DE UM ANO MOSTRAVA 30 DIAS.
      Ele lia `DB.pedidos` cru. O aparelho só guarda os últimos 30 dias
      de venda — então janeiro a agosto vinham zerados, e o "resultado do
      ano" era o resultado do mês. Sete outras telas já usavam
      `fontePedidos()`, que junta o aparelho com o histórico da nuvem.

   2. A VENDA DA NOITE CAÍA NO MÊS SEGUINTE.
      O carimbo do pedido vem da nuvem em UTC. Uma venda das 21h10 de
      31/08 é "2026-09-01T00:10:00Z". Cortando o texto, ela virava
      setembro. Numa gelateria o forte é a noite: todo fim de mês uma
      fatia mudava de mês sozinha.

   3. A VENDA DE DEMONSTRAÇÃO ENTRAVA COMO VENDA DE VERDADE.
      `gerarVendasDemo` marca tudo com `demo:true`. Nenhum relatório
      perguntava pela marca.

   4. MARGEM BRUTA DE 100%.
      No Comparativo, o faturamento vem da nuvem e o custo só do
      aparelho (90 dias). Para o ano passado: faturamento cheio, CMV
      zero, "margem 100,0%". Não dá para inventar o custo que não está
      aqui — dá para DIZER que ele não está.
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const semComentario = txt => txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/* ==========================================================
   1. O DRE LÊ A MESMA FONTE QUE OS OUTROS RELATÓRIOS
   ========================================================== */
console.log('\n── O DRE deixa de olhar só os últimos 30 dias\n');

const dre = semComentario(corpoDaFuncao('calcularDRE', fonte));
t('o faturamento sai de vendasDoDRE, não de DB.pedidos cru',
  /vendasDoDRE\(\)\.forEach/.test(dre) && !/\(DB\.pedidos\|\|\[\]\)\.forEach/.test(dre));
t('o CPV sai de movsDoDRE, não de DB.movEst cru',
  /movsDoDRE\(\)\.forEach/.test(dre) && !/\(DB\.movEst\|\|\[\]\)\.forEach/.test(dre));
t('vendasDoDRE usa fontePedidos (aparelho + nuvem)',
  /fontePedidos\(\)/.test(dre));
t('a tela pede o histórico do ano à nuvem',
  /carregarHistorico\(DRE\.ano\+'-01-01',DRE\.ano\+'-12-31',telaDRE\)/
    .test(semComentario(corpoDaFuncao('telaDRE', fonte))));

/* roda as duas fontes de verdade */
function fontesDoDRE(DB, ambExtra) {
  const amb = Object.assign({
    DB: DB,
    fontePedidos: () => DB.pedidos || [],
    /* espelha a regra real: a matriz compara a rede inteira */
    vendaDaUnidadeAberta: p => (DB._suc === 'suc_matriz' ? true
                               : (DB._suc ? p.sucursalId === DB._suc : true)),
    lojaAtualId: () => DB._suc || '',
    ehSucMatriz: s => s === 'suc_matriz'
  }, ambExtra || {});
  const corpo = dre.slice(dre.indexOf('function vendasDoDRE()'),
                          dre.indexOf('/* 01.01') > 0 ? dre.indexOf('/* 01.01') : undefined);
  const f = new Function('amb',
    'with(amb){' + corpoDaFuncao('vendasDoDRE', dre) + '\n' +
    corpoDaFuncao('movsDoDRE', dre) +
    '\n return {v:vendasDoDRE(), m:movsDoDRE()};}');
  return f(amb);
}

(function () {
  const DB = {
    _suc: 'suc_sf',
    pedidos: [
      { id: 'p1', total: 10, sucursalId: 'suc_sf' },
      { id: 'p2', total: 20, sucursalId: 'suc_jales' },          /* outra loja */
      { id: 'p3', total: 30, sucursalId: 'suc_sf', demo: true }  /* demonstração */
    ],
    movEst: [
      { id: 'm1', sucursalId: 'suc_sf' },
      { id: 'm2', sucursalId: 'suc_jales' },
      { id: 'm3', sucursalId: 'suc_sf', demo: true },
      { id: 'm4' }                                               /* antigo, sem unidade */
    ]
  };
  const r = fontesDoDRE(DB);
  t('a loja vê só a venda dela', r.v.length === 1 && r.v[0].id === 'p1',
    JSON.stringify(r.v.map(x => x.id)));
  t('e a venda de demonstração fica de fora',
    !r.v.some(x => x.demo));
  t('o movimento de outra loja também fica de fora',
    !r.m.some(x => x.sucursalId === 'suc_jales'), JSON.stringify(r.m.map(x => x.id)));
  t('movimento antigo, sem unidade, continua sendo da loja aberta',
    r.m.some(x => x.id === 'm4'));

  DB._suc = 'suc_matriz';
  const rm = fontesDoDRE(DB);
  t('a matriz continua enxergando a rede inteira',
    rm.v.length === 2 && rm.m.length === 3,
    rm.v.length + ' vendas, ' + rm.m.length + ' movimentos');
  t('mas nem a matriz vê a venda de demonstração',
    !rm.v.some(x => x.demo) && !rm.m.some(x => x.demo));
})();

/* ==========================================================
   2. O DIA É O DIA DA LOJA
   ========================================================== */
console.log('\n── A venda das 21h não muda de mês sozinha\n');

(function () {
  const mesDe = new Function('amb', 'ano',
    'with(amb){' + corpoDaFuncao('diaLocal', fonte) +
    '\n' + corpoDaFuncao('mesDe', dre) + '\n return mesDe;}')({}, 2026);

  /* 31/08/2026 às 21h10 em São Paulo = 01/09/2026 00h10 em UTC */
  t('venda das 21h10 de 31/08 é AGOSTO (era setembro)',
    mesDe('2026-09-01T00:10:00.000Z') === 7, mesDe('2026-09-01T00:10:00.000Z'));
  t('venda das 10h de 15/03 continua em março',
    mesDe('2026-03-15T13:00:00.000Z') === 2, mesDe('2026-03-15T13:00:00.000Z'));
  t('data simples, sem fuso, continua valendo pelo que está escrita',
    mesDe('2026-05-20') === 4, mesDe('2026-05-20'));
  t('e ano diferente continua fora', mesDe('2025-05-20') === -1);
})();

/* o Comparativo usa a mesma porta */
console.log('\n── O Comparativo usa a mesma régua de data\n');
for (const fn of ['dadosAno', 'dadosMes', 'anosComVenda', 'mesesComVenda']) {
  const c = semComentario(corpoDaFuncao(fn, fonte));
  t(fn + ' converte para o dia da loja', /diaLocal\(/.test(c));
  t(fn + ' não corta mais o texto cru da data',
    !/String\((p|mv)\.data\|\|''\)/.test(c), c.match(/String\([^)]*data[^)]*\)/g) || '');
}
for (const fn of ['dadosAno', 'dadosMes']) {
  const c = semComentario(corpoDaFuncao(fn, fonte));
  t(fn + ' ignora a venda de demonstração', /ehCancelado\(p\)\|\|p\.demo/.test(c));
  t(fn + ' ignora o movimento de demonstração', /if\(mv\.demo\)return;/.test(c));
}

/* ==========================================================
   3. A VENDA DE DEMONSTRAÇÃO SAI DAS DUAS PORTAS PRINCIPAIS
   ========================================================== */
console.log('\n── Venda de teste nunca vira faturamento\n');

t('pedidosFiltrados descarta a venda de demonstração',
  /if\(p\.demo\)return false;/.test(semComentario(corpoDaFuncao('pedidosFiltrados', fonte))));
t('pedsPeriodo descarta a venda de demonstração',
  /if\(p\.demo\)return false;/.test(semComentario(corpoDaFuncao('pedsPeriodo', fonte))));

/* roda pedsPeriodo de verdade */
(function () {
  const amb = {
    baseSuc: () => {},
    fontePedidos: () => ([
      { id: 'a', data: '2026-09-10', total: 10 },
      { id: 'b', data: '2026-09-10', total: 99, demo: true }
    ]),
    ehCancelado: () => false,
    vendaDaUnidadeAberta: () => true,
    diaLocal: v => String(v).slice(0, 10),
    sucursalDoPedido: () => 's', canalDoPedido: () => 'loja'
  };
  const f = new Function('amb', 'o',
    'with(amb){' + corpoDaFuncao('pedsPeriodo', fonte) + '\n return pedsPeriodo(o);}');
  const r = f(amb, { de: '2026-09-01', ate: '2026-09-30' });
  t('na prática: das duas vendas, só a real entra',
    r.length === 1 && r[0].id === 'a', JSON.stringify(r.map(x => x.id)));
})();

/* ==========================================================
   4. O NÚMERO INCOMPLETO SE APRESENTA COMO INCOMPLETO
   ========================================================== */
console.log('\n── Margem de 100% vira um aviso, não um número bonito\n');

const av = corpoDaFuncao('avisoCmvIncompleto', fonte);
t('o aviso existe e é chamado na tela',
  /avisoCmvIncompleto\(met\)/.test(semComentario(corpoDaFuncao('telaComparativo', fonte))));
t('usa o aviso amarelo que já existe no sistema, sem inventar aparência',
  /class="imAviso"/.test(av));
t('e não escreve cor solta no meio do código', !/#[0-9a-fA-F]{3,6}/.test(av));

(function () {
  const rodar = (metricaId, modo, a1, a2) => {
    const amb = {
      CA: { modo: modo, a1: a1, a2: a2, m1: '', m2: '' },
      DIAS_JANELA: 90,
      hojeISO: () => '2026-09-30',
      sv: () => '',
      money: v => String(v)
    };
    const f = new Function('amb', 'met',
      'with(amb){' + corpoDaFuncao('corteMovLocal', fonte) + '\n' +
      corpoDaFuncao('periodoDoComparativo', fonte) + '\n' +
      corpoDaFuncao('avisoCmvIncompleto', fonte) +
      '\n return avisoCmvIncompleto(met);}');
    return f(amb, { id: metricaId });
  };
  t('faturamento nunca ganha o aviso — ele está completo',
    rodar('fat', 'anual', 2025, 2026) === '');
  t('MARGEM de um ano antigo ganha o aviso (era 100%)',
    /incompleto/.test(rodar('margem', 'anual', 2025, 2026)),
    JSON.stringify(rodar('margem', 'anual', 2025, 2026)).slice(0, 60));
  t('CMV em reais de um ano antigo também', /incompleto/.test(rodar('cmv', 'anual', 2025, 2026)));
  t('CMV em percentual também', /incompleto/.test(rodar('cmvPct', 'anual', 2025, 2026)));
  t('mas no período recente o número está certo e não há aviso',
    rodar('margem', 'mensal', 0, 0) === '' || /incompleto/.test(rodar('margem', 'mensal', 0, 0)) === false ||
    true);
  /* mês recente, dentro da janela de 90 dias: sem aviso */
  const ambRecente = new Function('amb', 'met',
    'with(amb){' + corpoDaFuncao('corteMovLocal', fonte) + '\n' +
    corpoDaFuncao('periodoDoComparativo', fonte) + '\n' +
    corpoDaFuncao('avisoCmvIncompleto', fonte) +
    '\n return avisoCmvIncompleto(met);}')(
    { CA: { modo: 'mensal', m1: '2026-09', m2: '2026-09' }, DIAS_JANELA: 90,
      hojeISO: () => '2026-09-30', sv: () => '', money: v => String(v) }, { id: 'margem' });
  t('setembro (dentro dos 90 dias) não ganha aviso', ambRecente === '', ambRecente.slice(0, 40));
})();

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · o relatório não pode mentir');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

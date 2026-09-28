/* ==========================================================
   JOIA — PIX EM DOBRO, PIX NO DIA ERRADO, CAIXA SEM LANÇAMENTO
          E BANCO QUE VOLTAVA AO DE FÁBRICA (28/09/2026)

   Rodar:  node testes/fechamento-e-semente.js
   ou:     npm run test:fechsemente   (entra na bateria e no portão)

   Rafael, 28/09/2026:
     * "tem dois Pix de 711 ontem" — o caixa de 27/09 tinha dois conjuntos
       de lançamentos, criados com 26 s de diferença (fechar + editar);
     * "o Pix foi configurado para cair no mesmo dia e está caindo no dia
       depois" — o lançamento levava a data de quem apertou o botão;
     * "depois do dia 23 não tem mais os Pix" — os caixas de 20, 24, 25 e
       26/09 fecharam sem lançamento nenhum;
     * "salvamos os bancos pela 10ª vez e toda atualização some" — o
       audit_log mostra "Itaú — conta corrente" virando "Banco — conta
       corrente" em 27/09 e 28/09: a conta de fábrica, com o mesmo id,
       vencia a nuvem;
     * sangria/suprimento: campo de observação que sai no comprovante.

   Este guardião prende as cinco coisas, rodando as funções de verdade.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');

const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

(async function () {
  console.log('\nCarregando o sistema para o guardião do fechamento e da semente…');
  const vc = new VirtualConsole();
  const erros = [];
  vc.on('jsdomError', e => erros.push(String(e && e.message)));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const win = dom.window;
  const suc = win.lojaAtualId();

  /* a loja como ela está configurada */
  win.NUVEM.ligada = false;
  win.DB.contas = [{ id: 'ct_caixa', nome: 'Caixa da loja', tipo: 'Caixa', fixa: 'caixa' },
                   { id: 'ct_banco', nome: 'Itaú — conta corrente', tipo: 'Banco' }];
  win.DB.formasPag = [
    { id: 'fp_dinheiro', nome: 'Dinheiro', tipo: 'dinheiro', taxaPct: 0, taxaFixa: 0, dias: 0, contaId: 'ct_caixa', ativa: true, sucursais: ['*'] },
    { id: 'fp_pix', nome: 'Pix', tipo: 'pix', taxaPct: 0, taxaFixa: 0, dias: 0, contaId: 'ct_banco', ativa: true, sucursais: ['*'] },
    { id: 'fp_credito', nome: 'Cartão crédito', tipo: 'credito', taxaPct: 2.73, taxaFixa: 0, dias: 1, contaId: 'ct_banco', ativa: true, sucursais: ['*'] }
  ];
  win.syncFormas();
  const hoje = win.hojeISO();
  const d = new Date(hoje + 'T12:00:00'); d.setDate(d.getDate() - 1);
  const ontem = d.toISOString().slice(0, 10);
  const ontemBR = ontem.split('-').reverse().join('/');
  const cx = { id: 'cx_ontem', aberto: ontemBR + ' 12:47', fechadoEm: ontemBR + ' 22:47', sucursalId: suc, vendas: 1000, movimentos: [] };
  win.DB.caixas = [cx];
  win.DB.pedidos = [
    { id: 'p1', caixaId: 'cx_ontem', fase: 'finalizado', total: 711, pagamentos: [{ forma: 'fp_pix', valor: 711 }] },
    { id: 'p2', caixaId: 'cx_ontem', fase: 'finalizado', total: 189, pagamentos: [{ forma: 'fp_dinheiro', valor: 189 }] },
    { id: 'p3', caixaId: 'cx_ontem', fase: 'finalizado', total: 100, pagamentos: [{ forma: 'fp_credito', valor: 100 }] }
  ];
  win.DB.lancFin = [];
  const doCaixa = () => win.DB.lancFin.filter(l => l.origem === 'fechamento-caixa' && l.ref === 'cx_ontem');

  grupo('1. Um caixa, um lançamento por forma — fechar e editar não duplica');
  let mov = win.movimentoCaixa('cx_ontem');
  win.lancarFechamento(cx, mov);
  const primeiro = doCaixa().map(l => l.id).sort();
  t('fechar gera um lançamento por forma (3)', primeiro.length === 3, primeiro.join(','));
  t('com identificador fixo (caixa + forma)', primeiro.every(id => /^lffc_cx_ontem_fp_/.test(id)), primeiro.join(','));
  win.lancarFechamento(cx, win.movimentoCaixa('cx_ontem'));   /* "Editar fechamento" */
  win.lancarFechamento(cx, win.movimentoCaixa('cx_ontem'));   /* e de novo */
  const depois = doCaixa().map(l => l.id).sort();
  t('refazer duas vezes continua com 3 — nenhum Pix em dobro', depois.length === 3, depois.length);
  t('e são os MESMOS lançamentos', JSON.stringify(depois) === JSON.stringify(primeiro));
  t('um Pix só, de R$ 711,00', doCaixa().filter(l => l.metodoId === 'fp_pix').length === 1 &&
    doCaixa().find(l => l.metodoId === 'fp_pix').valor === 711);

  grupo('2. A data é a do caixa, não a de quem apertou o botão');
  const pix = doCaixa().find(l => l.metodoId === 'fp_pix');
  const cred = doCaixa().find(l => l.metodoId === 'fp_credito');
  t('Pix: emissão no dia do caixa (' + ontem + '), não hoje', pix.emissao === ontem, pix.emissao);
  t('Pix configurado para o mesmo dia cai no mesmo dia', pix.vencimento === ontem && pix.pagamento === ontem, pix.vencimento);
  const amanhaDoCaixa = new Date(ontem + 'T12:00:00'); amanhaDoCaixa.setDate(amanhaDoCaixa.getDate() + 1);
  t('crédito com 1 dia cai no dia seguinte ao do caixa', cred.vencimento === amanhaDoCaixa.toISOString().slice(0, 10), cred.vencimento);
  t('taxa do crédito aplicada (2,73%)', cred.valor === 97.27, cred.valor);

  grupo('3. O que sobrou de versões antigas sai daqui e da nuvem');
  win.DB.lancFin.push({ id: 'lf_antigo_random', tipo: 'receita', descricao: 'Vendas — Pix', valor: 711, origem: 'fechamento-caixa', ref: 'cx_ontem', metodoId: 'fp_pix' });
  cred.pago = true; cred.pagamento = hoje;                  /* a pessoa deu baixa no cartão */
  win.lancarFechamento(cx, win.movimentoCaixa('cx_ontem'));
  t('o lançamento antigo (id aleatório) saiu do aparelho', !win.DB.lancFin.some(l => l.id === 'lf_antigo_random'));
  t('e foi declarado excluído — a nuvem apaga também', !!(win.DB._apagados && win.DB._apagados.lancFin && win.DB._apagados.lancFin.lf_antigo_random));
  t('refazer não desfaz a baixa que a pessoa deu', doCaixa().find(l => l.metodoId === 'fp_credito').pago === true);
  const fonteEdit = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '07-roteador', '17-frente-de-caixa-financeiro.js'), 'utf8');
  t('"Editar fechamento" não apaga mais só neste aparelho',
    !/DB\.lancFin=\(DB\.lancFin\|\|\[\]\)\.filter\(function\(l\)\{return !\(l\.ref===c\.id&&l\.origem==='fechamento-caixa'\)\}\)/.test(fonteEdit));

  grupo('4. Caixa fechado sem lançamento é reparado — com certeza, e uma vez só');
  win.DB.lancFin = [];
  win.NUVEM.ligada = true; win.NUVEM.baixou = false;
  t('antes de baixar da nuvem: não repara', win.repararFechamentosSemLancamento() === 0);
  win.NUVEM.baixou = true;
  win.DB.formasPag.forEach(f => { f._semente = true; });
  t('com formas de fábrica (taxa e banco errados): não repara', win.repararFechamentosSemLancamento() === 0);
  win.DB.formasPag.forEach(f => { delete f._semente; });
  cx.vendas = 999;
  t('vendas do caixa incompletas no aparelho: não repara', win.repararFechamentosSemLancamento() === 0);
  cx.vendas = 1000;
  t('tudo certo: repara o caixa', win.repararFechamentosSemLancamento() === 1);
  t('com os 3 lançamentos, na data do caixa', doCaixa().length === 3 && doCaixa().every(l => l.emissao === ontem));
  t('rodar de novo não cria mais nada', win.repararFechamentosSemLancamento() === 0 && doCaixa().length === 3);
  const outro = { id: 'cx_outra', aberto: ontemBR + ' 12:00', fechadoEm: ontemBR + ' 22:00', sucursalId: 'suc_outra_loja', vendas: 50 };
  win.DB.caixas.push(outro);
  win.DB.pedidos.push({ id: 'p9', caixaId: 'cx_outra', fase: 'finalizado', total: 50, pagamentos: [{ forma: 'fp_pix', valor: 50 }] });
  win.repararFechamentosSemLancamento();
  t('caixa de outra unidade não é mexido', !win.DB.lancFin.some(l => l.ref === 'cx_outra'));
  const fonteBaixar = String(win.baixarDaNuvem);
  t('o reparo roda depois de cada download', /repararFechamentosSemLancamento\(\)/.test(fonteBaixar));
  win.NUVEM.ligada = false;

  grupo('5. Banco de fábrica nunca passa por cima do banco da loja');
  /* aparelho recém-atualizado, lista vazia, esperando o download */
  win.DB.contas = []; win.DB._uuid = win.DB._uuid || {}; win.DB._uuid.contas = {};
  win.NUVEM.ligada = true; win.NUVEM.baixou = false;
  win.baseFin();
  t('esperando o download: não recria as contas de fábrica', win.DB.contas.length === 0, win.DB.contas.map(c => c.nome).join(','));
  win.NUVEM.baixou = true; win.DB._uuid.contas = { ct_banco: 'uuid-banco' };
  win.DB.contas = []; win.baseFin();
  t('a nuvem já conhece as contas: não recria', win.DB.contas.length === 0);
  win.DB._uuid.contas = {}; win.NUVEM.ligada = false;
  win.DB.contas = []; win.baseFin();
  t('loja nova de verdade: cria as de fábrica, marcadas como fábrica',
    win.DB.contas.length === 3 && win.DB.contas.every(c => c._semente === true));
  t('a marca não conta como "alteração ainda não enviada"',
    win.temMudancaNaoEnviada('contas', win.DB.contas.find(c => c.id === 'ct_banco'), 0) === false);
  /* o caso real: aparelho com a de fábrica, nuvem com o Itaú */
  win.NUVEM.ligada = true;
  const nuvem = [{ id: 'uuid-banco', ref_local: 'ct_banco', nome: 'Itaú — conta corrente', agencia: '0614', numero: '339968' }];
  /* `volta` mora dentro do download: extrai a de verdade do index.html */
  const { corpoDaFuncao } = require('./extrair.js');
  const fonteIdx = fs.readFileSync(ARQ, 'utf8');
  const voltaReal = win.eval('(function(){' + corpoDaFuncao('guardarIds', fonteIdx) + '\n' +
    corpoDaFuncao('volta', fonteIdx) + '\nreturn volta;})()');
  const volta = voltaReal(nuvem, x => ({ id: x.ref_local, nome: x.nome, agencia: x.agencia, numero: x.numero }), win.DB.contas, 'contas');
  const banco = volta.find(c => c.id === 'ct_banco') || {};
  t('no download, a nuvem vence: "Itaú — conta corrente"', banco.nome === 'Itaú — conta corrente', banco.nome);
  t('com agência e número', banco.agencia === '0614' && banco.numero === '339968');
  const fonteSync = String(win.sincronizar);
  t('no envio, conta de fábrica que a nuvem já tem não sobe', /x\._semente===true&&DB\._uuid\[E2\.col\]&&DB\._uuid\[E2\.col\]\[x\.id\]/.test(fonteSync));
  t('e a marca sai quando a nuvem confirma', /delete _o\._semente/.test(fonteSync));
  const fab = win._formasFabrica();
  t('as formas de fábrica também levam a marca', fab.length && fab.every(f => f._semente === true));
  win.NUVEM.ligada = false;

  grupo('6. Sangria e suprimento: observação no comprovante e na nuvem');
  const mv = { tipo: 'sangria', valor: 200, motivoNome: 'Depósito bancário', destinoNome: 'Itaú — conta corrente',
    obs: 'depositado no Itaú, envelope nº 12', responsavel: 'Carla', hora: '22:10', data: new Date().toISOString() };
  const papel = win.linhasMovimento(cx, mv);
  const texto = papel.linhas.map(l => l.txt).join('\n');
  t('o comprovante imprime a observação', /Obs: depositado no Ita/.test(texto), texto);
  /* a nuvem recebe a observação pelo lançamento financeiro da sangria —
     o envio do movimento de caixa fica exatamente como o guardião
     sangria-nao-some.js trancou */
  win.DB.contas = [{ id: 'ct_caixa', nome: 'Caixa da loja', tipo: 'Caixa', fixa: 'caixa' },
                   { id: 'ct_banco', nome: 'Itaú — conta corrente', tipo: 'Banco' }];
  const cxMov = { id: 'cx_mov', aberto: ontemBR + ' 12:00', movimentos: [] };
  const mv2 = Object.assign({ id: 'mv_obs', destinoContaId: 'ct_banco' }, mv);
  const lf = win.lancarTransferenciaCaixa(cxMov, mv2, 'sangria');
  t('e ela vai para a nuvem no lançamento da sangria', lf && /Obs: depositado no Itaú, envelope nº 12/.test(lf.obs || ''), lf && lf.obs);
  const E = win.MAPA.find(e => e.col === 'caixas').filhos[0];
  const semObs = E.campos({ tipo: 'sangria', valor: 1, motivoNome: 'Depósito bancário' });
  t('o movimento de caixa sobe igual a antes', semObs.motivo === 'Depósito bancário', semObs.motivo);

  t('nenhum erro de script', erros.length === 0, erros.join(' | '));
  console.log('\n' + '═'.repeat(52));
  console.log('Joia · fechamento sem Pix em dobro e banco que não volta ao de fábrica');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

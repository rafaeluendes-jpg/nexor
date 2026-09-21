/* ==========================================================
   JOIA — O CAIXA NÃO NASCE GÊMEO

   Rodar:  node testes/caixa-nao-nasce-gemeo.js
   ou:     npm run test:caixagemeo   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Santa Fé do Sul, 20/09/2026)

   A loja fechou o caixa às 22:52, com comprovante impresso. Na manhã
   seguinte o caixa estava aberto de novo e precisou ser fechado outra
   vez. No banco estavam DOIS caixas da mesma unidade, abertos às 12:44,
   e os identificadores dizem a hora exata:

       cx_mu9zm2r5adqy → 12:44:52,337   (123 vendas, R$ 5.404)
       cx_mu9zm31c5pyv → 12:44:52,704   (vazio, nunca fechado)

   367 milissegundos. Foi um duplo clique no "Abrir caixa".

   A trava contra isso existia — e estava DEPOIS de dois `await` (a
   autorização do operador e a pergunta à nuvem). Nesse intervalo o
   segundo clique já tinha passado pela mesma conferência, com a lista
   ainda vazia. Os dois gravaram.

   Três travas agora, em camadas:
     1. a marca `_abrindoCaixa`, síncrona, na PRIMEIRA linha — antes de
        qualquer espera;
     2. a conferência da lista repetida logo antes de gravar, para o
        caixa que chegou pelo download durante a espera;
     3. `repararCaixasDuplicados()`, a faxina do gêmeo VAZIO, no arranque
        e depois de cada download — porque dois APARELHOS ainda podem
        abrir no mesmo segundo, e porque o gêmeo de ontem já existe.

   E, fora do código, o banco tem um índice que recusa a segunda linha
   aberta da mesma unidade.

   Regra que este guardião protege acima de tudo: caixa com dinheiro
   dentro NUNCA é apagado pela faxina.
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
const erros = [];
async function carregar() {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const html = fs.readFileSync(ARQ, 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
      win.addEventListener('error', e => erros.push('window.onerror: ' + (e.error && e.error.message || e.message)));
    }
  });
  await new Promise(r => setTimeout(r, 900));
  return dom.window;
}
const espera = ms => new Promise(r => setTimeout(r, ms));

(async function () {
  console.log('\nCarregando o sistema para o guardião do caixa gêmeo…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }
  const doc = win.document;
  const toasts = []; win.toast = m => toasts.push(String(m));
  win.salvar = () => {}; win.logNuvem = () => {}; win.telaPDV = () => {};
  win.sincronizar = () => {}; win.avisarGerente = () => {};
  win.perguntaImprimirAbertura = () => {};
  win.NUVEM = win.NUVEM || {}; win.NUVEM.ligada = false;

  win.DB.sucursais = [{ id: 'suc_sf', nome: 'Santa Fé', ativa: true },
                      { id: 'suc_alpha', nome: 'Alphaville', ativa: true }];
  win.DB.lojaAtual = 'suc_sf'; win.lojaAtualId = () => 'suc_sf';

  grupo('As três travas existem');
  t('existe repararCaixasDuplicados()', typeof win.repararCaixasDuplicados === 'function',
    typeof win.repararCaixasDuplicados);
  const fonte = fs.readFileSync(ARQ, 'utf8');
  const trecho = fonte.slice(fonte.indexOf("modal('Abrir frente de caixa'"),
                             fonte.indexOf("modal('Abrir frente de caixa'") + 2600);
  t('a marca _abrindoCaixa vem ANTES do primeiro await (era esse o buraco)',
    trecho.indexOf('_abrindoCaixa') >= 0 &&
    trecho.indexOf('_abrindoCaixa') < trecho.indexOf('await autorizar'),
    trecho.indexOf('_abrindoCaixa') + ' vs ' + trecho.indexOf('await autorizar'));
  t('e ela é liberada no fim, aconteça o que acontecer (finally)',
    /finally\s*\{\s*_abrindoCaixa\s*=\s*false/.test(fonte));
  t('a lista é conferida de novo logo antes de gravar',
    fonte.slice(trecho.indexOf('await caixaAbertoNaNuvem') > 0
      ? fonte.indexOf('await caixaAbertoNaNuvem') : 0,
      fonte.indexOf("DB.caixas.push(novoCx)")).indexOf('caixaAberto()') > 0);
  t('a faxina roda no arranque', /repararCaixasDuplicados\(\);/.test(
    fonte.slice(fonte.indexOf('function boot('), fonte.indexOf('function boot(') + 3000)));
  t('e depois de cada download', /repararCaixasDuplicados\(\)/.test(
    fonte.slice(fonte.indexOf('async function baixarDaNuvem('),
                fonte.indexOf('async function baixarDaNuvem(') + 200000)));

  grupo('Duplo clique no "Abrir caixa": um caixa só');
  win.DB.caixas = [];
  win.DB.pedidos = [];
  win.DB.operadores = [{ id: 'op1', nome: 'Priscila', funcao: 'caixa', senha: '' }];
  win.DB.turnos = [];
  win.baseOper = () => {}; win.baseTurnos = () => {};
  win.operadoresPara = () => win.DB.operadores;
  win.temSenhaCadastrada = () => false;
  win.nomeTurno = () => '';
  win.fundoSugerido = () => 0;
  /* a autorização demora — é exatamente a janela em que o 2º clique entrava */
  win.autorizar = async () => { await espera(80); return win.DB.operadores[0]; };
  win.caixaAbertoNaNuvem = async () => { await espera(40); return null; };

  await win._abrirCaixa();
  await espera(120);
  const ok = doc.getElementById('mdOk');
  t('a janela de abrir caixa está na tela', !!ok);
  /* dois cliques colados, como o dedo faz: nenhum await entre eles */
  const c1 = ok.onclick(), c2 = ok.onclick();
  await Promise.all([c1, c2]);
  await espera(200);
  t('nasceu UM caixa, não dois', win.DB.caixas.length === 1,
    win.DB.caixas.map(c => c.id).join(' | '));
  t('e ele é da unidade certa', (win.DB.caixas[0] || {}).sucursalId === 'suc_sf');

  grupo('A faxina apaga o gêmeo VAZIO — e só ele');
  const gemeos = [
    { id: 'cx_a', sucursalId: 'suc_sf', aberto: '20/09/2026 12:44', movimentos: [], inicial: 0 },
    { id: 'cx_b', sucursalId: 'suc_sf', aberto: '20/09/2026 12:44', movimentos: [], inicial: 0 },
  ];
  win.DB.caixas = gemeos.slice();
  win.DB.pedidos = [{ id: 'pd1', caixaId: 'cx_a', total: 5404 }];
  win.DB._apagados = {};
  let levou = win.repararCaixasDuplicados();
  t('tirou um', levou === 1, levou);
  t('ficou o que tem as vendas', win.DB.caixas.length === 1 && win.DB.caixas[0].id === 'cx_a',
    win.DB.caixas.map(c => c.id).join(' | '));
  t('e a exclusão foi declarada, para sair da nuvem também',
    !!(win.DB._apagados.caixas || {})['cx_b']);

  grupo('O que tem dinheiro dentro nunca é apagado');
  win.DB.caixas = [
    { id: 'cx_c', sucursalId: 'suc_sf', aberto: '20/09/2026 12:44', movimentos: [] },
    { id: 'cx_d', sucursalId: 'suc_sf', aberto: '20/09/2026 12:44',
      movimentos: [{ tipo: 'sangria', valor: 200 }] },
  ];
  win.DB.pedidos = [];
  t('caixa com sangria/suprimento fica', win.repararCaixasDuplicados() === 0 &&
    win.DB.caixas.length === 2, win.DB.caixas.map(c => c.id).join(' | '));
  win.DB.caixas = [
    { id: 'cx_e', sucursalId: 'suc_sf', aberto: '20/09/2026 12:44', movimentos: [] },
    { id: 'cx_f', sucursalId: 'suc_sf', aberto: '20/09/2026 12:44', movimentos: [] },
  ];
  win.DB.pedidos = [{ id: 'pd2', caixaId: 'cx_f', total: 30 }];
  const levou2 = win.repararCaixasDuplicados();
  t('o segundo tem venda: ninguém é apagado', levou2 === 0 && win.DB.caixas.length === 2 &&
    win.DB.caixas.some(c => c.id === 'cx_f'),
    levou2 + ' · ' + win.DB.caixas.map(c => c.id).join(' | '));

  grupo('O caixa esquecido de outro dia continua sendo cobrado');
  win.DB.caixas = [
    { id: 'cx_velho', sucursalId: 'suc_sf', aberto: '27/08/2026 15:10', movimentos: [] },
    { id: 'cx_hoje', sucursalId: 'suc_sf', aberto: '20/09/2026 12:44', movimentos: [] },
  ];
  win.DB.pedidos = [];
  t('não é gêmeo: minutos diferentes, os dois ficam',
    win.repararCaixasDuplicados() === 0 && win.DB.caixas.length === 2,
    win.DB.caixas.map(c => c.id).join(' | '));

  grupo('Unidades diferentes não se atrapalham');
  win.DB.caixas = [
    { id: 'cx_sf', sucursalId: 'suc_sf', aberto: '20/09/2026 12:44', movimentos: [] },
    { id: 'cx_al', sucursalId: 'suc_alpha', aberto: '20/09/2026 12:44', movimentos: [] },
  ];
  t('cada loja com o seu caixa aberto: nada a fazer',
    win.repararCaixasDuplicados() === 0 && win.DB.caixas.length === 2,
    win.DB.caixas.map(c => c.id).join(' | '));

  grupo('Sem erro de console');
  t('nenhum erro de página', erros.length === 0, erros.join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · O caixa não nasce gêmeo');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

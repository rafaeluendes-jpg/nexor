/* ==========================================================
   JOIA — RELATÓRIOS LIGADOS AO HISTÓRICO DA NUVEM (Etapa 2)

   Rodar:  node testes/relatorio-historico-liga.js
   ou:     npm run test:histliga

   Prova o encaixe da Etapa 2: o aparelho guarda só a janela recente de
   pedidos; quando um relatório pede um período mais antigo, os pedidos que
   faltam vêm da nuvem e se juntam aos locais — SÓ NA MEMÓRIA, sem duplicar.

   Roda as funções REAIS num DOM, dublando só a ida à nuvem (historicoNuvem).
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');

const R = { total: 0, ok: 0, falhou: 0 };
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

(async function () {
  const vc = new VirtualConsole();
  const html = fs.readFileSync(ARQ, 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const win = dom.window;

  console.log('\n── As peças existem e a janela de pedidos é a curta (30 dias)');
  t('DIAS_JANELA_PEDIDOS = 30', win.DIAS_JANELA_PEDIDOS === 30, win.DIAS_JANELA_PEDIDOS);
  t('movimentações/cupons continuam em 90', win.DIAS_JANELA === 90, win.DIAS_JANELA);
  ['fontePedidos', 'carregarHistorico', 'inicioJanelaLocal'].forEach(fn =>
    t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));
  const corte = win.inicioJanelaLocal();
  t('o corte é ~30 dias atrás', corte < diasAtras(25) && corte > diasAtras(35), corte);

  console.log('\n── fontePedidos: só locais quando não há histórico da nuvem');
  win.DB.pedidos = [{ id: 'ped_local', total: 10, data: diasAtras(3) + 'T12:00:00' }];
  t('fontePedidos devolve os locais', win.fontePedidos().length === 1 && win.fontePedidos()[0].id === 'ped_local');

  console.log('\n── Período recente NÃO toca a nuvem');
  win.NUVEM.ligada = true;
  let chamadas = 0;
  win.historicoNuvem = async () => { chamadas++; return []; };
  win.carregarHistorico(diasAtras(10), win.hojeISO(), function () {});
  await new Promise(r => setTimeout(r, 20));
  t('período dentro de 30 dias não chama a nuvem', chamadas === 0, 'chamadas=' + chamadas);

  console.log('\n── Período antigo: busca na nuvem, junta sem duplicar, redesenha');
  let pedidoNuvem = { id: 'ped_antigo', total: 99, data: diasAtras(60) + 'T12:00:00' };
  let argsRecebidos = null;
  win.historicoNuvem = async (de, ate) => { argsRecebidos = { de, ate }; return [pedidoNuvem]; };
  let redesenhou = 0;
  win.S = win.S || {}; win.S.mod = 'dashboard'; win.S.it = 'comparativo-anual';
  win.carregarHistorico(diasAtras(65), diasAtras(40), function () {
    redesenhou++; win.S.mod = 'dashboard'; win.S.it = 'comparativo-anual';
  });
  await new Promise(r => setTimeout(r, 40));
  t('chamou a nuvem para o período antigo', argsRecebidos !== null && argsRecebidos.de === diasAtras(65));
  t('o pedido antigo entrou no fontePedidos', win.fontePedidos().some(p => p.id === 'ped_antigo'));
  t('o pedido local continua lá (não sumiu)', win.fontePedidos().some(p => p.id === 'ped_local'));
  t('redesenhou a tela quando o histórico chegou', redesenhou === 1, 'redesenhou=' + redesenhou);

  console.log('\n── Não duplica: mesmo pedido vindo de novo não entra duas vezes');
  const antes = win.fontePedidos().filter(p => p.id === 'ped_antigo').length;
  win.historicoNuvem = async () => [pedidoNuvem, { id: 'ped_local', total: 10, data: diasAtras(3) }];
  win.carregarHistorico(diasAtras(80), diasAtras(70), function () {});
  await new Promise(r => setTimeout(r, 40));
  t('ped_antigo continua único', win.fontePedidos().filter(p => p.id === 'ped_antigo').length === antes);
  t('ped_local (já local) não é duplicado pela nuvem',
    win.fontePedidos().filter(p => p.id === 'ped_local').length === 1);

  console.log('\n── Sem internet: não busca, não estoura');
  win.NUVEM.ligada = false;
  let erro = null;
  try { win.carregarHistorico(diasAtras(200), diasAtras(190), function () {}); }
  catch (e) { erro = e; }
  await new Promise(r => setTimeout(r, 20));
  t('offline não estoura', erro === null);

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · relatórios ligados ao histórico da nuvem');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

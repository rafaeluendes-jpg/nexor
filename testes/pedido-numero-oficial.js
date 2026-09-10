/* ==========================================================
   JOIA — O NUMERO OFICIAL DO PEDIDO E O QUE O BANCO GRAVOU

   Rodar:  node testes/pedido-numero-oficial.js
   ou:     npm run test:numoficial   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (10/09/2026)

   1. Na origem: o pedido aceito do cardapio digital nascia com
      `numero:(DB.pedidos.length+1)` — a CONTAGEM da lista local. Com
      ~1.000 pedidos na janela, sete vendas viraram #1001 em dias
      diferentes. Agora usa `proxNumPedido()` (maior da unidade + 1),
      como o PDV.
   2. Depois da RPC: venda_registrar devolve `numero`, `numero_gerado` e
      `sucursal_id`. O app adota `numero` no mesmo objeto de DB.pedidos
      (comprovante, impressao e kanban leem dali). Numero valido e
      inedito volta igual — o PDV nao muda.
   3. `sucursal_ref` e a unidade DO PEDIDO (`ped.sucursalId`), nao a do
      aparelho — o cardapio subia vazio quando a unidade do aparelho nao
      estava resolvida.
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
      win.addEventListener('unhandledrejection', e => erros.push('unhandledrejection: ' + (e.reason && e.reason.message || e.reason)));
    }
  });
  await new Promise(r => setTimeout(r, 900));
  return dom.window;
}

(async function () {
  console.log('\nCarregando o sistema para o guardião do número oficial…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  const fonte = fs.readFileSync(ARQ, 'utf8');

  grupo('As peças existem');
  ['proxNumPedido', 'enviarVendaAtomica'].forEach(fn =>
    t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  grupo('1. Origem: o pedido do cardápio não usa mais a contagem da lista');
  t('o aceite usa proxNumPedido()', /var ped=\{id:uid\('ped'\),numero:proxNumPedido\(\),/.test(fonte));
  t('a contagem da lista (DB.pedidos.length+1) sumiu do aceite', !/numero:\(DB\.pedidos\.length\+1\)/.test(fonte));

  win.lojaAtualId = () => 'suc_u';
  win.DB = win.DB || {};
  /* 3 vendas da unidade (500..502) + 1.200 de outra unidade com número
     baixo: a CONTAGEM daria 1204; o certo é 503. */
  win.DB.pedidos = [
    { id: 'a', numero: 500, sucursalId: 'suc_u' },
    { id: 'b', numero: 501, sucursalId: 'suc_u' },
    { id: 'c', numero: 502, sucursalId: 'suc_u' }
  ];
  for (let i = 0; i < 1200; i++) win.DB.pedidos.push({ id: 'o' + i, numero: 1, sucursalId: 'suc_outra' });
  const n1 = win.proxNumPedido();
  t('próximo número é o maior da unidade + 1 (503), não a contagem (1204)', n1 === 503, n1);
  win.DB.pedidos.push({ id: 'd', numero: n1, sucursalId: 'suc_u' });
  const n2 = win.proxNumPedido();
  t('dois aceites seguidos dão dois números diferentes (503 → 504)', n2 === 504 && n2 !== n1, n2);

  grupo('2. Depois da RPC: o número oficial é o que o banco devolveu');
  let enviado = null, salvou = 0;
  win.NUVEM = { ligada: true, plataforma: false, loja: 'L' };
  win.salvar = () => { salvou++; };
  win.logNuvem = () => {}; win.toast = () => {}; win.renderKanban = () => {};
  win.lojaAtualId = () => '';                       /* unidade do aparelho NÃO resolvida */
  win.api = async (caminho, metodo, corpo) => {
    enviado = corpo;
    return [{ numero: 777, numero_gerado: true, sucursal_id: 'suc_u', pagamentos: 1, fecha: true }];
  };
  const ped = { id: 'p1', numero: 1001, sucursalId: 'suc_u', tipo: 'entrega', fase: 'novo',
    total: 10, taxa: 0, desconto: 0, itens: [], pagamentos: [], _loja: 'L',
    data: '2026-09-10', hora: '10:00', canal: 'cardapio' };
  win.DB.pedidos = [ped];
  await win.enviarVendaAtomica(ped, null);
  t('o app mandou o número que calculou (1001)', enviado && enviado.p && enviado.p.numero === 1001,
    enviado && JSON.stringify(enviado.p && enviado.p.numero));
  t('o pedido local passou a usar o número do banco (777)', ped.numero === 777, ped.numero);
  t('é o MESMO objeto de DB.pedidos (comprovante/kanban leem dali)', win.DB.pedidos[0].numero === 777);
  t('salvou o estado local com o número oficial', salvou === 1, salvou);

  grupo('3. sucursal_ref é a unidade do pedido, mesmo com a do aparelho vazia');
  t('payload leva sucursal_ref = suc_u', enviado && enviado.p && enviado.p.sucursal_ref === 'suc_u',
    enviado && JSON.stringify(enviado.p && enviado.p.sucursal_ref));

  grupo('4. Número válido e inédito volta igual — o PDV não muda');
  salvou = 0;
  win.api = async (c, m, corpo) => [{ numero: corpo.p.numero, numero_gerado: false, sucursal_id: 'suc_u', pagamentos: 1, fecha: true }];
  const ped2 = { id: 'p2', numero: 1002, sucursalId: 'suc_u', tipo: 'balcao', fase: 'x',
    total: 5, taxa: 0, desconto: 0, itens: [], pagamentos: [], _loja: 'L', data: '2026-09-10', hora: '10:01' };
  win.DB.pedidos = [ped2];
  await win.enviarVendaAtomica(ped2, null);
  t('número fica 1002', ped2.numero === 1002, ped2.numero);
  t('não regrava à toa quando o banco devolve o mesmo número', salvou === 0, salvou);

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · O número oficial do pedido é o que o banco gravou');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

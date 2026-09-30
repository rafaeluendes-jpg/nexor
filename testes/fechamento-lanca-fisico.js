/* ==========================================================
   JOIA — O FECHAMENTO LANÇA NO FINANCEIRO O FÍSICO, NÃO O SISTEMA
   (V395, 30/09/2026)

   Rodar:  node testes/fechamento-lanca-fisico.js
   ou:     npm run test:fechfisico   (entra na bateria e no portão)

   Rafael: "o que vai pro lançamento financeiro vai o que passou no
   sistema; preciso que o que vai pro lançamento seja o físico que o
   funcionário digitou". Números do fechamento de 29/09 de Santa Fé:
   débito 323 → 507, crédito 480 → 410, Pix 529 → 415, dinheiro batendo.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const R = { total: 0, ok: 0 };
function t(n, c, d) { R.total++; if (c) { R.ok++; console.log('   ok   ' + n); } else console.log('   FALHA ' + n + (d !== undefined ? '  → ' + d : '')); }
(async function () {
  const vc = new VirtualConsole(); const erros = [];
  vc.on('jsdomError', e => erros.push(e && e.message));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(w) { w.fetch = () => Promise.reject(new Error('offline')); w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
      w.scrollTo = () => {}; w.alert = () => {}; w.confirm = () => true; w.crypto = w.crypto || {};
      if (!w.crypto.subtle) w.crypto.subtle = { digest: async () => new ArrayBuffer(32) }; } });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window;
  w.DB.contas = [{ id: 'ct_caixa', nome: 'Caixa da loja', fixa: 'caixa' }, { id: 'ct_banco', nome: 'Itaú' }];
  w.DB.formasPag = [{ id: 'fp_dinheiro', nome: 'Dinheiro', tipo: 'dinheiro', taxaPct: 0, dias: 0 },
    { id: 'fp_debito', nome: 'Cartão débito', tipo: 'debito', taxaPct: 0, dias: 1, contaId: 'ct_banco' },
    { id: 'fp_credito', nome: 'Cartão crédito', tipo: 'credito', taxaPct: 0, dias: 1, contaId: 'ct_banco' },
    { id: 'fp_pix', nome: 'Pix', tipo: 'pix', taxaPct: 0, dias: 0, contaId: 'ct_banco' }];
  w.DB.lancFin = [];
  /* dinheiro: 439,05 de venda + 100 de fundo = 539,05 esperado na gaveta */
  const mov = { total: 1771.05, porForma: { fp_dinheiro: 439.05, fp_debito: 323, fp_credito: 480, fp_pix: 529 },
    qtdForma: { fp_dinheiro: 10, fp_debito: 8, fp_credito: 9, fp_pix: 12 } };
  const cx = { id: 'u0zawzxq', sucursalId: 'suc_sf', aberto: '29/09/2026 11:56', fechadoEm: '29/09/2026 23:19',
    esperadoPorForma: { fp_dinheiro: 539.05, fp_debito: 323, fp_credito: 480, fp_pix: 529 },
    conferencia: { fp_dinheiro: 539.05, fp_debito: 507, fp_credito: 410, fp_pix: 415 } };
  w.lancarFechamento(cx, mov);
  const v = id => (w.DB.lancFin.find(l => l.metodoId === id) || {}).valor;
  console.log('\n── O financeiro recebe o que a conferência contou');
  t('débito: 507 (físico), não 323', v('fp_debito') === 507, v('fp_debito'));
  t('crédito: 410 (físico), não 480', v('fp_credito') === 410, v('fp_credito'));
  t('Pix: 415 (físico), não 529', v('fp_pix') === 415, v('fp_pix'));
  t('dinheiro: a venda em dinheiro (439,05) — o fundo de troco não é receita', v('fp_dinheiro') === 439.05, v('fp_dinheiro'));
  const deb = w.DB.lancFin.find(l => l.metodoId === 'fp_debito');
  t('a observação diz que é o físico e guarda o do sistema', /físico/.test(deb.obs) && /sistema R\$ 323,00/.test(deb.obs), deb.obs);

  console.log('\n── Falta no dinheiro sai do lançamento');
  w.DB.lancFin = [];
  const cx2 = Object.assign({}, cx, { conferencia: Object.assign({}, cx.conferencia, { fp_dinheiro: 519.05 }) });
  w.lancarFechamento(cx2, mov);
  t('contaram 20 a menos na gaveta: entram 419,05', v('fp_dinheiro') === 419.05, v('fp_dinheiro'));

  console.log('\n── Caixa antigo, sem conferência gravada: fica o do sistema');
  w.DB.lancFin = [];
  w.lancarFechamento({ id: 'cx_velho', sucursalId: 'suc_sf', fechadoEm: '01/09/2026 22:00' }, mov);
  t('sem conferência, débito continua 323', v('fp_debito') === 323, v('fp_debito'));

  console.log('\n── Editar o fechamento refaz com o físico novo, sem duplicar');
  w.DB.lancFin = [];
  w.lancarFechamento(cx, mov);
  const cx3 = Object.assign({}, cx, { conferencia: Object.assign({}, cx.conferencia, { fp_pix: 529 }) });
  w.lancarFechamento(cx3, mov);
  t('Pix passa a 529 no MESMO lançamento', w.DB.lancFin.filter(l => l.metodoId === 'fp_pix').length === 1 && v('fp_pix') === 529);

  t('nenhum erro de runtime', erros.length === 0, erros.join(' | '));
  console.log('\n' + R.ok + ' de ' + R.total + ' testes passaram');
  try { w.close(); } catch (e) {}
  process.exit(R.ok === R.total ? 0 : 1);
})();

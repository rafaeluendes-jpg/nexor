/* ==========================================================
   JOIA — TABELA QUE A NUVEM TRANCA POR UNIDADE RECEBE A UNIDADE
   (29/09/2026)

   Rodar:  node testes/unidade-no-envio.js
   ou:     npm run test:unidadeenvio   (entra na bateria e no portão)

   Rafael: "foi feita uma transferência entre lojas e nas atualizações ela
   sumiu; em movimentação de mercadoria o histórico está lá".

   A regra de acesso da nuvem de `transferencias` exige `sucursal_id`
   igual à unidade de quem grava. O envio nunca mandou esse campo: TODA
   transferência foi recusada (zero linhas na nuvem), e o registro ficou
   preso no aparelho. `acertos` (acerto com entregadores) tinha o mesmo
   buraco — também zero linhas.

   Este guardião prende, para toda tabela cuja regra da nuvem compara
   `sucursal_id` com a unidade de quem grava, que o envio leva o campo.
   E prende a regra nova da transferência: origem E destino enxergam.

   Tabela nova com regra por unidade entra na lista abaixo — a consulta
   para conferir está no fim deste arquivo.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');

/* select tablename from pg_policies where qual ilike '%minha_sucursal_ref%' */
const TRANCADAS_POR_UNIDADE = ['acertos', 'caixas', 'contagens_estoque', 'cupons_fiscais',
  'estoque_unidade', 'lancamentos_financeiros', 'movimentacoes_estoque', 'transferencias'];

const R = { total: 0, ok: 0, falhou: 0 };
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

(async function () {
  const vc = new VirtualConsole();
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const win = dom.window;

  console.log('\n── O envio leva a unidade em toda tabela trancada por unidade');
  TRANCADAS_POR_UNIDADE.forEach(function (tab) {
    const E = win.MAPA.find(e => e.tab === tab);
    if (!E) { t(tab + ': está no MAPA', false); return; }
    let o = {};
    try { o = E.campos({ id: 'x1', origemSuc: 'suc_origem', sucursalId: 'suc_origem', itens: [], linhas: [] }, 0) || {}; }
    catch (e) { o = { erro: e.message }; }
    t(tab + ': sobe com sucursal_id preenchido', !!o.sucursal_id, JSON.stringify(o).slice(0, 120));
  });

  console.log('\n── A transferência é da origem');
  const Et = win.MAPA.find(e => e.tab === 'transferencias');
  const ot = Et.campos({ origemSuc: 'suc_santafe', destinoSuc: 'suc_jales', itens: [] }, 0);
  t('sucursal_id = unidade de origem', ot.sucursal_id === 'suc_santafe', ot.sucursal_id);

  console.log('\n── E a regra da nuvem deixa o destino enxergar para receber');
  const mig = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations',
    '20260929_transferencia_origem_e_destino.sql'), 'utf8');
  t('a regra aceita a unidade de origem', /origem_suc\s*=\s*\(select minha_sucursal_ref\(\)\)/.test(mig));
  t('e a unidade de destino', /destino_suc\s*=\s*\(select minha_sucursal_ref\(\)\)/.test(mig));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · a unidade vai junto no envio');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

/* ==========================================================
   EDITOU O CAIXA, MUDA NO FINANCEIRO — E CÓPIA VELHA NÃO DESFAZ (05/10/2026)

   Rodar:  node testes/lei-de-versao-financeiro-e-caixa.js
   ou:     npm run test:leiversaofin   (entra na bateria e no portão)

   Rafael: "Sangria de R$ 400 no caixa e R$ 200 na conciliação. Qualquer
   edição de caixa tem que levar a atualização para a conciliação e para o
   lançamento financeiro. Que vire lei."

   Duas causas, duas travas:
     1. o movimento do caixa fechado nunca subia (a trava do banco barrava
        o upsert): agora o movimento que já existe é corrigido, só o novo e
        a exclusão continuam barrados, e tudo fica auditado;
     2. um aparelho com cópia velha regravou lançamentos e baixas: agora
        lançamentos e baixas têm a lei de versão — a nuvem só aceita quem
        viu a versão mais nova.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const MIG = path.join(__dirname, '..', 'supabase', 'migrations', '20261005_lei_de_versao_financeiro_e_caixa.sql');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
(async function () {
  const erros = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => erros.push(e && e.message));
  const src = fs.readFileSync(ARQ, 'utf8');
  const dom = new JSDOM(src, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true;
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window;
  const MAPA = w.eval('MAPA');
  const E = c => MAPA.find(e => e.col === c) || {};

  console.log('\n── A lei de versão vale para lançamentos e baixas\n');
  t('lançamentos financeiros têm a lei de versão', E('lancFin').versao === true);
  t('baixas de estoque têm a lei de versão', E('baixasPend').versao === true);
  t('contas e formas continuam com ela', E('contas').versao === true && E('formasPag').versao === true);
  /* 06/10/2026 (ordem do Rafael, missão integridade): o recibo vale para
     TODA tabela do MAPA, sem condição — a forma antiga, só nas tabelas
     marcadas (if(E2.versao)…), deixa de ser aceita */
  t('o envio apresenta a versão que o aparelho viu', /\n\s*o\.versao_vista=x\._alt\|\|null;/.test(src) &&
    !/if\(E2\.versao\)o\.versao_vista=/.test(src));
  t('o lançamento desce com a versão da nuvem', /loteRef:x\.lote_ref\|\|undefined,loteNum:x\.lote_numero\|\|undefined,\s*\/\*[^*]*\*\/\s*_alt:x\.alterado_em\|\|null,/.test(src));
  t('a baixa desce com a versão da nuvem', /lancadaEm:x\.lancada_em,\s*\/\*[^*]*\*\/\s*_alt:x\.alterado_em\|\|null\}\},DB\.baixasPend,'baixasPend'\)/.test(src));
  t('o mesmo instante escrito de dois jeitos é a mesma versão',
    w.linhaAceitaPelaNuvem({ lancada_em: '2026-10-05T16:00:00.000Z' }, { lancada_em: '2026-10-05T16:00:00+00:00' }) === true &&
    w.linhaAceitaPelaNuvem({ lancada_em: '2026-10-05T16:00:00.000Z' }, { lancada_em: '2026-10-05T17:00:00+00:00' }) === false);
  t('valor diferente não passa por igual', w.linhaAceitaPelaNuvem({ valor: 400 }, { valor: 200 }) === false);

  console.log('\n── No banco\n');
  const sql = fs.existsSync(MIG) ? fs.readFileSync(MIG, 'utf8') : '';
  t('o movimento que já existe passa no envio do caixa fechado',
    /if new\.ref_local is not null and exists \(select 1 from caixa_movimentos where ref_local = new\.ref_local\) then\s+return new;/.test(sql));
  t('movimento novo e exclusão em caixa fechado continuam barrados',
    /caixa ja fechado nao aceita novo movimento/.test(sql) && /movimento de caixa ja fechado nao pode ser excluido/.test(sql));
  t('o valor pode ser corrigido; o tipo não',
    /if new\.tipo is distinct from old\.tipo then/.test(sql) && !/new\.valor is distinct from old\.valor/.test(sql));
  t('a correção do movimento fica no audit_log', /create trigger tg_auditar after insert or update or delete on public\.caixa_movimentos/.test(sql));
  t('a lei de versão está ligada nos lançamentos e nas baixas',
    /create trigger ab_versao_vista before update on public\.lancamentos_financeiros/.test(sql) &&
    /create trigger ab_versao_vista before update on public\.baixas_pendentes/.test(sql) &&
    /add column if not exists versao_vista timestamptz/.test(sql));

  t('nenhum erro de runtime', erros.length === 0, erros.slice(0, 3).join(' | '));
  console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
  try { w.close(); } catch (e) {}
  process.exit(falhas ? 1 : 0);
})();

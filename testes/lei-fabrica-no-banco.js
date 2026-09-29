/* ==========================================================
   JOIA — A LEI: VALOR DE FÁBRICA NÃO PASSA POR CIMA DO QUE A LOJA
   CONFIGUROU, E QUEM TRANCA É O BANCO (29/09/2026)

   Rodar:  node testes/lei-fabrica-no-banco.js
   ou:     npm run test:leifabrica   (entra na bateria e no portão)

   Rafael: "salvamos o banco ontem e hoje não estava salvo. Isso tem que
   virar lei." O "Itaú — conta corrente" voltou a "Banco — conta corrente"
   em 27/09, 28/09 e 29/09 (13:47, já na V362); as taxas de cartão voltaram
   a 1,99%/3,49% sete vezes em agosto e setembro. Cada correção no aparelho
   fechava um caminho e outro aparecia.

   A lei está no banco (migration 20260929_fabrica_nao_sobrescreve.sql):
   gatilhos em contas_capital e formas_pagamento recusam a troca de um
   registro configurado pela loja pelo valor de fábrica. Provado em
   produção num teste desfeito: a cópia de fábrica não passou; a edição
   normal passou.

   Este guardião prende:
     1. a migration existe e cria os dois gatilhos;
     2. os valores de fábrica que o banco recusa são EXATAMENTE os que o
        código semeia (_formasFabrica e baseFin) — se alguém mudar a
        semente no código, este teste avisa que a lei precisa acompanhar.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const MIG = path.join(__dirname, '..', 'supabase', 'migrations', '20260929_fabrica_nao_sobrescreve.sql');

const R = { total: 0, ok: 0, falhou: 0 };
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

(async function () {
  const sql = fs.existsSync(MIG) ? fs.readFileSync(MIG, 'utf8') : '';
  console.log('\n── 1. A lei está no banco');
  t('a migration existe', !!sql);
  t('gatilho em contas_capital', /create trigger aa_fabrica_nao_sobrescreve before update on public\.contas_capital/.test(sql));
  t('gatilho em formas_pagamento', /create trigger aa_fabrica_nao_sobrescreve before update on public\.formas_pagamento/.test(sql));
  t('o gatilho devolve o que a loja tinha (return old)', (sql.match(/return old;/g) || []).length === 2);

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

  console.log('\n── 2. O banco recusa exatamente a semente do código');
  win._formasFabrica().forEach(function (f) {
    if (f.id === 'fp_dinheiro') return;           /* dinheiro nasce com conta: não é o desenho da cópia */
    const re = new RegExp("new\\.ref_local = '" + f.id + "'\\s+and new\\.taxa_pct = " +
      String(f.taxaPct).replace('.', '\\.') + "\\s+and new\\.dias_recebimento = " + f.dias);
    t(f.id + ': fábrica ' + f.taxaPct + '% / ' + f.dias + ' dia(s) está na lei', re.test(sql));
  });
  win.NUVEM.ligada = false; win.DB.contas = []; win.DB._uuid = {}; win.baseFin();
  const nomes = (win.DB.contas || []).map(c => c.nome);
  t('as contas de fábrica do código são as que a lei conhece',
    nomes.length === 3 && nomes.every(n => sql.indexOf("'" + n + "'") >= 0), nomes.join(', '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · a lei do valor de fábrica, no banco');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

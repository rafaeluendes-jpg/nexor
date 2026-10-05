/* ==========================================================
   LANÇAMENTO APAGADO NÃO VOLTA (05/10/2026)

   Rodar:  node testes/lancamento-apagado-nao-volta.js
   ou:     npm run test:apagadonaovolta   (entra na bateria e no portão)

   Rafael: "Essa transação de 350 reais já foi apagada várias vezes, porém
   ela volta automático. Uma vez apagado, não tem que voltar."

   O banco só deixava admin apagar lançamento; a recusa vinha como "ok"
   com zero linhas, a tela tirava a linha e o download a trazia de volta.

   Prende:
     1. a tela só tira o lançamento quando a nuvem confirma que ele saiu;
        se a nuvem respondeu "ok" e a linha continua lá, avisa e mantém;
     2. o que nunca chegou à nuvem sai normalmente;
     3. no banco, quem tem o financeiro apaga (na própria unidade, nunca
        conciliado).
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const MIG = path.join(__dirname, '..', 'supabase', 'migrations', '20261005_financeiro_apaga_quem_tem_o_financeiro.sql');
const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const erros = [];
(async function () {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window, DB = w.DB;
  w.salvar = () => {}; w.telaLancamentos = () => {}; w.toast = () => {};
  w.pergunta = async () => true;
  let painel = [];
  w.painelErro = (m, d) => painel.push(m + ' | ' + d);
  w.NUVEM.ligada = true; w.NUVEM.loja = 'loja-sf';
  const lanc = () => ({ id: 'lf_350', tipo: 'transferencia', descricao: 'Transferência: Itaú → Caixa da loja',
    valor: 350, pago: true, conciliado: false, contaId: 'c1', contaDestinoId: 'c2' });

  grupo('1. A nuvem recusou em silêncio');
  let chamadas = [];
  w.api = async (cam, met, corpo, extra) => {
    chamadas.push({ cam, met, extra });
    if (met === 'DELETE') return [];                 /* "ok", zero linhas */
    return [{ id: 'b9470dc4' }];                       /* e a linha continua lá */
  };
  DB.lancFin = [lanc()]; DB._apagados = {};
  await w.excluirLanc('lf_350');
  t('o DELETE pede de volta o que foi apagado',
    chamadas[0] && chamadas[0].met === 'DELETE' && chamadas[0].extra && chamadas[0].extra.Prefer === 'return=representation');
  t('confere se a linha continua na nuvem', chamadas.some(c => !c.met && /ref_local=eq\.lf_350/.test(c.cam)));
  t('o lançamento NÃO sai do aparelho', DB.lancFin.length === 1);
  t('nem vira exclusão declarada', !(DB._apagados.lancFin && DB._apagados.lancFin.lf_350));
  t('e a loja é avisada', /não deixou excluir/.test(painel.join('|')), painel.join('|'));

  grupo('2. A nuvem apagou');
  painel = []; chamadas = [];
  w.api = async (cam, met) => { chamadas.push({ cam, met }); return met === 'DELETE' ? [{ id: 'b9470dc4' }] : []; };
  DB.lancFin = [lanc()];
  await w.excluirLanc('lf_350');
  t('sai do aparelho', DB.lancFin.length === 0);
  t('sem aviso nenhum', painel.length === 0);

  grupo('3. Nunca chegou à nuvem');
  w.api = async (cam, met) => [];
  DB.lancFin = [lanc()];
  await w.excluirLanc('lf_350');
  t('sai do aparelho normalmente', DB.lancFin.length === 0 && painel.length === 0);

  grupo('4. Conciliado continua protegido');
  DB.lancFin = [Object.assign(lanc(), { conciliado: true })];
  await w.excluirLanc('lf_350');
  t('conciliado não sai', DB.lancFin.length === 1);

  grupo('5. No banco');
  const sql = fs.existsSync(MIG) ? fs.readFileSync(MIG, 'utf8') : '';
  t('quem tem o financeiro apaga, na própria unidade, nunca conciliado',
    /create policy "financeiro: apaga quem tem o financeiro" on public\.lancamentos_financeiros\s+for delete/.test(sql) &&
    /posso\('financeira\/lancamentos-financeiros'\)/.test(sql) &&
    /coalesce\(conciliado, false\) = false/.test(sql) &&
    /sucursal_id = \(select minha_sucursal_ref\(\)\)/.test(sql));

  grupo('Balanço');
  t('nenhum erro de runtime', erros.length === 0, erros.slice(0, 5).join(' | '));
  console.log('\n' + R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : '') + '\n');
  try { w.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

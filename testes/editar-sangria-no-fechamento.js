/* ==========================================================
   EDITAR A SANGRIA NO FECHAMENTO DO CAIXA (05/10/2026)

   Rodar:  node testes/editar-sangria-no-fechamento.js
   ou:     npm run test:editsangria   (entra na bateria e no portão)

   Rafael: "aqui na frente de caixa deixar a opção de editar a sangria, e
   atualizar valores de caixa — mexer apenas nisso."

   Prende:
     · a janela "Editar fechamento" lista as sangrias e suprimentos com o
       valor editável, e mostra o dinheiro esperado da gaveta;
     · salvar troca o valor, guarda o anterior (quem, quando, de, para)
       e acerta a transferência que a sangria gerou no financeiro;
     · o esperado do caixa é refeito com o valor novo;
     · valor zero não grava; lançamento conciliado não é alterado.
   O fluxo no Chromium: sangria de 350 → 300, esperado +50, transferência 300.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
(async function () {
  const erros = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => erros.push(e && e.message));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {}; if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window, DB = w.DB, doc = w.document;
  const avisos = []; w.toast = m => avisos.push(String(m)); w.salvar = () => {}; w.telaFrenteCaixa = () => {};
  w.lancarFechamento = () => 0;
  console.log('\n── Editar sangria no fechamento\n');
  const cx = { id: 'cx_ed', inicial: 368.05, operador: 'Op', sucursalId: w.lojaAtualId(), aberto: '03/10/2026 12:11', fechadoEm: '03/10/2026 23:27',
    movimentos: [{ id: 'mv_s1', tipo: 'sangria', valor: 350, hora: '18:00', motivoNome: 'Depósito bancário', destino: 'Itaú', lancRef: 'lf_s1' },
      { id: 'mv_s2', tipo: 'suprimento', valor: 50, hora: '19:00', motivoNome: 'Reforço de troco', lancRef: 'lf_s2' }], conferencia: {} };
  DB.caixas = [cx]; DB.pedidos = DB.pedidos || []; DB.formasPag = DB.formasPag || [];
  DB.lancFin = [{ id: 'lf_s1', tipo: 'transferencia', valor: 350, origem: 'mov-caixa', ref: 'mv_s1', caixaId: 'cx_ed' },
    { id: 'lf_s2', tipo: 'transferencia', valor: 50, origem: 'mov-caixa', ref: 'mv_s2', caixaId: 'cx_ed', conciliado: true }];
  const esp0 = w.esperadoCaixa(cx);
  w.editarCaixa('cx_ed');
  const ins = doc.querySelectorAll('.ecMov');
  t('a janela lista a sangria e o suprimento com o valor', ins.length === 2 && /Sangrias e suprimentos/.test(doc.body.innerHTML));
  t('o suprimento conciliado no banco fica travado', ins[1].disabled === true);
  t('e mostra o dinheiro esperado da gaveta', !!doc.getElementById('ecEsperado'));
  ins[0].value = '0'; await doc.getElementById('mdOk').onclick();
  t('valor zero não grava', cx.movimentos[0].valor === 350 && /maior que zero/.test(avisos.join('|')));
  ins[0].value = '300,00'; w.ecRecalcEsperado();
  t('o esperado se refaz enquanto digita (+50)', doc.getElementById('ecEsperado').textContent === 'R$ ' + w.money(esp0 + 50), doc.getElementById('ecEsperado').textContent);
  await doc.getElementById('mdOk').onclick();
  t('salvar troca o valor da sangria', cx.movimentos[0].valor === 300);
  t('e guarda o anterior: de 350 para 300, quem e quando', (cx.movimentos[0].edicoes || []).length === 1 &&
    cx.movimentos[0].edicoes[0].de === 350 && cx.movimentos[0].edicoes[0].para === 300 && !!cx.movimentos[0].edicoes[0].por);
  t('a transferência no financeiro passa a 300', DB.lancFin[0].valor === 300);
  t('o lançamento conciliado não muda', DB.lancFin[1].valor === 50 && cx.movimentos[1].valor === 50);
  t('o esperado do caixa é refeito', Math.abs(cx.esperado - (esp0 + 50)) < 0.001, cx.esperado);
  t('nenhum erro de runtime', erros.length === 0, erros.slice(0, 3).join(' | '));
  console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
  try { w.close(); } catch (e) {}
  process.exit(falhas ? 1 : 0);
})();

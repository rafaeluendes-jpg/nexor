/* ==========================================================
   RECEBIMENTOS: O FÍSICO DO DINHEIRO É O VALOR REAL VENDIDO (05/10/2026)

   Rodar:  node testes/recebimentos-dinheiro-vendido.js
   ou:     npm run test:recebdinheiro   (entra na bateria e no portão)

   Rafael, na foto do caixa de 02/10 de Santa Fé: "Onde está o físico, eu
   preciso que aqui seja o valor de venda, o valor real. Esse valor aí está
   menos a sangria. O valor real é o que vai para a conciliação e para os
   lançamentos financeiros. Menos a sangria, dá o valor para abrir o caixa
   no outro dia."

   O caixa de 02/10 (números do banco): fundo R$ 512,05, vendas em dinheiro
   R$ 303,00, sangria R$ 450,00; gaveta esperada R$ 365,05, contada
   R$ 368,05 (que é o fundo do dia 03). Prende:
     1. a linha Dinheiro: Sistema = vendido em dinheiro (R$ 303,00);
        Físico (valor real) = contado − fundo + sangria = R$ 306,00;
     2. é o MESMO valor que o fechamento lança no financeiro;
     3. diferença + R$ 3,00, e os totais 2.215,00 × 2.218,00;
     4. a composição continua mostrando a gaveta (esperado e contado);
     5. as outras formas e a conferência do caixa não mudam.
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
  w.salvar = () => {}; w.toast = () => {};
  const formas = [
    { id: 'fp_dinheiro', nome: 'Dinheiro', troco: true, sistema: 365.05, fisico: 368.05, diferenca: 3 },
    { id: 'fp_debito', nome: 'Cartão débito', sistema: 553, fisico: 553, diferenca: 0 },
    { id: 'fp_credito', nome: 'Cartão crédito', sistema: 929, fisico: 929, diferenca: 0 },
    { id: 'fp_pix', nome: 'Pix', sistema: 430, fisico: 430, diferenca: 0 }];
  const cx = { id: 'cx_mur3wz9bmrtf', inicial: 512.05, operador: 'Operador Caixa', sucursalId: w.lojaAtualId(),
    aberto: '02/10/2026 12:17', fechadoEm: '02/10/2026 23:15', fechadoPor: 'Administrador',
    conferencia: { fp_dinheiro: 368.05, fp_debito: 553, fp_credito: 929, fp_pix: 430 },
    esperadoPorForma: { fp_dinheiro: 365.05, fp_debito: 553, fp_credito: 929, fp_pix: 430 },
    movimentos: [{ id: 'm1', tipo: 'sangria', valor: 450, hora: '20:00' }],
    snapshot: { formas: formas, fundoAbertura: 512.05, suprimentos: 0, sangrias: 450, vendasDinheiro: 303,
      diferencaTotal: 3, totalSistema: 2277.05, totalFisico: 2280.05, movimentos: [] } };
  DB.caixas = [cx]; DB.pedidos = []; DB.cancelamentos = [];
  w.verCaixa(cx.id); w.vcAba('receb');
  const cab = [...doc.querySelectorAll('.vcTab thead th')].map(th => th.textContent.trim());
  const linhas = [...doc.querySelectorAll('.vcTab tbody tr')].map(r => [...r.children].map(td => td.textContent.trim()));
  const din = linhas.find(l => /Dinheiro/.test(l[0] || '')) || [];
  const tot = [...doc.querySelectorAll('.vcTab tfoot td')].map(td => td.textContent.trim());

  console.log('\n── A linha Dinheiro é o valor real vendido\n');
  t('a coluna diz que é o valor real', cab[2] === 'Físico (valor real)', cab.join(' | '));
  t('Sistema: vendido em dinheiro, R$ 303,00 (e não a gaveta R$ 365,05)', din[1] === 'R$ 303,00', din.join(' | '));
  t('Físico: o real vendido, R$ 306,00 (e não a gaveta R$ 368,05)', din[2] === 'R$ 306,00', din[2]);
  t('a diferença continua + R$ 3,00', /\+ R\$ 3,00/.test(din[3] || ''), din[3]);
  t('é o mesmo valor que o fechamento lança no financeiro',
    w.valorFisicoDaForma(cx, { porForma: { fp_dinheiro: 303 } }, 'fp_dinheiro') === 306);
  t('os totais somam venda: R$ 2.215,00 × R$ 2.218,00, + R$ 3,00',
    tot[1] === 'R$ 2.215,00' && tot[2] === 'R$ 2.218,00' && /\+ R\$ 3,00/.test(tot[3]), tot.join(' | '));
  t('as outras formas não mudam', linhas.some(l => /débito/.test(l[0]) && l[1] === 'R$ 553,00' && l[2] === 'R$ 553,00'));

  console.log('\n── A gaveta continua à vista, e o caixa não muda\n');
  w.vcDinheiro();
  const comp = (doc.querySelector('.vcComp') || {}).textContent || '';
  t('a composição mostra o esperado e o contado da gaveta (o fundo de amanhã)',
    /dinheiro esperado na gaveta\s*R\$ 365,05/.test(comp) && /Dinheiro contado na gaveta\s*R\$ 368,05/.test(comp), comp);
  w.vcAba('resumo');
  t('a conferência do caixa continua + R$ 3,00', /\+ R\$ 3,00/.test((doc.querySelector('.vcStatus') || {}).textContent || ''));
  t('nenhum erro de runtime', erros.length === 0, erros.slice(0, 3).join(' | '));
  console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
  try { w.close(); } catch (e) {}
  process.exit(falhas ? 1 : 0);
})();

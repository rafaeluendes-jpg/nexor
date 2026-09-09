/* ==========================================================
   JOIA — A BAIXA APAGADA NÃO VOLTA (exclusão declarada)

   Rodar:  node testes/baixa-apaga-fica.js
   ou:     npm run test:baixaapaga   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (relato do Rafael, 09/09/2026)

   Na Baixa Manual, apagar um registro só o tirava da lista local e
   salvava. Como a exclusão não era DECLARADA (`declararExclusao`), o
   espelhamento não apagava a linha da nuvem — e no download seguinte ela
   VOLTAVA. "Apaguei e voltou."

   Este guardião trava a correção: excluir uma baixa declara a exclusão,
   que é a única coisa que autoriza o espelhamento a apagar da nuvem.
   Também confere que os registros mostram custo unitário e o total.
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
  console.log('\nCarregando o sistema para o guardião da baixa…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  grupo('As peças existem');
  ['excluirBaixa', 'declararExclusao'].forEach(fn =>
    t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  grupo('Excluir declara a exclusão (senão volta no download)');
  win.telaBaixaManual = () => {};            /* não renderiza no teste */
  win.confirmar = () => Promise.resolve(true);
  win.salvar = () => {};
  win.lojaAtualId = () => 'suc_teste';
  win.DB = win.DB || {};
  win.DB._apagados = {};
  win.DB.baixasPend = [{ id: 'bx1', itemRef: 'i1', itemNome: 'AÇÚCAR', itemTipo: 'insumo',
    qtd: 2, unidade: 'kg', custo: 10, motivoRef: 'm1', quem: 'Maria', situacao: 'pendente' }];
  await win.excluirBaixa('bx1');
  t('a baixa saiu da lista local', !(win.DB.baixasPend || []).some(b => b.id === 'bx1'));
  t('a exclusão foi DECLARADA (baixasPend/bx1)',
    !!(win.DB._apagados && win.DB._apagados.baixasPend && win.DB._apagados.baixasPend.bx1),
    JSON.stringify(win.DB._apagados));

  grupo('Os registros mostram custo unitário e o total');
  const fonte = fs.readFileSync(ARQ, 'utf8');
  t('coluna "Custo unit." no cabeçalho', /Custo unit\./.test(fonte));
  t('coluna "Total" no cabeçalho dos registros', />Total<\/th>/.test(fonte));

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · A baixa apagada não volta');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

/* ==========================================================
   JOIA — AS FORMAS DE PAGAMENTO APARECEM NA UNIDADE

   Rodar:  node testes/formas-visiveis-na-unidade.js
   ou:     npm run test:formasvisiveis   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (relato do Rafael, 10/09/2026)

   Na "Nova despesa", marcando "Já está pago", o seletor de Forma de
   pagamento vinha VAZIO na loja. Causa: as formas de fábrica nasciam sem
   `sucursais`, e o filtro de liberação por unidade
   (filtrarCadastroDaUnidade → liberadoNa) esconde da unidade tudo que não
   foi liberado. `formasPag` está em CADASTROS_LIB, então as formas sumiam
   da loja — e todo seletor de forma (despesa, boleto, PDV) ficava vazio.

   Este guardião trava a correção: as formas de fábrica nascem liberadas
   para TODAS as unidades (sucursais com '*'), então aparecem na loja.
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
  console.log('\nCarregando o sistema para o guardião das formas…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  grupo('As peças existem');
  ['_formasFabrica', 'liberadoNa'].forEach(fn =>
    t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  grupo('As formas de fábrica nascem liberadas para todas as unidades');
  var formas = win._formasFabrica();
  t('há pelo menos 5 formas de fábrica', (formas || []).length >= 5, (formas || []).length);
  t('toda forma tem sucursais preenchido',
    formas.every(function (f) { return Array.isArray(f.sucursais) && f.sucursais.length; }),
    JSON.stringify(formas.map(function (f) { return f.sucursais; })));
  t('toda forma está marcada para TODAS as unidades (contém "*")',
    formas.every(function (f) { return (f.sucursais || []).indexOf(win.TODAS_UN) >= 0; }),
    win.TODAS_UN);

  grupo('Na unidade (não-matriz), a forma de fábrica é visível');
  win.ehSucMatriz = function () { return false; };
  t('liberadoNa devolve true para a forma de fábrica na unidade',
    formas.every(function (f) { return win.liberadoNa(f, 'suc_unidade') === true; }));

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Formas de pagamento aparecem na unidade');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

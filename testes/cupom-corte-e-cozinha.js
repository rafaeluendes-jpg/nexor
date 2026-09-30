/* ==========================================================
   JOIA — CUPOM FISCAL E VIA DA COZINHA: CORTE, NOME, PIX E LETRA
   (V393, 30/09/2026)

   Rodar:  node testes/cupom-corte-e-cozinha.js
   ou:     npm run test:cupomcorte   (entra na bateria e no portão)

   Rafael, 30/09/2026:
   1. "precisa cortar os dois cupons" — o fiscal e o da cozinha saíam na
      mesma folha, grudados. Agora são duas FOLHAS do mesmo trabalho: a
      impressora corta entre elas e a ordem continua a mesma.
   2. o item saía com "prod_fatiatto_di_gelato" na frente do nome.
   3. PIX saía como "Outros" (a SEFAZ manda o código 20).
   4. a letra da cozinha 20% maior; o cupom fiscal fica como está.
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
  let imprimiu = 0; w.print = () => { imprimiu++; }; w.avisoJanelaImpressao = () => {};

  console.log('\n── 1. Duas folhas no mesmo trabalho: a impressora corta entre elas');
  w.imprimirPapeis([{ linhas: [{ txt: 'CUPOM FISCAL' }, { txt: 'linha' }], cols: 48 }, { linhas: [{ txt: 'SENHA 12' }], cols: 40 }], 80);
  await new Promise(r => setTimeout(r, 300));
  const css = (w.document.getElementById('impCSS') || {}).textContent || '';
  const pgs = w.document.querySelectorAll('#viaImp .papelPg');
  t('um trabalho de impressão só (a ordem não inverte)', imprimiu === 1, imprimiu);
  t('duas folhas, a fiscal primeiro', pgs.length === 2 && /CUPOM FISCAL/.test(pgs[0].textContent) && /SENHA/.test(pgs[1].textContent));
  t('cada folha é uma página própria, com o seu tamanho', /@page folha0\{size:80mm [\d.]+mm;margin:0\}/.test(css) &&
    /@page folha1\{size:80mm [\d.]+mm;margin:0\}/.test(css) && /\.folha1\{page:folha1\}/.test(css) && /break-before:page/.test(css), css.slice(0, 300));
  t('cada folha com a sua letra (colunas próprias)', /\.folha0 \.papel\{width:48ch/.test(css) && /\.folha1 \.papel\{width:40ch/.test(css));
  t('o cupom fiscal usa as duas folhas', /imprimirPapeis\(folhas,mm\)/.test(String(w.imprimirDanfe)));

  console.log('\n── 2. O item sai só com o nome');
  t('"prod_fatiatto_di_gelato" não aparece na frente do nome', w.fsCodigoVisivel('prod_fatiatto_di_gelato') === '');
  t('nem "prod_mt7ew19mb18b"', w.fsCodigoVisivel('prod_mt7ew19mb18b') === '');
  t('um código de verdade (ex.: 7891234) continua aparecendo', w.fsCodigoVisivel('7891234') === '7891234 ');

  console.log('\n── 3. PIX sai como PIX');
  const PAG = w.eval('PAG_SEFAZ');
  t('código 20 (PIX estático) = PIX', PAG['20'] === 'PIX');
  t('código 17 (PIX dinâmico) = PIX', PAG['17'] === 'PIX');

  console.log('\n── 4. A letra da cozinha 20% maior');
  const LC = w.eval('LETRA_COZINHA');
  t('a via da cozinha usa 20% menos colunas (letra 20% maior)', LC === 1.2);
  t('e a regra está no único lugar que monta a via', /var c=Math\.max\(24,Math\.round\(\(cols\|\|m\.colunas\|\|48\)\/LETRA_COZINHA\)\)/.test(String(w.viaDoPedido)));
  w.baseImp();
  const pedF = { id: 'pf', numero: 7, itens: [{ nome: 'Gelato', qtd: 1, total: 10 }], total: 10, pagamentos: [] };
  const pedE = Object.assign({}, pedF, { id: 'pe', tipo: 'entrega' });
  const vf = w.viaDoPedido(pedF, 48), ve = w.viaDoPedido(pedE);
  t('a ficha da cozinha sai com 40 colunas quando vai junto do cupom de 48', vf && vf.cols === 40, vf && vf.cols);
  t('o cupom da entrega também sai 20% maior', ve && ve.cols === Math.round(((w.modeloImp('entrega') || {}).colunas || 48) / 1.2), ve && ve.cols);
  t('o cupom fiscal não muda de letra', /colunasDaLetra\(mm,'normal'\)/.test(String(w.imprimirDanfe)));

  t('nenhum erro de runtime', erros.length === 0, erros.join(' | '));
  console.log('\n' + R.ok + ' de ' + R.total + ' testes passaram');
  try { w.close(); } catch (e) {}
  process.exit(R.ok === R.total ? 0 : 1);
})();

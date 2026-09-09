/* ==========================================================
   JOIA — O MOTIVO CADASTRADO NÃO SOME (nasce enxergando quem criou)

   Rodar:  node testes/motivo-nasce-visivel.js
   ou:     npm run test:motivovisivel   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (relato do Rafael, 09/09/2026)

   Cadastrar um motivo na Baixa Manual e ele sumia sozinho. Causa: o
   `formMotivo` era o único cadastro que NÃO chamava `lerUnidades`, então
   o motivo nascia com `sucursais` vazio. O cadastro-rede filtra o item
   para fora da unidade na primeira sincronização — o mesmo bug do "Taxa
   de Entrega" da V191. Era o "Consumo Balcão" recadastrado cinco vezes.

   Este guardião trava a correção: motivo novo nasce com `sucursais`
   preenchido (a própria unidade, ou todas quando é a matriz).
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
  console.log('\nCarregando o sistema para o guardião do motivo…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  grupo('As peças existem');
  ['lerUnidades', 'formMotivo'].forEach(fn =>
    t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  grupo('Na unidade, o motivo nasce enxergando a própria unidade');
  win.lojaAtualId = () => 'suc_unidade';
  win.ehSucMatriz = () => false;
  var novo = { id: 'mt_teste', nome: 'Consumo Balcão', tipo: 'saida', ativo: true };
  win.lerUnidades('mvUn', novo);   /* bloco 'mvUn' não existe na tela → cai no padrão */
  t('sucursais deixou de ser vazio', Array.isArray(novo.sucursais) && novo.sucursais.length > 0,
    JSON.stringify(novo.sucursais));
  t('enxerga a unidade que criou', (novo.sucursais || []).indexOf('suc_unidade') >= 0,
    JSON.stringify(novo.sucursais));

  grupo('Na matriz, o motivo nasce para todas as unidades');
  win.lojaAtualId = () => 'suc_matriz';
  win.ehSucMatriz = () => true;
  var novo2 = { id: 'mt_teste2', nome: 'Degustação', tipo: 'saida', ativo: true };
  win.lerUnidades('mvUn', novo2);
  t('sucursais preenchido na matriz', Array.isArray(novo2.sucursais) && novo2.sucursais.length > 0,
    JSON.stringify(novo2.sucursais));

  grupo('formMotivo chama lerUnidades (a correção está no lugar)');
  const fonte = fs.readFileSync(ARQ, 'utf8');
  t("formMotivo chama lerUnidades('mvUn', …)", /lerUnidades\('mvUn'/.test(fonte));

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · O motivo cadastrado não some');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

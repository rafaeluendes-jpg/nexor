/* ==========================================================
   JOIA — O ROBÔ DO WHATSAPP SEGUE O INTERRUPTOR DA LOJA, SEMPRE

   Rodar:  node testes/robo-segue-o-interruptor.js
   ou:     npm run test:robo   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Santa Fé, 14/09/2026)
   A loja fechou às 22:46 (cardápio e robô foram a "desligado" na nuvem)
   e religou de manhã num instante sem nuvem. O cardápio voltou ao ar
   sozinho pela sincronização; o robô, que só era gravado no clique,
   ficou mudo o dia inteiro: oito clientes sem resposta e sem o link.
   Agora `acertarRoboNaNuvem()` confere, a cada religada da nuvem e a
   cada sincronização com clique pendente, se o robô na nuvem está igual
   ao interruptor deste aparelho — e grava só quando está diferente.
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
  console.log('\nCarregando o sistema para o guardião do robô…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  grupo('As peças existem');
  ['acertarRoboNaNuvem', 'roboPendente', 'lojaLigada', 'gravarCfgZap', 'definirLojaLigada']
    .forEach(fn => t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  /* o aparelho de Santa Fé: interruptor LIGADO, nuvem ligada */
  win.salvar = () => {}; win.toast = () => {}; win.logNuvem = () => {};
  win.DB = win.DB || {};
  win.DB.sucursais = [{ id: 'suc_santafe', nome: 'Santa Fé', ativa: true }];
  win.DB.cardapio = { suc_santafe: { ativo: true } };
  win.DB.zap = { suc_santafe: { ativo: true } };
  win.DB.config = win.DB.config || {};
  win.lojaAtualId = () => 'suc_santafe';
  win.NUVEM.ligada = true; win.NUVEM.loja = 'l1'; win.NUVEM.plataforma = false;
  const chamadas = { get: 0, zap: [] };
  let naNuvem = [{ robo_ativo: false }];        /* como estava em Santa Fé: cardápio no ar, robô mudo */
  win.api = async (caminho, metodo) => { if (!metodo || metodo === 'GET') { chamadas.get++; return naNuvem; } return [{}]; };
  win.gravarCfgZap = async (suc, campos) => { chamadas.zap.push({ suc, campos }); return true; };

  grupo('Cardápio no ar e robô mudo na nuvem: o robô é religado');
  let r = await win.acertarRoboNaNuvem();
  t('leu o robô na nuvem', chamadas.get === 1, chamadas.get);
  t('gravou robo_ativo = true na unidade certa', r === true && chamadas.zap.length === 1 &&
    chamadas.zap[0].suc === 'suc_santafe' && chamadas.zap[0].campos.robo_ativo === true, JSON.stringify(chamadas.zap));

  grupo('Já iguais: não grava nada');
  naNuvem = [{ robo_ativo: true }]; chamadas.zap.length = 0;
  r = await win.acertarRoboNaNuvem();
  t('devolve "nada a fazer" e não grava', r === false && chamadas.zap.length === 0, JSON.stringify({ r, zap: chamadas.zap }));

  grupo('Loja desligada aqui e robô ligado lá: o robô é parado');
  win.DB.cardapio.suc_santafe.ativo = false; chamadas.zap.length = 0;
  r = await win.acertarRoboNaNuvem();
  t('gravou robo_ativo = false', r === true && chamadas.zap.length === 1 && chamadas.zap[0].campos.robo_ativo === false, JSON.stringify(chamadas.zap));
  win.DB.cardapio.suc_santafe.ativo = true;

  grupo('Sem linha do robô na nuvem, ou sem nuvem: não inventa');
  naNuvem = []; chamadas.zap.length = 0;
  t('unidade sem robô cadastrado: null e nada gravado', (await win.acertarRoboNaNuvem()) === null && chamadas.zap.length === 0);
  naNuvem = [{ robo_ativo: false }]; win.NUVEM.ligada = false;
  t('sem nuvem: null e nada gravado', (await win.acertarRoboNaNuvem()) === null && chamadas.zap.length === 0);
  win.NUVEM.ligada = true;

  grupo('Clique pendente é reenviado e a marca some');
  win.DB.zap.suc_santafe.roboPendente = true;
  t('roboPendente() enxerga a marca', win.roboPendente() === true);
  naNuvem = [{ robo_ativo: false }]; chamadas.zap.length = 0;
  await win.acertarRoboNaNuvem();
  t('reenviou e limpou a marca', chamadas.zap.length === 1 && !win.DB.zap.suc_santafe.roboPendente);
  t('roboPendente() volta a false', win.roboPendente() === false);

  grupo('Os ganchos existem de verdade (não é código morto)');
  const html = fs.readFileSync(ARQ, 'utf8');
  const religar = html.slice(html.indexOf('async function religarNuvem('), html.indexOf('async function religarNuvem(') + 6000);
  t('religarNuvem acerta o robô depois de baixar da nuvem', /baixarDaNuvem\(\)[\s\S]{0,400}acertarRoboNaNuvem\(\)/.test(religar));
  const sinc = html.slice(html.indexOf('async function sincronizar('), html.indexOf('async function sincronizar(') + 60000);
  t('sincronizar reenvia o clique pendente ao terminar', /NUVEM\.sincronizando=false;[\s\S]{0,200}roboPendente\(\)[\s\S]{0,40}acertarRoboNaNuvem\(\)/.test(sinc));

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · O robô do WhatsApp segue o interruptor da loja');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

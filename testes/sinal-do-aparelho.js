/* ==========================================================
   JOIA — O APARELHO AVISA A NUVEM QUE ESTÁ VIVO

   Rodar:  node testes/sinal-do-aparelho.js
   ou:     npm run test:sinal   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Etapa 2 da RDS, 23/09/2026)

   A auditoria pediu a saúde da sincronização POR APARELHO. A nuvem sabia
   o que cada loja mandou, mas não qual aparelho mandou, nem se algum
   tablet tinha parado de sincronizar. Agora cada envio e cada download
   que terminam bem — e cada erro de envio — mandam um sinal curto para
   `rpc/aparelho_sinal`.

   O que este guardião protege acima de tudo: O SINAL NUNCA ATRAPALHA A
   VENDA. Ele não repete, não reconecta, não lança erro, e sai no máximo
   uma vez a cada 2 minutos por tipo.
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
    }
  });
  await new Promise(r => setTimeout(r, 900));
  return dom.window;
}
const espera = ms => new Promise(r => setTimeout(r, ms));

(async function () {
  console.log('\nCarregando o sistema para o guardião do sinal do aparelho…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  grupo('A função existe e está ligada nos lugares certos');
  t('existe sinalDoAparelho()', typeof win.sinalDoAparelho === 'function');
  t('existe idDoAparelho()', typeof win.idDoAparelho === 'function');
  const fonte = fs.readFileSync(ARQ, 'utf8');
  const sinc = fonte.slice(fonte.indexOf('async function sincronizar('),
                           fonte.indexOf('async function sincronizar(') + 60000);
  t('o envio que termina bem manda o sinal (depois do backup do dia)',
    /backupDoDia\(\);[^\n]*\n\s*sinalDoAparelho\('envio'\)/.test(sinc));
  t('o erro de envio manda o sinal de erro',
    /sinalDoAparelho\('erro',/.test(sinc));
  const baixa = fonte.slice(fonte.indexOf('async function baixarDaNuvem('),
                            fonte.indexOf('async function baixarDaNuvem(') + 200000);
  t('o download que termina bem manda o sinal', /sinalDoAparelho\('download'\)/.test(baixa));
  const corpo = fonte.slice(fonte.indexOf('function sinalDoAparelho('),
                            fonte.indexOf('function sinalDoAparelho(') + 1600);
  t('não usa api() — que renova sessão e religa a nuvem ao ser recusada',
    corpo.indexOf('api(') < 0);

  grupo('Com a nuvem ligada: um sinal, com o que a auditoria precisa');
  const enviados = [];
  win.fetch = (url, init) => { enviados.push({ url: String(url), init }); return Promise.resolve({ ok: true, status: 204 }); };
  win.NUVEM.ligada = true; win.NUVEM.plataforma = false;
  win.NUVEM.url = 'https://teste.supabase.co'; win.NUVEM.chave = 'anon'; win.NUVEM.token = 'tk';
  win.lojaAtualId = () => 'suc_mt1unhbx2xrb';
  win.SESSAO.login = 'santafe@jologelato.com.br';
  const foi = win.sinalDoAparelho('envio');
  await espera(20);
  t('saiu um sinal', foi === true && enviados.length === 1, enviados.length);
  const e0 = enviados[0] || { init: {} };
  t('para rpc/aparelho_sinal', /\/rest\/v1\/rpc\/aparelho_sinal$/.test(e0.url), e0.url);
  t('com o token da sessão', ((e0.init.headers || {}).Authorization || '') === 'Bearer tk');
  let p = {};
  try { p = JSON.parse(e0.init.body).p || {}; } catch (e) {}
  t('leva o aparelho, a unidade, o usuário e a versão',
    /^ap_/.test(p.aparelho_id || '') && p.sucursal_ref === 'suc_mt1unhbx2xrb' &&
    p.usuario === 'santafe@jologelato.com.br' && p.versao === win.VERSAO, JSON.stringify(p));
  t('e diz se ficou coisa pendente', typeof p.pendente === 'boolean');
  t('o evento é "envio"', p.evento === 'envio');

  grupo('No máximo um por tipo a cada 2 minutos');
  win.sinalDoAparelho('envio'); win.sinalDoAparelho('envio');
  await espera(20);
  t('repetido logo em seguida: não sai de novo', enviados.length === 1, enviados.length);
  win.sinalDoAparelho('download');
  await espera(20);
  t('outro tipo sai normalmente', enviados.length === 2, enviados.length);
  win._SINAL.ultimo.envio = Date.now() - 121000;
  win.sinalDoAparelho('envio');
  await espera(20);
  t('passados 2 minutos, o envio volta a sinalizar', enviados.length === 3, enviados.length);

  grupo('O aparelho é sempre o mesmo');
  const id1 = win.idDoAparelho(), id2 = win.idDoAparelho();
  t('o identificador não muda entre chamadas', id1 && id1 === id2 && id1 === p.aparelho_id, id1 + ' / ' + id2);

  grupo('Nunca atrapalha');
  win._SINAL.ultimo = {};
  win.NUVEM.ligada = false;
  t('nuvem desligada: não sai nada', win.sinalDoAparelho('envio') === false);
  win.NUVEM.ligada = true; win.NUVEM.plataforma = true;
  t('modo plataforma (dono sem loja): não sai nada', win.sinalDoAparelho('envio') === false);
  win.NUVEM.plataforma = false; win.NUVEM.token = null;
  t('sem sessão: não sai nada', win.sinalDoAparelho('envio') === false);
  win.NUVEM.token = 'tk';
  win.fetch = () => Promise.reject(new Error('rede caiu'));
  let estourou = false;
  try { win.sinalDoAparelho('erro', 'teste'); } catch (e) { estourou = true; }
  await espera(30);
  t('rede caída: não lança erro nenhum', !estourou);
  win.fetch = () => { throw new Error('fetch quebrado'); };
  win._SINAL.ultimo = {};
  estourou = false;
  try { win.sinalDoAparelho('envio'); } catch (e) { estourou = true; }
  t('mesmo com o fetch quebrado, não lança erro', !estourou);

  grupo('Sem erro de console');
  t('nenhum erro de página', erros.length === 0, erros.join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · O aparelho avisa a nuvem que está vivo');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

/* ==========================================================
   A LIBERAÇÃO SÓ ESTÁ FEITA QUANDO CHEGOU NA NUVEM (04/10/2026)

   Rodar:  node testes/liberacao-conferida-na-nuvem.js
   ou:     npm run test:libconfere   (entra na bateria e no portão)

   Rafael liberou o FELICITÁ GELATO para Santa Fé pela ficha técnica, a
   tela disse "salvo", e Santa Fé não via. O envio do aparelho dele travou
   (nuvem lenta às 13h45) e a alteração ficou só no aparelho. "Você colocou
   lá para Santa Fé ver, tem que estar funcionando."

   Prende:
     · salvar a ficha com outra liberação confere na nuvem;
     · conferido: diz que as lojas já enxergam;
     · a nuvem com outra liberação: avisa, registra e baixa de novo;
     · ainda não chegou: avisa "enviando" e tenta de novo sozinho;
     · sem nuvem: diz que está só no aparelho;
     · salvar sem mexer na liberação não confere nada;
     · a janela "Quem enxerga" confere cada cadastro na sua tabela.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const L = '6001c62e-26f3-4d81-8b6c-fa367c14146c';
const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const erros = [];
const espera = (ms) => new Promise(r => setTimeout(r, ms));
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
  await espera(900);
  const w = dom.window, DB = w.DB;
  const toasts = [], caixinha = [];
  w.toast = (m) => toasts.push(String(m));
  w.reportarErro = (tp, on, m) => { caixinha.push(m); return true; };
  let nuvem = {}, leituras = 0, rebaixou = 0, sincs = 0;
  w.sincronizar = async () => { sincs++; };
  w.baixarDaNuvem = async () => { rebaixou++; return true; };
  w.api = async (q) => {
    leituras++;
    const m = /ref_local=in\.\(([^)]*)\)/.exec(q);
    const ids = m ? m[1].split(',').map(decodeURIComponent) : [];
    return ids.filter(id => id in nuvem).map(id => ({ ref_local: id, sucursais: nuvem[id] }));
  };
  Object.assign(w.NUVEM, { ligada: true, loja: L, sincronizando: false });
  DB.fichas = [{ id: 'fi_fel', nome: 'FELICITÁ GELATO', sucursais: ['suc_sf'], itens: [] }];

  grupo('1. Conferido na nuvem');
  nuvem = { fi_fel: ['suc_sf'] };
  let r = await w.conferirLiberacaoNaNuvem('fichas', ['fi_fel'], 'Liberação da ficha');
  t('a liberação que chegou é conferida', r === 'ok', r);
  t('envia antes de conferir', sincs >= 1, sincs);
  t('diz que as lojas já enxergam', /conferida na nuvem — as lojas marcadas já enxergam/.test(toasts.join('|')), toasts.join('|'));

  grupo('2. A nuvem manteve outra liberação');
  toasts.length = 0; nuvem = { fi_fel: [] };
  r = await w.conferirLiberacaoNaNuvem('fichas', ['fi_fel'], 'Liberação da ficha');
  t('não diz que deu certo', r === 'outra' && !/já enxergam/.test(toasts.join('|')), r + ' ' + toasts.join('|'));
  t('avisa, registra na caixinha e baixa de novo', /manteve a liberação/.test(toasts.join('|')) && caixinha.length === 1 && rebaixou === 1,
    JSON.stringify({ toasts, caixinha, rebaixou }));

  grupo('3. Ainda não chegou: tenta de novo sozinho');
  toasts.length = 0; nuvem = {}; leituras = 0;
  const p = w.conferirLiberacaoNaNuvem('fichas', ['fi_fel'], 'Liberação da ficha');
  await espera(300);
  t('avisa que está enviando', /salva — enviando para a nuvem/.test(toasts.join('|')), toasts.join('|'));
  nuvem = { fi_fel: ['suc_sf'] };       /* a nuvem volta e o envio chega */
  r = await p;
  t('tenta de novo e confirma quando chega', r === 'ok' && leituras >= 2, r + ' leituras=' + leituras);

  grupo('4. Sem nuvem: diz a verdade');
  toasts.length = 0; w.NUVEM.ligada = false;
  r = await w.conferirLiberacaoNaNuvem('fichas', ['fi_fel'], 'Liberação da ficha');
  t('diz que está só neste aparelho', r === 'offline' && /só enxergam depois que o sistema enviar/.test(toasts.join('|')), toasts.join('|'));
  w.NUVEM.ligada = true;
  t('cadastro sem tabela de liberação conferível não é conferido', (await w.conferirLiberacaoNaNuvem('turnos', ['x'])) === 'nada');

  grupo('5. Os botões chamam a conferência');
  const fonte = fs.readFileSync(ARQ, 'utf8');
  t('a ficha técnica confere quando a liberação mudou (e só então)',
    /var _sucAntes=JSON\.stringify\(\(\(f\|\|\{\}\)\.sucursais\|\|\[\]\)\.slice\(\)\.sort\(\)\);/.test(fonte) &&
    /!==_sucAntes&&typeof conferirLiberacaoNaNuvem==='function'\)\s*conferirLiberacaoNaNuvem\('fichas',\[_fx\.id\],'Liberação da ficha'\)/.test(fonte));
  const ab = String(w.abrirEscolhaUnidades);
  t('a janela "Quem enxerga" confere cada cadastro na sua tabela',
    /LIB_CONFERE\.find/.test(ab) && /conferirLiberacaoNaNuvem\(c,_porCol\[c\],'Liberação'\)/.test(ab));

  grupo('Balanço');
  t('nenhum erro de runtime', erros.length === 0, erros.slice(0, 5).join(' | '));
  console.log('\n' + R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : '') + '\n');
  try { w.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

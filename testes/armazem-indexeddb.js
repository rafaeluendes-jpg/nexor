/* ==========================================================
   JOIA — O ARMAZÉM MUDOU PARA INDEXEDDB SEM PERDER NADA (Fase 2)

   Rodar:  node testes/armazem-indexeddb.js
   ou:     npm run test:idb   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE

   A base do aparelho saiu do localStorage (teto de ~5 MB, o "memória
   cheia") para o IndexedDB. É a troca mais delicada do sistema: um erro
   aqui perde TODOS os dados da loja. Este guardião prova, no IndexedDB de
   verdade (fake-indexeddb), que:

     · aparelho que já tinha base no localStorage MIGRA para o IndexedDB
       sem perder nada, e a cópia velha só é apagada depois de confirmar;
     · depois de um "reload", a base volta do IndexedDB (persistiu);
     · a comparação de "mesmo dono" no login lê a base migrada (não o
       localStorage vazio) — senão trataria a própria loja como cliente
       novo e apagaria tudo (o desastre que este teste existe para barrar);
     · sem IndexedDB, tudo continua no localStorage, como antes.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const HTML = fs.readFileSync(ARQ, 'utf8');

const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* carrega o sistema num DOM. `idb` = fábrica de IndexedDB compartilhada
   (mesma fábrica em dois carregamentos = "mesmo aparelho, recarregado");
   passe null para simular aparelho SEM IndexedDB. `semear` injeta uma base
   no localStorage antes de o script rodar. */
async function carregar(idb, semear) {
  const vc = new VirtualConsole();
  const erros = [];
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      if (idb) win.indexedDB = idb;                 /* IndexedDB de verdade */
      else { try { delete win.indexedDB; } catch (e) {} win.indexedDB = undefined; }
      try { if (semear != null) win.localStorage.setItem('nexor_dados', semear); } catch (e) {}
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const win = dom.window;
  try { await win.hidratarLocal(); } catch (e) {}
  await new Promise(r => setTimeout(r, 20));
  win._erros = erros;
  return win;
}

(async function () {
  console.log('\nCarregando o sistema para o guardião do IndexedDB…');

  /* uma base de mentira, no formato que o app grava (comprimida com LZ1|
     quando compensa; aqui uso JSON puro, que `_desempacota` também lê) */
  const baseDono = JSON.stringify({
    _dono: 'loja_1', _donoUsuario: 'user_1', _donoSuc: 'suc_1',
    usuarios: [{ id: 'user_1', login: 'santafe' }], produtos: [{ id: 'p1', nome: 'Cascão' }],
    categorias: [], grupos: [], fichas: []
  });

  /* ---------------------------------------------------------- */
  grupo('As peças do armazém existem');
  const idbA = new IDBFactory();
  let win = await carregar(idbA, baseDono);
  ['idbDisponivel', 'idbLer', 'idbGravar', 'hidratarLocal', '_baseCrua', 'apagarBaseLocal', 'gravarLocal']
    .forEach(fn => t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));
  t('o IndexedDB foi reconhecido como disponível', win.idbDisponivel() === true);

  grupo('Aparelho que tinha base no localStorage MIGRA para o IndexedDB');
  t('passou a usar o IndexedDB', win._usaIDB === true, 'usaIDB=' + win._usaIDB);
  const noIdb = await win.idbLer('nexor_dados');
  t('a base foi copiada para o IndexedDB', noIdb === baseDono, String(noIdb).slice(0, 40));
  t('a cópia velha do localStorage AINDA está lá (reserva até a 1ª gravação)',
    win.localStorage.getItem('nexor_dados') === baseDono);
  win.carregar();
  t('carregar() lê a base migrada', win.DB && win.DB._dono === 'loja_1' && (win.DB.produtos || []).length === 1);

  grupo('Grava no IndexedDB e mantém o espelho síncrono no localStorage');
  win.DB.produtos.push({ id: 'p2', nome: 'Casquinha' });
  win.gravarLocal();
  try { await win.esperarGravacao(); } catch (e) {}
  await new Promise(r => setTimeout(r, 30));
  const noIdb2 = await win.idbLer('nexor_dados');
  t('o IndexedDB (a fonte) tem a base nova (com o item recém-criado)',
    /Casquinha/.test(win._desempacota(noIdb2)), String(noIdb2).slice(0, 40));
  t('o localStorage mantém um espelho síncrono (durabilidade imediata no F5)',
    /Casquinha/.test(win._desempacota(win.localStorage.getItem('nexor_dados') || '')),
    String(win.localStorage.getItem('nexor_dados')).slice(0, 40));

  grupo('Depois de um "reload", a base volta do IndexedDB (persistiu)');
  const win2 = await carregar(idbA, null);         /* mesma fábrica, localStorage vazio = reload */
  t('no reload, voltou a usar o IndexedDB', win2._usaIDB === true);
  win2.carregar();
  t('a base sobreviveu ao reload', win2.DB && win2.DB._dono === 'loja_1' &&
    (win2.DB.produtos || []).some(p => p.nome === 'Casquinha'), JSON.stringify((win2.DB || {}).produtos));

  grupo('A comparação de "mesmo dono" lê a base migrada, não o localStorage vazio');
  /* _baseCrua é a fonte que o login usa para saber se a base é do mesmo dono.
     Depois da virada o localStorage está vazio; se o login lesse dali, zeraria
     a loja. Tem de ler a base de verdade (a que está no IndexedDB/memória). */
  t('_baseCrua devolve a base migrada (não vazio)',
    !!win2._baseCrua() && /loja_1/.test(win2._desempacota(win2._baseCrua())), String(win2._baseCrua()).slice(0, 30));

  grupo('Apagar a base (troca de dono/reset) limpa as DUAS fontes');
  win2.apagarBaseLocal();
  await new Promise(r => setTimeout(r, 30));
  const noIdb3 = await win2.idbLer('nexor_dados');
  t('sumiu do IndexedDB', noIdb3 == null, String(noIdb3).slice(0, 20));
  t('sumiu do localStorage', !win2.localStorage.getItem('nexor_dados'));

  grupo('Sem IndexedDB, tudo continua no localStorage (como antes)');
  const winSem = await carregar(null, baseDono);
  t('sem IndexedDB, NÃO usa IDB', winSem._usaIDB === false, 'usaIDB=' + winSem._usaIDB);
  winSem.carregar();
  t('lê a base direto do localStorage', winSem.DB && winSem.DB._dono === 'loja_1');
  winSem.DB.produtos.push({ id: 'p9', nome: 'Pote' });
  winSem.gravarLocal();
  t('grava de volta no localStorage (com marca de compressão possível)',
    !!winSem.localStorage.getItem('nexor_dados') && /Pote|LZ1/.test(winSem.localStorage.getItem('nexor_dados')));

  grupo('Balanço: zero erro de runtime');
  const todosErros = [].concat(win._erros || [], win2._erros || [], winSem._erros || []);
  t('nenhum erro de runtime nos carregamentos', todosErros.length === 0, todosErros.slice(0, 6).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · O armazém mudou para IndexedDB sem perder nada');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); win2.close(); winSem.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

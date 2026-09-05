/* ==========================================================
   JOIA — A BASE CABE NO APARELHO (compressão sem perda)

   Rodar:  node testes/armazenamento-comprime.js
   ou:     npm run test:comprime

   POR QUE EXISTE (defeito real de 05/09/2026)

   A loja de Santa Fé viu "o sistema não está conseguindo salvar — memória
   cheia (5109 KB)". Era real: a base em JSON passava dos ~5 MB que o
   navegador dá, e o navegador RECUSAVA gravar — a venda feita sem internet
   não sobrevivia a um F5.

   A base passou a ser guardada COMPRIMIDA (lz-string). Este teste roda as
   funções REAIS do sistema, num DOM de verdade, e prova que:
     · o que é gravado volta IDÊNTICO (sem perda, com acento);
     · o comprimido é muito menor que o original;
     · aparelho antigo (base sem comprimir) continua sendo lido — a virada
       não perde nada;
     · a base grande, que antes estourava, agora grava.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');

const R = { total: 0, ok: 0, falhou: 0 };
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

(async function () {
  const vc = new VirtualConsole();
  const html = fs.readFileSync(ARQ, 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const win = dom.window;

  console.log('\n── A biblioteca de compressão carregou');
  t('LZString existe', win.LZString && typeof win.LZString.compressToUTF16 === 'function');
  t('_empacota e _desempacota existem',
    typeof win._empacota === 'function' && typeof win._desempacota === 'function');

  console.log('\n── Comprime e volta idêntico (sem perda, com acento)');
  const original = JSON.stringify({
    produtos: Array.from({ length: 300 }, (_, i) => ({ id: 'p' + i, nome: 'Cascão Nº ' + i + ' — açaí/pêssego', preco: i * 1.5 })),
    pedidos: Array.from({ length: 400 }, (_, i) => ({ id: 'ped' + i, total: i, itens: [{ n: 'Gelato', q: 1 }] }))
  });
  const empacotado = win._empacota(original);
  t('o empacotado leva a marca LZ1|', empacotado.slice(0, 4) === 'LZ1|', empacotado.slice(0, 8));
  t('o empacotado é bem menor que o original',
    empacotado.length < original.length / 3, empacotado.length + ' vs ' + original.length);
  t('desempacotar devolve EXATAMENTE o original', win._desempacota(empacotado) === original);

  console.log('\n── Aparelho antigo (base sem comprimir) continua legível');
  const legado = JSON.stringify({ produtos: [{ id: 'x', nome: 'Café' }] });
  t('base antiga (JSON puro) passa sem alteração', win._desempacota(legado) === legado);
  t('base antiga não é confundida com comprimida', legado.slice(0, 4) !== 'LZ1|');

  console.log('\n── gravarLocal grava comprimido e carregar lê de volta');
  win.DB = { produtos: [{ id: 'a', nome: 'Açaí' }], pedidos: [{ id: 'p1', total: 42, obs: 'çãé' }], _dono: 'l1' };
  win.localStorage.removeItem('nexor_dados');
  const gravou = win.gravarLocal();
  const bruto = win.localStorage.getItem('nexor_dados');
  t('gravarLocal gravou', gravou === true);
  t('o que está no localStorage está comprimido (LZ1|)', bruto && bruto.slice(0, 4) === 'LZ1|', (bruto || '').slice(0, 8));
  /* zera o DB e recarrega do "aparelho" */
  win.DB = {};
  win.carregar();
  t('carregar recuperou os pedidos', ((win.DB.pedidos || [])[0] || {}).total === 42);
  t('carregar preservou o acento no obs', ((win.DB.pedidos || [])[0] || {}).obs === 'çãé');
  t('carregar preservou o dono', win.DB._dono === 'l1');

  console.log('\n── A base grande, que estourava, agora cabe');
  const grandeDB = { pedidos: Array.from({ length: 12000 }, (_, i) => ({ id: 'ped' + i, numero: i, cliente_nome: 'Consumidor', nome: 'Cascão ' + i, total: i * 1.5, data: '2026-09-04T22:00:00.000Z', itens: [{ nome: 'Gelato Venda', qtd: 1, unitario: 24, total: 24 }], pagamentos: [{ forma: 'fp_dinheiro', formaNome: 'Dinheiro', valor: 24 }] })) };
  const cru = JSON.stringify(grandeDB);
  const comp = win._empacota(cru);
  t('a base grande em JSON passa de 3 MB (rumo ao limite que estourava)', cru.length > 3000000, Math.round(cru.length / 1024) + ' KB');
  t('comprimida cabe com muita folga (< 1/8 do original)',
    comp.length < cru.length / 8, Math.round(comp.length / 1024) + ' KB de ' + Math.round(cru.length / 1024) + ' KB');
  t('e volta idêntica', win._desempacota(comp) === cru);

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · a base cabe no aparelho');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

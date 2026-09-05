/* ==========================================================
   JOIA — GUARDIÃO DA FRENTE DE CAIXA

   Rodar com:  node testes/frente-de-caixa-guardiao.js
   ou:         npm run test:guardiao   (entra no portão de publicação)

   POR QUE ESTE ARQUIVO EXISTE (ordem do Rafael, 05/09/2026)

   O padrão que mais machucou a loja: consertar uma coisa e quebrar outra
   na frente de caixa, sem ninguém perceber até imprimir o comprovante ou
   fechar o caixa. Os testes antigos rodavam com DADOS LIMPOS e a nuvem
   ligada — o estado bom. Mas os defeitos NASCEM no estado ruim: a lista
   de formas de pagamento que ainda não sincronizou, o aparelho recém
   aberto, o cadastro vazio.

   Este guardião trava a frente de caixa NO ESTADO RUIM. Ele carrega o
   sistema de verdade e, com o cadastro propositalmente vazio, confere que:

     · o comprovante SEMPRE sai com o nome da forma de pagamento;
     · o dinheiro com troco não trava a venda;
     · dois avisos sobrepostos (o do cancelamento) não se atropelam.

   Cada linha aqui nasceu de um defeito real que chegou na loja. Se uma
   publicação futura quebrar qualquer um deles, o portão trava e NÃO sobe.
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

/* uma linha de pagamento do comprovante saiu SEM nome? (começa direto no
   número, sem rótulo à esquerda) */
function linhaSemNome(txt) {
  return /^\s*R?\$?\s*[\d.,]+\s*$/.test(String(txt));
}

(async function () {
  console.log('\nCarregando o sistema para o guardião da frente de caixa…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  /* ---------------------------------------------------------- */
  grupo('As funções críticas da frente de caixa existem');
  ['finalizarVenda', 'linhasPag', 'nomeFormaPag', 'formaDaTrocoId', 'confirmar', 'fecharCaixa']
    .forEach(fn => t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  const pedido = (pgs) => ({ numero: 910, total: 24, clienteNome: 'Consumidor',
    itens: [{ nome: 'Cascão 1 Bola', qtd: 1, total: 24 }], pagamentos: pgs });

  /* ==========================================================
     O DEFEITO DO PEDIDO 910: o comprovante saiu "Pagamento" sem o nome.
     Aqui o cadastro está VAZIO de propósito — o estado ruim — e o nome
     ainda tem de sair, por qualquer um dos três caminhos. ========== */
  grupo('Comprovante: a forma de pagamento nunca sai em branco (cadastro vazio)');

  /* A — o nome foi GRAVADO na venda: independe de qualquer lista */
  win.DB.formasPag = []; win.FORMAS = [];
  let linhas = win.linhasPag(pedido([{ forma: 'fp_x', formaNome: 'Dinheiro', valor: 24, recebido: 24 }]), 32);
  let txts = linhas.map(l => l.txt);
  t('nome gravado na venda aparece mesmo com tudo vazio', txts.some(x => /Dinheiro/.test(x)), txts.join(' | '));
  t('nenhuma linha de pagamento sai sem nome (A)', !txts.some(linhaSemNome), txts.join(' | '));

  /* B — sem nome gravado, mas a LISTA ATIVA do caixa (FORMAS) tem a forma */
  win.DB.formasPag = [];
  win.FORMAS = [{ id: 'fp_pix', n: 'Pix', tipo: 'pix' }];
  linhas = win.linhasPag(pedido([{ forma: 'fp_pix', valor: 24, recebido: 24 }]), 32);
  txts = linhas.map(l => l.txt);
  t('acha o nome na lista ativa do caixa quando o cadastro não carregou', txts.some(x => /Pix/.test(x)), txts.join(' | '));
  t('nenhuma linha de pagamento sai sem nome (B)', !txts.some(linhaSemNome), txts.join(' | '));

  /* C — sem nome gravado e sem FORMAS, mas o CADASTRO tem */
  win.DB.formasPag = [{ id: 'fp_dinheiro', nome: 'Dinheiro', tipo: 'dinheiro' }];
  win.FORMAS = [];
  linhas = win.linhasPag(pedido([{ forma: 'fp_dinheiro', valor: 24, recebido: 24 }]), 32);
  txts = linhas.map(l => l.txt);
  t('cai no cadastro quando a forma não está na lista ativa', txts.some(x => /Dinheiro/.test(x)), txts.join(' | '));

  /* D — tudo vazio: deriva do tipo, nunca fica em branco */
  win.DB.formasPag = []; win.FORMAS = [];
  linhas = win.linhasPag(pedido([{ tipo: 'credito', valor: 24, recebido: 24 }]), 32);
  txts = linhas.map(l => l.txt);
  t('sem nada resolvível, deriva do tipo (Cartão crédito)', txts.some(x => /Cartão crédito/.test(x)), txts.join(' | '));
  t('nenhuma linha de pagamento sai sem nome (D)', !txts.some(linhaSemNome), txts.join(' | '));

  /* ==========================================================
     TROCO EM DINHEIRO não trava com o cadastro vazio (defeito 04/09) ==*/
  grupo('Dinheiro com troco não trava a venda (cadastro vazio)');
  win.DB.formasPag = [];
  win.FORMAS = [{ id: 'fp_dinheiro', n: 'Dinheiro', tipo: 'dinheiro', troco: true }];
  t('o dinheiro é reconhecido como forma que dá troco', win.formaDaTrocoId('fp_dinheiro') === true);
  t('o pix não dá troco', win.formaDaTrocoId('fp_pix') === false);

  /* ==========================================================
     CANCELAR não estoura: dois avisos sobrepostos (defeito 04/09) ======*/
  grupo('Cancelar a venda: dois avisos sobrepostos não se atropelam');
  try {
    const doc = win.document;
    const antes = erros.length;
    const pA = win.confirmar({ titulo: 'A', ok: 'OK A', cancelar: 'Não A' });
    const pB = win.confirmar({ titulo: 'B', ok: 'OK B', cancelar: 'Não B' });
    const ovs = doc.querySelectorAll('.cfOv');
    t('os dois avisos abrem juntos', ovs.length === 2, ovs.length + '');
    const btB = ovs[1].querySelector('[data-cf="1"]');
    const btA = ovs[0].querySelector('[data-cf="0"]');
    if (btB) btB.dispatchEvent(new win.Event('click', { bubbles: true }));
    if (btA) btA.dispatchEvent(new win.Event('click', { bubbles: true }));
    const rB = await pB, rA = await pA;
    t('o de cima confirma e o de baixo ainda responde (sem "não é função")',
      rB === true && rA === false, 'rB=' + rB + ' rA=' + rA);
    t('nenhum erro de tela ao confirmar avisos sobrepostos', erros.length === antes,
      erros.slice(antes).join(' | '));
  } catch (e) { t('o fluxo de avisos roda sem estourar', false, e.message); }

  /* ---------------------------------------------------------- */
  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Guardião da frente de caixa');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

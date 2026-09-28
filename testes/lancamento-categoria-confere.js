/* ==========================================================
   JOIA — COMPRA E GASTO TÊM CATEGORIA, E ELA FICA (28/09/2026)

   Rodar:  node testes/lancamento-categoria-confere.js
   ou:     npm run test:catconfere   (entra na bateria e no portão)

   Rafael: "quando a pessoa for lançar uma compra ou um gasto, é
   obrigatório colocar a categoria — se é custo direto, imposto... E uma
   vez salvo, confere se está salvando, para não ter perigo de voltar."

   Na nuvem havia 20 despesas sem categoria (16 de nota de entrada, 4
   manuais, todas de antes de 24/09). Este guardião prende:
     1. sem categoria, com categoria apagada ou com categoria de receita,
        a despesa NÃO salva — e o campo fica marcado;
     2. com categoria certa, salva com ela;
     3. depois de salvar, o sistema LÊ DE VOLTA da nuvem a categoria de
        cada lançamento: só diz "conferido" quando ela está lá; se a
        nuvem recebeu sem, relê os vínculos, reenvia e confere de novo; se
        ainda faltar, avisa com o nome do lançamento;
     4. sem internet, diz a verdade: "salvo neste aparelho";
     5. na lista, despesa sem categoria aparece como "Sem categoria",
        clicável; lançamento automático (com nome de categoria) não;
     6. editar um lançamento com categoria apagada mostra o campo vazio,
        em vez de "—" passando como se estivesse preenchido.
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
const espera = ms => new Promise(r => setTimeout(r, ms));

(async function () {
  console.log('\nCarregando o sistema para o guardião da categoria do lançamento…');
  const vc = new VirtualConsole();
  const erros = [];
  vc.on('jsdomError', e => erros.push(String(e && e.message)));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await espera(900);
  const win = dom.window, doc = win.document;
  const toasts = [];
  const toastOrig = win.toast;
  win.toast = function (m) { toasts.push(String(m)); try { return toastOrig.apply(this, arguments); } catch (e) {} };

  win.DB.contas = [{ id: 'cc_caixa', nome: 'Caixa da loja', fixa: 'caixa' }];
  win.DB.formasPag = [{ id: 'fp_pix', nome: 'Pix', tipo: 'pix' }];
  win.DB.catfin = [
    { id: 'g1', nome: 'Custos Diretos', tipo: 'despesa', itens: [{ id: 'cat_merc', nome: 'Compra de mercadoria' }] },
    { id: 'g2', nome: 'Impostos', tipo: 'despesa', itens: [{ id: 'cat_simples', nome: 'Simples Nacional' }] },
    { id: 'g3', nome: 'Receitas', tipo: 'receita', itens: [{ id: 'cat_vendas', nome: 'Vendas' }] }
  ];
  win.DB.fornec = []; win.DB.lancFin = [];
  win.NUVEM.ligada = false;

  function novaDespesa(desc, cat) {
    try { win.fecharModal(); } catch (e) {}
    win.modalLanc(null, 'despesa', {});
    doc.getElementById('lnD').value = desc;
    doc.getElementById('lnV').value = '120';
    doc.getElementById('lnCat').value = cat;
  }
  async function salvarForm() { await doc.getElementById('mdOk').onclick(); await espera(30); }

  grupo('1. Despesa sem categoria certa não salva');
  novaDespesa('Sem categoria nenhuma', '');
  let n0 = win.DB.lancFin.length;
  await salvarForm();
  t('sem categoria: não salvou', win.DB.lancFin.length === n0);
  t('e o campo da categoria ficou marcado', doc.getElementById('lnCatB').classList.contains('falta'));
  t('e o aviso pede a categoria da despesa', /categoria da despesa/.test(toasts[toasts.length - 1] || ''), toasts.slice(-1)[0]);
  novaDespesa('Categoria apagada', 'cat_que_nao_existe');
  await salvarForm();
  t('categoria apagada: não salvou', win.DB.lancFin.length === n0);
  novaDespesa('Categoria de receita', 'cat_vendas');
  await salvarForm();
  t('categoria de receita numa despesa: não salvou', win.DB.lancFin.length === n0);

  grupo('2. Com a categoria certa, salva com ela');
  novaDespesa('Simples Nacional setembro', 'cat_simples');
  win.escolheCatLanc('cat_simples');
  t('escolher a categoria tira a marca de falta', !doc.getElementById('lnCatB').classList.contains('falta'));
  toasts.length = 0;
  await salvarForm();
  const salvo = win.DB.lancFin[win.DB.lancFin.length - 1] || {};
  t('salvou', win.DB.lancFin.length === n0 + 1);
  t('com a categoria escolhida', salvo.categoriaId === 'cat_simples', salvo.categoriaId);

  grupo('4. Sem internet: diz a verdade');
  await espera(50);
  t('"salvo neste aparelho", não "conferido"',
    toasts.some(m => /salvo neste aparelho/.test(m)) && !toasts.some(m => /conferido/.test(m)), toasts.join(' | '));

  grupo('3. Com a nuvem: lê de volta a categoria antes de dizer "conferido"');
  win.NUVEM.ligada = true; win.NUVEM.loja = '6001c62e-26f3-4d81-8b6c-fa367c14146c';
  win.DB._uuid = win.DB._uuid || {}; win.DB._hash = win.DB._hash || {};
  let naNuvem = {};                     /* ref_local -> subcategoria_id */
  let leituras = [], envios = 0, mapaRelido = 0;
  win.sincronizar = async function () {
    envios++;
    win.DB._uuid.lancFin = win.DB._uuid.lancFin || {};
    (win.DB.lancFin || []).forEach(l => { win.DB._uuid.lancFin[l.id] = 'uuid-' + l.id; });
  };
  win.montarMapaVinculos = async function () { mapaRelido++; };
  win.api = async function (caminho) {
    leituras.push(caminho);
    const m = /ref_local=in\.\(([^)]*)\)/.exec(caminho);
    const ids = m ? m[1].split(',').map(decodeURIComponent) : [];
    return ids.map(id => ({ ref_local: id, subcategoria_id: naNuvem[id] || null }));
  };

  /* 3a — a nuvem tem a categoria */
  naNuvem[salvo.id] = 'uuid-sub-simples';
  toasts.length = 0;
  let ok = await win.conferirLancNaNuvem([salvo.id]);
  t('esperou o envio', envios >= 1);
  t('leu a categoria de volta da nuvem', leituras.some(u => /lancamentos_financeiros\?/.test(u) && /subcategoria_id/.test(u)), leituras[0]);
  t('só então disse "conferido na nuvem, com a categoria"', ok === true && toasts.some(m => /conferido na nuvem, com a categoria/.test(m)), toasts.join(' | '));

  /* 3b — a nuvem recebeu sem, e o reenvio resolve */
  novaDespesa('NF 123 — Fornecedor', 'cat_merc');
  win.NUVEM.ligada = false; await salvarForm(); win.NUVEM.ligada = true;
  const l2 = win.DB.lancFin[win.DB.lancFin.length - 1];
  win.DB._hash.lancFin = { [l2.id]: 'impressao-antiga' };
  let tentativas = 0;
  win.sincronizar = async function () {
    envios++; tentativas++;
    win.DB._uuid.lancFin[l2.id] = 'uuid-' + l2.id;
    if (tentativas >= 2) naNuvem[l2.id] = 'uuid-sub-merc';  /* só o reenvio leva a categoria */
  };
  toasts.length = 0; mapaRelido = 0;
  ok = await win.conferirLancNaNuvem([l2.id]);
  t('a nuvem sem categoria fez reler os vínculos', mapaRelido === 1);
  t('e reenviar o lançamento (a impressão velha foi esquecida)', !(win.DB._hash.lancFin || {})[l2.id]);
  t('e conferir de novo — agora conferido', ok === true && toasts.some(m => /conferido/.test(m)), toasts.join(' | '));

  /* 3c — nem o reenvio leva: avisa, com o nome */
  novaDespesa('Conta de luz', 'cat_merc');
  win.NUVEM.ligada = false; await salvarForm(); win.NUVEM.ligada = true;
  const l3 = win.DB.lancFin[win.DB.lancFin.length - 1];
  win.sincronizar = async function () { win.DB._uuid.lancFin[l3.id] = 'uuid-' + l3.id; };
  let aviso = null;
  const confOrig = win.confirmar;
  win.confirmar = async function (op) { aviso = op; return true; };
  toasts.length = 0;
  ok = await win.conferirLancNaNuvem([l3.id]);
  win.confirmar = confOrig;
  t('não disse "conferido"', ok === false && !toasts.some(m => /conferido/.test(m)));
  t('avisou que a categoria não chegou', aviso && /categoria não chegou/.test(aviso.titulo), aviso && aviso.titulo);
  t('com o nome do lançamento', aviso && /Conta de luz/.test(aviso.texto), aviso && aviso.texto);

  grupo('5. Na lista, despesa sem categoria aparece — e se corrige com um clique');
  win.DB.lancFin.push({ id: 'lf_velho', tipo: 'despesa', descricao: 'NF 3195102 — Riberfoods (1/3)', valor: 272.43,
    emissao: '2026-09-22', vencimento: '2026-09-22', pago: false, categoriaId: '' });
  win.DB.lancFin.push({ id: 'lf_auto', tipo: 'despesa', descricao: 'Acerto com entregador', valor: 30,
    emissao: '2026-09-22', vencimento: '2026-09-22', pago: true, categoriaTxt: 'Acerto com entregadores' });
  t('a regra: despesa sem categoria', win.lancSemCategoria(win.DB.lancFin.find(x => x.id === 'lf_velho')) === true);
  t('lançamento automático com nome de categoria não entra', win.lancSemCategoria(win.DB.lancFin.find(x => x.id === 'lf_auto')) === false);
  t('com categoria certa não entra', win.lancSemCategoria(salvo) === false);
  try { win.LF.de = '2026-09-01'; win.LF.ate = '2026-09-30'; } catch (e) {}
  try { win.telaLancamentos(); } catch (e) { erros.push('telaLancamentos: ' + e.message); }
  const tag = [].slice.call(doc.querySelectorAll('.grpTag.semCat'));
  t('a lista mostra "Sem categoria"', tag.length >= 1 && /Sem categoria/.test(tag[0].textContent), tag.length);
  t('e o clique abre a edição daquele lançamento', tag.length && /modalLanc\('lf_velho'\)/.test(tag[0].getAttribute('onclick') || ''));

  grupo('6. Editar lançamento com categoria apagada mostra o campo vazio');
  win.DB.lancFin.push({ id: 'lf_catvelha', tipo: 'despesa', descricao: 'Mercado', valor: 30,
    emissao: '2026-08-15', vencimento: '2026-08-15', pago: false, categoriaId: 'cat_apagada' });
  try { win.fecharModal(); } catch (e) {}
  win.modalLanc('lf_catvelha');
  t('o campo abre vazio', doc.getElementById('lnCat').value === '');
  t('e diz "Selecione uma opção", não "—"', /Selecione uma opção/.test(doc.querySelector('#lnCatB span').textContent));
  const antes = JSON.stringify(win.DB.lancFin.find(x => x.id === 'lf_catvelha'));
  await salvarForm();
  t('e não deixa salvar sem escolher', JSON.stringify(win.DB.lancFin.find(x => x.id === 'lf_catvelha')) === antes);

  t('nenhum erro de script', erros.length === 0, erros.join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · compra e gasto têm categoria, e ela fica');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

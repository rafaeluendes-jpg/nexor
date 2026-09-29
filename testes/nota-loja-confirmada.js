/* ==========================================================
   JOIA — A NOTA DE ENTRADA PERGUNTA A LOJA A QUEM CIRCULA ENTRE UNIDADES

   Rodar:  node testes/nota-loja-confirmada.js
   ou:     npm run test:notaloja   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 29/09/2026)
   A nota X260925 (Variegato Morango Zero) foi lançada no computador de
   Santa Fé por um login da matriz. O estoque e o contas a pagar foram para
   a Matriz, e a ordem de produção de Santa Fé disse que o insumo não
   existia. Quem enxerga mais de uma unidade agora confirma a loja ANTES
   de digitar a nota; quem é de uma loja só não é incomodado.
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
(async function () {
  console.log('\nCarregando o sistema para o guardião da loja da nota…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }
  const doc = win.document;
  const toasts = []; win.toast = m => toasts.push(String(m));
  win.salvar = () => {}; win.telaNotas = () => {};
  win.DB.sucursais = [{ id: 'suc_matriz', nome: 'Matriz', ativa: true }, { id: 'suc_sf', nome: 'Santa Fé', ativa: true }];
  win.DB.fornec = [{ id: 'fo1', empresa: 'Doce Sabor' }]; win.DB.notas = []; win.DB.movEst = []; win.DB.lancFin = [];
  win.DB.insumos = [{ id: 'i1', nome: 'Variegato Morango Zero', unidade: 'kg', controlaEstoque: true, estoqueAtual: 0 }];
  const fonte = String(win.novaNota);
  const sobra = () => { const o = doc.getElementById('cfOv'); return o ? o.textContent : ''; };
  const fecharAviso = (sim) => { const b = doc.querySelector('#cfOv [data-cf="' + (sim ? 1 : 0) + '"]'); if (b) b.click(); };
  const espera = () => new Promise(r => setTimeout(r, 30));

  grupo('1. A pergunta usa a mesma regra do botão "Loja" do alto da tela');
  t('novaNota consulta vejoVariasUnidades()', /vejoVariasUnidades\(\)/.test(fonte));
  t('e o botão "Loja" do alto usa a mesma regra', /vejoVariasUnidades\(\)\s*\?\s*'<button class="bandSuc" id="sucBtn"/.test(
    fs.readFileSync(ARQ, 'utf8')));

  grupo('2. Login da matriz (vê várias unidades), no computador de Santa Fé');
  win.vejoVariasUnidades = () => true;
  win.nomeLojaAtual = () => 'Matriz';
  win._nota = null;
  win.novaNota();
  await espera();
  t('antes de abrir a nota, pergunta a loja', !!doc.getElementById('cfOv') && win._nota === null, sobra());
  t('a pergunta diz o nome da loja ativa', /Nota de entrada de Matriz\?/.test(sobra()), sobra());
  t('diz que estoque e contas a pagar ficam nela', /estoque e o contas a pagar desta nota ficam em Matriz/.test(sobra()), sobra());
  t('o outro botão é "Trocar de loja" (no celular o botão Loja fica fora da tela)', /Trocar de loja/.test(sobra()), sobra());
  let abriuTroca = 0; const trocaReal = win.abrirTrocaDeLoja; win.abrirTrocaDeLoja = () => { abriuTroca++; };
  fecharAviso(false); await espera();
  t('"Trocar de loja": não abre nota nenhuma', win._nota === null && !doc.getElementById('cfOv'));
  t('"Trocar de loja": abre a lista de lojas', abriuTroca === 1, abriuTroca);
  t('nada entrou no estoque nem no financeiro', win.DB.notas.length === 0 && win.DB.movEst.length === 0 && win.DB.lancFin.length === 0);
  win.abrirTrocaDeLoja = trocaReal;
  t('a lista abre depois do clique (senão o clique fora a fecha) e traz o botão Loja para a vista',
    /scrollIntoView/.test(String(trocaReal)) && /setTimeout\(function\(\)\{\s*if\(!\$\('sucMenu'\)\)toggleSuc\(\)/.test(String(trocaReal)), String(trocaReal));

  win.nomeLojaAtual = () => 'Santa Fé';
  win.novaNota(); await espera();
  t('depois de trocar a loja, a pergunta mostra Santa Fé', /Nota de entrada de Santa Fé\?/.test(sobra()) && /Lançar em Santa Fé/.test(sobra()), sobra());
  fecharAviso(true); await espera();
  t('confirmou: a nota abre vazia, pronta para digitar', !!win._nota && win._nota.numero === '' && (win._nota.itens || []).length === 0);
  t('o cabeçalho da nota mostra a loja', /Nota de entrada · Santa Fé/.test(doc.body.innerHTML));

  grupo('3. Login de uma loja só: nenhuma pergunta');
  try { win.fecharModal(); } catch (e) {}
  win._nota = null;
  win.vejoVariasUnidades = () => false;
  win.novaNota();
  t('abre a nota direto, sem aviso', !!win._nota && !doc.getElementById('cfOv'));

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));
  console.log('\n' + '═'.repeat(52));
  console.log('Joia · A nota de entrada pergunta a loja');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

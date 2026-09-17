/* ==========================================================
   JOIA — CADASTRO DA REDE: A UNIDADE VÊ, SÓ A MATRIZ EDITA

   Rodar:  node testes/cadastro-so-a-matriz-edita.js
   ou:     npm run test:cadmatriz   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 17/09/2026)
   Santa Fé abriu "BASE FIOR DI LATTE" pelo olhinho do Estoque Total e o
   cadastro veio editável — descrição, unidade, grupo. Um nome trocado na
   unidade quebra a ligação da base, da ficha e do estoque da rede inteira.
   Ingrediente e ficha técnica passam a ser só consulta na unidade.

   E a outra metade do mesmo estrago: a base do pedido caía no item pelo
   NOME, e um homônimo ganhava do vínculo. Agora quem manda é o vínculo —
   a ficha do pedido e o item de estoque que ela gera.
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
  console.log('\nCarregando o sistema para o guardião do cadastro da rede…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }
  const doc = win.document;
  const toasts = []; win.toast = m => toasts.push(String(m));
  win.salvar = () => {}; win.logNuvem = () => {}; win.pintarSino = () => {};
  win.rodape = () => {}; win.pergunta = async () => true;
  win.NUVEM = win.NUVEM || {}; win.NUVEM.ligada = false;

  grupo('As peças existem');
  ['podeEditarCadastro', 'barraCadastro', 'travarCamposSoLeitura'].forEach(fn =>
    t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  /* a rede: matriz + Santa Fé */
  win.DB.sucursais = [{ id: 'suc_mz', nome: 'Matriz', ativa: true, matriz: true },
                      { id: 'suc_sf', nome: 'Santa Fé', ativa: true }];
  win.baseSuc = () => win.DB.sucursais;
  win.DB.lojaAtual = 'suc_sf'; win.lojaAtualId = () => 'suc_sf';
  win.DB.gruposIng = [{ id: 'g1', nome: 'Base de Gelato', sucursais: ['*'] }];
  win.DB.fornec = []; win.DB.estoqueUn = []; win.DB.movEst = [];
  win.DB.fichaCats = [{ id: 'fc1', nome: 'Bases', paiId: '', subs: [], destinoId: '', sucursais: ['*'] }];

  function unidade() { win.usuarioLogado = () => ({ id: 'u2', login: 'santafe@jolo', sucursais: ['suc_sf'] }); }
  function matriz() { win.usuarioLogado = () => ({ id: 'u1', login: 'dono@jolo', sucursais: ['suc_mz'] }); }

  grupo('Quem é quem');
  unidade(); t('a unidade NÃO edita cadastro da rede', win.podeEditarCadastro() === false);
  matriz();  t('a matriz edita', win.podeEditarCadastro() === true);

  function insumoFior() {
    return { id: 'ins_fior', nome: 'BASE FIOR DI LATTE DUBAI', codigo: '78', unidade: 'un', grupoId: 'g1',
             controlaEstoque: true, compoeCMV: true, estoqueAtual: 3, estoqueMin: 0, estoqueMax: 0,
             fator: 1, custo: 71, custoUltima: 71, modoCusto: 'media', compras: [], sucursais: ['suc_sf'] };
  }

  grupo('A unidade abre o ingrediente pelo olhinho: lê, não digita');
  unidade();
  win.DB.insumos = [insumoFior()];
  win.abrirCadastroItem('ins_fior');
  const mdOv = doc.getElementById('mdOv');
  t('a janela abriu', !!mdOv);
  t('o título diz que é consulta', /consulta/i.test((mdOv.querySelector('.mdH') || {}).textContent || ''),
    (mdOv.querySelector('.mdH') || {}).textContent);
  t('não existe botão Salvar', !/Salvar/.test(mdOv.querySelector('.mdF').innerHTML), mdOv.querySelector('.mdF').innerHTML);
  t('a descrição está travada', doc.getElementById('isN').readOnly === true);
  t('a unidade de consumo está travada', doc.getElementById('isU').disabled === true);
  t('o grupo está travado', doc.getElementById('isG').disabled === true);
  t('"controla estoque" está travado', doc.getElementById('isCe').disabled === true);

  grupo('Mesmo forçando, a unidade não grava nem apaga');
  doc.getElementById('isN').value = 'BASE FIOR DI LATTE';   /* o nome errado de novo */
  toasts.length = 0; win.salvarInsumo('ins_fior', 0);
  t('o nome continua o certo', win.DB.insumos[0].nome === 'BASE FIOR DI LATTE DUBAI', win.DB.insumos[0].nome);
  t('avisou que o cadastro é da matriz', toasts.some(x => /matriz/i.test(x)), toasts.join(' | '));
  toasts.length = 0; await win.excluirInsumo('ins_fior');
  t('o ingrediente não foi excluído', win.DB.insumos.length === 1);
  toasts.length = 0; win.modalFicha();
  t('a ficha técnica não abre para cadastrar', toasts.some(x => /matriz/i.test(x)), toasts.join(' | '));
  toasts.length = 0; win.modalCatFicha();
  t('o grupo de fichas não abre para cadastrar', toasts.some(x => /matriz/i.test(x)));
  win.DB.fichas = [{ id: 'f1', nome: 'BASE FIOR DI LATTE DUBAI', unidade: 'un', estocavel: false,
                     itens: [], rendimento: 1, categoriaId: 'fc1', destinoId: 'ins_fior',
                     destinoNome: 'BASE FIOR DI LATTE DUBAI', sucursais: ['suc_sf'] }];
  win._fichaAberta = 'f1';
  toasts.length = 0; await win.salvarComposicao();
  t('a composição não é salva pela unidade', toasts.some(x => /matriz/i.test(x)), toasts.join(' | '));
  toasts.length = 0; win.addItemFicha('ins_fior');
  t('a unidade não acrescenta ingrediente na ficha', toasts.some(x => /matriz/i.test(x)));

  grupo('As telas não oferecem o que a unidade não pode fazer');
  win.fecharModal && win.fecharModal();
  win.telaInsumos();
  t('sem botão "Novo ingrediente"', !/Novo ingrediente/.test(doc.getElementById('content').innerHTML));
  t('a linha tem o olho de consulta, sem lixeira', !/excluirInsumo/.test(doc.getElementById('content').innerHTML));
  win.FT = win.FT || {}; win.FT.mostrar = false;
  win.telaFichaTecnica();
  const ft = doc.getElementById('content').innerHTML;
  t('a barra da ficha não tem Novo/Editar/Excluir', !/modalFicha\(\)/.test(ft) && !/excluirSel/.test(ft), ft.slice(0, 200));
  t('continua dando para abrir a Ficha Técnica (consulta)', /abrirComposicao/.test(ft));
  t('a árvore não oferece "Novo grupo"', !/modalCatFicha\(\)/.test(ft));

  grupo('A matriz continua com tudo');
  matriz();
  win.telaInsumos();
  t('a matriz vê "Novo ingrediente"', /Novo ingrediente/.test(doc.getElementById('content').innerHTML));
  win.telaFichaTecnica();
  t('a matriz vê Novo/Editar/Excluir na ficha', /modalFicha\(\)/.test(doc.getElementById('content').innerHTML));
  win.DB.insumos = [insumoFior()];
  win.modalInsumo('ins_fior');
  t('para a matriz o campo é editável', doc.getElementById('isN').readOnly === false);
  t('e o botão Salvar existe', /Salvar/.test(doc.getElementById('mdOv').querySelector('.mdF').innerHTML));
  doc.getElementById('isN').value = 'BASE FIOR DI LATTE DUBAI 3KG';
  win.salvarInsumo('ins_fior', 0);
  t('a matriz grava o novo nome', win.DB.insumos[0].nome === 'BASE FIOR DI LATTE DUBAI 3KG', win.DB.insumos[0].nome);

  grupo('A base do pedido cai pelo VÍNCULO, não pelo nome parecido');
  win.DB.insumos = [{ id: 'ins_fior', nome: 'BASE FIOR DI LATTE DUBAI', unidade: 'un', controlaEstoque: true, estoqueAtual: 0, sucursais: ['suc_sf'] },
                    { id: 'ins_homonimo', nome: 'BASE FIOR DI LATTE', unidade: 'un', controlaEstoque: true, estoqueAtual: 0, sucursais: ['suc_sf'] }];
  win.DB.fichas = [{ id: 'f_dubai', nome: 'BASE FIOR DI LATTE DUBAI', unidade: 'un', estocavel: false,
                     itens: [], rendimento: 1, categoriaId: 'fc1',
                     destinoId: 'ins_fior', destinoNome: 'BASE FIOR DI LATTE DUBAI' }];
  /* o catálogo tinha o nome antigo, mas o vínculo aponta para a ficha certa */
  const alvo = win.itemDaBaseNoEstoque({ baseNome: 'BASE FIOR DI LATTE', fichaRef: 'f_dubai' });
  t('o saldo vai para o item que a ficha ligada gera', alvo && alvo.id === 'ins_fior', alvo && alvo.id);
  t('não vai para o homônimo do nome antigo', !alvo || alvo.id !== 'ins_homonimo');
  /* sem vínculo, o nome continua valendo */
  const porNome = win.itemDaBaseNoEstoque({ baseNome: 'BASE FIOR DI LATTE', fichaRef: '' });
  t('sem ficha ligada, o nome ainda resolve', porNome && porNome.id === 'ins_homonimo', porNome && porNome.id);
  /* ficha estocável continua sendo o próprio destino */
  win.DB.fichas.push({ id: 'f_est', nome: 'BASE MORANGO', unidade: 'un', estocavel: true, itens: [], rendimento: 1 });
  const est = win.itemDaBaseNoEstoque({ baseNome: 'BASE MORANGO', fichaRef: 'f_est' });
  t('ficha estocável recebe nela mesma', est && est.id === 'f_est', est && est.id);

  grupo('Sem erro de console');
  t('nenhum erro de página', erros.length === 0, erros.join(' | '));

  console.log('\n────────────────────────────');
  console.log('  ' + R.ok + '/' + R.total + ' ok' + (R.falhou ? '  ·  ' + R.falhou + ' FALHA(S)' : ''));
  console.log('────────────────────────────\n');
  process.exit(R.falhou ? 1 : 0);
})();

/* ==========================================================
   JOIA — BAIXA MANUAL: OPERADOR REGISTRA, LOGIN PRINCIPAL LANÇA

   Rodar:  node testes/baixa-quem-lanca.js
   ou:     npm run test:bxquem   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 24/09/2026)
   "O registrar baixa, que ainda não sai do estoque, fica visível para os
   operadores. A parte de baixo, apenas o login principal de cada loja vai
   ter acesso e vai poder clicar em lançar no estoque."
   Também: na busca, a ficha vem antes do insumo de mesmo nome e mostra o
   que vai sair; insumo com saldo zerado não fica sem valor.
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
(async function () {
  console.log('\nCarregando o sistema para o guardião de quem lança a baixa…');
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.addEventListener('error', e => erros.push('window.onerror: ' + (e.error && e.error.message || e.message)));
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const win = dom.window, doc = win.document;
  if (!doc.getElementById('content')) { const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d); }
  win.salvar = () => {};
  win.lojaAtualId = () => 'suc_sf';
  win.DB.sucursais = [{ id: 'suc_matriz', nome: 'Matriz', matriz: true, ativa: true },
    { id: 'suc_sf', nome: 'Santa Fé', ativa: true, loginResp: 'santafe@jologelato.com.br' },
    { id: 'suc_jl', nome: 'Jales', ativa: true, loginResp: 'jolo@jologelato.com.br' }];
  const principal = { id: 'u1', login: 'santafe@jologelato.com.br', nome: 'Santa Fé', sucursais: ['suc_sf'], permissoes: { 'controle/baixa-manual': true } };
  const ana = { id: 'u2', login: 'ana@jologelato.com.br', nome: 'Ana', sucursais: ['suc_sf'], permissoes: { 'controle/baixa-manual': true } };
  const jales = { id: 'u3', login: 'jales@jologelato.com.br', nome: 'Jales', sucursais: ['suc_jl'], permissoes: {} };
  win.DB.usuarios = [principal, ana, jales];

  grupo('Quem pode lançar');
  t('o login principal da loja lança', win.podeLancarBaixa(principal) === true);
  t('a operadora NÃO lança', win.podeLancarBaixa(ana) === false);
  t('loja com um login só: ele lança (como é hoje)', win.podeLancarBaixa(jales) === true);
  t('acesso total lança', win.podeLancarBaixa({ login: 'x', tudo: true }) === true);
  const ana2 = Object.assign({}, ana, { permissoes: { 'controle/baixa-manual:lancar': true } });
  t('marcado no cadastro: a operadora passa a lançar', win.podeLancarBaixa(ana2) === true);
  const pr2 = Object.assign({}, principal, { permissoes: { 'controle/baixa-manual:lancar': false } });
  t('desmarcado no cadastro: nem o principal lança', win.podeLancarBaixa(pr2) === false);

  grupo('A tela da operadora');
  win.baseMov();
  win.DB.baixasPend = [
    { id: 'b1', sucursalRef: 'suc_sf', itemRef: 'i1', itemNome: 'Copinho M', itemTipo: 'insumo', qtd: 1, unidade: 'un', custo: 0.51, motivoNome: 'Perda', quem: 'Ana', registradoPor: 'ana@jologelato.com.br', data: '2026-09-24', situacao: 'pendente' },
    { id: 'b2', sucursalRef: 'suc_sf', itemRef: 'i2', itemNome: 'Saco de lixo', itemTipo: 'insumo', qtd: 1, unidade: 'un', custo: 0.42, motivoNome: 'Perda', quem: 'Bruno', registradoPor: 'bruno@jologelato.com.br', data: '2026-09-24', situacao: 'pendente' }];
  win.BX.filtro = 'pendente';
  win.usuarioLogado = () => ana;
  win.telaBaixaManual();
  let html = doc.getElementById('content').innerHTML;
  t('o formulário de registrar continua lá', !!doc.getElementById('bxItem'));
  t('ela vê o registro dela', /Copinho M/.test(html));
  t('e não vê o de outra pessoa', !/Saco de lixo/.test(html));
  t('não aparece o botão "Lançar no estoque"', !/lancarBaixasNoEstoque\(/.test(html));
  t('aparece o aviso de quem lança', /Quem lança no estoque é o login/.test(html));
  t('o registro diz "aguardando o gerente"', /aguardando o gerente/.test(html));
  let msg = ''; win.toast = m => { msg = m; };
  await win.lancarBaixasNoEstoque();
  t('mesmo chamando direto, a baixa não é lançada', win.DB.baixasPend.every(b => b.situacao === 'pendente') && /login principal/.test(msg), msg);

  grupo('A tela do login principal');
  win.usuarioLogado = () => principal;
  win.telaBaixaManual();
  html = doc.getElementById('content').innerHTML;
  t('vê os registros de todos', /Copinho M/.test(html) && /Saco de lixo/.test(html));
  t('com o botão "Lançar no estoque"', /lancarBaixasNoEstoque\(\)/.test(html));

  grupo('Na busca, a ficha vem antes e diz o que sai');
  win.DB.insumos = [
    { id: 'ins_ag', nome: 'Agua Com Gas', unidade: 'un', custo: 1.81, estoqueAtual: 41, controlaEstoque: true },
    { id: 'ins_cp', nome: 'Copo Descartavel', unidade: 'un', custo: 0.09, estoqueAtual: 400, controlaEstoque: true },
    { id: 'ins_cn', nome: 'Canudo', unidade: 'un', custo: 0, custoUltima: 0.04, estoqueAtual: -114, controlaEstoque: true }];
  win.DB.fichas = [{ id: 'fi_ag', nome: 'AGUA COM GAS', unidade: 'un', rendimento: 1, estoqueAtual: 0,
    itens: [{ insumoId: 'ins_ag', qtd: 1, unidade: 'un' }, { insumoId: 'ins_cp', qtd: 1, unidade: 'un' }, { insumoId: 'ins_cn', qtd: 1, unidade: 'un' }] }];
  const r = win.buscarItensBaixa('agua com');
  t('a ficha AGUA COM GAS vem antes do insumo', r.length >= 2 && r[0].tipo === 'ficha', r.map(x => x.tipo + ':' + x.nome).join(' | '));
  win.BX.item = null; win.BX.busca = 'agua com';
  const sug = win.sugestoesBaixaHTML();
  t('a sugestão mostra o que sai (Agua Com Gas, Copo, Canudo)', /sai: Agua Com Gas, Copo Descartavel, Canudo/.test(sug), sug.slice(0, 300));
  t('e o custo', /R\$ 1,94\/un/.test(sug), (sug.match(/R\$ [\d,]+\/un/g) || []).join(' '));
  const can = win.itensParaBaixa().find(x => x.id === 'ins_cn');
  t('Canudo com saldo negativo não fica sem valor (usa a última compra)', can && Math.abs(can.custo - 0.04) < 1e-6, can && can.custo);

  grupo('Cadastro da pessoa: a opção aparece');
  win.US = win.US || {}; win.US.sel = 'u2'; win.usrSel = () => ana;
  const perm = win.abaPermUsr(ana);
  t('abaixo de Baixa Manual existe "Lançar a baixa no estoque"', /Lançar a baixa no estoque/.test(perm));
  const box = doc.createElement('div'); box.innerHTML = perm; doc.body.appendChild(box);
  const ck = Array.from(box.querySelectorAll('input')).find(i => /togLancarBaixaUsr/.test(i.getAttribute('onchange') || ''));
  t('desmarcada para a operadora', ck && ck.checked === false);
  ck.checked = true; win.togLancarBaixaUsr(ck);
  t('marcar grava a permissão', ana.permissoes['controle/baixa-manual:lancar'] === true);
  t('e ela passa a lançar', win.podeLancarBaixa(ana) === true);

  grupo('Sem erro de página');
  t('nenhum erro', erros.length === 0, erros.slice(0, 5).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Operador registra, login principal lança');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

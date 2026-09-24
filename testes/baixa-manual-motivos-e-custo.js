/* ==========================================================
   JOIA — BAIXA MANUAL: O "+" EDITA E ACRESCENTA MOTIVOS, E O CUSTO
   RESPEITA A UNIDADE

   Rodar:  node testes/baixa-manual-motivos-e-custo.js
   ou:     npm run test:bxmotcusto   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 24/09/2026)

   1. "Quando a gente clica no maisinho, ter a opção de editar o nome
      deles e ter a opção de acrescentar mais." O + abria só o cadastro de
      um motivo novo.
   2. GELATO VENDA, 160 g, total R$ 3.807,57. O custo está gravado por kg
      (R$ 23,80) e a tela multiplicava 160 × 23,80, como se cada grama
      custasse um quilo. O certo é R$ 3,81.
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
const perto = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;
const erros = [];
async function carregar() {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.addEventListener('error', e => erros.push('window.onerror: ' + (e.error && e.error.message || e.message)));
    }
  });
  await new Promise(r => setTimeout(r, 900));
  return dom.window;
}

(async function () {
  console.log('\nCarregando o sistema para o guardião da Baixa Manual…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }
  const doc = win.document;
  if (!doc.getElementById('content')) { const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d); }
  win.salvar = () => {};
  win.baseMov();
  win.DB.motivosMov = win.DB.motivosMov.filter(m => m.sistema);
  win.DB.motivosMov.push({ id: 'mt_perda', nome: 'Perda / quebra', tipo: 'saida', ativo: true, sistema: false, sucursais: ['*'] });
  win.DB.motivosMov.push({ id: 'mt_bal', nome: 'Consumo Balcao', tipo: 'saida', ativo: true, sistema: false, sucursais: ['*'] });

  grupo('O + abre a lista de motivos');
  win.telaBaixaManual();
  const bt = doc.querySelector('.bxMotNovo');
  t('o + existe ao lado do motivo', !!bt);
  t('e chama a lista de motivos', bt && /gerirMotivosDaBaixa\(\)/.test(bt.getAttribute('onclick')));
  win.gerirMotivosDaBaixa();
  const nomes = () => Array.from(doc.querySelectorAll('#bxMgLista .bxMgNome'));
  t('a janela abriu', !!doc.getElementById('mdOv'));
  t('com os motivos da baixa num campo editável', nomes().length === 2 &&
    nomes().some(i => i.value === 'Consumo Balcao'), nomes().map(i => i.value).join('|'));

  grupo('Editar o nome');
  nomes().find(i => i.value === 'Consumo Balcao').value = 'Consumo Balcão';
  grupo('Acrescentar mais');
  win.acrescentarMotivoDaBaixa(); win.acrescentarMotivoDaBaixa();
  t('cada toque em Acrescentar abre uma linha nova', nomes().length === 4, nomes().length);
  const novos = nomes().filter(i => !i.getAttribute('data-id'));
  novos[0].value = 'Degustação'; novos[1].value = '';   /* linha em branco é ignorada */
  doc.getElementById('mdOk').click();
  await new Promise(r => setTimeout(r, 30));
  t('Salvar fecha a janela', !doc.getElementById('mdOv'));
  const bal = win.DB.motivosMov.find(m => m.id === 'mt_bal');
  t('o nome foi corrigido no mesmo motivo (histórico preservado)', bal && bal.nome === 'Consumo Balcão', bal && bal.nome);
  const deg = win.DB.motivosMov.find(m => m.nome === 'Degustação');
  t('o motivo novo entrou como Saída e ativo', deg && deg.tipo === 'saida' && deg.ativo === true && !deg.sistema);
  t('e nasce visível para quem criou', deg && Array.isArray(deg.sucursais) && deg.sucursais.length > 0);
  t('a linha deixada em branco não virou motivo', win.DB.motivosMov.filter(m => !m.nome).length === 0);
  t('o motivo novo já vem escolhido na baixa', win.BX.motivo === (deg || {}).id, win.BX.motivo);
  const opts = Array.from(doc.querySelectorAll('#bxMot option')).map(o => o.textContent);
  t('a lista da tela já mostra os dois nomes novos', opts.includes('Consumo Balcão') && opts.includes('Degustação'), opts.join('|'));

  grupo('Nome repetido ou vazio não passa');
  win.gerirMotivosDaBaixa();
  nomes()[0].value = 'degustação';
  doc.getElementById('mdOk').click();
  await new Promise(r => setTimeout(r, 30));
  t('nome repetido: a janela continua aberta', !!doc.getElementById('mdOv'));
  nomes()[0].value = '   ';
  doc.getElementById('mdOk').click();
  await new Promise(r => setTimeout(r, 30));
  t('nome vazio: a janela continua aberta', !!doc.getElementById('mdOv'));
  win.fecharModal();
  t('e nada foi gravado', win.DB.motivosMov.find(m => m.id === 'mt_perda').nome === 'Perda / quebra');

  grupo('O custo respeita a unidade (GELATO VENDA, 160 g)');
  const b = { id: 'bx1', itemRef: 'ins_gv', itemNome: 'GELATO VENDA', itemTipo: 'insumo',
    qtd: 160, unidade: 'g', custo: 23.7973, custoUnidade: 'kg', motivoRef: 'mt_bal', situacao: 'pendente' };
  t('custo de 1 g = R$ 0,0238', perto(win.custoUnBaixa(b), 0.0238), win.custoUnBaixa(b));
  t('160 g custam R$ 3,81 (não R$ 3.807,57)', perto(win.valorBaixa(b), 3.81), win.valorBaixa(b));
  const kg = Object.assign({}, b, { qtd: 1.5, unidade: 'kg' });
  t('em kg continua igual: 1,5 kg = R$ 35,70', perto(win.valorBaixa(kg), 35.70), win.valorBaixa(kg));
  /* registro antigo, sem a unidade do custo: usa a unidade do cadastro */
  win.DB.insumos = (win.DB.insumos || []).concat([{ id: 'ins_gv', nome: 'GELATO VENDA', unidade: 'kg', controlaEstoque: true, estoqueAtual: 10, custo: 23.7973 }]);
  const antigo = Object.assign({}, b); delete antigo.custoUnidade;
  t('registro antigo (sem unidade do custo) também dá R$ 3,81', perto(win.valorBaixa(antigo), 3.81), win.valorBaixa(antigo));

  grupo('A tela mostra o total certo');
  win.DB.baixasPend = [b];
  win.BX.filtro = 'pendente';
  win.telaBaixaManual();
  const html = doc.getElementById('content').innerHTML;
  t('o total da linha é R$ 3,81', /R\$ 3,81/.test(html));
  t('não aparece mais R$ 3.807', !/3\.807/.test(html));
  t('o custo unitário diz de qual unidade é (/kg)', /\/kg/.test(html));

  grupo('Sem erro de página');
  t('nenhum erro', erros.length === 0, erros.slice(0, 5).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Baixa Manual: motivos e custo');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

/* ==========================================================
   JOIA — A MOVIMENTAÇÃO DE ESTOQUE: POR DIA, E NÃO SE APAGA

   Rodar:  node testes/movimentacao-nao-se-apaga.js
   ou:     npm run test:movapaga   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 17/09/2026)
   A tela de Movimentações de Estoque é o RAZÃO do estoque: cada entrada,
   cada baixa, cada contagem. Ela tinha uma lixeira na linha (e outra na
   janela do lançamento) que apagava o registro e desfazia o saldo. Apagar
   dali some com a história e deixa o saldo sem explicação. Quem desfaz
   uma compra é a nota de entrada; quem desfaz uma contagem é outra
   contagem. Aqui só se consulta.

   E a lista abre POR DIA. Filtrando dois dias de Gelato Venda ela vinha
   com centenas de linhas abertas — os dez copos P, um por um, antes de
   qualquer pergunta. Agora é uma linha por dia, com o que entrou, o que
   saiu e o custo; o "+" abre o detalhe daquele dia.
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
  console.log('\nCarregando o sistema para o guardião da movimentação de estoque…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }
  const doc = win.document;
  win.toast = () => {}; win.salvar = () => {}; win.logNuvem = () => {}; win.rodape = () => {};

  grupo('A função de apagar não existe mais');
  t('excluirMov() foi embora (botão sem função e função sem botão são o defeito desta casa)',
    typeof win.excluirMov === 'undefined', typeof win.excluirMov);
  const html = fs.readFileSync(ARQ, 'utf8');
  t('e nenhum lugar do sistema chama excluirMov', html.indexOf('excluirMov') < 0);

  grupo('A lista abre por dia, fechada');
  win.DB.insumos = [{ id: 'ins_gv', nome: 'GELATO VENDA', unidade: 'kg', grupoId: 'g1',
    controlaEstoque: true, estoqueAtual: 10, custo: 23.53 }];
  win.DB.gruposIng = [{ id: 'g1', nome: 'Gelato Venda', sucursais: ['*'] }];
  win.DB.motivosMov = [{ id: 'mv_cont', nome: 'Contagem de estoque', tipo: 'ajuste' }];
  win.DB.movEst = [
    { id: 'mv_1', data: '2026-09-16', hora: '18:05', motivoId: 'mv_cont',
      identificacao: 'Contagem 16/09/2026', origem: 'contagem',
      linhas: [{ insumoId: 'ins_gv', nome: 'GELATO VENDA', unidade: 'kg', qtd: 2796.898,
        custo: 23.53, direcao: 'entrada', sistema: -2702.898, conferido: 94 }] },
    { id: 'mv_2', data: '2026-09-16', hora: '20:00', motivoId: 'mv_cont',
      identificacao: 'Pedido #744', origem: 'venda',
      linhas: [{ insumoId: 'ins_gv', nome: 'GELATO VENDA', unidade: 'g', qtd: 220,
        custo: 0.02, direcao: 'saida' }] }];
  win.MV = win.MV || {};
  win.MV.de = '2026-09-01'; win.MV.ate = '2026-09-30';
  win.telaMovimentacao();
  const tela = doc.getElementById('content').innerHTML;
  t('tem uma linha do dia 16/09/2026', /mvDia/.test(tela) && /16\/09\/2026/.test(tela));
  t('a linha do dia diz o dia da semana e quantas movimentações',
    /quarta · 2 movimentações/.test(tela), (tela.match(/mvDiaS[^<]*>([^<]*)/) || [])[1]);
  t('e mostra o que entrou e o que saiu, cada um na sua unidade',
    /2796,898 kg/.test(tela) && /220 g/.test(tela),
    (tela.match(/vg">[^<]*/) || [])[0] + ' | ' + (tela.match(/vr">[^<]*/) || [])[0]);
  t('o detalhe começa FECHADO: nada de item a item de cara',
    tela.indexOf('Pedido #744') < 0 && tela.indexOf('Contagem 16/09/2026') < 0);
  t('o rodapé conta os dias do período', /1 dia · 2 movimentações/.test(tela),
    (tela.match(/Total do período[^<]*/) || [])[0]);

  grupo('O "+" abre o detalhe daquele dia — e só dele');
  win.DB.movEst.push({ id: 'mv_3', data: '2026-09-15', hora: '10:00', motivoId: 'mv_cont',
    identificacao: 'Pedido #700', origem: 'venda',
    linhas: [{ insumoId: 'ins_gv', nome: 'GELATO VENDA', unidade: 'g', qtd: 100,
      custo: 0.02, direcao: 'saida' }] });
  win.telaMovimentacao();
  win.toggleDiaMov('2026-09-16');
  const aberto = doc.getElementById('mvCorpo').innerHTML;
  t('o dia 16 abriu com os lançamentos dele', /Pedido #744/.test(aberto) && /Contagem 16\/09\/2026/.test(aberto));
  t('o dia 15 continua fechado', aberto.indexOf('Pedido #700') < 0);
  t('a linha do detalhe mostra a hora, não a data de novo', /mvHora">20:00/.test(aberto),
    (aberto.match(/mvHora"[^<]*>[^<]*/) || [])[0]);
  t('continua dando para VER o lançamento', /verMovimento/.test(aberto));
  t('nenhuma lixeira na linha, nem na contagem gerada pelo sistema', aberto.indexOf('excluir') < 0);
  win.toggleDiaMov('2026-09-16');
  t('clicando de novo, fecha', doc.getElementById('mvCorpo').innerHTML.indexOf('Pedido #744') < 0);

  grupo('A janela do lançamento também não apaga');
  win.verMovimento('mv_1');
  const jan = (doc.getElementById('mdOv') || {}).innerHTML || '';
  t('a janela abriu', !!jan);
  t('o rodapé tem só o Fechar', /Fechar/.test(jan) && !/Excluir lançamento/.test(jan));

  grupo('Sem erro de console');
  t('nenhum erro de página', erros.length === 0, erros.join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · A movimentação de estoque não se apaga');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

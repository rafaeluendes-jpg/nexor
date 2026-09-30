/* ==========================================================
   JOIA — TRANSFERÊNCIA: VER OS ITENS, EXCLUIR DEVOLVENDO O ESTOQUE E
   APAGANDO O FINANCEIRO; RELATÓRIO NA MOVIMENTAÇÃO (V394, 30/09/2026)

   Rodar:  node testes/transferencia-ver-e-excluir.js
   ou:     npm run test:transfexcluir   (entra na bateria e no portão)

   Rafael: "ter a opção de clicar e ver qual item está em transferência e
   opção de excluir e voltar para o estoque ... e também apagar do
   lançamento financeiro, aparecer as perguntas ... e lá em movimentação
   de estoque ter o item de relatório transferência de mercadoria".
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const R = { total: 0, ok: 0 };
function t(n, c, d) { R.total++; if (c) { R.ok++; console.log('   ok   ' + n); } else console.log('   FALHA ' + n + (d !== undefined ? '  → ' + d : '')); }
(async function () {
  const vc = new VirtualConsole(); const erros = [];
  vc.on('jsdomError', e => erros.push(e && e.message));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(w) { w.fetch = () => Promise.reject(new Error('offline')); w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
      w.scrollTo = () => {}; w.alert = () => {}; w.confirm = () => true; w.crypto = w.crypto || {};
      if (!w.crypto.subtle) w.crypto.subtle = { digest: async () => new ArrayBuffer(32) }; } });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window, doc = w.document;
  w.salvar = () => {}; w.sincronizar = () => {}; w.toast = () => {};
  w.DB.sucursais = [{ id: 'suc_sf', nome: 'Santa Fé', ativa: true }, { id: 'suc_ja', nome: 'Jales', ativa: true }];
  w.lojaAtualId = () => 'suc_sf'; w.ehMatriz = () => false;
  w.DB.movEst = []; w.DB.lancFin = [];
  const aplicados = []; w.aplicarMovimento = (m) => { aplicados.push(m); };
  const itens = [{ id: 'ins_mar', nome: 'Maracujá Fruta', unidade: 'kg', qtd: 3.456, custo: 34.33 }, { id: 'ins_bol', nome: 'Bolacha Champanhe', unidade: 'un', qtd: 21, custo: 0.71 }];
  w.DB.transf = [{ id: 'tr1', numero: 1, origemSuc: 'suc_sf', destinoSuc: 'suc_ja', situacao: 'enviada', itens: JSON.parse(JSON.stringify(itens)), valorTotal: 195.54, data: '2026-09-27' }];
  w.DB.lancFin = [{ id: 'lf_t1', tipo: 'despesa', descricao: 'Transferência #1 para Jales', valor: 195.54 },
                  { id: 'lf_outro', tipo: 'transferencia', descricao: 'Transferência #1 entre contas', valor: 50 }];
  const declarados = []; const decl = w.declararExclusao; w.declararExclusao = (c, id) => { declarados.push(c + ':' + id); decl(c, id); };

  console.log('\n── 1. Clicar na linha mostra os itens');
  w.TR.aba = 'historico'; w.telaTransferencia();
  const linha = doc.querySelector('tr.trLinha');
  t('a linha do histórico é clicável', !!linha && /verTransferencia\('tr1'\)/.test(linha.getAttribute('onclick')));
  linha.click();
  const md = doc.getElementById('mdOv');
  t('abre a janela com os itens da transferência', !!md && /Maracujá Fruta/.test(md.textContent) && /Bolacha Champanhe/.test(md.textContent), md && md.textContent.slice(0, 200));
  t('mostra o trajeto e o valor', /Santa Fé → Jales/.test(md.textContent) && /195,54/.test(md.textContent));
  t('diz que há lançamento no financeiro ligado', /Ligada a 1 lançamento/.test(md.textContent));
  t('o botão é "Excluir transferência"', /Excluir transferência/.test(doc.getElementById('mdOk').textContent));
  w.fecharModal();

  console.log('\n── 2. Excluir: voltar para o estoque? apagar do financeiro? confirmar');
  const perguntas = []; let respostas = [true, true, true];
  w.confirmar = async (op) => { perguntas.push(op.titulo); return respostas.shift(); };
  await w.excluirTransferencia('tr1');
  t('pergunta, nesta ordem: estoque, financeiro, confirmação', JSON.stringify(perguntas) ===
    JSON.stringify(['Voltar os itens para o estoque?', 'Apagar do financeiro?', 'Excluir a transferência #1?']), JSON.stringify(perguntas));
  const volta = aplicados.find(m => m.sucursalId === 'suc_sf');
  t('o estoque volta para a origem (Santa Fé), item por item', !!volta && volta.linhas.length === 2 &&
    volta.linhas.every(l => l.direcao === 'entrada') && volta.linhas[0].qtd === 3.456, JSON.stringify(volta));
  t('o movimento diz de onde veio', volta && /Estorno da transferência #1 — excluída/.test(volta.identificacao));
  t('a transferência a caminho não mexe no destino', !aplicados.some(m => m.sucursalId === 'suc_ja'));
  t('o lançamento dela sai do financeiro', !w.DB.lancFin.some(l => l.id === 'lf_t1') && declarados.indexOf('lancFin:lf_t1') >= 0);
  t('transferência entre CONTAS com o mesmo número não é tocada', w.DB.lancFin.some(l => l.id === 'lf_outro'));
  t('a transferência some e a exclusão vai para a nuvem', !w.DB.transf.length && declarados.indexOf('transf:tr1') >= 0);

  console.log('\n── 3. "Não" para o estoque: nada volta');
  aplicados.length = 0; perguntas.length = 0;
  w.DB.transf = [{ id: 'tr2', numero: 2, origemSuc: 'suc_sf', destinoSuc: 'suc_ja', situacao: 'enviada', itens: JSON.parse(JSON.stringify(itens)), valorTotal: 10, data: '2026-09-28' }];
  respostas = [false, true];
  await w.excluirTransferencia('tr2');
  t('sem lançamento ligado, não pergunta do financeiro', JSON.stringify(perguntas) === JSON.stringify(['Voltar os itens para o estoque?', 'Excluir a transferência #2?']), JSON.stringify(perguntas));
  t('e o estoque fica como está', aplicados.length === 0 && !w.DB.transf.length);

  console.log('\n── 4. Recebida: só a matriz; volta o que chegou');
  w.DB.transf = [{ id: 'tr3', numero: 3, origemSuc: 'suc_sf', destinoSuc: 'suc_ja', situacao: 'recebida',
    itens: [{ id: 'ins_mar', nome: 'Maracujá Fruta', unidade: 'kg', qtd: 3, qtdRecebida: 2.5, custo: 34 }], valorTotal: 102, data: '2026-09-28' }];
  t('a unidade não exclui transferência já recebida', w.podeExcluirTransf(w.DB.transf[0]) === false);
  w.ehMatriz = () => true; aplicados.length = 0; respostas = [true, true];
  await w.excluirTransferencia('tr3');
  const saiDestino = aplicados.find(m => m.sucursalId === 'suc_ja'), voltaOrigem = aplicados.find(m => m.sucursalId === 'suc_sf');
  t('a matriz exclui: sai do destino o que chegou (2,5 kg)', !!saiDestino && saiDestino.linhas[0].direcao === 'saida' && saiDestino.linhas[0].qtd === 2.5);
  t('e volta para a origem o mesmo (2,5 kg)', !!voltaOrigem && voltaOrigem.linhas[0].direcao === 'entrada' && voltaOrigem.linhas[0].qtd === 2.5);

  console.log('\n── 5. Relatório de transferência na Movimentação de estoque');
  w.MV = { de: '2026-09-01', ate: '2026-09-30', insumoId: '', grupo: '', motivoId: '__transf', busca: '', dias: {} };
  t('"Transferência de mercadoria" junta enviada, recebida e estorno',
    w.movCasaMotivo({ motivoId: 'mv_transf_saida' }) && w.movCasaMotivo({ motivoId: 'mv_transf_entrada' }) &&
    w.movCasaMotivo({ motivoId: 'x', origem: 'transferencia' }) && !w.movCasaMotivo({ motivoId: 'mv_nota', origem: 'nota' }));
  w.DB.movEst = [{ id: 'm1', data: '2026-09-27', hora: '10:00', motivoId: 'mv_transf_saida', origem: 'transferencia', identificacao: 'Transferência #1 → Jales',
    linhas: [{ insumoId: 'ins_mar', nome: 'Maracujá Fruta', unidade: 'kg', qtd: 3.456, custo: 34, direcao: 'saida' }] },
    { id: 'm2', data: '2026-09-27', hora: '11:00', motivoId: 'mv_nota', origem: 'nota', linhas: [{ insumoId: 'ins_mar', nome: 'Maracujá Fruta', unidade: 'kg', qtd: 5, custo: 30, direcao: 'entrada' }] }];
  w.telaMovimentacao();
  const sel = [...doc.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === '__transf'));
  t('a opção aparece no filtro "Movimentação"', !!sel && [...sel.options].find(o => o.value === '__transf').textContent === 'Transferência de mercadoria');
  t('e o relatório mostra só a transferência (1 movimentação, 3,456 kg; a nota de 5 kg fica de fora)',
    /1 movimentação/.test(doc.querySelector('.mvTabW').textContent) && /3,456 kg/.test(doc.querySelector('.mvTabW').textContent) &&
    !/5,000 kg|5 kg/.test(doc.querySelector('.mvTabW').textContent),
    doc.querySelector('.mvTabW') && doc.querySelector('.mvTabW').textContent.slice(0, 200));

  t('nenhum erro de runtime', erros.length === 0, erros.join(' | '));
  console.log('\n' + R.ok + ' de ' + R.total + ' testes passaram');
  try { w.close(); } catch (e) {}
  process.exit(R.ok === R.total ? 0 : 1);
})();

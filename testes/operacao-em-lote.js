/* ==========================================================
   OPERAÇÃO EM LOTE NO FINANCEIRO (05/10/2026)

   Rodar:  node testes/operacao-em-lote.js
   ou:     npm run test:operacaolote   (entra na bateria e no portão)

   Rafael: "Eu preciso criar uma operação em lote, com número do lote e a
   data em que está sendo feita" — e: "isso precisa funcionar, não pode
   quebrar nada, precisa estar 100%."

   Prende, pela tela de verdade:
     1. só entra o que está em aberto, do mesmo lado e da mesma unidade;
     2. o número nasce com a data de hoje e a sequência do dia, e nunca
        se repete — nem depois de desfeito;
     3. confirmar paga todos na mesma data, conta e forma, com juros por
        item, e guarda o "antes" de cada um;
     4. sem categoria não paga — a mesma trava do pagamento comum;
     5. um lançamento só sai do lote desfazendo o lote (pagar de novo,
        desmarcar, editar e excluir ficam travados);
     6. a lista mostra a etiqueta e filtra o lote inteiro;
     7. a conciliação mostra o lote como UMA linha, e marcar o lote marca
        todos; lote conciliado não se desfaz;
     8. desfazer devolve cada lançamento exatamente como estava, com motivo,
        quem e quando;
     9. a nuvem: fora de lote nada muda no envio dos lançamentos; o lote
        sobe e desce; o banco tem a tabela com as regras de acesso.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const MIG = path.join(__dirname, '..', 'supabase', 'migrations', '20261005_operacao_em_lote.sql');
const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const perto = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;
const esp = ms => new Promise(r => setTimeout(r, ms));
const erros = [];
(async function () {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const src = fs.readFileSync(ARQ, 'utf8');
  const dom = new JSDOM(src, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.addEventListener('error', e => erros.push('window.onerror: ' + (e.error && e.error.message || e.message)));
    }
  });
  await esp(900);
  const w = dom.window, doc = w.document, $ = id => doc.getElementById(id);
  if (!$('content')) { const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d); }
  let avisos = [];
  w.toast = m => avisos.push(String(m));
  w.salvar = () => {};
  w.lojaAtualId = () => 'suc_sf';
  w.ehSucMatriz = () => false;
  w.usuarioLogado = () => ({ id: 'u1', nome: 'Bia', login: 'bia@jologelato.com.br', tudo: true });
  const HOJE = w.hojeISO(), PRE = HOJE.replace(/-/g, '');
  w.baseLanc();
  w.DB.contas = [{ id: 'ct_itau', nome: 'Itaú — conta corrente', banco: 'itau', saldoInicial: 10000 },
    { id: 'ct_caixa', nome: 'Caixa da loja', fixa: 'caixa', saldoInicial: 0 }];
  w.DB.formasPag = [{ id: 'fp_bol', nome: 'Boleto', tipo: 'boleto', ativo: true }, { id: 'fp_pix', nome: 'Pix', tipo: 'pix', ativo: true }];
  const L = (id, venc, forn, v, extra) => Object.assign({ id: id, tipo: 'despesa', contaId: '', metodoId: '', descricao: 'Compra ' + id,
    fornecedor: forn, documento: 'NF ' + id, categoriaTxt: 'Matéria-prima', valor: v, emissao: '2026-09-25', vencimento: venc,
    pago: false, sucursalRef: 'suc_sf' }, extra || {});
  w.DB.lancFin = [L('lf1', '2026-10-06', 'Laticínios', 1840), L('lf2', '2026-10-06', 'Embalagens', 612.4),
    L('lf3', '2026-10-07', 'Elektro', 938.77), L('lf4', '2026-11-20', 'Cascões', 734.2),
    L('lf5', '2026-10-08', 'Contador', 650), L('lr1', '2026-10-06', 'Buffet', 480, { tipo: 'receita', categoriaTxt: 'Encomendas' }),
    L('lpg', '2026-10-06', 'Gás', 145, { pago: true, contaId: 'ct_itau', metodoId: 'fp_pix', pagamento: '2026-10-04' }),
    L('lsc', '2026-10-06', 'Sem categoria', 99, { categoriaTxt: '', categoriaId: '' })];
  w.DB.lotesFin = [];
  const lanc = id => w.DB.lancFin.find(x => x.id === id);
  function tela(sel) {
    w.LF.aba = ''; w.LF.lote = ''; w.LF.de = '2026-10-01'; w.LF.ate = '2026-10-31'; w.LF.tipo = 'todas'; w.LF.sit = 'todas';
    w.LF.base = 'vencimento';
    w.telaLancamentos();
    doc.querySelectorAll('.chkLF').forEach(c => { c.checked = sel.indexOf(c.getAttribute('data-id')) >= 0; });
    w.atualizaSelecao();
  }

  grupo('1. O botão e quem entra no lote');
  tela(['lf1', 'lf2']);
  t('marcar mostra o botão Operação em lote', /Operação em lote/.test(($('selInfo') || {}).innerHTML || ''));
  t('e o "Marcar pago" continua lá', /mudarPago\(true\)/.test(($('selInfo') || {}).innerHTML || ''));
  t('o topo tem o botão Lotes', /abrirLotes\(\)/.test(doc.querySelector('.lfTopBtns').innerHTML));
  tela(['lf1']); avisos = []; w.abrirLote();
  t('um só não é lote', !$('mdOv') && /pelo menos dois/.test(avisos.join('|')));
  tela(['lf1', 'lr1']); avisos = []; w.abrirLote();
  t('pagar e receber juntos não', !$('mdOv') && /só de contas a pagar ou só de contas a receber/.test(avisos.join('|')));
  tela(['lf1', 'lpg']); avisos = []; w.abrirLote();
  t('o que já está pago fica de fora (e sobra um só: não abre)', !$('mdOv') && /em aberto/.test(avisos.join('|')));
  /* na matriz, que enxerga todas as unidades */
  lanc('lf5').sucursalRef = 'suc_jl'; w.ehSucMatriz = () => true;
  tela(['lf1', 'lf5']); avisos = []; w.abrirLote();
  t('unidades diferentes não', !$('mdOv') && /uma unidade só/.test(avisos.join('|')), avisos.join('|'));
  lanc('lf5').sucursalRef = 'suc_sf'; w.ehSucMatriz = () => false;

  grupo('2. A janela do lote');
  tela(['lf1', 'lf2', 'lf3', 'lpg']); avisos = []; w.abrirLote(); await esp(20);
  t('abre a janela', !!$('mdOv') && /Nova operação em lote/.test($('mdOv').innerHTML));
  t('o número nasce com a data de hoje: ' + PRE + '-01', ($('ltNum') || {}).textContent === PRE + '-01', ($('ltNum') || {}).textContent);
  t('avisa quem ficou de fora', /1 dos selecionados ficaram de fora/.test($('mdOv').innerHTML));
  t('três lançamentos na lista', $('mdOv').querySelectorAll('.ltJ').length === 3);
  $('ltC').value = 'ct_itau'; $('ltM').value = 'fp_bol'; $('ltD').value = '2026-10-05'; $('ltO').value = 'Fornecedores da semana';
  doc.querySelector('.ltJ[data-id="lf3"]').value = '12.5'; w.recalcLote();
  t('o total soma os juros', $('ltTot').textContent === 'R$ ' + w.money(1840 + 612.4 + 938.77 + 12.5), $('ltTot').textContent);
  t('e mostra como fica o saldo da conta (9.855,00 − 3.403,67)', /O saldo passa de R\$ 9\.855,00 para <b>R\$ 6\.451,33<\/b>/.test($('ltAviso').innerHTML), $('ltAviso').innerHTML);
  $('mdOk').click(); await esp(30);
  const lt = w.DB.lotesFin[0] || {};
  t('o lote foi gravado com o número, a conta, a forma, a data e quem fez',
    lt.numero === PRE + '-01' && lt.contaId === 'ct_itau' && lt.metodoId === 'fp_bol' && lt.data === '2026-10-05' &&
    lt.criadoPor === 'Bia' && lt.obs === 'Fornecedores da semana' && lt.tipo === 'pagar' && lt.sucursalId === 'suc_sf', JSON.stringify(lt));
  t('com 3 itens e o total certo', lt.qtd === 3 && perto(lt.total, 1840 + 612.4 + 938.77 + 12.5), lt.total);
  const pagos = ['lf1', 'lf2', 'lf3'].map(lanc);
  t('os três ficaram pagos na mesma data, conta e forma',
    pagos.every(l => l.pago && l.pagamento === '2026-10-05' && l.contaId === 'ct_itau' && l.metodoId === 'fp_bol'));
  t('e marcados com o lote', pagos.every(l => l.loteRef === lt.id && l.loteNum === lt.numero));
  t('o juros entrou só no que tinha juros', perto(lanc('lf3').valor, 951.27) && perto(lanc('lf3').valorOriginal, 938.77) &&
    perto(lanc('lf3').juros, 12.5) && lanc('lf1').valorOriginal === undefined && perto(lanc('lf1').valor, 1840));
  t('o "antes" de cada um ficou guardado', (lt.itens || []).every(it => it.antes && it.antes.pago === false && it.antes.pagamento === ''));
  t('o que estava pago fora do lote não foi tocado', lanc('lpg').loteRef === undefined && lanc('lpg').pagamento === '2026-10-04');

  grupo('3. Sem categoria não paga');
  tela(['lf5', 'lsc']); avisos = []; w.abrirLote(); await esp(20);
  $('ltC').value = 'ct_itau'; $('ltM').value = 'fp_bol'; $('mdOk').click(); await esp(20);
  t('recusa e diz qual', !!$('mdOv') && /sem categoria/.test(avisos.join('|')) && !lanc('lf5').pago && !lanc('lsc').pago);
  w.fecharModal();

  grupo('4. Um lançamento só sai do lote desfazendo o lote');
  avisos = []; w.togglePago('lf1');
  t('o joinha não desmarca', lanc('lf1').pago === true && /desfaça o lote/.test(avisos.join('|')));
  tela(['lf1', 'lf2']); avisos = []; w.mudarPago(false);
  t('o "Desmarcar" em massa pula os do lote', lanc('lf1').pago && lanc('lf2').pago && /de lote ficaram como estão/.test(avisos.join('|')));
  avisos = []; w.modalPagamento(['lf1']);
  t('pagar de novo não abre', !$('mdOv') && /desfaça o lote/.test(avisos.join('|')));
  avisos = []; await w.excluirLanc('lf2');
  t('excluir não exclui', !!lanc('lf2') && /desfaça o lote/.test(avisos.join('|')));
  avisos = []; w.modalLanc('lf3');
  t('editar não abre', !$('mdOv') && /desfaça o lote/.test(avisos.join('|')));

  grupo('5. A lista');
  tela([]);
  const linha = doc.querySelector('.chkLF[data-id="lf1"]').closest('tr');
  t('a linha mostra a etiqueta do lote', new RegExp('Lote ' + lt.numero).test(linha.innerHTML));
  t('o filtro Lote existe', /<label>Lote<\/label>/.test(doc.querySelector('.lfFiltros2').innerHTML));
  w.LF.lote = lt.id; w.LF.de = '2026-12-01'; w.LF.ate = '2026-12-31'; w.telaLancamentos();
  const ids = [...doc.querySelectorAll('.chkLF')].map(c => c.getAttribute('data-id')).sort().join(',');
  t('filtrar o lote mostra o lote inteiro, mesmo fora do período', ids === 'lf1,lf2,lf3', ids);
  w.limparLF();
  t('Limpar tira o filtro do lote', !w.LF.lote);

  grupo('6. A tela dos lotes');
  w.abrirLotes();
  t('abre Operações em lote', /Operações em lote/.test($('content').innerHTML) && new RegExp(lt.numero).test($('content').innerHTML));
  t('a situação é "Pago — falta conciliar"', /Pago — falta conciliar/.test($('content').innerHTML));
  w.telaLancamentos();
  t('enquanto estiver nos lotes, redesenhar não tira a pessoa de lá', /Operações em lote/.test($('content').innerHTML));
  w.voltarDosLotes();
  t('Voltar aos lançamentos volta', /Lançamentos Financeiros/.test($('content').innerHTML));
  w.verLote(lt.id); await esp(10);
  t('o lote abre com Imprimir, Conciliar e Desfazer', /imprimirLote/.test($('mdOv').innerHTML) &&
    /conciliarLote/.test($('mdOv').innerHTML) && /desfazerLote/.test($('mdOv').innerHTML));
  w.fecharModal();
  w.imprimirLote(lt.id);
  t('o comprovante sai com o número e o total', new RegExp('Lote ' + lt.numero).test(($('viaImp') || {}).innerHTML || '') &&
    /Total R\$ 3\.403,67/.test(($('viaImp') || {}).innerHTML || ''), (($('viaImp') || {}).innerHTML || '').slice(-120));

  grupo('7. A conciliação');
  w.CB.conta = 'ct_itau'; w.CB.de = '2026-10-01'; w.CB.ate = '2026-10-31'; w.CB.marcadas = {}; w.telaConciliacao();
  const cab = doc.querySelector('.cbTab tr.ltLinhaCB');
  t('o lote aparece como uma linha só, com o total', !!cab && new RegExp('Lote ' + lt.numero).test(cab.innerHTML) &&
    /R\$ 3\.403,67/.test(cab.innerHTML), cab && cab.textContent.slice(0, 120));
  t('uma linha de lote, e os três lançamentos embaixo dela', doc.querySelectorAll('.cbTab tr.ltLinhaCB').length === 1 &&
    doc.querySelectorAll('.cbTab tr.ltFilho').length === 3);
  w.marcarLoteCB(lt.id, true);
  t('marcar o lote marca os três', ['lf1', 'lf2', 'lf3'].every(id => w.CB.marcadas[id] === true) && w.CB.marcadas.lpg === undefined);
  w.conciliarSelecionadas();
  t('e o Confirmar conciliação concilia os três', pagos.every(l => l.conciliado));
  t('o lote passa a Conciliado', w.situacaoDoLote(lt) === 'conc');
  w.verLote(lt.id); await esp(10);
  t('lote conciliado não oferece Desfazer', !/desfazerLote/.test($('mdOv').innerHTML) && /não se desfaz/.test($('mdOv').innerHTML));
  w.fecharModal();
  pagos.forEach(l => { l.conciliado = false; l.dataConc = ''; });

  grupo('8. Conciliar o lote inteiro pelo lote');
  w.conciliarLote(lt.id);
  t('concilia os três de uma vez', pagos.every(l => l.conciliado) && w.situacaoDoLote(lt) === 'conc');
  pagos.forEach(l => { l.conciliado = false; l.dataConc = ''; });

  grupo('9. Desfazer o lote');
  await w.desfazerLote(lt.id); await esp(10);
  t('pede o motivo', /Motivo/.test($('mdOv').innerHTML));
  $('ltMot').value = ''; avisos = []; $('mdOk').click(); await esp(10);
  t('sem motivo não desfaz', lt.desfeito === false && /motivo/.test(avisos.join('|')));
  $('ltMot').value = 'saiu da conta errada'; $('mdOk').click(); await esp(20);
  t('cada lançamento voltou exatamente como estava', pagos.every(l => l.pago === false && l.pagamento === '' &&
    l.contaId === '' && l.metodoId === '' && l.loteRef === null && l.loteNum === null));
  t('o valor voltou sem os juros', perto(lanc('lf3').valor, 938.77) && lanc('lf3').valorOriginal === undefined && lanc('lf3').juros === 0);
  t('o lote ficou Desfeito, com motivo, quem e quando', lt.desfeito === true && lt.motivo === 'saiu da conta errada' &&
    lt.desfeitoPor === 'Bia' && !!lt.desfeitoEm && w.situacaoDoLote(lt) === 'desf');
  t('o lote desfeito continua guardado', w.DB.lotesFin.length === 1);
  tela(['lf1', 'lf2']); w.abrirLote(); await esp(10);
  t('o número desfeito não volta a ser usado: o próximo é -02', ($('ltNum') || {}).textContent === PRE + '-02', ($('ltNum') || {}).textContent);
  w.fecharModal();

  grupo('10. A nuvem');
  const MAPA = w.eval('MAPA');
  const EL = MAPA.find(e => e.col === 'lancFin'), ELT = MAPA.find(e => e.col === 'lotesFin');
  const fora = EL.campos(lanc('lf5'));
  t('fora de lote, o lançamento sobe exatamente como antes (sem campo novo)',
    !('lote_ref' in JSON.parse(JSON.stringify(fora))) && !('lote_numero' in JSON.parse(JSON.stringify(fora))));
  const noL = EL.campos(Object.assign({}, lanc('lf5'), { loteRef: 'lt_x', loteNum: PRE + '-09' }));
  t('no lote, sobe com o lote', noL.lote_ref === 'lt_x' && noL.lote_numero === PRE + '-09');
  t('desfeito, sobe nulo — é o que limpa na nuvem', JSON.stringify(EL.campos(lanc('lf1'))).indexOf('"lote_ref":null') >= 0);
  const cl = ELT && ELT.campos(lt);
  t('o lote tem a sua tabela no envio', !!ELT && ELT.tab === 'lotes_financeiros' && cl.numero === lt.numero &&
    cl.desfeito === true && cl.motivo === 'saiu da conta errada' && Array.isArray(cl.itens) && cl.sucursal_id === 'suc_sf');
  t('o lote nunca é apagado pela sincronização', !ELT.espelha);
  t('e desce da nuvem', /baixarTab\('lotes_financeiros'/.test(src) && /DB\.lotesFin=volta\(ltf,/.test(src) &&
    /loteRef:x\.lote_ref\|\|undefined,loteNum:x\.lote_numero\|\|undefined/.test(src));
  const sql = fs.existsSync(MIG) ? fs.readFileSync(MIG, 'utf8') : '';
  t('no banco: tabela com chave da loja, acesso do financeiro e sem apagar',
    /create table if not exists public\.lotes_financeiros/.test(sql) && /unique \(loja_id, ref_local\)/.test(sql) &&
    /enable row level security/.test(sql) && /posso\('financeira\/lancamentos-financeiros'\)/.test(sql) &&
    !/for delete/.test(sql) && /tg_auditar/.test(sql) && /bump_loja_versao/.test(sql) &&
    /add column if not exists lote_ref text/.test(sql));

  grupo('Balanço');
  t('nenhum erro de runtime', erros.length === 0, erros.slice(0, 5).join(' | '));
  console.log('\n' + R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : '') + '\n');
  try { w.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

/* ==========================================================
   JOIA — INDICADORES DO MÊS (29/09/2026)

   Rodar:  node testes/indicadores-mes.js
   ou:     npm run test:indicadores   (entra na bateria e no portão)

   Rafael: o fechamento do mês da planilha de Jales, montado sozinho, em
   tempo real, com filtros; funcionários e energia num campo com botão
   Atualizar, e a receita por funcionário calculada na hora.

   Este guardião monta uma loja de teste com números conhecidos e confere
   cada indicador contra a conta feita à mão:
     1. vendas, ticket, clientes, descontos, cancelamentos, média por dia;
     2. mix: Cascão/Copo/Potes somam em Gelato; taxa de entrega fica fora;
     3. consumo (CMV) sem a venda cancelada; perdas = contagem + baixa +
        perda de produção + perda de venda cancelada; transferência NÃO é
        perda; custo médio do gelato produzido;
     4. funcionários e energia: Atualizar grava por unidade e mês, sobe
        para a nuvem com a unidade, e a receita por funcionário aparece;
        sair com número digitado e não atualizado pergunta antes;
     5. o painel está no menu de Relatórios e abre;
     6. o mês em andamento percebe venda nova (tempo real).
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
const perto = (a, b) => Math.abs(a - b) < 0.005;

(async function () {
  console.log('\nCarregando o sistema para o guardião dos Indicadores do Mês…');
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
  await new Promise(r => setTimeout(r, 900));
  const win = dom.window, doc = win.document;
  win.NUVEM.ligada = false;
  const suc = win.lojaAtualId();
  const mes = win.hojeISO().slice(0, 7);
  const d1 = mes + '-01', d2 = mes + '-02';
  const ant = win.imMesMais(mes, -1);

  win.DB.categorias = [
    { id: 'c_casc', nome: 'Cascão' }, { id: 'c_copo', nome: 'Copo' }, { id: 'c_pote', nome: 'Potes Gelato' },
    { id: 'c_sob', nome: 'Sobremesas' }, { id: 'c_beb', nome: 'Bebidas' }, { id: 'c_tx', nome: 'Taxa de Entrega' }];
  win.DB.produtos = [
    { id: 'p_casc', nome: 'Cascão 1 Bola', categoriaId: 'c_casc' }, { id: 'p_copo', nome: 'Copo M', categoriaId: 'c_copo' },
    { id: 'p_kg', nome: 'Gelato 1 Kg', categoriaId: 'c_pote' }, { id: 'p_brow', nome: 'Brownie', categoriaId: 'c_sob' },
    { id: 'p_coca', nome: 'Coca Lata', categoriaId: 'c_beb' }, { id: 'p_tx', nome: 'Taxa de Entrega', categoriaId: 'c_tx' }];
  const ped = (id, dia, itens, extra) => Object.assign({ id, numero: id, data: dia + 'T15:00:00-03:00', fase: 'finalizado',
    sucursalId: suc, tipo: 'loja', desconto: 0, itens, total: itens.reduce((a, i) => a + i.total, 0) }, extra || {});
  win.DB.pedidos = [
    ped('v1', d1, [{ produtoId: 'p_casc', nome: 'Cascão 1 Bola', total: 18 }, { produtoId: 'p_coca', nome: 'Coca Lata', total: 7 }]),
    ped('v2', d1, [{ produtoId: 'p_kg', nome: 'Gelato 1 Kg', total: 90 }, { produtoId: 'p_brow', nome: 'Brownie', total: 20 }], { desconto: 10, total: 100 }),
    ped('v3', d2, [{ produtoId: 'p_copo', nome: 'Copo M', total: 25 }, { produtoId: 'p_tx', nome: 'Taxa de Entrega', total: 5 }], { tipo: 'entrega' }),
    ped('v4', d2, [{ produtoId: 'p_casc', nome: 'Cascão 1 Bola', total: 18 }], { fase: 'cancelado' }),
    ped('a1', ant + '-10', [{ produtoId: 'p_casc', nome: 'Cascão 1 Bola', total: 50 }])
  ];
  /* vendas do mês: v1 25 + v2 100 + v3 30 = 155; 3 pedidos; desconto 10; cancelada 18 */

  grupo('1. Vendas e clientes — a conta feita à mão');
  const v = win.imVendas(mes, suc);
  t('vendas = R$ 155,00 (cancelada fora)', perto(v.vendas, 155), v.vendas);
  t('clientes = 3 pedidos', v.pedidos === 3, v.pedidos);
  t('ticket = 155 ÷ 3', perto(v.ticket, 155 / 3), v.ticket);
  t('descontos = R$ 10,00', perto(v.descontos, 10), v.descontos);
  t('cancelamentos = R$ 18,00 (1 venda)', perto(v.cancel, 18) && v.qCancel === 1, v.cancel);
  t('média por dia = vendas ÷ dias corridos', perto(v.porDia, 155 / v.dias), v.porDia);
  const va = win.imVendas(ant, suc);
  t('o mês anterior é outro mês (R$ 50,00)', perto(va.vendas, 50), va.vendas);

  grupo('2. Mix de vendas pela categoria do produto');
  t('Gelato = Cascão + Copo + Pote (18 + 25 + 90 = 133)', perto(v.mix.gelato, 133), v.mix.gelato);
  t('Sobremesas = 20', perto(v.mix.sobremesa, 20), v.mix.sobremesa);
  t('Bebidas = 7', perto(v.mix.bebida, 7), v.mix.bebida);
  t('taxa de entrega não entra no mix', perto(v.mixTot, 160), v.mixTot);

  grupo('3. Consumo, perdas e produção — pelas movimentações de estoque');
  win.DB.insumos = [
    { id: 'i_gel', nome: 'GELATO VENDA', unidade: 'kg', controlaEstoque: true, custo: 20 },
    { id: 'i_cas', nome: 'Casquinha', unidade: 'un', controlaEstoque: true, custo: 1 }];
  const mv = (id, dia, motivoId, origem, linhas) => ({ id, data: dia, motivoId, origem, sucursalId: suc, linhas });
  win.DB.movEst = [
    mv('m1', d1, 'mv_venda', 'venda', [{ insumoId: 'i_gel', qtd: 2, unidade: 'kg', custo: 20, direcao: 'saida' }]),      /* 40 */
    /* ==========================================================
       ESTE CASO ERA FALSO, E O TESTE PASSAVA MESMO ASSIM

       Aqui havia um movimento com `origem:'estorno'`, montado à mão, e
       o teste conferia que o CMV descontava 10. O sistema descontava
       mesmo — mas NADA no Joia jamais escrevia `origem:'estorno'`.
       O caso só existia dentro deste arquivo: teste verde, código morto,
       e o cancelamento de verdade continuando a somar no CMV.

       O caso REAL é este: pedido já produzido e depois cancelado. O
       insumo foi consumido de verdade (o movimento fica, o saldo está
       certo), mas não virou venda — então não é CMV, é perda.
       ========================================================== */
    Object.assign(
      mv('m2', d2, 'mv_venda', 'venda', [{ insumoId: 'i_gel', qtd: 0.5, unidade: 'kg', custo: 20, direcao: 'saida' }]),
      { perdaCancelamento: 'cn_teste', perdaMotivo: 'Cliente desistiu' }),                                                /* perda 10 */
    mv('m3', d2, 'mv_perda', 'manual', [{ insumoId: 'i_cas', qtd: 5, unidade: 'un', custo: 1, direcao: 'saida' }]),       /* baixa 5 */
    mv('m4', d2, 'mv_cont', 'contagem', [{ insumoId: 'i_cas', qtd: 3, unidade: 'un', custo: 1, direcao: 'saida' }]),      /* ajuste 3 */
    mv('m5', d1, 'mv_prod', 'producao', [{ insumoId: 'i_gel', qtd: 10, unidade: 'kg', custo: 18, direcao: 'entrada' }]),  /* 180 / 10 kg */
    mv('m6', d1, 'mv_nota', 'nota', [{ insumoId: 'i_cas', qtd: 100, unidade: 'un', custo: 1, direcao: 'entrada' }]),      /* compra 100 */
    mv('m7', d2, 'mv_transf_saida', 'transferencia', [{ insumoId: 'i_gel', qtd: 1, unidade: 'kg', custo: 20, direcao: 'saida' }])
  ];
  const e = win.imEstoque(mes, suc);
  t('consumo = só a venda que valeu = R$ 40,00', perto(e.cmv, 40), e.cmv);
  t('a venda cancelada já produzida NÃO entra no consumo', perto(e.cmv, 40), e.cmv);
  t('ela entra como perda = R$ 10,00', perto(e.perdaCanc, 10), e.perdaCanc);
  t('baixa manual = R$ 5,00', perto(e.baixas, 5), e.baixas);
  t('ajuste de contagem = R$ 3,00', perto(e.ajustes, 3), e.ajustes);
  t('total de perdas = 5 + 3 + 10 = R$ 18,00', perto(e.perdas, 18), e.perdas);
  t('transferência não é perda nem consumo', perto(e.perdas, 18) && perto(e.cmv, 40));
  t('compras do mês = R$ 100,00', perto(e.compras, 100), e.compras);
  t('custo médio do gelato produzido = R$ 18,00/kg', perto(e.custoKg, 18), e.custoKg);

  grupo('4. Funcionários e energia: digita, Atualiza, fica');
  win.IM.mes = mes; win.IM.suc = suc; win.IM.aba = 'custos'; win.IM._estado = '';
  win.S.mod = 'relatorios'; win.S.it = 'indicadores-mes';
  win.DB.indManuais = [];
  win.telaIndicadoresMes();
  t('a aba de custos abre', !!doc.getElementById('im_funcionarios') && !!doc.getElementById('im_energia'));
  t('sem funcionários: receita por funcionário "—"', /Receita por funcionário<\/span><b>—/.test(doc.getElementById('content').innerHTML));
  doc.getElementById('im_funcionarios').value = '4';
  t('digitado e não atualizado: sair pergunta antes', /não foram atualizados/.test(win.GUARDA.fn() || ''));
  await win.salvarManual('funcionarios');
  const rec = (win.DB.indManuais || []).find(x => x.id === 'im_' + suc + '_' + mes) || {};
  t('Atualizar grava por unidade e mês', rec.funcionarios === 4 && rec.sucursalId === suc && rec.mes === mes, JSON.stringify(rec));
  t('receita por funcionário = 155 ÷ 4', /R\$ 38,75/.test(doc.getElementById('content').innerHTML));
  doc.getElementById('im_energia').value = '2103';
  await win.salvarManual('energia');
  t('energia gravada (2.103 kWh)', rec.energiaKwh === 2103, rec.energiaKwh);
  t('depois de atualizar, nada pendente para sair', !win.GUARDA.fn());
  doc.getElementById('im_funcionarios').value = '-2';
  await win.salvarManual('funcionarios');
  t('número negativo não grava', rec.funcionarios === 4, rec.funcionarios);
  const E = win.MAPA.find(x => x.col === 'indManuais');
  const sobe = E ? E.campos(rec) : {};
  t('sobe para a nuvem com a unidade, o mês e os dois números',
    sobe.sucursal_id === suc && sobe.mes === mes && sobe.funcionarios === 4 && sobe.energia_kwh === 2103, JSON.stringify(sobe));
  const fonteBaixar = fs.readFileSync(ARQ, 'utf8');
  t('e desce da nuvem em todo aparelho', /baixarTab\('indicadores_manuais'/.test(fonteBaixar) && /DB\.indManuais=volta\(/.test(fonteBaixar));

  grupo('5. Está no menu de Relatórios e abre');
  const rel = win.MOD.find(m => m.id === 'relatorios');
  t('item "Indicadores do Mês" em Relatórios', rel && rel.it.some(i => i.id === 'indicadores-mes' && i.n === 'Indicadores do Mês'));
  t('quem vê o Faturamento por Dia vê os Indicadores', win.temPermissao({ 'relatorios/faturamento-dia': true }, 'relatorios/indicadores-mes'));
  win.IM.aba = 'vendas'; win.IM._estado = '';
  t('a rota do menu abre o painel', /iid==='indicadores-mes'\)return telaIndicadoresMes\(\)/.test(fonteBaixar));
  try { win.telaIndicadoresMes(); } catch (x) { erros.push('tela: ' + x.message); }
  const html = doc.getElementById('content').innerHTML;
  t('a aba de vendas mostra os seis números', /Vendas do mês/.test(html) && /Ticket médio/.test(html) && /Cancelamentos/.test(html));
  t('com o valor certo (R$ 155,00)', /R\$ 155,00/.test(html));
  t('mix e gráficos de 12 meses', /Mix de vendas/.test(html) && /Vendas — últimos 12 meses/.test(html) && /<svg/.test(html));
  t('filtros de mês, unidade e comparação', !!doc.getElementById('imMes') && !!doc.getElementById('imSuc') && /Mesmo mês do ano passado/.test(html));

  grupo('6. Tempo real: o mês em andamento percebe venda nova');
  const antes = win.imImpressao();
  win.DB.pedidos.push(ped('v5', d2, [{ produtoId: 'p_casc', nome: 'Cascão 1 Bola', total: 18 }]));
  t('venda nova muda a impressão que o painel vigia', win.imImpressao() !== antes);
  t('e a conta já inclui a venda nova', perto(win.imVendas(mes, suc).vendas, 173));

  grupo('7. Sem movimentação de estoque no mês: "—", nunca um 0,0% falso');
  const movGuardado = win.DB.movEst; win.DB.movEst = [];
  win.IM.aba = 'custos'; win.telaIndicadoresMes();
  const h7 = doc.getElementById('content').innerHTML;
  t('CPV mostra "—"', /CPV do mês<\/span><b>—/.test(h7));
  t('e avisa que não houve movimentação', /Nenhuma movimentação de estoque neste mês/.test(h7));
  win.DB.movEst = movGuardado;

  t('nenhum erro de script', erros.length === 0, erros.join(' | '));
  try { if (win.IM._t) win.clearInterval(win.IM._t); } catch (x) {}
  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Indicadores do Mês');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  try { win.close(); } catch (x) {}
  process.exit(R.falhou ? 1 : 0);
})();

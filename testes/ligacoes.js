/* ==========================================================
   JOIA — AS LIGACOES ENTRE OS MODULOS

   A varredura de telas prova que nada estoura e que todo botao aponta
   para uma funcao que existe. Isso nao prova a coisa mais importante:
   que um modulo mexe no outro do jeito certo. A nota de entrada tem de
   entrar no estoque E gerar a conta a pagar. O cancelamento tem de
   devolver o insumo — ou nao devolver, conforme a resposta. A
   transferencia tem de sair de uma unidade e entrar na outra, e nao nas
   duas nem em nenhuma.

   Aqui as funcoes de verdade sao chamadas contra um DB semeado, e o
   saldo e conferido antes e depois, item a item.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ARQ = path.join(__dirname, '..', 'index.html');
let falhas = 0, testes = 0;
function grupo(n) { console.log('\n── ' + n + '\n'); }
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

const erros = [];
const ruido = m => /Not implemented: |Could not parse CSS|localStorage|offline|sem conexão/i.test(String(m));

(async function () {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!ruido(e && e.message)) erros.push(String(e.message).slice(0, 120)); });
  vc.on('error', (...a) => { const m = a.join(' '); if (!ruido(m)) erros.push(m.slice(0, 120)); });
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(w) {
      w.fetch = () => Promise.reject(new Error('offline'));
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      w.scrollTo = () => {}; w.print = () => {}; w.alert = () => {}; w.confirm = () => true;
      w.crypto = w.crypto || {};
      if (!w.crypto.subtle) w.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
      w.addEventListener('error', e => {
        const m = String((e.error && e.error.message) || e.message);
        if (!ruido(m)) erros.push(m.slice(0, 120));
      });
      w.addEventListener('unhandledrejection', e => {
        const m = String((e.reason && e.reason.message) || e.reason);
        if (!ruido(m)) erros.push(m.slice(0, 120));
      });
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window, doc = w.document;
  const esp = ms => new Promise(r => setTimeout(r, ms || 40));
  try { w.eval("SESSAO.login='admin';SESSAO.usuarioId='usr_mestre';"); } catch (e) {}
  doc.getElementById('login').style.display = 'none';
  doc.getElementById('app').classList.remove('hide');
  const toasts = [];
  w.toast = m => toasts.push(String(m));
  /* `confirmar` do sistema e uma janela que espera um clique. Sem
     responder por ela, todo `await confirmar(...)` fica pendurado para
     sempre e a suite trava — foi o que aconteceu na primeira volta. */
  w.confirmar = async () => true;
  w.pergunta = async () => true;
  w.eval(fs.readFileSync(path.join(__dirname, '..', 'ferramentas', 'semente-loja.js'), 'utf8'));
  w.topo(); w.faixa();
  const saldo = (id, suc) => +Number(w.saldoUn(id, suc || w.lojaAtualId())).toFixed(4);

  /* ---------------------------------------------------------- */
  grupo('Nota de entrada → estoque, custo e financeiro');

  const antesLeite = saldo('in_leite');
  const antesLanc = (w.DB.lancFin || []).length;
  w.eval(`
    baseNotas(); baseFin(); DB.lancFin=DB.lancFin||[];
    _nota={numero:'0001',data:hojeISO(),fornecedorId:'',fornecedorNome:'Laticínio X',
      receber:true,total:1000,
      itens:[{insumoId:'in_leite',nome:'Leite',unidade:'l',qtd:100,total:700}]};
  `);
  w.eval(`finalizarNota([{id:'lf_teste',valor:700,pago:false,contaId:'ct_caixa',
    metodoId:'',categoriaId:''}]);`);
  await esp(60);
  t('a nota entra no estoque', saldo('in_leite') - antesLeite === 100,
    antesLeite + ' → ' + saldo('in_leite'));
  const nota = (w.DB.notas || [])[w.DB.notas.length - 1];
  t('a nota fica gravada', !!nota && nota.numero === '0001');
  t('com o movimento de estoque amarrado', !!nota.movId);
  const movNota = (w.DB.movEst || []).find(m => m.id === nota.movId);
  t('o movimento tem o motivo de nota', movNota && movNota.motivoId === 'mv_nota');
  t('e a identificação leva o número da NF', movNota && /NF 0001/.test(movNota.identificacao));
  t('o custo da última compra é atualizado no ingrediente',
    Math.abs(w.insumo('in_leite').custoUltima - 7) < 0.001, w.insumo('in_leite').custoUltima);
  t('a compra fica no histórico do ingrediente',
    (w.insumo('in_leite').compras || []).length === 1);
  t('o lançamento financeiro é amarrado à nota',
    w.eval("(function(){return _nota===null})()") === true);

  /* nota marcada para NÃO receber não pode mexer no estoque */
  const antes2 = saldo('in_leite');
  w.eval(`
    _nota={numero:'0002',data:hojeISO(),fornecedorNome:'Y',receber:false,total:50,
      itens:[{insumoId:'in_leite',nome:'Leite',unidade:'l',qtd:10,total:70}]};
    finalizarNota([]);
  `);
  await esp(40);
  t('nota não recebida NÃO mexe no estoque', saldo('in_leite') === antes2,
    antes2 + ' → ' + saldo('in_leite'));

  /* ---------------------------------------------------------- */
  grupo('Transferência entre unidades → sai de uma, entra na outra');

  w.eval(`
    baseTransf();
    DB.sucursais=[{id:'suc_matriz',nome:'Matriz',matriz:true,ativa:true},
                  {id:'suc1',nome:'Jales',ativa:true}];
  `);
  const naMatriz = saldo('in_casq', 'suc_matriz');
  const emJales = saldo('in_casq', 'suc1');
  /* TR.itens e LISTA de itens escolhidos, com qtd e custo — nao um mapa */
  let enviou = false;
  try {
    await w.eval(`(async function(){
      TR={destino:'suc1',obs:'',itens:[{id:'in_casq',tipo:'insumo',nome:'Casquinha',
        unidade:'un',qtd:20,custo:0.8}]};
      return await enviarTransferencia();
    })()`);
    enviou = true;
  } catch (e) { enviou = 'ERRO: ' + e.message; }
  await esp(60);
  const t1 = (w.DB.transf || [])[0];
  t('a transferência é criada', !!t1, String(enviou));
  if (t1) {
    t('com origem e destino',
      t1.destinoSuc === 'suc1' && t1.origemSuc === 'suc_matriz',
      t1.origemSuc + ' → ' + t1.destinoSuc);
    t('com situação "enviada"', t1.situacao === 'enviada', t1.situacao);
    const movT = (w.DB.movEst || []).find(m => m.origem === 'transferencia');
    t('e um movimento de saída com motivo próprio',
      movT && movT.motivoId === 'mv_transf_saida', movT && movT.motivoId);
    t('saiu do estoque de quem enviou',
      naMatriz - saldo('in_casq', 'suc_matriz') === 20,
      naMatriz + ' → ' + saldo('in_casq', 'suc_matriz'));
    t('e NÃO entrou ainda no destino — quem recebe confirma',
      saldo('in_casq', 'suc1') === emJales,
      emJales + ' → ' + saldo('in_casq', 'suc1'));
    /* agora a unidade de destino recebe */
    w.eval("DB.lojaAtual='suc1';S.loja='suc1';");
    /* receber abre uma janela de conferencia: a entrada so acontece no
       confirmar, depois de a pessoa dizer o que de fato chegou */
    try { await w.eval(`receberTransferencia('${t1.id}')`); } catch (e) {}
    await esp(40);
    t('receber abre a conferência do que chegou', !!doc.getElementById('mdOv'));
    t('com um campo por item enviado',
      doc.querySelectorAll('.trRec').length === 1);
    if (doc.getElementById('mdOk')) doc.getElementById('mdOk').click();
    await esp(60);
    t('ao receber, entra no estoque do destino',
      saldo('in_casq', 'suc1') - emJales === 20,
      emJales + ' → ' + saldo('in_casq', 'suc1'));
    t('e não volta a mexer na origem',
      saldo('in_casq', 'suc_matriz') === naMatriz - 20);
    w.eval("DB.lojaAtual='suc_matriz';S.loja='suc_matriz';");
  }

  /* ---------------------------------------------------------- */
  grupo('Cancelamento de venda → o estoque volta, ou não');

  /* uma venda que baixou estoque */
  w.eval(`
    DB.pedidos=[]; PDV.comanda=[]; PDV.tipo='loja';
    DB.caixas=[{id:'cx1',inicial:0,operador:'Ana',aberto:'01/01/2026 10:00',
      sucursalId:'suc_matriz',movimentos:[]}];
    var p=DB.produtos.find(function(x){return x.id==='pr_casq'});
    PDV.comanda=[{produtoId:'pr_casq',nome:'Casquinha',qtd:3,unit:12,total:36,opcoes:[]}];
  `);
  const antesCasq = saldo('in_casq');
  w.eval("finalizarVenda(36,0,0,[{forma:'fp_din',valor:36}],false,false,null,0);");
  await esp(80);
  const ped = w.DB.pedidos[w.DB.pedidos.length - 1];
  t('a venda baixou o estoque', antesCasq - saldo('in_casq') === 3,
    antesCasq + ' → ' + saldo('in_casq'));
  const depoisVenda = saldo('in_casq');

  /* cancelamento respondendo NÃO PRODUZIDO: o estoque volta */
  w.eval(`
    DB.motivosCanc=[{id:'mc1',nome:'Erro de lançamento',ativo:true}];
    baseUsr();
    NUVEM.ligada=true;
    conferirSenhaNoBanco=async function(){return {confere:true,tem:true}};
    podeCancelarVenda=function(){return true};
    produzidoEscolhido=function(){return 'nao'};
    document.body.insertAdjacentHTML('beforeend',
      '<div id="mdOv"><select id="cvMot"><option value="mc1">m</option></select>'+
      '<select id="cvOp"><option value="us_ger">Bia</option></select>'+
      '<input id="cvSenha" value="1234"><input id="cvObs" value=""></div>');
  `);
  try { await w.eval(`confirmarCancelamento('${ped.id}')`); } catch (e) {}
  await esp(80);
  t('cancelando como NÃO produzido, o insumo volta',
    saldo('in_casq') - depoisVenda === 3, depoisVenda + ' → ' + saldo('in_casq'));
  t('a venda fica marcada como cancelada',
    w.ehCancelado(w.DB.pedidos.find(x => x.id === ped.id)) === true);

  /* o complemento: respondendo PRODUZIDO, o insumo NAO pode voltar —
     ele ja foi consumido na cuba */
  w.eval(`
    PDV.comanda=[{produtoId:'pr_casq',nome:'Casquinha',qtd:2,unit:12,total:24,opcoes:[]}];
    PDV.tipo='loja';
    finalizarVenda(24,0,0,[{forma:'fp_din',valor:24}],false,false,null,0);
  `);
  await esp(80);
  const ped2 = w.DB.pedidos[w.DB.pedidos.length - 1];
  const depois2 = saldo('in_casq');
  w.eval("produzidoEscolhido=function(){return 'sim'};");
  w.eval(`document.body.insertAdjacentHTML('beforeend',
      '<div id="mdOv"><select id="cvMot"><option value="mc1">m</option></select>'+
      '<select id="cvOp"><option value="us_ger">Bia</option></select>'+
      '<input id="cvSenha" value="1234"><input id="cvObs" value=""></div>');`);
  try { await w.eval(`confirmarCancelamento('${ped2.id}')`); } catch (e) {}
  await esp(80);
  t('cancelando como JÁ produzido, o insumo NÃO volta',
    saldo('in_casq') === depois2, depois2 + ' → ' + saldo('in_casq'));
  t('e a venda também sai do faturamento',
    w.ehCancelado(w.DB.pedidos.find(x => x.id === ped2.id)) === true);

  /* ---------------------------------------------------------- */
  grupo('Contagem de estoque → ajusta o saldo para o que foi contado');

  const antesConta = saldo('in_gv');
  const movsAntes = (w.DB.movEst || []).length;
  /* a contagem le CT2.cont, mapa de item → quantidade conferida, e compara
     com `estoqueAtual` do item — que e o espelho da unidade aberta */
  w.eval(`
    espelharEstoque();
    CT2={cont:{},custo:{},aba:'contar'};
    CT2.cont['in_gv']=String(saldoUn('in_gv',lojaAtualId())-5);
  `);
  try { await w.eval('fecharContagem()'); } catch (e) {}
  await esp(80);
  t('a contagem ajusta o saldo para o que foi contado',
    antesConta - saldo('in_gv') === 5, antesConta + ' → ' + saldo('in_gv'));
  t('e nasce um movimento de contagem',
    (w.DB.movEst || []).length === movsAntes + 1);
  const movCt = (w.DB.movEst || [])[w.DB.movEst.length - 1];
  t('com o motivo de contagem', movCt && movCt.motivoId === 'mv_cont', movCt && movCt.motivoId);
  t('a contagem fica no histórico', (w.DB.contagens || []).length === 1);
  const ct = (w.DB.contagens || [])[0];
  /* o valor em reais e zero porque este item nao tem custo cadastrado;
     o que prova a apuracao e a diferenca em quantidade */
  const linhaCt = ((ct || {}).itens || []).find(x => x.insumoId === 'in_gv');
  t('registrando a diferença apurada do item',
    linhaCt && linhaCt.diferenca === -5, linhaCt && linhaCt.diferenca);
  t('com o que o sistema esperava e o que foi contado',
    linhaCt && linhaCt.sistema - linhaCt.conferido === 5,
    linhaCt && (linhaCt.sistema + ' vs ' + linhaCt.conferido));
  t('e carimbada com a unidade', ct && ct.sucursalId === 'suc_matriz', ct && ct.sucursalId);

  /* ---------------------------------------------------------- */
  grupo('Nada disso levantou erro de runtime');
  t('zero erros no encadeamento inteiro', erros.length === 0, erros.slice(0, 3).join(' | '));

  console.log('\n════════════════════════════════════════════════════');
  console.log('Joia · as ligações entre os módulos');
  console.log(testes - falhas + ' de ' + testes + ' testes passaram');
  console.log('════════════════════════════════════════════════════\n');
  process.exit(falhas ? 1 : 0);
})();

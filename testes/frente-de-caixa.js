/* ==========================================================
   JOIA — O TRILHO QUENTE, DE PONTA A PONTA

   Este é o caminho que as seis lojas percorrem todo dia, e o único que
   não pode falhar em nenhum ponto:

     cardápio  ->  o produto cadastrado aparece na frente de caixa
     caixa     ->  abertura com operador, turno e fundo de troco
     comanda   ->  produto, opção com preço, quantidade
     pagamento ->  taxa, desconto, formas divididas, troco
     venda     ->  pedido gravado com unidade, caixa e canal
     estoque   ->  a ficha técnica baixa o que foi consumido
     entrega   ->  cliente, taxa da zona, entregador, fila
     caixa     ->  sangria assinada, fechamento cego, diferença
     relatório ->  frente de caixa, itens consumidos, formas de pagamento

   POR QUE ELE E RODADO NUM DOM DE VERDADE

   As outras suítes extraem funções e conferem a matemática, ou procuram
   trechos com expressão regular. Isso pega erro de conta e pegou muitos.
   Não pega o caso em que a tela abre e o botão não faz nada — que é como
   o `ci` da V179 ficou dez dias no ar com 523 verificações verdes.

   Aqui a suíte CLICA: acha o produto na grade pelo texto, abre o modal
   de opções, marca a opção, digita a quantidade, escolhe a forma de
   pagamento, edita o valor, confirma. Se algum desses elementos deixar
   de existir, o teste não acha e reprova — que é exatamente o que se
   quer saber antes de publicar.
   ========================================================== */
/* ==========================================================
   O FUSO E O DA LOJA, NAO O DA MAQUINA QUE RODA O TESTE

   `hojeISO()` forca o horario de Sao Paulo, mas `caixa.aberto` e gravado
   com `toLocaleDateString('pt-BR')`, que segue o relogio do aparelho. Num
   servidor em UTC, entre 21h e 00h de Brasilia os dois discordam em um
   dia — e o caixa fechado nao aparece no proprio relatorio. Na loja isso
   nao acontece; no container de teste, sim. Fixar o fuso aqui mede o
   sistema, nao a maquina.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';

const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ARQ = path.join(__dirname, '..', 'index.html');
const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n + '\n'); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

const erros = [];
const ruido = m => /Not implemented: |Could not parse CSS|localStorage is not available|offline/i.test(String(m));

async function carregar() {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!ruido(e && e.message)) erros.push(String(e.message).slice(0, 140)); });
  vc.on('error', (...a) => { const m = a.join(' '); if (!ruido(m)) erros.push(m.slice(0, 140)); });
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(w) {
      w.fetch = () => Promise.reject(new Error('offline no teste'));
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      w.scrollTo = () => {}; w.print = () => {}; w.alert = () => {}; w.confirm = () => true;
      w.crypto = w.crypto || {};
      if (!w.crypto.subtle) w.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
      w.addEventListener('error', e => {
        const m = String((e.error && e.error.message) || e.message);
        if (!ruido(m)) erros.push(m.slice(0, 140));
      });
      w.addEventListener('unhandledrejection', e => {
        const m = String((e.reason && e.reason.message) || e.reason);
        if (!ruido(m)) erros.push(m.slice(0, 140));
      });
    }
  });
  await new Promise(r => setTimeout(r, 900));
  return dom.window;
}

/* ==========================================================
   A LOJA DE MENTIRA, MONTADA COMO A DE VERDADE

   Dois produtos que baixam estoque por caminhos diferentes — um ligado a
   um insumo direto (casquinha), outro a uma ficha técnica com destino
   (o pote, que sai do "Gelato Venda") — e um que não baixa nada (água).
   São os três casos que existem no cardápio da Jolô.
   ========================================================== */
function semear(w) {
  w.eval(`
    baseMov(); baseFicha(); baseFormas(); baseUsr(); baseOper(); baseTurnos();
    DB.sucursais=[{id:'suc_matriz',nome:'Matriz',matriz:true,ativa:true}];
    DB.lojaAtual='suc_matriz'; S.loja='suc_matriz';
    DB.insumos=[
      {id:'in_leite',nome:'Leite',unidade:'l',custo:5,controlaEstoque:true},
      {id:'in_casq',nome:'Casquinha',unidade:'un',custo:0.8,controlaEstoque:true},
      {id:'in_gv',nome:'Gelato Venda',unidade:'kg',custo:0,controlaEstoque:true,gelatoVenda:true},
      {id:'in_nut',nome:'Nutella',unidade:'kg',custo:60,controlaEstoque:true}];
    DB.fichas=[
      {id:'fi_base',nome:'BASE CHOCOLATE',unidade:'kg',rendimento:10,rendUnidade:'kg',
       unidadesVenda:100,destinoId:'in_gv',destinoModo:'igual',destinoFator:1,
       itens:[{insumoId:'in_leite',qtd:4,unidade:'l'}]},
      {id:'fi_nut',nome:'BORDA NUTELLA',unidade:'kg',rendimento:1,unidadesVenda:50,
       itens:[{insumoId:'in_nut',qtd:1,unidade:'kg'}]}];
    DB.categorias=[{id:'ct1',nome:'Gelatos',ordem:1,ativo:true}];
    var disp={pdv:true,delivery:true,cardapio:true};
    DB.produtos=[
      {id:'pr_casq',nome:'Casquinha',categoriaId:'ct1',preco:12,ativo:true,ordem:1,
       vinculaEstoque:true,insumoId:'in_casq',insumoQtd:1,insumoUn:'un',
       grupos:['go1'],disponivel:disp},
      {id:'pr_pote',nome:'Pote 100g',categoriaId:'ct1',preco:20,ativo:true,ordem:2,
       vinculaEstoque:true,fichaId:'fi_base',disponivel:disp},
      {id:'pr_agua',nome:'Água',categoriaId:'ct1',preco:5,ativo:true,ordem:3,
       vinculaEstoque:false,disponivel:disp}];
    /* a opção guarda só nome e preço quando vai para a comanda: a baixa de
       estoque acha a ficha PELO NOME. Por isso os dois têm de bater. */
    DB.grupos=[{id:'go1',nome:'Bordas',min:0,max:1,forcado:false,canais:[],sucursais:[],
      /* nome da opcao DIFERENTE do nome da ficha, como e na loja de verdade:
         "Borda de Doce de Leite" para a ficha "BORDA DOCE LEITE". O vinculo
         que vale e o fichaId. */
      opcoes:[{nome:'Borda de Nutella',preco:3,fichaId:'fi_nut'}]}];
    DB.formasPag=[{id:'fp_din',nome:'Dinheiro',tipo:'dinheiro',ativo:true,ordem:1},
      {id:'fp_deb',nome:'Débito',tipo:'cartao',ativo:true,ordem:2},
      {id:'fp_pix',nome:'Pix',tipo:'pix',ativo:true,ordem:3}];
    DB.turnos=[{id:'tn1',nome:'Tarde',ini:'12:00',fim:'23:00',ativo:true}];
    DB.usuarios=[{id:'us_cx',login:'ana',nome:'Ana',ativo:true,senha:'',perms:{}},
      {id:'us_ger',login:'bia',nome:'Bia',ativo:true,tudo:true,senha:'',perms:{}}];
    /* A senha de AUTORIZAÇÃO não mora no usuário — operAtivos() zera esse
       campo de propósito, porque o valor fica no cofre da nuvem. Quem carrega
       senha local é "Operadores do Caixa", e para nomes iguais ela preenche a
       lacuna do usuário. Sem isso ninguém aparece na lista de sangria,
       cancelamento ou fechamento, que EXIGEM senha. */
    DB.operadores=[{id:'op_bia',nome:'Bia',funcao:'gerente',senha:'1234',ativo:true}];
    DB.entregadores=[{id:'en1',nome:'Zé',ativo:true,taxas:[]}];
    DB.areas=[{id:'ar1',nome:'Jales',taxaPadrao:6,ativa:true,
      zonas:[{id:'zn1',nome:'Centro',taxa:6,ativa:true}]}];
    DB.clientes=[{id:'cl1',nome:'João',telefone:'17999990000',cidade:'Jales',
      zonaId:'zn1',zona:'Centro',endereco:'Rua A, 1'}];
    DB.contas=[{id:'ct_caixa',nome:'Caixa da loja',tipo:'Caixa',saldo:0},
      {id:'ct_cofre',nome:'Cofre',tipo:'Cofre',saldo:0}];
    DB.pedidos=[];DB.caixas=[];DB.movEst=[];DB.lancFin=[];DB.estoqueUn=[];DB.saldos={};
    ['in_leite:500','in_casq:200','in_gv:50','in_nut:5'].forEach(function(x){
      var p=x.split(':');
      ajustaEstoque(insumo(p[0]),Number(p[1]),insumo(p[0]).unidade,1,lojaAtualId());
    });
    salvar();
  `);
}

(async function () {
  console.log('\nCarregando o sistema num DOM real…');
  const w = await carregar();
  const doc = w.document;
  const esp = ms => new Promise(r => setTimeout(r, ms || 40));
  const $ = id => doc.getElementById(id);
  const txt = () => ($('content') || {}).textContent || '';
  const saldo = id => +Number(w.saldoUn(id, w.lojaAtualId())).toFixed(4);
  const foto = () => ({ leite: saldo('in_leite'), casq: saldo('in_casq'),
                        gv: saldo('in_gv'), nut: saldo('in_nut') });
  const toasts = [];

  try { w.eval("SESSAO.login='admin';SESSAO.usuarioId='usr_mestre';"); } catch (e) {}
  $('login').style.display = 'none';
  $('app').classList.remove('hide');
  w.toast = m => toasts.push(String(m));
  semear(w);
  w.topo(); w.faixa();

  /* ---------------------------------------------------------- */
  grupo('As telas do trilho abrem sem erro');
  for (const n of ['telaCardapio', 'telaPDV', 'telaFrenteCaixa', 'telaMovimentacao',
                   'telaBaixaHub', 'telaItensConsumidos', 'telaItensVendidos',
                   'telaFaturamentoDia', 'telaVendasFormaPag', 'telaVendasPeriodo',
                   'telaPedidosOnline', 'telaFluxo', 'telaLancamentos', 'telaDRE']) {
    let ok = true, det = '';
    try { w[n](); } catch (e) { ok = false; det = e.message.slice(0, 70); }
    t(n, ok, det);
  }

  /* ---------------------------------------------------------- */
  grupo('Abrir a frente de caixa');
  t('nenhum caixa aberto no início', !w.caixaAberto());
  await w.abrirCaixa(); await esp(120);
  t('o formulário de abertura aparece', !!$('mdOv'));
  t('e oferece quem pode abrir', !!$('cxOp') && $('cxOp').options.length > 0);
  t('o turno cadastrado é oferecido',
    doc.querySelectorAll('input[name="cxTurno"]').length === 1);
  if ($('cxOp')) {
    const s = $('cxOp');
    const ana = [...s.options].find(o => /Ana/.test(o.textContent));
    if (ana) s.value = ana.value;
    const ini = $('cxIni');
    if (ini) { ini.value = '200,00'; ini.dispatchEvent(new w.Event('input', { bubbles: true })); }
    $('mdOk').click(); await esp(300);
  }
  const cx = w.caixaAberto();
  t('o caixa abre', !!cx);
  t('com o operador que assinou', cx && cx.operador === 'Ana', cx && cx.operador);
  t('com o turno', cx && cx.turno === 'Tarde', cx && cx.turno);
  t('com o fundo de troco', cx && cx.inicial === 200, cx && cx.inicial);
  t('e carimbado com a unidade', cx && cx.sucursalId === 'suc_matriz', cx && cx.sucursalId);

  /* ---------------------------------------------------------- */
  grupo('O cardápio chega à frente de caixa');
  w.PDV.aba = 'venda'; w.PDV.tipo = 'loja'; w.PDV.cat = null; w.telaPDV(); await esp(60);
  const nomes = () => [...doc.querySelectorAll('.prodBox b')].map(e => e.textContent.trim());
  t('os três produtos aparecem', nomes().length === 3, nomes().join(', '));
  t('com o preço na tela',
    /R\$ 12,00/.test(txt()) && /R\$ 20,00/.test(txt()));
  w.DB.produtos[2].disponivel = { pdv: false, delivery: true, cardapio: true };
  w.renderVenda();
  t('produto desligado do canal PDV some da grade', nomes().indexOf('Água') < 0);
  w.DB.produtos[2].disponivel = { pdv: true, delivery: true, cardapio: true };
  w.DB.produtos[2].ativo = false; w.renderVenda();
  t('produto inativo some da grade', nomes().indexOf('Água') < 0);
  w.DB.produtos[2].ativo = true; w.renderVenda();
  t('e volta quando é religado', nomes().indexOf('Água') >= 0);

  /* ==========================================================
     A CATEGORIA SEGUE O CANAL DOS PRODUTOS DELA

     Queixa do Rafael, com a foto: ele marcou "Taxa de Entrega" como
     disponível só no Delivery, e a categoria aparecia em "Pedido na
     loja" mesmo assim, com a pastilha dizendo "1". Quem clicava achava
     a categoria vazia.

     O "Disponível em" já valia para o produto; a faixa de CATEGORIAS não
     olhava canal nenhum.
     ========================================================== */
  w.DB.categorias.push({ id: 'ct_tx', nome: 'Taxa de Entrega', ordem: 99, ativo: true });
  w.DB.produtos.push({ id: 'pr_tx', nome: 'Taxa de Entrega', categoriaId: 'ct_tx',
    preco: 7, ativo: true, ordem: 1, vinculaEstoque: false,
    disponivel: { pdv: false, delivery: true, cardapio: true } });
  w.DB.categorias.push({ id: 'ct_vazia', nome: 'Categoria nova', ordem: 98, ativo: true });
  const cats = () => [...doc.querySelectorAll('.catBox span')].map(e => e.textContent.trim());
  const pastilha = n => {
    const c = [...doc.querySelectorAll('.catBox')]
      .find(e => e.querySelector('span').textContent.trim() === n);
    return c ? c.querySelector('em').textContent : '(ausente)';
  };
  w.PDV.tipo = 'loja'; w.PDV.cat = null; w.renderVenda(); await esp(60);
  t('categoria só de delivery NÃO aparece no pedido na loja',
    cats().indexOf('Taxa de Entrega') < 0, cats().join(', '));
  t('e a categoria ainda sem produto continua à vista',
    cats().indexOf('Categoria nova') >= 0, cats().join(', '));

  w.PDV.tipo = 'entrega'; w.PDV.cat = null; w.renderVenda(); await esp(60);
  t('na entrega ela aparece', cats().indexOf('Taxa de Entrega') >= 0, cats().join(', '));
  t('com a contagem do canal, não a geral', pastilha('Taxa de Entrega') === '1',
    pastilha('Taxa de Entrega'));
  t('e o produto está lá dentro',
    (w.PDV.cat = 'ct_tx', w.renderVenda(),
     [...doc.querySelectorAll('.prodBox b')].map(e => e.textContent.trim()))
      .indexOf('Taxa de Entrega') >= 0);

  /* limpa para não atrapalhar o resto da suíte */
  w.DB.categorias = w.DB.categorias.filter(c => c.id !== 'ct_tx' && c.id !== 'ct_vazia');
  w.DB.produtos = w.DB.produtos.filter(p => p.id !== 'pr_tx');
  w.PDV.tipo = 'loja'; w.PDV.cat = null; w.renderVenda(); await esp(60);

  /* ---------------------------------------------------------- */
  grupo('A comanda: produto, opção e quantidade');
  const antes = foto();
  [...doc.querySelectorAll('.prodBox')].find(e => /Casquinha/.test(e.textContent)).click();
  await esp(80);
  t('o produto com grupo abre a pergunta', !!$('mdOv'));
  t('e oferece a opção cadastrada',
    [...doc.querySelectorAll('.opSel')].length === 1);
  const opt = doc.querySelector('.opSel');
  if (opt) opt.checked = true;
  if ($('qtIt')) $('qtIt').value = '2';
  $('mdOk').click(); await esp(80);
  [...doc.querySelectorAll('.prodBox')].find(e => /Pote/.test(e.textContent)).click();
  await esp(80);
  t('a comanda tem os dois itens', w.PDV.comanda.length === 2);
  t('a opção soma no preço unitário', w.PDV.comanda[0].unit === 15, w.PDV.comanda[0].unit);
  /* ==========================================================
     O VINCULO DA FICHA VIAJA COM A OPCAO

     Ele ficava para tras: a comanda recebia so grupo, nome e preco, e a
     baixa de estoque tinha de adivinhar a ficha pelo NOME da opcao. Na
     Jolo, 7 das 10 opcoes vinculadas tinham nome diferente do da ficha —
     nenhuma baixava estoque, e a tela mostrava o vinculo do mesmo jeito.
     ========================================================== */
  t('a opção leva a ficha técnica junto para a comanda',
    (w.PDV.comanda[0].opcoes[0] || {}).fichaId === 'fi_nut',
    JSON.stringify(w.PDV.comanda[0].opcoes[0]));
  t('a quantidade multiplica', w.PDV.comanda[0].total === 30, w.PDV.comanda[0].total);
  t('o segundo item entra pelo preço dele', w.PDV.comanda[1].total === 20);

  /* ---------------------------------------------------------- */
  grupo('O pagamento: desconto e formas divididas');
  w.irPagamento(); await esp(100);
  t('a tela de pagamento abre', !!$('mdOv'));
  t('oferece as três formas cadastradas',
    doc.querySelectorAll('.pgBtn').length === 3);
  t('o total sai da comanda', /R\$ 50,00/.test($('pgTot').textContent));
  const dsc = $('pgDesc');
  dsc.value = '5,00'; dsc.dispatchEvent(new w.Event('input', { bubbles: true })); await esp(50);
  t('o desconto abate do total', /R\$ 45,00/.test($('pgTot').textContent),
    $('pgTot').textContent);
  [...doc.querySelectorAll('.pgBtn')].find(x => /Dinheiro/.test(x.textContent)).click();
  await esp(40);
  t('a primeira forma nasce com o valor inteiro', w._pagos[0].valor === 45, w._pagos[0].valor);
  const cmp = doc.querySelector('.pgV[data-i="0"]');
  cmp.value = '25,00'; cmp.dispatchEvent(new w.Event('input', { bubbles: true }));
  cmp.dispatchEvent(new w.Event('blur', { bubbles: true })); await esp(40);
  [...doc.querySelectorAll('.pgBtn')].find(x => /Pix/.test(x.textContent)).click();
  await esp(40);
  t('a segunda forma completa o que falta',
    w._pagos.length === 2 && w._pagos[1].valor === 20, JSON.stringify(w._pagos));
  $('mdOk').click(); await esp(400);

  /* ---------------------------------------------------------- */
  grupo('A venda gravada');
  const ped = w.DB.pedidos[w.DB.pedidos.length - 1];
  t('o pedido foi gravado', !!ped);
  t('com o total já com desconto', ped && ped.total === 45, ped && ped.total);
  t('com o desconto registrado', ped && ped.desconto === 5);
  t('amarrado ao caixa aberto', ped && ped.caixaId === cx.id);
  t('carimbado com a unidade', ped && ped.sucursalId === 'suc_matriz');
  t('com o canal do balcão', ped && ped.canal === 'pdv');
  t('e as duas formas de pagamento',
    ped && ped.pagamentos.length === 2 &&
    ped.pagamentos[0].forma === 'fp_din' && ped.pagamentos[1].forma === 'fp_pix');
  t('a numeração começou no 1', ped && ped.numero === 1);

  /* ---------------------------------------------------------- */
  grupo('A venda baixou o estoque pela ficha técnica');
  const dep = foto();
  t('o insumo direto sai pela quantidade vendida',
    antes.casq - dep.casq === 2, antes.casq + ' → ' + dep.casq);
  /* pote: rendimento 10 kg / 100 unidades de venda = 0,1 kg por pote */
  t('a ficha com destino sai do produto acabado',
    +(antes.gv - dep.gv).toFixed(4) === 0.1, antes.gv + ' → ' + dep.gv);
  /* borda: ficha de 1 kg para 50 unidades = 0,02 kg, vezes 2 casquinhas */
  t('a OPÇÃO escolhida também baixa o que consome',
    +(antes.nut - dep.nut).toFixed(4) === 0.04, antes.nut + ' → ' + dep.nut);
  t('o produto sem vínculo não mexe em estoque nenhum', antes.leite === dep.leite);
  const mv = (w.DB.movEst || []).filter(m => m.origem === 'venda');
  t('nasceu UM movimento de estoque para a venda', mv.length === 1);
  t('com o motivo de venda', mv[0] && mv[0].motivoId === 'mv_venda');
  t('apontando para o pedido', mv[0] && mv[0].pedidoId === ped.id);
  t('e identificado pelo número', mv[0] && /#1/.test(mv[0].identificacao));

  /* o vínculo por identificador não depende de como o nome foi escrito */
  const nutAntes = saldo('in_nut');
  w.baixarEstoqueVenda({ id: 'x', numero: 98, itens: [
    { produtoId: 'pr_casq', qtd: 1,
      opcoes: [{ nome: 'qualquer nome', preco: 3, fichaId: 'fi_nut' }] }] });
  t('a opção baixa pelo identificador, mesmo com o nome sem parecença',
    +(nutAntes - saldo('in_nut')).toFixed(4) === 0.02, nutAntes + ' → ' + saldo('in_nut'));
  /* comanda antiga, gravada antes desta versão: ainda tenta pelo nome */
  const nut2 = saldo('in_nut');
  w.baixarEstoqueVenda({ id: 'y', numero: 97, itens: [
    { produtoId: 'pr_casq', qtd: 1, opcoes: [{ nome: 'Borda Nutella', preco: 3 }] }] });
  t('comanda antiga, sem vínculo, ainda é resolvida pelo nome exato',
    +(nut2 - saldo('in_nut')).toFixed(4) === 0.02, nut2 + ' → ' + saldo('in_nut'));
  const nut3 = saldo('in_nut');
  w.baixarEstoqueVenda({ id: 'z', numero: 96, itens: [
    { produtoId: 'pr_casq', qtd: 1, opcoes: [{ nome: 'Borda de Nutella', preco: 3 }] }] });
  t('e sem vínculo nem nome exato ela não baixa — era o defeito',
    saldo('in_nut') === nut3, nut3 + ' → ' + saldo('in_nut'));

  /* ---------------------------------------------------------- */
  grupo('A entrega');
  w.liberarFecharVenda();
  w.PDV.aba = 'venda'; w.PDV.tipo = 'entrega'; w.telaPDV(); await esp(60);
  [...doc.querySelectorAll('.prodBox')].find(e => /Pote/.test(e.textContent)).click();
  await esp(60);
  w.irPagamento(); await esp(60);
  t('entrega sem cliente é barrada',
    /cliente identificado/i.test(toasts[toasts.length - 1] || ''),
    toasts[toasts.length - 1]);
  w.fecharModal();
  w.PDV.cliente = w.DB.clientes[0];
  w.irPagamento(); await esp(80);
  t('a taxa vem da zona do cliente', $('pgTaxa').value === '6,00', $('pgTaxa').value);
  t('o entregador é oferecido',
    doc.querySelectorAll('input[name="pgEnt"]').length === 1);
  [...doc.querySelectorAll('.pgBtn')].find(x => /Débito/.test(x.textContent)).click();
  await esp(40);
  t('o valor a pagar já inclui a taxa', w._pagos[0].valor === 26, w._pagos[0].valor);
  $('mdOk').click(); await esp(400);
  const pe = w.DB.pedidos[w.DB.pedidos.length - 1];
  t('o pedido de entrega grava a taxa', pe && pe.taxa === 6);
  t('com o canal de entrega', pe && pe.canal === 'entrega', pe && pe.canal);
  t('com o cliente identificado', pe && pe.clienteNome === 'João');
  t('com entregador atribuído', pe && !!pe.entregadorId);
  t('e entra na fila, não nasce concluído',
    pe && pe.fase !== 'entregue', pe && pe.fase);

  /* ---------------------------------------------------------- */
  grupo('Sangria — dinheiro que sai é assinado');
  w.NUVEM.ligada = true;
  w.conferirSenhaNoBanco = async () => ({ confere: true, tem: true });
  w.liberarFecharVenda();
  await w.movCaixa('sangria'); await esp(200);
  t('a sangria pede quem está retirando', !!$('mvOp'));
  t('e só oferece quem tem senha de autorização',
    [...doc.querySelectorAll('#mvOp option')].filter(o => o.value).length === 1);
  if ($('mvV')) {
    $('mvV').value = '50,00'; $('mvV').dispatchEvent(new w.Event('input', { bubbles: true }));
    const mot = $('mvMot'); mot.value = mot.options[1].value;
    mot.dispatchEvent(new w.Event('change', { bubbles: true }));
    const dst = $('mvDest'); dst.value = dst.options[0].value;
    const so = $('mvOp');
    so.value = [...so.options].find(o => /Bia/.test(o.textContent)).value;
    so.dispatchEvent(new w.Event('change', { bubbles: true })); await esp(40);
    if ($('mvSenha')) $('mvSenha').value = '1234';
    $('mdOk').click(); await esp(300);
  }
  const cx2 = w.caixaAberto();
  t('a sangria ficou registrada no caixa',
    (cx2.movimentos || []).length === 1, JSON.stringify(cx2.movimentos));
  t('com o nome de quem assinou',
    (cx2.movimentos[0] || {}).operador === 'Bia' ||
    (cx2.movimentos[0] || {}).responsavel === 'Bia',
    JSON.stringify(cx2.movimentos[0]));

  /* ---------------------------------------------------------- */
  grupo('A conta do caixa');
  const mov = w.movimentoCaixa(cx2.id);
  t('as vendas do turno somam as duas', mov.total === 71, mov.total);
  t('só o dinheiro entra na linha do dinheiro', mov.dinheiro === 25, mov.dinheiro);
  t('a gaveta é fundo + dinheiro − sangria',
    w.esperadoCaixa(cx2, mov) === 175, w.esperadoCaixa(cx2, mov));
  t('o débito da entrega aparece na forma dele',
    mov.porForma['fp_deb'] === 26, mov.porForma['fp_deb']);
  t('e o pix do balcão na dele', mov.porForma['fp_pix'] === 20, mov.porForma['fp_pix']);

  /* ---------------------------------------------------------- */
  grupo('O fechamento é cego, e continua sendo');
  t('o caixa cego está ligado e não se desliga', w.cfg().caixaCego === true);
  w.fecharCaixa(); await esp(200);
  t('a tela de fechamento abre', !!$('mdOv'));
  const sis = [...doc.querySelectorAll('.cSis')].map(e => e.textContent.trim());
  t('o valor do sistema fica OCULTO na conferência',
    sis.length > 0 && sis.every(x => /oculto/i.test(x)), sis.join(' | '));
  const campos = [...doc.querySelectorAll('.cfV')];
  t('há um campo de contagem por forma', campos.length === 3);
  campos.forEach(e => {
    const f = e.getAttribute('data-f');
    e.value = f === 'fp_din' ? '175,00' : (f === 'fp_deb' ? '26,00' : '20,00');
    e.dispatchEvent(new w.Event('input', { bubbles: true }));
  });
  await esp(60);
  t('e a diferença NÃO é mostrada antes de fechar',
    !/R\$/.test(($('cfDifTot') || {}).textContent || ''),
    ($('cfDifTot') || {}).textContent);
  const fo = $('fcOp');
  fo.value = [...fo.options].find(o => /Bia/.test(o.textContent)).value;
  fo.dispatchEvent(new w.Event('change', { bubbles: true })); await esp(40);
  if ($('fcSenha')) $('fcSenha').value = '1234';
  $('mdOk').click(); await esp(500);
  t('o caixa fecha', !w.caixaAberto());
  const cxf = w.DB.caixas[w.DB.caixas.length - 1];
  t('guardando o que o sistema esperava', cxf && cxf.esperado === 175, cxf && cxf.esperado);
  t('o que foi contado na gaveta', cxf && cxf.contado === 175, cxf && cxf.contado);
  t('e a diferença, que aqui é zero',
    cxf && Math.abs(Number(cxf.diferenca) || 0) < 0.005, cxf && cxf.diferenca);
  t('com quem assinou o fechamento',
    cxf && /Bia/.test(String(cxf.fechadoPor || cxf.operadorFecha || '')),
    cxf && (cxf.fechadoPor || cxf.operadorFecha));

  /* ---------------------------------------------------------- */
  grupo('Os relatórios enxergam o que aconteceu');
  w.telaFrenteCaixa(); await esp(80);
  t('a Frente de Caixa abre', /Frente de Caixa/.test(txt()));
  t('e encontra o turno fechado', /Bia|Ana/.test(txt()));

  w.IC.de = '2000-01-01'; w.IC.ate = '2099-12-31'; w.IC.motivos = [];
  w.IC.grupo = ''; w.IC.busca = '';
  w.telaItensConsumidos(); await esp(80);
  t('Itens Consumidos mostra o que a venda baixou', /Gelato Venda/.test(txt()));
  t('e a casquinha também', /Casquinha/.test(txt()));

  w.MV.de = ''; w.MV.ate = '';
  w.telaMovimentacao(); await esp(80);
  t('a Movimentação de Estoque mostra a venda', /Venda PDV/.test(txt()));
  t('identificando o pedido', /#1|#2/.test(txt()));

  w.VP.de = '2000-01-01'; w.VP.ate = '2099-12-31'; w.VP.formas = []; w.VP.canais = [];
  w.telaVendasFormaPag(); await esp(80);
  /* ==========================================================
     A VENDA DO DIA APARECIA COMO "NÃO INFORMADO" (corrigido na V208)

     O PDV grava a forma em `pagamento.forma`, e o relatório lia só
     `formaId`. Não aparecia sempre: a descida da nuvem devolve os dois
     campos, então a venda de ontem aparecia certa e a de hoje não — o
     relatório se consertava sozinho de um dia para o outro, e por isso
     ninguém achou. Este teste trava a correção no lugar.
     ========================================================== */
  t('Vendas por Forma de Pagamento reconhece a venda do dia',
    !/Não informado/.test(txt()), 'ainda aparece "Não informado"');
  t('e separa dinheiro, débito e pix',
    /Dinheiro/.test(txt()) && /Débito/.test(txt()) && /Pix/.test(txt()));

  w.telaItensVendidos(); await esp(80);
  t('Itens Vendidos lista o que saiu', /Gelatos/.test(txt()));

  w.telaFaturamentoDia(); await esp(80);
  t('o Faturamento por Dia soma as vendas', /71,00/.test(txt()) || /71/.test(txt()));

  /* ---------------------------------------------------------- */
  grupo('Nada disso levantou erro de runtime');
  t('zero erros durante o trilho inteiro', erros.length === 0,
    erros.slice(0, 3).join(' | '));
  t('zero ReferenceError', !erros.some(e => /ReferenceError/.test(e)));
  t('zero TypeError', !erros.some(e => /TypeError/.test(e)));

  console.log('\n════════════════════════════════════════════════════');
  console.log('Joia · trilho da frente de caixa');
  console.log(R.ok + ' de ' + R.total + ' testes passaram');
  console.log('════════════════════════════════════════════════════\n');
  process.exit(R.falhou ? 1 : 0);
})();

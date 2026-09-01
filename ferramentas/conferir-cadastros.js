/* ==========================================================
   VARREDURA DOS CADASTROS — pedida pelo Rafael em 31/08/2026

   Não confere se a tela abre (varrer.js já faz isso). Confere se o
   VÍNCULO funciona: o que eu cadastro aqui chega lá.

     1. banco/conta      → saldo, persistência
     2. forma de pagamento → taxa, prazo e a conta de destino
     3. o vínculo de verdade: vendi no crédito, o líquido caiu na conta?
     4. usuário/operador → senha, permissão, unidade
     5. pedido de base   → envia, a matriz muda, o sino da loja avisa
     6. baixa manual     → registra e desce do estoque
   ========================================================== */
process.env.TZ='America/Sao_Paulo';
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright');
const RAIZ='/home/user/nexor';
const SEMENTE=fs.readFileSync(path.join(RAIZ,'ferramentas','semente-loja.js'),'utf8');
const TIPOS={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
let falhas=0,feitos=0; const problemas=[];
function t(n,ok,d){feitos++;if(ok)console.log('   ok   '+n);
  else{falhas++;problemas.push(n+(d!==undefined?'  → '+d:''));console.log('   FALHOU  '+n+(d!==undefined?'  → '+d:''));}}
function servir(){return new Promise(ok=>{const s=http.createServer((rq,rs)=>{
  let p=decodeURIComponent(rq.url.split('?')[0]); if(p==='/')p='/index.html';
  const f=path.join(RAIZ,p);
  if(!f.startsWith(RAIZ)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){rs.writeHead(404);return rs.end('x');}
  rs.writeHead(200,{'Content-Type':TIPOS[path.extname(f)]||'application/octet-stream'});
  rs.end(fs.readFileSync(f));});s.listen(0,'127.0.0.1',()=>ok({s,porta:s.address().port}));});}

(async function(){
const {s,porta}=await servir();
const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await nav.newContext({viewport:{width:1440,height:900},locale:'pt-BR',timezoneId:'America/Sao_Paulo'});
const pg=await ctx.newPage();
const erros=[];
pg.on('pageerror',e=>erros.push(e.message.slice(0,180)));
pg.on('console',m=>{if(m.type()==='error'&&!/Failed to fetch|net::ERR|ServiceWorker|sem conexão/i.test(m.text()))erros.push(m.text().slice(0,180));});
await pg.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:'+porta)
  ? r.continue() : r.fulfill({status:200,contentType:'text/javascript',body:'/*x*/'}));

async function entrar(){
  await pg.goto('http://127.0.0.1:'+porta+'/index.html',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(2500);
  await pg.evaluate(()=>{ window.print=()=>{}; window.alert=()=>{};
    window.confirmar=async()=>true; window.pergunta=async()=>true; window.confirm=()=>true;
    try{SESSAO.login='admin';SESSAO.usuarioId='usr_mestre';}catch(e){}
    abrirSessao(); });
  await pg.waitForTimeout(400);
}
await entrar();
await pg.evaluate(SEMENTE);
await pg.evaluate(()=>{try{localStorage.setItem('nexor_impressao_ok','1')}catch(e){}});

/* ---------------------------------------------------------- */
console.log('\n══ 1. CADASTRO DE BANCO / CONTA\n');
let r=await pg.evaluate(()=>{
  telaContas();
  var antes=(DB.contas||[]).length;
  modalConta();
  var abriu=!!document.getElementById('mdOv');
  document.getElementById('cbN').value='Nubank PJ Santa Fé';
  document.getElementById('cbS').value='1500';
  document.getElementById('cbA').value='0001';
  document.getElementById('cbC').value='12345-6';
  var bt=[].slice.call(document.querySelectorAll('#mdOv button'))
    .find(x=>/^Salvar$/i.test(x.textContent.trim()));
  bt.click();
  var c=(DB.contas||[]).find(x=>x.nome==='Nubank PJ Santa Fé');
  return {abriu:abriu, criou:!!c, id:c&&c.id, saldoIni:c&&c.saldoInicial,
    ag:c&&c.agencia, num:c&&c.numero, banco:c&&c.banco,
    saldoCalc:c?saldoConta(c):null, total:(DB.contas||[]).length-antes,
    naTela:/Nubank PJ Santa Fé/.test(document.getElementById('content').innerHTML)};
});
t('o modal de conta abre', r.abriu===true);
t('a conta é criada com nome, agência e conta', r.criou&&r.ag==='0001'&&r.num==='12345-6', JSON.stringify(r));
t('o banco escolhido fica gravado', !!r.banco, r.banco);
t('o saldo inicial entra', r.saldoIni===1500, r.saldoIni);
t('o saldo calculado parte do saldo inicial', r.saldoCalc===1500, r.saldoCalc);
t('e ela aparece na lista da tela', r.naTela===true);
const contaId=r.id;

await pg.reload({waitUntil:'domcontentloaded'});
await pg.waitForTimeout(2200);
await pg.evaluate(()=>{window.print=()=>{};window.confirmar=async()=>true;window.pergunta=async()=>true;
  try{SESSAO.login='admin';SESSAO.usuarioId='usr_mestre';}catch(e){}abrirSessao();});
await pg.waitForTimeout(500);
r=await pg.evaluate(id=>({achou:!!(DB.contas||[]).find(x=>x.id===id)}),contaId);
t('e continua lá depois de recarregar a página', r.achou===true);

/* ---------------------------------------------------------- */
console.log('\n══ 2. FORMA DE PAGAMENTO: TAXA, PRAZO E DESTINO\n');
r=await pg.evaluate(id=>{
  telaFormasPag();
  modalForma();
  var abriu=!!document.getElementById('mdOv');
  document.getElementById('fpN').value='Crédito Mastercard';
  document.getElementById('fpT').value='credito';
  document.getElementById('fpTx').value='3.49';
  document.getElementById('fpTf').value='0,50';
  document.getElementById('fpD').value='30';
  var radio=document.querySelector('input[name=fpC][value="'+id+'"]');
  var achouRadio=!!radio; if(radio)radio.checked=true;
  var bt=[].slice.call(document.querySelectorAll('#mdOv button'))
    .find(x=>/^Salvar$/i.test(x.textContent.trim()));
  bt.click();
  var f=(DB.formasPag||[]).find(x=>x.nome==='Crédito Mastercard');
  return {abriu:abriu, achouRadio:achouRadio, criou:!!f, id:f&&f.id,
    tipo:f&&f.tipo, taxaPct:f&&f.taxaPct, taxaFixa:f&&f.taxaFixa,
    dias:f&&f.dias, contaId:f&&f.contaId, ativa:f&&f.ativa,
    naTela:/Crédito Mastercard/.test(document.getElementById('content').innerHTML),
    mostraConta:/Nubank PJ Santa Fé/.test(document.getElementById('content').innerHTML)};
},contaId);
t('o modal da forma abre', r.abriu===true);
t('a conta cadastrada aparece como destino escolhível', r.achouRadio===true);
t('a forma é criada', r.criou===true);
t('com a taxa por transação', r.taxaPct===3.49, r.taxaPct);
t('com a taxa fixa', r.taxaFixa===0.5, r.taxaFixa);
t('com o prazo de recebimento', r.dias===30, r.dias);
t('E COM A CONTA DE DESTINO VINCULADA', r.contaId===contaId, r.contaId);
t('a tela mostra a conta que recebe', r.mostraConta===true);
const formaId=r.id;

r=await pg.evaluate(id=>{
  syncFormas();
  var noPdv=(typeof FORMAS!=='undefined')&&FORMAS.some(f=>f.id===id);
  return {noPdv:noPdv, quantas:(typeof FORMAS!=='undefined')?FORMAS.length:0};
},formaId);
t('e ela passa a existir na frente de caixa', r.noPdv===true, JSON.stringify(r));

/* ---------------------------------------------------------- */
console.log('\n══ 3. O VÍNCULO DE VERDADE: vendi no crédito, o dinheiro foi para a conta?\n');
r=await pg.evaluate(async o=>{
  var hoje=new Date().toLocaleDateString('pt-BR');
  DB.caixas=[{id:'cx_v',inicial:100,operador:'Bia',operadorId:'op_bia',
    sucursalId:lojaAtualId(),movimentos:[],aberto:hoje+' 09:00'}];
  DB.pedidos=[{id:'pd_v',caixaId:'cx_v',fase:'finalizado',total:1000,
    itens:[{produtoId:'pr_agua',nome:'Água',qtd:1,preco:1000}],
    pagamentos:[{forma:o.formaId,valor:1000}],
    data:new Date().toISOString(),hora:'10:00',sucursalId:lojaAtualId()}];
  salvar();
  var cx=DB.caixas[0];
  var mov=movimentoCaixa('cx_v');
  var antesLanc=(DB.lancFin||[]).length;
  var n=lancarFechamento(cx,mov);
  var l=(DB.lancFin||[]).slice(antesLanc).find(x=>x.metodoId===o.formaId);
  var conta=(DB.contas||[]).find(x=>x.id===o.contaId);
  return {porForma:mov.porForma[o.formaId], criou:n, temLanc:!!l,
    contaDoLanc:l&&l.contaId, valorLiq:l&&l.valor, venc:l&&l.vencimento,
    pago:l&&l.pago, saldoDaConta:conta?saldoConta(conta):null,
    descricao:l&&l.descricao,
    vencEsperado:(function(){var d=new Date(hojeISO()+'T12:00:00');
      d.setDate(d.getDate()+30);
      return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+
             String(d.getDate()).padStart(2,'0');})()};
},{formaId,contaId});
t('a venda no crédito entra no movimento do turno', r.porForma===1000, r.porForma);
t('o fechamento cria o lançamento financeiro dessa forma', r.temLanc===true);
t('O LANÇAMENTO VAI PARA A CONTA CADASTRADA', r.contaDoLanc===contaId, r.contaDoLanc);
/* 1000 − 3,49% − 0,50 fixa = 1000 − 34,90 − 0,50 = 964,60 */
t('o valor é o LÍQUIDO, com a taxa descontada', r.valorLiq===964.6, r.valorLiq);
/* o vencimento e conferido contra o DIA DA LOJA lido na propria pagina.
   Calcular aqui, com o relogio do computador, quebrava a verificacao
   quando a bateria atravessava a meia-noite — foi o que aconteceu em
   01/09/2026, as 21h. */
t('e com o prazo de 30 dias no vencimento', r.venc===r.vencEsperado,
  r.venc + ' (esperado ' + r.vencEsperado + ')');
t('nasce como "a receber", não como já recebido', r.pago===false, r.pago);
/* a receber em 30 dias NAO e saldo em banco — so entra quando for pago */
t('a receber em 30 dias ainda NÃO entra no saldo da conta', r.saldoDaConta===1500,
  'saldo=' + r.saldoDaConta);

/* agora o que TEM de andar: uma forma sem prazo, que cai na conta na hora */
r=await pg.evaluate(o=>{
  var f=(DB.formasPag||[]).find(x=>x.id===o.formaId);
  var l={id:uid('lf'),tipo:'receita',contaId:o.contaId,metodoId:o.formaId,
    descricao:'Venda à vista no Pix',categoriaTxt:'Frente de Caixa',
    valor:200,emissao:hojeISO(),vencimento:hojeISO(),pagamento:hojeISO(),
    pago:true,origem:'fechamento-caixa'};
  DB.lancFin.push(l); salvar();
  var conta=(DB.contas||[]).find(x=>x.id===o.contaId);
  return {saldo:saldoConta(conta), lancPagos:(DB.lancFin||[])
    .filter(x=>x.contaId===o.contaId&&x.pago).length};
},{formaId,contaId});
t('há lançamento PAGO nessa conta', r.lancPagos>=1, r.lancPagos);
t('O SALDO DA CONTA ANDA COM O LANÇAMENTO PAGO', r.saldo===1700,
  'saldo=' + r.saldo + ' (esperado 1.700,00 = 1.500 + 200)');

r=await pg.evaluate(o=>{
  var l={id:uid('lf'),tipo:'despesa',contaId:o.contaId,descricao:'Conta de luz',
    valor:300,emissao:hojeISO(),vencimento:hojeISO(),pagamento:hojeISO(),pago:true};
  DB.lancFin.push(l); salvar();
  var conta=(DB.contas||[]).find(x=>x.id===o.contaId);
  return {saldo:saldoConta(conta)};
},{formaId,contaId});
t('e a despesa paga desce do saldo', r.saldo===1400,
  'saldo=' + r.saldo + ' (esperado 1.400,00)');

console.log('\n══ 4. USUÁRIO / OPERADOR: senha, permissão e unidade\n');
r=await pg.evaluate(()=>{
  baseUsr(); baseOper();
  DB.sucursais=[{id:'suc_matriz',nome:'Matriz',matriz:true,ativa:true},
                {id:'suc_sf',nome:'Santa Fé do Sul',ativa:true}];
  var antes=(DB.usuarios||[]).length;
  DB.usuarios.push({id:'us_novo',login:'carla',nome:'Carla',ativo:true,
    senha:'',perms:{'pdv':true},sucursais:['suc_sf']});
  salvar();
  var u=(DB.usuarios||[]).find(x=>x.id==='us_novo');
  DB.lojaAtual='suc_sf'; S.loja='suc_sf';
  var ops=operAtivos().map(o=>({id:o.id,nome:o.nome,senha:!!o.senha}));
  DB.operadores.push({id:'op_carla',nome:'Carla',funcao:'caixa',senha:'4321',ativo:true});
  salvar();
  var ops2=operAtivos();
  var carla=ops2.find(o=>/Carla/i.test(o.nome));
  return {criou:!!u, perms:u&&u.perms, suc:u&&u.sucursais,
    cresceu:(DB.usuarios||[]).length-antes,
    listaAntes:ops, temCarla:!!carla, carlaSenha:carla?temSenhaCadastrada(carla):null,
    podePdv:carla?podeFazer(carla,'sangria'):null,
    quemFecha:(typeof quemPode==='function')?quemPode('fechamento').map(o=>o.nome):null};
});
t('o usuário novo é criado', r.criou===true);
t('com a permissão marcada', !!(r.perms&&r.perms.pdv), JSON.stringify(r.perms));
t('e amarrado à unidade de Santa Fé', Array.isArray(r.suc)&&r.suc.indexOf('suc_sf')>=0, JSON.stringify(r.suc));
t('o operador do caixa aparece na lista de quem opera', r.temCarla===true);
t('e o sistema reconhece que ele tem senha', r.carlaSenha===true, r.carlaSenha);
t('a permissão por função é consultada de verdade', r.podePdv!==null, JSON.stringify(r.podePdv));

console.log('\n══ 5. PEDIDO DE BASE: envia · a matriz muda · o sino da loja avisa\n');
/* IMPORTANTE: quem entra como dono/sem unidade E a franqueadora — entao o
   lado da LOJA so pode ser testado entrando como um usuario DE Santa Fe. */
r=await pg.evaluate(async()=>{
  DB.pedidosBase=[]; DB.basesCat=[{id:'bs1',nome:'BASE CHOCOLATE',fichaRef:'fi_base',
    qtdCaixa:10,valorUnit:12,ativo:true}];
  DB.lojaAtual='suc_sf'; S.loja='suc_sf';
  SESSAO.login='carla'; SESSAO.usuarioId='us_novo';   /* usuario DA LOJA */
  var euSou={matriz:ehDaMatriz(), nome:(usuarioLogado()||{}).nome,
             suc:(usuarioLogado()||{}).sucursais};
  try{localStorage.removeItem(chaveSino())}catch(e){}
  PB.itens={bs1:3}; PB.responsavel='Carla'; PB.data=hojeISO(); PB.obs='';
  await enviarPedidoBase();
  var p=(DB.pedidosBase||[])[0];
  sinoEstreia();                       /* o aparelho da loja "estreia" o sino */
  return {euSou:euSou, criou:!!p, id:p&&p.id, sit:p&&p.situacao,
    enviadoEm:!!(p&&p.enviadoEm), total:p&&p.total, suc:p&&p.sucursalRef,
    novosNaEstreia:avisosNovos().length};
});
t('entrando como usuário DA LOJA, o sistema não a trata como matriz',
  r.euSou.matriz===false, JSON.stringify(r.euSou));
t('a loja envia o pedido', r.criou===true);
t('com a situação "enviado" e a hora gravada', r.sit==='enviado'&&r.enviadoEm===true, r.sit);
t('com o total certo (3 caixas × 10 × R$ 12 = R$ 360)', r.total===360, r.total);
t('e carimbado com a unidade que pediu', r.suc==='suc_sf', r.suc);
t('o sino começa quieto neste aparelho (histórico não é novidade)',
  r.novosNaEstreia===0, r.novosNaEstreia);
const pedId=r.id;

r=await pg.evaluate(id=>{
  /* a MATRIZ olhando */
  DB.lojaAtual='suc_matriz'; S.loja='suc_matriz';
  SESSAO.login='rafael@uendes.com'; SESSAO.usuarioId='usr_mestre';
  var avisos=avisosPedidoBase();
  return {daMatriz:ehDaMatriz(), tipos:avisos.map(a=>a.tipo),
    titulo:(avisos[0]||{}).titulo, texto:(avisos[0]||{}).texto};
},pedId);
t('a franqueadora é reconhecida como matriz', r.daMatriz===true);
t('E O PEDIDO NOVO APARECE NO SINO DA MATRIZ', r.tipos.indexOf('novo')>=0, JSON.stringify(r.tipos));
console.log('   aviso na matriz: "'+r.titulo+' — '+r.texto+'"');

r=await pg.evaluate(async id=>{
  await avancarPedido(id,'confirmado');
  var p=(DB.pedidosBase||[]).find(x=>x.id===id);
  return {sit:p.situacao, confirmadoEm:!!p.confirmadoEm};
},pedId);
t('A MATRIZ MUDA O PEDIDO (confirma)', r.sit==='confirmado'&&r.confirmadoEm===true, r.sit);

r=await pg.evaluate(id=>{
  /* de volta na LOJA, com o usuario da loja */
  DB.lojaAtual='suc_sf'; S.loja='suc_sf';
  SESSAO.login='carla'; SESSAO.usuarioId='us_novo';
  var todos=avisosPedidoBase(), novos=avisosNovos();
  if(!document.getElementById('sinoBadge'))
    document.body.insertAdjacentHTML('beforeend','<span id="sinoBadge"></span>');
  pintarSino();
  var badge=document.getElementById('sinoBadge');
  return {daMatriz:ehDaMatriz(), tipos:todos.map(a=>a.tipo),
    titulo:(todos[0]||{}).titulo, texto:(todos[0]||{}).texto,
    novos:novos.length, badge:badge.textContent, visivel:badge.style.display!=='none'};
},pedId);
t('a loja NÃO é tratada como matriz', r.daMatriz===false);
t('E A LOJA RECEBE O AVISO NO SININHO', r.tipos.indexOf('confirmado')>=0, JSON.stringify(r.tipos));
console.log('   aviso na loja: "'+r.titulo+' — '+r.texto+'"');
t('ele conta como aviso NÃO lido', r.novos>=1, r.novos);
t('O NÚMERO APARECE NO SINO', Number(r.badge)>=1, r.badge);
t('e o sino fica visível', r.visivel===true);

r=await pg.evaluate(()=>{
  var lista=avisosPedidoBase();
  marcarSinoVisto(lista);
  pintarSino();
  var b=document.getElementById('sinoBadge');
  return {novosDepois:avisosNovos().length, escondeu:b.style.display==='none'};
});
t('depois de abrir o sino, o aviso deixa de ser novidade', r.novosDepois===0, r.novosDepois);
t('e o número some', r.escondeu===true);

/* o que a matriz CONSOME para produzir esse pedido */
r=await pg.evaluate(async id=>{
  DB.lojaAtual='suc_matriz'; S.loja='suc_matriz';
  SESSAO.login='rafael@uendes.com'; SESSAO.usuarioId='usr_mestre';
  var f=(DB.fichas||[]).find(x=>x.id==='fi_base');
  var antes=(itemEstoque('in_leite')||{}).estoqueAtual||0;
  ajustaEstoque(DB.insumos.find(i=>i.id==='in_leite'),100,'l',1,lojaAtualId());
  var antes2=(itemEstoque('in_leite')||{}).estoqueAtual||0;
  await produzirPedido(id);
  var depois=(itemEstoque('in_leite')||{}).estoqueAtual||0;
  var b=DB.basesCat[0];
  return {rendimento:f.rendimento, receitaLeite:f.itens[0].qtd,
    caixas:3, qtdCaixa:b.qtdCaixa,
    consumiu:+(antes2-depois).toFixed(3),
    esperadoSeCaixaFosseUnidade:+( (3/f.rendimento)*f.itens[0].qtd ).toFixed(3),
    esperadoSeCaixaTivesse10:+( (3*b.qtdCaixa/f.rendimento)*f.itens[0].qtd ).toFixed(3)};
},pedId);
console.log('   ficha: rende '+r.rendimento+' kg e leva '+r.receitaLeite+' L de leite');
console.log('   pedido: '+r.caixas+' caixa(s) de '+r.qtdCaixa+' → consumiu '+r.consumiu+' L de leite');
t('a produção consome pelas UNIDADES do pedido, não pelo número de caixas',
  r.consumiu===r.esperadoSeCaixaTivesse10,
  'consumiu '+r.consumiu+' L; por caixas daria '+r.esperadoSeCaixaFosseUnidade+
  ' L, por unidades daria '+r.esperadoSeCaixaTivesse10+' L');

r=await pg.evaluate(async id=>{
  DB.lojaAtual='suc_matriz'; S.loja='suc_matriz';
  SESSAO.login='rafael@uendes.com'; SESSAO.usuarioId='usr_mestre';
  await avancarPedido(id,'enviado_matriz');
  await avancarPedido(id,'entregue');
  var p=(DB.pedidosBase||[]).find(x=>x.id===id);
  var lanc=(DB.lancFin||[]).find(x=>x.origemRef===id);
  return {sit:p.situacao, entregueEm:!!p.entregueEm,
    cobranca:lanc?{tipo:lanc.tipo,valor:lanc.valor,pago:lanc.pago}:null};
},pedId);
t('a matriz marca entregue', r.sit==='entregue'&&r.entregueEm===true, r.sit);
t('e nasce a cobrança da unidade, no valor do pedido',
  !!(r.cobranca&&r.cobranca.tipo==='receita'&&r.cobranca.valor===360&&r.cobranca.pago===false),
  JSON.stringify(r.cobranca));

r=await pg.evaluate(id=>{
  DB.lojaAtual='suc_sf'; S.loja='suc_sf';
  SESSAO.login='carla'; SESSAO.usuarioId='us_novo';
  var tipos=avisosPedidoBase().map(a=>a.tipo);
  pintarSino();
  return {tipos:tipos, novos:avisosNovos().length,
    badge:document.getElementById('sinoBadge').textContent};
},pedId);
t('E A LOJA É AVISADA DE QUE ESTÁ PRONTO PARA RETIRAR', r.tipos.indexOf('pronto')>=0, JSON.stringify(r.tipos));
t('e esse aviso novo faz o sino tocar de novo', Number(r.badge)>=1, r.badge);

r=await pg.evaluate(async id=>{
  /* a loja confere e dá entrada: "Recebi as bases".
     A base entra como a FICHA que ela é (produto acabado na filial). */
  var antes=(itemEstoque('fi_base')||{}).estoqueAtual||0;
  await receberPedidoBase(id);
  var p=(DB.pedidosBase||[]).find(x=>x.id===id);
  var pagar=(DB.lancFin||[]).find(x=>x.origemRef===id&&x.tipo==='despesa');
  var mv=(DB.movEst||[]).find(x=>x.id===p.movEntradaRef);
  var it=itemEstoque('fi_base')||{};
  return {entrada:!!p.entradaEstoque, depois:it.estoqueAtual||0, unidade:it.unidade,
    antes:antes, pagar:pagar?{valor:pagar.valor,pago:pagar.pago}:null,
    finPagarRef:!!p.finPagarRef,
    linha:mv?mv.linhas[0]:null, pedidoQtd:p.itens[0].qtd,
    caixaDe:(DB.basesCat[0]||{}).qtdCaixa, precoUnit:(DB.basesCat[0]||{}).valorUnit};
},pedId);
t('a loja dá entrada no recebimento', r.entrada===true);
t('o estoque da loja sobe com a base recebida', r.depois>r.antes, r.antes+' → '+r.depois);
console.log('   entrada: '+JSON.stringify(r.linha)+'  unidade do item: '+r.unidade);
console.log('   o pedido era de '+r.pedidoQtd+' caixa(s) de '+r.caixaDe+' × R$ '+r.precoUnit);
t('A QUANTIDADE QUE ENTRA É EM UNIDADES, NÃO EM CAIXAS',
  r.depois-r.antes === r.pedidoQtd*r.caixaDe,
  'entrou ' + (r.depois-r.antes) + ' ' + r.unidade + ', esperado ' + (r.pedidoQtd*r.caixaDe));
t('e o custo unitário gravado bate com o preço da base',
  r.linha && r.linha.custo === r.precoUnit,
  'custo gravado ' + (r.linha&&r.linha.custo) + ', preço da base ' + r.precoUnit);
t('e nasce a conta A PAGAR da loja para a matriz',
  !!(r.pagar&&r.pagar.valor===360&&r.pagar.pago===false), JSON.stringify(r.pagar));

r=await pg.evaluate(()=>{
  SESSAO.login='rafael@uendes.com'; SESSAO.usuarioId='usr_mestre';
  DB.lojaAtual='suc_matriz'; S.loja='suc_matriz';
  return {tipos:avisosPedidoBase().map(a=>a.tipo)};
});
t('E A MATRIZ É AVISADA DE QUE A LOJA CONFERIU', r.tipos.indexOf('conferido')>=0, JSON.stringify(r.tipos));

console.log('\n══ 6. BAIXA MANUAL\n');
r=await pg.evaluate(()=>{
  DB.lojaAtual='suc_matriz'; S.loja='suc_matriz';
  DB.baixasPend=[]; DB.movEst=[];
  ajustaEstoque(DB.insumos.find(i=>i.id==='in_nut'),10,'kg',1,lojaAtualId());
  salvar();
  var antes=itemEstoque('in_nut');
  telaBaixaManual();
  var abriu=/Baixa/i.test(document.getElementById('content').innerHTML);
  return {abriu:abriu, saldoAntes:antes};
});
t('a tela de baixa manual monta', r.abriu===true);
const saldoAntes=r.saldoAntes;
console.log('   saldo de Nutella antes: '+JSON.stringify(saldoAntes));

r=await pg.evaluate(()=>({motivos:(typeof motivosBaixa==='function')?motivosBaixa().map(m=>m.nome):null}));
console.log('   motivos de baixa disponíveis: '+JSON.stringify(r.motivos));
t('há motivo de baixa cadastrado para escolher', (r.motivos||[]).length>0, JSON.stringify(r.motivos));

r=await pg.evaluate(()=>{
  /* o formulário grava em BX pelos oninput — é assim que a tela funciona */
  escolherItemBaixa('in_nut','insumo');
  var pego=!!BX.item && BX.item.id==='in_nut';
  BX.qtd='2';
  BX.motivo=motivosBaixa()[0].id;
  BX.quem='Carla';
  BX.obs='quebra na produção';
  salvarBaixa();
  var b=(DB.baixasPend||[])[0];
  return {pego:pego, erro:BX.erro, gravou:!!b, item:b&&b.itemNome, qtd:b&&b.qtd,
    motivo:b&&b.motivoNome, quem:b&&b.quem, sit:b&&b.situacao,
    unidade:b&&b.unidade, suc:b&&b.sucursalRef};
});
t('o item é escolhido no campo', r.pego===true, r.erro);
t('a baixa é registrada na lista de pendentes', r.gravou===true, r.erro||JSON.stringify(r));
t('com o item certo', r.item==='Nutella', r.item);
t('com a quantidade digitada', Number(r.qtd)===2, r.qtd);
t('com o motivo escolhido', !!r.motivo, r.motivo);
t('com quem registrou', r.quem==='Carla', r.quem);
t('carimbada com a unidade', !!r.suc, r.suc);
t('e nasce PENDENTE — nada sai do estoque ainda', r.sit==='pendente', r.sit);

r=await pg.evaluate(()=>({saldo:(itemEstoque('in_nut')||{}).estoqueAtual}));
t('conferindo: o estoque NÃO mudou só por registrar', r.saldo===15, r.saldo);

r=await pg.evaluate(async ()=>{
  var antes=(itemEstoque('in_nut')||{}).estoqueAtual||0;
  await lancarBaixasNoEstoque();
  var b=(DB.baixasPend||[])[0];
  var depois=(itemEstoque('in_nut')||{}).estoqueAtual||0;
  var mv=(DB.movEst||[]).slice(-1)[0];
  return {antes:antes, depois:depois, sit:b&&b.situacao,
    pendentes:(DB.baixasPend||[]).filter(x=>x.situacao!=='lancada').length,
    mov:mv?{ident:mv.identificacao,linhas:(mv.linhas||[]).length,
            dir:(mv.linhas||[])[0]&&mv.linhas[0].direcao}:null};
});
t('O LANÇAMENTO TIRA DO ESTOQUE a quantidade da baixa',
  r.antes-r.depois===2, r.antes+' → '+r.depois);
t('a baixa fica marcada como lançada', r.sit==='lancada', r.sit);
t('e sai da fila de pendentes', r.pendentes===0, r.pendentes);
t('e o movimento de estoque fica gravado, como saída',
  !!(r.mov&&r.mov.dir==='saida'), JSON.stringify(r.mov));

r=await pg.evaluate(()=>{
  telaRelatorioBaixas();
  var h=document.getElementById('content').innerHTML;
  return {temTela:/Baixa/i.test(h), temItem:/Nutella/.test(h), temQuem:/Carla/.test(h)};
});
t('o relatório de baixas monta', r.temTela===true);
t('e mostra a baixa lançada, com quem registrou', r.temItem&&r.temQuem, JSON.stringify(r));

/* ---------------------------------------------------------- */
console.log('\n══ 7. O CADASTRO DE VERDADE DA LOJA, DE PONTA A PONTA\n');
/* Os números que o Rafael cadastrou em 01/09/2026:
   Itaú ag 0614 c/c 993368, saldo inicial R$ 66.113,69
   Dinheiro 0% → Caixa da loja · Débito 0,73% D+1 → Itaú
   Crédito 2,73% D+1 → Itaú · Pix 0% mesmo dia → Itaú          */
r = await pg.evaluate(async () => {
  var e = document.getElementById('mdOv'); if (e) e.remove();
  fecharModal();
  baseCat(); baseMov(); baseFin();
  DB.contas = [
    { id: 'ct_caixa', nome: 'Caixa da loja', tipo: 'Caixa', fixa: 'caixa', saldoInicial: 0 },
    { id: 'ct_cofre', nome: 'Cofre', tipo: 'Cofre', fixa: 'cofre', saldoInicial: 0 },
    { id: 'ct_itau', nome: 'Banco Itaú — conta corrente', banco: 'itau', tipo: 'Banco',
      agencia: '0614', numero: '993368', saldoInicial: 66113.69 }];
  DB.formasPag = [
    { id: 'fp_din', nome: 'Dinheiro', tipo: 'dinheiro', taxaPct: 0, taxaFixa: 0, dias: 0,
      contaId: 'ct_caixa', ativa: true, ordem: 0 },
    { id: 'fp_deb', nome: 'Cartão débito', tipo: 'debito', bandeira: 'Mastercard',
      taxaPct: 0.73, taxaFixa: 0, dias: 1, contaId: 'ct_itau', ativa: true, ordem: 1 },
    { id: 'fp_cred', nome: 'Cartão crédito', tipo: 'credito', bandeira: 'Mastercard',
      taxaPct: 2.73, taxaFixa: 0, dias: 1, contaId: 'ct_itau', ativa: true, ordem: 2 },
    { id: 'fp_pix', nome: 'Pix', tipo: 'pix', taxaPct: 0, taxaFixa: 0, dias: 0,
      contaId: 'ct_itau', ativa: true, online: true, ordem: 3 }];
  syncFormas(); salvar();

  var hoje = new Date().toLocaleDateString('pt-BR');
  DB.caixas = [{ id: 'cx_r', inicial: 200, operador: 'Bia', operadorId: 'op_bia',
    sucursalId: lojaAtualId(), movimentos: [], aberto: hoje + ' 12:00' }];
  /* uma venda de R$ 100 em cada forma */
  DB.pedidos = ['fp_din', 'fp_deb', 'fp_cred', 'fp_pix'].map(function (f, k) {
    return { id: 'pd_r' + k, caixaId: 'cx_r', fase: 'finalizado', total: 100,
      itens: [{ produtoId: 'pr_agua', nome: 'Água', qtd: 1, unitario: 100, total: 100 }],
      pagamentos: [{ forma: f, valor: 100 }], data: new Date().toISOString(),
      hora: '13:00', sucursalId: lojaAtualId() };
  });
  salvar();
  var mov = movimentoCaixa('cx_r');
  var antes = (DB.lancFin || []).length;
  lancarFechamento(DB.caixas[0], mov);
  var novos = (DB.lancFin || []).slice(antes);
  function lan(f) { return novos.find(function (l) { return l.metodoId === f; }) || {}; }
  var itau = DB.contas.find(function (c) { return c.id === 'ct_itau'; });
  return {
    porForma: mov.porForma, total: mov.total,
    din: lan('fp_din'), deb: lan('fp_deb'), cred: lan('fp_cred'), pix: lan('fp_pix'),
    saldoItauAntes: saldoConta(itau),
    hoje: hojeISO()
  };
});
t('as quatro vendas entram no movimento do turno', r.total === 400, r.total);
t('cada forma soma R$ 100', r.porForma.fp_cred === 100 && r.porForma.fp_deb === 100, JSON.stringify(r.porForma));

console.log('   ── dinheiro (0%, na hora)');
t('vai para o Caixa da loja', r.din.contaId === 'ct_caixa', r.din.contaId);
t('sem taxa: entra os R$ 100 cheios', r.din.valor === 100, r.din.valor);
t('e já nasce recebido', r.din.pago === true);

console.log('   ── débito 0,73% em 1 dia');
t('vai para o Itaú', r.deb.contaId === 'ct_itau', r.deb.contaId);
t('LÍQUIDO com a taxa descontada: R$ 99,27', r.deb.valor === 99.27, r.deb.valor);
t('a descrição mostra a taxa cobrada',
  /taxa R\$ 0,73/.test(r.deb.descricao || ''), r.deb.descricao);
t('nasce como A RECEBER, não como recebido', r.deb.pago === false);

console.log('   ── crédito 2,73% em 1 dia');
t('vai para o Itaú', r.cred.contaId === 'ct_itau', r.cred.contaId);
t('LÍQUIDO com a taxa descontada: R$ 97,27', r.cred.valor === 97.27, r.cred.valor);
t('a descrição mostra a taxa cobrada',
  /taxa R\$ 2,73/.test(r.cred.descricao || ''), r.cred.descricao);
t('nasce como A RECEBER', r.cred.pago === false);

console.log('   ── pix (0%, na hora)');
t('vai para o Itaú', r.pix.contaId === 'ct_itau', r.pix.contaId);
t('sem taxa: R$ 100 cheios', r.pix.valor === 100, r.pix.valor);
t('e já nasce recebido', r.pix.pago === true);

/* o saldo do banco: o que caiu hoje entra, o que vence amanhã não */
t('O SALDO DO ITAÚ SOBE COM O PIX (66.113,69 + 100)',
  r.saldoItauAntes === 66213.69, r.saldoItauAntes);
t('e o cartão de amanhã ainda NÃO entrou no saldo — está a receber',
  r.saldoItauAntes !== 66213.69 + 99.27 + 97.27, r.saldoItauAntes);

r = await pg.evaluate(() => {
  /* o dia seguinte: a loja marca o cartão como recebido */
  var itau = DB.contas.find(function (c) { return c.id === 'ct_itau'; });
  (DB.lancFin || []).forEach(function (l) {
    if (l.contaId === 'ct_itau' && !l.pago) { l.pago = true; l.pagamento = l.vencimento; }
  });
  salvar();
  return { saldo: saldoConta(itau) };
});
/* 66.113,69 + 100,00 (pix) + 99,27 (débito) + 97,27 (crédito) */
t('recebido o cartão, o saldo do Itaú fecha em 66.410,23',
  r.saldo === 66410.23, r.saldo);
t('e sem casa decimal sobrando na soma',
  String(r.saldo).split('.')[1].length <= 2, String(r.saldo));

console.log('\n   ── e os relatórios enxergam tudo isso\n');
r = await pg.evaluate(() => {
  var out = {};
  telaLancamentos();
  var h = document.getElementById('content').innerHTML;
  out.lancTemCredito = /Cartão crédito/.test(h);
  out.lancTemConta = /Itaú/.test(h);
  telaFluxo();
  out.fluxoMonta = /Fluxo/i.test(document.getElementById('content').innerHTML);
  telaContas();
  var hc = document.getElementById('content').innerHTML;
  out.contaMostraSaldo = /66\.410,23/.test(hc);
  telaFormasPag();
  var hf = document.getElementById('content').innerHTML;
  out.formaMostraTaxa = /2,73%/.test(hf) && /0,73%/.test(hf);
  out.formaMostraConta = (hf.match(/Itaú/g) || []).length >= 3;
  telaFaturamentoDia();
  var hd = document.getElementById('content').innerHTML;
  out.faturamento = /400,00/.test(hd);
  return out;
});
t('o lançamento do crédito aparece em Lançamentos Financeiros', r.lancTemCredito === true);
t('com a conta do Itaú', r.lancTemConta === true);
t('o Fluxo de Caixa monta com esses lançamentos', r.fluxoMonta === true);
t('a tela de Contas mostra o saldo já com o cartão recebido', r.contaMostraSaldo === true);
t('a tela de Formas mostra as taxas cadastradas', r.formaMostraTaxa === true);
t('e a conta que recebe cada uma', r.formaMostraConta === true);
t('o faturamento do dia soma as quatro vendas', r.faturamento === true);

console.log('\n══ 8. A VENDA DO PDV BAIXA O ESTOQUE E APARECE NO RELATÓRIO\n');
r = await pg.evaluate(async () => {
  DB.movEst = [];
  DB.insumos = [{ id: 'in_casq', nome: 'Casquinha', unidade: 'un', custo: 0.8,
                  controlaEstoque: true, codigo: '1' },
                { id: 'in_leite', nome: 'Leite', unidade: 'l', custo: 5,
                  controlaEstoque: true, codigo: '2' },
                { id: 'in_gv', nome: 'Gelato Venda', unidade: 'kg', custo: 0,
                  controlaEstoque: true, codigo: '3', gelatoVenda: true }];
  DB.fichas = [{ id: 'fi_base', nome: 'BASE CHOCOLATE', unidade: 'kg', rendimento: 10,
    rendUnidade: 'kg', unidadesVenda: 100, destinoId: 'in_gv', destinoModo: 'igual',
    destinoFator: 1, estocavel: true, itens: [{ insumoId: 'in_leite', qtd: 4, unidade: 'l' }] }];
  DB.produtos = [
    { id: 'pr_casq', nome: 'Casquinha', categoriaId: 'ct1', preco: 12, ativo: true,
      vinculaEstoque: true, insumoId: 'in_casq', insumoQtd: 1, insumoUn: 'un' },
    { id: 'pr_pote', nome: 'Pote 100g', categoriaId: 'ct1', preco: 20, ativo: true,
      vinculaEstoque: true, fichaId: 'fi_base' }];
  DB.estoqueUn = []; DB.saldos = {};
  ['in_casq', 'in_leite', 'in_gv'].forEach(function (id) {
    ajustaEstoque(DB.insumos.find(function (i) { return i.id === id; }), 100,
      DB.insumos.find(function (i) { return i.id === id; }).unidade, 1, lojaAtualId());
  });
  salvar(); espelharEstoque();
  var antes = {
    casq: (itemEstoque('in_casq') || {}).estoqueAtual,
    gv: (itemEstoque('in_gv') || {}).estoqueAtual
  };
  var ped = { id: 'pd_est', numero: 900, caixaId: 'cx_r', fase: 'finalizado',
    total: 32, sucursalId: lojaAtualId(), hora: '14:00', data: new Date().toISOString(),
    itens: [{ produtoId: 'pr_casq', nome: 'Casquinha', qtd: 2, unitario: 12, total: 24 },
            { produtoId: 'pr_pote', nome: 'Pote 100g', qtd: 1, unitario: 20, total: 20 }],
    pagamentos: [{ forma: 'fp_cred', valor: 44 }] };
  DB.pedidos.push(ped);
  baixarEstoqueVenda(ped);
  salvar(); espelharEstoque();
  var mv = (DB.movEst || []).find(function (m) { return m.origem === 'venda'; }) || {};
  telaMovimentacao();
  var hm = document.getElementById('content').innerHTML;
  return { antes: antes,
    casq: (itemEstoque('in_casq') || {}).estoqueAtual,
    gv: (itemEstoque('in_gv') || {}).estoqueAtual,
    mvData: mv.data, mvIdent: mv.identificacao,
    linhas: (mv.linhas || []).map(function (l) {
      return l.nome + ' ' + l.direcao + ' ' + l.qtd + ' ' + l.unidade; }),
    relatorioMostra: /Casquinha/.test(hm), relatorioPedido: /900/.test(hm),
    hoje: hojeISO() };
});
t('a venda gera movimento de estoque', !!r.mvIdent, r.mvIdent);
t('com a data de hoje', r.mvData === r.hoje, r.mvData);
t('o produto ligado a INSUMO baixa 2 casquinhas',
  r.antes.casq - r.casq === 2, r.antes.casq + ' → ' + r.casq);
t('o produto ligado a FICHA baixa do destino dela (Gelato Venda)',
  r.gv < r.antes.gv, r.antes.gv + ' → ' + r.gv);
t('o movimento diz item, direção e quantidade',
  r.linhas.length >= 2 && r.linhas.every(function (l) { return /saida/.test(l); }),
  JSON.stringify(r.linhas));
t('e o relatório de Movimentação mostra a baixa', r.relatorioMostra === true);
t('identificando o pedido que a gerou', r.relatorioPedido === true);

await nav.close(); s.close();
console.log('\n'+(falhas?'✗ '+falhas+' de '+feitos+' verificações falharam':'✓ '+feitos+' verificações passaram'));
if(problemas.length){console.log('\nPROBLEMAS:');problemas.forEach(p=>console.log(' · '+p));}
if(erros.length)console.log('\nerros de console: '+JSON.stringify(erros.slice(0,6)));
process.exit(0);
})();

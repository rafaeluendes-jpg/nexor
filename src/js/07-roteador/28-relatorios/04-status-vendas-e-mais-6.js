/* ==========================================================
   CANCELAR VENDA — pelo número, com motivo
   ========================================================== */
var MOTIVOS_CANC=['Cliente desistiu','Erro do operador','Produto em falta',
  'Pedido duplicado','Problema no pagamento','Troca de itens','Outro'];

function cancelarVenda(){
  var cx=caixaAberto();
  var h='<div class="mdB">'+
   '<div class="fld2"><label>Número do pedido *</label>'+
    '<input id="cvNum" inputmode="numeric" placeholder="digite o número do cupom" autocomplete="off">'+
    '<div class="hint">O número aparece no cupom impresso e no cartão do pedido.</div></div>'+
   '<div id="cvAchado"></div>'+
  '</div>';
  var ov=document.createElement('div');ov.className='mdOv';ov.id='mdOv';
  ov.innerHTML='<div class="mdBox lg"><div class="mdH"><b>Cancelar venda</b>'+
   '<button onclick="fecharModal()">&times;</button></div>'+h+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button></div></div>';
  document.body.appendChild(ov);
  fecharSoForaDeVerdade(ov);
  var i=$('cvNum');
  if(i){i.focus();i.oninput=function(){buscarParaCancelar(this.value)};}
}
/* abre direto no pedido, sem passar pela busca por numero */
function pedirCancelamento(id){
  var p=(DB.pedidos||[]).find(function(x){return x.id===id});
  if(!p)return;
  if(ehCancelado(p)){toast('Este pedido ja esta cancelado.');return;}
  if(!motivosCancAtivos().length){
    toast('Cadastre um motivo em Configuracao da Loja > Motivo de Cancelamento.');
    return;
  }
  var ov=document.createElement('div');ov.className='mdOv';ov.id='mdOv';
  ov.innerHTML='<div class="mdBox lg"><div class="mdH"><b>Cancelar venda #'+E(p.numero)+'</b>'+
   '<button onclick="fecharModal()">&times;</button></div>'+
   '<div class="mdB">'+cartaoCancelamento(p)+'</div>'+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button></div></div>';
  document.body.appendChild(ov);
  fecharSoForaDeVerdade(ov);
}
function buscarParaCancelar(num){
  var box=$('cvAchado');
  if(!box)return;
  num=String(num||'').trim();
  if(!num){box.innerHTML='';return;}
  var p=(DB.pedidos||[]).find(function(x){return String(x.numero)===num});
  if(!p){
    box.innerHTML='<div class="cncVazio">'+sv('search',20)+
     '<span>Nenhum pedido com o número <b>'+E(num)+'</b></span></div>';
    return;
  }
  if(ehCancelado(p)){
    box.innerHTML='<div class="cncVazio jaCanc">'+sv('help',20)+
     '<span>O pedido <b>#'+E(num)+'</b> já está cancelado.</span></div>';
    return;
  }
  box.innerHTML=cartaoCancelamento(p);
}
/* O cartao virou funcao para servir as duas portas: a busca por numero e
   o cancelamento pelo Kanban. Antes o Kanban cancelava direto, sem motivo
   e sem senha — e o cancelamento nao aparecia no relatorio. */
function cartaoCancelamento(p){
  var pg=(p.pagamentos||[]).map(function(g){
    var f=(DB.formasPag||[]).find(function(x){return x.id===g.formaId||x.id===g.forma});
    return (f?f.nome:'—')+' R$ '+money(g.valor);
  }).join(' · ');
  return '<div class="cncCard">'+
   '<div class="cncH"><b>#'+E(p.numero)+'</b>'+
    '<span>'+dataBR(String(p.data).slice(0,10))+' às '+E(p.hora||'')+'</span>'+
    '<span class="cidTag">'+(p.tipo==='entrega'?'Entrega':'Frente de caixa')+'</span></div>'+
   '<div class="cncCli">'+E(p.clienteNome||'Consumidor')+'</div>'+
   '<div class="cncItens">'+(p.itens||[]).map(function(i){
     return '<div><span>'+i.qtd+'× '+E(i.nome)+'</span><b>R$ '+money(i.total)+'</b></div>';
   }).join('')+'</div>'+
   '<div class="cncTot"><span>Total</span><b>R$ '+money(p.total)+'</b></div>'+
   (pg?'<div class="cncPg">'+sv('cash',12)+' '+E(pg)+'</div>':'')+
   '<div class="fld2 cncCampo"><label>Motivo do cancelamento *</label>'+
    '<select id="cvMot">'+
    '<option value="">Escolha o motivo</option>'+
    motivosCancAtivos().map(function(m){
      return '<option value="'+E(m.id)+'">'+E(m.nome)+'</option>'}).join('')+
    '</select>'+
    (motivosCancAtivos().length?''
     :'<div class="hint">Nenhum motivo ativo. Cadastre em Configuracao da Loja &rsaquo; Motivo de Cancelamento.</div>')+
   '</div>'+
   /* ==========================================================
      A PERGUNTA QUE DECIDE O ESTOQUE

      Antes o cancelamento SEMPRE devolvia tudo ao estoque. Mas gelato
      montado, cascao recheado e batido pronto ja consumiram o insumo:
      devolver so inventa saldo que nao existe na loja.

      Agora quem cancela responde: foi produzido?
        SIM  — o insumo ja foi gasto: o estoque NAO volta.
        NAO  — nada foi tirado da cuba: o estoque volta.

      O dinheiro sai do faturamento nos dois casos, e o cancelamento e
      sempre da nota inteira — nunca de parte dela.
      ========================================================== */
   '<div class="cncProd">'+
    '<div class="cncProdT">Esse pedido já foi produzido?</div>'+
    '<div class="cncProdB">'+
     '<label class="cncOp"><input type="radio" name="cvProd" value="sim" '+
      'onchange="pintarProduzido()"><span><b>Sim, já foi feito</b>'+
      '<small>o insumo já saiu — o estoque não volta</small></span></label>'+
     '<label class="cncOp"><input type="radio" name="cvProd" value="nao" '+
      'onchange="pintarProduzido()"><span><b>Não, não chegou a ser feito</b>'+
      '<small>nada saiu da cuba — o estoque volta</small></span></label>'+
    '</div>'+
    '<div class="hint" id="cvProdHint">Escolha uma das duas para continuar.</div>'+
   '</div>'+
   '<div class="fld2 cncCampo"><label>Observação</label>'+
    '<input id="cvObs" placeholder="detalhe, se precisar"></div>'+
   /* Quem cancela assina. Antes ia como "Administrador" ou o nome de quem
      abriu o caixa, mesmo que outra pessoa estivesse na maquina. */
   '<div class="cncDupla">'+
    '<div class="fld2" style="margin:0"><label>Quem esta cancelando *</label>'+
     '<select id="cvOp" onchange="pedeSenhaCancel()">'+
     '<option value="">Selecione</option>'+
     operadoresPara('cancelar').map(function(o){
       return '<option value="'+E(o.id)+'">'+E(o.nome)+'</option>'}).join('')+
     '</select></div>'+
    '<div class="fld2" style="margin:0"><label>Senha *</label>'+
     '<input id="cvSenha" type="password" placeholder="senha de acesso" autocomplete="off">'+
     '</div>'+
   '</div>'+
   '<div class="cncAviso">'+sv('help',14)+
    '<div>Ao cancelar: o estoque volta, o valor sai do faturamento e '+
    'o gerente é avisado no WhatsApp.</div></div>'+
   '<button class="btnP2 rdB" style="width:100%;justify-content:center;margin-top:12px" '+
    'onclick="confirmarCancelamento(\''+p.id+'\')">'+sv('x2',13)+' Cancelar a venda #'+E(p.numero)+'</button>'+
  '</div>';
}
/* mostra a senha so quando o operador escolhido tem senha cadastrada */
function produzidoEscolhido(){
  var r=document.querySelector('input[name="cvProd"]:checked');
  return r?r.value:'';
}
function pintarProduzido(){
  var v=produzidoEscolhido();
  Array.prototype.forEach.call(document.querySelectorAll('.cncOp'),function(l){
    var i=l.querySelector('input');
    l.classList.toggle('on', !!i&&i.checked);
  });
  var h=$('cvProdHint');
  if(h)h.textContent = v==='sim'
    ? 'O estoque NÃO volta: o insumo já foi consumido na produção.'
    : (v==='nao' ? 'O estoque volta: os itens retornam ao saldo da loja.'
                 : 'Escolha uma das duas para continuar.');
}
function pedeSenhaCancel(){
  var i=$('cvSenha');
  if(i){i.value='';i.focus();}
}
/* Quem pode cancelar: quem opera o PDV ou a frente de caixa. A mesma regra
   que o banco aplica na politica "cancelamentos: grava quem opera caixa" —
   escrita uma vez aqui para a tela nao divergir do banco. */
function podeCancelarVenda(){
  try{
    if(ehPlataforma()||ehFranqueadora())return true;
    return podeVer('pdv','pdv')||podeVer('financeira','frente-caixa');
  }catch(e){ _quieto(e,'podeCancelarVenda'); return false; }
}
async function confirmarCancelamento(id){
  var p=(DB.pedidos||[]).find(function(x){return x.id===id});
  if(!p)return;
  /* ==========================================================
     PERMISSAO CONFERIDA ANTES DE CRIAR A OPERACAO
     Era aqui a origem da faixa "1 tabela nao subiu — sem permissao para
     cancelamentos". A tela criava o cancelamento sem perguntar se a pessoa
     podia cancelar; o registro entrava na fila; o banco recusava com 403,
     corretamente; a fila guardava para tentar de novo; e o aviso voltava a
     cada sincronizacao, para sempre. Tentar de novo nunca ia resolver:
     falta de permissao nao melhora com o tempo.
     Agora a conferencia vem antes. Sem permissao, nada e criado — e o banco
     continua conferindo de novo, que a tela nao e seguranca.
     ========================================================== */
  if(!podeCancelarVenda()){
    toast('Você não possui permissão para cancelar vendas.');
    fecharModal();
    return;
  }
  var motId=($('cvMot')||{}).value||'';
  if(!motId){toast('Escolha o motivo do cancelamento.');return;}
  var mot=(DB.motivosCanc||[]).find(function(m){return m.id===motId});
  var motivo=mot?mot.nome:'';
  var obs=($('cvObs')||{}).value||'';

  /* quem cancela se identifica com a mesma senha que usa para abrir o caixa */
  var opId=($('cvOp')||{}).value||'';
  if(!opId){toast('Selecione quem esta cancelando.');return;}
  var op=operAtivos().find(function(o){return o.id===opId});
  if(!op){toast('Operador nao encontrado.');return;}
  /* sem senha cadastrada, nao ha o que conferir — mas a tela avisa, para
     ninguem achar que houve conferencia quando nao houve */
  /* mesma porta de todas as acoes do caixa: lista unica, senha e permissao */
  op=await autorizar('cancelar',op.id,($('cvSenha')||{}).value||'');
  if(!op)return;
  /* ==========================================================
     PRODUZIDO DECIDE O ESTOQUE — E NAO TEM PADRAO

     Sem resposta o sistema nao adivinha: chutar "nao produzido" inventa
     saldo que a loja nao tem, e chutar "produzido" some com item que
     ainda esta na cuba. Os dois erros so aparecem na contagem, semanas
     depois, quando ninguem lembra do cancelamento.
     ========================================================== */
  var prod=produzidoEscolhido();
  if(!prod){
    toast('Responda se o pedido já foi produzido.');
    var cx0=document.querySelector('.cncProd'); if(cx0)cx0.scrollIntoView({block:'center'});
    return;
  }
  var foiProduzido = (prod==='sim');
  var ok=await confirmar({
    titulo:'Cancelar a venda #'+p.numero,
    texto:E(p.clienteNome||'Consumidor'),
    linhas:[['Valor','R$ '+money(p.total),'vr'],
            ['Itens',String((p.itens||[]).length),''],
            ['Motivo',motivo,''],
            ['Produzido',foiProduzido?'Sim':'Não',''],
            ['Estoque',foiProduzido?'não volta':'volta para o saldo',''],
            ['Quem cancela',op.nome,'']],
    aviso:(foiProduzido
      ? 'O pedido já foi produzido: o estoque NÃO volta, porque o insumo já foi consumido. '
      : 'O pedido não foi produzido: os itens voltam para o estoque. ')+
      'O valor sai do faturamento e o gerente é avisado. A venda é cancelada por '+
      'inteiro. Esta ação fica registrada e não pode ser desfeita.',
    ok:'Confirmar cancelamento',tipo:'perigo'});
  if(!ok)return;
  var antes=p.fase;
  var cx=caixaAberto();
  p.fase='cancelado';
  p.canceladoEm=new Date().toISOString();
  p.motivoCancelamento=motivo+(obs?' — '+obs:'');
  p.canceladoPor=op.nome;
  /* registro proprio: e dele que o relatorio de Cancelamentos vive */
  DB.cancelamentos=DB.cancelamentos||[];
  var reg={id:uid('cn'),pedidoId:p.id,numero:p.numero,
    valor:Number(p.total)||0,data:hojeISO(),hora:agoraHM(),
    motivoId:motId,motivo:motivo,obs:obs,
    produzido:foiProduzido,
    estoqueVoltou:!foiProduzido,
    operadorId:op.id,operador:op.nome,
    caixaId:cx?cx.id:'',turno:cx?(cx.turno||''):''};
  DB.cancelamentos.push(reg);
  p.produzidoNoCancelamento=foiProduzido;
  /* o estoque so volta quando NAO foi produzido. O valor sai do faturamento
     nos dois casos — quem cuida disso e a fase 'cancelado', que o relatorio
     ja desconta. */
  try{
    if(antes!=='cancelado'&&!foiProduzido)estornarEstoqueVenda(p);
  }catch(e){_quieto(e,'confirmarCancelamento')}
  salvar();
  fecharModal();
  if(PDV.aba==='pedidos')renderKanban();
  avisarCliente(p,'cancelado');
  toast('Venda #'+p.numero+' cancelada por '+op.nome+
    (foiProduzido?' — estoque não voltou (já produzido).':' — itens devolvidos ao estoque.'));
  if(NUVEM.ligada)sincronizar();
  avisarGerente(p.sucursalId||lojaAtualId(),'cancelamento',
    msgCancelamento(p,p.motivoCancelamento));
  /* ==========================================================
     O CANCELAMENTO NAO IMPRIMIA NADA

     Sangria e abertura saem no papel para alguem assinar; cancelar uma
     venda, que tira dinheiro do faturamento na frente do cliente, nao
     saia. Agora oferece — sem obrigar, como as outras.

     Os 120 ms sao os mesmos da sangria: o modal deste cancelamento
     ainda esta fechando, e abrir o proximo em cima empilha dois
     overlays.
     ========================================================== */
  setTimeout(function(){ perguntaImprimirCancelamento(p,reg); },120);
}




/* ---------- a tela do cadastro de status ---------- */
function telaStatusVendas(){
  baseStatus();
  var lst=DB.statusVenda.slice().sort(function(a,b){return (a.ordem||0)-(b.ordem||0)});
  var ativos=lst.filter(function(x){return x.ativo!==false});
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Status de Vendas</h1>'+
    '<p>Cada status ligado vira uma coluna no Kanban do PDV, na ordem daqui. '+
    'O <b>papel</b> e o que o sistema entende do status — e por ele que o estoque volta '+
    'no cancelamento e a venda entra no faturamento quando termina.</p></div>'+
    '<button class="infoBt" onclick="explicaStatus()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2 ok" onclick="formStatus()">'+sv('plus',14)+' Novo status</button>'+
   '</div>'+

   '<div class="stPrev"><div class="stPrevH">Como o Kanban vai ficar</div>'+
   '<div class="stCols" id="stPrevBox">'+previaStatusHTML()+'</div></div>'+

   '<div class="pnl2"><div class="pnl2H">Status cadastrados <span class="cnt2">'+lst.length+'</span></div>'+
   '<div class="pnl2B" style="padding:0">'+
   '<table class="pTable finTab"><thead><tr>'+
    '<th style="width:70px">Ordem</th>'+
    '<th>Descricao</th>'+
    '<th style="width:150px">Papel</th>'+
    '<th style="width:96px;text-align:center">Tempo</th>'+
    '<th style="width:86px;text-align:center">Alerta</th>'+
    '<th style="width:88px;text-align:center">Ativo</th>'+
    '<th style="width:112px"></th></tr></thead><tbody id="stCorpo">'+
   linhasStatusHTML()+'</tbody></table>'+
   '</div></div></div></div>';
  rodape(ativos.length+' status ligados de '+lst.length);
}
function previaStatusHTML(){
  var ativos=statusAtivos();
  if(!ativos.length)return '<div class="hint">Nenhum status ligado — o Kanban ficaria vazio.</div>';
  return ativos.map(function(x){
    return '<div class="stCol" style="--sc:'+E(x.cor||'#8A8578')+'">'+
     '<b>'+E(x.nome)+'</b>'+
     '<span>'+E(nomePapel(x.papel))+'</span>'+
     (x.minutos?'<i>'+sv('clock',10)+' '+x.minutos+' min</i>':'')+
     (x.som?'<i>'+sv('bell',10)+' alerta</i>':'')+
     '</div>';
  }).join('');
}
function linhasStatusHTML(){
  baseStatus();
  var lst=DB.statusVenda.slice().sort(function(a,b){return (a.ordem||0)-(b.ordem||0)});
  return lst.map(function(x,i){
     var pedidos=(DB.pedidos||[]).filter(function(p){return p.fase===x.id}).length;
     return '<tr'+(x.ativo===false?' class="off"':'')+'>'+
      /* so o subir: com ele da para chegar a qualquer ordem, e a coluna
         fica limpa. O descer era um botao a mais sem serventia. */
      '<td><div class="stOrd">'+
       (i>0?'<button class="rBtn" onclick="moverStatus(\''+x.id+'\',-1)" title="Subir">'+
        sv('cima',12)+'</button>':'<span class="stTopo">1&ordf;</span>')+
      '</div></td>'+
      '<td><b><span class="stPt" style="background:'+E(x.cor||'#8A8578')+'"></span>'+E(x.nome)+'</b>'+
       (pedidos?'<small>'+pedidos+' pedido(s) neste status</small>':'')+'</td>'+
      '<td><span class="stPap">'+E(nomePapel(x.papel))+'</span></td>'+
      '<td style="text-align:center">'+(x.minutos?x.minutos+' min':'—')+'</td>'+
      '<td style="text-align:center">'+(x.som?sv('bell',13):'—')+'</td>'+
      '<td style="text-align:center"><label class="flagBox">'+
       '<input type="checkbox" '+(x.ativo!==false?'checked':'')+
       ' onchange="togStatus(\''+x.id+'\')"></label></td>'+
      '<td><div class="rowAct">'+
       '<button class="rBtn" onclick="formStatus(\''+x.id+'\')" title="Editar">'+sv('edit',12)+'</button>'+
       '<button class="rBtn rd" onclick="excluirStatus(\''+x.id+'\')" title="Excluir">'+sv('trash',12)+'</button>'+
      '</div></td></tr>';
  }).join('');
}
/* Clicar na chave refazia a tela toda: o cabecalho, a previa e a tabela
   eram destruidos e desenhados de novo, e o navegador piscava a cada
   toque. Agora so a previa e as linhas mudam — o resto fica parado. */
function redesenharStatus(){
  var pv=$('stPrevBox'), tb=$('stCorpo');
  if(!pv||!tb){telaStatusVendas();return;}
  pv.innerHTML=previaStatusHTML();
  tb.innerHTML=linhasStatusHTML();
  var l=statusAtivos().length, t=(DB.statusVenda||[]).length;
  rodape(l+' status ligados de '+t);
}
function explicaStatus(){
  confirmar({titulo:'Status de Vendas',texto:'O que o papel decide',
   linhas:[['Cancelado','o estoque volta e a venda sai do faturamento',''],
           ['Finalizado','a venda conta como concluida nos relatorios',''],
           ['Em entrega','o pedido aparece para acerto de entregador',''],
           ['Os demais','sao etapas do caminho, sem efeito no dinheiro','']],
   aviso:'O nome do status voce escolhe. O papel e o que o sistema entende — por isso '+
    'precisa existir sempre um status de papel Cancelado e um de papel Finalizado ligados. '+
    'Sem eles o PDV nao consegue concluir nem cancelar uma venda.',
   ok:'Entendi',cancelar:null}).then(function(){});
}
function formStatus(id){
  baseStatus();
  var x=id?statusVenda(id):null;
  var cores=['#8A8578','#C9922F','#1F5F8B','#0E8A46','#B4542F','#7A4E9B','#00A08B'];
  modal(x?'Editar status da venda':'Novo status da venda',
  '<div class="mdB">'+
   '<div class="fld2"><label>Descricao *</label>'+
    '<input id="stNome" value="'+E(x?x.nome:'')+'" placeholder="Em preparacao, Pronto, Saiu..."></div>'+
   '<div class="fld2"><label>O que este status significa *</label>'+
    '<select id="stPapel">'+PAPEIS.map(function(p){
      return '<option value="'+p.id+'"'+((x?x.papel:'producao')===p.id?' selected':'')+'>'+
       E(p.n)+' — '+E(p.d)+'</option>';
    }).join('')+'</select>'+
    '<div class="hint">E por aqui que o sistema sabe o que fazer com o pedido. '+
     'O nome acima pode ser o que voce quiser.</div></div>'+
   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
    '<div class="fld2"><label>Tempo limite (minutos)</label>'+
     '<input id="stMin" type="number" min="0" value="'+(x?x.minutos||0:0)+'">'+
     '<div class="hint">0 = sem aviso. Passou disso, o cartao fica vermelho no Kanban.</div></div>'+
    '<div class="fld2"><label>Cor da coluna</label>'+
     '<div class="stCores">'+cores.map(function(c){
       return '<label class="stCor'+((x?x.cor:cores[1])===c?' on':'')+'" style="background:'+c+'">'+
        '<input type="radio" name="stCor" value="'+c+'"'+((x?x.cor:cores[1])===c?' checked':'')+'></label>';
     }).join('')+'</div></div>'+
   '</div>'+
   '<label class="chkL"><input type="checkbox" id="stSom" '+(x&&x.som?'checked':'')+'>'+
    '<span>Emitir alerta sonoro quando um pedido chegar neste status</span></label>'+
   '<label class="chkL"><input type="checkbox" id="stConf" '+(x&&x.confPag?'checked':'')+'>'+
    '<span>Conferir o pagamento antes de sair deste status</span></label>'+
   '<div class="hint">Para ligar ou desligar este status no Kanban, use a chave da '+
    'coluna <b>Ativo</b> na lista — nao precisa entrar aqui.</div>'+
  '</div>','Salvar',function(){
    var nome=$('stNome').value.trim();
    if(!nome){toast('Informe a descricao do status.');return false;}
    var papel=$('stPapel').value;
    var cor='#C9922F';
    var rs=document.querySelectorAll('input[name="stCor"]');
    for(var i=0;i<rs.length;i++)if(rs[i].checked)cor=rs[i].value;
    var o={nome:nome,papel:papel,cor:cor,minutos:parseInt($('stMin').value,10)||0,
      som:$('stSom').checked,confPag:$('stConf').checked};
    /* o ativo nao e mexido aqui: quem edita o nome nao perde o que ja estava ligado */
    if(x)Object.assign(x,o);
    else DB.statusVenda.push(Object.assign({id:uid('st'),ordem:DB.statusVenda.length,ativo:true},o));
    salvar();redesenharStatus();toast(x?'Status atualizado.':'Status criado.');
    if(NUVEM.ligada)sincronizar();
    return true;
  });
}
function togStatus(id){
  var x=statusVenda(id);if(!x)return;
  if(x.ativo!==false&&(x.papel==='cancelado'||x.papel==='finalizado')){
    var sobra=statusAtivos().filter(function(y){return y.papel===x.papel&&y.id!==id});
    if(!sobra.length){
      toast('Precisa haver ao menos um status ativo com o papel '+nomePapel(x.papel)+'.');
      redesenharStatus();return;
    }
  }
  x.ativo=(x.ativo===false);
  salvar();redesenharStatus();
  if(NUVEM.ligada)sincronizar();
}
function moverStatus(id,d){
  baseStatus();
  var l=DB.statusVenda.slice().sort(function(a,b){return (a.ordem||0)-(b.ordem||0)});
  var i=l.findIndex(function(x){return x.id===id});
  if(i<0||i+d<0||i+d>=l.length)return;
  var t=l[i];l[i]=l[i+d];l[i+d]=t;
  l.forEach(function(x,k){x.ordem=k});
  salvar();redesenharStatus();
  if(NUVEM.ligada)sincronizar();
}
async function excluirStatus(id){
  var x=statusVenda(id);if(!x)return;
  var usados=(DB.pedidos||[]).filter(function(p){return p.fase===id}).length;
  if(usados){
    confirmar({titulo:'Nao da para excluir',texto:E(x.nome),
     linhas:[['Pedidos neste status',String(usados),'vr']],
     aviso:'Ha pedidos parados neste status. Se ele sumisse, esses pedidos ficariam sem '+
      'coluna no Kanban. Mova os pedidos primeiro, ou apenas desative o status.',
     ok:'Entendi',cancelar:null}).then(function(){});
    return;
  }
  var sobra=DB.statusVenda.filter(function(y){return y.papel===x.papel&&y.id!==id});
  if((x.papel==='cancelado'||x.papel==='finalizado')&&!sobra.length){
    toast('Este e o unico status com papel '+nomePapel(x.papel)+'. Sem ele o PDV trava.');
    return;
  }
  var ok=await confirmar({titulo:'Excluir status',texto:E(x.nome),
    aviso:'A coluna some do Kanban. Nenhum pedido esta neste status.',
    ok:'Excluir',tipo:'perigo'});
  if(!ok)return;
  DB.statusVenda=DB.statusVenda.filter(function(y){return y.id!==id});
  salvar();redesenharStatus();toast('Status excluido.');
  if(NUVEM.ligada)sincronizar();
}

/* ---------- alerta sonoro ----------
   Sem arquivo de som: o proprio navegador gera o bipe. Assim funciona
   offline e nao depende de nada hospedado. */
var _audioCtx=null;
function bipe(){
  try{
    _audioCtx=_audioCtx||new (window.AudioContext||window.webkitAudioContext)();
    var t=_audioCtx.currentTime;
    [880,1180].forEach(function(hz,i){
      var o=_audioCtx.createOscillator(),g=_audioCtx.createGain();
      o.type='sine';o.frequency.value=hz;
      g.gain.setValueAtTime(0.0001,t+i*0.16);
      g.gain.exponentialRampToValueAtTime(0.22,t+i*0.16+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001,t+i*0.16+0.14);
      o.connect(g);g.connect(_audioCtx.destination);
      o.start(t+i*0.16);o.stop(t+i*0.16+0.16);
    });
  }catch(e){_quieto(e,'bipe')}
}
/* quanto tempo o pedido esta parado no status atual, em minutos */
function minutosNoStatus(p){
  var q=p.statusEm||p.data;
  if(!q)return 0;
  var d=new Date(q);
  if(isNaN(d))return 0;
  return Math.floor((Date.now()-d.getTime())/60000);
}
function atrasado(p){
  var st=statusVenda(p.fase);
  if(!st||!st.minutos)return false;
  return minutosNoStatus(p)>st.minutos;
}


/* ==========================================================
   RELATÓRIO DE MESAS
   Quanto cada mesa rendeu, quantas contas fechou e o ticket.
   ========================================================== */
var RM={de:'',ate:''};
function telaRelMesas(){
  baseMesas();
  if(!RM.de){var d=new Date();
    RM.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    RM.ate=hojeISO();}
  var peds=(DB.pedidos||[]).filter(function(p){
    if(!p.mesaId&&!p.mesa)return false;
    if(ehCancelado(p))return false;
    var d=diaLocal(p.data);
    return (!RM.de||d>=RM.de)&&(!RM.ate||d<=RM.ate);
  });
  var porMesa={};
  peds.forEach(function(p){
    var k=String(p.mesa||'—');
    if(!porMesa[k])porMesa[k]={mesa:k,contas:0,valor:0,taxa:0,itens:0};
    var x=porMesa[k];
    x.contas++;x.valor+=Number(p.total)||0;x.taxa+=Number(p.taxaServico)||0;
    x.itens+=(p.itens||[]).reduce(function(a,i){return a+(Number(i.qtd)||0)},0);
  });
  var lst=Object.keys(porMesa).map(function(k){return porMesa[k]})
    .sort(function(a,b){return b.valor-a.valor});
  var totV=lst.reduce(function(a,x){return a+x.valor},0);
  var totC=lst.reduce(function(a,x){return a+x.contas},0);
  var totT=lst.reduce(function(a,x){return a+x.taxa},0);

  $('content').innerHTML='<div class="finWrap">'+
  '<div class="finTop"><div><h1>Vendas por Mesa</h1>'+
  '<p>Contas fechadas no salão, por mesa. Só entram vendas concluídas — cancelada não conta.</p></div>'+
  '<div class="finActs">'+
   '<button class="infoBt" onclick="explicaRelMesas()">'+sv('help',15)+'</button>'+
   '<button class="btnP2" onclick="exportarMesas()">'+sv('file',14)+' Exportar CSV</button>'+
  '</div></div>'+
  '<div class="filtroCard">'+
   '<div class="fl"><label>De</label><input type="date" id="rmDe" value="'+RM.de+'"></div>'+
   '<div class="fl"><label>Até</label><input type="date" id="rmAte" value="'+RM.ate+'"></div>'+
   '<button class="btnP2 ok" onclick="RM.de=$(\'rmDe\').value;RM.ate=$(\'rmAte\').value;telaRelMesas()">'+
    sv('search',14)+' Buscar</button>'+
   '<div style="flex:1"></div>'+
   '<div class="fcResumo">'+
    '<div><span>Contas</span><b>'+totC+'</b></div>'+
    '<div><span>Faturamento</span><b>R$ '+money(totV)+'</b></div>'+
    '<div><span>Ticket médio</span><b>R$ '+money(totC?totV/totC:0)+'</b></div>'+
    (totT?'<div><span>Taxa de serviço</span><b>R$ '+money(totT)+'</b></div>':'')+
   '</div>'+
  '</div>'+
  '<div class="pnl2"><div class="pnl2H">Mesas <span class="cnt2">'+lst.length+'</span></div>'+
  '<div class="pnl2B" style="padding:0">'+
  (lst.length?'<table class="pTable finTab"><thead><tr>'+
   '<th>Mesa</th>'+
   '<th style="width:96px;text-align:center">Contas</th>'+
   '<th style="width:96px;text-align:center">Itens</th>'+
   '<th style="width:120px;text-align:right">Ticket médio</th>'+
   '<th style="width:120px;text-align:right">Taxa</th>'+
   '<th style="width:130px;text-align:right">Faturamento</th></tr></thead><tbody>'+
   lst.map(function(x){
     return '<tr><td><b>Mesa '+E(x.mesa)+'</b></td>'+
     '<td style="text-align:center">'+x.contas+'</td>'+
     '<td style="text-align:center">'+x.itens+'</td>'+
     '<td style="text-align:right">R$ '+money(x.contas?x.valor/x.contas:0)+'</td>'+
     '<td style="text-align:right">R$ '+money(x.taxa)+'</td>'+
     '<td style="text-align:right"><b>R$ '+money(x.valor)+'</b></td></tr>';
   }).join('')+'</tbody></table>'
  :'<div class="entVazio"><b>Nenhuma conta de mesa no período</b>'+
   '<span>Ajuste as datas e clique em Buscar.</span></div>')+
  '</div></div></div>';
  rodape(totC+' contas de mesa no período');
}
function explicaRelMesas(){
  confirmar({titulo:'Como este relatório é montado',texto:'Vendas por Mesa',
   linhas:[['O que entra','vendas fechadas no salão, com mesa marcada',''],
           ['O que não entra','cancelamentos, delivery e balcão sem mesa',''],
           ['Ticket médio','faturamento dividido pelo número de contas','']],
   aviso:'Uma conta é um fechamento. Se a mesa 1 fechou unificado para quatro pessoas, '+
    'isso conta como UMA conta — que é o que interessa para medir giro de mesa.',
   ok:'Entendi',cancelar:null}).then(function(){});
}
function exportarMesas(){
  var peds=(DB.pedidos||[]).filter(function(p){
    if(!p.mesaId&&!p.mesa)return false;
    if(ehCancelado(p))return false;
    var d=diaLocal(p.data);
    return (!RM.de||d>=RM.de)&&(!RM.ate||d<=RM.ate);});
  if(!peds.length){toast('Nada para exportar no período.');return;}
  var l=[['Pedido','Data','Hora','Mesa','Comanda','Itens','Taxa de servico','Total']];
  peds.forEach(function(p){
    l.push([p.numero,dataBR(String(p.data).slice(0,10)),p.hora||'',p.mesa||'',
      p.comandaNome||'',(p.itens||[]).length,
      String(p.taxaServico||0).replace('.',','),
      String(p.total||0).replace('.',',')]);
  });
  baixarCSV('nexor-vendas-por-mesa.csv',l);
}

/* ==========================================================
   MODELO DE IMPRESSAO
   O cupom deixa de ser codigo e vira texto editavel. Cada linha
   do modelo e uma linha do papel; o que esta entre chaves e
   trocado pelo dado do pedido na hora de imprimir.
   ========================================================== */
var IMP={tipo:'ficha',rascunho:null};

/* Os tres papeis que saem da impressora. A mesa ja fica pronta
   mesmo antes do modulo de mesas existir: quando ele chegar, o
   modelo ja esta ali e nao vira obra nova. */
var IMP_TIPOS=[
 {id:'ficha',  n:'Ficha',   d:'sai na frente de caixa: uma via para o cliente, outra para a producao'},
 {id:'entrega',n:'Entrega', d:'sai no pedido de delivery, com endereco e telefone'},
 {id:'mesa',   n:'Mesa',    d:'conta da mesa, para quando o modulo de mesas entrar'}
];

var IMP_PADRAO={
 ficha:
  '{c}{n}{loja}{/n}\n'+
  '{c}{cnpj}\n'+
  '{c}{endereco}\n'+
  '{linha}\n'+
  '{c}{g}FICHA{/g}\n'+
  '{d}{data} - {hora}\n'+
  'Senha: {n}{g}{senha}{/g}{/n}\n'+
  'Cliente: {cliente}\n'+
  'Pedido: {numero}\n'+
  '{linha}\n'+
  'Qt.Descricao|Valor\n'+
  '{linha}\n'+
  '{itens}\n'+
  '{linha}\n'+
  'Quantidade de itens:|{qtd_itens}\n'+
  '{linha}\n'+
  'Total itens(=)|{subtotal}\n'+
  '{?acrescimo}Acrescimo(+)|{acrescimo}\n'+
  '{?desconto}Desconto(-)|{desconto}\n'+
  '{n}TOTAL(=)|{total}{/n}\n'+
  '{linha}\n'+
  'Forma de pagamento\n'+
  '{pagamentos}\n'+
  '{linha}\n'+
  '{c}{barras}\n'+
  '{c}Pedido {numero}\n'+
  '{c}Op: {operador}\n'+
  '{branco}\n'+
  '{c}{p}{loja} - Joia{/p}\n'+
  '{corte}',
 entrega:
  '{c}{n}{loja}{/n}\n'+
  '{c}{cnpj}\n'+
  '{c}{endereco}\n'+
  '{linha}\n'+
  '{c}{g}ENTREGA{/g}\n'+
  '{d}{data} - {hora}\n'+
  'Pedido: {n}{g}#{numero}{/g}{/n}\n'+
  'Cliente: {cliente}\n'+
  '{?fone_cliente}Telefone: {fone_cliente}\n'+
  '{linha}\n'+
  '{n}{end_entrega}{/n}\n'+
  '{?bairro}{bairro}\n'+
  '{?obs}Obs: {obs}\n'+
  '{linha}\n'+
  'Qt.Descricao|Valor\n'+
  '{linha}\n'+
  '{itens}\n'+
  '{linha}\n'+
  'Quantidade de itens:|{qtd_itens}\n'+
  '{linha}\n'+
  'Total itens(=)|{subtotal}\n'+
  '{?taxa}Taxa de entrega(+)|{taxa}\n'+
  '{?acrescimo}Acrescimo(+)|{acrescimo}\n'+
  '{?desconto}Desconto(-)|{desconto}\n'+
  '{n}TOTAL(=)|{total}{/n}\n'+
  '{linha}\n'+
  'Forma de pagamento\n'+
  '{pagamentos}\n'+
  '{linha}\n'+
  '{c}Op: {operador}\n'+
  '{branco}\n'+
  '{c}{p}{loja} - Joia{/p}\n'+
  '{corte}',
 mesa:
  '{c}{n}{loja}{/n}\n'+
  '{c}{cnpj}\n'+
  '{c}{endereco}\n'+
  '{linha}\n'+
  '{c}{g}MESA {mesa}{/g}\n'+
  '{d}{data} - {hora}\n'+
  'Pedido: {numero}\n'+
  '{?cliente}Cliente: {cliente}\n'+
  '{linha}\n'+
  'Qt.Descricao|Valor\n'+
  '{linha}\n'+
  '{itens}\n'+
  '{linha}\n'+
  'Quantidade de itens:|{qtd_itens}\n'+
  '{linha}\n'+
  'Total itens(=)|{subtotal}\n'+
  '{?acrescimo}Acrescimo(+)|{acrescimo}\n'+
  '{?desconto}Desconto(-)|{desconto}\n'+
  '{n}TOTAL(=)|{total}{/n}\n'+
  '{linha}\n'+
  '{c}{p}Este documento nao tem valor fiscal{/p}\n'+
  '{c}Op: {operador}\n'+
  '{branco}\n'+
  '{c}{p}{loja} - Joia{/p}\n'+
  '{corte}'
};

/* ==========================================================
   O MODELO EM BLOCOS
   A primeira versao desta tela pedia que o dono da loja aprendesse
   uma linguagem de chaves para mexer no cupom. Errado: quem mexe
   nisso quer ligar e desligar pedacos, nao programar. Agora o
   modelo e uma lista de blocos; o texto com chaves continua vivo
   por baixo, gerado a partir dos blocos, e so aparece para quem
   pedir o modo avancado.
   ========================================================== */
var BLOCOS=[
 {t:'loja',    n:'Cabecalho da loja', d:'nome, CNPJ e endereco'},
 {t:'titulo',  n:'Titulo',            d:'FICHA, ENTREGA, MESA...'},
 {t:'datahora',n:'Data e hora',       d:'quando o pedido saiu'},
 {t:'senha',   n:'Senha de retirada', d:'numero grande para chamar o cliente'},
 {t:'numero',  n:'Numero do pedido',  d:''},
 {t:'cliente', n:'Cliente',           d:'nome e, se quiser, telefone'},
 {t:'entrega', n:'Endereco de entrega',d:'rua, numero e bairro'},
 {t:'mesa',    n:'Mesa',              d:'numero da mesa em destaque'},
 {t:'obs',     n:'Observacao do pedido',d:'so sai se tiver observacao'},
 {t:'itens',   n:'Lista de itens',    d:'com ou sem preco'},
 {t:'qtd',     n:'Quantidade de itens',d:''},
 {t:'totais',  n:'Totais',            d:'subtotal, taxa, desconto e total'},
 {t:'pagam',   n:'Formas de pagamento',d:''},
 {t:'barras',  n:'Codigo de barras',  d:'do numero do pedido'},
 {t:'operador',n:'Operador',          d:'quem esta no caixa'},
 {t:'texto',   n:'Texto livre',       d:'o que voce quiser escrever'},
 {t:'linha',   n:'Traco divisorio',   d:''},
 {t:'branco',  n:'Espaco em branco',  d:''},
 {t:'corte',   n:'Cortar o papel',    d:'sempre por ultimo'}
];
function nomeBloco(t){var b=BLOCOS.find(function(x){return x.t===t});return b?b.n:t;}

/* blocos -> texto com chaves. E este texto que o motor de impressao le,
   entao a previa e a impressora continuam sendo as mesmas de antes. */
function blocosParaModelo(bs){
  var L=[];
  (bs||[]).forEach(function(b){
    if(b.on===false)return;
    switch(b.t){
      case 'loja':
        if(b.nome!==false)L.push('{c}{n}{loja}{/n}');
        if(b.cnpj!==false)L.push('{?cnpj}{c}{cnpj}');
        if(b.endereco!==false)L.push('{?endereco}{c}{endereco}');
        if(b.telefone)L.push('{?telefone}{c}Tel: {telefone}');
        break;
      case 'titulo':   L.push('{c}{g}'+(b.texto||'FICHA')+'{/g}'); break;
      case 'datahora': L.push('{d}{data} - {hora}'); break;
      case 'senha':    L.push('Senha: {n}{g}{senha}{/g}{/n}'); break;
      case 'numero':   L.push('Pedido: {n}{numero}{/n}'); break;
      case 'cliente':
        L.push('Cliente: {cliente}');
        if(b.telefone)L.push('{?fone_cliente}Telefone: {fone_cliente}');
        break;
      case 'entrega':
        /* sem `{?}` a linha do endereco saia em branco e em negrito
           quando o pedido nao tinha rua — um vazio no meio do cupom */
        L.push('{?end_entrega}{n}{end_entrega}{/n}');
        L.push('{?bairro}{bairro}');
        break;
      case 'mesa':     L.push('{c}{g}MESA {mesa}{/g}'); break;
      case 'obs':      L.push('{?obs}Obs: {obs}'); break;
      case 'itens':
        if(b.cabecalho!==false){
          L.push(b.preco===false?'Qt.Descricao':'Qt.Descricao|Valor');
          L.push('{linha}');
        }
        L.push(b.preco===false?'{itens_sem_preco}':'{itens}');
        break;
      case 'qtd':      L.push('Quantidade de itens:|{qtd_itens}'); break;
      case 'totais':
        if(b.subtotal!==false)L.push('Total itens(=)|{subtotal}');
        if(b.taxa!==false)L.push('{?taxa}Taxa de entrega(+)|{taxa}');
        if(b.acrescimo!==false)L.push('{?acrescimo}Acrescimo(+)|{acrescimo}');
        if(b.desconto!==false)L.push('{?desconto}Desconto(-)|{desconto}');
        L.push('{n}TOTAL(=)|{total}{/n}');
        break;
      case 'pagam':    L.push('Forma de pagamento');L.push('{pagamentos}'); break;
      case 'barras':   L.push('{c}{barras}');L.push('{c}Pedido {numero}'); break;
      case 'operador':
        L.push('{c}Op: {operador}'+(b.turno?' - {turno}':''));
        break;
      case 'texto':
        (b.texto||'').split('\n').forEach(function(t){
          L.push((b.al==='c'?'{c}':b.al==='d'?'{d}':'')+(b.peq?'{p}'+t+'{/p}':t));});
        break;
      case 'linha':    L.push('{linha}'); break;
      case 'branco':   L.push('{branco}'); break;
      case 'corte':    L.push('{corte}'); break;
    }
  });
  /* Desligar um bloco deixava o traco dele orfao: quatro riscos seguidos no
     papel. Aqui o traco repetido vira um so, e o que sobra no fim some. */
  var lim=[];
  L.forEach(function(l){
    if(l==='{linha}'&&lim[lim.length-1]==='{linha}')return;
    lim.push(l);
  });
  while(lim.length&&(lim[lim.length-1]==='{linha}'||lim[lim.length-1]==='{branco}'))lim.pop();
  return lim.join('\n');
}

/* o que cada modelo traz de fabrica, ja em blocos */
function blocosPadrao(tipo){
  var b=[{t:'loja',on:true,nome:true,cnpj:true,endereco:true,telefone:false},
         {t:'linha',on:true},
         {t:'titulo',on:true,texto:tipo==='entrega'?'ENTREGA':tipo==='mesa'?'':'FICHA'},
         {t:'datahora',on:true}];
  if(tipo==='mesa'){b[2]={t:'mesa',on:true};}
  if(tipo==='ficha')b.push({t:'senha',on:true});
  b.push({t:'numero',on:true});
  b.push({t:'cliente',on:true,telefone:tipo==='entrega'});
  if(tipo==='entrega'){
    b.push({t:'linha',on:true});
    b.push({t:'entrega',on:true});
    b.push({t:'obs',on:true});
  }
  b.push({t:'linha',on:true});
  b.push({t:'itens',on:true,preco:true,cabecalho:true});
  b.push({t:'linha',on:true});
  b.push({t:'qtd',on:true});
  b.push({t:'linha',on:true});
  b.push({t:'totais',on:true,subtotal:true,taxa:tipo==='entrega',acrescimo:true,desconto:true});
  b.push({t:'linha',on:true});
  b.push({t:'pagam',on:tipo!=='mesa'});
  if(tipo==='ficha'){b.push({t:'linha',on:true});b.push({t:'barras',on:true});}
  b.push({t:'operador',on:true,turno:false});
  b.push({t:'branco',on:true});
  b.push({t:'texto',on:true,al:'c',peq:true,texto:'Sem valor fiscal'});
  b.push({t:'corte',on:true});
  return b;
}

function baseImp(){
  DB.modelosImp=DB.modelosImp||[];
  /* este era o mais exposto: recriava POR TIPO, entao bastava um tipo faltar
     na lista para nascer um modelo novo a cada abertura. */
  if(NUVEM.ligada&&!DB._baixouUmaVez&&!DB.modelosImp.length)return DB.modelosImp;
  IMP_TIPOS.forEach(function(t,i){
    if(!DB.modelosImp.some(function(m){return m.tipo===t.id}))
      DB.modelosImp.push({id:uid('mi'),tipo:t.id,nome:t.n,colunas:34,vias:1,
        corte:true,gaveta:false,modelo:IMP_PADRAO[t.id],blocos:blocosPadrao(t.id),
        manual:false,ativo:true});
  });
  /* modelo vindo de versao anterior nao tinha blocos */
  DB.modelosImp.forEach(function(m){
    if(!m.blocos||!m.blocos.length){m.blocos=blocosPadrao(m.tipo);m.manual=!!m.manual;}
  });
  /* ==========================================================
     A LETRA DE FABRICA ERA PEQUENA DEMAIS NO PAPEL

     48 colunas na bobina de 80 mm da 2,6 mm de letra. Na tela parece
     bom; impresso, no balcao, o operador nao le. A loja de Santa Fe do
     Sul testou e devolveu: "nao da pra ver".

     Quem nunca escolheu o tamanho — modelo ainda com as 48 colunas de
     fabrica — passa para 32 colunas, que e letra 50% maior. Uma vez
     so: a partir daqui quem manda e o controle "Tamanho da letra" da
     tela, inclusive para voltar a 48 se a loja preferir.
     ========================================================== */
  if(!(DB._semeado&&DB._semeado.letraImp)){
    DB.modelosImp.forEach(function(m){
      if(Number(m.colunas)===48)m.colunas=34;   /* 80 mm, letra maior */
    });
    DB._semeado=DB._semeado||{}; DB._semeado.letraImp=true;
  }
  /* ==========================================================
     A CORRECAO NAO CHEGOU EM TODOS OS MODELOS

     O aumento acima marcou `letraImp` e nunca mais rodou. So que na
     loja os tres modelos continuaram em 48 colunas — a marca ficou
     gravada antes de os modelos existirem, e eles nasceram depois com
     o padrao antigo. Em 30/08/2026 o Rafael devolveu o cupom da
     entrega: "essa impressao esta muito pequena e ruim, nao da pra ver
     nada". Era 2,6 mm de letra.

     Esta segunda passada tem marca propria e alcanca esses. Continua
     valendo uma vez so, e continua sendo o controle "Tamanho da letra"
     da tela quem manda a partir daqui — inclusive para voltar a 48.
     ========================================================== */
  if(!(DB._semeado&&DB._semeado.letraImp2)){
    DB.modelosImp.forEach(function(m){
      if(Number(m.colunas)===48)m.colunas=34;
    });
    DB._semeado=DB._semeado||{}; DB._semeado.letraImp2=true;
  }

  return DB.modelosImp;
}
function modeloImp(tipo){
  baseImp();
  return DB.modelosImp.find(function(m){return m.tipo===tipo})||null;
}
/* o texto que vale para imprimir: montado dos blocos, ou o escrito a mao */
function textoDoModelo(m){
  if(!m)return '';
  return m.manual?(m.modelo||''):blocosParaModelo(m.blocos||[]);
}

/* ---------- os dados que entram no lugar das chaves ---------- */
function dadosImp(ped){
  baseSuc();
  /* ==========================================================
     O CUPOM SAIA COM O NOME DA LOJA ERRADA

     Aqui estava `(DB.sucursais||[])[0]` — a PRIMEIRA unidade da lista,
     que e a matriz. Numa rede de seis lojas isso significa que todo
     cupom impresso em qualquer unidade saia com o nome da matriz no
     cabecalho. Em 29/08/2026 a loja de Santa Fe do Sul imprimiu a
     ficha do pedido 504 com "Alphaville" escrito em cima.

     Nao e detalhe de aparencia: e o comprovante que o cliente leva, e
     o endereco e o telefone impressos embaixo eram os de outra cidade.

     Quem manda e a unidade em que a pessoa esta logada. Se por algum
     motivo ela nao for encontrada, cai na primeira — como antes — em
     vez de imprimir sem cabecalho nenhum.
     ========================================================== */
  var _suc=(DB.sucursais||[]);
  /* o pedido sabe onde foi feito; so quando ele nao sabe e que vale a
     unidade em que a pessoa esta agora. Assim uma segunda via tirada
     em outra loja sai com o nome da loja que vendeu */
  var _id=(ped&&ped.sucursalId)||'';
  if(!_id){ try{ _id=lojaAtualId()||''; }catch(e){} }
  var s=_suc.find(function(x){return x&&x.id===_id})||_suc[0]||{};
  var cx=caixaAberto()||{};
  var sub=(ped.itens||[]).reduce(function(a,i){return a+(Number(i.total)||0)},0);
  var end=[s.endereco,s.cidade,s.uf].filter(Boolean).join(', ');
  return {
    loja:s.apelido||s.nome||'Loja',
    cnpj:s.cnpj?('CNPJ: '+s.cnpj):'',
    endereco:end,
    telefone:s.telefone||'',
    data:dataBR(String(ped.data||hojeISO()).slice(0,10)),
    hora:ped.hora||agoraHM(),
    numero:String(ped.numero||''),
    senha:String(ped.senha||ped.numero||''),
    /* ==========================================================
       O NOME NA COMANDA MANDA NA LINHA DO CLIENTE

       O atendente escreve o primeiro nome na tela de pagamento so para
       achar o pedido na bancada. Ele sai AQUI, na linha "Cliente:" que
       todo modelo ja imprime — ficha, entrega e mesa — sem precisar
       que a loja mexa no modelo de impressao.

       Quando ha cliente identificado de verdade (entrega, fiado), o
       nome dele continua mandando: ali a linha e o destinatario, nao um
       apelido de balcao.
       ========================================================== */
    /* `clienteNome` vale 'Consumidor' na venda de balcao — texto, e
       portanto verdadeiro. Encadear com `||` faria o nome escrito nunca
       aparecer. Quem decide e ter cliente IDENTIFICADO. */
    cliente:(ped.clienteId?ped.clienteNome:'')||ped.nomeComanda||
            ped.clienteNome||'Consumidor',
    nome_comanda:ped.nomeComanda||'',
    /* ==========================================================
       PEDIDO SEM ENDERECO PROCURA NO CADASTRO DO CLIENTE

       O pedido passou a carregar a rua, mas os que ja estao gravados
       nao carregam. O endereco desses nao se perdeu: no aceite do
       cardapio ele SEMPRE foi para a ficha do cliente (rua, numero,
       ref). Entao, quando o pedido nao tem, buscamos ali — e a
       segunda via de uma entrega de ontem sai completa.
       ========================================================== */
    fone_cliente:ped.clienteFone||_cliDoPedido(ped).tel||'',
    end_entrega:enderecoDeEntrega(ped.endereco)||
                enderecoDeEntrega(_cliDoPedido(ped)),
    /* o bairro escrito pela pessoa vem primeiro; a regiao da taxa entra
       do lado, porque ela e o que explica o valor da entrega. Pedido
       antigo, sem bairro escrito, continua saindo com a regiao — que e
       o que sempre saiu. */
    bairro:bairroDoPedido(ped),
    mesa:String(ped.mesa||''),
    canal:ped.canal||'',
    obs:ped.obs||'',
    qtd_itens:String((ped.itens||[]).reduce(function(a,i){return a+(Number(i.qtd)||0)},0)),
    subtotal:money(sub),
    taxa:Number(ped.taxa)?money(ped.taxa):'',
    acrescimo:Number(ped.acrescimo)?money(ped.acrescimo):'',
    desconto:Number(ped.desconto)?money(ped.desconto):'',
    total:money(ped.total),
    recebido:money((ped.pagamentos||[]).reduce(function(a,g){
      var val=Number(g.valor)||0;
      var rec=(g.recebido===undefined||g.recebido===null)?val:(Number(g.recebido)||0);
      return a+rec;
    },0)),
    /* vazio quando nao ha troco: com `{?troco}` a linha some sozinha */
    troco:trocoDoPedido(ped)>0.009?money(trocoDoPedido(ped)):'',
    operador:cx.operador||'—',
    turno:cx.turno||''
  };
}

/* a ficha do cliente do pedido, ou um objeto vazio — nunca nulo, para
   quem chama nao precisar conferir */
function _cliDoPedido(ped){
  try{
    var id=ped&&ped.clienteId;
    if(!id)return {};
    return (DB.clientes||[]).find(function(c){return c.id===id})||{};
  }catch(e){ return {}; }
}
/* ---------- o motor: modelo + pedido = linhas de papel ----------
   Devolve uma lista de {txt, al, n, g, p, corte, barras} — cru, sem
   HTML. Quem desenha (previa) e quem imprime usam a mesma lista, e e
   por isso que a previa nao mente. */
function montarImp(modelo,ped,cols){
  var d=dadosImp(ped);
  var out=[];
  function preenche(t){
    return String(t).replace(/\{([a-z_]+)\}/g,function(todo,k){
      return (d[k]!==undefined)?d[k]:todo;});
  }
  String(modelo||'').split('\n').forEach(function(ln){
    /* {?campo} no comeco: a linha so sai se o campo tiver conteudo */
    var cond=ln.match(/^\{\?([a-z_]+)\}/);
    if(cond){
      if(!d[cond[1]])return;
      ln=ln.replace(/^\{\?[a-z_]+\}/,'');
    }
    if(/^\{linha\}\s*$/.test(ln)){out.push({tipo:'linha'});return;}
    if(/^\{branco\}\s*$/.test(ln)){out.push({tipo:'txt',txt:'',al:'e'});return;}
    if(/^\{corte\}\s*$/.test(ln)){out.push({tipo:'corte'});return;}
    if(/^\{itens\}\s*$/.test(ln)){linhasItens(ped,cols,true).forEach(function(x){out.push(x)});return;}
    if(/^\{itens_sem_preco\}\s*$/.test(ln)){linhasItens(ped,cols,false).forEach(function(x){out.push(x)});return;}
    if(/^\{pagamentos\}\s*$/.test(ln)){linhasPag(ped,cols).forEach(function(x){out.push(x)});return;}

    var al='e';
    if(/^\{c\}/.test(ln)){al='c';ln=ln.replace(/^\{c\}/,'');}
    else if(/^\{d\}/.test(ln)){al='d';ln=ln.replace(/^\{d\}/,'');}

    var neg=/\{n\}/.test(ln), gr=/\{g\}/.test(ln), pq=/\{p\}/.test(ln);
    var temBarras=/\{barras\}/.test(ln);
    ln=ln.replace(/\{\/?[ngp]\}/g,'');

    if(temBarras){
      ln=ln.replace(/\{barras\}/,'');
      out.push({tipo:'barras',txt:preenche(d.numero),al:al});
      if(!ln.trim())return;
    }
    ln=preenche(ln);

    /* a barra vertical separa o que fica na esquerda do que encosta na direita */
    if(ln.indexOf('|')>=0){
      var p=ln.split('|');
      var esq=p[0],dir=p.slice(1).join('|');
      var largura=gr?Math.floor(cols/2):cols;
      var espaco=largura-esq.length-dir.length;
      ln=esq+(espaco>0?new Array(espaco+1).join(' '):' ')+dir;
      al='e';
    }
    /* Linha maior que o papel: quebra na palavra. Sem isto a impressora
       corta ou embola sozinha, e a previa mentiria sobre o resultado.
       Letra grande ocupa o dobro, entao cabe metade. */
    var larg=gr?Math.floor(cols/2):cols;
    quebrar(ln,larg).forEach(function(t){
      out.push({tipo:'txt',txt:t,al:al,n:neg,g:gr,p:pq});
    });
  });
  return out;
}
function quebrar(txt,larg){
  txt=String(txt==null?'':txt);
  if(txt.length<=larg)return [txt];
  var r=[],linha='';
  txt.split(' ').forEach(function(p){
    /* palavra sozinha maior que o papel: parte no meio, nao ha alternativa */
    while(p.length>larg){
      if(linha){r.push(linha);linha='';}
      r.push(p.slice(0,larg));p=p.slice(larg);
    }
    if(!linha)linha=p;
    else if((linha+' '+p).length<=larg)linha+=' '+p;
    else {r.push(linha);linha=p;}
  });
  if(linha)r.push(linha);
  return r;
}
/* ==========================================================
   AS OPCOES DO ITEM, SEPARADAS PELO GRUPO DO CADASTRO

   Devolve [{titulo, itens:[...]}] na ordem dos grupos. O que nao tiver
   grupo conhecido volta num bloco sem titulo, que imprime como antes.
   ========================================================== */
function gruposDasOpcoes(item){
  var esc=(item&&item.opcoes)||[];
  if(!esc.length)return [];
  var simples=[{titulo:'',itens:esc}];
  try{
    var todos=(DB.grupos||[]);
    if(!todos.length)return simples;
    /* os grupos DESTE produto desempatam: a mesma opcao existe em mais
       de um grupo de sabores */
    var prod=(DB.produtos||[]).find(function(x){return x.id===item.produtoId})||
             (DB.produtos||[]).find(function(x){return x.nome===item.nome});
    var ids=(prod&&prod.grupos)||[];
    var doProduto=todos.filter(function(g){return ids.indexOf(g.id)>=0});
    var ordem=function(g,i){return (g.ordem==null?i:Number(g.ordem)); };
    var procurar=function(nome,lista){
      for(var k=0;k<lista.length;k++){
        var g=lista[k];
        if((g.opcoes||[]).some(function(o){return String(o.nome)===String(nome)}))
          return g;
      }
      return null;
    };
    var porId=function(id){
      if(!id)return null;
      return todos.find(function(g){return g.id===id})||null;
    };
    var blocos=[],semGrupo=[],achouAlgum=false;
    esc.forEach(function(o){
      var nome=(o&&o.nome)||o;
      /* o PDV grava o grupo dentro da opcao (`grupo`): quando ele vem,
         nao ha o que adivinhar. Procurar pelo nome fica para o que vem
         do cardapio, que manda so nome e preco. */
      var g=porId(o&&o.grupo)||procurar(nome,doProduto)||procurar(nome,todos);
      if(!g){semGrupo.push(o);return;}
      achouAlgum=true;
      /* ==========================================================
         "Cascao Adicional:" NAO CABE E NAO AJUDA

         O titulo era o nome do grupo do cadastro — "Sabores Gelatos 1
         Sabor:", "Cascao Adicional:". Num papel de 34 colunas isso
         ocupa a linha inteira e a loja devolveu: "ficou tudo muito
         confuso".

         Quem monta o gelato so precisa saber duas coisas: o que e
         SABOR e o que e ADICIONAL. Grupo cujo nome fala em sabor vira
         "Sabores"; todo o resto — cascao, borda, cobertura, calda —
         vira "Adicionais", que e o que eles sao. O adicional vem
         primeiro, porque e ele que muda o preco.
         ========================================================== */
      var ehSabor=/sabor/i.test(g.nome||'');
      var chave=ehSabor?'sab':'adi';
      var b=blocos.find(function(x){return x.id===chave});
      if(!b){ b={id:chave,titulo:ehSabor?'Sabores':'Adicionais',
        ord:ehSabor?1:0,itens:[]}; blocos.push(b); }
      b.itens.push(o);
    });
    if(!achouAlgum)return simples;
    blocos.sort(function(a,b2){return a.ord-b2.ord});
    if(semGrupo.length)blocos.push({titulo:'',itens:semGrupo});
    return blocos;
  }catch(e){ return simples; }
}
function linhasItens(ped,cols,comPreco){
  var r=[];
  (ped.itens||[]).forEach(function(i,k){
    var q=String(i.qtd||1);
    var val=comPreco?money(i.total):'';
    var largNome=cols-q.length-2-(val?val.length+1:0);
    var nome=String(i.nome||'');
    /* ==========================================================
       O QUE E PRODUTO SALTA AOS OLHOS

       Produto, titulo de bloco e opcao saiam todos com o mesmo peso, um
       embaixo do outro. Num pedido de tres itens — o 609, com dois
       Batidos de 500 e um de 300, cada um com cobertura e ovomaltine —
       viram vinte linhas iguais, e quem monta perde a conta de onde
       comeca um item e acaba o outro.

       Ordem da loja em 30/08/2026: PRODUTO em negrito, o titulo
       "Adicionais"/"Sabores" em negrito, e o resto em letra normal.
       Assim o olho pula de produto em produto, e o que esta debaixo
       dele e claramente detalhe.
       ========================================================== */
    /* ==========================================================
       NOME DE PRODUTO NAO SE PARTE NO MEIO DA PALAVRA

       Isto cortava na coluna exata: "Batido Di Gelato 300 Gram" e, na
       linha de baixo, "as". No papel do pedido 609 sairam tres itens
       assim, e "Gram / as" e o tipo de coisa que faz quem monta parar
       para entender.

       Agora quebra na PALAVRA, como o resto do cupom ja faz, e o valor
       fica encostado na direita da primeira linha.
       ========================================================== */
    var partesN=quebrar(nome,Math.max(6,largNome));
    partesN.forEach(function(t,idx){
      var linha=(idx?new Array(q.length+3).join(' '):(q+'  '))+t;
      if(!idx&&val){
        var esp=cols-linha.length-val.length;
        linha=linha+(esp>0?new Array(esp+1).join(' '):' ')+val;
      }
      r.push({tipo:'txt',txt:linha,al:'e',n:true});
    });
    /* ==========================================================
       SABOR NAO E RODAPE — E CASCAO NAO E SABOR

       Duas coisas erradas na mesma linha.

       A primeira: as opcoes saiam com `p:true` — 85% do tamanho e em
       cinza. Bobina termica nao faz cinza: pontilha, e sai borrao.
       Justo nos SABORES, que sao a unica coisa que a cozinha precisa
       ler para montar o gelato. Sao normais e pretos agora.

       A segunda, do pedido 600 de 30/08/2026: saiam todas embaralhadas
       numa lista so —

           + Cascao Tradicional
           + Leite Ninho Trufado Gelato
           + Jolo Gelato

       Quem monta le tres sabores. Mas o cascao NAO e sabor: e produto
       a parte, do grupo "Cascao Adicional", e custa R$ 3. Os outros
       dois sao os sabores do gelato.

       A separacao nao e chute nosso: cada opcao pertence a um GRUPO no
       cadastro, e e o nome do grupo que vira o titulo. Procuramos
       primeiro nos grupos DO PRODUTO — "Leite Ninho" existe em tres
       grupos de sabores diferentes, e so o produto desempata. Sem
       achar, volta a lista simples de antes: cupom sem grupo e melhor
       do que cupom sem opcao.
       ========================================================== */
    /* opcao com nome comprido — "Cascao Trufado com Castanha de Caju e
       Chocolate Belga" tem 52 caracteres — estourava a bobina: a linha
       era empurrada inteira, sem quebra. Aqui ela desce recuada, como o
       nome do produto ja faz. */
    var recuado=function(txt,rec){
      quebrar(String(txt),Math.max(6,cols-rec.length)).forEach(function(t,k){
        r.push({tipo:'txt',txt:(k?new Array(rec.length+1).join(' '):rec)+t,al:'e'});
      });
    };
    gruposDasOpcoes(i).forEach(function(g){
      if(g.titulo)r.push({tipo:'txt',txt:g.titulo+':',al:'e',n:true});
      g.itens.forEach(function(o){
        /* "1x Cascao Tradicional          3,00" — a quantidade na
           frente e o preco encostado na direita, igual a linha do
           produto. Quem confere le a coluna, nao cava no meio do
           texto. */
        var qt=(Number(o.qtd)||1)+'x ';
        var vl=Number(o.preco)>0?money(o.preco):'';
        var nome=String(o.nome||o);
        var largura=cols-qt.length-(vl?vl.length+1:0);
        var partes=quebrar(nome,Math.max(6,largura));
        partes.forEach(function(t,k){
          var linha=(k?new Array(qt.length+1).join(' '):qt)+t;
          if(!k&&vl&&partes.length===1){
            var esp=cols-linha.length-vl.length;
            linha=linha+(esp>0?new Array(esp+1).join(' '):' ')+vl;
          }
          r.push({tipo:'txt',txt:linha,al:'e'});
        });
        /* nome que precisou de duas linhas: o valor vai sozinho na
           direita embaixo, para nao encavalar */
        if(vl&&partes.length>1){
          var esp2=cols-vl.length;
          r.push({tipo:'txt',txt:(esp2>0?new Array(esp2+1).join(' '):'')+vl,al:'e'});
        }
      });
    });
    if(i.obs)recuado('obs: '+i.obs,'   ');
    /* uma linha de respiro ENTRE os itens — nunca depois do ultimo, que
       so esticaria o papel */
    if(k<(ped.itens||[]).length-1)r.push({tipo:'txt',txt:'',al:'e'});
  });
  if(!r.length)r.push({tipo:'txt',txt:'(sem itens)',al:'e'});
  return r;
}
/* ==========================================================
   O CUPOM TEM DE MOSTRAR O QUE O CLIENTE ENTREGOU E O TROCO

   Aqui saia so `valor` — quanto daquela quantia QUITA a venda. Numa
   venda de R$ 29 paga com R$ 40, o cupom dizia "Dinheiro 29,00" e o
   cliente nao tinha como conferir o troco no papel.

   Os dois numeros ja existem gravados desde a V-do-troco: `valor` e o
   que entra no caixa e `recebido` e o que veio na mao. Quem le o cupom
   quer ver o segundo, e a diferenca embaixo — do jeito que a nota
   fiscal da rede ja imprime:

       Dinheiro                     40,00
       Troco R$                     11,00

   Pedido antigo, gravado antes de `recebido` existir, cai no `valor` —
   e ai nao ha troco a mostrar, que e a verdade daquele pedido.
   ========================================================== */
function linhasPag(ped,cols){
  var r=[];
  var par=function(nm,v){
    nm=String(nm); v=String(v);
    if(nm.length+v.length+1>cols)nm=nm.slice(0,Math.max(0,cols-v.length-1));
    var esp=cols-nm.length-v.length;
    r.push({tipo:'txt',txt:nm+(esp>0?new Array(esp+1).join(' '):' ')+v,al:'e'});
  };
  var troco=0;
  (ped.pagamentos||[]).forEach(function(g){
    var f=(DB.formasPag||[]).find(function(x){return x.id===g.formaId||x.id===g.forma});
    var nm=(f?f.nome:'Pagamento');
    var val=Number(g.valor)||0;
    var rec=(g.recebido===undefined||g.recebido===null)?val:(Number(g.recebido)||0);
    if(rec>val+0.009)troco+=(rec-val);
    par(nm,money(rec));
  });
  if(!r.length){r.push({tipo:'txt',txt:'(nao informado)',al:'e'});return r;}
  if(troco>0.009)par('Troco R$',money(troco));
  return r;
}
/* o troco do pedido, para quem quiser a linha solta no modelo */
function trocoDoPedido(ped){
  return +((ped&&ped.pagamentos||[]).reduce(function(a,g){
    var val=Number(g.valor)||0;
    var rec=(g.recebido===undefined||g.recebido===null)?val:(Number(g.recebido)||0);
    return a+(rec>val?rec-val:0);
  },0)).toFixed(2);
}

/* ---------- desenha o papel na tela ---------- */
function papelHTML(linhas,cols){
  return linhas.map(function(l){
    if(l.tipo==='linha')return '<div class="ppL">'+new Array(cols+1).join('-')+'</div>';
    /* a linha de corte usa dois caracteres por repeticao: com `cols+1`
       ela saia com o DOBRO da largura do papel e estourava a bobina */
    if(l.tipo==='corte')
      return '<div class="ppCorte">'+new Array(Math.floor(cols/2)+1).join('- ')+'</div>';
    if(l.tipo==='barras')
      return '<div class="ppBar"><div class="ppBarG"></div><span>'+E(l.txt)+'</span></div>';
    var cls='ppL';
    if(l.al==='c')cls+=' ct'; else if(l.al==='d')cls+=' dr';
    if(l.n)cls+=' bd'; if(l.g)cls+=' gr'; if(l.p)cls+=' pq';
    return '<div class="'+cls+'">'+(E(l.txt)||'&nbsp;')+'</div>';
  }).join('');
}

/* pedido de mentira, so para a previa mostrar algo parecido com a vida real */
function pedidoExemplo(tipo){
  return {numero:1042,senha:18,data:hojeISO(),hora:agoraHM(),
    clienteNome:tipo==='ficha'?'Consumidor':'Maria da Graca Vitorino',
    clienteFone:'(17) 98116-0247',
    endereco:'Rua Tenente Dercio Lupiano de Assis, 234, Casa',
    zona:'Tres Fronteiras',mesa:'07',obs:tipo==='entrega'?'Interfone quebrado':'',
    itens:[{qtd:2,nome:'Copo 1 Bola',total:26,opcoes:[{nome:'Morango'},{nome:'Chocolate'}]},
           {qtd:1,nome:'Pote M (1kg)',total:65,obs:'sem calda'}],
    taxa:tipo==='entrega'?3:0,acrescimo:0,desconto:0,
    total:tipo==='entrega'?94:91,
    /* a previa paga em dinheiro com nota maior: e assim que o Rafael
       ve, ao configurar, como o troco vai sair no papel */
    pagamentos:[{formaId:(DB.formasPag||[{}])[0].id,
      valor:tipo==='entrega'?94:91,
      recebido:tipo==='entrega'?100:100}]};
}

/* ---------- a tela, agora em blocos ---------- */
function telaModeloImp(){
  baseImp();
  var rol=document.querySelector('.etScroll');
  var topo=rol?rol.scrollTop:0;
  var m=modeloImp(IMP.tipo);
  if(!m.blocos||!m.blocos.length){m.blocos=blocosPadrao(m.tipo);salvar();}
  var papelAtual=papelDoModelo(m);
  var letraAtual=letraDoModelo(m);
  var cols=colunasDaLetra(papelAtual,letraAtual);
  var texto=m.manual?(IMP.rascunho!==null?IMP.rascunho:m.modelo):blocosParaModelo(m.blocos);
  var linhas=montarImp(texto,pedidoExemplo(IMP.tipo),cols);

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Modelo de Impressao</h1>'+
    '<p>Monte o cupom ligando e desligando os pedacos. A previa ao lado mostra como '+
    'sai no papel, com um pedido de exemplo.</p></div>'+
    '<button class="infoBt" onclick="explicaImp()">'+sv('help',15)+'</button>'+
   '</div>'+

   '<div class="impAbas">'+IMP_TIPOS.map(function(t){
     return '<button class="impAba'+(IMP.tipo===t.id?' on':'')+'" onclick="trocarImp(\''+t.id+'\')">'+
      '<b>'+E(t.n)+'</b><span>'+E(t.d)+'</span></button>';
   }).join('')+'</div>'+

   /* ==========================================================
      ONDE A PESSOA VAI PROCURAR QUANDO SOBRAR PAPEL

      O aviso da primeira impressao pode ter sido dispensado, ou a loja
      trocar de computador. Aqui fica de pe, na tela onde ela ja mexe em
      impressao, dizendo o mesmo — texto vindo da MESMA lista, para os
      dois nunca divergirem.
      ========================================================== */
   '<div class="impAjuda">'+
    '<div class="impAjudaH">'+sv('print2',14)+
     '<b>Está saindo papel branco sobrando, com data em cima e o endereço do site embaixo?</b></div>'+
    '<p>Isso não é do Joia — o cupom dele acaba no "Sem valor fiscal". '+
    'Essas duas linhas são do navegador, e a chave delas fica na janela de impressão. '+
    'Ajuste uma vez, em <b>Mais definições</b>:</p>'+
    htmlPassosImpressao()+
   '</div>'+
   '<div class="impGrade">'+
    '<div class="impEdit">'+
     '<div class="impBarra">'+
      '<div class="fl"><label>Largura do papel</label><select id="impPapelMM" onchange="salvarImpCampo()">'+
       '<option value="58"'+(papelAtual===58?' selected':'')+'>58 mm (bobina estreita)</option>'+
       '<option value="80"'+(papelAtual===80?' selected':'')+'>80 mm (bobina larga)</option>'+
      '</select></div>'+
      '<div class="fl"><label>Tamanho da letra</label><select id="impLetra" onchange="salvarImpCampo()">'+
       LETRAS.map(function(L){
         return '<option value="'+L.id+'"'+(letraAtual===L.id?' selected':'')+'>'+
           E(L.n)+' ('+L.cols[papelAtual===58?58:80]+' colunas)</option>';
       }).join('')+
      '</select></div>'+
      '<div class="fl"><label>Quantas vias</label>'+
       '<input type="number" id="impVias" min="1" max="4" value="'+(m.vias||1)+'" onchange="salvarImpCampo()"></div>'+
      '<label class="chkL" style="margin:0"><input type="checkbox" id="impCorte" '+
       (m.corte!==false?'checked':'')+' onchange="salvarImpCampo()"><span>Cortar papel</span></label>'+
      '<label class="chkL" style="margin:0"><input type="checkbox" id="impGaveta" '+
       (m.gaveta?'checked':'')+' onchange="salvarImpCampo()"><span>Abrir gaveta</span></label>'+
     '</div>'+

     (m.manual
      ? '<div class="impAviso">'+sv('help',14)+'<div>Este modelo esta no <b>modo texto</b>. '+
        'Os blocos ficam desligados enquanto voce editar por aqui.</div>'+
        '<button class="btnP2" onclick="voltarBlocos()">Voltar aos blocos</button></div>'+
        '<textarea id="impTxt" class="impTxt" spellcheck="false" '+
        'oninput="IMP.rascunho=this.value;previaImp()">'+E(texto)+'</textarea>'+
        '<div class="impCampos"><span class="impCH">Inserir:</span>'+
        IMP_CAMPOS.map(function(c){
          return '<button class="impChip" title="'+E(c[1])+'" onclick="inserirImp(\''+c[0]+'\')">'+E(c[0])+'</button>';
        }).join('')+'</div>'
      : '<div id="blkBox">'+listaBlocosHTML(m)+'</div>')+

     '<div class="impAcoes">'+
      '<button class="btnP2 ok" onclick="salvarImp()">'+sv('nike',14)+' Salvar modelo</button>'+
      '<button class="btnP2" onclick="testarImp()">'+sv('file',14)+' Imprimir teste</button>'+
      '<div style="flex:1"></div>'+
      '<button class="btnP2 rdB" onclick="restaurarImp()">Restaurar padrao</button>'+
     '</div>'+
     (m.manual?'':'<button class="impAvancado" onclick="modoTexto()">'+
       'Editar como texto (avancado)</button>')+
    '</div>'+
    '<div class="impPrev">'+
     '<div class="impPrevH">Previa'+(m.vias>1?' · '+m.vias+' vias':'')+'</div>'+
     '<div class="papel'+(papelAtual===58?' p58':'')+'" id="impPapel" '+
      'style="width:'+cols+'ch">'+papelHTML(linhas,cols)+'</div>'+
    '</div>'+
   '</div>'+
   '</div></div>';
  var novoRol=document.querySelector('.etScroll');
  if(novoRol&&topo)novoRol.scrollTop=topo;
  rodape('modelo de '+m.nome);
  /* a folha so tem largura depois de estar na tela */
  setTimeout(function(){ var el=$('impPapel'); if(el)ajustarPrevia(el,cols); },0);
}

function listaBlocosHTML(m){
  var usados={};
  m.blocos.forEach(function(b){usados[b.t]=true});
  var podeAdd=BLOCOS.filter(function(b){
    /* traco, espaco e texto podem repetir; o resto nao faz sentido duas vezes */
    if(['linha','branco','texto'].indexOf(b.t)>=0)return true;
    return !usados[b.t];
  });
  return '<div class="blkLista">'+
   m.blocos.map(function(b,i){
     var op=opcoesBloco(b,i);
     return '<div class="blkIt'+(b.on===false?' off':'')+'">'+
      '<div class="blkH">'+
       '<label class="miniSw"><input type="checkbox" '+(b.on!==false?'checked':'')+
        ' onchange="togBloco('+i+')"><i></i></label>'+
       '<div class="blkN"><b>'+E(nomeBloco(b.t))+'</b>'+
        (resumoBloco(b)?'<span>'+E(resumoBloco(b))+'</span>':'')+'</div>'+
       '<div class="blkAc">'+
        (i>0?'<button class="rBtn" onclick="moverBloco('+i+',-1)" title="Subir">'+sv('cima',12)+'</button>':'')+
        (i<m.blocos.length-1?'<button class="rBtn" onclick="moverBloco('+i+',1)" title="Descer">'+sv('baixo',12)+'</button>':'')+
        '<button class="rBtn rd" onclick="tirarBloco('+i+')" title="Remover">'+sv('trash',11)+'</button>'+
       '</div>'+
      '</div>'+
      (op?'<div class="blkOp">'+op+'</div>':'')+
     '</div>';
   }).join('')+
   '</div>'+
   '<div class="blkAdd">'+
    '<select id="blkNovo"><option value="">+ Adicionar um pedaco...</option>'+
     podeAdd.map(function(b){
       return '<option value="'+b.t+'">'+E(b.n)+(b.d?' — '+E(b.d):'')+'</option>';
     }).join('')+'</select>'+
    '<button class="btnP2" onclick="addBloco()">Adicionar</button>'+
   '</div>';
}
function resumoBloco(b){
  if(b.t==='titulo')return b.texto||'';
  if(b.t==='texto')return (b.texto||'').split('\n')[0];
  if(b.t==='itens')return b.preco===false?'sem preco (via da producao)':'com preco';
  if(b.t==='cliente')return b.telefone?'com telefone':'';
  if(b.t==='loja'){
    var p=[];if(b.nome!==false)p.push('nome');if(b.cnpj!==false)p.push('CNPJ');
    if(b.endereco!==false)p.push('endereco');if(b.telefone)p.push('telefone');
    return p.join(', ');
  }
  if(b.t==='totais'){
    var q=[];if(b.subtotal!==false)q.push('subtotal');if(b.taxa!==false)q.push('taxa');
    if(b.acrescimo!==false)q.push('acrescimo');if(b.desconto!==false)q.push('desconto');
    return q.join(', ');
  }
  if(b.t==='operador')return b.turno?'com turno':'';
  return '';
}
function ck(i,campo,rot,marcado){
  return '<label class="chkMini"><input type="checkbox" '+(marcado?'checked':'')+
   ' onchange="opBloco('+i+',\''+campo+'\',this.checked)"><span>'+rot+'</span></label>';
}
function opcoesBloco(b,i){
  switch(b.t){
    case 'loja':
      return ck(i,'nome','Nome da loja',b.nome!==false)+ck(i,'cnpj','CNPJ',b.cnpj!==false)+
             ck(i,'endereco','Endereco',b.endereco!==false)+ck(i,'telefone','Telefone',!!b.telefone);
    case 'titulo':
      return '<input class="blkInp" value="'+E(b.texto||'')+'" placeholder="FICHA" '+
             'oninput="opBloco('+i+',\'texto\',this.value)">';
    case 'cliente':
      return ck(i,'telefone','Mostrar telefone do cliente',!!b.telefone);
    case 'itens':
      return '<div class="blkEsc">'+
       '<label class="blkOp2'+(b.preco!==false?' on':'')+'"><input type="radio" name="bpr'+i+'"'+
        (b.preco!==false?' checked':'')+' onchange="opBloco('+i+',\'preco\',true)">'+
        '<b>Com preco</b><span>via do cliente</span></label>'+
       '<label class="blkOp2'+(b.preco===false?' on':'')+'"><input type="radio" name="bpr'+i+'"'+
        (b.preco===false?' checked':'')+' onchange="opBloco('+i+',\'preco\',false)">'+
        '<b>Sem preco</b><span>via da producao</span></label>'+
       '</div>'+ck(i,'cabecalho','Mostrar "Qt. Descricao / Valor"',b.cabecalho!==false);
    case 'totais':
      return ck(i,'subtotal','Soma dos itens',b.subtotal!==false)+
             ck(i,'taxa','Taxa de entrega',b.taxa!==false)+
             ck(i,'acrescimo','Acrescimo',b.acrescimo!==false)+
             ck(i,'desconto','Desconto',b.desconto!==false);
    case 'operador':
      return ck(i,'turno','Mostrar o turno junto',!!b.turno);
    case 'texto':
      return '<textarea class="blkInp" rows="2" placeholder="Obrigado pela preferencia!" '+
             'oninput="opBloco('+i+',\'texto\',this.value)">'+E(b.texto||'')+'</textarea>'+
             '<div class="blkEsc2">'+
             ['e','c','d'].map(function(a){
               var nm={e:'Esquerda',c:'Centro',d:'Direita'}[a];
               return '<button class="blkAl'+((b.al||'e')===a?' on':'')+'" '+
                'onclick="opBloco('+i+',\'al\',\''+a+'\')">'+nm+'</button>';
             }).join('')+
             ck(i,'peq','Letra pequena',!!b.peq)+'</div>';
  }
  return '';
}
/* Mexer num bloco redesenhava a tela inteira, e o navegador jogava a
   rolagem de volta para o topo: quem estava mexendo la embaixo era
   arrancado do lugar a cada clique. Agora so a lista e a previa se
   refazem, e a posicao da tela fica onde estava. */
function redesenharBlocos(){
  var m=modeloImp(IMP.tipo);
  var box=$('blkBox');
  if(!box){telaModeloImp();return;}
  box.innerHTML=listaBlocosHTML(m);
  previaImp();
}
function togBloco(i){
  var m=modeloImp(IMP.tipo);
  m.blocos[i].on=(m.blocos[i].on===false);
  salvar();redesenharBlocos();
}
function moverBloco(i,d){
  var m=modeloImp(IMP.tipo),b=m.blocos;
  if(i+d<0||i+d>=b.length)return;
  var x=b[i];b[i]=b[i+d];b[i+d]=x;
  salvar();redesenharBlocos();
}
function tirarBloco(i){
  var m=modeloImp(IMP.tipo);
  m.blocos.splice(i,1);
  salvar();redesenharBlocos();
}
function addBloco(){
  var t=$('blkNovo').value;
  if(!t){toast('Escolha o pedaco que quer acrescentar.');return;}
  var m=modeloImp(IMP.tipo);
  var novo={t:t,on:true};
  if(t==='titulo')novo.texto='TITULO';
  if(t==='texto'){novo.texto='';novo.al='c';}
  if(t==='itens'){novo.preco=true;novo.cabecalho=true;}
  /* o corte e sempre a ultima coisa do papel */
  var iCorte=m.blocos.findIndex(function(b){return b.t==='corte'});
  if(t!=='corte'&&iCorte>=0)m.blocos.splice(iCorte,0,novo);
  else m.blocos.push(novo);
  salvar();redesenharBlocos();
}
/* mexer numa opcao nao pode redesenhar a tela inteira: o cursor pularia
   para fora do campo a cada letra. So a previa se refaz. */
function opBloco(i,campo,valor){
  var m=modeloImp(IMP.tipo);
  m.blocos[i][campo]=valor;
  salvar();
  /* digitando: so a previa, senao o cursor sairia do campo a cada letra */
  if(campo==='texto'){previaImp();return;}
  redesenharBlocos();
}
async function modoTexto(){
  var m=modeloImp(IMP.tipo);
  var ok=await confirmar({titulo:'Editar como texto',texto:'Modelo de '+m.nome,
    aviso:'No modo texto voce escreve o cupom linha a linha, com as chaves. E mais livre, '+
     'mas os blocos param de valer para este modelo. Da para voltar depois — so que a '+
     'volta refaz o modelo a partir dos blocos, e o texto que voce escrever se perde.',
    ok:'Ir para o modo texto'});
  if(!ok)return;
  m.modelo=blocosParaModelo(m.blocos);
  m.manual=true;IMP.rascunho=null;
  salvar();telaModeloImp();
}
async function voltarBlocos(){
  var m=modeloImp(IMP.tipo);
  var ok=await confirmar({titulo:'Voltar aos blocos',texto:'Modelo de '+m.nome,
    aviso:'O modelo volta a ser montado pelos blocos. O texto que voce escreveu se perde.',
    ok:'Voltar aos blocos',tipo:'perigo'});
  if(!ok)return;
  m.manual=false;IMP.rascunho=null;
  if(!m.blocos||!m.blocos.length)m.blocos=blocosPadrao(m.tipo);
  salvar();telaModeloImp();
}
var IMP_CAMPOS=[
 ['{loja}','nome da loja'],['{cnpj}','CNPJ'],['{endereco}','endereco da loja'],
 ['{telefone}','telefone da loja'],
 ['{data}','data do pedido'],['{hora}','hora do pedido'],
 ['{numero}','numero do pedido'],['{senha}','senha de retirada'],
 ['{cliente}','nome do cliente'],['{fone_cliente}','telefone do cliente'],
 ['{end_entrega}','endereco da entrega'],['{bairro}','bairro ou zona'],
 ['{mesa}','numero da mesa'],['{obs}','observacao do pedido'],
 ['{itens}','lista de itens com preco'],['{itens_sem_preco}','itens sem preco (producao)'],
 ['{qtd_itens}','quantidade de itens'],['{subtotal}','soma dos itens'],
 ['{taxa}','taxa de entrega'],['{acrescimo}','acrescimo'],['{desconto}','desconto'],
 ['{total}','total do pedido'],['{pagamentos}','formas de pagamento'],
 ['{recebido}','quanto o cliente entregou'],['{troco}','troco (vazio quando nao ha)'],
 ['{operador}','quem esta no caixa'],['{turno}','turno do caixa'],
 ['{c}','centralizar a linha'],['{d}','alinhar a direita'],
 ['{n}texto{/n}','negrito'],['{g}texto{/g}','letra grande'],['{p}texto{/p}','letra pequena'],
 ['|','empurra o resto para a direita'],
 ['{linha}','traco divisorio'],['{branco}','linha em branco'],
 ['{barras}','codigo de barras'],['{corte}','cortar o papel'],
 ['{?campo}','so imprime se o campo tiver conteudo']
];
function trocarImp(t){IMP.tipo=t;IMP.rascunho=null;telaModeloImp();}
/* ==========================================================
   A PREVIA TEM DE CABER NA COLUNA DA PREVIA

   Ela desenha `cols` caracteres de largura. Com a letra em milimetros
   — como no papel de verdade — 34 colunas ficam mais largas do que o
   painel, e a previa saia cortada na direita: "Valo", "26,0". Quem
   configura precisa ver a linha inteira.

   Entao a previa mantem as colunas e ajusta a letra ate a folha caber
   no painel: e a mesma proporcao do papel, so que na escala da tela.
   Menos colunas continuam aparecendo com letra maior, que e o que se
   quer ver ao escolher o tamanho.
   ========================================================== */
function ajustarPrevia(el,cols){
  try{
    /* `width:<cols>ch` com `box-sizing:border-box` desconta o padding da
       folha: sobrava largura para 33 caracteres num papel de 34, e toda
       linha cheia saia cortada. Na impressao o padding e zero, por isso
       so a previa sofria. */
    el.style.boxSizing='content-box';
    var pai=el.parentElement;
    if(!pai)return;
    var disp=pai.clientWidth-2;
    if(!(disp>40))return;
    var REF=14;
    el.style.fontSize=REF+'px';
    var larg=el.getBoundingClientRect().width;
    if(!(larg>0))return;
    var px=Math.max(7,Math.min(REF,+(REF*disp/larg).toFixed(2)));
    el.style.fontSize=px+'px';
  }catch(e){ _quieto(e,'ajustarPrevia'); }
}
function previaImp(){
  var m=modeloImp(IMP.tipo);
  var papel=parseInt(($('impPapelMM')||{}).value||papelDoModelo(m),10);
  var letra=($('impLetra')||{}).value||letraDoModelo(m);
  var cols=colunasDaLetra(papel,letra);
  var el=$('impPapel');
  if(!el)return;
  var txt=m.manual?(IMP.rascunho!==null?IMP.rascunho:m.modelo):blocosParaModelo(m.blocos);
  el.className='papel'+(papel===58?' p58':'');
  el.style.width=cols+'ch';
  el.innerHTML=papelHTML(montarImp(txt,pedidoExemplo(IMP.tipo),cols),cols);
  ajustarPrevia(el,cols);
}
function inserirImp(txt){
  var ta=$('impTxt');if(!ta)return;
  var i=ta.selectionStart||0,f=ta.selectionEnd||0;
  ta.value=ta.value.slice(0,i)+txt+ta.value.slice(f);
  ta.focus();ta.selectionStart=ta.selectionEnd=i+txt.length;
  IMP.rascunho=ta.value;previaImp();
}
function salvarImpCampo(){
  var m=modeloImp(IMP.tipo);
  m.colunas=colunasDaLetra(parseInt(($('impPapelMM')||{}).value,10)||papelDoModelo(m),
    ($('impLetra')||{}).value||letraDoModelo(m));
  m.vias=parseInt($('impVias').value,10)||1;
  m.corte=$('impCorte').checked;
  m.gaveta=$('impGaveta').checked;
  /* a tela inteira e refeita: cada opcao de letra mostra quantas colunas
     da NAQUELA bobina, entao trocar a bobina muda os rotulos. comRolagem
     devolve a pagina ao ponto em que estava */
  salvar();comRolagem(telaModeloImp);
  if(NUVEM.ligada)sincronizar();
}
function salvarImp(){
  var m=modeloImp(IMP.tipo);
  if(m.manual&&$('impTxt'))m.modelo=$('impTxt').value;
  else m.modelo=blocosParaModelo(m.blocos);
  m.colunas=colunasDaLetra(parseInt(($('impPapelMM')||{}).value,10)||papelDoModelo(m),
    ($('impLetra')||{}).value||letraDoModelo(m));
  m.vias=parseInt($('impVias').value,10)||1;
  m.corte=$('impCorte').checked;
  m.gaveta=$('impGaveta').checked;
  IMP.rascunho=null;
  salvar();telaModeloImp();toast('Modelo de '+m.nome+' salvo.');
  if(NUVEM.ligada)sincronizar();
}
async function restaurarImp(){
  var m=modeloImp(IMP.tipo);
  var ok=await confirmar({titulo:'Restaurar o padrao',texto:'Modelo de '+m.nome,
    aviso:'O modelo volta a ser o que veio de fabrica. O que voce escreveu se perde.',
    ok:'Restaurar',tipo:'perigo'});
  if(!ok)return;
  m.modelo=IMP_PADRAO[m.tipo];m.blocos=blocosPadrao(m.tipo);m.manual=false;IMP.rascunho=null;
  salvar();telaModeloImp();toast('Modelo restaurado.');
  if(NUVEM.ligada)sincronizar();
}
function explicaImp(){
  confirmar({titulo:'Como o modelo funciona',texto:'Modelo de Impressao',
   linhas:[['Uma linha do modelo','e uma linha do papel',''],
           ['{chave}','vira o dado do pedido',''],
           ['A barra |','empurra o que vem depois para a direita',''],
           ['{?campo}','a linha so sai se o campo tiver conteudo','']],
   aviso:'A previa usa um pedido de exemplo e o mesmo motor da impressao — o que voce ve '+
    'e o que sai no papel. Estes tres modelos NAO sao cupom fiscal: o cupom fiscal (NFC-e) '+
    'tem layout definido por lei e sai do emissor, quando a integracao fiscal for feita.',
   ok:'Entendi',cancelar:null}).then(function(){});
}
function testarImp(){
  var m=modeloImp(IMP.tipo);
  var cols=parseInt(($('impCols')||{}).value||m.colunas||48,10);
  var txt=m.manual?(IMP.rascunho!==null?IMP.rascunho:m.modelo):blocosParaModelo(m.blocos);
  imprimirPapel(montarImp(txt,pedidoExemplo(IMP.tipo),cols),cols,1);
}

/* ---------- manda para a impressora ----------
   Sai pelo navegador: a impressora termica instalada no Windows aparece
   como impressora comum. Comando direto ESC/POS (corte e gaveta) exige
   um programa na maquina — ainda nao existe, e os dois campos ficam
   guardados esperando ele. */
/* ==========================================================
   O PAPEL TEM DE TER A LARGURA DAS COLUNAS

   O comprovante e montado com `cols` caracteres por linha (48 na bobina
   de 80 mm, 32 na de 58 mm). Mas a largura vinha de um numero fixo no
   CSS — `width:320px`, fonte 12px — e 48 caracteres de 12px ocupam
   ~346 px. Com `overflow:hidden` no meio, o fim de CADA linha era
   cortado: na bobina da loja saia "R$ 133," em vez de "R$ 133,05".
   Todo valor do fechamento perdia os centavos, e ninguem conseguia
   conferir o caixa pelo papel.

   Aqui a conta passa a ser feita de verdade. A largura util da bobina
   (descontada a margem) dividida pelos caracteres da linha da o tamanho
   da fonte em milimetros — entao `cols` caracteres cabem exatos, seja
   qual for a bobina e qualquer que seja o modelo configurado. Em
   monoespacada, cada caractere mede 0,6 do tamanho da fonte.
   ========================================================== */
/* ==========================================================
   A ALTURA DO PAPEL TEM DE SER DECLARADA EM NUMERO

   Aqui estava escrito `@page{size:80mm auto}`. Parece certo — bobina
   continua, altura livre — mas NAO EXISTE em CSS: `size` aceita
   `auto`, ou uma medida, ou duas medidas; misturar medida com `auto`
   e regra invalida. O navegador descarta a declaracao inteira e cai
   no papel padrao dele, A4. Era isso que fazia o comprovante sair
   "numa folha gigante": a bobina nunca chegou a ser pedida.

   Entao a altura e medida antes de imprimir, no proprio comprovante
   ja montado, e vai declarada em milimetros. Sobram 4 mm no pe para
   o corte.
   ========================================================== */
/* ==========================================================
   LARGURA DO PAPEL E TAMANHO DA LETRA

   O unico controle da tela era "Largura do papel", que gravava 32 ou
   48 em `colunas` — e `colunas` era, ao mesmo tempo, quantos
   caracteres cabem na linha E de que bobina se trata. Amarrados
   assim, nao havia como pedir letra maior: a unica saida era dizer
   que a bobina era estreita, o que fazia o papel sair errado.

   Agora sao duas coisas. `papel` e a bobina em milimetros, e
   `colunas` e quantos caracteres cabem na linha — que e exatamente o
   que define o tamanho da letra: menos colunas na mesma bobina,
   letra maior.
   ========================================================== */
/* ==========================================================
   A BOBINA CONTINUA MORANDO DENTRO DE `colunas`

   O certo seria um campo `papel` proprio. Ele nao existe na tabela do
   banco de producao, e criar coluna em banco de loja aberta e decisao
   do Rafael, nao minha. Entao os valores de coluna sao escolhidos de
   modo que nao se confundam: de 34 para cima e bobina de 80 mm, de 32
   para baixo e 58 mm. Nenhum numero serve as duas.

   Quando a coluna `papel` existir, `papelDoModelo` passa a le-la e
   nada mais muda.
   ========================================================== */
var LETRAS=[
  {id:'normal', n:'Normal', cols:{80:48, 58:32}},
  {id:'grande', n:'Grande', cols:{80:40, 58:28}},
  {id:'maior',  n:'Maior',  cols:{80:34, 58:24}}
];
function papelDoModelo(m){
  if(!m)return 80;
  var p=Number(m.papel)||0;
  if(p===58||p===80)return p;
  return (Number(m.colunas)||48)>=34?80:58;
}
function letraDoModelo(m){
  var p=papelDoModelo(m), c=Number(m&&m.colunas)||48;
  var achou=LETRAS.find(function(L){return L.cols[p]===c});
  return achou?achou.id:'normal';
}
function colunasDaLetra(papel,letra){
  var L=LETRAS.find(function(x){return x.id===letra})||LETRAS[0];
  return L.cols[papel===58?58:80];
}
/* ==========================================================
   A LARGURA DA LETRA NAO SE ADIVINHA, SE MEDE

   O tamanho da fonte era calculado com `cols * 0.6` — um chute do
   quanto cada caractere ocupa numa fonte monoespacada. So que 0,6 nao
   e verdade em fonte nenhuma em particular: no Consolas do Windows a
   letra ocupa 0,55, no DejaVu do Linux 0,602. Errar para menos deixa
   ate 8% da bobina em branco e a letra menor do que podia ser.

   Agora o proprio navegador responde: `.papel` tem largura de `cols`
   caracteres (`width:<cols>ch`), entao basta medir o elemento com uma
   fonte de referencia e escalar. Da certo em qualquer fonte, em
   qualquer maquina.
   ========================================================== */
/* ==========================================================
   A FOLHA ACABA ONDE ACABA O TEXTO

   Primeiro foram 3 mm em cima e 4 embaixo. A loja olhou e pediu mais:
   cortar rente — em cima no "Jolo Santa Fe do Sul", embaixo no "Sem
   valor fiscal", sem faixa branca nenhuma.

   1 mm e o rente possivel: com zero, o arredondamento do navegador
   come a perna do "p" e do "g" da ultima linha. Os lados ficam em 2,
   que e o que a bobina pede para nao comer o ultimo caractere.

   O que sobrar de papel depois disso ja nao e da folha: e o avanco
   que a propria impressora da para a ultima linha passar pela
   guilhotina, e a janela de impressao do navegador quando esta com
   cabecalho e rodape ligados.
   ========================================================== */
var MARGEM_TOPO=0, MARGEM_PE=1, MARGEM_LADO=2;
/* o texto e um so, para a tela de ajuste e o aviso da hora da impressao
   nunca divergirem */
var PASSOS_IMPRESSAO=[
  ['Mais definições','abra essa parte da janela, no fim da lista'],
  ['Margens: Nenhuma','é o que tira a faixa branca em volta'],
  ['Cabeçalhos e rodapés: desmarcado',
   'é o que apaga a data em cima e o endereço do site embaixo'],
  ['Papel: o da sua bobina','80 mm, ou 58 mm na estreita']
];
function htmlPassosImpressao(){
  return '<ol class="impPassos">'+PASSOS_IMPRESSAO.map(function(p){
    return '<li><b>'+E(p[0])+'</b><span>'+E(p[1])+'</span></li>';
  }).join('')+'</ol>';
}
/* mostrado uma vez por aparelho, na primeira impressao; o Chrome guarda
   o ajuste, entao repetir so atrapalharia quem ja arrumou */
function avisoJanelaImpressao(){
  try{
    if(localStorage.getItem('nexor_impressao_ok'))return;
    var o=document.createElement('div');o.className='mdOv';o.id='mdImpAviso';
    o.innerHTML='<div class="mdBox"><div class="mdH"><b>Ajuste a janela de impressão</b>'+
      '<button onclick="fecharAvisoImpressao(false)">&times;</button></div>'+
      '<div class="mdB"><div class="hint" style="margin-bottom:10px">'+
      'A data em cima e o endereço do site embaixo <b>não são do Joia</b> — são do '+
      'navegador. Na janela que vai abrir agora, ajuste uma vez:</div>'+
      htmlPassosImpressao()+
      '<div class="hint">O Chrome guarda essa escolha para as próximas impressões.</div>'+
      '</div><div class="mdF">'+
      '<button class="btnP2" onclick="fecharAvisoImpressao(false)">Mostrar de novo depois</button>'+
      '<button class="btnP2 ok" onclick="fecharAvisoImpressao(true)">Já ajustei, não mostrar mais</button>'+
      '</div></div>';
    document.body.appendChild(o);
  }catch(e){ _quieto(e,'avisoJanelaImpressao'); }
}
function fecharAvisoImpressao(guardar){
  try{ if(guardar)localStorage.setItem('nexor_impressao_ok','1'); }catch(e){}
  var o=document.getElementById('mdImpAviso'); if(o)o.remove();
}
/* ==========================================================
   A ALTURA DE EMERGENCIA ERA 200 mm FIXOS — E ESSE ERA O BRANCO

   Este e o defeito que fazia o cupom "ficar certo e voltar". Tres
   caminhos de `medirPapel` devolviam `altura:200`: quando nao achava o
   papel, quando a medida vinha zero e quando a medicao estourava. Num
   cupom de 95 mm isso e uma folha de 200 mm — DEZ CENTIMETROS de papel
   branco, e nenhum erro na tela.

   E intermitente por natureza: a medida so falha quando o navegador
   ainda nao fez o layout ou a fonte monoespacada nao terminou de
   carregar. Mesmo sistema, mesma loja, mesma impressora — as vezes sai
   certo, as vezes sai com um palmo de branco. Foi exatamente o que a
   loja relatou tres vezes.

   Numero fixo nao tem como estar certo: ele nao sabe quantas linhas o
   cupom tem. Agora a emergencia CONTA AS LINHAS que estao no papel —
   que estao la, no DOM, mesmo quando a medida falha — e multiplica pela
   entrelinha real do CSS (1,42; a linha grande e ~1,86 e o codigo de
   barras vale por sete). Erra por pouco, e para mais ou para menos,
   nunca por dez centimetros.
   ========================================================== */
function alturaPelasLinhas(el,fonteMM){
  try{
    if(!el||!fonteMM)return 0;
    var alt=0;
    Array.prototype.forEach.call(el.querySelectorAll('.ppL,.ppCorte,.ppBar'),
      function(l){
        if(l.classList.contains('ppBar')){ alt+=fonteMM*7; return; }
        if(l.classList.contains('gr')){ alt+=fonteMM*1.86; return; }
        alt+=fonteMM*1.42;
      });
    if(!(alt>0))return 0;
    return Math.ceil(alt)+MARGEM_TOPO+MARGEM_PE;
  }catch(e){ return 0; }
}
function medirPapel(el,margem,larguraMM,cols){
  var fontePadrao=+((larguraMM-margem*2)/((cols||48)*0.6)).toFixed(3);
  /* o piso nunca e um numero fixo: e o que as linhas pedem */
  var socorro=function(f){
    var porLinha=alturaPelasLinhas(el,f||fontePadrao);
    return Math.max(30,(Number(larguraMM)||80)+2,porLinha||0);
  };
  var padrao={fonte:fontePadrao,altura:socorro(fontePadrao)};
  try{
    var alvo=el.querySelector('.papel');
    if(!alvo)return padrao;
    var antesEl=el.getAttribute('style')||'';
    var antesPad=alvo.style.padding;
    var antesFonte=alvo.style.fontSize;
    el.setAttribute('style','display:block;position:fixed;left:-10000px;top:0;'+
      'visibility:hidden;width:auto;padding:0;margin:0');
    alvo.style.padding='0';
    /* mede com 4 mm e escala para a largura util da bobina */
    var REF=4;
    alvo.style.fontSize=REF+'mm';
    var larg=alvo.getBoundingClientRect().width;
    var utilPx=(larguraMM-margem*2)*96/25.4;
    var fonte=(larg>0)?+(REF*utilPx/larg).toFixed(3):padrao.fonte;
    if(!(fonte>0.5)||!(fonte<20))fonte=padrao.fonte;
    alvo.style.fontSize=fonte+'mm';
    /* forca o layout antes de ler: sem isto a primeira leitura depois de
       trocar a fonte pode voltar zero, e era zero que caia nos 200 mm */
    void alvo.offsetHeight;
    var h=alvo.getBoundingClientRect().height;
    if(!(h>0)){ void el.offsetHeight; h=alvo.getBoundingClientRect().height; }
    alvo.style.padding=antesPad;
    alvo.style.fontSize=antesFonte;
    el.setAttribute('style',antesEl);
    /* medida falhou: cai na conta pelas linhas, com a fonte ja calculada */
    if(!(h>0))return {fonte:fonte,altura:socorro(fonte)};
    /* px do navegador (96 dpi) para mm, mais as margens e o corte */
    /* ==========================================================
       O BRANCO DE CIMA E DE BAIXO, MEDIDO

       Ordem do Rafael em 30/08/2026: 3 mm da borda ate a primeira
       escrita, 4 mm da ultima escrita ate a borda de baixo — os 4 de
       baixo porque e ali que passa o serrilhado do corte.

       A folha e exatamente isso: o texto medido mais 3 em cima e 4
       embaixo. Nada de folga extra somada por cima.
       ========================================================== */
    var mmAlt=Math.ceil(h*25.4/96)+MARGEM_TOPO+MARGEM_PE;
    /* ==========================================================
       PAPEL MAIS BAIXO DO QUE LARGO SAI DEITADO

       O comprovante da abertura tem 14 linhas: dava `size:80mm 60mm`.
       Para o driver da impressora, altura menor que largura e uma
       pagina em PAISAGEM — e ele girou o comprovante 90 graus. Foi o
       que saiu na bobina de Santa Fe do Sul em 29/08/2026: o texto
       correndo ao longo do papel, de lado.

       A folha nunca pode ser mais baixa do que larga. Sobra um pedaco
       de papel em comprovante curto; sair deitado nao e opcao.
       ========================================================== */
    /* ==========================================================
       O PISO SO PRECISA PASSAR DA LARGURA, NAO SOBRAR 8 mm

       O piso nasceu `largura+8`: 88 mm de folha para um comprovante de
       abertura com 50 mm de texto — quase quatro centimetros de papel
       branco em cada retirada, cada abertura e cada cancelamento.

       Medindo o Chromium (ferramentas, 30/08/2026): ele obedece a
       `size` ao milimetro, 80x40 sai 80x40. Quem gira a pagina e o
       DRIVER da impressora, quando a folha e mais larga do que alta.
       Entao basta a altura passar da largura — `+2` ja passa. Os outros
       6 mm eram papel jogado fora.
       ========================================================== */
    var minAlt=(Number(larguraMM)||80)+2;
    return {fonte:fonte,altura:Math.max(30,minAlt,mmAlt)};
  }catch(e){ return padrao; }
}
/* ==========================================================
   COLUNAS E LARGURA DA BOBINA SAO COISAS SEPARADAS

   Ate aqui a largura do papel era deduzida do numero de colunas:
   32 colunas queria dizer bobina de 58 mm. Isso amarra o tamanho da
   letra ao tamanho do papel — e um comprovante curto, como o da
   abertura, fica com letra de 48 colunas sem precisar.

   Agora quem imprime pode dizer as duas coisas: quantas colunas o
   texto tem e qual a bobina. Menos colunas na mesma bobina = letra
   maior. Sem `mmPapel`, vale a regra de antes.
   ========================================================== */
function imprimirPapel(linhas,cols,vias,mmPapel){
  cols=Number(cols)||48;
  /* ==========================================================
     LINHA VAZIA NO FIM E PAPEL JOGADO FORA

     Linha em branco NO MEIO e desenho e fica. No FIM, depois da ultima
     coisa escrita, ela so estica a folha: o comprovante fica mais
     comprido sem nada impresso ali. Some com elas antes de medir — e a
     medida ja sai menor.
     ========================================================== */
  if(Array.isArray(linhas)){
    linhas=linhas.slice();
    var vazia=function(l){
      var t=(l&&typeof l==='object')?l.txt:l;
      return !String(t==null?'':t).trim();
    };
    while(linhas.length&&vazia(linhas[linhas.length-1]))linhas.pop();
  }
  var mm=Number(mmPapel)||(cols<=32?58:80);
  var margem=MARGEM_LADO;                   /* mm de cada lado */
  var util=mm-(margem*2);
  var fonteMM=+(util/(cols*0.6)).toFixed(3);   /* ponto de partida; medido abaixo */
  var el=document.getElementById('viaImp')||document.createElement('div');
  el.id='viaImp';
  var uma='<div class="papel'+(mm<=58?' p58':'')+'" '+
    'style="width:'+cols+'ch;font-size:'+fonteMM+'mm">'+papelHTML(linhas,cols)+'</div>';
  var todas='';
  for(var v=0;v<(vias||1);v++)
    todas+='<div class="papelPg">'+uma+'</div>';
  el.innerHTML=todas;
  document.body.appendChild(el);
  var med=medirPapel(el,margem,mm,cols);
  fonteMM=med.fonte;
  var alturaMM=med.altura;
  /* o papel na tela usa a mesma fonte medida */
  Array.prototype.forEach.call(el.querySelectorAll('.papel'),function(x){
    x.style.fontSize=fonteMM+'mm'; });
  var st=document.getElementById('impCSS')||document.createElement('style');
  st.id='impCSS';
  /* o `padding:10px` do #viaImp somava 2,6 mm de cada lado por cima da
     margem da pagina: o comprovante de 76 mm passava dos 80 mm da
     bobina e o ultimo digito ia embora de novo. Aqui ele e zerado. */
  /* ==========================================================
     `@page{margin:0}` E O QUE APAGA O CABECALHO DO NAVEGADOR

     A loja continuava recebendo o papel com duas faixas que nao sao
     nossas: em cima "30/08/2026, 13:06  Joia", embaixo o endereco do
     site e "1/1" — e um palmo de branco em volta delas.

     Isso e o cabecalho e o rodape do Chrome. Nenhuma linha de CSS
     desliga essa opcao: ela e da janela de impressao. MAS o Chrome
     desenha essas faixas DENTRO DA MARGEM DA PAGINA. Com
     `@page{margin:0}` nao existe margem, e nao ha onde desenha-las —
     entao ele nao as imprime, mesmo com a caixinha marcada. Era por
     isso que sobrava branco: `margin:1mm` ainda dava a ele um lugar.

     A margem foi para DENTRO do papel, como padding: o texto continua
     a 1 mm da borda de cima, 1 da de baixo e 2 dos lados. Muda quem
     reserva o espaco — nos, e nao a pagina.

     TRAVA: `testes/papel-sem-branco.js` reprova qualquer volta de
     margem na `@page`. Isto ja voltou uma vez; nao pode voltar de novo
     por causa de uma correcao em outro canto.
     ========================================================== */
  st.textContent='@media print{@page{size:'+mm+'mm '+alturaMM+'mm;margin:0}'+
   'html,body{margin:0;padding:0;background:#fff}'+
   'body>*{display:none!important}'+
   '#viaImp{display:block!important;position:static;padding:0!important;'+
     'margin:0;width:auto;font-size:inherit}'+
   '#viaImp .papel{width:'+cols+'ch;font-size:'+fonteMM+'mm;box-shadow:none;'+
     'padding:'+MARGEM_TOPO+'mm '+margem+'mm '+MARGEM_PE+'mm '+margem+'mm;'+
     'margin:0;border-radius:0;max-width:none;box-sizing:content-box}'+
   '#viaImp .papelPg{padding:0;margin:0;display:block}'+
   /* quebra ENTRE as vias; `page-break-after` na ultima gerava uma
      pagina em branco no fim de toda impressao */
   '#viaImp .papelPg+.papelPg{page-break-before:always}}';
  document.head.appendChild(st);
  /* ==========================================================
     AS DUAS LINHAS QUE NAO SAO DO JOIA

     A loja recebe o papel com "30/08/2026, 13:06  Joia" em cima e
     "https://joiagest.com.br/index.html  1/1" embaixo, com branco em
     volta. O Joia NAO escreve isso: o papel dele sai de `papelHTML`,
     que so desenha .ppL, .ppCorte e .ppBar — nao ha endereco de site
     nem numero de pagina em lugar nenhum do codigo.

     Sao o cabecalho e o rodape do proprio Chrome. Nenhuma linha de CSS
     desliga essa caixinha — ela e da janela de impressao, e por
     seguranca o navegador nao deixa a pagina mexer nela. Ja mandamos
     `@page{margin:0}`, que tira o lugar onde elas seriam desenhadas;
     quando a janela esta com margem propria, elas voltam.

     O que da para fazer, e o que fazemos aqui: avisar a pessoa NA HORA,
     com a janela abrindo na frente dela, o que desmarcar. Uma vez por
     aparelho — o Chrome guarda a escolha para a proxima impressao.
     ========================================================== */
  avisoJanelaImpressao();
  setTimeout(function(){window.print()},200);
}

/* ==========================================================
   MOTIVOS DE CANCELAMENTO — cadastro
   O motivo era uma lista fixa dentro do codigo. Virou cadastro:
   a loja inclui, desativa e apaga sem depender de atualizacao.
   ========================================================== */
function baseCanc(){
  DB.motivosCanc=DB.motivosCanc||[];
  /* ==========================================================
     A LISTA SO E SEMEADA UMA VEZ NA VIDA DA EMPRESA
     Antes bastava a lista estar VAZIA para os 7 motivos serem criados de
     novo, com identificadores novos. E ela fica vazia toda vez que o sistema
     abre, no instante entre o arranque e a chegada do download. Resultado:
     a cada entrada nasciam 7 motivos, subiam para a nuvem, e a lista crescia
     — "Produto em falta" tres vezes, "Troca de itens" tres vezes.
     Explicava exatamente o que se via na tela: duplicado ao entrar, normal
     dez segundos depois (quando o download chegava e substituia a lista).
     Agora fica uma marca no aparelho e outra na propria empresa. Vazio
     depois disso significa "a loja apagou todos", e apagado tem de continuar
     apagado — nao se ressuscita cadastro que alguem removeu de proposito.
     ========================================================== */
  /* jaExistiu() vem ANTES da checagem de tamanho: e ela que grava a
     marca enquanto a lista ainda esta cheia */
  if(jaExistiu('motivosCanc')||DB.motivosCanc.length)return DB.motivosCanc;
  /* se a nuvem esta ligada mas o download ainda nao chegou, ESPERA:
     semear agora e o que criava a duplicata */
  if(NUVEM.ligada&&!DB._baixouUmaVez)return DB.motivosCanc;
  MOTIVOS_CANC.forEach(function(nome,i){
    DB.motivosCanc.push({id:uid('mc'),nome:nome,ativo:true,ordem:i});
  });
  DB._semeado=DB._semeado||{}; DB._semeado.motivosCanc=true;
  return DB.motivosCanc;
}
function motivosCancAtivos(){
  baseCanc();
  return DB.motivosCanc.filter(function(m){return m.ativo!==false})
    .sort(function(a,b){return (a.ordem||0)-(b.ordem||0)});
}
function telaMotivosCanc(){
  baseCanc();
  var lst=DB.motivosCanc.slice().sort(function(a,b){return (a.ordem||0)-(b.ordem||0)});
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Motivo de Cancelamento</h1>'+
    '<p>O que voce cadastrar aqui aparece na hora no PDV, quando o operador cancela uma '+
    'venda. Ele e obrigado a escolher um destes motivos e a confirmar com a propria senha — '+
    'o que fica registrado no relatorio de Cancelamentos.</p></div>'+
    '<button class="infoBt" onclick="explicaCanc()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2 ok" onclick="formMotivoCanc()">'+sv('plus',14)+' Cadastrar motivo</button>'+
   '</div>'+
   '<div class="pnl2"><div class="pnl2H">Motivos cadastrados <span class="cnt2">'+lst.length+'</span></div>'+
   '<div class="pnl2B" style="padding:0">'+
   (lst.length?'<table class="pTable finTab"><thead><tr>'+
     '<th>Motivo</th>'+
     '<th style="width:120px;text-align:center">Usos</th>'+
     '<th style="width:96px;text-align:center">Ativo</th>'+
     '<th style="width:86px"></th></tr></thead><tbody>'+
     lst.map(function(m){
       var usos=(DB.cancelamentos||[]).filter(function(c){return c.motivoId===m.id}).length;
       return '<tr'+(m.ativo===false?' class="off"':'')+'>'+
        '<td><b>'+E(m.nome)+'</b></td>'+
        '<td style="text-align:center">'+usos+'</td>'+
        '<td style="text-align:center"><label class="flagBox">'+
         '<input type="checkbox" '+(m.ativo!==false?'checked':'')+
         ' onchange="togMotivoCanc(\''+m.id+'\')"></label></td>'+
        '<td><div class="rowAct">'+
         '<button class="rBtn" onclick="formMotivoCanc(\''+m.id+'\')" title="Editar">'+sv('edit',12)+'</button>'+
         '<button class="rBtn rd" onclick="excluirMotivoCanc(\''+m.id+'\')" title="Excluir">'+sv('trash',12)+'</button>'+
        '</div></td></tr>';
     }).join('')+'</tbody></table>'
   :'<div class="entVazio"><b>Nenhum motivo cadastrado</b>'+
    '<span>Clique em Cadastrar motivo para incluir o primeiro.</span></div>')+
   '</div></div></div></div>';
  rodape(lst.length+' motivos de cancelamento');
}
function explicaCanc(){
  confirmar({titulo:'Motivo de Cancelamento',
   texto:'De onde vem e para onde vai',
   linhas:[['Onde aparece','PDV > Cancelar uma venda',''],
           ['Quem escolhe','o operador, na hora do cancelamento',''],
           ['O que exige','motivo + senha do proprio operador',''],
           ['Onde fica','Relatorios > Cancelamentos','']],
   aviso:'Desativar um motivo tira ele da lista do PDV mas mantem os cancelamentos '+
    'que ja usaram esse motivo. Excluir so e permitido enquanto o motivo nao tiver uso.',
   ok:'Entendi',cancelar:null}).then(function(){});
}
function formMotivoCanc(id){
  baseCanc();
  var m=id?DB.motivosCanc.find(function(x){return x.id===id}):null;
  modal(m?'Editar motivo':'Cadastrar motivo',
  '<div class="mdB">'+
   '<div class="fld2"><label>Motivo do cancelamento *</label>'+
    '<input id="mcNome" value="'+E(m?m.nome:'')+'" placeholder="Cliente desistiu, Erro do operador...">'+
    '<div class="hint">Escreva como o operador vai ler na tela do PDV.</div></div>'+
   '<label class="chkL"><input type="checkbox" id="mcAtivo" '+(!m||m.ativo!==false?'checked':'')+'>'+
    '<span>Motivo ativo — aparece na lista ao cancelar uma venda</span></label>'+
  '</div>','Salvar',function(){
    var nome=$('mcNome').value.trim();
    if(!nome){toast('Informe o motivo.');return false;}
    var rep=DB.motivosCanc.some(function(x){
      return x.nome.trim().toLowerCase()===nome.toLowerCase()&&(!m||x.id!==m.id);});
    if(rep){toast('Ja existe um motivo com este nome.');return false;}
    if(m){m.nome=nome;m.ativo=$('mcAtivo').checked;}
    else DB.motivosCanc.push({id:uid('mc'),nome:nome,ativo:$('mcAtivo').checked,
      ordem:DB.motivosCanc.length});
    salvar();telaMotivosCanc();toast(m?'Motivo atualizado.':'Motivo cadastrado.');
    if(NUVEM.ligada)sincronizar();
    return true;
  });
}
function togMotivoCanc(id){
  var m=(DB.motivosCanc||[]).find(function(x){return x.id===id});
  if(!m)return;
  m.ativo=(m.ativo===false);
  salvar();comRolagem(telaMotivosCanc);
  if(NUVEM.ligada)sincronizar();
}
async function excluirMotivoCanc(id){
  var m=(DB.motivosCanc||[]).find(function(x){return x.id===id});
  if(!m)return;
  var usos=(DB.cancelamentos||[]).filter(function(c){return c.motivoId===id}).length;
  if(usos){
    /* apagar o motivo apagaria a explicacao de cancelamentos ja feitos */
    confirmar({titulo:'Nao da para excluir',texto:E(m.nome),
     linhas:[['Cancelamentos com este motivo',String(usos),'vr']],
     aviso:'Este motivo ja explica cancelamentos registrados. Se excluir, o relatorio '+
      'perde a razao daquelas vendas. Desative em vez de excluir — ele some do PDV e '+
      'o historico continua de pe.',ok:'Entendi',cancelar:null}).then(function(){});
    return;
  }
  var ok=await confirmar({titulo:'Excluir motivo',texto:E(m.nome),
    aviso:'O motivo sai da lista do PDV. Nenhum cancelamento usa este motivo.',
    ok:'Excluir',tipo:'perigo'});
  if(!ok)return;
  DB.motivosCanc=DB.motivosCanc.filter(function(x){return x.id!==id});
  salvar();telaMotivosCanc();toast('Motivo excluido.');
  if(NUVEM.ligada)sincronizar();
}

/* ==========================================================
   TURNOS — cadastro e ligacao com a abertura de caixa
   ========================================================== */
function baseTurnos(){
  DB.turnos=DB.turnos||[];
  /* mesma correcao de baseCanc: so semeia uma vez, e nunca antes do
     download chegar. Ver o comentario la para o porque. */
  /* jaExistiu() vem ANTES da checagem de tamanho: e ela que grava a
     marca enquanto a lista ainda esta cheia */
  if(jaExistiu('turnos')||DB.turnos.length)return DB.turnos;
  if(NUVEM.ligada&&!DB._baixouUmaVez)return DB.turnos;
  DB.turnos.push({id:uid('tn'),nome:'Turno 1',ini:'08:00',fim:'15:00',ativo:true,ordem:0});
  DB.turnos.push({id:uid('tn'),nome:'Turno 2',ini:'15:00',fim:'23:00',ativo:true,ordem:1});
  DB._semeado=DB._semeado||{}; DB._semeado.turnos=true;
  return DB.turnos;
}
function turnosAtivos(){
  baseTurnos();
  return DB.turnos.filter(function(t){return t.ativo!==false})
    .sort(function(a,b){return (a.ordem||0)-(b.ordem||0)});
}
function nomeTurno(id){
  var t=(DB.turnos||[]).find(function(x){return x.id===id});
  return t?t.nome:'';
}
/* sugere o turno pelo relogio, mas quem decide e quem abre o caixa */
function turnoDoRelogio(){
  var ts=turnosAtivos();
  var agora=agoraHM();
  for(var i=0;i<ts.length;i++){
    var t=ts[i];
    if(!t.ini||!t.fim)continue;
    if(t.ini<=t.fim){ if(agora>=t.ini&&agora<t.fim)return t.id; }
    else { if(agora>=t.ini||agora<t.fim)return t.id; }   /* turno que vira a noite */
  }
  return ts.length?ts[0].id:'';
}
function telaTurnos(){
  baseTurnos();
  var lst=DB.turnos.slice().sort(function(a,b){return (a.ordem||0)-(b.ordem||0)});
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Turnos</h1>'+
    '<p>Quem abre a frente de caixa escolhe o turno. A partir dai todo pedido, sangria e '+
    'fechamento daquele caixa pertencem ao turno escolhido — e o relatorio de Frente de '+
    'Caixa pode ser filtrado por ele.</p></div>'+
    '<button class="infoBt" onclick="explicaTurnos()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2 ok" onclick="formTurno()">'+sv('plus',14)+' Cadastrar turno</button>'+
   '</div>'+
   '<div class="pnl2"><div class="pnl2H">Turnos cadastrados <span class="cnt2">'+lst.length+'</span></div>'+
   '<div class="pnl2B" style="padding:0">'+
   (lst.length?'<table class="pTable finTab"><thead><tr>'+
     '<th>Turno</th>'+
     '<th style="width:150px">Horario</th>'+
     '<th style="width:120px;text-align:center">Caixas</th>'+
     '<th style="width:96px;text-align:center">Ativo</th>'+
     '<th style="width:86px"></th></tr></thead><tbody>'+
     lst.map(function(t){
       var qtd=(DB.caixas||[]).filter(function(c){return c.turnoId===t.id}).length;
       return '<tr'+(t.ativo===false?' class="off"':'')+'>'+
        '<td><b>'+E(t.nome)+'</b></td>'+
        '<td>'+(t.ini&&t.fim?E(t.ini)+' as '+E(t.fim):'<span class="hint">sem horario</span>')+'</td>'+
        '<td style="text-align:center">'+qtd+'</td>'+
        '<td style="text-align:center"><label class="flagBox">'+
         '<input type="checkbox" '+(t.ativo!==false?'checked':'')+
         ' onchange="togTurno(\''+t.id+'\')"></label></td>'+
        '<td><div class="rowAct">'+
         '<button class="rBtn" onclick="formTurno(\''+t.id+'\')" title="Editar">'+sv('edit',12)+'</button>'+
         '<button class="rBtn rd" onclick="excluirTurno(\''+t.id+'\')" title="Excluir">'+sv('trash',12)+'</button>'+
        '</div></td></tr>';
     }).join('')+'</tbody></table>'
   :'<div class="entVazio"><b>Nenhum turno cadastrado</b>'+
    '<span>Clique em Cadastrar turno para incluir o primeiro.</span></div>')+
   '</div></div></div></div>';
  rodape(lst.length+' turnos cadastrados');
}
function explicaTurnos(){
  confirmar({titulo:'Turnos',texto:'Como o turno se liga ao caixa',
   linhas:[['Onde se escolhe','na abertura da frente de caixa',''],
           ['O que fica preso ao turno','pedidos, sangrias e o fechamento',''],
           ['Onde se consulta','Financeiro > Frente de Caixa','']],
   aviso:'O horario cadastrado serve so para sugerir o turno na hora de abrir. '+
    'Quem abre o caixa pode escolher outro — o sistema nao impede, so registra.',
   ok:'Entendi',cancelar:null}).then(function(){});
}
function formTurno(id){
  baseTurnos();
  var t=id?DB.turnos.find(function(x){return x.id===id}):null;
  modal(t?'Editar turno':'Cadastrar turno',
  '<div class="mdB">'+
   '<div class="fld2"><label>Nome do turno *</label>'+
    '<input id="tnNome" value="'+E(t?t.nome:'')+'" placeholder="Turno 1, Turno da manha..."></div>'+
   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
    '<div class="fld2"><label>Comeca as</label>'+
     '<input id="tnIni" type="time" value="'+E(t?t.ini:'')+'"></div>'+
    '<div class="fld2"><label>Termina as</label>'+
     '<input id="tnFim" type="time" value="'+E(t?t.fim:'')+'"></div>'+
   '</div>'+
   '<div class="hint">O horario so sugere o turno na abertura do caixa. Quem abre confirma.</div>'+
   '<label class="chkL" style="margin-top:10px"><input type="checkbox" id="tnAtivo" '+
    (!t||t.ativo!==false?'checked':'')+'>'+
    '<span>Turno ativo — aparece na abertura da frente de caixa</span></label>'+
  '</div>','Salvar',function(){
    var nome=$('tnNome').value.trim();
    if(!nome){toast('Informe o nome do turno.');return false;}
    var rep=DB.turnos.some(function(x){
      return x.nome.trim().toLowerCase()===nome.toLowerCase()&&(!t||x.id!==t.id);});
    if(rep){toast('Ja existe um turno com este nome.');return false;}
    var ini=$('tnIni').value||'',fim=$('tnFim').value||'';
    if(t){t.nome=nome;t.ini=ini;t.fim=fim;t.ativo=$('tnAtivo').checked;}
    else DB.turnos.push({id:uid('tn'),nome:nome,ini:ini,fim:fim,
      ativo:$('tnAtivo').checked,ordem:DB.turnos.length});
    salvar();telaTurnos();toast(t?'Turno atualizado.':'Turno cadastrado.');
    if(NUVEM.ligada)sincronizar();
    return true;
  });
}
function togTurno(id){
  var t=(DB.turnos||[]).find(function(x){return x.id===id});
  if(!t)return;
  t.ativo=(t.ativo===false);
  salvar();comRolagem(telaTurnos);
  if(NUVEM.ligada)sincronizar();
}
async function excluirTurno(id){
  var t=(DB.turnos||[]).find(function(x){return x.id===id});
  if(!t)return;
  var qtd=(DB.caixas||[]).filter(function(c){return c.turnoId===id}).length;
  if(qtd){
    confirmar({titulo:'Nao da para excluir',texto:E(t.nome),
     linhas:[['Caixas neste turno',String(qtd),'vr']],
     aviso:'Ha frentes de caixa registradas neste turno. Se excluir, o relatorio perde o '+
      'filtro daqueles caixas. Desative em vez de excluir.',
     ok:'Entendi',cancelar:null}).then(function(){});
    return;
  }
  var ok=await confirmar({titulo:'Excluir turno',texto:E(t.nome),
    aviso:'O turno sai da abertura de caixa. Nenhum caixa usa este turno.',
    ok:'Excluir',tipo:'perigo'});
  if(!ok)return;
  DB.turnos=DB.turnos.filter(function(x){return x.id!==id});
  salvar();telaTurnos();toast('Turno excluido.');
  if(NUVEM.ligada)sincronizar();
}

/* ==========================================================
   RELATORIO DE CANCELAMENTOS
   Ve e apaga. Nao edita: um cancelamento e um fato registrado,
   e reescrever o motivo depois destruiria a serventia da trilha.
   ========================================================== */
var RC={de:'',ate:'',motivo:'',oper:''};
function telaRelCancel(){
  baseCanc();
  DB.cancelamentos=DB.cancelamentos||[];
  if(!RC.de){var d=new Date();
    RC.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    RC.ate=hojeISO();}
  var lst=DB.cancelamentos.filter(function(c){
    if(RC.de&&c.data<RC.de)return false;
    if(RC.ate&&c.data>RC.ate)return false;
    if(RC.motivo&&c.motivoId!==RC.motivo)return false;
    if(RC.oper&&c.operadorId!==RC.oper)return false;
    return true;
  }).sort(function(a,b){
    return (b.data+' '+b.hora).localeCompare(a.data+' '+a.hora);});

  var total=lst.reduce(function(a,c){return a+(Number(c.valor)||0)},0);
  /* qual motivo mais cancela: e a informacao que o dono da loja procura aqui */
  var porMot={};
  lst.forEach(function(c){var k=c.motivo||'sem motivo';porMot[k]=(porMot[k]||0)+1});
  var ranking=Object.keys(porMot).map(function(k){return [k,porMot[k]]})
    .sort(function(a,b){return b[1]-a[1]}).slice(0,4);

  var opers={};
  (DB.cancelamentos||[]).forEach(function(c){if(c.operadorId)opers[c.operadorId]=c.operador});

  $('content').innerHTML='<div class="finWrap">'+
  '<div class="finTop"><div><h1>Cancelamentos</h1>'+
  '<p>Toda venda cancelada no PDV, com o motivo, o horario e quem confirmou com a propria senha.</p></div>'+
  '<div class="finActs">'+
   '<button class="infoBt" onclick="explicaRelCancel()">'+sv('help',15)+'</button>'+
   '<button class="btnP2" onclick="exportarCancel()">'+sv('file',14)+' Exportar CSV</button>'+
  '</div></div>'+

  '<div class="filtroCard">'+
   '<div class="fl"><label>De</label><input type="date" id="rcDe" value="'+RC.de+'"></div>'+
   '<div class="fl"><label>Ate</label><input type="date" id="rcAte" value="'+RC.ate+'"></div>'+
   '<div class="fl"><label>Motivo</label><select id="rcMot">'+
    '<option value="">Todos os motivos</option>'+
    DB.motivosCanc.map(function(m){
      return '<option value="'+E(m.id)+'"'+(RC.motivo===m.id?' selected':'')+'>'+E(m.nome)+'</option>';
    }).join('')+'</select></div>'+
   '<div class="fl"><label>Quem cancelou</label><select id="rcOper">'+
    '<option value="">Todos</option>'+
    Object.keys(opers).map(function(k){
      return '<option value="'+E(k)+'"'+(RC.oper===k?' selected':'')+'>'+E(opers[k])+'</option>';
    }).join('')+'</select></div>'+
   '<button class="btnP2 ok" onclick="buscarCancel()">'+sv('search',14)+' Buscar</button>'+
   '<button class="btnP2" onclick="RC={de:\'\',ate:\'\',motivo:\'\',oper:\'\'};telaRelCancel()">Limpar</button>'+
   '<div style="flex:1"></div>'+
   '<div class="fcResumo">'+
    '<div><span>Cancelamentos</span><b>'+lst.length+'</b></div>'+
    '<div><span>Valor cancelado</span><b class="vr">R$ '+money(total)+'</b></div>'+
   '</div>'+
  '</div>'+

  (ranking.length?'<div class="rcRank">'+ranking.map(function(r){
    return '<div class="rcRankIt"><b>'+r[1]+'</b><span>'+E(r[0])+'</span></div>';
  }).join('')+'</div>':'')+

  '<div class="pnl2"><div class="pnl2H">Vendas canceladas <span class="cnt2">'+lst.length+'</span></div>'+
  '<div class="pnl2B" style="padding:0">'+
  (lst.length?'<table class="pTable finTab"><thead><tr>'+
   '<th style="width:88px">Pedido</th>'+
   '<th style="width:150px">Quando</th>'+
   '<th>Motivo</th>'+
   '<th style="width:170px">Quem cancelou</th>'+
   '<th style="width:110px;text-align:right">Valor</th>'+
   '<th style="width:86px"></th></tr></thead><tbody>'+
   lst.map(function(c){
     return '<tr style="cursor:pointer" onclick="verCancel(\''+c.id+'\')">'+
     '<td><b>#'+E(c.numero)+'</b></td>'+
     '<td>'+dataBR(c.data)+'<small>as '+E(c.hora||'')+(c.turno?' · '+E(c.turno):'')+'</small></td>'+
     '<td><b>'+E(c.motivo||'—')+'</b>'+(c.obs?'<small>'+E(c.obs)+'</small>':'')+'</td>'+
     '<td>'+E(c.operador||'—')+'</td>'+
     '<td style="text-align:right"><b class="vr">R$ '+money(c.valor)+'</b></td>'+
     '<td onclick="event.stopPropagation()"><div class="rowAct">'+
      '<button class="rBtn" onclick="verCancel(\''+c.id+'\')" title="Visualizar">'+sv('eye',12)+'</button>'+
      '<button class="rBtn rd" onclick="excluirCancel(\''+c.id+'\')" title="Apagar registro">'+sv('trash',12)+'</button>'+
     '</div></td></tr>';
   }).join('')+'</tbody></table>'
  :'<div class="entVazio"><b>Nenhum cancelamento no periodo</b>'+
   '<span>Ajuste os filtros acima e clique em Buscar.</span></div>')+
  '</div></div></div>';
  rodape(lst.length+' cancelamentos no periodo');
}
function buscarCancel(){
  RC.de=$('rcDe').value;RC.ate=$('rcAte').value;
  RC.motivo=$('rcMot').value;RC.oper=$('rcOper').value;
  telaRelCancel();
}
function explicaRelCancel(){
  confirmar({titulo:'Como este relatorio e montado',texto:'Cancelamentos',
   linhas:[['De onde vem','cada cancelamento feito no PDV',''],
           ['O que entra','pedido, motivo, observacao, operador, turno e valor',''],
           ['O que nao entra','pedidos excluidos antes de virar venda','']],
   aviso:'O registro pode ser apagado, mas nunca editado. Um cancelamento e um fato: '+
    'reescrever o motivo depois acabaria com a serventia da trilha. Apagar o registro '+
    'nao desfaz o cancelamento — a venda continua cancelada no PDV.',
   ok:'Entendi',cancelar:null}).then(function(){});
}
function verCancel(id){
  var c=(DB.cancelamentos||[]).find(function(x){return x.id===id});
  if(!c)return;
  var p=(DB.pedidos||[]).find(function(x){return x.id===c.pedidoId});
  var itens=p?(p.itens||[]):[];
  modal('Cancelamento do pedido #'+E(c.numero),
  '<div class="mdB">'+
   '<div class="cncCard" style="margin:0">'+
    '<div class="cncH"><b>#'+E(c.numero)+'</b>'+
     '<span>'+dataBR(c.data)+' as '+E(c.hora||'')+'</span>'+
     (c.turno?'<span class="cidTag">'+E(c.turno)+'</span>':'')+'</div>'+
    (p?'<div class="cncCli">'+E(p.clienteNome||'Consumidor')+'</div>':'')+
    (itens.length?'<div class="cncItens">'+itens.map(function(i){
      return '<div><span>'+i.qtd+'x '+E(i.nome)+'</span><b>R$ '+money(i.total)+'</b></div>';
     }).join('')+'</div>'
     :'<div class="hint" style="padding:8px 0">Os itens deste pedido nao estao mais neste aparelho.</div>')+
    '<div class="cncTot"><span>Valor cancelado</span><b>R$ '+money(c.valor)+'</b></div>'+
   '</div>'+
   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">'+
    '<div class="fld2"><label>Motivo</label><input value="'+E(c.motivo||'—')+'" readonly></div>'+
    '<div class="fld2"><label>Quem cancelou</label><input value="'+E(c.operador||'—')+'" readonly></div>'+
   '</div>'+
   (c.obs?'<div class="fld2"><label>Observacao</label><input value="'+E(c.obs)+'" readonly></div>':'')+
  '</div>','Fechar',function(){return true;});
}
async function excluirCancel(id){
  var c=(DB.cancelamentos||[]).find(function(x){return x.id===id});
  if(!c)return;
  var ok=await confirmar({titulo:'Apagar o registro',
    texto:'Pedido #'+E(c.numero)+' — '+E(c.motivo||''),
    linhas:[['Valor','R$ '+money(c.valor),'vr'],
            ['Quem cancelou',c.operador||'—',''],
            ['Quando',dataBR(c.data)+' as '+(c.hora||''),'']],
    aviso:'Isto apaga a linha do relatorio, e nao o cancelamento: a venda #'+E(c.numero)+
     ' continua cancelada no PDV e fora do faturamento. Depois de apagada, a linha nao volta.',
    ok:'Apagar registro',tipo:'perigo'});
  if(!ok)return;
  DB.cancelamentos=DB.cancelamentos.filter(function(x){return x.id!==id});
  salvar();telaRelCancel();toast('Registro apagado.');
  if(NUVEM.ligada)sincronizar();
}
function exportarCancel(){
  var lst=(DB.cancelamentos||[]).filter(function(c){
    if(RC.de&&c.data<RC.de)return false;
    if(RC.ate&&c.data>RC.ate)return false;
    if(RC.motivo&&c.motivoId!==RC.motivo)return false;
    if(RC.oper&&c.operadorId!==RC.oper)return false;
    return true;});
  if(!lst.length){toast('Nada para exportar no periodo.');return;}
  var l=[['Pedido','Data','Hora','Turno','Motivo','Observacao','Quem cancelou','Valor']];
  lst.forEach(function(c){
    l.push([c.numero,dataBR(c.data),c.hora||'',c.turno||'',c.motivo||'',c.obs||'',
      c.operador||'',String(c.valor||0).replace('.',',')]);
  });
  baixarCSV('nexor-cancelamentos.csv',l);
}

/* ==========================================================
   USUÁRIOS E PERMISSÕES
   ========================================================== */
function baseUsr(){
  DB.usuarios=DB.usuarios||[];
  /* faxina dos acessos defeituosos deixados por versoes anteriores */
  DB.usuarios=DB.usuarios.filter(function(u){
    var lg=String(u.login||'').trim().toLowerCase();
    if(!lg)return false;                                  /* sem login */
    if(lg.indexOf('.duplicado')>=0)return false;          /* marcado como duplicado */
    if((lg.match(/@/g)||[]).length>1)return false;        /* dois arrobas: dominio errado */
    return true;
  });
  /* garante um unico dono da Joia */
  var donos=DB.usuarios.filter(function(u){return String(u.login||'').toLowerCase()===ADM_MESTRE});
  /* ------------------------------------------------------------------
     O dono da Joia NUNCA fica sem acesso.
     As permissoes vinham inteiras da tabela usuarios_sistema. Quando o
     download dela falhava — rede, token vencido, qualquer motivo — o registro
     era remontado sem 'tudo' nem 'mestre', e o dono entrava no proprio sistema
     sem enxergar tela nenhuma. Permissao de quem administra a plataforma nao
     pode depender de uma requisicao dar certo.
     ------------------------------------------------------------------ */
  donos.forEach(function(u){ u.tudo=true;u.mestre=true;u.ativo=true; });
  /* ==========================================================
     A FRANQUEADORA NAO FICA PRESA A UMA UNIDADE
     Quem responde pela matriz responde pela rede. Um acesso desses com
     unidade marcada perde o direito de administrar (sou_admin() exige
     nenhuma unidade) e o banco passa a recusar as gravacoes com 403 —
     o envio para de subir, e como nao se baixa nada com envio pendente,
     a sincronizacao trava nos dois sentidos.
     Isso ja aconteceu por edicao manual e por cadastro de sucursal.
     Em vez de esperar nao acontecer de novo, conserta-se na abertura.
     ========================================================== */
  /* ==========================================================
     A LIMPEZA DE VINCULO MORTO FOI REMOVIDA (V83)
     Na V82 eu apagava o vinculo de quem apontava para uma unidade
     excluida, para soltar a franqueadora. O efeito colateral foi grave:
     o gerente de Jales tambem apontava para a Jales excluida, ficou sem
     unidade — e sem unidade significa EMPRESA INTEIRA. Um gerente de loja
     virou franqueadora.
     Vinculo morto nao pode virar acesso a tudo. O certo e o contrario:
     quem perdeu a unidade nao alcanca nada ate alguem dizer onde ele fica.
     A franqueadora se resolve pelo caminho proprio, abaixo, que so mexe em
     quem esta registrado como responsavel da matriz.
     ========================================================== */
  try{
    var mz=(DB.sucursais||[]).find(function(x){return x.matriz});
    var lgMz=mz?String(mz.loginResp||'').toLowerCase():'';
    if(lgMz)DB.usuarios.forEach(function(u){
      if(String(u.login||'').toLowerCase()===lgMz&&(u.sucursais||[]).length){
        u.sucursais=[];
        logNuvem('acesso da matriz estava preso a uma unidade — soltado');
      }
    });
  }catch(e){_quieto(e,'baseUsr')}
  if(donos.length>1){
    var manter=donos[0];
    DB.usuarios=DB.usuarios.filter(function(u){
      return String(u.login||'').toLowerCase()!==ADM_MESTRE||u===manter;});
  }
  /* identificador repetido entre dois acessos faz um virar o outro: separa */
  var vistos={};
  DB.usuarios.forEach(function(u,k){
    var lg=String(u.login||'').toLowerCase();
    if(!u.id||vistos[u.id]!==undefined){
      u.id='usr_'+(lg.replace(/[^a-z0-9]/g,'').slice(0,12)||'x')+'_'+k;
    }
    vistos[u.id]=k;
  });
  /* login repetido: mantem o primeiro e desativa o duplicado */
  var porLogin={};
  DB.usuarios.forEach(function(u){
    var lg=String(u.login||'').toLowerCase();
    if(!lg)return;
    if(porLogin[lg]){u._apagar=true;}
    else porLogin[lg]=true;
  });
  DB.usuarios=DB.usuarios.filter(function(u){return !u._apagar});
  /* acesso apontando para uma unidade que nao existe mais: religa pelo nome */
  try{
    var scs=DB.sucursais||[];
    function chv(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[^a-z0-9]/g,'');}
    DB.usuarios.forEach(function(u){
      if(u.tudo||u.mestre)return;
      var val=(u.sucursais||[]).filter(function(id){
        return scs.some(function(x){return x.id===id});});
      if(val.length){u.sucursais=val;return;}
      var alvo=chv(String(u.login||'').split('@')[0]);
      if(!alvo)return;
      var sc=scs.filter(function(x){return !x.matriz}).find(function(x){
        var n=chv(x.nome);return n.indexOf(alvo)>=0||alvo.indexOf(chv(x.apelido||x.nome))>=0;});
      if(sc)u.sucursais=[sc.id];
    });
  }catch(e){_quieto(e,'baseUsr')}
  /* ninguem alem do dono da Joia pode carregar a marcacao de plataforma */
  DB.usuarios.forEach(function(u){
    if(String(u.login||'').toLowerCase()!==ADM_MESTRE&&u.plataforma){u.plataforma=false;}
  });
  /* o acesso generico admin/admin das primeiras versoes nao vale mais */
  DB.usuarios=DB.usuarios.filter(function(u){
    return !((u.login||'').toLowerCase()==='admin'&&u.senha==='admin');
  });
  /* administrador mestre do Nexor: existe em qualquer instalacao, enxerga tudo */
  if(!DB.usuarios.some(function(u){return (u.login||'').toLowerCase()===ADM_MESTRE})){
    /* sem senha: quem entra e o Auth. Uma senha escrita aqui seria a mesma
       em toda instalacao do Nexor — porta destrancada em todo cliente. */
    DB.usuarios.unshift({id:'usr_mestre',nome:'Administrador da Joia',login:ADM_MESTRE,
      senha:'',mestre:true,plataforma:true,ativo:true,sucursais:[],permissoes:{},tudo:true,
      criadoEm:new Date().toISOString()});
  }
  return DB.usuarios;
}
function usuarioLogado(){
  baseUsr();
  /* resolve primeiro pelo LOGIN: dois cadastros podem repetir identificador,
     mas nunca o login. Sem sessao, nao ha usuario — e nao se assume o mestre. */
  if(SESSAO.login){
    var porLogin=DB.usuarios.find(function(u){
      return String(u.login||'').toLowerCase()===SESSAO.login;});
    if(porLogin)return porLogin;
  }
  if(!SESSAO.usuarioId)return null;
  return DB.usuarios.find(function(u){return u.id===SESSAO.usuarioId})||null;
}
/* SESSAO nasce no bloco 1 — aqui ela ja existe e nao pode ser zerada:
   este trecho roda DEPOIS do "manter conectado" do bloco 5. */
/* pode ver este item do menu? */
function podeVer(mid,iid){
  var u=usuarioLogado();
  if(MOD_PLATAFORMA.indexOf(mid)>=0&&!ehPlataforma(u))return false;
  if(!u)return false;                       /* ninguem logado: nao mostra nada */
  if(!moduloContratado(mid))return false;   /* fora do contrato: some para todos */
  if(iid&&!recursoContratado(mid,iid))return false;   /* tela fechada pelo dono da Joia */
  /* modo de venda desligado: a tela dele nao existe para esta loja */
  if((iid==='mesas'||iid==='vendas-mesa')&&typeof modoAtivo==='function'&&!modoAtivo('mesa'))return false;
  /* ==========================================================
     AS LISTAS EXCLUSIVAS SAO TRAVA, NAO PASSE-LIVRE
     Elas ficavam DEPOIS do atalho do acesso total, entao a franqueadora,
     que tem acesso total, enxergava as telas do dono da Joia. E ficavam
     como "return true", entao uma tela desta lista aparecia mesmo com a
     marcacao desligada. Agora elas so BARRAM quem nao e daquele grupo;
     quem e daquele grupo segue o caminho normal e obedece a marcacao.
     ========================================================== */
  if(iid&&SO_PLATAFORMA.indexOf(mid+'/'+iid)>=0&&!ehPlataforma(u))return false;
  if(iid&&SO_FRANQUEADORA.indexOf(mid+'/'+iid)>=0&&!ehFranqueadora(u))return false;
  /* acesso total sem lista de permissoes preenchida era barrado tela por tela */
  if(u.tudo||u.mestre)return true;
  if(!iid)return (MOD.find(function(m){return m.id===mid})||{it:[]}).it
    .some(function(i){return podeVer(mid,i.id)});
  return !!(u.permissoes&&u.permissoes[mid+'/'+iid]);
}
/* pode operar nesta sucursal? */
function podeSucursal(sid){
  var u=usuarioLogado();
  if(!u||u.mestre||u.tudo)return true;
  if(!u.sucursais||!u.sucursais.length)return true;
  return u.sucursais.indexOf(sid)>=0;
}
function sucursaisDoUsuario(){
  var u=usuarioLogado();
  baseSuc();
  if(!u||u.mestre||u.tudo||!u.sucursais||!u.sucursais.length)return sucAtivas();
  return sucAtivas().filter(function(s){return u.sucursais.indexOf(s.id)>=0});
}
/* ==========================================================
   QUEM PODE VER MAIS DE UMA UNIDADE

   O usuário de UMA loja fica 100% preso à própria unidade: não vê seletor,
   filtro nem dropdown de sucursal em lugar nenhum (era o vazamento da Ficha
   Técnica em 03/09/2026). Só quem tem visão multiunidade — matriz/dono
   (mestre/tudo) ou usuário com mais de uma sucursal atribuída — enxerga o
   seletor. Uma função só, para todas as telas usarem a MESMA regra. */
function vejoVariasUnidades(){
  var u=usuarioLogado();
  if(u&&(u.mestre||u.tudo))return true;
  try{ return sucursaisDoUsuario().length>1; }catch(e){ return false; }
}

/* ---------- tela ---------- */
var US={sel:null,busca:'',aba:'permissoes',abertas:{},verInativos:false};
function achou(u,q){
  return !q||String(u.nome||'').toLowerCase().indexOf(q)>=0||
    String(u.login||'').toLowerCase().indexOf(q)>=0;
}
/* ==========================================================
   ABRIR E FECHAR PASTA SEM REMONTAR A TELA
   O clique chamava telaUsuarios(), que refaz o innerHTML inteiro — arvore,
   painel de permissoes e as ~91 caixas de marcar junto. O navegador destroi
   e recria tudo so para mostrar ou esconder alguns nomes; e dai que vinha a
   travada a cada clique.
   Abrir e fechar e estado visual: uma classe CSS resolve. O estado continua
   guardado em US.abertas para a proxima vez que a tela for montada de fato.
   ========================================================== */
function abrirPastaEmpresa(botao, nome){
  var pasta = botao && botao.parentNode;
  if(!pasta){ US.abertas[nome]=!US.abertas[nome]; telaUsuarios(); return; }
  var abre = !pasta.classList.contains('ab');
  pasta.classList.toggle('ab', abre);
  US.abertas[nome] = abre;
}
function telaUsuarios(){
  baseMov();baseSuc();baseUsr();
  var q=(US.busca||'').toLowerCase();
  baseRedes();
  var eu=usuarioLogado();
  var minhaRede=ehPlataforma(eu)?null:redeDoUsuario(eu);
  /* ==========================================================
     ACESSO DESLIGADO NAO POLUI A ARVORE
     Quem foi desligado continua no cadastro — o historico do que essa pessoa
     fez depende disso. Mas a arvore e a tela de trabalho do dia a dia, e uma
     lista cheia de gente que nao entra mais so atrapalha quem procura alguem.
     Some por padrao, com um botao para trazer de volta: escondido de vez,
     nao teria como reativar ninguem.
     ========================================================== */
  var lista=DB.usuarios.filter(function(u){
    if(u.ativo===false&&!US.verInativos&&US.sel!==u.id)return false;
    if(String(u.login||'').toLowerCase().indexOf(ADM_MESTRE)===0&&!ehPlataforma(eu))return false;
    if(u.plataforma&&!ehPlataforma(eu))return false;
    /* franqueadora ve so os acessos da propria rede */
    if(minhaRede){
      var r=redeDoUsuario(u);
      if(r&&r.id!==minhaRede.id)return false;
      if(!r&&(u.sucursais||[]).length){
        var daRede=(u.sucursais||[]).some(function(sid){
          var sc=(DB.sucursais||[]).find(function(x){return x.id===sid});
          return sc&&sc.redeId===minhaRede.id;});
        if(!daRede)return false;
      }
    }
    /* ------------------------------------------------------------------
       O filtro só separava por REDE. Como todas as unidades da Jolô são da
       mesma rede, o gerente de Santa Fé enxergava os acessos de São Paulo,
       de Sorocaba e o da própria franqueadora — inclusive para editar.
       Quem não é matriz vê apenas os acessos das unidades que ele opera.
       ------------------------------------------------------------------ */
    if(!ehFranqueadora(eu)&&!ehPlataforma(eu)){
      var minhas=(eu&&eu.sucursais)||[];
      if(minhas.length){
        if(u.id===(eu||{}).id)return achou(u,q);   /* o próprio sempre aparece */
        if(u.tudo||u.mestre)return false;          /* acesso total não é da unidade */
        var dele=(u.sucursais||[]);
        if(!dele.length)return false;              /* sem unidade = da rede toda */
        if(!dele.some(function(sid){return minhas.indexOf(sid)>=0}))return false;
      }
    }
    return achou(u,q);
  });
  /* so as unidades da rede de quem esta olhando */
  var sucsVisiveis=(DB.sucursais||[]).filter(function(sc){
    if(sc.matriz)return false;
    return !minhaRede||sc.redeId===minhaRede.id;});
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Usuários e Permissões</h1>'+
    '<p>Quem entra no sistema, em quais lojas e o que cada um enxerga.</p></div>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2 ok" onclick="novoUsuario()">'+sv('plus',14)+' Novo usuário</button>'+
   '</div>'+
   '<div class="usrGrade">'+
    '<div class="usrLista">'+
     '<div class="usrBusca">'+sv('search',13)+
      '<input id="usB" value="'+E(US.busca)+'" placeholder="buscar por nome ou login"></div>'+
      (function(){
        var n=(DB.usuarios||[]).filter(function(u){return u.ativo===false}).length;
        if(!n)return '';
        return '<button class="usrLnk" onclick="US.verInativos=!US.verInativos;telaUsuarios()">'+
          (US.verInativos?'esconder os desligados':'mostrar '+n+' desligado'+(n>1?'s':''))+
        '</button>';
      })()+
     '<div class="usrRol">'+
     (function(){
       /* ------------------------------------------------------------------
          ARVORE POR EMPRESA (proposta B)
          A pasta e a EMPRESA, nunca uma pessoa. Dentro dela vem a matriz
          primeiro e depois as unidades. Assim ninguem acumula dois papeis:
          pasta e lugar, linha e gente — e clicar no cabecalho so abre e
          fecha, nunca seleciona alguem sem querer.
          Com 15 clientes a tela abre com 15 pastas fechadas, e nao com 60
          nomes soltos um embaixo do outro.
          ------------------------------------------------------------------ */
       function corDe(u){
         if(u.mestre||u.tudo)return '#12263F';
         var sid=(u.sucursais||[])[0];
         var sc=(DB.sucursais||[]).find(function(x){return x.id===sid});
         return (sc&&sc.cor)?sc.cor:'#00A08B';
       }
       function unidadeDe(u){
         var sid=(u.sucursais||[])[0];
         var sc=(DB.sucursais||[]).find(function(x){return x.id===sid});
         return sc?sc.nome:'';
       }
       /* nome da empresa desta rede, para quando o usuario nao resolve sozinho */
       function empresaPadrao(){
         /* o nome vem do contrato com a Nexor — e o nome real da empresa.
            "Minha rede" era o rotulo de emergencia de uma lista local que
            nao existe mais. */
         if(DB._contrato&&DB._contrato.rede)return DB._contrato.rede;
         var mz=(DB.sucursais||[]).find(function(x){return x.matriz});
         if(mz&&mz.nome)return mz.nome;
         var r0=(DB.redes||[])[0];
         if(r0&&r0.nome)return r0.nome;
         return 'Minha empresa';
       }
       /* o dono da Joia nao pertence a empresa nenhuma: fica na secao de cima */
       function ehDono(u){
         return String(u.login||'').toLowerCase()===ADM_MESTRE||!!u.plataforma;
       }
       function linha(u,dentro){
         var nP=(u.mestre||u.tudo)?'acesso total':contaPerm(u)+' telas';
         var un=unidadeDe(u);
         return '<button class="'+(dentro?'usrIt':'usrSolto')+(US.sel===u.id?' on':'')+
          (u.ativo===false?' off':'')+'" '+
          'onclick="US.sel=\''+u.id+'\';telaUsuarios()">'+
          (dentro?'':'<span class="usrRec"></span>')+
          '<div class="usrAv" style="background:'+corDe(u)+';color:#fff">'+
            E((u.nome||'?').charAt(0).toUpperCase())+'</div>'+
          '<div class="usrN"><b>'+E(u.nome)+'</b>'+
           '<span>'+E(u.login)+' · '+nP+(un?' · '+E(un):'')+'</span></div>'+
          (u.ativo===false?'<span class="badge2 rd">inativo</span>':'')+
         '</button>';
       }

       /* ------------------------------------------------------------------
          A ARVORE MOSTRA AS UNIDADES, NAO SO OS USUARIOS.
          Antes ela era montada a partir da lista de acessos: unidade sem
          login criado simplesmente nao existia na tela. A franqueadora
          cadastrava Jales e nao encontrava Jales em lugar nenhum para
          liberar permissao. Agora a estrutura vem das SUCURSAIS — que e a
          empresa de verdade — e os acessos aparecem dentro da unidade a que
          pertencem. Unidade sem acesso aparece assim mesmo, dizendo que
          ainda nao tem login.
          ------------------------------------------------------------------ */
       var donos=lista.filter(ehDono);
       var resto=lista.filter(function(u){return !ehDono(u)});
       var buscando=!!q;
       var h='';
       if(donos.length){
         h+='<div class="usrSec">Plataforma<span class="usrLn"></span></div>'+
            donos.map(function(u){return linha(u,false)}).join('');
       }
       var nomeEmp=empresaPadrao();
       /* ==========================================================
          UNIDADE EXCLUIDA NAO E UNIDADE
          A arvore contava e desenhava tudo o que estivesse em DB.sucursais,
          inclusive a que ja tinha sido excluida. Dava "2 unidades" numa
          empresa com uma so — e a excluida aparecia como se pudesse receber
          acesso. Pior: a pessoa procurava essa unidade no Trocar de Loja e
          na Liberacao por Unidade, onde ela (corretamente) nao esta, e
          concluia que as telas nao conversavam entre si.
          ========================================================== */
       var sucs=(DB.sucursais||[]).filter(function(x){
         return !x.excluida&&!x.excluidaEm&&x.ativa!==false;
       }).slice().sort(function(a,b){
         if(!!b.matriz!==!!a.matriz)return b.matriz?1:-1;
         return String(a.nome||'').localeCompare(String(b.nome||''));
       });
       /* cada acesso vai para a unidade dele; sem unidade = empresa inteira */
       var porUn={},semUn=[];
       resto.forEach(function(u){
         var sid=(u.sucursais||[])[0];
         if(sid&&sucs.some(function(x){return x.id===sid})){(porUn[sid]=porUn[sid]||[]).push(u);}
         else semUn.push(u);
       });
       var aberta=buscando||US.abertas[nomeEmp]!==false;
       var totalAc=resto.length;
       /* ==========================================================
          QUEM ALCANCA TODAS AS UNIDADES
          Isto olhava so o "acesso total". Quando a franqueadora passou a
          ser tela por tela, ela deixou de contar — e a matriz voltou a
          aparecer como "sem acesso criado", sendo que a franqueadora chega
          nela todos os dias.
          O que alcanca a empresa inteira nao e ver todas as telas: e nao
          estar preso a nenhuma unidade. Acesso sem unidade cobre todas.
          ========================================================== */
       var cobreTudo=resto.some(function(u){
         return u.tudo||u.mestre||!((u.sucursais||[]).length);
       });
       h+='<div class="usrSec">Empresa<span class="usrLn"></span></div>'+
        '<div class="usrPasta'+(aberta?' ab':'')+'">'+
        '<button class="usrPastaH" onclick="abrirPastaEmpresa(this,\''+
          String(nomeEmp).replace(/'/g,"\\'")+'\')">'+
         '<span class="usrSeta"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" '+
           'stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'+
           '<path d="M9 5l7 7-7 7"/></svg></span>'+
         '<div class="usrAv" style="background:var(--deep);color:#fff">'+
           E(String(nomeEmp||'?').charAt(0).toUpperCase())+'</div>'+
         '<div class="usrN"><b>'+E(nomeEmp)+'</b><span>'+sucs.length+' unidade'+
          (sucs.length===1?'':'s')+' · '+totalAc+' acesso'+(totalAc===1?'':'s')+'</span></div>'+
        '</button><div class="usrFilhos">'+
        semUn.map(function(u){return linha(u,true)}).join('')+
        sucs.map(function(sc){
          var us=porUn[sc.id]||[];
          /* Unidade COM acesso mostra so o acesso: o nome da unidade ja vem
             na propria linha dele, e repetir logo acima era a mesma coisa
             escrita duas vezes.
             Unidade SEM acesso continua aparecendo — foi para isso que a
             arvore passou a nascer das sucursais. */
          if(us.length)return us.map(function(u){return linha(u,true)}).join('');
          /* Unidade coberta por um acesso de empresa inteira NAO esta sem
             acesso: alguem ja chega nela. Mostrar "sem acesso criado" ali
             era informacao falsa, e ainda parecia uma linha para excluir. */
          /* ==========================================================
             UNIDADE SEM ACESSO NAO APARECE MAIS
             Esta linha existia para a franqueadora achar uma unidade recem
             cadastrada e criar o login dela. Isso acabou: desde a V79 a
             unidade e o acesso nascem juntos, no cadastro da sucursal.
             A linha virou so ruido — e pior, parecia um login excluido que
             nao saia da tela, com um botao de excluir que nao existe.
             Esta e uma lista de ACESSOS. Unidade se ve em Sucursais.
             ========================================================== */
          return '';
        }).join('')+
        '</div></div>';
       if(!h)h='<div class="usrVaz" style="padding:20px 12px">Nenhum acesso encontrado.</div>';
       return h;
     })()+
     '</div></div>'+
    '<div class="usrDet">'+(US.sel?detalheUsuario():
      '<div class="usrVazio">'+sv('users',30)+
      '<b>Selecione um usuário</b>'+
      '<span>Ou crie um novo para dar acesso a alguém da equipe ou a um franqueado.</span></div>')+
    '</div>'+
   '</div></div></div>';
  var b=$('usB');
  if(b)b.oninput=function(){US.busca=this.value;var p=this.selectionStart;telaUsuarios();
    var n=$('usB');if(n){n.focus();n.setSelectionRange(p,p);}};
  rodape(DB.usuarios.length+' usuários');
}
function contaPerm(u){
  return Object.keys(u.permissoes||{}).filter(function(k){return u.permissoes[k]}).length;
}

/* ---------- detalhe do usuário ---------- */
function detalheUsuario(){
  var u=DB.usuarios.find(function(x){return x.id===US.sel});
  if(!u)return '';
  var sucs=sucAtivas();
  return '<div class="usrH">'+
    '<div class="usrAvG'+(u.mestre?' m':'')+'">'+E((u.nome||'?').charAt(0).toUpperCase())+'</div>'+
    '<div><b>'+E(u.nome)+'</b><span>'+E(u.login)+
     (u.mestre?' · dono do sistema':'')+'</span></div>'+
    '<div style="flex:1"></div>'+
    (u.mestre?'':'<label class="chkL" style="margin:0"><input type="checkbox" '+
      (u.ativo!==false?'checked':'')+' onchange="togAtivoUsr()"><span>ativo</span></label>')+
    /* ==========================================================
       O ACESSO DA UNIDADE NAO SE EDITA AQUI
       Nome, login e senha do responsavel de uma loja moram no cadastro da
       sucursal. Ter os dois lugares editando o mesmo acesso foi o que
       espalhou o cadastro. Aqui o botao leva para la, em vez de abrir um
       segundo formulario do mesmo dado.
       A equipe da loja (caixa, producao) continua sendo criada e editada
       aqui — essa gente nao tem cadastro de unidade.
       ========================================================== */
    ((function(){
      var _s=(DB.sucursais||[]).find(function(x){
        var a=acessoDaSuc(x); return a&&a.id===u.id;});
      if(_s)return '<button class="btnP2" onclick="formSucursal(\''+_s.id+'\')">'+
        sv('edit',12)+' Editar em Sucursais</button>';
      return '<button class="btnP2" onclick="editarUsuario()">'+sv('edit',12)+' Editar</button>';
    })())+
    (u.mestre?'':'<button class="btnP2 rdB" onclick="excluirUsuario()">'+sv('trash',12)+'</button>')+
   '</div>'+
   (u.mestre
    ?'<div class="usrMestre">'+sv('lock',20)+
     '<div><b>Acesso total</b><span>Este é o usuário dono do sistema. '+
     'Ele enxerga todas as lojas e todas as telas, e não pode ser restringido.</span></div></div>'
    :'<div class="usrAbas">'+
      [['permissoes','O que pode ver','list'],['lojas','Lojas que acessa','store'],
       ['app','Aplicativo','chart']]
       .map(function(a){
        return '<button class="usrAba'+(US.aba===a[0]?' on':'')+'" '+
        'onclick="US.aba=\''+a[0]+'\';telaUsuarios()">'+sv(a[2],13)+' '+a[1]+'</button>';
       }).join('')+
     '</div>'+
     (US.aba==='lojas'?abaLojasUsr(u,sucs):
      US.aba==='app'?abaAppUsr(u):abaPermUsr(u)))+
  '';
}
var CARTOES_APP=[
 {id:'faturamento', n:'Faturamento do período',  d:'o número principal, com a variação'},
 {id:'pedidos',     n:'Quantidade de pedidos',   d:'e a comparação com o período anterior'},
 {id:'ticket',      n:'Ticket médio',            d:''},
 {id:'entregas',    n:'Entregas e frente de caixa',d:'quantidade e valor de cada um'},
 {id:'maisvendidos',n:'Mais vendidos',           d:'os 5 produtos que mais saíram'},
 {id:'evolucao',    n:'Gráfico de evolução',     d:'últimos dias ou meses'},
 {id:'pagamentos',  n:'Formas de pagamento',     d:'quanto entrou em cada uma'},
 {id:'clientes',    n:'Clientes atendidos',      d:''}
];
function abaAppUsr(u){
  var link='https://app.joiagest.com.br/';
  var c=u.cartoes||[];
  var todos=!c.length;
  return '<div class="usrCorpo">'+
   '<div class="appAviso">'+sv('chat',18)+
    '<div><b>Aplicativo Joia</b>'+
    '<span>O franqueado abre este link no celular, entra com o mesmo login e senha, '+
    'e vê só a loja dele.</span>'+
    '<div class="appLink"><code>'+E(link)+'</code>'+
     '<button class="btnMini" onclick="copiarLinkApp()">copiar</button>'+
     '<a class="btnMini" href="'+link+'" target="_blank">abrir</a></div>'+
    '</div></div>'+
   '<div class="cfgSep">O que aparece no aplicativo</div>'+
   '<label class="chkL" style="margin-bottom:10px"><input type="checkbox" '+(todos?'checked':'')+
    ' onchange="todosCartoes(this.checked)"><span><b>Mostrar tudo</b>'+
    '<span>o franqueado vê todos os indicadores disponíveis</span></span></label>'+
   '<div class="cartGrade">'+CARTOES_APP.map(function(k){
     var on=todos||c.indexOf(k.id)>=0;
     return '<label class="chkL'+(todos?' bloq':'')+'">'+
      '<input type="checkbox"'+(on?' checked':'')+(todos?' disabled':'')+
      ' onchange="togCartao(\''+k.id+'\')">'+
      '<span><b>'+E(k.n)+'</b>'+(k.d?'<span>'+E(k.d)+'</span>':'')+'</span></label>';
   }).join('')+'</div>'+
   '<div class="cfgSep">Publicar o acesso</div>'+
   '<div class="hint" style="margin-bottom:10px">O login só funciona no aplicativo depois '+
   'de publicado. Publique de novo sempre que mudar a senha ou as permissões.</div>'+
   '<button class="btnP2 ok" onclick="publicarAcesso()">'+sv('cloud',13)+
    ' Publicar acesso de '+E(u.nome)+'</button>'+
   (u.publicadoEm?'<div class="hint" style="margin-top:8px">'+sv('check',11)+
     ' publicado em '+E(new Date(u.publicadoEm).toLocaleString('pt-BR'))+'</div>':'')+
  '</div>';
}
function togCartao(id){
  var u=usrSel();if(!u)return;
  u.cartoes=u.cartoes||[];
  var i=u.cartoes.indexOf(id);
  if(i>=0)u.cartoes.splice(i,1); else u.cartoes.push(id);
  salvar();semPular(telaUsuarios);
}
function todosCartoes(marcar){
  var u=usrSel();if(!u)return;
  u.cartoes=marcar?[]:CARTOES_APP.map(function(k){return k.id});
  salvar();semPular(telaUsuarios);
}
function copiarLinkApp(){
  var l='https://app.joiagest.com.br/';
  try{navigator.clipboard.writeText(l);toast('Link copiado — mande para o franqueado.');}
  catch(e){prompt('Copie o link:',l);}
}
async function publicarAcesso(){
  var u=usrSel();if(!u)return;
  if(!NUVEM.ligada){toast('Ligue a nuvem para publicar o acesso.');return;}
  try{
    baseSuc();
    /* converte os códigos locais para os do banco */
    var mapa={};
    var sc=await api('sucursais?loja_id=eq.'+NUVEM.loja);
    (sc||[]).forEach(function(x){ mapa[x.ref_local||x.id]=x.id; });
    var sucs=(u.sucursais||[]).map(function(id){return mapa[id]||id});
    /* ATENCAO ao metodo aqui. Com POST + merge-duplicates a linha inteira e
       substituida, e as colunas que esta tela nao manda voltam para nulo —
       entre elas SENHA_HASH. Ou seja: republicar o acesso de alguem que ja
       existia apagava a senha dele, e o franqueado ficava trancado para fora
       do aplicativo sem ninguem entender por que. PATCH so toca no que vai
       escrito; a senha, ultimo_acesso e bloqueado_ate ficam onde estao. */
    /* o login do APLICATIVO pode ser simples (ver comentario na tela). Quem
       nunca escolheu um continua com o e-mail do sistema. */
    var loginApp=String(u.loginApp||u.login||'').trim().toLowerCase();
    if(!loginApp)throw new Error('Este acesso está sem login.');
    var campos={
      loja_id:NUVEM.loja,
      nome:u.nome,login:loginApp,
      ativo:u.ativo!==false,mestre:!!u.mestre,tudo:!!u.tudo,
      sucursais:sucs,permissoes:u.permissoes||{},
      cartoes:u.cartoes||[],ref_local:u.id
    };
    /* procura pela referencia do usuario, nao pelo login: se o login mudou,
       procurar pelo login novo nao acharia a linha antiga e nasceria um
       acesso duplicado, com a pessoa aparecendo duas vezes na lista */
    var ja=await api('app_usuarios?ref_local=eq.'+encodeURIComponent(u.id),
                     'PATCH',campos,{'Prefer':'return=representation'});
    if(!(Array.isArray(ja)&&ja.length))
      ja=await api('app_usuarios?login=eq.'+encodeURIComponent(loginApp),
                   'PATCH',campos,{'Prefer':'return=representation'});
    var existia=Array.isArray(ja)&&ja.length>0;
    if(!existia)
      await api('app_usuarios?on_conflict=login','POST',[campos],
                {'Prefer':'resolution=merge-duplicates'});
    /* a senha vai por funcao, que cifra dentro do banco. Mandar o texto puro
       na tabela deixaria a senha legivel para quem lesse a linha. */
    /* a senha digitada na propria linha manda; se estiver vazia, vale a que
       o usuario ja tiver no cadastro (compatibilidade com o jeito antigo) */
    var _campo=$('sa_'+u.id);
    var _senhaApp=(_campo?String(_campo.value||'').trim():'')||u.senha||'';
    if(_senhaApp&&_senhaApp.length<4){
      throw new Error('A senha do aplicativo precisa ter ao menos 4 caracteres.');
    }
    if(_senhaApp){
      var rs=await api('rpc/app_definir_senha','POST',
        {p_login:loginApp,p_senha:_senhaApp});
      var dd=Array.isArray(rs)?rs[0]:rs;
      if(dd&&dd.erro)throw new Error(dd.erro);
      if(_campo)_campo.value='';
    }else if(!existia){
      /* so e erro quando o acesso esta NASCENDO sem senha. Para quem ja
         existe, campo de senha em branco significa "mantem a que tem" —
         antes isso barrava a republicacao de qualquer permissao. */
      throw new Error('Digite a senha do aplicativo na coluna "Senha do app", '+
        'nesta mesma linha, e clique em Publicar. É ela que abre o aplicativo — '+
        'não é a senha de entrar no sistema.');
    }
    u.publicadoEm=new Date().toISOString();
    salvar();telaUsuarios();
    toast('Acesso publicado — '+u.nome+' entra com o login "'+loginApp+'".');
  }catch(e){
    var det=String((e&&(e.message||e.hint||e.details))||e||'').slice(0,140);
    await confirmar({titulo:'Não consegui publicar o acesso',
      texto:'O login de '+E(u.nome)+' não foi liberado no aplicativo.',
      aviso:det?'Detalhe: '+E(det):'Verifique se a nuvem está ligada.',
      ok:'Entendi',cancelar:null,tipo:'perigo'});
  }
}
function abaLojasUsr(u,sucs){
  var todas=!u.sucursais||!u.sucursais.length;
  return '<div class="usrCorpo">'+
   '<div class="hint" style="margin-bottom:12px">Marque as lojas que este usuário acessa. '+
   'Sem marcar nenhuma, ele vê todas — use isso só para quem é da matriz.</div>'+
   '<label class="chkL" style="margin-bottom:10px"><input type="checkbox" '+(todas?'checked':'')+
    ' onchange="todasLojasUsr(this.checked)"><span><b>Todas as lojas</b>'+
    '<span>acesso a qualquer sucursal, inclusive as futuras</span></span></label>'+
   '<div class="lojaChk">'+sucs.map(function(s){
     var on=todas||(u.sucursais||[]).indexOf(s.id)>=0;
     return '<label class="chkL'+(todas?' bloq':'')+'">'+
      '<input type="checkbox"'+(on?' checked':'')+(todas?' disabled':'')+
      ' onchange="togLojaUsr(\''+s.id+'\')">'+
      '<span><b>'+E(s.nome)+'</b><span>'+E(s.cidade||'')+'</span></span></label>';
   }).join('')+'</div></div>';
}
/* troca o acesso total pelo controle tela a tela, mantendo o que ja estava
   marcado — desligar sem preservar deixaria a pessoa sem nada de repente */
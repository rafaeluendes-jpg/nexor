/* ==========================================================
   BLOCO 17 — FRENTE DE CAIXA (financeiro)
   ========================================================== */
var FC={de:'',ate:'',turno:''};
function telaFrenteCaixa(){
  baseLanc();baseTurnos();
  DB.caixas=DB.caixas||[];
  if(!FC.de){var d=new Date();
    FC.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    FC.ate=hojeISO();}
  var aberto=caixaAberto();
  /* ==========================================================
     CAIXA QUE FICOU ABERTO DE OUTRO DIA PRECISA APARECER

     A lista abaixo so mostra caixa COM data de fechamento. Um caixa que
     perdeu o fechamento simplesmente sumia da tela: nem entre os
     fechados, nem como pendencia. Foi o que aconteceu com o dia 27/08
     em Santa Fe do Sul — o Rafael procurou o relatorio do dia e nao
     havia nada, embora as vendas estivessem todas gravadas.

     Agora ele aparece em cima, em vermelho, com o botao que fecha
     aquele caixa especificamente, pela mesma tela de conferencia.
     ========================================================== */
  var esquecidos=(typeof caixasEsquecidos==='function'?caixasEsquecidos():[])
    .filter(function(c){return !aberto||c.id!==aberto.id});
  var fechados=(DB.caixas||[]).filter(function(c){
    if(!c.fechadoEm)return false;
    if(FC.turno&&c.turnoId!==FC.turno)return false;
    var d=isoDoCaixa(c.aberto);
    return (!FC.de||d>=FC.de)&&(!FC.ate||d<=FC.ate);
  }).sort(function(a,b){return isoDoCaixa(b.aberto).localeCompare(isoDoCaixa(a.aberto))});

  var totV=fechados.reduce(function(a,c){return a+(Number(c.vendas)||0)},0);
  var totDif=fechados.reduce(function(a,c){return a+((Number(c.contado)||0)-(Number(c.esperado)||0))},0);

  $('content').innerHTML='<div class="finWrap">'+
  '<div class="finTop"><div><h1>Frente de Caixa</h1>'+
  '<p>Aberturas e fechamentos do PDV, com a conferência de cada turno.</p></div>'+
  '<div class="finActs"><button class="btnP2" onclick="abrir(\'pdv\',\'pdv\')">'+sv('pos',14)+' Ir ao PDV</button></div></div>'+

  (aberto
   ?'<div class="fcAberto'+(caixaDeOutroDia(aberto)?' fcPend':'')+'">'+
     '<div class="fcIco">'+sv('cash',26)+'</div>'+
     '<div class="fcInfo">'+
      '<span class="fcTag">CAIXA ABERTO'+
       (caixaDeOutroDia(aberto)?' DESDE '+E(String(aberto.aberto).slice(0,10)):'')+
       (aberto.turno?' · '+E(aberto.turno).toUpperCase():'')+'</span>'+
      '<b>Aberto em '+E(aberto.aberto)+'</b>'+
      '<span>'+(caixaDeOutroDia(aberto)
        ?'Ficou aberto de um dia para o outro. Feche com a conferência para o '+
         'turno entrar no relatório — as vendas dele já estão todas lançadas.'
        :'Operador: '+E(aberto.operador||'—')+' · '+movimentoCaixa(aberto.id).qtd+
         ' pedidos no turno')+'</span>'+
     '</div>'+
     '<div class="fcVal"><span>Dinheiro em gaveta</span><b>R$ '+money(esperadoCaixa(aberto))+'</b></div>'+
     '<div class="fcVal"><span>Vendas do turno</span><b>R$ '+money(movimentoCaixa(aberto.id).total)+'</b></div>'+
     /* ==========================================================
        A TELA DO FECHAMENTO PRECISA FECHAR

        Ela se chama Frente de Caixa, lista os fechamentos, e nao tinha
        como fechar o caixa aberto — so "Ver detalhes". Quem precisava
        fechar tinha de descobrir sozinho que o caminho era outro, pelo
        PDV. Em 29/08/2026 eu mandei o Rafael clicar aqui num botao que
        nao existia nesta situacao.
        ========================================================== */
     '<button class="btnP2" onclick="verCaixa(\''+aberto.id+'\')">Ver detalhes</button>'+
     '<button class="btnP2 ok" onclick="fecharCaixa(\''+aberto.id+'\')">'+
      sv('cash',14)+' Fechar caixa</button>'+
    '</div>'
   :'<div class="fcFechado">'+sv('cash',20)+
     '<div><b>Nenhum caixa aberto no momento</b>'+
     '<span>Abra a frente de caixa no PDV para começar a operação.</span></div>'+
     '<button class="btnP2 ok" onclick="abrir(\'pdv\',\'pdv\')">Abrir no PDV</button></div>')+

  (esquecidos.length
   ?'<div class="fcAberto fcPend">'+
     '<div class="fcIco">'+sv('help',26)+'</div>'+
     '<div class="fcInfo">'+
      '<span class="fcTag">'+
       (esquecidos.length>1?esquecidos.length+' CAIXAS ABERTOS SEM FECHAMENTO'
                           :'CAIXA ABERTO SEM FECHAMENTO')+'</span>'+
      '<b>'+esquecidos.map(function(c){return E(c.aberto)}).join(' · ')+'</b>'+
      '<span>Só pode haver um caixa aberto por unidade. Este ficou para trás, '+
      'não entra no relatório abaixo e precisa ser fechado com a conferência. '+
      'O caixa em operação continua sendo o último aberto.</span>'+
     '</div>'+
     esquecidos.map(function(c){
       return '<button class="btnP2 ok" onclick="fecharCaixa(\''+c.id+'\')">'+
        'Fechar '+E(c.aberto)+'</button>';
     }).join('')+
    '</div>'
   :'')+
  '<div class="filtroCard" style="margin-top:4px">'+
   '<div class="fl"><label>De</label><input type="date" id="fcDe" value="'+FC.de+'"></div>'+
   '<div class="fl"><label>Até</label><input type="date" id="fcAte" value="'+FC.ate+'"></div>'+
   '<div class="fl"><label>Turno</label><select id="fcTurno">'+
    '<option value="">Todos os turnos</option>'+
    (DB.turnos||[]).map(function(t){
      return '<option value="'+E(t.id)+'"'+(FC.turno===t.id?' selected':'')+'>'+E(t.nome)+'</option>';
    }).join('')+'</select></div>'+
   '<button class="btnP2 ok" onclick="buscarCaixas()">'+sv('search',14)+' Buscar</button>'+
   '<button class="btnP2" onclick="FC.de=\'\';FC.ate=\'\';FC.turno=\'\';telaFrenteCaixa()">Limpar</button>'+
   '<div style="flex:1"></div>'+
   '<div class="fcResumo">'+
    '<div><span>Turnos</span><b>'+fechados.length+'</b></div>'+
    '<div><span>Vendas</span><b>R$ '+money(totV)+'</b></div>'+
    '<div><span>Diferença acumulada</span><b class="'+(Math.abs(totDif)<0.01?'vg':'vr')+'">R$ '+money(totDif)+'</b></div>'+
   '</div>'+
  '</div>'+

  '<div class="pnl2"><div class="pnl2H">Frentes de caixa fechadas <span class="cnt2">'+fechados.length+'</span></div>'+
  '<div class="pnl2B" style="padding:0">'+
  (fechados.length?'<table class="pTable finTab tabFC"><thead><tr>'+
   '<th>Turno</th>'+
   '<th style="width:64px;text-align:center">Ped.</th>'+
   '<th style="width:108px;text-align:right">Vendas</th>'+
   '<th style="width:108px;text-align:right">Esperado</th>'+
   '<th style="width:108px;text-align:right">Contado</th>'+
   '<th style="width:104px;text-align:right">Diferença</th>'+
   '<th style="width:78px"></th></tr></thead><tbody>'+
   fechados.map(function(c){
     var dif=(Number(c.contado)||0)-(Number(c.esperado)||0);
     var trava=caixaConciliado(c.id);
     return '<tr style="cursor:pointer" onclick="verCaixa(\''+c.id+'\')">'+
     '<td><b>'+E(c.aberto)+(c.turno?' <span class="cidTag">'+E(c.turno)+'</span>':'')+'</b>'+
      '<small>fechou '+E(c.fechadoEm)+' · '+E(c.operador||'sem operador')+
      (trava?' <span class="concTag">'+sv('nike',11)+'</span>':'')+'</small></td>'+
     '<td style="text-align:center">'+(c.qtd||0)+'</td>'+
     '<td style="text-align:right">R$ '+money(c.vendas||0)+'</td>'+
     '<td style="text-align:right">R$ '+money(c.esperado||0)+'</td>'+
     '<td style="text-align:right">R$ '+money(c.contado||0)+'</td>'+
     '<td style="text-align:right"><b class="'+(Math.abs(dif)<0.01?'vg':'vr')+'">'+
      (dif>0?'+':dif<0?'-':'')+'R$ '+money(Math.abs(dif))+'</b></td>'+
     '<td onclick="event.stopPropagation()"><div class="rowAct">'+
      '<button class="rBtn" onclick="verCaixa(\''+c.id+'\')" title="Abrir">'+sv('eye',12)+'</button>'+
      '<button class="rBtn" onclick="editarCaixa(\''+c.id+'\')" title="Editar">'+sv('edit',12)+'</button>'+
     '</div></td></tr>';
   }).join('')+'</tbody></table>'
  :'<div class="entVazio"><b>Nenhum caixa fechado no período</b>'+
   '<span>Ajuste as datas acima e clique em Buscar.</span></div>')+
  '</div></div></div>';
  rodape(fechados.length+' turnos no período');
}
function isoDoCaixa(txt){
  var p=String(txt||'').split(' ')[0].split('/');
  if(p.length!==3)return hojeISO();
  return p[2]+'-'+p[1]+'-'+p[0];
}
function buscarCaixas(){
  FC.de=$('fcDe').value;FC.ate=$('fcAte').value;
  FC.turno=($('fcTurno')||{}).value||'';
  telaFrenteCaixa();
}
function caixaConciliado(id){
  return (DB.lancFin||[]).some(function(l){return l.ref===id&&l.origem==='fechamento-caixa'&&l.conciliado});
}

/* ---------- DETALHE DO CAIXA ---------- */
/* ==========================================================
   RELATORIO DE FRENTE DE CAIXA — UMA FONTE SO (item 25)

   A regra que mais importa aqui e negativa: NENHUMA aba faz conta
   propria. Todas leem `dadosDoCaixa()`, que monta o retrato uma vez.
   Sem isso, uma venda vale R$ 100 no Resumo e R$ 90 em Recebimentos —
   e quando os dois numeros divergem ninguem sabe qual acreditar.

   Para caixa FECHADO, a fonte e o snapshot congelado no fechamento
   (item 26). Reimprimir em novembro tem de dar o mesmo que foi
   assinado em agosto, mesmo que uma venda tenha sido cancelada no
   meio do caminho.
   ========================================================== */
var VC={aba:'resumo',id:null,dinAberto:false};
function dadosDoCaixa(c){
  var fechado=!!c.fechadoEm;
  var mov=movimentoCaixa(c.id);
  var s=(fechado&&c.snapshot&&c.snapshot.formas)?c.snapshot:null;

  /* vendas do turno, sempre da mesma origem */
  var peds=(DB.pedidos||[]).filter(function(p){return p.caixaId===c.id});
  var ok=peds.filter(function(p){return !ehCancelado(p)});
  var canc=peds.filter(function(p){return ehCancelado(p)});
  var bruto=ok.reduce(function(a,p){return a+(Number(p.total)||0)},0)+
            canc.reduce(function(a,p){return a+(Number(p.total)||0)},0);
  var vCanc=canc.reduce(function(a,p){return a+(Number(p.total)||0)},0);
  var liquido=+(bruto-vCanc).toFixed(2);

  var fundo   = s?s.fundoAbertura : (Number(c.inicial)||0);
  var supri   = s?s.suprimentos   : totalMov(c,'suprimento');
  var sangria = s?s.sangrias      : totalMov(c,'sangria');
  var vendDin = s?s.vendasDinheiro: (Number(mov.dinheiro)||0);

  /* recebimentos: sistema x fisico x diferenca */
  var formas;
  if(s){ formas=s.formas.slice(); }
  else {
    var espG=esperadoCaixa(c);
    formas=FORMAS.map(function(f){
      var e=f.troco?espG:(mov.porForma[f.id]||0);
      var i=(c.conferencia&&c.conferencia[f.id]!==undefined&&c.conferencia[f.id]!==null)
        ?Number(c.conferencia[f.id]):null;
      return {id:f.id,nome:f.n,troco:!!f.troco,sistema:+e.toFixed(2),
        fisico:i===null?null:+i.toFixed(2),
        diferenca:i===null?null:+(i-e).toFixed(2)};
    });
  }
  var totSis=+formas.reduce(function(a,x){return a+x.sistema},0).toFixed(2);
  var totFis=+formas.reduce(function(a,x){return a+(x.fisico||0)},0).toFixed(2);
  var difGer=s?Number(s.diferencaTotal)||0:+(totFis-totSis).toFixed(2);
  var conciliado=Math.abs(difGer)<0.01;
  var divergeForma=s?!!s.divergenciaEntreFormas
    :(conciliado&&formas.some(function(x){return x.diferenca!==null&&Math.abs(x.diferenca)>=0.01}));
  var din=formas.filter(function(x){return x.troco})[0]||
          {sistema:0,fisico:null,diferenca:null,nome:'Dinheiro'};

  var movs=(s&&s.movimentos)?s.movimentos:(c.movimentos||[]).map(function(m){
    return {hora:m.hora||'',tipo:m.tipo,valor:Number(m.valor)||0,
      motivo:m.motivoNome||m.motivo||'',descricao:m.motivo||'',
      destino:m.destinoNome||'',responsavel:m.responsavel||'',lancRef:m.lancRef||''};
  });

  var cancels=(DB.cancelamentos||[]).filter(function(x){return x.caixaId===c.id});
  var descs=ok.filter(function(p){return (Number(p.desconto)||0)>0.001||p.cupom});

  return {c:c,fechado:fechado,doSnapshot:!!s,mov:mov,
    peds:peds,ok:ok,canc:canc,
    bruto:+bruto.toFixed(2),vCanc:+vCanc.toFixed(2),liquido:liquido,
    qtd:ok.length,ticket:ok.length?+(liquido/ok.length).toFixed(2):0,
    fundo:fundo,suprimentos:supri,sangrias:sangria,vendasDinheiro:vendDin,
    formas:formas,totSis:totSis,totFis:totFis,difGeral:difGer,
    conciliado:conciliado,divergeForma:divergeForma,dinheiro:din,
    movimentos:movs,cancelamentos:cancels,descontos:descs,
    semForma:s?s.semForma:+((mov.semForma||0)+(mov.descoberto||0)).toFixed(2),
    lanc:(DB.lancFin||[]).filter(function(l){return l.ref===c.id&&l.origem==='fechamento-caixa'})};
}
function sinalRS(v){
  if(v===null||v===undefined)return '<span class="vcNulo">—</span>';
  if(Math.abs(v)<0.01)return '<span class="vcZero">R$ 0,00</span>';
  return '<span class="'+(v>0?'vcMais':'vcMenos')+'">'+(v>0?'+ ':'− ')+'R$ '+money(Math.abs(v))+'</span>';
}
function verCaixa(id){
  VC.id=id; VC.aba='resumo'; VC.dinAberto=false;
  var c=(DB.caixas||[]).find(function(x){return x.id===id});
  if(!c)return;
  var o=document.getElementById('mdOv');
  if(!o){
    o=document.createElement('div');o.className='mdOv';o.id='mdOv';
    document.body.appendChild(o);
  }
  desenharVerCaixa();
  fecharSoForaDeVerdade(document.getElementById('mdOv'));
}
function vcAba(a){ VC.aba=a; desenharVerCaixa(); }
function vcDinheiro(){ VC.dinAberto=!VC.dinAberto; desenharVerCaixa(); }
function desenharVerCaixa(){
  var c=(DB.caixas||[]).find(function(x){return x.id===VC.id});
  if(!c)return;
  var d=dadosDoCaixa(c);
  var abas=[['resumo','Resumo'],['receb','Recebimentos'],['movs','Movimentações'],
            ['canc','Cancelamentos'],['desc','Descontos'],['vendas','Vendas'],
            ['oper','Operadores'],['aud','Auditoria']];

  /* ---------- cabecalho (item 13) ---------- */
  var cab='<div class="vcCab">'+
    '<div class="vcCabL">'+
      '<span class="vcEmp">'+E(cfg().nomePublico||nomeLojaAtual()||'')+'</span>'+
      '<h2>'+E(sucNome(c.sucursalId||lojaAtualId()))+'</h2>'+
      '<div class="vcMeta">'+
        '<span><b>Caixa</b>'+E(String(c.id||'').slice(-8))+'</span>'+
        (c.turno?'<span><b>Turno</b>'+E(c.turno)+'</span>':'')+
        '<span><b>Abertura</b>'+E(c.aberto||'—')+'</span>'+
        '<span><b>Fechamento</b>'+E(c.fechadoEm||'—')+'</span>'+
        '<span><b>Abriu</b>'+E(c.operador||'—')+'</span>'+
        '<span><b>Fechou</b>'+E(c.fechadoPor||'—')+'</span>'+
      '</div>'+
    '</div>'+
    '<div class="vcStatus '+(!d.fechado?'ab':(d.conciliado?'ok':'df'))+'">'+
      '<span>'+(!d.fechado?'CAIXA ABERTO':(d.conciliado?(d.divergeForma?'CONCILIADO':'CONFERE'):'COM DIVERGÊNCIA'))+'</span>'+
      (d.fechado?'<b>'+(Math.abs(d.difGeral)<0.01?'R$ 0,00'
        :(d.difGeral>0?'+ ':'− ')+'R$ '+money(Math.abs(d.difGeral)))+'</b>'+
        '<small>diferença geral</small>':'<b>R$ '+money(esperadoCaixa(c))+'</b><small>na gaveta</small>')+
    '</div>'+
  '</div>';

  var nav='<div class="vcAbas">'+abas.map(function(a){
    return '<button class="'+(VC.aba===a[0]?'on':'')+'" onclick="vcAba(\''+a[0]+'\')">'+a[1]+'</button>';
  }).join('')+'</div>';

  var corpo='';

  /* ---------- RESUMO (item 15) ---------- */
  if(VC.aba==='resumo'){
    corpo=
    '<div class="vcGrid">'+
      '<div class="vcCard"><div class="vcCardT">Faturamento</div>'+
        '<div class="vcL"><span>Bruto</span><b>R$ '+money(d.bruto)+'</b></div>'+
        '<div class="vcL"><span>(−) cancelamentos</span><b class="vcMenos">R$ '+money(d.vCanc)+'</b></div>'+
        '<div class="vcL tot"><span>Líquido</span><b>R$ '+money(d.liquido)+'</b></div>'+
        '<div class="vcL"><span>Vendas</span><b>'+d.qtd+'</b></div>'+
        '<div class="vcL"><span>Ticket médio</span><b>R$ '+money(d.ticket)+'</b></div>'+
      '</div>'+
      '<div class="vcCard"><div class="vcCardT">Dinheiro na gaveta</div>'+
        '<div class="vcL"><span>Fundo inicial</span><b>R$ '+money(d.fundo)+'</b></div>'+
        '<div class="vcL"><span>Vendas em dinheiro</span><b>+ R$ '+money(d.vendasDinheiro)+'</b></div>'+
        '<div class="vcL"><span>Suprimentos</span><b>+ R$ '+money(d.suprimentos)+'</b></div>'+
        '<div class="vcL"><span>Sangrias</span><b>− R$ '+money(d.sangrias)+'</b></div>'+
        '<div class="vcL tot"><span>Esperado</span><b>R$ '+money(d.dinheiro.sistema)+'</b></div>'+
        '<div class="vcL"><span>Físico informado</span><b>'+
          (d.dinheiro.fisico===null?'—':'R$ '+money(d.dinheiro.fisico))+'</b></div>'+
        '<div class="vcL tot"><span>Diferença</span><b>'+sinalRS(d.dinheiro.diferenca)+'</b></div>'+
      '</div>'+
      '<div class="vcCard"><div class="vcCardT">Conferência geral</div>'+
        '<div class="vcL"><span>Total sistema</span><b>R$ '+money(d.totSis)+'</b></div>'+
        '<div class="vcL"><span>Total físico</span><b>R$ '+money(d.totFis)+'</b></div>'+
        '<div class="vcL tot"><span>Diferença geral</span><b>'+sinalRS(d.difGeral)+'</b></div>'+
        '<div class="vcSelo '+(d.conciliado?'ok':'df')+'">'+
          (d.conciliado?'CONCILIADO':'COM DIVERGÊNCIA')+'</div>'+
      '</div>'+
    '</div>'+
    (d.divergeForma?avisoDivergencia():'')+
    (d.semForma>0.01?'<div class="vcAviso am">'+sv('help',15)+
      '<div><b>R$ '+money(d.semForma)+' em vendas sem forma de pagamento</b>'+
      '<small>Entram no faturamento mas não estão em nenhuma linha de recebimento.</small></div></div>':'');
  }

  /* ---------- RECEBIMENTOS (itens 16, 17 e 18) ---------- */
  if(VC.aba==='receb'){
    corpo='<table class="vcTab"><thead><tr><th>Forma</th>'+
      '<th class="num">Sistema</th><th class="num">Físico</th><th class="num">Diferença</th></tr></thead><tbody>'+
      d.formas.map(function(f){
        var linha='<tr'+(f.troco?' class="vcExp" onclick="vcDinheiro()"':'')+'>'+
          '<td>'+(f.troco?'<span class="vcSeta'+(VC.dinAberto?' ab':'')+'">▸</span> ':'')+E(f.nome)+
          (f.troco?'<small>toque para ver a composição</small>':'')+'</td>'+
          '<td class="num">R$ '+money(f.sistema)+'</td>'+
          '<td class="num">'+(f.fisico===null?'<span class="vcNulo">não informado</span>':'R$ '+money(f.fisico))+'</td>'+
          '<td class="num">'+sinalRS(f.diferenca)+'</td></tr>';
        /* item 17: de onde saiu o numero do dinheiro */
        if(f.troco&&VC.dinAberto){
          linha+='<tr class="vcSub"><td colspan="4"><div class="vcComp">'+
            '<div><span>Fundo de caixa</span><b>R$ '+money(d.fundo)+'</b></div>'+
            '<div><span>+ vendas em dinheiro</span><b>R$ '+money(d.vendasDinheiro)+'</b></div>'+
            '<div><span>+ suprimentos</span><b>R$ '+money(d.suprimentos)+'</b></div>'+
            '<div><span>− sangrias</span><b>R$ '+money(d.sangrias)+'</b></div>'+
            '<div class="tot"><span>= dinheiro esperado</span><b>R$ '+money(f.sistema)+'</b></div>'+
          '</div></td></tr>';
        }
        return linha;
      }).join('')+
      '</tbody><tfoot><tr><td><b>TOTAL</b></td>'+
      '<td class="num"><b>R$ '+money(d.totSis)+'</b></td>'+
      '<td class="num"><b>R$ '+money(d.totFis)+'</b></td>'+
      '<td class="num"><b>'+sinalRS(d.difGeral)+'</b></td></tr></tfoot></table>'+
      (d.divergeForma?avisoDivergencia():'');
  }

  /* ---------- MOVIMENTACOES (item 19) ---------- */
  if(VC.aba==='movs'){
    var linhas=[];
    linhas.push({hora:(c.aberto||'').slice(-5),tipo:'Abertura',valor:d.fundo,
      quem:c.operador||'—',motivo:'Fundo de troco',orig:'—',dest:'Caixa PDV',cls:'gr'});
    d.movimentos.forEach(function(m){
      linhas.push({hora:m.hora,tipo:m.tipo==='sangria'?'Sangria':'Suprimento',
        valor:m.valor,quem:m.responsavel||'—',
        motivo:(m.motivo||'')+(m.descricao&&m.descricao!==m.motivo?' — '+m.descricao:''),
        orig:m.tipo==='sangria'?'Caixa PDV':(m.destino||'—'),
        dest:m.tipo==='sangria'?(m.destino||'—'):'Caixa PDV',
        cls:m.tipo==='sangria'?'rd':'gr'});
    });
    if(d.fechado)linhas.push({hora:(c.fechadoEm||'').slice(-5),tipo:'Fechamento',
      valor:d.dinheiro.fisico||0,quem:c.fechadoPor||'—',motivo:'Contagem da gaveta',
      orig:'Caixa PDV',dest:'—',cls:''});
    corpo=linhas.length
     ?'<table class="vcTab"><thead><tr><th>Hora</th><th>Tipo</th><th class="num">Valor</th>'+
      '<th>Motivo</th><th>Origem</th><th>Destino</th><th>Operador</th></tr></thead><tbody>'+
      linhas.map(function(l){
        return '<tr><td>'+E(l.hora||'—')+'</td>'+
          '<td><span class="badge2 '+l.cls+'">'+E(l.tipo)+'</span></td>'+
          '<td class="num">R$ '+money(l.valor)+'</td>'+
          '<td>'+E(l.motivo||'—')+'</td><td>'+E(l.orig)+'</td>'+
          '<td>'+E(l.dest)+'</td><td>'+E(l.quem)+'</td></tr>';
      }).join('')+'</tbody></table>'
     :vcVazio('Nenhuma movimentação neste turno.');
  }

  /* ---------- CANCELAMENTOS (item 20) ---------- */
  if(VC.aba==='canc'){
    corpo=d.cancelamentos.length
     ?'<table class="vcTab"><thead><tr><th>Hora</th><th>Pedido</th><th class="num">Valor</th>'+
      '<th>Motivo</th><th>Autorizou</th><th>Estoque</th></tr></thead><tbody>'+
      d.cancelamentos.map(function(x){
        var p=(DB.pedidos||[]).find(function(y){return y.id===x.pedidoId});
        var fp=p&&(p.pagamentos||[])[0];
        var fn=fp?((FORMAS.find(function(f){return f.id===fp.forma})||{}).n||'—'):'—';
        return '<tr><td>'+E(x.hora||'—')+'</td>'+
          '<td>#'+E(String(x.numero||'—'))+'<small>'+E(fn)+'</small></td>'+
          '<td class="num vcMenos">R$ '+money(x.valor)+'</td>'+
          '<td>'+E(x.motivo||'—')+(x.obs?'<small>'+E(x.obs)+'</small>':'')+'</td>'+
          '<td>'+E(x.operador||'—')+'</td>'+
          '<td>'+(x.estoqueVoltou?'<span class="badge2 gr">devolvido</span>'
                                 :'<span class="badge2 rd">produzido, não voltou</span>')+'</td></tr>';
      }).join('')+'</tbody><tfoot><tr><td colspan="2"><b>Total cancelado</b></td>'+
      '<td class="num"><b class="vcMenos">R$ '+money(d.vCanc)+'</b></td>'+
      '<td colspan="3"></td></tr></tfoot></table>'
     :vcVazio('Nenhum cancelamento neste turno.');
  }

  /* ---------- DESCONTOS (item 21) ---------- */
  if(VC.aba==='desc'){
    var totD=d.descontos.reduce(function(a,p){return a+(Number(p.desconto)||0)},0);
    corpo=d.descontos.length
     ?'<table class="vcTab"><thead><tr><th>Pedido</th><th class="num">Original</th>'+
      '<th class="num">Desconto</th><th class="num">Final</th><th>Cupom</th><th>Operador</th></tr></thead><tbody>'+
      d.descontos.map(function(p){
        var desc=Number(p.desconto)||0;
        return '<tr><td>#'+E(String(p.numero||''))+'<small>'+E(p.hora||'')+'</small></td>'+
          '<td class="num">R$ '+money((Number(p.total)||0)+desc)+'</td>'+
          '<td class="num vcMenos">R$ '+money(desc)+'</td>'+
          '<td class="num">R$ '+money(p.total)+'</td>'+
          '<td>'+(p.cupom?E(p.cupom.codigo||''):'—')+'</td>'+
          '<td>'+E(c.operador||'—')+'</td></tr>';
      }).join('')+'</tbody><tfoot><tr><td colspan="2"><b>Total de descontos</b></td>'+
      '<td class="num"><b class="vcMenos">R$ '+money(totD)+'</b></td>'+
      '<td colspan="3"></td></tr></tfoot></table>'
     :vcVazio('Nenhum desconto concedido neste turno.');
  }

  /* ---------- VENDAS (item 22) ---------- */
  if(VC.aba==='vendas'){
    corpo='<div class="vcGrid">'+
      '<div class="vcCard"><div class="vcCardT">Indicadores</div>'+
      '<div class="vcL"><span>Pedidos</span><b>'+d.qtd+'</b></div>'+
      '<div class="vcL"><span>Faturamento bruto</span><b>R$ '+money(d.bruto)+'</b></div>'+
      '<div class="vcL"><span>Cancelamentos</span><b class="vcMenos">R$ '+money(d.vCanc)+'</b></div>'+
      '<div class="vcL tot"><span>Faturamento líquido</span><b>R$ '+money(d.liquido)+'</b></div>'+
      '<div class="vcL"><span>Ticket médio</span><b>R$ '+money(d.ticket)+'</b></div>'+
      '</div></div>'+
      (d.ok.length
        ?'<table class="vcTab" style="margin-top:14px"><thead><tr><th>Pedido</th><th>Hora</th>'+
         '<th>Canal</th><th>Formas</th><th class="num">Valor</th></tr></thead><tbody>'+
         d.ok.slice().sort(function(a,b){return (b.hora||'').localeCompare(a.hora||'')})
          .map(function(p){
            var fs=(p.pagamentos||[]).map(function(g){
              return (FORMAS.find(function(f){return f.id===g.forma})||{}).n||'sem forma';
            }).join(' + ');
            return '<tr><td>#'+E(String(p.numero||''))+'</td><td>'+E(p.hora||'')+'</td>'+
              '<td>'+E(p.canal||'pdv')+'</td><td>'+E(fs||'—')+'</td>'+
              '<td class="num">R$ '+money(p.total)+'</td></tr>';
          }).join('')+'</tbody></table>'
        :vcVazio('Nenhuma venda neste turno.'));
  }

  /* ---------- OPERADORES (item 23) ---------- */
  if(VC.aba==='oper'){
    var papeis=[];
    var add=function(nome,papel,det){
      if(!nome)return;
      var j=papeis.find(function(x){return x.nome===nome});
      if(!j){j={nome:nome,papeis:[]};papeis.push(j);}
      if(j.papeis.indexOf(papel)<0)j.papeis.push(papel+(det?' ('+det+')':''));
    };
    add(c.operador,'abriu o caixa');
    if(d.qtd)add(c.operador,'vendas',d.qtd);
    d.movimentos.forEach(function(m){
      add(m.responsavel,m.tipo==='sangria'?'sangria':'suprimento','R$ '+money(m.valor));
    });
    d.cancelamentos.forEach(function(x){ add(x.operador,'autorizou cancelamento'); });
    if(c.fechadoPor)add(c.fechadoPor,'fechou o caixa');
    corpo=papeis.length
     ?'<table class="vcTab"><thead><tr><th>Pessoa</th><th>O que fez neste turno</th></tr></thead><tbody>'+
      papeis.map(function(x){
        return '<tr><td><b>'+E(x.nome)+'</b></td><td>'+
          x.papeis.map(function(p){return '<span class="badge2">'+E(p)+'</span>'}).join(' ')+
          '</td></tr>';
      }).join('')+'</tbody></table>'+
      '<div class="hint" style="margin-top:10px">Nenhuma senha ou credencial é exibida aqui.</div>'
     :vcVazio('Sem registro de operadores neste turno.');
  }

  /* ---------- AUDITORIA (item 24) ---------- */
  if(VC.aba==='aud'){
    var ev=[];
    ev.push({q:c.aberto||'',e:'Abertura de caixa',
      det:'Fundo de R$ '+money(d.fundo),quem:c.operador||'—'});
    d.movimentos.forEach(function(m){
      ev.push({q:m.hora,e:m.tipo==='sangria'?'Sangria':'Suprimento',
        det:'R$ '+money(m.valor)+(m.destino?' → '+m.destino:'')+
            (m.motivo?' · '+m.motivo:'')+(m.lancRef?' · lanç. '+m.lancRef:''),
        quem:m.responsavel||'—'});
    });
    d.cancelamentos.forEach(function(x){
      ev.push({q:x.hora||'',e:'Cancelamento de venda',
        det:'#'+(x.numero||'')+' · R$ '+money(x.valor)+(x.motivo?' · '+x.motivo:''),
        quem:x.operador||'—'});
    });
    if(d.fechado)ev.push({q:c.fechadoEm||'',e:'Fechamento de caixa',
      det:'Diferença geral '+(Math.abs(d.difGeral)<0.01?'R$ 0,00'
        :(d.difGeral>0?'+ ':'− ')+'R$ '+money(Math.abs(d.difGeral)))+
        (d.doSnapshot?' · fotografia gravada':''),
      quem:c.fechadoPor||'—'});
    var ed=c.snapshot&&c.snapshot.editado;
    if(ed)ev.push({q:ed.em||'',e:'Edição administrativa do fechamento',
      det:'Valores refeitos; fotografia anterior preservada',quem:ed.por||'—'});
    corpo='<table class="vcTab"><thead><tr><th>Quando</th><th>Evento</th>'+
      '<th>Detalhe</th><th>Responsável</th></tr></thead><tbody>'+
      ev.map(function(x){
        return '<tr><td>'+E(x.q||'—')+'</td><td><b>'+E(x.e)+'</b></td>'+
          '<td>'+E(x.det)+'</td><td>'+E(x.quem)+'</td></tr>';
      }).join('')+'</tbody></table>'+
      (d.doSnapshot
        ?'<div class="vcAviso vd">'+sv('check',15)+'<div><b>Conferência congelada</b>'+
         '<small>Os números acima vêm da fotografia gravada no fechamento. '+
         'Não mudam se algo for alterado depois.</small></div></div>'
        :'');
  }

  var o=document.getElementById('mdOv');
  o.innerHTML='<div class="mdBox xl vcBox"><div class="mdH"><b>Relatório de frente de caixa</b>'+
    '<button onclick="fecharModal()">&times;</button></div>'+
    '<div class="mdB vcWrap">'+cab+nav+'<div class="vcCorpo">'+corpo+'</div></div>'+
    '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
    '<button class="btnP2" onclick="imprimirAbertura(\''+c.id+'\')">'+
      sv('print2',13)+' Abertura</button>'+
    (d.fechado?'<button class="btnP2" onclick="imprimirFechamento(\''+c.id+'\')">'+
      sv('print2',13)+' Cupom</button>'+
      '<button class="btnP2" onclick="imprimirRelatorioCaixa(\''+c.id+'\')">'+
      sv('print2',13)+' Imprimir relatório</button>':'')+
    (d.fechado?'<button class="btnP2 ok" onclick="editarCaixa(\''+c.id+'\')">'+sv('edit',13)+' Editar fechamento</button>'
     :'<button class="btnP2 ok" onclick="fecharModal();abrir(\'pdv\',\'pdv\')">Ir ao PDV</button>')+
    '</div></div>';
}
function vcVazio(t){ return '<div class="vcVazio">'+E(t)+'</div>'; }
function avisoDivergencia(){
  return '<div class="vcAviso am">'+sv('help',15)+
    '<div><b>Divergência de classificação entre formas de recebimento</b>'+
    '<small>Uma forma sobrou exatamente o que outra faltou: a diferença geral é R$ 0,00. '+
    'O dinheiro está todo aqui — o que errou foi a forma escolhida em alguma venda. '+
    '<b>Isto não é falta de caixa</b> e nenhuma venda foi alterada.</small></div></div>';
}
/* ==========================================================
   IMPRESSAO GERENCIAL (parte E)

   Folha A4, mais completa que a bobina. A bobina continua objetiva —
   quem confere a gaveta no fim da noite nao precisa da lista de
   descontos; quem audita o mes, sim.
   ========================================================== */
function imprimirRelatorioCaixa(id){
  var c=(DB.caixas||[]).find(function(x){return x.id===id});
  if(!c){toast('Caixa não encontrado.');return;}
  var d=dadosDoCaixa(c);
  var lin=function(a,b,cls){return '<tr><td>'+a+'</td><td class="n '+(cls||'')+'">'+b+'</td></tr>';};
  var sec=function(t,html){return '<h3>'+t+'</h3>'+html;};
  var dif=function(v){
    if(v===null)return '—';
    return (Math.abs(v)<0.01?'R$ 0,00':(v>0?'+ ':'- ')+'R$ '+money(Math.abs(v)));
  };
  var h='<html><head><meta charset="utf-8"><title>Fechamento de caixa</title><style>'+
   'body{font:12px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;margin:26px}'+
   'h1{font-size:17px;margin:0 0 2px}h2{font-size:13px;margin:0 0 14px;color:#666;font-weight:500}'+
   'h3{font-size:12px;margin:20px 0 6px;padding-bottom:4px;border-bottom:1.5px solid #2F4A32;color:#2F4A32}'+
   'table{width:100%;border-collapse:collapse;margin-bottom:4px}'+
   'td,th{padding:5px 7px;border-bottom:1px solid #e4e0d8;text-align:left;font-size:11px}'+
   'th{background:#2F4A32;color:#fff;font-size:10.5px}'+
   '.n{text-align:right;white-space:nowrap}.tot td{font-weight:700;border-top:1.5px solid #333}'+
   '.m{color:#B3261E}.p{color:#0E8A46}'+
   '.meta{display:flex;flex-wrap:wrap;gap:4px 22px;font-size:11px;color:#444;margin-bottom:6px}'+
   '.meta b{color:#000}.selo{display:inline-block;padding:4px 10px;border-radius:4px;'+
   'font-size:11px;font-weight:700;margin-top:8px}'+
   '.ok{background:#E7F5EC;color:#0E8A46}.df{background:#FDECEA;color:#B3261E}'+
   '@media print{body{margin:12mm}}</style></head><body>'+
   '<h1>'+E(cfg().nomePublico||nomeLojaAtual()||'')+' — Fechamento de caixa</h1>'+
   '<h2>'+E(sucNome(c.sucursalId||lojaAtualId()))+'</h2>'+
   '<div class="meta">'+
     '<span><b>Caixa:</b> '+E(String(c.id||'').slice(-8))+'</span>'+
     (c.turno?'<span><b>Turno:</b> '+E(c.turno)+'</span>':'')+
     '<span><b>Abertura:</b> '+E(c.aberto||'—')+'</span>'+
     '<span><b>Fechamento:</b> '+E(c.fechadoEm||'—')+'</span>'+
     '<span><b>Abriu:</b> '+E(c.operador||'—')+'</span>'+
     '<span><b>Fechou:</b> '+E(c.fechadoPor||'—')+'</span>'+
   '</div>'+
   '<div class="selo '+(d.conciliado?'ok':'df')+'">'+
     (d.conciliado?(d.divergeForma?'FECHAMENTO TOTAL CONCILIADO — divergência entre formas':'CONFERE'):
      'COM DIVERGÊNCIA')+'</div>'+

   sec('Recebimentos',
     '<table><tr><th>Forma</th><th class="n">Sistema</th><th class="n">Físico</th><th class="n">Diferença</th></tr>'+
     d.formas.map(function(f){
       return '<tr><td>'+E(f.nome)+'</td><td class="n">R$ '+money(f.sistema)+'</td>'+
        '<td class="n">'+(f.fisico===null?'—':'R$ '+money(f.fisico))+'</td>'+
        '<td class="n '+(f.diferenca===null||Math.abs(f.diferenca)<0.01?'':(f.diferenca>0?'p':'m'))+'">'+
        dif(f.diferenca)+'</td></tr>';
     }).join('')+
     '<tr class="tot"><td>TOTAL</td><td class="n">R$ '+money(d.totSis)+'</td>'+
     '<td class="n">R$ '+money(d.totFis)+'</td><td class="n">'+dif(d.difGeral)+'</td></tr></table>')+

   sec('Composição do dinheiro',
     '<table>'+lin('Fundo de caixa','R$ '+money(d.fundo))+
     lin('+ vendas em dinheiro','R$ '+money(d.vendasDinheiro))+
     lin('+ suprimentos','R$ '+money(d.suprimentos))+
     lin('− sangrias','R$ '+money(d.sangrias))+
     '<tr class="tot"><td>= dinheiro esperado</td><td class="n">R$ '+money(d.dinheiro.sistema)+'</td></tr>'+
     lin('Físico informado',d.dinheiro.fisico===null?'—':'R$ '+money(d.dinheiro.fisico))+
     '</table>')+

   sec('Faturamento',
     '<table>'+lin('Bruto','R$ '+money(d.bruto))+
     lin('(−) cancelamentos','R$ '+money(d.vCanc),'m')+
     '<tr class="tot"><td>Líquido</td><td class="n">R$ '+money(d.liquido)+'</td></tr>'+
     lin('Vendas',String(d.qtd))+lin('Ticket médio','R$ '+money(d.ticket))+
     '</table>')+

   (d.movimentos.length?sec('Movimentações',
     '<table><tr><th>Hora</th><th>Tipo</th><th class="n">Valor</th><th>Motivo</th><th>Destino</th><th>Operador</th></tr>'+
     d.movimentos.map(function(m){
       return '<tr><td>'+E(m.hora||'')+'</td><td>'+(m.tipo==='sangria'?'Sangria':'Suprimento')+'</td>'+
        '<td class="n">R$ '+money(m.valor)+'</td><td>'+E(m.motivo||'')+'</td>'+
        '<td>'+E(m.destino||'—')+'</td><td>'+E(m.responsavel||'—')+'</td></tr>';
     }).join('')+'</table>'):'')+

   (d.cancelamentos.length?sec('Cancelamentos',
     '<table><tr><th>Hora</th><th>Pedido</th><th class="n">Valor</th><th>Motivo</th><th>Autorizou</th></tr>'+
     d.cancelamentos.map(function(x){
       return '<tr><td>'+E(x.hora||'')+'</td><td>#'+E(String(x.numero||''))+'</td>'+
        '<td class="n m">R$ '+money(x.valor)+'</td><td>'+E(x.motivo||'')+'</td>'+
        '<td>'+E(x.operador||'—')+'</td></tr>';
     }).join('')+
     '<tr class="tot"><td colspan="2">Total cancelado</td><td class="n m">R$ '+money(d.vCanc)+
     '</td><td colspan="2"></td></tr></table>'):'')+

   (d.descontos.length?sec('Descontos',
     '<table><tr><th>Pedido</th><th class="n">Original</th><th class="n">Desconto</th>'+
     '<th class="n">Final</th><th>Cupom</th></tr>'+
     d.descontos.map(function(p){
       var ds=Number(p.desconto)||0;
       return '<tr><td>#'+E(String(p.numero||''))+'</td>'+
        '<td class="n">R$ '+money((Number(p.total)||0)+ds)+'</td>'+
        '<td class="n m">R$ '+money(ds)+'</td><td class="n">R$ '+money(p.total)+'</td>'+
        '<td>'+(p.cupom?E(p.cupom.codigo||''):'—')+'</td></tr>';
     }).join('')+'</table>'):'')+

   (d.doSnapshot?'<p style="font-size:10px;color:#666;margin-top:18px">'+
     'Valores congelados na fotografia gravada no fechamento. Não mudam com alterações posteriores.</p>':'')+
   '<p style="font-size:10px;color:#666;margin-top:6px">Emitido em '+
     new Date().toLocaleString('pt-BR')+' · Joia '+VERSAO+'</p>'+
   '</body></html>';
  var w=window.open('','_blank');
  if(!w){toast('Permita janelas para imprimir o relatório.');return;}
  w.document.write(h); w.document.close();
  setTimeout(function(){ try{w.print();}catch(e){} },300);
}

/* ---------- EDITAR FECHAMENTO ---------- */
function editarCaixa(id){
  fecharModal();
  var c=(DB.caixas||[]).find(function(x){return x.id===id});
  if(!c||!c.fechadoEm){toast('Só é possível editar caixas já fechados.');return;}
  if(caixaConciliado(id)){
    toast('Este caixa tem lançamento conciliado no banco. Desconcilie antes de editar.');return;
  }
  var mov=movimentoCaixa(c.id);
  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Abertura</h3>'+
  '<div class="row2">'+
  '<div class="fld2"><label>Fundo de troco</label><div class="cur"><span>R$</span>'+
   '<input id="ecIni" type="number" step="0.01" value="'+(c.inicial||0)+'"></div></div>'+
  '<div class="fld2"><label>Operador</label><input id="ecOp" value="'+E(c.operador||'')+'"></div>'+
  '</div></div>'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Valores conferidos</h3>'+
  '<table class="fpgTab"><thead><tr><th style="text-align:left">Forma</th>'+
  '<th style="text-align:right">Sistema</th><th style="text-align:right">Informado</th></tr></thead><tbody>'+
  (DB.formasPag||[]).map(function(f){
    var v=mov.porForma[f.id]||0;
    var inf=(c.conferencia&&c.conferencia[f.id]!==undefined)?c.conferencia[f.id]:'';
    return '<tr><td><b>'+E(f.nome)+'</b></td>'+
    '<td style="text-align:right">R$ '+money(v)+'</td>'+
    '<td style="width:150px"><div class="cur"><span>R$</span>'+
    '<input type="text" inputmode="decimal" autocomplete="off" class="moeda ecV" data-f="'+f.id+'" value="'+(inf===''?'':money(inf))+'" placeholder="0,00"></div></td></tr>';
  }).join('')+'</tbody></table></div>'+
  '<div class="blk" style="margin:0;max-width:none">'+
  '<div class="fld2" style="margin:0"><label>Observação do fechamento</label>'+
  '<input id="ecObs" value="'+E(c.obs||'')+'"></div>'+
  '<div class="avisoCfg" style="margin-top:12px">'+sv('help',15)+
  '<div>Ao salvar, os lançamentos que este caixa gerou no financeiro são refeitos com os novos valores.</div></div>'+
  '</div></div>';

  modal('Editar fechamento de caixa',h,'Salvar alterações',function(){
    c.inicial=moedaValor('ecIni');
    c.operador=$('ecOp').value.trim();
    c.obs=$('ecObs').value;
    var conf={},tot=0;
    var ins=document.querySelectorAll('.ecV');
    for(var i=0;i<ins.length;i++){
      var n=ins[i].value===''?0:moedaValor(ins[i]);
      conf[ins[i].getAttribute('data-f')]=n;tot+=n;
    }
    c.conferencia=conf;c.totalInformado=tot;
    var idDin=(FORMAS.find(function(f){return f.troco})||{}).id;
    c.contado=(idDin&&conf[idDin])||conf.dinheiro||0;
    c.esperado=esperadoCaixa(c);
    c.vendas=mov.total;c.qtd=mov.qtd;
    /* ==========================================================
       EDITAR UM FECHAMENTO NAO PODE APAGAR O ORIGINAL (itens 19 e 20)

       A fotografia e refeita — senao o cupom continuaria mostrando os
       valores antigos e a edicao nao teria efeito nenhum. Mas a
       fotografia ANTERIOR fica guardada, com quem alterou e quando.

       Sem isso, alterar um fechamento seria indistinguivel de nunca ter
       havido diferenca: alguem ajusta o informado para bater com o
       esperado e a falta desaparece da historia da loja.
       ========================================================== */
    var espF={};
    FORMAS.forEach(function(f){
      espF[f.id]=f.troco?c.esperado:(mov.porForma[f.id]||0);
    });
    c.esperadoPorForma=espF;
    var anterior=c.snapshot||null;
    c.snapshot=montarSnapshot(c,mov,espF,conf);
    c.snapshot.editado={
      em:new Date().toLocaleString('pt-BR'),
      por:((typeof usuarioLogado==='function'&&usuarioLogado())||{}).nome||SESSAO.login||'—',
      anterior:anterior?{
        totalSistema:anterior.totalSistema,totalFisico:anterior.totalFisico,
        diferencaTotal:anterior.diferencaTotal,fechado:anterior.fechado
      }:null
    };
    c.diferencaTotal=c.snapshot.diferencaTotal;
    c.conciliado=c.snapshot.conciliado;
    /* refaz os lançamentos deste caixa */
    DB.lancFin=(DB.lancFin||[]).filter(function(l){return !(l.ref===c.id&&l.origem==='fechamento-caixa')});
    var n2=lancarFechamento(c,mov);
    salvar();telaFrenteCaixa();
    toast('Fechamento atualizado. '+n2+' lançamento(s) refeitos no financeiro.');
    return true;
  },'lg');
}

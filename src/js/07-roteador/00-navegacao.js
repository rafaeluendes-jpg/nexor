/* ===== BLOCO 7 — ROTEADOR ===== */
/* Redesenhar a mesma tela nao pode jogar a pessoa para o topo. Tela nova
   comeca no comeco, como deve; a mesma tela volta onde estava. */
/* ==========================================================
   CRONOMETRO DE ABERTURA DE TELA
   Li o codigo inteiro procurando o que custa 6 segundos e nao achei: com
   250 insumos e nenhuma movimentacao, a conta toda nao passa de milissegundos.
   Ou seja, o gargalo NAO esta onde eu estava olhando — e continuar deduzindo
   e perder tempo.
   Isto mede de verdade, no aparelho de quem usa: quanto o JavaScript levou,
   quanto o navegador levou para desenhar, e o total ate a tela ficar pronta.
   Fica no Diagnostico do Sistema e nao aparece para o operador.
   ========================================================== */
/* ==========================================================
   MEDIDOR DE TRAVAMENTO — pega QUALQUER coisa que segure o navegador
   O cronometro anterior media so o que acontece dentro de abrir(). Nao
   apareceu nada, e isso e informacao: significa que os segundos NAO estao
   ali. Podem estar antes do clique chegar ao codigo, depois que a tela
   monta, ou numa tarefa paralela — sincronizacao, gravacao no aparelho,
   requisicao de rede.
   Aqui a medicao e por fora e nao depende de eu adivinhar onde procurar:
     1. tarefa longa  — qualquer bloco de JavaScript acima de 50 ms
     2. batimento     — se o navegador congela, o relogio atrasa e isso aparece
     3. gravacao      — quanto custa escrever no aparelho, e o tamanho
     4. rede          — toda requisicao, com tempo e destino
   Tudo vai para o Diagnostico e para o selo na tela.
   ========================================================== */
var TRAVAS=[];
function anotarTrava(tipo, ms, detalhe){
  var r={tipo:tipo, ms:Math.round(ms), detalhe:String(detalhe||''),
         hora:new Date().toLocaleTimeString('pt-BR'), tela:(S.mod||'?')+'/'+(S.it||'?')};
  TRAVAS.unshift(r); if(TRAVAS.length>80)TRAVAS.pop();
  try{ registrarFalha('desempenho', tipo, r.detalhe+' — '+r.ms+' ms',
        {situacao:'medido', tela:r.tela}); }
  catch(e){ /* medir nao pode derrubar o sistema */ }
  /* O SELO SAIU DA TELA.
     Ele existiu para achar o laco de envio-download que congelava o sistema.
     Cumpriu: as duas fotos que ele gerou deram a causa. Agora e ruido em cima
     do trabalho de quem usa. A MEDICAO CONTINUA — tudo segue registrado em
     Administracao > Diagnostico do Sistema, onde e o lugar dela. */
  return r;
}
/* ==========================================================
   QUEM ESTA SEGURANDO A TELA
   O medidor disse QUANTO (750 ms, uma vez por segundo, sem parar) mas nao
   disse O QUE. Nenhum laco do sistema roda a cada 1 s, entao a causa esta
   em outro lugar. Agora cada funcao suspeita e cronometrada por nome, e a
   que passar de 100 ms aparece com nome e sobrenome no diagnostico.
   ========================================================== */
try{
  if(window.PerformanceObserver&&PerformanceObserver.supportedEntryTypes&&
     PerformanceObserver.supportedEntryTypes.indexOf('longtask')>=0){
    new PerformanceObserver(function(l){
      l.getEntries().forEach(function(e){
        if(e.duration>=120)anotarTrava('tarefa longa', e.duration,
          (_ultimaFn?('provavelmente: '+_ultimaFn):'bloco de JavaScript'));
      });
    }).observe({entryTypes:['longtask']});
  }
}catch(e){ _quieto(e,'observarTarefas'); }

/* A VIGILANCIA POR NOME SAIU.
   Ela trocava 21 funcoes do sistema por versoes cronometradas — util para
   descobrir quem congelava a tela, e desnecessario depois de descoberto.
   Trocar funcao em tempo de execucao e coisa de diagnostico, nao de sistema
   em producao: qualquer erro ali quebra a funcao original.
   O que ficou: tarefa longa, congelamento, gravacao e rede, todos medidos
   por fora, sem tocar em nada, e registrados no Diagnostico. */
var _ultimaFn='';

/* 2. batimento: um relogio a cada 250 ms. Se atrasar, o navegador congelou —
      e o atraso e exatamente o tempo em que a tela ficou parada. */
/* ==========================================================
   O MEDIDOR DE TRAVAMENTO ESTAVA ATRAPALHANDO O QUE MEDIA

   Este relogio acordava 4 VEZES POR SEGUNDO — 240 vezes por minuto,
   para sempre, mesmo com a tela parada e mesmo em segundo plano. Cada
   acordada e uma tarefa na mesma fila onde o sistema desenha as telas,
   e impede o navegador de entrar em repouso (o que, em notebook e
   celular, tambem gasta bateria).

   O detector continua: 1 segundo e suficiente para perceber que a tela
   congelou — o que se quer detectar sao travas de meio segundo para
   cima, e essas aparecem igual. E em aba escondida ele para: tela que
   ninguem esta vendo nao precisa ser vigiada.

   De 240 acordadas por minuto para 60 com a aba aberta, e ZERO com a
   aba em segundo plano.
   ========================================================== */
(function(){
  var ultimo=Date.now();
  setInterval(function(){
    if(document.hidden){ ultimo=Date.now(); return; }
    var agora=Date.now(), atraso=agora-ultimo-1000;
    ultimo=agora;
    if(atraso>400)anotarTrava('congelou', atraso, 'a tela ficou parada');
  },1000);
})();

/* 3. gravacao no aparelho: mede tamanho e tempo */
(function(){
  if(!window.localStorage||localStorage._medido)return;
  var orig=localStorage.setItem.bind(localStorage);
  localStorage.setItem=function(k,v){
    var t=performance.now();
    var r=orig(k,v);
    var d=performance.now()-t;
    if(d>=120)anotarTrava('gravação', d,
      'gravar '+Math.round(String(v).length/1024)+' KB em "'+k+'"');
    return r;
  };
  try{ Object.defineProperty(localStorage,'_medido',{value:true}); }
  catch(e){ /* navegador que nao deixa marcar: segue sem a marca */ }
})();

/* 4. rede: toda requisicao, com tempo e destino */
var _REDE={n:0, ms:0, falhas:0};
(function(){
  if(!window.fetch||window._fetchMedido)return;
  window._fetchMedido=true;
  var orig=window.fetch;
  window.fetch=function(){
    var alvo=String((arguments[0]&&arguments[0].url)||arguments[0]||'');
    var curto=alvo.replace(/^https?:\/\/[^/]+/,'').split('?')[0].slice(0,60);
    var t=performance.now();
    /* contador acumulado: quantas requisicoes e quanto tempo de rede desde o
       arranque. cronometrar() tira duas fotos e mostra a diferenca — assim
       da para saber quanto da demora DAQUELA tela foi espera de rede. */
    _REDE.n++;
    return orig.apply(this,arguments).then(function(r){
      var d=performance.now()-t;
      _REDE.ms+=d;
      if(d>=600)anotarTrava('rede', d, curto);
      return r;
    },function(e){
      _REDE.ms+=performance.now()-t; _REDE.falhas++;
      anotarTrava('rede falhou', performance.now()-t, curto);
      throw e;
    });
  };
})();

var CRONO=[];
/* ==========================================================
   MEDICAO POR TELA — o que o navegador realmente gastou
   Antes media so calculo e desenho. Faltavam justamente os suspeitos de uma
   demora de 6 s: espera de rede, sincronizacao disparada na abertura e o
   tempo ate a tela ficar utilizavel (nao so pintada).
   Nada aqui altera comportamento: sao fotos antes e depois.
   ========================================================== */
function cronometrar(rot, fn){
  var t0=performance.now();
  var redeAntes={n:_REDE.n, ms:_REDE.ms};
  var sincAntes=!!(typeof NUVEM!=='undefined'&&NUVEM.sincronizando);
  var r=fn();
  var tJs=performance.now()-t0;
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      var tTudo=performance.now()-t0;
      var reg={tela:rot, js:Math.round(tJs), desenho:Math.round(tTudo-tJs),
               total:Math.round(tTudo), hora:new Date().toLocaleTimeString('pt-BR'),
               consultas:_REDE.n-redeAntes.n,
               rede:Math.round(_REDE.ms-redeAntes.ms),
               sincronizando:sincAntes||!!(typeof NUVEM!=='undefined'&&NUVEM.sincronizando)};
      /* tempo ate ficar utilizavel: quando o navegador volta a responder,
         medido por um relogio curto que so dispara com a fila livre */
      var tUtil=performance.now();
      setTimeout(function(){
        reg.utilizavel=Math.round(performance.now()-t0);
        if(reg.utilizavel-reg.total>250)
          anotarTrava('tela presa apos desenhar', reg.utilizavel-reg.total, rot);
      },0);
      CRONO.unshift(reg); if(CRONO.length>40)CRONO.pop();
      registrarFalha('desempenho', rot,
        'tela levou '+reg.total+' ms ('+reg.js+' ms de cálculo, '+
        reg.desenho+' ms de desenho)', {situacao:'medido'});
      try{ if(window.console)
        console.log('[Joia] '+rot+': '+reg.total+' ms — cálculo '+reg.js+
                    ' ms, desenho '+reg.desenho+' ms'); }
      catch(e){ _quieto(e,'cronometrar'); }
      /* mostra o numero NA TELA, no rodape, quando passa de meio segundo.
         Depender do Console nao esta funcionando: a linha se perde no meio
         das mensagens do navegador. Assim o numero aparece sozinho. */
      if(reg.total>300){
        anotarTrava('montar tela', reg.total,
          rot+' — cálculo '+reg.js+' ms, desenho '+reg.desenho+' ms');
      }
    });
  });
  return r;
}
function abrir(mid,iid){
  var mesma=(S.mod===mid&&S.it===iid);
  var ant=0;
  if(mesma){
    var r=document.querySelector('.etScroll');
    ant=r?r.scrollTop:(window.scrollY||0);
  }
  if(!mesma)_rolChave=(mid||'')+'/'+(iid||'');   /* tela nova: comeca no topo */
  if(!mesma)_trocandoTela++;
  var v;
  try{
    v=cronometrar((mid||'?')+'/'+(iid||'?'), function(){return _abrirTela(mid,iid)});
  } finally { if(!mesma)_trocandoTela--; }
  if(mesma&&ant){
    var r2=document.querySelector('.etScroll');
    if(r2)r2.scrollTop=ant; else window.scrollTo(0,ant);
  }
  return v;
}
var _emSemPular=0;      /* >0 = ja estamos dentro de um semPular */
var _trocandoTela=0;    /* >0 = o roteador esta abrindo uma tela NOVA */
/* ==========================================================
   REDESENHAR NAO PODE JOGAR A PESSOA PARA O TOPO
   Dezenas de botoes chamam telaXxx() de novo para se redesenharem —
   marcar uma caixa, mudar um filtro, trocar de aba. Como o desenho refaz
   o innerHTML inteiro, a barra de rolagem volta ao zero e quem estava no
   fim da pagina perde o lugar. Estava assim em quase toda tela do sistema.

   Corrigir chamada por chamada nao resolve: sao mais de noventa telas e a
   proxima que eu criar nasceria com o mesmo defeito. Entao o conserto e
   aqui: TODA funcao telaXxx passa a guardar e devolver a rolagem sozinha.

   A excecao e o roteador. Quando a pessoa clica no menu e vai para outra
   tela, ai sim tem que comecar no topo — por isso _trocandoTela.
   ========================================================== */
function _envolverTelas(){
  var nomes;
  try{ nomes=Object.getOwnPropertyNames(window); }catch(e){ return; }
  for(var i=0;i<nomes.length;i++){
    var n=nomes[i];
    if(!/^tela[A-Z]/.test(n))continue;
    var orig;
    try{ orig=window[n]; }catch(e){ continue; }
    if(typeof orig!=='function'||orig.__guardaRolagem)continue;
    window[n]=(function(fn){
      var env=function(){
        /* tela nova, ou ja estamos dentro de um semPular: segue direto */
        if(_trocandoTela||_emSemPular)return fn.apply(this,arguments);
        var eu=this,args=arguments,ret,chamou=false,erroDaTela=null;
        try{
          semPular(function(){
            try{ ret=fn.apply(eu,args); }
            catch(err){ erroDaTela=err; }      /* guarda para repassar depois */
            chamou=true;
          });
        }catch(e){
          /* aqui o erro e do proprio semPular, nao da tela.
             Se a tela nem chegou a ser desenhada, desenha sem guardar
             a rolagem — perder o lugar e ruim, tela em branco e pior. */
          _quieto(e,'guardaRolagem');
          if(!chamou)return fn.apply(eu,args);
        }
        /* erro da tela sobe igual a antes: escondê-lo tiraria o defeito
           do console e ninguem mais acharia a causa */
        if(erroDaTela)throw erroDaTela;
        return ret;
      };
      env.__guardaRolagem=true;
      return env;
    })(orig);
  }
}
/* roda depois que tudo foi declarado, e de novo no load para pegar
   qualquer tela declarada em bloco de script posterior */
try{ _envolverTelas(); }catch(e){}
window.addEventListener('load',function(){ try{ _envolverTelas(); }catch(e){} });

function _abrirTela(mid,iid){
  if(iid&&!podeVer(mid,iid)){
    $('content').innerHTML='<div class="construWrap"><div class="construBox">'+
     '<div class="construIc">'+sv('lock',30)+'</div>'+
     '<b>Sem acesso a esta tela</b>'+
     '<p>Seu usuário não tem permissão para abrir esta parte do sistema.</p>'+
     '<div class="construNota">Se você precisa deste acesso, peça ao administrador '+
     'para liberar em Configuração da Loja › Usuários e Permissões.</div></div></div>';
    rodape('sem permissão');
    return;
  }
S.mod=mid;S.it=iid;marcaIcones(mid);
document.body.classList.toggle('pdvFull',mid==='pdv'&&iid==='pdv');
var m=mid?M(mid):null,it=iid?IT(m,iid):null;
$('wTitle').innerHTML=m?('<b>'+E(it?it.n:m.n)+'</b><span>— '+E(m.n)+'</span>'):'<b>Painel</b>';
if(mid==='cardapio'&&iid==='cfg-cardapio')return telaCardapio();
if(mid==='pdv'&&iid==='pdv')return telaPDV();
if(mid==='pdv'&&iid==='pedidos-online'){limparSeloPedidos();return telaPedidosOnline();}
if(mid==='loja'&&iid==='cfg-pdv')return telaCfgPDV();
if(mid==='loja'&&iid==='cfg-movimentacao')return telaCfgMovimentacao();
if(mid==='loja'&&iid==='motivo-cancelamento')return telaMotivosCanc();
if(mid==='loja'&&iid==='operadores')return telaOperadores();
if(mid==='loja'&&iid==='turnos')return telaTurnos();
if(mid==='loja'&&iid==='mesas')return telaMesas();
if(mid==='loja'&&iid==='totem')return telaTotem();
if(mid==='loja'&&iid==='liberacao')return telaLiberacao();
if(mid==='loja'&&iid==='fiscal'){
  /* ==========================================================
     AUDITORIA — A CHAVE DA API FISCAL NAO E DE TODO MUNDO
     Esta tela pede o token do provedor de NFC-e (Focus NFe / TecnoSpeed).
     Com ele se emite nota em nome da empresa. Nao e credencial da nuvem
     nem do banco — mas e credencial, e estava ao alcance de qualquer
     pessoa da loja que tivesse a tela liberada, inclusive um operador de
     caixa. Agora e do administrador, e o banco tambem recusa (politica
     "fiscal: so quem administra").
     ========================================================== */
  if(!ehFranqueadora()&&!ehPlataforma())return telaRestrita('Configuração Fiscal');
  return telaFiscalCfg();
}
/* o item existia no menu e nao tinha tela: clicar nele nao fazia nada */
if(mid==='loja'&&iid==='dados-fiscais')return telaFiscalCfg();
if(mid==='loja'&&iid==='modelo-impressao')return telaModeloImp();
if(mid==='loja'&&iid==='status-vendas')return telaStatusVendas();
if(mid==='relatorios'&&iid==='cancelamentos')return telaRelCancel();
if(mid==='relatorios'&&iid==='vendas-mesa')return telaRelMesas();
if(mid==='relatorios'&&iid==='cupons-fiscais')return telaCuponsFiscais();
if(mid==='loja'&&iid==='cfg-loja')return telaMapaModulos();
if(mid==='controle'&&iid==='baixa-manual')return telaBaixaHub();
if(mid==='controle'&&iid==='pedido-base')return telaPedidoBase();
if(mid==='controle'&&iid==='bases-valores')return telaBasesHub();
if(mid==='estoque'&&iid==='movimentacao-estoque')return telaMovimentacao();
if(mid==='estoque'&&iid==='transferencia')return telaTransferencia();
if(mid==='estoque'&&iid==='posicao-estoque')return telaEstoqueTotal();
if(mid==='estoque'&&iid==='contagem-estoque')return telaContagem();
if(mid==='estoque'&&iid==='historico-posicao'){
  /* A tela antiga (telaHistPosicao) continua no arquivo, intacta: se algo
     faltar na nova, e so trocar esta linha de volta. */
  return telaMovMercadoria();
}
if(mid==='estoque'&&iid==='notas-entrada')return telaNotas();
if(mid==='tecnico'&&iid==='reset-sistema')return telaReset();
if(mid==='tecnico'&&iid==='central-tecnica')return telaCentralTecnica();
if(mid==='tecnico'&&iid==='sincronizacao')return telaSincronizacao();
if(mid==='tecnico'&&iid==='backup')return telaBackup();
if(mid==='tecnico'&&iid==='layout-menu')return telaLayoutMenu();
if(mid==='tecnico'&&iid==='instalacao')return telaInstalacao();
if(mid==='tecnico'&&iid==='financeiro-nexor')return telaFinanceiroNexor();
if(mid==='tecnico'&&iid==='diagnostico-sistema')return telaDiagnosticoSistema();
if(mid==='loja'&&iid==='carga-inicial')return telaCarga();
if(mid==='teste'&&iid==='gerar-demo')return telaGerarDemo();
if(mid==='teste'&&iid==='reset-sistema')return telaReset();
if(mid==='financeira'&&iid==='acerto-entregadores')return telaAcertos();
if(mid==='financeira'&&iid==='categorias-financeiras')return telaCatFin();
if(mid==='financeira'&&iid==='contas-bancarias')return telaContas();
if(mid==='financeira'&&iid==='formas-pagamento')return telaFormasPag();
if(mid==='financeira'&&iid==='lancamentos-financeiros')return telaLancamentos();
if(mid==='financeira'&&iid==='compras-sem-vinculo')return telaSemVinculo();
if(mid==='relatorios'&&iid==='cmv-mercadoria')return telaCMV();
if(mid==='financeira'&&iid==='fluxo-caixa')return telaFluxo();
if(mid==='financeira'&&iid==='conciliacao-bancaria')return telaConciliacao();
if(mid==='financeira'&&iid==='fornecedores')return telaFornecedores();
if(mid==='financeira'&&iid==='frente-caixa')return telaFrenteCaixa();
if(mid==='clientes'&&iid==='cadastro-clientes')return telaClientes();
if(mid==='clientes'&&iid==='cupons-clientes')return telaCupons();
if(mid==='dashboard'&&iid==='comparativo-anual')return telaComparativo();
if(mid==='relatorios'&&iid==='faturamento-dia')return telaFaturamentoDia();
if(mid==='relatorios'&&iid==='itens-consumidos')return telaItensConsumidos();
if(mid==='relatorios'&&iid==='itens-vendidos')return telaItensVendidos();
if(mid==='relatorios'&&iid==='vendas-area-entrega')return telaVendasArea();
if(mid==='relatorios'&&iid==='vendas-forma-pagamento')return telaVendasFormaPag();
if(mid==='relatorios'&&iid==='vendas-periodo')return telaVendasPeriodo();
if(mid==='relatorios'&&iid==='dre')return telaDRE();
if(mid==='loja'&&iid==='cfg-dre')return telaCfgDRE();
if(mid==='loja'&&iid==='cfg-sucursais')return telaSucursais();
if(mid==='loja'&&iid==='areas-entrega')return telaAreasEntrega();
if(mid==='loja'&&iid==='canais-integracao')return telaCanaisIntegracao();
if(mid==='loja'&&iid==='cfg-gerente')return telaGerente();
/* Operadores virou Usuários e Permissões: um cadastro só, com login,
   senha e as telas que cada pessoa enxerga. */
if(mid==='loja'&&iid==='cfg-operadores')return abrir('loja','usuarios-permissoes');
/* o cadastro e as regras do entregador moram em Acerto com Entregadores */
if(mid==='loja'&&iid==='cfg-entregador')return abrir('financeira','acerto-entregadores');
if(mid==='loja'&&iid==='usuarios-permissoes')return telaUsuarios();
if(mid==='dashboard'&&iid==='canais-venda')return telaCanaisVenda();
if(mid==='dashboard'&&iid==='faturamento')return telaFaturamento();
if(mid==='dashboard'&&iid==='venda-data-hora')return telaVendaDataHora();
if(mid==='estoque'&&iid==='producao')return telaProducao();
if(mid==='estoque'&&iid==='ficha-tecnica')return telaFichaTecnica();
if(mid==='estoque'&&iid==='ingredientes-insumos')return telaInsumos();
if(mid==='estoque'&&iid==='grupo-ingredientes')return telaGruposIng();
if(it)return telaConstrucao(mid,iid);
$('content').innerHTML='<div class="brandBg">'+
 '<img class="orb" src="joia-icone.png" alt="Joia"><h2>Joia</h2>'+
'<p>gestão simples, lucro visível</p><div class="hint">'+
(m?'Selecione um item de <b>'+E(m.n)+'</b>':'Clique em um ícone acima')+'</div></div>';
rodape();
}
function paleta(){
if($('pal'))return;
var o=document.createElement('div');o.className='pal';o.id='pal';
o.innerHTML='<div class="palBox"><div class="palIn">'+sv('search',17)+
'<input id="palI" placeholder="Buscar módulo ou tela..." autocomplete="off"></div><div class="palR" id="palR"></div></div>';
document.body.appendChild(o);
o.onclick=function(e){if(e.target===o)o.remove();};
var inp=$('palI');inp.focus();
function render(q){
var out=[];
for(var i=0;i<MOD.length;i++){var m=MOD[i];
if(!q||m.n.toLowerCase().indexOf(q)>=0)out.push([m.id,'',m.n,'Módulo']);
for(var j=0;j<m.it.length;j++)if(!q||m.it[j].n.toLowerCase().indexOf(q)>=0)out.push([m.id,m.it[j].id,m.it[j].n,m.n]);}
$('palR').innerHTML=out.length?out.slice(0,40).map(function(x){
return '<button data-m="'+x[0]+'" data-i="'+x[1]+'">'+sv('cr',13)+'<span>'+E(x[2])+'</span><small>'+E(x[3])+'</small></button>';}).join('')
:'<div style="padding:26px;text-align:center;color:#8394A6">Nenhum resultado</div>';
var b=$('palR').querySelectorAll('button');
for(var z=0;z<b.length;z++)b[z].onclick=function(){
abrir(this.getAttribute('data-m'),this.getAttribute('data-i')||null);o.remove();};}
render('');inp.oninput=function(){render(this.value.toLowerCase().trim());};
}

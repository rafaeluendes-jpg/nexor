/* ==========================================================
   VIGIA — A CAIXINHA DE ERROS (01/10/2026)

   Rafael: "uma caixinha para deixar todos os erros. Cupom fiscal que não
   saiu, qualquer outro erro — tudo registrado. E o agente engenheiro
   verifica de hora em hora e corrige. Pare de aparecer esses erros na
   tela." (roteiro aprovado: VIGIA_PLANO.md)

   O que este arquivo faz:
     · `reportarErro` guarda o erro numa fila do aparelho e manda para a
       nuvem (`registrar_erro`), que junta as repetições numa linha só e
       conta as vezes. Sem internet, a fila espera e manda depois.
     · liga as fontes de erro que já existiam (o Diagnóstico local, os
       avisos da sincronização, os erros soltos de tela) e as do fiscal
       (cupom recusado, preso, que não imprimiu).
     · a tela Administração › Central de Erros, para a matriz ver o que
       aconteceu e o que o vigia já resolveu.

   A caixinha nunca fala com o balcão: quem conserta é o vigia.
   O envio usa `fetch` direto, nunca `api()` — `api()` registra as
   próprias falhas, e uma falha ao registrar uma falha viraria laço.
   ========================================================== */
var VIGIA={fila:[],vistos:{},timer:null,enviando:false};
var VIGIA_JANELA=10*60*1000;     /* o mesmo erro, no mesmo aparelho: 1 envio a cada 10 min */
var VIGIA_FILA_MAX=60;
try{ VIGIA.fila=JSON.parse(localStorage.getItem('nexor_vigia_fila')||'[]')||[]; }catch(e){ VIGIA.fila=[]; }

/* a mesma ocorrência tem a mesma chave: números longos, ids e horas saem */
function vigiaNormaliza(txt){
  return String(txt||'').toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'#')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g,'#')
    .replace(/\d{3,}/g,'#').replace(/\s+/g,' ').trim().slice(0,160);
}
function vigiaAparelho(){
  try{
    var a=localStorage.getItem('nexor_aparelho');
    if(!a){a='ap_'+Math.random().toString(36).slice(2,10);localStorage.setItem('nexor_aparelho',a);}
    return a;
  }catch(e){ return ''; }
}
function vigiaGuardarFila(){
  try{ localStorage.setItem('nexor_vigia_fila',JSON.stringify(VIGIA.fila.slice(0,VIGIA_FILA_MAX))); }catch(e){ /* sem espaço: a fila fica só na memória */ }
}
function reportarErro(tipo,onde,mensagem,extra){
  try{
    if(!mensagem)return false;
    var suc='';try{suc=lojaAtualId()||'';}catch(e){suc='';}
    extra=extra||{};
    var chave=extra.chave||(suc+'|'+tipo+'|'+(onde||'')+'|'+vigiaNormaliza(mensagem));
    var agora=Date.now(),v=VIGIA.vistos[chave];
    if(v&&agora-v.em<VIGIA_JANELA){v.vezes++;return false;}
    var vezes=(v&&v.vezes)||1;
    VIGIA.vistos[chave]={em:agora,vezes:0};
    var u=(typeof NUVEM!=='undefined'&&NUVEM.perfil)||{};
    var item={chave:chave,tipo:String(tipo||'interno').slice(0,20),onde:String(onde||'').slice(0,120),
      mensagem:String(mensagem).slice(0,600),sucursal:suc,aparelho:vigiaAparelho(),
      usuario:u.nome||'',versao:(typeof VERSAO!=='undefined'?VERSAO:''),
      pedido:extra.pedido||null,vezes:vezes,
      detalhe:extra.detalhe||null,quando:new Date().toISOString()};
    /* a mesma chave já esperando na fila só soma a vez */
    var ja=VIGIA.fila.find(function(x){return x.chave===chave});
    if(ja)ja.vezes=(ja.vezes||1)+vezes; else VIGIA.fila.unshift(item);
    if(VIGIA.fila.length>VIGIA_FILA_MAX)VIGIA.fila.length=VIGIA_FILA_MAX;
    vigiaGuardarFila();
    clearTimeout(VIGIA.timer);
    VIGIA.timer=setTimeout(function(){vigiaEnviar().catch(function(){});},3000);
    return true;
  }catch(e){ return false; }   /* o registrador nunca derruba quem chamou */
}
async function vigiaEnviar(){
  if(VIGIA.enviando||!VIGIA.fila.length)return 0;
  if(typeof NUVEM==='undefined'||!NUVEM.ligada||!NUVEM.token||!NUVEM.url)return 0;
  VIGIA.enviando=true;var n=0;
  try{
    while(VIGIA.fila.length){
      var it=VIGIA.fila[VIGIA.fila.length-1];   /* o mais antigo primeiro */
      var r;
      try{
        r=await fetch(NUVEM.url+'/rest/v1/rpc/registrar_erro',{method:'POST',
          headers:{'apikey':NUVEM.chave,'Authorization':'Bearer '+NUVEM.token,'Content-Type':'application/json'},
          body:JSON.stringify({p:it})});
      }catch(e){ break; }                     /* sem rede: tenta na próxima */
      if(!r.ok&&r.status!==400&&r.status!==404)break;   /* recusa de formato não volta para a fila */
      VIGIA.fila.pop();n++;
    }
  }finally{ VIGIA.enviando=false; vigiaGuardarFila(); }
  return n;
}

/* ---------- as fontes de erro ---------- */
/* o Diagnóstico local: só a falha final (a que "vai tentar de novo" ainda
   não é erro) e nunca o desempenho, que é medida, não defeito */
function vigiaDaFalha(area,onde,msg,extra){
  if(area==='desempenho')return;
  if(extra&&/tentar de novo/.test(String(extra.situacao||'')))return;
  if(/registrar_erro/.test(String(onde||'')))return;
  reportarErro(area,onde,msg,{detalhe:extra?{situacao:extra.situacao||'',tentativa:extra.tentativa||1}:null});
}
/* cupom fiscal que precisa de conserto: vai para a caixinha, não para o balcão */
function vigiaFiscal(c,motivo){
  if(!c)return;
  var ped=(DB.pedidos||[]).find(function(p){return p.id===c.pedidoId})||{};
  var nome='venda '+(ped.numero||c.pedidoId||c.id);
  var txt=motivo||(c.status==='rejeitado'?'Cupom recusado pela Receita: '+(c.motivo||'sem motivo informado')
    :(typeof ehFalhaPassageira==='function'&&ehFalhaPassageira(c))?'A Receita não respondeu — cupom sendo reenviado'
    :c.motivo?'Cupom não emitido: '+c.motivo
    :'Cupom preso no envio');
  reportarErro('fiscal','cupom',txt+' ('+nome+')',
    {chave:'fiscal|'+c.id+'|'+(motivo?'impressao':c.status),pedido:c.pedidoId||null,
     detalhe:{cupom:c.id,status:c.status,numero:c.numero||null,serie:c.serie||null,spedyId:c.spedyId||null}});
}
/* o que está pendente na unidade, há mais de 10 minutos, vai para a caixinha */
function vigiaFiscalPendencias(suc){
  try{
    var limite=Date.now()-10*60*1000;
    baseCuponsFiscais().forEach(function(c){
      if((c.sucursalId||suc)!==suc)return;
      if(c.ambiente&&c.ambiente!=='producao')return;
      if(c.naoEmitir||c.status==='autorizado'||c.status==='contingencia'||c.status==='cancelado')return;
      var ped=(DB.pedidos||[]).find(function(p){return p.id===c.pedidoId});
      var q=(typeof fsQuandoDoCupom==='function')?fsQuandoDoCupom(c,ped):0;
      if(q&&q>limite)return;                   /* ainda é recente: a fila do aparelho cuida */
      vigiaFiscal(c);
    });
  }catch(e){ /* o vigia nunca derruba o caixa */ }
}
if(typeof window!=='undefined'&&window.addEventListener){
  window.addEventListener('error',function(ev){
    try{
      var arq=String((ev&&ev.filename)||'');
      if(arq&&location&&arq.indexOf(location.origin)!==0)return;   /* extensão do navegador não é do Joia */
      var m=(ev&&ev.message)||'';
      if(!m||/ResizeObserver loop/i.test(m))return;
      reportarErro('tela',(arq.split('/').pop()||'')+':'+((ev&&ev.lineno)||0),m);
    }catch(e){ /* nada */ }
  });
  window.addEventListener('unhandledrejection',function(ev){
    try{
      var r=ev&&ev.reason,m=(r&&r.message)||String(r||'');
      if(!m||/sem conexão|Failed to fetch|NetworkError|Load failed/i.test(m))return;   /* internet da loja não é defeito do sistema */
      reportarErro('tela','promessa',m);
    }catch(e){ /* nada */ }
  });
  window.addEventListener('online',function(){ vigiaEnviar().catch(function(){}); });
}

/* ==========================================================
   ADMINISTRAÇÃO › CENTRAL DE ERROS
   ========================================================== */
var CE={filtro:'aberto',lista:null,carregando:false,erro:''};
var CE_SITUACAO={aberto:'Aberto',corrigindo:'Corrigindo',resolvido:'Resolvido',precisa_voce:'Precisa de você'};
var CE_TIPO={fiscal:'Cupom fiscal',tela:'Tela',rede:'Internet',sincronizacao:'Nuvem',nuvem:'Nuvem',download:'Nuvem',
  fila:'Nuvem',caixa:'Caixa',dado:'Dados',permissao:'Acesso',sessao:'Login',interno:'Sistema',relatorio:'Relatório',vigia:'Vigia'};
async function carregarErros(){
  if(typeof NUVEM==='undefined'||!NUVEM.ligada){CE.lista=[];CE.erro='offline';return;}
  CE.carregando=true;
  try{
    var d=await api('erros_sistema?select=*&order=ultimo_em.desc&limit=300');
    CE.lista=Array.isArray(d)?d:[];CE.erro='';
  }catch(e){ CE.lista=CE.lista||[];CE.erro='falhou'; }
  finally{ CE.carregando=false; }
}
function telaCentralErros(){
  if(!ehMatriz()){
    $('content').innerHTML='<div class="construWrap"><div class="construBox">'+
     '<div class="construIc">'+sv('lock',30)+'</div><b>Tela da matriz</b>'+
     '<p>A caixinha de erros é acompanhada pela franqueadora.</p></div></div>';
    rodape('sem permissão');return;
  }
  if(CE.lista===null&&!CE.carregando){
    carregarErros().then(function(){ if(document.querySelector('.ceTab,.etTopo h1')&&/Central de Erros/.test((document.querySelector('.etTopo h1')||{}).textContent||''))telaCentralErros(); });
  }
  var l=CE.lista||[];
  var cont={aberto:0,corrigindo:0,precisa_voce:0,resolvido:0};
  l.forEach(function(x){cont[x.status]=(cont[x.status]||0)+1;});
  var vis=l.filter(function(x){
    if(CE.filtro==='todos')return true;
    if(CE.filtro==='aberto')return x.status==='aberto'||x.status==='corrigindo';
    return x.status===CE.filtro;
  });
  var corpo;
  if(CE.lista===null||CE.carregando){
    corpo='<div class="entVazio"><b>Buscando a caixinha…</b><span>Um instante.</span></div>';
  }else if(CE.erro==='offline'){
    corpo='<div class="entVazio"><b>Sem conexão com a nuvem</b><span>A caixinha fica na nuvem — ela aparece quando a internet voltar.</span></div>';
  }else if(!vis.length){
    corpo='<div class="entVazio"><b>'+(CE.filtro==='aberto'?'Nenhum erro em aberto':'Nada por aqui')+'</b>'+
      '<span>'+(CE.filtro==='aberto'?'O vigia confere o sistema de hora em hora.':'Escolha outra situação acima.')+'</span></div>';
  }else{
    corpo='<div class="lbTabW"><table class="pTable ceTab"><thead><tr>'+
     '<th style="width:120px">Quando</th><th style="width:150px">Loja</th><th>O que aconteceu</th>'+
     '<th style="width:70px">Vezes</th><th style="width:130px">Situação</th><th style="width:110px"></th></tr></thead><tbody>'+
     vis.map(function(x){
       var q=new Date(x.ultimo_em);
       var quando=q.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+
         q.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
       var loja=x.sucursal_ref?sucNome(x.sucursal_ref):'—';
       return '<tr>'+
        '<td>'+E(quando)+'</td>'+
        '<td>'+E(loja==='—'?(x.sucursal_ref||'—'):loja)+'</td>'+
        '<td><b class="ceTipo">'+E(CE_TIPO[x.tipo]||'Sistema')+'</b> '+E(x.mensagem)+
          (x.resolucao?'<div class="ceRes">'+sv('check',12)+' '+E(x.resolucao)+'</div>':'')+'</td>'+
        '<td style="font-variant-numeric:tabular-nums">'+E(String(x.vezes||1))+'</td>'+
        '<td><span class="ceSit '+E(x.status)+'">'+E(CE_SITUACAO[x.status]||x.status)+'</span></td>'+
        '<td>'+(x.status!=='resolvido'
          ?(podeDevolver(x)?'<button class="btnP2" style="margin-bottom:6px" onclick="devolverComoEstava(\''+E(x.id)+'\')">Devolver como estava</button>':'')+
           '<button class="btnP2" onclick="resolverErro(\''+E(x.id)+'\')">Resolvido</button>':'')+'</td>'+
       '</tr>';
     }).join('')+'</tbody></table></div>';
  }
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo"><div><h1>Central de Erros</h1>'+
   '<p>Tudo o que deu errado nas lojas fica registrado aqui. O vigia confere de hora em hora, '+
   'corrige e escreve o que fez.</p></div>'+
   '<div class="lbTopoAc"><button class="btnP2" onclick="CE.lista=null;telaCentralErros()">'+sv('ref',13)+' Atualizar</button></div></div>'+
   '<div class="lbBarra"><div class="lbSegm">'+
    [['aberto','Em aberto',(cont.aberto||0)+(cont.corrigindo||0)],['precisa_voce','Precisa de você',cont.precisa_voce||0],
     ['resolvido','Resolvidos',cont.resolvido||0],['todos','Todos',l.length]].map(function(f){
      return '<button class="'+(CE.filtro===f[0]?'on':'')+'" onclick="CE.filtro=\''+f[0]+'\';telaCentralErros()">'+
        f[1]+' <b>'+f[2]+'</b></button>';
    }).join('')+'</div></div>'+
   corpo+'</div></div>';
  rodape(vis.length+' de '+l.length+' registro(s)');
}
/* ==========================================================
   DEVOLVER COMO ESTAVA (Missão integridade, fase 4 — 06/10/2026)

   O vigia acusa aqui o dado que voltou sozinho, o estado que andou para
   trás sem desfazer e o cadastro da rede mexido por login de loja. A
   matriz decide: devolver põe de volta o "antes" da auditoria — só se a
   linha não mudou de novo desde então — e a devolução fica registrada
   com o motivo (devolver_como_estava, 20261006_vigia_dos_dados).
   ========================================================== */
function podeDevolver(x){
  var d=x&&x.detalhe;
  return !!(x&&x.tipo==='dado'&&d&&d.audit_id&&['mao_unica','voltou','loja'].indexOf(d.achado)>=0);
}
async function devolverComoEstava(id){
  var x=(CE.lista||[]).find(function(e){return e.id===id});
  if(!x||!podeDevolver(x))return;
  var r=await confirmar({titulo:'Devolver como estava',texto:x.mensagem||'',
    campo:{id:'dvMotivo',rotulo:'Por que está devolvendo? *',dica:'ex.: a loja não edita o cadastro da rede · voltou sozinho'},
    aviso:'O que está na nuvem volta a ser o que era antes desta mudança. Fica registrado quem devolveu, quando e por quê.',
    ok:'Devolver'});
  if(!r)return;
  var motivo=String(window._cfCampo||'').trim();
  if(!motivo){toast('Diga por que está devolvendo.');return;}
  var quem=((NUVEM&&NUVEM.perfil)||{}).nome||'matriz';
  try{
    await api('rpc/devolver_como_estava','POST',{p_audit_id:x.detalhe.audit_id,p_motivo:motivo});
  }catch(e){
    painelErro('Não foi devolvido.',detalheErro(e));
    return;
  }
  var res='Devolvido como estava por '+quem+': '+motivo;
  try{
    await api('erros_sistema?id=eq.'+encodeURIComponent(id),'PATCH',
      {status:'resolvido',resolvido_em:new Date().toISOString(),resolvido_por:quem,resolucao:res},{'Prefer':'return=minimal'});
  }catch(e2){ _quieto(e2,'devolverComoEstava'); }
  x.status='resolvido';x.resolucao=res;
  toast('Devolvido como estava.');
  if(NUVEM.ligada)sincronizar();
  telaCentralErros();
}
async function resolverErro(id){
  var x=(CE.lista||[]).find(function(e){return e.id===id});
  if(!x)return;
  var quem=((NUVEM&&NUVEM.perfil)||{}).nome||'matriz';
  try{
    await api('erros_sistema?id=eq.'+encodeURIComponent(id),'PATCH',
      {status:'resolvido',resolvido_em:new Date().toISOString(),resolvido_por:quem,
       resolucao:x.resolucao||('Marcado como resolvido por '+quem)},{'Prefer':'return=minimal'});
    x.status='resolvido';x.resolucao=x.resolucao||('Marcado como resolvido por '+quem);
    toast('Marcado como resolvido.');
  }catch(e){ toast('Não consegui salvar agora — tente de novo em instantes.'); }
  telaCentralErros();
}

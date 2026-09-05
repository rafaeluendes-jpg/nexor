/* ===== BLOCO 6 — INTERFACE ===== */
function boot(){
  DB.motivosCanc=DB.motivosCanc||[];DB.turnos=DB.turnos||[];
  DB.cancelamentos=DB.cancelamentos||[];
  DB.modelosImp=DB.modelosImp||[];
  DB.statusVenda=DB.statusVenda||[];
  DB.mesas=DB.mesas||[];DB.comandas=DB.comandas||[];DB.cupons_f=DB.cupons_f||[];
  DB.transf=DB.transf||[];
  baseCanc();baseTurnos();baseImp();baseStatus();
  DB.estoqueUn=DB.estoqueUn||[];
  lojaAtual();                  /* fixa a unidade ativa antes de qualquer conta */
  migrarEstoqueParaUnidade();   /* uma vez: o saldo antigo vai para a matriz */
  /* ==========================================================
     NAO SE FILTRA ANTES DE FALAR COM A NUVEM (V192)

     Aqui rodava `filtrarCadastroDaUnidade()` — que APAGA da memoria do
     aparelho o cadastro nao liberado. No boot, antes de qualquer
     download e antes de qualquer envio.

     Efeito reproduzido em 27/08: a unidade cadastrou categoria e
     produto, fechou a tela, e no proximo carregamento o filtro apagou
     os dois ANTES de eles subirem. A categoria sobreviveu porque uma
     sincronizacao aconteceu no meio; o produto nao teve essa sorte e
     **nunca chegou ao banco**. Conferido: nao existe la.

     Apagar dado que ainda nao subiu e perda definitiva. E o filtro nao
     tem pressa nenhuma: ele roda logo depois do download, que e quando
     se sabe de verdade o que a nuvem tem.

     A tela pode mostrar por um instante um item a mais do que deveria.
     Isso e infinitamente melhor do que apagar o que a pessoa acabou de
     cadastrar.
     ========================================================== */
  /* filtro removido do boot de proposito — roda apos o download */
  espelharEstoque();            /* a tela mostra o saldo DESTA unidade */
  /* retrato do que JA existia no aparelho antes de qualquer conversa com a
     nuvem — e o numero que diz se o problema e o aparelho comecar vazio */
  try{
    MEDIDA.boot={insumos:(DB.insumos||[]).length,
      estoqueUn:(DB.estoqueUn||[]).length,
      comSaldo:(DB.estoqueUn||[]).filter(function(x){
        return Number(x&&x.estoque)!==0}).length};
  }catch(e){ _quieto(e,'boot'); }
  aplicarLayoutMenu();          /* ordem salva pelo dono da Joia */
  baixarLayoutMenu();
  topo();faixa();
  try{vigiarConteudo()}catch(e){_quieto(e,'boot')}   /* a tela para de subir sozinha */
  abrir('cardapio','cfg-cardapio');
  try{pintarRede()}catch(e){_quieto(e,'boot')}
  try{pintarTravaUnidade()}catch(e){_quieto(e,'boot')}
if(modo()==='nuvem'&&!NUVEM.ligada)setTimeout(function(){toast('Nuvem estava ligada: entre novamente em Banco de dados.')},900);}

function topo(){
$('hdr').innerHTML='<img class="hMk" src="joia-icone.png" alt="Joia">'+
  '<div class="hNm">JOIA</div><div class="hGrow"></div>'+
'<button class="hSearch" onclick="paleta()">'+sv('search',15)+'<span>Buscar no sistema</span><kbd>Ctrl K</kbd></button>'+
/* o sino avisa de verdade desde a V207 — abrirSino() monta a lista a partir
   dos proprios pedidos. Antes daqui saia um toast dizendo que nao havia
   nada, com um zero fixo ao lado: o franqueado so sabia que o pedido dele
   ficou pronto se abrisse a tela e olhasse o selo. */
'<button class="hIc" id="btnSino" onclick="abrirSino(event)" title="Avisos">'+sv('bell',18)+'<span class="hBadge" id="sinoBadge" style="display:none">0</span></button>'+
'<span class="rtTag" id="rtTag"><i></i>tempo real</span>'+
'<button class="hIc" id="btnNuvem" onclick="painelNuvem()" title="Banco de dados">'+sv('cloud',18)+'</button>'+'<button class="hIc" onclick="dev()">'+sv('help',18)+'</button>'+
(function(){var u=usuarioLogado()||{};
  var nm=u.login||u.nome||'sem sessão';
  /* ==========================================================
     O ROTULO DIZ A POSICAO NA REDE, NAO A PERMISSAO
     Dizia "franqueadora" so para quem tinha acesso total. Quando a
     franqueadora passou a ser tela por tela ela virou "acesso limitado",
     e presa a uma unidade virava "unidade" — sendo que ela e a matriz.
     Ser matriz e posicao; ver todas as telas e permissao. Sao coisas
     diferentes desde a V73, e este rotulo tinha ficado para tras.
     ========================================================== */
  var pp=ehPlataforma()?'dono da Joia'
    :(ehFranqueadora(u)?('matriz — '+((u.tudo||u.mestre)?'acesso total':'franqueadora'))
    :(u.sucursais&&u.sucursais.length?'unidade':'acesso limitado'));
  return '<div class="hUsr"><div class="hAv">'+E((u.nome||'?').charAt(0).toUpperCase())+'</div>'+
   '<div><b>'+E(nm)+'</b><span>'+pp+'</span></div>';})()+
'<button class="hPwr" onclick="sair()" title="Sair">'+sv('out',14)+'</button></div>';
try{pintarSino()}catch(e){_quieto(e,'topo')}
}
function faixa(){
var h='';
for(var i=0;i<MOD.length;i++){var m=MOD[i];
if(!podeVer(m.id))continue;
h+='<button class="mIco" data-m="'+m.id+'" title="'+E(m.n)+'"><span class="tile">'+svMod(m.id,m.ic,25)+'</span>'+
'<span class="lb">'+E(m.n)+'</span></button>';}
/* o seletor de loja no topo é só para quem tem visão multiunidade
   (matriz/dono). O usuário de uma unidade vê o nome da própria loja, fixo,
   sem seta e sem poder trocar — nem pelo menu nem pelo clique. */
h+='<div class="bandGrow"></div>'+
   (vejoVariasUnidades()
    ?'<button class="bandSuc" id="sucBtn"><i>Loja</i><span>'+E(nomeLojaAtual())+'</span>'+sv('dn',13)+'</button>'
    :'<div class="bandSuc bandSucFix"><i>Loja</i><span>'+E(nomeLojaAtual())+'</span></div>');
$('bandRow').innerHTML=h;
var b=$('bandRow').querySelectorAll('.mIco');
for(var k=0;k<b.length;k++)b[k].onclick=function(e){e.stopPropagation();toggleDrop(this.getAttribute('data-m'));};
var _sucBtn=$('sucBtn');
if(_sucBtn)_sucBtn.onclick=function(e){e.stopPropagation();toggleSuc();};
}
function ajustaAlturaDrop(){
  var d=document.getElementById('mnu'); if(!d)return;
  var topo=d.getBoundingClientRect().top;
  var livre=Math.max(200,(window.innerHeight||600)-topo-14);
  d.style.maxHeight=livre+'px';
}
window.addEventListener('resize',ajustaAlturaDrop);
var _limpaDrop=null;
function toggleDrop(mid){
fecharSuc();
if(S.aberto===mid){fecharDrop();return;}
/* Trocar de categoria NAO passa mais por fecharDrop().
   Ele agendava um innerHTML='' para 200ms depois; como o menu novo era desenhado
   na hora, essa limpeza atrasada apagava justamente o menu recem-aberto — e por
   isso era preciso clicar duas ou tres vezes para a lista aparecer. */
clearTimeout(_limpaDrop);
var trocando=!!S.aberto;      /* ja havia um menu aberto: e troca, e tem de ser instantanea */
var m=M(mid);S.aberto=mid;
var btn=document.querySelector('.mIco[data-m="'+mid+'"]');
if(!btn){S.aberto=null;return;}
var h='<div class="mnu" id="mnu"><div class="mh">'+E(m.n)+'</div>';
var vis=m.it.filter(function(t){return podeVer(mid,t.id)});
for(var i=0;i<vis.length;i++){var t=vis[i];
var atraso=trocando?0:Math.min(i*14,150);
h+='<button data-m="'+mid+'" data-i="'+t.id+'"'+(t.id===S.it?' class="on"':'')+
' style="transition-delay:'+atraso+'ms"><span class="mp"></span><span>'+E(t.n)+'</span>'+
'<span class="ma">'+sv('cr',12)+'</span></button>';}
if(!vis.length)h+='<div class="mnuVazio">Sem acesso liberado neste módulo</div>';
h+='</div>';
$('mnuBox').innerHTML=h;
var el=$('mnu');
var r=btn.getBoundingClientRect(),rb=document.querySelector('.bandRow').getBoundingClientRect();
var esq=r.left-rb.left;
el.style.left=esq+'px';
/* na troca o menu ja esta na tela: aparece na hora, sem esperar quadro nenhum */
if(trocando){el.classList.add('op');}
requestAnimationFrame(function(){
  var e2=document.getElementById('mnu');
  if(!e2)return;
  var fora=e2.getBoundingClientRect().right-window.innerWidth+12;
  if(fora>0)e2.style.left=Math.max(6,esq-fora)+'px';
  e2.classList.add('op');
  ajustaAlturaDrop();
});
marcaIcones(mid);
var bs=el.querySelectorAll('button');
for(var z=0;z<bs.length;z++)bs[z].onclick=function(e){e.stopPropagation();
abrir(this.getAttribute('data-m'),this.getAttribute('data-i'));fecharDrop();};
}
function fecharDrop(){
if(!S.aberto)return;
S.aberto=null;
var el=$('mnu');
if(el){
  el.classList.remove('op');
  clearTimeout(_limpaDrop);
  /* so limpa se, passados os 200ms da animacao, nenhum outro menu tiver sido aberto */
  _limpaDrop=setTimeout(function(){ if(!S.aberto)$('mnuBox').innerHTML=''; },200);
}
marcaIcones(S.mod);
}
function marcaIcones(mid){var b=$('bandRow').querySelectorAll('.mIco');
for(var k=0;k<b.length;k++)b[k].classList.toggle('on',b[k].getAttribute('data-m')===mid);}
/* Existiam DUAS listas de loja: "lojasFin", so no aparelho e usada pelo
   seletor do topo, e "sucursais", sincronizada e usada pela operacao.
   Trocar de loja no topo mexia numa e a operacao lia a outra — que nunca
   mudava. Toda venda e todo estoque iam parar sempre na PRIMEIRA unidade,
   independente do que estivesse escrito na tela.
   Agora e uma lista so: sucursais. */
function lojasCad(){
  var a=sucAtivas();
  DB.lojasFin=a;                       /* compatibilidade com telas antigas */
  return a;
}
/* a unidade a que a pessoa pertence, vinda do login */
function unidadeDoPerfil(){
  return (NUVEM.perfil&&NUVEM.perfil.sucursal_ref)||'';
}
function podeTrocarUnidade(){
  if(ehPlataforma&&ehPlataforma())return true;
  var u=usuarioLogado()||{};
  if(u.tudo||u.mestre)return true;
  var s=unidadeDoPerfil();
  if(!s)return true;                       /* perfil antigo, sem unidade */
  return ehSucMatriz(s);
}
/* ==========================================================
   O LOGIN DA UNIDADE ABRE NA UNIDADE DELE

   Antes: se o perfil apontasse para uma unidade que nao existe mais —
   e isso acontece quando a unidade e criada, apagada e recriada, porque
   o codigo muda — a busca falhava e o sistema caia em `a[0]`, que e a
   primeira da lista: a Matriz. Silenciosamente. O gerente de Santa Fe
   entrava vendo o estoque da matriz sem nenhum aviso na tela, e demorou
   horas para alguem desconfiar.

   Agora a escolha tem ordem e a ultima palavra nao e a Matriz:
   1. a unidade do perfil, se existir;
   2. a unica unidade liberada para o usuario, se ele tiver so uma;
   3. so entao a primeira da lista — e apenas para quem circula entre
      unidades, que na pratica e a matriz.
   Se o perfil apontar para unidade inexistente, avisa em vez de fingir.
   ========================================================== */
function unidadeDoUsuario(){
  var u=usuarioLogado()||{};
  var l=(u.sucursais||[]).filter(function(x){return x!=='*'});
  if(l.length!==1)return '';
  return sucAtivas().some(function(s){return s.id===l[0]})?l[0]:'';
}
function lojaAtual(){
  var a=lojasCad();
  /* ==========================================================
     LISTA VAZIA NAO E "SOU A MATRIZ" — E "AINDA NAO SEI"

     Nos primeiros segundos do carregamento a lista de unidades ainda
     esta vazia. Como nenhuma unidade "existe", a regra 3 caia em
     `a[0]` e gravava `suc_matriz` em DB.lojaAtual e S.loja. Segundos
     depois os dados chegavam e a tela se corrigia sozinha — daí o
     nome trocar de Matriz para Santa Fe no canto da tela.

     O nome errado era o sintoma bonito. O perigo era o resto: durante
     esses segundos o sistema inteiro se considerava matriz, e qualquer
     coisa gravada ali nascia com a loja errada — foi assim que vendas
     do balcao nasceram sem unidade na V130.

     Sem lista, nao se decide nada: devolve o que ja estava e espera.
     ========================================================== */
  if(!a.length) return DB.lojaAtual||S.loja||'';
  /* ==========================================================
     LISTA COM A SEMENTE TAMBEM E "AINDA NAO SEI" (item 98)

     O guarda de cima cobre lista VAZIA. Faltava o caso em que a lista
     tem exatamente uma unidade e ela e a Matriz semeada no primeiro
     uso — a nuvem ainda nao respondeu. Ai `existe(fixa)` dava falso
     para o gerente de Santa Fe, o sistema avisava que a unidade nao
     existia mais e o jogava na Matriz.

     Quem tem unidade no perfil espera a nuvem. Nao decide, nao avisa,
     nao grava. Fallback silencioso para a Matriz e risco de isolamento
     entre unidades, nao apenas um nome errado no canto da tela.
     ========================================================== */
  if(soSemente()&&unidadeDoPerfil()) return DB.lojaAtual||S.loja||'';
  var existe=function(id){return !!id&&a.some(function(l){return l.id===id})};
  var fixa=unidadeDoPerfil();
  /* 1. a unidade do perfil manda em quem nao circula */
  if(fixa&&existe(fixa)&&!podeTrocarUnidade()){
    DB.lojaAtual=fixa;S.loja=fixa;return fixa;
  }
  /* perfil apontando para unidade que nao existe: avisa uma vez */
  if(fixa&&!existe(fixa)&&!DB._avisouUnidadeSumida){
    DB._avisouUnidadeSumida=true;
    setTimeout(function(){
      try{toast('A unidade do seu acesso não existe mais. Peça à matriz para refazer o acesso.');}
      catch(e){_quieto(e,'lojaAtual');}
    },1200);
  }
  /* 2. quem tem uma unidade so abre nela, mesmo sem perfil ou com perfil quebrado */
  if(!existe(DB.lojaAtual)){
    var sua=unidadeDoUsuario();
    if(sua){DB.lojaAtual=sua;S.loja=sua;return sua;}
  }
  /* ==========================================================
     QUEM TEM UNIDADE FIXA NUNCA CAI NA MATRIZ (item 100)

     Ate aqui, o gerente de Santa Fe cujo perfil apontasse para uma
     unidade inexistente recebia o aviso E CAIA NA MATRIZ mesmo assim.
     O aviso deixava a consciencia limpa; o acesso continuava errado.

     Isso e risco de isolamento, nao detalhe de tela: erro ao resolver
     a unidade virava permissao para ver outra. Agora quem tem unidade
     no perfil e nao pode circular fica SEM unidade ativa — a tela dira
     que o contexto e invalido, e nada e carregado.

     Preferir tela bloqueada a tela com o dado da loja errada.
     ========================================================== */
  if(fixa&&!existe(fixa)&&!podeTrocarUnidade()){
    DB.lojaAtual='';S.loja='';
    DB._contextoInvalido='A unidade do seu acesso não foi encontrada.';
    return '';
  }
  /* 3. so quem circula entre unidades cai na primeira da lista */
  if(!existe(DB.lojaAtual))
    DB.lojaAtual=(a[0]||{}).id||'suc_matriz';
  S.loja=DB.lojaAtual;                 /* as duas passam a apontar para o mesmo */
  return DB.lojaAtual;
}
function nomeLojaAtual(){
  var l=lojasCad().find(function(x){return x.id===lojaAtual()});
  /* nao inventa "Matriz" quando ainda nao sabe: quem le o canto da tela
     acredita no que esta escrito */
  return l?l.nome:(lojasCad().length?'Matriz':'…');
}
/* deixa visivel que a unidade e fixa, em vez de o clique nao fazer nada */
function pintarTravaUnidade(){
  var b=document.getElementById('sucBtn');
  if(!b)return;
  var travado=!podeTrocarUnidade();
  b.classList.toggle('travado',travado);
  b.title=travado?('Seu acesso é da unidade '+nomeLojaAtual()):'Trocar de unidade';
}
function toggleSuc(){
if(!podeTrocarUnidade()){
  toast('Seu acesso é da unidade '+sucNome(unidadeDoPerfil())+'.');
  return;
}
if($('sucMenu')){fecharSuc();return;}
fecharDrop();
lojaAtual();
/* ==========================================================
   O MENU OFERECIA UNIDADES QUE A PESSOA NAO PODE OPERAR (V202)

   Aqui estava `lojasCad()`, que e a lista INTEIRA de unidades ativas.
   Quem passasse por `podeTrocarUnidade()` — e passa todo perfil sem
   `sucursal_ref`, pela regra do "perfil antigo" — via no menu e podia
   entrar em qualquer unidade da rede, mesmo tendo so uma ou duas
   liberadas no cadastro. Era a queixa de "um entrava pela outra loja".

   A separacao por unidade nao existe no banco: a RLS trabalha por LOJA,
   e todas as sucursais de uma loja sao da mesma. Entao esta lista e a
   unica trava que existe — e ela nao estava travando nada.

   `sucursaisDoUsuario()` ja fazia exatamente este filtro, e nunca havia
   sido chamada por ninguem. Estava no MAPA.md, entre as 42 funcoes que
   ninguem chamava. Foi escrita para isto.

   Quem nao tem lista de unidades continua vendo todas — a lista vazia
   sempre significou "sem restricao", e mudar isso trancaria gente.
   ========================================================== */
$('sucBox').innerHTML='<div class="sucMenu" id="sucMenu"><div class="h">Trocar de loja</div>'+
sucursaisDoUsuario().map(function(l){
  return '<button class="'+(S.loja===l.id?'on':'')+'" onclick="trocarLoja(\''+l.id+'\')">'+
  '<span>'+E(l.nome)+'</span>'+(S.loja===l.id?sv('cr',13):'')+'</button>';}).join('')+
'<div style="padding:9px 10px;font-size:11.5px;color:var(--ink-3)">Cadastre outras lojas em Configuração da Loja.</div></div>';
}
function trocarLoja(id){
  /* So quem e da matriz circula entre unidades. Gerente de loja fica na dele —
     senao a separacao de estoque e de cadastro nao vale nada. */
  if(!podeTrocarUnidade()){
    toast('Seu acesso é da unidade '+sucNome(unidadeDoPerfil())+'.');
    fecharSuc();return;
  }
  /* E circular entre unidades nao e circular entre TODAS: a conferencia
     do destino faltava, entao esconder do menu nao bastava — bastaria
     chamar trocarLoja('outra') pelo console. `podeSucursal` foi escrita
     para esta pergunta e tambem nunca havia sido chamada. */
  if(!podeSucursal(id)){
    toast('Sua conta não opera na unidade '+sucNome(id)+'.');
    fecharSuc();return;
  }
  DB.lojaAtual=id;S.loja=id;
  fecharSuc();
  /* o saldo mostrado na tela passa a ser o DESTA unidade */
  try{espelharEstoque()}catch(e){_quieto(e,'trocarLoja')}
  /* o cadastro tambem muda: cada unidade enxerga o seu. Como o filtro tira
     itens da memoria, e preciso rebaixar da nuvem para nao "perder" o que a
     outra unidade via. */
  if(NUVEM.ligada){
    toast('Carregando o cadastro de '+sucNome(id)+'...');
    baixarDaNuvem(true).then(function(){
      try{espelharEstoque()}catch(e){_quieto(e,'trocarLoja')}
      if(S.mod)abrir(S.mod,S.it);
    }).catch(function(){});
  }
  try{salvar()}catch(e){_quieto(e,'trocarLoja')}
  var b=document.querySelector('#sucBtn span');
  if(b)b.textContent=nomeLojaAtual();
  if(S.mod)abrir(S.mod,S.it); else rodape();
  toast('Unidade: '+nomeLojaAtual());
}
function fecharSuc(){$('sucBox').innerHTML='';}
var DIAS_JANELA=90;   /* movimentacoes/cupons: janela baixada no login */
/* pedidos guardam uma janela mais curta no aparelho — o histórico mais antigo
   vem da nuvem no relatório (Etapa 2, 05/09/2026), para o aparelho ficar leve */
var DIAS_JANELA_PEDIDOS=30;
var VERSAO='V312.0.0';
/* confere se há versão nova publicada e avisa, sem forçar nada */
/* location.reload(true) não força mais nada nos navegadores atuais:
   o arquivo antigo continua vindo do cache. Recarregar com um endereço
   novo é o que realmente traz a versão publicada. */
/* ==========================================================
   ATUALIZAR ERA TROCAR DE ENDERECO, NAO LIMPAR O CACHE (V195)

   `location.replace(pathname+'?v='+Date.now())` resolvia pelo caminho
   errado: em vez de jogar fora o arquivo guardado, ia buscar num
   endereco diferente. A pessoa ficava com `?v=1787…` na barra para
   sempre, e o service worker passava a guardar ESSE endereco tambem —
   duplicando o problema em vez de resolver.

   Agora o cache do service worker e apagado de verdade (ele ja sabia
   fazer isso: responde a mensagem 'limpar-cache' desde que foi criado,
   e ninguem nunca mandava). So depois a pagina recarrega, no MESMO
   endereco.

   O `setTimeout` existe porque a limpeza e assincrona: se o service
   worker nao responder em 1,2 s, recarrega assim mesmo — melhor
   recarregar com cache do que nao recarregar.
   ========================================================== */
function aplicarAtualizacao(){
  try{ gravarLocal(); }catch(e){_quieto(e,'aplicarAtualizacao')}
  var recarregou=false;
  var vai=function(){ if(recarregou)return; recarregou=true; location.reload(); };
  try{
    if(navigator.serviceWorker&&navigator.serviceWorker.controller){
      navigator.serviceWorker.addEventListener('message',function(e){
        if(e.data==='cache-limpo')vai();
      });
      navigator.serviceWorker.controller.postMessage('limpar-cache');
      setTimeout(vai,1200);          /* nao esperar para sempre */
      return;
    }
  }catch(e){_quieto(e,'aplicarAtualizacao')}
  vai();
}
var _checando=false;
/* ==========================================================
   A CHECAGEM DE VERSAO BAIXAVA O SISTEMA INTEIRO, DE 45 EM 45 s

   `fetch(location.pathname, {cache:'no-store'})` — sem cache, de
   proposito, para pegar o arquivo novo. So que o arquivo tem 2,5 MB.

   A conta: 2,5 MB a cada 45 s = 3,4 MB por minuto = 201 MB por hora =
   **2 GB por loja num turno de 10 horas**. Com quatro unidades abertas,
   quase 8 GB por dia — so para descobrir se saiu versao nova. E cada
   uma dessas descargas ocupa a rede e a thread do navegador enquanto a
   loja esta vendendo.

   Agora perguntamos primeiro, com HEAD: o servidor responde so o
   cabecalho, com a etiqueta do arquivo (ETag ou Last-Modified) —
   algumas centenas de bytes. Se a etiqueta for a mesma da ultima vez,
   nada mudou e paramos ali. So quando a etiqueta muda o arquivo e
   baixado, para ler qual e a versao nova.

   De 201 MB/hora para menos de 1 MB/hora em operacao normal.
   ========================================================== */
var _etiquetaArquivo=null;
async function checarVersao(){
  if(_checando)return;
  _checando=true;
  try{
    var mudou=true;
    try{
      var h=await fetch(location.pathname+'?v='+Date.now(),
        {method:'HEAD',cache:'no-store'});
      var et=h.headers.get('etag')||h.headers.get('last-modified')||'';
      if(et){
        /* ==========================================================
           A PRIMEIRA CHECAGEM NAO PODE SO GUARDAR A ETIQUETA (V194)

           Aqui, na primeira vez, o sistema guardava a etiqueta do
           arquivo e voltava SEM comparar a versao. So comparava da
           segunda vez em diante, e so se a etiqueta mudasse.

           Efeito: se a pagina foi aberta logo depois de uma publicacao,
           a primeira checagem guarda a etiqueta JA NOVA, nunca ve
           mudanca, e o aviso de versao nova NUNCA aparece. A loja fica
           numa versao velha sem saber — foi o que aconteceu com a V193.

           A etiqueta serve para economizar banda: com ela igual, nao
           vale a pena baixar o arquivo inteiro. Mas a PRIMEIRA vez tem
           de baixar e comparar de verdade, senao a economia custa a
           atualizacao.
           ========================================================== */
        if(_etiquetaArquivo===null){ _etiquetaArquivo=et; }   /* compara mesmo assim */
        else if(et===_etiquetaArquivo) mudou=false;
        else _etiquetaArquivo=et;
      }
    }catch(e){ /* servidor sem HEAD: cai no jeito antigo */ }
    if(!mudou)return;

    var r=await fetch(location.pathname+'?v='+Date.now(),{cache:'no-store'});
    var t=await r.text();
    /* ==========================================================
       A CHECAGEM TEM DE SOBREVIVER AO ARQUIVO ENXUTO

       Este trecho le o proprio index.html publicado para saber se ha
       versao nova. A partir da V239 o arquivo que vai ao ar passa pelo
       enxugador, que pode trocar aspas simples por duplas e comer o
       espaco depois do `var`. Com a expressao amarrada em aspas
       simples, a busca falharia calada e a loja nunca mais saberia que
       existe atualizacao — o defeito da V195 de novo, por outro
       caminho. Agora aceita os dois formatos.
       ========================================================== */
    var m=t.match(/VERSAO\s*=\s*['"](V[0-9.]+)['"]/);
    if(!m)return;
    if(m[1]!==VERSAO){
      var el=document.getElementById('avisoVer');
      if(el)return;
      var d=document.createElement('div');
      d.id='avisoVer';d.className='avisoVer';
      d.innerHTML=sv('ref',15)+'<div><b>Versão nova disponível ('+m[1]+')</b>'+
        '<span>você está na '+VERSAO+' — seus dados não se perdem ao atualizar</span></div>'+
        '<button onclick="aplicarAtualizacao()">Atualizar agora</button>'+
        '<button class="x" onclick="this.parentNode.remove()">&times;</button>';
      document.body.appendChild(d);
    }
  }catch(e){_quieto(e,'checarVersao')}
  finally{ _checando=false; }
}
setTimeout(checarVersao,1500);
/* a cada 2 minutos basta: com HEAD o custo e minimo, mas nao ha razao para
   perguntar de 45 em 45 s. Voltar para a aba continua conferindo na hora. */
setInterval(function(){ if(!document.hidden)checarVersao(); },120000);
/* voltar para a aba já confere: quem deixa o sistema aberto o dia todo vê na hora */
document.addEventListener('visibilitychange',function(){
  if(!document.hidden)checarVersao();
});
window.addEventListener('focus',checarVersao);
function rodape(extra){
$('stat').innerHTML='<span class="live" id="nuvemSt"><i></i>'+(NUVEM.ligada
  ?('Nuvem ligada'+(RT.ligado?' · tempo real':' · sem tempo real, conferindo a cada 45s')+
    (NUVEM.ultima?' · '+NUVEM.ultima.toLocaleTimeString('pt-BR').slice(0,5):''))
  :'SALVO SÓ NESTE APARELHO')+'</span><span>|</span>'+
'<span class="soPC">Loja: <b>'+E(nomeLojaAtual())+'</b></span><span class="soPC">|</span>'+
'<span class="soPC">Usuário: <b>'+E((usuarioLogado()||{}).login||(usuarioLogado()||{}).nome||'—')+'</b>'+
  (ehPlataforma()?' <em style="color:var(--acc)">(dono da Joia)</em>':'')+'</span>'+
(extra?'<span class="soPC">|</span><span class="soPC">'+extra+'</span>':'')+
'<span class="gw"></span><span class="logo soPC">'+
 '<img src="joia-icone.png" alt="" class="logoIco">JOIA</span>'+
'<span class="verTag" onclick="location.reload(true)" title="clique para buscar a versão mais nova">'+VERSAO+'</span>';
}

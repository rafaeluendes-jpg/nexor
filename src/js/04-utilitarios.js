/* ===== BLOCO 4 — UTILITARIOS ===== */
var S={mod:null,it:null,aberto:null,cat:'todos',buscaCat:'',buscaProd:''};
var $=function(i){return document.getElementById(i)};
function M(id){return MOD.find(function(x){return x.id===id})||null}
function IT(m,id){return m?(m.it.find(function(x){return x.id===id})||null):null}
/* ==========================================================
   P14 — ESCAPE COMPLETO
   A versao anterior trocava apenas  &  <  e  "  — faltavam  >  e a ASPA
   SIMPLES. O sistema monta dezenas de atributos assim:
       onclick="abrir('+E(x.id)+')"
   Um valor contendo aspa simples fechava a string e o que viesse depois
   era executado como codigo. Um cliente chamado  O'Brien');alert(1);//
   ja seria suficiente.
   Agora escapa os cinco caracteres que importam em HTML.
   ========================================================== */
function E(t){return String(t==null?'':t)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
/* ==========================================================
   TECLADO NUMERICO PARA TELA DE TOQUE (parte B)

   O PDV roda em tablet e totem, onde o teclado do sistema operacional
   cobre metade da tela — inclusive o botao de finalizar — e some sem
   avisar. Este e proprio, fica ancorado embaixo e nunca cobre o rodape
   do modal.

   SO no PDV e no fechamento de caixa. Abrir isto na tela de cadastro de
   produto, onde a pessoa esta num computador com teclado de verdade,
   seria estorvo.

   O teclado fisico continua funcionando o tempo todo: quem digita
   direto nao percebe que ele existe.
   ========================================================== */
var TECLADO={alvo:null,antes:null};
function tecladoTouchPermitido(){
  try{
    if(cfg().tecladoTouch===false)return false;
    /* aparelho sem toque nao precisa: teclado fisico ja resolve */
    var toque=('ontouchstart' in window)||navigator.maxTouchPoints>0;
    if(!toque&&cfg().tecladoTouch!==true)return false;
    return (S.mod==='pdv')||!!document.getElementById('cfTot')||!!document.getElementById('fcFundo');
  }catch(e){ return false; }
}
function tecladoTouchAbrir(el){
  if(!el||!tecladoTouchPermitido())return;
  if(el.getAttribute('data-semteclado')==='1')return;
  TECLADO.alvo=el;
  TECLADO.antes=el.value;
  var box=document.getElementById('tecladoTouch');
  if(!box){
    box=document.createElement('div');
    box.id='tecladoTouch';
    box.className='tclOv';
    box.innerHTML=
      '<div class="tclBox">'+
        '<div class="tclEco"><span>R$</span><b id="tclEco">0,00</b></div>'+
        '<div class="tclGrade">'+
          ['7','8','9','4','5','6','1','2','3'].map(function(d){
            return '<button class="tclT" data-d="'+d+'">'+d+'</button>';
          }).join('')+
          '<button class="tclT" data-d=",">,</button>'+
          '<button class="tclT" data-d="0">0</button>'+
          '<button class="tclT tclApg" data-d="del">&#9003;</button>'+
        '</div>'+
        '<div class="tclRodape">'+
          '<button class="tclLimpar" data-d="clr">Limpar</button>'+
          '<button class="tclOk" data-d="ok">OK</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(box);
    box.addEventListener('mousedown',function(ev){ ev.preventDefault(); });
    box.addEventListener('click',function(ev){
      var b=ev.target.closest('[data-d]');
      if(b){ tecladoTouchTecla(b.getAttribute('data-d')); return; }
      if(ev.target===box)tecladoTouchFechar(true);
    });
  }
  box.classList.add('on');
  document.body.classList.add('comTeclado');
  tecladoTouchEco(el);
}
function tecladoTouchEco(el){
  var e=document.getElementById('tclEco');
  if(e&&(!el||el===TECLADO.alvo))e.textContent=(el&&el.value)||'0,00';
}
function tecladoTouchTecla(d){
  var el=TECLADO.alvo; if(!el)return;
  if(d==='ok'){ tecladoTouchFechar(); tecladoTouchProximo(el); return; }
  if(d==='clr'){ el.value=''; }
  else if(d==='del'){ el.value=el.value.slice(0,-1); }
  else if(d===','){ if(el.value.indexOf(',')<0)el.value=(el.value||'0')+','; }
  else {
    /* o campo comeca vazio de verdade: digitar 25 da 25, nunca 025 */
    el.value=(el.value||'')+d;
  }
  el.setAttribute('data-v',moedaLer(el.value));
  el.dispatchEvent(new Event('input',{bubbles:true}));
  tecladoTouchEco(el);
}
/* item 7: OK avanca para o proximo campo de dinheiro da mesma tela */
function tecladoTouchProximo(el){
  var campos=[].slice.call(document.querySelectorAll('.moeda:not([disabled])'))
    .filter(function(x){return x.offsetParent!==null});
  var i=campos.indexOf(el);
  if(i>=0&&i<campos.length-1){ campos[i+1].focus(); }
}
function tecladoTouchFechar(cancelar){
  var box=document.getElementById('tecladoTouch');
  if(box)box.classList.remove('on');
  document.body.classList.remove('comTeclado');
  var el=TECLADO.alvo;
  if(el){
    /* ESC devolve o valor que estava antes — nao altera nada indevidamente */
    if(cancelar==='esc'&&TECLADO.antes!==null){
      el.value=TECLADO.antes;
      el.setAttribute('data-v',moedaLer(el.value));
      el.dispatchEvent(new Event('input',{bubbles:true}));
    }
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  TECLADO.alvo=null; TECLADO.antes=null;
}
document.addEventListener('keydown',function(e){
  if(!TECLADO.alvo)return;
  if(e.key==='Escape'){ e.preventDefault(); tecladoTouchFechar('esc'); }
  /* ENTER e tratado por quem e dono do campo (fechamento, pagamento);
     aqui so recolhe o teclado para nao cobrir o botao */
  if(e.key==='Enter'){ tecladoTouchFechar(); }
});
function money(v){return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
/* ==========================================================
   CAMPO DE DINHEIRO — UM SO, PARA O SISTEMA INTEIRO

   Havia 18 campos de valor espalhados, cada um `type="number"` com
   `value="0"`. Tres problemas, todos os dias, em toda tela:

   1. o zero era VALOR, nao rotulo. Quem tocava e digitava 25 obtinha
      "025" ou tinha de apagar o zero antes;
   2. trocar 125,90 por 80 exigia apagar digito por digito;
   3. `type="number"` num aparelho em portugues aceita virgula E ponto,
      e `parseFloat("1.234,56")` devolve 1.234 — silenciosamente.

   O componente resolve os tres de uma vez, e e o UNICO lugar onde a
   conversao texto->numero acontece. Nada de calculo em cima de string
   formatada.

   Uso:
     moedaHTML({id:'cxIni', valor:0})       -> HTML do campo
     moedaValor('cxIni')                    -> numero, sempre
     moedaSet('cxIni', 12.5)                -> escreve formatado

   O valor real vive em `data-v`; o que aparece e so apresentacao.
   ========================================================== */
/* ==========================================================
   ARREDONDAR CENTAVO NAO E `toFixed` (GL-11)

   JavaScript guarda numero em binario, e nem todo decimal cabe. O caso
   real, medido nesta auditoria:

     250 g de insumo a R$ 0,0043
     valor exato ......... 1,075
     no binario .......... 1,0749999999999999556
     toFixed(2) .......... "1.07"
     Postgres (numeric) .. 1.08

   Um centavo de diferenca entre a tela e o banco, no MESMO calculo. Na
   ficha tecnica isso multiplica: cada insumo erra um centavo para baixo,
   e o CMV da loja fica menor do que e — o que faz a margem parecer maior
   do que e.

   O `+ Number.EPSILON` corrige a representacao antes de arredondar, e o
   resultado passa a bater com o banco, que e a fonte da verdade.

   Uso: `arred(250*0.0043)` -> 1.08. Para custos com mais casas,
   `arred(v, 4)`.
   ========================================================== */
function arred(v, casas){
  var n = Number(v);
  if(!isFinite(n)) return 0;
  var p = Math.pow(10, (casas===undefined ? 2 : casas));
  return Math.round((n + Number.EPSILON * Math.abs(n)) * p) / p;
}
function moedaFmt(n){
  n=Number(n)||0;
  return n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
/* le qualquer coisa que o usuario digitou e devolve numero.
   Aceita "1.234,56", "1234.56", "1234,56", "R$ 80" e vazio. */
function moedaLer(txt){
  if(txt===null||txt===undefined)return 0;
  var s=String(txt).replace(/[^\d,.-]/g,'').trim();
  if(!s)return 0;
  var v=s.lastIndexOf(','), p=s.lastIndexOf('.');
  if(v>=0&&p>=0){
    /* o ultimo separador manda: e o decimal */
    if(v>p) s=s.replace(/\./g,'').replace(',','.');
    else    s=s.replace(/,/g,'');
  } else if(v>=0){
    /* so virgula: decimal, a menos que sejam milhares (1,234) */
    s=(/,\d{3}$/.test(s)&&s.replace(/[^,]/g,'').length===1&&s.indexOf(',')>0&&s.length>4)
      ? s.replace(',','') : s.replace(',','.');
  }
  var n=parseFloat(s);
  return isFinite(n)?n:0;
}
function moedaHTML(o){
  o=o||{};
  var v=Number(o.valor)||0;
  var vazio=(v===0&&o.zeroVazio!==false);
  return '<div class="cur moedaBox"'+(o.estilo?' style="'+o.estilo+'"':'')+'>'+
    '<span>R$</span>'+
    '<input type="text" inputmode="decimal" autocomplete="off" class="moeda'+
      (o.classe?' '+o.classe:'')+'" '+
      (o.id?'id="'+o.id+'" ':'')+
      (o.attrs||'')+
      ' data-v="'+v+'" value="'+(vazio?'':moedaFmt(v))+'" placeholder="0,00">'+
  '</div>';
}
function moedaEl(ref){
  return (typeof ref==='string')?document.getElementById(ref):ref;
}
function moedaValor(ref){
  var el=moedaEl(ref);
  if(!el)return 0;
  /* o texto na tela manda: `data-v` pode estar atrasado se o evento
     de digitacao ainda nao rodou (toque em Finalizar sem sair do campo) */
  var n=moedaLer(el.value);
  if(!el.value&&el.getAttribute('data-v'))n=Number(el.getAttribute('data-v'))||0;
  return +n.toFixed(2);
}
function moedaSet(ref,valor,vazioSeZero){
  var el=moedaEl(ref); if(!el)return;
  var n=Number(valor)||0;
  el.setAttribute('data-v',n);
  el.value=(n===0&&vazioSeZero)?'':moedaFmt(n);
}
/* ==========================================================
   OS TRES COMPORTAMENTOS, LIGADOS UMA VEZ SO NO DOCUMENTO

   Delegacao: as telas sao redesenhadas o tempo todo (333 pontos
   chamam telaX() depois de salvar). Ligar evento em cada campo criado
   significaria religar em cada redesenho e esquecer em algum.
   ========================================================== */
document.addEventListener('focusin',function(e){
  var el=e.target;
  if(!el.classList||!el.classList.contains('moeda'))return;
  /* item 2: tocar seleciona tudo — trocar 125,90 por 80 e digitar 80 */
  setTimeout(function(){ try{ el.select(); }catch(x){} },0);
  if(typeof tecladoTouchAbrir==='function')tecladoTouchAbrir(el);
});
document.addEventListener('input',function(e){
  var el=e.target;
  if(!el.classList||!el.classList.contains('moeda'))return;
  el.setAttribute('data-v',moedaLer(el.value));
  if(typeof tecladoTouchEco==='function')tecladoTouchEco(el);
  if(el.dataset.aoDigitar&&window[el.dataset.aoDigitar])window[el.dataset.aoDigitar](el);
});
document.addEventListener('focusout',function(e){
  var el=e.target;
  if(!el.classList||!el.classList.contains('moeda'))return;
  var n=moedaLer(el.value);
  el.setAttribute('data-v',n);
  /* vazio continua vazio: o "0,00" cinza e placeholder, nao valor */
  el.value=(el.value.trim()==='')?'':moedaFmt(n);
});
function toast(m){var o=$('ts');if(o)o.remove();var d=document.createElement('div');
d.className='toast';d.id='ts';d.textContent=m;document.body.appendChild(d);
setTimeout(function(){if(d.parentNode)d.remove()},2400);}
function dev(){toast('Este módulo será construído na próxima etapa.');}
/* ==========================================================
   A TELA NAO SOBE MAIS SOZINHA
   Existem 333 lugares no sistema que redesenham a propria tela depois
   de salvar alguma coisa. Cada um deles jogava a pessoa para o topo, e
   tapar um a um seria garantir esquecer algum.

   Em vez disso: o sistema anota onde a pessoa estava em cada tela e,
   sempre que o conteudo e refeito SEM trocar de tela, devolve a
   posicao. Trocou de tela de verdade, comeca do topo — que e o certo.
   ========================================================== */
var _rolTela={}, _rolChave=null, _rolTrava=false;
function chaveTela(){return (S.mod||'')+'/'+(S.it||'')}
/* ==========================================================
   QUALQUER CAIXA QUE ROLA, NAO SO DUAS

   A guarda so olhava `.etScroll` e `.finWrap`. Medido tela a tela: VINTE
   E OITO telas rolam em outra caixa — o cardapio em `.cardB`, a ficha
   tecnica em `.ftWrap`, a movimentacao e os insumos em `.mvWrap`, os
   lancamentos em `.lfScroll`, a conciliacao em `.cbWrap`, as notas em
   `.ntWrap`, o fluxo em `.fxWrap`, e mais onze em `.ctWrap`. Em todas
   elas o defeito continuava inteiro: quem estava no fim da lista e
   clicava em qualquer coisa voltava para o topo.

   Crescer a lista de classes seria garantir esquecer a proxima — foi o
   que o comentario acima ja dizia sobre tapar buraco um a um. Entao a
   posicao passa a ser guardada para TODA caixa que role dentro do
   #content, identificada por uma marca estavel, e devolvida junto.

   A marca e o identificador do elemento quando ele tem um; senao, a
   etiqueta com as duas primeiras classes mais a posicao entre os iguais.
   Sobrevive ao redesenho, que reconstroi a mesma estrutura.
   ========================================================== */
function marcaDeRolagem(el){
  if(el.id)return '#'+el.id;
  var cls=String(el.className||'').trim().split(/\s+/).filter(Boolean).slice(0,2).join('.');
  var sel=el.tagName.toLowerCase()+(cls?'.'+cls:'');
  try{
    var iguais=document.querySelectorAll('#content '+sel);
    for(var i=0;i<iguais.length;i++)if(iguais[i]===el)return sel+'|'+i;
  }catch(e){ /* classe com caractere que nao vale em seletor */ }
  return sel+'|0';
}
function elementoDaMarca(marca){
  try{
    if(marca.charAt(0)==='#')return document.getElementById(marca.slice(1));
    var p=marca.split('|');
    return document.querySelectorAll('#content '+p[0])[Number(p[1])||0]||null;
  }catch(e){ return null; }
}
(function guardarRolagem(){
  /* na fase de captura porque a barra e de um elemento interno, e o evento
     de rolagem nao sobe pela arvore */
  document.addEventListener('scroll',function(e){
    if(_rolTrava)return;
    var el=e.target;
    if(!el||el.nodeType!==1)return;
    var area=document.getElementById('content');
    if(!area||!(el===area||area.contains(el)))return;
    var k=chaveTela();
    _rolTela[k]=_rolTela[k]||{};
    _rolTela[k][marcaDeRolagem(el)]=el.scrollTop;
  },true);
  window.addEventListener('scroll',function(){
    if(_rolTrava)return;
    var k=chaveTela();
    _rolTela[k]=_rolTela[k]||{};
    _rolTela[k]['@janela']=window.scrollY||0;
  });
})();
function devolverRolagem(){
  var k=chaveTela();
  if(k!==_rolChave){_rolChave=k;return;}    /* tela nova: comeca no topo */
  var m=_rolTela[k];
  if(!m)return;
  _rolTrava=true;
  Object.keys(m).forEach(function(marca){
    var y=Number(m[marca])||0;
    if(!y)return;
    if(marca==='@janela'){
      if(Math.abs((window.scrollY||0)-y)>2)window.scrollTo(0,y);
      return;
    }
    var el=elementoDaMarca(marca);
    if(el&&Math.abs(el.scrollTop-y)>2)el.scrollTop=y;
  });
  setTimeout(function(){_rolTrava=false},60);
}
/* ligado no arranque: aqui em cima o #content ainda nao existe */
var _obsRol=null;
function vigiarConteudo(){
  try{
    if(_obsRol)return;
    var alvo=document.getElementById('content');
    if(!alvo||!window.MutationObserver)return;
    _obsRol=new MutationObserver(function(){ devolverRolagem(); });
    _obsRol.observe(alvo,{childList:true});
  }catch(e){_quieto(e,'vigiarConteudo')}
}
/* redesenha sem perder o lugar em que a pessoa estava lendo */
function comRolagem(fn){
  var r=document.querySelector('.etScroll');
  var y=r?r.scrollTop:(window.scrollY||0);
  fn();
  var r2=document.querySelector('.etScroll');
  if(y){ if(r2)r2.scrollTop=y; else window.scrollTo(0,y); }
}
/* Duas abas do mesmo sistema gravavam uma por cima da outra, e a ultima a
   salvar apagava o trabalho da primeira. Agora a aba antiga percebe e avisa,
   em vez de continuar gravando por cima. */
var _minhaAba=String(Date.now())+'-'+Math.random().toString(36).slice(2,7);
(function vigiarAbas(){
  try{
    localStorage.setItem('nexor_aba',_minhaAba);
    window.addEventListener('storage',function(e){
      if(e.key==='nexor_aba'&&e.newValue&&e.newValue!==_minhaAba){
        alertaGravacao('A Joia foi aberta em outra aba ou janela. Para não gravar '+
          'um por cima do outro, use apenas uma — feche esta ou recarregue depois '+
          'de fechar a outra.');
      }
      if(e.key==='nexor_dados'&&!NUVEM.sincronizando){
        /* outra aba gravou: avisa que o que esta na tela pode estar velho */
        marcaNovidade(true);
      }
    });
  }catch(e){_quieto(e,'comRolagem')}
})();
function fecharPops(){
  var p=document.querySelectorAll('.popMenu');
  for(var i=0;i<p.length;i++)p[i].remove();
  _popDono=null;
}
document.addEventListener('click',function(e){
  if(!e.target.closest('.popMenu')&&!e.target.closest('[data-pop]'))fecharPops();
  if(!e.target.closest('.band')){fecharDrop();fecharSuc();}
});


/* rede de seguranca: qualquer falha inesperada avisa em vez de travar a tela */
window.onerror=function(msg,arq,lin){
  try{toast('Ocorreu um erro na tela ('+msg+'). Nada foi perdido — seus dados estão salvos.');}catch(e){_quieto(e,'fecharPops')}
  return false;
};
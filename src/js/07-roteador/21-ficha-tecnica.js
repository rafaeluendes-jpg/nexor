/* ==========================================================
   BLOCO 21 — FICHA TÉCNICA
   ========================================================== */
var FT={cat:'',sub:'',busca:'',sel:null,loja:'',mostrar:false,abertas:{}};

function proxCodFicha(){return proxCodItem()}
var _mapaCat=null, _mapaCatL=null, _mapaCatN=-1;
function catFicha(id){
  var lst=DB.fichaCats||[];
  if(_mapaCatL!==lst||_mapaCatN!==lst.length){
    _mapaCat={}; lst.forEach(function(c){_mapaCat[c.id]=c});
    _mapaCatL=lst; _mapaCatN=lst.length;
  }
  return _mapaCat[id]||null;
}
/* ==========================================================
   GRUPO E SUBGRUPO SAO A MESMA TABELA
   ficha_grupos ganhou pai_id. Pasta e a linha sem pai; subgrupo e a linha
   com pai. Antes o subgrupo so existia dentro do grupo, em memoria, e era
   remontado a partir das fichas — subgrupo vazio sumia no carregamento
   seguinte e nao havia onde escrever.
   c.subs continua existindo porque ha tela que le dele, mas agora e
   DERIVADO: nunca e fonte, e refeito a cada normalizacao.
   ========================================================== */
function gruposFicha(){return (DB.fichaCats||[]).filter(function(c){return !c.paiId})}
function subsDoGrupo(cid){
  return (DB.fichaCats||[]).filter(function(c){return c.paiId===cid})
    .sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')});
}
function subFicha(id){
  if(!id)return null;
  var c=catFicha(id);
  if(c&&c.paiId)return c;
  var achou=null;   /* heranca: subgrupo que ainda so existe dentro do grupo */
  (DB.fichaCats||[]).forEach(function(c2){(c2.subs||[]).forEach(function(s){if(s.id===id)achou=s})});
  return achou;
}
function normalizaGruposFicha(){
  if(!DB.fichaCats)DB.fichaCats=[];
  var novos=[];
  var tem=function(id){return (DB.fichaCats||[]).some(function(x){return x.id===id})
    ||novos.some(function(x){return x.id===id})};
  /* subgrupo que so existia dentro do grupo vira linha */
  (DB.fichaCats||[]).forEach(function(c){
    if(c.paiId)return;
    (c.subs||[]).forEach(function(sg){
      if(!sg||!sg.id||tem(sg.id))return;
      novos.push({id:sg.id,nome:sg.nome||'Subgrupo',paiId:c.id,subs:[],destinoId:'',sucursais:[]});
    });
  });
  /* ficha apontando para subgrupo que nunca teve linha: a linha nasce agora,
     senao a ficha ficaria invisivel na arvore (mesmo erro da V13.2.0) */
  (DB.fichas||[]).forEach(function(f){
    if(!f.subgrupoId||tem(f.subgrupoId))return;
    if(!f.categoriaId)return;
    novos.push({id:f.subgrupoId,nome:f.subgrupoNome||'Subgrupo recuperado',
      paiId:f.categoriaId,subs:[],destinoId:'',sucursais:[]});
  });
  if(novos.length)DB.fichaCats=DB.fichaCats.concat(novos);
  (DB.fichaCats||[]).forEach(function(c){
    if(c.paiId===undefined)c.paiId='';
    c.subs=c.paiId?[]:subsDoGrupo(c.id);
  });
  return novos.length;
}
function custoItem(it){
  var ins=itemComp(it.insumoId);
  if(!ins)return 0;
  var q=Number(it.qtd)||0;
  var perda=Number(it.perda)||0;
  if(perda>0&&perda<100)q=q/(1-perda/100);
  var conv=convUnid(q,it.unidade,ins.unidade);
  if(conv===null)conv=q;
  return +(conv*(ins.custo||0)).toFixed(4);
}
/* ==========================================================
   FICHA QUE SE CONTEM TRAVA O NAVEGADOR
   Uma ficha pode ter outra ficha como ingrediente, e o custo de uma ficha
   e a soma dos custos dos seus itens. Se A usa B e B usa A, esse calculo
   se chama sem fim e a aba congela. A pilha abaixo corta o ciclo: a ficha
   que ja esta sendo calculada vale zero na segunda entrada.
   ========================================================== */
var _custoEmCurso={};
function custoFicha(f){
  if(!f)return 0;
  if(_custoEmCurso[f.id])return 0;
  _custoEmCurso[f.id]=true;
  var t=0;
  try{ t=(f.itens||[]).reduce(function(a,it){return a+custoItem(it)},0); }
  finally{ delete _custoEmCurso[f.id]; }
  return +t.toFixed(4);
}
function custoPorUnidade(f){var r=Number(f.rendimento)||0;return r?+(custoFicha(f)/r).toFixed(4):0}
function custoPorVenda(f){var u2=Number(f.unidadesVenda)||0;return u2?+(custoFicha(f)/u2).toFixed(4):custoPorUnidade(f)}
function baseFicha(){
  baseEstoque();
  /* limpa a ficha de exemplo que versões antigas criavam */
  DB.fichas=(DB.fichas||[]).filter(function(f){
    return !(/Ficha padrão/i.test(f.nome||'')&&!(f.itens||[]).length);
  });
  /* Produzido e Vendas sao estruturais: a producao depende de um grupo que
     case com /produz/. Ja os subgrupos (Artesanal, Base de Gelato, Cascao,
     Sorbet, Zero Acucar) sao do ramo de gelato e nasciam em TODA loja nova —
     uma padaria abria o sistema e encontrava Sorbet cadastrado. Cada empresa
     cria os seus. */
  if(!DB.fichaCats.length){
    DB.fichaCats=[
      {id:'fc_prod',nome:'Produzido',subs:[]},
      {id:'fc_venda',nome:'Vendas',subs:[]}
    ];
  }
  normalizaGruposFicha();
  var _proxF=0;
  (DB.insumos||[]).forEach(function(x){var v=Number(x.codigo)||0;if(v>_proxF)_proxF=v});
  (DB.fichas||[]).forEach(function(x){var v=Number(x.codigo)||0;if(v>_proxF)_proxF=v});
  DB.fichas.forEach(function(f){
    if(!f.codigo)f.codigo=String(++_proxF);
    if(!f.unidade)f.unidade='un';
    if(!f.itens)f.itens=[];
    if(f.rendimento===undefined)f.rendimento=1;
    if(!f.rendUnidade)f.rendUnidade=f.unidade;
    /* Todo ingrediente precisa de identificador proprio. Sem ele nao da para
       saber, no download, quais ja estao na nuvem e quais so existem aqui —
       e era assim que o ingrediente novo era descartado. Fichas antigas
       recebem o seu agora, uma vez. */
    var _vistos={};
    (f.itens||[]).forEach(function(it,j){
      if(!it)return;
      if(!it.id||_vistos[it.id])
        it.id=f.id+'_'+j+'_'+Math.random().toString(36).slice(2,8);
      _vistos[it.id]=true;
    });
  });
}
/* DESATIVADA. Criava 15 insumos de gelato em toda loja que abrisse a tela de
   fichas com o estoque vazio — inclusive em cliente novo, que via 27 insumos
   sem nunca ter cadastrado nada. A funcao continua existindo, e vazia, porque
   ha chamadas dela espalhadas; botao que aponta para funcao inexistente quebra
   a tela. Cadastro de insumo agora so nasce de quem cadastrou. */

/* ---------- LISTA ---------- */
function telaFichaTecnica(){
  baseFicha();
  var lista=[];
  if(FT.mostrar){
    lista=(DB.fichas||[]).filter(function(f){
      if(FT.sub&&f.subgrupoId!==FT.sub)return false;
      if(FT.cat==='__sem')return !catFicha(f.categoriaId);
      if(FT.cat&&!FT.sub&&f.categoriaId!==FT.cat)return false;
      if(FT.busca){
        var q=FT.busca.toLowerCase();
        if((f.nome||'').toLowerCase().indexOf(q)<0&&String(f.codigo||'').indexOf(q)<0)return false;
      }
      return true;
    }).sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')});
  }

  $('content').innerHTML='<div class="ftWrap">'+
   '<div class="ftBar">'+
    '<span class="ftTit">Produto</span>'+
    '<div class="tSep2"></div>'+
    '<button class="btnP2 ok" onclick="modalFicha()">Novo</button>'+
    '<button class="btnP2" onclick="editarSel()">Editar</button>'+
    '<button class="btnP2 rdB" onclick="excluirSel()">Excluir</button>'+
    '<button class="btnP2" onclick="abrirComposicao()">Ficha Técnica</button>'+
    '<button class="btnP2" onclick="modalUnidades()">Converter Unids.</button>'+
    '<button class="btnP2 ok" onclick="corrigirVinculos()">'+sv('ref',13)+' Corrigir vínculos</button>'+
   '</div>'+
   '<div class="ftBody">'+
    '<aside class="ftPane">'+
     '<div class="ftPaneH">Pesquisar</div>'+
     '<div class="ftPaneB">'+
      '<div class="ftCampo"><label>Localizar</label>'+
       '<input id="ftB" value="'+E(FT.busca)+'" placeholder="nome ou código"></div>'+
      '<div class="ftCampo"><label>Relação do grupo</label>'+
       '<div class="arvFT">'+
        '<div class="ftNo'+(!FT.cat&&!FT.sub?' on':'')+'" onclick="filtroFT(\'\',\'\')">'+
         '<span class="ftSeta vaz"></span>'+sv('folder',13)+' Todos os grupos</div>'+
        /* Uma ficha sem grupo ficava fora de toda a árvore: existia no banco e
           não aparecia em lugar nenhum. Agora ela tem onde ser vista e corrigida. */
        (function(){
          var orfas=(DB.fichas||[]).filter(function(f){return !catFicha(f.categoriaId)});
          if(!orfas.length)return '';
          return '<div class="ftNo'+(FT.cat==='__sem'?' on':'')+'" onclick="filtroFT(\'__sem\',\'\')">'+
           '<span class="ftSeta vaz"></span>'+sv('folder',13)+
           ' <b style="color:var(--amber)">Sem grupo</b> <span class="ftQt">'+orfas.length+'</span></div>';
        })()+
        gruposFicha().map(function(c){
          var ab=!!FT.abertas[c.id];
          var _sgs=subsDoGrupo(c.id);
          var _soltas=(DB.fichas||[]).filter(function(f){return f.categoriaId===c.id&&!f.subgrupoId});
          var _tot=(DB.fichas||[]).filter(function(f){return f.categoriaId===c.id}).length;
          return '<div class="ftNo'+(FT.cat===c.id&&!FT.sub?' on':'')+'">'+
           '<span class="ftSeta'+(ab?' ab':'')+'" onclick="event.stopPropagation();toggleFT(\''+c.id+'\')">'+
            ((_sgs.length||_soltas.length)?sv('tri',9):'')+'</span>'+
           '<span class="ftNoNm" onclick="filtroFT(\''+c.id+'\',\'\')">'+sv(ab?'folderOpen':'folder',13)+' '+E(c.nome)+'</span>'+
           (_tot?'<span class="ftQt">'+_tot+'</span>':'')+
           '<span class="ftEd">'+
            '<button class="arvB" onclick="event.stopPropagation();modalCatFicha(\''+c.id+'\')">'+sv('edit',10)+'</button>'+
            '<button class="arvB rd" onclick="event.stopPropagation();excluirCatFicha(\''+c.id+'\')">'+sv('trash',10)+'</button>'+
           '</span></div>'+
           (ab?'<div class="ftSubs">'+
             _sgs.map(function(sg){
               var _qs=(DB.fichas||[]).filter(function(f){return f.subgrupoId===sg.id}).length;
               return '<div class="ftNo sub'+(FT.sub===sg.id?' on':'')+'" onclick="filtroFT(\''+c.id+'\',\''+sg.id+'\')">'+
               sv('file2',12)+' '+E(sg.nome)+
               (_qs?'<span class="ftQt">'+_qs+'</span>':'')+
               '<span class="ftEd">'+
                '<button class="arvB" onclick="event.stopPropagation();renSubFicha(\''+sg.id+'\')">'+sv('edit',10)+'</button>'+
                '<button class="arvB rd" onclick="event.stopPropagation();delSubFicha(\''+sg.id+'\')">'+sv('trash',10)+'</button>'+
               '</span></div>';
             }).join('')+
             _soltas.slice()
               .sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')})
               .map(function(f){
                 return '<div class="ftNo prod'+(FT.sel===f.id?' on':'')+'" onclick="selecionaFicha(\''+f.id+'\')">'+
                 sv('file2',12)+' '+E(f.nome)+'</div>';}).join('')+
             '<div class="ftAddSub"><input id="fsg-'+c.id+'" placeholder="novo subgrupo"'+
              ' onkeydown="if(event.key===\'Enter\')addSubFicha(\''+c.id+'\')">'+
              '<button class="arvB" onclick="addSubFicha(\''+c.id+'\')">'+sv('plus',11)+'</button></div>'+
            '</div>':'');
        }).join('')+
       '</div>'+
       '<button class="btnP2" style="width:100%;justify-content:center;margin-top:6px" onclick="modalCatFicha()">'+
        sv('plus',12)+' Novo grupo</button>'+
      '</div>'+
     '</div>'+
     '<button class="btnPesq" onclick="pesquisarFT()">Pesquisar</button>'+
    '</aside>'+
    '<div class="ftMain">'+
     '<div class="ftTabW">'+
     (!FT.mostrar
      ?'<div class="ftEspera">'+sv('search',26)+'<b>Selecione um grupo e clique em Pesquisar</b>'+
       '<span>A lista de produtos aparece aqui.</span></div>'
      :(lista.length?'<table class="ftTab"><thead><tr>'+
       '<th style="width:90px">Código</th><th>Nome</th>'+
       '<th style="width:150px">Grupo</th>'+
       '<th style="width:130px">Unidade Padrão</th>'+
       '<th style="width:70px;text-align:center">Itens</th>'+
       '<th style="width:112px;text-align:right">Custo</th></tr></thead><tbody>'+
       lista.map(function(f){
         var c=catFicha(f.categoriaId),sg=subFicha(f.subgrupoId);
         return '<tr class="'+(FT.sel===f.id?'sel2':'')+'" onclick="FT.sel=\''+f.id+'\';marcaLinhaFT()" '+
         'ondblclick="modalComposicao(\''+f.id+'\')">'+
         '<td>'+E(f.codigo)+'</td><td>'+E(f.nome.toUpperCase())+'</td>'+
         '<td>'+E((c?c.nome:'')+(sg?' › '+sg.nome:''))+'</td>'+
         '<td>'+E(un(f.unidade).n)+'</td>'+
         '<td style="text-align:center">'+((f.itens||[]).length||'')+'</td>'+
         '<td style="text-align:right">'+(custoFicha(f)?money(custoFicha(f)):'')+'</td></tr>';
       }).join('')+'</tbody></table>'
      :'<div class="ftEspera">'+sv('box',26)+'<b>Nenhum produto neste grupo</b>'+
       '<span>Clique em <b>Novo</b> para cadastrar.</span></div>'))+
     '</div>'+
     '<div class="ftFoot">'+
      '<span id="ftSelTxt">'+(FT.sel?'Selecionado: <b>'+E((DB.fichas.find(function(f){return f.id===FT.sel})||{}).nome||'')+'</b>':'Nenhum produto selecionado')+'</span>'+
      '<span class="hint">'+lista.length+' registro(s) · clique duas vezes para abrir a ficha</span>'+
     '</div></div></div></div>';
  $('ftB').oninput=function(){FT.busca=this.value};
  $('ftB').onkeydown=function(e){if(e.key==='Enter')pesquisarFT()};
  rodape((DB.fichas||[]).length+' fichas · '+(DB.insumos||[]).length+' insumos');
}
function pesquisarFT(){FT.mostrar=true;telaFichaTecnica();}
function selecionaFicha(id){
  var f=(DB.fichas||[]).find(function(x){return x.id===id});
  if(!f)return;
  FT.sel=id;FT.cat=f.categoriaId;FT.sub=f.subgrupoId||'';FT.mostrar=true;
  telaFichaTecnica();
}
function filtroFT(c,sg){FT.cat=c;FT.sub=sg;FT.mostrar=true;telaFichaTecnica();}
function toggleFT(id){FT.abertas[id]=!FT.abertas[id];telaFichaTecnica();}
function marcaLinhaFT(){
  var f=DB.fichas.find(function(x){return x.id===FT.sel});
  var t=$('ftSelTxt');
  if(t&&f)t.innerHTML='Selecionado: <b>'+E(f.nome)+'</b>';
  var rs=document.querySelectorAll('.ftTab tbody tr');
  for(var i=0;i<rs.length;i++)rs[i].classList.remove('sel2');
  if(event&&event.currentTarget)event.currentTarget.classList.add('sel2');
}
/* Mostra o que o sistema está enxergando e conserta os vínculos de produção.
   Serve como diagnóstico: se algo estiver errado, aparece aqui na tela. */
function corrigirVinculos(){
  baseMov();
  var itens=itensEstoque();
  var gv=(DB.insumos||[]).find(function(i){
    return i.gelatoVenda||String(i.nome||'').toLowerCase()==='gelato venda';});
  var linhas=(DB.fichas||[]).map(function(f){
    var d=destinoDaFicha(f);
    return {f:f,d:d,grupo:(catFicha(f.categoriaId)||{}).nome||'—'};
  });
  var semDestino=linhas.filter(function(x){return !x.d});

  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>O que o sistema está vendo</h3>'+
   '<div class="linha"><span>Itens de estoque carregados</span><b>'+itens.length+'</b></div>'+
   '<div class="linha"><span>Fichas técnicas</span><b>'+(DB.fichas||[]).length+'</b></div>'+
   '<div class="linha"><span>Item "Gelato Venda"</span><b class="'+(gv?'vg':'vr')+'">'+
     (gv?'encontrado':'NÃO ENCONTRADO')+'</b></div>'+
   '<div class="linha"><span>Fichas sem destino</span><b class="'+(semDestino.length?'vr':'vg')+'">'+
     semDestino.length+'</b></div>'+
   '<div class="linha"><span>Versão neste aparelho</span><b>'+VERSAO+'</b></div>'+
  '</div>'+
  '<div class="blk" style="margin:0;max-width:none;padding:0;overflow:hidden">'+
   '<div class="acTit">Ficha por ficha</div>'+
   '<div class="acTabW" style="max-height:300px"><table class="acTab"><tbody>'+
   linhas.map(function(x){
     return '<tr><td><b>'+E(x.f.nome)+'</b><small style="display:block;color:var(--ink-3)">'+
     E(x.grupo)+'</small></td>'+
     '<td style="text-align:right">'+(x.d
       ? '<span class="comDest">'+E(x.d.nome)+(fatorDestino(x.f)!==1?' '+fmtQt(fatorDestino(x.f))+'x':'')+'</span>'
       : '<span class="semDest">sem destino</span>')+'</td></tr>';
   }).join('')+'</tbody></table></div></div></div>';

  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox lg"><div class="mdH"><b>Vínculos de produção</b>'+
   '<button onclick="fecharModal()">&times;</button></div>'+h+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
   '<button class="btnP2" onclick="baixarEVincular()">Baixar da nuvem e corrigir</button>'+
   '<button class="btnP2 ok" onclick="vincularTudo()">Vincular tudo do grupo</button></div></div>';
  document.body.appendChild(o);
  fecharSoForaDeVerdade(o);
}
/* liga todas as fichas ao destino padrão do grupo delas */
function vincularTudo(){
  baseMov();
  var gv=(DB.insumos||[]).find(function(i){
    return i.gelatoVenda||String(i.nome||'').toLowerCase()==='gelato venda';});
  var n=0;
  gruposFicha().forEach(function(c){
    if(!c.destinoId&&/produz|gelato/i.test(c.nome)&&gv){c.destinoId=gv.id;n++;}
  });
  (DB.fichas||[]).forEach(function(f){
    if(f.destinoId==='__nenhum')return;
    /* respeita a escolha que você já fez nesta ficha */
    if(f.destinoNome){
      var alvo=(DB.insumos||[]).find(function(i){
          return String(i.nome||'').toLowerCase()===String(f.destinoNome).toLowerCase();})
        ||(DB.fichas||[]).find(function(x){
          return String(x.nome||'').toLowerCase()===String(f.destinoNome).toLowerCase();});
      if(alvo&&f.destinoId!==alvo.id){f.destinoId=alvo.id;n++;}
      return;
    }
    if(destinoDaFicha(f))return;
    /* massa/base não recebe o padrão do grupo: o destino dela é específico */
    if(/massa|base/i.test(f.nome||''))return;
    var c=catFicha(f.categoriaId);
    if(c&&c.destinoId){f.destinoId=c.destinoId;f.destinoNome=(itemEstoque(c.destinoId)||{}).nome||'';n++;return;}
    if(gv&&/gelato|açúcar|acucar|sorbet/i.test(f.nome)){
      f.destinoId=gv.id;f.destinoNome=gv.nome;f.destinoFator=f.destinoFator||1;n++;
    }
  });
  salvar();
  fecharModal();
  telaFichaTecnica();
  toast(n?n+' vínculo(s) corrigido(s).':'Nada a corrigir — todas as fichas já estão vinculadas.');
}
async function baixarEVincular(){
  if(!NUVEM.ligada){toast('Ligue a nuvem primeiro.');return;}
  toast('Baixando da nuvem...');
  try{ await baixarDaNuvem(true); }catch(e){ toast('Erro ao baixar: '+((e&&e.message)||'')); return; }
  baseMov();
  fecharModal();
  corrigirVinculos();
}
function editarSel(){if(!FT.sel){toast('Selecione um produto.');return;}modalFicha(FT.sel);}
async function excluirSel(){
  if(!FT.sel){toast('Selecione um produto.');return;}
  var f=DB.fichas.find(function(x){return x.id===FT.sel});
  var uso=(DB.produtos||[]).filter(function(p){return p.fichaId===f.id}).length;
  if(uso){toast('Vinculado a '+uso+' produto(s) do cardápio.');return;}
  if(!await pergunta('Excluir "'+f.nome+'"?'))return;
  /* ==========================================================
     A EXCLUSAO PRECISA CHEGAR NA NUVEM
     fichas_tecnicas esta no mapa com espelha:false — de proposito, para uma
     unidade nao apagar da nuvem o cadastro da rede que ela nem enxerga. So
     que isso valia tambem para quem PODE apagar: a ficha saia daqui, o
     download seguinte trazia de volta, e a pessoa apagava dez vezes sem
     entender por que voltava.
     Agora a exclusao vai direto na linha daquela ficha. Se a nuvem recusar,
     a ficha NAO some daqui — mentir que apagou e pior do que avisar que nao
     deu.
     ========================================================== */
  if(NUVEM.ligada&&NUVEM.loja){
    try{
      var alvo=encodeURIComponent(f.id);
      /* os ingredientes primeiro: sao filhos da ficha */
      var fc=await api('fichas_tecnicas?loja_id=eq.'+NUVEM.loja+
                       '&ref_local=eq.'+alvo+'&select=id');
      /* todas as linhas, nao so a primeira: se a ficha chegou a duplicar na
         nuvem, apagar uma so deixava a outra voltando no download */
      for(var _q=0;_q<((fc&&fc.length)||0);_q++){
        await api('ficha_itens?ficha_id=eq.'+fc[_q].id,'DELETE');
        await api('fichas_tecnicas?id=eq.'+fc[_q].id,'DELETE');
      }
    }catch(e){
      painelErro('Não consegui excluir na nuvem.',detalheErro(e));
      return;                       /* nao apaga aqui: continuaria voltando */
    }
  }
  DB.fichas=DB.fichas.filter(function(x){return x.id!==FT.sel});
  /* tira tambem do retrato, senao o espelhamento a considera "sumida" depois */
  try{ if(DB._uuid&&DB._uuid.fichas)delete DB._uuid.fichas[FT.sel];
       if(DB._snap)delete DB._snap['fichas.itens.'+FT.sel]; }
  catch(e2){ _quieto(e2,'excluirSel'); }
  FT.sel=null;salvar();telaFichaTecnica();toast('Excluído.');
}
function abrirComposicao(){
  if(!FT.sel){toast('Selecione um produto na lista.');return;}
  modalComposicao(FT.sel);
}
/* grupos e subgrupos */
function modalCatFicha(id){
  baseFicha();
  var c=id?catFicha(id):null;
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none">'+
  '<div class="fld2"><label>Nome do grupo *</label>'+
  '<input id="cfN" value="'+E(c?c.nome:'')+'" placeholder="ex: Produzido, Vendas"></div>'+
  '<div class="fld2" style="margin:0"><label>Destino da produção</label><select id="cfD">'+
   '<option value="">Nenhum — a produção não gera estoque</option>'+
   '<optgroup label="Ingredientes e insumos">'+
   (DB.insumos||[]).slice().sort(function(a,b){return a.nome.localeCompare(b.nome)}).map(function(i){
     return '<option value="'+i.id+'"'+(c&&c.destinoId===i.id?' selected':'')+'>'+E(i.nome)+'</option>'}).join('')+
   '</optgroup>'+
   '<optgroup label="Fichas técnicas">'+
   (DB.fichas||[]).slice().sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')}).map(function(x){
     return '<option value="'+x.id+'"'+(c&&c.destinoId===x.id?' selected':'')+'>'+E(x.nome)+'</option>'}).join('')+
   '</optgroup>'+
  '</select><div class="hint">Ao produzir qualquer ficha deste grupo, o estoque entra neste item. '+
  'Ex.: todos os sabores de gelato geram estoque em <b>Gelato Venda</b>.</div></div></div>'+
  /* mesmo defeito do grupo de ingredientes: nascia sem liberacao */
  blocoUnidades(c,'cfUn')+'</div>';
  modal(c?'Editar grupo':'Novo grupo',h,'Salvar',function(){
    var nome=$('cfN').value.trim();
    if(!nome){toast('Informe o nome.');return false;}
    var alvo;
    if(c){c.nome=nome;c.destinoId=$('cfD').value;alvo=c;}
    else{alvo={id:uid('fc'),nome:nome,paiId:'',subs:[],destinoId:$('cfD').value,sucursais:[]};
      DB.fichaCats.push(alvo);FT.abertas[alvo.id]=true;}
    lerUnidades('cfUn',alvo);
    salvar();telaFichaTecnica();return true;
  },'sm2');
}
async function excluirCatFicha(id){
  var q=(DB.fichas||[]).filter(function(f){return f.categoriaId===id}).length;
  if(q){toast('Este grupo tem '+q+' produto(s).');return;}
  var qs=subsDoGrupo(id).length;
  if(qs){toast('Este grupo tem '+qs+' subgrupo(s). Exclua-os primeiro.');return;}
  if(!await pergunta('Excluir o grupo?'))return;
  await excluirLinhaGrupoFicha(id);
}
function addSubFicha(cid){
  var inp=$('fsg-'+cid);var nome=(inp.value||'').trim();
  if(!nome){inp.focus();return;}
  if(subsDoGrupo(cid).some(function(x){return (x.nome||'').toLowerCase()===nome.toLowerCase()})){
    toast('Já existe um subgrupo com esse nome aqui.');return;}
  DB.fichaCats.push({id:uid('fs'),nome:nome,paiId:cid,subs:[],destinoId:'',sucursais:[]});
  normalizaGruposFicha();
  FT.abertas[cid]=true;salvar();telaFichaTecnica();
  var n2=$('fsg-'+cid);if(n2)n2.focus();
}
function renSubFicha(sid){
  var sg=catFicha(sid); if(!sg)return;
  var novo=prompt('Renomear subgrupo:',sg.nome);
  if(novo===null)return;novo=novo.trim();if(!novo)return;
  sg.nome=novo;normalizaGruposFicha();salvar();telaFichaTecnica();
}
async function delSubFicha(sid){
  var sg=catFicha(sid); if(!sg)return;
  var q=(DB.fichas||[]).filter(function(f){return f.subgrupoId===sid}).length;
  if(q){toast('Este subgrupo tem '+q+' produto(s).');return;}
  if(!await pergunta('Excluir "'+sg.nome+'"?'))return;
  await excluirLinhaGrupoFicha(sid);
}
/* ==========================================================
   EXCLUSAO PRECISA CHEGAR NA NUVEM
   ficha_grupos esta no mapa com espelha:false — apagar so aqui faz o
   download devolver a linha segundos depois, e a pessoa apaga dez vezes
   sem entender. Se a nuvem recusar, nao some daqui: mentir que apagou e
   pior do que avisar que nao deu.
   ========================================================== */
async function excluirLinhaGrupoFicha(id){
  if(NUVEM.ligada&&NUVEM.loja){
    try{
      await api('ficha_grupos?loja_id=eq.'+NUVEM.loja+
                '&ref_local=eq.'+encodeURIComponent(id),'DELETE');
    }catch(e){
      painelErro('Não consegui excluir na nuvem.',detalheErro(e));
      return false;
    }
  }
  DB.fichaCats=DB.fichaCats.filter(function(x){return x.id!==id}); declararExclusao('fichaCats',id); /* exclusao declarada: so isto autoriza apagar da nuvem (V201) */
  try{ if(DB._uuid&&DB._uuid.fichaCats)delete DB._uuid.fichaCats[id]; }
  catch(e2){ _quieto(e2,'excluirLinhaGrupoFicha'); }
  normalizaGruposFicha();
  salvar();telaFichaTecnica();
  return true;
}

/* ---------- CADASTRO ---------- */
function modalFicha(id){
  baseFicha();
  var f=id?DB.fichas.find(function(x){return x.id===id}):null;
  var subs=[];
  (DB.catfin||[]).forEach(function(p){(p.itens||[]).forEach(function(it){
    subs.push({id:it.id,nome:p.nome+' › '+it.nome});});});
  var c0=f?catFicha(f.categoriaId):null;
  var h='<div class="mdB">'+
  '<div class="abas2">'+
   '<button class="ab2 on" data-a="basicos" onclick="trocaAbaFicha(\'basicos\')">Dados básicos</button>'+
   '<button class="ab2" data-a="fiscal" onclick="trocaAbaFicha(\'fiscal\')">Fiscal</button></div>'+
  '<div id="abBasicos"><div class="blk" style="margin:0;max-width:none">'+
   '<div class="row3">'+
    '<div class="fld2" style="grid-column:span 2"><label>Nome do produto *</label>'+
     '<input id="ftN" value="'+E(f?f.nome:'')+'"></div>'+
    '<div class="fld2"><label>Código</label><input id="ftC" value="'+E(f?f.codigo:proxCodFicha())+'"></div></div>'+
   '<div class="row3">'+
    '<div class="fld2"><label>Unidade padrão *</label><select id="ftU">'+
     unidades().map(function(u){return '<option value="'+u.id+'"'+(f&&f.unidade===u.id?' selected':'')+'>'+u.n+'</option>'}).join('')+
    '</select></div>'+
    '<div class="fld2"><label>Grupo *</label><select id="ftG" onchange="trocaGrupoFicha()">'+
     '<option value="">Selecione</option>'+
     gruposFicha().map(function(c){return '<option value="'+c.id+'"'+(f&&f.categoriaId===c.id?' selected':'')+'>'+E(c.nome)+'</option>'}).join('')+
    '</select></div>'+
    '</div>'+
   '<div class="row3">'+
    '<div class="fld2" style="grid-column:span 2"><label>Subgrupo</label><select id="ftSg">'+
     '<option value="">— nenhum —</option>'+
     subsDoGrupo(f?f.categoriaId:'').map(function(sg){
       return '<option value="'+sg.id+'"'+(f&&f.subgrupoId===sg.id?' selected':'')+'>'+E(sg.nome)+'</option>'}).join('')+
    '</select><div class="hint">Os subgrupos são os da pasta escolhida acima. '+
    'Para criar um novo, use a árvore da tela de Ficha Técnica.</div></div>'+
    '</div>'+
   '</div>'+
   '<div class="blk" style="margin:9px 0 0;max-width:none"><h3>O que a produção gera</h3>'+
   '<div class="hint" style="margin-bottom:8px">Ao produzir, o estoque entra neste item — '+
   'sabor de gelato gera <b>Gelato Venda</b>, massa de cascão gera <b>Cascão</b>.</div>'+
   '<div class="row2">'+
    '<div class="fld2" style="margin:0"><label>Gerar estoque em</label><select id="ftDest">'+
     '<option value="">Usar o padrão do grupo'+
      ((catFicha(f?f.categoriaId:'')||{}).destinoId
        ? ' ('+E((insumo((catFicha(f.categoriaId)||{}).destinoId)||{}).nome||'')+')' : ' (nenhum)')+'</option>'+
     '<option value="__nenhum"'+(f&&f.destinoId==='__nenhum'?' selected':'')+'>Não gerar estoque</option>'+
     '<optgroup label="Ingredientes e insumos">'+
     (DB.insumos||[]).slice().sort(function(a,b){return a.nome.localeCompare(b.nome)}).map(function(i){
       return '<option value="'+i.id+'"'+(f&&f.destinoId===i.id?' selected':'')+'>'+E(i.nome)+'</option>'}).join('')+
     '</optgroup>'+
     '<optgroup label="Fichas técnicas">'+
     (DB.fichas||[]).filter(function(x){return !f||x.id!==f.id})
       .slice().sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')}).map(function(x){
       return '<option value="'+x.id+'"'+(f&&f.destinoId===x.id?' selected':'')+'>'+E(x.nome)+'</option>'}).join('')+
     '</optgroup>'+
    '</select></div>'+
    '<div class="fld2" style="margin:0"><label>Como converter</label>'+
     '<select id="ftModo" onchange="avisaFator()">'+
      '<option value="igual"'+(modoDestino(f||{})==='igual'?' selected':'')+'>'+
        'Mesma quantidade — 4,5 kg produzidos viram 4,5 kg</option>'+
      '<option value="receita"'+(modoDestino(f||{})==='receita'?' selected':'')+'>'+
        'A receita inteira gera N unidades</option>'+
     '</select>'+
     '<div id="boxFat" style="margin-top:8px">'+
      '<label>Quantas unidades a receita inteira gera</label>'+
      '<input id="ftFat" type="number" step="0.0001" value="'+(f?(f.destinoFator||1):1)+'" '+
      'oninput="avisaFator()">'+
     '</div>'+
     '<div class="hint" id="dicaFat"></div></div>'+
   '</div></div>'+
   '<div class="blk" style="margin:11px 0 0;max-width:none">'+
   '<label class="chkL"><input type="checkbox" id="ftEs" '+(!f||f.estocavel!==false?'checked':'')+'><span>Estocável</span></label>'+
   '<label class="chkL"><input type="checkbox" id="ftDv2" '+(f&&f.disponivelVenda?'checked':'')+'><span>Disponível para venda</span></label>'+
   /* ==========================================================
      NEM TODA FICHA DO GRUPO PRODUZIDO E UMA ORDEM DE PRODUCAO

      A base de gelato, a base da calda e o cascao assado saem junto de
      outra producao — nao se abre ordem para eles. Antes a tela de
      Producao listava tudo do grupo Produzido, e quem ia bater gelato
      tinha de achar o sabor no meio de 50 itens que nunca produz.
      A chave abaixo tira a ficha da lista sem apagar nada: ela continua
      existindo, com receita, custo e estoque.
      ========================================================== */
   '<label class="chkL"><input type="checkbox" id="ftProd" '+(!f||f.naProducao!==false?'checked':'')+'>'+
   '<span>Aparece na ordem de produção</span></label>'+
   '</div></div>'+
  '<div id="abFiscal" style="display:none">'+
   '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Dados fiscais</h3>'+
   '<div class="row3">'+
    '<div class="fld2"><label>NCM</label><input id="ftNc" value="'+E(f?f.ncm:'')+'"></div>'+
    '<div class="fld2"><label>CFOP</label><input id="ftCf" value="'+E(f?f.cfop:'')+'"></div>'+
    '<div class="fld2"><label>CEST</label><input id="ftCe" value="'+E(f?f.cest:'')+'"></div></div>'+
   '<div class="row3">'+
    '<div class="fld2" style="margin:0"><label>Origem</label><select id="ftOr">'+
     ['0 — Nacional','1 — Importação direta','2 — Mercado interno','3 — Nacional imp. >40%',
      '4 — Produção conforme processos','5 — Nacional imp. <40%'].map(function(o){
       return '<option'+(f&&f.origem===o?' selected':'')+'>'+o+'</option>'}).join('')+'</select></div>'+
    '<div class="fld2" style="margin:0"><label>CST / CSOSN</label><input id="ftCs" value="'+E(f?f.cst:'')+'"></div>'+
    '<div class="fld2" style="margin:0"><label>Alíquota (%)</label><input id="ftAl" type="number" step="0.01" value="'+(f?(f.aliquota||0):0)+'"></div>'+
   '</div></div>'+
   /* liberar a ficha para esta ou aquela unidade é decisão da matriz; o
      usuário de uma loja não vê nem mexe na lista de sucursais (e o que já
      estava liberado é preservado no salvar). */
   (vejoVariasUnidades()
    ?'<div class="blk" style="margin:0;max-width:none"><h3>Sucursais</h3>'+
     '<div class="contaGrid">'+sucursaisDoUsuario().map(function(l){
       var marc=f?((f.lojas||[]).indexOf(l.id)>=0):true;
       return '<label class="contaBox"><input type="checkbox" class="ftL" value="'+l.id+'"'+(marc?' checked':'')+'>'+
       '<span><b>'+E(l.nome)+'</b></span></label>';}).join('')+'</div></div>'
    :'')+
  '</div>'+
  blocoUnidades(f,'ftUn')+
  '</div>';
  modal(f?'Produto — edição':'Produto — inclusão',h,'Confirmar',function(){
    var nome=$('ftN').value.trim();
    if(!nome){toast('Informe o nome.');return false;}
    if(!$('ftG').value){toast('Selecione o grupo.');return false;}
    var ls=[];
    var cks=document.querySelectorAll('.ftL');
    if(cks.length){ for(var i=0;i<cks.length;i++)if(cks[i].checked)ls.push(cks[i].value); }
    else if(f){ ls=(f.lojas||[]).slice(); }   /* grid escondido (usuário de loja): preserva */
    var o={nome:nome,codigo:$('ftC').value.trim()||proxCodFicha(),unidade:$('ftU').value,
      categoriaId:$('ftG').value,
      /* subgrupo de outra pasta deixaria a ficha invisivel na arvore */
      subgrupoId:(function(){
        var v=$('ftSg')?$('ftSg').value:(f?f.subgrupoId||'':'');
        if(!v)return '';
        var sg=catFicha(v);
        return (sg&&sg.paiId===$('ftG').value)?v:'';
      })(),
      /* este saiu da tela: o que ja estava gravado e preservado */
      contaId:($('ftGc')?$('ftGc').value:(f?f.contaId||'':'')),
      estocavel:$('ftEs').checked,disponivelVenda:$('ftDv2').checked,
      naProducao:$('ftProd')?$('ftProd').checked:(f?f.naProducao!==false:true),
      ncm:$('ftNc').value.trim(),cfop:$('ftCf').value.trim(),cest:$('ftCe').value.trim(),
      origem:$('ftOr').value,cst:$('ftCs').value.trim(),aliquota:parseFloat($('ftAl').value)||0,lojas:ls,
      destinoId:$('ftDest')?$('ftDest').value:'',
      destinoModo:($('ftModo')||{}).value||'igual',
      destinoNome:(function(){var d=$('ftDest');if(!d)return '';
        var o=d.options[d.selectedIndex];return o?o.text:'';})(),
      destinoFator:parseFloat(($('ftFat')||{}).value)||1};
    var _novaBase=null;
    if(f)Object.assign(f,o);
    else{o.id=uid('fi');o.itens=[];o.rendimento=1;o.rendUnidade=o.unidade;DB.fichas.push(o);FT.sel=o.id;
      /* ficha chamada BASE <SABOR> ja entra no catalogo de pedido, vinculada.
         Mora no bloco 22 porque o catalogo e de la; aqui so se avisa que
         nasceu uma ficha. */
      if(typeof baseDeFichaNova==='function')_novaBase=baseDeFichaNova(o);}
    lerUnidades('ftUn',f||o);        /* quem enxerga esta ficha */
    FT.mostrar=true;FT.cat=o.categoriaId;FT.sub=o.subgrupoId||'';
    if(FT.cat)FT.abertas[FT.cat]=true;
    salvar();telaFichaTecnica();
    toast('Produto salvo em "'+E((catFicha(o.categoriaId)||{}).nome||'')+'".'+
      (_novaBase?' Base criada no pedido — falta pôr o preço.':''));
    return true;
  },'lg');
}
function avisaFator(){
  var d=$('dicaFat'); if(!d)return;
  var modo=($('ftModo')||{}).value||'igual';
  var bf=$('boxFat'); if(bf)bf.style.display=(modo==='receita')?'':'none';
  var rend=parseFloat(($('ftRend')||{}).value)||parseFloat(($('cpRend')||{}).value)||0;
  if(modo==='igual'){
    d.innerHTML='A quantidade produzida entra igual no destino. '+
      'É o caso dos sabores de gelato: produziu 4,5 kg, entram 4,5 kg de Gelato Venda.';
    return;
  }
  var n=parseFloat(($('ftFat')||{}).value)||0;
  d.innerHTML='<span class="avisoFat">'+sv('help',12)+
    ' A receita inteira gera <b>'+fmtQt(n)+'</b> unidade(s). '+
    'O sistema calcula proporcional: produzindo metade da receita, entram '+fmtQt(n/2)+'.<br>'+
    'O custo de cada unidade sai do custo da receita dividido por '+fmtQt(n)+'.</span>';
}
function trocaGrupoFicha(){
  if(!$('ftSg'))return;
  var ant=$('ftSg').value;
  var lst=subsDoGrupo($('ftG').value);
  $('ftSg').innerHTML='<option value="">— nenhum —</option>'+lst.map(function(s){
    return '<option value="'+s.id+'"'+(s.id===ant?' selected':'')+'>'+E(s.nome)+'</option>'}).join('');
}
function trocaAbaFicha(a){
  $('abBasicos').style.display=a==='basicos'?'':'none';
  $('abFiscal').style.display=a==='fiscal'?'':'none';
  var bs=document.querySelectorAll('.ab2');
  for(var i=0;i<bs.length;i++)bs[i].classList.toggle('on',bs[i].getAttribute('data-a')===a);
}

/* ---------- JANELA DA FICHA TÉCNICA (composição) ---------- */
var _fichaAberta=null,_abaComp='composicao',_buscaIns='',_secIns={material:true,insumo:true,produto:false};
function modalComposicao(id){
  baseFicha();
  /* rascunho e SEMPRE da ficha aberta agora. Sem isto, o modo de preparo
     digitado numa ficha e nao salvo apareceria na proxima que fosse aberta. */
  _rascFicha={};
  _fichaAberta=id;_abaComp='composicao';
  desenhaComp();
}
function telaComposicao(id){modalComposicao(id)}
/* ==========================================================
   O QUE FOI DIGITADO SOBREVIVE A TROCA DE ABA
   Receita e Composicao sao a MESMA janela redesenhada. Trocar de aba
   chamava desenhaComp() direto, e o desenho le os valores da ficha
   GRAVADA — entao tudo que estava digitado e ainda nao salvo era
   redesenhado por cima. A pessoa escrevia o modo de preparo, ia ver a
   composicao, voltava, e o texto tinha sumido.
   Pior: salvarComposicao() so le os campos que estao na tela naquele
   instante ('if($(...))'). Salvando pela aba Composicao, a receita
   digitada nem chegava a ser lida.
   Agora existe um rascunho: antes de qualquer redesenho os campos sao
   colhidos, e o desenho prefere o rascunho ao valor gravado. Cancelar
   descarta o rascunho — nada e escrito na ficha antes do Salvar.
   ========================================================== */
var _rascFicha={};
function colherCamposFicha(){
  var C={cpPreco:'preco',cpRend:'rendimento',cpRendU:'rendUnidade',
         cpUnVenda:'unidadesVenda',cpReceita:'receita',cpTempo:'tempo',
         cpVal:'validade',cpTemp:'temperatura',cpObs:'obs'};
  for(var id in C){ var el=$(id); if(el)_rascFicha[C[id]]=el.value; }
}
/* valor a exibir: o que a pessoa digitou vence o que esta gravado */
function vFicha(f,campo,padrao){
  if(_rascFicha[campo]!==undefined&&_rascFicha[campo]!=='')return _rascFicha[campo];
  if(_rascFicha[campo]==='')return '';
  var v=f?f[campo]:undefined;
  return (v===undefined||v===null)?(padrao===undefined?'':padrao):v;
}
function trocarAbaComp(a){ colherCamposFicha(); _abaComp=a; desenhaComp(); }
function desenhaComp(){
  try{
    var _f0=DB.fichas.find(function(x){return x.id===_fichaAberta});
    if(_f0)_rastroFicha('desenhou a tela', _f0, (_f0.itens||[]).length);
  }catch(e){ _quieto(e,'desenhaComp'); }
  var f=DB.fichas.find(function(x){return x.id===_fichaAberta});
  if(!f)return;
  var custo=custoFicha(f);
  var rend=Number(f.rendimento)||0;
  var cUn=custoPorUnidade(f);
  var preco=Number(f.preco)||0;
  var margem=preco?((preco-custoPorVenda(f))/preco*100):-100;

  var q=_buscaIns.toLowerCase();
  /* ingredientes = insumos + as outras fichas técnicas (bases, massas...) */
  var listaIns=(DB.insumos||[]).map(function(i){
      return {id:i.id,codigo:i.codigo,nome:i.nome,unidade:i.unidade,tipo:'insumo'};
    })
    .concat((DB.fichas||[]).filter(function(f){return f.id!==_fichaAberta})
      .map(function(f){
        return {id:f.id,codigo:f.codigo,nome:f.nome,unidade:f.rendUnidade||f.unidade,tipo:'ficha'};
      }))
    .filter(function(i){
      return !q||(i.nome||'').toLowerCase().indexOf(q)>=0||String(i.codigo||'').indexOf(q)>=0;
    }).sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')});

  var corpo;
  if(_abaComp==='receita'){
    corpo='<div class="fmReceita">'+
     '<div class="fmRcEsq">'+
      '<label class="fmLb">Modo de preparo</label>'+
      '<textarea id="cpReceita" placeholder="1. Higienizar a fruta&#10;2. Bater por 8 minutos...">'+E(vFicha(f,'receita',''))+'</textarea>'+
      '<div class="row3" style="margin-top:10px">'+
       '<div class="fld2" style="margin:0"><label>Tempo (min)</label><input id="cpTempo" type="number" value="'+E(vFicha(f,'tempo',0))+'"></div>'+
       '<div class="fld2" style="margin:0"><label>Validade (dias)</label><input id="cpVal" type="number" value="'+E(vFicha(f,'validade',0))+'"></div>'+
       '<div class="fld2" style="margin:0"><label>Armazenamento</label><input id="cpTemp" value="'+E(vFicha(f,'temperatura',''))+'" placeholder="-18°C"></div>'+
      '</div>'+
      '<div class="fld2" style="margin:10px 0 0"><label>Observações</label><input id="cpObs" value="'+E(vFicha(f,'obs',''))+'"></div>'+
     '</div>'+
     '<div class="fmRcDir">'+
      '<label class="fmLb">Foto do produto</label>'+
      '<div class="fmFoto" onclick="trocarFotoFicha()">'+
       (f.foto?'<img src="'+f.foto+'">':'<div class="fhVazia">'+sv('img',22)+'<span>clique para adicionar</span></div>')+
      '</div>'+
      (f.foto?'<button class="btnP2 rdB" style="width:100%;justify-content:center;margin-top:7px" onclick="removerFotoFicha()">Remover foto</button>':'')+
     '</div></div>';
  }else{
    corpo='<div class="fmBody">'+
     '<div class="fmEsq">'+
      '<div class="fmLoc"><label>Localizar:</label>'+
       '<input id="insB" value="'+E(_buscaIns)+'" placeholder=""></div>'+
      '<div class="fmSecs"><table class="insTab"><tbody>'+
       (listaIns.length?listaIns.map(function(i){
         return '<tr draggable="true" data-id="'+i.id+'" class="insLin" ondblclick="addItemFicha(\''+i.id+'\')" '+
         'title="R$ '+money(custoAtual(i))+' / '+un(i.unidade).ab+'">'+
         '<td class="cCod">'+E(i.codigo)+'</td>'+
         '<td>'+E(i.nome)+(i.tipo==='ficha'?'<span class="tagFicha">ficha</span>':'')+'</td>'+
         '<td class="cUn">'+un(i.unidade).ab+'</td></tr>';
       }).join('')
       :'<tr><td colspan="3" class="semIns">Nenhum ingrediente cadastrado.<br>'+
        'Cadastre em Gestão de Estoque › Ingredientes e Insumos.</td></tr>')+
      '</tbody></table></div>'+
     '</div>'+
     '<div class="fmDir" id="dropZona">'+
      '<table class="fmTab"><thead><tr>'+
       '<th style="width:30px"></th><th style="width:82px">Código</th><th>Mercadoria</th>'+
       '<th style="width:76px;text-align:right">QTD</th>'+
       '<th style="width:88px">Unidade</th>'+
       '<th style="width:70px;text-align:right">Perda</th>'+
       '<th style="width:110px;text-align:right">Custo/Unidade</th>'+
       '<th style="width:100px;text-align:right">Custo Un.</th>'+
       '<th style="width:96px;text-align:right">Custo Médio</th></tr></thead><tbody>'+
      ((f.itens||[]).length?f.itens.map(function(it,k){
        var i2=itemComp(it.insumoId)||{};
        var ci=custoItem(it);
        var uu=un(i2.unidade||'un');
        return '<tr>'+
        '<td><button class="xDel" onclick="remItemFicha('+k+')" title="Remover">'+sv('x2',10)+'</button></td>'+
        '<td>'+E(i2.codigo||'—')+'</td><td>'+E(i2.nome||'item removido')+'</td>'+
        '<td style="text-align:right"><input class="itQ" data-k="'+k+'" type="number" step="0.001" value="'+it.qtd+'"></td>'+
        '<td><select class="itU" data-k="'+k+'">'+
         unidades().filter(function(u){return !i2.unidade||u.base===uu.base}).map(function(u){
           return '<option value="'+u.id+'"'+(it.unidade===u.id?' selected':'')+'>'+u.n.toLowerCase()+'</option>'}).join('')+
        '</select></td>'+
        '<td style="text-align:right"><input class="itP" data-k="'+k+'" type="number" step="0.1" value="'+(it.perda||0)+'"></td>'+
        '<td style="text-align:right">'+money(i2.custo||0)+' / '+uu.ab+'</td>'+
        '<td style="text-align:right">'+(convUnid(1,it.unidade,i2.unidade||'un')!==null
          ? money(convUnid(1,it.unidade,i2.unidade||'un')*(i2.custo||0))+' / '+un(it.unidade).ab : '—')+'</td>'+
        '<td style="text-align:right"><b>'+money(ci)+'</b></td></tr>';
      }).join('')
      :'<tr><td colspan="9" class="fmVazio">'+sv('box',22)+
       '<b>Arraste os itens da lista ao lado</b><span>ou clique duas vezes no item</span></td></tr>')+
      '</tbody></table></div></div>';
  }

  /* usuário de unidade: a ficha é sempre a da PRÓPRIA loja — nunca a de
     outra. Sem seletor, o custo/estoque mostrado é o da unidade dele. */
  if(!vejoVariasUnidades()){
    var _minhas=sucursaisDoUsuario();
    if(_minhas.length&&(!FT.loja||!_minhas.some(function(s){return s.id===FT.loja})))
      FT.loja=_minhas[0].id;
  }
  var html='<div class="fichaMod">'+
   '<div class="fmH"><b>Ficha Técnica</b><button onclick="fecharComp()">&times;</button></div>'+
   '<div class="fmBar">'+
    '<button class="fmAba'+(_abaComp==='receita'?' on':'')+'" onclick="trocarAbaComp(\'receita\')">'+
     sv('book',15)+' Receita</button>'+
    '<button class="fmAba'+(_abaComp==='composicao'?' on':'')+'" onclick="trocarAbaComp(\'composicao\')">'+
     sv('box',15)+' Composição</button>'+
    '<div class="tSep2"></div>'+
    '<button class="btnP2" onclick="fecharComp()">Cancelar</button>'+
    '<button class="btnP2 ok" onclick="salvarComposicao()">Salvar</button>'+
    /* ==========================================================
       O USUÁRIO DE UMA LOJA NÃO VÊ (NEM ESCOLHE) OUTRA SUCURSAL

       03/09/2026. Logado em Santa Fé, a Ficha Técnica mostrava o seletor de
       Sucursais e deixava abrir a de Alphaville. O seletor só existe para
       quem tem visão multiunidade (matriz/dono); o usuário de unidade fica
       preso à própria loja — e as opções, mesmo para a matriz, saem de
       `sucursaisDoUsuario()`, nunca da lista de todas as lojas. */
    (vejoVariasUnidades()
     ?'<div class="fmSuc"><label>Sucursais</label><select onchange="FT.loja=this.value">'+
       sucursaisDoUsuario().map(function(l){return '<option value="'+l.id+'"'+(FT.loja===l.id?' selected':'')+'>'+E(l.nome)+'</option>'}).join('')+
      '</select></div>'
     :'')+
    '<button class="btnP2" onclick="imprimirFicha(\''+f.id+'\')">Imprimir</button>'+
   '</div>'+
   '<div class="fmTopo">'+
    '<div class="fmC"><label>Produto</label><div class="fmVal nm">'+E(f.nome)+'</div></div>'+
    '<div class="fmC"><label>Custo Total</label><div class="fmVal num">'+money(custo)+'</div></div>'+
    (function(){
      /* preço da unidade de rendimento: custo total dividido pelo peso da receita */
      var rr=Number(f.rendimento)||0;
      var ab=un(f.rendUnidade||f.unidade).ab||'';
      return '<div class="fmC"><label>Preço do '+E(ab||'Kg')+'</label>'+
        '<div class="fmVal num dest">'+(rr>0?'R$ '+money(custo/rr):'—')+'</div></div>';
    })()+
   '</div>'+
   '<div class="fmMid">'+
    '<div class="fmBox"><div class="fmBoxT">Rendimento</div>'+
     '<div class="fmBoxB"><input id="cpRend" type="number" step="0.001" value="'+E(vFicha(f,'rendimento',rend))+'">'+
     '<select id="cpRendU">'+unidades().map(function(u){
       return '<option value="'+u.id+'"'+(String(vFicha(f,'rendUnidade',f.unidade))===u.id?' selected':'')+'>'+u.n+'</option>'}).join('')+
     '</select></div></div>'+
    '<div class="fmBox"><div class="fmBoxT">Custo Porção / Unid. Venda</div>'+
     '<div class="fmBoxB"><div class="fmRO">'+money(custoPorVenda(f))+'</div></div></div>'+
    '<div class="fmBox"><div class="fmBoxT">Quantas unidades de venda rendem uma receita?</div>'+
     '<div class="fmBoxB"><input id="cpUnVenda" type="number" step="0.001" value="'+E(vFicha(f,'unidadesVenda',f.unidadesVenda||rend))+'">'+
     '<div class="fmRO sm">Unidade</div></div></div>'+
    '<div class="fmBox"><div class="fmBoxT">Qtd Porção / Unid. Venda</div>'+
     '<div class="fmBoxB"><div class="fmRO">'+
      (f.unidadesVenda?fmtQt(rend/Number(f.unidadesVenda)):fmtQt(rend))+' / '+un(f.rendUnidade||f.unidade).n+
     '</div></div></div>'+
   '</div>'+
   corpo+
  '</div>';

  var o=document.getElementById('mdOv');if(o)o.remove();
  var ov=document.createElement('div');ov.className='mdOv fichaOv';ov.id='mdOv';
  ov.innerHTML=html;
  document.body.appendChild(ov);
  if($('insB')){
    $('insB').oninput=function(){_buscaIns=this.value;var p=this.selectionStart;desenhaComp();
      var n2=$('insB');if(n2){n2.focus();n2.setSelectionRange(p,p);}};
  }
  ligarArrasteFicha();ligarCamposComp();
}
function fecharComp(){
  _rascFicha={};                 /* cancelar descarta o que foi digitado */
  _fichaAberta=null;             /* libera o download, que fica parado com a ficha aberta */
  var o=document.getElementById('mdOv');if(o)o.remove();
  telaFichaTecnica();
}
function ligarCamposComp(){
  function liga(cls,campo){
    var e2=document.querySelectorAll(cls);
    for(var i=0;i<e2.length;i++)e2[i].onchange=function(){
      var f=DB.fichas.find(function(x){return x.id===_fichaAberta});
      var v=this.value;
      f.itens[this.getAttribute('data-k')][campo]=(campo==='unidade')?v:(parseFloat(v)||0);
      salvar();desenhaComp();
    };
  }
  liga('.itQ','qtd');liga('.itU','unidade');liga('.itP','perda');
}
function ligarArrasteFicha(){
  var its=document.querySelectorAll('.insLin');
  for(var i=0;i<its.length;i++){
    its[i].ondragstart=function(e){
      e.dataTransfer.setData('text/plain',this.getAttribute('data-id'));
      this.classList.add('arrastando');};
    its[i].ondragend=function(){this.classList.remove('arrastando')};
  }
  var z=$('dropZona');
  if(z){
    z.ondragover=function(e){e.preventDefault();this.classList.add('over2')};
    z.ondragleave=function(){this.classList.remove('over2')};
    z.ondrop=function(e){e.preventDefault();this.classList.remove('over2');
      var id=e.dataTransfer.getData('text/plain');
      if(id)addItemFicha(id);};
  }
}
function addItemFicha(insumoId){
  var ins=itemComp(insumoId);
  if(!ins)return;
  var base=un(ins.unidade).base;
  var opts=unidades().filter(function(u){return u.base===base});
  var h='<div class="qtdCx">'+
   '<div class="qtdT">'+E(ins.nome)+(ins.tipo==='ficha'?' <small>(ficha técnica)</small>':'')+'</div>'+
   '<div class="qtdL"><label>Quantidade</label>'+
    '<input id="qiQ" type="number" step="0.001" value="1"></div>'+
   '<div class="qtdL"><label>Unidade</label><select id="qiU">'+
    opts.map(function(u){return '<option value="'+u.id+'"'+(u.id===ins.unidade?' selected':'')+'>'+u.n+'</option>'}).join('')+
   '</select></div>'+
   '<div class="qtdL"><label>Perda %</label>'+
    '<input id="qiP" type="number" step="0.1" value="0"></div>'+
   '<div class="qtdC" id="qiPrev">Custo: R$ 0,00</div>'+
   '<div class="qtdB"><button class="btnP2" onclick="fecharQtd()">Cancelar</button>'+
    '<button class="btnP2 ok" onclick="confirmarQtd(\''+insumoId+'\')">Ok</button></div>'+
  '</div>';
  var ov=document.createElement('div');ov.className='mdOv qtdOv';ov.id='mdOv2';
  ov.innerHTML=h;
  document.body.appendChild(ov);
  function prev(){
    var c=custoItem({insumoId:insumoId,qtd:parseFloat($('qiQ').value)||0,
      unidade:$('qiU').value,perda:parseFloat($('qiP').value)||0});
    $('qiPrev').textContent='Custo: R$ '+money(c);
  }
  $('qiQ').oninput=prev;$('qiU').onchange=prev;$('qiP').oninput=prev;prev();
  $('qiQ').onkeydown=function(e){if(e.key==='Enter')confirmarQtd(insumoId)};
  setTimeout(function(){var n2=$('qiQ');if(n2){n2.focus();n2.select();}},50);
}
function fecharQtd(){var o=document.getElementById('mdOv2');if(o)o.remove();}
var _ultimoRastro={id:null,n:0,ids:''};
function _rastroFicha(oque, f, antes){
  try{
    var ids=(f.itens||[]).map(function(o){return (o.id||'?')+':'+(o.insumoId||'?')}).join(' | ');
    var n=(f.itens||[]).length;
    var alerta='';
    if(_ultimoRastro.id===f.id && n<_ultimoRastro.n)
      alerta=' <<< PERDEU ITEM (tinha '+_ultimoRastro.n+')';
    if(console&&console.log)
      console.log('[ficha] '+oque+' — antes '+antes+', agora '+n+alerta+
        '\n         '+ids);
    /* quem apagou? o rastro dizia QUE sumiu, nunca QUEM. O console.trace
       imprime a cadeia de chamadas ate aqui — e ela nomeia a funcao. */
    if(alerta&&console&&console.trace)console.trace('[ficha] quem mexeu na lista');
    _ultimoRastro={id:f.id,n:n,ids:ids};
  }catch(e){ _quieto(e,'rastroFicha'); }
}
function confirmarQtd(insumoId){
  var q=parseFloat($('qiQ').value)||0;
  if(q<=0){toast('Informe a quantidade.');return;}
  var f=DB.fichas.find(function(x){return x.id===_fichaAberta});
  if(!f)return;
  /* ==========================================================
     AVISO, NAO PROIBICAO

     Eu tinha BLOQUEADO o caso em que o ingrediente e o mesmo item que a
     ficha produz, achando que so podia ser engano. Nao e: a base comprada
     pronta e a base produzida costumam ter o MESMO NOME — uma e insumo, a
     outra e ficha — e uma entra de verdade na receita da outra.
     Quem cadastra sabe o que esta fazendo. O sistema avisa quando o item
     e literalmente o mesmo registro (o que faria o estoque girar em
     circulo) e deixa seguir.
     ========================================================== */
  var _dest=(typeof destinoDaFicha==='function')?destinoDaFicha(f):null;
  if(insumoId===f.id||(_dest&&(_dest.id||_dest)===insumoId))
    toast('Atenção: este é o mesmo item que a ficha gera. Confira o estoque depois de produzir.');
  /* dois lançamentos do mesmo ingrediente viram um só: somam a quantidade */
  var _ja=(f.itens||[]).find(function(o){
    return o.insumoId===insumoId&&o.unidade===$('qiU').value; });
  if(_ja){
    _ja.qtd=(Number(_ja.qtd)||0)+q;
    _ja.perda=parseFloat($('qiP').value)||0;
    salvar();fecharQtd();desenhaComp();
    toast('Já havia este ingrediente — a quantidade foi somada.');
    return;
  }
  f.itens=f.itens||[];
  /* id proprio desde o nascimento: e ele que amarra o item na nuvem */
  var _antes=(f.itens||[]).length;
  f.itens.push({id:uid('fit'),insumoId:insumoId,qtd:q,
    unidade:$('qiU').value,perda:parseFloat($('qiP').value)||0});
  /* ==========================================================
     RASTRO DA COMPOSICAO
     O ingrediente some ao adicionar o terceiro e eu nao consigo reproduzir
     daqui. Este rastro diz, no Console, quantos itens havia antes e depois
     de cada acao, e se a lista mudou sozinha entre uma e outra. Sai assim
     que a causa aparecer.
     ========================================================== */
  _rastroFicha('adicionou '+insumoId, f, _antes);
  salvar();fecharQtd();desenhaComp();
}
function remItemFicha(k){
  var f=DB.fichas.find(function(x){return x.id===_fichaAberta});
  f.itens.splice(k,1);salvar();desenhaComp();
}
function trocarFotoFicha(){
  var inp=document.createElement('input');
  inp.type='file';inp.accept='image/*';
  inp.onchange=function(){
    var file=inp.files[0];if(!file)return;
    var r=new FileReader();
    r.onload=function(){
      var img=new Image();
      img.onload=function(){
        var c=document.createElement('canvas');
        var max=480,esc=Math.min(1,max/Math.max(img.width,img.height));
        c.width=img.width*esc;c.height=img.height*esc;
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        var f=DB.fichas.find(function(x){return x.id===_fichaAberta});
        f.foto=c.toDataURL('image/jpeg',0.8);
        salvar();desenhaComp();
      };
      img.src=r.result;
    };
    r.readAsDataURL(file);
  };
  inp.click();
}
function removerFotoFicha(){
  var f=DB.fichas.find(function(x){return x.id===_fichaAberta});
  f.foto='';salvar();desenhaComp();
}
/* ==========================================================
   OS INGREDIENTES SAO GRAVADOS NA HORA, PELA PROPRIA TELA

   Ate aqui esta tela dependia do motor de sincronizacao: guardava na
   memoria, marcava pendente, e torcia para o envio em lote dar certo mais
   tarde. Entre uma coisa e outra havia retrato, impressao, espelhamento,
   tempo real e download — e bastava um deles falhar para o ingrediente
   desaparecer sem nenhum erro na tela.
   Composicao de ficha e um punhado de linhas. Nao precisa de nada disso:
   grava direto, confere o que a nuvem respondeu e DIZ se deu certo. Se a
   nuvem recusar, a pessoa fica sabendo na hora, com o motivo.
   ========================================================== */
async function gravarItensFichaAgora(f){
  if(!NUVEM.ligada||!NUVEM.loja)return {ok:true,local:true};
  var itens=(f.itens||[]).filter(function(o){return o&&o.insumoId});
  /* 1. o identificador que a nuvem deu para esta ficha */
  var fc=await api('fichas_tecnicas?loja_id=eq.'+NUVEM.loja+
                   '&ref_local=eq.'+encodeURIComponent(f.id)+'&select=id');
  if(!Array.isArray(fc)||!fc.length)
    return {ok:false,motivo:'a ficha ainda não existe na nuvem'};
  var pai=fc[0].id;
  /* o mapa que traduz "ins_xxx" para o identificador da nuvem pode estar vazio
     se ainda nao houve sincronizacao nesta sessao — monta antes de precisar */
  try{ await montarMapaVinculos(NUVEM.loja,false); }
  catch(e){ _quieto(e,'gravarItensFicha'); }
  /* 2. cada item com identificador proprio e estavel */
  var refs=[];
  var linhas=itens.map(function(o){
    if(!o.id)o.id=uid('fit');
    refs.push(String(o.id));
    var ehF=_ehFichaLocal(o.insumoId);
    return {ref_local:String(o.id),ficha_id:pai,
      insumo_id:ehF?null:(_ids[o.insumoId]||null),
      ficha_ref:ehF?(_ids[o.insumoId]||null):null,
      quantidade:Number(o.qtd)||0,unidade:o.unidade||'un',
      perda:Number(o.perda)||0};
  });
  var semVinculo=linhas.filter(function(y){return !y.insumo_id&&!y.ficha_ref});
  if(semVinculo.length)
    return {ok:false,motivo:semVinculo.length+' ingrediente(s) ainda não '+
      'existem na nuvem — sincronize os ingredientes antes'};
  var gravadas=[];
  if(linhas.length){
    gravadas=await api('ficha_itens?on_conflict=ref_local','POST',linhas,
      {'Prefer':'resolution=merge-duplicates,return=representation'});
    if(!Array.isArray(gravadas)||gravadas.length!==linhas.length)
      return {ok:false,motivo:'a nuvem aceitou '+
        ((gravadas&&gravadas.length)||0)+' de '+linhas.length+' ingrediente(s)'};
  }
  /* 3. o que nao esta na tela sai da nuvem */
  var qDel='ficha_itens?ficha_id=eq.'+pai;
  if(refs.length)qDel+='&ref_local=not.in.('+refs.map(function(r){
    return '"'+String(r).replace(/"/g,'')+'"'}).join(',')+')';
  await api(qDel,'DELETE');
  /* 4. o retrato passa a bater com a nuvem, senao o motor de sincronizacao
        acha que estes itens sumiram e os apaga na proxima passagem */
  try{ DB._snap=DB._snap||{}; DB._snap['fichas.itens.'+f.id]=refs.slice(); }
  catch(e){ _quieto(e,'gravarItensFicha'); }
  return {ok:true,n:linhas.length};
}
async function salvarComposicao(){
  var f=DB.fichas.find(function(x){return x.id===_fichaAberta});
  if(!f)return;
  /* colhe o que esta na tela AGORA e junta ao que foi digitado nas outras
     abas. Antes so os campos visiveis eram lidos: salvar estando na
     Composicao descartava a receita digitada. */
  colherCamposFicha();
  var R=_rascFicha;
  if(R.preco!==undefined)        f.preco=parseFloat(R.preco)||0;
  if(R.rendimento!==undefined)   f.rendimento=parseFloat(R.rendimento)||1;
  if(R.rendUnidade!==undefined)  f.rendUnidade=R.rendUnidade;
  if(R.unidadesVenda!==undefined)f.unidadesVenda=parseFloat(R.unidadesVenda)||0;
  if(R.receita!==undefined)      f.receita=R.receita;
  if(R.tempo!==undefined)        f.tempo=parseInt(R.tempo)||0;
  if(R.validade!==undefined)     f.validade=parseInt(R.validade)||0;
  if(R.temperatura!==undefined)  f.temperatura=R.temperatura;
  if(R.obs!==undefined)          f.obs=R.obs;
  _rascFicha={};
  salvar();
  var c=custoFicha(f);
  var r=null;
  try{ r=await gravarItensFichaAgora(f); }
  catch(e){ r={ok:false,motivo:detalheErro?detalheErro(e):((e&&e.message)||'falha')}; }
  if(r&&!r.ok){
    /* nao fecha a janela: o trabalho continua na tela e a pessoa sabe por que */
    painelErro('Não consegui gravar os ingredientes na nuvem.',
      (r.motivo||'')+'\n\nO que está na tela continua aqui. '+
      'Corrija e clique em Salvar de novo.');
    return;
  }
  fecharComp();
  toast('Ficha salva'+(r&&r.n!==undefined?' — '+r.n+' ingrediente(s) na nuvem':'')+
    '. Custo total R$ '+money(c));
}
function imprimirFicha(id){
  var f=DB.fichas.find(function(x){return x.id===id});
  var custo=custoFicha(f);
  var el=document.getElementById('viaImp')||document.createElement('div');
  el.id='viaImp';
  el.innerHTML=
  '<div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px">'+
   '<b style="font-size:15px">FICHA TÉCNICA</b><br>'+E(f.nome)+'</div>'+
  (f.foto?'<div style="text-align:center;margin-bottom:8px"><img src="'+f.foto+'" style="max-width:170px"></div>':'')+
  '<table style="width:100%;font-size:11px;margin-bottom:8px">'+
   '<tr><td><b>Código:</b> '+E(f.codigo)+'</td><td><b>Grupo:</b> '+E((catFicha(f.categoriaId)||{}).nome||'—')+'</td></tr>'+
   '<tr><td><b>Rendimento:</b> '+fmtQt(f.rendimento)+' '+un(f.rendUnidade||f.unidade).n+'</td>'+
   '<td><b>Un. venda:</b> '+fmtQt(f.unidadesVenda||f.rendimento)+'</td></tr></table>'+
  '<table style="width:100%;font-size:11px;border-collapse:collapse">'+
   '<tr style="border-bottom:1px solid #000"><th align="left">Mercadoria</th><th align="right">Qtd</th>'+
   '<th align="right">Perda</th><th align="right">Custo</th></tr>'+
   (f.itens||[]).map(function(it){
     var i2=insumo(it.insumoId)||{};
     return '<tr><td>'+E(i2.nome||'')+'</td><td align="right">'+fmtQt(it.qtd)+' '+un(it.unidade).ab+'</td>'+
     '<td align="right">'+(it.perda||0)+'%</td><td align="right">'+money(custoItem(it))+'</td></tr>';
   }).join('')+
   '<tr style="border-top:1px solid #000"><td colspan="3"><b>CUSTO TOTAL</b></td>'+
   '<td align="right"><b>R$ '+money(custo)+'</b></td></tr></table>'+
  '<div style="font-size:11px;margin-top:6px"><b>Custo por unidade de venda:</b> R$ '+money(custoPorVenda(f))+
   (f.preco?' · <b>CMV:</b> '+(custoPorVenda(f)/f.preco*100).toFixed(1)+'%':'')+'</div>'+
  (f.receita?'<div style="margin-top:8px"><b style="font-size:12px">MODO DE PREPARO</b>'+
   '<div style="font-size:11px;white-space:pre-wrap">'+E(f.receita)+'</div></div>':'');
  document.body.appendChild(el);
  setTimeout(function(){window.print()},200);
}

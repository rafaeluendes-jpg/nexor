/* ==========================================================
   IMPORTACAO POR AREA
   Um campo unico que engolia tudo obrigava o sistema a adivinhar o
   que era ficha e o que era insumo — e adivinhar e onde ele erra.
   Agora cada area tem a sua porta, com as colunas que ela espera.

   Aceita planilha salva como CSV, que e o que sai de qualquer
   sistema. Nada e aplicado sem voce ver antes o que vai entrar.
   ========================================================== */
var IMPC={area:'insumos',linhas:null,cols:[],mapa:{},arquivo:'',erros:[],modo:'somar'};

var AREAS_IMP=[
 {id:'insumos', n:'Ingredientes e mercadorias', ic:'box',
  d:'nome, unidade, custo e estoque de cada item',
  campos:[
   {k:'nome',    n:'Nome',            obr:true,  ex:'Açúcar refinado'},
   {k:'grupo',   n:'Grupo',           obr:false, ex:'Secos'},
   {k:'unidade', n:'Unidade',         obr:true,  ex:'kg'},
   {k:'custo',   n:'Custo unitário',  obr:false, ex:'4,50'},
   {k:'estoque', n:'Estoque atual',   obr:false, ex:'120'},
   {k:'minimo',  n:'Estoque mínimo',  obr:false, ex:'20'},
   {k:'codigo',  n:'Código',          obr:false, ex:'INS-001'}]},
 {id:'fichas',  n:'Fichas técnicas', ic:'book',
  d:'uma linha por ingrediente da ficha — o sistema agrupa pelo nome',
  campos:[
   {k:'ficha',     n:'Nome da ficha',      obr:true,  ex:'Gelato de creme'},
   {k:'rendimento',n:'Rendimento',         obr:false, ex:'5'},
   {k:'unidRend',  n:'Unidade do rendimento',obr:false,ex:'kg'},
   {k:'item',      n:'Ingrediente',        obr:true,  ex:'Leite integral'},
   {k:'qtd',       n:'Quantidade',         obr:true,  ex:'2,5'},
   {k:'unidade',   n:'Unidade',            obr:false, ex:'L'},
   {k:'preparo',   n:'Modo de preparo',    obr:false, ex:'Bater por 8 min'}]},
 {id:'fornec',  n:'Fornecedores', ic:'tri',
  d:'empresa, contato e documento',
  campos:[
   {k:'empresa', n:'Empresa',  obr:true,  ex:'Lacto Nutri'},
   {k:'contato', n:'Contato',  obr:false, ex:'Marcos'},
   {k:'cnpj',    n:'CNPJ',     obr:false, ex:'12.345.678/0001-90'},
   {k:'tel',     n:'Telefone', obr:false, ex:'(17) 99999-0000'},
   {k:'email',   n:'E-mail',   obr:false, ex:'contato@lacto.com'}]}
];
function areaImp(){return AREAS_IMP.find(function(a){return a.id===IMPC.area})||AREAS_IMP[0]}

/* ---------- leitura do CSV ----------
   Separador vem diferente conforme quem exportou: ponto e virgula no
   Excel brasileiro, virgula no resto. Descobrimos pela primeira linha. */
function separadorDe(txt){
  var l=txt.split(/\r?\n/)[0]||'';
  var pv=(l.match(/;/g)||[]).length, vg=(l.match(/,/g)||[]).length, tb=(l.match(/\t/g)||[]).length;
  if(tb>pv&&tb>vg)return '\t';
  return pv>=vg?';':',';
}
function lerCSV(txt){
  var sep=separadorDe(txt), linhas=[], atual=[], campo='', aspas=false;
  for(var i=0;i<txt.length;i++){
    var c=txt[i];
    if(aspas){
      if(c==='"'&&txt[i+1]==='"'){campo+='"';i++;}
      else if(c==='"')aspas=false;
      else campo+=c;
    }else{
      if(c==='"')aspas=true;
      else if(c===sep){atual.push(campo);campo='';}
      else if(c==='\n'){atual.push(campo);linhas.push(atual);atual=[];campo='';}
      else if(c!=='\r')campo+=c;
    }
  }
  if(campo!==''||atual.length){atual.push(campo);linhas.push(atual);}
  return linhas.filter(function(l){return l.some(function(x){return String(x).trim()!==''})});
}
/* numero brasileiro: 1.234,56 */
function numBR(t){
  if(t===undefined||t===null)return 0;
  var s=String(t).replace(/[^\d,.\-]/g,'').trim();
  if(!s)return 0;
  if(s.indexOf(',')>=0)s=s.replace(/\./g,'').replace(',','.');
  return Number(s)||0;
}
/* tenta casar sozinho o cabeçalho da planilha com os campos esperados */
function adivinharMapa(cols){
  var m={},usados={};
  areaImp().campos.forEach(function(cp){
    var alvo=cp.n.toLowerCase(), chave=cp.k.toLowerCase();
    for(var i=0;i<cols.length;i++){
      if(usados[i])continue;
      var c=String(cols[i]||'').toLowerCase().trim()
        .replace(/[áàâã]/g,'a').replace(/[éê]/g,'e').replace(/í/g,'i')
        .replace(/[óôõ]/g,'o').replace(/ú/g,'u').replace(/ç/g,'c');
      var a=alvo.replace(/[áàâã]/g,'a').replace(/[éê]/g,'e').replace(/í/g,'i')
        .replace(/[óôõ]/g,'o').replace(/ú/g,'u').replace(/ç/g,'c');
      if(c===a||c===chave||c.indexOf(a)>=0||a.indexOf(c)>=0){
        m[cp.k]=i;usados[i]=true;break;
      }
    }
  });
  return m;
}

/* ---------- a tela ---------- */
function telaCarga(){
  var a=areaImp();
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo"><div><h1>Importar Dados</h1>'+
   '<p>Traz para a Joia os cadastros de um sistema anterior. Cada tipo de dado tem a sua '+
   'área — assim o sistema não precisa adivinhar o que é ficha e o que é ingrediente.</p></div>'+
   '<button class="infoBt" onclick="explicaImport()">'+sv('help',15)+'</button></div>'+

   '<div class="impAbas">'+AREAS_IMP.map(function(x){
     return '<button class="impAba'+(IMPC.area===x.id?' on':'')+'" '+
      'onclick="trocarAreaImp(\''+x.id+'\')">'+sv(x.ic,15)+
      '<div><b>'+E(x.n)+'</b><span>'+E(x.d)+'</span></div></button>';
   }).join('')+'</div>'+

   '<div class="impBox">'+
    '<div class="impPasso"><b>1.</b> Escolha o arquivo</div>'+
    '<input type="file" id="impArq" accept=".csv,.txt,text/csv" onchange="lerArquivoImp(this)">'+
    '<div class="hint">Planilha salva como <b>CSV</b>. No Excel: Arquivo › Salvar como › '+
    'CSV. Aceita ponto e vírgula, vírgula ou tabulação como separador.</div>'+

    '<div class="impCols">'+
     '<div class="impColsT">Colunas que esta área espera</div>'+
     '<table class="pTable"><thead><tr><th>Coluna</th><th style="width:88px">Obrigatória</th>'+
     '<th>Exemplo</th></tr></thead><tbody>'+
     a.campos.map(function(c){
       return '<tr><td><b>'+E(c.n)+'</b></td>'+
        '<td>'+(c.obr?'<span class="impObr">sim</span>':'<span class="impOpc">não</span>')+'</td>'+
        '<td class="impEx">'+E(c.ex)+'</td></tr>';
     }).join('')+'</tbody></table>'+
     '<button class="btnP2" style="margin-top:10px" onclick="baixarModeloImp()">'+
     sv('file',13)+' Baixar planilha modelo</button>'+
    '</div>'+
   '</div>'+

   (IMPC.linhas?blocoConferir():'')+
   '</div></div>';
  rodape(IMPC.linhas?(IMPC.linhas.length-1)+' linhas carregadas':'nenhum arquivo');
}
function trocarAreaImp(id){
  IMPC.area=id;IMPC.linhas=null;IMPC.mapa={};IMPC.erros=[];IMPC.arquivo='';
  telaCarga();
}
function lerArquivoImp(input){
  var f=input.files&&input.files[0];
  if(!f)return;
  IMPC.arquivo=f.name;
  var r=new FileReader();
  r.onload=function(){
    try{
      var l=lerCSV(String(r.result||''));
      if(l.length<2){toast('O arquivo precisa ter o cabeçalho e ao menos uma linha.');return;}
      IMPC.linhas=l;IMPC.cols=l[0].map(function(x){return String(x).trim()});
      IMPC.mapa=adivinharMapa(IMPC.cols);
      telaCarga();
      var faltam=areaImp().campos.filter(function(c){return c.obr&&IMPC.mapa[c.k]===undefined});
      if(faltam.length)toast('Confira as colunas: '+faltam.map(function(c){return c.n}).join(', '));
      else toast(IMPC.cols.length+' colunas reconhecidas.');
    }catch(e){ toast('Não consegui ler o arquivo: '+((e&&e.message)||'')); }
  };
  r.readAsText(f,'UTF-8');
}
function blocoConferir(){
  var a=areaImp(), dados=IMPC.linhas.slice(1);
  var faltam=a.campos.filter(function(c){return c.obr&&IMPC.mapa[c.k]===undefined});
  var prev=montarPrevia();
  return '<div class="impBox">'+
   '<div class="impPasso"><b>2.</b> Confira as colunas <span class="impArq">'+E(IMPC.arquivo)+'</span></div>'+
   '<div class="hint">O sistema tentou reconhecer sozinho. Corrija o que estiver trocado.</div>'+
   '<div class="impMapa">'+a.campos.map(function(c){
     return '<div class="impM"><label>'+E(c.n)+(c.obr?' <i>*</i>':'')+'</label>'+
      '<select onchange="IMPC.mapa[\''+c.k+'\']=(this.value===\'\'?undefined:+this.value);telaCarga()">'+
      '<option value="">— não usar —</option>'+
      IMPC.cols.map(function(col,i){
        return '<option value="'+i+'"'+(IMPC.mapa[c.k]===i?' selected':'')+'>'+E(col||('coluna '+(i+1)))+'</option>';
      }).join('')+'</select></div>';
   }).join('')+'</div>'+

   (faltam.length
    ?'<div class="impErro">'+sv('help',15)+'<div><b>Falta indicar: '+
      faltam.map(function(c){return E(c.n)}).join(', ')+'</b>'+
      'Sem essas colunas não dá para importar.</div></div>'
    :'<div class="impPasso" style="margin-top:18px"><b>3.</b> Confira o resultado</div>'+
     '<div class="impResumo">'+
      '<div><span>Linhas no arquivo</span><b>'+dados.length+'</b></div>'+
      '<div><span>'+(IMPC.area==='fichas'?'Fichas':'Itens')+' que vão entrar</span><b>'+prev.novos+'</b></div>'+
      '<div><span>Já existem — serão atualizados</span><b>'+prev.exist+'</b></div>'+
      (prev.ruins?'<div class="ruim"><span>Linhas com problema</span><b>'+prev.ruins+'</b></div>':'')+
     '</div>'+
     (prev.avisos.length?'<div class="impErro">'+sv('help',15)+'<div><b>Confira antes de aplicar</b>'+
       prev.avisos.slice(0,6).map(function(x){return '<div>· '+E(x)+'</div>'}).join('')+
       (prev.avisos.length>6?'<div>· e mais '+(prev.avisos.length-6)+'</div>':'')+'</div></div>':'')+
     '<div class="impPrev"><div class="impColsT">Primeiras linhas, do jeito que vão entrar</div>'+
     prev.html+'</div>'+
     '<div class="impModo">'+
      '<label class="chkL"><input type="radio" name="impModo" '+(IMPC.modo==='somar'?'checked':'')+
       ' onchange="IMPC.modo=\'somar\'"><span><b>Acrescentar e atualizar</b> — mantém o que já existe</span></label>'+
      '<label class="chkL"><input type="radio" name="impModo" '+(IMPC.modo==='trocar'?'checked':'')+
       ' onchange="IMPC.modo=\'trocar\'"><span><b>Substituir tudo desta área</b> — apaga o que existe antes</span></label>'+
     '</div>'+
     '<button class="btnP2 ok" style="margin-top:14px" onclick="aplicarImport()">'+
     sv('nike',14)+' Aplicar a importação</button>')+
   '</div>';
}

/* ---------- previa: mostra o que vai entrar, antes de mexer em nada ---------- */
function valDe(l,k){
  var i=IMPC.mapa[k];
  return (i===undefined)?'':String(l[i]===undefined?'':l[i]).trim();
}
function montarPrevia(){
  var dados=IMPC.linhas.slice(1), avisos=[], ruins=0, novos=0, exist=0, html='';
  if(IMPC.area==='insumos'){
    var vistos={};
    var linhas=dados.map(function(l){
      var nome=valDe(l,'nome');
      if(!nome){ruins++;return null;}
      var un=valDe(l,'unidade')||'un';
      var o={nome:nome,grupo:valDe(l,'grupo'),unidade:un,
        custo:numBR(valDe(l,'custo')),estoque:numBR(valDe(l,'estoque')),
        minimo:numBR(valDe(l,'minimo')),codigo:valDe(l,'codigo')};
      if(vistos[nome.toLowerCase()])avisos.push('"'+nome+'" aparece mais de uma vez no arquivo');
      vistos[nome.toLowerCase()]=true;
      var ja=(DB.insumos||[]).find(function(x){
        return String(x.nome||'').toLowerCase()===nome.toLowerCase()});
      if(ja)exist++; else novos++;
      if(o.custo<=0&&o.estoque>0)avisos.push('"'+nome+'" tem estoque mas não tem custo');
      return o;
    }).filter(Boolean);
    html='<table class="pTable"><thead><tr><th>Nome</th><th>Grupo</th><th>Un</th>'+
     '<th style="text-align:right">Custo</th><th style="text-align:right">Estoque</th></tr></thead><tbody>'+
     linhas.slice(0,6).map(function(o){
       return '<tr><td><b>'+E(o.nome)+'</b></td><td>'+E(o.grupo||'—')+'</td>'+
        '<td>'+E(o.unidade)+'</td><td style="text-align:right">R$ '+money(o.custo)+'</td>'+
        '<td style="text-align:right">'+o.estoque+'</td></tr>';
     }).join('')+'</tbody></table>';
  }else if(IMPC.area==='fichas'){
    var fichas={};
    dados.forEach(function(l){
      var fn=valDe(l,'ficha'), it=valDe(l,'item');
      if(!fn||!it){ruins++;return;}
      if(!fichas[fn])fichas[fn]={nome:fn,rendimento:numBR(valDe(l,'rendimento')),
        unidRend:valDe(l,'unidRend')||'un',preparo:valDe(l,'preparo'),itens:[]};
      if(!fichas[fn].preparo&&valDe(l,'preparo'))fichas[fn].preparo=valDe(l,'preparo');
      var q=numBR(valDe(l,'qtd'));
      if(q<=0)avisos.push('"'+fn+'" · "'+it+'" está sem quantidade');
      var achou=(DB.insumos||[]).some(function(x){
        return String(x.nome||'').toLowerCase()===it.toLowerCase()});
      if(!achou)avisos.push('"'+it+'" não existe nos ingredientes — importe os ingredientes antes');
      fichas[fn].itens.push({nome:it,qtd:q,unidade:valDe(l,'unidade')||''});
    });
    var lista=Object.keys(fichas).map(function(k){return fichas[k]});
    lista.forEach(function(f){
      var ja=(DB.fichas||[]).find(function(x){
        return String(x.nome||'').toLowerCase()===f.nome.toLowerCase()});
      if(ja)exist++; else novos++;
      if(!f.rendimento)avisos.push('"'+f.nome+'" está sem rendimento');
    });
    html='<table class="pTable"><thead><tr><th>Ficha</th><th style="width:96px">Rendimento</th>'+
     '<th style="width:88px">Itens</th><th>Composição</th></tr></thead><tbody>'+
     lista.slice(0,6).map(function(f){
       return '<tr><td><b>'+E(f.nome)+'</b></td>'+
        '<td>'+(f.rendimento||'—')+' '+E(f.unidRend)+'</td>'+
        '<td>'+f.itens.length+'</td>'+
        '<td class="impEx">'+E(f.itens.slice(0,3).map(function(i){
          return i.qtd+(i.unidade?i.unidade:'')+' '+i.nome}).join(' · '))+
        (f.itens.length>3?' …':'')+'</td></tr>';
     }).join('')+'</tbody></table>';
    IMPC._fichas=lista;
  }else{
    var lf=dados.map(function(l){
      var em=valDe(l,'empresa');
      if(!em){ruins++;return null;}
      var ja=(DB.fornec||[]).find(function(x){
        return String(x.empresa||'').toLowerCase()===em.toLowerCase()});
      if(ja)exist++; else novos++;
      return {empresa:em,nome:valDe(l,'contato'),cnpj:valDe(l,'cnpj'),
        tel:valDe(l,'tel'),email:valDe(l,'email')};
    }).filter(Boolean);
    html='<table class="pTable"><thead><tr><th>Empresa</th><th>Contato</th><th>CNPJ</th>'+
     '<th>Telefone</th></tr></thead><tbody>'+
     lf.slice(0,6).map(function(o){
       return '<tr><td><b>'+E(o.empresa)+'</b></td><td>'+E(o.nome||'—')+'</td>'+
        '<td>'+E(o.cnpj||'—')+'</td><td>'+E(o.tel||'—')+'</td></tr>';
     }).join('')+'</tbody></table>';
    IMPC._fornec=lf;
  }
  /* aviso repetido nao ajuda ninguem */
  var unicos=[];avisos.forEach(function(x){if(unicos.indexOf(x)<0)unicos.push(x)});
  return {novos:novos,exist:exist,ruins:ruins,avisos:unicos,html:html};
}

/* ---------- aplicar ---------- */
async function aplicarImport(){
  var a=areaImp(), dados=IMPC.linhas.slice(1);
  var prev=montarPrevia();
  var ok=await confirmar({
    titulo:'Importar '+a.n.toLowerCase(),
    texto:prev.novos+' novos · '+prev.exist+' atualizados',
    linhas:[['Arquivo',E(IMPC.arquivo),''],
            ['Modo',IMPC.modo==='trocar'?'substituir tudo':'acrescentar e atualizar',''],
            ['Unidade do estoque',sucNome(lojaAtualId()),'']],
    aviso:(IMPC.modo==='trocar'
      ?'ATENÇÃO: tudo que existe nesta área será APAGADO antes. '
      :'')+
     (IMPC.area==='insumos'
      ?'O estoque entra na unidade '+sucNome(lojaAtualId())+' — cada unidade tem o seu saldo. '+
       'Se este arquivo é de outra unidade, troque a unidade no topo antes de aplicar.'
      :'Faça um backup antes, em Administração › Backup e Restauração.'),
    ok:'Importar agora',tipo:IMPC.modo==='trocar'?'perigo':'check'});
  if(!ok)return;

  var suc=lojaAtualId(), n=0;
  try{
    if(IMPC.area==='insumos'){
      baseMov();
      if(IMPC.modo==='trocar')DB.insumos=[];
      dados.forEach(function(l){
        var nome=valDe(l,'nome'); if(!nome)return;
        var ins=(DB.insumos||[]).find(function(x){
          return String(x.nome||'').toLowerCase()===nome.toLowerCase()});
        var grupoId='';
        var gn=valDe(l,'grupo');
        if(gn){
          var g=(DB.gruposIng||[]).find(function(x){
            return String(x.nome||'').toLowerCase()===gn.toLowerCase()});
          if(!g){g={id:uid('gi'),nome:gn,compoeCMV:true,sucursais:[]};DB.gruposIng.push(g);}
          grupoId=g.id;
        }
        if(!ins){
          ins={id:uid('ins'),nome:nome,controlaEstoque:true,sucursais:[]};
          DB.insumos.push(ins);
        }
        ins.unidade=valDe(l,'unidade')||ins.unidade||'un';
        if(grupoId)ins.grupoId=grupoId;
        if(valDe(l,'codigo'))ins.codigo=valDe(l,'codigo');
        var mn=numBR(valDe(l,'minimo')); if(mn)ins.estoqueMin=mn;
        /* saldo e custo entram na UNIDADE ativa, nunca no item */
        var q=numBR(valDe(l,'estoque'));
        var c=numBR(valDe(l,'custo'));
        if(q||c){
          setSaldoUn(ins.id,q,suc);
          if(c)setCustoUn(ins.id,c,suc);
        }
        n++;
      });
      espelharEstoque();
    }else if(IMPC.area==='fichas'){
      if(IMPC.modo==='trocar')DB.fichas=[];
      (IMPC._fichas||[]).forEach(function(f){
        var fc=(DB.fichas||[]).find(function(x){
          return String(x.nome||'').toLowerCase()===f.nome.toLowerCase()});
        if(!fc){fc={id:uid('fc'),nome:f.nome,sucursais:[]};DB.fichas.push(fc);}
        fc.rendimento=f.rendimento||fc.rendimento||1;
        fc.unidade=f.unidRend||fc.unidade||'un';
        if(f.preparo)fc.preparo=f.preparo;
        fc.itens=f.itens.map(function(i){
          var ins=(DB.insumos||[]).find(function(x){
            return String(x.nome||'').toLowerCase()===i.nome.toLowerCase()});
          return {insumoId:ins?ins.id:'',nome:i.nome,qtd:i.qtd,
            unidade:i.unidade||(ins?ins.unidade:'un'),_semVinculo:!ins};
        });
        n++;
      });
    }else{
      if(IMPC.modo==='trocar')DB.fornec=[];
      (IMPC._fornec||[]).forEach(function(o){
        var f=(DB.fornec||[]).find(function(x){
          return String(x.empresa||'').toLowerCase()===o.empresa.toLowerCase()});
        if(!f){f={id:uid('fo'),empresa:o.empresa};DB.fornec.push(f);}
        if(o.nome)f.nome=o.nome;
        if(o.cnpj)f.cnpj=o.cnpj;
        if(o.tel)f.tel=o.tel;
        if(o.email)f.email=o.email;
        n++;
      });
    }
    salvar();
    var soltos=(IMPC.area==='fichas')
      ?(DB.fichas||[]).reduce(function(t,f){
         return t+((f.itens||[]).filter(function(i){return i._semVinculo}).length)},0):0;
    IMPC.linhas=null;IMPC.arquivo='';
    telaCarga();
    toast(n+' '+(IMPC.area==='fichas'?'ficha(s)':'item(ns)')+' importado(s).'+
      (soltos?' '+soltos+' ingrediente(s) sem vínculo — importe os ingredientes e refaça.':''));
    if(NUVEM.ligada)sincronizar();
  }catch(e){
    toast('Falhou no meio: '+((e&&e.message)||'erro')+'. Restaure o backup.');
  }
}
function baixarModeloImp(){
  var a=areaImp();
  var l=[a.campos.map(function(c){return c.n}), a.campos.map(function(c){return c.ex})];
  if(a.id==='fichas')
    l.push(['Gelato de creme','5','kg','Açúcar refinado','1,2','kg','']);
  baixarCSV(l,'modelo-'+a.id);
}
function explicaImport(){
  confirmar({titulo:'Como importar sem errar',texto:'Importação por área',
   linhas:[['1º','importe os ingredientes',''],
           ['2º','depois as fichas técnicas',''],
           ['3º','por último os fornecedores',''],
           ['Estoque','entra na unidade que está aberta no topo','']],
   aviso:'A ordem importa: a ficha técnica aponta para ingredientes. Se você importar as fichas '+
    'antes, elas ficam sem vínculo e o custo não calcula. E lembre que o saldo é de cada unidade — '+
    'importar com Jales aberto coloca o estoque em Jales.',
   ok:'Entendi',cancelar:null}).then(function(){});
}

/* a importacao por arquivo unico continua existindo como opcao avancada */
function lerArquivoCarga(el){
  var f=el.files&&el.files[0];if(!f)return;
  var fr=new FileReader();
  fr.onload=function(){
    try{
      var d=JSON.parse(fr.result);
      if(!d.insumos||!d.fichas)throw new Error('arquivo sem ingredientes ou fichas');
      if(!d.resumo)d.resumo={grupos:(d.grupos||[]).length,insumos:d.insumos.length,
        fichas:d.fichas.length,fornecedores:(d.fornec||[]).length,
        linhasComposicao:d.fichas.reduce(function(a,x){return a+((x.itens||[]).length)},0),
        comEstoque:d.insumos.filter(function(i){return i.estoqueAtual}).length,
        comCusto:d.insumos.filter(function(i){return i.custo>0}).length,
        comPreparo:d.fichas.filter(function(x){return x.receita}).length,
        valorEstoque:d.insumos.reduce(function(a,i){return a+(i.estoqueAtual||0)*(i.custo||0)},0)};
      CARGA_SFS=d;telaCarga();toast('Arquivo lido. Confira antes de aplicar.');
    }catch(e){ toast('Arquivo inválido: '+((e&&e.message)||'erro')); }
  };
  fr.readAsText(f);
}
async function aplicarCarga(){
  if(!CARGA_SFS){toast('Escolha o arquivo primeiro.');return;}
  var C=CARGA_SFS,r=C.resumo||{};
  var ok=await confirmar({titulo:'Aplicar a importação',
    texto:'Os cadastros atuais de estoque serão substituídos pelos do arquivo.',
    linhas:[['Ingredientes',String(r.insumos||0),''],['Fichas técnicas',String(r.fichas||0),''],
            ['Fornecedores',String(r.fornecedores||0),''],
            ['Valor do estoque','R$ '+money(r.valorEstoque||0),'']],
    aviso:'Grupos, ingredientes, fichas, fornecedores, movimentações, contagens e notas '+
      'serão <b>apagados e substituídos</b>.<br>Cardápio, pedidos e financeiro não são tocados.',
    ok:'Aplicar',tipo:'perigo'});
  if(!ok)return;
  try{
    if(NUVEM.ligada){toast('Guardando um backup antes...');await criarBackup('antes-da-importacao');}
  }catch(e){ toast('Não consegui guardar o backup — a importação foi cancelada por segurança.'); return; }
  try{
    if(C.grupos)   DB.gruposIng = JSON.parse(JSON.stringify(C.grupos));
    if(C.fichaCats)DB.fichaCats = JSON.parse(JSON.stringify(C.fichaCats));
    DB.insumos = JSON.parse(JSON.stringify(C.insumos));
    DB.fichas  = JSON.parse(JSON.stringify(C.fichas));
    if(C.fornec)   DB.fornec = JSON.parse(JSON.stringify(C.fornec));
    DB.movEst=[];DB.contagens=[];DB.notas=[];DB.ordensProd=[];
    DB._cargaFeita=C.versao||'arquivo';DB._ultimoBackup='';
    repararDestinos();salvar();
    await confirmar({titulo:'Importação concluída',
      texto:C.insumos.length+' ingredientes e '+C.fichas.length+' fichas técnicas entraram no sistema.',
      aviso:'Confira em <b>Gestão de Estoque</b>. A página será recarregada.',
      ok:'Recarregar',cancelar:'Depois',tipo:'check'});
    location.reload();
  }catch(e){ toast('Falhou ao aplicar: '+((e&&e.message)||'erro')); }
}

/* ==========================================================
   BACKUP
   Uma fotografia completa dos dados, guardada na nuvem.
   Roda sozinha uma vez por dia e pode ser feita a mão.
   Restaurar troca os dados deste aparelho pelos da fotografia.
   ========================================================== */
var BK={lista:null,carregando:false,erro:''};

function _dadosDoBackup(){
  var copia={};
  Object.keys(DB).forEach(function(k){
    if(k.charAt(0)==='_')return;            /* marcas internas nao entram */
    copia[k]=DB[k];
  });
  return copia;
}
function _resumoDoBackup(){
  return {ingredientes:(DB.insumos||[]).length,fichas:(DB.fichas||[]).length,
    movimentacoes:(DB.movEst||[]).length,notas:(DB.notas||[]).length,
    lancamentos:(DB.lancFin||[]).length,pedidos:(DB.pedidos||[]).length,
    produtos:(DB.produtos||[]).length,clientes:(DB.clientes||[]).length,
    sucursais:(DB.sucursais||[]).length,usuarios:(DB.usuarios||[]).length};
}
/* uma cópia por dia, disparada após a sincronização — nunca trava a tela */
function backupDoDia(){
  try{
    if(!NUVEM.ligada)return;
    var hoje=hojeISO();
    if(DB._ultimoBackup===hoje)return;
    DB._ultimoBackup=hoje;gravarLocal();
    criarBackup('automatico').catch(function(e){
      DB._ultimoBackup='';                   /* falhou: tenta de novo na próxima */
      logNuvem('backup do dia falhou: '+((e&&e.message)||'erro'),true);
    });
  }catch(e){_quieto(e,'backupDoDia')}
}
async function criarBackup(origem){
  if(!NUVEM.ligada)throw new Error('A nuvem precisa estar ligada para guardar o backup.');
  var dados=_dadosDoBackup();
  var txt=JSON.stringify(dados);
  var u=usuarioLogado();
  await api('backups','POST',[{loja_id:NUVEM.loja,versao:VERSAO,origem:origem||'manual',
    feito_por:(u?u.nome:'—'),tamanho_kb:Math.round(txt.length/1024),
    resumo:_resumoDoBackup(),dados:dados}],{'Prefer':'return=minimal'});
  logNuvem('backup '+(origem||'manual')+' guardado ('+Math.round(txt.length/1024)+' KB)');
  await limparBackupsAntigos();
  return true;
}
/* guarda as 30 mais novas; as demais saem para nao inchar o banco */
async function limparBackupsAntigos(){
  try{
    var l=await api('backups?loja_id=eq.'+NUVEM.loja+'&select=id&order=criado_em.desc');
    if(!l||l.length<=30)return;
    var sobra=l.slice(30).map(function(x){return x.id});
    for(var i=0;i<sobra.length;i++)
      await api('backups?id=eq.'+sobra[i],'DELETE',null,{'Prefer':'return=minimal'});
  }catch(e){_quieto(e,'limparBackupsAntigos')}
}
async function carregarBackups(){
  BK.carregando=true;BK.erro='';telaBackup();
  try{
    BK.lista=await api('backups?loja_id=eq.'+NUVEM.loja+
      '&select=id,criado_em,versao,origem,feito_por,tamanho_kb,resumo&order=criado_em.desc&limit=40');
  }catch(e){ BK.erro=(e&&e.message)||'não consegui ler a lista'; BK.lista=[]; }
  BK.carregando=false;telaBackup();
}
async function backupAgora(){
  if(!NUVEM.ligada){toast('Ligue a nuvem antes — o backup é guardado nela.');return;}
  toast('Guardando a cópia...');
  try{ await criarBackup('manual'); toast('Backup guardado.'); await carregarBackups(); }
  catch(e){ toast('Não consegui guardar: '+((e&&e.message)||'erro')); }
}
/* cópia extra, em arquivo, na mão do dono */
function baixarBackupArquivo(){
  var txt=JSON.stringify({nexor:VERSAO,quando:new Date().toISOString(),
    resumo:_resumoDoBackup(),dados:_dadosDoBackup()});
  var b=new Blob([txt],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='nexor-backup-'+hojeISO()+'.json';
  document.body.appendChild(a);a.click();
  setTimeout(function(){a.remove()},400);
  toast('Arquivo baixado — guarde fora do computador da loja.');
}
async function restaurarBackup(id,quando){
  var ok=await confirmar({
    titulo:'Restaurar o backup de '+quando,
    texto:'Os dados deste aparelho serão substituídos pelos da cópia.',
    aviso:'Tudo que foi feito <b>depois</b> dessa data será perdido: vendas, notas, '+
      'lançamentos e cadastros.<br><br>Antes de restaurar, o sistema guarda automaticamente '+
      'uma cópia de segurança do estado atual — dá para voltar atrás.',
    ok:'Restaurar',cancelar:'Não fazer nada',tipo:'perigo'});
  if(!ok)return;
  try{
    toast('Guardando o estado atual antes de trocar...');
    await criarBackup('antes-de-restaurar');
    toast('Baixando a cópia...');
    var r=await api('backups?id=eq.'+id+'&select=dados');
    var d=(r&&r[0])?r[0].dados:null;
    if(!d)throw new Error('cópia vazia');
    Object.keys(DB).forEach(function(k){ if(k.charAt(0)!=='_')delete DB[k]; });
    Object.keys(d).forEach(function(k){ DB[k]=d[k]; });
    DB._ultimoBackup='';
    gravarLocal();
    await confirmar({titulo:'Backup restaurado',
      texto:'Os dados voltaram para o estado de '+quando+'.',
      aviso:'A página será recarregada. Confira o estoque e o financeiro antes de operar.',
      ok:'Recarregar agora',cancelar:'Depois',tipo:'check'});
    location.reload();
  }catch(e){ toast('Não consegui restaurar: '+((e&&e.message)||'erro')); }
}
function telaBackup(){
  if(BK.lista===null&&!BK.carregando&&NUVEM.ligada){carregarBackups();return;}
  var l=BK.lista||[];
  $('content').innerHTML='<div class="ctWrap">'+
   '<div class="ctTopo"><h1>Backup e Restauração</h1>'+
    '<p>O backup é <b>automático</b>: uma vez por dia o sistema guarda sozinho uma cópia completa '+
    'na nuvem, sem ninguém apertar nada. Você não precisa baixar nada para estar protegido. '+
    'Para restaurar, escolha a data na lista abaixo.</p>'+
    '<p style="font-size:12px">O botão de baixar arquivo é <b>opcional</b> — serve para ter uma cópia '+
    'fora do Supabase, já que no plano gratuito os backups moram todos lá dentro. '+
    'Detalhes em Central Técnica › Mapa do Sistema › Backup.</p></div>'+
   '<div class="bkBotoes">'+
    '<button class="btnP2 ok" onclick="backupAgora()">'+sv('cloud',13)+' Fazer backup agora</button>'+
    '<button class="btnP2" onclick="baixarBackupArquivo()">'+sv('file2',13)+' Baixar cópia externa (opcional)</button>'+
    '<button class="btnP2" onclick="carregarBackups()">'+sv('ref',13)+' Atualizar a lista</button>'+
   '</div>'+
   (function(){
     var i=infoRespaldo();
     if(!i)return '<div class="ctNota" style="max-width:820px">Ainda não há cópia local neste '+
       'aparelho. Ela é gravada sozinha antes de cada download da nuvem.</div>';
     return '<div class="ctNota ctAt" style="max-width:820px">'+
      '<b>Cópia local deste aparelho</b> — guardada em '+
      new Date(i.quando).toLocaleString('pt-BR')+' ('+Math.round((i.tam||0)/1024)+' KB), '+
      'antes do último download da nuvem. Use se algo sumir depois de sincronizar.<br>'+
      '<button class="btnP2" style="margin-top:8px" onclick="restaurarRespaldo()">'+
      sv('ref',13)+' Restaurar a cópia local</button></div>';
   })()+
   (!NUVEM.ligada
    ?'<div class="ctNota ctAt" style="max-width:820px">A nuvem está desligada, então não dá para '+
     'guardar nem listar cópias. Ligue no ícone de nuvem. <b>O botão de baixar arquivo continua '+
     'funcionando</b> — ele salva direto no seu computador.</div>'
    :(BK.erro?'<div class="ctNota ctAt">'+E(BK.erro)+'</div>':''))+
   (BK.carregando?'<div class="hint" style="padding:20px">carregando as cópias...</div>':'')+
   (l.length
    ?'<div class="blk" style="max-width:none;padding:0;overflow:hidden;margin-top:12px">'+
     '<table class="fmTab"><thead><tr>'+
      '<th style="width:150px">Quando</th><th style="width:120px">Origem</th>'+
      '<th style="width:150px">Feito por</th><th>Conteúdo</th>'+
      '<th style="width:90px;text-align:right">Tamanho</th>'+
      '<th style="width:90px">Versão</th><th style="width:110px"></th></tr></thead><tbody>'+
     l.map(function(b){
       var q=b.criado_em?dataBR(b.criado_em.slice(0,10))+' '+b.criado_em.slice(11,16):'—';
       var r=b.resumo||{};
       var cont=[[r.pedidos,'pedidos'],[r.movimentacoes,'movimentos'],[r.notas,'notas'],
                 [r.lancamentos,'lançamentos'],[r.fichas,'fichas'],[r.ingredientes,'ingredientes']]
         .filter(function(x){return x[0]}).map(function(x){return x[0]+' '+x[1]}).join(' · ');
       return '<tr><td><b>'+q+'</b></td>'+
       '<td>'+(b.origem==='automatico'?'automático':
               b.origem==='antes-de-restaurar'?'<b class="vr">antes de restaurar</b>':'manual')+'</td>'+
       '<td>'+E(b.feito_por||'—')+'</td>'+
       '<td><small>'+E(cont||'—')+'</small></td>'+
       '<td style="text-align:right">'+(b.tamanho_kb||0)+' KB</td>'+
       '<td>'+E(b.versao||'—')+'</td>'+
       '<td><button class="btnP2" onclick="restaurarBackup(\''+b.id+'\',\''+q+'\')">Restaurar</button></td></tr>';
     }).join('')+'</tbody></table></div>'
    :(NUVEM.ligada&&!BK.carregando
      ?'<div class="mvVazio" style="padding:56px">'+sv('cloud',26)+'<b>Nenhuma cópia ainda</b>'+
       '<span>A primeira é guardada na próxima sincronização, ou clique em Fazer backup agora.</span></div>':''))+
   '<div class="ctGrade" style="margin-top:14px">'+
    ctCard('Quantas camadas você tem','proteção em três níveis',
     ctLinha('1. O aparelho','os dados ficam no computador da loja, funcionando sem internet')+
     ctLinha('2. A nuvem','o banco Supabase — hoje no plano gratuito, <b>sem backup do serviço</b>')+
     ctLinha('3. Estas cópias','fotografias diárias automáticas, feitas pela Joia')+
     '<div class="ctNota ctAt">Atenção: no <b>plano gratuito</b>, o Supabase não guarda cópia nenhuma. '+
     'Hoje a camada 3 é a sua única rede de proteção real. No plano Pro (~US$ 25/mês) o próprio '+
     'serviço passa a fazer backup diário e permite voltar o banco a qualquer minuto dos últimos dias. '+
     'É o item número um a contratar antes de escalar a rede.</div>')+
    ctCard('O que uma cópia guarda','tudo que é seu',
     ctLinha('Cadastros','ingredientes, fichas, produtos, fornecedores, clientes')+
     ctLinha('Operação','estoque, movimentações, notas, produção, contagens')+
     ctLinha('Financeiro','lançamentos, contas, categorias, conciliação')+
     ctLinha('Vendas','pedidos, caixas, cupons')+
     ctLinha('Estrutura','sucursais, usuários e permissões')+
     '<div class="ctNota ctAt">Não guarda o que está fora do sistema: a sessão do WhatsApp, '+
     'as chaves no Render e o código-fonte no GitHub têm o backup deles próprios.</div>')+
   '</div></div>';
  rodape(l.length?l.length+' cópia(s) guardada(s)':'backup');
}

/* ==========================================================
   CENTRAL TECNICA — o mapa do sistema, em portugues.
   Serve para o Rafael entender e para o programador que
   assumir encontrar tudo sem precisar perguntar.
   ========================================================== */
var CT={aba:'pecas'};
function ctAba(a){CT.aba=a;telaCentralTecnica();}
function ctCard(titulo,sub,corpo){
  titulo=E(titulo);sub=E(sub);     /* P14 */
  return '<div class="ctCard"><div class="ctCardH"><b>'+titulo+'</b>'+
   (sub?'<span>'+sub+'</span>':'')+'</div><div class="ctCardB">'+corpo+'</div></div>';
}
function ctLinha(rot,val){
  return '<div class="ctL"><span>'+rot+'</span><b>'+val+'</b></div>';
}
function telaCentralTecnica(){
  var abas=[['pecas','As 4 peças','o que é cada parte e o que para se ela cair'],
            ['contas','Contas e acessos','onde mora cada coisa'],
            ['dados','Banco de dados','como os dados são guardados'],
            ['backup','Backup','onde fica e como resgatar'],
            ['socorro','Quando dá problema','o que olhar primeiro']];
  $('content').innerHTML='<div class="ctWrap">'+
   '<div class="ctTopo">'+
    '<h1>Mapa do Sistema</h1>'+
    '<p>Esta tela é a planta baixa da Joia. Foi escrita para você entender sem saber programar '+
    'e para quem assumir o desenvolvimento encontrar tudo sem depender de ninguém. '+
    '<b>Esta tela é do dono da Joia</b> — nenhum cliente, nem a franqueadora dele, tem acesso: '+
    'aqui estão as contas de infraestrutura do produto.</p>'+
   '</div>'+
   '<div class="ctAbas">'+abas.map(function(a){
     return '<button class="ctAba'+(CT.aba===a[0]?' on':'')+'" onclick="ctAba(\''+a[0]+'\')">'+
      '<b>'+a[1]+'</b><small>'+a[2]+'</small></button>';
   }).join('')+'</div>'+
   '<div class="ctCorpo">'+
    (CT.aba==='pecas'?ctPecas():CT.aba==='contas'?ctContas():
     CT.aba==='dados'?ctDados():CT.aba==='backup'?ctBackupDoc():ctSocorro())+
   '</div></div>';
  rodape('Central Técnica · versão do sistema '+VERSAO);
}

function ctPecas(){
  return '<p class="ctIntro">A Joia não é um programa só. São <b>quatro peças separadas</b> que '+
   'conversam entre si. Isso é de propósito: se uma quebrar, as outras continuam funcionando. '+
   'É a diferença entre queimar uma lâmpada e cair a casa inteira.</p>'+
  '<div class="ctGrade">'+
   ctCard('1. O Sistema','onde você trabalha todo dia',
    ctLinha('Endereço','rafaeluendes-jpg.github.io/nexor/')+
    ctLinha('O que é','um arquivo só, chamado index.html')+
    ctLinha('Onde o código mora','GitHub, repositório <b>nexor</b>')+
    ctLinha('Quem publica','GitHub Pages, sozinho, ~1 min após a alteração')+
    '<div class="ctNota ctOk">Se o cardápio online, o robô ou o app caírem, '+
    '<b>o sistema e o PDV continuam vendendo normal</b>.</div>')+

   ctCard('2. O Cardápio Digital','onde o cliente faz o pedido',
    ctLinha('Endereço','rafaeluendes-jpg.github.io/delivery/')+
    ctLinha('Onde o código mora','GitHub, repositório <b>delivery</b>')+
    ctLinha('De onde tira os dados','direto do banco — sabores, zonas e taxas ao vivo')+
    ctLinha('Para onde manda o pedido','tabela pedidos_online, e o PDV toca o sino')+
    '<div class="ctNota ctAt">Esta é a peça que <b>depende do banco</b>. Se o banco cair, '+
    'o cliente não consegue pedir pelo site — mas a loja continua vendendo no balcão.</div>')+

   ctCard('3. O Robô do WhatsApp','a Carla, que atende e avisa',
    ctLinha('Onde roda','Render — nexor-whatsapp.onrender.com')+
    ctLinha('Onde o código mora','GitHub, repositório <b>nexor-whatsapp</b>')+
    ctLinha('Como conversa','Baileys (WhatsApp) + Groq/Llama, com Gemini de reserva')+
    ctLinha('Onde fica a sessão','no banco — sobrevive a reinício, sem ler QR de novo')+
    ctLinha('Página de conferência','/diagnostico — mostra se está conectado')+
    '<div class="ctNota ctOk">Se o robô cair, <b>nada mais é afetado</b>. '+
    'Só a Carla para de responder.</div>')+

   ctCard('4. O App do Franqueado','o painel no celular',
    ctLinha('Endereço','app.joiagest.com.br')+
    ctLinha('Onde o código mora','GitHub, repositório <b>nexor-app</b>')+
    ctLinha('O que mostra','faturamento, ticket médio, mais vendidos, evolução')+
    ctLinha('Como instala','abre no celular e adiciona à tela inicial (PWA)')+
    '<div class="ctNota ctOk">Só lê. Não altera nada. Se cair, não afeta a operação.</div>')+
  '</div>'+
  '<div class="ctFluxo"><b>Como as peças se ligam</b>'+
   '<div class="ctFluxoL">Sistema (seu computador) &nbsp;⇄&nbsp; <b>Banco de dados</b> &nbsp;⇄&nbsp; Cardápio · Robô · App</div>'+
   '<span>Todas conversam pelo banco. Nenhuma conversa direto com a outra — por isso uma não derruba a outra.</span>'+
  '</div>';
}

function ctContas(){
  return '<p class="ctIntro">Onde cada coisa mora, e em qual conta. '+
   '<b>Nenhuma senha está escrita aqui</b> — de propósito: esta tela vira parte do arquivo do sistema, '+
   'e senha em arquivo é senha vazada. Guarde as senhas num gerenciador (1Password, Bitwarden) '+
   'e use esta lista como o índice do que existe.</p>'+
  '<div class="ctGrade">'+
   ctCard('Banco de dados','Supabase',
    ctLinha('Serviço','Supabase — PostgreSQL 17 + autenticação')+
    ctLinha('Identificador do projeto','cevghkndzpzvnzwifhnm')+
    ctLinha('Endereço do banco','db.cevghkndzpzvnzwifhnm.supabase.co')+
    ctLinha('Endereço da API','https://cevghkndzpzvnzwifhnm.supabase.co')+
    ctLinha('Região','us-east-2 (Ohio, EUA)')+
    ctLinha('Plano','gratuito — <b>sem backup do serviço</b>')+
    ctLinha('Painel','supabase.com/dashboard → projeto da Joia')+
    ctLinha('Onde ficam as chaves','painel → Project Settings → API')+
    ctLinha('O que guarda','absolutamente todos os dados da rede')+
    '<div class="ctNota ctAt">É a peça mais crítica. Perder o acesso a esta conta é o pior cenário. '+
    'Mantenha o e-mail de recuperação atualizado e ative verificação em duas etapas.</div>')+

   ctCard('Código-fonte','GitHub',
    ctLinha('Conta','rafaeluendes-jpg')+
    ctLinha('Repositórios','nexor · delivery · nexor-app · nexor-whatsapp')+
    ctLinha('Histórico','toda alteração fica gravada e dá para voltar atrás')+
    ctLinha('Token de publicação','gerado em Settings → Developer settings')+
    '<div class="ctNota ctAt">Os repositórios estão <b>públicos</b> hoje — qualquer um lê o código. '+
    'Item aberto para resolver.</div>')+

   ctCard('Hospedagem','GitHub Pages',
    ctLinha('O que hospeda','sistema, cardápio e app')+
    ctLinha('Como publica','sozinho, ao gravar no repositório')+
    ctLinha('Custo','gratuito')+
    ctLinha('Histórico','já usamos Netlify; migrou por esgotar o plano gratuito'))+

   ctCard('Servidor do robô','Render',
    ctLinha('Serviço','Render, plano Starter (pago)')+
    ctLinha('Aplicação','nexor-whatsapp')+
    ctLinha('Chaves guardadas lá','banco, Groq e Gemini — como variáveis de ambiente')+
    '<div class="ctNota ctOk">As chaves do robô ficam no painel do Render, '+
    'nunca dentro do código. É o jeito certo.</div>')+

   ctCard('Inteligência da Carla','Groq e Google',
    ctLinha('Principal','Groq — modelo Llama 3.3')+
    ctLinha('Reserva','Google Gemini')+
    ctLinha('Onde ficam as chaves','painel do Render')+
    '<div class="ctNota ctAt">Chave que aparece escrita em qualquer lugar público é revogada '+
    'automaticamente pelo fornecedor. Já aconteceu uma vez com a do Groq.</div>')+

   ctCard('Acessos do sistema','logins da rede',
    ctLinha('Administrador da Joia','rafael@uendes.com — enxerga todas as instalações')+
    ctLinha('Franqueadora','criada no Assistente de Instalação — acesso total à rede')+
    ctLinha('Unidades','uma por loja, criadas no mesmo assistente')+
    ctLinha('Onde se muda','Configuração da Loja › Usuários e Permissões')+
    '<div class="ctNota ctAt">As senhas iniciais são padrão (123). Troque todas.</div>')+
  '</div>';
}

function ctDados(){
  return '<p class="ctIntro">Como os dados são guardados — e por que você não perde venda '+
   'se a internet cair.</p>'+
  '<div class="ctGrade">'+
   ctCard('Duas camadas','aparelho e nuvem',
    ctLinha('1ª camada','o próprio aparelho (localStorage do navegador)')+
    ctLinha('2ª camada','o banco na nuvem (Supabase)')+
    ctLinha('3ª camada','os backups diários — Central Técnica › Backup e Restauração')+
    ctLinha('Quem manda','o aparelho grava primeiro, a nuvem recebe depois')+
    '<div class="ctNota ctOk">Por isso, <b>sem internet o PDV continua vendendo</b>. '+
    'Quando a conexão volta, o que ficou pendente sobe.</div>'+
    '<div class="ctNota ctAt">O contrário também vale: <b>limpar os dados do navegador '+
    'apaga a camada local</b>. Só reconecte a nuvem e baixe de novo.</div>')+

   ctCard('Quantos dados','no seu aparelho agora',
    ctLinha('Ingredientes',String((DB.insumos||[]).length))+
    ctLinha('Fichas técnicas',String((DB.fichas||[]).length))+
    ctLinha('Movimentações de estoque',String((DB.movEst||[]).length))+
    ctLinha('Notas de entrada',String((DB.notas||[]).length))+
    ctLinha('Lançamentos financeiros',String((DB.lancFin||[]).length))+
    ctLinha('Pedidos',String((DB.pedidos||[]).length))+
    ctLinha('Sucursais',String((DB.sucursais||[]).length))+
    ctLinha('Usuários',String((DB.usuarios||[]).length)))+

   ctCard('Como a nuvem separa as lojas','o que impede uma ver a outra',
    ctLinha('Regra','cada linha do banco carrega a loja dona')+
    ctLinha('Quem confere','o próprio banco, a cada consulta')+
    ctLinha('Nome técnico','RLS — Row Level Security')+
    '<div class="ctNota ctOk">Isso vale mesmo que alguém descubra o endereço do banco: '+
    'sem estar logado na loja certa, não vem dado.</div>')+

   ctCard('O que ainda está aberto','transparência',
    '<div class="ctNota ctAt"><b>Leitura pública em algumas tabelas.</b> O cardápio online '+
    'precisa mostrar sabores e taxas sem login, e isso hoje deixa outras tabelas visíveis junto. '+
    'Fechar exige separar tabela por tabela, sem quebrar o cardápio e o robô. É o próximo passo.</div>'+
    '<div class="ctNota ctAt"><b>Senhas do sistema em texto.</b> Ainda não são embaralhadas. '+
    'Está na fila.</div>'+
    '<div class="ctNota ctOk"><b>Escrita já bloqueada.</b> Testado: ninguém de fora consegue '+
    'gravar, alterar ou apagar dados sem login.</div>')+
  '</div>';
}

function ctBackupDoc(){
  return '<p class="ctIntro">Como o backup da Joia funciona, <b>onde os dados ficam guardados</b> '+
   'e o passo a passo para resgatar. Escrito para quem nunca viu o sistema.</p>'+
  '<div class="ctGrade">'+
   ctCard('Como funciona','automático, sem ninguém apertar nada',
    ctLinha('Quando roda','sozinho, na primeira sincronização de cada dia')+
    ctLinha('O que guarda','uma fotografia completa de todos os dados da loja')+
    ctLinha('Quantas guarda','as 30 mais recentes; as antigas saem sozinhas')+
    ctLinha('Também roda','antes de qualquer restauração, para poder voltar atrás')+
    '<div class="ctNota ctOk">Ninguém precisa lembrar de fazer backup. '+
    'Se o sistema abriu e sincronizou naquele dia, a cópia existe.</div>')+

   ctCard('Onde os dados ficam','o endereço exato',
    ctLinha('Serviço','Supabase — projeto cevghkndzpzvnzwifhnm')+
    ctLinha('Tabela','backups')+
    ctLinha('Como ver por fora','painel do Supabase → Table Editor → tabela backups')+
    ctLinha('Colunas úteis','criado_em · origem · feito_por · tamanho_kb · resumo · dados')+
    ctLinha('Onde a cópia inteira mora','coluna <b>dados</b>, em formato JSON')+
    ctLinha('Separação','cada linha tem loja_id — uma loja nunca vê o backup da outra')+
    '<div class="ctNota ctOk">Só quem está logado enxerga. Testado: com a chave pública do sistema, '+
    'de fora, não se lê nem se apaga backup nenhum.</div>')+

   ctCard('Como resgatar','pelo sistema, em 4 passos',
    '<div class="ctPasso"><b>1.</b> Central Técnica → Backup e Restauração</div>'+
    '<div class="ctPasso"><b>2.</b> Ache a data desejada na lista e clique em Restaurar</div>'+
    '<div class="ctPasso"><b>3.</b> Confirme — o sistema guarda antes uma cópia do estado atual, '+
    'marcada em vermelho como "antes de restaurar"</div>'+
    '<div class="ctPasso"><b>4.</b> A página recarrega. Confira estoque e financeiro antes de operar</div>'+
    '<div class="ctNota ctAt">Tudo que aconteceu <b>depois</b> da data restaurada se perde. '+
    'Restaurar é para acidente grave, não para corrigir um lançamento errado.</div>')+

   ctCard('Como resgatar sem o sistema','se a Joia não abrir',
    '<div class="ctPasso"><b>1.</b> Entre em supabase.com/dashboard com a conta da franqueadora</div>'+
    '<div class="ctPasso"><b>2.</b> Table Editor → tabela <b>backups</b> → ordene por criado_em</div>'+
    '<div class="ctPasso"><b>3.</b> Copie o conteúdo da coluna <b>dados</b> da linha desejada</div>'+
    '<div class="ctPasso"><b>4.</b> É um JSON com todas as coleções — qualquer programador '+
    'recoloca no sistema a partir dali</div>'+
    '<div class="ctNota ctOk">Ou seja: os dados não ficam presos à Joia. '+
    'Estão num banco padrão de mercado, legíveis por qualquer ferramenta.</div>')+

   ctCard('O que falta para ficar profissional','honestidade',
    ctLinha('Hoje','cópia diária feita pelo próprio sistema — funciona, mas depende do sistema abrir')+
    ctLinha('Falta 1','plano Supabase Pro: backup do banco inteiro, feito pelo servidor')+
    ctLinha('Falta 2','Point-in-Time Recovery: voltar o banco a qualquer minuto dos últimos dias')+
    ctLinha('Falta 3','cópia guardada fora do Supabase, em outro provedor')+
    '<div class="ctNota ctAt">Enquanto o plano for gratuito, se a conta do Supabase for perdida '+
    'ou suspensa, <b>os backups vão junto</b> — porque moram lá dentro. É a fragilidade real de hoje '+
    'e o motivo do botão "Baixar arquivo": ele tira uma cópia para fora, na sua mão.</div>')+

   ctCard('O que o backup NÃO guarda','para não haver surpresa',
    ctLinha('Sessão do WhatsApp','fica na tabela whatsapp_sessoes; se perder, lê o QR de novo')+
    ctLinha('Chaves de IA e do banco','ficam no painel do Render, como variáveis de ambiente')+
    ctLinha('Código do sistema','fica no GitHub, com histórico de todas as versões')+
    ctLinha('Arquivos de imagem','fotos de produto seguem o mesmo caminho dos dados'))+
  '</div>';
}

function ctSocorro(){
  return '<p class="ctIntro">O primeiro passo sempre é descobrir <b>qual das quatro peças</b> '+
   'está com problema. Quase sempre é uma só.</p>'+
  '<div class="ctGrade">'+
   ctCard('O sistema não abre ou está velho','',
    '<div class="ctPasso"><b>1.</b> Ctrl+Shift+R (força recarregar sem usar o que estava guardado)</div>'+
    '<div class="ctPasso"><b>2.</b> Confira a versão no canto — deve bater com a última publicada</div>'+
    '<div class="ctPasso"><b>3.</b> Se não bater, o GitHub Pages ainda está publicando; espere 1 minuto</div>')+

   ctCard('Pedido do cardápio não chega','',
    '<div class="ctPasso"><b>1.</b> Abra o cardápio e veja se carrega os sabores — se não, é o banco</div>'+
    '<div class="ctPasso"><b>2.</b> Se carrega mas o pedido não chega, é a ligação com o PDV</div>'+
    '<div class="ctPasso"><b>3.</b> O PDV continua vendendo no balcão. Não pare a loja por isso</div>')+

   ctCard('A Carla parou de responder','',
    '<div class="ctPasso"><b>1.</b> Abra nexor-whatsapp.onrender.com/diagnostico</div>'+
    '<div class="ctPasso"><b>2.</b> Veja se o WhatsApp aparece conectado e se a IA está ativa</div>'+
    '<div class="ctPasso"><b>3.</b> IA desativada quase sempre é chave vencida ou revogada — troque no Render</div>'+
    '<div class="ctPasso"><b>4.</b> Isso não afeta vendas nem estoque</div>')+

   ctCard('Sumiu dado no aparelho','',
    '<div class="ctPasso"><b>1.</b> Não cadastre nada de novo — pode duplicar</div>'+
    '<div class="ctPasso"><b>2.</b> Ícone de nuvem → Testar conexão → Baixar cópia dos dados</div>'+
    '<div class="ctPasso"><b>3.</b> Se a nuvem também estiver sem, use o backup do dia anterior</div>')+

   ctCard('Para quem for assumir o desenvolvimento','o essencial',
    ctLinha('Tecnologia','HTML, CSS e JavaScript puros — sem framework, sem build')+
    ctLinha('Arquitetura','arquivo único; dados em localStorage; Supabase para sincronizar')+
    ctLinha('Como testar','abrir o index.html no navegador; não precisa instalar nada')+
    ctLinha('Como publicar','gravar no GitHub; o Pages publica sozinho')+
    ctLinha('Onde ficam as decisões','arquivo DECISOES.md, no repositório nexor')+
    '<div class="ctNota ctAt">O arquivo único foi ótimo para chegar rápido até aqui, mas '+
    '<b>vai precisar ser dividido</b> quando entrar mais gente. É a conversa a ter no primeiro dia '+
    'com quem assumir.</div>')+
  '</div>';
}

/* ---------- MENU DO + ---------- */
function menuNovo(ev){
  ev.stopPropagation();
  pop(ev,'<button onclick="modalLanc(null,\'despesa\');fecharPops()">'+
   '<span class="mnIc" style="background:#FCEBEB;color:#C94141">'+sv('dn4',14)+'</span> Nova despesa</button>'+
   '<button onclick="modalLanc(null,\'receita\');fecharPops()">'+
   '<span class="mnIc" style="background:#E0F5F1;color:#00806F">'+sv('up4',14)+'</span> Nova receita</button>'+
   '<div class="popSep"></div>'+
   '<button onclick="modalTransf();fecharPops()">'+
   '<span class="mnIc" style="background:#E8F0FC;color:#2C6FD1">'+sv('troca',14)+'</span> Transferência entre contas</button>');
}

/* ---------- DESPESA / RECEITA ---------- */
var _preLanc=null;
function modalLanc(id,tipoNovo,pre){
  _preLanc=pre||null;
  baseLanc();baseForn();
  var l=id?DB.lancFin.find(function(x){return x.id===id}):null;
  var P=_preLanc||{};
  if(l&&l.conciliado){toast('Movimento conciliado — desconcilie na Conciliação Bancária para editar.');return;}
  var tipo=l?l.tipo:(tipoNovo||'despesa');
  /* na conciliacao nao se troca receita/despesa: o movimento ja existe no banco */
  var escondeTipo=(!l&&P.soDespesa)||!!P.deCB;
  /* banco e forma de pagamento pertencem ao pagamento, nao ao lancamento:
     so aparecem depois que a conta foi paga */
  var mostraPg=!!(l&&l.pago);
  /* lancamento que nasceu de uma nota de entrada: mostra o que foi comprado */
  var notaL=notaDoLanc(l);
  var cats=[];
  (DB.catfin||[]).forEach(function(p){(p.itens||[]).forEach(function(it){
    cats.push({id:it.id,nome:p.nome+' › '+it.nome});});});

  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 11px;max-width:none">'+
  '<div class="tipoRad"'+(escondeTipo?' style="display:none"':'')+'>'+
   '<label class="radL"><input type="radio" name="lnT" value="receita" onchange="limpaCatSeTrocou()"'+(tipo==='receita'?' checked':'')+'> Receita</label>'+
   '<label class="radL"><input type="radio" name="lnT" value="despesa" onchange="limpaCatSeTrocou()"'+(tipo==='despesa'?' checked':'')+'> Despesa</label>'+
  '</div>'+
  /* compra de mercadoria e sempre despesa: nao se escolhe o tipo */
  ((!l&&P.soDespesa)?'<div class="tipoFixo">'+sv('dn',12)+' Compra de mercadoria — lançada como <b>despesa</b></div>':'')+
  (P.deCB?'<div class="tipoFixo">'+sv('nike',12)+' Movimento do extrato — '+
    (tipo==='receita'?'<b>receita</b>':'<b>despesa</b>')+', o tipo não muda por aqui</div>':'')+
  (mostraPg
  ?'<div class="row2" style="margin-top:12px">'+
   '<div class="fld2"><label>Banco / conta *</label><select id="lnC">'+
    '<option value="">Selecione uma opção</option>'+
    (DB.contas||[]).map(function(c){return '<option value="'+c.id+'"'+((l&&l.contaId===c.id)||(!l&&P.contaId===c.id)?' selected':'')+'>'+E(c.nome)+'</option>'}).join('')+
   '</select></div>'+
   '<div class="fld2"><label>Forma de pagamento</label>'+
   '<select id="lnM"><option value="">Selecione uma opção</option>'+
    (DB.formasPag||[]).filter(function(f){return f.ativa!==false}).map(function(f){
      return '<option value="'+f.id+'"'+(l&&l.metodoId===f.id?' selected':'')+'>'+E(f.nome)+'</option>'}).join('')+
   '</select></div>'+
  '</div>'
  :'<div class="avisoPg">'+sv('help',12)+' <span>Banco e forma de pagamento são escolhidos '+
   'na hora de dar baixa, no <b>joinha</b> da lista de lançamentos.</span></div>')+
  '<div class="fld2"><label>Descrição *</label><input id="lnD" maxlength="225" value="'+E(l?l.descricao:(P.descricao||''))+'" placeholder="ex: Pagamento NF 123 — Fornecedor X"></div>'+
  '<div class="row3">'+
   '<div class="fld2"><label>Valor *</label><div class="cur"><span>R$</span>'+
    '<input id="lnV" type="number" step="0.01" value="'+(l?l.valor:(P.valor||''))+'"></div></div>'+
   '<div class="fld2"><label>Emissão</label><input id="lnE" type="date" value="'+(l?l.emissao:(P.emissao||hojeISO()))+'"></div>'+
   '<div class="fld2"><label>Vencimento</label><input id="lnVc" type="date" value="'+(l?l.vencimento:(P.vencimento||hojeISO()))+'"></div>'+
  '</div>'+
  '<div class="row3">'+
   '<div class="fld2"><label>Categoria *</label>'+
    '<button class="selArv" id="lnCatB" type="button" onclick="abreCatLanc()">'+
    '<span>'+E(l&&l.categoriaId?nomeCategoria(l.categoriaId):'Selecione uma opção')+'</span>'+sv('dn',13)+'</button>'+
    '<input type="hidden" id="lnCat" value="'+E(l?l.categoriaId:'')+'">'+
    '<div class="arvIn" id="lnCatArv" style="display:none"></div></div>'+
   '<div class="fld2"><label>Fornecedor</label>'+
    '<select id="lnFid"><option value="">— sem fornecedor —</option>'+
    (DB.fornec||[]).map(function(fo){
      return '<option value="'+fo.id+'"'+((l&&l.fornecedorId===fo.id)||(!l&&P.fornecedorId===fo.id)?' selected':'')+'>'+E(fo.empresa)+
      (fo.nome?' — '+E(fo.nome):'')+'</option>';}).join('')+
    '</select></div>'+
   '<div class="fld2"><label>Nº documento / NF</label><input id="lnDoc" value="'+E(l?l.documento:(P.documento||''))+'"></div>'+
   /* opcional: quando existe, a Assistente manda junto com a cobrança */
   '<div class="fld2"><label>Código de barras do boleto <i class="opc">opcional</i></label>'+
    '<input id="lnCB" inputmode="numeric" autocomplete="off" placeholder="cole a linha digitável"'+
    ' value="'+E(l?(l.codigoBarras||''):(P.codigoBarras||''))+'"'+
    ' oninput="checarCampoBoleto(\'lnCB\',\'lnCBav\')">'+
    '<div id="lnCBav" class="blAviso"></div>'+
    '<div class="hint">Preenchido, ele vai junto na cobrança que a Assistente manda no '+
    'WhatsApp — o gerente copia e paga sem procurar o papel.</div></div>'+
  '</div>'+
  '<label class="chkL" style="margin-top:4px"><input type="checkbox" id="lnP" '+(l&&l.pago?'checked':'')+'>'+
  '<span>Já está pago<small style="display:block;color:var(--ink-3)">marque para informar o dia do pagamento</small></span></label>'+
  '<div class="fld2" id="boxPg" style="'+(l&&l.pago?'':'display:none')+'"><label>Data do pagamento</label>'+
   '<input id="lnPg" type="date" value="'+(l&&l.pagamento?l.pagamento:hojeISO())+'"></div>'+
  '</div>'+
  (l?'':
  '<div class="blk" style="margin:0 0 11px;max-width:none">'+
  '<label class="chkL"><input type="checkbox" id="lnParc">'+
  '<span>Conta parcelada<small style="display:block;color:var(--ink-3)">gera um lançamento para cada parcela, nas datas certas</small></span></label>'+
  '<div id="boxParc" style="display:none">'+
   '<div class="row3" style="margin-top:12px">'+
    '<div class="fld2"><label>Periodicidade</label><select id="lnPer" onchange="trocaPerParc()">'+
     '<option value="semanal">Semanal (7 dias)</option>'+
     '<option value="quinzenal">Quinzenal (15 dias)</option>'+
     '<option value="mensal" selected>Mensal</option>'+
     '<option value="bimestral">A cada 2 meses</option>'+
     '<option value="dias">Personalizado (dias)</option>'+
    '</select></div>'+
    '<div class="fld2"><label>Nº de parcelas</label><input id="lnQtd" type="number" min="2" value="2"></div>'+
    '<div class="fld2"><label>1º vencimento</label><input id="lnPri" type="date" value="'+hojeISO()+'"></div>'+
    '<div class="fld2" id="boxDias" style="display:none"><label>Intervalo em dias</label>'+
     '<input id="lnDias" type="number" min="1" value="10"></div>'+
   '</div>'+
   '<div class="row2">'+
    '<div class="fld2" style="margin:0"><label>Modo do valor</label><select id="lnModo">'+
     '<option value="dividir">Dividir o valor total entre as parcelas</option>'+
     '<option value="repetir">Repetir o valor em cada parcela</option>'+
    '</select></div>'+
    '<div class="fld2" style="margin:0"><label>Valor de cada parcela</label>'+
     '<div class="cur"><span>R$</span><input id="lnVp" type="number" step="0.01" readonly style="background:var(--alt)"></div></div>'+
   '</div>'+
   '<div class="prevBox" id="prevParc"></div>'+
  '</div></div>')+
  (notaL
  ?'<div class="blk" style="margin:0 0 11px;max-width:none;padding:0;overflow:hidden">'+
   '<div class="acTit notaLink" onclick="abrirNotaDoLanc(\''+notaL.id+'\')" '+
    'title="Abrir a nota de entrada que gerou este boleto">'+
    sv('book',13)+' <span>Nota de entrada'+
    (notaL.numero?' — NF '+E(notaL.numero):'')+
    (notaL.fornecedorNome?' · '+E(notaL.fornecedorNome):'')+
    (notaL.data?' · '+dataBR(notaL.data):'')+'</span>'+
    '<em>'+sv('eye',13)+' ver a nota</em></div>'+
   ((notaL.itens||[]).length
    ?'<table class="acTab"><thead><tr><th>Item</th>'+
     '<th style="width:120px;text-align:right">Quantidade</th>'+
     '<th style="width:110px;text-align:right">Valor un.</th>'+
     '<th style="width:110px;text-align:right">Total</th></tr></thead><tbody>'+
     notaL.itens.map(function(it){
       return '<tr><td><b>'+E(it.nome)+'</b>'+
       (it.desconto?'<small style="display:block;color:var(--ink-3)">desconto R$ '+money(it.desconto)+'</small>':'')+'</td>'+
       '<td style="text-align:right">'+fmtQt(it.qtd)+' '+un(it.unidade).ab+'</td>'+
       '<td style="text-align:right">R$ '+money(it.valorUn)+'</td>'+
       '<td style="text-align:right"><b>R$ '+money(it.total)+'</b></td></tr>';}).join('')+
     '</tbody><tfoot><tr><td colspan="3"><b>'+notaL.itens.length+' item(ns)</b></td>'+
     '<td style="text-align:right"><b>R$ '+
      money(notaL.itens.reduce(function(a,x){return a+(Number(x.total)||0)},0))+'</b></td></tr></tfoot></table>'
    :'<div class="hint" style="padding:12px">Esta nota não tem itens registrados.</div>')+
   '</div>'
  :'')+
  '<div class="blk" style="margin:0;max-width:none">'+
  '<div class="fld2" style="margin:0"><label>Observação</label><input id="lnO" value="'+E(l?l.obs:'')+'"></div></div></div>';

  modal((l?'Editar lançamento':(P.titulo||(tipo==='receita'?'Nova receita':'Nova despesa'))),h,(P.botao||'Salvar'),function(){
    var d=$('lnD').value.trim();
    if(!d){toast('Informe a descrição.');return false;}
    if($('lnC')&&!$('lnC').value){toast('Selecione o banco / conta.');return false;}
    if(!$('lnCat').value){toast('Selecione a categoria.');return false;}
    var v=parseFloat($('lnV').value)||0;
    if(!v){toast('Informe o valor.');return false;}
    var tp=(document.querySelector('input[name=lnT]:checked')||{}).value||'despesa';
    var pago=$('lnP').checked;
    var fid=$('lnFid')?$('lnFid').value:'';
    var fo=(DB.fornec||[]).find(function(x){return x.id===fid});
    var forn=fo?fo.empresa:'';
    var o={tipo:tp,
      contaId:($('lnC')?$('lnC').value:(l?(l.contaId||''):(P.contaId||''))),
      metodoId:($('lnM')?$('lnM').value:(l?(l.metodoId||''):(P.metodoId||''))),descricao:d,valor:v,
      emissao:$('lnE').value||hojeISO(),vencimento:$('lnVc').value||hojeISO(),
      pagamento:pago?($('lnPg').value||hojeISO()):'',pago:pago,
      categoriaId:$('lnCat').value,fornecedor:forn,fornecedorId:fid,documento:$('lnDoc').value.trim(),
      codigoBarras:soDigitos(($('lnCB')||{}).value),obs:$('lnO').value};
    if(l){Object.assign(l,o);salvar();telaLancamentos();toast('Lançamento salvo.');return true;}
    var parc=$('lnParc')&&$('lnParc').checked;
    if(parc){
      var ds=datasParcelas(),vp=valorParcela();
      var criados=[];
      ds.forEach(function(dt,i){
        var c2=JSON.parse(JSON.stringify(o));
        c2.id=uid('lf');c2.valor=vp;c2.vencimento=dt;
        c2.descricao=o.descricao+' ('+(i+1)+'/'+ds.length+')';
        c2.pago=false;c2.pagamento='';
        DB.lancFin.push(c2);criados.push(c2);
      });
      salvar();
      if(_preLanc&&_preLanc.apos){var cb=_preLanc.apos;_preLanc=null;cb(criados);return true;}
      telaLancamentos();
      toast(ds.length+' parcelas lançadas nas datas.');
      return true;
    }
    o.id=uid('lf');DB.lancFin.push(o);
    salvar();
    if(_preLanc&&_preLanc.apos){var cb2=_preLanc.apos;_preLanc=null;cb2([o]);return true;}
    telaLancamentos();
    /* nasceu ja pago e sem banco: pede o banco e a forma na hora */
    if(o.pago&&!o.contaId){setTimeout(function(){modalPagamento([o.id])},80);return true;}
    toast('Lançamento salvo.');
    return true;
  },'lg');
  $('lnP').onchange=function(){$('boxPg').style.display=this.checked?'':'none';};
  if(P.categoriaId){
    var hid=$('lnCat');if(hid)hid.value=P.categoriaId;
    var bt=document.querySelector('#lnCatB span');if(bt)bt.textContent=nomeCategoria(P.categoriaId);
  }
  _catLancAbertas={};
  if(P.pago){var pg=$('lnP');if(pg){pg.checked=true;var bx=$('boxPg');if(bx)bx.style.display='';}}
  var pc=$('lnParc');
  if(pc){
    pc.onchange=function(){$('boxParc').style.display=this.checked?'':'none';_datasParc=[];previewParc();};
    ['lnPer','lnQtd','lnPri','lnModo','lnV','lnDias'].forEach(function(k){
      var el=$(k);if(el)el.addEventListener('input',previewParc);
      if(el)el.addEventListener('change',previewParc);
    });
    previewParc();
  }
}

var _catLancAbertas={};
function abreCatLanc(){
  var box=document.getElementById('lnCatArv');
  if(!box)return;
  if(box.style.display!=='none'){box.style.display='none';return;}
  box.style.display='';desenhaCatLanc();
}
/* trocar receita/despesa descarta a categoria escolhida se ela for do outro lado */
function limpaCatSeTrocou(){
  var c=document.getElementById('lnCat');
  var tp=(document.querySelector('input[name=lnT]:checked')||{}).value||'despesa';
  if(c&&c.value){
    var achou=(DB.catfin||[]).some(function(p){
      return tipoCat(p)===tp&&(p.itens||[]).some(function(it){return it.id===c.value});
    });
    if(!achou){
      c.value='';
      var b=document.getElementById('lnCatB');
      if(b)b.innerHTML='<span>Selecione uma opção</span>'+sv('dn',12);
    }
  }
  var a=document.getElementById('lnCatArv');
  if(a&&a.style.display!=='none')desenhaCatLanc();
}
function desenhaCatLanc(){
  var box=document.getElementById('lnCatArv');
  if(!box)return;
  var atual=(document.getElementById('lnCat')||{}).value||'';
  /* mostra só as categorias do tipo que está sendo lançado */
  var tpSel=(document.querySelector('input[name=lnT]:checked')||{}).value||'despesa';
  var lista=(DB.catfin||[]).filter(function(p){return tipoCat(p)===tpSel});
  var h='<div class="arvInB">';
  lista.forEach(function(p){
    var ab=!!_catLancAbertas[p.id];
    h+='<div class="arvInG">'+
     '<div class="arvInP" onclick="togglePastaLanc(\''+p.id+'\')">'+
      '<span class="ftSeta'+(ab?' ab':'')+'">'+sv('tri',9)+'</span>'+
      sv(ab?'folderOpen':'folder',13)+' <span class="arvInNm">'+E(p.nome)+'</span>'+
      '<span class="apQt">'+(p.itens||[]).length+'</span></div>'+
     (ab?'<div class="arvInF">'+((p.itens||[]).length?p.itens.map(function(it){
       return '<div class="arvInIt sub'+(atual===it.id?' on':'')+'" onclick="escolheCatLanc(\''+it.id+'\')">'+
       sv('file2',12)+' '+E(it.nome)+'</div>';}).join('')
       :'<div class="hint" style="padding:5px 26px">sem itens</div>')+'</div>':'')+
    '</div>';
  });
  if(!lista.length)
    h+='<div class="hint" style="padding:12px">Nenhuma categoria de '+
      (tpSel==='receita'?'receita':'despesa')+'. Cadastre em Financeiro \u203A Categorias Financeiras.</div>';
  h+='</div>';
  box.innerHTML=h;
}
function togglePastaLanc(id){_catLancAbertas[id]=!_catLancAbertas[id];desenhaCatLanc();}
function escolheCatLanc(id){
  var inp=document.getElementById('lnCat');
  if(inp)inp.value=id||'';
  var b=document.querySelector('#lnCatB span');
  if(b)b.textContent=id?nomeCategoria(id):'Selecione uma opção';
  var box=document.getElementById('lnCatArv');
  if(box)box.style.display='none';
}
function menuCatForm(ev){
  ev.stopPropagation();
  CF.abertas=CF.abertas||{};
  var h='<div class="arvPop">';
  (DB.catfin||[]).forEach(function(p){
    var ab=!!CF.abertas['m_'+p.id];
    h+='<div class="apGrupo">'+
     '<button class="apPasta" onclick="event.stopPropagation();togglePastaForm(\''+p.id+'\')">'+
      '<span class="apSeta'+(ab?' ab':'')+'">'+sv('tri',10)+'</span>'+
      sv(ab?'folderOpen':'folder',14)+' <span class="apNm">'+E(p.nome)+'</span>'+
      '<span class="apQt">'+(p.itens||[]).length+'</span></button>'+
     (ab?'<div class="apFilhos">'+((p.itens||[]).length?p.itens.map(function(it){
        return '<button class="apItem" onclick="event.stopPropagation();escolheCatForm(\''+it.id+'\')">'+
        sv('file2',12)+' '+E(it.nome)+'</button>';}).join('')
        :'<div class="hint" style="padding:6px 12px">sem subcategorias</div>')+'</div>':'')+
    '</div>';
  });
  if(!(DB.catfin||[]).length)h+='<div class="hint" style="padding:14px">Cadastre em Financeiro › Categorias Financeiras.</div>';
  h+='</div>';
  pop(ev,h);
}
function togglePastaForm(id){
  CF.abertas=CF.abertas||{};
  CF.abertas['m_'+id]=!CF.abertas['m_'+id];
  var b=document.getElementById('lnCatB');
  fecharPops();
  menuCatForm({stopPropagation:function(){},currentTarget:b});
}
function escolheCatForm(id){
  $('lnCat').value=id;
  document.querySelector('#lnCatB span').textContent=nomeCategoria(id);
  fecharPops();
}
var _datasParc=[];
function trocaPerParc(){
  var bd=$('boxDias');
  if(bd)bd.style.display=($('lnPer').value==='dias')?'':'none';
  _datasParc=[];
  previewParc();
}
function datasCalculadas(){
  var q=parseInt($('lnQtd').value)||2;
  var per=$('lnPer').value;
  var d0=$('lnPri').value||hojeISO();
  var dias=parseInt(($('lnDias')||{}).value)||10;
  var out=[];
  for(var i=0;i<q;i++){
    var d=new Date(d0+'T12:00:00');
    if(per==='semanal')d.setDate(d.getDate()+7*i);
    else if(per==='quinzenal')d.setDate(d.getDate()+15*i);
    else if(per==='mensal')d.setMonth(d.getMonth()+i);
    else if(per==='bimestral')d.setMonth(d.getMonth()+2*i);
    else d.setDate(d.getDate()+dias*i);
    out.push(d.toISOString().slice(0,10));
  }
  return out;
}
function datasParcelas(){
  var calc=datasCalculadas();
  /* mantém as datas que o usuário ajustou manualmente */
  var out=calc.map(function(d,i){return (_datasParc[i]||d)});
  return out;
}
function mudaDataParc(i,v){
  _datasParc[i]=v;
  previewParc();
}
function valorParcela(){
  var total=parseFloat($('lnV').value)||0;
  var q=parseInt($('lnQtd').value)||2;
  return $('lnModo').value==='dividir'?+(total/q).toFixed(2):total;
}
function previewParc(){
  var box=$('prevParc');if(!box)return;
  if(!$('lnParc').checked){box.innerHTML='';return;}
  var ds=datasParcelas(),v=valorParcela();
  $('lnVp').value=v.toFixed(2);
  box.innerHTML='<div class="prevTit">Parcelas que serão lançadas <b>'+ds.length+'</b> · total R$ '+money(v*ds.length)+
   ' <span class="hint" style="font-weight:400">· altere a data de qualquer parcela abaixo</span></div>'+
  '<div class="prevLista">'+ds.map(function(d,i){
    return '<div class="prevIt"><span class="prevN">'+(i+1)+'</span>'+
    '<span class="prevD">'+dataBR(d)+'</span>'+
    '<input type="date" class="prevData" value="'+d+'" onchange="mudaDataParc('+i+',this.value)">'+
    '<span class="prevV">R$ '+money(v)+'</span></div>';}).join('')+'</div>';
}

/* ---------- TRANSFERÊNCIA ---------- */
function modalTransf(){
  baseLanc();
  var op=(DB.contas||[]).map(function(c){return '<option value="'+c.id+'">'+E(c.nome)+' — R$ '+money(saldoConta(c))+'</option>'}).join('');
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none">'+
  '<div class="fld2"><label>Saiu da conta *</label><select id="trDe"><option value="">Selecione uma opção</option>'+op+'</select></div>'+
  '<div class="fld2"><label>Entrou na conta *</label><select id="trPara"><option value="">Selecione uma opção</option>'+op+'</select></div>'+
  '<div class="row2"><div class="fld2" style="margin:0"><label>Valor *</label>'+
   '<div class="cur"><span>R$</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" class="moeda" id="trV"></div></div>'+
   '<div class="fld2" style="margin:0"><label>Data</label><input id="trD" type="date" value="'+hojeISO()+'"></div></div>'+
  '<div class="fld2" style="margin:12px 0 0"><label>Observação</label><input id="trO" placeholder="opcional"></div>'+
  '</div></div>';
  modal('Nova transferência',h,'Salvar',function(){
    var de=$('trDe').value,para=$('trPara').value,v=moedaValor('trV');
    if(!de||!para){toast('Selecione as duas contas.');return false;}
    if(de===para){toast('As contas precisam ser diferentes.');return false;}
    if(!v){toast('Informe o valor.');return false;}
    var dt=$('trD').value||hojeISO();
    DB.lancFin.push({id:uid('lf'),tipo:'transferencia',contaId:de,contaDestinoId:para,metodoId:'',
      descricao:'Transferência: '+contaNome(de)+' → '+contaNome(para),categoriaTxt:'Transferência',
      valor:v,emissao:dt,vencimento:dt,pagamento:dt,pago:true,obs:$('trO').value});
    salvar();telaLancamentos();
    toast('Transferência de R$ '+money(v)+' registrada.');
    return true;
  });
}

/* ---------- EXPORTAR / IMPRIMIR ---------- */
function exportarLanc(){
  var lista=filtrarLanc();
  var linhas=[['Vencimento','Emissao','Pagamento','Descricao','Fornecedor','Documento','Codigo de barras','Metodo','Categoria','Conta','Tipo','Valor do boleto','Juros','Multa','Valor pago','Situacao']];
  lista.forEach(function(l){
    var sg=(l.tipo==='despesa'?'-':'');
    linhas.push([dataBR(l.vencimento),dataBR(l.emissao),l.pagamento?dataBR(l.pagamento):'',
      l.descricao,l.fornecedor||'',l.documento||'',l.codigoBarras||'',metodoNome(l.metodoId),catTexto(l),
      contaNome(l.contaId),l.tipo,
      sg+String(valorBoleto(l)).replace('.',','),
      String(Number(l.juros)||0).replace('.',','),
      String(Number(l.multa)||0).replace('.',','),
      l.pago?(sg+String(valorPago(l)).replace('.',',')):'',
      l.pago?'Pago':'Nao pago']);
  });
  var csv=linhas.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"'}).join(';')}).join('\n');
  var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='nexor-lancamentos-'+LF.de+'-a-'+LF.ate+'.csv';
  document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},400);
  toast('Arquivo exportado — abre no Excel.');
}
function imprimirLanc(){
  var lista=filtrarLanc();
  var totD=lista.filter(function(l){return l.tipo==='despesa'}).reduce(function(a,l){return a+l.valor},0);
  var totR=lista.filter(function(l){return l.tipo==='receita'}).reduce(function(a,l){return a+l.valor},0);
  var el=document.getElementById('viaImp')||document.createElement('div');
  el.id='viaImp';
  el.innerHTML='<div style="text-align:center"><b>JOIA — LANÇAMENTOS FINANCEIROS</b><br>'+
  dataBR(LF.de)+' a '+dataBR(LF.ate)+'</div><hr>'+
  lista.map(function(l){
    return dataBR(l.vencimento)+' — '+E(l.descricao)+' — '+catTexto(l)+' — '+
    (l.tipo==='despesa'?'-':'')+'R$ '+money(l.valor)+(l.pago?' [PAGO]':' [EM ABERTO]');
  }).join('<br>')+
  '<hr>Despesas: R$ '+money(totD)+'<br>Receitas: R$ '+money(totR)+
  '<br><b>Saldo: R$ '+money(totR-totD)+'</b>';
  document.body.appendChild(el);
  setTimeout(function(){window.print()},150);
}

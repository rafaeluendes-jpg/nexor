/* ===== BLOCO 3 — ARMAZENAMENTO ===== */
/* Havia DUAS listas com este nome. A de baixo (dos cupons) apagava esta,
   e o formulario do produto acabava gravando os identificadores da outra.
   Agora e uma so, declarada aqui e usada tambem pelos cupons. */
/* "Pedido online" e "Cardapio digital" eram a mesma coisa com dois nomes:
   o mesmo cardapio, o mesmo link, o mesmo pedido. Ter os dois so criava
   duvida na hora de marcar. Ficou um so. */
var CANAIS=[
 {id:'pdv',      n:'Frente de caixa',  d:'venda no balcão e salão'},
 {id:'delivery', n:'Delivery',         d:'pedidos de entrega'},
 {id:'cardapio', n:'Cardápio digital', d:'cardápio pelo celular, no link'},
 {id:'mesa',     n:'Mesa (QR Code)',   d:'quem está sentado na loja'},
 {id:'totem',    n:'Totem',            d:'autoatendimento na loja'}
];
/* Onde este produto pode ser vendido. Produto sem nenhuma marcacao aparece
   em todo lugar — senao, ao subir esta versao, o cardapio de quem nunca
   preencheu isso ficaria vazio de uma hora para outra. */
function disponivelNo(p,canal){
  var d=(p&&p.disponivel)||{};
  var algum=d.pdv||d.delivery||d.online||d.cardapio||d.mesa||d.totem;
  if(!algum)return true;
  /* "online" some da tela mas continua valendo para quem ja marcou antes */
  if(canal==='cardapio')return !!(d.cardapio||d.online||d.delivery);
  /* mesa e totem vendem o que se vende no balcao, nao o que sai para entrega */
  if(canal==='mesa') return !!(d.mesa||d.pdv);
  if(canal==='totem')return !!(d.totem||d.pdv);
  return !!d[canal];
}
var IMPOSTOS=['Sem tributação','Tributado integralmente','Isento','Substituição tributária','Não tributado'];
var IMPRESSAO=['Não imprimir','Impressora da cozinha','Impressora do bar','Impressora de expedição'];
var CORES=['#00A08B','#2C6FD1','#7B5FD4','#E08A2E','#C94141','#0EA5A5','#8894A6','#D9A22B'];
var DIAS=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

var DB={categorias:[],produtos:[],grupos:[],fichas:[]};

/* ----------------------------------------------------------
   CAMADA DE DADOS — ponto unico de gravacao
   Todo o sistema chama apenas carregar() e salvar().
   Trocar de "aparelho" para "nuvem" nao mexe em mais nada.
   ---------------------------------------------------------- */
var NUVEM={
  url:'https://cevghkndzpzvnzwifhnm.supabase.co',
  chave:'sb_publishable_tH04wQWnUjOUQWePZ0Bshw_RirDPUDY',
  cli:null, token:null, ligada:false, baixou:false, sujo:false, log:[], loja:null, perfil:null, sincronizando:false, pendente:false, ultima:null
};
/* ==========================================================
   CLIENTE UNICO DA NUVEM
   Havia TRES createClient() no arquivo — entrar, religar e conectar. Cada um
   cria um GoTrueClient proprio, com o proprio relogio de renovacao, todos
   disputando a mesma sessao no localStorage. Dois relogios renovando ao mesmo
   tempo invalidam o refresh token um do outro, e a sessao cai no meio do uso:
   era daqui que vinha "sua sessao expirou" durante o trabalho normal.
   Agora e um so, criado uma vez, com persistencia e renovacao explicitas.
   ========================================================== */
var _cli=null;
function cliente(){
  if(_cli)return _cli;
  if(!window.supabase)return null;
  _cli=window.supabase.createClient(NUVEM.url,NUVEM.chave,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,
          storageKey:'nexor-auth'}
  });
  /* a sessao renovada chega por aqui: o token do sistema acompanha sozinho,
     sem ninguem precisar perguntar */
  try{
    _cli.auth.onAuthStateChange(function(ev,ses){
      if(ses&&ses.access_token){
        NUVEM.token=ses.access_token;
      if(_avisouSessao){
        _avisouSessao=false;
        try{var _a=document.getElementById('avisoTab'); if(_a)_a.remove();}
        catch(e2){ _quieto(e2,'tokenValido'); }
      }
        try{ if(_cli.realtime&&_cli.realtime.setAuth)_cli.realtime.setAuth(NUVEM.token); }catch(e){_quieto(e,'cliente')}
        if(ev==='TOKEN_REFRESHED')logNuvem('sessão renovada automaticamente');
      }
      if(ev==='SIGNED_OUT'){NUVEM.token=null;NUVEM.ligada=false;estadoNuvem('offline');}
    });
  }catch(e){_quieto(e,'cliente')}
  return _cli;
}
/* ==========================================================
   ESTADO UNICO DE CONEXAO
   Antes cada pedaco da tela decidia sozinho se estava online, e por isso
   apareciam avisos contraditorios ao mesmo tempo. Agora ha um estado so.
   ========================================================== */
var CONEXAO='offline';   /* conectando | online | offline | sincronizando | erro */
function estadoNuvem(e,msg){
  CONEXAO=e;
  var el=document.getElementById('nuvemSt');
  if(el){
    /* ==========================================================
       CONTADOR DISCRETO NO LUGAR DA FAIXA
       Quando ha coisa esperando para subir, o rodape diz quantas — em vez
       de abrir uma faixa explicando tabelas e sincronizacao. Quem esta no
       caixa ve "Online · 2 pendencias" e segue trabalhando; quem quiser
       detalhe abre o Diagnostico.
       ========================================================== */
    var pend=0;
    try{ pend=(NUVEM.sujo||DB._sujo)?contarPendencias():0; }
    catch(x){ _quieto(x,'estadoNuvem'); }
    var sufixo=pend?' · '+pend+' pendência'+(pend>1?'s':''):'';
    if(e==='conectando')el.innerHTML='<i style="background:#B8730B"></i>Conectando...';
    else if(e==='sincronizando')el.innerHTML='<i style="background:#1F6FB2"></i>Sincronizando'+
      (pend?' '+pend+' alteração'+(pend>1?'ões':''):'')+'...';
    else if(e==='online')el.innerHTML='<i></i>Online'+sufixo;
    else if(e==='erro')el.innerHTML='<i style="background:#C94141"></i>'+(msg||'sincronização pendente')+sufixo;
    else el.innerHTML='<i style="background:#8A8578"></i>Offline'+sufixo;
  }
  try{conferirNuvem();}catch(e2){_quieto(e2,'estadoNuvem')}
}
/* quantas alteracoes ainda nao subiram — so cadastros que o motor envia */
function contarPendencias(){
  var n=0;
  try{
    (MAPA||[]).forEach(function(E2){
      var lista=DB[E2.col]; if(!Array.isArray(lista))return;
      var h=(DB._hash&&DB._hash[E2.col])||{};
      lista.forEach(function(x){
        if(!x||typeof x!=='object')return;
        if(x._loja&&x._loja!==NUVEM.loja)return;   /* de outra empresa: nao conta */
        if(!h[x.id])n++;
      });
    });
  }catch(e){ _quieto(e,'contarPendencias'); }
  return n;
}
function modo(){try{return localStorage.getItem('nexor_modo')||'local'}catch(e){return 'local'}}
function setModo(m){try{localStorage.setItem('nexor_modo',m)}catch(e){_quieto(e,'setModo')}}

function carregar(){
  try{
    var raw=localStorage.getItem('nexor_dados');
    if(raw){DB=JSON.parse(raw);}
    else{semear();gravarLocal();}
  }catch(e){semear();}
  DB.categorias=DB.categorias||[];DB.produtos=DB.produtos||[];
  DB.grupos=DB.grupos||[];DB.fichas=DB.fichas||[];
}
var _ultimoTamanho=0;
/* O navegador da uns 5 MB por site. Guardavamos DUAS copias inteiras no
   mesmo lugar — os dados e o respaldo — e juntas elas estouravam o limite.
   Agora, quando falta espaco, o sistema joga fora o que e descartavel e
   tenta de novo, em vez de simplesmente parar de salvar. */
function liberarEspacoLocal(){
  var soltos=['nexor_respaldo','nexor_respaldo_info','nexor_log','nexor_cache'];
  var liberou=0;
  soltos.forEach(function(k){
    try{
      var v=localStorage.getItem(k);
      if(v){liberou+=v.length;localStorage.removeItem(k);}
    }catch(e){_quieto(e,'liberarEspacoLocal')}
  });
  return liberou;
}
function gravarLocal(){
  var txt;
  try{ txt=JSON.stringify(DB); }
  catch(e){ alertaGravacao('Não consegui preparar os dados para salvar.'); return false; }
  try{
    localStorage.setItem('nexor_dados',txt);
    _ultimoTamanho=txt.length;
    limparAlertaGravacao();
    return true;
  }catch(e){
    /* segunda chance: descarta a copia de respaldo e tenta de novo */
    var lib=liberarEspacoLocal();
    if(lib){
      try{
        localStorage.setItem('nexor_dados',txt);
        _ultimoTamanho=txt.length;
        limparAlertaGravacao();
        logNuvem('espaço apertado: descartei a cópia local ('+Math.round(lib/1024)+
          ' KB) para conseguir salvar');
        return true;
      }catch(e2){_quieto(e2,'gravarLocal')}
    }
    /* memoria do navegador cheia: a gravacao falha e o proximo F5 volta ao estado antigo.
       Isso NAO pode passar como um toast que some em tres segundos. */
    alertaGravacao('O navegador recusou a gravação — memória cheia ('+
      Math.round(txt.length/1024)+' KB). Nada do que você lançar agora será guardado '+
      'neste aparelho até resolver. Seus dados na nuvem estão a salvo.');
    logNuvem('FALHA AO GRAVAR NO APARELHO — '+Math.round(txt.length/1024)+' KB',true);
    return false;
  }
}
/* uma barra so, no rodape, com todos os avisos empilhados */
function barraAvisos(){
  var b=document.getElementById('barraAvisos');
  if(!b){
    b=document.createElement('div');b.id='barraAvisos';
    document.body.appendChild(b);
  }
  return b;
}
/* ----------------------------------------------------------
   AVISO DE APARELHO FORA DA NUVEM
   Rodar em modo local numa loja e perigoso: o que se lanca fica
   preso naquele computador e ninguem da rede enxerga. Antes isso
   so aparecia como um texto pequeno no rodape e passava batido.
   ---------------------------------------------------------- */
function conferirNuvem(){
  try{
    var el=document.getElementById('avisoNuvem');
    /* Conectado, conectando ou o dono da plataforma (que nao tem loja para
       sincronizar): nada a avisar. */
    if(NUVEM.ligada||CONEXAO==='conectando'||NUVEM.plataforma){ if(el)el.remove(); return; }
    var ap=document.getElementById('app');
    if(!ap||ap.classList.contains('hide')){ if(el)el.remove(); return; }
    var lg=document.getElementById('login');
    if(lg&&!lg.classList.contains('hide')){ if(el)el.remove(); return; }
    if(el)return;
    /* ------------------------------------------------------------------
       Nao existe mais "ligar a nuvem". Se o sistema nao esta conectado com
       uma sessao valida e internet, e porque a internet caiu — e isso o
       sistema resolve sozinho. O aviso agora informa, nao cobra acao.
       ------------------------------------------------------------------ */
    el=document.createElement('div');
    el.id='avisoNuvem';el.className='avisoGrav';
    /* "sem internet" mandava procurar problema no lugar errado: quase sempre
       a internet esta boa e quem nao respondeu foi o servidor. */
    var semNet=!navigator.onLine;
    el.innerHTML='<div><b>'+(semNet?'Sem conexão com a internet'
      :'Servidor não respondeu — reconectando sozinho')+'</b>'+
      '<span>Você pode continuar trabalhando: o que for lançado fica guardado aqui '+
      'e sobe sozinho assim que a conexão voltar.</span></div>';
    barraAvisos().appendChild(el);
  }catch(e){_quieto(e,'conferirNuvem')}
}
setInterval(conferirNuvem,20000);
/* aviso fixo na tela: some so quando a gravacao voltar a funcionar */
function alertaGravacao(msg){
  try{
    var el=document.getElementById('avisoGrav');
    if(!el){
      el=document.createElement('div');
      el.id='avisoGrav';el.className='avisoGrav';
      barraAvisos().appendChild(el);
    }
    el.innerHTML='<div><b>Atenção: o sistema não está conseguindo salvar</b>'+
      '<span>'+E(msg)+'</span></div>'+
      (podeVer('tecnico','backup')
        ?'<button onclick="abrir(\'tecnico\',\'backup\')">Abrir backup</button>'
        :'<button onclick="encolherFotos(true)">Liberar espaço</button>');
  }catch(e){_quieto(e,'alertaGravacao')}
}
/* ==========================================================
   FOTO GRANDE ENCHE A MEMORIA DO NAVEGADOR

   Todo o banco local mora no localStorage, que tem cerca de 5 MB. As fotos
   sao guardadas dentro dele em base64: 25 fotos a 160 KB ja ocupavam 4,2 MB
   e nada mais conseguia ser salvo — o sistema passava a trabalhar so na
   memoria e o F5 voltava ao estado anterior.

   A foto nova ja entra em 520px. Esta rotina cuida das que foram gravadas
   antes disso: reduz cada uma, marca que a loja foi tratada e manda as
   versoes menores para a nuvem, para que os outros aparelhos recebam a
   foto leve em vez de refazerem a conta.
   ========================================================== */
function _encolher1(src,cb){
  if(!src||src.indexOf('data:image')!==0||src.length<=90000){cb(null);return;}
  var im=new Image();
  im.onload=function(){
    try{
      var L=520, esc=Math.min(1,L/(im.width||L));
      var c=document.createElement('canvas');
      c.width=Math.max(1,Math.round((im.width||L)*esc));
      c.height=Math.max(1,Math.round((im.height||L)*esc));
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      var u=c.toDataURL('image/jpeg',0.72);
      if(u.length>90000)u=c.toDataURL('image/jpeg',0.6);
      if(u.length>90000)u=c.toDataURL('image/jpeg',0.45);
      cb(u.length<src.length?u:null);
    }catch(e){_quieto(e,'_encolher1');cb(null);}
  };
  im.onerror=function(){cb(null)};
  im.src=src;
}
function encolherFotos(pedido){
  if(!pedido&&DB._fotosLeves)return;
  var alvos=[];
  (DB.produtos||[]).forEach(function(x){alvos.push([x,'imagem'])});
  (DB.categorias||[]).forEach(function(x){alvos.push([x,'imagem'])});
  (DB.fichas||[]).forEach(function(x){alvos.push([x,'foto'])});
  (DB.insumos||[]).forEach(function(x){alvos.push([x,'foto'])});
  alvos=alvos.filter(function(a){
    var v=a[0][a[1]];
    return v&&String(v).indexOf('data:image')===0&&String(v).length>90000;
  });
  if(!alvos.length){
    DB._fotosLeves=true;salvar();
    if(pedido)toast('As fotos já estão no tamanho leve.');
    return;
  }
  if(pedido)toast('Reduzindo '+alvos.length+' foto(s)...');
  var i=0,antes=0,depois=0;
  (function passo(){
    if(i>=alvos.length){
      DB._fotosLeves=true;
      salvar();
      if(NUVEM.ligada)sincronizar();
      var ganho=Math.round((antes-depois)/1024);
      logNuvem('fotos reduzidas: '+alvos.length+' arquivo(s), '+ganho+' KB liberados');
      toast(alvos.length+' foto(s) reduzida(s) — '+ganho+' KB liberados.');
      return;
    }
    var o=alvos[i][0],campo=alvos[i][1],orig=String(o[campo]||'');
    i++;
    _encolher1(orig,function(novo){
      if(novo){antes+=orig.length;depois+=novo.length;o[campo]=novo;}
      setTimeout(passo,0);
    });
  })();
}
function limparAlertaGravacao(){
  var el=document.getElementById('avisoGrav');if(el)el.remove();
}
/* copia de seguranca do aparelho, guardada antes de qualquer download da nuvem */
function respaldoLocal(motivo){
  try{
    var raw=localStorage.getItem('nexor_dados');
    if(!raw||raw.length<200)return false;
    /* A copia so faz sentido se sobrar espaco para ela. Guardar uma segunda
       copia inteira e o que estourava o limite do navegador — e sem espaco
       o sistema para de salvar, que e muito pior do que ficar sem a copia. */
    if(raw.length>1600000){
      try{localStorage.removeItem('nexor_respaldo');
          localStorage.removeItem('nexor_respaldo_info');}catch(e0){_quieto(e0,'respaldoLocal')}
      logNuvem('base grande ('+Math.round(raw.length/1024)+' KB): cópia local '+
        'desligada para não faltar espaço. O backup da nuvem continua normal.');
      return false;
    }
    localStorage.setItem('nexor_respaldo',raw);
    localStorage.setItem('nexor_respaldo_info',JSON.stringify({
      quando:new Date().toISOString(),motivo:motivo||'',tam:raw.length}));
    return true;
  }catch(e){
    /* sem espaco para a copia: nao e fatal, mas registra */
    logNuvem('não coube a cópia de segurança local',true);
    return false;
  }
}
function infoRespaldo(){
  try{ return JSON.parse(localStorage.getItem('nexor_respaldo_info')||'null'); }
  catch(e){ return null; }
}
/* volta o aparelho para a ultima copia boa, antes do ultimo download */
async function restaurarRespaldo(){
  var raw=null;
  try{ raw=localStorage.getItem('nexor_respaldo'); }catch(e){_quieto(e,'restaurarRespaldo')}
  if(!raw){alert('Não há cópia local guardada neste aparelho.');return;}
  var i=infoRespaldo()||{};
  if(!await pergunta('Voltar este aparelho para a cópia de '+
    (i.quando?new Date(i.quando).toLocaleString('pt-BR'):'antes do último download')+'?\n\n'+
    'O que estiver na tela agora será substituído por essa cópia.\n'+
    'A nuvem não é tocada até você conferir e salvar.'))return;
  try{
    DB=JSON.parse(raw);
    localStorage.setItem('nexor_dados',raw);
    NUVEM.sujo=false;
    alert('Cópia restaurada. Confira os dados antes de sincronizar.');
    location.reload();
  }catch(e){ alert('A cópia está ilegível: '+(e.message||'')); }
}
/* ==========================================================
   P20 — CARIMBO DE ORIGEM (empresa e unidade) NA CRIACAO
   O motor de sincronizacao carimbava a loja DA SESSAO ATUAL em todo
   registro que subia (o.loja_id = l). Consequencia: uma venda criada na
   empresa A, ainda na fila, era enviada como se fosse da empresa B se
   outra pessoa entrasse antes de a fila esvaziar. O dado mudava de dono.
   Agora cada registro recebe _loja e _suc NO MOMENTO EM QUE E GRAVADO —
   que e quando ainda se sabe de quem ele e — e isso nunca mais muda.
   Na hora de enviar, o motor compara: se a origem nao for a empresa da
   sessao, o registro NAO SOBE. Fica esperando.
   ========================================================== */
var _COLS_SEM_CARIMBO={_hash:1,_uuid:1,_snap:1,_contrato:1,lojaAtual:1,_sujo:1,_snapOk:1};
/* marca do que nasceu neste aparelho e ainda nao foi confirmado pela nuvem.
   E ela que impede o download de apagar o registro recem-criado. */
function marcarNovoAqui(x,col){
  try{
    if(!x||typeof x!=='object'||!x.id)return;
    if(DB._uuid&&DB._uuid[col]&&DB._uuid[col][x.id]){ delete x._novoAqui; return; }
    x._novoAqui=true;
  }catch(e){ _quieto(e,'marcarNovoAqui'); }
}
/* ==========================================================
   O REGISTRO CRIADO SEM SESSAO FICAVA PRESO PARA SEMPRE (V193)

   `carimbarOrigem` desistia quando `NUVEM.loja` ainda nao estava
   resolvida — o que acontece nos primeiros segundos apos abrir o
   sistema, e sempre que a sessao demora a responder.

   O registro nascia sem `_loja`. No envio seguinte o motor o marcava
   `_tenantDesconhecido` e o retirava da lista, para nao adotar dado
   orfao dando a ele a empresa de quem esta logado agora — regra certa.

   O problema e que essa marca NUNCA ERA LIMPA. Nao havia caminho de
   volta: o registro ficava retido em silencio, para sempre, e a unica
   pista era um contador numa tela de diagnostico que ninguem abre.

   Foi assim que o produto "Taxa de Entrega" desapareceu tres vezes. A
   categoria subia porque era criada alguns segundos depois, com a
   sessao ja pronta; o produto, criado na sequencia dentro da mesma
   tela, pegava a janela ruim — ou o contrario. Loteria.

   Agora: quando a sessao aparece, o registro orfao E ADOTADO pela
   empresa da sessao, com uma condicao — que ele tenha nascido NESTE
   aparelho e ainda nao conheca a nuvem. Nao ha risco de mudar dado de
   dono: dado de outra empresa tem `_loja` preenchido e continua
   retido, exatamente como antes.
   ========================================================== */
function carimbarOrigem(){
  if(!NUVEM.loja)return 0;                 /* sem sessao nao ha o que carimbar */
  var suc=null; try{suc=lojaAtualId()}catch(e){_quieto(e,'carimbarOrigem')}
  var n=0;
  for(var col in DB){
    if(_COLS_SEM_CARIMBO[col])continue;
    var lista=DB[col];
    if(!Array.isArray(lista))continue;
    for(var i=0;i<lista.length;i++){
      var r=lista[i];
      if(!r||typeof r!=='object')continue;
      if(!r._loja){ r._loja=NUVEM.loja; r._suc=r._suc||suc;
                    r._criadoEm=r._criadoEm||new Date().toISOString(); n++;
                    /* nasceu aqui antes de a sessao existir: agora tem dono e
                       volta para a fila em vez de ficar retido para sempre */
                    if(r._tenantDesconhecido){ delete r._tenantDesconhecido; } }
      /* enquanto a nuvem nao devolveu um identificador para este registro,
         ele so existe aqui — e o download nao pode apaga-lo */
      marcarNovoAqui(r,col);
    }
  }
  return n;
}
/* ==========================================================
   GRAVACAO NO APARELHO SAI DA FRENTE DO CLIQUE
   gravarLocal() transforma o DB inteiro em texto e escreve no aparelho —
   e isso e SINCRONO: enquanto roda, o navegador nao responde a nada. Com o
   volume atual sao centenas de KB, e salvar() e chamado em 178 lugares.
   Clicar num menu logo depois de uma gravacao significa esperar ela acabar.
   Agora a gravacao e adiada para o proximo respiro do navegador. Se a pessoa
   fechar a aba antes, o gancho de saida grava na hora — nada se perde.
   ========================================================== */
/* ==========================================================
   GRAVA AGORA, E SO DEPOIS ECONOMIZA
   A primeira versao ADIAVA a gravacao para o respiro do navegador. Ganhava
   tempo e perdia dado: o login gravava a lista de usuarios, a gravacao ficava
   na fila, e um Ctrl+F5 antes do respiro deixava o aparelho sem ela — o
   sistema abria "sem sessao, acesso limitado". Foi o que aconteceu na
   V45.0.0 e V45.0.1.
   Agora e o contrario: a PRIMEIRA gravacao acontece na hora, sincrona, e as
   seguintes dentro de 400 ms sao agrupadas numa so no fim da janela.
   Digitar cem vezes seguidas continua dando duas gravacoes em vez de cem —
   mas o dado nunca fica so na memoria esperando uma folga que pode nao vir.
   ========================================================== */
var _gravJanela=-99999, _gravPend=false;   /* comeca fora da janela: a 1a grava */
function gravarDepois(){
  var agora=Date.now();
  if(agora-_gravJanela>400){          /* fora da janela: grava JA */
    _gravJanela=agora;
    try{gravarLocal()}catch(e){_quieto(e,'gravarDepois')}
    return;
  }
  if(_gravPend)return;                /* dentro da janela: uma no fim */
  _gravPend=true;
  setTimeout(function(){
    _gravPend=false; _gravJanela=Date.now();
    try{gravarLocal()}catch(e){_quieto(e,'gravarDepois')}
  },400);
}
window.addEventListener('pagehide',function(){
  if(_gravPend){ _gravPend=false; try{gravarLocal()}catch(e){_quieto(e,'pagehide')} }
});
window.addEventListener('visibilitychange',function(){
  if(document.hidden&&_gravPend){ _gravPend=false;
    try{gravarLocal()}catch(e){_quieto(e,'visibilitychange')} }
});
function salvar(){
  carimbarOrigem();                  /* antes de gravar: de quem e este dado */
  /* a marca de "tem coisa para enviar" vai junto com os dados: se o navegador
     fechar antes do envio, no proximo boot o sistema ainda sabe que deve subir
     antes de baixar qualquer coisa. Antes ela so existia na memoria. */
  if(NUVEM.ligada)DB._sujo=true;
  gravarDepois();                    /* grava no aparelho, mas sem travar a tela */
  if(NUVEM.ligada){NUVEM.sujo=true;logNuvem('mudança salva aqui — envio agendado');agendarSync();}
  else logNuvem('mudança salva aqui (nuvem desligada)');
}
/* registro do que acontece na sincronização, para diagnóstico */
/* ==========================================================
   ERRO SILENCIOSO
   Havia 103 blocos `catch(e){_quieto(e,'salvar')}` — o erro era capturado e jogado fora. O
   sistema seguia como se nada tivesse acontecido, e quando algo quebrava
   nao havia rastro nenhum. Foi o que escondeu o botao "Salvar unidade" por
   horas.
   Estes catch nao devem QUEBRAR o sistema (por isso existem: sao coisas
   nao-essenciais, como pintar um icone ou ler uma preferencia). Mas o erro
   passa a ficar registrado, com o lugar onde aconteceu, no diagnostico
   tecnico. Ninguem e incomodado; quem procura, encontra.
   ========================================================== */
/* ==========================================================
   VALIDACAO CENTRAL DE IDENTIFICADORES
   O erro do login veio de JavaScript concatenar null com texto e produzir a
   STRING "null", que o Postgres recebeu como se fosse um uuid. O mesmo vale
   para "undefined", "" e "NaN" — todos parecem valor e nao sao.
   Toda consulta e todo envio passam por aqui antes de sair.
   ========================================================== */
var _RX_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var _NAO_VALOR={'null':1,'undefined':1,'NaN':1,'":"':1,'':1};
function ehUuid(v){
  if(v==null)return false;
  var t=String(v).trim();
  if(_NAO_VALOR[t])return false;
  return _RX_UUID.test(t);
}
/* devolve o uuid, ou null de verdade — nunca a palavra "null" */
function uuidOuNulo(v){ return ehUuid(v)?String(v).trim():null; }
/* limpa um objeto inteiro antes de subir: campo *_id que nao for uuid vira
   null de verdade. Sem isto, um "undefined" perdido derruba a tabela toda. */
function limparIds(o){
  if(!o||typeof o!=='object')return o;
  for(var k in o){
    if(!/(^|_)(id)$/.test(k))continue;
    var v=o[k];
    if(v==null)continue;
    var t=String(v).trim();
    if(_NAO_VALOR[t]||t===''){ o[k]=null; continue; }
    /* ref_local e texto de propósito: só valida o que termina em _id */
    if(!_RX_UUID.test(t)&&k!=='ref_local'&&k!=='motivo_id'&&k!=='sucursal_id'
       &&k!=='operador_id'&&k!=='item_ref'){
      /* identificador local (ins_xxx, ped_xxx) e legitimo em ref_local,
         mas nao numa coluna uuid: registra e anula */
      if(/^(ins|ped|cli|prod|mv|lf|cx|nt)_/.test(t)){ o[k]=null; }
    }
  }
  return o;
}

/* ==========================================================
   CLASSIFICACAO E REGISTRO DE FALHAS
   Tres tipos, tres comportamentos:
     tecnico  -> registra, tenta de novo, nao incomoda ninguem
     funcional-> mensagem curta ligada a acao (estoque insuficiente)
     critico  -> impede a operacao e avisa em linguagem simples
   O operador de caixa nunca ve SQL, uuid, nome de tabela nem pilha de erro.
   ========================================================== */
var DIAGNOSTICO=[];
function classificarErro(e,ctx){
  var m=String((e&&e.message)||e||'').toLowerCase();
  var st=(e&&e.status)||0;
  if(e&&e.rede)return 'tecnico';
  if(st===408||st===429||st>=500)return 'tecnico';
  if(/timeout|network|failed to fetch|conexão|conexao/.test(m))return 'tecnico';
  if(/uuid|syntax|column|relation|violates|constraint|pgrst|row-level/.test(m))return 'tecnico';
  if(e&&e.critico)return 'critico';
  if(e&&e.funcional)return 'funcional';
  return 'tecnico';
}
function registrarFalha(area,onde,msg,extra){
  try{
    DIAGNOSTICO.unshift({
      quando:new Date().toISOString(),
      hora:new Date().toLocaleTimeString('pt-BR'),
      area:area||'', onde:onde||'', msg:String(msg||'').slice(0,400),
      loja:(NUVEM&&NUVEM.loja)||'', unidade:(function(){try{return lojaAtualId()}catch(e){return ''}})(),
      usuario:((NUVEM&&NUVEM.perfil)||{}).nome||'', cargo:((NUVEM&&NUVEM.perfil)||{}).cargo||'',
      tentativa:(extra&&extra.tentativa)||1, situacao:(extra&&extra.situacao)||'pendente',
      extra:extra||{}
    });
    if(DIAGNOSTICO.length>300)DIAGNOSTICO.pop();
    try{localStorage.setItem('nexor_diag',JSON.stringify(DIAGNOSTICO.slice(0,80)));}catch(e){/* nao registra: e o proprio registrador */}
  }catch(x){/* nao registra: e o proprio registrador */}
}
try{ DIAGNOSTICO=JSON.parse(localStorage.getItem('nexor_diag')||'[]'); }catch(e){ DIAGNOSTICO=[]; }

/* ==========================================================
   RETENTATIVA COM ESPERA CRESCENTE
   Falha temporaria (rede, timeout, servidor ocupado) tenta de novo sozinha,
   tres vezes, esperando cada vez mais. Nao e laco infinito, e as operacoes
   criticas continuam idempotentes — reenviar nao duplica.
   ========================================================== */
async function comRetentativa(fn,rot,vezes){
  vezes=vezes||3;
  var espera=[600,1800,4000];
  for(var i=0;i<vezes;i++){
    try{ return await fn(); }
    catch(e){
      var tipo=classificarErro(e);
      registrarFalha('rede',rot||'',((e&&e.message)||'falha'),
        {tentativa:i+1,situacao:(i+1<vezes&&tipo==='tecnico')?'vai tentar de novo':'desistiu'});
      if(tipo!=='tecnico'||i+1>=vezes)throw e;
      await new Promise(function(ok){setTimeout(ok,espera[i]||4000)});
    }
  }
}
var FALHAS=[];
function _quieto(e,onde){
  try{
    if(!e)return;
    registrarFalha('interno',onde,(e&&e.message)||String(e),{situacao:'registrado'});
    FALHAS.unshift({h:new Date().toLocaleTimeString('pt-BR'),
      onde:onde||'',msg:(e&&e.message)||String(e),
      loja:(NUVEM&&NUVEM.loja)||'',cargo:(NUVEM&&NUVEM.perfil&&NUVEM.perfil.cargo)||''});
    if(FALHAS.length>120)FALHAS.pop();
    if(window.console&&console.debug)console.debug('[nexor:'+(onde||'?')+']',e);
  }catch(x){_quieto(x,'_quieto')}
}
function logNuvem(txt,erro){
  NUVEM.log=NUVEM.log||[];
  NUVEM.log.unshift({h:new Date().toLocaleTimeString('pt-BR'),t:txt,e:!!erro});
  if(NUVEM.log.length>60)NUVEM.log.pop();
}
function semear(){
  /* Cliente novo nasce VAZIO. Sem ficha de exemplo, sem insumo de demonstracao,
     sem nada. O Nexor e vendido para empresas diferentes: o que aparecer na tela
     tem de ter sido cadastrado por aquela empresa, nunca inventado pelo sistema.
     Era a ficha 'f1' daqui que abria a porta para os semeadores de exemplo. */
  DB={categorias:[],produtos:[],grupos:[],fichas:[]};
}

/* ---- sincronizacao com a nuvem ---- */
var _timerSync=null;
function agendarSync(){
  clearTimeout(_timerSync);
  /* ==========================================================
     A SINCRONIZACAO ESPERA A PESSOA PARAR DE MEXER
     Cada gravacao agendava um envio para 800 ms depois. Trabalhando, isso
     dispara sem parar — e cada envio percorre 15 tabelas, monta os pacotes e
     ocupa o navegador. O clique de quem esta usando entra na fila atras
     disso, e a tela parece lenta mesmo montando em 30 ms.
     Agora: 2,5 s de silencio antes de enviar, e o envio so comeca quando o
     navegador esta ocioso. Nada e perdido — o envio continua garantido, so
     acontece na folga em vez de na frente do usuario.
     ========================================================== */
  _timerSync=setTimeout(function(){
    if(window.requestIdleCallback){
      requestIdleCallback(function(){sincronizar()},{timeout:4000});
    }else{
      setTimeout(sincronizar,0);
    }
  },2500);
}
async function conectarNuvem(email,senha){
  if(!window.supabase)throw new Error('Biblioteca da nuvem não carregou. Verifique a internet.');
  NUVEM.cli=cliente();
  var r=await NUVEM.cli.auth.signInWithPassword({email:email,password:senha});
  if(r.error)throw r.error;
  var rp=await NUVEM.cli.from('perfis').select('id,nome,cargo,loja_id,empresa_id').eq('id',r.data.user.id).maybeSingle();
  if(rp.error||!rp.data)throw new Error('Usuário sem perfil vinculado a uma loja.');
  NUVEM.perfil=rp.data;NUVEM.loja=rp.data.loja_id;NUVEM.ligada=true;
  NUVEM.token=r.data.session?r.data.session.access_token:null;
  setTimeout(ligarTempoReal,600);
  setModo('nuvem');
  conferirNuvem();
  return true;
}
function desconectarNuvem(){
  try{ if(NUVEM.cli)NUVEM.cli.auth.signOut(); }catch(e){_quieto(e,'desconectarNuvem')}
  desligarTempoReal();
  NUVEM.ligada=false;NUVEM.cli=null;NUVEM.token=null;NUVEM.perfil=null;NUVEM.loja=null;
  setModo('local');rodape();conferirNuvem();
}
/* ao abrir o sistema, volta a ligar a nuvem sem pedir senha de novo */
function temDadosLocais(){
  try{
    return MAPA.some(function(E4){ return (DB[E4.col]||[]).length>0; });
  }catch(e){return false}
}
async function religarNuvem(){
  /* ==========================================================
     A SESSAO MANDA, NAO A BANDEIRA DO APARELHO
     Antes a primeira linha era `if(modo()!=='nuvem') return false` — uma
     marca gravada no localStorage dizendo que ESTE computador estava
     "ligado na nuvem". Limpar o navegador, trocar de maquina ou abrir uma
     aba nova apagava a marca, e o sistema entrava desconectado mesmo com
     sessao valida e internet boa. Era dai que vinha "Este aparelho nao
     esta ligado na nuvem" e o botao "Ligar agora".
     Quem decide agora e a sessao do Auth: se ela existe, o sistema conecta.
     ========================================================== */
  if(!window.supabase)return false;
  var cli=cliente(); if(!cli)return false;
  estadoNuvem('conectando');
  try{
    NUVEM.cli=cli;
    var r=await cli.auth.getSession();
    var ses=r&&r.data?r.data.session:null;
    if(!ses){ estadoNuvem('offline'); return false; }
    /* ==========================================================
       UM ERRO NAO E MOTIVO PARA DESISTIR DA NUVEM

       A leitura do perfil era feita UMA vez. Se falhasse, o sistema se
       declarava desconectado e a loja passava a trabalhar so no
       aparelho. Num dia de instabilidade do servidor — 401 intermitente,
       consulta estourando o tempo — isso derruba os dois computadores ao
       mesmo tempo, com a sessao valida e a internet boa.

       Agora tenta tres vezes, com espera crescente. Na pratica a segunda
       ja costuma passar.
       ========================================================== */
    var rp=null;
    for(var _t=0;_t<3;_t++){
      rp=await cli.from('perfis')
        .select('id,nome,cargo,loja_id,empresa_id,sucursal_ref,nome_unidade')
        .eq('id',ses.user.id).maybeSingle();
      if(rp&&!rp.error&&rp.data)break;
      if(_t<2){
        try{logNuvem('perfil não respondeu — tentando de novo ('+(_t+2)+'ª)');}catch(e){}
        await new Promise(function(r2){setTimeout(r2,900*(_t+1))});
      }
    }
    if(!rp||rp.error||!rp.data){ estadoNuvem('offline'); return false; }
    NUVEM.perfil=rp.data;NUVEM.loja=rp.data.loja_id;NUVEM.ligada=true;
    NUVEM.token=ses.access_token;
    NUVEM.plataforma=(!rp.data.loja_id&&rp.data.cargo==='plataforma');
    setModo('nuvem');
    if(DB._sujo)NUVEM.sujo=true;
    estadoNuvem('online');rodape();
    if(NUVEM.plataforma)return true;          /* dono nao baixa dados de loja */
    setTimeout(ligarTempoReal,400);
    setTimeout(async function(){
      try{
        /* ==========================================================
           SOBE PRIMEIRO, DEPOIS BAIXA
           A ordem estava invertida. O download SUBSTITUI as listas locais
           pelas da nuvem; entao, quando o aparelho reabria com uma venda
           feita offline e ainda nao enviada, o download passava por cima
           dela e o sincronizar() seguinte ja nao tinha o que enviar — a
           venda sumia dos dois lados, sem erro nenhum na tela.
           Simulado: venda offline PERDIDA na ordem antiga, preservada nesta.
           Enviar primeiro custa alguns segundos a mais no arranque. Perder
           o movimento de um dia de loja custa muito mais. */
        estadoNuvem('sincronizando');
        if(temDadosLocais()&&DB._sujo){ await sincronizar(); }
        await baixarDaNuvem();
        estadoNuvem('online');
        if(S.mod&&S.it)abrir(S.mod,S.it);
        try{ await rodarCaixaAssistente(true); ligarCaixaAssistente(); }catch(e){_quieto(e,'religarNuvem')}
      }catch(e){ estadoNuvem('erro',(e&&e.message)||''); }
    },700);
    return true;
  }catch(e){ estadoNuvem('offline'); return false; }
}
/* ==========================================================
   RECONEXAO AUTOMATICA
   Internet caiu e voltou, aba dormiu e acordou: o sistema volta sozinho.
   Nenhum botao.
   ========================================================== */
window.addEventListener('online',function(){
  if(!NUVEM.ligada)religarNuvem();
});
window.addEventListener('offline',function(){ estadoNuvem('offline'); });
document.addEventListener('visibilitychange',function(){
  if(!document.hidden&&!NUVEM.ligada&&navigator.onLine)religarNuvem();
});
/* loja aberta e sistema desconectado custa caro: tenta a cada 8 segundos */
setInterval(function(){
  if(!NUVEM.ligada&&navigator.onLine&&document.getElementById('app')&&
     !document.getElementById('app').classList.contains('hide'))religarNuvem();
},8000);
/* ==========================================================
   MOTOR DE SINCRONIZAÇÃO
   Cada coleção local vira uma linha do MAPA.
   Para acrescentar campo novo: só incluir no "campos".
   ========================================================== */
var MAPA=[
 {col:'contas', espelha:true,      tab:'contas_capital',
  campos:function(x){return {nome:x.nome,tipo:x.tipo||'Banco',banco:x.banco||null,agencia:x.agencia||null,
    numero:x.numero||null,saldo_inicial:n(x.saldoInicial),fixa:x.fixa||null,
    /* `sucursais` sobe: sem isto a liberacao por unidade morre no
       caminho e a loja nao ve o cadastro (V188) */
    sucursais:x.sucursais||[]}}},

 {col:'catfin', espelha:true,      tab:'categorias_financeiras',
  campos:function(x,i){return {nome:x.nome,ordem:i,tipo:x.tipo||'despesa',
    /* `sucursais` sobe: sem isto a liberacao por unidade morre no
       caminho e a loja nao ve o cadastro (V188) */
    sucursais:x.sucursais||[]}},
  filhos:[{lista:'itens',tab:'subcategorias_financeiras',pai:'categoria_id',
    campos:function(o,k){return {nome:o.nome,ordem:k}}}]},

/* ==========================================================
   A UNIDADE NAO ADMINISTRA USUARIOS — E NAO DEVE TENTAR (V196)

   `usuarios_sistema` so aceita gravacao de gestor (admin ou
   plataforma). Isso esta certo: quem cria e altera usuario e a matriz.

   Mas o motor de sincronizacao enviava a tabela de qualquer jeito, a
   cada ciclo, de todo aparelho. O gerente de unidade tomava 403 a cada
   sincronizacao — ruido no Console, banda gasta, e a impressao de que
   o sistema estava quebrado quando na verdade a recusa estava certa.

   `soGestor:true` faz o motor pular a tabela quando quem esta logado
   nao e gestor. Nao afrouxa nada no banco: a politica continua
   identica. Apenas para de bater numa porta que a propria regra manda
   manter fechada.
   ========================================================== */
 {col:'usuarios', espelha:false, soGestor:true,   tab:'usuarios_sistema',
  /* `senha` sobe SEMPRE nulo: a senha nao mora mais na nuvem. Quem manda
     e o Supabase Auth; o aparelho guarda so o hash local, que nunca sobe. */
  campos:function(x){return {nome:x.nome||null,login:x.login||null,senha:null,
    /* o login simples do aplicativo sobe junto: sem isso ele so existiria no
       aparelho onde foi digitado, e o outro computador republicaria com o
       e-mail de volta — a pessoa deixaria de entrar sem ninguem entender */
    login_app:x.loginApp||null,
    /* senha_caixa nao sobe mais: a senha vive so no cofre, como hash */
    ativo:x.ativo!==false,tudo:!!x.tudo,mestre:!!x.mestre,
    sucursais:x.sucursais||[],permissoes:x.permissoes||{}}}},

 {col:'fornec', espelha:false,      tab:'fornecedores',
  campos:function(x){return {empresa:x.empresa,contato:x.nome||null,cnpj:x.cnpj||null,
    email:x.email||null,telefone:x.tel||null,whatsapp:x.whats||null,
    /* `sucursais` sobe: sem isto a liberacao por unidade morre no
       caminho e a loja nao ve o cadastro (V188) */
    sucursais:x.sucursais||[]}}},

 {col:'formasPag', espelha:true,   tab:'formas_pagamento',
  campos:function(x,i){return {nome:x.nome,tipo:x.tipo||'outro',bandeira:x.bandeira||null,
    taxa_pct:n(x.taxaPct),taxa_fixa:n(x.taxaFixa),dias_recebimento:n(x.dias),
    conta_id:fk('contas',x.contaId),ativa:x.ativa!==false,online:!!x.online,ordem:ordemDe(x,i),
    /* `sucursais` sobe: sem isto a liberacao por unidade morre no
       caminho e a loja nao ve o cadastro (V188) */
    sucursais:x.sucursais||[]}}},

 {col:'unidExtra', espelha:true,   tab:'unidades_medida',
  campos:function(x){return {nome:x.n,sigla:x.ab,base:x.base,fator:n(x.f),
    /* `sucursais` sobe: sem isto a liberacao por unidade morre no
       caminho e a loja nao ve o cadastro (V188) */
    sucursais:x.sucursais||[]}}},

 {col:'gruposIng', espelha:false,   tab:'grupos_ingredientes',
  campos:function(x){return {nome:x.nome,compoe_cmv:x.compoeCMV!==false,
    categoria:x.categoria||null,sucursais:x.sucursais||[]}}},

 {col:'insumos', espelha:false,     tab:'insumos',
  campos:function(x){return {nome:x.nome,codigo:x.codigo||null,unidade:x.unidade||'un',
    grupo_id:fk('gruposIng',x.grupoId),
    subcategoria_id:fkSub(x.catFinId),controla_estoque:x.controlaEstoque!==false,
    compoe_cmv:x.compoeCMV!==false,estoque_min:n(x.estoqueMin),estoque_max:n(x.estoqueMax),
    validade:x.validade||null,ean13:x.ean13||null,
    permite_venda:!!x.permiteVenda,embalagem:x.unidadeVenda||null,
    estoque_atual:n(x.estoqueAtual),
    fator:n(x.fator)||1,custo:n(x.custo),custo_ultima:n(x.custoUltima),modo_custo:normModo(x.modoCusto),
    fornecedor_id:fk('fornec',x.fornecedorId),descricao:x.descricao||null,
    gelato_venda:!!x.gelatoVenda,sucursais:x.sucursais||[]}}},

 {col:'fichaCats', espelha:false,   tab:'ficha_grupos',
  campos:function(x){var o={nome:x.nome,
    destino_id:fk('insumos',x.destinoId)||fk('fichas',x.destinoId)||null,sucursais:x.sucursais||[]};
    /* O subgrupo virou linha de verdade em ficha_grupos, com pai_id apontando
       para a pasta. Campo novo NUNCA sobe como null (regra da V81): aparelho
       em versao antiga, que nao conhece pai_id, apagaria o vinculo de todos.
       Se o pai ainda nao tem uuid nesta rodada, o vinculo e gravado no fim
       do envio, junto com os vinculos de producao. */
    if(x.paiId&&_ids[x.paiId])o.pai_id=_ids[x.paiId];
    return o;}},

 {col:'fichas', espelha:false,      tab:'fichas_tecnicas',
  campos:function(x){return {nome:x.nome,codigo:x.codigo||null,grupo_id:fk('fichaCats',x.categoriaId),
    subcategoria_id:fkSub(x.contaId),subgrupo_id:x.subgrupoId||null,unidade:x.unidade||'un',estocavel:x.estocavel!==false,
    na_producao:x.naProducao!==false,
    disponivel_venda:!!x.disponivelVenda,rendimento:n(x.rendimento)||1,rend_unidade:x.rendUnidade||null,
    unidades_venda:n(x.unidadesVenda),preco:n(x.preco),receita:x.receita||null,
    tempo:n(x.tempo),validade:n(x.validade),temperatura:x.temperatura||null,
    observacao:x.obs||null,foto:x.foto||null,ncm:x.ncm||null,cfop:x.cfop||null,cest:x.cest||null,
    origem:x.origem||null,cst:x.cst||null,aliquota:n(x.aliquota),lojas:x.lojas||[],
    destino_id:fk('insumos',x.destinoId)||fk('fichas',x.destinoId)||null,
    destino_fator:n(x.destinoFator)||1,estoque_atual:n(x.estoqueAtual),
    custo_medio:n(x.custoMedio),destino_nome:x.destinoNome||null,
    destino_modo:x.destinoModo||'igual',sucursais:x.sucursais||[]}},
  /* ==========================================================
     O INGREDIENTE PODE SER UMA FICHA — E ISSO DERRUBAVA O LOTE INTEIRO

     A tela de composicao oferece, junto com os insumos, as OUTRAS fichas
     tecnicas (bases, massas). Mas aqui o item subia sempre como
     insumo_id, e essa coluna aponta para a tabela de insumos. Uma base
     escolhida como ingrediente virava uma linha invalida.
     O Postgres recusa o COMANDO inteiro quando uma linha viola a chave —
     nao so a linha errada. Entao bastava UM ingrediente ser uma base para
     que NENHUM ingrediente daquela ficha fosse gravado. No download
     seguinte a ficha voltava com a lista antiga: era o ingrediente
     "sumindo" e o outro "tomando o lugar dele".
     Agora cada item vai para a coluna certa: insumo no insumo_id, ficha
     no ficha_ref. Nenhum dos dois recusa o outro.
     ========================================================== */
  filhos:[{lista:'itens',tab:'ficha_itens',pai:'ficha_id',
    campos:function(o){return {insumo_id:refIngInsumo(o.insumoId),
      ficha_ref:refIngFicha(o.insumoId),quantidade:n(o.qtd),
      unidade:o.unidade||'un',perda:n(o.perda)}}}]},

 /* o caderno sobe para a nuvem: a franqueadora precisa ver a perda de cada
    unidade, e a pessoa nao pode perder o registro se trocar de aparelho */
 {col:'pedidosBase', espelha:true, tab:'pedidos_base',
  /* LISTA, nao objeto. Todo o resto do sistema declara filhos como lista, e o
     codigo faz (m.filhos||[]).forEach(...). Escrevi este como objeto: forEach
     nao existe em objeto, entao a leitura do mapa QUEBRAVA no meio — e tudo
     que vinha depois de pedidosBase deixava de ser processado, inclusive o
     envio dos itens da ficha tecnica. Era o erro vermelho no Console.
     A chave tambem e 'lista', nao 'col', que e como o enviador procura. */
  filhos:[{lista:'itens', tab:'pedido_base_itens', pai:'pedido_id',
    campos:function(x,pai){return {base_ref:x.baseRef,base_nome:x.baseNome,
      ficha_ref:x.fichaRef||null,quantidade:n(x.qtd),
      valor_unit:n(x.valorUnit),total:n(x.total)};}}],
  campos:function(x){return {numero:x.numero||null,sucursal_id:x.sucursalRef,
    sucursal_nome:x.sucursalNome||null,data:x.data||null,
    responsavel:x.responsavel||null,observacao:x.obs||null,total:n(x.total),
    situacao:x.situacao||'rascunho',produzido:!!x.produzido,
    mov_producao_ref:x.movProducaoRef||null,
    financeiro_receber_ref:x.finReceberRef||null,
    entrada_estoque:!!x.entradaEstoque,mov_entrada_ref:x.movEntradaRef||null,
    financeiro_pagar_ref:x.finPagarRef||null,
    enviado_em:x.enviadoEm||null,confirmado_em:x.confirmadoEm||null,
    entregue_em:x.entregueEm||null,pago_em:x.pagoEm||null,
    motivo_rejeicao:x.motivoRejeicao||null};}},
 {col:'basesCat', espelha:true, tab:'bases_catalogo',
  campos:function(x){return {nome:x.nome,qtd_caixa:n(x.qtdCaixa),
    valor_unit:n(x.valorUnit),ficha_ref:x.fichaRef||null,
    ativo:x.ativo!==false,ordem:x.ordem||0};}},
 {col:'baixasPend', espelha:true, tab:'baixas_pendentes',
  campos:function(x){return {
    sucursal_id:x.sucursalRef||null, item_ref:x.itemRef, item_nome:x.itemNome,
    item_tipo:x.itemTipo||'insumo', quantidade:n(x.qtd), unidade:x.unidade||null,
    custo_unit:n(x.custo), motivo_ref:x.motivoRef||null, motivo_nome:x.motivoNome||null,
    quem_registrou:x.quem||null, registrado_por:x.registradoPor||null,
    data:x.data||null, hora:x.hora||null, observacao:x.obs||null,
    situacao:x.situacao||'pendente', mov_ref:x.movRef||null,
    lancada_em:x.lancadaEm||null};}},
 {col:'motivosMov', espelha:true,  tab:'motivos_movimentacao',
  campos:function(x){return {nome:x.nome,tipo:x.tipo,sistema:!!x.sistema,
    ativo:x.ativo!==false,lojas_visiveis:x.lojas||[],
    /* `sucursais` sobe: sem isto a liberacao por unidade morre no
       caminho e a loja nao ve o cadastro (V188) */
    sucursais:x.sucursais||[]}}},

 /* Motivo de cancelamento virou cadastro. Antes era uma lista fixa dentro do
    codigo: o dono da loja nao conseguia trocar sem mexer no sistema. */
 {col:'motivosCanc', espelha:true, tab:'motivos_cancelamento',
  campos:function(x,i){return {nome:x.nome,ativo:x.ativo!==false,ordem:ordemDe(x,i),
    /* `sucursais` sobe: sem isto a liberacao por unidade morre no
       caminho e a loja nao ve o cadastro (V188) */
    sucursais:x.sucursais||[]}}},

 {col:'statusVenda', espelha:true, tab:'status_venda',
  campos:function(x,i){return {nome:x.nome,papel:x.papel||'producao',ordem:ordemDe(x,i),
    ativo:x.ativo!==false,cor:x.cor||null,minutos:n(x.minutos),som:!!x.som,
    confere_pagamento:!!x.confPag,
    /* `sucursais` sobe: sem isto a liberacao por unidade morre no
       caminho e a loja nao ve o cadastro (V188) */
    sucursais:x.sucursais||[]}}},

 {col:'modelosImp', espelha:true, tab:'modelos_impressao',
  campos:function(x){return {tipo:x.tipo,nome:x.nome,colunas:n(x.colunas)||48,
    vias:n(x.vias)||1,corte:x.corte!==false,gaveta:!!x.gaveta,
    modelo:x.modelo||'',blocos:x.blocos||[],manual:!!x.manual,ativo:x.ativo!==false,
    /* `sucursais` sobe: sem isto a liberacao por unidade morre no
       caminho e a loja nao ve o cadastro (V188) */
    sucursais:x.sucursais||[]}}},

 /* Turno tem que vir antes de caixas no MAPA: o caixa aponta para o turno,
    e o vinculo so resolve se o turno ja subiu. */
 {col:'cupons_f', tab:'cupons_fiscais',
  campos:function(x){return {pedido_ref:x.pedidoId||null,pedido_numero:n(x.pedidoNumero),
    origem:x.origem||null,modelo:'65',serie:n(x.serie),numero:n(x.numero),
    chave:x.chave||null,protocolo:x.protocolo||null,status:x.status||'pendente',
    motivo:x.motivo||null,ambiente:x.ambiente||null,
    consumidor_nome:x.consumidor||null,consumidor_doc:x.doc||null,
    pagamento:x.pagamento||null,valor_total:n(x.total),valor_desconto:n(x.desconto),
    valor_entrega:n(x.entrega),data_venda:x.data||null,hora_venda:x.hora||null,
    nfe_agrupada_ref:x.nfeAgrupada||null,contingencia:!!x.contingencia}}},

 {col:'comandas', tab:'mesa_comandas',
  campos:function(x){return {mesa_ref:x.mesaId||null,mesa_numero:n(x.mesaNumero),
    nome:x.nome,itens:x.itens||[],aberta:x.aberta!==false,
    aberta_em:x.abertaEm||null,fechada_em:x.fechadaEm||null,
    pedido_ref:x.pedidoRef||null,sucursal_id:x.sucursalId||null}}},

 {col:'transf', espelha:true, tab:'transferencias',
  campos:function(x){return {numero:n(x.numero),origem_suc:x.origemSuc,destino_suc:x.destinoSuc,
    situacao:x.situacao||'enviada',itens:x.itens||[],valor_total:n(x.valorTotal),
    observacao:x.obs||null,enviada_em:x.enviadaEm||null,enviada_por:x.enviadaPor||null,
    recebida_em:x.recebidaEm||null,recebida_por:x.recebidaPor||null,
    divergencia:!!x.divergencia,data_envio:x.data||null}}},

 {col:'mesas', espelha:true, tab:'mesas',
  campos:function(x){return {numero:n(x.numero),nome:x.nome||null,
    lugares:n(x.lugares)||4,ativa:x.ativa!==false,sucursal_id:x.sucursalId||null}}},

 {col:'turnos', espelha:true, tab:'turnos',
  campos:function(x,i){return {nome:x.nome,hora_inicio:x.ini||null,hora_fim:x.fim||null,
    ativo:x.ativo!==false,ordem:ordemDe(x,i),
    /* `sucursais` sobe: sem isto a liberacao por unidade morre no
       caminho e a loja nao ve o cadastro (V188) */
    sucursais:x.sucursais||[]}}},

 /* O cancelamento tem registro proprio, e nao so um campo no pedido. Assim o
    relatorio nasce de uma trilha, com quem fez, quando e por que. */
 {col:'cancelamentos', tab:'cancelamentos',
  campos:function(x){return {pedido_ref:x.pedidoId||null,pedido_numero:n(x.numero),
    valor:n(x.valor),data:x.data||null,hora:x.hora||null,
    motivo_id:fk('motivosCanc',x.motivoId),motivo_nome:x.motivo||null,
    observacao:x.obs||null,operador_id:x.operadorId||null,operador_nome:x.operador||null,
    caixa_ref:x.caixaId||null,turno_nome:x.turno||null,
    /* sobe junto: sem isso o relatorio nunca saberia se o estoque voltou —
       o mesmo esquecimento que apagou os vinculos de ficha (V143) */
    produzido:(x.produzido==null?null:!!x.produzido),
    estoque_voltou:(x.estoqueVoltou==null?null:!!x.estoqueVoltou)}}},

 {col:'estoqueUn', espelha:true, tab:'estoque_unidade',
  campos:function(x){return {sucursal_id:x.sucursalId,item_ref:x.itemId,
    tipo:x.tipo||'insumo',estoque:n(x.estoque),custo_medio:n(x.custoMedio),
    atualizado_em:x.atualizadoEm||null}}},

 {col:'movEst',      tab:'movimentacoes_estoque',
  campos:function(x){return {data:x.data||null,hora:x.hora||null,
    sucursal_id:x.sucursalId||null,
    motivo_id:fk('motivosMov',x.motivoId),identificacao:x.identificacao||null,
    observacao:x.obs||null,origem:x.origem||null,linhas:x.linhas||[]}}},

 /* ==========================================================
    CADA UNIDADE CONTA A SUA, E ISSO PRECISA SOBREVIVER A SINCRONIZACAO

    A contagem e o inventario fisico de UMA loja. O aparelho ja sabia de
    qual era, mas o campo nao subia e nao descia — na nuvem chegava vazio,
    e o historico da tela listava tudo junto: a contagem de Santa Fe
    aparecia em Jales, com os itens e os valores dela.

    O mesmo valia para a movimentacao e para a ordem de producao: o envio
    mandava a unidade, o download nao lia de volta. Depois da primeira
    sincronizacao todo movimento ficava sem dono na memoria.
    ========================================================== */
 {col:'contagens',   tab:'contagens_estoque',
  campos:function(x){return {data:x.data||null,hora:x.hora||null,
    sucursal_id:x.sucursalId||x.loja||null,
    perda:n(x.perda),ganho:n(x.ganho),resultado:n(x.resultado),itens:x.itens||[]}}},

 {col:'categorias', espelha:true,  tab:'categorias',
  campos:function(x,i){return {nome:x.nome,impressao:x.impressao||null,imposto:x.imposto||null,
    cor:x.cor||null,imagem:x.imagem||null,ativa:x.ativo!==false,ordem:ordemDe(x,i),sucursais:x.sucursais||[]}}},

 {col:'grupos', espelha:true,      tab:'grupos_opcoes',
  /* ==========================================================
     `sucursais` NAO SUBIA — E A LIBERACAO EVAPORAVA NO CAMINHO

     Este cadastro esta na lista de liberaveis desde a V109: a matriz
     libera grupo por grupo na tela de Liberacao por Unidade. Mas o
     campo nunca fez parte do que sobe, e a coluna nem existia no
     banco.

     A matriz liberava, o valor ficava no aparelho dela, e o proximo
     download devolvia o grupo sem `sucursais`. `liberadoNa()` le lista
     vazia como "ninguem" — e Santa Fe abria o produto e via
     "Nenhum grupo cadastrado".

     Campo que existe de um lado e nao do outro. O mesmo padrao que este
     arquivo ja registrou onze vezes.
     ========================================================== */
  campos:function(x,i){return {nome:x.nome,minimo:n(x.min),maximo:(x.max==null?1:Number(x.max)),
    forcado:!!x.forcado,ordem:ordemDe(x,i),canais:x.canais||[],
    sucursais:x.sucursais||[]}},
  /* ==========================================================
     A FICHA DA OPCAO NAO SUBIA — E O TRABALHO SUMIA NO PROXIMO DOWNLOAD

     A tela deixa vincular uma ficha tecnica a cada opcao (borda, cobertura,
     sabor) para a venda baixar estoque. A descida LE `ficha_id`. Mas esta
     subida mandava so nome, preco e ordem: `ficha_id` nunca ia junto.

     Resultado: a pessoa vinculava as 58 opcoes, o botao Salvar dizia que
     salvou, e estava certo — salvou no aparelho. Na nuvem o campo ficava
     nulo. No download seguinte o aparelho recebia nulo de volta e apagava
     o proprio trabalho. Nenhum erro na tela.

     Mesma armadilha da V136 (formaId x forma) e da V135: campo que existe
     na tela e na descida, mas falta na subida, apaga dado em silencio.
     ========================================================== */
  filhos:[{lista:'opcoes',tab:'opcoes',pai:'grupo_id',
    campos:function(o,k){return {nome:o.nome,preco_adicional:n(o.preco),ordem:k,
      ficha_id:fk('fichas',o.fichaId)}}}]},

 {col:'produtos', espelha:true,    tab:'produtos',
  campos:function(x,i){return {nome:x.nome,preco:n(x.preco),codigo:x.codigo||null,
    descricao:x.detalhes||x.descricao||null,categoria_id:fk('categorias',x.categoriaId),
    ativo:x.ativo!==false,ordem:ordemDe(x,i),imagem_url:x.imagem||null,
    imagem:x.imagem||null,disponivel_delivery:x.delivery!==false,
    pesado:!!x.pesado,variacao:!!x.variacao,nome_online:x.nomeOnline||null,
    disponivel:x.disponivel||{},promocoes:x.promocoes||[],vincula_estoque:!!x.vinculaEstoque,
    ncm:x.ncm||null,cfop:x.cfop||null,csosn:x.csosn||null,cst:x.cst||null,
    origem_fiscal:x.origemFiscal||null,cest:x.cest||null,gtin:x.gtin||null,
    unidade_tributavel:x.unTrib||null,
    ficha_id:fk('fichas',x.fichaId),insumo_id:fk('insumos',x.insumoId),
    insumo_qtd:n(x.insumoQtd),insumo_un:x.insumoUn||null,sucursais:x.sucursais||[]}},
  vinculo:{tab:'produto_grupos',pai:'produto_id',campo:'grupo_id',lista:'grupos',ref:'grupos'}},

 {col:'clientes', espelha:true,    tab:'clientes',
  campos:function(x){return {nome:x.nome,telefone:x.tel||null,cpf:x.cpf||null,
    nascimento:x.nascimento||null,rua:x.rua||null,numero:x.numero||null,
    bairro:x.bairro||null,cidade:x.cidade||null,referencia:x.ref||null,
    zona_id:x.zonaId||null,zona:x.zona||null,
    compras:n(x.compras),gasto:n(x.gasto),
    limite_fiado:n(x.limiteFiado),saldo_fiado:n(x.saldoFiado),observacao:x.obs||null}}},

 {col:'entregadores', espelha:true,tab:'entregadores',
  campos:function(x){return {nome:x.nome,telefone:x.tel||null,cpf:x.cpf||null,pix:x.pix||null,
    diarias:x.diarias||{},padrao:!!x.padrao,ativo:x.ativo!==false,
    /* `sucursais` sobe: sem isto a liberacao por unidade morre no
       caminho e a loja nao ve o cadastro (V188) */
    sucursais:x.sucursais||[]}},
  filhos:[{lista:'taxas',tab:'entregador_taxas',pai:'entregador_id',
    campos:function(o){return {cidade:o.cidade,valor:n(o.valor)}}}]},

 {col:'caixas',      tab:'caixas',
  campos:function(x){return {operador:x.operador||null,valor_inicial:n(x.inicial),
    turno_id:fk('turnos',x.turnoId),turno_nome:x.turno||null,operador_id:x.operadorId||null,
    aberto_txt:x.aberto||null,fechado_txt:x.fechadoEm||null,
    /* ==========================================================
       CAIXA ABERTO E O QUE NAO TEM DATA DE FECHAMENTO

       A tabela tem DOIS campos para o fechamento: `fechado_txt`, um
       texto tipo "24/08/2026 13:01", e `fechado_em`, uma data de
       verdade. So o texto era gravado; a data ficava sempre vazia.

       Quem consulta pela data — relatorio, conferencia, qualquer coisa
       fora do aparelho — via TODOS os caixas como abertos, inclusive os
       fechados dias atras. Foi o que me fez concluir errado que havia
       tres caixas abertos ao mesmo tempo.

       Agora as duas sobem juntas, e `aberto_em` tambem: caixa aberto e
       o que tem `fechado_em` nulo, sem ambiguidade.
       ========================================================== */
    aberto_em:dataDoTexto(x.aberto),
    fechado_em:dataDoTexto(x.fechadoEm),
    /* ==========================================================
       ITEM 7 — O CAIXA NAO TINHA UNIDADE

       A tabela `caixas` nao guardava em qual loja o caixa foi aberto, e
       `caixaAberto()` pegava QUALQUER caixa sem fechamento. Com quatro
       unidades no mesmo banco, o caixa aberto no Alphaville aparecia
       como aberto em Santa Fe — e o de Santa Fe podia ser fechado a
       partir de outra loja.

       O rastro esta no banco: um caixa aberto em 20/08 so foi fechado
       em 24/08, e outro atravessou de 24 para 25.
       ========================================================== */
    sucursal_id:x.sucursalId||lojaAtualId()||null,
    esperado:n(x.esperado),contado:n(x.contado),total_informado:n(x.totalInformado),
    vendas:n(x.vendas),qtd_pedidos:n(x.qtd),conferencia:x.conferencia||{},observacao:x.obs||null,
    /* a fotografia do fechamento sobe junto: sem ela na nuvem, reimprimir
       de outro aparelho recalcularia — e o item 19 existe justamente para
       impedir que dois cupons do mesmo caixa saiam diferentes */
    snapshot:x.snapshot||null, esperado_por_forma:x.esperadoPorForma||null,
    fundo_proximo:n(x.fundoProximo), fechado_por:x.fechadoPor||null,
    fechado_por_id:x.fechadoPorId||null,
    diferenca_total:n(x.diferencaTotal), conciliado:x.conciliado===true}},
  filhos:[{lista:'movimentos',tab:'caixa_movimentos',pai:'caixa_id',
    /* destino e lancamento vinham de fora do sync: a sangria subia sem
       dizer para onde o dinheiro foi, e a contrapartida ficava so no
       aparelho que fez a retirada. Campo que existe de um lado e nao do
       outro — o mesmo padrao de sempre. */
    campos:function(o){return {tipo:o.tipo,valor:n(o.valor),motivo:o.motivo||null,
      responsavel:o.responsavel||null,responsavel_id:o.responsavelId||null,
      destino_conta_id:fk('contas',o.destinoContaId),destino_nome:o.destinoNome||null,
      lanc_ref:o.lancRef||null,hora:o.hora||null,
      data_hora:o.data||null}}}]},

 {col:'pedidos',     tab:'pedidos',
  campos:function(x){return {numero:n(x.numero),tipo:x.tipo||'loja',fase:x.fase||'aguardando',
    cliente_id:fk('clientes',x.clienteId),cliente_nome:x.clienteNome||null,cidade:x.cidade||null,
    entregador_id:fk('entregadores',x.entregadorId),caixa_id:fk('caixas',x.caixaId),
    total:n(x.total),taxa:n(x.taxa),desconto:n(x.desconto),fiscal:!!x.fiscal,
    hora:x.hora||null,data_venda:x.data||null,
    mesa_id:fk('mesas',x.mesaId),mesa_numero:n(x.mesa),
    comanda_nome:x.comandaNome||null,taxa_servico:n(x.taxaServico),
    /* Sem isto, o relatorio de canais so funcionava no aparelho que fez a
       venda: o dado subia sem o canal e voltava em branco. Com totem e mesa
       entrando, saber de ONDE veio a venda passa a ser essencial. */
    canal:x.canal||null,origem_venda:x.origem||null,
    /* ==========================================================
       A VENDA TAMBEM PRECISA SABER DE QUAL LOJA E

       O envio nao mandava sucursal_id e o download nao lia. Na memoria a
       venda ficava sem unidade, e todo relatorio que le
       `p.sucursalId||'suc_matriz'` jogava a venda inteira na matriz.
       Com duas lojas operando, o faturamento de Santa Fe apareceria na
       matriz e Santa Fe ficaria zerada.
       ========================================================== */
    sucursal_id:fk('sucursais',x.sucursalId),
    equipamento:x.equipamento||null,senha_totem:n(x.senha)}},
  filhos:[
   {lista:'itens',tab:'pedido_itens',pai:'pedido_id',
    campos:function(o){return {produto_id:fk('produtos',o.produtoId),nome:o.nome,
      quantidade:n(o.qtd),unitario:n(o.unit),total:n(o.total),
      opcoes:o.opcoes||[],observacao:o.obs||null}}},
   {lista:'pagamentos',tab:'pedido_pagamentos',pai:'pedido_id',
    /* ==========================================================
       A FORMA DE PAGAMENTO NAO PODE DEPENDER DO MAPA DO APARELHO

       `fk()` traduz a referencia local no identificador da nuvem usando
       um mapa que o aparelho monta antes de enviar. Quando esse mapa
       falha — releitura vencida, tabela nao lida, aparelho recem-aberto
       — `fk()` devolve NULO, e a venda subia com a forma em branco. Sem
       erro na tela: o caixa fechava a venda achando que estava tudo
       certo, e a noite o fechamento nao batia.

       Aconteceu com as 8 vendas do primeiro dia de operacao em Santa Fe.

       Agora a referencia vai junto (`forma_ref`), e um gatilho no banco
       resolve o vinculo quando o id chega vazio. A forma deixa de
       depender de o aparelho ter o mapa montado.
       ========================================================== */
    campos:function(o){return {forma_id:fk('formasPag',o.forma),forma_ref:o.forma||null,
      valor:n(o.valor),equipamento:o.equipamento||null}}}]},

 {col:'acertos',     tab:'acertos',
  campos:function(x){return {entregador_id:fk('entregadores',x.entregadorId),
    periodo_de:x.de||null,periodo_ate:x.ate||null,qtd:n(x.qtd),taxas:n(x.taxas),
    diaria:n(x.diaria),vendas:n(x.vendas),descontos:n(x.descontos),acrescimos:n(x.acrescimos),
    pago:n(x.pago),conta_id:fk('contas',x.contaId),forma:x.forma||null,
    observacao:x.obs||null,data:x.data||null}}},

 {col:'cupons', espelha:true,      tab:'cupons',
  campos:function(x){return {codigo:x.codigo,tipo:x.tipo,valor:n(x.valor),
    teto:n(x.tetoDesconto),minimo:n(x.minimo),valido_de:x.de||null,valido_ate:x.ate||null,
    hora_de:x.horaDe||null,hora_ate:x.horaAte||null,quantidade:n(x.quantidade),
    limite_cliente:n(x.limiteCliente),formas:x.formas||[],canais:x.canais||[],ativo:x.ativo!==false}}},

 {col:'cupomUsos',   tab:'cupom_usos',
  campos:function(x){return {cupom_id:fk('cupons',x.cupomId),cliente_id:fk('clientes',x.clienteId),
    cliente_nome:x.clienteNome||null,pedido_id:fk('pedidos',x.pedidoId),numero:n(x.numero),
    valor:n(x.valor),total_pedido:n(x.totalPedido),data:x.data||null}}},

 {col:'fiadoMov',    tab:'fiado_movimentos',
  campos:function(x){return {cliente_id:fk('clientes',x.clienteId),tipo:x.tipo,valor:n(x.valor),
    data:x.data||null,pedido_id:fk('pedidos',x.pedidoId),forma_id:fk('formasPag',x.formaId),
    conta_id:fk('contas',x.contaId),observacao:x.obs||null}}},

 {col:'cardapioL', espelha:true, tab:'cardapio_config',
  campos:function(x){return {sucursal_id:fk('sucursais',x.sucId),ativo:x.ativo!==false,
    titulo:x.titulo||null,slogan:x.slogan||null,logo:x.logo||null,capa:x.capa||null,
    cor_principal:x.corPrincipal||'#2F4A32',cor_fundo:x.corFundo||'#F7F3EA',
    whatsapp:x.whatsapp||null,instagram:x.instagram||null,endereco:x.endereco||null,
    pedido_minimo:n(x.pedidoMinimo),tempo_entrega:x.tempoEntrega||null,
    tempo_retirada:x.tempoRetirada||null,aceita_entrega:x.aceitaEntrega!==false,
    aceita_retirada:x.aceitaRetirada!==false,pede_cpf:!!x.pedeCpf,
    formas_aceitas:x.formas||[],pix_chave:x.pixChave||null,
    aviso:x.aviso||null,horarios:x.horarios||[],
    /* ==========================================================
       A DATA PRECISA SUBIR JUNTO

       A V119 pos uma trava: a descida nao escreve por cima quando o
       aparelho tem algo mais novo, comparando `_salvoEm` local com
       `atualizado_em` da nuvem. So que o envio NUNCA mandava
       `atualizado_em` — ele ficava congelado na data de criacao. Com a
       nuvem sempre "mais velha", a trava passou a valer para sempre: o
       aparelho parou de aceitar o que vinha da nuvem, e cada aba ficou
       com a sua propria versao. Foi por isso que o horario "voltava
       sozinho" — era outra aba, com dado velho, gravando por cima.
       ========================================================== */
    atualizado_em:new Date().toISOString()}}},

 {col:'areas', espelha:true, tab:'areas_entrega',
  campos:function(x){return {nome:x.nome,uf:x.uf||null,
    taxa_padrao:n(x.taxaPadrao),tempo:n(x.tempo)}},
  filhos:[{lista:'zonas',tab:'areas_zonas',pai:'area_id',
    campos:function(o,k){return {nome:o.nome,tipo:o.tipo||'bairro',taxa:n(o.taxa),
      km:n(o.km),tempo:n(o.tempo),observacao:o.obs||null,ativa:o.ativa!==false,ordem:k}}}]},

 {col:'sucursais', espelha:false, tab:'sucursais',
  campos:function(x){return {nome:x.nome,apelido:x.apelido||null,cnpj:x.cnpj||null,
    telefone:x.telefone||null,cidade:x.cidade||null,uf:x.uf||null,
    matriz:!!x.matriz,ativa:x.ativa!==false,
    mensalidade:n(x.mensalidade),dia_vencimento:x.diaVenc||null,
    /* ==========================================================
       REATIVAR UMA UNIDADE TEM DE APAGAR A MARCA DE EXCLUIDA
       A Jolo Jales foi reativada com valor e vencimento e mesmo assim nao
       aparecia nas Mensalidades: a marca de excluida continuava la, e a
       consulta esconde tudo o que esta marcado. O envio nunca mexia neste
       campo, entao a marca era eterna.
       Aqui o nulo e intencional — "esta viva" — e por isso vai. Quando a
       unidade esta inativa o campo e OMITIDO, para nao apagar a data de
       exclusao de quem foi excluido de verdade.
       ========================================================== */
    excluida_em:(x.ativa!==false?null:undefined),
    /* Vazio aqui NAO significa "apague o que esta la". O aparelho que ainda
       nao baixou este campo mandaria null e apagaria o vinculo na nuvem —
       envio acontece antes do download, entao o vazio venceria sempre. */
    login_responsavel:(x.loginResp||undefined),
    rede_id:x.redeId||null,rede_nome:x.redeNome||null}}},

 {col:'ordensProd',  tab:'ordens_producao',
  campos:function(x){return {numero:x.numero||null,data:x.data||null,hora:x.hora||null,
    responsavel:x.resp||null,observacao:x.obs||null,previsto:n(x.previsto),
    real_produzido:n(x.real),diferenca:n(x.diferenca),itens:x.itens||[],mov_id:x.movId||null}}},

 {col:'notas',       tab:'notas_entrada',
  campos:function(x){return {numero:x.numero||null,fornecedor_id:fk('fornec',x.fornecedorId),
    fornecedor_nome:x.fornecedorNome||null,data:x.data||null,hora:x.hora||null,
    valor_mercadorias:n(x.valorMercadorias),valor_total:n(x.valorTotal),
    recebida:x.receber!==false,pagamento:x.pagamento||{},itens:x.itens||[]}}},

 {col:'clientesNexor',tab:'clientes_nexor',espelha:false,
  campos:function(x){return {rede:x.rede,responsavel:x.responsavel||null,email:x.email||null,
    telefone:x.telefone||null,documento:x.documento||null,cidade:x.cidade||null,uf:x.uf||null,
    unidades:parseInt(x.unidades)||1,plano:x.plano||null,mensalidade:n(x.mensalidade),
    loja_id:x.lojaId||null,modulos:x.modulos||[],
    dia_vencimento:parseInt(x.diaVenc)||10,situacao:x.situacao||'ativo',
    inicio:x.inicio||null,observacao:x.obs||null,cobrancas:x.cobrancas||[]}}},

 {col:'comprasSemVinc',tab:'compras_sem_vinculo',espelha:true,
  campos:function(x){return {nota_id:x.notaId||null,nota_numero:x.notaNumero||null,
    fornecedor_nome:x.fornecedor||null,descricao:x.descricao||null,
    documento:x.documento||null,valor:n(x.valor),vencimento:x.vencimento||null,
    excluido_por:x.excluidoPor||null,excluido_em:x.excluidoEm||null,
    dados:{itens:x.itens||[],lanc:x.lanc||null}}}},

 {col:'lancFin',     tab:'lancamentos_financeiros',
  campos:function(x){return {tipo:x.tipo,conta_id:fk('contas',x.contaId),
    conta_destino_id:fk('contas',x.contaDestinoId),forma_id:fk('formasPag',x.metodoId),
    subcategoria_id:fkSub(x.categoriaId),categoria_texto:x.categoriaTxt||null,
    fornecedor_id:fk('fornec',x.fornecedorId),fornecedor_nome:x.fornecedor||null,
    descricao:x.descricao,documento:x.documento||null,valor:n(x.valor),
    codigo_barras:x.codigoBarras||null,
    emissao:x.emissao||null,vencimento:x.vencimento||null,pagamento:x.pagamento||null,
    pago:!!x.pago,conciliado:!!x.conciliado,data_conciliacao:x.dataConc||null,
    juros:n(x.juros),multa:n(x.multa),valor_original:(x.valorOriginal!==undefined?n(x.valorOriginal):null),
    /* de onde este lançamento veio (a nota, o fechamento de caixa...).
       Sem isto, o vínculo se perdia em toda sincronização. */
    origem:x.origem||null,origem_ref:x.ref||null,observacao:x.obs||null}}}
];

function n(v){var x=Number(v);return isNaN(x)?0:x}
var _ids={};                       /* ref_local -> uuid do banco */
/* ordem ZERO e uma ordem valida. Usar "||" fazia o primeiro item da lista
   subir com o indice no lugar da ordem: a nuvem devolvia outro numero, a
   lista reordenava, o indice mudava e subia de novo — a tela ficava se
   refazendo sozinha, sem parar. */
function ordemDe(x,i){
  var o=x&&x.ordem;
  return (o===undefined||o===null||o==='')?i:(Number(o)||0);
}
/* tabelas que servem de destino para algum vinculo */
var _TAB_VINCULO={insumos:'insumos', fichas:'fichas_tecnicas',
  fichaCats:'ficha_grupos', gruposIng:'grupos_ingredientes',
  categorias:'categorias', produtos:'produtos', fornec:'fornecedores',
  contas:'contas_capital', formasPag:'formas_pagamento', clientes:'clientes',
  entregadores:'entregadores', motivosMov:'motivos_movimentacao',
  motivosCanc:'motivos_cancelamento', turnos:'turnos', sucursais:'sucursais',
  mesas:'mesas', cupons:'cupons', caixas:'caixas', pedidos:'pedidos'};
var _MAPA_LIDO=0;
async function montarMapaVinculos(loja, forcar){
  DB._uuid=DB._uuid||{};
  /* o que este aparelho ja sabe entra primeiro */
  Object.keys(DB._uuid).forEach(function(c){
    var mp=DB._uuid[c]||{};
    Object.keys(mp).forEach(function(r){ _ids[r]=mp[r]; });
  });
  if(!loja)return;
  /* Ler as 19 tabelas a CADA envio era caro demais: com o envio acontecendo
     em laco, virou a propria causa do congelamento. O mapa muda pouco —
     basta relê-lo de tempos em tempos, ou quando um vinculo faltar. */
  if(!forcar && _MAPA_LIDO && (Date.now()-_MAPA_LIDO)<5*60*1000)return;
  _MAPA_LIDO=Date.now();
  var cols=Object.keys(_TAB_VINCULO);
  for(var i=0;i<cols.length;i++){
    var col=cols[i], tab=_TAB_VINCULO[col];
    try{
      var r=await api(tab+'?loja_id=eq.'+loja+'&select=id,ref_local&limit=5000');
      if(!r||!r.length)continue;
      DB._uuid[col]=DB._uuid[col]||{};
      for(var k=0;k<r.length;k++){
        var x=r[k];
        if(!x||!x.id)continue;
        var ref=x.ref_local||x.id;
        _ids[ref]=x.id;
        DB._uuid[col][ref]=x.id;
      }
    }catch(e){
      /* tabela sem loja_id ou sem permissao: segue com o que ja tem */
      logNuvem('mapa de vínculos: não li '+tab+' ('+
        String((e&&e.message)||e).slice(0,60)+')');
    }
  }
}
function fk(col,ref){
  if(!ref)return null;
  if(_ids[ref])return _ids[ref];
  /* o registro aponta para algo que a nuvem ainda não conhece: avisa em vez de
     gravar um vínculo vazio que ninguém percebe */
  _fkPerdido[col+':'+ref]=true;
  return null;
}
var _fkPerdido={};
/* ==========================================================
   _ids E UMA LISTA UNICA PARA TODAS AS TABELAS
   fk('insumos', ref) nao confere se aquele ref e mesmo de um insumo: ele
   so procura na lista. Uma ficha usada como ingrediente era encontrada e
   devolvida como se fosse insumo — e o banco recusava a linha por chave
   estrangeira. Aqui a origem e decidida ANTES de perguntar o vinculo.
   ========================================================== */
function _ehFichaLocal(ref){
  return !!ref&&(DB.fichas||[]).some(function(f){return f.id===ref});
}
function refIngInsumo(ref){ return _ehFichaLocal(ref)?null:fk('insumos',ref); }
function refIngFicha(ref){  return _ehFichaLocal(ref)?fk('fichas',ref):null; }
var _AVISOU_PERM={};
function fkSub(ref){return ref&&_ids[ref]?_ids[ref]:null}

/* ---- chamada direta ao banco (sem depender de biblioteca externa) ---- */
/* pega sempre a credencial vigente — ela expira e precisa ser renovada */
async function tokenAtual(forcar){
  try{
    if(!NUVEM.cli)return NUVEM.token;
    if(forcar){
      var rr=await NUVEM.cli.auth.refreshSession();
      if(rr&&rr.data&&rr.data.session)NUVEM.token=rr.data.session.access_token;
    }else{
      var r=await NUVEM.cli.auth.getSession();
      if(r&&r.data&&r.data.session)NUVEM.token=r.data.session.access_token;
    }
    if(NUVEM.token&&NUVEM.cli.realtime&&NUVEM.cli.realtime.setAuth)
      NUVEM.cli.realtime.setAuth(NUVEM.token);
  }catch(e){_quieto(e,'tokenAtual')}
  return NUVEM.token;
}
/* O token do Supabase vence em uma hora. Antes, api() mandava o que estivesse
   na memória: vencido virava anônimo, e as 15 tabelas com regra de escrita eram
   recusadas de uma vez — sempre em bloco, sempre com "row-level security".
   Agora a sessão é renovada ANTES de vencer, e a recusa por sessão é tratada
   como o que é: falta de credencial, não erro de dado. */
var _tokenAte=0;
async function tokenValido(forcar){
  if(!NUVEM.cli)return NUVEM.token;
  var agora=Date.now();
  if(!forcar&&NUVEM.token&&agora<_tokenAte)return NUVEM.token;
  try{
    var r=await NUVEM.cli.auth.getSession();
    var ses=r&&r.data?r.data.session:null;
    /* renova quando falta menos de 5 minutos, em vez de esperar quebrar */
    var venceEm=ses&&ses.expires_at?ses.expires_at*1000:0;
    if(!ses||forcar||(venceEm&&venceEm-agora<300000)){
      var rr=await NUVEM.cli.auth.refreshSession();
      ses=rr&&rr.data?rr.data.session:null;
      venceEm=ses&&ses.expires_at?ses.expires_at*1000:0;
    }
    if(ses){
      NUVEM.token=ses.access_token;
      _tokenAte=venceEm?venceEm-300000:agora+600000;
      if(NUVEM.cli.realtime&&NUVEM.cli.realtime.setAuth)
        NUVEM.cli.realtime.setAuth(NUVEM.token);
    }else{
      /* a sessão acabou de verdade: parar de fingir que está ligado */
      NUVEM.token=null;_tokenAte=0;NUVEM.ligada=false;
      try{conferirNuvem();rodape();}catch(e){_quieto(e,'tokenValido')}
    }
  }catch(e){_quieto(e,'tokenValido')}
  return NUVEM.token;
}
async function api(caminho,metodo,corpo,extra,_repetiu){
  var h={'apikey':NUVEM.chave,'Content-Type':'application/json'};
  if(NUVEM.cli)await tokenValido();
  if(NUVEM.token)h['Authorization']='Bearer '+NUVEM.token;
  if(extra)for(var k in extra)h[k]=extra[k];
  var tab=String(caminho).split('?')[0];
  var r;
  try{
    r=await fetch(NUVEM.url+'/rest/v1/'+caminho,{method:metodo||'GET',headers:h,
      body:corpo?JSON.stringify(corpo):undefined});
  }catch(eRede){
    /* fetch só falha assim quando a rede caiu: vale uma segunda tentativa */
    if(!_repetiu){
      await new Promise(function(ok){setTimeout(ok,900)});
      return api(caminho,metodo,corpo,extra,true);
    }
    var e1=new Error('sem conexão com a nuvem');
    e1.tabela=tab;e1.rede=true;throw e1;
  }
  var t=await r.text();
  var d=null;
  try{ d=t?JSON.parse(t):null; }catch(e){ d=null; }
  if(!r.ok){
    /* Recusa por credencial: renova e tenta UMA vez. Se a renovação não
       devolver token, a sessão acabou mesmo — repetir só produziria a lista
       de 15 tabelas recusadas, que assusta e não diz o que houve. */
    /* ------------------------------------------------------------------
       401 e sessao. 403 e RLS — a sessao esta viva, o banco e que recusou
       aquela linha. Tratar os dois como "sessao expirou" derrubava a conexao
       inteira por causa de UMA consulta barrada, e enchia a tela de aviso
       durante o uso normal.
       ------------------------------------------------------------------ */
    var porSessao=(r.status===401&&!(d&&d.code==='42501'));
    var porRegra=(r.status===403||(d&&(d.code==='42501'||
      /row-level security/i.test(d.message||''))));
    if(porRegra){
      logNuvem('o banco recusou '+tab+' por regra de acesso (RLS) · loja='+
        (NUVEM.loja||'sem loja')+' · '+((d&&d.message)||'')+' · tentativa '+
        (_repetiu?2:1),true);
      /* a resposta do PostgREST diz QUAL politica recusou; isso era
         descartado e sobrava so "sem permissao", que nao permite agir */
      var eR=new Error('sem permissão para '+tab);
      eR.tabela=tab;eR.status=r.status;eR.regra=true;
      eR.detalhe=(d&&(d.message||d.details||d.hint))||('HTTP '+r.status);
      throw eR;
    }
    if(porSessao&&!_repetiu){
      var tk=await tokenValido(true);
      if(tk)return api(caminho,metodo,corpo,extra,true);
    }
    if(porSessao){
      NUVEM.token=null;_tokenAte=0;
      /* nao anuncia "sessao expirou" e nao desliga: tenta reconectar sozinho.
         So vira offline se a reconexao tambem falhar. */
      logNuvem('token recusado em '+tab+' — tentando reconectar',true);
      var voltou=false;
      try{ voltou=await religarNuvem(); }catch(e3){_quieto(e3,'api')}
      if(voltou&&!_repetiu)return api(caminho,metodo,corpo,extra,true);
      NUVEM.ligada=false;estadoNuvem('offline');
      try{rodape();}catch(e){_quieto(e,'api')}
      var eS=new Error('sem conexão com a nuvem');
      eS.tabela=tab;eS.status=r.status;eS.sessao=true;
      throw eS;
    }
    var e2=new Error((d&&(d.message||d.hint))||('erro '+r.status));
    e2.tabela=tab;e2.status=r.status;
    throw e2;
  }
  return d;
}
/* impressao curta de um registro — e ela que diz se algo mudou desde o ultimo envio */
function hashTexto(t){
  var h=2166136261;
  t=String(t||'');
  for(var i=0;i<t.length;i++){h^=t.charCodeAt(i);h=(h*16777619)>>>0;}
  return h.toString(36);
}
/* grava (insere ou atualiza) pelo ref_local e devolve os ids */
/* O banco exige que TODOS os registros de um envio tenham exatamente as mesmas
   chaves. Um campo que às vezes vale `undefined` (um vínculo que não existe)
   simplesmente some do registro, e aí um tem 12 chaves e o outro 11 — daí o
   "All object keys must match". Aqui os registros são igualados antes de subir:
   quem não tem o campo sobe com ele em branco. Vale para as 41 tabelas. */
function igualarChaves(linhas){
  var todas={};
  linhas.forEach(function(o){
    Object.keys(o).forEach(function(k){
      if(o[k]!==undefined)todas[k]=true;
    });
  });
  var chaves=Object.keys(todas);
  return linhas.map(function(o){
    var novo={};
    chaves.forEach(function(k){ novo[k]=(o[k]===undefined?null:o[k]); });
    return novo;
  });
}
/* A chave que identifica a linha na nuvem. Era so "ref_local", mas ela
   passou a ser unica POR LOJA — sem isso o banco recusa a gravacao inteira
   dizendo que nao existe restricao correspondente.
   Tabela filha (item de ficha, item de pedido) nao tem loja_id: nela a
   chave continua sendo so o ref_local, porque o pai ja isola. */
var _TABS_SEM_LOJA=['ficha_itens','opcoes','produto_grupos','pedido_itens',
 'pedido_pagamentos','entregador_taxas','caixa_movimentos','areas_zonas',
 'subcategorias_financeiras','usuario_permissoes','usuario_sucursais',
 'sucursal_permissoes'];
function chaveConflito(tab){
  return (_TABS_SEM_LOJA.indexOf(tab)>=0)?'ref_local':'loja_id,ref_local';
}
/* ==========================================================
   IDENTIFICADOR REPETIDO NO MESMO LOTE DERRUBA A GRAVACAO INTEIRA

   O Postgres recusa um upsert quando duas linhas do MESMO comando disputam
   a mesma chave: "ON CONFLICT DO UPDATE command cannot affect row a second
   time". A resposta e 500 e NENHUMA linha do lote entra — nem as que estavam
   certas.
   Era isso que limitava a ficha tecnica a poucos ingredientes: bastava dois
   itens acabarem com o mesmo ref_local para o lote inteiro ser recusado, e
   a ficha voltava do download com o que ja havia antes.
   Aqui o lote e limpo antes de sair: identificador repetido fica com a
   ultima versao, e o caso e registrado para nao passar despercebido.
   ========================================================== */
function tirarRepetidos(tab,linhas){
  var vistos={}, saida=[], repetidos=[];
  for(var i=0;i<linhas.length;i++){
    var r=linhas[i]&&linhas[i].ref_local;
    if(r==null||r===''){ saida.push(linhas[i]); continue; }
    if(vistos[r]!==undefined){
      repetidos.push(r);
      saida[vistos[r]]=linhas[i];      /* a ultima vale */
    }else{
      vistos[r]=saida.length;
      saida.push(linhas[i]);
    }
  }
  if(repetidos.length)
    logNuvem(tab+': '+repetidos.length+' identificador(es) repetido(s) no envio — '+
      'mantida a última versão de cada ('+repetidos.slice(0,3).join(', ')+')',true);
  return saida;
}
async function enviar(tab,linhas){
  if(!linhas.length)return [];
  linhas=tirarRepetidos(tab,linhas);
  var out=[];
  for(var i=0;i<linhas.length;i+=200){
    var lote=igualarChaves(linhas.slice(i,i+200));
    var r=await api(tab+'?on_conflict='+chaveConflito(tab),'POST',lote,
      {'Prefer':'resolution=merge-duplicates,return=representation'});
    out=out.concat(r||[]);
  }
  return out;
}
/* apaga na nuvem os registros que não existem mais neste aparelho */
/* Só apaga na nuvem o que este aparelho realmente tinha e o usuário removeu.
   Compara com a foto do último envio bem-sucedido: o que estava lá e sumiu daqui
   foi excluído por você. O que nunca esteve na foto foi criado em outro
   aparelho — e esse nunca é tocado. */
/* O reinício e a limpeza de dados são as ÚNICAS situações em que esvaziar
   uma tabela inteira é intenção, e não falha. Fora delas, a trava segura. */
function autorizarEsvaziar(){NUVEM.podeEsvaziar=Date.now()+120000;}
function podeEsvaziarAgora(){return !!(NUVEM.podeEsvaziar&&Date.now()<NUVEM.podeEsvaziar)}
/* tabelas de cadastro da rede: so a matriz manda nelas */
var TABS_CADASTRO_REDE=['insumos','fichas_tecnicas','produtos','categorias','ficha_grupos',
 'grupos_ingredientes','grupos_opcoes','motivos_movimentacao','motivos_cancelamento',
 'fornecedores','formas_pagamento','categorias_financeiras','contas_capital',
 'unidades_medida','turnos','status_venda','entregadores','modelos_impressao'];
/* ==========================================================
   EXCLUSAO DECLARADA (V201)

   Chamada por quem apaga de verdade, pela tela. E a unica coisa que
   autoriza o espelhamento a apagar da nuvem.
   ========================================================== */
function declararExclusao(col,id){
  if(!col||!id)return;
  DB._apagados=DB._apagados||{};
  DB._apagados[col]=DB._apagados[col]||{};
  DB._apagados[col][id]=true;
}
async function apagarRemovidos(tab,chave,idsAgora){
  try{
    /* veio cortada pelo limite: a ausencia nao significa exclusao */
    if(_CORTADAS&&_CORTADAS[tab]){
      logNuvem('exclusões de '+tab+' não espelhadas: o download veio cortado pelo limite');
      return;
    }
    /* A unidade so BAIXA o cadastro que foi liberado para ela — entao a lista
       dela e menor de proposito. Se ela pudesse espelhar exclusoes, apagaria
       da nuvem tudo o que nao enxerga. Quem apaga cadastro e a matriz. */
    if(TABS_CADASTRO_REDE.indexOf(tab)>=0&&!ehSucMatriz(lojaAtualId())){
      return;
    }
    /* Um aparelho que ainda nao baixou nesta sessao tem uma copia possivelmente
       velha. Deixar ele espelhar exclusoes e como deixar quem chegou atrasado
       decidir o que os outros fizeram. A trava existia no codigo mas nunca era
       conferida — agora e. */
    if(!NUVEM.baixou){
      logNuvem('exclusões de '+tab+' não espelhadas: este aparelho ainda não baixou da nuvem');
      return;
    }
    DB._snap=DB._snap||{};
    var antes=DB._snap[chave]||null;
    if(!antes){DB._snap[chave]=idsAgora.slice();return;}   /* primeira vez: nada a comparar */
    var sumiram=antes.filter(function(id){return idsAgora.indexOf(id)<0});
    if(!sumiram.length){DB._snap[chave]=idsAgora.slice();return;}
    /* Nenhum identificador em comum entre o que havia e o que há agora: isso é
       troca de formato de identificador, não exclusão. Adota a lista nova. */
    if(idsAgora.length&&sumiram.length===antes.length){
      logNuvem(tab+': identificadores mudaram de formato — lista adotada sem apagar nada');
      DB._snap[chave]=idsAgora.slice();
      return;
    }

    /* ---- TRAVAS: apagar tudo de uma vez quase nunca é intenção ----
       Sem elas, um download que veio vazio virava exclusão definitiva na nuvem.
       O _snap NÃO é atualizado quando a trava age: assim o estado anterior
       continua valendo e nada é dado como aceito. */
    if(!idsAgora.length&&!podeEsvaziarAgora()){
      logNuvem('BLOQUEADO: '+tab+' ficaria vazio na nuvem ('+antes.length+
        ' registro(s)). Nada foi apagado.',true);
      return;
    }
    if(sumiram.length>200&&!podeEsvaziarAgora()){
      logNuvem('BLOQUEADO: '+tab+' — '+sumiram.length+' exclusões de uma vez',true);
      return;
    }
    if(antes.length>=10&&sumiram.length>antes.length*0.6&&!podeEsvaziarAgora()){
      logNuvem('BLOQUEADO: '+tab+' — '+sumiram.length+' de '+antes.length+
        ' seriam apagados de uma vez',true);
      avisoSinc('O sistema evitou apagar '+sumiram.length+' de '+antes.length+
        ' registro(s) de '+tab+' na nuvem. Confira antes de continuar.');
      return;
    }

    /* ==========================================================
       AUSENCIA NA LISTA NAO E EXCLUSAO (V201)

       Ate aqui, qualquer registro que sumisse da lista local era
       apagado da nuvem. As travas acima cobrem o caso grosseiro —
       lista vazia, muitos de uma vez — mas nao o caso fino, que e o que
       destruiu o trabalho da loja:

       o produto novo sobe, o filtro de liberacao por unidade o tira da
       lista local, e no ciclo seguinte este codigo conclui que ele foi
       "excluido por voce" e o apaga do banco. Um registro so, dentro de
       todos os limites, sem disparar trava nenhuma.

       Nenhum produto criado pela tela chegou a sobreviver no banco
       desde 20/08. Os 42 que existem vieram todos de uma importacao em
       massa, no mesmo segundo.

       Agora exclusao precisa ser DECLARADA. Quem apaga pela tela marca
       o identificador em `DB._apagados`. O espelhamento apaga da nuvem
       SOMENTE o que esta marcado ali. Sumir da lista por filtro, por
       erro, por contexto errado ou por qualquer outro motivo deixa de
       significar exclusao.

       E a mesma regra que este arquivo ja registrou tres vezes em
       outras formas: ausencia de dado nao e resposta.
       ========================================================== */
    DB._apagados=DB._apagados||{};
    var declarados=DB._apagados[chave]||{};
    var deVerdade=sumiram.filter(function(r){ return declarados[r]===true; });
    var semDeclaracao=sumiram.length-deVerdade.length;
    if(semDeclaracao)
      logNuvem(tab+': '+semDeclaracao+' registro(s) sumiram da lista sem terem sido '+
        'excluídos — mantidos na nuvem',true);
    if(!deVerdade.length){ DB._snap[chave]=idsAgora.slice(); return; }
    await api(tab+'?ref_local=in.('+deVerdade.map(function(r){
      return '"'+String(r).replace(/"/g,'')+'"'}).join(',')+')','DELETE');
    deVerdade.forEach(function(r){ delete declarados[r]; });
    DB._apagados[chave]=declarados;
    DB._snap[chave]=idsAgora.slice();      /* só depois de apagar de verdade */
    logNuvem(tab+': '+deVerdade.length+' excluído(s) por você');
  }catch(e){console.error('apagarRemovidos',tab,e);logNuvem('aviso ao excluir em '+tab,true);}
}

/* apaga os itens de um pai que não existem mais neste aparelho */
async function apagar(tab,campo,valor){
  try{ await api(tab+'?'+campo+'=eq.'+encodeURIComponent(valor),'DELETE'); }
  catch(e){ console.error('apagar',tab,e); }
}

/* ---- sincronização completa ---- */
var RETIDOS={},ORFAOS={},RECUSADAS={};
async function sincronizar(){
  RETIDOS={};ORFAOS={};RECUSADAS={};
  /* ==========================================================
     SESSAO CAIDA PARA A SINCRONIZACAO NA HORA
     No Console apareceram cinco POSTs seguidos com 401: turnos,
     estoque_unidade, sucursais, config_loja, config_operacao. Sem token, o
     banco recusa TUDO — e o motor seguia tentando tabela por tabela, cada
     uma com ida e volta pela rede, a cada gravacao. Quinze tabelas x varias
     tentativas seguram o navegador, e o clique da pessoa fica na fila
     esperando. Era isso que dava a impressao de tela lenta: a tela monta em
     30 ms, mas o clique demorava a CHEGAR nela.
     Agora: sem token, nem comeca. Tenta renovar uma vez; se nao vier,
     avisa e para. Sessao expirada nao melhora tentando de novo.
     ========================================================== */
  if(NUVEM.ligada&&NUVEM.cli){
    var _tk=await tokenValido();
    if(!_tk){
      _tk=await tokenValido(true);
      if(!_tk){
        NUVEM.ligada=false;
        anotarTrava('sessão caiu',0,'sincronização interrompida: sem autorização');
        estadoNuvem('offline');
        avisoSessaoCaiu();
        return;
      }
    }
  }
  if(!NUVEM.ligada){logNuvem('envio cancelado: nuvem desligada',true);return;}
  /* o dono nao tem loja: nao ha dado dele para subir, e subir com loja vazia
     carimbaria o cadastro de alguem sem dono */
  if(NUVEM.plataforma){
    /* O dono nao tem loja: nao existe dado dele para subir. Sem limpar as
       marcas de pendencia aqui, o download seguinte via "tem coisa para
       enviar", chamava o envio, o envio nao fazia nada, e o download se
       cancelava — em laco, a cada 30 segundos, enchendo o diagnostico. */
    NUVEM.sujo=false;DB._sujo=false;
    logNuvem('modo plataforma: não há loja para sincronizar');
    return;
  }
  /* ==========================================================
     NADA SOBE ANTES DE BAIXAR
     Entre o login e a chegada dos dados da nuvem existe uma janela de alguns
     segundos em que o aparelho esta vazio. Qualquer coisa que apareca no DB
     nessa janela nao veio do cliente — veio do proprio sistema. Foi por essa
     porta que 27 insumos e 10 fichas de exemplo subiram como se fossem da
     Rafaelos. Os semeadores foram desligados; esta trava garante que, se
     algum dia nascer outro, ele nao chega na nuvem.
     O envio nao e perdido: fica pendente e sai assim que o download terminar.
     ========================================================== */
  if(NUVEM.zerado&&!NUVEM.baixou){
    NUVEM.pendente=true;
    logNuvem('envio adiado: este aparelho ainda não baixou da nuvem');
    return;
  }
  if(NUVEM.sincronizando){
    NUVEM.pendente=true;
    logNuvem('envio adiado: já havia um em andamento');
    /* trava de segurança: se ficar preso, libera e tenta de novo */
    clearTimeout(NUVEM._destrava);
    NUVEM._destrava=setTimeout(function(){
      if(NUVEM.sincronizando){
        NUVEM.sincronizando=false;
        logNuvem('envio anterior travou — liberando e tentando de novo',true);
        agendarSync();
      }
    },15000);
    return;
  }
  /* 6 segundos era um chute: enviar 45 tabelas passa disso, e os avisos das
     MINHAS proprias gravacoes chegavam depois da pausa acabar — o sistema
     reagia ao proprio barulho e redesenhava a tela. Agora a pausa dura o
     envio inteiro e so e solta no fim. */
  NUVEM.sincronizando=true;statusNuvem('enviando');
  var _tEnvio=Date.now();
  RT.pausa=true;clearTimeout(RT._t);
  await tokenAtual();
  logNuvem('enviando...');
  var etapa='';
  try{
    var l=NUVEM.loja;
    _ids={};
    /* ==========================================================
       O MAPA DE VINCULOS VEM DA NUVEM, NAO DA MEMORIA DESTE APARELHO

       Por que isto existe: fk() traduz "insumo ins_xxx" para o identificador
       que a nuvem deu a ele. Esse mapa vinha so de DB._uuid — o que ESTE
       aparelho enviou um dia. Insumo que chegou por download, ou enviado por
       outro aparelho, ou de antes de DB._uuid existir, ficava de fora: fk()
       devolvia null, a coluna e obrigatoria e o banco recusava a linha.
       Era isso que fazia o ingrediente sumir da ficha ao salvar.

       Na tentativa anterior eu preenchi o mapa durante o DOWNLOAD. Nao
       bastou: quando ha coisa pendente para subir, o download nem acontece —
       e o mapa continuava vazio justamente quando era mais necessario.
       Agora o mapa e montado aqui, no comeco de cada envio, perguntando a
       propria nuvem. Sao consultas minusculas: duas colunas por tabela.
       ========================================================== */
    /* releitura forcada quando o envio anterior deixou vinculo sem resolver:
       ai vale a pena pagar as consultas, porque sem elas o item nao sobe */
    await montarMapaVinculos(l, Object.keys(_fkPerdido||{}).length>0);
    /* o identificador que a nuvem deu a cada registro fica guardado: assim da para
       PULAR o que nao mudou sem perder o vinculo dos filhos com o pai */
    DB._uuid=DB._uuid||{};DB._hash=DB._hash||{};DB._enviados=DB._enviados||{};
    Object.keys(DB._uuid).forEach(function(c9){
      var mp=DB._uuid[c9]||{};
      Object.keys(mp).forEach(function(r9){ _ids[r9]=mp[r9]; });
    });
    /* nenhum registro sobe sem identificação própria — é ela que evita duplicar */
    /* o cardápio é guardado por sucursal: vira lista para subir */
    /* ==========================================================
       A CONFIGURACAO DO CARDAPIO NUNCA SUBIA

       O envio descarta todo registro sem `_loja` — e o marca como
       "tenant desconhecido", em silencio, sem erro na tela. Quem poe o
       carimbo e carimbarOrigem(), que percorre DB e so entra em coleçao
       que e ARRAY. DB.cardapio e um mapa por unidade, nao um array:
       nunca foi carimbado. E DB.cardapioL, derivado dele aqui, nascia
       igualmente sem carimbo — entao era filtrado fora do envio toda
       vez. Por isso o Rafael salvava o nome do cardapio, o campo
       aceitava, e a nuvem continuava com o valor antigo.

       O carimbo agora vem junto: da propria configuracao, se ela ja
       tiver, senao da sessao aberta.
       ========================================================== */
    DB.cardapioL=Object.keys(DB.cardapio||{})
      /* configuracao que nunca foi salva pelo lojista nao sobe */
      .filter(function(k){return !(DB.cardapio[k]||{})._padrao;})
      .map(function(k){
      var o=Object.assign({},DB.cardapio[k]);
      o.id='cc_'+k;o.sucId=k;
      o._loja=DB.cardapio[k]._loja||NUVEM.loja;
      o._suc=DB.cardapio[k]._suc||k;
      return o;
    });
    MAPA.forEach(function(E3){
      var lst=DB[E3.col]||[];
      var vistosId={},vistosNome={},limpa=[];
      lst.forEach(function(x){
        if(!x.id)x.id=uid(E3.col.slice(0,3));
        /* repetido pelo identificador: descarta */
        if(vistosId[x.id])return;
        /* repetido pelo nome dentro do mesmo cadastro: fica o que tem mais conteúdo */
        var chave=(x.nome||x.codigo||'').toString().trim().toLowerCase();
        /* item usado como destino de produção nunca é descartado */
        var ehDestino=(DB.fichas||[]).some(function(ff){return ff.destinoId===x.id})
          ||(DB.fichaCats||[]).some(function(cc){return cc.destinoId===x.id});
        if(ehDestino){vistosId[x.id]=true;limpa.push(x);return;}
        if(chave&&E3.espelha){
          var ant=vistosNome[chave];
          if(ant!==undefined){
            var peso=function(o){
              var n=0;
              (E3.filhos||[]).forEach(function(F3){n+=(o[F3.lista]||[]).length});
              return n;
            };
            if(peso(x)>peso(limpa[ant])){limpa[ant]=x;vistosId[x.id]=true;}
            return;
          }
          vistosNome[chave]=limpa.length;
        }
        vistosId[x.id]=true;
        (E3.filhos||[]).forEach(function(F2){
          /* Duas travas. A primeira tira a repeticao de VERDADE: duas opcoes
             com o mesmo nome e preco no mesmo grupo sao a mesma opcao, e
             manter as duas foi o que encheu o banco.
             A segunda garante identificador estavel — e NUNCA aleatorio,
             porque id sorteado a cada envio cria linha nova toda vez. */
          var lst2=x[F2.lista]||[];
          if(lst2.length){
            var visto={}, limpo=[];
            lst2.forEach(function(o){
              if(!o)return;
              /* ==========================================================
                 ESTA TRAVA APAGAVA OS INGREDIENTES DA FICHA TECNICA

                 Ela foi escrita para OPCOES DE CARDAPIO: duas opcoes com o
                 mesmo nome e o mesmo preco no mesmo grupo sao a mesma opcao.
                 Mas roda para os filhos de TODAS as tabelas — e um item de
                 ficha tecnica nao tem nome nem preco. A chave saia
                 "" + "|" + 0 = "|0" para TODOS os ingredientes. O primeiro
                 entrava, e do segundo em diante todos eram considerados
                 repetidos e descartados — direto de DB.fichas, na memoria.
                 Era isto: o primeiro insumo gravava, o resto sumia em
                 segundos, e o terceiro parecia tomar o lugar do segundo.
                 Filho sem nome nao tem como ser comparado por nome: passa
                 direto. A trava continua valendo para as opcoes.
                 ========================================================== */
              if(!String(o.nome||'').trim()){ limpo.push(o); return; }
              var ch=String(o.nome).trim().toLowerCase()+'|'+(Number(o.preco)||0);
              if(visto[ch])return;
              visto[ch]=true;limpo.push(o);
            });
            if(limpo.length!==lst2.length)
              logNuvem(F2.tab+' em "'+(x.nome||'')+'": '+(lst2.length-limpo.length)+
                ' repetido(s) descartado(s)');
            x[F2.lista]=limpo;lst2=limpo;
          }
          var vf={};
          lst2.forEach(function(o,j){
            if(!o)return;
            if(!o.id)o.id=x.id+'_'+j;
            /* id repetido: desempata pela posicao, nao por sorteio */
            while(vf[o.id])o.id=x.id+'_'+j+'_'+Object.keys(vf).length;
            vf[o.id]=true;
          });
        });
        limpa.push(x);
      });
      if(limpa.length!==lst.length)
        logNuvem(E3.col+': '+(lst.length-limpa.length)+' repetido(s) removido(s)');
      DB[E3.col]=limpa;
    });
    gravarLocal();

    NUVEM.erros=[];
    for(var m=0;m<MAPA.length;m++){
      var E2=MAPA[m];
      etapa=E2.tab;
      /* ------------------------------------------------------------------
         A CARTEIRA DE CLIENTES E DA PLATAFORMA, NAO DA LOJA.
         clientes_nexor guarda o contrato de cada empresa com a Nexor, e so
         o dono grava nela. Mas a tabela estava no MAPA como qualquer outra,
         entao TODA loja tentava reenviar a propria linha a cada
         sincronizacao — e levava um "sem permissao" do banco, corretamente,
         a cada vez. O erro era do sistema tentando, nao da regra.
         ------------------------------------------------------------------ */
      if(E2.tab==='clientes_nexor'&&!ehPlataforma())continue;
      /* mesma razão, outra tabela: usuário é administrado pela matriz.
         A unidade tomava 403 a cada ciclo por tentar o que a regra proíbe. */
      if(E2.soGestor&&!ehMatriz())continue;
      /* Cada tabela é enviada por conta própria. Antes, um único registro
         recusado pelo banco parava a fila inteira e as 40 tabelas seguintes
         nunca subiam — o aparelho ficava "travado" sem dizer onde. */
      try{
      var lista=DB[E2.col]||[];

      /* ---- ENVIO INCREMENTAL ----
         Antes, cada mudanca reenviava o banco inteiro: milhares de linhas e, nas
         tabelas com filhos, UMA chamada por pai. Isso demorava, travava e volta e
         meia era interrompido no meio. Agora sobe so o que mudou desde o ultimo
         envio confirmado — o resto e pulado, inclusive os filhos. */
      var hAnt=DB._hash[E2.col]||{}, hNovo={}, mudou={}, hSalvar={};
      DB._uuid[E2.col]=DB._uuid[E2.col]||{};
      if(lista.length){
        /* ------------------------------------------------------------
           SO SOBE O QUE E DESTA EMPRESA.
           Registro de outra empresa fica na fila ate a pessoa voltar para
           ela. Registro sem origem conhecida (legado, criado antes deste
           carimbo) tambem NAO sobe: e marcado tenant_desconhecido e espera
           resolucao. Nunca se adota um dado orfao dando a ele a empresa
           de quem esta logado agora.
           ------------------------------------------------------------ */
        var _retidos=0,_orfaos=0;
        lista=lista.filter(function(x){
          if(!x||typeof x!=='object')return true;
          if(!x._loja){
            if(x._tenantDesconhecido!==true){x._tenantDesconhecido=true;_orfaos++;}
            return false;
          }
          if(x._loja!==l){_retidos++;return false;}
          return true;
        });
        if(_retidos)RETIDOS[E2.col]=_retidos;
        if(_orfaos){
          ORFAOS[E2.col]=_orfaos;
          /* silencio aqui foi o que fez o produto sumir sem deixar rastro */
          logNuvem(_orfaos+' registro(s) de '+E2.tab+' não subiram: foram criados '+
            'antes de a sessão da empresa estar pronta. Serão enviados assim que '+
            'o sistema recarregar com a sessão ativa.',true);
        }
        if(!lista.length){DB._hash[E2.col]=hAnt;continue;}
        var linhas=lista.map(function(x,i){
          var o=E2.campos(x,i);
          o.loja_id=x._loja;          /* a empresa de ORIGEM, nunca a da sessao */
          o.ref_local=x.id;
          /* a impressao inclui os filhos: mexer num item da ficha tambem conta */
          var extra='';
          (E2.filhos||[]).forEach(function(F9){extra+=JSON.stringify(x[F9.lista]||[])});
          if(E2.vinculo)extra+=JSON.stringify(x[E2.vinculo.lista]||[]);
          hNovo[x.id]=hashTexto(JSON.stringify(o)+extra);
          if(hAnt[x.id]!==hNovo[x.id]||!DB._uuid[E2.col][x.id])mudou[x.id]=true;
          return o;
        });
        var envio=linhas.filter(function(o){return mudou[o.ref_local]});
        var salvos=[];
        if(envio.length){
          salvos=await enviar(E2.tab,envio);
          var faltou=envio.length-((salvos||[]).length);
          logNuvem(E2.tab+': '+envio.length+' de '+linhas.length+' mudaram, '+
            (salvos||[]).length+' confirmado(s)',faltou!==0);
          /* mesma razao: registro do pai que nao subiu nao pode deixar a
             sincronizacao se declarar limpa */
          if(faltou>0){
            NUVEM.erros=NUVEM.erros||[];
            NUVEM.erros.push({tab:E2.tab,
              motivo:faltou+' registro(s) não foram aceitos'});
          }
          if(faltou>0)toast('Atenção: '+faltou+' registro(s) de '+E2.tab+' não foram aceitos pela nuvem.');
        }
        salvos.forEach(function(r){
          if(!r.ref_local)return;
          _ids[r.ref_local]=r.id;DB._uuid[E2.col][r.ref_local]=r.id;
          /* confirmado pela nuvem: deixa de ser "so daqui" */
          var _o=lista.find(function(x){return x.id===r.ref_local});
          if(_o)delete _o._novoAqui;
        });
        /* so marca como enviado o que a nuvem confirmou; o que falhou tenta de novo */
        var confirmados={};
        salvos.forEach(function(r){if(r.ref_local)confirmados[r.ref_local]=true});
        var perdeuVinculo=Object.keys(_fkPerdido).length>0;
        Object.keys(hNovo).forEach(function(ref){
          if(perdeuVinculo)return;                 /* não marca como enviado: tenta de novo */
          if(!mudou[ref]||confirmados[ref])hSalvar[ref]=hNovo[ref];
          else if(hAnt[ref]!==undefined)hSalvar[ref]=hAnt[ref];
        });
        if(perdeuVinculo){
          logNuvem(E2.tab+': vínculo não resolvido ('+Object.keys(_fkPerdido).join(', ')+
            ') — será reenviado',true);
          _fkPerdido={};
        }
        DB._hash[E2.col]=hSalvar;
        DB._enviados[E2.col]=lista.map(function(x){return x.id})
          .filter(function(id){return !!DB._uuid[E2.col][id]});
      }
      /* roda mesmo com a lista vazia — senão apagar o último item nunca chega na nuvem */
      if(E2.espelha)await apagarRemovidos(E2.tab,E2.col,lista.map(function(x){return x.id}));
      if(!lista.length){DB._enviados=DB._enviados||{};DB._enviados[E2.col]=[];continue;}

      /* filhos (opções, itens, parcelas...) */
      if(E2.filhos)for(var f=0;f<E2.filhos.length;f++){
        var F=E2.filhos[f];
        etapa=F.tab;
        for(var k=0;k<lista.length;k++){
          if(!mudou[lista[k].id])continue;      /* pai igual: filhos tambem estao */
          var paiId=_ids[lista[k].id];
          if(!paiId)continue;
          var filhos=lista[k][F.lista]||[];
          /* ==========================================================
             IDENTIFICADOR DO FILHO PRECISA SER ESTAVEL
             Era montado como pai + '_' + (o.id || posicao). Quando o item
             ainda nao tinha id proprio virava pai_0, pai_1... e quando ganhava
             id virava pai_pai_0 — nome DIFERENTE para o MESMO item. A cada
             sincronizacao o espelhamento via os nomes antigos como "sumiram"
             e os apagava, e a posicao ainda fazia o item novo herdar o numero
             de um antigo. Era isso que limitava a ficha a dois ingredientes:
             cada um que entrava derrubava outro.
             Agora: se o item ja tem id proprio, ele E o nome; se nao tem,
             ganha um agora e passa a ter para sempre. */
          /* identificador estavel E unico. Estavel porque o item guarda o
             seu; unico porque dois itens com o mesmo nome derrubam o lote
             inteiro no Postgres (ver tirarRepetidos). */
          /* ==========================================================
             O NOME NA NUVEM E O PROPRIO ID DO ITEM — SEM PREFIXO
             Antes o ref_local era montado colando o id da ficha na frente do
             id do item. Resultado: o item ia para a nuvem com um nome e
             voltava com outro, e o download nao conseguia reconhecer que era
             o mesmo. Era isso que fazia o ingrediente recem-criado ser
             descartado como se nao existisse.
             Agora o nome e exatamente o id do item, dos dois lados. */
          var _usados={};
          var refs=filhos.map(function(o,j){
            if(!o.id)o.id=(lista[k].id)+'_'+j+'_'+Math.random().toString(36).slice(2,8);
            if(_usados[o.id]){
              o.id=(lista[k].id)+'_'+j+'_'+Math.random().toString(36).slice(2,8);
              logNuvem(F.tab+': dois itens tinham o mesmo identificador — '+
                'um foi renomeado');
            }
            _usados[o.id]=true;
            return String(o.id);
          });

          var _falhouFilho=false;
          if(!filhos.length)logNuvem(F.tab+': nenhum item para enviar em "'+(lista[k].nome||'')+'"');
          if(filhos.length){
            var lf=filhos.map(function(o,j){
              var y=F.campos(o,j);
              y[F.pai]=paiId;
              y.ref_local=refs[j];
              return y;
            });
            var sf=await enviar(F.tab,lf);
            var conf=(sf||[]).length;
            logNuvem(F.tab+': '+lf.length+' item(ns), '+conf+' confirmado(s)',
              conf!==lf.length);
            /* ==========================================================
               FILHO QUE NAO SUBIU PRECISA CONTAR COMO ERRO

               ESTA E A CAUSA DO INGREDIENTE QUE SOME.
               Quando a nuvem nao confirmava uma linha de item, isso so ia
               para o registro. A sincronizacao terminava "sem erros", e no
               fim ela limpa a marca de pendente. Sem essa marca, o download
               seguinte esta liberado — e o download SUBSTITUI a ficha pela
               versao da nuvem, que nao tem o ingrediente que acabou de
               falhar. O item somia da tela e o sistema achava que estava
               tudo certo.
               Agora a falha entra na lista de erros: a marca de pendente
               continua, o download nao passa por cima, e o envio e repetido.
               ========================================================== */
            if(conf!==lf.length){
              _falhouFilho=true;
              NUVEM.erros=NUVEM.erros||[];
              NUVEM.erros.push({tab:F.tab,
                motivo:(lf.length-conf)+' item(ns) de "'+
                  (lista[k].nome||F.tab)+'" não foram aceitos'});
              /* o pai volta a contar como NAO enviado, para o proximo envio
                 recalcular e mandar os filhos de novo. hSalvar ja foi gravado
                 em DB._hash antes deste ponto, entao mexe-se ali. */
              try{
                if(DB._hash&&DB._hash[E2.col])delete DB._hash[E2.col][lista[k].id];
              }catch(e8){ _quieto(e8,'reenviarFilhos'); }
            }
            /* ==========================================================
               FALHA DE FILHO DEIXA DE SER SILENCIOSA
               Quando a nuvem recusava uma linha de item, isso ficava so no
               registro do Diagnostico — que ninguem abre. Na tela, a ficha
               parecia salva; no download seguinte ela voltava sem aquele
               ingrediente e a pessoa concluia, com razao, que o sistema
               tinha comido o dado.
               Agora quem esta usando fica sabendo na hora, com o nome do
               que nao subiu. */
            if(conf!==lf.length){
              var okRefs={};
              (sf||[]).forEach(function(r){ if(r.ref_local)okRefs[r.ref_local]=1; });
              var faltaram=lf.filter(function(y){return !okRefs[y.ref_local]});
              var semVinculo=faltaram.filter(function(y){
                return y[F.pai]==null||Object.keys(y).some(function(kk){
                  return /_id$/.test(kk)&&kk!==F.pai&&y[kk]==null; });
              }).length;
              /* tambem sem janela: registrado, nao interrompendo */
              registrarFalha('sincronizacao',F.tab,
                'em "'+(lista[k].nome||F.tab)+'": '+faltaram.length+' de '+
                lf.length+' item(ns) não aceitos'+
                (semVinculo?' ('+semVinculo+' por vínculo não reconhecido)':''),
                {situacao:'será reenviado'});
            }
            sf.forEach(function(r){if(r.ref_local)_ids[r.ref_local]=r.id});
          }
          /* só remove o que sumiu daqui — e apenas se este aparelho estiver atualizado.
             Antes ele apagava tudo e reinseria, o que fazia um aparelho
             desatualizado apagar o que o outro tinha acabado de criar. */
          await apagarRemovidos(F.tab,E2.col+'.'+F.lista+'.'+lista[k].id,refs);

          /* ==========================================================
             OS INGREDIENTES DA FICHA SAO O QUE ESTA NA TELA — NADA ALEM

             O espelhamento acima compara com um RETRATO guardado neste
             aparelho. Linha que chegou a nuvem antes desse retrato existir
             — formato antigo de identificador, aparelho trocado, dado de
             teste — nunca aparecia como "sumida", entao nunca era apagada.
             A cada download ela voltava, e a ficha ganhava sozinha um
             ingrediente que ninguem tinha posto. Era por isso tambem que
             apagar um ingrediente nao adiantava: ele voltava no download.
             Aqui a lista da tela manda: na nuvem fica exatamente o que
             esta aqui. O corte e POR FICHA — nenhuma outra e tocada — e so
             acontece se este aparelho ja baixou nesta sessao e se todos os
             itens subiram sem falha.
             ========================================================== */
          if(F.tab==='ficha_itens'&&NUVEM.baixou&&!_falhouFilho){
            try{
              var qDel='ficha_itens?ficha_id=eq.'+paiId;
              if(refs.length)qDel+='&ref_local=not.in.('+refs.map(function(r){
                return '"'+String(r).replace(/"/g,'')+'"'}).join(',')+')';
              var sobra=await api(qDel,'DELETE',null,
                {'Prefer':'return=representation'});
              if(sobra&&sobra.length)
                logNuvem('ficha_itens: '+sobra.length+' item(ns) que não estão '+
                  'na ficha "'+(lista[k].nome||'')+'" foram removidos da nuvem');
            }catch(eD){
              logNuvem('ficha_itens: não consegui limpar os itens antigos de "'+
                (lista[k].nome||'')+'"',true);
            }
          }
        }
      }

      }catch(eT){
        /* ==========================================================
           SEM PERMISSAO NAO E FALHA DE SINCRONIZACAO
           O banco recusar por regra de acesso (403 / RLS) nao e problema
           temporario: e a resposta CERTA para uma operacao que aquela pessoa
           nao pode fazer. Tratar como falha punha o registro de volta na
           fila, tentava de novo a cada sincronizacao, e a faixa voltava
           eternamente — "sobe na proxima sincronizacao" era mentira, porque
           nunca ia subir.
           Agora: sai da fila, fica registrado no diagnostico do administrador,
           e o operador nao ve nada. A correcao de verdade e a tela nao criar
           a operacao (ver podeCancelarVenda), e isso ja foi feito.
           ========================================================== */
        var _semPerm = (eT&&eT.regra) || (eT&&eT.status===403) ||
          /sem permissão|row-level security|violates row-level/i.test((eT&&eT.message)||'');
        if(_semPerm){
          RECUSADAS[etapa]=((RECUSADAS[etapa]||0)+1);
          registrarFalha('permissao',etapa,
            'o banco recusou: esta conta não tem permissão para gravar em '+etapa,
            {situacao:'não será tentado de novo',codigo:403});
          logNuvem('sem permissão em '+etapa+' — removido da fila, '+
                   'não adianta tentar de novo',true);
          DB._hash[E2.col]=hNovo;   /* considera resolvido: para de tentar */
          /* ==========================================================
             RECUSA POR PERMISSAO PRECISA APARECER PARA QUEM ESTA USANDO
             A decisao de nao insistir esta certa. Errado era o silencio: a
             pessoa cadastrava, a tela dizia salvo, o registro nunca subia e
             no download seguinte sumia. Ela conclui que o sistema comeu o
             dado — e conclui certo, do ponto de vista dela.
             O caso mais comum e conta de plataforma (dono da Joia) mexendo
             em dado de loja: o banco recusa, e deve recusar mesmo. Mas
             precisa dizer isso em portugues, uma vez por sessao e por tabela,
             sem virar praga na tela. */
          if(!_AVISOU_PERM[etapa]){
            _AVISOU_PERM[etapa]=true;
            /* ==========================================================
               ESTE AVISO SAIU DA TELA.
               Virou janela em cima do trabalho, repetindo a cada
               sincronizacao, para um registro antigo preso na fila que nao
               atrapalha nada do que esta sendo cadastrado agora. Interromper
               quem esta trabalhando por causa disso e pior do que o problema.
               A informacao continua inteira — com a conta, os registros e o
               motivo do servidor — em Administracao > Diagnostico do Sistema.
               ========================================================== */
            var _eu=(usuarioLogado()||{}).login||'';
            var _motivo=String((eT&&(eT.detalhe||eT.message))||'').slice(0,200);
            var _refs=(typeof envio!=='undefined'&&envio&&envio.length)
              ? envio.slice(0,3).map(function(o){return o.ref_local}).join(', ')
              : '—';
            registrarFalha('permissao',etapa,
              'a nuvem recusou gravar em '+etapa+' — conta: '+_eu+
              ' · registros: '+_refs+' · servidor: '+_motivo,
              {situacao:'não será tentado de novo',codigo:403});
          }
          continue;
          continue;
        }
        /* dado invalido (400) tambem nao melhora tentando de novo */
        var _invalido = (eT&&eT.status===400) &&
          !/timeout|network|fetch/i.test((eT&&eT.message)||'');
        if(_invalido){
          registrarFalha('dado',etapa,(eT&&eT.message)||'dado recusado',
            {situacao:'precisa de correção; não será tentado de novo',codigo:400});
          logNuvem('dado recusado em '+etapa+': '+((eT&&eT.message)||'')+
                   ' — registrado no diagnóstico',true);
          DB._hash[E2.col]=hNovo;
          continue;
        }
        /* daqui para baixo e falha temporaria de verdade: mantem na fila */
        NUVEM.erros.push({tab:etapa,msg:(eT&&eT.message)||'falha'});
        logNuvem('ERRO em '+etapa+': '+((eT&&eT.message)||'falha')+
          ' — as demais tabelas continuam subindo',true);
        continue;
      }

      /* vínculos N:N (produto <-> grupos) */
      if(E2.vinculo){
        var V=E2.vinculo;
        etapa=V.tab;
        for(var v=0;v<lista.length;v++){
          if(!mudou[lista[v].id])continue;      /* vinculo igual: nao mexe */
          var pid=_ids[lista[v].id];
          if(!pid)continue;
          await apagar(V.tab,V.pai,pid);
          var refs=(lista[v][V.lista]||[]).map(function(r){return _ids[r]}).filter(Boolean);
          if(!refs.length)continue;
          var lv=refs.map(function(g,j){var o={};o[V.pai]=pid;o[V.campo]=g;o.ordem=j;return o});
          await api(V.tab,'POST',lv,{'Prefer':'return=minimal'});
        }
      }
    }

    /* configuração da loja — também isolada: se ela falhar, o resto já subiu */
    etapa='config_loja';
    try{
    var c=cfg();
    await api('config_loja?on_conflict=loja_id','POST',[{loja_id:l,
      loja_aberta:c.lojaAberta!==false,tempo_entrega:n(c.tempoEntrega),
      tempo_retirada:n(c.tempoRetirada),caixa_cego:!!c.caixaCego,
      layout:c.layout||'foto',fases:c.fases||[],cfg_dre:DB.cfgDre||{},cfg_mesa:c.mesa||{},cfg_modos:c.modos||{},cfg_fiscal:c.fiscal||{},cfg_totem:c.totem||{},
    cfg_pdv:{colunas:c.colunas,mostraPreco:c.mostraPreco,
      mostraDesc:c.mostraDesc,botaoGrande:c.botaoGrande}}],
      {'Prefer':'resolution=merge-duplicates,return=minimal'});
    }catch(eC){
      NUVEM.erros.push({tab:'config_loja',msg:(eC&&eC.message)||'falha'});
      logNuvem('ERRO em config_loja: '+((eC&&eC.message)||'falha'),true);
    }

    /* Estas seis viviam SO no navegador de quem cadastrou: nao subiam nem
       desciam. Trocar de aparelho, limpar o navegador ou abrir em outra
       maquina perdia o telefone dos gestores, a conexao da Carla e os
       operadores de caixa — sem nenhum aviso. */
    etapa='config_operacao';
    try{
      await api('config_operacao?on_conflict=loja_id','POST',[{loja_id:l,
        gerente:DB.gerente||{}, zap:DB.zap||{}, canais:DB.canais||{},
        ass_plat:DB.assPlat||{}, redes:DB.redes||[], operadores:DB.operadores||[],
        atualizado_em:new Date().toISOString()}],
        {'Prefer':'resolution=merge-duplicates,return=minimal'});
    }catch(eO){
      NUVEM.erros.push({tab:'config_operacao',msg:(eO&&eO.message)||'falha'});
      logNuvem('ERRO em config_operacao: '+((eO&&eO.message)||'falha'),true);
    }

    /* vínculo de produção que aponta para outra ficha só existe depois
       que todas as fichas subiram — por isso é gravado agora, no fim */
    var pend=[];
    (DB.fichas||[]).forEach(function(f){
      if(!f.destinoId||f.destinoId==='__nenhum')return;
      var alvo=_ids[f.destinoId];
      if(!alvo)return;
      pend.push({tab:'fichas_tecnicas',ref:f.id,campo:'destino_id',uid:alvo});
    });
    (DB.fichaCats||[]).forEach(function(c){
      if(c.destinoId&&_ids[c.destinoId])
        pend.push({tab:'ficha_grupos',ref:c.id,campo:'destino_id',uid:_ids[c.destinoId]});
      /* o subgrupo aponta para a pasta, que pode ter subido na mesma rodada */
      if(c.paiId&&_ids[c.paiId])
        pend.push({tab:'ficha_grupos',ref:c.id,campo:'pai_id',uid:_ids[c.paiId]});
    });
    for(var pz=0;pz<pend.length;pz++){
      try{
        var _pt={};_pt[pend[pz].campo||'destino_id']=pend[pz].uid;
        await api(pend[pz].tab+'?ref_local=eq.'+encodeURIComponent(pend[pz].ref),
          'PATCH',_pt);
      }catch(e){console.error('vinculo',e);}
    }
    if(pend.length)logNuvem(pend.length+' vínculo(s) de produção gravado(s)');

    NUVEM.ultima=new Date();
    /* Uma ou outra tabela com problema de dado nao pode paralisar o aparelho.
       Mas se MUITAS falharem de uma vez, isso e rede ou credencial caindo — e
       ai a pendencia continua marcada, para nada ser baixado por cima. */
    var comDados=MAPA.filter(function(E9){return (DB[E9.col]||[]).length}).length||1;
    var sistemico=(NUVEM.erros||[]).length>=Math.max(3,Math.ceil(comDados/2));
    NUVEM.sujo=sistemico;
    DB._sujo=sistemico;
    if(sistemico)logNuvem('muitas tabelas falharam ('+NUVEM.erros.length+
      ') — parece rede ou credencial; nada será baixado por cima',true);
    _puxadasPresas=0;
    (function(){var a=document.getElementById('avisoEnvio');if(a)a.remove();})();
    if((NUVEM.erros||[]).length){
      var tt=NUVEM.erros.map(function(x){return x.tab}).join(', ');
      logNuvem('tabelas que não subiram: '+tt,true);
      avisoTabelaComErro(NUVEM.erros);
    }else{
      var av=document.getElementById('avisoTab');if(av)av.remove();
    }
    /* o que ficou retido aparece no diagnostico, nao some em silencio */
    var _r=Object.keys(RETIDOS), _o=Object.keys(ORFAOS);
    if(_r.length){
      var tot=_r.reduce(function(a,k){return a+RETIDOS[k]},0);
      logNuvem('RETIDOS: '+tot+' registro(s) de OUTRA empresa não foram enviados ('+
        _r.map(function(k){return k+': '+RETIDOS[k]}).join(' · ')+
        ') — sobem quando alguém dessa empresa entrar',true);
    }
    if(_o.length){
      var tot2=_o.reduce(function(a,k){return a+ORFAOS[k]},0);
      logNuvem('SEM ORIGEM: '+tot2+' registro(s) sem empresa identificada, marcados '+
        'tenant_desconhecido e NÃO enviados ('+
        _o.map(function(k){return k+': '+ORFAOS[k]}).join(' · ')+')',true);
    }
    DB._snapOk=true;
    /* A marca de "tem coisa para enviar" era ligada a cada gravacao e NUNCA
       desligada. Resultado: o sistema achava que havia pendencia para sempre,
       e o download vivia sendo adiado por um envio que ja tinha acontecido.
       Se alguma tabela falhou, a marca fica — ai a pendencia e real. */
    if(!NUVEM.erros||!NUVEM.erros.length){ NUVEM.sujo=false;DB._sujo=false; }
    gravarLocal();
    statusNuvem('ok');
    logNuvem('tudo enviado com sucesso');
    /* ESPERA a marca ficar pronta: seguir sem esperar era o que deixava o
       relogio de 6 s ver um contador "novo" que fui EU mesmo que criei. */
    await marcarVersaoAtual();
    backupDoDia();                 /* uma cópia por dia, sem travar nada */
  }catch(e){
    console.error('[JOIA sync]',etapa,e);
    statusNuvem('erro',etapa+': '+((e&&e.message)||'falha'));
    console.error('SINCRONIZACAO falhou em',etapa,e);
    logNuvem('ERRO em '+etapa+': '+((e&&e.message)||'falha'),true);
    /* o envio parou no meio: a partir daqui NADA pode ser baixado por cima,
       senao o que ficou de fora e apagado do aparelho. */
    NUVEM.sujo=true;DB._sujo=true;
    try{gravarLocal()}catch(e2){_quieto(e2,'sincronizar')}
    toast('Não consegui enviar ('+etapa+'): '+((e&&e.message)||'falha')); 
  }finally{
    NUVEM.sincronizando=false;
    try{MEDIDA.envio=Date.now()-(_tEnvio||Date.now());}catch(e){}
    _ultimoEnvio=Date.now();     /* marca para o tempo real ignorar meu eco */
    /* rabicho: os avisos das minhas gravacoes ainda estao a caminho */
    pausaTempoReal(4000);
    if(NUVEM.pendente){NUVEM.pendente=false;agendarSync();}
  }
}

/* ---- trazer da nuvem ---- */
/* ==========================================================
   UMA TABELA QUE FALHA NAO DERRUBA AS OUTRAS
   Antes, o download inteiro estava num unico try: a primeira tabela que o
   banco recusasse encerrava a leitura, e as 40 seguintes nunca vinham. Foi o
   que aconteceu com contas_capital — o sistema abriria sem cardapio, sem
   estoque e sem financeiro por causa de UMA consulta malformada.
   Agora cada tabela e lida isoladamente, com duas tentativas. A que falhar
   devolve lista vazia, fica registrada no diagnostico, e o resto continua.
   Lista vazia nao apaga nada: a rede de protecao mantem o que ja existe.
   ========================================================== */
var _FALHOU_BAIXA=[];
/* ==========================================================
   TABELA QUE VEIO CORTADA NAO ESPELHA EXCLUSAO
   Tres tabelas espelham exclusoes E baixam com limite: pedidos_base (800),
   transferencias (1.000) e estoque_unidade (20.000). Enquanto o volume for
   menor que o limite, tudo funciona. No dia em que passar, o mais antigo
   deixa de vir no download — e o espelhamento le essa ausencia como "a
   pessoa apagou" e APAGA DA NUVEM de verdade.
   As travas de exclusao em massa nao pegam isso: o transbordo e de um ou
   dois registros por dia, bem abaixo dos limites de 200 e de 60%.
   Aqui a tabela que voltou no limite e marcada como cortada, e o
   espelhamento a ignora. Perde-se a exclusao espelhada dessa tabela; nao se
   perde historico.
   ========================================================== */
var _CORTADAS={};
/* ==========================================================
   AS LEITURAS COMECAM TODAS JUNTAS, MAS SAO USADAS NA ORDEM

   O download fazia 51 leituras em fila indiana: cada uma esperava a
   anterior terminar. A ~180 ms por leitura, sao 9 a 25 segundos parado —
   e era isso que o usuario via como "os nomes aparecem, os valores nao".
   Nenhuma dessas leituras depende do resultado da outra: todas as URLs
   sao montadas a partir do mesmo filtro de loja. Entao elas podem partir
   ao mesmo tempo.
   O corpo do download NAO muda: continua com "await baixarTab(...)" na
   mesma ordem, e o processamento continua sequencial (que e onde ha
   dependencia de verdade — mapa de insumos antes das fichas, por
   exemplo). Aqui embaixo, baixarTab so aproveita a leitura que ja esta
   a caminho, em vez de comecar uma nova.
   ========================================================== */
/* ==========================================================
   MEDICAO DA LENTIDAO — PARA DE ADIVINHAR

   Passei a tarde propondo causas para o "os valores demoram" e errei
   varias. Este relatorio diz, com numero, tres coisas que decidem tudo:
   1. quanto o aparelho tem guardado (se vier 0 KB, ele comeca vazio a
      cada abertura e TODO dado precisa vir da nuvem — sao os 40 s);
   2. quanto tempo levou o envio e quanto levou a leitura;
   3. quais leituras passaram de 400 ms.
   ========================================================== */
var MEDIDA={envio:0,download:0,tabelas:{},boot:{}};
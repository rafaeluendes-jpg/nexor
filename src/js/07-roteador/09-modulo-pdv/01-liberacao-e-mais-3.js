/* ==========================================================
   BLOCO 9 — MÓDULO PDV
   ========================================================== */
var FORMAS=[];
var TIPOS_PG=[
 {id:'dinheiro',n:'Dinheiro',troco:true},
 {id:'debito',n:'Cartão de débito'},
 {id:'credito',n:'Cartão de crédito'},
 {id:'pix',n:'Pix'},
 {id:'voucher',n:'Vale / Voucher'},
 {id:'fiado',n:'Fiado / A prazo'},
 {id:'outro',n:'Outros'}
];
var BANDEIRAS=['—','Visa','Mastercard','Elo','American Express','Hipercard','Alelo','Sodexo','Ticket','VR','Ifood','Outra'];
function baseFormas(){
  if(!DB.formasPag||!DB.formasPag.length){
    DB.formasPag=[
      {id:'fp_dinheiro',nome:'Dinheiro',tipo:'dinheiro',bandeira:'',taxaPct:0,taxaFixa:0,dias:0,contaId:'ct_caixa',ativa:true,online:false,ordem:0},
      {id:'fp_debito',nome:'Cartão débito',tipo:'debito',bandeira:'Mastercard',taxaPct:1.99,taxaFixa:0,dias:1,contaId:'',ativa:true,online:false,ordem:1},
      {id:'fp_credito',nome:'Cartão crédito',tipo:'credito',bandeira:'Mastercard',taxaPct:3.49,taxaFixa:0,dias:30,contaId:'',ativa:true,online:false,ordem:2},
      {id:'fp_pix',nome:'Pix',tipo:'pix',bandeira:'',taxaPct:0,taxaFixa:0,dias:0,contaId:'',ativa:true,online:true,ordem:3},
      {id:'fp_voucher',nome:'Vale / Voucher',tipo:'voucher',bandeira:'',taxaPct:0,taxaFixa:0,dias:30,contaId:'',ativa:true,online:false,ordem:4}
    ];
  }
  syncFormas();
}
/* ==========================================================
   AQUI ESTAVA O TROCO BLOQUEADO

   A conferencia da venda pergunta `forma.troco` para saber se aquela
   forma aceita receber a mais. A lista ANTIGA, escrita no codigo,
   trazia `{id:'dinheiro', n:'Dinheiro', troco:true}`.

   Quando as formas passaram a vir do banco, esta funcao virou a fonte
   da lista — e ela monta o objeto campo a campo, sem `troco`. O banco
   guarda `tipo` ('dinheiro', 'pix', 'debito'...), nunca guardou uma
   coluna `troco`.

   Resultado: `f.troco` passou a ser SEMPRE indefinido. Nem o dinheiro
   dava troco. Venda de R$ 18, cliente entrega R$ 20, a tela calculava
   e mostrava "Troco R$ 2,00" — e o botao de finalizar recusava, com
   uma mensagem que nao fazia sentido nenhum para quem estava no
   balcao.

   E o mesmo padrao que ja apareceu sete vezes neste sistema: campo que
   existe de um lado e nao do outro. Aqui o efeito foi travar a venda em
   dinheiro, que e a forma mais usada na loja.

   O troco agora e deduzido do TIPO, que o banco realmente guarda.
   ========================================================== */
function formaDaTroco(f){
  if(!f)return false;
  if(f.troco===true||f.troco===false)return !!f.troco;   /* respeita quem definiu */
  var t=String(f.tipo||'').toLowerCase();
  return t==='dinheiro'||t==='especie'||t==='cash';
}
function syncFormas(){
  FORMAS=(DB.formasPag||[]).filter(function(f){return f.ativa!==false})
    .sort(function(a,b){return (a.ordem||0)-(b.ordem||0)})
    .map(function(f){return {id:f.id,n:f.nome,tipo:f.tipo,contaId:f.contaId,
      taxaPct:f.taxaPct,taxaFixa:f.taxaFixa,dias:f.dias,
      troco:formaDaTroco(f)}});
}
function formaPag(id){return (DB.formasPag||[]).find(function(f){return f.id===id})||null}
var FASES_DISP=[
 {id:'aguardando',n:'Aguardando preparação'},
 {id:'preparo',n:'Em preparação'},
 {id:'pronto',n:'Pronto / Aguardando retirada'},
 {id:'saiu',n:'Saiu para entrega'},
 {id:'entregue',n:'Entregue / Concluído'},
 {id:'cancelado',n:'Cancelado'}
];



/* ==========================================================
   QR Code — gerador proprio, dentro do sistema
   A loja nao pode depender da internet para imprimir o QR da mesa.
   Modo byte, correcao M, versao escolhida pelo tamanho do texto.
   ========================================================== */
var QRN=(function(){
  /* ---- GF(256) ---- */
  var EXP=new Array(512),LOG=new Array(256);
  (function(){var x=1;for(var i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11D;}
   for(var j=255;j<512;j++)EXP[j]=EXP[j-255];})();
  function mul(a,b){return (a===0||b===0)?0:EXP[LOG[a]+LOG[b]];}
  function polyGer(n){var p=[1];
    for(var i=0;i<n;i++){var q=[];
      for(var j=0;j<=p.length;j++){
        var v=0;
        if(j<p.length)v^=p[j];
        if(j>0)v^=mul(p[j-1],EXP[i]);
        q[j]=v;}
      p=q;}
    return p;}
  function rs(dados,n){
    var g=polyGer(n),res=new Array(n).fill(0);
    for(var i=0;i<dados.length;i++){
      var f=dados[i]^res[0];
      res.shift();res.push(0);
      if(f!==0)for(var j=0;j<n;j++)res[j]^=mul(g[j+1],f);
    }
    return res;}

  /* ---- tabelas da correcao M ---- */
  /* [total de palavras, palavras de correcao por bloco, blocos g1, palavras g1, blocos g2, palavras g2] */
  var M=[null,
   [26,10,1,16,0,0],[44,16,1,28,0,0],[70,26,1,44,0,0],[100,18,2,32,0,0],
   [134,24,2,43,0,0],[172,16,4,27,0,0],[196,18,4,31,0,0],[242,22,2,38,2,39],
   [292,22,3,36,2,37],[346,26,4,43,1,44],[404,30,1,50,4,51],[466,22,6,36,2,37],
   [532,22,8,37,1,38],[581,24,4,40,5,41],[655,24,5,41,5,42],[733,28,7,45,3,46],
   [815,28,10,46,1,47],[901,26,9,43,4,44],[991,26,3,44,11,45],[1085,26,3,41,13,42]];
  var ALIN=[[],[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],
   [6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],
   [6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90]];

  function capacidade(v){
    var t=M[v],ec=t[1],blocos=t[2]+t[4];
    return t[0]-ec*blocos;
  }
  function versaoPara(bytes){
    for(var v=1;v<=20;v++){
      var cci=(v<10)?8:16;
      var bits=4+cci+bytes*8;
      if(bits<=capacidade(v)*8)return v;
    }
    throw new Error('texto longo demais para o QR');
  }

  function montarDados(txt,v){
    var b=[];
    for(var i=0;i<txt.length;i++){
      var c=txt.charCodeAt(i);
      if(c<128)b.push(c);
      else if(c<2048){b.push(192|(c>>6),128|(c&63));}
      else {b.push(224|(c>>12),128|((c>>6)&63),128|(c&63));}
    }
    var bits=[];
    function put(val,n){for(var k=n-1;k>=0;k--)bits.push((val>>k)&1);}
    put(4,4);                                  /* modo byte */
    put(b.length,(v<10)?8:16);                 /* contador */
    for(var j=0;j<b.length;j++)put(b[j],8);
    var cap=capacidade(v)*8;
    for(var t=0;t<4&&bits.length<cap;t++)bits.push(0);   /* terminador */
    while(bits.length%8)bits.push(0);
    var pal=[];
    for(var p=0;p<bits.length;p+=8){
      var x=0;for(var q=0;q<8;q++)x=(x<<1)|bits[p+q];
      pal.push(x);
    }
    var enche=[0xEC,0x11],e=0;
    while(pal.length<capacidade(v))pal.push(enche[e++%2]);
    return pal;
  }

  function intercalar(pal,v){
    var t=M[v],ec=t[1];
    var blocos=[],pos=0;
    var def=[[t[2],t[3]],[t[4],t[5]]];
    def.forEach(function(d){
      for(var i=0;i<d[0];i++){
        var dd=pal.slice(pos,pos+d[1]);pos+=d[1];
        blocos.push({d:dd,e:rs(dd,ec)});
      }
    });
    var out=[],max=0;
    blocos.forEach(function(b){if(b.d.length>max)max=b.d.length});
    for(var i=0;i<max;i++)blocos.forEach(function(b){if(i<b.d.length)out.push(b.d[i])});
    for(var j=0;j<ec;j++)blocos.forEach(function(b){out.push(b.e[j])});
    return out;
  }

  function novaMatriz(n){
    var m=[];for(var i=0;i<n;i++){m.push(new Array(n).fill(null));}
    return m;}
  function porFinder(m,r,c){
    for(var i=-1;i<=7;i++)for(var j=-1;j<=7;j++){
      var y=r+i,x=c+j;
      if(y<0||x<0||y>=m.length||x>=m.length)continue;
      var d=(i>=0&&i<=6&&(j===0||j===6))||(j>=0&&j<=6&&(i===0||i===6))||
            (i>=2&&i<=4&&j>=2&&j<=4);
      m[y][x]=d?1:0;
    }}
  function funcoes(m,v){
    var n=m.length;
    porFinder(m,0,0);porFinder(m,0,n-7);porFinder(m,n-7,0);
    for(var i=8;i<n-8;i++){m[6][i]=(i%2===0)?1:0;m[i][6]=(i%2===0)?1:0;}
    /* O alinhamento so nao entra nos TRES cantos dos finders. Eu pulava
       sempre que a casa ja estivesse ocupada — e a linha de tempo ocupa a
       linha 6, entao o alinhamento do meio nunca era desenhado. Isso so
       aparecia da versao 7 para cima. */
    var al=ALIN[v],ult=al.length-1;
    for(var a=0;a<al.length;a++)for(var b=0;b<al.length;b++){
      if((a===0&&b===0)||(a===0&&b===ult)||(a===ult&&b===0))continue;
      var r=al[a],c=al[b];
      for(var i2=-2;i2<=2;i2++)for(var j2=-2;j2<=2;j2++)
        m[r+i2][c+j2]=(Math.max(Math.abs(i2),Math.abs(j2))!==1)?1:0;
    }
    m[n-8][8]=1;                                    /* modulo escuro */
    /* reserva formato */
    for(var k=0;k<9;k++){
      if(m[8][k]===null)m[8][k]=0;
      if(m[k][8]===null)m[k][8]=0;
    }
    for(var k2=0;k2<8;k2++){
      if(m[8][n-1-k2]===null)m[8][n-1-k2]=0;
      if(m[n-1-k2][8]===null)m[n-1-k2][8]=0;
    }
    if(v>=7){
      for(var i3=0;i3<6;i3++)for(var j3=0;j3<3;j3++){
        m[n-11+j3][i3]=0;m[i3][n-11+j3]=0;
      }
    }
  }
  function colocar(m,dados,v){
    var n=m.length,base=novaMatriz(n);funcoes(base,v);
    var bit=0,cima=true;
    for(var col=n-1;col>0;col-=2){
      if(col===6)col--;
      for(var t=0;t<n;t++){
        var row=cima?(n-1-t):t;
        for(var d=0;d<2;d++){
          var c=col-d;
          if(base[row][c]!==null)continue;
          var b=0;
          if(bit<dados.length*8)b=(dados[bit>>3]>>(7-(bit&7)))&1;
          bit++;
          m[row][c]=b;
        }
      }
      cima=!cima;
    }
  }
  function mascara(k,r,c){
    switch(k){
      case 0:return (r+c)%2===0;
      case 1:return r%2===0;
      case 2:return c%3===0;
      case 3:return (r+c)%3===0;
      case 4:return (Math.floor(r/2)+Math.floor(c/3))%2===0;
      case 5:return ((r*c)%2)+((r*c)%3)===0;
      case 6:return (((r*c)%2)+((r*c)%3))%2===0;
      case 7:return (((r+c)%2)+((r*c)%3))%2===0;
    }
  }
  var FMT=[
   0x5412,0x5125,0x5E7C,0x5B4B,0x45F9,0x40CE,0x4F97,0x4AA0];  /* nivel M, mascaras 0-7 */
  var VER=[0,0,0,0,0,0,0,0x07C94,0x085BC,0x09A99,0x0A4D3,0x0BBF6,0x0C762,0x0D847,
   0x0E60D,0x0F928,0x10B78,0x1145D,0x12A17,0x13532,0x149A6];

  /* Os 15 bits do formato entram do MAIS significativo para o menos, e nesta
     ordem de casas. Eu tinha escrito ao contrario, e o leitor nao entendia
     nem a mascara nem o nivel de correcao. */
  var POS_FMT=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],
               [7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  function aplicarFormato(m,mk,v){
    var n=m.length,f=FMT[mk],bits=[];
    for(var i=14;i>=0;i--)bits.push((f>>i)&1);
    for(var k=0;k<15;k++)m[POS_FMT[k][0]][POS_FMT[k][1]]=bits[k];
    for(var k2=0;k2<7;k2++)m[n-1-k2][8]=bits[k2];        /* copia 2, vertical */
    for(var k3=7;k3<15;k3++)m[8][n-15+k3]=bits[k3];      /* copia 2, horizontal */
    m[n-8][8]=1;
    if(v>=7){
      var vv=VER[v];
      for(var j=0;j<18;j++){
        var bb=(vv>>j)&1;
        m[Math.floor(j/3)][n-11+(j%3)]=bb;
        m[n-11+(j%3)][Math.floor(j/3)]=bb;
      }
    }
  }
  function penal(m){
    var n=m.length,p=0,i,j;
    /* regra 1 — sequencias de 5 ou mais da mesma cor */
    for(i=0;i<n;i++){
      var qc=0,qr=0,uc=null,ur=null;
      for(j=0;j<n;j++){
        var a=m[i][j];
        if(a===uc)qc++; else {if(qc>=5)p+=3+(qc-5);uc=a;qc=1;}
        var b=m[j][i];
        if(b===ur)qr++; else {if(qr>=5)p+=3+(qr-5);ur=b;qr=1;}
      }
      if(qc>=5)p+=3+(qc-5);
      if(qr>=5)p+=3+(qr-5);
    }
    /* regra 2 — blocos 2x2 da mesma cor */
    for(i=0;i<n-1;i++)for(j=0;j<n-1;j++){
      var soma=m[i][j]+m[i][j+1]+m[i+1][j]+m[i+1][j+1];
      if(soma===4||soma===0)p+=3;
    }
    /* regra 3 — o desenho que imita o finder, nos dois sentidos.
       Feito por janela deslizante de 11 bits, como manda a norma. */
    var achou=0;
    for(i=0;i<n;i++){
      var bc=0,br=0;
      for(j=0;j<n;j++){
        bc=((bc<<1)&0x7FF)|m[i][j];
        if(j>=10&&(bc===0x5D0||bc===0x05D))achou++;
        br=((br<<1)&0x7FF)|m[j][i];
        if(j>=10&&(br===0x5D0||br===0x05D))achou++;
      }
    }
    p+=achou*40;
    /* regra 4 — quanto a proporcao de escuro se afasta da metade */
    var esc=0;
    for(i=0;i<n;i++)for(j=0;j<n;j++)esc+=m[i][j];
    var k=Math.abs(Math.ceil((esc*100/(n*n))/5)-10);
    p+=k*10;
    return p;
  }
  function gerar(txt){
    var b=0;
    for(var i=0;i<txt.length;i++){var c=txt.charCodeAt(i);b+=c<128?1:(c<2048?2:3);}
    var v=versaoPara(b);
    var n=17+v*4;
    var pal=montarDados(txt,v);
    var dados=intercalar(pal,v);
    var melhor=null,melhorP=Infinity;
    for(var mk=0;mk<8;mk++){
      var m=novaMatriz(n);funcoes(m,v);
      var base=novaMatriz(n);funcoes(base,v);
      colocar(m,dados,v);
      for(var r=0;r<n;r++)for(var c2=0;c2<n;c2++)
        if(base[r][c2]===null&&mascara(mk,r,c2))m[r][c2]^=1;
      aplicarFormato(m,mk,v);
      var p=penal(m);
      if(p<melhorP){melhorP=p;melhor=m;}
    }
    return melhor;
  }
  return {gerar:gerar};
})();


/* ==========================================================
   CODIGO DE BARRAS DO BOLETO
   Guardar a linha digitavel muda o dia do gerente: em vez de
   procurar o papel, ele recebe o numero pelo WhatsApp e cola no
   aplicativo do banco. Por isso o campo aceita colar sujo — com
   ponto, espaco e traco — e limpa sozinho.
   ========================================================== */
/* mod 10: cada casa da direita para a esquerda multiplica por 2 e 1;
   resultado com duas casas vira a soma dos algarismos */
function mod10(bloco){
  var s=0,p=2;
  for(var i=bloco.length-1;i>=0;i--){
    var v=parseInt(bloco[i],10)*p;
    if(v>9)v=Math.floor(v/10)+(v%10);
    s+=v;p=(p===2)?1:2;
  }
  var r=s%10;
  return r===0?0:10-r;
}
function mod11Arrec(bloco){
  var s=0,p=2;
  for(var i=bloco.length-1;i>=0;i--){
    s+=parseInt(bloco[i],10)*p;
    p++; if(p>9)p=2;
  }
  var r=s%11,d=11-r;
  if(d===0||d===1||d>9)return 0;
  return d;
}
/* Devolve {ok, tipo, digitos, aviso}. Nao recusa: avisa. Boleto com um
   digito trocado precisa ser visto, mas quem lanca pode saber de algo
   que o sistema nao sabe. */
function conferirBoleto(txt){
  var d=soDigitos(txt);
  if(!d)return {ok:false,vazio:true,digitos:''};
  if(d.length===47){
    var c1=d.slice(0,9),v1=d[9],c2=d.slice(10,20),v2=d[20],c3=d.slice(21,31),v3=d[31];
    var erros=[];
    if(mod10(c1)!==+v1)erros.push('1º campo');
    if(mod10(c2)!==+v2)erros.push('2º campo');
    if(mod10(c3)!==+v3)erros.push('3º campo');
    return {ok:!erros.length,tipo:'boleto',digitos:d,
      aviso:erros.length?('dígito verificador não confere no '+erros.join(' e no ')):''};
  }
  if(d.length===48){
    /* conta de consumo: 4 blocos de 12, cada um com seu verificador */
    var oito=d[2];                              /* 6 ou 7 = mod10; 8 ou 9 = mod11 */
    var f=(oito==='6'||oito==='7')?mod10:mod11Arrec;
    var errs=[];
    for(var i=0;i<4;i++){
      var b=d.slice(i*12,i*12+11),dv=d[i*12+11];
      if(f(b)!==+dv)errs.push((i+1)+'º bloco');
    }
    return {ok:!errs.length,tipo:'concessionária',digitos:d,
      aviso:errs.length?('dígito verificador não confere no '+errs.join(', ')):''};
  }
  if(d.length===44)
    return {ok:true,tipo:'código de barras',digitos:d,
      aviso:'são 44 dígitos (código de barras). O ideal é a linha digitável, de 47.'};
  return {ok:false,tipo:'',digitos:d,
    aviso:'tem '+d.length+' dígitos. Boleto tem 47, conta de consumo tem 48.'};
}
/* separa em blocos, como vem impresso no papel */
function boletoBonito(txt){
  var d=soDigitos(txt);
  if(d.length===47)
    return d.slice(0,5)+'.'+d.slice(5,10)+' '+d.slice(10,15)+'.'+d.slice(15,21)+' '+
           d.slice(21,26)+'.'+d.slice(26,32)+' '+d[32]+' '+d.slice(33);
  if(d.length===48)
    return d.slice(0,12)+' '+d.slice(12,24)+' '+d.slice(24,36)+' '+d.slice(36);
  return d;
}
/* aviso embaixo do campo, enquanto a pessoa digita */
function checarCampoBoleto(idCampo,idAviso){
  var c=$(idCampo),a=$(idAviso);
  if(!c||!a)return;
  var r=conferirBoleto(c.value);
  if(r.vazio){a.className='blAviso';a.innerHTML='';return;}
  if(r.ok&&!r.aviso){
    a.className='blAviso ok';
    a.innerHTML=sv('nike',12)+' '+r.tipo+' válido · '+E(boletoBonito(r.digitos));
  }else{
    a.className='blAviso '+(r.ok?'':'ruim');
    a.innerHTML=sv('help',12)+' '+E(r.aviso||'confira o número');
  }
}




/* ==========================================================
   ESTOQUE POR UNIDADE
   O CADASTRO e da rede: acucar cadastrado na matriz e o mesmo
   acucar em Jales e em Sorocaba — nome, unidade, ficha tecnica.
   O SALDO e de cada uma: o que Jales tem no deposito nao tem
   nada a ver com o que Sorocaba tem.

   Antes, "estoqueAtual" morava no proprio item — um numero so para
   as seis lojas. Vender em Jales baixava o estoque de Sorocaba.

   Como foi resolvido sem reescrever os 45 lugares que leem o saldo:
   o numero verdadeiro passa a viver em DB.estoqueUn, por unidade, e
   o campo "estoqueAtual" do item vira um ESPELHO da unidade ativa.
   Quem le continua lendo igual; quem escreve escreve no lugar certo.
   ========================================================== */
function baseEstUn(){DB.estoqueUn=DB.estoqueUn||[];return DB.estoqueUn;}

function chaveEst(suc,itemId){return suc+'|'+itemId;}

function regEstoque(itemId,suc,criar){
  baseEstUn();
  suc=suc||lojaAtualId();
  var k=chaveEst(suc,itemId);
  var r=DB.estoqueUn.find(function(x){return x.id===k});
  if(!r&&criar){
    r={id:k,sucursalId:suc,itemId:itemId,tipo:'insumo',estoque:0,custoMedio:0};
    DB.estoqueUn.push(r);
  }
  return r||null;
}
/* saldo daquele item naquela unidade */
function saldoUn(itemId,suc){
  var r=regEstoque(itemId,suc,false);
  return r?(Number(r.estoque)||0):0;
}
function custoMedioUn(itemId,suc){
  var r=regEstoque(itemId,suc,false);
  return r?(Number(r.custoMedio)||0):0;
}
function setSaldoUn(itemId,valor,suc){
  var r=regEstoque(itemId,suc,true);
  r.estoque=+((Number(valor)||0).toFixed(4));
  r.atualizadoEm=new Date().toISOString();
  return r.estoque;
}
function setCustoUn(itemId,valor,suc){
  var r=regEstoque(itemId,suc,true);
  r.custoMedio=+((Number(valor)||0).toFixed(6));
  return r.custoMedio;
}
/* copia o saldo da unidade ativa para o campo do item, que e o que as
   telas leem. Chamado ao abrir o sistema e ao trocar de unidade. */
/* ==========================================================
   REDE DE SEGURANCA: FILHO REPETIDO

   O defeito da V115 — item de venda reinserido a cada sincronizacao —
   nao dava erro nenhum: o total do pedido continuava certo e so o
   detalhe por produto inchava. Foi descoberto por acaso, com 10.024
   itens numa venda de R$ 15,00.

   Esta conferencia roda depois de cada download e avisa se alguma lista
   filha voltou com a mesma linha repetida. Nao apaga nada — so acende a
   luz, para ninguem descobrir de novo dois meses depois.
   ========================================================== */
function conferirFilhosRepetidos(){
  var achados=[];
  function olhar(nomeLista,itens,chave){
    var vistos={},rep=0;
    (itens||[]).forEach(function(o){
      var k=chave(o);
      if(vistos[k])rep++; else vistos[k]=1;
    });
    if(rep)achados.push(nomeLista+': '+rep+' linha(s) repetida(s)');
  }
  (DB.pedidos||[]).forEach(function(p){
    olhar('venda '+(p.numero||p.id),p.itens,function(o){
      return (o.nome||'')+'|'+(o.qtd||0)+'|'+(o.unit||0);});
  });
  (DB.fichas||[]).forEach(function(f){
    olhar('ficha '+(f.nome||''),f.itens,function(o){
      return (o.insumoId||'')+'|'+(o.qtd||0)+'|'+(o.unidade||'');});
  });
  (DB.caixas||[]).forEach(function(c){
    olhar('caixa '+(c.id||''),c.movimentos,function(o){
      return (o.tipo||'')+'|'+(o.valor||0)+'|'+(o.motivo||'')+'|'+(o.quando||'');});
  });
  if(!achados.length)return 0;
  logNuvem('ATENCAO — linhas repetidas encontradas: '+achados.slice(0,6).join(' · ')+
    (achados.length>6?' e mais '+(achados.length-6):''),true);
  try{
    if(typeof ehMatriz==='function'&&ehMatriz())
      toast('Encontrei linhas repetidas em '+achados.length+' registro(s). Veja o registro da nuvem.');
  }catch(e){_quieto(e,'conferirFilhosRepetidos');}
  return achados.length;
}
function espelharEstoque(){
  baseEstUn();
  var suc=lojaAtualId();
  /* um indice em vez de 250 varreduras: regEstoque percorre a lista inteira
     a cada item, o que dava 250 x 241 comparacoes por chamada. Agora que
     esta funcao roda depois de cada download e ao abrir a tela, vale montar
     o mapa uma vez. */
  var mapa={};
  (DB.estoqueUn||[]).forEach(function(x){ if(x&&x.id)mapa[x.id]=x; });
  function achar(itemId){ return mapa[chaveEst(suc,itemId)]||null; }
  (DB.insumos||[]).forEach(function(i){
    var r=achar(i.id);
    i.estoqueAtual=r?(Number(r.estoque)||0):0;
    i.custo=r?(Number(r.custoMedio)||0):0;
  });
  (DB.fichas||[]).forEach(function(f){
    if(f.estocavel===false)return;
    var r=achar(f.id);
    f.estoqueAtual=r?(Number(r.estoque)||0):0;
  });
}
/* Traz o saldo antigo — que era da rede — para a unidade matriz.
   Roda uma vez so: depois disso o numero verdadeiro e o da tabela nova. */
function migrarEstoqueParaUnidade(){
  if(DB._estoqueMigrado)return;
  baseEstUn();
  var matriz=(baseSuc().find(function(s){return s.matriz})||sucAtivas()[0]||{}).id||'suc_matriz';
  var n=0;
  (DB.insumos||[]).forEach(function(i){
    var q=Number(i.estoqueAtual)||0;
    if(!q&&!Number(i.custo))return;
    var r=regEstoque(i.id,matriz,true);
    r.tipo='insumo';r.estoque=q;r.custoMedio=Number(i.custo)||0;n++;
  });
  (DB.fichas||[]).forEach(function(f){
    var q=Number(f.estoqueAtual)||0;
    if(!q)return;
    var r=regEstoque(f.id,matriz,true);
    r.tipo='ficha';r.estoque=q;n++;
  });
  DB._estoqueMigrado=true;
  if(n){
    logNuvem('estoque migrado para a unidade '+matriz+': '+n+' itens');
    try{salvar()}catch(e){_quieto(e,'migrarEstoqueParaUnidade')}
  }
}


/* ==========================================================
   LIBERACAO DE CADASTRO POR UNIDADE
   O cadastro nasce na matriz e vale para a rede. Mas nem tudo
   deve chegar em todas: ficha exclusiva da matriz, insumo que so
   uma unidade usa, categoria de teste.

   Regra: lista VAZIA = vale para todas. So restringe o que for
   marcado. Assim, ligar isso hoje nao esconde nada de ninguem —
   e o unico jeito seguro de introduzir a regra num sistema que
   ja esta rodando.
   ========================================================== */
/* TUDO que a matriz cadastra e a unidade consome. Cada um vira uma pasta
   na tela, e dentro dela os itens aparecem UM A UM — porque restringir
   "fichas tecnicas" inteiro nao serve para nada: o que se quer e escolher
   qual ficha vai para qual unidade. */
var CADASTROS_LIB=[
 {col:'insumos',    n:'Ingredientes',           ic:'box'},
 {col:'fichas',     n:'Fichas técnicas',        ic:'book'},
 {col:'produtos',   n:'Produtos',               ic:'cart'},
 {col:'categorias', n:'Categorias do cardápio', ic:'folder'},
 {col:'fichaCats',  n:'Categorias de ficha',    ic:'folder'},
 {col:'gruposIng',  n:'Grupos de ingredientes', ic:'folder'},
 {col:'grupos',     n:'Grupos de opções',       ic:'plu'},
 {col:'motivosMov', n:'Motivos de baixa manual',ic:'dn4'},
 {col:'motivosCanc',n:'Motivos de cancelamento',ic:'x2'},
 {col:'fornec',     n:'Fornecedores',           ic:'tri', campo:'empresa'},
 {col:'formasPag',  n:'Formas de pagamento',    ic:'cash'},
 {col:'catfin',     n:'Categorias financeiras', ic:'chart'},
 {col:'contas',     n:'Contas bancárias',       ic:'cash'},
 {col:'unidExtra',  n:'Unidades de medida',     ic:'box'},
 {col:'turnos',     n:'Turnos',                 ic:'clock'},
 {col:'statusVenda',n:'Status de vendas',       ic:'list'},
 {col:'entregadores',n:'Entregadores',          ic:'moto'},
 {col:'modelosImp', n:'Modelos de impressão',   ic:'print2'}
];
/* alguns cadastros nao guardam o nome em "nome" */
function nomeDoCad(x,col){
  var d=CADASTROS_LIB.find(function(c){return c.col===col});
  var campo=(d&&d.campo)||'nome';
  return x[campo]||x.nome||x.empresa||'—';
}
/* a unidade marcada como matriz na rede */
function ehSucMatriz(id){
  var s=baseSuc().find(function(x){return x.id===id});
  return !!(s&&s.matriz);
}
/* REGRA DA REDE, e ela nao tem excecao:

   1. A MATRIZ ENXERGA TUDO. E a franqueadora — nao existe cadastro de
      unidade nenhuma que ela nao possa ver. A marcacao nem e consultada.
   2. Unidade nao ve nada de outra unidade. Sabor regional de Jales nao
      aparece em Santa Fe, nem o contrario. Cada uma e independente.
   3. SEM LIBERACAO A UNIDADE NAO VE. Este e o ponto e ele mudou na V109.

      Antes, item sem marcacao ia para todas as unidades sozinho. Parecia
      comodo, mas invertia o proposito da tela de Liberacao por Unidade:
      a matriz nao liberava — ela tirava. E franquia nova nascia enxergando
      o cardapio inteiro, inclusive sabor que ela nao vende.

      Agora e o contrario, e e o que se espera de um ERP com matriz por
      cima: a unidade entra vendo os modulos vazios, e a matriz vai
      liberando item a item o que aquela unidade pode ter.

      Para dizer "todas, inclusive as futuras" existe a marca '*' na
      lista. Lista vazia significa ninguem — nao significa todos. */
var TODAS_UN='*';
/* ==========================================================
   PARA QUEM ESTE CADASTRO ESTA LIBERADO, EM UMA LINHA

   Serve a quem enxerga a rede inteira — a matriz. Item liberado para
   todo mundo nao ganha etiqueta: seria ruido em cima de 43 produtos.
   Item de uma unidade so ganha o nome dela, que e o que distingue duas
   linhas parecidas na lista.
   ========================================================== */
function rotuloUnidades(item){
  try{
    var l=item&&item.sucursais;
    if(!l||!l.length)return '';
    if(l.indexOf(TODAS_UN)>=0)return '';
    var eu=lojaAtualId();
    if(!eu||!ehSucMatriz(eu))return '';   /* na unidade, tudo o que ela ve e dela */
    if(l.length===1)return sucNome(l[0]);
    return l.length+' unidades';
  }catch(e){ return ''; }
}
function marcadoTodas(item){
  var l=(item&&item.sucursais)||[];
  return l.indexOf(TODAS_UN)>=0;
}
/* O mesmo bloco em todo formulario de cadastro: quem enxerga este item.
   Decidir na hora de criar e melhor do que criar e depois lembrar de ir
   na tela de liberacao — que e onde as coisas ficam esquecidas. */
function blocoUnidades(item,pref){
  var sucs=sucAtivas();
  if(sucs.length<2)return '';              /* loja unica nao tem o que liberar */
  if(!ehMatriz())return '';                /* so a matriz decide */
  var l=(item&&item.sucursais)||[];
  var todas=marcadoTodas(item);
  return '<div class="blk unBlk" style="margin:0 0 11px;max-width:none">'+
   '<h3>Quem enxerga este item</h3>'+
   '<label class="chkL"><input type="checkbox" id="'+pref+'Todas" '+(todas?'checked':'')+
    ' onchange="togTodasUn(\''+pref+'\')">'+
    '<span><b>Todas as unidades</b> — inclusive as que forem criadas depois</span></label>'+
   '<div class="unGrade" id="'+pref+'Grade" style="'+(todas?'opacity:.45':'')+'">'+
    sucs.map(function(x){
      if(x.matriz)return '<label class="unOp fixa"><input type="checkbox" checked disabled>'+
        '<b>'+E(x.nome)+'</b><span>matriz — vê sempre</span></label>';
      return '<label class="unOp"><input type="checkbox" class="'+pref+'Suc" value="'+E(x.id)+'"'+
       (l.indexOf(x.id)>=0?' checked':'')+(todas?' disabled':'')+'>'+
       '<b>'+E(x.nome)+'</b></label>';
    }).join('')+'</div>'+
   '<div class="hint">Sem marcar nada, o item fica só na matriz — a unidade não vê. '+
   'A matriz enxerga sempre.</div>'+
  '</div>';
}
function togTodasUn(pref){
  var t=document.getElementById(pref+'Todas');
  var g=document.getElementById(pref+'Grade');
  if(!t)return;
  document.querySelectorAll('.'+pref+'Suc').forEach(function(c){c.disabled=t.checked});
  if(g)g.style.opacity=t.checked?'.45':'1';
}
/* le o bloco de volta na hora de salvar */
/* ==========================================================
   QUEM CRIA O CADASTRO TEM DE ENXERGAR O QUE CRIOU (V191)

   O bloco "Quem enxerga este item" so aparece para a MATRIZ — e esta
   certo, e ela quem decide o alcance. Mas `lerUnidades` desistia sem
   fazer nada quando o bloco nao estava na tela, e o item recem-criado
   ficava com `sucursais` vazio.

   Para a matriz isso e inofensivo: ela ve tudo. Para a UNIDADE e
   absurdo — ela cria a categoria, a categoria aparece na hora (esta na
   memoria), e some na primeira sincronizacao, porque
   `filtrarCadastroDaUnidade` pergunta se esta liberada para ela e a
   resposta e "nao".

   Reproduzido em 27/08/2026: Santa Fe criou "Taxa de Entrega", viu no
   cadastro e no PDV, e o item sumiu dos dois. No banco ele estava la o
   tempo todo, com `sucursais: []`.

   A regra que faltava: cadastro nasce enxergando quem o criou. A matriz
   pode ampliar ou restringir depois — mas ninguem cria uma coisa para
   ela desaparecer sozinha.
   ========================================================== */
function lerUnidades(pref,item){
  var t=document.getElementById(pref+'Todas');
  if(!t){
    /* bloco nao esta na tela: ou e loja unica, ou quem edita nao e a
       matriz. Em qualquer dos casos, o item tem de continuar visivel
       para a unidade que esta mexendo nele. */
    if(item&&(!item.sucursais||!item.sucursais.length)){
      var eu=lojaAtualId();
      item.sucursais = (!eu||ehSucMatriz(eu)) ? [TODAS_UN] : [eu];
    }
    return;
  }
  if(t.checked){item.sucursais=[TODAS_UN];return;}
  var l=[];
  document.querySelectorAll('.'+pref+'Suc').forEach(function(c){if(c.checked)l.push(c.value)});
  /* a matriz desmarcou tudo: e escolha dela, e ela continua vendo.
     Mas nao se apaga em silencio o vinculo de quem criou. */
  item.sucursais=l;
}
function liberadoNa(item,suc){
  if(!item)return false;
  suc=suc||lojaAtualId();
  if(ehSucMatriz(suc))return true;       /* regra 1 — a matriz ve tudo */
  var l=item.sucursais;
  if(l&&l.indexOf(TODAS_UN)>=0)return true;  /* liberado para todas, e para as futuras */
  if(!l||!l.length)return false;         /* regra 3 — sem liberacao, nao ve */
  return l.indexOf(suc)>=0;              /* regra 2 — so quem foi liberado */
}
/* usada pelas telas: so o que esta liberado nesta unidade */
/* ==========================================================
   A NUVEM JA CONHECE ESTE REGISTRO? (V192)

   `DB._uuid[col][ref]` guarda o identificador que a nuvem devolveu
   quando o registro subiu. Enquanto ele nao existe, o registro so mora
   neste aparelho.

   A V191 tentou proteger isso com a marca `_novoAqui`. A marca nao
   funcionava: `marcarNovoAqui()` esta escrita no arquivo e NUNCA E
   CHAMADA de lugar nenhum. Era codigo morto, e a protecao que eu
   registrei como feita nunca existiu de fato.

   Agora a pergunta e feita direto ao mapa de identificadores, que e
   preenchido de verdade a cada envio confirmado.
   ========================================================== */
function aNuvemNaoConhece(x,col){
  if(!x||!x.id)return false;
  if(x._novoAqui===true)return true;          /* marca, quando houver */
  if(!col)return false;
  try{ return !(DB._uuid&&DB._uuid[col]&&DB._uuid[col][x.id]); }
  catch(e){ return false; }
}
/* ==========================================================
   O REGISTRADOR DE SUMICO (V197)

   Tres versoes tentaram consertar isto e nenhuma acertou, porque eu
   estava corrigindo hipoteses. No meu ambiente o ciclo passa; no
   aparelho da loja o cadastro some. Enquanto eu nao souber QUEM apaga
   e QUANDO, qualquer correcao e chute.

   Este registrador anota, dentro do proprio sistema, toda vez que um
   cadastro encolhe: quando foi, qual colecao, quantos sumiram, quais
   eram, e de onde veio a chamada. Fica guardado no aparelho e aparece
   na tela de Diagnostico, para a loja poder me mandar.

   Nao muda comportamento nenhum. So observa.
   ========================================================== */
var SUMICOS_MAX=40;
function registrarSumico(col,antes,depois,motivo){
  try{
    if(!Array.isArray(antes)||!Array.isArray(depois))return;
    if(depois.length>=antes.length)return;
    var ficaram={}; depois.forEach(function(x){ if(x&&x.id)ficaram[x.id]=true; });
    var foram=antes.filter(function(x){ return x&&x.id&&!ficaram[x.id]; })
      .map(function(x){
        return {id:x.id,nome:x.nome||x.login||'—',
                suc:JSON.stringify(x.sucursais||[]),
                loja:x._loja||'—',novo:x._novoAqui===true};
      }).slice(0,10);
    DB._sumicos=DB._sumicos||[];
    DB._sumicos.unshift({
      quando:new Date().toLocaleString('pt-BR'),
      col:col, motivo:motivo,
      unidade:(function(){try{return lojaAtualId()}catch(e){return '?'}})(),
      matriz:(function(){try{return ehMatriz()}catch(e){return '?'}})(),
      de:antes.length, para:depois.length, itens:foram,
      pilha:(new Error()).stack.split('\n').slice(2,5).join(' <- ').slice(0,240)
    });
    if(DB._sumicos.length>SUMICOS_MAX)DB._sumicos.length=SUMICOS_MAX;
    logNuvem('SUMIÇO em '+col+': '+antes.length+' -> '+depois.length+
      ' ('+motivo+') — '+foram.map(function(f){return f.nome}).join(', '),true);
  }catch(e){ _quieto(e,'registrarSumico'); }
}
function soLiberados(lista,suc,col){
  var s=suc||lojaAtualId();
  /* sem unidade nao se decide nada: devolve a lista inteira em vez de
     esvaziar. Filtro que nao sabe o alvo nao filtra — apaga. */
  if(!s)return (lista||[]).slice();
  return (lista||[]).filter(function(x){
    /* ==========================================================
       O QUE ACABOU DE SER CRIADO AQUI NAO SOME (V191)

       Segunda camada da mesma protecao. Se por qualquer motivo um item
       criado neste aparelho ainda nao tiver liberacao — bloco ausente,
       falha ao ler, versao antiga que gravou vazio — ele NAO pode ser
       apagado da tela de quem o criou.

       `_novoAqui` marca o registro que a nuvem ainda nao conhece. Some
       assim que ele sobe. Ate la, ele fica visivel.

       Esconder o que a pessoa acabou de cadastrar e o pior tipo de
       falha: ela nao sabe se salvou, cadastra de novo, e a rede ganha
       duplicata. Foi exatamente o que aconteceu com "Taxa de Entrega",
       que virou duas categorias no banco.
       ========================================================== */
    if(aNuvemNaoConhece(x,col))return true;
    return liberadoNa(x,s);
  });
}
/* Tira da memoria desta unidade o cadastro que nao foi liberado para ela.
   Nada e apagado da nuvem — a matriz continua com tudo. */
/* ==========================================================
   SEM UNIDADE RESOLVIDA, NAO SE FILTRA NADA (regressao da V181)

   Na V181 eu corrigi o contexto para NAO cair na Matriz quando a
   unidade do perfil nao resolve — `lojaAtual()` passou a devolver
   string vazia em vez de escolher a unidade errada. Aquilo estava
   certo: melhor sem unidade do que na unidade errada.

   O que eu nao previ foi o efeito AQUI. Esta funcao recebe a unidade
   vazia, `ehSucMatriz('')` da falso, e entao ela pergunta a
   `liberadoNa()` se cada cadastro esta liberado para "" — que nunca
   esta. Resultado: ela apaga da memoria do aparelho os grupos, as
   categorias, os produtos, os insumos e as fichas. TODOS.

   Foi isso que o Rafael viu: "atualizou e eu perdi tudo". Na nuvem
   nada se perdeu — `espelha:false` protege esses cadastros contra
   remocao em massa — mas a tela ficou vazia, e a liberacao que ele
   acabara de fazer parecia nao ter funcionado.

   Filtrar e uma operacao destrutiva na memoria local. Fazer isso sem
   saber para QUAL unidade e o pior dos mundos: apaga tudo por nao
   saber nada. Ausencia de contexto nao autoriza remocao — a mesma
   licao da V130 e da V181, agora no terceiro lugar.
   ========================================================== */
/* ==========================================================
   O BOTAO DE LIBERAR TEM DE FUNCIONAR — SEMPRE (V188)

   Este arquivo ja registrou o mesmo estrago tres vezes seguidas, e da
   terceira a loja ficou sem ver os grupos:

     V186 — tres formularios sem o bloco "Quem enxerga este item"
     V187 — ONZE tabelas sem a coluna `sucursais` no banco
     V187 — `grupos_opcoes` nao subia nem descia com o campo

   Em todos, o mesmo desenho de falha: a tela de Liberacao por Unidade
   oferece o botao, a matriz clica, e o valor morre em algum ponto do
   caminho — no formulario que nao le, no envio que nao manda, na
   coluna que nao existe. Ninguem ve erro. A unidade so abre a tela e
   nao encontra nada.

   O que torna isso grave nao e o bug em si: e a REGRA de leitura.
   `liberadoNa()` trata ausencia de dado como "ninguem liberou". Numa
   liberacao de verdade isso esta certo — lista vazia significa lista
   vazia. Mas quando o campo nao chega por defeito de encanamento, a
   mesma regra transforma um problema tecnico invisivel em CADASTRO
   INVISIVEL para a loja inteira.

   A correcao estrutural nao e consertar o terceiro caso. E garantir
   que a leitura nunca esconda dado por causa do encanamento:

   1. `canaLiberacao(col)` pergunta ao proprio MAPA se aquele cadastro
      leva `sucursais` na subida. Nao consulta o banco, nao depende de
      internet: usa a configuracao real que o sistema usa para
      sincronizar.

   2. `filtrarCadastroDaUnidade` NAO FILTRA os cadastros cujo cano esta
      quebrado. A unidade passa a ver tudo daquele cadastro — que e o
      comportamento seguro. Esconder por engano e pior do que mostrar
      demais: dado escondido parece perda de dado, e a loja para.

   3. O defeito e denunciado, nao engolido: fica no Diagnostico e no
      health check, com o nome do cadastro.

   Regra que fica escrita: CADASTRO SO ENTRA EM `CADASTROS_LIB` DEPOIS
   QUE O CAMPO SOBE, DESCE E TEM COLUNA. As duas pontas, ou nenhuma.
   ========================================================== */
var _canoLib=null;
function canaisDeLiberacao(){
  if(_canoLib)return _canoLib;
  _canoLib={};
  (CADASTROS_LIB||[]).forEach(function(c){
    var m=(MAPA||[]).find(function(x){return x.col===c.col});
    if(!m||typeof m.campos!=='function'){
      /* cadastro que nao sincroniza nao pode ser filtrado por algo que
         so existe na nuvem */
      _canoLib[c.col]={ok:false,motivo:'não sincroniza'};
      return;
    }
    try{
      /* pergunta ao proprio mapa: o campo sobe? */
      var amostra=m.campos({id:'x',ref_local:'x',nome:'x',sucursais:['suc_teste']},0);
      var sobe=amostra&&Object.prototype.hasOwnProperty.call(amostra,'sucursais');
      _canoLib[c.col]=sobe?{ok:true}:{ok:false,motivo:'o campo não sobe para a nuvem'};
    }catch(e){
      _quieto(e,'canaisDeLiberacao');
      _canoLib[c.col]={ok:false,motivo:'não consegui verificar'};
    }
  });
  return _canoLib;
}
/* lista dos cadastros cujo botao de liberar NAO esta funcionando */
function liberacoesQuebradas(){
  var c=canaisDeLiberacao(),fora=[];
  (CADASTROS_LIB||[]).forEach(function(x){
    if(c[x.col]&&!c[x.col].ok)fora.push({col:x.col,nome:x.n,motivo:c[x.col].motivo});
  });
  return fora;
}
function filtrarCadastroDaUnidade(){
  var suc=lojaAtualId();
  if(!suc){                              /* contexto ainda nao resolvido */
    logNuvem('unidade ainda não resolvida — o cadastro não foi filtrado');
    return 0;
  }
  if(ehSucMatriz(suc))return 0;          /* a matriz ve tudo */
  var cano=canaisDeLiberacao(),n=0,pulados=[];
  CADASTROS_LIB.forEach(function(c){
    var antes=(DB[c.col]||[]).length;
    if(!antes)return;
    /* cano quebrado: mostra tudo em vez de esconder tudo */
    if(cano[c.col]&&!cano[c.col].ok){ pulados.push(c.n); return; }
    /* passa a coluna: e por ela que se sabe o que a nuvem ja conhece */
    var _antes=DB[c.col];
    DB[c.col]=soLiberados(DB[c.col],suc,c.col);
    registrarSumico(c.col,_antes,DB[c.col],'filtro de liberação por unidade');
    n+=antes-DB[c.col].length;
  });
  if(pulados.length)
    logNuvem('AVISO: a liberação por unidade não está funcionando em '+
      pulados.join(', ')+' — estes cadastros aparecem inteiros nesta unidade '+
      'em vez de sumirem. Avise o suporte.');
  if(n)logNuvem(n+' item(ns) de cadastro não liberados para '+sucNome(suc)+' ficaram de fora');
  return n;
}
/* ==========================================================
   LIBERAÇÃO POR UNIDADE — reescrita
   A versão anterior punha os 19 cadastros como abas horizontais: elas
   embrulhavam em três linhas, o número colava no nome ("Ingredientes250") e
   o aviso de cinco linhas ocupava metade da tela antes de qualquer conteúdo.
   Havia ainda dois campos de busca diferentes na mesma tela, e "todas as 2
   unidades" repetido 250 vezes — informação que se repete não informa nada.

   Agora: coluna lateral com os cadastros (o mesmo desenho de Usuários e
   Permissões, que a pessoa já conhece), uma busca só, filtro para achar o que
   está restrito entre centenas, e a barra de ação em lote aparecendo apenas
   quando há seleção.
   ========================================================== */
var LB={col:'insumos',busca:'',sel:{},grupo:'',filtro:'todos'};

/* restrito = nao esta com a marca de todas. Inclui o item que ainda nao
   foi liberado para ninguem, que e o estado natural de item novo. */
function libRestritos(col){
  return (DB[col]||[]).filter(function(x){return !marcadoTodas(x)}).length;
}
function telaLiberacao(){
  if(!ehMatriz()){
    $('content').innerHTML='<div class="construWrap"><div class="construBox">'+
     '<div class="construIc">'+sv('lock',30)+'</div><b>Tela da matriz</b>'+
     '<p>Quem decide o que cada unidade enxerga é a franqueadora.</p></div></div>';
    rodape('sem permissão');return;
  }
  var sucs=sucAtivas();
  var def=(CADASTROS_LIB.find(function(c){return c.col===LB.col})||CADASTROS_LIB[0]);
  var todos=(DB[LB.col]||[]).slice();
  var restritos=libRestritos(LB.col);

  var lista=todos.slice();
  if(LB.filtro==='restritos')
    lista=lista.filter(function(x){return !marcadoTodas(x)});
  else if(LB.filtro==='todas')
    lista=lista.filter(function(x){return marcadoTodas(x)});
  var q=(LB.busca||'').toLowerCase();
  if(q)lista=lista.filter(function(x){
    return nomeDoCad(x,LB.col).toLowerCase().indexOf(q)>=0;});
  lista.sort(function(a,b){
    return nomeDoCad(a,LB.col).localeCompare(nomeDoCad(b,LB.col));});

  var selN=Object.keys(LB.sel).filter(function(k){return LB.sel[k]}).length;
  var nomeMatriz=sucNome((baseSuc().find(function(z){return z.matriz})||{}).id);

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo"><div><h1>Liberação por Unidade</h1>'+
   '<p>O cadastro é feito uma vez na matriz. Aqui você escolhe o que '+
   '<b>não</b> chega em alguma unidade — o estoque nunca vai junto.</p></div>'+
   '<button class="infoBt" onclick="explicaLiberacao()">'+sv('help',15)+'</button></div>'+

   '<div class="lbGrade2">'+

    /* ---------- coluna dos cadastros ---------- */
    '<div class="lbLado"><div class="lbLadoT">Cadastros</div><div class="lbLadoR">'+
    CADASTROS_LIB.map(function(c){
      var qt=(DB[c.col]||[]).length, rs=libRestritos(c.col);
      return '<button class="lbCad'+(LB.col===c.col?' on':'')+'" '+
       'onclick="LB.col=\''+c.col+'\';LB.sel={};LB.busca=\'\';LB.filtro=\'todos\';telaLiberacao()">'+
       sv(c.ic,14)+'<span class="lbCadN">'+E(c.n)+'</span>'+
       (rs?'<span class="lbCadR">'+rs+'</span>':'')+
       '<span class="lbCadQ">'+qt+'</span></button>';
    }).join('')+'</div></div>'+

    /* ---------- lista de itens ---------- */
    '<div class="lbCorpo">'+
     '<div class="lbBarra">'+
      '<div class="lbBusca">'+sv('search',14)+
       '<input id="lbQ" value="'+E(LB.busca)+'" placeholder="Buscar entre '+
       todos.length+' '+E(def.n.toLowerCase())+'" '+
       'oninput="LB.busca=this.value;clearTimeout(window._lbT);'+
       'window._lbT=setTimeout(telaLiberacao,300)"></div>'+
      '<div class="lbSegm">'+
       ['todos','restritos','todas'].map(function(f){
         var rot=f==='todos'?'Todos':(f==='restritos'?'Restritos':'Em todas');
         var n=f==='todos'?todos.length:(f==='restritos'?restritos:todos.length-restritos);
         return '<button class="'+(LB.filtro===f?'on':'')+'" '+
          'onclick="LB.filtro=\''+f+'\';telaLiberacao()">'+rot+
          ' <b>'+n+'</b></button>';
       }).join('')+'</div>'+
      (lista.length?'<button class="btnP2" onclick="marcarTodosLib()">Selecionar tudo</button>':'')+
     '</div>'+

     (lista.length
      ?'<div class="lbTabW"><table class="pTable"><thead><tr>'+
       '<th style="width:36px"></th><th>Item</th>'+
       '<th style="width:300px">Quem enxerga</th>'+
       '<th style="width:52px"></th></tr></thead><tbody>'+
       lista.map(function(x){
         var l=x.sucursais||[];
         return '<tr>'+
          '<td><label class="flagBox"><input type="checkbox" '+(LB.sel[x.id]?'checked':'')+
           ' onchange="LB.sel[\''+x.id+'\']=this.checked;semPular(telaLiberacao)"></label></td>'+
          '<td><b>'+E(nomeDoCad(x,LB.col))+'</b></td>'+
          '<td>'+(marcadoTodas(x)
            ?'<span class="lbTodas">todas as unidades</span>'
            :(l.length
              ?'<div class="lbTags"><span class="lbTag mtz">'+E(nomeMatriz)+'</span>'+
                l.filter(function(id){return !ehSucMatriz(id)}).map(function(id){
                  return '<span class="lbTag">'+E(sucNome(id))+'</span>';}).join('')+'</div>'
              :'<div class="lbTags"><span class="lbTag mtz">'+E(nomeMatriz)+'</span>'+
                '<span class="lbTag so">só a matriz</span></div>'))+'</td>'+
          '<td><button class="rBtn" onclick="editarLiberacao(\''+x.id+'\')" '+
           'title="Definir unidades">'+sv('edit',12)+'</button></td>'+
         '</tr>';
       }).join('')+'</tbody></table></div>'
      :'<div class="entVazio"><b>'+
        (LB.filtro==='restritos'
          ?'Nenhum item restrito'
          :(q?'Nada encontrado':'Nenhum '+E(def.n.toLowerCase())+' cadastrado'))+
        '</b><span>'+
        (LB.filtro==='restritos'
          ?'Nenhum item deste cadastro foi limitado a unidades específicas.'
          :(q?'Tente outro nome.':'Cadastre primeiro na tela do módulo.'))+
        '</span></div>')+

     (selN?'<div class="lbLote">'+
       '<b>'+selN+' item(ns) selecionado(s)</b><div style="flex:1"></div>'+
       '<button class="btnP2" onclick="LB.sel={};telaLiberacao()">Limpar</button>'+
       '<button class="btnP2 ok" onclick="liberarEmLote()">Definir unidades</button>'+
      '</div>':'')+
    '</div>'+
   '</div></div></div>';
  rodape(lista.length+' de '+todos.length+' · '+restritos+' restrito(s)');
}
function editarLiberacao(id){
  var x=(DB[LB.col]||[]).find(function(i){return i.id===id});
  if(!x)return;
  abrirEscolhaUnidades([x],nomeDoCad(x,LB.col));
}
function marcarTodosLib(){
  var q=(LB.busca||'').toLowerCase();
  (DB[LB.col]||[]).forEach(function(x){
    if(q&&nomeDoCad(x,LB.col).toLowerCase().indexOf(q)<0)return;
    LB.sel[x.id]=true;
  });
  telaLiberacao();
}
function liberarEmLote(){
  var itens=(DB[LB.col]||[]).filter(function(x){return LB.sel[x.id]});
  if(!itens.length)return;
  abrirEscolhaUnidades(itens,itens.length+' itens selecionados');
}
function abrirEscolhaUnidades(itens,titulo){
  var sucs=sucAtivas();
  /* marcacao inicial: o que TODOS os itens ja tem em comum */
  var atual=(itens.length===1)?(itens[0].sucursais||[]):[];
  var jaTodas=(itens.length===1)&&marcadoTodas(itens[0]);
  atual=atual.filter(function(x){return x!==TODAS_UN});
  modal('Quem enxerga: '+E(titulo),
  '<div class="mdB">'+
   '<label class="chkL"><input type="checkbox" id="lbTodas" '+(jaTodas?'checked':'')+
    ' onchange="document.querySelectorAll(\'.lbSuc\').forEach(function(c){c.disabled=this.checked},this)">'+
    '<span><b>Todas as unidades</b> — inclusive as que forem criadas depois</span></label>'+
   '<div class="hint" style="margin:6px 0 12px">Desmarque acima para escolher unidade por unidade.</div>'+
   '<div class="lbGrade">'+sucs.map(function(s){
     /* a matriz nao entra na escolha: ela ve tudo por regra da rede */
     if(s.matriz)
       return '<label class="lbOp fixa"><input type="checkbox" checked disabled>'+
        '<b>'+E(s.nome)+'</b><span>matriz — vê sempre</span></label>';
     return '<label class="lbOp"><input type="checkbox" class="lbSuc" value="'+E(s.id)+'"'+
      (atual.indexOf(s.id)>=0?' checked':'')+(jaTodas?' disabled':'')+'>'+
      '<b>'+E(s.nome)+'</b></label>';
   }).join('')+'</div>'+
  '</div>','Salvar',function(){
    var todas=$('lbTodas').checked;
    var escolhidas=[];
    document.querySelectorAll('.lbSuc').forEach(function(c){if(c.checked)escolhidas.push(c.value)});
    if(!todas&&!escolhidas.length){
      toast('Escolha ao menos uma unidade, ou marque Todas.');return false;
    }
    itens.forEach(function(x){ x.sucursais=todas?[TODAS_UN]:escolhidas.slice(); });
    LB.sel={};salvar();telaLiberacao();
    toast(itens.length+' item(ns) atualizado(s).');
    if(NUVEM.ligada)sincronizar();
    return true;
  });
}
function explicaLiberacao(){
  confirmar({titulo:'Como a liberação funciona',texto:'Cadastro da rede',
   linhas:[['O cadastro','é feito na matriz e já vale para todas',''],
           ['Sem marcação','o item aparece em todas as unidades',''],
           ['Com marcação','só aparece nas unidades escolhidas',''],
           ['O saldo','é sempre de cada unidade, nunca compartilhado','']],
   aviso:'Restringir não apaga nada: o item continua existindo e o histórico dele '+
    'também. A unidade apenas deixa de vê-lo em novos lançamentos.',
   ok:'Entendi',cancelar:null}).then(function(){});
}
function ehMatriz(){
  if(ehPlataforma&&ehPlataforma())return true;
  var u=usuarioLogado()||{};
  if(u.tudo||u.mestre)return true;
  /* mesma regra da ehFranqueadora: a posicao na rede nao depende
     de ter ou nao acesso total as telas */
  if(typeof ehFranqueadora==='function'&&ehFranqueadora(u))return true;
  var s=baseSuc().find(function(x){return x.id===lojaAtualId()});
  return !!(s&&s.matriz);
}


/* ==========================================================
   TOTEM — autoatendimento
   Extensao do mesmo sistema: mesmos produtos, mesmo pedido, mesmo
   estoque, mesmo Kanban. Muda so a porta de entrada e a roupa.
   Quem decide o que cada unidade tem e a matriz, como no resto.
   ========================================================== */
var LAYOUTS_TOTEM=[
 {id:'vitrine', n:'Vitrine',  d:'Duas colunas, foto quadrada grande. O cliente escolhe pelo olho.',
  q:'para cardápio com foto boa'},
 {id:'lista',   n:'Lista',    d:'Uma coluna, foto pequena e descrição ao lado. Cabe muito mais item.',
  q:'para cardápio grande'},
 {id:'destaque',n:'Destaque', d:'Um produto por vez, foto enorme, avança com a seta.',
  q:'para poucos itens'}
];
var FUNDOS_TOTEM=['#0E5C3A','#1A3A5C','#5C1A2E','#3D2B1F','#1F1F23','#7A4A0F'];
var BOTOES_TOTEM=['#B08422','#D9A83D','#C25A2E','#1F5F8B','#0E8A46','#8B5CF6'];

function cfgTotem(){
  var c=cfg();
  c.totem=c.totem||{};
  var t=c.totem;
  if(t.ativo===undefined)t.ativo=false;
  if(t.layout===undefined)t.layout='vitrine';
  if(t.foto===undefined)t.foto='media';
  if(t.descanso===undefined)t.descanso='frase';
  if(t.fundo===undefined)t.fundo='#0E5C3A';
  if(t.botao===undefined)t.botao='#B08422';
  if(t.titulo===undefined)t.titulo='Monte seu pedido';
  if(t.sub===undefined)t.sub='Escolha com calma. Sem fila, no seu tempo.';
  if(t.cta===undefined)t.cta='Toque para começar';
  if(t.msgFim===undefined)t.msgFim='Obrigado pela preferência!';
  if(t.msgFim2===undefined)t.msgFim2='Leve sua senha ao balcão. Volte sempre!';
  if(t.nome===undefined)t.nome='obrigatorio';
  if(t.celular===undefined)t.celular='opcional';
  if(t.cpf===undefined)t.cpf='opcional';
  if(t.mostraDesc===undefined)t.mostraDesc=true;
  if(t.selo===undefined)t.selo=true;
  if(t.escondeSemEstoque===undefined)t.escondeSemEstoque=false;
  if(t.turbinar===undefined)t.turbinar=true;
  if(t.leveTambem===undefined)t.leveTambem=true;
  if(t.qtdUpsell===undefined)t.qtdUpsell=3;
  if(t.perguntaLocal===undefined)t.perguntaLocal=true;
  if(t.inatividade===undefined)t.inatividade=45;
  if(t.avisaAntes===undefined)t.avisaAntes=true;
  if(t.voltaFim===undefined)t.voltaFim=12;
  if(t.pagaNoTotem===undefined)t.pagaNoTotem=false;
  if(t.unidades===undefined)t.unidades=[];   /* vazio = todas */
  /* fundo: cor chapada ou foto. Com foto, a escrita precisa de contraste —
     por isso o veu e a opcao de texto escuro andam junto. */
  if(t.fundoTipo===undefined)t.fundoTipo='cor';
  if(t.fundoFoto===undefined)t.fundoFoto='';
  if(t.textoEscuro===undefined)t.textoEscuro=true;
  if(t.veu===undefined)t.veu=25;
  /* categoria oferecida no "Leve tambem". Vazio = o sistema escolhe os
     produtos mais baratos que ainda nao estao na sacola. */
  if(t.catLeve===undefined)t.catLeve='';
  return t;
}
/* O fundo da tela de descanso, montado uma vez e usado na previa e no
   totem de verdade — para o que voce ve ser o que o cliente ve. */
function fundoTotem(){
  var t=cfgTotem();
  if(t.fundoTipo!=='foto'||!t.fundoFoto)
    return {css:'background:'+t.fundo,texto:'#fff',sombra:'0 2px 12px rgba(0,0,0,.35)'};
  var claro=t.textoEscuro;
  /* o veu e branco quando a escrita e escura e preto quando e clara:
     em qualquer foto, a palavra continua legivel */
  var cor=claro?'255,255,255':'0,0,0';
  var a=(Number(t.veu)||0)/100;
  return {
    css:'background-image:linear-gradient(rgba('+cor+','+a+'),rgba('+cor+','+
        /* aspas SIMPLES: o endereco da foto vai dentro de style="...", e aspas
           duplas aqui fechavam o atributo e apagavam a tela inteira */
        Math.min(a+0.12,0.92)+')),url(\''+t.fundoFoto+'\');'+
        'background-size:cover;background-position:center',
    texto:claro?'#241F1A':'#fff',
    sombra:claro?'0 1px 10px rgba(255,255,255,.5)':'0 2px 12px rgba(0,0,0,.45)'
  };
}
function totemLigadoNa(suc){
  var t=cfgTotem();
  if(!t.ativo)return false;
  if(ehSucMatriz(suc||lojaAtualId()))return true;
  if(!t.unidades.length)return true;
  return t.unidades.indexOf(suc||lojaAtualId())>=0;
}

/* ---------- a tela de configuração ---------- */
function telaTotem(){
  var t=cfgTotem(), sucs=sucAtivas();
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo"><div><h1>Totem de autoatendimento</h1>'+
   '<p>Os produtos, preços e fotos vêm da Gestão de Cardápio — marque <b>Totem</b> em '+
   '"Disponível em" e o item aparece aqui. Nesta tela você define só a roupa.</p></div>'+
   '<button class="infoBt" onclick="explicaTotem()">'+sv('help',15)+'</button></div>'+

   '<div class="tmLiga">'+
    '<label class="chkMini"><input type="checkbox" '+(t.ativo?'checked':'')+
     ' onchange="cfgTotem().ativo=this.checked;salvarTotem()">'+
     '<span><b>Totem ligado</b> — libera a tela de autoatendimento</span></label>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="abrirTotemCheio()">'+sv('eye',14)+' Testar em tela cheia</button>'+
   '</div>'+

   (ehMatriz()&&sucs.length>1
    ?'<div class="tmBox"><div class="tmT">Em quais unidades</div>'+
      '<div class="hint" style="margin-bottom:10px">A matriz decide. Nenhuma marcada = todas.</div>'+
      '<div class="tmSucs">'+sucs.map(function(s){
        if(s.matriz)return '<label class="tmSuc fixa"><input type="checkbox" checked disabled>'+
          '<b>'+E(s.nome)+'</b><span>matriz</span></label>';
        return '<label class="tmSuc"><input type="checkbox" value="'+E(s.id)+'" class="tmSucCk"'+
         (t.unidades.indexOf(s.id)>=0?' checked':'')+' onchange="salvarUnidadesTotem()">'+
         '<b>'+E(s.nome)+'</b></label>';
      }).join('')+'</div></div>':'')+

   '<div class="tmDuas">'+
    '<div>'+
     '<div class="tmBox"><div class="tmT">Layout do cardápio</div>'+
      '<div class="tmLays">'+LAYOUTS_TOTEM.map(function(l){
        return '<div class="tmLay'+(t.layout===l.id?' on':'')+'" '+
         'onclick="cfgTotem().layout=\''+l.id+'\';salvarTotem()">'+
         '<div class="tmChk"></div>'+miniTotem(l.id)+
         '<h4>'+E(l.n)+'</h4><p>'+E(l.d)+'</p><div class="tmQ">'+E(l.q)+'</div></div>';
      }).join('')+'</div>'+
      '<div class="tmLin"><div class="tmR"><b>Tamanho da foto</b>'+
       '<span>maior vende mais, mas cabe menos por tela</span></div>'+
       tmSeg('foto',[['pequena','Pequena'],['media','Média'],['grande','Grande']])+'</div>'+
      tmChave('mostraDesc','Mostrar descrição','o texto curto abaixo do nome')+
      tmChave('selo','Selo "mais pedido"','marca os campeões do mês, automático')+
      tmChave('escondeSemEstoque','Esconder item sem estoque','em vez de mostrar esgotado')+
     '</div>'+

     '<div class="tmBox"><div class="tmT">Marca e frases</div>'+
      '<div class="tmLin"><div class="tmR"><b>Fundo do totem</b>'+
       '<span>fica atrás de todas as telas, do começo ao fim do pedido</span></div>'+
       tmSeg('fundoTipo',[['cor','Cor'],['foto','Foto']])+'</div>'+
      (t.fundoTipo==='foto'
       ?'<div class="tmFoto">'+
         (t.fundoFoto
          ?'<div class="tmFotoPrev" style="background-image:url(\''+E(t.fundoFoto)+'\')"></div>'
          :'<div class="tmFotoVazio">'+sv('img',26)+'<span>nenhuma foto escolhida</span></div>')+
         '<div class="tmFotoAc">'+
          '<input type="file" id="tmArq" accept="image/*" style="display:none" '+
           'onchange="lerFundoTotem(this)">'+
          '<button class="btnP2" onclick="document.getElementById(\'tmArq\').click()">'+
           sv('img',13)+' Escolher foto</button>'+
          (t.fundoFoto?'<button class="btnP2 rd" onclick="cfgTotem().fundoFoto=\'\';salvarTotem()">Remover</button>':'')+
         '</div>'+
         '<div class="hint">Uma foto clara e sem muito detalhe no meio funciona melhor — '+
         'a escrita fica por cima. Deitada, pelo menos 1600 de largura.</div>'+
        '</div>'+
        '<div class="tmLin"><div class="tmR"><b>Cor da escrita</b>'+
         '<span>escolha o contrário do fundo</span></div>'+
         tmSeg('textoEscuro',[[true,'Escura'],[false,'Clara']],false,true)+'</div>'+
        '<div class="tmLin"><div class="tmR"><b>Véu sobre a foto</b>'+
         '<span>clareia ou escurece para a escrita não sumir</span></div>'+
         '<input class="tmNum" type="range" min="0" max="70" step="5" value="'+(t.veu||0)+'" '+
         'style="width:130px" oninput="cfgTotem().veu=+this.value;pintarTotem()" '+
         'onchange="salvarTotem()"><b style="width:38px;text-align:right">'+(t.veu||0)+'%</b></div>'
       :'<div class="tmLin"><div class="tmR"><b>Cor de fundo</b>'+
         '<span>domina a tela de descanso e o topo</span></div>'+
         '<div class="tmCores">'+FUNDOS_TOTEM.map(function(c){
           return '<div class="tmCor'+(t.fundo===c?' on':'')+'" style="background:'+c+'" '+
            'onclick="cfgTotem().fundo=\''+c+'\';salvarTotem()"></div>';
         }).join('')+'</div></div>')+
      '<div class="tmLin"><div class="tmR"><b>Cor do botão</b>'+
       '<span>a cor da ação principal</span></div>'+
       '<div class="tmCores">'+BOTOES_TOTEM.map(function(c){
         return '<div class="tmCor'+(t.botao===c?' on':'')+'" style="background:'+c+'" '+
          'onclick="cfgTotem().botao=\''+c+'\';salvarTotem()"></div>';
       }).join('')+'</div></div>'+
      tmTexto('titulo','Chamada grande','o que a pessoa lê de longe')+
      tmTexto('sub','Linha de apoio','o convite, em letra menor')+
      tmTexto('cta','Botão de começar','')+
     '</div>'+

     '<div class="tmBox"><div class="tmT">Tela de descanso</div>'+
      '<div class="hint" style="margin-bottom:9px">O que aparece quando ninguém está usando — '+
      'é o que chama a pessoa a se aproximar.</div>'+
      tmSeg('descanso',[['frase','Frase e logo'],['produtos','Produtos girando'],['logo','Só a logo']],true)+
      '<div class="tmLin" style="margin-top:12px"><div class="tmR"><b>Voltar ao início sem toque</b>'+
       '<span>segundos parados até descartar o pedido</span></div>'+
       tmNum('inatividade')+'</div>'+
      tmChave('avisaAntes','Avisar antes de descartar','pergunta "ainda está aí?" 10 segundos antes')+
     '</div>'+
    '</div>'+

    '<div>'+
     '<div class="tmPrev">'+
      '<div class="tmPrevT"><span class="tmPt"></span>Prévia</div>'+
      '<div class="tmAbas">'+
       ['descanso','cardapio','senha'].map(function(a,i){
         return '<button class="tmAba'+(TM.aba===a?' on':'')+'" onclick="TM.aba=\''+a+'\';pintarTotem()">'+
          (a==='descanso'?'Descanso':a==='cardapio'?'Cardápio':'Senha')+'</button>';
       }).join('')+'</div>'+
      '<div class="tmTela" id="tmTela"></div>'+
     '</div>'+

     '<div class="tmBox"><div class="tmT">Identificação do cliente</div>'+
      '<div class="tmLin"><div class="tmR"><b>Nome</b><span>para chamar quando ficar pronto</span></div>'+
       tmSeg('nome',[['nao','Não pedir'],['opcional','Opcional'],['obrigatorio','Obrigatório']])+'</div>'+
      '<div class="tmLin"><div class="tmR"><b>Celular</b><span>avisa por WhatsApp quando ficar pronto</span></div>'+
       tmSeg('celular',[['nao','Não pedir'],['opcional','Opcional'],['obrigatorio','Obrigatório']])+'</div>'+
      '<div class="tmLin"><div class="tmR"><b>CPF na nota</b></div>'+
       tmSeg('cpf',[['nao','Não pedir'],['opcional','Opcional'],['obrigatorio','Obrigatório']])+'</div>'+
     '</div>'+

     '<div class="tmBox"><div class="tmT">Venda adicional</div>'+
      tmChave('turbinar','"Quer turbinar?" no produto','complementos enquanto monta o item')+
      tmChave('leveTambem','"Leve também" antes de fechar','oferece bebida ou sobremesa numa tela própria')+
      (cfgTotem().leveTambem
       ?'<div class="tmLin"><div class="tmR"><b>O que oferecer</b>'+
         '<span>a categoria de onde saem as sugestões</span></div>'+
         '<select class="tmSel" onchange="cfgTotem().catLeve=this.value;salvarTotem()">'+
         '<option value="">— os mais baratos —</option>'+
         (DB.categorias||[]).filter(function(c){return c.ativo!==false}).map(function(c){
           return '<option value="'+E(c.id)+'"'+(cfgTotem().catLeve===c.id?' selected':'')+'>'+
            E(c.nome)+'</option>';
         }).join('')+'</select></div>':'')+
      '<div class="tmLin"><div class="tmR"><b>Quantos itens oferecer</b>'+
       '<span>mais que 3 vira ruído e o cliente ignora</span></div>'+tmNum('qtdUpsell')+'</div>'+
     '</div>'+

     '<div class="tmBox"><div class="tmT">Depois de fechar</div>'+
      tmTexto('msgFim','Mensagem de agradecimento','o que a pessoa lê junto com a senha')+
      tmTexto('msgFim2','Linha de apoio','a instrução prática')+
      '<div class="tmLin"><div class="tmR"><b>Voltar ao início depois de</b>'+
       '<span>segundos com a senha na tela</span></div>'+tmNum('voltaFim')+'</div>'+
      tmChave('perguntaLocal','Pergunta comer aqui ou levar','desligue se a loja só atende de um jeito')+
      tmChave('pagaNoTotem','Pagamento no próprio totem',
       'exige maquininha e emissão fiscal — deixe desligado enquanto não estiver ligado')+
     '</div>'+
    '</div>'+
   '</div>'+
   '</div></div>';
  rodape(t.ativo?('totem ligado · layout '+t.layout):'totem desligado');
  pintarTotem();
}

/* ---------- peças da tela ---------- */
var TM={aba:'descanso'};
function tmSeg(campo,ops,largo,bool){
  var t=cfgTotem();
  return '<div class="tmSeg'+(largo?' largo':'')+'">'+ops.map(function(o){
    var v=bool?String(o[0]):("'"+o[0]+"'");
    return '<button class="'+(t[campo]===o[0]?'on':'')+'" '+
     'onclick="cfgTotem().'+campo+'='+v+';salvarTotem()">'+E(o[1])+'</button>';
  }).join('')+'</div>';
}
/* A foto entra REDUZIDA. Uma imagem de 4 MB no fundo trava o tablet e enche
   a memoria do navegador — o mesmo problema das fotos de produto. */
function lerFundoTotem(input){
  var f=input.files&&input.files[0];
  if(!f)return;
  var r=new FileReader();
  r.onload=function(){
    var img=new Image();
    img.onload=function(){
      var L=1600, esc=Math.min(1,L/img.width);
      var c=document.createElement('canvas');
      c.width=Math.round(img.width*esc);c.height=Math.round(img.height*esc);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      var url=c.toDataURL('image/jpeg',0.82);
      cfgTotem().fundoFoto=url;
      salvarTotem();
      toast('Foto aplicada — '+Math.round(url.length/1024)+' KB.');
    };
    img.onerror=function(){toast('Não consegui ler essa imagem.')};
    img.src=String(r.result||'');
  };
  r.readAsDataURL(f);
}
function tmChave(campo,titulo,desc){
  var t=cfgTotem();
  return '<div class="tmLin"><div class="tmR"><b>'+E(titulo)+'</b>'+
   (desc?'<span>'+E(desc)+'</span>':'')+'</div>'+
   '<div class="tmCh'+(t[campo]?' on':'')+'" onclick="cfgTotem().'+campo+
   '=!cfgTotem().'+campo+';salvarTotem()"></div></div>';
}
function tmNum(campo){
  var t=cfgTotem();
  return '<input class="tmNum" type="number" value="'+(t[campo]||0)+'" '+
   'onchange="cfgTotem().'+campo+'=parseInt(this.value,10)||0;salvarTotem()">';
}
function tmTexto(campo,titulo,desc){
  var t=cfgTotem();
  return '<div class="tmTx"><label>'+E(titulo)+(desc?' <i>'+E(desc)+'</i>':'')+'</label>'+
   '<input value="'+E(t[campo]||'')+'" oninput="cfgTotem().'+campo+
   '=this.value;pintarTotem()" onchange="salvarTotem()"></div>';
}
function miniTotem(l){
  var b='<div class="tmMB"></div><div class="tmMC"><i class="on"></i><i></i><i></i></div>';
  if(l==='vitrine')
    return '<div class="tmMini">'+b+'<div class="tmMG">'+
     '<div class="tmMK"><div class="tmMF"></div><u></u><u class="p"></u></div>'.repeat(4)+'</div></div>';
  if(l==='lista')
    return '<div class="tmMini">'+b+'<div class="tmML">'+
     '<div class="tmMI"><div class="tmMT"></div><div class="tmMCol"><u></u><u class="p"></u></div></div>'.repeat(5)+
     '</div></div>';
  return '<div class="tmMini">'+b+'<div class="tmMD"><div class="tmMBig"></div>'+
   '<div class="tmMS"><s></s><div class="tmMP"><em class="on"></em><em></em><em></em></div><s></s></div>'+
   '</div></div>';
}
/* produtos de verdade, os que estão marcados para o totem */
/* ==========================================================
   AS CATEGORIAS DO TOTEM NAO FILTRAVAM NADA

   A faixa de categorias era desenhada como <div> sem onclick, e
   produtosTotem() devolvia sempre a lista inteira. Tocar em "Copo"
   nao mudava a tela: continuavam os 32 produtos da loja, e a primeira
   pastilha ficava acesa para sempre.

   Agora a pastilha filtra de verdade, e entrou um "Todos" na frente
   para poder voltar.
   ========================================================== */
function produtosTotem(){
  var l=(DB.produtos||[]).filter(function(p){
    return p.ativo!==false&&disponivelNo(p,'totem');});
  if(!l.length)l=(DB.produtos||[]).filter(function(p){return p.ativo!==false});
  if(TMC.cat)l=l.filter(function(p){return p.categoriaId===TMC.cat});
  return l;
}
function catTotem(id){
  TMC.cat=id||'';
  TMC.i=0;
  pintarCheio();
}
/* sem a pastilha "Todos", o totem abre ja na primeira categoria */
function catInicialTotem(){
  var cats=(DB.categorias||[]).filter(function(c){return c.ativo!==false})
    .sort(function(a,b){return (a.ordem||0)-(b.ordem||0)});
  return cats.length?cats[0].id:'';
}
var CORES_SEM_FOTO=['linear-gradient(140deg,#F3E0BC,#C99A4E)','linear-gradient(140deg,#F6C6CF,#C25A72)',
 'linear-gradient(140deg,#B79279,#5B3B27)','linear-gradient(140deg,#CFE8D2,#5B9E6E)',
 'linear-gradient(140deg,#FBE3B0,#E0A02C)','linear-gradient(140deg,#E4D6F2,#8F6BB5)'];
/* A foto como <img> em vez de fundo de CSS. Com fundo, a proporcao dependia
   da largura do cartao e a imagem virava uma tarja cortada no meio do
   produto. Com <img> e recorte quadrado, o gelato aparece inteiro.
   Produto sem foto ganha a inicial numa cor da paleta — melhor que um
   retangulo vazio do tamanho da tela. */
function fotoProd(p,i,alt){
  var r=alt||'1';
  if(p&&p.imagem)
    return '<div class="tcIm" style="aspect-ratio:'+r+'">'+
      '<img src="'+E(p.imagem)+'" alt="'+E(p.nome||'')+'" loading="lazy"></div>';
  var ini=String(p&&p.nome||'?').trim().charAt(0).toUpperCase();
  return '<div class="tcIm semFoto" style="aspect-ratio:'+r+';background:'+
    CORES_SEM_FOTO[i%CORES_SEM_FOTO.length]+'"><span>'+E(ini)+'</span></div>';
}
/* mesma logica da tela grande, em miniatura: a previa tem que mostrar o
   que o cliente vai ver, nao uma aproximacao */
function miniFoto(p,i,raio,alturaCheia){
  var est='width:100%;'+(alturaCheia?'height:100%;':'aspect-ratio:1;')+
    'overflow:hidden;'+(raio?'border-radius:'+raio+';':'');
  if(p&&p.imagem)
    return '<div style="'+est+'"><img src="'+E(p.imagem)+'" '+
      'style="width:100%;height:100%;object-fit:cover;display:block"></div>';
  var ini=String(p&&p.nome||'?').trim().charAt(0).toUpperCase();
  return '<div style="'+est+'background:'+CORES_SEM_FOTO[i%CORES_SEM_FOTO.length]+
    ';display:grid;place-items:center"><span style="font-size:15px;font-weight:800;'+
    'color:rgba(255,255,255,.9)">'+E(ini)+'</span></div>';
}
/* ==========================================================
   P14 — COR VINDA DO CADASTRO NAO ENTRA CRUA EM style=""
   As cores do totem e do cardapio sao digitadas pelo cliente. Indo direto
   para o atributo style, um valor como  #fff"><script>...  fecharia o
   atributo e injetaria HTML. Passam a ser validadas: so cor hexadecimal,
   rgb/rgba ou nome simples; qualquer outra coisa vira a cor padrao.
   ========================================================== */
function corSegura(v,padrao){
  v=String(v==null?'':v).trim();
  if(/^#[0-9a-fA-F]{3,8}$/.test(v))return v;
  if(/^rgba?\([\d\s.,%]+\)$/.test(v))return v;
  if(/^[a-zA-Z]{3,20}$/.test(v))return v;
  if(/^var\(--[\w-]+\)$/.test(v))return v;
  return padrao||'#000000';
}
function pintarTotem(){
  var el=document.getElementById('tmTela');
  if(!el)return;
  var t=cfgTotem(), ps=produtosTotem().slice(0,6);
  var cats=(DB.categorias||[]).filter(function(c){return c.ativo!==false}).slice(0,4);
  if(!cats.length)cats=[{nome:'Todos'}];
  if(TM.aba==='descanso'){
    var F=fundoTotem();
    var claro=(t.fundoTipo==='foto'&&t.textoEscuro);
    el.innerHTML='<div style="flex:1;'+F.css+';color:'+corSegura(F.texto,'#222')+';display:flex;'+
     'flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px">'+
     (t.descanso==='produtos'
      ?'<div style="display:flex;gap:6px;margin-bottom:12px">'+ps.slice(0,3).map(function(p,i){
         return '<div style="width:46px;background:rgba(255,255,255,.14);border-radius:7px;overflow:hidden">'+
          miniFoto(p,i)+
          '<div style="font-size:7px;padding:3px 2px;font-weight:700">'+E((p.nome||'').slice(0,11))+'</div></div>';
       }).join('')+'</div>'
      :'<div style="width:44px;height:44px;border-radius:11px;background:'+
       (claro?'rgba(0,0,0,.07)':'rgba(255,255,255,.16)')+';border:2px solid '+
       (claro?'rgba(0,0,0,.26)':'rgba(255,255,255,.5)')+';display:grid;place-items:center;'+
       'font-size:19px;font-weight:800;margin-bottom:12px">'+E((nomeLojaAtual()||'N')[0])+'</div>')+
     (t.descanso!=='logo'
      ?'<div style="font-size:18px;font-weight:800;line-height:1.12;text-shadow:'+F.sombra+'">'+
        E(t.titulo)+'</div>'+
       '<div style="font-size:9px;opacity:.88;margin-top:6px;max-width:155px;text-shadow:'+F.sombra+
       '">'+E(t.sub)+'</div>':'')+
     '<div style="margin-top:16px;background:'+t.botao+';color:#241F1A;font-size:10px;'+
     'font-weight:800;padding:9px 18px;border-radius:8px">'+E(t.cta)+'</div></div>';
  }else if(TM.aba==='cardapio'){
    var alt=t.foto==='grande'?'1':t.foto==='media'?'1.25':'1.7';
    var corpo='';
    if(t.layout==='vitrine'){
      corpo='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'+ps.slice(0,4).map(function(p,i){
        return '<div style="background:#fff;border:1px solid var(--lin,#e6e0d4);border-radius:7px;overflow:hidden">'+
         miniFoto(p,i)+
         '<div style="padding:5px 6px 7px"><div style="font-size:9px;font-weight:700">'+E(p.nome)+'</div>'+
         (t.mostraDesc&&p.detalhes?'<div style="font-size:7px;color:var(--tx2,#7a7266)">'+E(p.detalhes.slice(0,22))+'</div>':'')+
         '<div style="font-size:11px;font-weight:800;color:'+t.fundo+';margin-top:2px">R$ '+money(p.preco)+'</div>'+
         '</div></div>';}).join('')+'</div>';
    }else if(t.layout==='lista'){
      var tam=t.foto==='grande'?42:t.foto==='media'?32:24;
      corpo='<div style="display:flex;flex-direction:column;gap:5px">'+ps.map(function(p,i){
        return '<div style="background:#fff;border:1px solid var(--lin,#e6e0d4);border-radius:7px;padding:5px;'+
         'display:flex;gap:6px;align-items:center"><div style="width:'+tam+'px;flex-shrink:0">'+
         miniFoto(p,i,'5px')+'</div>'+
         '<div style="flex:1"><div style="font-size:9px;font-weight:700">'+E(p.nome)+'</div></div>'+
         '<div style="font-size:10px;font-weight:800;color:'+t.fundo+'">R$ '+money(p.preco)+'</div></div>';
        }).join('')+'</div>';
    }else{
      var p0=ps[0]||{nome:'—',preco:0};
      corpo='<div style="height:100%;display:flex;flex-direction:column;gap:7px">'+
       '<div style="flex:1;overflow:hidden;border-radius:9px">'+miniFoto(p0,0,'9px','100%')+'</div>'+
       '<div style="text-align:center"><div style="font-size:12px;font-weight:800">'+E(p0.nome)+'</div>'+
       '<div style="font-size:15px;font-weight:800;color:'+t.fundo+'">R$ '+money(p0.preco)+'</div></div></div>';
    }
    el.innerHTML='<div style="background:'+t.fundo+';color:#fff;padding:8px 10px;font-size:10px;'+
     'font-weight:700">Escolha seu pedido</div>'+
     '<div style="display:flex;gap:4px;padding:7px 8px;background:#fff;border-bottom:1px solid var(--lin,#e6e0d4);'+
     'overflow:hidden">'+cats.map(function(c,i){
       return '<div style="font-size:8px;padding:4px 8px;border-radius:12px;white-space:nowrap;'+
        (i===0?'background:'+t.fundo+';color:#fff':'background:var(--bg2,#faf7f0);border:1px solid var(--lin,#e6e0d4)')+
        '">'+E(c.nome)+'</div>';}).join('')+'</div>'+
     '<div style="flex:1;overflow:hidden;padding:8px">'+corpo+'</div>'+
     '<div style="background:#fff;border-top:1px solid var(--lin,#e6e0d4);padding:7px 9px;display:flex;'+
     'align-items:center;gap:7px"><div style="flex:1"><div style="font-size:7px;color:var(--tx2,#7a7266)">2 ITENS</div>'+
     '<div style="font-size:13px;font-weight:800">R$ 32,00</div></div>'+
     '<div style="background:'+t.botao+';color:#241F1A;font-size:9px;font-weight:800;padding:8px 12px;'+
     'border-radius:7px">Ver sacola</div></div>';
  }else{
    el.innerHTML='<div style="flex:1;background:'+t.fundo+';display:flex;flex-direction:column;'+
     'align-items:center;justify-content:center;padding:18px;text-align:center;color:#fff">'+
     '<div style="background:#fff;border-radius:14px;padding:22px 18px;width:100%">'+
     '<div style="font-size:8px;font-weight:800;letter-spacing:.12em;color:var(--tx2,#7a7266)">SUA SENHA</div>'+
     '<div style="font-size:46px;font-weight:800;color:'+t.fundo+';line-height:1;margin:4px 0">47</div>'+
     (t.nome!=='nao'?'<div style="font-size:8px;color:var(--tx2,#7a7266)">Rafael</div>':'')+'</div>'+
     '<div style="font-size:12px;font-weight:700;margin-top:14px;line-height:1.35">'+E(t.msgFim)+'</div>'+
     '<div style="font-size:8.5px;opacity:.85;margin-top:6px">'+E(t.msgFim2)+'</div></div>';
  }
}
function salvarTotem(){salvar();telaTotem();if(NUVEM.ligada)sincronizar();}
function salvarUnidadesTotem(){
  var l=[];
  document.querySelectorAll('.tmSucCk').forEach(function(c){if(c.checked)l.push(c.value)});
  cfgTotem().unidades=l;
  salvar();telaTotem();
  if(NUVEM.ligada)sincronizar();
}
function explicaTotem(){
  confirmar({titulo:'Como o totem se liga ao resto',texto:'Totem de autoatendimento',
   linhas:[['Os produtos','vêm da Gestão de Cardápio, marcados como Totem',''],
           ['O pedido','entra no mesmo PDV, mesma numeração',''],
           ['O estoque','baixa na unidade do totem, normalmente',''],
           ['O relatório','aparece em Canais de Venda, separado',''],
           ['Quem libera','a matriz, por unidade','']],
   aviso:'Não existe cadastro próprio do totem, e isso é de propósito: dois cadastros do mesmo '+
    'produto acabam divergindo, e o cliente do totem pagaria diferente do cliente do balcão.',
   ok:'Entendi',cancelar:null}).then(function(){});
}


/* ==========================================================
   TECLADO NA TELA
   Campo pequeno com teclado do sistema nao existe em totem: nao ha
   teclado. O que o mercado faz e mostrar o que foi digitado GRANDE e
   um teclado de dedo embaixo, ocupando metade da tela.
   ========================================================== */
var TEC={campo:'',valor:{},maiusc:true};
var LINHAS_QWERTY=[
 ['Q','W','E','R','T','Y','U','I','O','P'],
 ['A','S','D','F','G','H','J','K','L'],
 ['Z','X','C','V','B','N','M']
];
function tecladoLetras(){
  return '<div class="tecl">'+LINHAS_QWERTY.map(function(l,i){
    return '<div class="teclL">'+
     (i===2?'<button class="tecK esp" onclick="tecMaiusc()">'+(TEC.maiusc?'abc':'ABC')+'</button>':'')+
     l.map(function(k){
       var v=TEC.maiusc?k:k.toLowerCase();
       return '<button class="tecK" onclick="tecDigita(\''+v+'\')">'+v+'</button>';
     }).join('')+
     (i===2?'<button class="tecK esp" onclick="tecApaga()">'+sv('cr2',20)+'</button>':'')+
     '</div>';
  }).join('')+
  '<div class="teclL"><button class="tecK espaco" onclick="tecDigita(\' \')">espaço</button></div>'+
  '</div>';
}
function tecladoNumeros(){
  var ks=['1','2','3','4','5','6','7','8','9','','0','apaga'];
  return '<div class="tecl num">'+ks.map(function(k){
    if(k==='')return '<button class="tecK vazio" disabled></button>';
    if(k==='apaga')return '<button class="tecK" onclick="tecApaga()">'+sv('cr2',22)+'</button>';
    return '<button class="tecK" onclick="tecDigita(\''+k+'\')">'+k+'</button>';
  }).join('')+'</div>';
}
function tecDigita(c){
  var v=TEC.valor[TEC.campo]||'';
  if(TEC.campo==='celular'&&soDigitos(v).length>=11)return;
  if(TEC.campo==='cpf'&&soDigitos(v).length>=11)return;
  if(TEC.campo==='nome'&&v.length>=24)return;
  TEC.valor[TEC.campo]=v+c;
  pintarCheio();
}
function tecApaga(){
  var v=TEC.valor[TEC.campo]||'';
  TEC.valor[TEC.campo]=v.slice(0,-1);
  pintarCheio();
}
function tecMaiusc(){TEC.maiusc=!TEC.maiusc;pintarCheio();}
function tecCampo(c){TEC.campo=c;pintarCheio();}
/* mascara na hora: o numero aparece formatado enquanto e digitado */
function mostraValor(campo,v){
  if(!v)return '';
  if(campo==='celular'){
    var d=soDigitos(v);
    if(d.length<=2)return '('+d;
    if(d.length<=7)return '('+d.slice(0,2)+') '+d.slice(2);
    return '('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7,11);
  }
  if(campo==='cpf'){
    var c=soDigitos(v);
    if(c.length<=3)return c;
    if(c.length<=6)return c.slice(0,3)+'.'+c.slice(3);
    if(c.length<=9)return c.slice(0,3)+'.'+c.slice(3,6)+'.'+c.slice(6);
    return c.slice(0,3)+'.'+c.slice(3,6)+'.'+c.slice(6,9)+'-'+c.slice(9,11);
  }
  return v;
}
function camposTotem(){
  var t=cfgTotem(),l=[];
  if(t.nome!=='nao')l.push({k:'nome',n:'Seu nome',dica:'para chamarmos quando ficar pronto',
    obr:t.nome==='obrigatorio',tipo:'letras'});
  if(t.celular!=='nao')l.push({k:'celular',n:'Celular',dica:'avisamos por WhatsApp',
    obr:t.celular==='obrigatorio',tipo:'numeros'});
  if(t.cpf!=='nao')l.push({k:'cpf',n:'CPF na nota',dica:'',
    obr:t.cpf==='obrigatorio',tipo:'numeros'});
  return l;
}
function faltaPreencher(){
  return camposTotem().filter(function(c){
    return c.obr&&!String(TEC.valor[c.k]||'').trim();
  });
}


/* ==========================================================
   OPCOES DO PRODUTO NO TOTEM
   Nada de cadastro novo: os grupos de opcoes ja existem em Gestao de
   Cardapio e ja sao ligados ao produto na aba Opcoes. O totem so usa.

   A diferenca esta em COMO perguntar:
   - grupo obrigatorio (minimo 1) -> mostra as opcoes direto
   - grupo opcional  (minimo 0)  -> pergunta SIM ou NAO primeiro
     "Quer adicionar borda?" e so entao mostra os sabores. Perguntar
     antes evita que a pessoa role uma lista que talvez nem queira.
   ========================================================== */
/* ==========================================================
   NEM TODA PERGUNTA CABE NOS TRES CANAIS

   O sabor do pote e do batido precisa ser perguntado no cardapio
   digital — o cliente escolhe sozinho, ninguem esta ali para anotar.
   Na frente de caixa, nao: quem atende ja ouviu o sabor e serviu, e ser
   obrigado a marcar de novo na tela so atrasa a fila.

   Cada grupo agora diz onde vale. Sem marcacao nenhuma, vale nos tres —
   e o que existia antes continua funcionando igual.
   ========================================================== */
function grupoValeEm(g,canal){
  if(!g)return false;
  var c=g.canais;
  if(!c||!c.length)return true;      /* sem escolha = todos os canais */
  return c.indexOf(canal)>=0;
}
function gruposDoProduto(p,canal){
  if(!p||!p.grupos||!p.grupos.length)return [];
  return (DB.grupos||[]).filter(function(g){
    /* grupo em que TODAS as opcoes estao desligadas nao tem o que
        perguntar: nao aparece, como o grupo vazio ja nao aparecia */
    if(p.grupos.indexOf(g.id)<0||!opcoesAtivas(g).length)return false;
    return canal?grupoValeEm(g,canal):true;
  });
}
function grupoObrigatorio(g){return (Number(g.min)||0)>0;}
function maxDoGrupo(g){return (g.max==null?1:Number(g.max))||1;}

/* estado de quem esta montando um item */
var MON={produto:null,idx:0,escolhas:{},pulados:{},perguntou:{}};

/* o que oferecer no "Leve tambem": da categoria escolhida, ou os mais
   baratos — e nunca o que a pessoa ja colocou na sacola */
function sugestoesTotem(){
  var t=cfgTotem();
  var naSacola={};
  TMC.sacola.forEach(function(x){naSacola[x.nome]=true});
  var l=produtosTotem().filter(function(p){
    if(naSacola[p.nome])return false;
    if(t.catLeve)return p.categoriaId===t.catLeve;
    return true;
  });
  if(!t.catLeve)l=l.sort(function(a,b){return (a.preco||0)-(b.preco||0)});
  return l.slice(0,Math.max(1,Number(t.qtdUpsell)||3));
}
function addSugestao(i){
  var p=sugestoesTotem()[i];
  if(!p)return;
  TMC.sacola.push({nome:p.nome,preco:Number(p.preco)||0,opcoes:[]});
  pintarCheio();
}
function telaLeveTambem(){
  var t=cfgTotem(), sug=sugestoesTotem();
  var tot=TMC.sacola.reduce(function(a,p){return a+(Number(p.preco)||0)},0);
  if(!sug.length){TMC.passo=3;return pintarCheio();}
  return '<div class="tcTopo" style="background:'+t.fundo+'">'+
   '<button class="tcVb" onclick="TMC.passo=2;pintarCheio()">‹</button>'+
   '<div class="tcT1">Antes de fechar</div>'+
   '<div class="tcT2">'+TMC.sacola.length+' itens · R$ '+money(tot)+'</div></div>'+
   '<div class="tcLeve">'+
    '<h2>Que tal levar junto?</h2>'+
    '<div class="tcLeveS">Combina com o que você pediu</div>'+
    '<div class="tcLeveG">'+sug.map(function(p,i){
      return '<button class="tcLeveC" onclick="addSugestao('+i+')">'+
       fotoProd(p,i,'1')+
       '<div class="tcLeveI"><div class="tcNm">'+E(p.nome)+'</div>'+
       '<div class="tcPr" style="color:'+t.fundo+'">R$ '+money(p.preco)+'</div>'+
       '<span class="tcLeveB" style="background:'+t.botao+'">+ Adicionar</span></div></button>';
    }).join('')+'</div>'+
   '</div>'+
   '<div class="tcRod">'+
    '<button class="tcBtn fant" onclick="TMC.passo=3;pintarCheio()">Não, obrigado</button>'+
    '<button class="tcBtn" style="background:'+t.botao+';flex:1" '+
     'onclick="TMC.passo=3;pintarCheio()">Continuar · R$ '+money(tot)+'</button>'+
   '</div>';
}
function comecarMontagem(i){
  var p=produtosTotem()[i];
  if(!p)return;
  var gs=gruposDoProduto(p,'totem');
  if(!gs.length){                       /* produto simples: entra direto */
    TMC.sacola.push({nome:p.nome,preco:Number(p.preco)||0,opcoes:[]});
    pintarCheio();return;
  }
  MON={produto:p,idx:0,escolhas:{},pulados:{},perguntou:{}};
  TMC.passo='monta';
  pintarCheio();
}
function grupoAtual(){
  var gs=gruposDoProduto(MON.produto,'totem');
  return gs[MON.idx]||null;
}
function precoMontagem(){
  var t=Number(MON.produto&&MON.produto.preco)||0;
  Object.keys(MON.escolhas).forEach(function(gid){
    (MON.escolhas[gid]||[]).forEach(function(o){t+=Number(o.preco)||0});
  });
  return t;
}
function respondeGrupo(sim){
  var g=grupoAtual();if(!g)return;
  MON.perguntou[g.id]=true;
  if(!sim){MON.pulados[g.id]=true;proximoGrupo();}
  else pintarCheio();
}
function escolherOpcao(gid,k){
  var g=(DB.grupos||[]).find(function(x){return x.id===gid});
  if(!g)return;
  /* o indice vem da lista desenhada, que ja esta filtrada */
  var o=opcoesAtivas(g)[k];if(!o)return;
  var atual=MON.escolhas[gid]||[];
  var max=maxDoGrupo(g);
  var ja=atual.findIndex(function(x){return x.nome===o.nome});
  if(ja>=0)atual.splice(ja,1);
  else{
    if(max===1)atual=[o];
    else if(atual.length<max)atual.push(o);
    else{toast('Você já escolheu '+max+'.');return;}
  }
  MON.escolhas[gid]=atual;
  pintarCheio();
  /* escolha unica e obrigatoria: avanca sozinho, sem pedir confirmacao */
  if(max===1&&grupoObrigatorio(g))setTimeout(proximoGrupo,240);
}
function proximoGrupo(){
  var gs=gruposDoProduto(MON.produto,'totem');
  if(MON.idx<gs.length-1){MON.idx++;pintarCheio();return;}
  fecharMontagem();
}
function voltarGrupo(){
  if(MON.idx>0){MON.idx--;pintarCheio();}
  else{TMC.passo=2;pintarCheio();}
}
function fecharMontagem(){
  var p=MON.produto;
  var ops=[];
  Object.keys(MON.escolhas).forEach(function(gid){
    (MON.escolhas[gid]||[]).forEach(function(o){ops.push(o.nome)});
  });
  TMC.sacola.push({nome:p.nome,preco:precoMontagem(),opcoes:ops});
  TMC.passo=2;MON={produto:null,idx:0,escolhas:{},pulados:{},perguntou:{}};
  pintarCheio();
}

/* a tela: pergunta antes, opcoes depois */
function telaMontagem(){
  var t=cfgTotem(), p=MON.produto, g=grupoAtual();
  if(!p||!g)return '';
  var gs=gruposDoProduto(p,'totem');
  var obr=grupoObrigatorio(g);
  var max=maxDoGrupo(g);
  var sel=MON.escolhas[g.id]||[];
  var perguntar=(!obr&&!MON.perguntou[g.id]);
  var falta=(obr&&!sel.length);

  var cab='<div class="tcTopo" style="background:'+t.fundo+'">'+
   '<button class="tcVb" onclick="voltarGrupo()">‹</button>'+
   '<div class="tcT1">'+E(p.nome)+'</div>'+
   '<div class="tcT2">'+(MON.idx+1)+' de '+gs.length+'</div></div>';

  if(perguntar){
    /* SIM ou NAO, duas escolhas do tamanho da mão. O nome do grupo vira a
       pergunta: "Bordas" -> "Quer adicionar borda?" */
    var barato=opcoesAtivas(g).reduce(function(m,o){
      var v=Number(o.preco)||0;return (m===null||v<m)?v:m;},null);
    return cab+
     '<div class="tcSimNao">'+
      '<div class="tcSNfoto">'+fotoProd(p,0,'16/9')+'</div>'+
      '<h2>'+E(perguntaDoGrupo(g))+'</h2>'+
      (barato?'<div class="tcSNsub">a partir de R$ '+money(barato)+'</div>':'')+
      '<div class="tcSNbt">'+
       '<button class="tcSNn" onclick="respondeGrupo(false)">Não, obrigado</button>'+
       '<button class="tcSNs" style="background:'+t.botao+'" onclick="respondeGrupo(true)">'+
        'Sim, quero</button>'+
      '</div>'+
     '</div>';
  }

  return cab+
   '<div class="tcOpc">'+
    '<div class="tcOpcH"><h2>'+E(g.nome)+'</h2>'+
     '<span>'+(obr
       ?(max>1?'escolha até '+max:'escolha 1')
       :(max>1?'até '+max+' · opcional':'opcional'))+'</span></div>'+
    '<div class="tcOpcG">'+opcoesAtivas(g).map(function(o,k){
      var on=sel.some(function(x){return x.nome===o.nome});
      return '<button class="tcOp'+(on?' on':'')+'" onclick="escolherOpcao(\''+g.id+'\','+k+')">'+
       '<span class="tcOpM"></span>'+
       '<span class="tcOpN">'+E(o.nome)+'</span>'+
       (Number(o.preco)?'<span class="tcOpP">+ R$ '+money(o.preco)+'</span>':
         '<span class="tcOpP zero">incluso</span>')+
      '</button>';
    }).join('')+'</div>'+
   '</div>'+
   '<div class="tcRod">'+
    '<div class="tcRv"><span>'+E(p.nome)+'</span><b>R$ '+money(precoMontagem())+'</b></div>'+
    (!obr?'<button class="tcBtn fant" onclick="respondeGrupo(false)">Pular</button>':'')+
    '<button class="tcBtn'+(falta?' off':'')+'" style="background:'+
     (falta?'#D8D0C2':t.botao)+'" '+(falta?'':'onclick="proximoGrupo()"')+'>'+
     ((MON.idx<gs.length-1)?'Continuar':'Adicionar ao pedido')+'</button>'+
   '</div>';
}
/* "Bordas" vira "Quer adicionar borda?"; se o grupo ja for uma pergunta,
   usa como esta */
function perguntaDoGrupo(g){
  var n=String(g.nome||'').trim();
  if(/\?$/.test(n))return n;
  var s=n.toLowerCase();
  if(/s$/.test(s)&&s.length>3)s=s.slice(0,-1);   /* Bordas -> borda */
  return 'Quer adicionar '+s+'?';
}


/* ==========================================================
   O TOTEM VIRA VENDA DE VERDADE
   Ate aqui o totem era so ensaio: a sacola vivia numa lista temporaria
   e sumia ao fechar a tela. Agora ele cria pedido com numero, entra no
   caixa aberto, baixa estoque e aparece no PDV — igual a venda do
   balcao. O que muda e so o canal.
   ========================================================== */
function fecharPedidoTotem(){
  var t=cfgTotem();
  if(!TMC.sacola.length){toast('Sacola vazia.');return null;}

  var cx=caixaAberto();
  if(!cx){
    toast('O caixa da loja está fechado — o totem não pode registrar venda.');
    return null;
  }
  if(!travarFecharVenda()){toast('Aguarde...');return null;}

  var itens=TMC.sacola.map(function(x){
    return {produtoId:x.produtoId||'',nome:x.nome+(x.opcoes&&x.opcoes.length
              ?' ('+x.opcoes.join(', ')+')':''),
            qtd:1,unitario:Number(x.preco)||0,total:Number(x.preco)||0,
            opcoes:x.opcoes||[]};
  });
  var total=itens.reduce(function(a,i){return a+i.total},0);
  var ag=new Date();

  /* pagamento: no totem sem maquininha, a venda nasce aguardando o caixa.
     Com maquininha ligada, ela ja nasce paga. */
  var pago=!!t.pagaNoTotem;
  var ped={
    id:uid('ped'),numero:proxNumPedido(),
    tipo:'loja',canal:'totem',origem:'totem',
    fase:pago?(statusDoPapel('finalizado')||statusInicial('loja'))
             :(statusDoPapel('aguardando')||statusInicial('loja')),
    clienteNome:TEC.valor.nome||'',
    itens:itens,
    pagamentos:pago?[{forma:TMC.forma||'credito',
      nome:nomeForma(TMC.forma||'credito'),valor:total,equipamento:'totem'}]:[],
    total:total,taxa:0,desconto:0,
    caixaId:cx.id,sucursalId:lojaAtualId(),
    data:hojeISO(),hora:agoraHM(),
    senha:TMC.senha||proxSenhaTotem(),
    equipamento:'totem'
  };
  if(TEC.valor.cpf)ped.cpfNota=soDigitos(TEC.valor.cpf);
  if(TEC.valor.celular)ped.clienteTel=soDigitos(TEC.valor.celular);
  /* O cliente do totem entra no MESMO cadastro do balcao e do delivery.
     Sem isso, quem compra sozinho na tela ficaria invisivel — e e
     justamente quem a loja mais quer reconhecer depois. */
  var cli=clienteDoTotem();
  if(cli){
    ped.clienteId=cli.id;
    ped.clienteNome=cli.nome;
    cli.compras=(cli.compras||0)+1;
    cli.gasto=+((Number(cli.gasto)||0)+total).toFixed(2);
    cli.ultima=dataBR(hojeISO())+' '+ped.hora;
    if(!cli.origem)cli.origem='totem';
  }

  ped._loja=NUVEM.loja; ped._suc=lojaAtualId(); ped._criadoEm=ag.toISOString();
  DB.pedidos.push(ped);
  try{ baixarEstoqueVenda(ped); }catch(e){ console.error('estoque totem',e); }
  try{ registrarCupom(ped); }catch(e){_quieto(e,'fecharPedidoTotem')}
  salvar();
  liberarFecharVenda();
  if(NUVEM.ligada)sincronizar();
  return ped;
}
/* Acha ou cria o cliente pelo telefone; sem telefone, pelo CPF. So com o
   nome nao da: dois "Joao" seriam a mesma pessoa. */
function clienteDoTotem(){
  var tel=soDigitos(TEC.valor.celular||'');
  var cpf=soDigitos(TEC.valor.cpf||'');
  var nome=String(TEC.valor.nome||'').trim();
  if(!tel&&!cpf)return null;              /* sem identificacao, sem cadastro */
  DB.clientes=DB.clientes||[];
  var achou=DB.clientes.find(function(c){
    if(tel&&soDigitos(c.tel||'')===tel)return true;
    if(cpf&&soDigitos(c.cpf||'')===cpf)return true;
    return false;
  });
  if(achou){
    /* completa o que faltava, sem sobrescrever o que ja existe */
    if(nome&&!achou.nome)achou.nome=nome;
    if(tel&&!achou.tel)achou.tel=tel;
    if(cpf&&!achou.cpf)achou.cpf=cpf;
    return achou;
  }
  var novo={id:uid('cli'),nome:nome||'Cliente do totem',tel:tel,cpf:cpf,
    compras:0,gasto:0,origem:'totem',criadoEm:hojeISO()};
  DB.clientes.push(novo);
  return novo;
}
/* a senha e por dia e por unidade: reinicia a cada abertura de caixa */
function proxSenhaTotem(){
  var hoje=hojeISO(), suc=lojaAtualId(), max=0;
  (DB.pedidos||[]).forEach(function(p){
    if(p.canal!=='totem')return;
    if(diaLocal(p.data)!==hoje)return;
    if((p.sucursalId||'')!==suc)return;
    var s=Number(p.senha)||0;
    if(s>max)max=s;
  });
  return max+1;
}
function nomeForma(id){
  var f=(typeof FORMAS!=='undefined'?FORMAS:[]).find(function(x){return x.id===id});
  return f?f.n:id;
}

/* ---------- teste em tela cheia ---------- */
function abrirTotemCheio(){
  var t=cfgTotem(), ps=produtosTotem();
  /* ==========================================================
     A MARCACAO DE UNIDADE DO TOTEM NAO VALIA NADA (V204)

     A configuracao tem uma caixinha por unidade — "o totem vale aqui" —
     e `totemLigadoNa(suc)` responde exatamente essa pergunta. Ela nunca
     foi chamada por ninguem: dava para abrir o totem numa unidade que
     nao estava marcada, e a marcacao era enfeite.

     A matriz continua passando sempre (e de la que se configura), e
     lista de unidades vazia continua significando "todas" — a mesma
     convencao de `podeSucursal`.
     ========================================================== */
  if(!totemLigadoNa()){
    toast(t.ativo ? 'O totem não está liberado para ' + sucNome(lojaAtualId()) + '.'
                  : 'O totem está desligado nesta configuração.');
    return;
  }
  if(!ps.length){toast('Nenhum produto ativo para mostrar.');return;}
  var d=document.createElement('div');
  d.id='tmCheio';d.className='tmCheio';
  d.innerHTML='<button class="tmSair" onclick="fecharTotemCheio()">Sair do teste ✕</button>'+
   '<div class="tmC" id="tmC"></div>';
  document.body.appendChild(d);
  TMC={passo:1,sacola:[]};
  pintarCheio();
  try{ if(d.requestFullscreen)d.requestFullscreen().catch(function(){}); }catch(e){_quieto(e,'abrirTotemCheio')}
}
function reiniciarTotem(){
  TMC={passo:1,sacola:[],cat:'',pedido:null,senha:null};
  TEC={campo:'',valor:{},maiusc:true};
  pintarCheio();
}
function fecharTotemCheio(){
  var d=document.getElementById('tmCheio');
  if(d)d.remove();
  try{ if(document.exitFullscreen&&document.fullscreenElement)document.exitFullscreen().catch(function(){}); }catch(e){_quieto(e,'fecharTotemCheio')}
}
var TMC={passo:1,sacola:[],cat:''};
function irTotem(n){
  TMC.passo=n;
  if(n===2&&!TMC.cat)TMC.cat=catInicialTotem();
  pintarCheio();
}
function pintarCheio(){
  var el=document.getElementById('tmC');
  if(!el)return;
  var t=cfgTotem(), ps=produtosTotem();
  var tot=TMC.sacola.reduce(function(a,p){return a+(Number(p.preco)||0)},0);
  if(TMC.passo==='monta'){ el.innerHTML=telaMontagem(); return; }
  if(TMC.passo==='leve'){ el.innerHTML=telaLeveTambem(); return; }
  if(TMC.passo===1){
    var F=fundoTotem();
    var claro=(t.fundoTipo==='foto'&&t.textoEscuro);
    el.innerHTML='<div class="tcAtr'+(claro?' claro':'')+'" style="'+F.css+';color:'+corSegura(F.texto,'#222')+
     '" onclick="irTotem(2)">'+
     (t.descanso==='produtos'
      ?'<div class="tcGira">'+ps.slice(0,4).map(function(p,i){
         return '<div class="tcGp"><div class="tcGf">'+fotoProd(p,i,'1')+'</div>'+
          '<div class="tcGn">'+E(p.nome)+'</div><div class="tcGv">R$ '+money(p.preco)+'</div></div>';
        }).join('')+'</div>'
      :'<div class="tcLogo">'+E((nomeLojaAtual()||'N')[0])+'</div>')+
     (t.descanso!=='logo'
      ?'<h1 style="text-shadow:'+F.sombra+'">'+E(t.titulo)+'</h1>'+
       '<div class="tcSb" style="text-shadow:'+F.sombra+'">'+E(t.sub)+'</div>':'')+
     '<div class="tcCta" style="background:'+t.botao+'">'+E(t.cta)+'</div></div>';
  }else if(TMC.passo===2){
    var alt=t.foto==='grande'?'1':t.foto==='media'?'1.2':'1.7';
    var cats=(DB.categorias||[]).filter(function(c){return c.ativo!==false});
    var corpo='';
    if(t.layout==='vitrine'){
      /* A grade se ajusta ao tamanho da tela: num monitor grande cabem
         cinco por linha, no tablet cabem duas. Antes era fixo em duas
         colunas, e num monitor de 32 polegadas cada cartao ficava do
         tamanho de uma folha. */
      var largo=t.foto==='grande'?330:t.foto==='media'?250:190;
      corpo='<div class="tcGrade" style="grid-template-columns:repeat(auto-fill,minmax('+
       largo+'px,1fr))">'+ps.map(function(p,i){
        return '<div class="tcCard" onclick="addTotem('+i+')">'+
         fotoProd(p,i,'1')+
         '<div class="tcInf"><div class="tcNm">'+E(p.nome)+'</div>'+
         (t.mostraDesc&&p.detalhes?'<div class="tcDs">'+E(p.detalhes)+'</div>':'')+
         '<div class="tcPr" style="color:'+t.fundo+'">R$ '+money(p.preco)+'</div></div></div>';
       }).join('')+'</div>';
    }else if(t.layout==='lista'){
      var tam=t.foto==='grande'?128:t.foto==='media'?96:68;
      corpo='<div class="tcLista">'+ps.map(function(p,i){
        return '<div class="tcLI" onclick="addTotem('+i+')">'+
         '<div class="tcLIf" style="width:'+tam+'px">'+fotoProd(p,i,'1')+'</div>'+
         '<div style="flex:1;min-width:0"><div class="tcNm">'+E(p.nome)+'</div>'+
         (t.mostraDesc&&p.detalhes?'<div class="tcDs">'+E(p.detalhes)+'</div>':'')+'</div>'+
         '<div class="tcPr" style="color:'+t.fundo+';margin:0;white-space:nowrap">R$ '+
         money(p.preco)+'</div></div>';
       }).join('')+'</div>';
    }else{
      var p0=ps[TMC.i||0]||ps[0];
      corpo='<div class="tcDest"><div class="tcDf">'+fotoProd(p0,TMC.i||0,'4/3')+'</div>'+
       '<div class="tcDi"><div class="tcDn">'+E(p0.nome)+'</div>'+
       (t.mostraDesc&&p0.detalhes?'<div class="tcDd">'+E(p0.detalhes)+'</div>':'')+
       '<div class="tcDp" style="color:'+t.fundo+'">R$ '+money(p0.preco)+'</div></div>'+
       '<div class="tcDnav"><div class="tcSeta" onclick="passaTotem(-1)">‹</div>'+
       '<button class="tcBtn" style="background:'+t.botao+'" onclick="addTotem('+(TMC.i||0)+')">Adicionar</button>'+
       '<div class="tcSeta" onclick="passaTotem(1)">›</div></div></div>';
    }
    el.innerHTML='<div class="tcTopo" style="background:'+t.fundo+'">'+
     '<button class="tcVb" onclick="irTotem(1)">‹</button><div class="tcT1">Escolha seu pedido</div></div>'+
     (cats.length?'<div class="tcCats">'+
       cats.map(function(c){
       return '<div class="tcCat" onclick="catTotem(\''+c.id+'\')"'+
        (TMC.cat===c.id?' style="background:'+t.fundo+';color:#fff;border-color:'+t.fundo+'"':'')+
        '>'+E(c.nome)+'</div>';}).join('')+'</div>':'')+
     corpo+
     '<div class="tcRod"><div class="tcRv"><span>'+TMC.sacola.length+' itens</span>'+
     '<b>R$ '+money(tot)+'</b></div>'+
     '<button class="tcBtn" style="background:'+t.botao+'" onclick="'+
     (cfgTotem().leveTambem&&TMC.sacola.length?'TMC.passo=\'leve\';pintarCheio()':'irTotem(3)')+
     '">Continuar</button></div>';
  }else if(TMC.passo===3){
    /* Uma pergunta por vez, o que foi digitado em letra grande, e o teclado
       ocupando a metade de baixo — que e onde o dedo alcanca. Antes eram
       tres campos apertados sem teclado nenhum. */
    var cps=camposTotem();
    if(!cps.length){irTotem(4);return;}
    if(!TEC.campo||!cps.some(function(c){return c.k===TEC.campo}))TEC.campo=cps[0].k;
    var atual=cps.find(function(c){return c.k===TEC.campo})||cps[0];
    var val=TEC.valor[atual.k]||'';
    var falta=faltaPreencher();
    el.innerHTML='<div class="tcTopo" style="background:'+t.fundo+'">'+
     '<button class="tcVb" onclick="irTotem(2)">‹</button>'+
     '<div class="tcT1">Quase lá</div>'+
     '<div class="tcT2">'+TMC.sacola.length+' itens · R$ '+money(tot)+'</div></div>'+
     '<div class="tcId2">'+
      (cps.length>1?'<div class="tcAbasC">'+cps.map(function(c){
        var v=TEC.valor[c.k]||'';
        return '<button class="tcAbaC'+(TEC.campo===c.k?' on':'')+(v?' feito':'')+'" '+
         'onclick="tecCampo(\''+c.k+'\')">'+(v?sv('check',13)+' ':'')+E(c.n)+
         (c.obr?'<i>*</i>':'')+'</button>';
      }).join('')+'</div>':'')+
      '<div class="tcPerg">'+E(atual.n)+(atual.obr?'':' <em>opcional</em>')+'</div>'+
      (atual.dica?'<div class="tcDica">'+E(atual.dica)+'</div>':'')+
      '<div class="tcEntrada'+(val?' cheio':'')+'">'+
       (val?E(mostraValor(atual.k,val)):'<span>toque nas teclas abaixo</span>')+
       '<b class="tcCursor"></b></div>'+
      (atual.tipo==='letras'?tecladoLetras():tecladoNumeros())+
     '</div>'+
     '<div class="tcRod">'+
      (falta.length
       ?'<div class="tcAviso">'+sv('help',15)+' Falta preencher: '+
         falta.map(function(c){return E(c.n)}).join(', ')+'</div>'
       :'<button class="tcBtn fant" onclick="irTotem(2)">Voltar ao cardápio</button>')+
      '<button class="tcBtn'+(falta.length?' off':'')+'" style="background:'+
       (falta.length?'#D8D0C2':t.botao)+';flex:1" '+
       (falta.length?'':'onclick="concluirTotem()"')+'>Fechar pedido · R$ '+money(tot)+'</button>'+
     '</div>';
  }else{
    var pd=TMC.pedido||{};
    el.innerHTML='<div class="tcFim" style="background:'+t.fundo+'">'+
     '<div class="tcTk"><div class="tcTk1">Sua senha</div>'+
     '<div class="tcTkN" style="color:'+t.fundo+'">'+(pd.senha||TMC.senha||'—')+'</div>'+
     (pd.numero?'<div class="tcTk1" style="opacity:.6">pedido #'+pd.numero+'</div>':'')+
     ((TEC.valor.nome||'')?'<div class="tcTk1">'+E(TEC.valor.nome)+'</div>':'')+
     '<div class="tcTkD">'+TMC.sacola.slice(0,4).map(function(p){
       return '<div class="tcTkR"><span>'+E(p.nome)+'</span><b>'+money(p.preco)+'</b></div>';
      }).join('')+
     '<div class="tcTkR" style="font-size:17px;margin-top:8px"><span><b>Total</b></span>'+
     '<b>R$ '+money(tot)+'</b></div></div></div>'+
     '<div class="tcFm">'+E(t.msgFim)+'</div>'+
     '<div class="tcFs">'+E(t.msgFim2)+'</div>'+
     (!cfgTotem().pagaNoTotem
      ?'<div class="tcPague">Leve a senha ao caixa para pagar</div>'
      :'<div class="tcPago">PAGO — não precisa ir ao caixa</div>')+
     '<button class="tcBtn" style="background:'+t.botao+';margin-top:30px" '+
     'onclick="reiniciarTotem()">Fazer outro pedido</button></div>';
  }
}
function addTotem(i){
  comecarMontagem(i);
}
/* fecha de verdade: cria o pedido e so entao mostra a senha */
function concluirTotem(){
  var ped=fecharPedidoTotem();
  if(!ped)return;
  TMC.pedido=ped;TMC.senha=ped.senha;
  irTotem(4);
}
function passaTotem(d){
  var ps=produtosTotem();
  TMC.i=((TMC.i||0)+d+ps.length)%ps.length;
  pintarCheio();
}


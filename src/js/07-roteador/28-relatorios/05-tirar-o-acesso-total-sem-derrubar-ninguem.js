/* ==========================================================
   TIRAR O ACESSO TOTAL SEM DERRUBAR NINGUEM
   Antes, um acesso total tem a lista de marcacoes VAZIA — ele nunca
   precisou dela. Tirar o acesso total nesse estado deixava a pessoa
   sem nenhuma tela, e o aviso mandava "marque antes", numa tela onde
   as marcacoes ainda nao valiam. Ordem impossivel.
   Agora, quando a lista esta vazia, o sistema ja marca tudo o que
   aquele acesso enxerga hoje. Nada muda para a pessoa no instante da
   troca — e a partir dali quem desmarca e o dono.
   ========================================================== */
async function tirarAcessoTotal(){
  var u=usrSel(); if(!u)return;
  var marcadas=Object.keys(u.permissoes||{}).filter(function(k){return u.permissoes[k]}).length;
  var vazio=!marcadas;
  var ok=await confirmar({
    titulo:'Escolher tela por tela?',
    texto:vazio
      ?'Vou marcar tudo o que este acesso já enxerga hoje. Nada muda para ele '+
       'agora — daqui em diante você desmarca o que ele não deve ver.'
      :'Este acesso deixa de ver tudo e passa a ver só o que estiver marcado.',
    linhas:vazio
      ?[['Telas marcadas hoje','nenhuma',''],
        ['Depois da mudança','continua vendo o mesmo','']]
      :[['Telas marcadas hoje',String(marcadas),''],
        ['Depois da mudança','vê só essas '+marcadas,'']],
    ok:'Continuar'
  });
  if(!ok)return;
  u.tudo=false; u.mestre=false;
  if(vazio){
    /* marca cada tela que este acesso pode ver na nova condicao.
       As telas exclusivas de outro grupo ficam de fora — elas nao
       apareceriam de qualquer jeito. */
    u.permissoes={};
    MOD.filter(function(m){return m.id!=='teste'}).forEach(function(m){
      (m.it||[]).forEach(function(i){
        var ch=m.id+'/'+i.id;
        if(SO_PLATAFORMA.indexOf(ch)>=0&&!ehPlataforma(u))return;
        if(SO_FRANQUEADORA.indexOf(ch)>=0&&!ehFranqueadora(u))return;
        u.permissoes[ch]=true;
      });
    });
    marcadas=Object.keys(u.permissoes).length;
  }
  salvar(); semPular(telaUsuarios);
  toast('Pronto: '+marcadas+' tela(s) marcadas. Agora é só desmarcar o que não deve aparecer.');
}
function abaPermUsr(u){
  var p=u.permissoes||{};
  /* ==========================================================
     ACESSO TOTAL PASSA POR CIMA DAS MARCACOES
     podeVer() devolve true para quem tem 'tudo' ou 'mestre' ANTES de olhar
     a lista de permissoes. Entao desmarcar uma tela para um acesso total
     nao tinha efeito nenhum — e a tela nao dizia isso em lugar nenhum. A
     pessoa desmarcava, salvava, e a tela continuava aparecendo para o
     franqueado, sem explicacao.
     Agora o aviso e explicito e da o caminho para resolver.
     ========================================================== */
  var total=!!(u.tudo||u.mestre);
  var avisoTotal = total
    ? '<div class="permTotal">'+sv('lock',15)+
      '<div><b>Este acesso está marcado como acesso total</b>'+
      '<span>Enquanto estiver assim, ele enxerga todas as telas e '+
      'as marcações abaixo não têm efeito.</span></div>'+
      '<button class="btnP2" onclick="tirarAcessoTotal()">'+
      'Passar a controlar tela por tela</button></div>'
    : '';
  return '<div class="usrCorpo">'+
   avisoTotal+
   '<div class="permBarra'+(total?' permFraca':'')+'">'+
    '<span>'+contaPerm(u)+' tela(s) liberada(s)</span>'+
    '<div style="flex:1"></div>'+
    '<button class="btnMini" onclick="marcarTudoUsr(true)">liberar tudo</button>'+
    '<button class="btnMini" onclick="marcarTudoUsr(false)">bloquear tudo</button>'+
    '<button class="btnMini" onclick="aplicarModelo(\'franqueado\')">modelo franqueado</button>'+
    '<button class="btnMini" onclick="aplicarModelo(\'gerente\')">modelo gerente</button>'+
    '<button class="btnMini" onclick="aplicarModelo(\'caixa\')">modelo caixa</button>'+
    '<button class="btnMini" onclick="aplicarModelo(\'producao\')">modelo produção</button>'+
   '</div>'+
   '<div class="permLista">'+
   MOD.filter(function(m){return m.id!=='teste'}).map(function(m){
     var itens=m.it||[];
     var lib=itens.filter(function(i){return p[m.id+'/'+i.id]}).length;
     var todos=lib===itens.length&&itens.length>0;
     return '<div class="permMod">'+
      '<div class="permModH">'+
       '<label class="chkMini"><input type="checkbox"'+(todos?' checked':'')+
        (lib&&!todos?' data-meio="1"':'')+
        ' onchange="togModUsr(\''+m.id+'\',this.checked)"><i></i></label>'+
       sv(m.ic,15)+'<b>'+E(m.n)+'</b>'+
       '<span class="permN" data-cont="'+m.id+'">'+lib+'/'+itens.length+'</span></div>'+
      '<div class="permItens">'+itens.map(function(i){
        var on=!!p[m.id+'/'+i.id];
        return '<label class="permIt'+(on?' on':'')+'" '+
         'data-perm="'+m.id+'/'+i.id+'" data-mod="'+m.id+'">'+
         '<input type="checkbox"'+(on?' checked':'')+
         ' onchange="togPermUsr(\''+m.id+'/'+i.id+'\',this)">'+
         '<span>'+E(i.n)+'</span></label>';
      }).join('')+'</div></div>';
   }).join('')+
   '</div></div>';
}
/* ---------- ações ---------- */
function usrSel(){return DB.usuarios.find(function(x){return x.id===US.sel})}
/* ==========================================================
   REDESENHAR SEM PULAR PARA O TOPO
   Cada clique numa permissao redesenha a tela inteira (innerHTML), e a barra
   de rolagem volta ao inicio. Quem esta liberando 60 telas rola ate embaixo,
   clica, e e jogado de volta la em cima a cada clique.
   O guardiao geral de rolagem existe, mas ele age no MutationObserver, no
   mesmo instante em que o HTML e trocado — as vezes antes de o navegador
   recalcular a altura, e ai o scrollTop e cortado para zero.
   Aqui a posicao e guardada ANTES, e devolvida tres vezes: logo apos,
   no proximo quadro e no seguinte. Uma delas pega a altura ja certa.
   ========================================================== */
function semPular(fn){
  /* ==========================================================
     REDESENHAR SEM PULAR — DE UMA VEZ
     Errei duas vezes tentando adivinhar QUAL barra estava rolada: primeiro
     guardei so o painel central (.etScroll), depois acrescentei a janela e a
     lista da esquerda. Faltava justamente a que importava — .usrCorpo, a
     barra de dentro do quadro de permissoes.
     Adivinhar qual elemento rola nao escala: cada tela tem a sua, e a
     proxima que eu criar tera outra. Entao agora nao se pergunta mais:
     guarda-se a posicao de TUDO que estiver rolado, seja o que for, e
     devolve-se pelo caminho do elemento na arvore — que e o mesmo antes e
     depois, porque a tela redesenhada tem a mesma estrutura.
     ========================================================== */
  function caminho(el){
    var p=[],n=el;
    while(n&&n!==document.body){
      var pai=n.parentNode;
      if(!pai)break;
      var i=Array.prototype.indexOf.call(pai.children,n);
      p.unshift(n.tagName+':'+i+':'+(n.className||''));
      n=pai;
    }
    return p.join('>');
  }
  var marcas=[];
  var win=(window.scrollY||window.pageYOffset||document.documentElement.scrollTop||0);
  try{
    var todos=document.querySelectorAll('*');
    for(var k=0;k<todos.length;k++){
      var e=todos[k];
      if(e.scrollTop>0)marcas.push({c:caminho(e),y:e.scrollTop});
    }
  }catch(err){_quieto(err,'semPular')}

  _emSemPular++;
  try{ fn(); } finally { _emSemPular--; }

  function devolve(){
    try{
      if(win){
        var a=(window.scrollY||window.pageYOffset||document.documentElement.scrollTop||0);
        if(Math.abs(a-win)>1)window.scrollTo(0,win);
      }
      if(!marcas.length)return;
      /* ==========================================================
         ACHAR PELO CAMINHO, SEM VARRER A TELA INTEIRA
         Antes isto montava o caminho de TODOS os elementos da pagina para
         depois procurar os poucos que interessavam — e repetia isso cinco
         vezes (agora, dois quadros, 60ms e 150ms). Numa tela de milhares
         de elementos era lento a ponto de travar.
         O caminho ja diz a posicao de cada filho: da para descer por ele
         direto, do body ate o elemento. Passou de varrer tudo para uns
         poucos passos.
         ========================================================== */
      marcas.forEach(function(m){
        var partes=m.c.split('>'),n=document.body,ok=true;
        for(var i=0;i<partes.length&&ok;i++){
          var p=partes[i].split(':'),idx=parseInt(p[1],10);
          var f=(n&&n.children)?n.children[idx]:null;
          if(!f||f.tagName!==p[0]){ok=false;break}
          n=f;
        }
        if(ok&&n&&Math.abs(n.scrollTop-m.y)>1)n.scrollTop=m.y;
      });
    }catch(err){_quieto(err,'semPular')}
  }
  devolve();
  requestAnimationFrame(function(){ devolve(); requestAnimationFrame(devolve); });
  setTimeout(devolve,60);
  setTimeout(devolve,150);
}
/* ==========================================================
   MARCAR UMA TELA NAO REMONTA A TELA INTEIRA
   Cada clique numa caixa chamava telaUsuarios(), que refaz o innerHTML
   completo: a arvore, o painel e as 81 caixas de marcar. O navegador
   destruia e recriava tudo a cada clique — e quem estava montando a
   permissao de um franqueado, marcando dezenas de telas seguidas, sentia
   a interface travar em cada uma.
   O que muda ao marcar uma caixa e: a propria caixa e o contador do
   modulo. So isso e atualizado agora.
   ========================================================== */
function togPermUsr(chave, elBox){
  var u=usrSel();if(!u)return;
  u.permissoes=u.permissoes||{};
  u.permissoes[chave]=!u.permissoes[chave];
  var ligou=!!u.permissoes[chave];
  if(!ligou)delete u.permissoes[chave];
  salvar();

  var lab = elBox && elBox.closest ? elBox.closest('.permIt') : null;
  if(!lab){ semPular(telaUsuarios); return; }   /* sem o elemento, refaz */
  lab.classList.toggle('on', ligou);

  /* contador do modulo e o total no topo */
  var mid = lab.getAttribute('data-mod');
  var cont = document.querySelector('.permN[data-cont="'+mid+'"]');
  if(cont){
    var m=MOD.find(function(x){return x.id===mid})||{it:[]};
    var n=(m.it||[]).filter(function(i){return u.permissoes[mid+'/'+i.id]}).length;
    cont.textContent = n+'/'+(m.it||[]).length;
  }
  var topo=document.querySelector('.permBarra span');
  if(topo)topo.textContent = contaPerm(u)+' tela(s) liberada(s)';
}
function togModUsr(mid,marcar){
  var u=usrSel();if(!u)return;
  u.permissoes=u.permissoes||{};
  var m=MOD.find(function(x){return x.id===mid});
  (m.it||[]).forEach(function(i){
    if(marcar)u.permissoes[mid+'/'+i.id]=true;
    else delete u.permissoes[mid+'/'+i.id];
  });
  salvar();semPular(telaUsuarios);
}
function marcarTudoUsr(marcar){
  var u=usrSel();if(!u)return;
  u.permissoes={};
  if(marcar)MOD.filter(function(m){return m.id!=='teste'}).forEach(function(m){
    (m.it||[]).forEach(function(i){u.permissoes[m.id+'/'+i.id]=true});
  });
  salvar();semPular(telaUsuarios);
}
var MODELOS={
 franqueado:['pdv/pdv','pdv/pedidos-online','cardapio/cfg-cardapio',
   'financeira/lancamentos-financeiros','financeira/fluxo-caixa','financeira/fornecedores',
   'financeira/frente-caixa','financeira/formas-pagamento',
   'clientes/cadastro-clientes','clientes/cupons-clientes',
   'estoque/producao','estoque/ficha-tecnica','estoque/ingredientes-insumos',
   'estoque/movimentacao-estoque','estoque/posicao-estoque','estoque/contagem-estoque',
   'estoque/historico-posicao','estoque/notas-entrada',
   'relatorios/faturamento-dia','relatorios/itens-vendidos','relatorios/vendas-periodo',
   'relatorios/itens-consumidos','relatorios/vendas-area-entrega','relatorios/vendas-forma-pagamento',
   'dashboard/faturamento','dashboard/canais-venda','dashboard/venda-data-hora',
   /* o franqueado ve os proprios cancelamentos, mas nao mexe no cadastro
      de motivos: quem decide a lista e a franqueadora */
   'relatorios/cancelamentos'],
 caixa:['pdv/pdv','pdv/pedidos-online','clientes/cadastro-clientes'],
 producao:['estoque/producao','estoque/ficha-tecnica','estoque/posicao-estoque',
   'estoque/movimentacao-estoque','estoque/contagem-estoque','estoque/ingredientes-insumos'],
 gerente:['pdv/pdv','pdv/pedidos-online','financeira/frente-caixa',
   'relatorios/faturamento-dia','relatorios/itens-vendidos','relatorios/cancelamentos',
   'estoque/posicao-estoque','estoque/contagem-estoque','clientes/cadastro-clientes',
   'dashboard/faturamento']
};
function aplicarModelo(qual){
  var u=usrSel();if(!u)return;
  u.permissoes={};
  (MODELOS[qual]||[]).forEach(function(k){u.permissoes[k]=true});
  salvar();semPular(telaUsuarios);
  toast('Modelo aplicado — ajuste o que precisar.');
}
function togLojaUsr(sid){
  var u=usrSel();if(!u)return;
  u.sucursais=u.sucursais||[];
  var i=u.sucursais.indexOf(sid);
  if(i>=0)u.sucursais.splice(i,1); else u.sucursais.push(sid);
  salvar();semPular(telaUsuarios);
}
function todasLojasUsr(marcar){
  var u=usrSel();if(!u)return;
  u.sucursais=marcar?[]:sucAtivas().map(function(s){return s.id});
  salvar();semPular(telaUsuarios);
}
function togAtivoUsr(){
  var u=usrSel();if(!u)return;
  u.ativo=(u.ativo===false);
  salvar();semPular(telaUsuarios);
}
function novoUsuario(){US.novaSuc=null;formUsuario();}
function editarUsuario(){formUsuario(US.sel);}
function formUsuario(id){
  baseUsr();
  var u=id?DB.usuarios.find(function(x){return x.id===id}):null;
  /* ==========================================================
     O RESPONSAVEL DA UNIDADE NAO SE EDITA POR AQUI
     Login e senha de quem responde por uma loja moram no cadastro da
     sucursal — junto do nome, CNPJ e telefone dela. Abrir um segundo
     formulario do mesmo dado foi o que espalhou o cadastro e deixou os
     dois lugares gravando pedacos diferentes.
     Aqui fica a EQUIPE da loja: caixa, producao, socio.
     ========================================================== */
  if(u){
    var sucDele=(DB.sucursais||[]).find(function(x){
      return String(x.loginResp||'').toLowerCase()===String(u.login||'').toLowerCase();
    });
    if(sucDele){ formSucursal(sucDele.id); return; }
  }
  modal(u?'Editar usuário':'Novo usuário',
  '<div class="mdB">'+
   '<div class="row2">'+
    '<div class="fld2" style="margin:0"><label>Nome *</label>'+
     '<input id="uNome" value="'+E(u?u.nome:'')+'" placeholder="nome da pessoa"></div>'+
    '<div class="fld2" style="margin:0"><label>Login *</label>'+
     '<input id="uLogin" value="'+E(u?u.login:'')+'" placeholder="sem espaços, ex: joao.jales"></div>'+
   '</div>'+
   '<div class="row2">'+
    '<div class="fld2" style="margin:0"><label>Senha '+(u?'<small>(deixe vazio para manter)</small>':'*')+'</label>'+
     '<input id="uSenha" type="text" value="" placeholder="'+(u?'não alterar':'senha de acesso')+'"></div>'+
    '<div class="fld2" style="margin:0"><label>Telefone</label>'+
     '<input id="uTel" value="'+E(u?u.tel:'')+'" placeholder="para contato"></div>'+
   '</div>'+
   /* ==========================================================
      SENHA DE AUTORIZACAO — SEPARADA DA SENHA DE ENTRAR

      A senha de entrar fica no servico de login, criptografada: o
      navegador nao consegue le-la, e nem deve. Por isso o cancelamento
      dizia "nao tem senha cadastrada" para quem entrava normalmente.

      Esta segunda senha existe so para autorizar o que precisa de
      assinatura na loja — hoje o cancelamento de venda. E curta de
      proposito, para digitar rapido no balcao, e pode ser dada ao
      gerente sem entregar a senha de entrar no sistema.
      ========================================================== */
   '<div class="fld2"><label>Senha para autorizar cancelamento '+
     '<small>(diferente da senha de entrar)</small></label>'+
    /* nunca preenche com a senha atual: o navegador nao a conhece mais.
       Vazio = mantem a que esta no cofre. */
    '<input id="uSenhaCx" type="password" value="" autocomplete="new-password" '+
     'placeholder="'+(temSenhaCadastrada({id:(u?u.id:''),senha:1})?'já cadastrada — digite para trocar':'4 a 6 dígitos')+'"></div>'+
   /* A função diz o que a pessoa faz na loja e é o que aparece na abertura
      de caixa. As telas que ela enxerga continuam sendo as marcadas abaixo —
      a função não manda nas permissões, só descreve o papel. */
   '<div class="fld2"><label>Função na loja</label>'+
    '<div class="tipoEsc">'+FUNCOES.map(function(f){
      var sel=(u?(u.funcao||'atendente'):'atendente')===f.id;
      return '<label class="tipoOp'+(sel?' on':'')+'">'+
       '<input type="radio" name="uFunc" value="'+f.id+'"'+(sel?' checked':'')+'>'+
       '<b>'+f.n+'</b><span>'+f.d+'</span></label>';
    }).join('')+'</div></div>'+
   '<div style="background:#EAF3F8;border:1px solid #C5DCE8;border-radius:var(--r-s);'+
    'padding:10px 12px;margin:12px 0;font-size:12.5px;line-height:1.5;color:var(--ink-2)">'+
    '<b style="color:var(--ink)">A conta de acesso é criada no banco ao salvar.</b><br>'+
    'O login precisa ser um e-mail e a senha, ao menos 6 caracteres — é o Auth do banco '+
    'que guarda, cifrada. '+(u?'Deixe a senha vazia para não alterar a atual.':'')+
   '</div>'+
   (u&&u.mestre?'':'<label class="chkL"><input type="checkbox" id="uTudo" '+
     ((u&&u.tudo)?'checked':'')+'>'+
     '<span><b>Acesso total</b><span>vê todas as telas e todas as lojas, como o administrador</span></span></label>')+
  '</div>','Salvar',async function(){
    var nome=$('uNome').value.trim();
    var login=$('uLogin').value.trim().toLowerCase().replace(/\s+/g,'');
    if(!nome){toast('Informe o nome.');return false;}
    if(!login){toast('Informe o login.');return false;}
    /* o Auth so aceita e-mail; login sem arroba nao conseguiria entrar */
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(login)){
      toast('O login precisa ser um e-mail — é ele que entra no sistema.');return false;}
    var rep=DB.usuarios.find(function(x){return x.login===login&&x.id!==(u?u.id:'')});
    if(rep){toast('Já existe um usuário com o login "'+login+'".');return false;}
    var senha=$('uSenha').value;
    if(!u&&!senha){toast('Informe a senha.');return false;}
    if(senha&&senha.length<6){toast('A senha precisa ter ao menos 6 caracteres.');return false;}
    /* a conta de verdade nasce no servidor: a chave de administrador nao pode
       vir para o navegador, senao qualquer cliente vira admin de todas as redes */
    if(senha||!u){
      if(!NUVEM.ligada){toast('Ligue a nuvem para criar ou alterar o acesso.');return false;}
      try{
        var rr=await criarAcessoNoBanco(login,senha,nome);
        if(rr&&rr.erro){toast(rr.erro);return false;}
      }catch(e){
        toast('Não consegui criar o acesso: '+((e&&e.message)||'servidor não respondeu'));
        return false;
      }
    }
    var func='atendente';
    var rs=document.querySelectorAll('input[name="uFunc"]');
    for(var i=0;i<rs.length;i++)if(rs[i].checked)func=rs[i].value;
    var senhaCx=($('uSenhaCx')?$('uSenhaCx').value:'').trim();
    if(senhaCx&&senhaCx.length<4){
      toast('A senha de autorização precisa ter ao menos 4 caracteres.');return false;}
    /* a senha de autorizacao nao fica no cadastro: vai para o cofre como hash */
    var dados={nome:nome,login:login,tel:$('uTel').value.trim(),funcao:func,
      senhaCaixa:'',
      tudo:$('uTudo')?$('uTudo').checked:(u?u.tudo:false)};
    if(senha)dados.senha=senha;
    if(u)Object.assign(u,dados);
    else{
      var novo=Object.assign({id:uid('usr'),ativo:true,
        sucursais:(US.novaSuc?[US.novaSuc]:[]),permissoes:{},
        criadoEm:new Date().toISOString()},dados);
      DB.usuarios.push(novo);
      US.sel=novo.id;
    }
    salvar();
    /* a senha de autorizacao (cancelar, sangria) vai pela funcao unica (GL-04) */
    if(senhaCx){
      var _ref=(u?u.id:(US.sel||''));
      var _rs=await definirSenhaOperador(_ref, senhaCx);
      if(!_rs.ok)toast('Usuário salvo, mas '+_rs.msg.charAt(0).toLowerCase()+_rs.msg.slice(1));
    }
    telaUsuarios();
    toast('Usuário salvo'+((senha||!u)?' e acesso liberado.':'.'));
    return true;
  },'lg');
}
/* fala com a funcao do servidor, que e a unica que tem a chave de administrador */
async function criarAcessoNoBanco(login,senha,nome){
  var r=await fetch(NUVEM.url+'/functions/v1/criar-usuario',{
    method:'POST',
    headers:{'apikey':NUVEM.chave,'Authorization':'Bearer '+NUVEM.token,
             'Content-Type':'application/json'},
    /* admin da propria loja: cadastra a equipe dela, dentro do que a matriz
       liberou. Ver comentario em salvarUnidade. */
    body:JSON.stringify({email:login,senha:senha,nome:nome,cargo:'admin'})});
  var d=null;
  try{ d=await r.json(); }catch(e){_quieto(e,'criarAcessoNoBanco')}
  if(!r.ok)return {erro:(d&&d.erro)||('o servidor recusou ('+r.status+')')};
  return d;
}
async function excluirUsuario(){
  var u=usrSel();
  if(!u||u.mestre)return;
  var ok=await confirmar({titulo:'Excluir '+E(u.nome),
    texto:'O acesso "'+E(u.login)+'" deixa de entrar no sistema.\n\n'+
      'O histórico do que essa pessoa fez é preservado.',
    ok:'Excluir',tipo:'perigo'});
  if(!ok)return;
  /* ------------------------------------------------------------------
     A exclusao precisa CHEGAR na nuvem.
     usuarios_sistema esta no MAPA com espelha:false — de proposito, para
     uma unidade nao apagar da nuvem os acessos que ela nem enxerga. So que
     isso valia tambem para quem PODE apagar: o registro saia daqui, o
     download seguinte trazia de volta, e a pessoa apagava o mesmo acesso
     dez vezes sem entender por que ele voltava.
     Agora a exclusao vai direto na tabela, pela linha daquele acesso nesta
     loja. Se a nuvem recusar, o registro NAO some daqui — mentir que apagou
     e pior do que avisar que nao deu.
     ------------------------------------------------------------------ */
  if(NUVEM.ligada&&NUVEM.loja){
    try{
      /* Desativa em vez de apagar: o login para de entrar na hora, mas o
         registro fica no banco com data e responsavel. Sem isso nao ha como
         saber depois de quem era o acesso que abriu aquele caixa. */
      await api('rpc/usuario_excluir','POST',{p_ref:u.id});
    }catch(e){
      painelErro('Não consegui excluir na nuvem.',detalheErro(e));
      return;
    }
  }
  DB.usuarios=DB.usuarios.filter(function(x){return x.id!==u.id});
  US.sel=null;salvar();telaUsuarios();
  toast('Acesso excluído.');
}

/* ---------- POPUP E MODAL ---------- */
/* Clicar de novo no MESMO botao fecha o menu.
   Antes, quem abria chamava fecharPops() e logo em seguida abria outro —
   entao o menu fechava e reabria no mesmo clique, e parecia que nunca
   fechava. So saia clicando fora, o que nao e o que a pessoa espera. */
var _popDono=null;
function pop(ev,html){
  var dono=ev.currentTarget;
  if(_popDono===dono&&document.querySelector('.popMenu')){
    fecharPops();
    return document.createElement('div');   /* solto: quem chama nao quebra */
  }
  fecharPops();
  _popDono=dono;
  var el=document.createElement('div');
  el.className='popMenu';el.innerHTML=html;
  document.body.appendChild(el);
  var r=ev.currentTarget.getBoundingClientRect();
  var top=r.bottom+5,left=r.left;
  if(left+el.offsetWidth>window.innerWidth-10)left=window.innerWidth-el.offsetWidth-10;
  if(top+el.offsetHeight>window.innerHeight-10)top=r.top-el.offsetHeight-5;
  el.style.top=top+'px';el.style.left=left+'px';
  return el;
}
function modal(titulo,corpo,btn,onOk,tam){
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox'+(tam==='lg'?' lg':'')+'"><div class="mdH"><b>'+E(titulo)+'</b>'+
  '<button onclick="fecharModal()">&times;</button></div>'+corpo+
  '<div class="mdF"><button class="btn" onclick="fecharModal()">Cancelar</button>'+
  '<button class="btn p" id="mdOk">'+E(btn)+'</button></div></div>';
  document.body.appendChild(o);
  fecharSoForaDeVerdade(o);
  $('mdOk').onclick=async function(){
    var f=onOk?onOk():true;
    if(f&&typeof f.then==='function')f=await f;   /* validação pode perguntar antes */
    if(f!==false)fecharModal();
  };
}
/* fechar ao clicar fora só vale se o clique nasceu fora.
   Antes, arrastar para selecionar um valor dentro do campo fechava a janela
   e perdia tudo que estava preenchido. */
function fecharSoForaDeVerdade(o){
  var nasceuFora=false;
  o.addEventListener('mousedown',function(e){nasceuFora=(e.target===o);});
  o.addEventListener('click',function(e){
    if(e.target===o&&nasceuFora)fecharModal();
    nasceuFora=false;
  });
}
function fecharModal(){var o=$('mdOv');if(o)o.remove();}
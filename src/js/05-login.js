/* ===== BLOCO 5 — LOGIN ===== */
$('tg').onclick=function(){
  var i=$('lgP'),v=i.type==='text';
  i.type=v?'password':'text';
  this.setAttribute('aria-label',v?'Mostrar senha':'Ocultar senha');
};
function abrirSessao(){
  carregar();
  $('login').classList.add('hide');$('app').classList.remove('hide');
  boot();
  /* a entrada pelo Auth ja deixou o aparelho ligado: aqui so falta buscar
     o que mudou. Quem voltou por sessao guardada ainda precisa religar. */
  setTimeout(function(){
    try{
      if(NUVEM.ligada){
        statusNuvem('ok');rodape();
        setTimeout(ligarTempoReal,400);
        if(NUVEM.plataforma){
          statusNuvem('ok');
          try{ abrir('tecnico','instalacao'); }catch(e){_quieto(e,'abrirSessao')}
          return;
        }
        setTimeout(async function(){
          try{
            statusNuvem('baixando'); await baixarDaNuvem(true); statusNuvem('ok');
            if(S.mod&&S.it)abrir(S.mod,S.it);
            /* a fila da assistente entra assim que a nuvem estiver de pé */
            try{ await rodarCaixaAssistente(true); ligarCaixaAssistente(); }catch(e){_quieto(e,'abrirSessao')}
          }catch(e){ statusNuvem('erro',(e&&e.message)||''); }
        },900);
      }else religarNuvem();
    }catch(e){console.error('religar',e);}
  },500);
  /* e confere: aparelho fora da nuvem numa loja tem de gritar, nao sussurrar */
  setTimeout(conferirNuvem,4000);
}
function chaveCliente(t){
  return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]/g,'');
}
/* a que rede este acesso pertence */
function redeDoUsuario(u){
  if(!u)return null;
  try{
    baseRedes();
    if(u.redeId)return (DB.redes||[]).find(function(r){return r.id===u.redeId})||null;
    var sid=(u.sucursais||[])[0];
    if(sid){
      var sc=(DB.sucursais||[]).find(function(x){return x.id===sid});
      if(sc&&sc.redeId)return (DB.redes||[]).find(function(r){return r.id===sc.redeId})||null;
    }
    var dom=String(u.login||'').split('@')[1]||'';
    if(dom)return (DB.redes||[]).find(function(r){return chaveCliente(r.dominio)===chaveCliente(dom)})||null;
  }catch(e){_quieto(e,'redeDoUsuario')}
  return null;
}
/* ----------------------------------------------------------
   ENTRADA PELO SUPABASE AUTH
   Antes eram duas entradas: a do sistema (senha em texto puro na
   tabela usuarios_sistema) e a da nuvem (Banco de dados). Como
   ninguem entrava pelo Auth, auth.uid() ficava vazio e as regras
   de RLS das 29 tabelas nao tinham em quem se apoiar — estavam
   escritas e nao valiam nada.
   Agora e uma entrada so: quem entra no sistema entra na nuvem.
   Devolve {ok:true,...} ou {ok:false, motivo:'senha'|'rede'|'perfil'}.
   ---------------------------------------------------------- */
async function entrarPeloAuth(lg,sn){
  if(!window.supabase||!NUVEM.url||!NUVEM.chave)return {ok:false,motivo:'rede'};
  var cli;
  try{ cli=cliente(); if(!cli)return {ok:false,motivo:'rede'}; }
  catch(e){ return {ok:false,motivo:'rede'}; }
  var r;
  try{ r=await cli.auth.signInWithPassword({email:lg,password:sn}); }
  catch(e){ return {ok:false,motivo:'rede'}; }
  if(r.error){
    /* senha errada e uma resposta do servidor; sem internet o pedido nem chega la.
       A diferenca importa: uma recusa nao pode virar entrada pela conferencia local. */
    var m=String((r.error&&r.error.message)||'').toLowerCase();
    var st=r.error&&r.error.status;
    if(st===400||st===401||m.indexOf('invalid')>=0||m.indexOf('credential')>=0
       ||m.indexOf('not confirmed')>=0)return {ok:false,motivo:'senha'};
    return {ok:false,motivo:'rede'};
  }
  var ses=r.data&&r.data.session?r.data.session:null;
  var rp=await cli.from('perfis')
    .select('id,nome,cargo,loja_id,empresa_id,sucursal_ref,nome_unidade')
    .eq('id',r.data.user.id).maybeSingle();
  if(rp.error||!rp.data){
    /* local: derrubar a sessao das OUTRAS lojas por causa de um perfil
       que nao carregou aqui e o defeito descrito em desconectarNuvem() */
    try{cli.auth.signOut({scope:'local'})}catch(e){_quieto(e,'entrarPeloAuth')}
    return {ok:false,motivo:'perfil'};
  }
  /* daqui em diante o aparelho esta ligado na nuvem — sem passar por
     Banco de dados. Era isso que deixava o socio lancando no vazio. */
  /* ==========================================================
     A NUVEM MANDA — MAS SO QUANDO QUEM ENTRA E OUTRO

     O aparelho era limpo em TODO login. A razao e boa: quem usou o
     computador antes nao pode deixar a base dele para o proximo — foi assim
     que os dados da Jolo apareceram dentro da Rafaelos.
     O erro era o alcance. Limpar tambem quando e A MESMA PESSOA da MESMA
     loja entrando de novo faz o sistema comecar do zero toda vez: as 51
     tabelas sao rebaixadas, e o registro de "o que ja subiu" (_hash e _uuid)
     vai junto — por isso o envio dizia "insumos: 250 de 250 mudaram" e
     "estoque_unidade: 241 de 241 mudaram" mesmo sem ninguem ter mexido em
     nada. Eram os 40 segundos ate os valores aparecerem.
     Agora a limpeza compara tres coisas: a loja, a unidade e o usuario. Se
     as tres baterem, o que esta no aparelho e da propria pessoa e continua
     valendo. Qualquer diferenca — outro usuario, outra unidade, outra
     empresa — limpa tudo, exatamente como antes.
     ========================================================== */
  var _mesmoDono=false, _ant=null;
  try{
    var _txt=localStorage.getItem('nexor_dados');
    if(_txt){
      _ant=JSON.parse(_txt);
      _mesmoDono = !!_ant
        && _ant._dono===rp.data.loja_id
        && _ant._donoUsuario===r.data.user.id
        && String(_ant._donoSuc||'')===String(rp.data.sucursal_ref||'');
    }
  }catch(eL0){ _mesmoDono=false; _ant=null; }

  if(_mesmoDono){
    DB=_ant;
    /* ==========================================================
       `semear()` AQUI DESFAZIA A LINHA DE CIMA

       `semear()` nao acrescenta nada: ela TROCA o DB inteiro por
       `{categorias:[],produtos:[],grupos:[],fichas:[]}` — e o que ela
       faz e certo, para cliente NOVO. Chamada logo depois de `DB=_ant`,
       ela jogava fora exatamente o que a linha anterior tinha acabado de
       restaurar: formas de pagamento, contas, motivos, o registro do que
       ja subiu (`_hash`, `_uuid`) e o que ainda nao tinha subido.

       O efeito era o oposto do que o comentario acima promete. E o pior:
       com as listas vazias, as sementes de fabrica (`baseFormas`,
       `baseContas`) repunham os valores de fabrica — 1,99% no debito,
       3,49% no credito, conta nenhuma — e o envio seguinte levava isso
       para a nuvem por cima da configuracao da loja. Foi assim que as
       taxas de Santa Fe do Sul voltaram sozinhas em 31/08/2026, meia
       hora depois de o Rafael as ter gravado.

       As linhas abaixo ja garantem que nenhuma lista basica falte.
       ========================================================== */
    DB.usuarios=DB.usuarios||[];DB.sucursais=DB.sucursais||[];
    DB.insumos=DB.insumos||[];DB.produtos=DB.produtos||[];
    DB.categorias=DB.categorias||[];DB.fichas=DB.fichas||[];
    DB.pedidos=DB.pedidos||[];DB.clientes=DB.clientes||[];
    DB._snap=DB._snap||{};DB._hash=DB._hash||{};DB._uuid=DB._uuid||{};
    NUVEM.zerado=false;
    logNuvem('mesma pessoa, mesma unidade — o que estava no aparelho foi mantido');
  }else{
  try{
    localStorage.removeItem('nexor_dados');
    localStorage.removeItem('nexor_respaldo');
    localStorage.removeItem('nexor_respaldo_info');
  }catch(eL){_quieto(eL,'entrarPeloAuth')}
  DB={};
  try{ semear(); }catch(eS2){_quieto(eS2,'entrarPeloAuth')}
  /* deixa as listas basicas de pe: quem chamar logo depois nao pode
     encontrar o DB pela metade */
  DB.usuarios=[];DB.sucursais=[];DB.insumos=[];DB.produtos=[];
  DB.categorias=[];DB.fichas=[];DB.pedidos=[];DB.clientes=[];
  DB._snap={};DB._hash={};DB._uuid={};
  NUVEM.zerado=true;
  logNuvem('aparelho limpo no login — os dados vêm todos da nuvem');
  }
  DB._dono=rp.data.loja_id;
  DB._donoUsuario=r.data.user.id;
  DB._donoSuc=rp.data.sucursal_ref||'';
  /* 'baixou' volta a ser falso em qualquer caso: enquanto o download desta
     sessao nao chegar, este aparelho nao espelha exclusao nenhuma. */
  NUVEM.baixou=false;

  /* ==========================================================
     MODO PLATAFORMA
     O dono da Joia nao pertence a loja nenhuma. Amarra-lo a uma loja foi o
     que fez todo cliente novo nascer dentro do primeiro: quem cadastra de
     dentro de uma empresa cadastra PARA aquela empresa.
     Perfil sem loja e com cargo 'plataforma' entra em modo plataforma: nao
     baixa dados de loja, nao envia nada, e abre direto no painel de empresas.
     ========================================================== */
  NUVEM.plataforma=(!rp.data.loja_id&&rp.data.cargo==='plataforma');
  NUVEM.cli=cli;NUVEM.perfil=rp.data;NUVEM.loja=rp.data.loja_id;
  if(rp.data.sucursal_ref){DB.lojaAtual=rp.data.sucursal_ref;S.loja=rp.data.sucursal_ref;}
  /* A unidade vem do perfil, nao da escolha da pessoa: o gerente de Jales
     entra em Jales. Sem isto, ele caia sempre na primeira da lista. */
  if(rp.data.sucursal_ref){
    DB.lojaAtual=rp.data.sucursal_ref;
    S.loja=rp.data.sucursal_ref;
  }
  NUVEM.token=ses?ses.access_token:null;NUVEM.ligada=true;
  setModo('nuvem');
  /* as permissoes continuam vindo de usuarios_sistema, agora com RLS de verdade */
  var linha=null;
  try{
    /* ------------------------------------------------------------------
       maybeSingle() devolve ERRO quando ha mais de uma linha — nao devolve
       a primeira. Se o mesmo login existir duas vezes na empresa (uma criada
       pelo painel, outra pela tela da propria loja), o resultado era 'linha
       nula' e a pessoa entrava com PERMISSAO ZERO, mesmo com tudo liberado.
       Agora pega a linha com mais telas liberadas e segue, em vez de
       desistir. O banco tambem passou a impedir a duplicata.
       ------------------------------------------------------------------ */
    var ru=await cli.from('usuarios_sistema').select('*').ilike('login',lg).limit(5);
    var lst=(ru&&!ru.error&&ru.data)?ru.data:[];
    if(lst.length){
      lst.sort(function(a,b){
        var pa=Object.keys(a.permissoes||{}).length+((a.tudo||a.mestre)?999:0);
        var pb=Object.keys(b.permissoes||{}).length+((b.tudo||b.mestre)?999:0);
        return pb-pa;
      });
      linha=lst[0];
      if(lst.length>1)logNuvem('atenção: '+lst.length+' cadastros para o login '+lg+
        ' nesta empresa — usei o mais completo',true);
    }
  }catch(e){_quieto(e,'entrarPeloAuth')}
  return {ok:true,perfil:rp.data,linha:linha};
}
/* a linha da nuvem no formato do cadastro local */
function usuarioDaNuvem(x,lg,sn){
  return {id:x&&x.ref_local?x.ref_local
            :('usr_'+String(lg).replace(/[^a-z0-9]/gi,'').slice(0,12)),
    nome:(x&&x.nome)||lg,login:(x&&x.login)||lg,senha:sn,
    ativo:!x||x.ativo!==false,tudo:!!(x&&x.tudo),mestre:!!(x&&x.mestre),
    sucursais:(x&&x.sucursais)||[],permissoes:(x&&x.permissoes)||{}};
}
/* ==========================================================
   A SENHA DEIXA DE VIAJAR EM TEXTO PURO (P0 da auditoria final)

   O login offline comparava `x.senha === sn` — texto puro contra texto
   puro. Para isso funcionar, a senha de cada pessoa era gravada em
   `usuarios_sistema.senha`, subia para a nuvem e descia para TODOS os
   aparelhos da loja.

   Tres consequencias, todas serias:
   1. quem abrisse a tabela via API com a sessao de qualquer usuario da
      loja lia a senha de todo mundo em claro;
   2. sao as MESMAS senhas do Supabase Auth — vazar aqui e vazar o
      acesso ao sistema inteiro;
   3. cada aparelho novo recebia uma copia.

   A capacidade offline nao pode acabar: a loja nao para quando a
   internet cai. Entao ela continua — mas comparando HASH, nao texto.

   `crypto.subtle` e nativo do navegador (nao precisa de biblioteca) e
   exige HTTPS, que e o caso do joiagest.com.br. O login entra na
   receita como sal, para que a mesma senha em dois logins diferentes
   gere hashes diferentes.

   SHA-256 nao e bcrypt — nao tem custo ajustavel. Mas isto e o segundo
   fator de um acesso que ja passou pelo Supabase Auth, e a alternativa
   real aqui era TEXTO PURO. A troca vale.

   Transicao: aparelho com senha antiga em texto puro ainda entra uma
   vez, e nesse momento o texto e apagado e trocado pelo hash.
   ========================================================== */
async function hashSenhaLocal(senha, login){
  try{
    var dados = new TextEncoder().encode('joia:'+String(login||'').toLowerCase()+':'+String(senha||''));
    var buf = await crypto.subtle.digest('SHA-256', dados);
    return Array.from(new Uint8Array(buf))
      .map(function(b){return b.toString(16).padStart(2,'0')}).join('');
  }catch(e){ _quieto(e,'hashSenhaLocal'); return ''; }
}
/* confere o acesso guardado neste aparelho, sem internet */
async function conferirSenhaLocal(u, senhaDigitada){
  if(!u)return false;
  if(u.senhaLocal){
    var h = await hashSenhaLocal(senhaDigitada, u.login);
    return !!h && h === u.senhaLocal;
  }
  /* aparelho ainda nao migrado: aceita o texto puro UMA vez e ja converte */
  if(u.senha && u.senha === senhaDigitada){
    u.senhaLocal = await hashSenhaLocal(senhaDigitada, u.login);
    u.senha = '';
    try{ salvar(); }catch(e){ _quieto(e,'migrarSenhaLocal'); }
    return true;
  }
  return false;
}
async function entrar(){
  try{ if(!DB||!DB.usuarios)carregar(); }catch(e){_quieto(e,'entrar')}
  baseUsr();
  var lg=$('lgU').value.trim().toLowerCase();
  var sn=$('lgP').value;
  var u=null;
  if(lg&&sn){
    lgAviso('conferindo o acesso...');
    var res=await entrarPeloAuth(lg,sn);
    lgAviso('');
    if(res.ok){
      /* A limpeza do login zera o DB — entao a lista de usuarios precisa ser
         refeita ANTES de mexer nela. Sem isto o sistema quebrava aqui e a
         pessoa nao conseguia entrar de jeito nenhum. */
      baseUsr();
      var nu=usuarioDaNuvem(res.linha,lg,sn);
      /* o que fica guardado neste aparelho e o hash, nunca a senha */
      nu.senhaLocal=await hashSenhaLocal(sn,lg);
      nu.senha='';
      var ja=(DB.usuarios||[]).find(function(x){
        return String(x.login||'').toLowerCase()===String(nu.login||'').toLowerCase();});
      if(ja){Object.assign(ja,nu);u=ja;}
      else{DB.usuarios.push(nu);u=nu;}
      salvar();
    }else if(res.motivo==='senha'){
      lgAviso('Usuário ou senha inválidos.');sacode();return;
    }else if(res.motivo==='perfil'){
      lgAviso('Este acesso existe, mas não está ligado a nenhuma loja.<br>'+
        '<small style="opacity:.85">Fale com o administrador da sua rede.</small>');
      sacode();return;
    }else{
      /* internet caiu: a loja nao pode parar. Confere no cadastro deste
         aparelho e entra em modo local, com o aviso vermelho do rodape. */
      var cand=(DB.usuarios||[]).find(function(x){
        return String(x.login||'').toLowerCase()===lg;});
      u=(cand && await conferirSenhaLocal(cand,sn)) ? cand : null;
      if(!u){
        lgAviso('Não consegui falar com o servidor e este acesso não está '+
          'guardado neste aparelho.<br><small style="opacity:.85">Verifique a internet.</small>');
        sacode();return;
      }
    }
  }
  /* O campo "Cliente" foi retirado. Ele nao separava nada: quando o sistema
     nao conseguia resolver a rede do usuario — o que acontece SEMPRE logo apos
     o login, porque o aparelho acabou de ser zerado e a lista de redes esta
     vazia — a conferencia devolvia "ok" e liberava a entrada com qualquer
     texto digitado. Era possivel entrar com o usuario da Jolo escrevendo
     "rafaellos" no campo.
     Quem separa os clientes e o Supabase Auth (o e-mail ja diz de quem e o
     acesso) somado ao RLS, que so entrega as linhas da loja daquele perfil.
     Uma conferencia no navegador nunca foi barreira: qualquer pessoa a remove
     pelo proprio console. Tirar o campo nao afrouxa nada — so para de
     prometer uma protecao que nao existia. */
  if(u&&u.ativo===false){
    lgAviso('Este acesso está desativado. Fale com o administrador.');
    sacode();return;
  }
  if(u){
    SESSAO.usuarioId=u.id;
    SESSAO.login=String(u.login||'').toLowerCase();
    u.ultimoAcesso=new Date().toISOString();
    salvar();
    /* o login aparece SEMPRE (ordem do Rafael, 02/09/2026): nao se guarda
       mais sessao para entrar sozinho. A caixa "Lembrar meu e-mail" so
       decide se o e-mail volta preenchido no proximo acesso. */
    var lembrar=!$('lgK')||$('lgK').checked;
    try{
      if(lembrar)localStorage.setItem('nexor_ultimo_email',SESSAO.login);
      else localStorage.removeItem('nexor_ultimo_email');
      /* qualquer sessao antiga que ainda esteja guardada sai daqui */
      localStorage.removeItem('nexor_sessao');
      sessionStorage.removeItem('nexor_sessao');
    }catch(e){_quieto(e,'entrar')}
    abrirSessao();
    return;
  }
  var lst=(DB.usuarios||[]).filter(function(x){return x.ativo!==false})
    .map(function(x){return x.login}).filter(Boolean);
  lgAviso('Usuário ou senha inválidos.'+
    (lst.length?'<br><small style="opacity:.85">acessos deste aparelho: '+
      lst.map(function(x){return E(x)}).join(' · ')+'</small>':''));
  sacode();
}
/* a mensagem entra no estilo do arquivo oficial */
function lgAviso(html,tipo){
  var e=$('lgE');if(!e)return;
  e.innerHTML=html||'';
  e.className='message lgErr'+(html?(' '+(tipo||'error')):'');
}
/* a página não rola por baixo enquanto a entrada está aberta */
function travaRolagem(){
  try{
    var lg=document.getElementById('login');
    document.body.classList.toggle('semRolagem',!!lg&&!lg.classList.contains('hide'));
  }catch(e){_quieto(e,'travaRolagem')}
}
travaRolagem();
window.addEventListener('resize',travaRolagem);
function sacode(){
  var c=$('lgCard');
  if(c){c.classList.add('shake');setTimeout(function(){c.classList.remove('shake')},360);}
}
$('lgB').onclick=entrar;
if($('lgEsq'))$('lgEsq').onclick=function(){
  lgAviso('Para redefinir a senha, fale com o administrador da sua rede — '+
    'ele altera em <b>Configuração da Loja › Usuários e Permissões</b>.');
};
document.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&!$('login').classList.contains('hide'))entrar();
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&$('login').classList.contains('hide')){e.preventDefault();paleta();}
  if(e.key==='Escape'){var p=$('pal');if(p)p.remove();var m=$('mdOv');if(m)m.remove();fecharPops();fecharDrop();fecharSuc();}
});
async function sair(){
  if(!await pergunta('Sair de '+((usuarioLogado()||{}).login||'sua conta')+'?'))return;
  try{localStorage.removeItem('nexor_sessao');sessionStorage.removeItem('nexor_sessao');}catch(e){_quieto(e,'sair')}
  /* a copia da sessao da nuvem sai junto: sair tem de ser sair */
  try{ apagarSessaoGuardada(); }catch(e){_quieto(e,'sair')}
  /* a entrada e uma so, entao a saida tambem: deixar a sessao do Auth de pe
     manteria o token valido no aparelho depois de sair */
  try{ desconectarNuvem(); }catch(e){_quieto(e,'sair')}
  SESSAO.usuarioId=null;SESSAO.login=null;
  $('app').classList.add('hide');$('login').classList.remove('hide');travaRolagem();
  /* ==========================================================
     QUEM VOLTA NAO PRECISA LEMBRAR O E-MAIL

     A loja entra sempre com o mesmo endereco. Sair e ter de digitar
     `santafe@jologelato.com.br` no meio do expediente e atrito puro — e
     e justamente o que o aviso de sessao expirada pede que se faca.
     O e-mail volta preenchido e o cursor vai direto para a senha. Senha
     nunca e guardada.
     ========================================================== */
  try{
    var _u=$('lgU'), _p=$('lgP');
    var _ult=localStorage.getItem('nexor_ultimo_email')||'';
    if(_u&&_ult){ _u.value=_ult; if(_p)setTimeout(function(){_p.focus()},60); }
  }catch(e){_quieto(e,'sair')}
  /* Os avisos são da operação, não da entrada. Deixá-los pendurados fazia a
     tela de login abrir com tarja vermelha dizendo que nada seria salvo —
     assustando quem ainda nem entrou. */
  try{
    ['avisoNuvem','avisoTab','avisoSessao','avisoVer','avisoGrav'].forEach(function(id){
      var e=document.getElementById(id); if(e)e.remove();
    });
    var b=document.getElementById('barraAvisos');
    if(b)b.innerHTML='';
  }catch(e){_quieto(e,'sair')}
  lgAviso('');
}
/* ==========================================================
   O "MANTER CONECTADO" TEM DE ESPERAR O ARQUIVO TERMINAR

   Este trecho e CODIGO DE TOPO: roda enquanto o navegador ainda esta
   lendo o arquivo, na altura do bloco 5. Ele chama `abrirSessao()`, que
   chama `boot()`, que chama funcao de bloco la na frente — `baseCanc()`,
   por exemplo, no bloco 28.

   Funcao e icada pelo navegador e pode ser chamada antes; VARIAVEL de
   topo, nao. `var MOTIVOS_CANC=[...]` mora no bloco 28 e so recebe valor
   quando aquela linha roda. Chamado daqui, `baseCanc()` encontrava
   `undefined` e estourava:

       Cannot read properties of undefined (reading 'forEach')

   O erro caia no catch abaixo, que so anota. A tela ficava com o login
   escondido, o app visivel e TUDO VAZIO — sem cabecalho, sem menu, sem
   conteudo. Foi a tela branca da V213, na loja, com a versao ja no ar.

   Antes da V213 isso nunca acontecia por acidente: `SESSAO` tambem
   morava no bloco 28, entao a PRIMEIRA linha ja estourava e o resto nem
   chegava a rodar. Consertar `SESSAO` sem consertar isto destravou um
   caminho que nunca tinha rodado inteiro.

   A correcao nao e declarar variavel mais cedo — sao dezenas, e amanha
   aparece a proxima. E rodar o restauro DEPOIS do arquivo inteiro, com
   `setTimeout(...,0)`: ele espera o script terminar, e ai todo `var` de
   todo bloco ja tem valor.
   ========================================================== */
/* ==========================================================
   O LOGIN APARECE SEMPRE — ORDEM DO RAFAEL, 02/09/2026

   "Toda vez que vai entrar, quando fechou a pagina e clica de novo, ele ja
   entra direto, nao passa pelo login. Tem que seguir o processo: clicou,
   aparece o login, dai entra."

   Antes, com "Manter conectado", a sessao ficava guardada e o aparelho
   voltava DIRETO para dentro do sistema, pulando a tela de login. Agora
   nao pula mais: ao abrir, sempre para no login. O e-mail volta preenchido
   e o cursor vai para a senha — o processo e o mesmo de sempre, so nao se
   entra sozinho. Nada do que estava no aparelho e apagado; os dados
   continuam la para quando a pessoa entrar.
   ========================================================== */
function restaurarSessaoGuardada(){
try{
  /* a sessao guardada nao entra mais sozinha: ela so serve para trazer o
     e-mail de volta ao campo. O login e sempre mostrado. */
  try{ localStorage.removeItem('nexor_sessao'); }catch(e){_quieto(e,'restaurar')}
  try{ sessionStorage.removeItem('nexor_sessao'); }catch(e){_quieto(e,'restaurar')}
  var _ult='';
  try{ _ult=localStorage.getItem('nexor_ultimo_email')||''; }catch(e){}
  var _u=document.getElementById('lgU'), _p=document.getElementById('lgP');
  if(_u&&_ult&&!_u.value){ _u.value=_ult; if(_p)setTimeout(function(){try{_p.focus()}catch(e){}} ,80); }
  try{ var _c=document.getElementById('lgK'); if(_c)_c.checked=!!_ult; }catch(e){}
  /* a tela de login ja esta visivel por padrao (app com .hide); nada a fazer
     alem de garantir que continua assim */
  try{
    var _l=document.getElementById('login'); if(_l)_l.classList.remove('hide');
    var _a=document.getElementById('app');   if(_a)_a.classList.add('hide');
  }catch(e){}
}catch(e){
  /* nao pode mais ficar so anotado: se o restauro falha, a pessoa fica
     olhando uma tela vazia sem nenhuma explicacao. Volta para o login,
     que ao menos e uma tela em que da para trabalhar, e o motivo fica
     escrito no Diagnostico. */
  _quieto(e,'restaurarSessaoGuardada');
  try{
    logNuvem('a sessão guardada não pôde ser restaurada: '+
      String((e&&e.message)||e).slice(0,100)+' — entre novamente',true);
  }catch(e2){}
  try{
    SESSAO.usuarioId=null;SESSAO.login=null;
    var _l=document.getElementById('login'); if(_l)_l.classList.remove('hide');
    var _a=document.getElementById('app');   if(_a)_a.classList.add('hide');
  }catch(e3){}
}
}
/* roda DEPOIS de o arquivo inteiro carregar — ver o bloco acima */
setTimeout(restaurarSessaoGuardada,0);

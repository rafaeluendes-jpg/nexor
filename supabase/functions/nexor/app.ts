export const APP_JS = `
var S = { unidade:'Matriz', modulo:'home', item:null, open:false };
var $ = function(id){ return document.getElementById(id); };

function mod(id){ for(var i=0;i<MODULOS.length;i++){ if(MODULOS[i].id===id) return MODULOS[i]; } return null; }
function item(m, id){ if(!m) return null; for(var i=0;i<m.itens.length;i++){ if(m.itens[i].id===id) return m.itens[i]; } return null; }
function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function initLogin(){
  var f = $('lgForm');
  $('togglePwd').innerHTML = svg('eye', 18);
  $('togglePwd').onclick = function(){
    var i = $('lgPwd');
    var vis = i.type === 'text';
    i.type = vis ? 'password' : 'text';
    this.innerHTML = svg(vis ? 'eye' : 'eyeOff', 18);
  };
  f.onsubmit = function(e){
    e.preventDefault();
    var u = $('lgUser').value.trim();
    var p = $('lgPwd').value;
    var err = $('lgErr');
    if(u.toLowerCase() === 'rafa' && p === '123'){
      err.textContent = '';
      $('login').classList.add('hide');
      $('app').classList.remove('hide');
      boot();
    } else {
      err.textContent = 'Login ou senha invalidos.';
      var c = $('lgCard');
      c.classList.add('shake');
      setTimeout(function(){ c.classList.remove('shake'); }, 400);
    }
  };
}

function boot(){ buildSidebar(); buildTop(); go('home', null); }

function buildSidebar(){
  var h = '';
  h += '<div class="side-top"><div class="side-mark">N</div><div class="side-name">NEXOR<small>Gestao simples, lucro visivel</small></div></div>';
  h += '<div class="nav" id="nav">';
  for(var i=0;i<MODULOS.length;i++){
    var m = MODULOS[i];
    var temSub = m.itens.length > 0;
    h += '<button class="nav-item" data-mod="' + m.id + '">';
    h += '<span class="nav-ico">' + svg(m.ico, 19) + '</span>';
    h += '<span class="nav-txt">' + esc(m.nome) + '</span>';
    if(temSub) h += '<span class="nav-caret">' + svg('caret', 14) + '</span>';
    h += '</button>';
    if(temSub){
      h += '<div class="sub" id="sub-' + m.id + '">';
      var grupoAtual = '';
      for(var j=0;j<m.itens.length;j++){
        var it = m.itens[j];
        if(it.grupo && it.grupo !== grupoAtual){
          grupoAtual = it.grupo;
          h += '<div class="sub-group">' + esc(it.grupo) + '</div>';
        }
        h += '<button class="sub-item" data-mod="' + m.id + '" data-item="' + it.id + '">' + esc(it.nome) + '</button>';
      }
      h += '</div>';
    }
  }
  h += '<button class="nav-item" id="btnSair" style="margin-top:10px"><span class="nav-ico">' + svg('out',19) + '</span><span class="nav-txt">Sair</span></button>';
  h += '</div>';
  h += '<div class="side-foot"><div class="ava">R</div><div class="side-foot-meta"><b style="display:block;font-size:12.8px;color:#fff">Rafa</b><span style="font-size:11px;color:#7B88A3">Administrador Geral</span></div></div>';
  var side = $('side');
  side.innerHTML = h;
  var navItems = side.querySelectorAll('.nav-item[data-mod]');
  for(var k=0;k<navItems.length;k++){
    navItems[k].onclick = function(){
      var id = this.getAttribute('data-mod');
      var m2 = mod(id);
      if(m2 && m2.itens.length > 0){
        var sub = $('sub-' + id);
        var aberto = sub.classList.contains('open');
        if(aberto){ sub.classList.remove('open'); this.classList.remove('open'); }
        else { sub.classList.add('open'); this.classList.add('open'); go(id, null); }
      } else { go(id, null); }
    };
  }
  var subs = side.querySelectorAll('.sub-item');
  for(var s=0;s<subs.length;s++){
    subs[s].onclick = function(){ go(this.getAttribute('data-mod'), this.getAttribute('data-item')); };
  }
  $('btnSair').onclick = sair;
}

function buildTop(){
  var h = '';
  h += '<button class="btn-icon burger" id="burger">' + svg('menu',20) + '</button>';
  h += '<div class="search"><span class="s-ico">' + svg('search',16) + '</span>';
  h += '<input id="busca" placeholder="Buscar modulo, relatorio, cadastro..." autocomplete="off"><div id="buscaRes"></div></div>';
  h += '<div class="top-sp"></div>';
  h += '<div class="unit" id="unitBtn"><div><span class="u-lab">Unidade atual</span><span class="u-val" id="unitVal">Matriz</span></div>' + svg('caret',14) + '<div id="unitMenu"></div></div>';
  h += '<button class="btn-icon" id="btnBell">' + svg('bell',19) + '<span class="dot"></span></button>';
  h += '<button class="btn-icon" id="btnHelp">' + svg('help',19) + '</button>';
  h += '<div class="who"><div class="ava">R</div><div class="who-meta"><b>Rafa</b><span>Administrador Geral</span></div>';
  h += '<button class="btn-icon" id="btnOut">' + svg('power',18) + '</button></div>';
  var top = $('top');
  top.innerHTML = h;
  $('burger').onclick = function(){ S.open = !S.open; $('app').classList.toggle('open', S.open); };
  $('scrim').onclick = function(){ S.open = false; $('app').classList.remove('open'); };
  $('btnOut').onclick = sair;
  $('btnBell').onclick = function(){ toast('Nenhuma notificacao nova.'); };
  $('btnHelp').onclick = function(){ toast('Central de ajuda: modulo em desenvolvimento.'); };
  $('unitBtn').onclick = function(e){
    e.stopPropagation();
    var mn = $('unitMenu');
    if(mn.className === 'u-menu'){ mn.className = ''; mn.innerHTML = ''; return; }
    var uh = '';
    for(var i=0;i<UNIDADES.length;i++){
      var u = UNIDADES[i];
      var on = u.nome === S.unidade ? ' class="on"' : '';
      uh += '<button' + on + ' data-u="' + esc(u.nome) + '"><span>' + esc(u.nome) + '<small>' + esc(u.cidade) + ' - ' + u.uf + ' | ' + u.tipo + '</small></span>' + (u.nome === S.unidade ? svg('check',15) : '') + '</button>';
    }
    mn.className = 'u-menu';
    mn.innerHTML = uh;
    var bs = mn.querySelectorAll('button');
    for(var b=0;b<bs.length;b++){
      bs[b].onclick = function(ev){
        ev.stopPropagation();
        S.unidade = this.getAttribute('data-u');
        $('unitVal').textContent = S.unidade;
        mn.className = ''; mn.innerHTML = '';
        toast('Unidade alterada para ' + S.unidade);
        go(S.modulo, S.item);
      };
    }
  };
  document.addEventListener('click', function(){
    var mn = $('unitMenu'); if(mn){ mn.className=''; mn.innerHTML=''; }
    var br = $('buscaRes'); if(br){ br.className=''; br.innerHTML=''; }
  });
  var bi = $('busca');
  bi.onclick = function(e){ e.stopPropagation(); };
  bi.oninput = function(){
    var q = this.value.trim().toLowerCase();
    var res = $('buscaRes');
    if(q.length < 2){ res.className=''; res.innerHTML=''; return; }
    var out = [];
    for(var i=0;i<MODULOS.length;i++){
      var m = MODULOS[i];
      if(m.nome.toLowerCase().indexOf(q) >= 0) out.push({m:m.id, i:null, t:m.nome, s:'Modulo'});
      for(var j=0;j<m.itens.length;j++){
        var it = m.itens[j];
        if(it.nome.toLowerCase().indexOf(q) >= 0) out.push({m:m.id, i:it.id, t:it.nome, s:m.nome});
      }
    }
    if(out.length === 0){ res.className='s-res'; res.innerHTML='<div class="s-empty">Nada encontrado</div>'; return; }
    var rh = '';
    for(var o=0;o<out.length && o<12;o++){
      rh += '<button data-m="' + out[o].m + '" data-i="' + (out[o].i || '') + '">' + esc(out[o].t) + '<small>' + esc(out[o].s) + '</small></button>';
    }
    res.className = 's-res';
    res.innerHTML = rh;
    var rb = res.querySelectorAll('button');
    for(var r=0;r<rb.length;r++){
      rb[r].onclick = function(ev){
        ev.stopPropagation();
        go(this.getAttribute('data-m'), this.getAttribute('data-i') || null);
        bi.value=''; res.className=''; res.innerHTML='';
      };
    }
  };
}

function sair(){
  if(!confirm('Deseja sair do sistema?')) return;
  $('app').classList.add('hide');
  $('login').classList.remove('hide');
  $('lgUser').value=''; $('lgPwd').value=''; $('lgErr').textContent='';
}

function go(moduloId, itemId){
  S.modulo = moduloId; S.item = itemId;
  S.open = false; $('app').classList.remove('open');
  var navs = document.querySelectorAll('.nav-item[data-mod]');
  for(var i=0;i<navs.length;i++) navs[i].classList.toggle('on', navs[i].getAttribute('data-mod') === moduloId && !itemId);
  var subs = document.querySelectorAll('.sub-item');
  for(var j=0;j<subs.length;j++) subs[j].classList.toggle('on', subs[j].getAttribute('data-item') === itemId);
  var m = mod(moduloId);
  if(m && m.itens.length){
    var sub = $('sub-' + moduloId);
    if(sub && !sub.classList.contains('open')){
      sub.classList.add('open');
      var btn = document.querySelector('.nav-item[data-mod="' + moduloId + '"]');
      if(btn) btn.classList.add('open');
    }
  }
  var c = $('content');
  window.scrollTo(0,0);
  if(moduloId === 'home'){ telaHome(c); return; }
  if(!itemId){ telaModulo(c, m); return; }
  if(itemId === 'unidades'){ telaUnidades(c); return; }
  if(itemId === 'nova-unidade'){ telaUnidades(c); setTimeout(function(){ modalUnidade(); }, 60); return; }
  if(itemId === 'perfis'){ telaPerfis(c); return; }
  if(itemId === 'lista-usuarios'){ telaUsuarios(c); return; }
  telaDev(c, m, item(m, itemId));
}

function crumb(parts){
  var h = '<div class="crumb"><button onclick="go(\\'home\\',null)">Inicio</button>';
  for(var i=0;i<parts.length;i++){
    h += '<span>/</span>';
    if(parts[i].go) h += '<button onclick="' + parts[i].go + '">' + esc(parts[i].t) + '</button>';
    else h += '<b>' + esc(parts[i].t) + '</b>';
  }
  return h + '</div>';
}

function head(ico, titulo, desc, acoes){
  var h = '<div class="head"><div class="head-ico">' + svg(ico, 23) + '</div>';
  h += '<div><h1>' + esc(titulo) + '</h1><p>' + esc(desc) + '</p></div>';
  if(acoes) h += '<div class="head-act">' + acoes + '</div>';
  return h + '</div>';
}

function pill(status){
  var map = { ativa:['p-on','Ativa'], inativa:['p-off','Inativa'], pendente:['p-wait','Pendente'], bloqueada:['p-block','Bloqueada'], dev:['p-dev','Em desenvolvimento'] };
  var v = map[status] || ['p-off', status];
  return '<span class="pill ' + v[0] + '">' + v[1] + '</span>';
}

function toast(msg){
  var old = $('toast'); if(old) old.remove();
  var d = document.createElement('div');
  d.className = 'toast'; d.id = 'toast';
  d.innerHTML = svg('check',17) + '<span>' + esc(msg) + '</span>';
  document.body.appendChild(d);
  setTimeout(function(){ if(d.parentNode) d.remove(); }, 2600);
}

function modal(titulo, sub, corpo, botao, onOk, largura){
  var ov = document.createElement('div');
  ov.className = 'ov'; ov.id = 'ov';
  var h = '<div class="mo' + (largura === 'sm' ? ' sm' : '') + '">';
  h += '<div class="mo-h"><div><h3>' + esc(titulo) + '</h3>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div><button class="x" id="moX">&times;</button></div>';
  h += '<div class="mo-b">' + corpo + '</div>';
  h += '<div class="mo-f"><button class="btn btn-ghost" id="moC">Cancelar</button><button class="btn btn-primary" id="moK">' + esc(botao) + '</button></div></div>';
  ov.innerHTML = h;
  document.body.appendChild(ov);
  var fecha = function(){ ov.remove(); };
  $('moX').onclick = fecha;
  $('moC').onclick = fecha;
  $('moK').onclick = function(){ if(onOk) onOk(); fecha(); };
  ov.onclick = function(e){ if(e.target === ov) fecha(); };
}

function telaHome(c){
  var h = crumb([{t:'Dashboard'}]);
  h += head('grid', 'Bem-vindo ao Nexor', 'Unidade atual: ' + S.unidade + ' - selecione um modulo para comecar.');
  h += '<div class="kpis">';
  h += '<div class="kpi"><div class="k-l">Unidades na rede</div><div class="k-v">' + UNIDADES.length + '</div><div class="k-s">Estrutura preparada para 60+</div></div>';
  h += '<div class="kpi"><div class="k-l">Unidades ativas</div><div class="k-v">' + UNIDADES.filter(function(u){return u.status==="ativa";}).length + '</div><div class="k-s">Operando normalmente</div></div>';
  h += '<div class="kpi"><div class="k-l">Modulos do sistema</div><div class="k-v">' + (MODULOS.length - 1) + '</div><div class="k-s">Com todos os itens mapeados</div></div>';
  h += '<div class="kpi"><div class="k-l">Perfis de acesso</div><div class="k-v">' + PERFIS.length + '</div><div class="k-s">Permissoes por unidade</div></div>';
  h += '</div>';
  h += '<div class="card"><div class="card-h"><div><h3>Modulos do sistema</h3><p>Clique em um modulo para ver seus itens</p></div></div><div class="card-b">';
  h += '<div class="grid">';
  for(var i=1;i<MODULOS.length;i++){
    var m = MODULOS[i];
    h += '<button class="mod" onclick="go(\\'' + m.id + '\\',null)">';
    h += '<div class="mod-ico">' + svg(m.ico, 22) + '</div>';
    h += '<h3>' + esc(m.nome) + '</h3><p>' + esc(m.desc) + '</p>';
    h += '<div class="mod-tag">' + m.itens.length + ' itens</div>';
    h += '<div class="mod-go">Acessar ' + svg('caret',13) + '</div>';
    h += '</button>';
  }
  h += '</div></div></div>';
  c.innerHTML = h;
}

function telaModulo(c, m){
  if(!m){ c.innerHTML = '<div class="empty"><h3>Modulo nao encontrado</h3></div>'; return; }
  var h = crumb([{t:m.nome}]);
  h += head(m.ico, m.nome, m.desc, '<button class="btn btn-ghost" onclick="go(\\'home\\',null)">' + svg('back',16) + ' Voltar</button>');
  var grupos = {}; var ordem = [];
  for(var i=0;i<m.itens.length;i++){
    var g = m.itens[i].grupo || '';
    if(!grupos[g]){ grupos[g] = []; ordem.push(g); }
    grupos[g].push(m.itens[i]);
  }
  for(var o=0;o<ordem.length;o++){
    var g2 = ordem[o];
    h += '<div class="card"><div class="card-h"><div><h3>' + esc(g2 || 'Itens do modulo') + '</h3><p>' + grupos[g2].length + ' itens disponiveis</p></div></div><div class="card-b"><div class="grid">';
    for(var j=0;j<grupos[g2].length;j++){
      var it = grupos[g2][j];
      var pronto = TELAS_PRONTAS.indexOf(it.id) >= 0;
      h += '<button class="mod" onclick="go(\\'' + m.id + '\\',\\'' + it.id + '\\')">';
      h += '<div class="mod-ico">' + svg(m.ico, 20) + '</div>';
      h += '<h3>' + esc(it.nome) + '</h3>';
      h += '<p>' + (pronto ? 'Interface disponivel nesta versao.' : 'Item mapeado - interface a ser desenvolvida na proxima etapa.') + '</p>';
      h += '<div class="mod-tag">' + (pronto ? 'Pronto' : 'Etapa 2') + '</div>';
      h += '<div class="mod-go">Abrir ' + svg('caret',13) + '</div></button>';
    }
    h += '</div></div></div>';
  }
  c.innerHTML = h;
}

function telaDev(c, m, it){
  if(!m || !it){ c.innerHTML = '<div class="empty"><h3>Item nao encontrado</h3></div>'; return; }
  var h = crumb([{t:m.nome, go:"go('" + m.id + "',null)"}, {t:it.nome}]);
  h += head(m.ico, it.nome, m.nome + ' - unidade ' + S.unidade, '<button class="btn btn-ghost" onclick="go(\\'' + m.id + '\\',null)">' + svg('back',16) + ' Voltar</button>');
  h += '<div class="card"><div class="card-h"><div><h3>' + esc(it.nome) + '</h3><p>Status do item</p></div>' + pill('dev') + '</div>';
  h += '<div class="card-b"><div class="empty"><div class="empty-ico">' + svg('tools',30) + '</div>';
  h += '<h3>Modulo em desenvolvimento</h3>';
  h += '<p>A estrutura, o menu e a navegacao deste item ja estao prontos. As funcionalidades serao construidas na proxima etapa, uma de cada vez.</p>';
  h += '<button class="btn btn-ghost" onclick="go(\\'' + m.id + '\\',null)">' + svg('back',16) + ' Voltar para ' + esc(m.nome) + '</button>';
  h += '</div></div></div>';
  h += '<div class="card"><div class="card-h"><div><h3>Espaco reservado</h3><p>Area onde os dados e graficos deste item serao exibidos</p></div></div>';
  h += '<div class="card-b"><div class="chart-ph">' + svg('chart',26) + '<span>Conteudo sera carregado aqui</span></div></div></div>';
  c.innerHTML = h;
}

var filtroU = { q:'', cidade:'', uf:'', status:'' };

function telaUnidades(c){
  var h = crumb([{t:'Gestao de Franquias e Sucursais', go:"go('franquias',null)"}, {t:'Unidades da Rede'}]);
  h += head('net', 'Unidades da Rede', 'Franquias, sucursais e matriz cadastradas no sistema', '<button class="btn btn-ghost" onclick="go(\\'franquias\\',null)">' + svg('back',16) + ' Voltar</button><button class="btn btn-primary" onclick="modalUnidade()">' + svg('plus',16) + ' Nova unidade</button>');
  h += '<div class="kpis">';
  h += '<div class="kpi"><div class="k-l">Total</div><div class="k-v">' + UNIDADES.length + '</div><div class="k-s">unidades cadastradas</div></div>';
  h += '<div class="kpi"><div class="k-l">Ativas</div><div class="k-v" style="color:#16A34A">' + UNIDADES.filter(function(u){return u.status==="ativa";}).length + '</div><div class="k-s">em operacao</div></div>';
  h += '<div class="kpi"><div class="k-l">Pendentes</div><div class="k-v" style="color:#D97706">' + UNIDADES.filter(function(u){return u.status==="pendente";}).length + '</div><div class="k-s">aguardando abertura</div></div>';
  h += '<div class="kpi"><div class="k-l">Inativas</div><div class="k-v" style="color:#8A94A8">' + UNIDADES.filter(function(u){return u.status==="inativa";}).length + '</div><div class="k-s">fora de operacao</div></div>';
  h += '</div>';
  var cidades = [], ufs = [];
  for(var i=0;i<UNIDADES.length;i++){
    if(cidades.indexOf(UNIDADES[i].cidade) < 0) cidades.push(UNIDADES[i].cidade);
    if(ufs.indexOf(UNIDADES[i].uf) < 0) ufs.push(UNIDADES[i].uf);
  }
  h += '<div class="card"><div class="filters">';
  h += '<input id="fq" placeholder="Pesquisar por nome, codigo ou responsavel..." value="' + esc(filtroU.q) + '">';
  h += '<select id="fcidade"><option value="">Todas as cidades</option>';
  for(var a=0;a<cidades.length;a++) h += '<option' + (filtroU.cidade===cidades[a]?' selected':'') + '>' + esc(cidades[a]) + '</option>';
  h += '</select>';
  h += '<select id="fuf"><option value="">Todos os estados</option>';
  for(var b=0;b<ufs.length;b++) h += '<option' + (filtroU.uf===ufs[b]?' selected':'') + '>' + esc(ufs[b]) + '</option>';
  h += '</select>';
  h += '<select id="fstatus"><option value="">Todos os status</option>';
  var sts = ['ativa','inativa','pendente'];
  for(var d=0;d<sts.length;d++) h += '<option value="' + sts[d] + '"' + (filtroU.status===sts[d]?' selected':'') + '>' + sts[d].charAt(0).toUpperCase() + sts[d].slice(1) + '</option>';
  h += '</select></div>';
  var lista = UNIDADES.filter(function(u){
    if(filtroU.cidade && u.cidade !== filtroU.cidade) return false;
    if(filtroU.uf && u.uf !== filtroU.uf) return false;
    if(filtroU.status && u.status !== filtroU.status) return false;
    if(filtroU.q){
      var q = filtroU.q.toLowerCase();
      if((u.nome + ' ' + u.cod + ' ' + u.resp).toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  });
  h += '<div class="card-b flush"><div class="tw"><table><thead><tr>';
  h += '<th>Codigo</th><th>Unidade</th><th>Tipo</th><th>Cidade</th><th>UF</th><th>Responsavel</th><th>Status</th><th>Ultimo acesso</th><th style="text-align:right">Acoes</th>';
  h += '</tr></thead><tbody>';
  if(lista.length === 0){
    h += '<tr><td colspan="9"><div class="empty"><div class="empty-ico">' + svg('search',28) + '</div><h3>Nenhuma unidade encontrada</h3><p>Ajuste os filtros para ver outros resultados.</p></div></td></tr>';
  } else {
    for(var e=0;e<lista.length;e++){
      var u = lista[e];
      h += '<tr><td><b>' + u.cod + '</b></td><td><b>' + esc(u.nome) + '</b></td><td>' + u.tipo + '</td><td>' + esc(u.cidade) + '</td><td>' + u.uf + '</td><td>' + esc(u.resp) + '</td><td>' + pill(u.status) + '</td><td>' + esc(u.acesso) + '</td>';
      h += '<td><div class="acts">';
      h += '<button class="act" title="Visualizar" onclick="verUnidade(\\'' + u.cod + '\\')">' + svg('eye',15) + '</button>';
      h += '<button class="act" title="Editar" onclick="modalUnidade(\\'' + u.cod + '\\')">' + svg('edit',15) + '</button>';
      h += '<button class="act" title="Desativar" onclick="alertaDev()">' + svg('power',15) + '</button>';
      h += '<button class="act danger" title="Excluir" onclick="excluirUnidade(\\'' + u.cod + '\\')">' + svg('trash',15) + '</button>';
      h += '</div></td></tr>';
    }
  }
  h += '</tbody></table></div>';
  h += '<div class="pag"><span>Exibindo ' + lista.length + ' de ' + UNIDADES.length + ' unidades</span><div class="pag-n"><button class="btn btn-ghost btn-sm">Anterior</button><button class="btn btn-ghost btn-sm">Proxima</button></div></div>';
  h += '</div></div>';
  c.innerHTML = h;
  $('fq').oninput = function(){ filtroU.q = this.value; var p = this.selectionStart; telaUnidades(c); var n = $('fq'); n.focus(); n.setSelectionRange(p,p); };
  $('fcidade').onchange = function(){ filtroU.cidade = this.value; telaUnidades(c); };
  $('fuf').onchange = function(){ filtroU.uf = this.value; telaUnidades(c); };
  $('fstatus').onchange = function(){ filtroU.status = this.value; telaUnidades(c); };
}

function verUnidade(cod){
  var u = null;
  for(var i=0;i<UNIDADES.length;i++) if(UNIDADES[i].cod === cod) u = UNIDADES[i];
  if(!u) return;
  var b = '<div class="fg">';
  b += '<div class="fi"><label>Codigo</label><input value="' + u.cod + '" disabled></div>';
  b += '<div class="fi"><label>Tipo</label><input value="' + u.tipo + '" disabled></div>';
  b += '<div class="fi full"><label>Nome da unidade</label><input value="' + esc(u.nome) + '" disabled></div>';
  b += '<div class="fi"><label>Cidade</label><input value="' + esc(u.cidade) + '" disabled></div>';
  b += '<div class="fi"><label>Estado</label><input value="' + u.uf + '" disabled></div>';
  b += '<div class="fi"><label>Responsavel</label><input value="' + esc(u.resp) + '" disabled></div>';
  b += '<div class="fi"><label>Ultimo acesso</label><input value="' + esc(u.acesso) + '" disabled></div>';
  b += '</div>';
  modal('Unidade ' + u.nome, 'Visualizacao dos dados da unidade', b, 'Fechar', null);
}

function excluirUnidade(cod){
  var b = '<p style="font-size:13.5px;color:#5B6880;line-height:1.6">Esta acao removera a unidade <b>' + cod + '</b> da rede. Nesta versao de prototipo nenhum dado e realmente excluido.</p>';
  modal('Excluir unidade', 'Confirmacao necessaria', b, 'Confirmar exclusao', function(){ toast('Acao registrada (prototipo).'); }, 'sm');
}

function alertaDev(){ toast('Funcionalidade sera liberada na proxima etapa.'); }

function modalUnidade(cod){
  var u = null;
  if(cod) for(var i=0;i<UNIDADES.length;i++) if(UNIDADES[i].cod === cod) u = UNIDADES[i];
  var v = function(x){ return u ? esc(u[x] || '') : ''; };
  var b = '<div class="sec-t">Identificacao</div><div class="fg">';
  b += '<div class="fi"><label>Codigo da unidade</label><input placeholder="007" value="' + v('cod') + '"></div>';
  b += '<div class="fi"><label>Tipo da unidade</label><select><option>Franquia</option><option>Sucursal</option><option>Matriz</option></select></div>';
  b += '<div class="fi full"><label>Nome da unidade</label><input placeholder="Unidade Centro" value="' + v('nome') + '"></div>';
  b += '<div class="fi"><label>Nome empresarial</label><input placeholder="Razao social LTDA"></div>';
  b += '<div class="fi"><label>Nome fantasia</label><input placeholder="Nome comercial"></div>';
  b += '<div class="fi"><label>CNPJ</label><input placeholder="00.000.000/0000-00"></div>';
  b += '<div class="fi"><label>Data de abertura</label><input type="date"></div>';
  b += '</div>';
  b += '<div class="sec-t">Localizacao</div><div class="fg">';
  b += '<div class="fi full"><label>Endereco</label><input placeholder="Rua, numero, bairro"></div>';
  b += '<div class="fi"><label>Cidade</label><input placeholder="Cidade" value="' + v('cidade') + '"></div>';
  b += '<div class="fi"><label>Estado</label><input placeholder="UF" maxlength="2" value="' + v('uf') + '"></div>';
  b += '</div>';
  b += '<div class="sec-t">Contato e responsavel</div><div class="fg">';
  b += '<div class="fi"><label>Responsavel pela unidade</label><input placeholder="Nome do responsavel" value="' + v('resp') + '"></div>';
  b += '<div class="fi"><label>Telefone</label><input placeholder="(00) 00000-0000"></div>';
  b += '<div class="fi full"><label>E-mail</label><input type="email" placeholder="unidade@empresa.com"></div>';
  b += '</div>';
  b += '<div class="sec-t">Situacao</div><div class="fg">';
  b += '<div class="fi"><label>Status da unidade</label><select><option value="ativa">Ativa</option><option value="pendente">Pendente</option><option value="inativa">Inativa</option></select></div>';
  b += '<div class="fi"><label>Matriz ou sucursal</label><select><option>Sucursal</option><option>Matriz</option></select></div>';
  b += '</div>';
  modal(u ? 'Editar unidade' : 'Cadastrar nova unidade', u ? 'Alterando dados de ' + u.nome : 'Preencha os dados da nova franquia ou sucursal', b, u ? 'Salvar alteracoes' : 'Cadastrar unidade', function(){ toast('Cadastro sera gravado no banco na proxima etapa.'); });
}

function telaPerfis(c){
  var h = crumb([{t:'Usuarios e Permissoes', go:"go('usuarios',null)"}, {t:'Perfis de Acesso'}]);
  h += head('shield', 'Perfis de Acesso', 'Defina o que cada perfil pode fazer dentro do sistema', '<button class="btn btn-ghost" onclick="go(\\'usuarios\\',null)">' + svg('back',16) + ' Voltar</button><button class="btn btn-primary" onclick="alertaDev()">' + svg('plus',16) + ' Novo perfil</button>');
  for(var i=0;i<PERFIS.length;i++){
    var p = PERFIS[i];
    h += '<div class="card"><div class="card-h"><div><h3>' + esc(p.nome) + '</h3><p>' + esc(p.desc) + '</p></div>';
    h += '<span class="pill p-dev">' + esc(p.escopo) + '</span></div>';
    h += '<div class="card-b" style="padding:0">';
    h += '<div class="perm-row"><div class="perm-i"><b>Permissoes gerais</b><span>Controle do que este perfil pode executar</span></div>';
    h += '<div class="perm-t">';
    var perms = ['Visualizar','Criar','Editar','Excluir','Relatorios'];
    for(var j=0;j<perms.length;j++){
      var mark = (j < 2 || i < 3) ? ' checked' : '';
      h += '<label class="tg"><input type="checkbox"' + mark + ' onchange="alertaDev()"><span class="sw"></span>' + perms[j] + '</label>';
    }
    h += '</div></div>';
    h += '<div class="perm-row"><div class="perm-i"><b>Abrangencia de unidades</b><span>' + esc(p.escopo) + '</span></div>';
    h += '<div class="perm-t"><label class="tg"><input type="checkbox"' + (i < 3 ? ' checked' : '') + ' onchange="alertaDev()"><span class="sw"></span>Acessar varias unidades</label>';
    h += '<label class="tg"><input type="checkbox"' + (i >= 3 ? ' checked' : '') + ' onchange="alertaDev()"><span class="sw"></span>Limitar a uma unidade</label></div></div>';
    h += '</div></div>';
  }
  c.innerHTML = h;
}

function telaUsuarios(c){
  var h = crumb([{t:'Usuarios e Permissoes', go:"go('usuarios',null)"}, {t:'Usuarios Cadastrados'}]);
  h += head('users', 'Usuarios Cadastrados', 'Pessoas com acesso ao sistema e suas unidades', '<button class="btn btn-ghost" onclick="go(\\'usuarios\\',null)">' + svg('back',16) + ' Voltar</button><button class="btn btn-primary" onclick="alertaDev()">' + svg('plus',16) + ' Novo usuario</button>');
  h += '<div class="card"><div class="card-b flush"><div class="tw"><table><thead><tr>';
  h += '<th>Usuario</th><th>E-mail</th><th>Perfil</th><th>Unidade</th><th>Status</th><th style="text-align:right">Acoes</th></tr></thead><tbody>';
  for(var i=0;i<USUARIOS_DEMO.length;i++){
    var u = USUARIOS_DEMO[i];
    h += '<tr><td><b>' + esc(u.nome) + '</b></td><td>' + esc(u.email) + '</td><td>' + esc(u.perfil) + '</td><td>' + esc(u.unidade) + '</td><td>' + pill(u.status) + '</td>';
    h += '<td><div class="acts"><button class="act" onclick="alertaDev()">' + svg('edit',15) + '</button><button class="act" onclick="alertaDev()">' + svg('power',15) + '</button><button class="act danger" onclick="alertaDev()">' + svg('trash',15) + '</button></div></td></tr>';
  }
  h += '</tbody></table></div>';
  h += '<div class="pag"><span>' + USUARIOS_DEMO.length + ' usuarios cadastrados</span></div></div></div>';
  c.innerHTML = h;
}

document.addEventListener('DOMContentLoaded', initLogin);
`;

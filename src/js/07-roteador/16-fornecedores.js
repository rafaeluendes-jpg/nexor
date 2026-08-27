/* ==========================================================
   BLOCO 16 — FORNECEDORES
   ========================================================== */
function baseForn(){DB.fornec=DB.fornec||[];}
var FB={busca:''};
function fornecedor(id){return (DB.fornec||[]).find(function(x){return x.id===id})||null}
function filtraFornec(){
  var q=(FB.busca||'').trim().toLowerCase();
  return (DB.fornec||[]).filter(function(f){
    if(q.length<3)return true;          /* a partir da terceira letra e que filtra */
    var d=soDigitos(q);
    return (f.empresa||'').toLowerCase().indexOf(q)>=0||
           (f.nome||'').toLowerCase().indexOf(q)>=0||
           (f.email||'').toLowerCase().indexOf(q)>=0||
           (f.cnpj||'').toLowerCase().indexOf(q)>=0||
           (d&&soDigitos(f.whats||'').indexOf(d)>=0)||
           (d&&soDigitos(f.tel||'').indexOf(d)>=0);
  }).sort(function(a,b){return (a.empresa||'').localeCompare(b.empresa||'')});
}
/* repinta so a tabela: o campo de busca nunca e recriado, entao nao perde letra */
function pintaFornec(){
  var l=filtraFornec();
  var alvo=document.querySelector('.pnl2B');
  if(alvo)alvo.innerHTML=tabelaFornec(l);
  var c=document.querySelector('.pnl2H .cnt2');
  if(c)c.textContent=l.length;
  rodape(l.length+' fornecedores');
}
function tabelaFornec(lista){
  return lista.length?'<table class="pTable finTab"><thead><tr>'+
   '<th>Empresa</th><th style="width:200px">Contato</th><th style="width:160px">Telefone</th>'+
   '<th style="width:160px">WhatsApp</th><th style="width:170px">CNPJ</th><th style="width:150px"></th></tr></thead><tbody>'+
   lista.map(function(f){
     return '<tr><td><b>'+E(f.empresa||'—')+'</b>'+
      (f.email?'<div style="font-size:11px;color:var(--ink-3)">'+E(f.email)+'</div>':'')+'</td>'+
     '<td>'+E(f.nome||'—')+'</td><td>'+E(f.tel||'—')+'</td>'+
     '<td>'+(f.whats?'<a class="waLink" href="https://wa.me/55'+soDigitos(f.whats)+'" target="_blank">'+
       sv('phone',12)+' '+E(f.whats)+'</a>':'—')+'</td>'+
     '<td>'+E(f.cnpj||'—')+'</td>'+
     '<td><div class="rowAct">'+
      '<button class="btnP2" onclick="modalForn(\''+f.id+'\')">'+sv('edit',13)+' Editar</button>'+
      '<button class="rBtn rd" onclick="excluirForn(\''+f.id+'\')">'+sv('trash',13)+'</button>'+
     '</div></td></tr>';
   }).join('')+'</tbody></table>'
  :'<div class="entVazio"><b>Nenhum fornecedor encontrado</b>'+
   '<span>Ajuste a busca ou cadastre um novo fornecedor.</span></div>';
}
function telaFornecedores(){
  baseForn();
  var q=(FB.busca||'').toLowerCase();
  var lista=filtraFornec();
  $('content').innerHTML='<div class="finWrap telaCheia">'+
  '<div class="finTop"><div><h1>Fornecedores</h1>'+
  '<p>Cadastro usado nos lançamentos financeiros e nas notas de entrada.</p></div>'+
  '<div class="buscaTopo">'+
   '<input id="fbB" value="'+E(FB.busca)+'" placeholder="buscar por empresa, contato, CNPJ ou WhatsApp" '+
   'oninput="FB.busca=this.value;pintaFornec()"></div>'+
  '<div class="finActs"><button class="btnP2 ok" onclick="modalForn()">'+sv('plus',14)+' Cadastrar fornecedor</button></div></div>'+
  '<div class="pnl2 flex1"><div class="pnl2H">Fornecedores <span class="cnt2">'+lista.length+'</span></div>'+
  '<div class="pnl2B scroll1" style="padding:0">'+
  tabelaFornec(lista)+
  '</div></div></div>';
  rodape(lista.length+' fornecedores');
}
function modalForn(id){
  baseForn();
  var f=id?DB.fornec.find(function(x){return x.id===id}):null;
  var h='<div class="mdB"><div class="blk" style="margin:0 0 11px;max-width:none"><h3>Empresa</h3>'+
  '<div class="row2"><div class="fld2"><label>Nome da empresa *</label><input id="foE" value="'+E(f?f.empresa:'')+'"></div>'+
  '<div class="fld2"><label>CNPJ</label><input id="foC" value="'+E(f?f.cnpj:'')+'" placeholder="00.000.000/0000-00"></div></div></div>'+
  '<div class="blk" style="margin:0;max-width:none"><h3>Contato</h3>'+
  '<div class="row2"><div class="fld2"><label>Nome do fornecedor</label><input id="foN" value="'+E(f?f.nome:'')+'" placeholder="pessoa de contato"></div>'+
  '<div class="fld2"><label>E-mail</label><input id="foM" type="email" value="'+E(f?f.email:'')+'"></div></div>'+
  '<div class="row2"><div class="fld2" style="margin:0"><label>Telefone</label><input id="foT" value="'+E(f?f.tel:'')+'" placeholder="(00) 0000-0000"></div>'+
  '<div class="fld2" style="margin:0"><label>WhatsApp *</label><input id="foW" value="'+E(f?f.whats:'')+'" placeholder="(00) 00000-0000"></div></div>'+
  '</div>'+
  (f?(function(){
    var vinc=(DB.insumos||[]).filter(function(i){return i.fornecedorId===f.id});
    return '<div class="blk" style="margin:11px 0 0;max-width:none"><h3>Insumos deste fornecedor'+
     ' <span class="cnt2">'+vinc.length+'</span></h3>'+
     (vinc.length?'<table class="acTab"><thead><tr><th>Insumo</th>'+
       '<th style="width:90px">Unidade</th><th style="width:110px;text-align:right">Custo médio</th>'+
       '<th style="width:110px;text-align:right">Em estoque</th></tr></thead><tbody>'+
       vinc.sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')}).map(function(i){
         return '<tr><td><b>'+E(i.nome)+'</b></td><td>'+un(i.unidade).ab+'</td>'+
         '<td style="text-align:right">R$ '+money(custoAtual(i))+'</td>'+
         '<td style="text-align:right">'+fmtQt(i.estoqueAtual||0)+' '+un(i.unidade).ab+'</td></tr>';
       }).join('')+'</tbody></table>'
      :'<div class="hint" style="padding:10px">Nenhum insumo vinculado ainda. '+
       'O vínculo é criado ao lançar uma nota de entrada deste fornecedor.</div>')+
     '</div>';
  })():'')+
  '</div>';
  modal(f?'Editar fornecedor':'Cadastrar fornecedor',h,'Salvar',function(){
    var emp=$('foE').value.trim();
    if(!emp){toast('Informe o nome da empresa.');return false;}
    if(!$('foW').value.trim()){toast('Informe o WhatsApp do fornecedor.');return false;}
    var o={empresa:emp,cnpj:$('foC').value.trim(),nome:$('foN').value.trim(),
      email:$('foM').value.trim(),tel:$('foT').value.trim(),whats:$('foW').value.trim()};
    if(f)Object.assign(f,o);
    else{o.id=uid('fo');DB.fornec.push(o);}
    salvar();telaFornecedores();toast('Fornecedor salvo.');return true;
  },'lg');
}
async function excluirForn(id){
  var f=DB.fornec.find(function(x){return x.id===id});
  var usos=(DB.lancFin||[]).filter(function(l){return l.fornecedorId===id}).length;
  if(usos){toast('Este fornecedor tem '+usos+' lançamento(s). Não é possível excluir.');return;}
  if(!await pergunta('Excluir "'+f.empresa+'"?'))return;
  DB.fornec=DB.fornec.filter(function(x){return x.id!==id}); declararExclusao('fornec',id); /* exclusao declarada: so isto autoriza apagar da nuvem (V201) */
  salvar();telaFornecedores();toast('Fornecedor excluído.');
}

/* ==========================================================
   BLOCO 28.6 — RELATORIO DE PEDIDOS DE BASE

   De onde vem: DB.pedidosBase, a mesma tabela que a unidade preenche e a
   matriz confirma. Nao ha calculo paralelo aqui — o que a tela mostra e a
   soma do que foi pedido, com os precos que valiam no dia do pedido, que e o
   que ficou gravado em cada item. Refazer a conta pelo preco de hoje daria
   um numero diferente do que foi cobrado.

   Tres cortes do mesmo periodo, porque sao tres perguntas diferentes:
     por sabor   -> quanto de cada base a rede inteira consome
     por unidade -> quanto cada franqueado comprou
     por mes     -> como isso cresce ou cai ao longo do ano

   Rejeitado fica de fora por padrao: pedido recusado nao virou mercadoria
   nem dinheiro, e somado ali dentro inflaria o total sem nada por tras.
   ========================================================== */
var RPB = { de: '', ate: '', suc: '', base: '', sit: 'validos',
            visao: 'sabor', busca: '' };

function pedBaseNoFiltro(){
  var l = (DB.pedidosBase || []).slice();
  if (RPB.de)  l = l.filter(function (p) { return String(p.data || '') >= RPB.de; });
  if (RPB.ate) l = l.filter(function (p) { return String(p.data || '') <= RPB.ate; });
  if (RPB.suc) l = l.filter(function (p) { return p.sucursalRef === RPB.suc; });
  if (RPB.sit === 'validos') l = l.filter(function (p) { return p.situacao !== 'rejeitado'; });
  else if (RPB.sit) l = l.filter(function (p) { return p.situacao === RPB.sit; });
  return l;
}

/* percorre pedido a pedido e item a item, chamando de volta para cada linha.
   As tres visoes usam esta mesma varredura: se o filtro mudar, muda para as
   tres juntas, e nao ha como uma discordar da outra. */
function varrerPedBase(fn){
  pedBaseNoFiltro().forEach(function (p) {
    (p.itens || []).forEach(function (it) {
      if (RPB.base && it.baseRef !== RPB.base) return;
      if (RPB.busca && String(it.baseNome || '').toLowerCase()
            .indexOf(RPB.busca.toLowerCase()) < 0) return;
      fn(p, it);
    });
  });
}

function agruparPedBase(chave, rotulo){
  var por = {};
  varrerPedBase(function (p, it) {
    var k = chave(p, it);
    por[k] = por[k] || { k: k, nome: rotulo(p, it), cx: 0, valor: 0,
                         pedidos: {}, unidades: {} };
    por[k].cx += Number(it.qtd) || 0;
    por[k].valor += Number(it.total) || 0;
    por[k].pedidos[p.id] = 1;
    por[k].unidades[p.sucursalRef || '—'] = 1;
  });
  return Object.keys(por).map(function (k) {
    var x = por[k];
    x.nPedidos = Object.keys(x.pedidos).length;
    x.nUnidades = Object.keys(x.unidades).length;
    return x;
  }).sort(function (a, b) { return b.valor - a.valor; });
}

function mesDoPedido(p){ return String(p.data || '').slice(0, 7); }
function nomeDoMes(aaaamm){
  var m = ['janeiro','fevereiro','março','abril','maio','junho','julho',
           'agosto','setembro','outubro','novembro','dezembro'];
  var pt = String(aaaamm || '').split('-');
  if (pt.length < 2) return aaaamm || '—';
  return (m[(Number(pt[1]) || 1) - 1] || '?') + ' de ' + pt[0];
}

function telaRelPedidosBase(){
  if (!ehMatriz() && !ehPlataforma()) return telaRestrita('Pedidos de Base');
  basePedidos(); baseCatalogo();
  if (!RPB.de) {
    var d = new Date();
    RPB.de = new Date(d.getFullYear(), d.getMonth() - 5, 1).toISOString().slice(0, 10);
    RPB.ate = hojeISO();
  }

  var lista;
  if (RPB.visao === 'unidade')
    lista = agruparPedBase(function (p) { return p.sucursalRef || '—'; },
                           function (p) { return p.sucursalNome || '—'; });
  else if (RPB.visao === 'mes')
    lista = agruparPedBase(function (p) { return mesDoPedido(p); },
                           function (p) { return nomeDoMes(mesDoPedido(p)); })
             .sort(function (a, b) { return String(b.k).localeCompare(String(a.k)); });
  else
    lista = agruparPedBase(function (p, it) { return it.baseRef || it.baseNome; },
                           function (p, it) { return it.baseNome || '—'; });

  var totalV = lista.reduce(function (a, x) { return a + x.valor; }, 0);
  var totalC = lista.reduce(function (a, x) { return a + x.cx; }, 0);
  var pedidos = pedBaseNoFiltro().length;
  var sucs = (typeof lojasCad === 'function' ? lojasCad() : []) || [];
  var bases = baseCatalogo().slice().sort(function (a, b) {
    return String(a.nome || '').localeCompare(String(b.nome || ''));
  });
  var primeira = (RPB.visao === 'unidade' ? 'Unidade'
                : RPB.visao === 'mes' ? 'Mês' : 'Base');

  $('content').innerHTML = '<div class="etWrap"><div class="etScroll">' +
   '<div class="etTopo">' +
    '<div><h1>Pedidos de Base</h1><p>Quanto cada unidade pediu, de cada base, ' +
     'em cada mês.</p></div>' +
    '<button class="infoBt" onclick="explicaRelPedBase()">' + sv('help', 15) + '</button>' +
    '<div style="flex:1"></div>' +
    '<button class="btnP2" onclick="imprimirRel(\'Pedidos de Base\')">' +
     sv('print2', 13) + ' PDF</button>' +
    '<button class="btnP2" onclick="exportarRelPedBase()">' +
     sv('down2', 13) + ' Exportar</button>' +
   '</div>' +

   '<div class="barraF">' +
    '<div class="bfCampo"><label>De</label>' +
     '<input type="date" id="rpbDe" value="' + E(RPB.de) + '"></div>' +
    '<div class="bfCampo"><label>Até</label>' +
     '<input type="date" id="rpbAte" value="' + E(RPB.ate) + '"></div>' +
    '<div class="bfCampo"><label>Unidade</label>' +
     '<select onchange="RPB.suc=this.value;telaRelPedidosBase()">' +
      '<option value="">Todas</option>' +
      sucs.map(function (s) {
        return '<option value="' + s.id + '"' + (RPB.suc === s.id ? ' selected' : '') +
               '>' + E(s.nome) + '</option>';
      }).join('') + '</select></div>' +
    '<div class="bfCampo"><label>Base</label>' +
     '<select onchange="RPB.base=this.value;telaRelPedidosBase()">' +
      '<option value="">Todas</option>' +
      bases.map(function (b) {
        return '<option value="' + b.id + '"' + (RPB.base === b.id ? ' selected' : '') +
               '>' + E(b.nome) + '</option>';
      }).join('') + '</select></div>' +
    '<div class="bfCampo"><label>Situação</label>' +
     '<select onchange="RPB.sit=this.value;telaRelPedidosBase()">' +
      [['validos', 'Todos menos rejeitados'], ['', 'Todos, inclusive rejeitados'],
       ['enviado', 'Aguardando'], ['confirmado', 'Confirmados'],
       ['enviado_matriz', 'Enviados'], ['entregue', 'Entregues'],
       ['pago', 'Pagos'], ['rejeitado', 'Rejeitados']].map(function (o) {
        return '<option value="' + o[0] + '"' + (RPB.sit === o[0] ? ' selected' : '') +
               '>' + o[1] + '</option>';
      }).join('') + '</select></div>' +
    '<div class="bfCampo cresce"><label>Buscar base</label>' +
     '<input id="rpbBusca" value="' + E(RPB.busca) + '" placeholder="nome do sabor"></div>' +
    '<button class="btnP2 ok" onclick="RPB.de=$(\'rpbDe\').value;' +
     'RPB.ate=$(\'rpbAte\').value;telaRelPedidosBase()">' + sv('search', 13) +
     ' Buscar</button>' +
    (RPB.suc || RPB.base || RPB.busca || RPB.sit !== 'validos'
      ? '<button class="btnP2" onclick="limparRPB()">Limpar</button>' : '') +
   '</div>' +

   '<div class="lbSegm" style="margin-bottom:12px">' +
    [['sabor', 'Por sabor'], ['unidade', 'Por unidade'], ['mes', 'Por mês']]
      .map(function (v) {
        return '<button class="' + (RPB.visao === v[0] ? 'on' : '') + '" ' +
          'onclick="RPB.visao=\'' + v[0] + '\';telaRelPedidosBase()">' + v[1] +
          '</button>';
      }).join('') + '</div>' +

   '<div class="relKpis">' +
    '<div class="rk"><span>Pedidos no período</span><b>' + pedidos + '</b></div>' +
    '<div class="rk"><span>Caixas pedidas</span><b>' + fmtQt(totalC) + '</b></div>' +
    '<div class="rk dest"><span>Valor total</span><b>R$ ' + money(totalV) + '</b></div>' +
   '</div>' +

   '<div class="etTabW plano2" id="relArea">' +
   (lista.length
    ? '<table class="etTab semBusca"><thead><tr>' +
      '<th>' + primeira + '</th>' +
      '<th style="width:110px;text-align:right">Pedidos</th>' +
      '<th style="width:110px;text-align:right">Caixas</th>' +
      '<th style="width:130px;text-align:right">Valor médio/cx</th>' +
      '<th style="width:140px;text-align:right">Total</th>' +
      '<th style="width:110px;text-align:right">% do total</th></tr></thead><tbody>' +
      lista.map(function (x) {
        var pc = totalV ? (x.valor / totalV * 100) : 0;
        return '<tr><td><b>' + E(x.nome) + '</b>' +
         (RPB.visao === 'sabor' && x.nUnidades > 1
           ? '<small style="display:block;color:var(--ink-3)">' + x.nUnidades +
             ' unidade(s)</small>' : '') + '</td>' +
         '<td style="text-align:right">' + x.nPedidos + '</td>' +
         '<td style="text-align:right"><b>' + fmtQt(x.cx) + '</b></td>' +
         '<td style="text-align:right">R$ ' + money(x.cx ? x.valor / x.cx : 0) + '</td>' +
         '<td style="text-align:right"><b>R$ ' + money(x.valor) + '</b></td>' +
         '<td style="text-align:right"><span class="hpBar"><i style="width:' +
          Math.min(100, pc) + '%"></i></span><small>' + pc.toFixed(1) +
          '%</small></td></tr>';
      }).join('') + '</tbody>' +
      '<tfoot><tr><td><b>Total</b></td><td style="text-align:right">' + pedidos +
      '</td><td style="text-align:right"><b>' + fmtQt(totalC) + '</b></td><td></td>' +
      '<td style="text-align:right"><b>R$ ' + money(totalV) + '</b></td>' +
      '<td></td></tr></tfoot></table>'
    : '<div class="mvVazio">' + sv('box', 26) +
      '<b>Nenhum pedido no período</b></div>') +
   '</div></div></div>';

  var b = $('rpbBusca');
  if (b) b.oninput = function () {
    RPB.busca = this.value; var pos = this.selectionStart;
    telaRelPedidosBase();
    var n = $('rpbBusca'); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
  };
  rodape(lista.length + ' linha(s) · ' + fmtQt(totalC) + ' cx · R$ ' + money(totalV));
}

function limparRPB(){
  RPB.suc = ''; RPB.base = ''; RPB.busca = ''; RPB.sit = 'validos';
  telaRelPedidosBase();
}
function explicaRelPedBase(){
  explicaRel('Pedidos de Base — como é feito', [
   ['Caixas', 'soma da quantidade pedida de cada base, como foi enviada pela unidade'],
   ['Total', 'soma do valor de cada item do pedido, com o preço que valia no dia — ' +
    'não é recalculado pelo preço de hoje'],
   ['Valor médio por caixa', 'total dividido pelas caixas; muda quando a matriz ' +
    'reajusta a tabela no meio do período'],
   ['Por sabor', 'junta a rede inteira: quanto de cada base sai por período'],
   ['Por unidade', 'quanto cada franqueado comprou'],
   ['Por mês', 'a mesma soma quebrada pelo mês da data do pedido'],
   ['Situação', 'por padrão rejeitados ficam de fora — pedido recusado não virou ' +
    'mercadoria nem cobrança']
  ], 'os pedidos de base das unidades, pela data do pedido.',
   'pedidos rejeitados (salvo se você escolher vê-los) e qualquer baixa de estoque ' +
   'que não tenha vindo de um pedido de base.');
}
function exportarRelPedBase(){
  var area = [['Item', 'Pedidos', 'Caixas', 'Valor medio por caixa', 'Total']];
  var tr = document.querySelectorAll('#relArea tbody tr');
  for (var i = 0; i < tr.length; i++) {
    var td = tr[i].querySelectorAll('td');
    area.push([td[0].innerText.split('\n')[0], td[1].innerText, td[2].innerText,
               td[3].innerText, td[4].innerText]);
  }
  baixarCSV('nexor-pedidos-de-base.csv', area);
}

/* ==========================================================
   JOIA — O RELATORIO TEM DE BATER COM O QUE A LOJA VENDEU

   Quatro defeitos que o Rafael achou em 01/09/2026 olhando os paineis
   de agosto. Todos conferidos no banco de producao antes de mexer.

   1. A VENDA DO CARDAPIO NASCIA NA MATRIZ.
      `aceitarPedidoOnline` gravava `sucursalId: p.sucursal_id||'suc_matriz'`
      e o cardapio digital nao manda sucursal. Os 9 pedidos do cardapio de
      agosto (R$ 608,00) estavam todos em caixas de Santa Fe do Sul e todos
      com sucursal nula. Santa Fe nao via nenhum deles.

   2. DELIVERY E CARDAPIO DIGITAL ERAM DOIS CANAIS PARA A MESMA VENDA.
      Em `telaCanaisVenda`, Delivery era
      `tipo==='entrega' && canal!=='cardapio' && canal!=='whatsapp'`:
      a entrega pedida pelo cardapio saia de dentro do Delivery. Sobrava
      "Delivery R$ 213,00 · 2 pedidos" — os dois unicos digitados a mao no
      PDV. O aplicativo do celular ja contava certo (`tipo==='entrega'`),
      e era por isso que os dois nunca batiam.

   3. "DOMINGO: 177 PEDIDOS EM 120 DIA(S)", em um mes de 31 dias.
      A media por dia da semana contava os dias com a chave `p.data` — o
      carimbo inteiro, com hora e segundo. Cada pedido virava um dia. Os
      120 sao 117 carimbos de PDV mais os 3 domingos importados. Com a
      conta errada, o "melhor dia" era quarta-feira; domingo, que e o dia
      forte da loja, caia para quinto.

   4. UM PICO AS 19h QUE NUNCA EXISTIU.
      A carga do sistema antigo trouxe 315 vendas de agosto, R$ 50.763,38,
      todas carimbadas "19:00" porque nao tinham hora. O grafico somava o
      carimbo: R$ 51,5 mil as 19h contra menos de R$ 2 mil em cada outra
      hora.

   Estes testes rodam as funcoes de verdade do index.html.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const fs = require('fs');
const { corpoDaFuncao, ARQ } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* ---------- o retrato do banco em agosto/2026 ---------- */
function mundo() {
  return {
    caixas: [{ id: 'cx_sf', sucursalId: 'suc_santafe' },
             { id: 'cx_mt', sucursalId: 'suc_matriz' }],
    pedidos: [
      /* entregas pedidas pelo cardapio digital: caixa de Santa Fe, sem loja */
      { id: 'p600', numero: 600, tipo: 'entrega', canal: 'cardapio', sucursalId: '',
        caixaId: 'cx_sf', total: 75, fase: 'entregue', data: '2026-08-30T16:06:44.111Z', hora: '13:06' },
      { id: 'p684', numero: 684, tipo: 'entrega', canal: 'cardapio', sucursalId: '',
        caixaId: 'cx_sf', total: 102, fase: 'entregue', data: '2026-08-30T22:49:26.800Z', hora: '19:49' },
      /* entrega digitada no PDV: essa sempre teve loja */
      { id: 'p712', numero: 712, tipo: 'entrega', canal: 'entrega', sucursalId: 'suc_santafe',
        caixaId: 'cx_sf', total: 105, fase: 'entregue', data: '2026-08-31T00:29:19.519Z', hora: '21:29' },
      /* balcao */
      { id: 'p700', numero: 700, tipo: 'loja', canal: 'pdv', sucursalId: 'suc_santafe',
        caixaId: 'cx_sf', total: 40, fase: 'entregue', data: '2026-08-30T20:00:00.000Z', hora: '17:00' },
      /* venda trazida do sistema antigo: data certa, hora carimbada */
      { id: 'i001', numero: 1, tipo: 'loja', canal: 'pdv', origem: 'importado',
        sucursalId: 'suc_santafe', caixaId: 'cx_sf', total: 3868.67, fase: 'entregue',
        data: '2026-08-01T22:00:00.000Z', hora: '19:00' },
      { id: 'i002', numero: 2, tipo: 'loja', canal: 'pdv', origem: 'importado',
        sucursalId: 'suc_santafe', caixaId: 'cx_sf', total: 5765.34, fase: 'entregue',
        data: '2026-08-02T22:00:00.000Z', hora: '19:00' },
      /* venda de outra unidade: Santa Fe nao pode ver */
      { id: 'p900', numero: 900, tipo: 'loja', canal: 'pdv', sucursalId: 'suc_jales',
        caixaId: 'cx_mt', total: 999, fase: 'entregue', data: '2026-08-30T20:00:00.000Z', hora: '17:00' }
    ]
  };
}

function api(DB, loja) {
  const amb = {
    DB: DB,
    lojaAtualId: () => loja || 'suc_santafe',
    ehSucMatriz: id => id === 'suc_matriz',
    baseSuc: () => {}, baseMov: () => {},
    ehCancelado: p => String(p.fase || '') === 'cancelado',
    _histExtra: [],   /* Etapa 2: fontePedidos junta locais + histórico da nuvem */
    DIAS_SEM: ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
  };
  const nomes = ['diaLocal', 'diaSemana', 'sucursalDoPedido', 'vendaDaUnidadeAberta',
                 'canalDoPedido', 'fontePedidos', 'pedsPeriodo', 'canaisVenda', 'pedidosFiltrados'];
  const codigo = nomes.map(n => corpoDaFuncao(n, fonte)).join('\n') +
    '\n' + fonte.slice(fonte.indexOf('var CANAIS_REL=['),
                       fonte.indexOf('];', fonte.indexOf('var CANAIS_REL=[')) + 2);
  const feito = new Function('amb',
    'with(amb){' + codigo + '\nreturn {' + nomes.join(',') + ',CANAIS_REL:CANAIS_REL};}')(amb);
  Object.assign(amb, feito);
  return feito;
}

console.log('\n── A venda do cardápio é da loja que a aceitou\n');
{
  const DB = mundo(), f = api(DB);
  const cardapio = DB.pedidos.find(p => p.id === 'p600');
  t('pedido do cardápio sem loja cai no caixa que recebeu o dinheiro',
    f.sucursalDoPedido(cardapio) === 'suc_santafe', f.sucursalDoPedido(cardapio));
  t('e Santa Fé passa a enxergar essa venda', f.vendaDaUnidadeAberta(cardapio) === true);
  t('pedido que já tem loja não muda',
    f.sucursalDoPedido(DB.pedidos.find(p => p.id === 'p712')) === 'suc_santafe');
  t('sem loja e sem caixa continua caindo na matriz, como antes',
    f.sucursalDoPedido({ id: 'x', sucursalId: '', caixaId: '' }) === 'suc_matriz');
  t('a venda de Jales continua invisível para Santa Fé',
    f.vendaDaUnidadeAberta(DB.pedidos.find(p => p.id === 'p900')) === false);
}
{
  const DB = mundo(), f = api(DB, 'suc_matriz');
  t('a matriz continua vendo a rede inteira',
    DB.pedidos.every(p => f.vendaDaUnidadeAberta(p) === true));
}

console.log('\n── Entrega é entrega, venha de onde vier\n');
{
  const DB = mundo(), f = api(DB);
  t('entrega do cardápio digital é Delivery',
    f.canalDoPedido(DB.pedidos.find(p => p.id === 'p600')) === 'entrega',
    f.canalDoPedido(DB.pedidos.find(p => p.id === 'p600')));
  t('entrega digitada no PDV é Delivery',
    f.canalDoPedido(DB.pedidos.find(p => p.id === 'p712')) === 'entrega');
  t('entrega pedida pelo WhatsApp é Delivery',
    f.canalDoPedido({ tipo: 'entrega', canal: 'whatsapp' }) === 'entrega');
  t('retirada pedida pelo cardápio é balcão',
    f.canalDoPedido({ tipo: 'loja', canal: 'cardapio' }) === 'balcao');
  t('mesa continua mesa', f.canalDoPedido({ tipo: 'loja', canal: 'mesa' }) === 'mesa');
  t('totem continua totem', f.canalDoPedido({ tipo: 'loja', canal: 'totem' }) === 'totem');
  t('não existe mais o canal "cardapio" na lista',
    !f.CANAIS_REL.some(c => c.id === 'cardapio'), f.CANAIS_REL.map(c => c.id).join(','));
  t('nem o canal "whatsapp"', !f.CANAIS_REL.some(c => c.id === 'whatsapp'));
  t('e o canal de entrega se chama Delivery',
    (f.CANAIS_REL.find(c => c.id === 'entrega') || {}).n === 'Delivery');
}

console.log('\n── O Delivery do relatório bate com o do aplicativo\n');
{
  const DB = mundo(), f = api(DB);
  const peds = f.pedsPeriodo({ de: '2026-08-01', ate: '2026-08-31', sucs: [], canais: [] });
  const soma = l => l.reduce((a, p) => a + p.total, 0);
  /* a regra do aplicativo do celular, escrita aqui do lado para comparar */
  const doApp = DB.pedidos.filter(p => p.tipo === 'entrega' && p.fase !== 'cancelado'
    && p.sucursalId !== 'suc_jales');
  const doRelatorio = peds.filter(p => f.canalDoPedido(p) === 'entrega');
  t('mesmo número de entregas que o aplicativo',
    doRelatorio.length === doApp.length, doRelatorio.length + ' × ' + doApp.length);
  t('mesmo valor de entregas que o aplicativo',
    Math.abs(soma(doRelatorio) - soma(doApp)) < 0.005,
    soma(doRelatorio) + ' × ' + soma(doApp));
  t('são as três entregas, R$ 282,00', soma(doRelatorio) === 282, soma(doRelatorio));
  t('nenhuma venda cai em dois cartões ao mesmo tempo',
    peds.every(p => f.CANAIS_REL.filter(c => f.canalDoPedido(p) === c.id).length === 1));
  t('a soma dos canais é o total da tela',
    Math.abs(f.CANAIS_REL.reduce((a, c) =>
      a + soma(peds.filter(p => f.canalDoPedido(p) === c.id)), 0) - soma(peds)) < 0.005);
}

console.log('\n── Os cinco relatórios do outro seletor passam pela mesma porta\n');
{
  const DB = mundo(), f = api(DB);
  const lista = f.canaisVenda();
  t('o seletor mostra só os canais de verdade',
    Object.keys(lista).sort().join(',') === 'balcao,entrega,mesa,totem',
    Object.keys(lista).join(','));
  t('sem nome cru de banco na tela',
    !Object.keys(lista).some(k => k === 'pdv' || k === 'cardapio'));
  const so = f.pedidosFiltrados({ de: '2026-08-01', ate: '2026-08-31', canais: ['entrega'], dias: [] });
  t('filtrar por Delivery traz as entregas do cardápio junto',
    so.length === 3, so.map(p => p.numero).join(','));
  const tudo = f.pedidosFiltrados({ de: '2026-08-01', ate: '2026-08-31', canais: [], dias: [] });
  t('e a venda de Jales não entra no relatório de Santa Fé',
    !tudo.some(p => p.id === 'p900'), tudo.map(p => p.numero).join(','));
}

console.log('\n── A média por dia da semana divide por dias, não por carimbos\n');
{
  const DB = mundo(), f = api(DB);
  /* dois pedidos no mesmo domingo, com segundos diferentes */
  const peds = [
    { total: 100, data: '2026-08-02T20:00:01.000Z' },
    { total: 200, data: '2026-08-02T20:00:02.000Z' },
    { total: 300, data: '2026-08-09T20:00:00.000Z' }
  ];
  const sem = []; for (let d = 0; d < 7; d++) sem.push({ v: 0, q: 0, dias: {} });
  peds.forEach(function (p) {
    const dia = f.diaLocal(p.data);
    const k = f.diaSemana(dia);
    sem[k].v += p.total; sem[k].q++; sem[k].dias[dia] = true;
  });
  sem.forEach(x => { x.nd = Object.keys(x.dias).length; x.media = x.nd ? x.v / x.nd : 0; });
  t('três pedidos em dois domingos contam DOIS dias', sem[0].nd === 2, sem[0].nd);
  t('a média é R$ 300,00 e não R$ 200,00', sem[0].media === 300, sem[0].media);
  t('o dia é o de São Paulo, não o de Greenwich',
    f.diaLocal('2026-08-31T00:29:19.519Z') === '2026-08-30',
    f.diaLocal('2026-08-31T00:29:19.519Z'));
  t('e por isso essa venda das 21h29 é de domingo, não de segunda',
    f.diaSemana(f.diaLocal('2026-08-31T00:29:19.519Z')) === 0);
}

console.log('\n── A hora carimbada da importação não vira pico\n');
{
  const DB = mundo(), f = api(DB);
  const peds = f.pedsPeriodo({ de: '2026-08-01', ate: '2026-08-31', sucs: [], canais: [] });
  const comHora = peds.filter(p => String(p.origem || '') !== 'importado');
  const semHora = peds.filter(p => String(p.origem || '') === 'importado');
  const horas = []; for (let h = 0; h < 24; h++) horas.push({ v: 0, q: 0 });
  comHora.forEach(function (p) {
    const hh = parseInt(String(p.hora || '0').slice(0, 2), 10);
    if (isNaN(hh) || hh < 0 || hh > 23) return;
    horas[hh].v += p.total; horas[hh].q++;
  });
  const melhorH = horas.indexOf(horas.slice().sort((a, b) => b.v - a.v)[0]);
  t('as vendas importadas ficam fora do gráfico de horário',
    semHora.length === 2, semHora.length);
  /* às 19h só fica a venda real das 19h49 (R$ 102,00);
     os R$ 9.634,01 carimbados não entram */
  t('as 19h não recebem os R$ 9.634,01 da importação',
    horas[19].v === 102, horas[19].v);
  t('o pico passa a ser uma hora de venda de verdade',
    melhorH === 21, melhorH + 'h');
  t('mas o faturamento total continua com a venda importada',
    Math.abs(peds.reduce((a, p) => a + p.total, 0) - 9956.01) < 0.005,
    peds.reduce((a, p) => a + p.total, 0));
  t('e o dia da semana também conta a venda importada',
    peds.filter(p => f.diaLocal(p.data) === '2026-08-01').length === 1);
}

console.log('\n── O código não guarda mais as regras antigas\n');
{
  const cv = corpoDaFuncao('telaCanaisVenda', fonte);
  t('a tela de Canais não tem mais lista própria de canais',
    !/n:'Cardápio digital'/.test(cv), 'lista paralela ainda presente');
  t('e chama a porta única', /canalDoPedido\(p\)===c\.id/.test(cv));
  const ac = corpoDaFuncao('aceitarPedidoOnline', fonte);
  t('o pedido do cardápio nasce na loja aberta',
    /sucursalId:p\.sucursal_id\|\|lojaAtualId\(\)\|\|'suc_matriz'/.test(ac));
  const ex = corpoDaFuncao('explicaCanais', fonte);
  t('a explicação da tela não promete módulo que já existe',
    !/ficam em zero até os módulos existirem/.test(ex));
  t('e diz que Delivery é toda entrega, venha de onde vier',
    /não importa por onde o pedido entrou/.test(ex));
  const vd = corpoDaFuncao('telaVendaDataHora', fonte);
  t('a contagem de dias usa o dia da loja', /sem\[k\]\.dias\[dia\]=true/.test(vd));
  t('e nunca mais o carimbo inteiro', !/dias\[p\.data\]=true/.test(vd));
  t('o gráfico de horário separa quem não tem hora',
    /var comHora=peds\.filter/.test(vd) && /!=='importado'/.test(vd));
  t('a tela avisa quantas vendas ficaram de fora', /fora: '\+semHora\.length/.test(vd));
  t('e o rodapé não inventa pico quando não há hora',
    /temHora\?' · pico às '/.test(vd));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

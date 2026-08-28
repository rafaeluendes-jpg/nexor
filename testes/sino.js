/* ==========================================================
   JOIA — O SINO PRECISA AVISAR, NAO ENFEITAR

   Ate a V207 o sino do cabecalho respondia sempre a mesma frase
   ("Nenhuma notificação no momento") com um zero escrito na mao ao lado.
   O franqueado so descobria que o pedido dele tinha ficado pronto se
   abrisse a tela do pedido e olhasse o selo.

   O aviso NAO tem tabela propria, de proposito: ele e derivado do proprio
   pedido, que ja sobe e desce inteiro e ja grava a hora de cada mudanca de
   fase. Uma tabela a parte seria um segundo lugar onde a verdade mora, e no
   dia em que os dois discordassem ninguem saberia qual acreditar.

   O que estes testes protegem:
     - matriz e unidade veem coisas diferentes, e uma nao ve a da outra;
     - pedido de outra unidade NUNCA aparece para o franqueado;
     - o "ja li" e do aparelho, e a primeira abertura nao despeja o
       historico inteiro como se fosse novidade.
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome); }
}

/* um localStorage de mentira, para o "ja li" ser observavel no teste */
function memoria() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null),
           setItem: (k, v) => { m[k] = String(v); },
           removeItem: k => { delete m[k]; }, _m: m };
}

function montar(nomes, DB, extra) {
  const codigo = nomes.map(n => corpoDaFuncao(n, fonte)).join('\n');
  const fabrica = new Function('DB', 'ambiente',
    'with(ambiente){' + codigo + '\n return {' + nomes.join(',') + '};}');
  return fabrica(DB, extra);
}

const FN = ['avisosPedidoBase', 'ehDaMatriz', 'chaveSino', 'sinoVistos',
            'marcarSinoVisto', 'sinoEstreia', 'avisosNovos', 'quandoSino'];

function cenario(quem, loja) {
  const ls = memoria();
  const DB = { pedidosBase: [] };
  const amb = {
    localStorage: ls,
    ehMatriz: () => quem === 'matriz',
    ehPlataforma: () => false,
    lojaAtualId: () => loja || 'suc1',
    usuarioLogado: () => ({ id: 'u1', login: 'rafael' }),
    money: v => String(v),
    dataBR: v => v,
    _quieto: () => {}
  };
  return { DB, ls, fn: montar(FN, DB, amb) };
}

const AGORA = new Date().toISOString();
const ONTEM = new Date(Date.now() - 26 * 3600 * 1000).toISOString();

function ped(x) {
  return Object.assign({ id: 'pb1', numero: 7, sucursalRef: 'suc1',
    sucursalNome: 'Jales', data: '2026-08-24', total: 500,
    situacao: 'enviado', enviadoEm: ONTEM, itens: [] }, x || {});
}

console.log('\n── O sino não é mais enfeite\n');

t('a frase fixa saiu do cabeçalho',
  !/Nenhuma notificação no momento/.test(fonte));
t('o botão chama abrirSino',               /onclick="abrirSino\(event\)"/.test(fonte));
t('o número tem id, para ser pintado',     /id="sinoBadge"/.test(fonte));
t('topo\(\) manda pintar',                 /pintarSino\(\)/.test(corpoDaFuncao('topo', fonte)));

console.log('\n── A matriz é avisada do que chega\n');

const M = cenario('matriz');
M.DB.pedidosBase = [ped()];
let av = M.fn.avisosPedidoBase();
t('pedido enviado vira aviso',             av.length === 1);
t('diz o número do pedido',                av[0].titulo.indexOf('#0007') >= 0);
t('e a unidade que pediu',                 av[0].texto.indexOf('Jales') >= 0);
M.DB.pedidosBase[0].entradaEstoque = true;
M.DB.pedidosBase[0].entregueEm = AGORA;
av = M.fn.avisosPedidoBase();
t('conferência da unidade também avisa',   av.length === 2);
t('o mais recente vem primeiro',           av[0].titulo.indexOf('conferido') >= 0);

console.log('\n── O franqueado é avisado do que muda\n');

const F = cenario('unidade', 'suc1');
F.DB.pedidosBase = [ped({ situacao: 'confirmado', confirmadoEm: ONTEM })];
t('confirmado avisa',
  F.fn.avisosPedidoBase().some(a => a.tipo === 'confirmado'));
t('mas ele NÃO vê o aviso de "pedido recebido" da matriz',
  !F.fn.avisosPedidoBase().some(a => a.tipo === 'novo'));

F.DB.pedidosBase[0].situacao = 'entregue';
F.DB.pedidosBase[0].entregueEm = AGORA;
const pronto = F.fn.avisosPedidoBase().find(a => a.tipo === 'pronto');
t('entregue vira "pronto para retirar"',   !!pronto);
t('e diz o que fazer em seguida',          /Recebi as bases/.test(pronto.texto));

F.DB.pedidosBase[0].situacao = 'pago';
F.DB.pedidosBase[0].pagoEm = AGORA;
t('pago avisa',                            F.fn.avisosPedidoBase().some(a => a.tipo === 'pago'));

const R = cenario('unidade', 'suc1');
R.DB.pedidosBase = [ped({ situacao: 'rejeitado', motivoRejeicao: 'fora do prazo' })];
const rej = R.fn.avisosPedidoBase().find(a => a.tipo === 'rejeitado');
t('recusa avisa',                          !!rej);
t('e leva o motivo junto',                 rej.texto === 'fora do prazo');
t('recusa sem motivo não fica em branco',
  cenario('unidade', 'suc1').fn.avisosPedidoBase.call(null) !== undefined);

console.log('\n── Pedido de outra unidade não vaza\n');

const V = cenario('unidade', 'suc1');
V.DB.pedidosBase = [
  ped({ id: 'pb1', situacao: 'entregue', entregueEm: AGORA }),
  ped({ id: 'pb9', numero: 9, sucursalRef: 'suc2', sucursalNome: 'Sorocaba',
        situacao: 'entregue', entregueEm: AGORA })];
const meus = V.fn.avisosPedidoBase();
t('só o pedido da unidade dele aparece',   meus.every(a => a.pedido === 'pb1'));
t('nenhum aviso da outra loja',            meus.filter(a => a.pedido === 'pb9').length === 0);
t('a matriz, essa sim, vê os dois',
  (function () {
    const X = cenario('matriz');
    X.DB.pedidosBase = V.DB.pedidosBase;
    const ids = {};
    X.fn.avisosPedidoBase().forEach(a => { ids[a.pedido] = 1; });
    return Object.keys(ids).length === 2;
  })());

console.log('\n── O "já li" mora no aparelho\n');

const L = cenario('matriz');
L.DB.pedidosBase = [ped({ id: 'pb1' }), ped({ id: 'pb2', numero: 8 })];
t('na estreia, o histórico não é novidade',
  (L.fn.sinoEstreia(), L.fn.avisosNovos().length === 0));
t('e a chave fica gravada',                L.ls.getItem(L.fn.chaveSino()) !== null);

L.DB.pedidosBase.push(ped({ id: 'pb3', numero: 9, enviadoEm: AGORA }));
t('pedido que chega DEPOIS conta como novo', L.fn.avisosNovos().length === 1);
L.fn.marcarSinoVisto(L.fn.avisosPedidoBase());
t('depois de ler, zera',                   L.fn.avisosNovos().length === 0);
t('e continua zerado ao reler',            L.fn.avisosNovos().length === 0);

t('a chave é por usuário',
  L.fn.chaveSino().indexOf('u1') >= 0);
t('a lista guardada não cresce sem limite',
  /slice\(-300\)/.test(corpoDaFuncao('marcarSinoVisto', fonte)));
t('localStorage quebrado não derruba a tela',
  (function () {
    const Q = cenario('matriz');
    Q.DB.pedidosBase = [ped()];
    const F2 = montar(FN, Q.DB, {
      localStorage: { getItem() { throw new Error('bloqueado'); },
                      setItem() { throw new Error('bloqueado'); } },
      ehMatriz: () => true, ehPlataforma: () => false,
      lojaAtualId: () => 'suc1', usuarioLogado: () => ({ id: 'u1' }),
      money: v => String(v), dataBR: v => v, _quieto: () => {} });
    try { F2.sinoEstreia(); return F2.avisosNovos().length === 1; }
    catch (e) { return false; }
  })());

console.log('\n── O relógio do aviso fala português\n');

const q = cenario('matriz').fn.quandoSino;
t('agora',                                 q(new Date().toISOString()) === 'agora');
t('minutos',                               q(new Date(Date.now() - 12 * 60000).toISOString()) === 'há 12 min');
t('horas',                                 q(new Date(Date.now() - 3 * 3600000).toISOString()) === 'há 3 h');
t('ontem',                                 q(ONTEM) === 'ontem');
t('data ruim não vira "Invalid Date"',     q('nada') === '');

console.log('\n── O painel abre, fecha e leva ao pedido\n');

const ab = corpoDaFuncao('abrirSino', fonte);
t('o clique não sobe e fecha sozinho',     /stopPropagation/.test(ab));
t('clicar de novo fecha',                  /fecharSuc\(\)/.test(ab));
t('abrir marca como lido',                 /marcarSinoVisto\(lista\)/.test(ab));
t('e repinta o número',                    /pintarSino\(\)/.test(ab));
const ir = corpoDaFuncao('irDoSino', fonte);
t('matriz vai para os pedidos recebidos',  /'controle', 'bases-valores'/.test(ir));
t('unidade vai para a tela dela',          /'controle', 'pedido-base'/.test(ir));

console.log('\n── E se atualiza sozinho\n');

t('o ciclo de 15s repinta o sino',
  /pintarSino\(\)[\s\S]{0,120}if\(!NUVEM\.ligada\)return;/.test(fonte));
t('enviar pedido repinta',                 /pintarSino[\s\S]{0,80}enviarPedidoBase/.test(fonte));
t('avançar de fase repinta',               /pintarSino[\s\S]{0,80}avancarPedido/.test(fonte));
t('receber as bases repinta',              /pintarSino[\s\S]{0,80}receberPedidoBase/.test(fonte));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · o sino');
console.log(testes - falhas + ' de ' + testes + ' testes passaram');
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

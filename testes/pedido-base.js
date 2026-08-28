/* ==========================================================
   JOIA — O PEDIDO DE BASE TEM DE FECHAR DOS DOIS LADOS

   O caminho combinado e este, e nenhum pedaco dele pode existir sozinho:

     unidade pede            -> o pedido sobe para a matriz
     matriz confirma         -> so muda de fase
     matriz lanca producao   -> baixa os insumos da ficha e poe a base
                                no estoque da matriz
     matriz marca ENTREGUE   -> a base SAI do estoque da matriz
                                e nasce a conta a RECEBER daquela unidade
     unidade "Recebi as bases" -> entra no estoque dela
                                e nasce a conta a PAGAR para a matriz

   Ate a V206 dois desses passos estavam errados:

     - a saida do estoque da matriz nao existia: a base entrava na
       producao e nunca saia, entao o estoque da matriz so crescia e
       ninguem sabia quanto cada unidade tinha levado;

     - a conta a receber era gravada em DB.lancamentos, a colecao LEGADA.
       Ela nao sobe para a nuvem, e a migracao do bloco 13 a converte para
       DB.lancFin com `pago:true` e com o tipo virado — porque so trata
       'entrada' como receita. Resultado: a cobranca da matriz virava uma
       DESPESA JA QUITADA, com a data de hoje no lugar do vencimento.

   Estes testes rodam as funcoes de verdade de dentro do index.html.
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

/* monta um mundo minimo e roda a funcao pedida dentro dele */
function rodar(nomes, DB, extra) {
  const codigo = nomes.map(n => corpoDaFuncao(n, fonte)).join('\n');
  const fabrica = new Function('DB', 'ambiente',
    'with(ambiente){' + codigo + '\n return {' + nomes.join(',') + '};}');
  return fabrica(DB, extra || {});
}

const HOJE = '2026-08-28';
const amb = {
  hojeISO: () => HOJE,
  agoraHM: () => '10:00',
  uid: p => p + '_' + (amb._n = (amb._n || 0) + 1),
  baseFin: () => {},
  baseMov: () => {},
  money: v => String(v),
  dataBR: v => v
};

function mundo() {
  return {
    lancFin: [],
    lancamentos: [],
    movEst: [],
    fichas: [{ id: 'fi1', nome: 'BASE CHOCOLATE', rendimento: 10, unidade: 'kg',
               itens: [{ insumoId: 'in1', qtd: 2, unidade: 'kg' }] }],
    pedidosBase: []
  };
}
function pedido(extra) {
  return Object.assign({
    id: 'pb1', numero: 7, sucursalRef: 'suc1', sucursalNome: 'Jales',
    data: '2026-08-24', total: 500, situacao: 'enviado_matriz',
    itens: [{ baseRef: 'bc1', baseNome: 'BASE CHOCOLATE', fichaRef: 'fi1',
              qtd: 4, valorUnit: 125, total: 500 }]
  }, extra || {});
}

console.log('\n── O vencimento é calculado, não perguntado\n');

const venc = rodar(['vencimentoPedidoBase'], mundo(), amb).vencimentoPedidoBase;
t('3 dias depois da data do pedido',      venc({ data: '2026-08-24' }) === '2026-08-27');
t('vira o mês corretamente',              venc({ data: '2026-08-30' }) === '2026-09-02');
t('vira o ano corretamente',              venc({ data: '2026-12-30' }) === '2027-01-02');
t('data inválida não gera NaN',           /^\d{4}-\d{2}-\d{2}$/.test(venc({ data: 'xx' })));
t('sem prompt no faturamento',
  !/prompt\(/.test(corpoDaFuncao('faturarPedidoBase', fonte)));

console.log('\n── A conta a receber vai para a coleção que sobe para a nuvem\n');

const DB1 = mundo(), P1 = pedido();
const g = rodar(['gerarReceberPedido', 'vencimentoPedidoBase'], DB1, amb).gerarReceberPedido;
const rec = g(P1);
t('nasce um lançamento',                  !!rec);
t('vai para DB.lancFin',                  DB1.lancFin.length === 1);
t('NÃO vai para a coleção legada',        DB1.lancamentos.length === 0);
t('é receita, não despesa',               rec.tipo === 'receita');
t('nasce em aberto, não paga',            rec.pago === false);
t('com o valor do pedido',                rec.valor === 500);
t('vence 3 dias após o pedido',           rec.vencimento === '2026-08-27');
t('aponta para o pedido',                 rec.origemRef === 'pb1');
t('o pedido guarda a referência',         P1.finReceberRef === rec.id);
t('rodar de novo não duplica',            g(P1) === null && DB1.lancFin.length === 1);

console.log('\n── A base sai do estoque da matriz na entrega\n');

/* a saida espelha a ENTRADA que a producao gerou: mesma quantidade, mesmo
   item de destino. Por isso ela e montada pela mesma montarLinhas(). */
const corpoSai = corpoDaFuncao('linhasSaidaBases', fonte);
t('reaproveita montarLinhas',             /montarLinhas\(/.test(corpoSai));
t('fica só com a linha de entrada',       /direcao === 'entrada'/.test(corpoSai));
t('e vira saída',                         /direcao = 'saida'/.test(corpoSai));

const corpoMov = corpoDaFuncao('saidaBasesMatriz', fonte);
t('usa o motivo próprio da venda de base', /mv_pedbase/.test(corpoMov));
t('aplica pelo caminho único de estoque', /aplicarMovimento\(/.test(corpoMov));
t('não recalcula estoque por fora',       !/ajustaEstoque\(/.test(corpoMov));

const corpoMarca = corpoDaFuncao('saidaBaseJaFeita', fonte);
t('a trava contra repetir lê DB.movEst',  /DB\.movEst/.test(corpoMarca));
t('e não um campo solto do pedido',       !/p\.saidaMatriz/.test(corpoMarca));

const DB2 = mundo();
const f2 = rodar(['saidaBaseJaFeita', 'marcaSaidaBase'], DB2, amb);
const P2 = pedido();
t('antes da entrega, não saiu',           f2.saidaBaseJaFeita(P2) === false);
DB2.movEst.push({ origem: 'pedbase_saida', identificacao: f2.marcaSaidaBase(P2) });
t('depois do movimento, saiu',            f2.saidaBaseJaFeita(P2) === true);
t('a marca leva o número do pedido',      f2.marcaSaidaBase(P2).indexOf('#0007') >= 0);
t('e o nome da unidade',                  f2.marcaSaidaBase(P2).indexOf('Jales') >= 0);
t('pedido de outra unidade tem outra marca',
  f2.marcaSaidaBase(P2) !== f2.marcaSaidaBase(pedido({ numero: 8 })));

console.log('\n── "Entregue" é o clique que mexe no estoque e no dinheiro\n');

const av = corpoDaFuncao('avancarPedido', fonte);
t('só o passo "entregue" dispara',        /para === 'entregue'/.test(av));
t('chama a saída do estoque',             /saidaBasesMatriz\(/.test(av));
t('chama a conta a receber',              /gerarReceberPedido\(/.test(av));
t('avisa antes, na confirmação',          /confirmar\(/.test(av));
t('avisa se o saldo ficar negativo',      /faltaEstoque\(/.test(av));

console.log('\n── A entrada no estoque é da unidade, e só dela\n');

const ac = corpoDaFuncao('acoesPedido', fonte);
t('a tela da matriz não dá entrada',      !/darEntradaPedido/.test(ac));
t('nem gera a conta a pagar da unidade',  !/pagarPedido\(/.test(ac));
t('a unidade tem o botão "Recebi as bases"',
  /Recebi as bases/.test(corpoDaFuncao('telaPedidoBase', fonte)));
const rb = corpoDaFuncao('receberPedidoBase', fonte);
t('e ele confere a unidade do pedido',    /sucursalRef !== lojaAtualId\(\)/.test(rb));
t('grava a conta a pagar em DB.lancFin',  /DB\.lancFin\.push/.test(rb));
t('a pagar nasce em aberto',              /pago: false/.test(rb));

console.log('\n── As gêmeas quebradas não existem mais\n');

t('faturarPedido (coleção legada) sumiu', !/function faturarPedido\s*\(/.test(fonte));
t('produzirPedidoBase sumiu',             !/function produzirPedidoBase\s*\(/.test(fonte));
t('darEntradaPedido sumiu',               !/function darEntradaPedido\s*\(/.test(fonte));
t('pagarPedido sumiu',                    !/function pagarPedido\s*\(/.test(fonte));
t('nada no sistema escreve em DB.lancamentos para pedido de base',
  !/DB\.lancamentos\.push[\s\S]{0,400}?Pedido de base/.test(fonte));

console.log('\n── Ficha "BASE <SABOR>" já entra no catálogo de pedido\n');

const DB3 = mundo(); DB3.basesCat = [];
const fx = rodar(['ehNomeDeBase', 'baseDeFichaNova', 'baseCatalogo'], DB3, amb);
t('BASE CHOCOLATE é nome de base',        fx.ehNomeDeBase('BASE CHOCOLATE') === true);
t('BASE DOCE DE LEITE também',            fx.ehNomeDeBase('BASE DOCE DE LEITE') === true);
t('Base Chocolate (minúscula) não é',     fx.ehNomeDeBase('Base Chocolate') === false);
t('BASE sozinho não é',                   fx.ehNomeDeBase('BASE') === false);
t('CALDA MORANGO não é',                  fx.ehNomeDeBase('CALDA MORANGO') === false);

const nova = fx.baseDeFichaNova({ id: 'fi9', nome: 'BASE PISTACHE' });
t('a base é criada',                      !!nova && DB3.basesCat.length === 1);
t('já vinculada à ficha',                 nova.fichaRef === 'fi9');
t('nasce sem preço',                      nova.valorUnit === 0);
t('e nasce INATIVA, para não pedirem a zero', nova.ativo === false);
t('criar a mesma ficha de novo não duplica',
  fx.baseDeFichaNova({ id: 'fi9', nome: 'BASE PISTACHE' }) === null &&
  DB3.basesCat.length === 1);
t('ficha que não é base não cria nada',
  fx.baseDeFichaNova({ id: 'fi8', nome: 'Cascão' }) === null &&
  DB3.basesCat.length === 1);

/* base solta, cadastrada a mao antes da ficha existir: amarra em vez de
   criar uma segunda com o mesmo nome */
DB3.basesCat.push({ id: 'bc9', nome: 'BASE AVELÃ', fichaRef: '', valorUnit: 10 });
fx.baseDeFichaNova({ id: 'fi7', nome: 'BASE AVELÃ' });
t('base solta é amarrada, não duplicada',
  DB3.basesCat.length === 2 &&
  DB3.basesCat.find(b => b.id === 'bc9').fichaRef === 'fi7');

t('a ficha técnica chama o gatilho',
  /baseDeFichaNova\(o\)/.test(fonte));

console.log('\n── O relatório existe e está ligado ao menu\n');

t('a tela existe',                        /function telaRelPedidosBase\(/.test(fonte));
t('tem item de menu',                     /id:'pedidos-base'/.test(fonte));
t('tem rota',                             /iid==='pedidos-base'\)return telaRelPedidosBase\(\)/.test(fonte));
t('é da matriz',                          /ehMatriz\(\) && !ehPlataforma\(\)/.test(
  corpoDaFuncao('telaRelPedidosBase', fonte)));
const vr = corpoDaFuncao('telaRelPedidosBase', fonte);
t('tem as três visões',                   /'sabor'/.test(vr) && /'unidade'/.test(vr) && /'mes'/.test(vr));
t('tem filtro de período',                /RPB\.de/.test(vr) && /RPB\.ate/.test(vr));
t('tem filtro por unidade',               /RPB\.suc/.test(vr));
t('tem filtro por base',                  /RPB\.base/.test(vr));
t('exporta',                              /exportarRelPedBase/.test(vr));

/* o relatorio soma o que foi pedido, com o preco do dia do pedido */
const DB4 = mundo();
DB4.pedidosBase = [
  pedido(),
  pedido({ id: 'pb2', numero: 8, sucursalRef: 'suc2', sucursalNome: 'Sorocaba',
           data: '2026-08-25', total: 250,
           itens: [{ baseRef: 'bc1', baseNome: 'BASE CHOCOLATE', fichaRef: 'fi1',
                     qtd: 2, valorUnit: 125, total: 250 }] }),
  pedido({ id: 'pb3', numero: 9, data: '2026-08-26', situacao: 'rejeitado',
           total: 999,
           itens: [{ baseRef: 'bc1', baseNome: 'BASE CHOCOLATE', qtd: 9,
                     valorUnit: 111, total: 999 }] })
];
const rel = rodar(['pedBaseNoFiltro', 'varrerPedBase', 'agruparPedBase', 'mesDoPedido',
                   'nomeDoMes'], DB4,
  Object.assign({}, amb, { RPB: { de: '', ate: '', suc: '', base: '',
                                  sit: 'validos', busca: '' } }));
const porSabor = rel.agruparPedBase(function (p, it) { return it.baseRef; },
                                    function (p, it) { return it.baseNome; });
t('soma as caixas dos dois pedidos',      porSabor[0].cx === 6);
t('soma os valores',                      porSabor[0].valor === 750);
t('o rejeitado fica de fora',             porSabor[0].cx !== 15);
t('conta as unidades diferentes',         porSabor[0].nUnidades === 2);
t('o mês sai da data do pedido',          rel.mesDoPedido({ data: '2026-08-24' }) === '2026-08');
t('e vira nome legível',                  rel.nomeDoMes('2026-08') === 'agosto de 2026');

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · pedido de base');
console.log(testes - falhas + ' de ' + testes + ' testes passaram');
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

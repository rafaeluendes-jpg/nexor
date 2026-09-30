/* ==========================================================
   JOIA — NENHUM LANÇAMENTO AUTOMÁTICO ENTRAVA NO DRE (V377)

   Oito eventos do sistema criam lançamento financeiro sozinhos: o
   fechamento de caixa, a sangria, a transferência entre contas, o
   acerto com entregadores, o recebimento de fiado, as duas pontas do
   pedido de base e a nota lançada pela Assistente do WhatsApp.

   Todos nasciam com a categoria escrita à mão no código, como TEXTO
   solto — "Frente de Caixa", "Transferência", "Acerto com entregadores"
   —, sem id do plano de contas. E o DRE só enxerga quem tem id:

       var cat = l.categoriaId || ''; var rub = c.mapa[cat]; if (!rub) return;

   Resultado: a venda do dia, a sangria, o acerto do entregador e a
   compra lançada pela Assistente entravam no Fluxo de Caixa como grupos
   soltos e SUMIAM do resultado. O DRE mostrava as despesas digitadas à
   mão e quase nada do que o próprio sistema gera.

   A RDS (item 18) pede uma tabela de regras configurada, com vigência e
   responsável — e é explícita sobre o que fazer quando ela falta: não
   confirmar, registrar pendência, **e deixar o PDV continuar**.
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const semComentario = txt => txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/* ==========================================================
   1. OS OITO EVENTOS EXISTEM, E TODOS OS OITO CONSULTAM A REGRA
   ========================================================== */
console.log('\n── Os oito eventos que o sistema lança sozinho\n');

const EVENTOS = new Function(
  fonte.slice(fonte.indexOf('var EVENTOS_AUTO=['),
              fonte.indexOf('function regrasAuto()')) + '\n return EVENTOS_AUTO;')();

t('são oito', EVENTOS.length === 8, EVENTOS.length);
t('cada um tem nome e explicação em português',
  EVENTOS.every(e => e.id && e.n && e.d));

const ESPERADOS = ['fechamento-caixa', 'mov-caixa', 'transferencia', 'acerto-entregador',
                   'fiado', 'pedbase-receber', 'pedbase-pagar', 'assistente-nota'];
t('e são exatamente os oito que criam lançamento no código',
  ESPERADOS.every(id => EVENTOS.some(e => e.id === id)),
  JSON.stringify(EVENTOS.map(e => e.id)));

/* cada evento tem de estar SENDO USADO — regra que ninguém consulta é
   configuração decorativa, o defeito da V191 */
for (const id of ESPERADOS) {
  const usos = (fonte.match(new RegExp("categoriaDoEvento\\('" + id + "'\\)", 'g')) || []).length;
  t('o evento "' + id + '" é consultado por quem cria o lançamento', usos >= 2, usos + ' uso(s)');
}

/* ==========================================================
   2. A REGRA, RODANDO DE VERDADE
   ========================================================== */
console.log('\n── A regra decide, e regra inválida não vale\n');

function comRegras(regras, catfin) {
  const DB = { cfgDre: { regrasAuto: regras }, catfin: catfin };
  return new Function('amb', 'ev',
    'with(amb){' + corpoDaFuncao('cfgDRE', fonte) + '\n' +
    corpoDaFuncao('categoriaValida', fonte) + '\n' +
    corpoDaFuncao('regrasAuto', fonte) + '\n' +
    corpoDaFuncao('categoriaDoEvento', fonte) +
    '\n return categoriaDoEvento(ev);}')({ DB: DB, tipoCat: () => null, _quieto: () => {} }, arguments[1]);
}
const plano = [{ id: 'p1', nome: 'Vendas', itens: [{ id: 'sub_venda', nome: 'Balcão' }] }];
const rodar = (regras, ev) => new Function('amb', 'ev',
  'with(amb){' + corpoDaFuncao('cfgDRE', fonte) + '\n' +
  corpoDaFuncao('categoriaValida', fonte) + '\n' +
  corpoDaFuncao('regrasAuto', fonte) + '\n' +
  corpoDaFuncao('categoriaDoEvento', fonte) +
  '\n return categoriaDoEvento(ev);}')(
  { DB: { cfgDre: { regrasAuto: regras }, catfin: plano }, tipoCat: () => null, _quieto: () => {} }, ev);

t('com regra configurada, devolve a conta',
  rodar({ 'fechamento-caixa': 'sub_venda' }, 'fechamento-caixa') === 'sub_venda');
t('sem regra nenhuma, devolve vazio — e não inventa uma conta',
  rodar({}, 'fechamento-caixa') === '');
t('REGRA APONTANDO PARA CONTA QUE SUMIU NÃO VALE — senão o DRE some sem aviso',
  rodar({ 'fiado': 'sub_apagada' }, 'fiado') === '', rodar({ 'fiado': 'sub_apagada' }, 'fiado'));
t('e a regra de um evento não vaza para outro',
  rodar({ 'fiado': 'sub_venda' }, 'fechamento-caixa') === '');

/* quais faltam */
(function () {
  const f = (regras) => new Function('amb',
    'with(amb){' + fonte.slice(fonte.indexOf('var EVENTOS_AUTO=['), fonte.indexOf('function regrasAuto()')) +
    corpoDaFuncao('cfgDRE', fonte) + '\n' +
    corpoDaFuncao('categoriaValida', fonte) + '\n' +
    corpoDaFuncao('regrasAuto', fonte) + '\n' +
    corpoDaFuncao('categoriaDoEvento', fonte) + '\n' +
    corpoDaFuncao('eventosSemRegra', fonte) +
    '\n return eventosSemRegra();}')(
    { DB: { cfgDre: { regrasAuto: regras }, catfin: plano }, tipoCat: () => null, _quieto: () => {} });
  t('sem nada configurado, os oito faltam', f({}).length === 8, f({}).length);
  t('configurando um, faltam sete',
    f({ 'fiado': 'sub_venda' }).length === 7, f({ 'fiado': 'sub_venda' }).length);
})();

/* ==========================================================
   3. SEM REGRA, O LANÇAMENTO NASCE MESMO ASSIM — MARCADO
   ========================================================== */
console.log('\n── Sem regra o caixa não para: o lançamento nasce, marcado\n');

for (const [fn, ev] of [['lancarFechamento', 'fechamento-caixa'],
                        ['lancarTransferenciaCaixa', 'mov-caixa'],
                        ['gerarReceberPedido', 'pedbase-receber'],
                        ['receberPedidoBase', 'pedbase-pagar']]) {
  const c = semComentario(corpoDaFuncao(fn, fonte));
  t(fn + ' grava a conta da regra', new RegExp("categoriaId:\\s*categoriaDoEvento\\('" + ev + "'\\)").test(c));
  t(fn + ' marca a pendência quando não há regra',
    new RegExp("pendenciaRegra:\\s*!categoriaDoEvento\\('" + ev + "'\\)").test(c));
  t(fn + ' continua criando o lançamento de qualquer jeito', /DB\.lancFin|lancFin\.push|l\s*=\s*\{/.test(c));
}

t('e o texto antigo da categoria continua lá, como rótulo',
  /categoriaTxt:'Frente de Caixa'/.test(fonte) &&
  /categoriaTxt: 'Pedido de base'/.test(fonte));

/* ==========================================================
   4. A TELA DIZ O QUE FALTA
   ========================================================== */
console.log('\n── E a tela do Plano de Contas diz quantos faltam\n');

const bl = semComentario(corpoDaFuncao('blocoRegrasAuto', fonte));
t('o bloco entra na tela do Plano de Contas',
  /blocoRegrasAuto\(\)/.test(semComentario(corpoDaFuncao('telaCatFin', fonte))));
t('conta quantos estão sem regra', /eventosSemRegra\(\)\.length/.test(bl));
t('e avisa o que isso significa: não entra no DRE',
  /não entra no <b>DRE<\/b>|não entra no \\?<b\\?>DRE/.test(corpoDaFuncao('blocoRegrasAuto', fonte)) ||
  /não entra no/.test(corpoDaFuncao('blocoRegrasAuto', fonte)));
t('diz também que o lançamento continua sendo criado — o caixa não para',
  /o caixa não para/.test(corpoDaFuncao('blocoRegrasAuto', fonte)));
t('quando tudo está configurado, diz isso em vez de ficar mudo',
  /Todos os oito eventos têm conta definida/.test(corpoDaFuncao('blocoRegrasAuto', fonte)));
t('usa os componentes que já existem, sem inventar aparência',
  /class="imAviso"/.test(bl) && /class="grpTag semCat"/.test(bl) && /class="pTable"/.test(bl));
t('e o rodapé da tela também avisa',
  /evento\(s\) do sistema sem conta/.test(corpoDaFuncao('telaCatFin', fonte)));

const sr = semComentario(corpoDaFuncao('salvarRegraAuto', fonte));
t('gravar a regra guarda quem decidiu e quando', /por:\(quem&&quem\.nome\)/.test(sr) && /em:new Date\(\)/.test(sr));
t('escolher "sem regra" remove, em vez de gravar vazio', /delete r\[ev\]/.test(sr));
t('e a regra sobe para a nuvem', /if\(NUVEM\.ligada\)sincronizar\(\)/.test(sr));

/* a regra viaja em cfg_dre, que já sobe e desce — sem tabela nova */
t('as regras moram no cfgDre, que já sincroniza nos dois sentidos',
  /cfg_dre:DB\.cfgDre\|\|\{\}/.test(fonte) && /DB\.cfgDre=cfgS\[0\]\.cfg_dre/.test(fonte));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · o lançamento automático entra no DRE');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

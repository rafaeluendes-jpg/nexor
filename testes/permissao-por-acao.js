/* ==========================================================
   JOIA — PERMISSÃO POR AÇÃO (V382, RDS 20)

   As permissões do Joia são por TELA: 75 chaves `modulo/item`. Quem tem
   a tela de Contagem de Estoque podia **fechar a contagem**, que ajusta
   saldo e custo de todos os itens de uma vez. Quem tinha a tela de
   Conciliação podia **desconciliar** qualquer coisa. A RDS pede 18
   permissões por ação; existia uma — `controle/baixa-manual:lancar`.

   A regra que não pode quebrar a loja: **marcação ausente vale o
   comportamento de hoje**. Nenhuma ação passa a ser barrada por esta
   lista existir; elas só podem ser TIRADAS de alguém, de propósito.

   O contrário — nascer tudo barrado e ir liberando — é repetir o
   incidente de 29/08/2026: Santa Fé do Sul sem conseguir fechar o caixa
   porque uma alçada foi ligada antes de a lista de cargos estar certa.
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

const ACOES = new Function(
  fonte.slice(fonte.indexOf('var ACOES_CONTROLADAS=['), fonte.indexOf('function podeAcao(')) +
  '\n return ACOES_CONTROLADAS;')();

console.log('\n── As ações controladas\n');
t('são cinco — as que o sistema realmente tem como controlar',
  ACOES.length === 5, ACOES.length);
t('"alterar custo" ficou de fora, e o código diz por quê',
  !ACOES.some(a => /alterar-custo/.test(a.chave)) &&
  fonte.replace(/\s+/g, ' ').indexOf('uma permissao que nao permite nada') >= 0);
t('cada uma diz a tela onde mora', ACOES.every(a => /^[a-z-]+\/[a-z-]+$/.test(a.tela)));
t('e a chave segue o formato que já funciona (tela:acao)',
  ACOES.every(a => a.chave.indexOf(a.tela + ':') === 0), JSON.stringify(ACOES.map(a => a.chave)));
t('todas têm nome e explicação em português', ACOES.every(a => a.n && a.d));

console.log('\n── A regra: ausente vale o de hoje\n');
const pode = (u, chave) => new Function('amb', 'u', 'chave',
  'with(amb){' + corpoDaFuncao('podeAcao', fonte) + '\n return podeAcao(chave,u);}')(
  { usuarioLogado: () => u, ehPlataforma: () => false, ehFranqueadora: () => false }, u, chave);

const K = 'estoque/contagem-estoque:inventariar';
t('SEM MARCAÇÃO, pode — nada muda para quem já usava', pode({ id: 'u1' }, K) === true);
t('marcado true, pode', pode({ id: 'u1', permissoes: { [K]: true } }, K) === true);
t('MARCADO FALSE, NÃO PODE — é o que esta versão entrega',
  pode({ id: 'u1', permissoes: { [K]: false } }, K) === false);
t('marcação de outra ação não interfere',
  pode({ id: 'u1', permissoes: { 'pdv/pdv:cancelar-venda': false } }, K) === true);
t('dono e acesso total passam sempre',
  pode({ id: 'u1', mestre: true, permissoes: { [K]: false } }, K) === true &&
  pode({ id: 'u1', tudo: true, permissoes: { [K]: false } }, K) === true);
t('sem ninguém logado, não barra nada', pode(null, K) === true);

/* o barrador avisa, e não some em silêncio */
(function () {
  let dito = '';
  const f = (u) => new Function('amb', 'chave',
    'with(amb){' + corpoDaFuncao('podeAcao', fonte) + '\n' +
    corpoDaFuncao('nomeDaAcao', fonte) + '\n' +
    corpoDaFuncao('exigirAcao', fonte) + '\n return exigirAcao(chave);}')(
    { usuarioLogado: () => u, ehPlataforma: () => false, ehFranqueadora: () => false,
      ACOES_CONTROLADAS: ACOES, toast: m => { dito = m; } }, K);
  t('quem pode, segue', f({ id: 'u1' }) === true);
  dito = '';
  t('quem não pode, é barrado', f({ id: 'u1', permissoes: { [K]: false } }) === false);
  t('e ouve o motivo, com o nome da ação em português',
    /Fechar a contagem/.test(dito), dito);
})();

console.log('\n── E as seis ações são realmente conferidas\n');
const ONDE = [
  ['fecharContagem', 'estoque/contagem-estoque:inventariar'],
  ['salvarMovimento', 'controle/movimentacao-estoque:ajustar'],
  ['desconciliar', 'financeira/conciliacao-bancaria:desconciliar'],
  ['excluirNota', 'controle/notas-entrada:anular']
];
for (const [fn, chave] of ONDE) {
  const c = semComentario(corpoDaFuncao(fn, fonte));
  t(fn + ' confere a permissão', new RegExp("exigirAcao\\('" + chave + "'\\)").test(c));
  t(fn + ' confere ANTES de fazer qualquer coisa',
    c.indexOf('exigirAcao') < 120, c.indexOf('exigirAcao'));
}
t('cancelar venda respeita a permissão por ação',
  /podeAcao\('pdv\/pdv:cancelar-venda'\)/.test(semComentario(corpoDaFuncao('podeCancelarVenda', fonte))));
t('sem derrubar a senha do operador, que continua sendo exigida',
  /await autorizar\('cancelar'/.test(semComentario(corpoDaFuncao('confirmarCancelamento', fonte))));

/* chave que ninguém confere é decoração — o defeito da V191 */
for (const a of ACOES) {
  const usos = (fonte.match(new RegExp("['\"]" + a.chave.replace(/[-/]/g, '\\$&') + "['\"]", 'g')) || []).length;
  t('a chave "' + a.chave + '" é usada em mais de um lugar', usos >= 2, usos);
}

console.log('\n── E dá para tirar a ação de alguém, pela tela\n');
const tg = semComentario(corpoDaFuncao('togAcaoUsr', fonte));
t('a marcação é gravada como valor explícito', /u\.permissoes\[chave\]=!!\(el&&el\.checked\)/.test(tg));
t('e marca as permissões como não salvas, para não perder o clique',
  /marcarPermSujo\(\)/.test(tg));
t('o aviso diz o que foi liberado ou bloqueado', /nomeDaAcao\(chave\)/.test(tg));
t('as ações aparecem dentro da tela a que pertencem',
  /ACOES_CONTROLADAS\.filter\(function\(a\)\{return a\.tela===m\.id\+'\/'\+i\.id\}\)/
    .test(semComentario(corpoDaFuncao('abaPermUsr', fonte))));
t('já marcadas — desmarcar é que tira a ação da pessoa',
  /var on=podeAcao\(a\.chave,u\);/.test(semComentario(corpoDaFuncao('abaPermUsr', fonte))));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · permissão por ação');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

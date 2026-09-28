/* ==========================================================
   JOIA — VENDA CANCELADA NÃO VAI PARA O LANÇAMENTO FINANCEIRO
   (28/09/2026)

   Rodar:  node testes/cancelamento-sem-lancamento.js
   ou:     npm run test:cancsemlanc   (entra na bateria e no portão)

   Rafael: "todo estorno de pedido, o valor e o pedido, vai para
   lançamento financeiro. Não há necessidade, senão polui demais."

   Quem gravava era o BANCO: ao registrar um cancelamento, o gatilho
   `tg_cancelamento_estorna` (e a função `venda_cancelar`) inseria uma
   despesa "Estorno do pedido #N". Além de poluir, contava duas vezes:
   a venda cancelada já sai do faturamento e do fechamento de caixa.

   Este guardião prende, no que está no repositório:
     1. a versão MAIS NOVA das duas funções do banco não grava em
        lancamentos_financeiros — e continua devolvendo o estoque;
     2. nenhum código do sistema cria lançamento de origem
        'cancelamento' nem "Estorno do pedido".
   ========================================================== */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const MIG = path.join(RAIZ, 'supabase', 'migrations');

const R = { total: 0, ok: 0, falhou: 0 };
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* a última migration (por nome, que começa pela data) que redefine a função */
function ultimaDefinicao(nome) {
  const arqs = fs.readdirSync(MIG).filter(f => f.endsWith('.sql')).sort();
  let achou = null;
  for (const f of arqs) {
    const s = fs.readFileSync(path.join(MIG, f), 'utf8');
    const re = new RegExp('create or replace function public\\.' + nome + '\\([^]*?\\$function\\$;', 'i');
    const m = re.exec(s);
    if (m) achou = { arq: f, corpo: m[0] };
  }
  return achou;
}

console.log('\n── 1. O banco não grava a despesa de estorno');
for (const fn of ['tg_cancelamento_estorna', 'venda_cancelar']) {
  const d = ultimaDefinicao(fn);
  t(fn + ': a definição vigente está no repositório', !!d);
  if (!d) continue;
  t(fn + ': não insere em lancamentos_financeiros (' + d.arq + ')',
    !/insert\s+into\s+lancamentos_financeiros/i.test(d.corpo));
  t(fn + ': continua devolvendo o estoque (estoque_aplicar)', /estoque_aplicar\(/.test(d.corpo));
  t(fn + ': continua marcando a venda como cancelada', /fase\s*=\s*(coalesce\(|'cancelado')/i.test(d.corpo));
}
const limpa = fs.readdirSync(MIG).some(f =>
  /delete\s+from\s+public\.lancamentos_financeiros[^;]*origem\s*=\s*'cancelamento'/i
    .test(fs.readFileSync(path.join(MIG, f), 'utf8')));
t('as despesas de estorno antigas foram tiradas', limpa);

console.log('\n── 2. O sistema também não cria');
function varrer(dir, acc) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) varrer(p, acc);
    else if (f.endsWith('.js')) acc.push(p);
  }
  return acc;
}
const fontes = varrer(path.join(RAIZ, 'src', 'js'), []);
const culpados = fontes.filter(p => {
  const s = fs.readFileSync(p, 'utf8');
  return /origem\s*:\s*'cancelamento'/.test(s) || /Estorno do pedido/.test(s);
});
t('nenhum código cria lançamento de cancelamento', culpados.length === 0,
  culpados.map(p => path.relative(RAIZ, p)).join(', '));

console.log('\n' + '═'.repeat(52));
console.log('Joia · venda cancelada sem lançamento financeiro');
console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
process.exit(R.falhou ? 1 : 0);

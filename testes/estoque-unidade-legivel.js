/* ==========================================================
   JOIA — O ESTOQUE SE LÊ: ACIMA DE 1 kg EM kg, ABAIXO EM g

   03/09/2026. Regra do Rafael: "se tem 1 quilo, põe quilo; se tem 0,999,
   põe grama". Os relatórios de estoque saíam tudo numa unidade só — GELATO
   VENDA com dezenas de milhares de gramas, saldo em milhares de gramas —
   número que ninguém lê. Peso adapta entre g e kg; volume entre ml e L; o
   resto (un) sai como está.

   Rodar:  node testes/estoque-unidade-legivel.js
   ========================================================== */
const fs = require('fs');
const { ARQ } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* a MESMA regra, isolada com um convUnid/fmtQt de referência */
function fmtQt(v) { return String(v).replace('.', ','); }
function convUnid(q, de, para) {
  const F = { g: 0.001, kg: 1, mg: 0.000001, ml: 0.001, l: 1 };
  const b = { g: 'p', kg: 'p', mg: 'p', ml: 'v', l: 'v' };
  de = String(de).toLowerCase(); para = String(para).toLowerCase();
  if (!F[de] || !F[para] || b[de] !== b[para]) return null;
  return q * F[de] / F[para];
}
function qtdLegivel(v, u) {
  v = Number(v) || 0; u = String(u || '').toLowerCase();
  if (u === 'g' || u === 'kg' || u === 'mg') {
    let g = convUnid(v, u, 'g'); if (g === null) g = v;
    return Math.abs(g) >= 1000 ? { n: fmtQt(g / 1000), u: 'kg' } : { n: fmtQt(g), u: 'g' };
  }
  if (u === 'ml' || u === 'l') {
    let ml = convUnid(v, u, 'ml'); if (ml === null) ml = v;
    return Math.abs(ml) >= 1000 ? { n: fmtQt(ml / 1000), u: 'L' } : { n: fmtQt(ml), u: 'ml' };
  }
  return { n: fmtQt(v), u: u };
}

console.log('\n── Peso: acima de 1 kg mostra kg, abaixo mostra g\n');
{
  t('53,22 kg → "53,22 kg" (não 53.220 g)', JSON.stringify(qtdLegivel(53.22, 'kg')) === JSON.stringify({ n: '53,22', u: 'kg' }));
  t('0,22 kg → "220 g"', JSON.stringify(qtdLegivel(0.22, 'kg')) === JSON.stringify({ n: '220', u: 'g' }));
  t('0,999 kg → "999 g" (ainda grama)', JSON.stringify(qtdLegivel(0.999, 'kg')) === JSON.stringify({ n: '999', u: 'g' }));
  t('1 kg → "1 kg" (vira quilo)', JSON.stringify(qtdLegivel(1, 'kg')) === JSON.stringify({ n: '1', u: 'kg' }));
  t('1,738 kg → "1,738 kg"', JSON.stringify(qtdLegivel(1.738, 'kg')) === JSON.stringify({ n: '1,738', u: 'kg' }));
}

console.log('\n── Negativo também se lê em kg quando passa de 1\n');
{
  t('−6,05 kg → "−6,05 kg", não milhares de g', qtdLegivel(-6.05, 'kg').u === 'kg' && qtdLegivel(-6.05, 'kg').n === '-6,05');
}

console.log('\n── Linha em grama fica em grama; item em kg vira kg no saldo\n');
{
  t('uma saída de 220 g mostra "220 g"', JSON.stringify(qtdLegivel(220, 'g')) === JSON.stringify({ n: '220', u: 'g' }));
  t('saldo de 53220 g (item base g) vira "53,22 kg"', JSON.stringify(qtdLegivel(53220, 'g')) === JSON.stringify({ n: '53,22', u: 'kg' }));
}

console.log('\n── Volume e unidade\n');
{
  t('250 ml → "250 ml"', JSON.stringify(qtdLegivel(250, 'ml')) === JSON.stringify({ n: '250', u: 'ml' }));
  t('1,5 L → "1,5 L"', JSON.stringify(qtdLegivel(1.5, 'l')) === JSON.stringify({ n: '1,5', u: 'L' }));
  t('12 un → "12 un"', qtdLegivel(12, 'un').u === 'un' && qtdLegivel(12, 'un').n === '12');
}

console.log('\n── A função está no código e é usada nos relatórios\n');
{
  t('qtdLegivel existe e adapta peso',
    /function qtdLegivel\(v,u\)/.test(fonte) && /Math\.abs\(g\)>=1000\?\{n:fmtQt\(g\/1000\),u:'kg'\}/.test(fonte));
  t('a Movimentação de Mercadoria usa qtdLegivel no saldo do dia',
    /qtdLegivel\(saldoFim,g\.un\)/.test(fonte));
  t('e soma o dia na unidade-base (converte a linha)',
    /var qb=convUnid\(x\.qtd,x\.un,baseUn\)/.test(fonte));
  t('o rastreio do item usa qtdLegivelTxt no saldo',
    /qtdLegivelTxt\(saldos\[k3\],i\.unidade\)/.test(fonte));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

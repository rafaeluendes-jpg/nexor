/* ==========================================================
   JOIA — A BAIXA DA VENDA SAI NA UNIDADE DO ITEM (g não vira kg)

   31/08/2026. GELATO VENDA é guardado em QUILO, mas a ficha rende em
   GRAMA. Cada venda gerava uma linha `qtd:242, unidade:'g'`. O caminho
   local convertia (0,242 kg); o pacote atômico da nuvem
   (rpc/venda_registrar → estoque_aplicar) descontava 242 kg — mil vezes a
   mais. Os dois lados brigavam pelo saldo e o download adotava o errado.
   Medido: saldo em −779 kg onde o certo eram ~73 kg.

   Correção na porta única da venda: cada linha é normalizada para a
   unidade-base do próprio item antes de virar movimento. O que o aparelho
   guarda, o que sobe e o delta que o banco aplica passam a ser a mesma
   quantidade, na mesma unidade.

   Rodar:  node testes/baixa-venda-converte-unidade.js
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

/* a MESMA regra de normalização, isolada. `itens` diz a unidade-base de
   cada insumo; convUnid é o conversor real (g↔kg pela base comum). */
const BASE = { 'ins_gelato': 'kg', 'ins_leite': 'L' };
function convUnid(qtd, de, para) {
  const F = { g: 0.001, kg: 1, mg: 0.000001, ml: 0.001, l: 1 };
  const base = { g: 'peso', kg: 'peso', mg: 'peso', ml: 'vol', l: 'vol' };
  const a = String(de).toLowerCase(), b = String(para).toLowerCase();
  if (!F[a] || !F[b] || base[a] !== base[b]) return null;
  return qtd * F[a] / F[b];
}
function normalizar(linha) {
  const insUn = BASE[linha.insumoId];
  if (!insUn || !linha.unidade || linha.unidade === insUn) return linha;
  const q = convUnid(Number(linha.qtd) || 0, linha.unidade, insUn);
  if (q === null) return linha;
  return Object.assign({}, linha, { qtd: +q.toFixed(4), unidade: insUn });
}

console.log('\n── Grama vira quilo antes de descontar do estoque\n');
{
  const r = normalizar({ insumoId: 'ins_gelato', qtd: 242, unidade: 'g' });
  t('242 g viram 0,242 kg', r.qtd === 0.242 && r.unidade === 'kg', r.qtd + ' ' + r.unidade);
  const r2 = normalizar({ insumoId: 'ins_gelato', qtd: 500, unidade: 'g' });
  t('500 g viram 0,5 kg (não 500 kg)', r2.qtd === 0.5 && r2.unidade === 'kg', r2.qtd + ' ' + r2.unidade);
}

console.log('\n── Linha que já está na unidade-base passa intacta\n');
{
  const r = normalizar({ insumoId: 'ins_gelato', qtd: 3.2, unidade: 'kg' });
  t('3,2 kg continuam 3,2 kg', r.qtd === 3.2 && r.unidade === 'kg');
}

console.log('\n── Sem base comum, não arrisca: mantém como está\n');
{
  const r = normalizar({ insumoId: 'ins_gelato', qtd: 5, unidade: 'un' });
  t('un contra kg fica como está (não converte errado)', r.qtd === 5 && r.unidade === 'un');
}

console.log('\n── Mililitro vira litro para item guardado em litro\n');
{
  const r = normalizar({ insumoId: 'ins_leite', qtd: 250, unidade: 'ml' });
  t('250 ml viram 0,25 L', r.qtd === 0.25 && r.unidade === 'L', r.qtd + ' ' + r.unidade);
}

console.log('\n── A trava está no código (baixarEstoqueVenda)\n');
{
  t('normaliza cada linha para a unidade-base do item',
    /var q=convUnid\(Number\(l\.qtd\)\|\|0,l\.unidade,ins\.unidade\)/.test(fonte));
  t('unidade incompatível é mantida (não converte errado)',
    /if\(q===null\)return l;\s*\/\* sem base comum/.test(fonte));
  t('a linha normalizada assume a unidade do item',
    /qtd:\+q\.toFixed\(4\),unidade:ins\.unidade/.test(fonte));
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

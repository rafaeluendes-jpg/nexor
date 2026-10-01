/* ==========================================================
   "LINHAS REPETIDAS" SO QUANDO E A MESMA LINHA (01/10/2026)

   O caixa da matriz mostrava "Encontrei linhas repetidas em 377
   registro(s)". Era alarme falso: dois Cascao 1 Bola na mesma venda sao
   duas linhas com ids diferentes — e na nuvem 373 dessas 388 vendas
   fecham o total no centavo. O defeito da V115 repetia a MESMA linha.

   Prende: repetida e o mesmo id; dois itens iguais com ids diferentes
   nao contam; e o achado vai para o registro da nuvem, nunca para a
   tela.

   Rodar:  node testes/repetida-e-mesma-linha.js
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
console.log('\n── Sistema ' + versaoDoSistema() + ' — linha repetida é a mesma linha\n');
const corpo = corpoDaFuncao('conferirFilhosRepetidos', fonte);
t('não fala com a tela do caixa', !/toast\(/.test(corpo.replace(/\/\*[\s\S]*?\*\//g, '')));
const logs = [];
const mk = new Function('DB', 'logNuvem', '_quieto', corpo + '\nreturn conferirFilhosRepetidos;');
const it = (id) => ({ id, nome: 'Cascão 1 Bola', qtd: 1, unit: 19 });
const DB = { pedidos: [{ numero: 1, itens: [it('a'), it('b')] }], fichas: [], caixas: [] };
t('dois itens iguais, cada um com o seu id, não são repetição', mk(DB, (m) => logs.push(m), () => {})() === 0);
DB.pedidos.push({ numero: 2, itens: [it('c'), it('c')] });
t('a mesma linha duas vezes é repetição', mk(DB, (m) => logs.push(m), () => {})() === 1 && /venda 2/.test(logs.join()));
DB.pedidos = [{ numero: 3, itens: [{ nome: 'X', qtd: 1, unit: 2 }, { nome: 'X', qtd: 1, unit: 2 }] }];
t('linha sem id continua na comparação antiga', mk(DB, (m) => logs.push(m), () => {})() === 1);
console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

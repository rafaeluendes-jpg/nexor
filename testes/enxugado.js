/* ==========================================================
   O ARQUIVO PUBLICADO NAO PODE LEVAR O MANUAL JUNTO

   Ate a V238, o `index.html` que a loja baixava era o codigo-fonte
   inteiro em texto limpo: funcao em portugues, campo em portugues, e
   2.373 blocos de comentario explicando a regra de negocio, o nome das
   tabelas do banco e cada defeito ja corrigido com o porque da
   solucao. 495 KB, 20% do arquivo. Qualquer pessoa apertava Ctrl+U em
   joiagest.com.br e levava o sistema pronto para copiar.

   Ninguem entra nos DADOS por ai — quem tranca o dado e a RLS. O que se
   levava era o produto.

   Agora a publicacao passa pelo `ferramentas/enxugar.js`. Estes testes
   prendem as tres coisas que nao podem sair errado:

     1. o comentario tem de sumir de verdade — e o motivo de existir;
     2. NENHUMA funcao pode se perder no caminho;
     3. a VERSAO tem de continuar legivel no arquivo publicado, senao a
        loja nunca mais sabe que ha atualizacao (o defeito da V195).

   Rodar:  node testes/enxugado.js
   ========================================================== */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const ORIG = path.join(RAIZ, 'index.html');
const SAIDA = path.join(require('os').tmpdir(), 'joia-enxuto-' + process.pid + '.html');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

console.log('\n── O enxugador roda e não perde nada\n');

let saiu = '';
try {
  saiu = execFileSync('node', [path.join(RAIZ, 'ferramentas', 'enxugar.js'), ORIG, SAIDA],
    { encoding: 'utf8' });
} catch (e) {
  console.log('   FALHOU  o enxugador não rodou  → ' + (e.stderr || e.message));
  process.exit(1);
}
t('o enxugador roda sem erro', /todas presentes/.test(saiu), saiu.trim());

const orig = fs.readFileSync(ORIG, 'utf8');
const enx = fs.readFileSync(SAIDA, 'utf8');

const nomes = txt => new Set((txt.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/g) || [])
  .map(x => x.replace(/function\s+/, '').replace(/\s*\($/, '')));
const antes = nomes(orig), depois = nomes(enx);
const sumiram = [...antes].filter(n => !depois.has(n));
t('as ' + antes.size + ' funções continuam todas lá',
  sumiram.length === 0, sumiram.slice(0, 6).join(', '));

console.log('\n── E o manual sai\n');

/* contar `/* */` por texto no arquivo inteiro da falso positivo: existe
   um `/*"` dentro de uma string de HTML no codigo. O que nao pode
   sobrar e o cabecalho de comentario, que e inconfundivel. */
const banner = txt => txt.split('==========================================================').length - 1;
t('nenhum bloco de comentário sobra no arquivo publicado',
  banner(enx) === 0, banner(orig) + ' → ' + banner(enx));
t('nenhum comentário de HTML sobra', !/<!--/.test(enx));
t('o arquivo encolhe pelo menos 20%',
  enx.length < orig.length * 0.8,
  Math.round(100 - enx.length * 100 / orig.length) + '% menor');
/* uma frase que só existe nos comentários: se ela sobreviver, sobrou manual */
t('as explicações de defeito não vão mais para a loja',
  !/derrubou a loja|nao pode acontecer de novo|foi o que a loja/i.test(enx));

console.log('\n── E a loja continua sabendo que existe versão nova\n');

t('a VERSAO continua legível no arquivo publicado',
  /VERSAO\s*=\s*['"]V[0-9.]+['"]/.test(enx));
const mo = orig.match(/VERSAO\s*=\s*['"](V[0-9.]+)['"]/);
const me = enx.match(/VERSAO\s*=\s*['"](V[0-9.]+)['"]/);
t('e é exatamente a mesma do repositório', mo && me && mo[1] === me[1],
  (mo && mo[1]) + ' vs ' + (me && me[1]));
t('a checagem de atualização aceita os dois tipos de aspas',
  /VERSAO\\s\*=\\s\*\['"\]/.test(orig),
  'a expressão em 06-interface.js precisa ser tolerante');

console.log('\n── E o sistema continua montável\n');

t('o bloco de script continua fechado', (enx.match(/<\/script>/g) || []).length ===
  (orig.match(/<\/script>/g) || []).length);
t('o service worker e o manifesto continuam referenciados',
  /sw\.js/.test(enx) && /manifest\.json/.test(enx));

try { fs.unlinkSync(SAIDA); } catch (e) {}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

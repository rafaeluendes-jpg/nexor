/* ==========================================================
   MONTAGEM — cortar e emendar tem que devolver o mesmo arquivo

   Esta e a rede de seguranca da modularizacao inteira.

   Ela nao le src/ do disco: corta o index.html de HOJE em memoria,
   emenda de volta e compara byte a byte. Entao ela continua valendo
   depois da V201, da V210 e de qualquer correcao que voce publicar —
   nao ha nada para manter em dia.

   Se passar, e impossivel o recorte ter perdido uma linha. Uma funcao
   a menos muda o hash, e o teste reprova.
   ========================================================== */
const fs = require('fs');
const crypto = require('crypto');
const { dividir, ARQ } = require('../ferramentas/dividir.js');
const { montar } = require('../ferramentas/montar.js');

const hash = t => crypto.createHash('sha256').update(t).digest('hex');

const original = fs.readFileSync(ARQ, 'utf8');
const { ordem, conteudo } = dividir(original);
const refeito = montar(ordem, caminho => {
  if (!(caminho in conteudo)) throw new Error('parte ausente: ' + caminho);
  return conteudo[caminho];
});

const hOriginal = hash(original);
const hRefeito = hash(refeito);
const partes = Object.keys(conteudo).length;

if (hOriginal === hRefeito) {
  console.log('montagem: ' + partes + ' partes, ' + original.length.toLocaleString('pt-BR') + ' bytes');
  console.log('montagem: identico byte a byte  sha256 ' + hOriginal.slice(0, 16));
  process.exit(0);
}

/* falhou: aponta a primeira divergencia em vez de so dizer "diferente" */
const a = original.split('\n'), b = refeito.split('\n');
let i = 0;
while (i < a.length && i < b.length && a[i] === b[i]) i++;
console.error('montagem: REPROVADO — o arquivo remontado nao e o original');
console.error('  linhas: original ' + a.length + ', remontado ' + b.length);
console.error('  primeira diferenca na linha ' + (i + 1));
console.error('    original : ' + JSON.stringify((a[i] || '').slice(0, 120)));
console.error('    remontado: ' + JSON.stringify((b[i] || '').slice(0, 120)));
process.exit(1);

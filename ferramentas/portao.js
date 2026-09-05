/* ==========================================================
   JOIA — PORTÃO DE PUBLICAÇÃO

   Protocolo do Rafael, item 12: antes de publicar, tudo tem de passar.
   Se qualquer verificação crítica falhar, NÃO PUBLICA — corrige antes.

   Este arquivo é o único lugar que diz "pode publicar". Ele roda a
   bateria inteira, na ordem, e para na primeira reprovação — porque
   publicar é abrir a loja com o sistema novo, na hora.

     node ferramentas/portao.js

   Sai com 0 só quando TUDO passou. Qualquer outro código de saída
   significa: não publique.
   ========================================================== */
const { execFileSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');
const t0 = Date.now();

const ETAPAS = [
  { n: 'Montagem — o index.html é o espelho do src/',
    cmd: 'npm', args: ['run', 'montar'], mudo: true },
  { n: 'Vistoria — o código chama só o que existe (nada novo aponta pro vazio)',
    cmd: 'node', args: ['ferramentas/vistoriar.js'] },
  { n: 'Estrutura e versão — VERSAO e VERSAO_SW sobem juntas',
    cmd: 'node', args: ['testes/montagem.js'] },
  { n: 'Bateria de testes — as suítes todas',
    cmd: 'npm', args: ['test'] },
  { n: 'Configurações — nenhuma rotina apaga o que a loja configurou',
    cmd: 'node', args: ['ferramentas/auditar-configuracoes.js'] },
  { n: 'Nuvem — o que o código manda é o que o banco aceita',
    cmd: 'node', args: ['ferramentas/conferir-nuvem.js'] },
  { n: 'Varredura — as 94 telas montam e todo botão tem função',
    cmd: 'node', args: ['ferramentas/varrer.js'] },
  { n: 'Auditoria visual — computador e celular, no Chromium',
    cmd: 'node', args: ['ferramentas/auditar.js'] },
  { n: 'Provas — os fluxos da loja, no Chromium',
    cmd: 'node', args: ['ferramentas/provar.js'] },
  { n: 'Persistência — a configuração sobrevive a tudo',
    cmd: 'node', args: ['ferramentas/persistir.js'] }
];

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  JOIA · PORTÃO DE PUBLICAÇÃO                     ║');
console.log('╚══════════════════════════════════════════════════╝\n');

const saidas = [];
let reprovou = null;
for (const e of ETAPAS) {
  process.stdout.write('  ▸ ' + e.n + ' ... ');
  const t1 = Date.now();
  try {
    const out = execFileSync(e.cmd, e.args, { cwd: RAIZ, encoding: 'utf8', stdio: 'pipe',
      maxBuffer: 64 * 1024 * 1024 });
    saidas.push({ n: e.n, out: out });
    console.log('passou  (' + Math.round((Date.now() - t1) / 1000) + 's)');
  } catch (err) {
    console.log('REPROVOU  (' + Math.round((Date.now() - t1) / 1000) + 's)');
    reprovou = { etapa: e.n, saida: String(err.stdout || '') + String(err.stderr || '') };
    break;
  }
}

/* o git também é parte do portão: o index.html publicado tem de ser o
   gerado a partir do src/, e não uma edição à mão */
let sujoAMao = '';
try {
  const st = execSync('git status --porcelain', { cwd: RAIZ, encoding: 'utf8' });
  if (/^\s*M\s+index\.html$/m.test(st) && !/^\s*[AM]\s+src\//m.test(st))
    sujoAMao = 'o index.html mudou sem o src/ ter mudado — ele é gerado, nunca editado à mão';
} catch (e) {}

console.log('\n' + '─'.repeat(52));
if (reprovou) {
  console.log('\n✗ NÃO PUBLICAR.\n');
  console.log('  Reprovou em: ' + reprovou.etapa + '\n');
  const linhas = reprovou.saida.split('\n').filter(l => /FALHOU|✗|Error|erro/i.test(l));
  (linhas.length ? linhas : reprovou.saida.split('\n').slice(-25))
    .slice(0, 30).forEach(l => console.log('    ' + l.trim()));
  console.log('\n  Corrija e rode o portão de novo.\n');
  process.exit(1);
}
if (sujoAMao) {
  console.log('\n✗ NÃO PUBLICAR.\n\n  ' + sujoAMao + '\n');
  process.exit(1);
}
const versao = (function () {
  const m = /var VERSAO='([^']+)'/.exec(fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8'));
  return m ? m[1] : '?';
})();
console.log('\n✓ PODE PUBLICAR — ' + ETAPAS.length + ' etapas, todas passaram.');
console.log('  Versão: ' + versao + '   ·   ' + Math.round((Date.now() - t0) / 1000) + 's\n');
console.log('  Publicar continua sendo decisão do Rafael (regra 1 do CLAUDE.md).\n');
process.exit(0);

/* ==========================================================
   JOIA — AS REGRAS DO PEDIDO VALEM SOZINHAS (06/10/2026)

   Rodar:  node testes/regras-do-pedido.js
   ou:     npm run test:regraspedido   (entra na bateria e no portão)

   Rafael: "As regras do pedido passam a valer sozinhas em todo pedido
   meu, em toda conversa, sem eu colar nada."

   Elas moram no CLAUDE.md (seção "## Regras do pedido") e o gancho
   `UserPromptSubmit` do Claude Code (`.claude/regras-do-pedido.js`,
   ligado em `.claude/settings.json`) as junta a cada mensagem dele.

   Este guardião prende:
     1. o gancho está ligado no settings.json, no evento certo;
     2. o gancho roda e devolve as quatro regras, lidas do CLAUDE.md;
     3. a seção do CLAUDE.md tem as quatro regras;
     4. sem a seção, o gancho avisa em vez de ficar calado.
   ========================================================== */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
function rodar(dir) {
  return execFileSync('node', [path.join(dir, '.claude', 'regras-do-pedido.js')], {
    input: JSON.stringify({ prompt: 'teste', hook_event_name: 'UserPromptSubmit' }),
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: dir }), encoding: 'utf8' });
}

grupo('1. O gancho está ligado');
let cfg = null;
try { cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, '.claude', 'settings.json'), 'utf8')); } catch (e) { /* vira falha abaixo */ }
const ganchos = (((cfg || {}).hooks || {}).UserPromptSubmit || [])
  .flatMap(g => (g && g.hooks) || []);
t('.claude/settings.json existe e é JSON válido', !!cfg);
t('UserPromptSubmit chama .claude/regras-do-pedido.js',
  ganchos.some(h => h.type === 'command' && /\.claude\/regras-do-pedido\.js/.test(h.command || '')),
  JSON.stringify(ganchos));

grupo('2. O gancho devolve as regras do CLAUDE.md');
let saida = '';
try { saida = rodar(RAIZ); } catch (e) { saida = 'ERRO: ' + e.message; }
t('roda sem erro e começa pelo título', /^REGRAS DO PEDIDO/.test(saida), saida.slice(0, 80));
t('regra 1 — responder em uma ou duas linhas o que entendeu', /uma ou duas linhas o que entendeu/.test(saida));
t('regra 2 — mexer só no que foi pedido (e a lista do que não se toca)',
  /Mexa só no que ele pediu/.test(saida) && /ficha técnica/.test(saida) && /caixas\s+fechados/.test(saida));
t('regra 3 — nenhum dado das lojas muda com versão nova, provado',
  /Nenhum dado das lojas muda com uma versão nova/.test(saida) && /antes e depois/.test(saida));
t('regra 4 — portão verde, publica sozinho, três linhas',
  /Portão verde, e publique sozinho/.test(saida) && /três linhas/.test(saida));

grupo('3. A seção mora no CLAUDE.md — fonte única');
const md = fs.readFileSync(path.join(RAIZ, 'CLAUDE.md'), 'utf8');
t('CLAUDE.md tem "## Regras do pedido"', /\n## Regras do pedido\n/.test(md));
t('o gancho não carrega cópia própria das regras (lê do CLAUDE.md)',
  !/Mexa só no que ele pediu/.test(fs.readFileSync(path.join(RAIZ, '.claude', 'regras-do-pedido.js'), 'utf8')));

grupo('4. Sem a seção, o gancho avisa');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'regras-'));
fs.mkdirSync(path.join(tmp, '.claude'));
fs.copyFileSync(path.join(RAIZ, '.claude', 'regras-do-pedido.js'), path.join(tmp, '.claude', 'regras-do-pedido.js'));
fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), '# Joia\n\n## Outra coisa\n');
let semSecao = '';
try { semSecao = rodar(tmp); } catch (e) { semSecao = 'ERRO: ' + e.message; }
t('avisa que a seção sumiu e repete as quatro regras', /sumiu do CLAUDE\.md/.test(semSecao) && /portão verde/.test(semSecao), semSecao.slice(0, 120));
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\n' + '═'.repeat(52));
console.log('Joia · regras do pedido');
console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
process.exit(R.falhou ? 1 : 0);

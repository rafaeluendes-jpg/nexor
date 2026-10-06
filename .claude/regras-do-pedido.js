#!/usr/bin/env node
/* ==========================================================
   JOIA — AS REGRAS DO PEDIDO ENTRAM SOZINHAS EM TODA MENSAGEM

   Ordem do Rafael (06/10/2026): as regras do pedido valem em todo pedido
   dele, em toda conversa, sem ele colar nada.

   Este é o gancho `UserPromptSubmit` do Claude Code (ligado em
   `.claude/settings.json`). A cada mensagem do Rafael, ele lê a seção
   "## Regras do pedido" do CLAUDE.md e a devolve; o Claude Code junta o
   texto à mensagem. Uma fonte só: quem muda a regra muda o CLAUDE.md, e o
   gancho passa a dizer a nova.

   Se a seção sumir do CLAUDE.md, o gancho NÃO fica calado: avisa que ela
   sumiu (e `testes/regras-do-pedido.js` reprova a publicação).
   ========================================================== */
const fs = require('fs');
const path = require('path');

const RAIZ = process.env.CLAUDE_PROJECT_DIR || path.join(__dirname, '..');

function regras() {
  let md;
  try { md = fs.readFileSync(path.join(RAIZ, 'CLAUDE.md'), 'utf8'); }
  catch (e) { return null; }
  const i = md.indexOf('\n## Regras do pedido');
  if (i < 0) return null;
  const resto = md.slice(i + 1);
  const fim = resto.indexOf('\n## ', 3);
  return (fim < 0 ? resto : resto.slice(0, fim)).trim();
}

/* o Claude Code manda a mensagem em JSON pela entrada; ela não é usada,
   mas é lida até o fim para o processo não fechar a entrada no meio */
try { fs.readFileSync(0); } catch (e) { /* sem entrada: rodado à mão */ }

const r = regras();
if (!r) {
  process.stdout.write('ATENÇÃO: a seção "## Regras do pedido" sumiu do CLAUDE.md do Joia. ' +
    'Ela vale mesmo assim: 1) responda em uma ou duas linhas o que entendeu e siga; ' +
    '2) mexa só no que foi pedido; 3) nenhum dado das lojas muda com versão nova — prove; ' +
    '4) portão verde e publique sozinho, três linhas no fim. Devolva a seção ao CLAUDE.md.\n');
  process.exit(0);
}
process.stdout.write('REGRAS DO PEDIDO (CLAUDE.md do Joia — valem para esta mensagem do Rafael):\n\n' +
  r + '\n');
process.exit(0);

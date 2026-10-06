/* ==========================================================
   JOIA — TESTE VERMELHO NÃO PUBLICA (06/10/2026)

   Rodar:  node testes/publicacao-espera-a-bateria.js
   ou:     npm run test:publicaespera   (entra na bateria e no portão)

   Rafael: "Hoje teste vermelho no GitHub não impede a publicação: o
   pages.yml não depende do testes.yml."

   Em 06/10/2026 a bateria estava vermelha na main e a loja recebia a
   versão do mesmo jeito. Agora o `pages.yml` tem um trabalho `bateria`
   e o `publicar` só começa depois dele (`needs: bateria`).

   Este guardião prende:
     1. o pages.yml tem o trabalho da bateria e o de publicar;
     2. publicar ESPERA a bateria (needs) — sem atalho;
     3. a bateria roda as quatro conferências: npm test, vistoria, trava
        dos guardiões e conferir-nuvem;
     4. nenhum passo da bateria é dispensado com continue-on-error, e o
        publicar não tem `if:` que o deixe rodar com a bateria vermelha.
   ========================================================== */
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', '.github', 'workflows', 'pages.yml');
const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* leitor mínimo do YAML do GitHub: só o que importa aqui — os trabalhos,
   o `needs`, o `if` e os comandos `run` de cada um */
function trabalhos(txt) {
  const linhas = txt.split('\n'), out = {};
  let dentro = false, atual = null;
  for (const l of linhas) {
    if (/^jobs:\s*$/.test(l)) { dentro = true; continue; }
    if (!dentro) continue;
    if (/^\S/.test(l)) { dentro = false; continue; }
    const j = /^  ([A-Za-z0-9_-]+):\s*$/.exec(l);
    if (j) { atual = out[j[1]] = { needs: [], runs: [], se: null, ignora: false, texto: '' }; continue; }
    if (!atual) continue;
    atual.texto += l + '\n';
    const nd = /^    needs:\s*(.+)$/.exec(l);
    if (nd) atual.needs = nd[1].replace(/[\[\]\s]/g, '').split(',').filter(Boolean);
    const se = /^    if:\s*(.+)$/.exec(l);
    if (se) atual.se = se[1].trim();
    const rn = /^\s+(?:- )?run:\s*(.+)$/.exec(l);
    if (rn) atual.runs.push(rn[1].trim());
    if (/continue-on-error:\s*true/.test(l)) atual.ignora = true;
  }
  return out;
}

const txt = fs.readFileSync(ARQ, 'utf8');
const J = trabalhos(txt);

grupo('1. O pages.yml tem a bateria e o publicar');
t('existe o trabalho `bateria`', !!J.bateria, Object.keys(J).join(', '));
t('existe o trabalho `publicar`', !!J.publicar, Object.keys(J).join(', '));

grupo('2. Publicar espera a bateria');
t('publicar tem `needs: bateria`', !!(J.publicar && J.publicar.needs.includes('bateria')),
  J.publicar && J.publicar.needs.join(','));
t('publicar não tem `if:` que o solte com a bateria vermelha',
  !!(J.publicar && (J.publicar.se === null || !/always\(\)|failure\(\)|cancelled\(\)/.test(J.publicar.se))),
  J.publicar && J.publicar.se);
t('só um trabalho publica (deploy-pages) — e é o que espera',
  (txt.match(/actions\/deploy-pages/g) || []).length === 1 &&
  !!(J.publicar && /actions\/deploy-pages/.test(J.publicar.texto)));

grupo('3. A bateria roda as quatro conferências');
const runs = (J.bateria && J.bateria.runs) || [];
t('npm test', runs.some(r => /^npm test\b/.test(r)), runs.join(' | '));
t('vistoria (ferramentas/vistoriar.js)', runs.some(r => /ferramentas\/vistoriar\.js/.test(r)));
t('trava dos guardiões (ferramentas/travar.js)', runs.some(r => /ferramentas\/travar\.js(\s|$)/.test(r) && !/--gravar|--liberar/.test(r)));
t('conferir-nuvem (ferramentas/conferir-nuvem.js)', runs.some(r => /ferramentas\/conferir-nuvem\.js/.test(r)));
t('instala as ferramentas da bateria (npm ci)', runs.some(r => /^npm ci\b/.test(r)));

/* 06/10/2026: com node-version '20' o jsdom da bateria nem carrega
   (webidl.util.markAsUncloneable), e a trava bloquearia TODA publicação.
   A versão mínima sai do package-lock — o que o npm ci vai instalar. */
const nv = /node-version:\s*'?(\d+)/.exec((J.bateria && J.bateria.texto) || '');
let minimo = 0;
try {
  const lock = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
  Object.keys(lock.packages || {}).forEach(k => {
    const e = ((lock.packages[k] || {}).engines || {}).node;
    if (!/node_modules\/(jsdom|undici)$/.test(k) || !e) return;
    const m = /(\d+)/.exec(e); if (m && +m[1] > minimo) minimo = +m[1];
  });
} catch (e) { /* sem lock: vira falha abaixo */ }
t('o Node da bateria atende ao que o jsdom/undici exigem (Node ' + minimo + '+)',
  !!nv && minimo > 0 && +nv[1] >= minimo, (nv ? nv[1] : 'sem node-version') + ' × ' + minimo);

grupo('4. Nada é dispensado');
t('nenhum passo da bateria com continue-on-error', !!(J.bateria && !J.bateria.ignora));
t('nenhum `|| true` escondendo reprovação na bateria', !runs.some(r => /\|\|\s*true/.test(r)));

console.log('\n' + '═'.repeat(52));
console.log('Joia · teste vermelho não publica');
console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
process.exit(R.falhou ? 1 : 0);

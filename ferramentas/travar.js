/* ==========================================================
   JOIA — TRAVA DAS CORREÇÕES

   Ordem do Rafael (24/09/2026): "Uma vez uma correção feita, isso fica
   travado. Quando fizer outra correção, não pode quebrar aquele módulo.
   Não pode ter a opção daquilo ser quebrado novamente."

   Cada correção entra com um teste-guardião que a reproduz. O que impede
   a correção de voltar a quebrar é esse guardião CONTINUAR existindo,
   CONTINUAR rodando e CONTINUAR conferindo tudo o que conferia. Este
   arquivo tranca as três coisas, como catraca — só anda para frente:

     1. nenhum guardião registrado some do repositório;
     2. nenhum sai da bateria (`npm test`) nem do portão;
     3. nenhum passa a conferir MENOS pontos do que conferia;
     4. nenhuma etapa do portão é retirada;
     5. guardião novo precisa ser registrado aqui (senão ele não está
        trancado — e o portão avisa).

   A referência fica em `ferramentas/travas.json`.

     node ferramentas/travar.js            confere (entra no portão)
     node ferramentas/travar.js --gravar   registra guardiões novos e
                                           pontos novos (só para cima)

   Diminuir de propósito (o Rafael mandou tirar uma funcionalidade) exige
   dizer o porquê, e fica anotado para sempre no próprio travas.json:

     node ferramentas/travar.js --gravar --liberar testes/x.js --motivo "…"
   ========================================================== */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ARQ = path.join(__dirname, 'travas.json');
const args = process.argv.slice(2);
const GRAVAR = args.includes('--gravar');
const iLib = args.indexOf('--liberar');
const LIBERAR = iLib >= 0 ? args[iLib + 1] : null;
const iMot = args.indexOf('--motivo');
const MOTIVO = iMot >= 0 ? args[iMot + 1] : null;

/* pontos conferidos por um guardião: cada chamada de conferência que
   começa com um texto — t('…'), ok('…'), teste('…'), assert('…')… */
const CONFERE = /(^|[^A-Za-z0-9_.$])(t|ok|teste|check|checar|assert|conferir|prova|caso|it)\s*\(\s*['"`]/g;
function pontos(arquivo) {
  const s = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
  return (s.match(CONFERE) || []).length;
}

/* os guardiões que o `npm test` roda, seguindo os apelidos do package.json */
function naBateria() {
  const sc = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts || {};
  const achados = new Set(), vistos = new Set();
  (function segue(nome) {
    if (vistos.has(nome) || !sc[nome]) return;
    vistos.add(nome);
    const cmd = sc[nome];
    (cmd.match(/testes\/[\w.-]+\.js/g) || []).forEach(f => achados.add(f));
    (cmd.match(/npm run ([\w:.-]+)/g) || []).forEach(m => segue(m.replace('npm run ', '')));
  })('test');
  return achados;
}
function doPortao() {
  const s = fs.readFileSync(path.join(__dirname, 'portao.js'), 'utf8');
  const etapas = (s.match(/\{\s*n:\s*'([^']+)'/g) || []).map(x => x.replace(/^\{\s*n:\s*'/, '').replace(/'$/, ''));
  const testes = new Set(s.match(/testes\/[\w.-]+\.js/g) || []);
  return { etapas, testes };
}

const hoje = {};
const bat = naBateria(), por = doPortao();
fs.readdirSync(path.join(RAIZ, 'testes')).filter(f => /\.js$/.test(f)).sort().forEach(f => {
  const rel = 'testes/' + f;
  hoje[rel] = { pontos: pontos(rel), roda: bat.has(rel) || por.testes.has(rel) };
});

let ref = { guardioes: {}, etapasDoPortao: [], liberacoes: [] };
if (fs.existsSync(ARQ)) ref = Object.assign(ref, JSON.parse(fs.readFileSync(ARQ, 'utf8')));

const problemas = [], novos = [];
Object.keys(ref.guardioes).forEach(f => {
  const antes = ref.guardioes[f], agora = hoje[f];
  if (LIBERAR === f) return;
  if (!agora) { problemas.push(f + ' — o guardião foi APAGADO'); return; }
  if (antes.roda && !agora.roda) problemas.push(f + ' — saiu da bateria (não roda mais no npm test nem no portão)');
  if (agora.pontos < antes.pontos)
    problemas.push(f + ' — conferia ' + antes.pontos + ' pontos, agora confere ' + agora.pontos);
});
ref.etapasDoPortao.forEach(e => {
  if (!por.etapas.includes(e)) problemas.push('portão — a etapa "' + e + '" foi retirada');
});
Object.keys(hoje).forEach(f => { if (!ref.guardioes[f]) novos.push(f); });
Object.keys(hoje).forEach(f => {
  if (!hoje[f].roda && hoje[f].pontos > 0 && !ref.guardioes[f])
    problemas.push(f + ' — guardião fora da bateria: ligue-o no "test" do package.json');
});

if (GRAVAR) {
  if (LIBERAR && !MOTIVO) {
    console.error('\n  Para liberar um guardião, diga o porquê: --motivo "…"\n');
    process.exit(1);
  }
  if (problemas.length && !LIBERAR) {
    console.error('\n  ✗ Não gravo por cima de uma trava quebrada:\n');
    problemas.forEach(p => console.error('     · ' + p));
    console.error('\n  Conserte, ou libere de propósito com --liberar <arquivo> --motivo "…"\n');
    process.exit(1);
  }
  const g = {};
  Object.keys(hoje).forEach(f => {
    const a = ref.guardioes[f];
    g[f] = (a && f !== LIBERAR)
      ? { pontos: Math.max(a.pontos, hoje[f].pontos), roda: a.roda || hoje[f].roda }
      : hoje[f];
  });
  if (LIBERAR) ref.liberacoes.push({ arquivo: LIBERAR, motivo: MOTIVO,
    antes: ref.guardioes[LIBERAR] || null, depois: hoje[LIBERAR] || null,
    data: new Date().toISOString().slice(0, 10) });
  const out = { sobre: 'Trava das correções — ver ferramentas/travar.js. Só anda para frente.',
    guardioes: g,
    etapasDoPortao: Array.from(new Set(ref.etapasDoPortao.concat(por.etapas))),
    liberacoes: ref.liberacoes };
  fs.writeFileSync(ARQ, JSON.stringify(out, null, 1) + '\n');
  const total = Object.values(g).reduce((a, x) => a + x.pontos, 0);
  console.log('\n  ✓ Trava gravada: ' + Object.keys(g).length + ' guardiões, ' + total +
    ' pontos conferidos, ' + out.etapasDoPortao.length + ' etapas do portão.' +
    (novos.length ? '\n    Novos trancados: ' + novos.join(', ') : '') + '\n');
  process.exit(0);
}

console.log('\n  Trava das correções — ' + Object.keys(ref.guardioes).length + ' guardiões trancados');
if (problemas.length) {
  console.error('\n  ✗ UMA CORREÇÃO JÁ FEITA FICOU DESPROTEGIDA:\n');
  problemas.forEach(p => console.error('     · ' + p));
  console.error('\n  O que já foi corrigido não pode voltar a quebrar. Devolva o guardião,');
  console.error('  ou — só com ordem do Rafael — libere com --liberar <arquivo> --motivo "…".\n');
  process.exit(1);
}
if (novos.length) {
  console.error('\n  ✗ Guardião novo ainda não trancado: ' + novos.join(', '));
  console.error('    Rode: node ferramentas/travar.js --gravar\n');
  process.exit(1);
}
console.log('  ✓ nenhum guardião apagado, desligado ou enfraquecido\n');
process.exit(0);

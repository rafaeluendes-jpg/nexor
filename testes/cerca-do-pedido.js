/* ==========================================================
   JOIA — A CERCA DO PEDIDO FUNCIONA (Missão integridade, fase 5 — 06/10/2026)

   Rodar:  node testes/cerca-do-pedido.js
   ou:     npm run test:cerca   (entra na bateria e no portão)

   Regra do pedido nº 2: mexer só no que o Rafael pediu. A cerca
   (ferramentas/cerca.js + CERCA.json) é etapa do portão. Este guardião
   roda o juízo de verdade com casos e prende que ele:
     1. aceita o que está declarado, e o que acompanha qualquer mudança
        (index.html gerado, testes, trava, documentos);
     2. reprova arquivo fora da cerca;
     3. reprova o motor mexido sem "mexe_no_motor": true;
     4. reprova migration que cita tabela fora da cerca;
     5. reprova mudança sem CERCA.json;
     6. continua sendo etapa do portão.
   ========================================================== */
const fs = require('fs');
const path = require('path');
const { julgar } = require('../ferramentas/cerca.js');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const cerca = { pedido: 'arrumar a tela da ficha', arquivos: ['src/js/07-roteador/21-ficha-tecnica.js'],
  tabelas: ['fichas_tecnicas'], mexe_no_motor: false };

console.log('\n── 1. O declarado passa\n');
let r = julgar(cerca, ['src/js/07-roteador/21-ficha-tecnica.js', 'index.html', 'testes/ficha-x.js',
  'ferramentas/travas.json', 'MISSAO_INTEGRIDADE.md']);
t('a tela declarada, o index.html gerado, o teste, a trava e o documento passam', r.ok, r.problemas.join(' | '));
t('glob com * cobre a pasta', julgar(Object.assign({}, cerca, { arquivos: ['src/js/07-roteador/13-lancamentos-financeiros/*'] }),
  ['src/js/07-roteador/13-lancamentos-financeiros/01-lancamentos-e-mais-10.js']).ok);

console.log('\n── 2. Fora da cerca reprova\n');
r = julgar(cerca, ['src/js/07-roteador/21-ficha-tecnica.js', 'src/js/07-roteador/09-modulo-pdv/03-pdv.js']);
t('o PDV mexido num pedido da ficha reprova', !r.ok && /03-pdv\.js mudou e não está na cerca/.test(r.problemas.join('|')), r.problemas.join(' | '));

console.log('\n── 3. O motor só com declaração\n');
for (const f of ['src/js/03-armazenamento/01-inicio.js', 'sw.js', 'supabase/migrations/20261010_x.sql',
  '.github/workflows/pages.yml', 'ferramentas/portao.js', 'src/js/02-modulos.js']) {
  r = julgar(Object.assign({}, cerca, { arquivos: [f], tabelas: ['*'] }), [f]);
  t(f + ' sem "mexe_no_motor" reprova', !r.ok && /é do motor/.test(r.problemas.join('|')), r.problemas.join(' | '));
}
r = julgar(Object.assign({}, cerca, { arquivos: ['sw.js'], mexe_no_motor: true }), ['sw.js']);
t('declarado, o motor passa', r.ok, r.problemas.join(' | '));

console.log('\n── 4. Migration só nas tabelas declaradas\n');
const sql = { 'supabase/migrations/20261010_x.sql': 'alter table public.fichas_tecnicas add column y text;\nupdate public.insumos set custo = 0;' };
r = julgar(Object.assign({}, cerca, { arquivos: ['supabase/migrations/*'], mexe_no_motor: true }),
  ['supabase/migrations/20261010_x.sql'], f => sql[f]);
t('migration que mexe em insumos num pedido de fichas reprova', !r.ok && /mexe em insumos/.test(r.problemas.join('|')), r.problemas.join(' | '));
t('…e a tabela declarada não é apontada', !/mexe em fichas_tecnicas/.test(r.problemas.join('|')));
r = julgar(Object.assign({}, cerca, { arquivos: ['supabase/migrations/*'], mexe_no_motor: true, tabelas: ['fichas_tecnicas', 'insumos'] }),
  ['supabase/migrations/20261010_x.sql'], f => sql[f]);
t('com as duas declaradas, passa', r.ok, r.problemas.join(' | '));

console.log('\n── 5. Sem cerca não se mexe\n');
r = julgar(null, ['src/js/07-roteador/21-ficha-tecnica.js']);
t('mudança sem CERCA.json reprova', !r.ok && /sem CERCA\.json/.test(r.problemas.join('|')));
t('sem mudança e sem cerca, nada a julgar', julgar(null, []).ok);

console.log('\n── 6. É etapa do portão\n');
const portao = fs.readFileSync(path.join(__dirname, '..', 'ferramentas', 'portao.js'), 'utf8');
t('o portão roda a cerca', /args:\s*\['ferramentas\/cerca\.js'\]/.test(portao));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

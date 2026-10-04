/* ==========================================================
   O VÍNCULO DE PRODUÇÃO SÓ SOBE QUANDO MUDA (04/10/2026)

   Rodar:  node testes/vinculo-so-sobe-quando-muda.js
   ou:     npm run test:vinculo   (entra na bateria e no portão)

   Rafael: "está demorando para entrar no sistema — urgente."
   Todo envio regravava o vínculo de produção de todas as fichas e pastas
   (3.571 gravações em 20 minutos). Cada regravação virava versão nova da
   loja, que acordava os outros aparelhos, que enviavam de novo.

   Prende:
     · o aparelho lembra o vínculo que já gravou e não regrava;
     · no banco, gravação que não muda nada não vira versão nova
       (20261004_versao_so_quando_muda.sql).
   ========================================================== */
const fs = require('fs');
const path = require('path');
const { ARQ, versaoDoSistema } = require('./extrair.js');
const src = fs.readFileSync(ARQ, 'utf8');
const MIG = path.join(__dirname, '..', 'supabase', 'migrations', '20261004_versao_so_quando_muda.sql');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
console.log('\n── Sistema ' + versaoDoSistema() + ' — vínculo só sobe quando muda\n');
t('o aparelho filtra o vínculo que já gravou',
  /DB\._vinc=DB\._vinc\|\|\{\};\s*pend=pend\.filter\(function\(pv\)\{\s*return DB\._vinc\[pv\.tab\+'\|'\+pv\.ref\+'\|'\+\(pv\.campo\|\|'destino_id'\)\]!==pv\.uid;/.test(src));
t('e só anota depois que a nuvem aceitou',
  /'PATCH',_pt\);\s*DB\._vinc\[pend\[pz\]\.tab\+'\|'\+pend\[pz\]\.ref\+'\|'\+\(pend\[pz\]\.campo\|\|'destino_id'\)\]=pend\[pz\]\.uid;/.test(src));
/* o comportamento: duas rodadas seguidas com o mesmo vínculo mandam um PATCH só */
const DB = { _vinc: {} };
let patches = 0;
function rodada(pend) {
  DB._vinc = DB._vinc || {};
  pend = pend.filter(pv => DB._vinc[pv.tab + '|' + pv.ref + '|' + (pv.campo || 'destino_id')] !== pv.uid);
  pend.forEach(pv => { patches++; DB._vinc[pv.tab + '|' + pv.ref + '|' + (pv.campo || 'destino_id')] = pv.uid; });
}
const p = [{ tab: 'fichas_tecnicas', ref: 'fi_a', campo: 'destino_id', uid: 'u1' }];
rodada(p); rodada(p); rodada(p);
t('três envios sem mudança: um PATCH só', patches === 1, patches);
rodada([{ tab: 'fichas_tecnicas', ref: 'fi_a', campo: 'destino_id', uid: 'u2' }]);
t('o vínculo que mudou sobe', patches === 2, patches);
const sql = fs.existsSync(MIG) ? fs.readFileSync(MIG, 'utf8') : '';
t('no banco, gravação sem mudança não vira versão nova',
  /if tg_op = 'UPDATE' and \(to_jsonb\(new\) - 'alterado_em' - 'sucursais_vista' - 'versao_vista'\)\s*= \(to_jsonb\(old\) - 'alterado_em' - 'sucursais_vista' - 'versao_vista'\) then\s*return new;/.test(sql));
console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

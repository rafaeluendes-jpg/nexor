/* ==========================================================
   FECHAMENTO DE CAIXA CONFERIDO NUNCA É APAGADO (05/10/2026)

   Rodar:  node testes/fechamento-nao-se-apaga.js
   ou:     npm run test:fechamentofica   (entra na bateria e no portão)

   Rafael: "Do dia 2 para frente não tem nenhum físico, e está tudo
   lançado e fechado. Depois das correções foi quebrado e sumiu."

   Em 05/10 13:47 o aparelho de Santa Fé reenviou o caixa de 02/10 a partir
   de uma cópia velha, fechada mas sem conferência, e zerou o fechamento na
   nuvem. O caixa foi devolvido do audit_log; a trava no banco impede que
   aconteça de novo. Este guardião confere que a trava continua lá, inteira:
   fechado não reabre, conferência/fotografia/quem fechou não voltam a
   vazio, e a edição do fechamento (que manda conferência) continua valendo.
   ========================================================== */
const fs = require('fs');
const path = require('path');
const MIG = path.join(__dirname, '..', 'supabase', 'migrations', '20261005_fechamento_nao_se_apaga.sql');
let falhas = 0, testes = 0;
function t(nome, ok) { testes++; if (ok) console.log('   ok   ' + nome); else { falhas++; console.log('   FALHOU  ' + nome); } }
const sql = fs.existsSync(MIG) ? fs.readFileSync(MIG, 'utf8') : '';
console.log('\n── A trava do fechamento no banco\n');
t('a trava existe e roda antes de gravar o caixa',
  /create trigger ab_fechamento_nao_se_apaga before update on public\.caixas/.test(sql));
t('caixa fechado não reabre', /if old\.fechado_em is not null and new\.fechado_em is null then\s+new\.fechado_em := old\.fechado_em;/.test(sql));
t('cópia sem conferência não apaga a conferência',
  /coalesce\(old\.conferencia, '\{\}'::jsonb\) <> '\{\}'::jsonb\s+and coalesce\(new\.conferencia, '\{\}'::jsonb\) = '\{\}'::jsonb then\s+new\.conferencia\s+:= old\.conferencia;/.test(sql));
t('nem o contado, o informado, o esperado e a diferença',
  /new\.contado\s+:= old\.contado;/.test(sql) && /new\.total_informado\s+:= old\.total_informado;/.test(sql) &&
  /new\.esperado\s+:= old\.esperado;/.test(sql) && /new\.diferenca_total\s+:= old\.diferenca_total;/.test(sql));
t('a fotografia do fechamento não volta a nula', /if old\.snapshot is not null and new\.snapshot is null then\s+new\.snapshot := old\.snapshot;/.test(sql));
t('quem fechou não some', /if old\.fechado_por is not null and new\.fechado_por is null then\s+new\.fechado_por := old\.fechado_por;/.test(sql));
t('a edição do fechamento continua valendo: só o vazio é barrado', !/new\.conferencia\s+:= old\.conferencia;\s*end if;\s*return new/.test(sql) &&
  /= '\{\}'::jsonb then/.test(sql));
console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

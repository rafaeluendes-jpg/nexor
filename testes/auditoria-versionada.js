/* ==========================================================
   JOIA — A TRILHA DE AUDITORIA EXISTIA SÓ EM PRODUÇÃO (V379)

   `audit_log`, `tg_auditar()` e `tg_audit_imutavel()` rodam no banco da
   Jolô desde sempre: são a base do `/historico` da API e a única
   resposta possível à pergunta "quem mexeu nisso?".

   E a definição delas não estava em **nenhuma** migração do repositório.
   Existiam apenas como estado de produção.

   Três consequências, todas ruins:

     1. `20260929_indicadores_manuais.sql` faz
        `create trigger ... execute function tg_auditar()` — ou seja, só
        roda num banco que JÁ tenha a função. Um banco novo (cópia para
        homologação, restauração do zero) falharia ali.
     2. Não havia como revisar, comparar ou provar a trava de
        imutabilidade para a RDS. "Confie, está ligada" não é evidência.
     3. Um banco novo nasceria **sem auditoria nenhuma**, em silêncio.

   Este guardião tranca a migração no lugar: ela é a fotografia do que
   está rodando, e tem de continuar sendo.

   E tranca também a segunda metade do item 22 da RDS: a trilha passou a
   entrar no backup. Auditoria fora do backup não é auditoria — a trava
   de imutabilidade do banco não protege contra quem pode desligar o
   gatilho, e já aconteceu (27/08/2026, 291.063 linhas apagadas).
   ========================================================== */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const MIG = path.join(raiz, 'supabase', 'migrations', '20260930_auditoria_versionada.sql');
const sql = fs.readFileSync(MIG, 'utf8');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

console.log('\n── A trilha existe no repositório, não só no banco\n');

t('a migração existe', fs.existsSync(MIG));
t('cria a tabela da trilha', /create table if not exists public\.audit_log/.test(sql));
t('com RLS ligada — tabela de auditoria aberta é o contrário de auditoria',
  /alter table public\.audit_log enable row level security/.test(sql));
t('e com os dois índices que a consulta usa',
  /ix_audit_loja/.test(sql) && /ix_audit_tab/.test(sql));

console.log('\n── O que a trilha guarda\n');
for (const campo of ['quando', 'loja_id', 'usuario', 'usuario_email', 'cargo',
                     'tabela', 'operacao', 'registro_id', 'ref_local', 'antes', 'depois']) {
  t('guarda ' + campo, new RegExp('^\\s*' + campo + '\\s', 'm').test(sql));
}

console.log('\n── E o que ela nunca pode guardar\n');
/* auditoria que copia senha vira o maior vazamento do sistema */
for (const seg of ['senha', 'token', 'access_token', 'refresh_token', 'api_key',
                   'secret', 'app_secret', 'meta_token', 'webhook_token', 'sessao']) {
  t('"' + seg + '" está na lista de campos apagados', new RegExp("'" + seg + "'").test(sql));
}
t('de campo sensível fica só QUE mudou, nunca o valor',
  /to_jsonb\('\(alterado\)'::text\)/.test(sql));
t('e o antes também é limpo', /jantes := jantes - k;/.test(sql));

console.log('\n── A trava de imutabilidade\n');
t('a função da trava existe', /create or replace function public\.tg_audit_imutavel\(\)/.test(sql));
t('ela recusa a alteração com uma frase em português',
  /a trilha de auditoria não pode ser alterada nem apagada/.test(sql));
t('o gatilho pega UPDATE e DELETE', /before update or delete on public\.audit_log/.test(sql));
t('e roda por linha — não dá para apagar em lote escapando dele',
  /for each row execute function public\.tg_audit_imutavel\(\)/.test(sql));
t('a migração é honesta sobre o limite: o dono do banco ainda pode desligar o gatilho',
  /pode desligar o gatilho/.test(sql) && /copia fora do banco/.test(sql));

console.log('\n── Gravação que não muda nada não é alteração\n');
t('UPDATE sem mudança real não gera linha na trilha',
  /if tg_op = 'UPDATE' and to_jsonb\(old\) = to_jsonb\(new\) then\s*\n\s*return new;/.test(sql));
t('e o id que não é uuid não derruba o gatilho',
  /create or replace function public\.begin_id/.test(sql) &&
  /exception when others then return null/.test(sql));

console.log('\n── As tabelas auditadas são uma decisão escrita\n');
const alvos = (sql.match(/alvos text\[\] := array\[([\s\S]*?)\];/) || [])[1] || '';
const lista = (alvos.match(/'[a-z_]+'/g) || []).map(x => x.replace(/'/g, ''));
t('a lista está escrita, não descoberta por varredura', lista.length > 0);
t('são as 35 tabelas de negócio que o banco audita hoje', lista.length === 35, lista.length);
for (const tab of ['pedidos', 'lancamentos_financeiros', 'movimentacoes_estoque',
                   'estoque_unidade', 'caixas', 'cancelamentos', 'fichas_tecnicas',
                   'insumos', 'produtos', 'perfis', 'usuarios_sistema']) {
  t('audita ' + tab, lista.indexOf(tab) >= 0);
}
t('e a criação do gatilho é idempotente — rodar duas vezes não duplica',
  /if exists \(select 1 from pg_trigger g/.test(sql) && /continue;/.test(sql));
t('tabela que ainda não existe é pulada, não quebra a migração',
  /if to_regclass\('public\.'\|\|t\) is null then continue; end if;/.test(sql));

console.log('\n── A trilha entra no backup\n');
const bk = fs.readFileSync(path.join(raiz, 'ferramentas', 'backup.js'), 'utf8');
t('o audit_log NÃO está mais na lista de exclusão padrão',
  /const FORA = COM_AUDITORIA \? \['backups'\] : \['audit_log', 'backups'\];/.test(bk));
t('entra por padrão, e a saída é que virou opção',
  /!process\.argv\.includes\('--sem-auditoria'\)/.test(bk));
t('e o motivo está escrito: auditoria fora do backup não é auditoria',
  /auditoria fora do backup nao e auditoria/i.test(bk));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia · a trilha de auditoria versionada');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

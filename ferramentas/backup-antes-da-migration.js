/* ==========================================================
   JOIA — O BACKUP ANTES DE CADA MIGRATION (regra 2 do CLAUDE.md)

   Imprime o SQL que copia, DENTRO do próprio banco, as tabelas que o
   aparelho grava (lidas do MAPA — nunca de uma lista escrita aqui) para o
   esquema `copia_seguranca`, fechado: nem o visitante nem o login de loja
   enxergam. Junto vão as definições das funções e dos gatilhos de hoje,
   para devolver tudo como estava se a migration der errado.

     node ferramentas/backup-antes-da-migration.js 20261006a > /tmp/backup.sql

   O prefixo (primeiro argumento) nomeia as cópias: copia_seguranca."<prefixo>_<tabela>".
   Usado em 06/10/2026 (prefixo lei20261006) antes da lei de versão em todas.

   Para devolver uma tabela (só com ordem do Rafael, depois de conferir o
   que mudou desde a cópia no audit_log): as linhas da cópia voltam por
   id, com `insert … on conflict (id) do update`, nunca apagando o que
   nasceu depois da cópia.
   ========================================================== */
const fs = require('fs');
const path = require('path');
const { tabelasDoMapa } = require('./tabelas-do-mapa');

const prefixo = (process.argv[2] || '').replace(/[^a-z0-9_]/gi, '');
if (!prefixo) { console.error('uso: node ferramentas/backup-antes-da-migration.js <prefixo>'); process.exit(1); }
const fonte = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const tabs = tabelasDoMapa(fonte).todas.slice().sort();

const q = [];
q.push('create schema if not exists copia_seguranca;');
q.push('revoke all on schema copia_seguranca from public, anon, authenticated;');
tabs.forEach(t => q.push(`create table copia_seguranca."${prefixo}_${t}" as table public.${t};`));
q.push(`create table copia_seguranca."${prefixo}_definicoes" as
  select 'funcao'::text tipo, p.proname::text nome, pg_get_functiondef(p.oid) def
    from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f'
  union all
  select 'gatilho', c.relname||'.'||tg.tgname, pg_get_triggerdef(tg.oid)
    from pg_trigger tg join pg_class c on c.oid=tg.tgrelid
   where c.relnamespace='public'::regnamespace and not tg.tgisinternal;`);
q.push('revoke all on all tables in schema copia_seguranca from public, anon, authenticated;');
/* a prova de que copiou: contagem da cópia = contagem do original, tabela a tabela */
q.push(`select count(*) filter (where n_orig = n_copia) iguais, count(*) tabelas from (\n` +
  tabs.map(t => `  select (select count(*) from public.${t}) n_orig, (select count(*) from copia_seguranca."${prefixo}_${t}") n_copia`).join('\n  union all\n') +
  `\n) z;`);
console.log(q.join('\n'));

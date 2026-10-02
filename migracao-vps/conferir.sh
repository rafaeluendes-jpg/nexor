#!/usr/bin/env bash
# Confere tabela por tabela se a VPS tem exatamente o que a nuvem tem.
set -euo pipefail
source /opt/joia/migracao.env
Q="select string_agg(format('%s=%s', c.relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) n from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text), E'\n' order by c.relname)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'"
diff <(psql "$ORIGEM_DB_URL" -At -c "$Q") <(psql "$DESTINO_DB_URL" -At -c "$Q") && echo "ok: todas as tabelas batem, linha por linha."
for x in "select count(*) from auth.users" "select count(*) from storage.objects" "select count(*) from pg_publication_tables where pubname='supabase_realtime'" "select count(*) from pg_policies where schemaname='public'"; do
  a=$(psql "$ORIGEM_DB_URL" -At -c "$x"); b=$(psql "$DESTINO_DB_URL" -At -c "$x")
  [ "$a" = "$b" ] && echo "ok: $x → $a" || { echo "DIFERENTE: $x → nuvem $a, VPS $b"; exit 1; }
done

#!/usr/bin/env bash
# Copia o banco do Supabase (nuvem) para o Supabase da VPS.
# Precisa, em /opt/joia/migracao.env (permissão 600, nunca no git):
#   ORIGEM_DB_URL=postgresql://postgres.cevghkndzpzvnzwifhnm:<SENHA>@aws-0-us-east-2.pooler.supabase.com:5432/postgres
#   DESTINO_DB_URL=postgresql://postgres.<POOLER_TENANT_ID do .env>:<POSTGRES_PASSWORD do .env>@127.0.0.1:5432/postgres
# Rodar com as lojas FECHADAS (a cópia é uma foto do momento):
#   bash copiar-banco.sh
set -euo pipefail
source /opt/joia/migracao.env
D=/opt/joia/copia-$(date +%Y%m%d-%H%M)
mkdir -p "$D" && chmod 700 "$D"
cd "$D"
npx -y supabase@latest db dump --db-url "$ORIGEM_DB_URL" -f roles.sql --role-only
npx -y supabase@latest db dump --db-url "$ORIGEM_DB_URL" -f schema.sql
npx -y supabase@latest db dump --db-url "$ORIGEM_DB_URL" -f data.sql --use-copy --data-only
ls -la "$D"
psql "$DESTINO_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
  -f roles.sql -f schema.sql \
  -c 'SET session_replication_role = replica' \
  -f data.sql
echo "ok: banco copiado. Próximo: bash copiar-segredos.sh"

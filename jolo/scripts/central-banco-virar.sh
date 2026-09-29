#!/usr/bin/env bash
# ============================================================
# A TROCA DO BANCO DA CENTRAL: Supabase da nuvem -> Supabase na VPS
#
# Ensaiado em 29/09/2026 (docs/MUDANCA_PARA_A_VPS.md). Em ordem:
#
#   1. Central em manutencao (ninguem grava durante a copia)
#   2. banco da VPS zerado e refeito: esquema, dados, regras do storage,
#      gatilho do login, cofre, rotinas agendadas, enderecos das funcoes
#   3. fotos: so as novas desde o ensaio (as iguais sao puladas)
#   4. conferencia tabela por tabela: nuvem == VPS, senao PARA
#   5. rotinas ligadas na VPS e DESLIGADAS na nuvem (senao avisos em dobro)
#   6. Central apontando para https://centraljolo.com.br/banco
#   7. manutencao desligada e prova de fumaca
#
# Se qualquer passo antes do 5 falhar, a manutencao sai e a Central
# volta a usar a nuvem, que nao foi tocada.
#
# ENSAIO=1 roda so o passo 2-4 (nao para a Central, nao mexe na nuvem).
#
# Uso (root):  bash central-banco-virar.sh           (a troca de verdade)
#              ENSAIO=1 bash central-banco-virar.sh  (so o ensaio)
# ============================================================
set -Eeuo pipefail

ENSAIO="${ENSAIO:-0}"
SB=/opt/supabase-central
TRAB=/root/migracao-central
PGD=/usr/lib/postgresql/17/bin/pg_dump
LOG="$TRAB/virada-$(date +%Y%m%d-%H%M%S).log"
install -d -m 700 "$TRAB"; exec > >(tee -a "$LOG") 2>&1

set -a; . /etc/jolo/central.env; . /etc/jolo/central-banco.env; set +a
export PGPASSWORD="$CENTRAL_DB_SENHA"

# A TROCA JA FOI FEITA em 29/09/2026 17:56. Rodar de novo apagaria o que foi
# gravado na VPS desde entao (o banco e refeito a partir da nuvem, parada) e,
# pela volta automatica, religaria as rotinas na nuvem. Por isso: trancado.
if [[ -d /opt/central-nuvem ]] || grep -q 'location /banco/' /etc/nginx/sites-available/central; then
  echo "A troca do banco da Central ja foi feita. Este roteiro esta trancado."
  exit 1
fi
NUVEM="host=db.cvarnbkjlvpjehjulsuc.supabase.co user=postgres dbname=postgres sslmode=require"
L() { docker exec -i central-db psql -U supabase_admin -d postgres "$@"; }
passo() { echo; echo "=== $(date +%H:%M:%S) $*"; }

MANUT=/etc/nginx/sites-available/central
manutencao_liga() {
  # so guarda o "antes" se ele ainda E o antes: rodando de novo com a
  # manutencao ligada, guardaria a propria manutencao como original
  grep -q MANUTENCAO "$MANUT" || cp "$MANUT" "$TRAB/central.nginx.antes"
  python3 - "$MANUT" <<'EOF'
import sys
p=sys.argv[1]; s=open(p).read()
if 'MANUTENCAO' not in s:
    s=s.replace('    location / {', '''    # MANUTENCAO (troca do banco) — retirado no fim do roteiro
    location = /manutencao.html { root /var/www/manutencao; }
    location / { return 503; }
    error_page 503 /manutencao.html;
    location /__antes__ {''',1)
open(p,'w').write(s)
EOF
  install -d /var/www/manutencao
  cat > /var/www/manutencao/manutencao.html <<'EOF'
<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Central Jolô — em manutenção</title><meta http-equiv="refresh" content="60">
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#1f2a1c;color:#f4eee3;font-family:system-ui,sans-serif;text-align:center">
<div><h1 style="font-weight:500">Central Jolô em manutenção</h1><p>Voltamos em poucos minutos. Esta página se atualiza sozinha.</p></div></body></html>
EOF
  nginx -t && systemctl reload nginx
}
manutencao_desliga() {
  [[ -s "$TRAB/central.nginx.antes" ]] || return 0   # a manutencao nem chegou a ligar
  cp "$TRAB/central.nginx.antes" "$MANUT"; nginx -t && systemctl reload nginx
}

desfazer() {
  echo "!!! falhou antes de trocar. A Central volta para a nuvem, que nao foi tocada."
  if [[ "$ENSAIO" != 1 ]]; then
    # as rotinas da nuvem voltam ao que eram
    [[ -s "$TRAB/cron-ativar.sql" ]] && psql "$NUVEM" -q -At < "$TRAB/cron-ativar.sql" > /dev/null || true
    manutencao_desliga
  fi
}
trap desfazer ERR

# ---------------------------------------------------------------- 0
if [[ "$ENSAIO" != 1 ]]; then
  passo "0. conferencias antes de parar"
  # a Central nova ja montada, apontando para o banco da VPS
  [[ -s /opt/central-vps/.next/BUILD_ID ]]
  grep -rqs "centraljolo.com.br/banco" /opt/central-vps/.next/server
  [[ "$(docker inspect -f '{{.State.Health.Status}}' central-db)" == healthy ]]
  # o login de quem esta conectado agora foi assinado pela chave ES256 da
  # nuvem: a parte publica dela tem de estar no banco da VPS, senao todo
  # mundo cai na tela de entrar
  for KID in $(curl -s https://cvarnbkjlvpjehjulsuc.supabase.co/auth/v1/.well-known/jwks.json | grep -oE '"kid":"[^"]+"' | cut -d'"' -f4); do
    grep -q "$KID" "$SB/.env" || { echo "falta a chave publica $KID da nuvem"; false; }
    docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' central-rest | grep -q "$KID"
  done
  # o estado das rotinas da nuvem, guardado ANTES de mexer (para voltar)
  psql "$NUVEM" -At -c "select format('select cron.alter_job(jobid, active := %L) from cron.job where jobname = %L;', active, jobname) from cron.job order by jobid" > "$TRAB/cron-ativar.sql"
  [[ -s "$TRAB/cron-ativar.sql" ]]
fi

# ---------------------------------------------------------------- 1
if [[ "$ENSAIO" != 1 ]]; then
  passo "1. manutencao ligada e rotinas da nuvem desligadas"
  manutencao_liga
  # sem isto uma rotina gravaria na nuvem durante a copia e a conferencia
  # (nuvem == VPS) nao bateria
  psql "$NUVEM" -q -At -c "select cron.alter_job(jobid, active := false) from cron.job" > /dev/null
  [[ "$(psql "$NUVEM" -At -c "select count(*) from cron.job where active")" == 0 ]]
  sleep 20   # quem estava no meio de um envio termina
fi

# ---------------------------------------------------------------- 2
passo "2. copiando da nuvem"
cd "$TRAB"
$PGD "$NUVEM" --schema-only -n public -n seguranca -n supabase_migrations -f esquema.sql
$PGD "$NUVEM" --data-only -n public -n seguranca -n auth -n storage -n supabase_migrations \
  --exclude-table=auth.schema_migrations --exclude-table=storage.migrations -f dados.sql 2>/dev/null
psql "$NUVEM" -At > extras.sql <<'EOF'
select format('create policy %I on %I.%I as %s for %s to %s%s%s;', policyname, schemaname, tablename, permissive, cmd, array_to_string(roles, ', '),
  case when qual is not null then ' using ('||qual||')' else '' end,
  case when with_check is not null then ' with check ('||with_check||')' else '' end)
from pg_policies where schemaname='storage';
select pg_get_triggerdef(t.oid)||';' from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and not t.tgisinternal;
EOF
psql "$NUVEM" -At -c "select format('select cron.schedule(%L, %L, %L);', jobname, schedule, command) from cron.job order by jobid" > cron.sql
# no ensaio o estado sai da nuvem agora; na troca ja foi guardado no passo 0
[[ "$ENSAIO" == 1 ]] && psql "$NUVEM" -At -c "select format('select cron.alter_job(jobid, active := %L) from cron.job where jobname = %L;', active, jobname) from cron.job order by jobid" > cron-ativar.sql

passo "2. banco da VPS refeito do zero"
cd "$SB"
docker compose stop db auth rest realtime storage functions >/dev/null
docker compose rm -f db >/dev/null
rm -rf "$SB/volumes/db/data"
docker compose up -d >/dev/null
for i in $(seq 1 60); do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' central-db 2>/dev/null)" == healthy ]] && \
  [[ "$(docker inspect -f '{{.State.Health.Status}}' central-auth 2>/dev/null)" == healthy ]] && \
  [[ "$(docker inspect -f '{{.State.Health.Status}}' central-storage 2>/dev/null)" == healthy ]] && break
  sleep 3
done
cd "$TRAB"
echo "create extension if not exists pg_cron with schema pg_catalog; grant usage on schema cron to postgres; grant all on all tables in schema cron to postgres;" | L -q
L -q < esquema.sql 2>&1 | grep ERROR | grep -v 'schema "public" already exists' && { echo "erro no esquema"; false; } || true
( echo "set session_replication_role = replica;"; cat dados.sql ) | L -q > dados.log 2>&1 || true
# as unicas recusas aceitas: tabelas de login VAZIAS que a versao da nuvem tem a mais
grep ERROR dados.log | grep -vE 'mfa_recovery_code|one_time_tokens|scim_' && { echo "erro nos dados"; false; } || true
L -q < extras.sql
psql "$NUVEM" -At -c "select format('select vault.create_secret(%L, %L, %L);', decrypted_secret, name, coalesce(description,'')) from vault.decrypted_secrets order by name" | L -q -At > /dev/null
L -q -At < cron.sql > /dev/null
L -q -c "update cron.job set active=false"
L -q <<'EOF'
do $$ declare r record; begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname in ('public','seguranca') and p.prokind='f'
             and pg_get_functiondef(p.oid) like '%cvarnbkjlvpjehjulsuc.supabase.co/functions/v1/%'
  loop
    execute replace(pg_get_functiondef(r.oid), 'https://cvarnbkjlvpjehjulsuc.supabase.co/functions/v1/', 'http://kong:8000/functions/v1/');
  end loop;
end $$;
EOF

# ---------------------------------------------------------------- 3
passo "3. fotos"
node /opt/jolo/jolo/scripts/central-copiar-arquivos.mjs

# ---------------------------------------------------------------- 4
passo "4. conferencia tabela por tabela"
SQL="select string_agg(format('select %L as t, count(*) as n from %I.%I', n.nspname||'.'||c.relname, n.nspname, c.relname), ' union all ' order by 1) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and (n.nspname in ('public','seguranca') or (n.nspname='auth' and c.relname in ('users','identities','sessions','refresh_tokens','mfa_factors')) or (n.nspname='storage' and c.relname in ('buckets','objects')))"
Q1=$(psql "$NUVEM" -Atc "$SQL")
psql "$NUVEM" -Atc "$Q1 order by 1" > contagem-nuvem.txt
L -At -c "$Q1 order by 1" > contagem-vps.txt
if [[ "$ENSAIO" == 1 ]]; then
  diff contagem-nuvem.txt contagem-vps.txt || echo "(no ensaio a Central esta aberta: diferenca em registro de acesso e esperada)"
else
  diff contagem-nuvem.txt contagem-vps.txt
fi
echo "tabelas conferidas: $(wc -l < contagem-vps.txt)"
[[ "$(L -Atc "select count(*) from vault.decrypted_secrets")" == "$(psql "$NUVEM" -Atc "select count(*) from vault.secrets")" ]]
[[ "$(L -Atc "select count(*) from pg_policies where schemaname='storage'")" == "$(psql "$NUVEM" -Atc "select count(*) from pg_policies where schemaname='storage'")" ]]

if [[ "$ENSAIO" == 1 ]]; then passo "ENSAIO OK — nada foi trocado"; exit 0; fi

# ---------------------------------------------------------------- 5
passo "5. rotinas ligadas na VPS (na nuvem ja estao desligadas)"
trap - ERR   # daqui em diante a VPS e a dona dos dados: nao ha volta automatica
L -q -At < "$TRAB/cron-ativar.sql" > /dev/null
L -At -c "select jobname||' ativo='||active from cron.job order by jobid"

# ---------------------------------------------------------------- 6
passo "6. Central apontando para o banco da VPS"
python3 - "$TRAB/central.nginx.antes" <<'EOF'
import sys
p=sys.argv[1]; s=open(p).read()
if 'location /banco/' not in s:
    s=s.replace('    location / {', '''    # o banco da Central (Supabase na VPS, 127.0.0.1:18000)
    location /banco/ {
        proxy_pass http://127.0.0.1:18000/;
        include /etc/nginx/jolo-proxy.conf;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_buffer_size 64k; proxy_buffers 8 64k; proxy_busy_buffers_size 128k;
        client_max_body_size 50m;
    }
    location / {''',1)
open(p,'w').write(s)
EOF
rm -f /etc/nginx/sites-enabled/central-ensaio
sed -i '/ensaio.centraljolo.com.br/d' /etc/hosts
grep -q ' centraljolo.com.br$' /etc/hosts || echo "127.0.0.1 centraljolo.com.br" >> /etc/hosts
grep -q '^NEXT_PUBLIC_SUPABASE_URL=' /etc/jolo/central.env || echo "NEXT_PUBLIC_SUPABASE_URL=https://centraljolo.com.br/banco" >> /etc/jolo/central.env
# a Central nova foi montada ANTES da manutencao em /opt/central-vps;
# aqui so troca a pasta (a antiga fica guardada para voltar)
systemctl stop jolo-central
rm -rf /opt/central-nuvem
mv /opt/central /opt/central-nuvem
mv /opt/central-vps /opt/central
systemctl start jolo-central

# ---------------------------------------------------------------- 7
passo "7. manutencao desligada"
manutencao_desliga
sleep 6
A=$(grep ^ANON_KEY= "$SB/.env" | cut -d= -f2-)
printf 'entrar: %s\n'  "$(curl -s -o /dev/null -w '%{http_code}' https://centraljolo.com.br/entrar)"
printf 'login:  %s\n'  "$(curl -s -o /dev/null -w '%{http_code}' https://centraljolo.com.br/banco/auth/v1/health -H "apikey: $A")"
printf 'dados:  %s\n'  "$(curl -s -o /dev/null -w '%{http_code}' "https://centraljolo.com.br/banco/rest/v1/unidades?select=id&limit=1" -H "apikey: $A")"
printf 'funcao: %s (401 = trancada, certo)\n' "$(curl -s -o /dev/null -w '%{http_code}' -X POST https://centraljolo.com.br/banco/functions/v1/criar-acesso -H "apikey: $A")"
passo "TROCA FEITA. Registro: $LOG"

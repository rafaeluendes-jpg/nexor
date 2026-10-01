#!/usr/bin/env bash
# ============================================================
# Leva a Gestao de Franquias (gestao.jologelato.com.br) para containers:
#   - o banco sai do Postgres instalado na maquina e vai para gestao-postgres
#   - o sistema sai do PM2 e vai para gestao-app
# (infra/docker/docker-compose.sistemas.yml)
#
# Uso (no servidor, como root):  bash /opt/jolo/jolo/scripts/gestao-para-container.sh
#
# - A senha do banco novo e gerada aqui e nunca aparece na tela.
# - O site fica fora do ar ~1 minuto (entre parar o PM2 e o container responder).
# - Antes de mexer, faz uma copia do banco em /var/backups/jolo/.
# - Confere tabela por tabela que o banco novo tem as mesmas linhas.
# - Se qualquer passo falhar depois de parar o site, volta sozinho para o
#   PM2 e o Postgres da maquina (que nao sao apagados: ficam desligados).
# ============================================================
set -Eeuo pipefail

COMPOSE="docker compose -f /opt/jolo/jolo/infra/docker/docker-compose.sistemas.yml -p jolo-sistemas"
PASTA=/var/www/jolo-gestao
TRAB="/var/backups/jolo/gestao-mudanca-$(date +%Y-%m-%d_%H%M%S)"
SITE_PARADO=0

passo() { printf '\n==> %s\n' "$*"; }
erro()  { printf '\nERRO: %s\n' "$*" >&2; exit 1; }

voltar() {
  [ "$SITE_PARADO" = 1 ] || return 0
  echo
  echo "!!! algo falhou: voltando a Gestao para como estava (PM2 + banco da maquina)."
  $COMPOSE rm -sf gestao-app >/dev/null 2>&1 || true
  systemctl start postgresql >/dev/null 2>&1 || true
  pm2 restart jolo-gestao >/dev/null 2>&1 || pm2 resurrect >/dev/null 2>&1 || true
  sleep 5
  echo "    site: $(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:3000/login)"
  echo "    copia do banco feita antes: $TRAB/banco-antes.dump"
}
# EXIT (e nao ERR): o "erro" sai com exit 1, que o ERR nao pega
trap 'RC=$?; [ "$RC" = 0 ] || voltar' EXIT

# ------------------------------------------------------------
passo "1. Conferencias antes de mexer"
[ "$(id -u)" = 0 ] || erro "rode como root."
pm2 describe jolo-gestao >/dev/null 2>&1 || {
  docker inspect -f '{{.State.Running}}' gestao-app 2>/dev/null | grep -q true \
    && { echo "    a Gestao ja esta no container. Nada a fazer."; exit 0; }
  erro "nao achei a Gestao no PM2."; }
sudo -u postgres psql -Atc 'select 1' -d jolo_gestao >/dev/null || erro "nao consegui ler o banco jolo_gestao da maquina."
$COMPOSE config -q || erro "o arquivo dos containers esta invalido."
install -d -m 700 "$TRAB"
echo "    ok"

# ------------------------------------------------------------
passo "2. Senha do banco novo (gerada aqui, nao aparece)"
if docker volume inspect jolo-sistemas_gestao-dados >/dev/null 2>&1; then
  # o banco novo ja foi criado numa tentativa anterior: a senha tem de ser a mesma
  [ -s /etc/jolo/gestao-banco.env ] && [ -s /etc/jolo/gestao.env ] \
    || erro "o banco novo existe mas a configuracao dele sumiu. Apague o volume jolo-sistemas_gestao-dados e rode de novo."
  echo "    banco novo de uma tentativa anterior: senha mantida"
else
  ( umask 077
    SENHA="$(openssl rand -hex 24)"
    printf 'POSTGRES_USER=jolo_user\nPOSTGRES_PASSWORD=%s\nPOSTGRES_DB=jolo_gestao\n' "$SENHA" > /etc/jolo/gestao-banco.env
    printf '# Gestao de Franquias: banco no container gestao-postgres (127.0.0.1:15433)\nDATABASE_URL="postgresql://jolo_user:%s@127.0.0.1:15433/jolo_gestao"\n' "$SENHA" > /etc/jolo/gestao.env )
  echo "    gravada em /etc/jolo/gestao.env e gestao-banco.env (so root)"
fi

# ------------------------------------------------------------
passo "3. Banco novo no container"
$COMPOSE up -d gestao-postgres
for i in $(seq 1 30); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' gestao-postgres 2>/dev/null)" = healthy ] && break
  sleep 2
done
[ "$(docker inspect -f '{{.State.Health.Status}}' gestao-postgres)" = healthy ] || erro "o banco novo nao subiu (docker logs gestao-postgres)."
echo "    gestao-postgres de pe"

# ------------------------------------------------------------
passo "4. Parando o site (~1 minuto fora do ar a partir daqui)"
SITE_PARADO=1
pm2 stop jolo-gestao >/dev/null
echo "    PM2 parado: ninguem grava no banco durante a copia"

# ------------------------------------------------------------
passo "5. Copia do banco da maquina"
sudo -u postgres pg_dump -Fc -d jolo_gestao > "$TRAB/banco-antes.dump"
sudo -u postgres pg_restore -l < "$TRAB/banco-antes.dump" >/dev/null
echo "    $TRAB/banco-antes.dump ($(du -h "$TRAB/banco-antes.dump" | cut -f1))"

# ------------------------------------------------------------
passo "6. Copia para o banco novo"
docker exec gestao-postgres psql -U jolo_user -d postgres -qc 'drop database if exists jolo_gestao with (force)'
docker exec gestao-postgres psql -U jolo_user -d postgres -qc 'create database jolo_gestao'
docker exec -i gestao-postgres pg_restore -U jolo_user -d jolo_gestao --no-owner --no-privileges --exit-on-error < "$TRAB/banco-antes.dump"
echo "    restaurado"

# ------------------------------------------------------------
passo "7. Conferencia tabela por tabela"
CONTAR="select string_agg(format('select %L as t, count(*) as n from %I.%I', table_schema||'.'||table_name, table_schema, table_name), ' union all ' order by table_schema, table_name) from information_schema.tables where table_type='BASE TABLE' and table_schema not in ('pg_catalog','information_schema')"
SQL_A="$(sudo -u postgres psql -d jolo_gestao -Atc "$CONTAR")"
SQL_B="$(docker exec gestao-postgres psql -U jolo_user -d jolo_gestao -Atc "$CONTAR")"
[ -n "$SQL_A" ] && [ "$SQL_A" = "$SQL_B" ] || erro "as listas de tabelas nao batem."
sudo -u postgres psql -d jolo_gestao -Atc "$SQL_A order by 1" > "$TRAB/linhas-antes.txt"
docker exec gestao-postgres psql -U jolo_user -d jolo_gestao -Atc "$SQL_B order by 1" > "$TRAB/linhas-depois.txt"
diff -q "$TRAB/linhas-antes.txt" "$TRAB/linhas-depois.txt" >/dev/null || { diff "$TRAB/linhas-antes.txt" "$TRAB/linhas-depois.txt" || true; erro "as contagens de linhas nao batem."; }
echo "    $(wc -l < "$TRAB/linhas-antes.txt") tabelas, $(awk -F'|' '{s+=$2} END{print s}' "$TRAB/linhas-antes.txt") linhas: iguais nos dois bancos"

# ------------------------------------------------------------
passo "8. Sistema no container"
# o banco da maquina desliga ANTES: se o sistema ainda tentasse usa-lo, falharia aqui
systemctl stop postgresql
$COMPOSE up -d gestao-app
OK=0
for i in $(seq 1 30); do
  sleep 2
  case "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/login)" in 2*|3*) OK=1; break ;; esac
done
[ "$OK" = 1 ] || { docker logs --tail 30 gestao-app; erro "o container da Gestao nao respondeu."; }
sleep 5
if docker logs gestao-app 2>&1 | grep -qiE 'ECONNREFUSED|P1001|P1000|password authentication failed|Can.t reach database'; then
  docker logs --tail 30 gestao-app; erro "o sistema subiu mas nao conversa com o banco novo."
fi
[ "$(docker inspect -f '{{.RestartCount}}' gestao-app)" = 0 ] || erro "o container da Gestao reiniciou sozinho."
echo "    respondendo em 127.0.0.1:3000 (so por dentro; o nginx atende a internet)"

# ------------------------------------------------------------
passo "9. Desligando o jeito antigo (nada e apagado)"
SITE_PARADO=0
pm2 delete jolo-gestao >/dev/null && pm2 save --force >/dev/null
systemctl disable postgresql >/dev/null 2>&1 || true
systemctl disable --now pm2-root >/dev/null 2>&1 || true
# a publicacao da Gestao passa a recriar o container em vez do PM2
if grep -q 'pm2 start' "$PASTA/deploy.sh"; then
  cp "$PASTA/deploy.sh" "$TRAB/deploy.sh.antes"
  python3 - "$PASTA/deploy.sh" <<'FIMPY'
import sys
p = sys.argv[1]; s = open(p).read()
velho = s[s.index('echo "♻️ Restarting PM2..."'):s.index('echo "✅ Deploy concluído!"')]
novo = ('echo "♻️ Recriando o container gestao-app..."\n'
        'docker compose -f /opt/jolo/jolo/infra/docker/docker-compose.sistemas.yml -p jolo-sistemas \\\n'
        '  up -d --no-deps --force-recreate gestao-app\n')
open(p, 'w').write(s.replace(velho, novo))
FIMPY
  echo "    deploy.sh da Gestao agora recria o container"
fi
echo "    PM2 removido; Postgres da maquina desligado (dados guardados em /var/lib/postgresql)"

echo
echo "conferencia de fora: https://gestao.jologelato.com.br/login -> $(curl -s -o /dev/null -w '%{http_code}' --max-time 15 https://gestao.jologelato.com.br/login)"
echo "Pronto. Copia de seguranca da mudanca: $TRAB"

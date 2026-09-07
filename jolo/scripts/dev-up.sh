#!/usr/bin/env bash
# Sobe tudo que o sistema precisa para rodar e para os testes passarem.
# Uso: ./scripts/dev-up.sh
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

esperar() { # esperar <url> <segundos>
  local url="$1" limite="${2:-40}" i=0
  while [ "$i" -lt "$limite" ]; do
    curl -fsS -o /dev/null --max-time 2 "$url" && return 0
    i=$((i + 1)); sleep 1
  done
  return 1
}

# ---------- banco ----------
if ! pg_isready -q 2>/dev/null; then
  echo "subindo Postgres..."
  # Postgres instalado na maquina tem prioridade: e onde os dados ja estao.
  if [ -d /var/lib/postgresql/16/main ]; then
    su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/16/main \
      -o '-c config_file=/etc/postgresql/16/main/postgresql.conf' -l /tmp/pg.log start" > /dev/null 2>&1
  fi
  if ! pg_isready -q 2>/dev/null && command -v docker > /dev/null && [ -f infra/docker/docker-compose.yml ]; then
    (cd infra/docker && [ -f .env ] || cp ../../.env .env; docker compose up -d postgres redis)
  fi
fi

# ---------- fila ----------
redis-cli ping > /dev/null 2>&1 || {
  echo "subindo Redis..."
  redis-server --daemonize yes --appendonly no --save '' > /dev/null 2>&1
}

sleep 2
pg_isready -q && echo "Postgres no ar" || { echo "Postgres nao subiu"; exit 1; }
redis-cli ping > /dev/null 2>&1 && echo "Redis no ar" || { echo "Redis nao subiu"; exit 1; }

# ---------- API e workers ----------
# Derrubar pelo processo que ESTA na porta: "node dist/main.js" e o mesmo
# comando na API e nos workers, entao o nome sozinho nao distingue nem casa.
# A API e os workers rodam o MESMO comando ("node dist/main.js"); o que os
# distingue e a pasta de onde subiram. Por isso derrubamos pelo diretorio.
derrubar_em() {
  local pasta="$1" pid
  for pid in $(pgrep -f 'node dist/main.js' 2>/dev/null); do
    [ "$(readlink "/proc/$pid/cwd" 2>/dev/null)" = "$pasta" ] && kill "$pid" 2>/dev/null
  done
  return 0
}
derrubar_em "$RAIZ/apps/api"
derrubar_em "$RAIZ/workers"
pkill -f 'tsx src/main.ts' 2>/dev/null
sleep 2
(cd "$RAIZ/apps/api" && setsid node dist/main.js > /tmp/api.log 2>&1 &)
(cd "$RAIZ/workers" && setsid node dist/main.js > /tmp/workers.log 2>&1 &)

# ---------- telas ----------
pkill -f 'next-server' 2>/dev/null
sleep 2
(cd "$RAIZ/apps/landing" && setsid npx next start -p 3000 > /tmp/landing.log 2>&1 &)
(cd "$RAIZ/apps/crm" && setsid npx next start -p 3001 > /tmp/crm.log 2>&1 &)
if [ -d "$RAIZ/apps/landing/.next-teste" ]; then
  # instancia so dos testes, com numero ficticio de WhatsApp
  (cd "$RAIZ/apps/landing" && NEXT_DIST_DIR=.next-teste setsid npx next start -p 3010 > /tmp/landing-wa.log 2>&1 &)
fi

esperar http://localhost:3333/health 40 && echo "API no ar"      || echo "API NAO subiu (veja /tmp/api.log)"
esperar http://localhost:3000 40      && echo "landing no ar"    || echo "landing NAO subiu"
esperar http://localhost:3001/login 40 && echo "CRM no ar"       || echo "CRM NAO subiu"
[ -d "$RAIZ/apps/landing/.next-teste" ] && { esperar http://localhost:3010 40 && echo "landing de teste no ar"; }
exit 0

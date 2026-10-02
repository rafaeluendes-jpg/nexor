#!/usr/bin/env bash
# Instala o Supabase (versão que roda no próprio servidor) na VPS, ao lado do
# que já existe. Não apaga nada da máquina. Rodar como root:
#   bash instalar-supabase.sh
set -euo pipefail
BASE=/opt/joia
mkdir -p "$BASE"
command -v docker >/dev/null || { curl -fsSL https://get.docker.com | sh; }
docker compose version >/dev/null
command -v node >/dev/null || { apt-get update -y && apt-get install -y nodejs; }
command -v psql >/dev/null || { apt-get update -y && apt-get install -y postgresql-client; }

# memória: o Supabase completo pede 4 GB ou mais
MEM=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)
[ "$MEM" -ge 3800 ] || echo "ATENÇÃO: a VPS tem ${MEM} MB de memória; o recomendado é 4 GB ou mais."

if [ ! -d "$BASE/supabase" ]; then
  git clone --depth 1 https://github.com/supabase/supabase "$BASE/_src"
  mkdir -p "$BASE/supabase"
  cp -rf "$BASE/_src/docker/." "$BASE/supabase/"
  cp "$BASE/supabase/.env.example" "$BASE/supabase/.env"
  node "$(dirname "$0")/gerar-chaves.js" "$BASE/supabase/.env"
fi
cd "$BASE/supabase"
docker compose pull
docker compose up -d
sleep 20
docker compose ps
echo "ok: Supabase no ar na porta 8000 (só local). Próximo: nginx + certificado (passo 3 do LEIA-PRIMEIRO)."

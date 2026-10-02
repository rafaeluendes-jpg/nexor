#!/usr/bin/env bash
# Coloca as funções do servidor (cupom fiscal, criar usuário, API...) no
# Supabase da VPS. Rodar de dentro do repositório nexor:
#   bash migracao-vps/publicar-funcoes.sh
set -euo pipefail
ALVO=/opt/joia/supabase/volumes/functions
RAIZ=$(cd "$(dirname "$0")/.." && pwd)
for f in "$RAIZ"/supabase/functions/*/; do
  nome=$(basename "$f")
  [ -f "$f/index.ts" ] || continue
  mkdir -p "$ALVO/$nome"
  cp -rf "$f". "$ALVO/$nome/"
  echo "  função: $nome"
done
cd /opt/joia/supabase && docker compose restart functions
echo "ok: funções publicadas na VPS."

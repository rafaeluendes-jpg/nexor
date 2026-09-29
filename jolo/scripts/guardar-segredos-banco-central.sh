#!/usr/bin/env bash
# ============================================================
# Guarda no servidor as duas chaves que a mudança do BANCO da Central
# para a VPS precisa, sem passarem por chat, código ou histórico:
#
#   1. a senha do banco (Supabase → Database → senha)  — para copiar
#      os dados, os logins e os arquivos
#   2. o JWT secret "legacy" (Supabase → JWT Keys)      — para as
#      chaves e as sessões de hoje continuarem valendo na VPS, sem
#      ninguém precisar entrar de novo
#
# Digitado escondido, vai para /etc/jolo/central-banco.env (600, root).
# Uso (no servidor, como root):
#   bash /opt/jolo/jolo/scripts/guardar-segredos-banco-central.sh
# ============================================================
set -Eeuo pipefail

ARQ="${ARQ:-/etc/jolo/central-banco.env}"
install -d -m 700 "$(dirname "$ARQ")"

ler() {  # $1 = pergunta ; devolve sem espacos
  local v
  read -rsp "$1" v; echo >&2
  printf '%s' "$v" | tr -d '[:space:]'
}

SENHA="$(ler 'Cole a SENHA DO BANCO e aperte Enter: ')"
[[ ${#SENHA} -ge 8 ]] || { echo "Senha curta demais. Nada foi gravado."; exit 1; }

JWT="$(ler 'Cole o JWT SECRET e aperte Enter: ')"
[[ ${#JWT} -ge 32 ]] || { echo "Isso nao parece o JWT secret. Nada foi gravado."; exit 1; }

umask 077
TMP="$(mktemp "$(dirname "$ARQ")/.banco.XXXXXX")"
printf 'CENTRAL_DB_SENHA=%s\nCENTRAL_JWT_SECRET=%s\n' "$SENHA" "$JWT" > "$TMP"
chmod 600 "$TMP"
mv "$TMP" "$ARQ"
echo "As duas chaves foram guardadas com seguranca."

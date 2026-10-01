#!/usr/bin/env bash
# Guarda a chave da IA (Anthropic) da Central no servidor, escondida, e
# reinicia a Central. Uso (root): bash /opt/jolo/jolo/scripts/guardar-chave-ia-central.sh
set -Eeuo pipefail
ARQ="${ARQ:-/etc/jolo/central.env}"
read -rsp "Cole a chave da IA (comeca com sk-ant-) e aperte Enter: " CHAVE; echo
CHAVE="$(printf '%s' "$CHAVE" | tr -d '[:space:]')"
CHAVE="sk-ant-${CHAVE##*sk-ant-}"   # colou duas vezes? fica a ultima inteira
[[ "$CHAVE" =~ ^sk-ant-[A-Za-z0-9_-]{20,}$ ]] || { echo "Isso nao parece a chave da IA. Nada foi gravado."; exit 1; }
umask 077
TMP="$(mktemp "$(dirname "$ARQ")/.ia.XXXXXX")"
grep -v '^ANTHROPIC_API_KEY=' "$ARQ" > "$TMP" || true
printf 'ANTHROPIC_API_KEY=%s\n' "$CHAVE" >> "$TMP"
chmod 600 "$TMP"; mv "$TMP" "$ARQ"
[[ "${SEM_REINICIAR:-0}" == 1 ]] || docker compose -f /opt/jolo/jolo/infra/docker/docker-compose.sistemas.yml -p jolo-sistemas up -d --no-deps --force-recreate jolo-central >/dev/null 2>&1
echo "Chave da IA guardada com seguranca."

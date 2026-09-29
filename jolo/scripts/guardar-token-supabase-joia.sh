#!/usr/bin/env bash
# ============================================================
# Guarda no servidor o token de acesso da conta Supabase (o que comeca
# com sb_) e, com ele, publica a funcao fiscal do Joia — a parte do
# servidor que a tela nova precisa.
#
# O token e digitado escondido e vai para /etc/jolo/joia.env (600, so
# root). Ele nao aparece na tela e nao entra em codigo nenhum.
#
# Uso (no servidor, como root):
#   bash /opt/jolo/jolo/scripts/guardar-token-supabase-joia.sh
# ============================================================
set -Eeuo pipefail

ARQ="${ARQ:-/etc/jolo/joia.env}"
PROJETO="${PROJETO:-cevghkndzpzvnzwifhnm}"
FONTE="${FONTE:-/opt/joia-fonte}"
install -d -m 700 "$(dirname "$ARQ")"

read -rsp "Cole o token de acesso do Supabase e aperte Enter: " TOKEN
echo
TOKEN="$(printf '%s' "$TOKEN" | tr -d '[:space:]')"
# colou duas vezes sem querer: fica a ultima inteira
case "$TOKEN" in *sbp_*) TOKEN="sbp_${TOKEN##*sbp_}" ;; esac

if [[ ! "$TOKEN" =~ ^sbp_[A-Za-z0-9]{20,}$ ]]; then
  echo "Isso nao parece o token de acesso (ele comeca com sbp_). Nada foi gravado."
  exit 1
fi

umask 077
TMP="$(mktemp "$(dirname "$ARQ")/.joia.XXXXXX")"
[[ -f "$ARQ" ]] && grep -v '^SUPABASE_ACCESS_TOKEN=' "$ARQ" > "$TMP" || true
printf 'SUPABASE_ACCESS_TOKEN=%s\n' "$TOKEN" >> "$TMP"
chmod 600 "$TMP"; mv "$TMP" "$ARQ"
echo "Token guardado com seguranca."

[[ "${SO_GUARDAR:-0}" == 1 ]] && exit 0

echo "Publicando a funcao fiscal..."
bash /opt/jolo/jolo/scripts/publicar-funcao-fiscal.sh

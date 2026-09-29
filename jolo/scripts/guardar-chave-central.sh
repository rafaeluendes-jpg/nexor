#!/usr/bin/env bash
# ============================================================
# Guarda no servidor a chave secreta (service_role) do Supabase da
# Central Jolô, sem ela passar por chat, código ou histórico.
#
# A chave é digitada/colada escondida e vai para /etc/jolo/central.env,
# que só o root lê (600). Nada é impresso na tela.
#
# Uso (no servidor, como root):  bash /opt/jolo/jolo/scripts/guardar-chave-central.sh
# ============================================================
set -Eeuo pipefail

ARQ="${ARQ:-/etc/jolo/central.env}"
install -d -m 700 "$(dirname "$ARQ")"

read -rsp "Cole a chave secreta (service_role) da Central e aperte Enter: " CHAVE
echo
CHAVE="$(printf '%s' "$CHAVE" | tr -d '[:space:]')"

# Colar duas vezes sem querer junta as chaves numa linha so (aconteceu
# em 29/09/2026). Fica a primeira chave inteira: a JWT, se houver; se nao,
# a primeira sb_secret_.
JWT="$(grep -oE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}' <<<"$CHAVE" | head -1 || true)"
if [[ -n "$JWT" ]]; then
  CHAVE="$JWT"
elif [[ "$CHAVE" == sb_secret_*sb_secret_* ]]; then
  CHAVE="sb_secret_$(awk -F'sb_secret_' '{print $2}' <<<"$CHAVE")"
fi

# A service_role e um JWT (tres partes separadas por ponto) ou, no
# formato novo, comeca com sb_secret_. Qualquer outra coisa e engano.
if [[ ! "$CHAVE" =~ ^(sb_secret_[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$ ]]; then
  echo "Isso nao parece a chave secreta. Nada foi gravado."
  exit 1
fi

umask 077
TMP="$(mktemp "$(dirname "$ARQ")/.central.XXXXXX")"
[[ -f "$ARQ" ]] && grep -v '^SUPABASE_SERVICE_ROLE_KEY=' "$ARQ" > "$TMP" || true
printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "$CHAVE" >> "$TMP"
chmod 600 "$TMP"
mv "$TMP" "$ARQ"
echo "Chave guardada com seguranca."

#!/usr/bin/env bash
# ============================================================
# Publica no servidor a versao que ja esta em /opt/jolo, com os enderecos
# definitivos (infra/deployment/dominios.env), e confere que subiu.
#
# E o UNICO comando que o Claude do servidor tem autorizacao fixa para
# rodar sem pedir confirmacao (.claude/settings.json). Ele nao recebe
# parametro nenhum de fora: o que ele faz esta todo escrito aqui.
#
# Uso (no servidor, como root):  bash /opt/jolo/jolo/scripts/publicar.sh
# ============================================================
set -Eeuo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="${LOG:-/root/instalacao.log}"

set -a
# shellcheck disable=SC1091
. "$APP/infra/deployment/dominios.env"
set +a

echo "publicando: ${DOMINIO_LANDING}, ${DOMINIO_CRM} (motor em ${DOMINIO_API})"
# O codigo e o que esta aqui no servidor (/opt/jolo): nada e baixado de
# fora. Sem isto o instalador buscaria a versao do GitHub e apagaria o que
# foi alterado aqui.
export SEM_GIT=sim
if ! bash "$APP/scripts/instalar-vps.sh" > "$LOG" 2>&1; then
  echo "a publicacao falhou; ultimas linhas do registro ($LOG):"
  tail -40 "$LOG"
  exit 1
fi
tail -15 "$LOG"

echo
echo "conferencia de fora para dentro:"
for URL in "https://${DOMINIO_LANDING}/" "https://${DOMINIO_CRM}/login" "https://${DOMINIO_API}/health"; do
  printf '  %-45s %s\n' "$URL" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL" || echo falhou)"
done

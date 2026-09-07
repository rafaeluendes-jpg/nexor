#!/usr/bin/env bash
# Copia de seguranca do banco do CRM.
# Uso:  ./scripts/backup.sh [pasta-destino]
# Le a DATABASE_URL do .env. Guarda um arquivo comprimido por dia e
# apaga os mais velhos que RETENCAO_DIAS (padrao 30).
set -euo pipefail

# A DATABASE_URL do Prisma traz parametros que o pg_dump/pg_restore nao
# entendem (?schema=, connection_limit, pgbouncer). Aqui ficam so os que
# o Postgres reconhece.
url_para_postgres() {
  local url="$1" base="${1%%\?*}" consulta="" par chave
  case "$url" in *\?*) consulta="${url#*\?}" ;; esac
  local mantidos=""
  local IFS='&'
  for par in $consulta; do
    chave="${par%%=*}"
    case "$chave" in
      sslmode|sslrootcert|sslcert|sslkey|application_name|connect_timeout|options)
        mantidos="${mantidos:+$mantidos&}$par" ;;
    esac
  done
  printf '%s%s' "$base" "${mantidos:+?$mantidos}"
}

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="${1:-$RAIZ/var/backups}"
RETENCAO_DIAS="${RETENCAO_DIAS:-30}"


# Le uma variavel do .env sem executar o arquivo: um valor com espaco ou
# com "!" nao pode virar comando por descuido de quem preencheu.
ler_env() {
  local chave="$1" arquivo="$RAIZ/.env" linha
  [ -f "$arquivo" ] || return 0
  linha="$(grep -m1 "^${chave}=" "$arquivo" || true)"
  linha="${linha#*=}"
  linha="${linha%%$'\r'}"
  case "$linha" in
    \"*\") linha="${linha#\"}"; linha="${linha%%\"*}" ;;
    \'*\') linha="${linha#\'}"; linha="${linha%%\'*}" ;;
    *) linha="${linha%%[[:space:]]#*}"; linha="${linha%%[[:space:]]}" ;;
  esac
  printf '%s' "$linha"
}

DATABASE_URL="${DATABASE_URL:-$(ler_env DATABASE_URL)}"
: "${DATABASE_URL:?DATABASE_URL nao definida (veja .env)}"
URL_PG="$(url_para_postgres "$DATABASE_URL")"

mkdir -p "$DESTINO"
CARIMBO="$(date +%Y-%m-%d_%H%M%S)"
ARQUIVO="$DESTINO/jolo-crm-$CARIMBO.dump"

echo "Copiando o banco para $ARQUIVO"
# formato custom (-Fc): restaura com pg_restore, aceita restauracao parcial
pg_dump --dbname="$URL_PG" --format=custom --no-owner --no-privileges --file="$ARQUIVO"

TAMANHO="$(du -h "$ARQUIVO" | cut -f1)"
echo "Copia concluida: $ARQUIVO ($TAMANHO)"

# a copia so vale se der para ler o indice dela
if ! pg_restore --list "$ARQUIVO" > /dev/null 2>&1; then
  echo "ERRO: a copia saiu ilegivel. Nao apague nada e refaca." >&2
  exit 1
fi
echo "Copia verificada (indice legivel)."

APAGADOS="$(find "$DESTINO" -name 'jolo-crm-*.dump' -mtime "+$RETENCAO_DIAS" -print -delete | wc -l)"
[ "$APAGADOS" -gt 0 ] && echo "Copias antigas apagadas: $APAGADOS"
exit 0

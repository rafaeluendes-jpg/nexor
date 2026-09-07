#!/usr/bin/env bash
# Restauracao do banco do CRM a partir de uma copia.
# Uso:  ./scripts/restaurar.sh caminho/da/copia.dump [URL_DO_BANCO_DESTINO]
#
# ATENCAO: apaga o conteudo do banco de destino antes de restaurar.
# Sem o segundo argumento ele usa a DATABASE_URL do .env — ou seja,
# o banco em uso. Restaure primeiro numa copia de teste.
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
COPIA="${1:?informe o arquivo da copia}"
[ -f "$COPIA" ] || { echo "Arquivo nao encontrado: $COPIA" >&2; exit 1; }


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
DESTINO="${2:-${DATABASE_URL:?DATABASE_URL nao definida}}"
URL_PG="$(url_para_postgres "$DESTINO")"

# nunca imprimir a senha que vem dentro da URL
mascarar() { printf '%s' "$1" | sed -E 's#(://[^:/@]+):[^@]*@#\1:***@#'; }
echo "Copia:   $COPIA"
echo "Destino: $(mascarar "${DESTINO%%\?*}")"
if [ "${CONFIRMADO:-nao}" != "sim" ]; then
  read -r -p "Isto APAGA o banco de destino. Digite 'restaurar' para seguir: " resposta
  [ "$resposta" = "restaurar" ] || { echo "Cancelado."; exit 1; }
fi

pg_restore --dbname="$URL_PG" --clean --if-exists --no-owner --no-privileges --exit-on-error "$COPIA"
echo "Restauracao concluida."

# conferencia: as tabelas principais precisam existir e responder
psql "$URL_PG" -tAc "select
  (select count(*) from users)         as usuarios,
  (select count(*) from leads)         as leads,
  (select count(*) from contacts)      as contatos,
  (select count(*) from pipeline_stages) as etapas;"

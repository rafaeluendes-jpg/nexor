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
chmod 700 "$DESTINO"   # copia de banco com dado de cliente: so o dono le
CARIMBO="$(date +%Y-%m-%d_%H%M%S)"
ARQUIVO="$DESTINO/jolo-crm-$CARIMBO.dump"

# No servidor o banco roda num container: o pg_dump de dentro dele e da
# mesma versao do banco. O pg_dump da maquina pode ser mais velho e recusar.
if command -v docker > /dev/null 2>&1 \
   && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx jolo-postgres; then
  NO_CONTAINER=sim
else
  NO_CONTAINER=""
fi

umask 077
echo "Copiando o banco para $ARQUIVO"
# formato custom (-Fc): restaura com pg_restore, aceita restauracao parcial
if [ -n "$NO_CONTAINER" ]; then
  USUARIO_PG="$(ler_env POSTGRES_USER)"; BANCO_PG="$(ler_env POSTGRES_DB)"
  docker exec jolo-postgres pg_dump -U "${USUARIO_PG:-jolo}" -d "${BANCO_PG:-jolo_franquias}" \
    --format=custom --no-owner --no-privileges > "$ARQUIVO"
else
  pg_dump --dbname="$URL_PG" --format=custom --no-owner --no-privileges --file="$ARQUIVO"
fi

TAMANHO="$(du -h "$ARQUIVO" | cut -f1)"
echo "Copia concluida: $ARQUIVO ($TAMANHO)"

# a copia so vale se der para ler o indice dela
if [ -n "$NO_CONTAINER" ]; then
  LEGIVEL() { docker exec -i jolo-postgres pg_restore --list < "$ARQUIVO" > /dev/null 2>&1; }
else
  LEGIVEL() { pg_restore --list "$ARQUIVO" > /dev/null 2>&1; }
fi
if ! LEGIVEL; then
  echo "ERRO: a copia saiu ilegivel. Nao apague nada e refaca." >&2
  exit 1
fi
echo "Copia verificada (indice legivel)."

# Documentos enviados pelo CRM (contratos, COF, planilhas exportadas) e a
# configuracao do servidor: sem eles, o banco sozinho nao reergue o sistema.
ARQUIVOS=()
for PASTA in "$RAIZ/apps/api/var/storage" "$RAIZ/var/storage" "$RAIZ/workers/var/storage"; do
  [ -d "$PASTA" ] && ARQUIVOS+=("${PASTA#"$RAIZ/"}")
done
[ -f "$RAIZ/.env" ] && ARQUIVOS+=(".env")
if [ "${#ARQUIVOS[@]}" -gt 0 ]; then
  PACOTE="$DESTINO/jolo-arquivos-$CARIMBO.tar.gz"
  tar -czf "$PACOTE" -C "$RAIZ" "${ARQUIVOS[@]}"
  echo "Arquivos e configuracao: $PACOTE ($(du -h "$PACOTE" | cut -f1))"
fi

APAGADOS="$(find "$DESTINO" \( -name 'jolo-crm-*.dump' -o -name 'jolo-arquivos-*.tar.gz' \) -mtime "+$RETENCAO_DIAS" -print -delete | wc -l)"
[ "$APAGADOS" -gt 0 ] && echo "Copias antigas apagadas: $APAGADOS"
exit 0

#!/usr/bin/env bash
# ============================================================
# Emergencia de seguranca (29/09/2026): o administrador do CRM foi criado
# com a senha padrao que esta escrita no codigo - e o codigo e publico.
# Este script desliga essa senha e derruba qualquer sessao aberta com ela.
# Ninguem entra como administrador ate receber um link de acesso novo
# (scripts/link-de-acesso.sh).
#
# Uso (no servidor, como root): bash /opt/jolo/jolo/scripts/bloquear-senha-padrao.sh
# ============================================================
set -Eeuo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
# shellcheck disable=SC1091
. "$APP/.env"
set +a

docker exec -i jolo-postgres psql -v ON_ERROR_STOP=1 -q \
  -U "${POSTGRES_USER:-jolo}" -d "${POSTGRES_DB:-jolo_franquias}" <<'SQL'
-- so o administrador criado pela semente; contas criadas depois nao sao tocadas
UPDATE users SET "devPasswordHash" = NULL WHERE email = 'admin@jologelato.com.br';
UPDATE user_sessions SET "revokedAt" = now()
 WHERE "revokedAt" IS NULL
   AND "userId" IN (SELECT id FROM users WHERE email = 'admin@jologelato.com.br');
SQL

SEM_SENHA="$(docker exec jolo-postgres psql -tA -U "${POSTGRES_USER:-jolo}" -d "${POSTGRES_DB:-jolo_franquias}" \
  -c "select count(*) from users where email='admin@jologelato.com.br' and \"devPasswordHash\" is null")"
echo "senha padrao desligada: ${SEM_SENHA} conta(s) de administrador sem senha e sem sessao aberta"

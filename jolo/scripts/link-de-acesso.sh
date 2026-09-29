#!/usr/bin/env bash
# ============================================================
# Gera um link de acesso de uso unico para o administrador do CRM criar a
# propria senha. O link vale 2 horas e morre no primeiro uso; gerar outro
# invalida o anterior. A senha nunca passa por conversa nenhuma.
#
# Para os demais usuarios, o administrador gera o link pela tela Usuarios.
#
# Uso (no servidor, como root): bash /opt/jolo/jolo/scripts/link-de-acesso.sh
# ============================================================
set -Eeuo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EMAIL="admin@jologelato.com.br"
set -a
# shellcheck disable=SC1091
. "$APP/.env"
set +a

TOKEN="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n')"
HASH="$(printf '%s' "$TOKEN" | sha256sum | cut -d' ' -f1)"

CRIADOS="$(docker exec -i jolo-postgres psql -v ON_ERROR_STOP=1 -tA -q \
  -U "${POSTGRES_USER:-jolo}" -d "${POSTGRES_DB:-jolo_franquias}" <<SQL
UPDATE access_links SET "usedAt" = now()
 WHERE "usedAt" IS NULL AND "userId" IN (SELECT id FROM users WHERE email = '${EMAIL}');
INSERT INTO access_links (id, "organizationId", "userId", "tokenHash", "expiresAt")
SELECT gen_random_uuid(), u."organizationId", u.id, '${HASH}', now() + interval '2 hours'
  FROM users u WHERE u.email = '${EMAIL}' AND u.status = 'ACTIVE'
RETURNING 1;
SQL
)"
[ "$CRIADOS" = "1" ] || { echo "administrador ${EMAIL} nao encontrado ou desativado" >&2; exit 1; }

echo "Link de acesso do administrador (vale 2 horas, uma vez so):"
echo "${CRM_PUBLIC_URL%/}/definir-senha#t=${TOKEN}"

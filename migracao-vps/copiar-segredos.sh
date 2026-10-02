#!/usr/bin/env bash
# O cofre (vault) guarda as chaves da Spedy e o CSC criptografados com a chave
# do projeto de origem — na VPS eles chegam ilegíveis. Este script lê os
# valores abertos na origem e grava de novo no cofre da VPS.
# NADA é impresso: o arquivo temporário tem permissão 600 e é apagado no fim.
set -euo pipefail
source /opt/joia/migracao.env
T=$(mktemp); chmod 600 "$T"
trap 'shred -u "$T" 2>/dev/null || rm -f "$T"' EXIT
psql "$ORIGEM_DB_URL" -At -F $'\x1f' -c \
  "select name, encode(convert_to(decrypted_secret,'UTF8'),'base64'), coalesce(description,'') from vault.decrypted_secrets" > "$T"
N=$(wc -l < "$T")
psql "$DESTINO_DB_URL" -v ON_ERROR_STOP=1 -c "delete from vault.secrets" >/dev/null
while IFS=$'\x1f' read -r nome b64 desc; do
  psql "$DESTINO_DB_URL" -v ON_ERROR_STOP=1 -q \
    -v nome="$nome" -v b64="$b64" -v desc="$desc" \
    -c "select vault.create_secret(convert_from(decode(:'b64','base64'),'UTF8'), :'nome', :'desc')" >/dev/null
done < "$T"
M=$(psql "$DESTINO_DB_URL" -At -c "select count(*) from vault.decrypted_secrets where decrypted_secret is not null")
echo "ok: $M de $N segredo(s) gravados no cofre da VPS (valores não exibidos)."
[ "$M" = "$N" ]

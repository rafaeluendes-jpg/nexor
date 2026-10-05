#!/usr/bin/env bash
# ============================================================
# Cópia diária do que NÃO é o banco do CRM (esse já vai pelo backup.sh):
#
#   - o código do Joia/CRM e da Central, com o histórico inteiro
#     (git bundle: dá para refazer o repositório só com este arquivo)
#   - o Joia como está no ar (/var/www/joia/atual)
#   - a configuração do servidor: nginx, serviços e os segredos de
#     /etc/jolo (o arquivo sai 600, só root lê — como o original)
#
# A cópia de FORA da VPS é o backup diário da Hostinger, que leva o disco
# inteiro, estas pastas inclusive.
#
# Uso:  bash backup-sistemas.sh [/var/backups/jolo]
# ============================================================
set -Eeuo pipefail
umask 077

DESTINO="${1:-/var/backups/jolo}"
RETENCAO_DIAS="${RETENCAO_DIAS:-30}"
QUANDO="$(date +%Y-%m-%d_%H%M%S)"
PASTA="$DESTINO/sistemas-$QUANDO"
install -d -m 700 "$PASTA"

for REPO in /opt/jolo /opt/central; do
  [[ -d "$REPO/.git" ]] || continue
  NOME="$(basename "$REPO")"
  git -c safe.directory="$REPO" -C "$REPO" bundle create -q "$PASTA/codigo-$NOME.bundle" --all
  git -c safe.directory="$REPO" -C "$REPO" bundle verify -q "$PASTA/codigo-$NOME.bundle" >/dev/null 2>&1
done

[[ -d /var/www/joia/atual ]] && tar -C /var/www/joia/atual -czf "$PASTA/joia-no-ar.tar.gz" .

# o banco da Central (Supabase na VPS, desde 29/09/2026): banco inteiro,
# logins inclusive, e as fotos. O pg_restore -l prova que a copia abre.
if docker inspect -f '{{.State.Running}}' central-db 2>/dev/null | grep -q true; then
  docker exec central-db pg_dump -U supabase_admin -d postgres -Fc > "$PASTA/central-banco.dump"
  docker exec -i central-db pg_restore -l < "$PASTA/central-banco.dump" > /dev/null
  tar -C /opt/supabase-central -czf "$PASTA/central-arquivos.tar.gz" volumes/storage volumes/functions .env docker-compose.central.yml
fi

# a Gestao de Franquias (gestao.jologelato.com.br): banco (container
# gestao-postgres, desde 01/10/2026) e a pasta do sistema com os documentos
# enviados, sem as dependencias que a compilacao refaz.
if docker inspect -f '{{.State.Running}}' gestao-postgres 2>/dev/null | grep -q true; then
  docker exec gestao-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$PASTA/gestao-banco.dump"
  docker exec -i gestao-postgres pg_restore -l < "$PASTA/gestao-banco.dump" > /dev/null
fi
[[ -d /var/www/jolo-gestao ]] && tar -C /var/www -czf "$PASTA/gestao-arquivos.tar.gz" \
  --exclude='jolo-gestao/node_modules' --exclude='jolo-gestao/.next/cache' jolo-gestao

tar -czf "$PASTA/configuracao.tar.gz" \
  --ignore-failed-read \
  /etc/nginx/sites-available /etc/nginx/jolo-proxy.conf \
  /etc/systemd/system/jolo-*.service /etc/systemd/system/jolo-*.timer \
  /opt/jolo/jolo/infra/docker /opt/supabase-central/docker-compose.central.yml \
  /etc/jolo /etc/fail2ban/jail.d 2>/dev/null

# confere que cada arquivo abre antes de apagar os antigos
for F in "$PASTA"/*.tar.gz; do gzip -t "$F"; done

find "$DESTINO" -maxdepth 1 -name 'sistemas-*' -type d -mtime +"$RETENCAO_DIAS" -exec rm -rf {} +
echo "copia dos sistemas: $PASTA ($(du -sh "$PASTA" | cut -f1))"

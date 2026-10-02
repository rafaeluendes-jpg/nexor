#!/usr/bin/env bash
# Cópia do banco todo dia às 3h, guardada 14 dias. Instalar com:
#   (crontab -l 2>/dev/null; echo "0 3 * * * bash /opt/joia/backup-diario.sh") | crontab -
set -euo pipefail
source /opt/joia/migracao.env
mkdir -p /opt/joia/backups && chmod 700 /opt/joia/backups
pg_dump "$DESTINO_DB_URL" -Fc -f /opt/joia/backups/joia-$(date +%Y%m%d).dump
find /opt/joia/backups -name 'joia-*.dump' -mtime +14 -delete

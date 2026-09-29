#!/usr/bin/env bash
# ============================================================
# Liga o backup automatico do servidor: todo dia de madrugada copia o
# banco do CRM, os documentos enviados e a configuracao, confere que a
# copia abre, e guarda 30 dias. Roda uma vez na hora, para provar.
#
# Uso (no servidor, como root):  bash scripts/ligar-backup.sh
# Ver as copias:                 ls -lh /var/backups/jolo
# Ver o ultimo resultado:        journalctl -u jolo-backup -n 20
# ============================================================
set -Eeuo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="${DESTINO:-/var/backups/jolo}"
HORA="${HORA:-03:15}"
DIR_SYSTEMD="${DIR_SYSTEMD:-/etc/systemd/system}"

[ "$(id -u)" = "0" ] || { echo "rode como root" >&2; exit 1; }

mkdir -p "$DESTINO"
chmod 700 "$DESTINO"

cat > "${DIR_SYSTEMD}/jolo-backup.service" <<FIMUNIT
[Unit]
Description=Jolo Franquias - copia de seguranca do banco e dos arquivos
After=docker.service

[Service]
Type=oneshot
Environment=HOME=/root
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=RETENCAO_DIAS=30
ExecStart=/bin/bash ${APP}/scripts/backup.sh ${DESTINO}
FIMUNIT

cat > "${DIR_SYSTEMD}/jolo-backup.timer" <<FIMUNIT
[Unit]
Description=Jolo Franquias - copia de seguranca diaria

[Timer]
OnCalendar=*-*-* ${HORA}:00
# servidor desligado na hora marcada: faz assim que voltar
Persistent=true
RandomizedDelaySec=10min

[Install]
WantedBy=timers.target
FIMUNIT

systemctl daemon-reload
systemctl enable --now jolo-backup.timer > /dev/null

# prova: uma copia agora
systemctl start jolo-backup.service
if systemctl is-failed --quiet jolo-backup.service; then
  journalctl -u jolo-backup -n 30 --no-pager
  echo "a primeira copia falhou (registro acima)" >&2
  exit 1
fi
echo "backup ligado: todo dia as ${HORA}, guardando 30 dias em ${DESTINO}"
ls -lh "$DESTINO" | tail -3
systemctl list-timers jolo-backup.timer --no-pager | head -3

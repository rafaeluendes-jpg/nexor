#!/usr/bin/env bash
# ============================================================
# Confere os backups de dentro da VPS. SO LE: nao cria, nao apaga,
# nao restaura e nao mostra conteudo de banco nem segredo.
#
# Uso (no servidor, como root):  bash /opt/jolo/jolo/scripts/conferir-backups.sh
# ============================================================
set -uo pipefail
DESTINO="${DESTINO:-/var/backups/jolo}"
AGORA="$(date +%s)"
PROBLEMAS=0

idade() { # idade <arquivo> -> "ha Xh"
  local s=$(( (AGORA - $(stat -c %Y "$1")) / 3600 ))
  echo "ha ${s}h"
}
abre_dump() { # prova que o .dump abre, sem restaurar
  local f="$1" c
  for c in jolo-postgres central-db gestao-postgres; do
    docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null | grep -q true || continue
    docker exec -i "$c" pg_restore -l < "$f" >/dev/null 2>&1 && { echo sim; return; }
  done
  echo NAO
}
linha() { printf '%-24s | %-17s | %-8s | %-6s | %s\n' "$@"; }

echo "== Rotinas de backup =="
systemctl list-timers --all --no-pager 2>/dev/null | grep -i backup || echo "nenhuma rotina de backup encontrada"
for U in jolo-backup jolo-backup-sistemas; do
  systemctl cat "$U.service" >/dev/null 2>&1 || continue
  R="$(systemctl show "$U.service" -p Result --value)"
  echo "$U: ultima execucao terminou com '$R'"
  [ "$R" = success ] || PROBLEMAS=$((PROBLEMAS + 1))
done

echo
echo "== Copias em $DESTINO =="
linha "o que" "ultima copia" "tamanho" "abre?" "idade"
ultimo() { ls -t $1 2>/dev/null | head -1; }

F="$(ultimo "$DESTINO/jolo-crm-*.dump")"
if [ -n "$F" ]; then
  OK="$(abre_dump "$F")"; [ "$OK" = sim ] || PROBLEMAS=$((PROBLEMAS + 1))
  linha "CRM - banco" "$(date -r "$F" '+%d/%m %H:%M')" "$(du -h "$F" | cut -f1)" "$OK" "$(idade "$F")"
else linha "CRM - banco" "NENHUMA" "-" "-" "-"; PROBLEMAS=$((PROBLEMAS + 1)); fi

F="$(ultimo "$DESTINO/jolo-arquivos-*.tar.gz")"
if [ -n "$F" ]; then
  gzip -t "$F" 2>/dev/null && OK=sim || { OK=NAO; PROBLEMAS=$((PROBLEMAS + 1)); }
  linha "CRM - documentos" "$(date -r "$F" '+%d/%m %H:%M')" "$(du -h "$F" | cut -f1)" "$OK" "$(idade "$F")"
fi

P="$(ls -td "$DESTINO"/sistemas-* 2>/dev/null | head -1)"
if [ -n "$P" ]; then
  for F in "$P"/*; do
    if [ ! -s "$F" ]; then
      PROBLEMAS=$((PROBLEMAS + 1))
      linha "$(basename "$F" | sed 's/\..*//')" "$(date -r "$F" '+%d/%m %H:%M')" "0" "VAZIO" "$(idade "$F")"
      continue
    fi
    case "$F" in
      *.dump) OK="$(abre_dump "$F")" ;;
      *.tar.gz) gzip -t "$F" 2>/dev/null && OK=sim || OK=NAO ;;
      *.bundle) git bundle verify -q "$F" >/dev/null 2>&1 && OK=sim || OK=NAO ;;
      *) OK="-" ;;
    esac
    [ "$OK" = NAO ] && PROBLEMAS=$((PROBLEMAS + 1))
    linha "$(basename "$F" | sed 's/\..*//')" "$(date -r "$F" '+%d/%m %H:%M')" "$(du -h "$F" | cut -f1)" "$OK" "$(idade "$F")"
  done
else linha "demais sistemas" "NENHUMA" "-" "-" "-"; PROBLEMAS=$((PROBLEMAS + 1)); fi

echo
echo "Copias guardadas: $(ls "$DESTINO"/jolo-crm-*.dump 2>/dev/null | wc -l) do CRM, $(ls -d "$DESTINO"/sistemas-* 2>/dev/null | wc -l) dos demais sistemas (guarda 30 dias)"
echo "Espaco das copias: $(du -sh "$DESTINO" 2>/dev/null | cut -f1)  |  disco: $(df -h / | awk 'NR==2{print $3" usados de "$2", livre "$4}')"
echo
[ "$PROBLEMAS" -eq 0 ] && echo "RESULTADO: backups de dentro da VPS em dia e abrindo." \
  || echo "RESULTADO: $PROBLEMAS ponto(s) com problema (veja acima)."

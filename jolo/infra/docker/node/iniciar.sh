#!/bin/sh
# Carrega a configuracao do jeito que o servidor ja carregava (os mesmos
# arquivos .env de antes, lidos na hora de subir: trocar uma chave e
# reiniciar o container basta) e depois aplica o que e fixo do servico.
#   ARQUIVOS_ENV="/a.env:/b.env"   FIXAR="NODE_ENV=production"
#   CORRER_COMO="999:987"  le a configuracao como root (ela e so do root,
#   600) e so entao roda o programa com o usuario sem privilegio.
set -e
IFS_ANTES="$IFS"; IFS=':'
for ARQ in ${ARQUIVOS_ENV:-}; do
  [ -r "$ARQ" ] || { echo "configuracao $ARQ nao encontrada" >&2; exit 1; }
  set -a; . "$ARQ"; set +a
done
IFS="$IFS_ANTES"
for PAR in ${FIXAR:-}; do export "$PAR"; done
USUARIO="${CORRER_COMO:-}"
unset ARQUIVOS_ENV FIXAR IFS_ANTES ARQ PAR CORRER_COMO
if [ -n "$USUARIO" ]; then
  exec setpriv --reuid="${USUARIO%:*}" --regid="${USUARIO#*:}" --clear-groups --no-new-privs "$@"
fi
exec "$@"

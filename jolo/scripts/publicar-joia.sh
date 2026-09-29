#!/usr/bin/env bash
# ============================================================
# Publica o Joia (ERP das lojas) na VPS — o mesmo que o GitHub Pages
# publica hoje, montado igual (.github/workflows/pages.yml).
#
# - Sai SEMPRE da `main` (regra 1 do Joia: main = o que está na loja),
#   nunca da branch em que a pasta /opt/jolo estiver trabalhando.
# - Só entra na pasta pública a lista fechada de arquivos do site. Nada
#   de código-fonte, .env, .git, documentos ou pasta do CRM.
# - Cada publicação vai para uma pasta nova e a troca é instantânea
#   (link simbólico): a loja nunca abre um site pela metade. As 5
#   últimas ficam guardadas para voltar atrás em um comando.
#
# Uso (no servidor, como root):  bash /opt/jolo/jolo/scripts/publicar-joia.sh
# ============================================================
set -Eeuo pipefail

REPO="${REPO:-/opt/jolo}"
RAMO="${RAMO:-main}"
RAIZ="/var/www/joia"
NOVA="$RAIZ/versoes/$(date +%Y-%m-%d_%H%M%S)"

git -C "$REPO" fetch -q origin "+refs/heads/$RAMO:refs/remotes/origin/$RAMO"
COMMIT="$(git -C "$REPO" rev-parse --short "origin/$RAMO")"

FONTE="$(mktemp -d)"
trap 'rm -rf "$FONTE"' EXIT
git -C "$REPO" archive "origin/$RAMO" | tar -x -C "$FONTE"

# o enxugador precisa do terser; instala uma vez numa pasta propria
FERRAMENTA=/opt/joia-ferramentas
if [[ ! -d "$FERRAMENTA/node_modules/terser" ]]; then
  install -d "$FERRAMENTA"
  npm install --prefix "$FERRAMENTA" --no-save --no-audit --no-fund terser@5 >/dev/null
fi

install -d -m 755 "$NOVA"
(
  cd "$FONTE"
  cp manifest.json supabase.js "$NOVA/"
  NODE_PATH="$FERRAMENTA/node_modules" node ferramentas/enxugar.js index.html "$NOVA/index.html"
  cp ./*.png ./*.jpg "$NOVA/" 2>/dev/null || true
  [[ -d fotos ]] && cp -r fotos "$NOVA/"
  for d in santafe santafedosul jales alphaville; do
    [[ -d "$d" ]] && cp -r "$d" "$NOVA/"
  done
  [[ -f sw.js ]] && cp sw.js "$NOVA/"
)
echo "$COMMIT" > "$NOVA/.versao"
chmod -R a+rX,go-w "$NOVA"

# conferencia minima antes de trocar: o sistema tem de estar la
[[ -s "$NOVA/index.html" && -s "$NOVA/sw.js" ]] || { echo "montagem incompleta; nada foi trocado"; exit 1; }

ln -sfn "$NOVA" "$RAIZ/atual.novo" && mv -Tf "$RAIZ/atual.novo" "$RAIZ/atual"

# guarda as 5 ultimas
ls -1dt "$RAIZ"/versoes/* | tail -n +6 | xargs -r rm -rf

echo "Joia publicado na VPS: versao $COMMIT"

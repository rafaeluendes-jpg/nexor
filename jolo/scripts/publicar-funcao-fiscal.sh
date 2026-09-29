#!/usr/bin/env bash
# ============================================================
# Publica no Supabase a funcao `joia-fiscal` — a unica porta entre o
# Joia e a Spedy, e a parte do servidor que a tela fiscal precisa.
#
# Sai SEMPRE da `main` (o que esta publicado nas lojas), nunca de uma
# pasta de trabalho: a funcao no ar tem de ser a mesma do sistema no ar.
#
# `--verify-jwt=false` e de proposito e vem de antes: o pedido de
# vistoria do navegador (OPTIONS) chega sem sessao, e a propria funcao
# confere quem esta chamando na primeira linha. Ver o comentario no
# topo do index.ts.
#
# Uso (root):  bash /opt/jolo/jolo/scripts/publicar-funcao-fiscal.sh
# ============================================================
set -Eeuo pipefail

PROJETO="${PROJETO:-cevghkndzpzvnzwifhnm}"
RAMO="${RAMO:-main}"
REPO="${REPO:-/opt/jolo}"
ENVARQ="${ENVARQ:-/etc/jolo/joia.env}"

[[ -s "$ENVARQ" ]] || { echo "falta o token: rode guardar-token-supabase-joia.sh"; exit 1; }
set -a; . "$ENVARQ"; set +a
[[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]] || { echo "o token nao esta em $ENVARQ"; exit 1; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git -C "$REPO" fetch -q origin "+refs/heads/$RAMO:refs/remotes/origin/$RAMO"
git -C "$REPO" archive "origin/$RAMO" | tar -x -C "$TMP"
COMMIT="$(git -C "$REPO" rev-parse --short "origin/$RAMO")"

FN="$TMP/supabase/functions/joia-fiscal/index.ts"
[[ -s "$FN" ]] || { echo "a funcao nao esta na $RAMO"; exit 1; }
ANTES="$(sha256sum "$FN" | cut -d' ' -f1)"
echo "publicando joia-fiscal da $RAMO ($COMMIT), $(wc -c < "$FN") bytes"

cd "$TMP"
supabase functions deploy joia-fiscal \
  --project-ref "$PROJETO" --no-verify-jwt --use-api 2>&1 | tail -5

# conferencia: o que ficou no ar tem de ser byte a byte o da main
DEPOIS="$(supabase functions download joia-fiscal --project-ref "$PROJETO" \
  --output-dir "$TMP/baixada" >/dev/null 2>&1 \
  && sha256sum "$TMP/baixada/joia-fiscal/index.ts" 2>/dev/null | cut -d' ' -f1 || echo "")"
if [[ -n "$DEPOIS" && "$DEPOIS" != "$ANTES" ]]; then
  echo "ATENCAO: o que esta no ar NAO e igual ao da $RAMO."
  exit 1
fi
[[ -n "$DEPOIS" ]] && echo "conferido: byte a byte igual ao da $RAMO."
echo "funcao fiscal publicada ($COMMIT)."

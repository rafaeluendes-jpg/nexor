#!/usr/bin/env bash
# ==========================================================
# Cópia de todo o código no nosso servidor, fora do GitHub.
#
# Ordem do Rafael de 01/10/2026: "faça essa cópia, deixa tudo dentro da
# [Hetzner]. Se um dia eu quiser, só dá o comando, aí você desliga das
# outras coisas."
#
# O que ele faz: guarda em /opt/espelho um espelho COMPLETO de cada
# repositório — todos os ramos, todas as etiquetas, todo o histórico.
# Não é uma pasta com os arquivos de hoje: é o repositório inteiro. De um
# espelho desses dá para subir o sistema em qualquer lugar, sem GitHub,
# com um `git clone /opt/espelho/nexor.git`.
#
# Ele NÃO apaga nada no GitHub e NÃO mexe em nada que está publicado.
# Rodar de novo só atualiza o que mudou.
#
# Como rodar, no servidor:
#     export GH_TOKEN=ghp_...          # ver abaixo
#     bash espelhar-vps.sh
#
# O token é preciso porque 5 dos repositórios são privados. Ele é usado
# só na hora, não é gravado em disco e não aparece no log (a URL com o
# token nunca é impressa, e o espelho guarda a URL sem ele).
# ==========================================================
set -uo pipefail

DESTINO="${DESTINO:-/opt/espelho}"
DONO="rafaeluendes-jpg"

REPOS=(
  nexor                       # Joia — ERP das lojas Jolô (em produção)
  nexor-whatsapp              # robô do WhatsApp do Joia
  nexor-app                   # aplicativo
  delivery                    # cardápio digital / delivery
  painel-rafael-ulian         # painel
  rafaellos-centro-de-gestao  # Central Rafaello's
  Rafael-gest-o-              # Dalu
  r2on                        # R2ON (parado, mas guardado)
  jolo-central                # central Jolô
  sistema-inteligente         # sistema inteligente
)

# 1) o que vier no ambiente; 2) o arquivo guardado; 3) o gh desta máquina
if [ -z "${GH_TOKEN:-}" ] && [ -r "$DESTINO/.token" ]; then
  GH_TOKEN="$(cat "$DESTINO/.token")"
fi
if [ -z "${GH_TOKEN:-}" ] && command -v gh >/dev/null 2>&1; then
  GH_TOKEN="$(gh auth token 2>/dev/null || true)"
fi

# Muita máquina já clona sem token (o gh guarda a credencial no git). Então
# o token não é exigido de saída: é a segunda tentativa, só de quem precisa.
AJUDA_TOKEN='Sem credencial os repositórios privados não vêm. Como gerar o token:
  github.com -> foto -> Settings -> Developer settings
  -> Personal access tokens -> Tokens (classic) -> Generate new token
  -> marque só "repo" -> Generate -> copie
Depois, para valer também na atualização automática de madrugada:
  umask 077; printf %s "cole_aqui" > '"$DESTINO"'/.token
ou, só para agora:  export GH_TOKEN=cole_aqui   e rode de novo.'

mkdir -p "$DESTINO" || { echo "não consegui criar $DESTINO (falta sudo?)"; exit 1; }

ok=0
declare -a problemas=()

# tenta sem credencial e, se falhar, com o token. Devolve 0 se deu.
tentar(){           # $1 = comando: clonar|buscar   $2 = repo   $3 = pasta
  local acao="$1" r="$2" pasta="$3"
  local limpa="https://github.com/$DONO/$r.git"
  local comtoken="https://x-access-token:${GH_TOKEN:-}@github.com/$DONO/$r.git"
  local u
  for u in "$limpa" "$comtoken"; do
    [ "$u" = "$comtoken" ] && [ -z "${GH_TOKEN:-}" ] && continue
    if [ "$acao" = clonar ]; then
      rm -rf "$pasta"
      git clone --mirror "$u" "$pasta" >/dev/null 2>&1 && return 0
    else
      git -C "$pasta" fetch --prune "$u" '+refs/*:refs/*' >/dev/null 2>&1 && return 0
    fi
  done
  return 1
}

for r in "${REPOS[@]}"; do
  pasta="$DESTINO/$r.git"
  limpa="https://github.com/$DONO/$r.git"
  if [ -d "$pasta" ]; then
    printf '  %-28s atualizando... ' "$r"; acao=buscar
  else
    printf '  %-28s copiando...    ' "$r"; acao=clonar
  fi
  if tentar "$acao" "$r" "$pasta"; then
    # o que fica gravado em disco e a URL sem token
    git -C "$pasta" remote set-url origin "$limpa" 2>/dev/null
    echo ok; ok=$((ok+1))
  else
    echo FALHOU; problemas+=("$r")
  fi
done

echo
echo "  ---- conferência (o espelho tem mesmo o conteúdo?) ----"
vazios=0
for r in "${REPOS[@]}"; do
  pasta="$DESTINO/$r.git"
  [ -d "$pasta" ] || continue
  ramos=$(git -C "$pasta" for-each-ref --format='%(refname)' refs/heads 2>/dev/null | wc -l)
  comits=$(git -C "$pasta" rev-list --all --count 2>/dev/null || echo 0)
  tam=$(du -sh "$pasta" 2>/dev/null | cut -f1)
  printf '  %-28s %3s ramos  %6s commits  %6s\n' "$r" "$ramos" "$comits" "$tam"
  # espelho sem nenhum commit é espelho de mentira
  if [ "${comits:-0}" -lt 1 ]; then
    vazios=$((vazios+1)); problemas+=("$r (espelho vazio)")
  fi
done

echo
echo "  copiados/atualizados: $ok de ${#REPOS[@]}"
if [ ${#problemas[@]} -gt 0 ]; then
  echo "  PROBLEMAS:"
  for p in "${problemas[@]}"; do echo "    - $p"; done
  echo
  echo "  NÃO diga que a cópia está pronta enquanto houver problema acima."
  echo
  echo "$AJUDA_TOKEN"
  exit 1
fi

# Espelho que ninguém conseguiu abrir não é cópia de segurança: é pasta.
prova=$(mktemp -d)
if git clone --quiet "$DESTINO/nexor.git" "$prova/nexor" 2>/dev/null \
   && [ -s "$prova/nexor/index.html" ]; then
  echo "  prova: o sistema foi reaberto a partir do espelho, sem GitHub (ok)"
else
  echo "  PROBLEMA: o espelho existe mas não reabriu o sistema. Não é cópia válida."
  rm -rf "$prova"; exit 1
fi
rm -rf "$prova"

echo "  cópia completa em $DESTINO"
echo
echo "  Para manter em dia sozinho (uma vez por dia, de madrugada):"
echo "    (crontab -l 2>/dev/null; echo '17 4 * * * DESTINO=$DESTINO bash $(readlink -f "$0") >> /var/log/espelho.log 2>&1') | crontab -"
echo "  (de madrugada o token vem de $DESTINO/.token — não vai no crontab)"
echo "  Para subir o sistema a partir do espelho, sem GitHub:"
echo "    git clone $DESTINO/nexor.git ~/joia && ls ~/joia"

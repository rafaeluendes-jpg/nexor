#!/usr/bin/env bash
# ==========================================================
# Os sistemas do Rafael no servidor, cada um na sua caixa.
#
# Ordem dele de 01/10/2026: "dentro da VPS, separe tudo por Docker. Tudo
# por pasta, separado, separado por projeto certinho, nada misturado."
#
# O que este arquivo faz: monta /opt/sistemas com uma pasta por projeto.
# Cada pasta tem o codigo, o seu proprio docker-compose, a sua propria
# rede, o seu proprio volume e o seu proprio arquivo de chaves. Nenhum
# projeto alcanca o outro, e nenhum deles escreve na pasta do vizinho.
#
#   /opt/sistemas/
#     jolo-central/    Central Jolo       (Next.js)      127.0.0.1:8081
#     painel-ulian/    Painel Rafael U.   (site)         127.0.0.1:8082
#     r2on/            R2ON               (site)         127.0.0.1:8083
#     dalu/            Dalu               (site)         127.0.0.1:8084
#     rafaellos/       Central Rafaellos  (site)         127.0.0.1:8085
#     zap-assistente/  Assistente WhatsApp (robo)        127.0.0.1:8086
#     espelho/         as copias completas do git
#
# TRES COISAS QUE ELE NAO FAZ, DE PROPOSITO:
#
# 1. Nao encosta no que ja esta no ar. O /opt/dalu, o Supabase proprio e
#    o nginx do servidor ficam exatamente como estao. Nada aqui ocupa a
#    porta 80 nem a 443: cada caixa escuta so em 127.0.0.1, e quem publica
#    para a internet continua sendo o nginx que ja existe. O bloco pronto
#    para ele fica em cada pasta, como nginx-site.conf, para ser ligado a
#    mao quando o Rafael quiser.
#
# 2. Nao liga o assistente do WhatsApp. O WhatsApp aceita UMA sessao por
#    numero: subir uma segunda copia desconecta a que esta atendendo. A
#    caixa fica montada e parada; ligar e uma ordem a parte.
#
# 3. Nao sobrescreve arquivo de chave. Se o .env do projeto ja existe, ele
#    e deixado intacto. Chave que o Rafael colou nao se perde por rodar
#    isto de novo.
#
# Como rodar, no servidor:   bash vps-docker.sh
# Rodar de novo e seguro: atualiza o codigo e reconstroi o que mudou.
# ==========================================================
set -uo pipefail

RAIZ="${RAIZ:-/opt/sistemas}"
DONO="rafaeluendes-jpg"

# id|repositorio|porta|modo|nome de gente
PROJETOS=(
  "jolo-central|jolo-central|8081|next|Central Jolo"
  "painel-ulian|painel-rafael-ulian|8082|site|Painel Rafael Ulian"
  "r2on|r2on|8083|vite|R2ON"
  "dalu|Rafael-gest-o-|8084|site|Dalu"
  "rafaellos|rafaellos-centro-de-gestao|8085|site|Central Rafaellos"
  "zap-assistente|nexor-whatsapp|8086|robo|Assistente WhatsApp"
)

# o assistente do WhatsApp fica montado e PARADO: ver observacao 2 no topo
NAO_LIGAR="zap-assistente"

campo(){ echo "$1" | cut -d'|' -f"$2"; }

# chave que o projeto NAO funciona sem. Serve para separar "quebrado" de
# "montado, esperando o Rafael colar a chave".
exigencias(){
  case "$1" in
    jolo-central)   echo "NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY" ;;
    r2on)           echo "VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY" ;;
    zap-assistente) echo "SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY CHAVE_API" ;;
    *)              echo "" ;;
  esac
}

falta_chave(){
  local id="$1" arq="$RAIZ/$1/.env" n
  [ -f "$arq" ] || return 1
  for n in $(exigencias "$id"); do
    grep -qE "^$n=.+" "$arq" || return 0
  done
  return 1
}

exigir(){
  local falta=0
  for c in git docker; do
    command -v "$c" >/dev/null 2>&1 || { echo "  falta o $c neste servidor"; falta=1; }
  done
  docker compose version >/dev/null 2>&1 || { echo "  falta o 'docker compose' (plugin v2)"; falta=1; }
  [ "$falta" = 0 ] || exit 1
}

# --------------------------------------------------------------------
# 1. o codigo de cada projeto, na pasta dele
# --------------------------------------------------------------------
pegar_codigo(){
  local id="$1" repo="$2" pasta="$RAIZ/$id/repo"
  local limpa="https://github.com/$DONO/$repo.git"
  local comtoken="https://x-access-token:${GH_TOKEN:-}@github.com/$DONO/$repo.git"
  local u
  if [ -d "$pasta/.git" ]; then
    for u in "$limpa" "$comtoken"; do
      [ "$u" = "$comtoken" ] && [ -z "${GH_TOKEN:-}" ] && continue
      git -C "$pasta" remote set-url origin "$u" >/dev/null 2>&1
      if git -C "$pasta" fetch --quiet origin >/dev/null 2>&1; then
        local ramo; ramo=$(git -C "$pasta" symbolic-ref --short HEAD 2>/dev/null || echo main)
        git -C "$pasta" reset --hard "origin/$ramo" >/dev/null 2>&1
        git -C "$pasta" remote set-url origin "$limpa" >/dev/null 2>&1
        return 0
      fi
    done
    git -C "$pasta" remote set-url origin "$limpa" >/dev/null 2>&1
    return 1
  fi
  for u in "$limpa" "$comtoken"; do
    [ "$u" = "$comtoken" ] && [ -z "${GH_TOKEN:-}" ] && continue
    rm -rf "$pasta"
    if git clone --quiet --depth 1 "$u" "$pasta" >/dev/null 2>&1; then
      git -C "$pasta" remote set-url origin "$limpa" >/dev/null 2>&1
      return 0
    fi
  done
  return 1
}

# --------------------------------------------------------------------
# 2. os arquivos da caixa de cada projeto
# --------------------------------------------------------------------
nginx_comum(){
  # Cabecalhos de seguranca iguais aos que o Worker da Cloudflare punha.
  # Sem eles, sair da Cloudflare seria sair com menos protecao do que tinha.
  cat <<'NG'
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
  # sw.js e manifest nunca podem vir do cache velho: e o defeito que faz a
  # loja continuar com o sistema de ontem
  location ~ ^/(sw\.js|manifest\.json|js/config\.js|versao\.json)$ {
    add_header Cache-Control "no-cache" always;
    try_files $uri =404;
  }
NG
}

escrever_site(){      # projeto estatico servido por nginx
  local id="$1" porta="$2" docroot="$3" negar="$4"
  mkdir -p "$RAIZ/$id"
  {
    echo 'server {'
    echo '  listen 80;'
    echo '  root /site;'
    echo '  index index.html;'
    echo '  charset utf-8;'
    nginx_comum
    if [ -n "$negar" ]; then
      echo ''
      echo '  # Fora da Cloudflare o nginx serviria TODO arquivo da pasta. O que'
      echo '  # nao e do aplicativo (codigo de funcao, documento interno, teste)'
      echo '  # nao pode ficar legivel para quem abrir o endereco.'
      echo "  location ~ $negar { deny all; return 404; }"
    fi
    echo ''
    echo '  location / { try_files $uri $uri/ /index.html; }'
    echo '}'
  } > "$RAIZ/$id/nginx.conf"

  cat > "$RAIZ/$id/docker-compose.yml" <<COMPOSE
# $id — caixa propria: rede propria, volume proprio, nada compartilhado
name: $id

services:
  site:
    image: nginx:1.27-alpine
    restart: unless-stopped
    # so em 127.0.0.1: quem publica para a internet e o nginx do servidor
    ports: ["127.0.0.1:$porta:80"]
    volumes:
      - ./repo/$docroot:/site:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    networks: [rede]
    healthcheck:
      # O -Y off desliga proxy: se a maquina tiver http_proxy no ambiente, o
      # wget tentaria sair pela rua para falar com ele mesmo e o sinal de
      # saude acusaria doente um contêiner são. (Visto acontecendo.)
      test: ["CMD", "wget", "-Y", "off", "-qO-", "http://127.0.0.1/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

networks:
  rede:
    name: ${id}_rede
COMPOSE
}

escrever_next(){      # Central Jolo: Next.js
  local id="$1" porta="$2"
  mkdir -p "$RAIZ/$id"
  cat > "$RAIZ/$id/Dockerfile" <<'DOCKER'
# Duas etapas: a primeira constroi, a segunda so roda. A imagem final nao
# leva compilador nem pasta de desenvolvimento.
FROM node:22-alpine AS construir
WORKDIR /app
COPY repo/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; \
    else npm install --no-audit --no-fund; fi
COPY repo/ ./
# As chaves publicas (NEXT_PUBLIC_) entram no JavaScript na hora de construir
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npx next build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=construir /app/package*.json ./
COPY --from=construir /app/node_modules ./node_modules
COPY --from=construir /app/.next ./.next
COPY --from=construir /app/public ./public
COPY --from=construir /app/next.config.ts ./
# nao roda como root
USER node
EXPOSE 3000
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
DOCKER

  cat > "$RAIZ/$id/docker-compose.yml" <<COMPOSE
# $id — caixa propria
name: $id

services:
  app:
    build:
      context: .
      args:
        NEXT_PUBLIC_SUPABASE_URL: \${NEXT_PUBLIC_SUPABASE_URL:-}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: \${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}
        NEXT_PUBLIC_SITE_URL: \${NEXT_PUBLIC_SITE_URL:-}
    restart: unless-stopped
    env_file: [.env]
    ports: ["127.0.0.1:$porta:3000"]
    networks: [rede]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

networks:
  rede:
    name: ${id}_rede
COMPOSE
}

escrever_vite(){      # R2ON: constroi e serve o resultado
  local id="$1" porta="$2"
  mkdir -p "$RAIZ/$id"
  cat > "$RAIZ/$id/Dockerfile" <<'DOCKER'
FROM node:22-alpine AS construir
WORKDIR /app
COPY repo/package.json repo/pnpm-lock.yaml* repo/package-lock.json* ./
# O esbuild e o workerd baixam um binario no passo de instalacao; o pnpm 10
# recusa rodar esse passo sem autorizacao explicita (ERR_PNPM_IGNORED_BUILDS).
# Autorizar ESTES DOIS, pelo nome, e diferente de liberar tudo: dependencia
# nova que peça para rodar script volta a reprovar, e e isso que se quer.
RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && corepack prepare pnpm@10 --activate \
      && pnpm install --frozen-lockfile \
           --config.onlyBuiltDependencies=esbuild,workerd; \
    else npm ci --no-audit --no-fund; fi
COPY repo/ ./
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=construir /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
DOCKER

  {
    echo 'server {'
    echo '  listen 80;'
    echo '  root /usr/share/nginx/html;'
    echo '  index index.html;'
    echo '  charset utf-8;'
    nginx_comum
    echo '  location / { try_files $uri $uri/ /index.html; }'
    echo '}'
  } > "$RAIZ/$id/nginx.conf"

  cat > "$RAIZ/$id/docker-compose.yml" <<COMPOSE
# $id — caixa propria
name: $id

services:
  site:
    build:
      context: .
      args:
        VITE_SUPABASE_URL: \${VITE_SUPABASE_URL:-}
        VITE_SUPABASE_PUBLISHABLE_KEY: \${VITE_SUPABASE_PUBLISHABLE_KEY:-}
    restart: unless-stopped
    ports: ["127.0.0.1:$porta:80"]
    networks: [rede]
    healthcheck:
      # O -Y off desliga proxy: se a maquina tiver http_proxy no ambiente, o
      # wget tentaria sair pela rua para falar com ele mesmo e o sinal de
      # saude acusaria doente um contêiner são. (Visto acontecendo.)
      test: ["CMD", "wget", "-Y", "off", "-qO-", "http://127.0.0.1/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

networks:
  rede:
    name: ${id}_rede
COMPOSE
}

escrever_robo(){      # Assistente do WhatsApp
  local id="$1" porta="$2"
  mkdir -p "$RAIZ/$id/dados/sessoes"
  chown -R 1000:1000 "$RAIZ/$id/dados" 2>/dev/null || true
  cat > "$RAIZ/$id/Dockerfile" <<'DOCKER'
# Duas etapas. A de cima precisa do git: o Baileys puxa uma dependencia do
# GitHub e, sem git, o npm para com ENOENT "spawn git". A imagem oficial
# completa do Node ja vem com git, entao nao se instala pacote nenhum aqui —
# construcao que depende de repositorio de pacote e construcao que um dia
# quebra sozinha. A imagem final e a enxuta, sem git e sem compilador.
#
# As duas etapas usam a MESMA base (Debian). Trocar alpine por debian no meio
# quebraria qualquer biblioteca compilada: musl e glibc nao se misturam.
FROM node:22-bookworm AS construir
WORKDIR /app
COPY repo/package*.json ./
# Este repositorio nao guarda package-lock.json. Sem ele o npm ci se recusa a
# instalar, e e por isso que ha os dois caminhos. Fica dito: sem arquivo de
# travamento, duas construcoes em dias diferentes podem trazer versoes
# diferentes de biblioteca. Quem quiser construcao sempre igual, commita um
# package-lock.json no repositorio do assistente.
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund; \
    else npm install --omit=dev --no-audit --no-fund; fi

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=construir /app/node_modules ./node_modules
COPY repo/ ./
ENV NODE_ENV=production PORT=3000 PASTA_SESSOES=/dados/sessoes
# nao roda como root; a pasta da sessao e do mesmo usuario (ver instalador)
USER node
EXPOSE 3000
CMD ["node", "server.js"]
DOCKER

  cat > "$RAIZ/$id/docker-compose.yml" <<COMPOSE
# $id — caixa propria
#
# A sessao do WhatsApp mora em ./dados/sessoes, FORA da imagem: reconstruir
# o contêiner nao faz o numero pedir o QR de novo.
#
# O WhatsApp aceita uma sessao por numero. Enquanto o assistente estiver
# atendendo em outro lugar, ligar esta caixa derruba o que esta no ar.
name: $id

services:
  robo:
    build: .
    restart: unless-stopped
    env_file: [.env]
    environment:
      PASTA_SESSOES: /dados/sessoes
      PORT: "3000"
    volumes:
      - ./dados/sessoes:/dados/sessoes
    ports: ["127.0.0.1:$porta:3000"]
    networks: [rede]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

networks:
  rede:
    name: ${id}_rede
COMPOSE
}

molde_env(){          # nunca sobrescreve: chave colada nao se perde
  local id="$1" arq="$RAIZ/$id/.env"
  [ -f "$arq" ] && return 0
  case "$id" in
    jolo-central) cat > "$arq" <<'ENV'
# Central Jolo. As duas de cima vao ao navegador; a de baixo, NUNCA.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_AMBIENTE=producao
ENV
;;
    r2on) cat > "$arq" <<'ENV'
# R2ON. So chave publica; service_role aqui nunca.
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
ENV
;;
    zap-assistente) cat > "$arq" <<'ENV'
# Assistente do WhatsApp. A service_role e necessaria aqui, e so aqui,
# porque o robo grava em nome do sistema. Este arquivo nunca vai ao git.
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
# Sem CHAVE_API o robo avisa no arranque que o acesso esta ABERTO. Hoje ele so
# escuta em 127.0.0.1 e ninguem de fora chega; no dia em que ganhar um dominio,
# sem isto seria porta sem tranca. Invente uma senha longa e guarde.
CHAVE_API=
EXIGIR_CHAVE=sim
ORIGENS_LIBERADAS=
ENV
;;
    *) : > "$arq" ;;
  esac
  chmod 600 "$arq"
}

bloco_nginx(){        # pronto para o nginx do servidor, ligado a mao
  local id="$1" porta="$2" nome="$3"
  cat > "$RAIZ/$id/nginx-site.conf" <<NG
# $nome — bloco para o nginx DO SERVIDOR (o que ja existe).
# Este arquivo nao e usado por ninguem automaticamente: ligar e decisao do
# Rafael, porque mexer no nginx mexe no que ja esta no ar.
#
#   ln -s $RAIZ/$id/nginx-site.conf /etc/nginx/sites-enabled/$id.conf
#   nginx -t && systemctl reload nginx
#   certbot --nginx -d SEU.DOMINIO
server {
    server_name SEU.DOMINIO;
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:$porta;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        "upgrade";
    }
    listen 80;
}
NG
}

# --------------------------------------------------------------------
# 3. mao na massa
# --------------------------------------------------------------------
exigir
mkdir -p "$RAIZ" || { echo "nao consegui criar $RAIZ (falta sudo?)"; exit 1; }

echo "  ---- codigo de cada projeto ----"
declare -a problemas=()
declare -a pendentes=()
for p in "${PROJETOS[@]}"; do
  id=$(campo "$p" 1); repo=$(campo "$p" 2); nome=$(campo "$p" 5)
  printf '  %-16s %-22s ' "$id" "$nome"
  if pegar_codigo "$id" "$repo"; then echo "ok"; else echo "FALHOU"; problemas+=("$id: codigo"); fi
done

echo
echo "  ---- caixa de cada projeto ----"
for p in "${PROJETOS[@]}"; do
  id=$(campo "$p" 1); porta=$(campo "$p" 3); modo=$(campo "$p" 4); nome=$(campo "$p" 5)
  case "$modo" in
    site)
      case "$id" in
        painel-ulian) raizweb="public"; negar='' ;;
        rafaellos)    raizweb="public"; negar='' ;;
        # O Dalu guarda o aplicativo na raiz do repositorio, junto com o
        # codigo das funcoes e os documentos internos. Fora da Cloudflare
        # o nginx serviria tudo: estes caminhos ficam fechados.
        dalu)         raizweb="."; negar='^/(functions|assinar|\.github|.*\.(md|mjs|ts)$)' ;;
        *)            raizweb="public"; negar='' ;;
      esac
      escrever_site "$id" "$porta" "$raizweb" "$negar" ;;
    next) escrever_next "$id" "$porta" ;;
    vite) escrever_vite "$id" "$porta" ;;
    robo) escrever_robo "$id" "$porta" ;;
  esac
  molde_env "$id"
  bloco_nginx "$id" "$porta" "$nome"
  printf '  %-16s pasta, compose, rede, chaves e bloco do nginx: ok\n' "$id"
done

echo
echo "  ---- subindo (cada um na sua caixa) ----"
for p in "${PROJETOS[@]}"; do
  id=$(campo "$p" 1); nome=$(campo "$p" 5)
  # Subir um contêiner que nao tem como funcionar so enche o painel de
  # vermelho. Sem a chave, ele e CONSTRUIDO e fica pronto — ligar e um
  # comando depois de colar a chave.
  if falta_chave "$id"; then
    printf '  %-16s ' "$id"
    reg="$RAIZ/$id/subida.log"
    if (cd "$RAIZ/$id" && docker compose build > "$reg" 2>&1); then
      echo "imagem pronta; esperando a chave em $RAIZ/$id/.env"
      pendentes+=("$id")
    else
      echo "FALHOU ao construir"
      problemas+=("$id: construir — motivo em $reg")
      grep -m3 -E 'ERR|[Ee]rror|failed' "$reg" | sed 's/^/        /'
    fi
    continue
  fi

  if [ "$id" = "$NAO_LIGAR" ]; then
    # "Montado" tem de significar pronto para ligar: a imagem e CONSTRUIDA
    # agora. Deixar so os arquivos seria descobrir que o robo nao compila no
    # dia em que ele for mais necessario.
    printf '  %-16s ' "$id"
    reg="$RAIZ/$id/subida.log"
    if (cd "$RAIZ/$id" && docker compose build > "$reg" 2>&1); then
      echo "imagem pronta, PARADA de proposito (WhatsApp aceita uma sessao)"
    else
      echo "FALHOU ao construir"
      problemas+=("$id: construir — motivo em $reg")
      grep -m3 -E 'ERR|[Ee]rror|failed' "$reg" | sed 's/^/        /'
    fi
    continue
  fi
  printf '  %-16s ' "$id"
  reg="$RAIZ/$id/subida.log"
  if (cd "$RAIZ/$id" && docker compose up -d --build > "$reg" 2>&1); then
    echo "no ar"
  elif sleep 5; (cd "$RAIZ/$id" && docker compose up -d --build >> "$reg" 2>&1); then
    # a primeira tentativa costuma morrer puxando a imagem; a segunda acha no cache
    echo "no ar (na segunda tentativa)"
  else
    echo "FALHOU ao subir"
    problemas+=("$id: subir — motivo em $reg")
    grep -m3 -E 'ERR|[Ee]rror|failed' "$reg" | sed 's/^/        /'
  fi
done

echo
echo "  ---- conferencia: cada caixa responde na porta dela? ----"
for p in "${PROJETOS[@]}"; do
  id=$(campo "$p" 1); porta=$(campo "$p" 3)
  [ "$id" = "$NAO_LIGAR" ] && continue
  falta_chave "$id" && continue
  codigo=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    codigo=$(curl -s -o /dev/null -w '%{http_code}' -m 5 "http://127.0.0.1:$porta/" 2>/dev/null)
    case "$codigo" in 2*|3*) break ;; esac
    sleep 3
  done
  case "$codigo" in
    2*|3*) printf '  %-16s porta %s respondeu %s\n' "$id" "$porta" "$codigo" ;;
    *)
      printf '  %-16s porta %s NAO respondeu (%s)\n' "$id" "$porta" "${codigo:-sem resposta}"
      problemas+=("$id: nao responde") ;;
  esac
done

echo
if [ ${#problemas[@]} -gt 0 ]; then
  echo "  PROBLEMAS:"
  for x in "${problemas[@]}"; do echo "    - $x"; done
  echo
  echo "  NAO diga que esta pronto enquanto houver problema acima."
  echo "  Repositorio privado sem credencial? gere o token (so o escopo 'repo') e:"
  echo "    export GH_TOKEN=cole_aqui && bash \$0"
  echo "  Ver o motivo de um projeto:  cd $RAIZ/<id> && docker compose logs --tail 40"
  exit 1
fi

if [ ${#pendentes[@]} -gt 0 ]; then
  echo "  Tudo separado em $RAIZ. Estes estao prontos e esperam a chave:"
  for x in "${pendentes[@]}"; do echo "    - $x  ->  $RAIZ/$x/.env"; done
else
  echo "  Tudo separado e no ar, em $RAIZ."
fi
echo
echo "  O que falta, e so o Rafael pode fazer:"
echo "    1. colar as chaves em $RAIZ/<projeto>/.env e depois LIGAR:"
echo "       cd $RAIZ/<projeto> && docker compose up -d --build"
echo "    2. ligar o dominio de cada um: o bloco esta em"
echo "       $RAIZ/<projeto>/nginx-site.conf (instrucao dentro do arquivo)"
echo "    3. o assistente do WhatsApp esta montado e parado. Para ligar"
echo "       (e so quando o que esta atendendo hoje for desligado):"
echo "       cd $RAIZ/zap-assistente && docker compose up -d --build"

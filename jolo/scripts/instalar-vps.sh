#!/usr/bin/env bash
# ============================================================
# JOLO FRANQUIAS - instalacao completa num servidor proprio
# (testado no alvo: VPS Hostinger, Ubuntu 22.04/24.04, como root)
#
# Instala e deixa rodando: Postgres 16, Redis 7, a API, os workers,
# a landing e o CRM, com nginx na frente e certificado do Let's Encrypt.
#
# Uso:
#   DOMINIO_LANDING=franquias.jologelato.com.br \
#   DOMINIO_CRM=crm.jologelato.com.br \
#   DOMINIO_API=api.jologelato.com.br \
#   bash scripts/instalar-vps.sh
#
# Sem dominios ele instala tudo igual e serve por HTTP no IP do
# servidor - serve para conferir, mas a Meta so entrega webhook em
# HTTPS: os dominios sao obrigatorios antes de ligar o WhatsApp.
#
# Pode rodar de novo quantas vezes quiser: nao repete o que ja esta
# feito e NUNCA reescreve o .env que ja existe (a configuracao da
# operacao e dado, nao codigo).
# ============================================================
set -Eeuo pipefail

RAIZ="${RAIZ:-/opt/jolo}"
REPO="${REPO:-https://github.com/rafaeluendes-jpg/nexor.git}"
BRANCH="${BRANCH:-}"   # vazio = mantem a branch que ja esta no servidor
SUBPASTA="${SUBPASTA:-jolo}"
NODE_MAJOR=22
PNPM_VERSAO="10.33.0"
FIREWALL="${FIREWALL:-sim}"
DIR_SYSTEMD="${DIR_SYSTEMD:-/etc/systemd/system}"
DIR_NGINX="${DIR_NGINX:-/etc/nginx}"

DOMINIO_LANDING="${DOMINIO_LANDING:-}"
DOMINIO_CRM="${DOMINIO_CRM:-}"
DOMINIO_API="${DOMINIO_API:-}"

passo()  { printf '\n\033[1;32m==>\033[0m %s\n' "$*"; }
aviso()  { printf '\033[1;33m[atencao]\033[0m %s\n' "$*"; }
erro()   { printf '\033[1;31m[erro]\033[0m %s\n' "$*" >&2; exit 1; }
tem()    { command -v "$1" >/dev/null 2>&1; }

trap 'erro "a instalacao parou na linha $LINENO. Nada ficou pela metade sem aviso: rode o script de novo depois de resolver."' ERR

if [ "${MODO:-}" != "conferir" ]; then
  [ "$(id -u)" = "0" ] || erro "rode como root (no terminal da Hostinger voce ja e root)."
  tem apt-get || erro "este script e para Ubuntu/Debian. O seu servidor nao tem apt."
fi

# ------------------------------------------------------------
# Diz se a porta ja tem alguem escutando. Serve para nao brigar com o que
# ja estava rodando no servidor - derrubar o que e de outro nao se faz.
porta_ocupada() {
  ss -ltnH "sport = :$1" 2>/dev/null | grep -q LISTEN
}

# Primeira porta livre a partir da que foi pedida.
porta_livre() {
  local p="$1"
  while porta_ocupada "$p"; do p=$((p + 1)); done
  echo "$p"
}

# Troca a porta do banco/fila no .env quando a escolhida ja esta ocupada.
# Mexe SO nas linhas de porta, e diz o que mudou.
remanejar_porta() {
  local chave="$1" antiga="$2" nova="$3"
  sed -i "s#^${chave}=.*#${chave}=${nova}#" "$ENV_ARQ"
  case "$chave" in
    POSTGRES_PORT) sed -i "s#\(^DATABASE_URL=.*@127\.0\.0\.1:\)${antiga}#\1${nova}#" "$ENV_ARQ" ;;
    REDIS_PORT)    sed -i "s#^REDIS_URL=.*#REDIS_URL=redis://127.0.0.1:${nova}#" "$ENV_ARQ" ;;
  esac
  aviso "a porta ${antiga} ja estava ocupada por outro programa deste servidor; o nosso ${chave%%_*} passou para a ${nova}."
}

# ------------------------------------------------------------
# Escreve um servico do systemd: sobe junto com o servidor e volta
# sozinho se cair.
criar_servico() {
  local nome="$1" descricao="$2" pasta="$3" comando="$4" extra="${5:-}"
  cat > "${DIR_SYSTEMD}/${nome}.service" <<FIMUNIT
[Unit]
Description=${descricao}
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${pasta}
# EnvironmentFile vem primeiro: as linhas Environment abaixo tem a ultima palavra
EnvironmentFile=${ENV_ARQ}
Environment=HOME=/root
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
${extra}
ExecStart=${comando}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
# o processo nao precisa de mais nada do sistema do que a propria pasta
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
FIMUNIT
}

# ------------------------------------------------------------
# Escreve a porta de entrada (nginx). Com os tres dominios, um endereco
# para cada parte; sem eles, landing na 80 e CRM na 8080, so para olhar.
# O HTTPS entra depois, no passo 10, quando o DNS ja aponta para ca.
escrever_nginx() {
mkdir -p "${DIR_NGINX}/sites-available" "${DIR_NGINX}/sites-enabled"

cat > "${DIR_NGINX}/jolo-proxy.conf" <<'FIMPROXY'
# Cabecalhos que as tres partes esperam de quem esta na frente delas.
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
FIMPROXY

if [ -n "$DOMINIO_LANDING" ] && [ -n "$DOMINIO_CRM" ] && [ -n "$DOMINIO_API" ]; then
  cat > "${DIR_NGINX}/sites-available/jolo" <<FIMNGINX
server {
    listen 80;
    server_name ${DOMINIO_LANDING};
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:${PORTA_LANDING:-3000};
        include ${DIR_NGINX}/jolo-proxy.conf;
    }
}

server {
    listen 80;
    server_name ${DOMINIO_CRM};
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:${PORTA_CRM:-3001};
        include ${DIR_NGINX}/jolo-proxy.conf;
    }
}

server {
    listen 80;
    server_name ${DOMINIO_API};
    # planilha de leads e documento do candidato passam por aqui (limite 20 MB)
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:${API_PORT:-3333};
        include ${DIR_NGINX}/jolo-proxy.conf;
    }
    # tempo real: a conexao fica aberta de proposito. Sem desligar o buffer
    # e sem estender o tempo, a tela de conversas pararia de receber.
    location /realtime {
        proxy_pass http://127.0.0.1:${API_PORT:-3333};
        include ${DIR_NGINX}/jolo-proxy.conf;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }
}
FIMNGINX
  ENDERECO_FINAL="http://${DOMINIO_CRM}"
else
  # Se ja ha site publicado na 80, a landing vai para a 8000 e o site de
  # la continua respondendo normalmente.
  if porta_ocupada 80 && ! grep -rq 'proxy_pass http://127.0.0.1:' "${DIR_NGINX}/sites-enabled/" 2>/dev/null; then
    PORTA_ENTRADA=8000
  else
    PORTA_ENTRADA="${PORTA_ENTRADA:-80}"
  fi
  [ "$PORTA_ENTRADA" = "80" ] && PADRAO_80=" default_server" || PADRAO_80=""
  cat > "${DIR_NGINX}/sites-available/jolo" <<FIMNGINX
# Sem dominio ainda: cada parte numa porta, no IP do servidor.
server {
    listen ${PORTA_ENTRADA}${PADRAO_80};
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:${PORTA_LANDING:-3000};
        include ${DIR_NGINX}/jolo-proxy.conf;
    }
}

server {
    listen 8080;
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:${PORTA_CRM:-3001};
        include ${DIR_NGINX}/jolo-proxy.conf;
    }
}

server {
    listen 8081;
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:${API_PORT:-3333};
        include ${DIR_NGINX}/jolo-proxy.conf;
    }
    location /realtime {
        proxy_pass http://127.0.0.1:${API_PORT:-3333};
        include ${DIR_NGINX}/jolo-proxy.conf;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }
}
FIMNGINX
  ENDERECO_FINAL="porta 8080 do IP do servidor (landing na ${PORTA_ENTRADA})"
fi

ln -sfn "${DIR_NGINX}/sites-available/jolo" "${DIR_NGINX}/sites-enabled/jolo"
# A pagina de boas-vindas do Ubuntu sai da frente; qualquer OUTRO site que
# ja estivesse publicado aqui continua onde esta - nao se derruba o que e
# dos outros para abrir espaco.
if [ -f "${DIR_NGINX}/sites-enabled/default" ] \
   && grep -q 'root /var/www/html' "${DIR_NGINX}/sites-enabled/default" 2>/dev/null \
   && ! grep -q 'server_name .*\..*;' "${DIR_NGINX}/sites-enabled/default" 2>/dev/null; then
  rm -f "${DIR_NGINX}/sites-enabled/default"
fi
}

# ------------------------------------------------------------
# Escreve o .env do servidor. Chamada uma unica vez, em servidor novo:
# .env que ja existe nunca e reescrito (configuracao da operacao e dado).
escrever_env() {
  local ENV_ARQ="$1"
  SENHA_BANCO="$(openssl rand -hex 24)"
  SEGREDO_JWT="$(openssl rand -hex 48)"
  URL_API="${DOMINIO_API:+https://$DOMINIO_API}";         URL_API="${URL_API:-http://localhost:3333}"
  URL_LAND="${DOMINIO_LANDING:+https://$DOMINIO_LANDING}"; URL_LAND="${URL_LAND:-http://localhost:3000}"
  URL_CRM="${DOMINIO_CRM:+https://$DOMINIO_CRM}";         URL_CRM="${URL_CRM:-http://localhost:3001}"
  umask 077
  cat > "$ENV_ARQ" <<FIMENV
# Gerado por scripts/instalar-vps.sh em $(date -Is). NAO comitar.
# As linhas marcadas [OPERADOR] dependem de credencial externa:
# enquanto estiverem vazias a API sobe em modo local, sem WhatsApp.
# staging enquanto as linhas [OPERADOR] estiverem vazias: em production a
# API se recusa a subir sem as chaves da Meta e do Supabase (de proposito).
NODE_ENV=staging
API_PORT=3333
# a API so escuta em casa: quem fala com ela de fora e o nginx
API_HOST=127.0.0.1
TRUST_PROXY=true
PORTA_LANDING=3000
PORTA_CRM=3001
API_PUBLIC_URL=${URL_API}
LANDING_PUBLIC_URL=${URL_LAND}
CRM_PUBLIC_URL=${URL_CRM}
CORS_ALLOWED_ORIGINS=${URL_LAND},${URL_CRM}

DATABASE_URL=postgresql://jolo:${SENHA_BANCO}@127.0.0.1:5432/jolo_franquias?schema=public
POSTGRES_USER=jolo
POSTGRES_PASSWORD=${SENHA_BANCO}
POSTGRES_DB=jolo_franquias
POSTGRES_PORT=5432
POSTGRES_BIND=127.0.0.1
REDIS_PORT=6379
REDIS_BIND=127.0.0.1
REDIS_URL=redis://127.0.0.1:6379

AUTH_PROVIDER=local
JWT_SECRET=${SEGREDO_JWT}
JWT_EXPIRES_IN=8h
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

META_APP_ID=
META_APP_SECRET=
META_WHATSAPP_ACCESS_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_BUSINESS_ACCOUNT_ID=
META_WEBHOOK_VERIFY_TOKEN=
META_GRAPH_VERSION=v21.0

NEXT_PUBLIC_WHATSAPP_NUMBER=
NEXT_PUBLIC_WHATSAPP_MESSAGE="Ola! Vim pela pagina de franquias da Jolo e gostaria de falar com o dono."
NEXT_PUBLIC_API_URL=${URL_API}
NEXT_PUBLIC_SITE_URL=${URL_LAND}

AI_PROVIDER=disabled
AI_MODEL=gpt-4.1-mini
OPENAI_API_KEY=
AI_MAX_TOKENS=800
FIMENV
  umask 022
}


# ------------------------------------------------------------
# MODO=conferir: escreve os arquivos que a instalacao geraria numa pasta
# temporaria e confere se sao validos, sem tocar em nada do sistema.
# Serve para provar o script fora do servidor.
if [ "${MODO:-}" = "conferir" ]; then
  PROVA="$(mktemp -d)"
  DIR_SYSTEMD="$PROVA"; DIR_NGINX="$PROVA"
  escrever_env "${PROVA}/.env"
  ENV_ARQ="${PROVA}/.env"
  criar_servico jolo-api     "Jolo Franquias - API"     /opt/jolo/jolo/apps/api  "/usr/bin/node dist/main.js"
  criar_servico jolo-crm     "Jolo Franquias - CRM"     /opt/jolo/jolo/apps/crm  "/usr/bin/pnpm start" "Environment=NODE_ENV=production"
  escrever_nginx
  echo "arquivos gerados em ${PROVA}:"
  ls -la "$PROVA" "${PROVA}/sites-available"
  if tem nginx; then
    # confere a configuracao de verdade, com o nginx lendo o arquivo
    CONF="${PROVA}/nginx.conf"
    printf 'events {}\nhttp {\n  include %s/sites-enabled/*;\n}\n' "$PROVA" > "$CONF"
    nginx -t -c "$CONF" -p "$PROVA" >/dev/null 2>&1 \
      && echo "nginx: configuracao valida" \
      || { nginx -t -c "$CONF" -p "$PROVA"; erro "configuracao do nginx invalida."; }
  fi
  if tem docker; then
    docker compose --env-file "${PROVA}/.env" \
      -f "$(dirname "$0")/../infra/docker/docker-compose.yml" config >/dev/null \
      && echo "docker compose: valido" || erro "docker compose invalido."
  fi
  echo "endereco que seria publicado: ${ENDERECO_FINAL}"
  exit 0
fi

# ------------------------------------------------------------
passo "1/10 Pacotes de base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git openssl ufw ripgrep >/dev/null

# Com 4 GB e uma CPU (plano KVM 1), compilar as telas pode estourar a
# memoria e morrer no meio. Um arquivo de troca de 2 GB segura isso.
MEM_MB="$(free -m | awk '/^Mem:/ {print $2}')"
SWAP_MB="$(free -m | awk '/^Swap:/ {print $2}')"
if [ "${SWAP_MB:-0}" -eq 0 ] && [ "${MEM_MB:-0}" -lt 6000 ]; then
  if fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none; then
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null 2>&1 && swapon /swapfile 2>/dev/null \
      && { grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab; echo "    memoria de troca de 2 GB ligada"; } \
      || aviso "nao consegui ligar a memoria de troca; a compilacao pode ficar apertada."
  fi
fi

# ------------------------------------------------------------
passo "2/10 Docker (Postgres e Redis rodam dentro dele)"
if ! tem docker; then
  install -m 0755 -d /etc/apt/keyrings
  DISTRO="$(. /etc/os-release && echo "$ID")"
  CODINOME="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
  curl -fsSL "https://download.docker.com/linux/${DISTRO}/gpg" \
    -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${DISTRO} $CODINOME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  systemctl enable --now docker >/dev/null
else
  echo "    ja instalado: $(docker --version)"
fi

# ------------------------------------------------------------
passo "3/10 Node ${NODE_MAJOR} e pnpm"
if ! tem node || [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -lt "$NODE_MAJOR" ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
corepack enable >/dev/null 2>&1 || npm install -g corepack@latest >/dev/null
corepack prepare "pnpm@${PNPM_VERSAO}" --activate >/dev/null
echo "    node $(node --version), pnpm $(pnpm --version)"

# ------------------------------------------------------------
passo "4/10 Codigo em ${RAIZ}"
if [ "${SEM_GIT:-}" = "sim" ]; then
  # o codigo ja foi entregue por fora (copia do GitHub Actions): nao baixa nada
  echo "    codigo ja entregue em ${RAIZ}"
elif [ -d "${RAIZ}/.git" ]; then
  # sem BRANCH explicito, continua na branch que o servidor ja usa: trocar
  # sozinho para a main jogaria fora a versao que esta rodando na loja
  BRANCH="${BRANCH:-$(git -C "$RAIZ" rev-parse --abbrev-ref HEAD)}"
  echo "    branch: ${BRANCH}"
  git -C "$RAIZ" fetch --quiet origin "$BRANCH"
  git -C "$RAIZ" checkout --quiet "$BRANCH"
  git -C "$RAIZ" reset --hard --quiet "origin/${BRANCH}"
else
  BRANCH="${BRANCH:-main}"
  [ -e "$RAIZ" ] && [ -n "$(ls -A "$RAIZ" 2>/dev/null)" ] \
    && erro "${RAIZ} existe e nao esta vazio, mas nao e um clone do repositorio. Escolha outra pasta com RAIZ=/outro/lugar."
  git clone --quiet --branch "$BRANCH" "$REPO" "$RAIZ" \
    || erro "nao consegui baixar o codigo. O repositorio e privado: autorize este servidor no GitHub antes (um token de leitura ou uma chave de deploy)."
fi
APP="${RAIZ}/${SUBPASTA}"
[ -f "${APP}/pnpm-workspace.yaml" ] || erro "nao achei o projeto em ${APP}."

# ------------------------------------------------------------
passo "5/10 Configuracao (.env) - segredos gerados aqui, nunca exibidos"
ENV_ARQ="${APP}/.env"
if [ -f "$ENV_ARQ" ]; then
  echo "    .env ja existe: mantido exatamente como esta."
else
  escrever_env "$ENV_ARQ"
  echo "    .env criado com senha de banco e JWT proprios."
fi
chmod 600 "$ENV_ARQ"
chown root:root "$ENV_ARQ"

# o resto do script obedece ao que esta no .env, nao a valores presumidos
set -a; . "$ENV_ARQ"; set +a
USUARIO_BANCO="${POSTGRES_USER:-jolo}"
BANCO="${POSTGRES_DB:-jolo_franquias}"

# ------------------------------------------------------------
passo "6/10 Banco e fila de pe"
# Se a porta ja e do NOSSO container, esta tudo certo: so remaneja quando
# quem esta escutando e outro programa.
if porta_ocupada "${POSTGRES_PORT:-5432}" \
   && ! docker ps --filter name=jolo-postgres --format '{{.Names}}' | grep -q jolo-postgres; then
  NOVA="$(porta_livre $(( ${POSTGRES_PORT:-5432} + 10000 )))"
  remanejar_porta POSTGRES_PORT "${POSTGRES_PORT:-5432}" "$NOVA"
fi
if porta_ocupada "${REDIS_PORT:-6379}" \
   && ! docker ps --filter name=jolo-redis --format '{{.Names}}' | grep -q jolo-redis; then
  NOVA="$(porta_livre $(( ${REDIS_PORT:-6379} + 10000 )))"
  remanejar_porta REDIS_PORT "${REDIS_PORT:-6379}" "$NOVA"
fi
set -a; . "$ENV_ARQ"; set +a

docker compose --env-file "$ENV_ARQ" -f "${APP}/infra/docker/docker-compose.yml" up -d >/dev/null
printf '    esperando o Postgres responder'
for _ in $(seq 1 60); do
  if docker exec jolo-postgres pg_isready -U "$USUARIO_BANCO" -d "$BANCO" >/dev/null 2>&1; then
    printf ' ok\n'; PRONTO=1; break
  fi
  printf '.'; sleep 2
done
[ "${PRONTO:-}" = "1" ] || erro "o Postgres nao subiu. Veja: docker logs jolo-postgres"
docker exec jolo-redis redis-cli ping >/dev/null 2>&1 || erro "o Redis nao subiu. Veja: docker logs jolo-redis"

# ------------------------------------------------------------
# Portas das telas e da API: o mesmo cuidado do banco. Se o servidor ja
# usa a porta para outra coisa, a nossa muda de lugar em vez de brigar.
for PAR in "API_PORT 3333" "PORTA_LANDING 3000" "PORTA_CRM 3001"; do
  CHAVE="${PAR%% *}"; PADRAO="${PAR##* }"
  VALOR="$(eval echo "\${$CHAVE:-$PADRAO}")"
  if porta_ocupada "$VALOR" && ! pgrep -f "port=$VALOR" >/dev/null 2>&1; then
    # a nossa propria (de uma instalacao anterior) nao conta como conflito
    DONO_NOSSO=""
    for SVC in jolo-api jolo-landing jolo-crm; do
      systemctl is-active --quiet "$SVC" 2>/dev/null && DONO_NOSSO="sim"
    done
    if [ -z "$DONO_NOSSO" ]; then
      NOVA="$(porta_livre $((VALOR + 10000)))"
      if grep -q "^${CHAVE}=" "$ENV_ARQ"; then
        sed -i "s#^${CHAVE}=.*#${CHAVE}=${NOVA}#" "$ENV_ARQ"
      else
        printf '%s=%s\n' "$CHAVE" "$NOVA" >> "$ENV_ARQ"
      fi
      aviso "a porta ${VALOR} ja era de outro programa deste servidor; ${CHAVE} passou para ${NOVA}."
    fi
  elif ! grep -q "^${CHAVE}=" "$ENV_ARQ"; then
    printf '%s=%s\n' "$CHAVE" "$VALOR" >> "$ENV_ARQ"
  fi
done
set -a; . "$ENV_ARQ"; set +a
PORTA_LANDING="${PORTA_LANDING:-3000}"
PORTA_CRM="${PORTA_CRM:-3001}"

# Enderecos publicos: as telas guardam o endereco da API no momento em que
# sao compiladas. Sem dominio, "localhost" so funcionaria para quem esta
# sentado no servidor - entao entra o IP. Mexe so no que ainda esta no
# valor de fabrica; endereco que voce ja ajustou fica como esta.
IP_PUBLICO="$(curl -fsS --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"
if [ -z "$DOMINIO_CRM" ] && [ -n "$IP_PUBLICO" ]; then
  trocar_se_padrao() { # trocar_se_padrao <chave> <valor novo>
    grep -q "^$1=http://localhost" "$ENV_ARQ" && sed -i "s#^$1=.*#$1=$2#" "$ENV_ARQ"
    return 0
  }
  trocar_se_padrao API_PUBLIC_URL     "http://${IP_PUBLICO}:8081"
  trocar_se_padrao LANDING_PUBLIC_URL "http://${IP_PUBLICO}"
  trocar_se_padrao CRM_PUBLIC_URL     "http://${IP_PUBLICO}:8080"
  trocar_se_padrao NEXT_PUBLIC_API_URL  "http://${IP_PUBLICO}:8081"
  trocar_se_padrao NEXT_PUBLIC_SITE_URL "http://${IP_PUBLICO}"
  grep -q "^CORS_ALLOWED_ORIGINS=http://localhost" "$ENV_ARQ" \
    && sed -i "s#^CORS_ALLOWED_ORIGINS=.*#CORS_ALLOWED_ORIGINS=http://${IP_PUBLICO},http://${IP_PUBLICO}:8080#" "$ENV_ARQ"
  set -a; . "$ENV_ARQ"; set +a
  echo "    enderecos ajustados para o IP ${IP_PUBLICO} (sem dominio ainda)"
fi

# Quando os dominios chegam depois (o normal: primeiro sobe pelo IP,
# depois o DNS fica pronto), os enderecos provisorios em http:// dao lugar
# aos definitivos. Endereco que ja esta em https:// nao e tocado.
if [ -n "$DOMINIO_CRM" ] && [ -n "$DOMINIO_LANDING" ] && [ -n "$DOMINIO_API" ]; then
  trocar_provisorio() { # trocar_provisorio <chave> <valor novo>
    grep -q "^$1=http://" "$ENV_ARQ" && sed -i "s#^$1=.*#$1=$2#" "$ENV_ARQ"
    return 0
  }
  trocar_provisorio API_PUBLIC_URL      "https://${DOMINIO_API}"
  trocar_provisorio LANDING_PUBLIC_URL  "https://${DOMINIO_LANDING}"
  trocar_provisorio CRM_PUBLIC_URL      "https://${DOMINIO_CRM}"
  trocar_provisorio NEXT_PUBLIC_API_URL "https://${DOMINIO_API}"
  trocar_provisorio NEXT_PUBLIC_SITE_URL "https://${DOMINIO_LANDING}"
  grep -q "^CORS_ALLOWED_ORIGINS=http://" "$ENV_ARQ" \
    && sed -i "s#^CORS_ALLOWED_ORIGINS=.*#CORS_ALLOWED_ORIGINS=https://${DOMINIO_LANDING},https://${DOMINIO_CRM}#" "$ENV_ARQ"
  set -a; . "$ENV_ARQ"; set +a
  echo "    enderecos definitivos: ${DOMINIO_LANDING}, ${DOMINIO_CRM}, ${DOMINIO_API}"
fi

# ------------------------------------------------------------
passo "7/10 Instalar dependencias e compilar"
cd "$APP"
pnpm install --frozen-lockfile
# O cliente do banco e gerado a partir do schema, e nao vem pronto no
# repositorio. Sem gerar antes, o TypeScript nao acha o PrismaClient e a
# compilacao para no meio (foi o que aconteceu na primeira instalacao).
pnpm db:generate
pnpm build

# ------------------------------------------------------------
passo "8/10 Estrutura do banco"
pnpm db:migrate
# A semente so entra em banco vazio. Semear banco com dados seria repor
# valor de fabrica sobre o que a operacao ja configurou.
CONTA_ORG="$(docker exec jolo-postgres psql -U "$USUARIO_BANCO" -d "$BANCO" -tAc \
  'select count(*) from organizations' 2>/dev/null | tr -d '[:space:]')"
case "$CONTA_ORG" in
  ''|*[!0-9]*) erro "nao consegui conferir se o banco esta vazio; nao vou semear no escuro." ;;
esac
if [ "$CONTA_ORG" = "0" ]; then
  pnpm db:seed
  echo "    banco recem-criado: organizacao, funil e perfis de acesso criados."
else
  echo "    banco ja tem dados (${CONTA_ORG} organizacao): semente NAO executada."
fi

# ------------------------------------------------------------
passo "9/10 Servicos que sobem junto com o servidor"

NODE_BIN="$(command -v node)"
PNPM_BIN="$(command -v pnpm)"
criar_servico jolo-api     "Jolo Franquias - API"     "${APP}/apps/api"  "${NODE_BIN} dist/main.js"
criar_servico jolo-workers "Jolo Franquias - workers" "${APP}/workers"   "${NODE_BIN} dist/main.js"
# o Next reclama de NODE_ENV fora do padrao; para ele e sempre production
# -H 127.0.0.1: quem atende a internet e o nginx, nao o Next direto
criar_servico jolo-landing "Jolo Franquias - landing" "${APP}/apps/landing" \
  "${PNPM_BIN} exec next start -p ${PORTA_LANDING} -H 127.0.0.1" "Environment=NODE_ENV=production"
criar_servico jolo-crm     "Jolo Franquias - CRM"     "${APP}/apps/crm" \
  "${PNPM_BIN} exec next start -p ${PORTA_CRM} -H 127.0.0.1" "Environment=NODE_ENV=production"
systemctl daemon-reload
systemctl enable --now jolo-api jolo-workers jolo-landing jolo-crm >/dev/null
sleep 6
for s in jolo-api jolo-workers jolo-landing jolo-crm; do
  systemctl is-active --quiet "$s" \
    && echo "    ${s}: rodando" \
    || { journalctl -u "$s" -n 30 --no-pager; erro "${s} nao subiu (registro acima)."; }
done
curl -fsS --max-time 10 "http://127.0.0.1:${API_PORT:-3333}/health" >/dev/null \
  && echo "    /health respondeu" \
  || erro "a API subiu mas /health nao respondeu."

# ------------------------------------------------------------
passo "10/10 Porta de entrada e HTTPS"
tem nginx || apt-get install -y -qq nginx >/dev/null
escrever_nginx
nginx -t >/dev/null 2>&1 || { nginx -t; erro "a configuracao do nginx saiu invalida; nada foi recarregado."; }
systemctl enable nginx >/dev/null
systemctl reload nginx 2>/dev/null || systemctl restart nginx
echo "    nginx de pe e conferido"

# HTTPS: certificado do Let's Encrypt. So faz sentido depois que o DNS
# do dominio ja aponta para este servidor - senao a Let's Encrypt recusa.
if [ -n "$DOMINIO_LANDING" ] && [ -n "$DOMINIO_CRM" ] && [ -n "$DOMINIO_API" ]; then
  MEU_IP="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
  IP_DOMINIO="$(getent hosts "$DOMINIO_CRM" | awk '{print $1}' | head -1 || true)"
  if [ -n "$MEU_IP" ] && [ "$MEU_IP" = "$IP_DOMINIO" ]; then
    tem certbot || apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
    certbot --nginx --non-interactive --agree-tos --redirect \
      --register-unsafely-without-email \
      -d "$DOMINIO_LANDING" -d "$DOMINIO_CRM" -d "$DOMINIO_API" \
      && { ENDERECO_FINAL="https://${DOMINIO_CRM}"; echo "    HTTPS ligado e com renovacao automatica"; } \
      || aviso "o certificado nao saiu. O sistema continua de pe em HTTP; rode o script de novo depois."
  else
    aviso "o dominio ${DOMINIO_CRM} ainda nao aponta para este servidor (${MEU_IP:-IP desconhecido}). Sem HTTPS por enquanto: ajuste o DNS e rode o script de novo."
  fi
fi

if [ "$FIREWALL" = "sim" ]; then
  ufw allow 22/tcp  >/dev/null
  ufw allow 80/tcp  >/dev/null
  ufw allow 443/tcp >/dev/null
  if [ -z "$DOMINIO_CRM" ]; then
    ufw allow 8080/tcp >/dev/null
    ufw allow 8081/tcp >/dev/null
    [ "${PORTA_ENTRADA:-80}" = "80" ] || ufw allow "${PORTA_ENTRADA}/tcp" >/dev/null
  fi
  # Num servidor que ja publica outra coisa, ligar o firewall poderia
  # cortar uma porta que aquele site usa. Entao so liga sozinho em
  # servidor limpo; se ja estava ligado, as regras acima bastam.
  if ufw status 2>/dev/null | grep -q '^Status: active'; then
    echo "    firewall ja estava ligado: liberadas as portas do sistema."
  elif [ "$(ls -1 "${DIR_NGINX}/sites-enabled" 2>/dev/null | grep -cv '^jolo$')" -gt 0 ]; then
    aviso "este servidor ja publica outro site: nao liguei o firewall para nao cortar nada dele. Para ligar depois: ufw enable"
  else
    yes | ufw enable >/dev/null 2>&1 || true
    echo "    firewall: so 22, 80 e 443. Banco e fila nem aparecem de fora."
  fi
fi

cat <<FIM

============================================================
Instalado.

  Endereco:   ${ENDERECO_FINAL}
  Codigo:     ${APP}
  Config:     ${ENV_ARQ}  (somente root, 600 - nao abra em publico)
  Servicos:   systemctl status jolo-api jolo-workers jolo-landing jolo-crm
  Registro:   journalctl -u jolo-api -f
  Backup:     ${APP}/scripts/backup.sh

Falta ligar o WhatsApp: as linhas [OPERADOR] do .env (token e segredo
da Meta). Depois de preencher, trocar NODE_ENV=staging por
NODE_ENV=production e reiniciar:
  systemctl restart jolo-api jolo-workers
============================================================
FIM

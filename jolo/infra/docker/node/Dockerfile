# Base comum dos sistemas Node do servidor (landing, CRM, API, workers,
# Central e Gestao). Mesma versao do Node que rodava direto na maquina,
# para nada mudar de comportamento ao entrar no container.
# Sem TZ de proposito: o fuso fica o mesmo de quando rodavam fora (UTC).
FROM node:22.23.3-bookworm-slim
RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
COPY iniciar.sh /usr/local/bin/iniciar
RUN chmod 755 /usr/local/bin/iniciar
ENTRYPOINT ["/usr/local/bin/iniciar"]

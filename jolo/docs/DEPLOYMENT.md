# Publicacao

## Como ficam os enderecos

| Parte | Endereco sugerido |
|---|---|
| Landing | `https://franquias.jologelato.com.br` |
| CRM | `https://crm.jologelato.com.br` |
| API | `https://api.jologelato.com.br` |

A URL do webhook que vai no painel da Meta e
`https://api.jologelato.com.br/webhooks/meta/whatsapp`.

## O que producao exige

A API se recusa a subir em `NODE_ENV=production` sem isto (e a mensagem
diz o que falta):

- `AUTH_PROVIDER=supabase` e as chaves do Supabase;
- `META_APP_SECRET`, `META_WHATSAPP_ACCESS_TOKEN`,
  `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WEBHOOK_VERIFY_TOKEN`.

E de proposito: melhor nao subir do que subir sem saber falar com a Meta.

## Caminho curto: servidor proprio (VPS)

Num Ubuntu novo, um comando faz tudo — banco, fila, compilacao,
migrations, servicos e nginx com HTTPS:

```bash
DOMINIO_LANDING=franquias.jologelato.com.br \
DOMINIO_CRM=crm.jologelato.com.br \
DOMINIO_API=api.jologelato.com.br \
bash scripts/instalar-vps.sh
```

Passo a passo, o que depende do operador e como conferir o script sem
servidor: `docs/VPS_HOSTINGER.md`.

Atras de proxy, duas linhas importam no `.env`: `API_HOST=127.0.0.1`
(a API deixa de escutar a internet direto) e `TRUST_PROXY=true`
(o IP de quem chega passa a ser o real, nao o do proxy).

## Passos a mao

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate           # aplica migrations pendentes
pnpm db:seed              # so na primeira vez
```

Depois, com o gerenciador de processo do servidor (systemd, pm2, Docker):

- `node apps/api/dist/main.js` — a API
- `node workers/dist/main.js` — os workers (pelo menos um)
- `next start` na landing e no CRM, ou publicacao em Vercel/Netlify

## Ordem que evita susto

1. Subir a API e conferir `/health`.
2. Subir os workers.
3. Publicar a landing e o CRM.
4. So entao apontar o webhook da Meta para o endereco novo.

Trocar o webhook antes de a API estar de pe faz a Meta recusar o
cadastro, e mensagens que chegarem nesse intervalo se perdem.

## HTTPS

Obrigatorio. A Meta so entrega webhook em HTTPS com certificado valido.
Certificado do Let's Encrypt serve.

## Depois de publicar, conferir

- `curl https://api.SEU-DOMINIO/health` responde `ok`;
- a landing abre e o botao abre o WhatsApp no numero certo;
- uma mensagem de teste vira lead no funil;
- `docs/OPERACAO.md` diz o que olhar todo dia.

## Voltar atras

O codigo volta pela versao anterior (tag ou commit). O banco **nao volta
sozinho**: migration aplicada fica aplicada. Antes de qualquer publicacao
com migration, rode `./scripts/backup.sh`.

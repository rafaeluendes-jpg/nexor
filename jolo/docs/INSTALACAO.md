# Instalacao (desenvolvimento)

O que precisa estar na maquina: Node 22 ou mais novo, pnpm 10, e Docker
(ou um Postgres 16 e um Redis 7 ja instalados).

## 1. Dependencias

```bash
pnpm install
```

## 2. Banco e fila

```bash
cd infra/docker && docker compose up -d && cd ../..
```

Sem Docker: crie o banco `jolo_franquias` e o usuario `jolo` no Postgres,
e deixe o Redis rodando na porta 6379.

## 3. Variaveis de ambiente

```bash
cp .env.example .env
```

Abra o `.env` e preencha. Cada linha tem uma marca:

- `[LOCAL]` ja vem funcionando para desenvolvimento;
- `[OPERADOR]` depende de conta ou credencial externa (Meta, Supabase,
  provedor de IA). Sem elas o sistema sobe e funciona, so nao envia nem
  recebe WhatsApp de verdade e a IA fica desligada.

O `.env` NUNCA entra no Git.

## 4. Estrutura do banco e dados iniciais

```bash
pnpm db:migrate     # cria as tabelas
pnpm db:seed        # papeis, permissoes, funil, pracas, usuario administrador
```

O seed cria o administrador com o e-mail e a senha de `SEED_ADMIN_EMAIL`
e `SEED_ADMIN_PASSWORD`. Em producao a senha vive no Supabase Auth: o
sistema nao guarda senha propria.

## 5. Compilar os pacotes internos

```bash
pnpm build
```

## 6. Subir

Em quatro terminais (ou com o gerenciador de processo de sua preferencia):

```bash
pnpm dev:api        # http://localhost:3333
pnpm workers        # processa as mensagens que chegam
pnpm dev:landing    # http://localhost:3000
pnpm dev:crm        # http://localhost:3001
```

Confira: `curl http://localhost:3333/health` responde `ok`.

## 7. Provar que esta tudo de pe

```bash
pnpm test           # testes de unidade
pnpm test:e2e       # testes de ponta a ponta (precisa dos servicos no ar)
```

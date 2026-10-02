# Mudança do Joia para a VPS — roteiro

Preparado em 02/10/2026, depois da queda do Supabase de 12h24 às 13h58.
Este roteiro é para o **Claude Code que roda dentro da VPS**. Ele cobre
tudo; o que só o Rafael pode fazer está marcado com **[RAFAEL]**.

Regras do `CLAUDE.md` que valem aqui:

- Nada de senha, chave ou CSC em arquivo do git, commit ou mensagem.
- O site só muda com o portão verde.
- A virada é feita numa noite com as lojas fechadas.

## Por que o Supabase travou em 02/10

Os registros do banco, das 11h30 às 12h24, mostram o disco lento demais:
- uma gravação de rotina de 1.683 blocos levou 172 s, quando normalmente
  leva menos de 1 s;
- a leitura do tempo real levou 50 s;
- consultas foram canceladas por tempo.

É o limite de leitura e gravação em disco do plano de servidor do
Supabase: quando a cota esgota, tudo fica lento até travar.

Duas coisas pesam nesse disco, e a VPS sozinha não resolve nenhuma delas:
- 38 tabelas em tempo real;
- um pagamento de venda que o banco recusa e que o aparelho de Santa Fé
  reenvia sem parar (2.362 vezes em 01/10).

Na VPS, o disco é da máquina e sem cota, mas esses dois pontos devem ser
corrigidos de qualquer forma.

## O que muda e o que não muda

| | Hoje | Depois |
|---|---|---|
| Site do Joia (`index.html`) | GitHub Pages | **igual**: não muda |
| Banco, login, tempo real, funções, arquivos | Supabase (nuvem, EUA) | Supabase **na VPS**, em `https://api.joiagest.com.br` |
| Cardápio digital e robô do WhatsApp | apontam para o Supabase | passam a apontar para `api.joiagest.com.br` |

Inventário da nuvem, em 02/10/2026:

- banco de 299 MB, com 38 tabelas em tempo real;
- 11 usuários de login, com as mesmas senhas, que vão junto;
- 6 segredos no cofre (chaves da Spedy e CSC);
- 6 baldes com 42 arquivos (6 MB);
- 17 funções, cujo código está todo em `supabase/functions/`. As que são do
  Joia: `joia-fiscal`, `criar-usuario`, `joia-api`, `joia-rds` e
  `central-painel`. As outras são da plataforma de marketing (ver
  `supabase/functions/VERSOES.md`).
- Extensões: pgcrypto, pg_trgm, unaccent, uuid-ossp, vector, pgmq,
  supabase_vault e pg_stat_statements.

## Requisitos da VPS

- 4 GB de memória ou mais, 2 vCPU e 40 GB livres.
- Docker. O `instalar-supabase.sh` instala se faltar.
- **Não trocar o sistema operacional da VPS.** Tudo entra em `/opt/joia`,
  ao lado do que já roda.

## Passo a passo

### Antes da noite da virada (pode ser feito de dia, com as lojas abertas)

1. **Instalar o Supabase na VPS.**
   ```
   cd ~ && git clone https://github.com/rafaeluendes-jpg/nexor && cd nexor
   bash migracao-vps/instalar-supabase.sh
   ```
2. **[RAFAEL] Endereço `api.joiagest.com.br`.** No site onde o domínio
   joiagest.com.br está registrado, criar um registro **A**:
   - nome `api`;
   - valor: o IP da VPS (o Claude da VPS informa).

   Leva 5 minutos.
3. **HTTPS e nginx**, depois que o endereço do passo 2 responder:
   ```
   apt-get install -y nginx certbot python3-certbot-nginx
   certbot certonly --nginx -d api.joiagest.com.br
   cp migracao-vps/nginx-api.joiagest.conf /etc/nginx/sites-available/api.joiagest.com.br
   ln -sf /etc/nginx/sites-available/api.joiagest.com.br /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   ```
4. **[RAFAEL] Senha do banco da nuvem.** No painel do Supabase:
   - Project Settings › Database › **Reset database password**;
   - colar a senha nova **direto na VPS**, no arquivo `/opt/joia/migracao.env`
     (o Claude da VPS cria o arquivo e diz onde colar).

   Nunca mandar a senha no chat.
5. **Montar `/opt/joia/migracao.env`** (permissão 600) com:
   - `ORIGEM_DB_URL`: a conexão "Session pooler" do painel do Supabase,
     com a senha do passo 4;
   - `DESTINO_DB_URL=postgresql://postgres.<POOLER_TENANT_ID>:<POSTGRES_PASSWORD>@127.0.0.1:5432/postgres`,
     com os dois valores tirados de `/opt/joia/supabase/.env`;
   - `ORIGEM_URL=https://cevghkndzpzvnzwifhnm.supabase.co`;
   - `ORIGEM_SERVICE_KEY`: a chave secreta do Supabase (Project Settings › API
     keys);
   - `DESTINO_URL=https://api.joiagest.com.br` e `DESTINO_SERVICE_KEY`, que é
     o `SERVICE_ROLE_KEY` do `.env`.
6. **Ensaio completo** (de dia, sem afetar as lojas: só lê a nuvem):
   ```
   bash migracao-vps/copiar-banco.sh
   bash migracao-vps/copiar-segredos.sh
   set -a; source /opt/joia/migracao.env; set +a; node migracao-vps/copiar-arquivos.js
   bash migracao-vps/publicar-funcoes.sh
   bash migracao-vps/conferir.sh
   ```
   Tudo tem de terminar em "ok". Se algo falhar, corrigir e repetir; o
   ensaio pode ser refeito quantas vezes for preciso. Antes de repetir,
   `docker compose down -v && docker compose up -d` em
   `/opt/joia/supabase` limpa a VPS.
7. **Teste de ponta a ponta no ensaio.** Abrir uma cópia do Joia apontando
   para a VPS (passo 9, sem publicar), entrar com um usuário, abrir o caixa
   e vender. Conferir:
   - que a venda chega ao banco da VPS;
   - que o cupom fiscal sai em homologação (a Matriz está em homologação).

### A noite da virada (lojas fechadas, de 1 a 2 horas)

8. **Copiar de novo, com a última versão.** Limpar a VPS e repetir o passo 6
   inteiro. `conferir.sh` tem de dar "ok" em todas as tabelas.
9. **Apontar o Joia para a VPS.** Em `src/js/03-armazenamento/01-inicio.js`,
   no objeto `NUVEM`:
   - `url:'https://api.joiagest.com.br'`;
   - `chave:'<ANON_KEY do .env da VPS>'`. A chave anônima é pública: ela já vai
     no site hoje.

   Depois:
   - subir `VERSAO` e `VERSAO_SW`;
   - `npm run montar`;
   - `node ferramentas/portao.js`.

   Também precisam apontar para a VPS:
   - o cardápio digital (`delivery/cardapio.js`);
   - o robô do WhatsApp (repositório `nexor-whatsapp`).
10. **[RAFAEL] Ordem para publicar.** Com o portão verde: `git push origin
    HEAD:main`.
11. **Primeira entrada.** Cada loja aperta F5 e entra de novo com o mesmo
    usuário e a mesma senha (as sessões antigas não valem no servidor novo).
    O que estava guardado no aparelho sobe sozinho.
12. **Cópia diária** do banco na VPS:
    ```
    cp migracao-vps/backup-diario.sh /opt/joia/
    (crontab -l 2>/dev/null; echo "0 3 * * * bash /opt/joia/backup-diario.sh") | crontab -
    ```

### Se der errado na noite

Voltar o passo 9 (o `url` e a `chave` originais), publicar, e as lojas
voltam para o Supabase da nuvem. Dá para fazer até a abertura das lojas: a
nuvem fica intacta até a virada.

## Depois da virada

- Manter o projeto do Supabase da nuvem **pausado, sem apagar, por 30 dias**,
  como cópia de segurança.
- `ferramentas/conferir-nuvem.js` continua valendo: a estrutura é a mesma.
- O vigia (`.claude/skills/vigia/SKILL.md`) passa a olhar o banco da VPS.

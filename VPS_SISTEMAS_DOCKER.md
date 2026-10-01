# Os sistemas do Rafael na VPS, cada um na sua caixa

Ordem dele de 01/10/2026: *"dentro da VPS, separe tudo por Docker. Tudo por
pasta, separado, separado por projeto certinho, nada misturado."*

Quem faz: **`ferramentas/vps-docker.sh`**, rodado no servidor.
A cópia completa do código (todo ramo, todo commit) continua sendo o
`ferramentas/espelhar-vps.sh`, que agora também guarda o assistente do
WhatsApp.

## O desenho

```
/opt/sistemas/
  painel-ulian/         Painel Rafael Ulian  site            127.0.0.1:8082
  r2on/                 R2ON                 site            127.0.0.1:8083
  dalu/                 Dalu                 site            127.0.0.1:8084
  rafaellos/            Central Rafaello's   site            127.0.0.1:8085
  zap-assistente/       Assistente WhatsApp  robô            127.0.0.1:8086
  sistema-inteligente/  Sistema Inteligente  tela+API+banco  :8087 e :8088
  espelho/              as cópias completas do git
  removidos/            o que saiu da lista, guardado com a data
```

**A lista é esta e só esta** (ordem do Rafael, 01/10/2026). Ficam de fora,
de propósito: `nexor` (Joia), `jolo-central` (Central Jolô), `nexor-app` e
`delivery`. Projeto que sai da lista é **desligado** e a pasta vai para
`removidos/` com a data — não é apagada, porque pode ter um `.env` com
chave colada à mão, e isso não se destrói sem alguém pedir.

Dentro de cada pasta, e **só** dentro dela: o código (`repo/`), o
`docker-compose.yml`, o `Dockerfile` quando precisa construir, o
`nginx.conf` quando é site, o `.env` com as chaves daquele projeto, a
pasta de dados quando o projeto guarda estado, e o `nginx-site.conf` com o
bloco pronto para o domínio.

Separado de verdade, não só em nome: **rede própria por projeto**
(`<projeto>_rede`), e todo volume aponta para dentro da pasta do próprio
projeto. Medido: do contêiner do Dalu não se alcança o do Rafaello's nem
o da Central Jolô, nem pelo nome nem pelo IP.

## Três coisas que ele não faz, de propósito

0. **O Sistema Inteligente usa o compose que vem no próprio repositório**,
   em vez de um inventado aqui: ele já traz banco, API e tela. O que é
   trocado: a senha do banco passa a vir do `.env` desta pasta; as portas
   passam a escutar só em `127.0.0.1`; e a semente de exemplo e o
   dono-de-teste ficam **desligados**, porque o compose do repositório traz
   uma senha do Rafael escrita dentro, e ela não sobe para o servidor.
1. **Não encosta no que já está no ar.** O `/opt/dalu`, o Supabase próprio
   e o nginx do servidor ficam como estão. Nada aqui ocupa a porta 80 nem
   a 443: cada caixa escuta só em `127.0.0.1`, e quem publica para a
   internet continua sendo o nginx que já existe. O bloco de cada domínio
   fica pronto em `nginx-site.conf`, para ser ligado à mão — mexer no
   nginx mexe no que está atendendo.
2. **Não liga o assistente do WhatsApp.** O WhatsApp aceita **uma** sessão
   por número: subir uma segunda cópia desconecta a que está atendendo. A
   imagem é construída (para não descobrir no dia errado que não compila) e
   o contêiner fica parado.
3. **Não sobrescreve arquivo de chave.** `.env` que já existe é deixado
   intacto. Rodar de novo atualiza o código e reconstrói o que mudou.

E ainda: **não sobe o que não tem como funcionar.** Projeto sem a chave
obrigatória é construído e fica pronto, com o aviso de qual arquivo falta.
Subir um contêiner que só sabe responder erro é enfeitar o painel de
vermelho.

## O que foi medido, rodando de verdade

Docker de verdade, as seis caixas construídas e subidas:

| | |
|---|---|
| Painel Rafael Ulian | 200, título "Painel Rafael Ulian", 8.764 bytes |
| R2ON | constrói e serve: 200, título "R2ON · Gestão inteligente de obras" |
| Dalu | 200, título "Dalu — Organize. Simplifique. Viva." |
| Central Rafaello's | 200, 1.532.746 bytes — o sistema inteiro |
| Assistente WhatsApp | sobe, responde `{"ok":true,"versao":"R2.3.0"}`, grava a sessão, roda sem ser root |
| Sistema Inteligente | banco próprio de pé e saudável, aceitando a senha do `.env` desta pasta, sem porta publicada; volume próprio (`sistema-inteligente_si_dados`) |

**Uma coisa não deu para exercitar nesta sessão:** a construção da API e da
tela do Sistema Inteligente. O Dockerfile dele instala pacote do sistema
(`postgresql-client`) e a rede desta sessão bloqueia o repositório do
Debian — conferido, responde 000. No servidor, com rede aberta, o passo
roda. Fica dito em vez de ser apresentado como testado.

**Retirada do que saiu da lista, testada:** montei um servidor de mentira
com o Central Jolô instalado e um `.env` escrito à mão. Ao rodar, ele foi
desligado e a pasta foi para `removidos/jolo-central-202610010246`, com o
`.env` intacto lá dentro.

Isolamento: seis pares testados, todos isolados.
Dalu: `functions/`, `*.md` e `*.mjs` dão 404; o aplicativo dá 200.

## Defeitos encontrados construindo (e corrigidos)

Nenhum destes apareceria em revisão de código — só construindo de verdade:

- **R2ON não instalava**: o pnpm 10 recusa rodar o passo de compilação do
  `esbuild` e do `workerd` sem autorização pelo nome
  (`ERR_PNPM_IGNORED_BUILDS`). Autorizados os dois, nominalmente; versão do
  pnpm fixada (com `latest`, a mesma pasta constrói diferente em dias
  diferentes).
- **Assistente do WhatsApp não instalava, por dois motivos**: o repositório
  não guarda `package-lock.json`, e sem ele o `npm ci` se recusa a rodar; e
  o Baileys puxa uma dependência do GitHub, então a etapa de construção
  precisa do `git` — sem ele o npm para com `spawn git`. Resolvido com duas
  etapas sobre a imagem oficial do Node (que já traz git), sem instalar
  pacote de sistema nenhum.
- **O relatório absolvia o que estava quebrado**: o R2ON falhou em
  construir e a conferência disse "no ar, esperando a chave". Era mentira na
  cara. Agora quem falhou aparece como falho.
- **O motivo da falha ia para o lixo** (`>/dev/null`): foi preciso ir atrás
  do erro à mão. Agora fica em `subida.log`, com as primeiras linhas na
  tela, e há uma segunda tentativa — a primeira falha costuma ser só puxar
  a imagem.
- **A API e a tela do Sistema Inteligente ficariam abertas para a
  internet.** O `include` do Compose **soma** a lista de portas em vez de
  trocar, então o `3000:3000` e o `3001:3001` do compose do repositório
  continuavam valendo junto com os meus `127.0.0.1:…` — o oposto do que
  este arquivo promete. Resolvido com `!override`, e agora há uma **trava**
  no instalador: ele lê o compose de cada projeto e reprova se qualquer
  porta publicada não estiver em `127.0.0.1`. Contraprova feita: abri uma
  porta de propósito e a trava acusou.
- **Sinal de saúde acusava doente contêiner são**: numa máquina com
  `http_proxy` no ambiente, o `wget` tentava sair pela rua para falar com
  ele mesmo. Agora usa `-Y off`; os projetos em Node usam o `fetch` do
  próprio Node, que ignora proxy.

Contraprovas, todas passaram: espelho vazio reprova; espelho que abre mas
não tem o sistema dentro reprova; site apontado para pasta inexistente
aparece como "NÃO respondeu"; projeto que falhou em construir não é
absolvido como "só falta a chave".

## Um ponto de segurança que mudou de dono

Fora da Cloudflare, o nginx serviria **todo** arquivo da pasta. O Dalu
guarda o aplicativo na raiz do repositório, junto com o código das funções
e documento interno — e o repositório é privado. Por isso
`functions/`, `assinar/`, `.github/`, `*.md`, `*.mjs` e `*.ts` ficam
fechados no `nginx.conf` dele. Conferido: 404.

O assistente do WhatsApp avisa no arranque quando está **sem `CHAVE_API`**:
o acesso fica aberto. Hoje ele escuta só em `127.0.0.1` e ninguém de fora
chega; no dia em que ganhar domínio, sem isso seria porta sem tranca.
A chave entrou como obrigatória: sem ela o robô não é ligado.

## O que depende do Rafael

1. Rodar no servidor: `bash vps-docker.sh`.
2. Colar as chaves em `/opt/sistemas/<projeto>/.env` e ligar:
   `cd /opt/sistemas/<projeto> && docker compose up -d --build`.
3. Ligar o domínio de cada um — instrução dentro do `nginx-site.conf`.
4. O assistente do WhatsApp só liga depois que o que atende hoje for
   desligado.

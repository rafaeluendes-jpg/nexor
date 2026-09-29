# Colocar o sistema no servidor (VPS Hostinger)

Este arquivo tem duas partes: **o que so o Rafael pode fazer** (tres
telas, nada de codigo) e **o que o servidor faz sozinho** depois disso.

O assistente daqui (Claude Code da nuvem) **nao alcanca a VPS**: este
ambiente nao tem saida para a porta de SSH. Por isso o caminho e levar o
Claude Code para dentro da VPS e trabalhar de la.

---

## Parte 1 — o que depende de voce

### 1. Abrir o terminal da VPS

No painel da Hostinger (hpanel.hostinger.com): **VPS** → no seu servidor,
**Gerenciar** → botao **Web console** (canto direito da Visao geral).
Abre uma aba nova ja logada como `root`. Se pedir senha, e a senha de root
do servidor — na mesma tela ha o "Redefinir senha". Se o navegador
bloquear a aba, libere pop-ups do hpanel.

Servidor de hoje: Ubuntu 24.04 LTS, plano KVM 1, IP `2.25.199.187`.
Nesse plano (4 GB de memoria, uma CPU) a compilacao e demorada — o
instalador liga 2 GB de memoria de troca antes de compilar justamente
para ela nao morrer no meio.

### 2. Entrar no GitHub pela propria VPS

O codigo fica num repositorio privado; o servidor precisa de permissao
para ler. Isso se resolve dentro da VPS mesmo, sem cadastrar nada em
lugar nenhum. Cole no Web console:

```bash
apt-get update -y && apt-get install -y gh git
gh auth login --hostname github.com --git-protocol https --web
```

Ele mostra um codigo curto e o endereco `github.com/login/device`: abra no
navegador, cole o codigo e autorize. Pronto — a permissao fica guardada na
VPS.

### 3. Baixar e instalar

```bash
gh auth setup-git
git clone --depth 1 --branch claude/geologia-elato-visual-identity-c3qwzv \
  https://github.com/rafaeluendes-jpg/nexor.git /opt/jolo
nohup bash /opt/jolo/jolo/scripts/instalar-vps.sh > /root/instalacao.log 2>&1 &
tail -f /root/instalacao.log
```

A ultima linha so mostra o andamento. A instalacao continua mesmo se a
aba do navegador fechar; para voltar a acompanhar, `tail -f
/root/instalacao.log`. No plano KVM 1 a compilacao demora — dez a vinte
minutos e normal.

### 4. Quando terminar

A ultima linha diz o endereco. Sem dominio configurado ainda: a landing
responde no IP do servidor e o CRM na porta 8080 dele.

### 5. Apontar os enderecos (dominio)

No painel de quem cuida do dominio `jologelato.com.br`, criar tres
registros **A** apontando para o IP da VPS:

| Nome | Tipo | Valor |
|---|---|---|
| `franquias` | A | `2.25.199.187` |
| `crm` | A | `2.25.199.187` |
| `api` | A | `2.25.199.187` |

Sem isso o sistema funciona pelo IP, mas **sem HTTPS** — e a Meta so
entrega mensagem do WhatsApp em HTTPS.

### 6. Credenciais da Meta

Continuam sendo suas: `docs/WHATSAPP_SETUP.md` diz onde pegar cada uma.
Sem elas o sistema sobe e funciona; o que nao funciona e o WhatsApp.

---

## Parte 2 — o que o servidor faz sozinho

Um comando so, de dentro da pasta do projeto na VPS:

```bash
DOMINIO_LANDING=franquias.jologelato.com.br \
DOMINIO_CRM=crm.jologelato.com.br \
DOMINIO_API=api.jologelato.com.br \
bash scripts/instalar-vps.sh
```

Sem os dominios (`bash scripts/instalar-vps.sh`) ele instala igual e
serve pelo IP: landing na porta 80, CRM na 8080, API na 8081.

O script faz, em ordem, e para na primeira falha:

1. pacotes de base (`curl`, `git`, `openssl`, firewall);
2. Docker;
3. Node 22 e pnpm;
4. o codigo em `/opt/jolo`;
5. o `.env`, com senha de banco e chave de sessao **geradas no servidor**
   (nunca exibidas, arquivo `600`, so root le). Um `.env` que ja existe
   **nunca** e reescrito;
6. Postgres 16 e Redis 7 de pe, escutando **so em 127.0.0.1**;
7. dependencias e compilacao;
8. estrutura do banco (migrations). A semente de fabrica **so entra em
   banco vazio** — nunca por cima de dado da operacao;
9. os quatro servicos (`jolo-api`, `jolo-workers`, `jolo-landing`,
   `jolo-crm`), que sobem junto com o servidor e voltam sozinhos se
   cairem, e conferencia do `/health`;
10. nginx na frente, configuracao conferida antes de recarregar, e
    certificado do Let's Encrypt quando o DNS ja aponta para o servidor.
    Firewall aberto so em 22, 80 e 443.

Rodar de novo e seguro: nao repete o que ja esta feito.

### Conferir o script sem servidor

```bash
MODO=conferir bash scripts/instalar-vps.sh
```

Gera numa pasta temporaria o `.env`, os servicos e a configuracao do
nginx que a instalacao criaria, e confere se sao validos. Nao toca em
nada do sistema.

---

## Depois de instalado

| Para que | Comando na VPS |
|---|---|
| Ver se esta tudo de pe | `systemctl status jolo-api jolo-workers jolo-landing jolo-crm` |
| Ler o que a API registrou | `journalctl -u jolo-api -f` |
| Reiniciar depois de mexer no `.env` | `systemctl restart jolo-api jolo-workers` |
| Atualizar para a versao nova | `bash /opt/jolo/jolo/scripts/instalar-vps.sh` |
| Backup do banco | `bash /opt/jolo/jolo/scripts/backup.sh` |

Quando as credenciais da Meta estiverem no `.env`, trocar
`NODE_ENV=staging` por `NODE_ENV=production` e reiniciar: em producao a
API se recusa a subir sem elas, de proposito.

O endereco do webhook para o painel da Meta:
`https://api.jologelato.com.br/webhooks/meta/whatsapp`.

## O que este ambiente nao consegue fazer

Ele nao tem cliente de SSH nem saida na porta 22: **nao da para instalar
a VPS daqui**, nem com IP e senha em maos. Tudo o que esta na Parte 2 foi
escrito e conferido aqui (`MODO=conferir`: `.env` validado pelo proprio
validador do sistema, configuracao do nginx conferida pelo nginx de
verdade, `docker compose` conferido pelo docker), mas a execucao completa
acontece na VPS, pelo Claude Code de lá.

---

## Caminho alternativo: Claude Code dentro da VPS

Quem preferir conversar com um assistente no proprio servidor pode
instalar o Claude Code la:

```bash
curl -fsSL https://claude.ai/install.sh | bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
claude
```

Exige assinatura Claude Pro ou Max **na conta que estiver logada no
navegador** na hora de autorizar — foi onde a primeira tentativa parou.
Nao e necessario para instalar o sistema: os passos acima bastam.

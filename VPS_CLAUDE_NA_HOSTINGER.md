# ⚠️ Correção de 22/09/2026 — a VPS paga é da HETZNER

Conferido nos e-mails do Rafael, no mesmo dia:

- **HostGator**: a VPS foi comprada em fevereiro e **cancelada com
  reembolso** em 28/02/2026. Não existe mais.
- **Hostinger**: só e-mail de propaganda. **Não há VPS** nessa conta — a
  tela que pedia plano era de compra, não de configuração. Não pagar.
- **Hetzner**: fatura de 22/09/2026, **US$ 5,97**, paga com o crédito da
  conta. **É esta a máquina que ele paga** — e é para ela que foram a
  central, o Rafaellos e o gestão de obras.

Consequência: **não trocar o sistema da máquina da Hetzner** — ela já
roda os outros sistemas, e trocar o sistema apaga tudo. O Claude Code
entra **ao lado** do que já existe, com um comando só, sem apagar nada.

O texto abaixo, sobre o template da Hostinger, fica só como registro.

---

# Trabalhar dentro da VPS — Hostinger

Pesquisa de 22/09/2026, a pedido do Rafael. (Primeiro falamos em
HostGator; a VPS é da **Hostinger**, e para o nosso caso isso é melhor.)

## O que a Hostinger oferece

A Hostinger tem um **template de VPS com o Claude Code já instalado** —
"Ubuntu 24.04 with Claude Code". Não é um robô de terceiros com o nome
Claude: é **o mesmo Claude Code** que você usa comigo, rodando na sua
máquina.

- Você escolhe o template na hora de instalar o sistema da VPS.
- O acesso é pelo **console do navegador**, dentro do painel da Hostinger
  — não precisa saber terminal nem instalar nada no computador.
- O login é com a **sua conta Claude**: roda `claude`, ele mostra um
  endereço, você abre, autoriza, e pronto. Sem chave de API avulsa e sem
  cobrança por uso separada.
- A Hostinger ainda tem o **Kodee**, o assistente do painel, que
  consegue destravar o servidor se você se trancar do lado de fora.

## Como ligar (é você que clica, leva uns 10 minutos)

1. Painel da Hostinger → **VPS** → sua máquina.
2. **Sistema operacional** → *Change OS / Trocar sistema* → escolha
   **Ubuntu 24.04 with Claude Code**.
   ⚠️ **Isso apaga tudo que estiver na VPS hoje.** Se tem alguma coisa
   rodando lá, me avise antes — a gente salva primeiro.
3. Abra o **Browser terminal / Console** no próprio painel.
4. Digite `claude` e siga o endereço que ele mostrar para entrar com a
   sua conta.

Daí em diante, dá para conversar com ele por ali — e é nessa máquina que
eu montaria as três coisas abaixo.

## Para que usar, na ordem

1. **Porta pelo WhatsApp.** Você manda o áudio, ele aciona o trabalho.
   (O robô do WhatsApp já é projeto seu; a VPS é a casa dele.)
2. **Vigia da madrugada.** Conferir se todas as lojas sincronizaram, se
   ficou caixa aberto, se alguma configuração se perdeu — e avisar antes
   de a loja abrir.
3. **Cópia do banco todo dia**, guardada na VPS, sob seu controle.

## O que não muda

O Claude que roda lá começa **sem a memória do Joia** — sem o protocolo de
engenharia, sem o portão de publicação, sem os guardiões. Ele puxa o
repositório e lê o `CLAUDE.md`, mas a regra continua valendo: alterar o
Joia passa por teste, portão verde e **ordem sua para publicar**. Isso não
é limitação da máquina; é o que impede um erro de parar a venda de uma
loja.

## O que preciso de você

1. Trocar o sistema da VPS para o template com Claude Code (passo acima).
2. O **acesso** da máquina (endereço e usuário/senha de SSH) — ou, se
   preferir, você mesmo cola no console os comandos que eu escrever.

Aviso honesto: **desta sessão eu não alcanço a sua VPS** — a rede deste
ambiente bloqueia saída. Então ou você cola os comandos no console, ou o
Claude Code do seu computador faz a ponte.

## Fontes

- Como usar o template de VPS com Claude Code —
  hostinger.com/support/11970152-how-to-use-the-claude-code-vps-template/
- Instalar o Claude Code numa VPS da Hostinger —
  hostinger.com/support/11929523-installing-claude-code-on-a-vps-at-hostinger/
- Hospedagem VPS para Claude Code — hostinger.com/vps/claude-code-hosting

*(A HostGator tem coisa parecida, o GatorClaw, mas é outro agente —
OpenClaw — que pede chave de API paga à parte. O caminho da Hostinger é
mais direto e mais barato para nós.)*

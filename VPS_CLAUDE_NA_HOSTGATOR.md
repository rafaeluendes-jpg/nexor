# Trabalhar dentro da VPS da HostGator — o que existe de verdade

Pesquisa feita em 22/09/2026, a pedido do Rafael. Ele estava certo: a
HostGator tem, sim, um assistente que roda dentro da VPS.

## O que a HostGator oferece

**GatorClaw** — um agente de IA que fica ligado dentro da sua VPS,
recebe comando por chat (inclusive **WhatsApp**) e executa tarefas na
máquina. Por baixo é o OpenClaw, empacotado pela HostGator para não
precisar configurar nada técnico.

- Pede VPS com **Ubuntu 22.04**.
- Você escolhe o "cérebro": Claude, GPT, Gemini, DeepSeek… e cola a
  **chave de API** do provedor. O painel testa na hora.
- **O consumo da chave é cobrado à parte, direto pelo provedor** — não
  está incluso na VPS nem na assinatura do Claude.

Além dele, o **Claude Code** (este mesmo que você usa comigo) instala em
qualquer VPS por uma linha de comando e roda pelo terminal ou pelo console
do navegador. Não depende de a hospedagem oferecer nada.

## O que isso muda — e o que não muda

**Muda:** passa a existir um assistente ligado 24 horas na sua máquina,
que você aciona pelo WhatsApp e que pode rodar rotina sozinho de
madrugada.

**Não muda:** esse assistente não é esta sessão. Ele começa sem a
memória do Joia — sem o protocolo de engenharia, sem o portão de
publicação, sem os guardiões. Por isso o papel dele deve ser este, e só
este, no começo:

1. **Porta de entrada pelo WhatsApp.** Você manda o áudio, ele me aciona.
2. **Vigia da madrugada.** Conferir se todas as lojas sincronizaram, se
   ficou caixa aberto, se alguma configuração sumiu — e te avisar antes
   de a loja abrir.
3. **Cópia do banco todo dia**, guardada na VPS, sob seu controle.

**Alterar o código do Joia continua passando pelo caminho de sempre:**
teste, portão verde, e publicação só com sua ordem. Isso não é limitação
de máquina — é o que impede um erro de parar a venda de uma loja.

## O que preciso de você

1. A VPS com **Ubuntu 22.04** (se hoje for outra versão, a HostGator
   reinstala pelo painel — perde o que estiver lá dentro, então avise
   antes se tiver algo).
2. Uma **chave de API da Anthropic** (console.anthropic.com → API keys).
   É cobrança por uso, separada da sua assinatura.
3. O **acesso da VPS** (endereço, usuário e senha/chave de SSH).

Um aviso honesto: **desta sessão aqui eu não alcanço a sua VPS** — a rede
deste ambiente bloqueia saída para fora. Então a instalação sai por um
destes dois caminhos: eu escrevo o passo a passo e você cola no painel, ou
o Claude Code do seu computador executa, que ele alcança a máquina.

## Fontes

- Como funciona o GatorClaw em uma VPS — suporte.hostgator.com.br/hc/pt-br/articles/49822075283603
- Configuração inicial do GatorClaw — suporte.hostgator.com.br/hc/pt-br/articles/49820359710099
- Servidor VPS GatorClaw — hostgator.com.br/servidor-vps/gatorclaw
- Instalar Claude Code numa VPS — hostinger.com/support/11929523

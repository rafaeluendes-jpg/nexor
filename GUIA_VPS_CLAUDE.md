# Nossa VPS com o Claude dentro
## Passo a passo — 23/09/2026

**O que vamos montar:** um Claude morando na VPS da Hostinger, ligado 24
horas. Você conversa com ele pelo app Claude do celular, ele mexe no
servidor, cuida do painel da Hostinger e faz a vigia das lojas de
madrugada. Depois, com ele lá dentro, trazemos o Joia e a Central.

**A VPS:** IP `2.25.199.187`. Ela **já roda um sistema em produção**
(gestao.jologelato.com.br). Regra de ouro: **nunca trocar o sistema
operacional dela** — isso apaga tudo. Tudo aqui entra **ao lado** do que
já existe.

⚠️ Senha nunca vai neste documento nem em conversa. Guarde no
gerenciador de senhas do Google.

---

# Fase 0 — Proteger antes de mexer (10 minutos)

**1. Entre no painel da Hostinger**
👉 https://hpanel.hostinger.com/vps
Clique na VPS → **Gerenciar**.

Se a VPS estiver na conta de outra pessoa (o Ricardo, por exemplo), peça
para ela te dar acesso de **Admin**: Perfil → **Compartilhamento de conta**
→ **Conceder acesso** → seu e-mail.
Como fazer: https://www.hostinger.com/support/1583777-how-to-share-access-to-your-account-at-hostinger/

**2. Tire uma foto da máquina (snapshot)**
No menu da VPS: **Snapshots e backups** → **Criar snapshot**.
É a rede de segurança: se qualquer coisa der errado, a máquina inteira
volta a como estava agora.

**3. Troque a senha de root**
No menu da VPS: **Configurações** → **Senha root** → **Alterar**.
A senha antiga ficou escrita em conversa e é fácil de adivinhar.
Use o botão de gerar senha e **guarde no gerenciador do Google**.

---

# Fase 1 — Instalar o Claude na VPS (15 minutos)

**1. Abra o terminal no próprio painel**
Na página da VPS, botão **Terminal do navegador** (*Browser terminal*),
no canto superior direito. Abre uma tela preta já dentro do servidor.

**2. Cole estes comandos, um de cada vez, apertando Enter depois de cada um**

Instala o Claude Code:
```
curl -fsSL https://claude.ai/install.sh | bash
```

Faz o servidor achar o programa recém-instalado:
```
export PATH="$HOME/.local/bin:$PATH" && echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

Instala o que mantém o Claude ligado quando você fecha a janela:
```
apt-get update && apt-get install -y tmux git
```

Traz o Joia para dentro da VPS (só o código, para ele ler as regras da casa):
```
git clone https://github.com/rafaeluendes-jpg/nexor.git /opt/joia
```

Abre uma "sala" que não desliga:
```
cd /opt/joia && tmux new -s claude
```

**3. Ligue o Claude e entre com a sua conta**
```
claude
```
Ele mostra um endereço. Abra no navegador, entre com a **sua conta
Claude** e autorize. Pronto: o Claude está dentro da VPS.

---

# Fase 2 — Conversar com ele pelo celular

**1.** Ainda no terminal da VPS, dentro da sala do passo anterior:
```
claude remote-control
```

**2.** No celular, abra o **app Claude** → **Claude Code**. A sessão da VPS
aparece na lista. Toque nela: a partir daí você fala com o Claude que
está dentro do servidor, de qualquer lugar.

**3.** Para fechar o terminal do painel **sem desligar o Claude**: aperte
`Ctrl` + `B`, solte, e aperte `D`. Ele continua rodando.
Para voltar a ver a sala depois: `tmux attach -t claude`.

---

# Fase 3 — Dar ao Claude acesso ao painel da Hostinger

Com isso ele consegue, sozinho: tirar snapshot, reiniciar a VPS, mexer no
firewall, no DNS e nos domínios.

No terminal da VPS (ou peça para ele mesmo, pelo celular):
```
claude mcp add --transport http hostinger https://mcp.hostinger.com
```
Ele mostra um endereço: abra, entre na **Hostinger** e autorize. Não é
preciso copiar chave nenhuma.
Sobre essa ligação: https://www.hostinger.com/support/11079316-hostinger-api-mcp-server/

---

# Fase 4 — A primeira conversa com o Claude da VPS

Mande exatamente isto pelo celular:

> Leia o /opt/joia/CLAUDE.md e o /opt/joia/GUIA_VPS_CLAUDE.md. Você está
> na VPS da rede Jolô, que já roda o sistema gestao.jologelato.com.br em
> produção. Antes de mudar qualquer coisa: me diga quanta memória e disco
> a máquina tem, o que está rodando nela e se o sistema gestao está
> saudável. Não altere nada nesta primeira conversa.

Ele devolve o raio-x da máquina. É com esse raio-x que se decide o
tamanho do que cabe lá.

---

# Fase 5 — A vigia da madrugada

Depois do raio-x, peça:

> Monte uma rotina que roda todo dia às 5h: confere a saúde da
> sincronização do Joia (vendas sem pagamento, caixas abertos, aparelhos
> sem sinal), as taxas de cartão de cada unidade e se o sistema gestao
> está no ar. Me mande o resumo de manhã.

A chave da API que ele vai usar para ler o Joia eu crio na hora, só para
ele, e passo pelo chat — nunca por documento.

---

# Fase 6 — Trazer o Joia e a Central para a VPS

A decisão é sua. A ordem abaixo existe para que **nenhuma loja fique
sem vender** em nenhum momento:

1. **Snapshot** da VPS (Fase 0) — sempre antes.
2. **Conferir se cabe:** o banco completo do Joia pede uns 4 GB de
   memória livres, além do que o sistema gestao já usa.
3. **Central primeiro, como piloto.** É menor e não trava caixa de loja.
   Copia o banco, liga na VPS, testa uma semana com o Supabase ainda
   ligado ao lado.
4. **Joia depois**, numa **noite de domingo**: copia o banco, portão de
   testes verde, vira a chave, plantão na segunda de manhã.
5. **Backup diário para fora da VPS** funcionando **antes** de virar a
   chave — na VPS, backup automático é tarefa nossa, não vem pronto.
6. **Plano pago do Supabase ligado mais um mês**, como volta imediata.
   Só depois disso se cancela.

O site das lojas (as telas) pode continuar no GitHub Pages, que é grátis
e não depende da VPS.

---

## O que o Claude da VPS continua não fazendo sozinho

- **Publicar versão nova do Joia nas lojas** — isso continua sendo ordem
  sua, como hoje.
- **Mexer no banco de produção sem teste** — o portão de testes vale lá
  também.

Não é desconfiança: é o que garante que um erro dele nunca pare a venda
de uma loja.

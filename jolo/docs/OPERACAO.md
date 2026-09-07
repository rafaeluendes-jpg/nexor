# Operacao do dia a dia

## Todo dia

1. A API responde? `curl https://api.SEU-DOMINIO/health`
2. Entrou lead novo no funil?
3. Alguma conversa esperando resposta ha mais de uma hora?
4. A copia de seguranca da madrugada rodou? (`var/backups`)

## Toda semana

- Ler o registro de auditoria: quem mexeu em que.
- Conferir se ha lead parado na mesma etapa ha muito tempo.
- Olhar o gasto da IA no painel do provedor.

## Todo mes

- **Restaurar uma copia num banco de teste** e conferir os numeros
  (`docs/BACKUP_RESTORE.md`). Copia que ninguem testou nao e copia.
- Rever quem tem acesso ao CRM e tirar quem saiu.

## Sinais que a Fase 2 acrescentou

- **COF perto do prazo:** a tela de COF mostra alerta a dois dias do fim.
- **Tarefa vencida:** aparece marcada na tela de Tarefas e no painel.
- **Lead parado:** o relatorio lista quem esta ha 3 dias ou mais sem andar.
- **Praca:** confira se as cidades vendidas estao marcadas como vendidas,
  senao a IA continua oferecendo.

## Quando algo da errado

### O lead nao aparece no funil

1. A API esta no ar? (`/health`)
2. Os workers estao rodando? Sem eles a mensagem fica na fila e nada
   acontece.
3. O Redis esta de pe? A fila vive nele.
4. O webhook ainda esta cadastrado no painel da Meta?

### A Meta recusa o webhook

O token de verificacao no painel tem de ser igual ao
`META_WEBHOOK_VERIFY_TOKEN` do servidor, e a API tem de estar no ar em
HTTPS na hora de salvar.

### Chegou mensagem mas o sistema recusou

Registro de auditoria com "webhook recusado por assinatura" quase sempre
significa `META_APP_SECRET` errado ou trocado no painel. Confira e
reinicie a API.

### O botao da landing nao abre o WhatsApp

`NEXT_PUBLIC_WHATSAPP_NUMBER` esta vazio ou incompleto. Ele precisa de
DDI, DDD e numero, so digitos. Depois de mudar, a landing precisa ser
compilada de novo: esse valor entra na hora da compilacao.

### Ninguem consegue entrar no CRM

Cinco tentativas erradas bloqueiam o IP por quinze minutos. Espere ou
reinicie o Redis (isso zera os contadores).

### A tela nao atualiza sozinha

O canto da tela de Conversas mostra "atualizando sozinho" ou
"reconectando…". Se ficar em "reconectando", o Redis provavelmente caiu:
o canal de avisos vive nele. A tela continua funcionando — ela volta a
atualizar de tempos em tempos — mas o aviso imediato para.

### O contrato nao libera na tela de COF

Isso e proposital. Faltam dias do prazo legal, e o proprio recado diz
quantos. Nao existe caminho pela tela para liberar antes.

### A IA parou de responder

Provavel fim de credito no provedor, ou a conversa foi assumida por uma
pessoa (a IA cala de proposito nesse caso).

## Quem faz o que

| Assunto | Quem resolve |
|---|---|
| Credencial da Meta, do Supabase, do provedor de IA | operador (dono) |
| Numero oficial do WhatsApp | operador |
| Aprovacao de modelo de mensagem na Meta | operador |
| Erro no sistema, ajuste de tela, regra nova | desenvolvimento |
| Restaurar copia de seguranca | desenvolvimento, com aviso ao dono |

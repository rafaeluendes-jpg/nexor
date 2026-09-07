# Ligar o WhatsApp oficial (Meta Cloud API)

O sistema so fala pelo **WhatsApp Business Platform Cloud API**, da propria
Meta. Nao ha QR Code, nao ha celular ligado num servidor, nao ha
biblioteca nao oficial. Isso protege o numero da rede de bloqueio.

## O que depende de voce (operador)

Estas etapas exigem conta e decisao do dono. Nenhuma delas pode ser feita
pelo programador.

1. **Conta Meta Business** (business.facebook.com) verificada.
2. **App do tipo Business** no painel de desenvolvedores da Meta
   (developers.facebook.com), com o produto **WhatsApp** adicionado.
3. **Numero de telefone** dedicado, que ainda nao esteja em uso no
   aplicativo comum do WhatsApp.
4. **Usuario de sistema** com token permanente e permissoes
   `whatsapp_business_messaging` e `whatsapp_business_management`.

Anote e guarde: App ID, App Secret, token de acesso permanente,
Phone Number ID e WhatsApp Business Account ID.

## O que colocar no `.env`

| Variavel | Onde encontrar |
|---|---|
| `META_APP_ID` | painel do app, em Configuracoes |
| `META_APP_SECRET` | mesmo lugar, botao "Mostrar" |
| `META_WHATSAPP_ACCESS_TOKEN` | token do usuario de sistema |
| `META_WHATSAPP_PHONE_NUMBER_ID` | WhatsApp > Configuracao da API |
| `META_WHATSAPP_BUSINESS_ACCOUNT_ID` | mesmo lugar |
| `META_WEBHOOK_VERIFY_TOKEN` | voce inventa uma frase secreta e repete no painel |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | o numero, so digitos, com DDI e DDD |

Enquanto `NEXT_PUBLIC_WHATSAPP_NUMBER` estiver vazio, o botao da landing
nao abre nada. E de proposito: melhor nao abrir do que mandar o
interessado para um numero errado.

## Cadastrar o webhook

No painel da Meta, em WhatsApp > Configuracao:

- **URL de callback:** `https://SEU-DOMINIO/webhooks/meta/whatsapp`
- **Token de verificacao:** o mesmo `META_WEBHOOK_VERIFY_TOKEN`
- **Campos assinados:** `messages`

A Meta faz uma chamada de conferencia na hora de salvar. Se a API estiver
no ar com o token certo, ela salva; se nao, ela recusa. Nao ha como
"forcar".

Depois de salvar, marque tambem os eventos de status (entregue, lido)
no mesmo campo `messages`.

## Como o sistema se protege

- **Assinatura conferida em toda chamada.** Cada evento vem com o
  cabecalho `x-hub-signature-256`. Se a conta nao bate com o App Secret,
  o evento e recusado com 403 e registrado para auditoria. Nada e
  processado antes disso.
- **Evento repetido nao vira lead repetido.** A Meta reenvia quando fica
  em duvida da entrega; o sistema guarda a identificacao de cada evento e
  ignora o que ja entrou.
- **Resposta rapida.** O webhook so grava e coloca na fila. O trabalho
  pesado fica com os workers, fora do caminho da Meta.

## Modelos de mensagem

Fora da janela de 24 horas, a Meta so permite mensagem de modelo
aprovado. Ha tres cadastrados no seed (`primeiro_contato`,
`follow_up_24h`, `lembrete_reuniao`). Eles precisam ser criados e
aprovados no painel da Meta com o mesmo nome.

## Conferir que ficou funcionando

1. `curl "https://SEU-DOMINIO/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=teste"`
   tem de devolver `teste`.
2. Mande uma mensagem do seu celular para o numero da empresa.
3. O lead tem de aparecer sozinho no funil do CRM, na etapa
   "IA qualificando" (ou "Novo lead", se a IA estiver desligada).

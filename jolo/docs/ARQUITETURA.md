# Arquitetura

## O caminho do interessado

```
Landing (jologelato)      Meta / WhatsApp            CRM Jolo
  |                             |                        |
  | clica "Fale com o dono"     |                        |
  |---> grava a origem -------> API                      |
  |                             |                        |
  | abre wa.me com a mensagem   |                        |
  | e o codigo de rastreio      |                        |
  |                             |                        |
  |          manda a mensagem ->|                        |
  |                             |-- webhook assinado --> API
  |                             |                        |-> fila (Redis)
  |                             |                        |-> worker cria
  |                             |                        |   contato, lead
  |                             |                        |   e conversa
  |                             |                        |-> lead no funil
```

## As pecas

| Peca | O que faz | Tecnologia |
|---|---|---|
| `apps/landing` | a pagina publica de franquias | Next.js |
| `apps/crm` | o painel do time de expansao | Next.js |
| `apps/api` | as regras e as rotas | NestJS + Fastify |
| `workers` | tudo que nao pode travar a resposta da Meta | BullMQ |
| `packages/*` | codigo comum, um assunto por pacote | TypeScript |
| Postgres | os dados | Prisma |
| Redis | a fila | BullMQ |

## Por que separar em pacotes

Cada pacote tem um assunto so, e isso mantem os arquivos pequenos o
bastante para caberem inteiros na cabeca de quem for mexer:

- `shared`: telefone, permissoes, etapas do funil, erros;
- `config`: variaveis de ambiente (porta publica e porta de servidor);
- `security`: assinatura da Meta, limite de tentativa;
- `whatsapp`: leitura do webhook e envio pela Cloud API;
- `attribution`: de onde veio o lead, com o primeiro toque preservado;
- `crm-core`: contato, lead, funil, conversa, pontuacao, auditoria;
- `ai-sdr`: a IA e as ferramentas que ela pode usar;
- `analytics`: numeros do funil;
- `database`: o desenho do banco.

## Regras que o desenho garante

**O primeiro toque nunca e trocado.** Quem trouxe o lead na primeira
visita continua levando o credito, mesmo que ele volte depois por outro
caminho.

**Evento repetido nao vira lead repetido.** Cada mensagem tem
identificacao propria; a segunda vez e ignorada.

**A IA nao encosta no banco.** Ela so age por dez ferramentas
autorizadas (ver `docs/IA_SDR.md`). Nao existe caminho da IA para o SQL.

**Quando o humano assume, a IA cala.** A conversa passa a ter dono e a
IA para de responder ate ser liberada de novo.

**Nada some sem registro.** Mudanca de etapa, atendimento assumido,
usuario alterado: tudo vira linha de auditoria com autor, data e origem.

## Onde a resposta precisa ser rapida

O webhook da Meta responde em milissegundos: ele so confere a assinatura,
grava o evento e coloca na fila. Criar contato, ligar a campanha, chamar
a IA e atualizar a planilha acontecem depois, nos workers. Se a Meta
esperar demais, ela corta a entrega.

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

## Tempo real

Quando uma mensagem chega, quando um lead muda de etapa e quando alguem
assume uma conversa, as telas abertas se atualizam **sem F5**.

Como funciona: o worker (ou a API) publica um aviso curto num canal do
Redis, um canal por empresa. A tela do CRM fica ouvindo esse canal e,
ao receber o aviso, busca o dado atualizado pela API normal.

Duas decisoes importantes:

- **O aviso nao carrega dado.** Ele so diz "a conversa X mudou". Quem
  busca o conteudo e a tela, com a permissao de quem esta olhando. Assim
  ninguem recebe pelo canal algo que nao poderia ver na tela.
- **O canal e da empresa, nunca do pedido.** A inscricao usa o
  identificador de quem esta logado. Nao existe parametro na URL para
  escutar o movimento de outra empresa.

Se a conexao cair, a tela volta a atualizar de tempos em tempos e tenta
reconectar com espera crescente.

## As regras de negocio ficam no banco, nao no codigo

Horario de atendimento, quem atende o lead novo, pesos da pontuacao e os
textos padrao da IA sao configuracao, e mudam pela tela. O codigo traz
apenas o valor de fabrica, usado enquanto a loja nao mexeu em nada.

Cada configuracao tem um formato conferido na entrada: configuracao
invalida nao entra, e o recado diz exatamente qual campo esta errado.

## O prazo da COF e uma trava, nao um aviso

A Lei de Franquias exige dez dias entre a entrega da Circular de Oferta de
Franquia e a assinatura do contrato. O sistema conta esse prazo a partir da
data de **recebimento** e **recusa** a liberacao do contrato antes do fim,
dizendo quantos dias faltam. Nao ha caminho pela tela que passe por cima
disso.

## Onde a resposta precisa ser rapida

O webhook da Meta responde em milissegundos: ele so confere a assinatura,
grava o evento e coloca na fila. Criar contato, ligar a campanha, chamar
a IA e atualizar a planilha acontecem depois, nos workers. Se a Meta
esperar demais, ela corta a entrega.

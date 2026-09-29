# Seguranca

## O que nunca sai do servidor

Estes valores existem so no `.env` do servidor e nunca chegam ao
navegador nem ao Git:

`META_APP_SECRET`, `META_WHATSAPP_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_JWT_SECRET`, `OPENAI_API_KEY`, `JWT_SECRET`, `DATABASE_URL`.

Como isso e garantido, e nao so prometido:

- O pacote publicado para o navegador so recebe variaveis que comecam com
  `NEXT_PUBLIC_`. Nenhuma das acima comeca assim.
- O pacote `@jolo/config` tem duas portas: a publica
  (`@jolo/config`, so o que o navegador pode ver) e a de servidor
  (`@jolo/config/server`, com o contrato de ambiente). O front-end so
  importa a publica.
- Ha um teste que abre os arquivos compilados da landing e do CRM e
  procura por esses valores e por esses nomes. Se aparecer qualquer um,
  a bateria reprova (`tests/e2e/seguranca.spec.ts`).

## Senhas

- Em producao a senha vive no **Supabase Auth**. O sistema nao guarda
  senha propria, nao inventa hash, nao tem "recuperar senha" caseiro.
- Em desenvolvimento existe um hash local (bcrypt, custo 12) so para dar
  para trabalhar sem conta na nuvem. Ele e recusado se `NODE_ENV` for
  `production`.
- Nenhuma resposta da API devolve senha, hash, token de terceiro ou chave
  de servico. Ha teste para isso.

## Entrada no sistema

- Cinco tentativas de login por IP a cada quinze minutos. Passou disso, o
  IP fica bloqueado por um tempo, mesmo com a senha certa.
- Senha errada e e-mail inexistente devolvem **a mesma resposta**. Quem
  esta tentando adivinhar nao descobre quais e-mails existem.
- A sessao e um token assinado com validade curta; cada sessao tem
  registro proprio e pode ser encerrada de fora ("encerrar sessoes").

## Permissao

Seis papeis (`SUPER_ADMIN`, `ADMIN`, `EXPANSAO`, `ATENDENTE`,
`MARKETING`, `VISUALIZACAO`) e vinte e cinco permissoes.

**Quem decide e o servidor.** Esconder um botao na tela nao e seguranca:
toda rota confere a permissao antes de responder, e ha teste que entra
com um usuario de leitura e confirma o 403.

## Webhook da Meta

Ordem obrigatoria, na ordem: conferir a assinatura, gravar o evento cru,
colocar na fila, responder 200. Assinatura errada, ausente ou de outro
segredo: 403, sem dizer onde errou, e a tentativa fica registrada.

## Cabecalhos das paginas

Politica de conteudo (CSP), `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy` e `Strict-Transport-Security`.
A tecnologia do servidor nao e anunciada.

## Origem das chamadas (CORS)

A API so responde para as origens listadas em `CORS_ALLOWED_ORIGINS`.
Em producao, so os enderecos reais da landing e do CRM. Um site de fora
nao consegue ler a resposta.

## Registro de auditoria

Toda acao que muda dado grava quem fez, o que fez, quando e de onde:
mudanca de etapa, atendimento assumido, usuario criado, permissao
alterada. Nada some sem deixar rastro.

## Dados pessoais (LGPD)

O sistema guarda nome, telefone, cidade e o que a pessoa contou sobre o
interesse na franquia. E dado de contato comercial, com finalidade
declarada na pagina de privacidade. O que a operacao precisa manter:

- so quem trabalha com expansao tem acesso;
- pedido de exclusao apaga o contato e as conversas dele;
- as copias de seguranca tambem envelhecem (30 dias por padrao).

### Termo de uso e confidencialidade (desde 29/09/2026)

Todo usuario do CRM aceita o termo antes de ver qualquer dado. Nao e so a
tela: a API recusa toda rota com dado (`428 TERMO_PENDENTE`) ate o aceite
da versao vigente. Ficam de fora apenas ler o termo, aceitar, saber quem
e, trocar a propria senha e sair.

- O aceite guarda usuario, versao, data, IP e navegador
  (`term_acceptances`) e gera o evento `termo_aceito` na auditoria.
- Aceitar de novo nao muda a data do primeiro aceite: ela e a prova.
- Aceitar uma versao que nao e a vigente e recusado (409).
- O texto mora em `packages/shared/src/termo.ts`. **Mudou o texto, troque
  a versao**: todos aceitam de novo. Texto novo com versao velha seria
  aceite de algo que a pessoa nao leu.

### Pedido para parar no WhatsApp

Quem responde PARAR (ou "sair", "stop", "nao quero mais receber"...) e
atendido na hora, sem depender do robo entender:

- o contato fica marcado para sempre (`contacts.optOutAt`) e aparece com
  a etiqueta "Nao contatar" na lista de contatos;
- a conversa sai do robo; recebe uma unica confirmacao;
- robo e acompanhamento automatico nunca mais falam com ele. Se a pessoa
  voltar a escrever, uma pessoa da equipe pode responder.
- O reconhecimento e conservador ("quero parar de trabalhar para abrir uma
  franquia" nao e pedido de parada): `packages/shared/src/optout.ts`.

### Aviso no primeiro contato

O robo, na primeira mensagem, diz para que os dados serao usados, que a
pessoa pode responder PARAR e o link da politica de privacidade. Nunca
pede documento, CPF, dado bancario ou senha pelo WhatsApp. Pedido de
ver, corrigir ou apagar dados vai para uma pessoa.

## Se um segredo vazar

1. Trocar o valor no painel de origem (Meta, Supabase, provedor de IA).
2. Atualizar o `.env` do servidor e reiniciar a API e os workers.
3. Encerrar todas as sessoes (`POST /auth/logout-all` por usuario).
4. Conferir o registro de auditoria no periodo.

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

## Se um segredo vazar

1. Trocar o valor no painel de origem (Meta, Supabase, provedor de IA).
2. Atualizar o `.env` do servidor e reiniciar a API e os workers.
3. Encerrar todas as sessoes (`POST /auth/logout-all` por usuario).
4. Conferir o registro de auditoria no periodo.

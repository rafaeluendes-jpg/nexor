# Relatorio da Fase 1 — Jolo Franquias

Data: 07/09/2026
Situacao: **Fase 1 concluida. Aguardando aprovacao para a Fase 2.**

---

## 1. O que foi construido

A base do caminho inteiro, do clique ate o lead no funil:

```
LANDING -> BOTAO "FALE COM O DONO" -> WHATSAPP OFICIAL DA META -> CRM JOLO
```

O que ja funciona de ponta a ponta, provado por teste automatizado:

1. o interessado chega na landing por um anuncio;
2. aperta "Fale com o dono";
3. o sistema grava de onde ele veio;
4. o WhatsApp abre no numero oficial, com a mensagem pronta e um codigo
   de rastreio dentro dela;
5. ele manda a mensagem;
6. a Meta avisa o sistema pelo webhook oficial, com assinatura conferida;
7. o sistema cria contato, lead e conversa, liga o lead a campanha que o
   trouxe e coloca no funil;
8. o time de expansao ve o lead no CRM, com a origem certa.

## 2. A pagina aprovada foi preservada

A referencia e `legacy/landing-approved.html`, com as imagens
externalizadas em `legacy/assets/` e o arquivo original registrado por
soma de verificacao (`legacy/ORIGINAL.sha256`).

Nao foram alterados: fotografias, textos, cores, identidade visual,
logo, composicao, ordem das secoes nem conteudo.

A prova e um teste que compara bloco a bloco a pagina servida com a
aprovada (`tests/e2e/fidelidade-visual.spec.ts`):

| Tela | Blocos comparados | Divergentes |
|---|---|---|
| Computador (1440) | 65 | 0 |
| Tablet (834) | 65 | 0 |
| Celular (390) | 65 | 0 |

O que mudou foi so o necessario para a pagina virar sistema: as imagens
que estavam embutidas viraram arquivos servidos com cache, e os seis
botoes "Fale com o dono" passaram a chamar uma unica funcao central em
vez de montar o link cada um por conta propria.

## 3. Numeros

| | |
|---|---|
| Pacotes internos | 9 |
| Arquivos TypeScript | 241 |
| Linhas de codigo | 11.120 |
| Tabelas no banco | 42 |
| Rotas na API | 29 |
| Etapas do funil | 14 |
| Papeis de acesso | 6 |
| Permissoes | 25 |
| Ferramentas da IA | 10 |
| Testes de unidade | 48 |
| Testes de ponta a ponta | 51 |

## 4. Testes

Todos verdes, executados em 07/09/2026.

### Unidade (48, `pnpm test`)

| Assunto | Casos |
|---|---|
| Assinatura do webhook da Meta | 9 |
| Telefone e deduplicacao de contato | 5 |
| Pontuacao e temperatura do lead | 6 |
| Leitura do webhook e idempotencia | 4 |
| Atribuicao de origem | 6 |
| Permissao por papel | 7 |
| Link do botao do WhatsApp | 5 |
| Contrato de ambiente (o que producao exige) | 6 |

### Ponta a ponta (51, `pnpm test:e2e`, Chromium de verdade)

| Arquivo | O que prova | Casos |
|---|---|---|
| `landing.spec.ts` | pagina abre sem erro, secoes na ordem, fotos carregam, sem rolagem horizontal, botoes com area de toque, SEO | 6 x 2 telas |
| `fidelidade-visual.spec.ts` | a pagina servida e igual a aprovada | 3 |
| `whatsapp-botao.spec.ts` | numero certo, mensagem pronta, codigo de rastreio, origem registrada, primeiro toque preservado, abre mesmo com API fora | 6 |
| `webhook.spec.ts` | challenge, assinatura invalida, corpo adulterado, evento repetido, payload estranho, confirmacao de leitura | 9 |
| `crm.spec.ts` | login, papel e permissao, rota protegida, token adulterado, funil, forca bruta, telas | 13 |
| `seguranca.spec.ts` | segredo no pacote do navegador, cabecalhos, CORS, dados invalidos, injecao de SQL | 7 |
| `fluxo-completo.spec.ts` | o caminho inteiro numa corrida so | 1 |

## 5. Defeitos encontrados e corrigidos durante os testes

Os testes nao passaram de primeira. O que eles pegaram:

| Defeito | Consequencia se tivesse passado | Correcao |
|---|---|---|
| Telefone escrito com o zero do DDD (`017...`) nao era reconhecido | o mesmo interessado viraria dois leads | o zero de tronco passou a ser descartado |
| O contrato de ambiente do servidor estava dentro do pacote enviado ao navegador, com o valor padrao de `JWT_SECRET` | nomes e valores de segredo visiveis para qualquer visitante | o pacote de configuracao foi partido em porta publica e porta de servidor |
| Login respondia 201 ("recurso criado") | integracao futura que espera 200 quebraria | login, logout e troca de senha respondem 200 |
| `.env` com valor de frase sem aspas | qualquer script que lesse o arquivo quebrava | valores com espaco passaram a ir entre aspas |
| Script de restauracao imprimia a senha do banco na tela | senha exposta em log e em historico de terminal | a senha e mascarada |
| Producao aceitava a chave de assinatura de desenvolvimento, que esta no repositorio | quem conhecesse a chave assinaria qualquer sessao | producao passou a recusar essa chave e a exigir uma propria |
| Os workers nao tinham compilacao, mas a documentacao mandava rodar o compilado | quem seguisse o passo a passo nao subiria os workers | os workers passaram a compilar como a API |

## 6. Seguranca

- **Nenhum segredo vai para o navegador.** Ha teste que abre os arquivos
  compilados da landing e do CRM e procura por cada segredo e por cada
  nome de segredo. Reprova se achar.
- **Senha:** em producao vive no Supabase Auth. O sistema nao guarda
  senha propria nem inventa hash. O atalho local de desenvolvimento e
  recusado quando `NODE_ENV=production`.
- **Nunca exibido:** senha, hash, token, chave de servico. Testado.
- **Webhook:** assinatura conferida antes de qualquer processamento;
  recusa devolve 403 sem dizer onde errou; a tentativa fica registrada.
- **Forca bruta:** cinco tentativas por IP a cada quinze minutos.
  Testado, inclusive que a senha certa tambem e barrada durante o castigo.
- **Enumeracao de usuario:** senha errada e e-mail inexistente devolvem
  resposta identica. Testado.
- **Permissao:** decidida no servidor. Testado com usuario de leitura
  levando 403 ao tentar criar usuario.
- **CORS:** so as origens autorizadas leem a resposta. Testado.
- **Cabecalhos:** CSP, nosniff, DENY em frame, referrer, HSTS,
  permissoes. Testado.
- **Auditoria:** toda mudanca de dado grava autor, acao, data e origem.

Detalhe em `docs/SEGURANCA.md`.

## 7. A IA nao acessa o banco

A IA age por dez ferramentas autorizadas e nada alem disso. Nao existe
caminho dela para o SQL. Cada ferramenta valida o que recebe antes de
gravar. Sem credencial de IA configurada, ela fica desligada e cada
mensagem vira tarefa para uma pessoa responder: nao se inventa resposta.

## 8. Copia de seguranca

Script de copia com verificacao (`scripts/backup.sh`) e script de
restauracao com confirmacao por escrito (`scripts/restaurar.sh`).

**Restauracao testada de verdade em 07/09/2026:** copia gerada,
restaurada num banco separado, contagens conferidas contra o banco de
origem (4 usuarios, 3 leads, 3 contatos, 14 etapas — identicas), banco de
teste apagado. Passo a passo em `docs/BACKUP_RESTORE.md`.

## 9. Documentacao entregue

| Arquivo | Para quem |
|---|---|
| `docs/INSTALACAO.md` | quem for montar o ambiente |
| `docs/ARQUITETURA.md` | quem for mexer no codigo |
| `docs/DEPLOYMENT.md` | quem for publicar |
| `docs/WHATSAPP_SETUP.md` | operador, para ligar o WhatsApp oficial |
| `docs/CRM_MANUAL.md` | time de expansao |
| `docs/IA_SDR.md` | quem for configurar a IA |
| `docs/SEGURANCA.md` | referencia de seguranca |
| `docs/OPERACAO.md` | rotina do dia a dia e o que fazer quando da errado |
| `docs/BACKUP_RESTORE.md` | copia e restauracao |
| `infra/docker/README.md`, `infra/monitoring/README.md` | infraestrutura |

## 10. O que depende do operador

Nada disso pode ser feito por quem programa. Sao contas, credenciais e
decisoes comerciais.

| O que | Para que serve | Enquanto nao houver |
|---|---|---|
| Conta Meta Business verificada + App | falar pelo WhatsApp oficial | o sistema roda, mas nao envia nem recebe WhatsApp de verdade |
| `META_APP_ID`, `META_APP_SECRET` | conferir a assinatura do webhook | o webhook recusa tudo |
| `META_WHATSAPP_ACCESS_TOKEN`, `..._PHONE_NUMBER_ID`, `..._BUSINESS_ACCOUNT_ID` | enviar mensagem | o sistema recebe, mas nao responde |
| `META_WEBHOOK_VERIFY_TOKEN` | cadastrar o webhook no painel | a Meta nao aceita o cadastro |
| **Numero oficial do WhatsApp** (`NEXT_PUBLIC_WHATSAPP_NUMBER`) | o botao da landing | o botao nao abre nada, de proposito |
| Projeto Supabase + chaves | login em producao | producao nao sobe (recusa proposital) |
| `OPENAI_API_KEY` (ou outro provedor) | a IA de primeiro atendimento | mensagem vira tarefa para uma pessoa |
| Aprovacao dos modelos de mensagem na Meta | falar fora da janela de 24h | so responde dentro de 24h |
| Dominio e certificado HTTPS | publicar | a Meta so entrega webhook em HTTPS |

Tudo isso esta marcado como `[OPERADOR]` no `.env.example`, com o lugar
exato de onde tirar cada valor em `docs/WHATSAPP_SETUP.md`.

## 11. O que NAO foi feito (e por que)

Fora do escopo da Fase 1, conforme o combinado:

- envio ativo de mensagem em massa e campanhas de disparo;
- COF, contrato e assinatura eletronica (etapas existem no funil, o
  processo em si e a Fase 2);
- relatorios avancados e paineis de analise;
- aplicativo de celular;
- integracao com ERP ou financeiro.

Nada disso foi comecado pela metade. O que esta no sistema, esta
inteiro e testado.

## 12. Como conferir

```bash
pnpm install
cd infra/docker && docker compose up -d && cd ../..
cp .env.example .env        # preencher o que for [OPERADOR]
pnpm build && pnpm db:migrate && pnpm db:seed
pnpm dev:api & pnpm workers & pnpm dev:landing & pnpm dev:crm &
pnpm test                   # 48 testes de unidade
pnpm test:e2e               # 51 testes de ponta a ponta
```

---

**Fim da Fase 1. Nada da Fase 2 foi comecado. Aguardando aprovacao.**

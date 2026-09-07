# Jolo Franquias

Sistema de captacao e acompanhamento de candidatos a franqueado da rede
**Jolo Gelato**: a pagina publica de franquias, o botao "Fale com o dono"
ligado ao WhatsApp oficial da Meta, e o CRM onde o time de expansao
acompanha cada interessado ate virar franqueado.

```
LANDING -> BOTAO "FALE COM O DONO" -> WHATSAPP OFICIAL -> CRM
```

## Comecar

Passo a passo em **[docs/INSTALACAO.md](docs/INSTALACAO.md)**.

```bash
pnpm install
cp .env.example .env      # preencher o que estiver marcado [OPERADOR]
pnpm build && pnpm db:migrate && pnpm db:seed
./scripts/dev-up.sh       # sobe banco, fila, API, workers e as telas
```

## Documentacao

| Arquivo | Para que serve |
|---|---|
| [docs/INSTALACAO.md](docs/INSTALACAO.md) | montar o ambiente |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | entender as pecas antes de mexer |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | publicar |
| [docs/WHATSAPP_SETUP.md](docs/WHATSAPP_SETUP.md) | ligar o WhatsApp oficial |
| [docs/CRM_MANUAL.md](docs/CRM_MANUAL.md) | usar o CRM |
| [docs/IA_SDR.md](docs/IA_SDR.md) | a IA de primeiro atendimento |
| [docs/SEGURANCA.md](docs/SEGURANCA.md) | o que protege o que |
| [docs/OPERACAO.md](docs/OPERACAO.md) | rotina e solucao de problemas |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | copia e restauracao |
| [docs/PHASE_1_REPORT.md](docs/PHASE_1_REPORT.md) | o que a Fase 1 entregou |
| [docs/PHASE_2_REPORT.md](docs/PHASE_2_REPORT.md) | o que a Fase 2 entregou |

## Testes

```bash
pnpm test        # unidade
pnpm test:e2e    # ponta a ponta, no navegador (precisa dos servicos no ar)
pnpm typecheck   # tipos
```

## Regras que nao se quebram

1. **A pagina aprovada e a referencia.** `legacy/landing-approved.html`
   nao se altera. Ha teste que compara bloco a bloco.
2. **So WhatsApp oficial da Meta.** Nada de QR Code, sessao nao oficial
   ou biblioteca de terceiro.
3. **Segredo nao vai para o navegador nem para o Git.** Ha teste que
   procura por eles nos arquivos compilados.
4. **A IA nao encosta no banco.** So as ferramentas autorizadas.
5. **Corrigir uma coisa nao autoriza mexer em outra.**

## Estrutura

```
apps/landing   pagina publica       apps/crm    painel do time
apps/api       regras e rotas       workers     fila e processamento
packages/      codigo comum         legacy/     a pagina aprovada
docs/          documentacao         infra/      banco, fila, publicacao
tests/         unidade e ponta a ponta
```

# Relatorio da Fase 2 — Jolo Franquias

Data: 07/09/2026
Situacao: **Fase 2 concluida.**

---

## 1. O que a Fase 2 acrescentou

A Fase 1 entregou o caminho do clique ate o lead no funil. A Fase 2
entrega **o processo inteiro de franquia**, do primeiro contato ao
contrato assinado:

```
LEAD -> QUALIFICACAO -> REUNIAO -> COF (prazo legal) -> CONTRATO -> VENDA
```

Com tudo o que a operacao precisa em volta: agenda, tarefas, documentos,
pracas, relatorios, configuracao das regras, auditoria e as telas para
administrar isso.

## 2. Modulos novos

| Modulo | O que resolve |
|---|---|
| **COF** | O prazo legal de 10 dias, contado do recebimento, com trava real |
| **Documentos** | Armazenamento privado com controle de acesso e registro de abertura |
| **Agenda** | Reunioes e visitas, que movem o lead no funil sozinhas |
| **Tarefas** | O que o time precisa fazer, com prazo e dono |
| **Pracas** | Cidades da rede: disponivel, em analise, negociacao, reservada, vendida |
| **Relatorios** | Todas as metricas do funil, por campanha, origem, cidade e responsavel |
| **Auditoria** | Consulta ao registro de tudo que mudou dado |
| **Contatos** | Todo telefone que ja falou com a rede, sem repetir ninguem |
| **Configuracoes** | Horario, roteamento de leads e pesos da pontuacao, pela tela |
| **Modelos de mensagem** | Cadastro dos modelos que a Meta precisa aprovar |
| **Integracao** | O que ja esta ligado e o que falta, sem mostrar segredo |
| **Tempo real** | As telas se atualizam sozinhas, sem F5 |

## 3. Telas do CRM

Dezenove telas, organizadas em quatro areas no menu lateral:

- **Atendimento:** Painel, Conversas, Funil, Leads, Contatos
- **Processo:** Agenda, Tarefas, COF, Documentos, Pracas
- **Analise:** Relatorios, Origem dos leads, Exportacoes
- **Administracao:** Usuarios e acessos, Modelos de mensagem, IA de
  atendimento, Integracao WhatsApp, Configuracoes, Auditoria

Mais a ficha completa de cada lead, com qualificacao, origem, linha do
tempo, reunioes, tarefas, COF e documentos numa tela so.

**O menu mostra apenas o que a pessoa pode acessar** — e o servidor barra
de todo jeito, com ou sem o botao na tela.

## 4. As regras que a Fase 2 garante

**O prazo da COF e uma trava, nao um aviso.** Dez dias entre o
recebimento da Circular e a liberacao do contrato. Tentar antes recebe
recusa com o numero de dias que faltam. Nao ha caminho pela tela que passe
por cima. A ordem tambem e conferida: nao se recebe uma COF que nao foi
enviada, nem com data anterior ao envio.

**Marcar reuniao move o lead.** Quem marcou nao precisa lembrar de
arrastar o cartao; e marcar "aconteceu" leva para "apresentacao realizada".

**Lead novo ganha dono pela regra configurada.** Sempre a mesma pessoa,
rodizio, por cidade, por estado, por campanha, ou ninguem. No modo
"ninguem", o lead fica na fila geral: nao some. Regra que aponta para
conta desligada e ignorada.

**Documento e privado de verdade.** Lista fechada de tipos aceitos, limite
de 20 MB, nome de arquivo escolhido pelo sistema (nunca o que veio de
fora), permissao 0600 em disco, nada servido como arquivo estatico, e cada
abertura registrada na auditoria.

**Praca vendida some da lista que a IA oferece.**

**Auditoria nao se edita.** Existe rota de leitura e mais nenhuma.

## 5. Numeros

| | Fase 1 | Fase 2 |
|---|---|---|
| Modulos na API | 11 | 23 |
| Rotas | 29 | 65 |
| Telas do CRM | 4 | 22 |
| Arquivos TypeScript | 241 | 347 |
| Linhas de codigo | 11.120 | 18.924 |
| Testes de unidade | 48 | 60 |
| Testes de ponta a ponta | 51 | 75 |

Tabelas no banco: 42 (uma alteracao — a praca ganhou responsavel e lead).

## 6. Testes

Todos verdes, executados em 07/09/2026.

### Unidade (60, `pnpm test`)

Os 48 da Fase 1 mais 12 novos: horario de atendimento com fuso correto
(inclusive a virada de dia entre Brasilia e UTC) e as seis regras de
roteamento de leads.

### Ponta a ponta (75, `pnpm test:e2e`, Chromium de verdade)

Os 51 da Fase 1 mais 24 novos:

| Arquivo | O que prova | Casos |
|---|---|---|
| `cof.spec.ts` | prazo legal barra a liberacao; ordem envio→recebimento; um processo por lead | 3 |
| `documentos.spec.ts` | guarda e devolve so com permissao; recusa tipo e categoria invalidos; nome com caminho nao escapa da pasta | 5 |
| `crm-fase2.spec.ts` | tarefas, agenda, pracas, configuracoes, relatorios, auditoria e integracao | 12 |
| `telas-crm.spec.ts` | as 19 telas abrem sem erro de console e sem vazar para o lado, no computador e no celular | 4 |

## 7. Defeitos encontrados e corrigidos durante os testes

| Defeito | Consequencia se tivesse passado | Correcao |
|---|---|---|
| O canal de tempo real escrevia direto na resposta e pulava o CORS do framework | as telas de conversa e funil nunca atualizariam sozinhas no navegador | a permissao de origem passou a ser conferida a mao, contra a mesma lista de origens autorizadas |
| Acoes respondiam 201 ("recurso criado") em vez de 200 | integracao futura que espera 200 quebraria | registro de envio, recebimento, liberacao de contrato, mudanca de etapa e assumir conversa respondem 200 |
| O `.env.example` nao trazia as variaveis que o docker compose exige | quem seguisse a instalacao nao conseguiria subir o banco | variaveis do Postgres e do Redis incluidas |
| O script que sobe o ambiente nao derrubava o processo antigo | duas versoes do sistema rodando ao mesmo tempo, com a antiga segurando a porta | passou a identificar cada processo pela pasta de onde subiu |

## 8. O que continua dependendo do operador

O mesmo da Fase 1, sem nada novo:

| O que | Para que serve |
|---|---|
| Conta Meta Business + App + credenciais | falar pelo WhatsApp oficial |
| Numero oficial do WhatsApp | o botao da landing |
| Projeto Supabase + chaves | login em producao |
| Chave do provedor de IA | primeiro atendimento automatico |
| Aprovacao dos modelos de mensagem na Meta | falar fora da janela de 24h |
| Dominio e certificado HTTPS | publicar |

Sem nada disso o sistema roda inteiro, com dados reais, so nao fala com o
WhatsApp de verdade. A tela **Integracao WhatsApp** mostra exatamente o
que falta, e `docs/WHATSAPP_SETUP.md` diz onde achar cada valor.

## 9. O que NAO foi feito

- Envio ativo em massa (disparo de campanha por WhatsApp).
- Assinatura eletronica de contrato dentro do sistema.
- Aplicativo de celular.
- Integracao com ERP ou financeiro.
- Custo por lead: depende de ligar a conta de anuncios da Meta, que e
  credencial do operador.

Nada disso foi comecado pela metade.

## 10. Como conferir

```bash
./scripts/dev-up.sh     # sobe banco, fila, API, workers e as telas
pnpm test               # 60 testes de unidade
pnpm test:e2e           # 75 testes de ponta a ponta
```

---

**Fim da Fase 2.**

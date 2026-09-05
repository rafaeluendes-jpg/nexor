# JOIA — Protocolo Permanente de Engenharia, Regressão e Proteção

**Ordem do Rafael, 02/09/2026. Permanente.**

Este arquivo **não é instrução de uma conversa**. Ele vale para toda
sessão, aqui e no Claude Code do computador do Rafael, e **deve ser lido
e obedecido ANTES de qualquer alteração no Joia**. Nenhum pedido futuro
apaga estas regras — só o próprio Rafael, dizendo expressamente que quer
mudar este protocolo.

Leia junto com:
- `CLAUDE.md` — o que o sistema é (contexto permanente).
- `JOIA_REGRAS_DE_ENGENHARIA.md` — como se altera (as 14 regras já vigentes).
- `BASELINE.md` — o que está aprovado e não pode quebrar.
- `SEGURANCA.md` — a revisão de segurança.
- `JOIA_TESTES_E_REGRESSAO.md` — como rodar e o que cada suíte cobre.

Este protocolo **não substitui** os de cima — ele os amarra numa regra só
e diz onde cada exigência já está atendida no repositório.

---

## A regra que manda em todas

**Corrigir uma coisa não autoriza alterar outra.** Funcionalidade
aprovada é protegida por teste. Uma tarefa só está concluída quando o que
foi pedido funciona **E** o que já funcionava continua funcionando, provado
pela bateria verde.

```
ENTENDER → REPRODUZIR → PROTEGER → ALTERAR O MÍNIMO → TESTAR
→ COMPARAR → VALIDAR → COMPROVAR
```

Nunca `ALTERAR → PUBLICAR → DESCOBRIR NA LOJA O QUE QUEBROU`.

---

## Como cada exigência do protocolo já vive no repositório

O Joia não é um projeto novo: a infraestrutura de proteção **já existe**.
Esta tabela liga cada ponto do protocolo do Rafael ao mecanismo real. Onde
o mecanismo existe, use-o — **não crie um paralelo** (isso é a regra 17,
alteração mínima, e o próprio protocolo proíbe reescrever o que funciona).

| Exigência (nº do protocolo) | Onde já está atendida |
|---|---|
| Git e controle de versão (3) | Repositório Git ativo; `.gitignore` protege segredos; `.env` nunca versionado (ver `SEGURANCA.md`) |
| Baseline funcional (4, 5, 34) | `BASELINE.md` — tabela de aprovados, com a prova de cada item |
| Playwright / E2E (6, 11, 28) | `ferramentas/provar.js`, `auditar.js`, `persistir.js`, `varrer.js`, `varrer-modais.js` — abrem o Chromium de verdade (1440 e 390) e exercem os fluxos reais |
| Regressão (7, 30) | 56 suítes em `testes/`, rodadas por `npm test` e pelo portão |
| Persistência (8) | `ferramentas/persistir.js` — taxa de cartão como sentinela, no Chromium: salva → F5 → sai/entra → troca de tela → versão nova → semente |
| Unitários (9) | `testes/*.js` extraem as funções reais do `index.html` e as rodam (cálculo, troco, fechamento, sangria, totais, estoque, permissão) |
| Integração (10) | `ferramentas/provar.js` cobre PDV→estoque, PDV→financeiro, PDV→caixa; `conferir-nuvem.js` cobre configuração→nuvem |
| Produção não destrutiva (12) | Regra 2 do `CLAUDE.md`: nada de `DROP/DELETE/TRUNCATE`/migration em produção sem ordem explícita |
| Multi-tenant (19) | `testes/tenant*`, isolamento por `minha_loja()`/`minha_rede()` — auditado em `SEGURANCA.md` |
| Baseline de segurança (20) | `SEGURANCA.md` — RLS nas 87 tabelas, segredo fora do navegador, XSS, permissões |
| Banco (18) | `ferramentas/conferir-nuvem.js` + `esquema-nuvem.json` — campo a campo contra o banco de produção |
| Bug vira teste (32) | Toda suíte em `testes/` nasceu de um estrago; regra 6 do `JOIA_REGRAS_DE_ENGENHARIA.md` |
| Portão / CI local (11, 24, 39) | `ferramentas/portao.js` — 9 etapas, para na 1ª reprovação, só diz "pode publicar" com tudo verde |

**Por que não foi criada uma árvore `tests/e2e/` nova com `@playwright/test`:**
seria duplicar o que `ferramentas/provar.js`, `auditar.js` e `persistir.js`
já fazem (eles JÁ usam o Chromium/Playwright, organizados por domínio),
criando dois sistemas de teste que envelhecem em ritmos diferentes. O
protocolo pede "conforme for compatível com a tecnologia real do
repositório" e proíbe reescrever o que funciona (regra 17). A camada E2E
do Joia são essas ferramentas; este documento as reconhece como tal.

---

## O fluxo obrigatório de toda tarefa futura

Antes de tocar em qualquer arquivo:

1. **Ler este protocolo** e o `JOIA_REGRAS_DE_ENGENHARIA.md`.
2. **Entender o pedido** — e só ele. `O que esta solicitação realmente
   autoriza alterar?`
3. **Analisar impacto** — módulo, arquivos, tabelas, dependências, efeito
   colateral, quais testes já cobrem a área.
4. **Conferir o Git** — `git status`, `git diff`; não sobrescrever
   alteração de terceiros; criar ponto seguro se preciso.
5. **Rodar os testes da área ANTES** — provar que está funcionando (o
   "before state").
6. **Reproduzir o problema** — se for bug, um teste que falha por causa dele.

Depois:

7. **Alterar só o necessário** — as linhas exatas, nunca reescrever bloco
   de memória (regra do `CLAUDE.md`).
8. **Rodar o teste específico** — o de reprodução passa.
9. **Rodar as integrações relacionadas**.
10. **Rodar a regressão** — `node ferramentas/portao.js` antes de entrega
    relevante.
11. **Revisar o `git diff`** — nenhum arquivo fora do escopo mexido sem
    necessidade; o `index.html` só muda como consequência do `src/`.
12. **Verificar logs** — console do navegador, erros de rede, 4xx/5xx,
    queries com falha (o `auditar.js` reprova em erro de console).
13. **Validar persistência** — `ferramentas/persistir.js` quando a
    alteração toca configuração.
14. **Entregar o relatório** — no formato abaixo.

---

## O portão é a prova

```
node ferramentas/portao.js
```

Nove etapas, na ordem, parando na primeira reprovação:

1. **Montagem** — o `index.html` é o espelho do `src/`.
2. **Estrutura e versão** — `VERSAO` (em `src/js/06-interface.js`) e
   `VERSAO_SW` (em `sw.js`) sobem juntas.
3. **Bateria de testes** — as 56 suítes.
4. **Configurações** — nenhuma rotina apaga o que a loja configurou
   (`auditar-configuracoes.js`).
5. **Nuvem** — o que o código manda é o que o banco aceita
   (`conferir-nuvem.js`).
6. **Varredura** — as 94 telas montam, todo botão tem função.
7. **Auditoria visual** — computador (1440) e celular (390), no Chromium.
8. **Provas** — os fluxos da loja no Chromium (abre caixa, vende,
   recarrega, fecha, exporta, permissão por perfil).
9. **Persistência** — a configuração sobrevive a tudo.

**Sai com 0 só quando tudo passou. Qualquer outro resultado: não publique.**

Publicar continua sendo decisão do Rafael (regra 1 do `CLAUDE.md`). A
exceção que ele autorizou: correção de defeito do que já está publicado,
com o portão verde, sobe direto; regra de negócio nova ou recurso novo
espera ordem.

---

## Regras de bloqueio (não entregar "pronto" se…)

Nunca declarar a tarefa concluída havendo:

- teste antes aprovado agora falhando;
- portão vermelho;
- erro crítico de console/rede;
- regressão;
- perda de dado;
- inconsistência financeira;
- quebra de isolamento entre empresas;
- risco de segurança crítico.

Corrija o que a **sua** alteração causou antes de entregar. Se for defeito
pré-existente e fora do escopo, registre com todas as letras:
`DEFEITO PRÉ-EXISTENTE — NÃO CAUSADO POR ESTA ALTERAÇÃO`, e **não saia
corrigindo sem autorização** — salvo quando a correção for indispensável
para viabilizar o próprio teste e não mexer em regra de negócio.

---

## Teste não se maquia

- Proibido baixar `assert`, dar `skip`, remover cobertura ou trocar o
  resultado esperado só para ficar verde.
- Teste vermelho: primeiro decidir **quem está errado** — o código
  (corrige o código) ou o teste (só corrige o teste depois de provar que a
  especificação não é o comportamento aprovado).
- Regra de negócio só muda quando o Rafael pede; aí os testes passam a
  representar a regra nova.
- Todo bug real corrigido vira teste permanente — o mesmo defeito não
  volta calado.

---

## Configuração da loja é dado, não é código

Publicar JS/CSS/HTML/Service Worker **não** pode apagar, resetar ou repor
valor de fábrica no banco. Semente só entra com o registro **inexistente**;
existindo, preserva-se exatamente o que está lá. Isto é a regra 1 do
`JOIA_REGRAS_DE_ENGENHARIA.md` e é conferido a cada publicação pelo
`auditar-configuracoes.js`.

---

## O formato de toda entrega futura

No chat, valem as **três linhas** do `CLAUDE.md` (o Rafael lê o resultado,
não o relatório). O relatório completo vai em arquivo ou no commit:

```
ALTERADO:            o que foi modificado
PRESERVADO:          o que foi mantido intacto
TESTES EXECUTADOS:   específicos + regressão (portão)
RESULTADO:           ex. "56 suítes, todas verdes, 0 falhas"
GIT:                 arquivos alterados; diff revisado
PERSISTÊNCIA:        validada / não se aplica
REGRESSÃO:           nenhuma detectada / descrição precisa do que restou
```

---

## Não prometer o impossível

Nenhuma ferramenta garante zero bug. Não se diz "100% sem erro". O que
este protocolo faz é reduzir drasticamente regressão e tornar a
confiabilidade **verificável** — provada, não afirmada.

---

## A vistoria: uma ferramenta contra "conserta A, quebra B" (05/09/2026)

Ordem do Rafael: parar de vez com a correção de uma coisa quebrar outra que
não tinha nada a ver, no sistema INTEIRO — não numa pasta só.

Boa parte desses defeitos é de um tipo só, e é o tipo que uma ferramenta
pega ANTES de rodar: o código chama um nome que não existe (função
renomeada, removida, digitada errada) ou repete uma chave de objeto
(perdendo um campo). Foram assim o `ci is not defined` (V186), o
`fundoSugerido` apagado (V179), o `_respConfirma is not a function`
(04/09) e outros.

`ferramentas/vistoriar.js` usa o **ESLint** — a ferramenta que os
programadores usam — e lê os 39 arquivos como um só (que é como rodam na
loja). Ela reprova a publicação quando um nome chamado não existe em
arquivo NENHUM, ou quando uma chave de objeto se repete, entre outros
erros que estouram em execução. Vale para qualquer pasta — PDV,
financeiro, relatórios, estoque — e o mesmo comando serve para os outros
repositórios (app, robô).

**Trava de catraca.** Num sistema grande e antigo, exigir zero problema no
primeiro dia travaria tudo e obrigaria a mexer, de uma vez, em dezenas de
pontos que ninguém pediu — errado e arriscado. Então os problemas que já
existiam ficam congelados em `ferramentas/vistoria-baseline.json`, e a
vistoria só reprova quando aparece um problema NOVO — exatamente o que a
correção de hoje pode ter introduzido. A lista antiga vai sendo zerada
quando se encosta naquele arquivo. Regravar a lista (depois de corrigir,
ou ao aceitar o estado atual de propósito):
`node ferramentas/vistoriar.js --gravar`.

A vistoria é a **primeira etapa do `portao.js`**, antes de qualquer teste:
ela é a mais rápida e pega a pior classe de defeito sem sequer abrir a
tela.

## Toda correção nasce com um teste que a tranca

O que impede um defeito de VOLTAR não é ter consertado uma vez — é o teste
que falha se alguém quebrar de novo. Toda correção passa a entrar com um
teste que reproduz o defeito (falha antes, passa depois) e fica para
sempre na bateria. Exemplos recentes: o troco com o cadastro vazio, a
forma de pagamento no comprovante, os dois avisos sobrepostos do
cancelamento. O `testes/frente-de-caixa-guardiao.js` roda o fluxo do caixa
no ESTADO RUIM (listas ainda não sincronizadas), que é onde os defeitos
nascem — os testes antigos rodavam só no estado limpo.

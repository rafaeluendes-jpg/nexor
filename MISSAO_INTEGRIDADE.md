# Missão integridade — o sistema para de desfazer dado sozinho

Ordem do Rafael, 06/10/2026. Este arquivo é o diário da missão: onde ela
está, o que foi provado e como se prova. Se ele pedir uma correção no
meio, faça a correção, publique, e volte daqui.

**A regra da missão:** regra nova só vale se virar trava que roda — no
banco, num teste ou no portão. Nada de parágrafo novo no protocolo. Toda
lista de tabelas sai do MAPA e do banco, nunca escrita à mão.

---

## Onde está

| Fase | Situação |
|---|---|
| 0 — publicação só com bateria verde; regras do pedido automáticas | feita no código, portão verde; **publicação pendente** (ver "Bloqueio") |
| 1 — inventário e régua | em andamento |
| 2 — banco vira juiz em todas as tabelas | não começou |
| 3 — o que anda para frente não volta | não começou |
| 4 — vigia confere os dados | não começou |
| 5 — cerca do pedido | não começou |

### Bloqueio (06/10/2026)

A sessão de 06/10 trabalhou num clone de leitura do `nexor`: o pedido de
acesso de escrita ao repositório foi negado pelo controle de permissões da
sessão. O trabalho está pronto e commitado na branch local
`missao-integridade`; falta só empurrar para a `main`.

---

## Fase 0 — feita (06/10/2026)

**Teste vermelho não publica.** O `pages.yml` ganhou o trabalho `bateria`
(npm ci, vistoria, trava dos guardiões, conferir-nuvem, `npm test`) e o
`publicar` só começa depois dele (`needs: bateria`).

Achado na hora de ligar a trava: **a bateria já estava vermelha na
`main`**. O guardião `testes/faturamento-inteiro.js` usava vendas com data
fixa em setembro; com a passagem do tempo o dia coberto caiu para fora da
janela de 30 dias e o caso 6 passou a falhar sem mudança nenhuma no
código. Como o `npm test` para no primeiro erro, as suítes seguintes nem
rodavam — e a loja recebia versão nova do mesmo jeito. O teste passou a
gerar as datas a partir de hoje (o código estava certo).

**Regras do pedido automáticas.** Moram numa seção só do `CLAUDE.md`
("## Regras do pedido"). O gancho `UserPromptSubmit` do Claude Code
(`.claude/settings.json` → `.claude/regras-do-pedido.js`) lê essa seção e
a junta a toda mensagem do Rafael. Regras 1 e 2 do `CLAUDE.md` trocadas:
publicar e aplicar migration não pedem ordem, pedem portão verde + backup
antes + prova num banco de cópia.

**Como se prova:**
- `node testes/publicacao-espera-a-bateria.js` — 12 pontos; tirando o
  `needs: bateria` do pages.yml ele reprova (provado).
- `node testes/regras-do-pedido.js` — 10 pontos; tirando a seção do
  CLAUDE.md ele reprova (provado). Os dois estão na bateria e trancados no
  `travas.json` (169 guardiões).
- Gancho provado no Claude Code de verdade: `claude -p` na pasta do Joia
  mostrou o evento `UserPromptSubmit` com o texto das regras, e o modelo
  respondeu "SIM. Regra 4: Portão verde, e publique sozinho…".
- Portão: 11 etapas verdes (V426.0.0, 425 s).

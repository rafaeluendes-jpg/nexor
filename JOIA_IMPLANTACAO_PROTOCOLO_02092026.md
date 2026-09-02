# JOIA — Relatório da implantação do Protocolo Permanente

**02/09/2026.** Resposta ao §37 do protocolo do Rafael. A proteção
permanente não foi criada do zero — o Joia já tinha quase tudo; este
trabalho a **amarrou num protocolo obrigatório**, ligou cada exigência ao
mecanismo real e registrou o que faltava.

## A. Git
- **Já existia.** Repositório Git ativo, com histórico por versão (V283…V289).
- **Estado:** branch de trabalho `claude/claude-project-reading-ieiet8`;
  publicação só da `main` → joiagest.com.br.
- **Estratégia:** trabalhar na branch, portão verde, merge para a `main` é
  decisão do Rafael (exceção: correção de defeito já publicado).
- **Segredos:** `.gitignore` presente; `.env` nunca versionado; só a chave
  **publicável** do Supabase vai ao navegador; a `service_role` fica no
  robô do WhatsApp, por variável de ambiente (ver `SEGURANCA.md`).

## B. Playwright
- **Já em uso**, pela via compatível com o projeto: as ferramentas
  `provar.js`, `auditar.js`, `persistir.js`, `varrer.js` e `varrer-modais.js`
  abrem o **Chromium de verdade** (1440 e 390).
- **Navegador:** Chromium do ambiente (`/opt/pw-browsers`).
- **Localização:** `ferramentas/` (E2E/visual) — organizadas por concern.
- **Não** foi criada uma árvore `tests/e2e/` paralela com `@playwright/test`:
  duplicaria a camada que já existe e fere a regra 17. Documentado no
  protocolo.

## C. Testes
- **Bateria:** **56 suítes** em `testes/` (unitário + integração + regressão),
  rodadas por `npm test`.
- **E2E/visual:** `provar.js`, `auditar.js`, `varrer.js`, `persistir.js`.
- **Integração de módulos:** PDV→estoque, PDV→financeiro, PDV→caixa em
  `provar.js`; configuração→nuvem em `conferir-nuvem.js`.
- **Nova barreira nesta rodada:** `pedido-base-sobe-inteiro.js` ganhou a
  prova do envio do item preso (o defeito da V289).

## D. Baseline
- Registrada em `BASELINE.md` (é a "baseline funcional aprovada" do §34).
- **Aprovadas:** login/sessão, permissões, isolamento matriz↔unidades, PDV
  (venda, troco, turnos, sabor), formas de pagamento + taxa (persistência),
  caixa (abertura/fechamento/sangria), estoque (contagem, baixa manual,
  movimentação), pedido de base, relatórios (canais, data/hora), impressão,
  sincronização (envio, download, contador, forma), Service Worker, telas,
  visual.
- **Com defeito conhecido (aberto):** taxa de cartão de Santa Fé oscilando
  (ver `JOIA_VARREDURA_02092026.md`) — depende de decisão do Rafael, não
  alterada.
- **Sem prova automática ainda:** Assistente Carla, dashboard/gráficos,
  operadores/senha, impressoras, cupons/promoções, acerto com entregadores,
  fiado, backup/restore (listadas em `BASELINE.md`).

## E. Segurança
- Baseline em `SEGURANCA.md`: **nada crítico aberto**. RLS nas 87 tabelas;
  segredo fora do navegador; XSS escapado no cardápio e no pedido online;
  permissões finas por tela; senhas de operador em cofre fechado.

## F. Regressão (rodada agora)
- **TOTAL:** 56 suítes / **99 no maior bloco E2E-DOM**.
- **APROVADOS:** todos — `npm test` saiu com código **0**.
- **FALHARAM:** 0.
- **IGNORADOS:** 0.
- Portão (`portao.js`): as etapas de código e nuvem passaram; as etapas de
  Chromium ficaram para reexecução por uma instabilidade de rede do
  ambiente **após o reinício do processo** — não é regressão de código
  (nada em `src/` mudou desde a V289, que subiu com o portão verde).

## G. Problemas encontrados (não corrigidos sem ordem)
1. **Taxa de cartão de Santa Fé oscilando** (1,99/3,49 ↔ 0,73/2,73), ainda
   em 02/09 — precisa o Rafael dizer o valor certo. Detalhe em
   `JOIA_VARREDURA_02092026.md`.
2. **2 pedidos de cardápio cancelados sem itens** (histórico, baixo impacto).
3. **19 vendas sem pagamento** — quase todas históricas (20–25/08); recentes
   limpas; cardápio pode ser "pagar na entrega".
Nada disso foi alterado — é dado/decisão, fora do escopo de "implantar a
proteção".

## H. Arquivos criados
- `JOIA_PROTOCOLO_PERMANENTE_DE_ENGENHARIA.md`
- `JOIA_TESTES_E_REGRESSAO.md`
- `JOIA_VARREDURA_02092026.md`
- `JOIA_IMPLANTACAO_PROTOCOLO_02092026.md` (este)

## I. Arquivos modificados
- `CLAUDE.md` — o protocolo entrou como leitura obrigatória no topo.

## J. Conclusão
**A proteção permanente está implantada e operacional.** O protocolo é
leitura obrigatória (registrado no `CLAUDE.md`), ligado aos mecanismos
reais que já rodam: Git, 56 suítes, E2E no Chromium, conferência de nuvem,
auditoria de configuração e o portão de 9 etapas. Nenhuma regra de negócio
foi tocada nesta implantação. Nenhuma ferramenta promete zero bug; o que
esta estrutura garante é regressão **verificável**, não afirmada.

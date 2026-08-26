# Testes de regressão do Joia

## Como rodar

```
npm run test                  # sintaxe + reconciliação
npm run test:reconciliacao    # só a reconciliação
npm run test:sintaxe          # só a sintaxe do index.html
```

Sem npm, direto:

```
node testes/reconciliacao.js
node testes/sintaxe.js
```

Sai com código 1 quando falha — serve para travar publicação.

## Quando rodar

Sempre antes de publicar, e depois de mexer em: PDV, pagamentos, caixa,
estoque, dashboards, relatórios, filtros de data, timezone ou sincronização.

No GitHub roda sozinho a cada envio (`.github/workflows/testes.yml`).

## O que ele protege

| Grupo | O que garante |
|---|---|
| Teste base | 100 + 250 + 50 = 400 em PDV, faturamento, pagamentos, itens e estoque |
| Pagamento misto | venda de 100 paga 40 + 60 continua sendo 100 de faturamento |
| Cancelamento | sai de todos os indicadores; estorno de estoque uma vez só |
| Timezone | venda das 21:43 fica no dia local, não no dia UTC |
| Unidades | A vê 500, B vê 300, matriz 800, sem mistura |
| Duplicidade | reenvio não dobra venda nem pagamento |
| Estoque | nenhum item vendido sem baixa, nenhuma baixa repetida |
| Filtros de data | Hoje, Ontem e período combinado |
| Dashboards | todos os indicadores da mesma fonte |

## Por que ele funciona

Os testes **não reimplementam a regra**. `extrair.js` lê as funções de
dentro do `index.html` e roda **elas**. Se alguém mudar `diaLocal`
amanhã, o teste roda a versão nova e quebra.

Um teste com cópia da regra continuaria passando com o sistema errado —
é o tipo de teste que dá falsa segurança.

## Prova de que detecta

Três defeitos reais foram reintroduzidos de propósito para conferir:

| Sabotagem | Detectada? |
|---|---|
| Voltar o filtro de data para UTC cru | sim — 9 falhas |
| Voltar a referência de pagamento `_pg0` | sim — 2 falhas |
| Deixar a venda cancelada contar | sim — 6 falhas |

## Limite honesto

Esta suíte testa **a regra**, com cenários montados. Ela não substitui a
conferência dos dados reais no banco — para isso existe a view
`vw_vendas_sem_pagamento` e as consultas do relatório de reconciliação.

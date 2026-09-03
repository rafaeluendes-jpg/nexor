# JOIA — Auditoria de sincronização e banco de dados

**03/09/2026.** Leitura, sem escrita de produção (a única escrita foi a
correção da taxa de Santa Fé, já autorizada antes). Pedido do Rafael:
por que às vezes demora a subir e fica pendente; capacidade do banco;
tudo sendo salvo; e o fluxo PDV → Financeiro → Relatórios → Estoque e
Baixa Manual → Estoque → Relatórios, sem perda, duplicidade ou
divergência.

## Veredito

O fluxo está **íntegro e persistindo**. As vendas de **02/09 (34) e 03/09
estão 100% completas** na nuvem — todas com itens, pagamento e caixa.
Não há perda nem duplicidade. A "demora/pendência" é, na maior parte,
o comportamento normal do modo offline-first (abaixo). Um ponto de
fragilidade de projeto fica **registrado**, sem correção agora — mexer no
motor de sincronização que está funcionando, sem um defeito reproduzido,
é o risco que o próprio protocolo manda evitar.

## 1. Capacidade do banco — folgado

- Banco: **147 MB**. Sem risco de espaço.
- Maior tabela: `audit_log` (15 MB, 12 mil linhas) — o histórico de quem
  mexeu em quê; cresce devagar, sob controle.

## 2. Tudo sendo salvo — sim

- **02/09: 34 vendas, todas com itens + pagamento + caixa. 03/09: idem.**
- Zero registro **órfão** (item/pagamento/movimento apontando para pai
  inexistente).
- Zero **duplicidade** de identificador em pedidos, itens, pagamentos,
  estoque e financeiro.
- Forma dos dados conferida campo a campo (`conferir-nuvem`): 923 campos ×
  88 tabelas, nada fora do lugar.

## 3. Fluxo PDV → Financeiro → Relatórios → Estoque — íntegro

- **Total da venda × pagamento:** 0 divergências onde há pagamento.
- **Venda → caixa:** as vendas recentes carregam `caixa_id` — caem no
  caixa, e o caixa alimenta o financeiro/relatórios.
- **Venda → estoque:** a baixa por venda acontece (origem "venda"), com os
  5 tipos de movimento ativos (contagem, importação, manual, produção,
  venda), 443 movimentos recentes.
- **Relatórios:** leem o `total` do pedido, que está correto em toda a
  série — o financeiro nunca foi afetado pelos itens.

## 4. Baixa Manual → Estoque → Relatórios — mecanismo íntegro, pouco uso

- Só **1 baixa manual** no histórico (15/08), ainda "pendente" (iniciada e
  não finalizada). Nenhuma baixa "lançada" sem o movimento correspondente.
  O caminho funciona; o recurso é pouco usado.

## 5. Achados (nenhum é defeito de código vivo)

### a) Divergência item × total — histórica, já cessada
14 vendas de PDV (a maioria em **30/08**, um dia de 133 vendas) com a soma
dos itens diferente do total. Causa: item **digitado em duplicidade ou
faltando no balcão** — não é duplicação de sincronização (todos os
`ref_local` são distintos). **O total da venda sempre esteve certo**, então
caixa e financeiro nunca erraram. **02–03/09: zero divergência.**

### b) `unitario` = 0 em itens antigos — já corrigido
Itens até ~28/08 subiam com o preço unitário zerado (só o total ia). O
mapa está certo (`unitario:n(o.unit)`); o PDV é que não preenchia o campo.
A partir de 01–02/09 o unitário passou a ser gravado. Dado antigo fica
como está; relatório de receita (que usa o total) nunca foi afetado.

### c) 9 insumos com saldo negativo — operacional, não é bug
Insumos consumidos além do que foi contado (o sistema deduz certo pela
ficha; falta lançar a contagem física). Realidade de food service, não
perda de dado.

## 6. Por que às vezes "demora a subir / fica pendente"

O sistema é offline-first: cada aparelho manda quando pode. Os tempos reais:

| O quê | Quando |
|---|---|
| Depois de salvar, sobe | ~2,5 s após parar de digitar |
| Aparelho vizinho vê a mudança | ~6 s (checagem leve) a 45 s (reconciliação) |
| Recarga completa da base | no máximo 1× a cada 20 s |
| Histórico baixado | últimos **90 dias** (o resto vem sob demanda no relatório) |
| Retentativa de rede | 3× (0,6 / 1,8 / 4 s), depois no próximo ciclo |

O que **legitimamente** deixa algo pendente por mais tempo:

1. **Nada sobe antes de baixar:** enquanto o aparelho não completa um
   download na sessão, ele segura os envios (evita gravar cópia velha por
   cima — regra que já salvou taxa e fechamento). Aparelho recém-aberto,
   com rede ruim, mostra pendência até completar o primeiro download.
2. **Enquanto há coisa para subir, o aparelho pausa os downloads** até o
   próprio envio terminar. Por isso "mesmo login, telas diferentes" às
   vezes mostra número diferente por alguns segundos.
3. **Sessão caída** (token expirado) não sobe sozinha — só reentrando.

### Fragilidade registrada (sem correção agora)

Se um aparelho ficar com **uma linha que nunca consegue subir** (ex.: um
registro de outra empresa retido, ou um filho cujo pai é recusado), ele
fica "sujo" e, enquanto sujo, **para de baixar** — deixa de ver o que as
outras lojas mandaram, e o contador de pendências não zera. **Não achei
nenhum aparelho nesse estado hoje** (os dados recentes estão 100%
completos, prova de que todos estão sincronizando). Corrigir isso é mexer
no coração do motor de sincronização que está funcionando; o protocolo
manda **reproduzir o defeito antes de alterar** e **não quebrar o que
funciona**. Fica registrado como melhoria a autorizar, com teste próprio,
não como remendo às cegas.

## Conclusão

Banco folgado, nada perdido, nada duplicado, fluxo íntegro e persistindo.
A demora é o ritmo normal do offline-first; a única fragilidade real está
registrada acima e não está ocorrendo agora. Nenhuma alteração de código
foi feita nesta auditoria — não havia defeito vivo que a exigisse, e
inventar um seria contra o protocolo.

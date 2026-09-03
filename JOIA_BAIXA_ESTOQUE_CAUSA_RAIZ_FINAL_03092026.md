# JOIA — Por que a venda não baixava o estoque (causa raiz definitiva) e o recálculo geral

**03/09/2026.** "Vendeu R$ 800+ e só baixou Borda Nutella; os cascões,
copos, GELATO VENDA e embalagens não baixaram." E "o estoque está negativo
em vários itens".

## A causa raiz das baixas faltando

`baixarEstoqueVenda` baixa o estoque a partir da **ficha do produto**
(`produto.fichaId`) — e das **opções** (que carregam a própria `fichaId`,
ex.: Borda Nutella).

No banco, **`produtos.ficha_id` estava NULO para todos os produtos**. Sem o
vínculo, o caminho do PRODUTO não baixava nada; só as OPÇÕES baixavam
(porque a Borda Nutella traz o próprio `fichaId`). Por isso a venda de um
"Cascão 2 Bolas com Borda Nutella" baixava só a Nutella, e não o GELATO
VENDA, o cascão, o guardanapo, a pazinha, a embalagem.

A correção de código anterior (V296) preserva o vínculo LOCAL num download,
mas não adianta se **nenhum** aparelho tem o vínculo — e a nuvem estava
zerada. Então a correção de verdade é **repor o vínculo na nuvem**.

## O que foi feito

1. **Vínculo produto→ficha restaurado na nuvem** (39 produtos), a partir do
   que o próprio sistema já usava nas baixas que subiram + casamento por
   nome. Backup em `bkp_produtos_ficha_20260903`. Agora todo aparelho baixa
   a ficha inteira de cada produto vendido.
2. **Recálculo geral do estoque** (não só 3 itens): para cada item da
   contagem de 31/08, `saldo = contagem + entradas − vendido`, com o
   "vendido" reconstruído dos PEDIDOS (completos) pela ficha de cada
   produto, convertido para a unidade-base. Validado contra as baixas que
   subiram nos dias de cobertura completa (bateu). **33 itens corrigidos**
   (GELATO VENDA 51,5 kg; Guardanapo 10.870; Pazinha 873; cascões, copos,
   embalagens — todos positivos e coerentes). Backup em
   `bkp_estoque_recompute_20260903`.
3. **Dois itens não foram tocados**: "Copinho M" e "Copinho P". A própria
   **contagem de 31/08 os registrou errado** (2,740 e 2,097 — não se conta
   copo pela metade; parece "2740/2097" digitado como decimal). Sem o valor
   verdadeiro, não escrevo um chute. **Precisam de recontagem física.**

## Importante (o que ainda depende do aparelho)

Tudo isto só "gruda" no tablet quando ele **baixa os dados novos e roda a
versão nova (V301)**. Enquanto um tablet ficar na versão antiga vendendo,
ele volta a gerar baixa incompleta e pode re-zerar o vínculo na nuvem ao
subir. Por isso: **fechar e abrir o sistema nos tablets** é o passo que
trava a correção. Depois disso, cada venda passa a baixar exatamente todos
os itens da ficha.

## Isolamento por unidade (o outro pedido) — pausado com segurança

Cheguei na Etapa 1 (funções-base, testadas por perfil) e corrigi 11 pedidos
sem unidade. **Nenhuma política de RLS foi aplicada ainda** — nada ficou
pela metade. Retomo as etapas seguintes (RLS por unidade nas tabelas de
pedido/estoque/caixa, depois Financeiro) após o estoque estabilizar, uma a
uma, testadas por perfil.

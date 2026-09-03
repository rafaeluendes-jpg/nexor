# JOIA — Causa raiz da fila de sincronização travada (estoque)

**03/09/2026.** Investigação do "aparelho atrasado / alterações não subiram
/ fila acumulada" no PDV. Leitura de produção, sem alteração.

## Resumo em uma linha

A fila que não esvazia é o **saldo de estoque** (`estoque_unidade`) sendo
**reescrito em guerra por dois aparelhos da mesma loja** — não é perda de
venda nem de dinheiro.

## A prova

No `audit_log`, os registros de `estoque_unidade` da loja
`suc_mt1unhbx2xrb` foram **regravados mais de 100 vezes em 48 h** (um item,
121 vezes; outros 106, 105, 105, 76…), sempre em **lote, no mesmo
milissegundo** — assinatura de reenvio automático, não de venda a venda.

E o valor **oscila**, não cai em linha reta como uma baixa de venda:

```
-278,35 → -498,35 → -278,35 → -718,35 → -458,35 → -278,35 → …
… → -999,27 → -779,49
```

Ir e voltar entre os mesmos números é o retrato de **dois aparelhos, cada
um com um saldo diferente, gravando por cima do outro**.

## Por que trava a sincronização

1. `estoque_unidade` guarda o **saldo absoluto** por (loja, item) e sobe
   como estado espelhado (`espelha:true`, `setSaldoUn` grava o número
   cheio).
2. Dois aparelhos na mesma loja têm saldos diferentes; cada um trata o seu
   como "ainda não enviado" e **reenvia por cima** a cada ciclo.
3. Enquanto há coisa para subir, o aparelho **fica "sujo" e pausa os
   downloads** — então ele para de receber o que as outras lojas mandaram:
   é isso que a tela chama de **"aparelho atrasado"**, e o contador de
   pendências nunca zera.

O saldo é um **cache derivado** (existe para mostrar o número na tela). O
que não pode faltar — venda, item, pagamento, movimento — é a **ledger**
(razão), que é append-only e à prova de conflito.

## Os dados estão salvos? Sim — sem perda, sem duplicidade

- **02–03/09: 100% das vendas com item + pagamento + caixa.**
- Zero registro duplicado em pedidos, itens, pagamentos, estoque,
  financeiro; zero órfão.
- O total de cada venda bate com o pagamento (0 divergências) e caiu no
  caixa. **O dinheiro nunca esteve errado.**

O único número não confiável é o **saldo de estoque** da loja afetada, que
derivou (chegou a −999) por causa da guerra — um cache, não a venda.

## A correção (é no coração do sync — exige cuidado, não remendo às cegas)

O certo é o saldo **parar de ser um número mutável que dois aparelhos
disputam** e voltar a ser **derivado da ledger** (contagem + movimentos),
que é igual em todos os aparelhos — assim não há o que conflitar, a fila
esvazia e o "atrasado" acaba. Em concreto:

1. `estoque_unidade` deixa de ser preservado como "alteração minha não
   enviada" no download: o aparelho **adota o valor reconciliado** em vez
   de reenviar o seu antigo — a guerra para.
2. O saldo é **recomputado da ledger** após o download, deterministicamente
   — todos os aparelhos convergem para o mesmo número.
3. **Uma recontagem** na loja afetada zera o desvio acumulado (a loja já
   faz contagem física; ela é o marco que corrige).

Isto **muda números de estoque na tela** (corrige-os) e mexe no motor de
sincronização que está rodando ao vivo em 6 lojas. Pelo protocolo
permanente (reproduzir → alteração mínima → testar → não quebrar o que
funciona), isso entra com **teste próprio que reproduz a oscilação e prova
que ela assenta**, e passa pelo portão antes de publicar — não como
remendo apressado. É a única parte que peço para confirmar antes, porque
altera o saldo exibido (configuração/dado da loja).

## O que NÃO foi feito nesta investigação

Nada foi alterado. Não gravei saldo novo, não mexi no sync. A guerra é
chata (fila e aviso), mas não está comendo venda nem dinheiro — e trocar o
motor de estoque às cegas, ao vivo, seria o risco que o protocolo manda
evitar.

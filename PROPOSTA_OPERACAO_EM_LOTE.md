# Operação em lote no financeiro (proposta, 05/10/2026)

Telas-modelo: montadas dentro do próprio sistema, com o visual de verdade.
Nada disto está no ar ainda: é o desenho para você aprovar.

## O que eu entendo por operação em lote

É juntar vários lançamentos e tratá-los como **uma operação só**.

Por exemplo, você seleciona os boletos da semana e paga todos de uma vez,
na mesma data, saindo da mesma conta e pela mesma forma de pagamento.

Essa operação ganha um **número de lote**. O número carrega a data em que
o lote foi feito, quem fez e o total.

## Para que serve

- **O banco mostra um valor só.** Quando o Itaú paga vários boletos juntos,
  o extrato pode trazer um débito único. O lote tem exatamente esse valor,
  então a conciliação é feita de uma vez.
- **Saber o que foi pago junto.** Daqui a três meses, "o que saiu naquele
  débito de R$ 4.411,87?" tem resposta: abre o lote e estão lá os cinco
  fornecedores.
- **Errou, desfaz tudo de uma vez.** Se o lote saiu da conta errada, um
  botão volta os cinco lançamentos para "em aberto". O lote fica registrado
  como desfeito, com quem desfez, quando e por quê.

## O número do lote

- O formato é **data + sequência do dia**: `20261005-01` é o primeiro lote
  de 05/10/2026, `20261005-02` é o segundo do mesmo dia.
- Nasce sozinho; ninguém digita.
- É de cada loja.
- Nunca é reaproveitado, nem quando o lote é desfeito.

## As telas

1. **Lançamentos Financeiros** (`1-selecionar`): marca os lançamentos, como
   hoje. Na barra verde do total aparece o botão novo **Operação em lote**,
   ao lado de "Marcar pago", que continua igual. No topo entra o botão
   **Lotes**.
2. **Nova operação em lote** (`2-janela-do-lote`). A janela mostra:
   - o número do lote já gerado, quando e por quem;
   - se é para **pagar** ou **receber** em lote;
   - a data, a conta de saída (com o saldo), a forma e uma observação;
   - os lançamentos do lote, com campo de juros/multa em cada um, e o
     total;
   - o aviso: "o saldo do Itaú passa de X para Y; no extrato, procure um
     pagamento de R$ 4.411,87".
3. **A lista depois do lote** (`3-lista-com-lote`): cada lançamento pago
   mostra a etiqueta **Lote 20261005-01**. Os filtros ganham **Lote**, que
   mostra só os lançamentos daquele lote.
4. **Operações em lote** (`4-tela-dos-lotes`): todos os lotes do mês, com
   número, data, conta, forma, quantidade, total, quem fez e a situação:
   **Pago — falta conciliar**, **Conciliado** ou **Desfeito** (riscado).
5. **O lote aberto** (`5-lote-aberto`): os lançamentos do lote e o total,
   com três botões:
   - **Imprimir comprovante do lote**;
   - **Conciliar o lote inteiro**;
   - **Desfazer o lote**.
6. **Conciliação bancária** (`6-conciliacao`): o lote aparece como **uma
   linha só**, com o valor que bate com o extrato, e os lançamentos dele
   embaixo. Marcar a linha do lote concilia todos.

## As regras

- Entra no lote só o que está **em aberto**, não conciliado e da mesma
  loja.
- Todos os lançamentos do lote são do mesmo tipo: ou todos a pagar, ou
  todos a receber.
- A trava que já existe continua valendo: lançamento sem categoria do plano
  de contas não é pago, nem em lote.
- Um lançamento só sai do lote **desfazendo o lote**. Não dá para excluir
  ou editar um só e deixar o lote com total diferente do que saiu do banco.
- **Lote conciliado não se desfaz.** Primeiro desconcilia, como já é hoje
  com um lançamento sozinho.
- Desfazer pede o motivo e fica registrado.

## O que não muda

"Marcar pago" com vários selecionados continua funcionando como hoje, sem
número de lote. O lote é um caminho a mais, não substitui nada.

## O que depende de você

1. O número do lote fica no formato `20261005-01` (data + sequência)?
2. Quem pode criar e desfazer lote: só gerente e admin, ou quem já tem
   acesso ao financeiro?
3. O **receber em lote** entra junto, ou começamos só pelo **pagar em
   lote**?

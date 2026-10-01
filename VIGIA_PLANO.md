# Vigia do Joia — como vai funcionar

Aprovado pelo Rafael em 01/10/2026 ("pode ligar o vigia"). Ligado na V407.

## 1. A caixinha de erros

Uma tela nova em **Administração › Central de Erros**, só para a matriz.

Todo aparelho de toda loja manda para ela, sozinho e na hora:

| O que acontece | Exemplo |
|---|---|
| Cupom fiscal recusado | "NCM inválido", "número repetido" |
| Cupom autorizado que **não imprimiu** | venda 2584 |
| Cupom parado em "enviando" há mais de 5 minutos | SEFAZ fora do ar |
| Falha ao salvar na nuvem | venda, caixa ou cadastro que não subiu |
| Erro de tela | botão que quebrou, tela que não abriu |
| Login do sistema fora do ar | o caso de 13:35 de hoje |

Cada linha mostra a loja, o aparelho, a hora, a venda e o que aconteceu,
com uma situação:

- **Aberto**: ainda não foi visto.
- **Corrigindo**: o vigia está mexendo.
- **Resolvido**: diz o que foi feito.
- **Precisa de você**: só o que depende do Rafael.

Mensagem técnica não aparece mais na tela do caixa. Ela vai para a
caixinha. O caixa só vê o que ele precisa fazer.

## 2. O vigia, de hora em hora

Um agente engenheiro roda sozinho a cada hora, das 9h às 23h:

1. Lê a caixinha e os registros do servidor da última hora.
2. Confere o sistema inteiro:
   - cupons autorizados sem impressão;
   - cupons pendentes;
   - vendas que não subiram;
   - caixas abertos esquecidos;
   - estoque negativo fora do normal;
   - a bateria completa de testes.
3. Para cada erro, acha a causa e corrige.
4. Escreve na caixinha o que fez, em uma frase.

## 3. O que ele corrige sozinho

Sem nova versão, na hora:

- reenvia cupom pendente ou recusado por falha de comunicação;
- reimprime cupom que não saiu, no próximo pedido da loja;
- reenvia para a nuvem a venda ou o caixa que não subiu;
- refaz lançamento financeiro que faltou.

Com versão nova, automática:

- defeito no código do sistema. Ele corrige, roda a bateria inteira e
  publica só se tudo passar.

A versão nova é obrigatória nesse caso. É ela que faz o navegador da loja
trocar o sistema velho pelo corrigido. Sem ela, a loja continuaria com o
erro guardado no cache, que foi o defeito da V195. Você não precisa
fazer nada: a loja recebe sozinha no próximo F5.

## 4. O que ele nunca faz sozinho

- mudar configuração da loja: taxas, contas, preços, liberação;
- apagar venda, caixa ou lançamento;
- mexer em regra de negócio ou criar recurso novo;
- publicar com qualquer teste vermelho.

Esses casos ficam na caixinha como **Precisa de você**, com o passo a passo.

## 5. O que você recebe

- Nada, quando está tudo certo.
- Uma mensagem curta quando ele corrigiu algo importante, por exemplo
  "3 cupons de Santa Fé reimpressos".
- Uma mensagem quando algo depende de você.

## 6. O que depende de você

1. **Aprovar este roteiro.** Responda "pode ligar o vigia".
2. **Custo.** Cada rodada do vigia usa o seu plano do Claude, como uma
   conversa comigo. São 15 rodadas por dia. Se preferir menos, dá para
   rodar de 2 em 2 horas.

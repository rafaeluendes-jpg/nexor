# Joia — relatório de 23/09/2026
## Etapa 2 da RDS, velocidade do banco e cadastros

## Em uma página

**O que ficou pronto hoje**

- **O banco ficou até 300 vezes mais rápido** para as lojas. Ler o estoque
  de Santa Fé caiu de 3 segundos para 0,009 segundo, e ninguém passou a
  ver nada diferente do que via antes — provado em 9 perfis e 82 tabelas.
- **A chave exclusiva "RDS Auditoria"** foi criada: só leitura, a rede
  inteira, desativável na hora. Ela vai para você **à parte**, nunca
  dentro de documento.
- **A Etapa 2 que a RDS autorizou está no ar:** o banco agora marca a data
  de cada alteração, tem os índices das consultas da auditoria, e a API
  ganhou quatro caminhos novos — extração dos cadastros, saúde da
  sincronização, lista de alterações e histórico de quem mudou o quê.
- **Ficha técnica, insumo e produto passaram a ter histórico**: antes,
  depois, quem e quando.
- **O desenho técnico da Etapa 3** (CPV congelado, cortesia, competência,
  classe dos motivos) foi entregue.
- **Segurança:** 12 cópias de segurança estavam expostas na área pública do
  banco. Foram protegidas. Nenhuma continha senha ou chave.

**O que foi achado — e precisa de você**

1. **Urgente:** as taxas de cartão de Santa Fé voltaram sozinhas ao valor
   de fábrica em 09/09 (débito 1,99%, crédito 3,49%) e Pix, débito e
   crédito perderam a conta de destino. Está assim há duas semanas.
2. **Só Santa Fé opera no Joia.** Jales e Alphaville não têm dado.
3. **Caixa de Alphaville aberto desde 27/08.**
4. **72 lançamentos financeiros sem categoria** e **56 insumos sem custo**.

---

# 1. O que foi feito

## 1.1 O banco — de segundos para milésimos

A regra que decide "quem pode ver esta linha" era calculada **linha por
linha**, com várias consultas cada vez. Passou a ser calculada **uma vez
por leitura**. A regra em si não mudou.

| mesma leitura, como o gerente de Santa Fé | antes | depois |
|---|---|---|
| as 1.810 movimentações de estoque | 2.972 ms | **9 ms** |
| todas as 82 tabelas protegidas | 28,2 s | **0,2 s** |

**A prova de que nada mudou para ninguém:** nove perfis reais — dono da
rede, admin de Alphaville, gerente de Santa Fé, gerente de Jales,
plataforma, Raylan, um admin inativo, o visitante do cardápio e um usuário
estranho — contaram as linhas de cada uma das 82 tabelas **antes e
depois**. **Zero diferença.** A gravação também foi conferida: a loja grava
e altera o que é dela, e o estranho continua barrado.

Feito às 6h30, com as lojas fechadas. As 130 regras antigas estão
guardadas intactas: dá para voltar qualquer uma.

## 1.2 A chave da RDS

| | |
|---|---|
| nome | **RDS Auditoria** |
| alcance | a rede Jolô inteira (para comparar unidades) |
| permissão | **somente leitura** |
| revogação | imediata, a qualquer momento |
| prova | a chave responde; sem chave, a API recusa |

A chave **não está neste documento**. Ela foi entregue ao Rafael pelo
chat, para ser repassada à RDS.

## 1.3 Etapa 2 — o que a RDS autorizou

| item pedido | como ficou |
|---|---|
| `updated_at` | **`alterado_em` em 29 tabelas**, marcado pelo próprio banco. Regravação sem mudança não mexe na data — senão ela viraria ruído |
| índices de desempenho | criados para as consultas da auditoria e para a leitura do que mudou |
| saúde da sincronização **por unidade** | no ar: vendas sem pagamento, sem caixa, sem baixa de estoque, último registro recebido, caixas abertos |
| saúde da sincronização **por aparelho** | o banco já recebe; **o aviso sai do Joia na próxima versão** — pronto e testado, aguardando a publicação |

**O aviso do aparelho** diz à nuvem, a cada sincronização que dá certo (e a
cada erro): qual aparelho, de que unidade, com que usuário, em que versão
do Joia e se ficou coisa pendente. Ele nunca atrapalha a venda: sai no
máximo uma vez a cada 2 minutos e, se falhar, falha em silêncio. Tem teste
próprio (22 verificações) e passou pelo portão completo do Joia, as 10
etapas, incluindo os fluxos da loja no navegador de verdade.

## 1.4 A API — quatro caminhos novos (versão 2.1)

| caminho | para que serve |
|---|---|
| `/cadastros/{tipo}` | extrair os cadastros inteiros: unidades, usuários, itens, unidades de medida, motivos, formas de pagamento, contas, fornecedores |
| `/saude-sincronizacao` | o estado de cada unidade e de cada aparelho |
| `/alteracoes?desde=` | o que foi criado ou alterado desde um instante |
| `/historico` | quem mudou o quê, com o antes e o depois |

Provado: todos respondem com dado real; a chave presa a uma unidade não
enxerga as outras nem nos caminhos novos; sem chave, recusa.

## 1.5 Histórico da ficha técnica

A RDS pediu: *"se alguém alterar uma ficha, deverá registrar o antes, o
depois, a data e o motivo"*. O banco já registrava antes, depois, quem e
quando em 30 tabelas — **mas não na ficha, nos ingredientes, nos insumos
nem nos produtos**, justamente onde mora o custo. Agora registra. O
**motivo** depende de um campo na tela, que está no desenho da Etapa 3.

## 1.6 Segurança

A verificação de segurança do banco apontou **12 cópias de segurança** na
área pública, sem proteção — algumas feitas durante as correções de 16 a
21/09. Quem tivesse a chave pública do aplicativo poderia lê-las. Foram
movidas para a área protegida, sem perder nada. **Nenhuma continha senha,
token ou chave.**

## 1.7 Desenho técnico da Etapa 3

Entregue em `DESENHO_ETAPA3.md`. O ponto principal: **o Joia já grava o
custo de cada venda no momento em que ela acontece** (no movimento de
estoque da venda). A Etapa 3 não cria um motor de custo novo — só amarra
esse custo a cada item e guarda a composição da ficha usada.

---

# 2. O que os dados mostraram

## 2.1 Urgente — as taxas de cartão de Santa Fé

| quando | quem gravou | o que aconteceu |
|---|---|---|
| 02/09 12:18 | aparelho de Santa Fé | taxas voltaram ao valor de fábrica |
| 02/09 20:21 | ajuste | corrigido |
| 03/09 17:05 | aparelho de Santa Fé | voltou de novo |
| 03/09 18:03 | ajuste | corrigido |
| **09/09 16:19** | **aparelho de Santa Fé** | **débito 0,73% → 1,99%, crédito 2,73% → 3,49%, e Pix, débito e crédito perderam a conta de destino** |

Desde 09/09 ninguém repôs. A taxa calculada nas vendas em cartão, a
previsão de recebimento e a conta onde o dinheiro cai estão erradas desde
então.

As correções de 01 a 04/09 não impediram essa última volta. A causa mais
provável é um aparelho rodando uma versão antiga guardada no navegador —
**o aviso de aparelho, pronto hoje, é o que passa a mostrar isso.**

## 2.2 Só Santa Fé opera no Joia

| unidade | vendas no Joia | observação |
|---|---|---|
| Santa Fé do Sul | 2.067 de 01/08 a 22/09 | operação real |
| Matriz | até 19/08 | implantação e teste |
| Jales | nenhuma | — |
| Alphaville | nenhuma | **caixa aberto desde 27/08** |

A comparação com Jales que a RDS quer fazer **não tem dado do Joia** hoje.

## 2.3 A qualidade da venda melhorou semana a semana

| semana | vendas | sem caixa | sem pagamento | sem baixa de estoque |
|---|---|---|---|---|
| 27/07 a 17/08 | 315 | 315 | 0 | 315 |
| 24/08 | 397 | 2 | 10 | 67 |
| 31/08 | 422 | 0 | 0 | 44 |
| 07/09 | 447 | 0 | 0 | 4 |
| 14/09 | 404 | 0 | 0 | 2 |
| 21/09 (parcial) | 82 | 0 | 0 | 0 |

**A partir de 07/09 a venda de Santa Fé é consistente.** As poucas vendas
sem baixa são de produto sem ficha.

## 2.4 Cadastros — os pontos de limpeza

| cadastro | situação |
|---|---|
| fornecedores | **o mais saudável**: 53, todos com CNPJ, nenhum duplicado |
| fichas técnicas | 146, todas com ingredientes e rendimento |
| insumos | **56 sem custo** (19%); sem situação ativa/inativa |
| produtos | **2 ativos sem ficha nem insumo** — vendem sem baixar estoque |
| lançamentos financeiros | **72 sem categoria nenhuma**, de 202 |
| contas financeiras | 3 genéricas, **saldo inicial zero e sem data**, nenhuma ligada a unidade |
| formas de pagamento | crédito com uma bandeira só; taxas no valor de fábrica |
| unidades | só Santa Fé com CNPJ; Matriz e Alphaville sem cidade |
| motivos de estoque | 13, **nenhum com classe** |
| usuários | uma conta por loja — o histórico mostra a unidade, não a pessoa |

O detalhe completo está em `CADASTROS_DIAGNOSTICO.md`.

---

# 3. O que depende do Rafael

## 3.1 Agora

1. **Confirmar as taxas de cartão de hoje** e a **conta** onde cartão e Pix
   caem. Com isso a restauração é feita na hora e a causa é investigada.
2. **Publicar a próxima versão**, que leva o aviso de aparelho. Está pronta,
   com o portão completo verde.
3. **Fechar o caixa de Alphaville** aberto desde 27/08.

## 3.2 Com o Raylan

4. **Confirmar a classe dos 13 motivos** de estoque. A tabela com a sugestão
   para cada um está em `CADASTROS_DIAGNOSTICO.md`, seção 5.
5. **Categorizar os 72 lançamentos** sem categoria.
6. **Dar custo aos 56 insumos** sem custo.

## 3.3 Com a RDS, antes da Etapa 3

7. **As contas reais de cada unidade** e o saldo na data de corte.
8. **Competência do imposto:** regra automática (mês anterior ao
   vencimento) ou manual?
9. **Motivos de cortesia:** a lista final.
10. **Data de corte e unidade-piloto.** Os dados apontam para Santa Fé,
    com o corte **depois que as taxas forem repostas**, e inventário físico
    no mesmo dia.
11. **Login por pessoa**, se a auditoria precisar saber quem fez cada
    operação — hoje é uma conta por loja.

---

# 4. Para a RDS começar

A leitura pode começar hoje, pela sequência que a própria RDS propôs:

1. autenticação e segregação — já provadas;
2. `/lojas`;
3. `/saude-sincronizacao` — mostra de cara que só Santa Fé tem operação;
4. `/resumo` para a visão inicial;
5. os analíticos (`/pedidos`, `/itens`, `/pagamentos-analitico`,
   `/movimentacoes`, `/inventarios`, `/titulos`, `/extrato`);
6. `/cadastros/*` e `/historico` para a completude e a coerência.

**Ressalvas que valem para a primeira leitura:**

- a taxa de cartão das vendas desde 09/09 está com o valor de fábrica;
- o CPV histórico usa a ficha de hoje (a ficha não tem versão);
- não há competência própria — a emissão é a data mais próxima;
- o aviso por aparelho só aparece depois da próxima versão.

---

*Arquivos deste trabalho, no repositório: `DESEMPENHO_BANCO.md`,
`CADASTROS_DIAGNOSTICO.md`, `DESENHO_ETAPA3.md`, `API_JOIA_AUDITORIA.md`,
`api-joia.openapi.yaml` (versão 2.1) e o código da API em
`supabase/functions/joia-api/index.ts`.*

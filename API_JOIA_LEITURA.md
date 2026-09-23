# Joia — API de leitura (resumos e análise)

Porta oficial para outro sistema **perguntar** ao Joia: Codex/ChatGPT,
planilha, painel, o que for. Ela **só lê**. Não existe nenhum caminho de
escrita aqui — nada que se chame por esta porta altera o sistema.

Criada em 18/09/2026, a pedido do Rafael, para o Codex trazer resumos e
fazer análise. Em 22/09/2026 ganhou a **camada analítica (v2.0)**, para a
auditoria gerencial da RDS: os registros que formaram cada total, um a um.

- Dicionário completo de campos, fórmulas e erros: `API_JOIA_AUDITORIA.md`
- Contrato OpenAPI 3.1: `api-joia.openapi.yaml`
- O que o Joia ainda não grava, e o que depende de decisão:
  `DIAGNOSTICO_API_AUDITORIA_RDS.md`

## Endereço

```
https://cevghkndzpzvnzwifhnm.supabase.co/functions/v1/joia-api
```

## Como chamar

Todas as chamadas são `GET`, com a chave no cabeçalho:

```
Authorization: Bearer SUA_CHAVE
```

(ou `x-api-key: SUA_CHAVE`, se for mais fácil na ferramenta.)

Exemplo:

```bash
curl -H "Authorization: Bearer SUA_CHAVE" \
  "https://cevghkndzpzvnzwifhnm.supabase.co/functions/v1/joia-api/resumo?de=2026-09-01&ate=2026-09-17"
```

## Parâmetros que valem em quase tudo

| parâmetro | o que é | padrão |
|---|---|---|
| `de` | data inicial, `AAAA-MM-DD` | 30 dias atrás |
| `ate` | data final, `AAAA-MM-DD` | hoje |
| `loja` | a unidade (`suc_...`). Sem ela, a rede toda | rede toda |

O dia é o dia **da loja** (fuso de São Paulo): venda das 23h é do dia dela.

## Caminhos

| caminho | o que devolve |
|---|---|
| `GET /` | a própria ajuda, em JSON |
| `GET /lojas` | as unidades da rede, com a referência para usar em `loja` |
| `GET /faturamento` | venda por dia: pedidos, total, ticket médio, desconto, taxa |
| `GET /produtos` | o que mais vendeu (`limite`, padrão 50) |
| `GET /pagamentos` | venda por forma de pagamento |
| `GET /estoque` | saldo atual, custo médio, valor e quem está abaixo do mínimo (`abaixo=1` traz só esses) |
| `GET /financeiro` | a pagar e a receber do período, por categoria e situação |
| `GET /producao` | ordens de produção do período |
| `GET /contagens` | contagens de estoque: sobra, perda e resultado |
| `GET /resumo` | **tudo isso junto** — é o caminho certo para análise |

### Analíticos (v2.0) — registro a registro

Todos paginados (`pagina`, `por_pagina`: padrão 200, máximo 1000), com
ordem determinada e um envelope que diz a versão, a hora da geração, o
período, a unidade e o total de registros. Quando o Joia não grava algo
que o caminho tocaria, a resposta traz `avisos` dizendo isso.

| caminho | o que devolve |
|---|---|
| `GET /pedidos` | venda a venda, com cancelamento, motivo e operador |
| `GET /itens` | item a item das vendas, com adicionais |
| `GET /pagamentos-analitico` | pagamento a pagamento, com taxa e data prevista |
| `GET /movimentacoes` | o razão do estoque, linha a linha, classificado |
| `GET /inventarios` | contagem item a item: sistema × contado × diferença |
| `GET /producao-analitico` | produção item a item: previsto × realizado |
| `GET /titulos` | título a título (`data=emissao\|vencimento\|pagamento`) |
| `GET /extrato` | o que entrou e saiu de caixa e banco |
| `GET /plano-de-contas` | categorias e subcategorias de hoje |
| `GET /fichas` | ficha técnica com ingredientes (`ficha=fi_...`) |
| `GET /reconciliacao/estoque` | saldo inicial + entradas − saídas = saldo final |

### Etapa 2 (v2.1, 23/09/2026)

| caminho | o que devolve |
|---|---|
| `GET /cadastros/{tipo}` | um cadastro inteiro: unidades, usuarios, itens, unidades-medida, motivos, formas-pagamento, contas, fornecedores |
| `GET /saude-sincronizacao` | por unidade e por aparelho: vendas sem pagamento, sem caixa, sem baixa, último registro recebido, caixas abertos, último sinal |
| `GET /alteracoes?desde=` | o que foi criado ou alterado desde um instante |
| `GET /historico` | quem mudou o quê, com o antes e o depois |

## Respostas de erro

| código | quando |
|---|---|
| 401 | sem chave, ou chave inválida/desativada |
| 400 | data fora do formato `AAAA-MM-DD`, ou início depois do fim |
| 404 | caminho que não existe (a resposta já vem com a lista dos válidos) |
| 405 | qualquer método que não seja GET — esta API não escreve |

## As chaves

- Ficam na tabela `api_chaves`. A chave **nunca** é guardada em texto: o
  banco tem só o sha-256 dela e os primeiros caracteres, para dar para
  reconhecer qual é.
- Cada chave vale para uma rede e, se `sucursal_id` estiver preenchido,
  para **uma** unidade — e aí o parâmetro `loja` não a tira de lá.
- A tabela guarda `ultimo_uso` e `usos`, então dá para ver se uma chave
  está sendo usada e quando foi a última vez.
- Para cancelar uma chave: `update api_chaves set ativa=false where prefixo='...'`.
  A recusa é imediata, sem precisar mexer em código.

### Criar outra chave

```sql
with nova as (select 'joia_' || encode(gen_random_bytes(24),'hex') as chave)
insert into api_chaves (nome, prefixo, chave_hash, loja_id, sucursal_id)
select 'Nome de quem vai usar', left(chave,14),
       encode(digest(chave,'sha256'),'hex'),
       '6001c62e-26f3-4d81-8b6c-fa367c14146c',
       null                      -- ou 'suc_mt1unhbx2xrb' para travar numa loja
  from nova
returning (select chave from nova) as chave_para_guardar;
```

A chave sai **uma vez** nesse retorno. Não dá para recuperá-la depois —
se perder, cancela e cria outra.

## Por dentro

- Função de borda `joia-api` (Supabase Edge Function), sem JWT: quem manda
  na porta é a chave própria, conferida contra `api_chaves`.
- Os números saem de funções SQL `api_*` (`security definer`, só `select`),
  revogadas para `anon` e `authenticated` — ninguém as alcança pelas chaves
  públicas do projeto, só a função de borda.
- Provado ponta a ponta em 18/09/2026: sem chave → 401; chave errada →
  401; POST → 405; caminho inexistente → 404; data torta → 400; e os nove
  caminhos de leitura respondendo com os números conferidos contra o banco.
- E de novo em 22/09/2026, na v2.0: os onze caminhos analíticos
  respondendo com dado real; data inventada → 400; chave presa a uma
  unidade pedindo outra → responde a dela, com zero registro; e chave de
  outra rede → nenhum dado desta.

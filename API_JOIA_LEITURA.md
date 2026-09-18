# Joia — API de leitura (resumos e análise)

Porta oficial para outro sistema **perguntar** ao Joia: Codex/ChatGPT,
planilha, painel, o que for. Ela **só lê**. Não existe nenhum caminho de
escrita aqui — nada que se chame por esta porta altera o sistema.

Criada em 18/09/2026, a pedido do Rafael, para o Codex trazer resumos e
fazer análise.

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

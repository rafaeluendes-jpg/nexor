# Banco do Joia — espaço e velocidade (22/09/2026)

Medido direto no banco de produção, só leitura. Nada foi alterado.

## Espaço — sobra muito

| o quê | usado | o plano Pro inclui |
|---|---|---|
| banco de dados | **201 MB** | 8 GB (≈ 2,5% usado) |
| arquivos (fotos, logos) | **6 MB** (42 arquivos) | 100 GB |

Metade do banco é a tabela `backups` (**101 MB**) — cópias antigas
guardadas dentro do próprio banco — e mais **37 MB** são o registro de
auditoria (`audit_log`). Os dados de operação de verdade (vendas,
estoque, financeiro) somam uns **15 MB**. Espaço não é preocupação por
anos.

## Velocidade — a máquina está folgada; a regra de acesso é que pesa

- Memória: **100%** das leituras saem da memória (nada espera o disco).
- Conexões: 39 de 60 — normal; 21 delas são a reserva ociosa da API.

**O problema achado:** a checagem de segurança que decide "este usuário
pode ver esta linha?" é executada **linha por linha**, e cada vez faz
várias consultas ao perfil do usuário. Medido como o gerente de Santa Fé,
lendo as 1.810 movimentações de estoque:

| mesma leitura | tempo |
|---|---|
| sem a checagem | **0,001 s** |
| com a checagem, como a loja faz hoje | **2,97 s** |

Ou seja, **~2.700 vezes mais lento**, e cresce junto com o volume: cada
movimento novo deixa a leitura um pouco mais lenta. Nos registros do banco
desde julho, as leituras que o aparelho faz ao sincronizar levam em média
**1,3 a 2,9 s** cada (movimentações, cupons, pedidos, estoque, financeiro),
e até gravar um item de venda leva **1,2 s** em média — pelo mesmo motivo.

Hoje isso não trava a loja porque o Joia vende offline e sincroniza por
trás. Mas com mais meses de dados e as outras unidades entrando, é aqui
que a sincronização vai começar a demorar e a falhar.

## A correção (depende de autorização)

É conhecida e segura: fazer o banco calcular **uma vez por consulta**
quem é o usuário e quais lojas ele enxerga, em vez de uma vez por linha.
A regra de quem vê o quê **não muda** — muda só quantas vezes ela é
calculada. Mexe nas regras de acesso do banco de produção, então:

1. copiar as regras atuais (backup) antes de tocar;
2. trocar tabela por tabela, começando pelas mais lidas;
3. provar, para cada perfil (dono, gerente de unidade, outra rede), que
   vê **exatamente** as mesmas linhas de antes — e medir o tempo de novo;
4. desfazer na hora se qualquer contagem divergir.

Pela regra 2 do projeto, isso só roda com ordem do Rafael.

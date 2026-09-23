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

## A correção — FEITA em 23/09/2026, às 6h30 (lojas fechadas)

Autorizada pelo Rafael ("pode seguir direto"). A regra de quem vê o quê
**não mudou**; mudou só quantas vezes ela é calculada: agora uma vez por
leitura, em vez de uma vez por linha.

### O que foi feito
1. As 130 regras de acesso foram copiadas antes, intactas, para
   `arquivo.bkp_rls_politicas_20260923` — dá para voltar qualquer uma.
2. Três funções novas, com a mesma lógica das antigas, devolvendo a
   resposta de uma vez: `minha_rede_plena()`, `minhas_lojas()` e
   `lojas_com_cardapio()`.
3. As 130 regras foram reescritas numa transação só: ou trocava tudo, ou
   nada. (A primeira tentativa foi recusada por um detalhe de tipo e não
   alterou nada; a segunda passou.)

### A prova — o mesmo que antes, linha por linha
Nove perfis reais — dono da rede, admin de Alphaville, gerente de Santa Fé,
gerente de Jales, plataforma, Raylan, um admin inativo, visitante do
cardápio e um usuário estranho — contando cada uma das 82 tabelas
protegidas, **antes e depois**:

| perfil | tabelas | diferenças | tempo antes | tempo depois |
|---|---|---|---|---|
| gerente Santa Fé | 82 | **0** | 28,2 s | 0,2 s |
| gerente Jales | 82 | **0** | 25,0 s | 0,1 s |
| dono da rede | 82 | **0** | 25,9 s | 0,1 s |
| admin Alphaville | 82 | **0** | 26,4 s | 0,2 s |
| Raylan | 82 | **0** | 22,6 s | 0,1 s |
| admin inativo | 82 | **0** | 21,2 s | 0,1 s |
| plataforma | 82 | **0** | 5,2 s | 0,1 s |
| visitante do cardápio | 82 | **0** | 4,1 s | 0,0 s |
| usuário estranho | 82 | **0** | 22,7 s | 0,1 s |

Gravação conferida, com teste desfeito no fim: o gerente de Santa Fé grava
movimento e atualiza os mesmos pedidos, lançamentos e movimentos que já
enxergava; o usuário estranho continua barrado ("sessão sem empresa").
Nenhum resto de teste ficou no banco.

A leitura das 1.810 movimentações como o gerente de Santa Fé caiu de
**2.972 ms para 9 ms**.

A contagem completa (perfil, tabela, linhas e tempo, antes e depois)
ficou guardada em `arquivo.rls_prova_20260923`.

### Regra para toda regra de acesso nova
Função de identidade dentro de regra de acesso vai **sempre** entre
parênteses com SELECT — `(SELECT minha_loja())`, nunca `minha_loja()` solto
— e o teste de rede usa `(SELECT minha_rede_plena()) OR loja_id = ANY
((SELECT minhas_lojas())::uuid[])`. Solto, o banco recalcula a cada linha,
e a lentidão volta.

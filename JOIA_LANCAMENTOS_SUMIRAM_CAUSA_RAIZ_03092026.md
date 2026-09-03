# JOIA — Lançamentos de venda sumiram do Financeiro (regressão) — causa e correção

**03/09/2026. URGENTE.** Depois da correção das taxas, os lançamentos de
venda (débito, crédito, Pix) pararam de aparecer no Financeiro, na conta
Banco Itaú. Investigação por Git + leitura no banco de produção.

## A causa raiz (é a semente de fábrica repondo por cima do real)

O fechamento de caixa cria o lançamento da venda **na conta de destino da
forma de pagamento**. Débito, crédito e Pix estavam com **conta de destino
VAZIA** — então o lançamento nascia sem conta e não aparecia em conta
nenhuma. No banco, as formas estavam com **valor de fábrica**: débito 1,99%,
crédito 3,49%, conta nula.

Como chegaram a fábrica: a `baseFormas()` enche a lista de formas com o
valor de FÁBRICA sempre que ela fica vazia por um instante (troca de login,
estado zerado) — e o envio seguinte levava isso para a nuvem, **por cima da
configuração real da loja** (taxa 0,73/2,73 e conta Banco Itaú). Some a
conta → some o lançamento; e a taxa também voltava a 1,99/3,49.

Pelo Git: a V290 já tinha travado essa reposição, mas cegou o caixa (sem
forma nenhuma não dá para cobrar), e a V293 reabriu a semente — trazendo a
regressão de volta, agora atingindo também a conta.

## A correção (V299, sem refatorar, sem desfazer a taxa)

Separei o que a tela MOSTRA do que o sistema GRAVA:

- A lista **gravada** (`DB.formasPag`, que sobe para a nuvem) só recebe
  fábrica quando a loja é **nova** (a nuvem nunca soube das formas). Se a
  nuvem já conhece, fica vazia e **espera o download trazer os valores
  reais** — nunca repõe fábrica por cima da taxa nem da conta.
- O caixa **nunca fica sem forma**: `syncFormas` usa uma lista de
  **exibição** de fábrica quando a gravada ainda não chegou. Essa lista de
  exibição **não é gravada nem enviada**.

Assim a taxa real (0,73/2,73) e a conta real (Banco Itaú) da loja param de
ser repostas, e o caixa continua cobrando.

- Teste: `testes/pdv-tem-forma-pagamento.js` reescrito — loja nova semeia;
  vazia+nuvem-conhece não semeia mas a tela tem forma; lista real preserva
  taxa E conta.
- `node ferramentas/portao.js`: 9 etapas verdes.

## Restauração do dado (nuvem)

Como a nuvem estava com fábrica por cima do real, restaurei, com backup:

- Cartão débito → taxa 0,73%, conta Banco Itaú.
- Cartão crédito → taxa 2,73%, conta Banco Itaú.
- Pix → conta Banco Itaú (taxa 0).
- Dinheiro → conta Caixa (já estava).

E os lançamentos de venda desta semana que tinham ficado **sem conta**
foram apontados para a conta certa (débito/crédito/Pix → Banco Itaú), para
voltarem a aparecer no extrato. Backup em `bkp_formas_conta_20260903` e
`bkp_lancfin_conta_20260903`.

## Varredura

Conferido PDV → fechamento → lançamento → conta → valor: com a forma
apontando para a conta certa, cada método cai na conta esperada. A taxa da
correção anterior (0,73/2,73) volta a valer e não é mais reposta.

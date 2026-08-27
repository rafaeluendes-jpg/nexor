# Joia — as funções que ninguém chamava

Uma função que ninguém chama não é código morto por definição. Pode ser
resto de tela removida, pode ser duplicata que perdeu — ou pode ser **a
proteção que alguém escreveu e esqueceu de ligar**, que é o mesmo que não
existir. Foi o defeito da V191 (`marcarNovoAqui`), e a V192 existiu só
para consertar isso.

Eram **42**. Hoje são **2**. Cada uma foi lida na tela onde deveria
morar, antes de qualquer decisão — ligar às cegas é como nasceu a V179.

Regenerar a lista: `node ferramentas/mapear.js` e ler o fim do `MAPA.md`.

## Ligadas — eram recurso construído sem porta de entrada

| Função | O que voltou a existir |
|---|---|
| `podeSucursal` | **a separação por unidade.** `trocarLoja` não conferia o destino: dava para entrar em qualquer unidade da rede (V202) |
| `sucursaisDoUsuario` | o menu do topo listava a rede inteira; agora lista só as unidades liberadas (V202) |
| `liberacoesQuebradas` | o diagnóstico de "marquei a unidade e a loja continua sem ver", parado desde a V188 |
| `mudarPago` | **marcar vários lançamentos como pagos de uma vez.** A seleção, a soma e o `modalPagamento` aceitando lista já existiam — faltavam os dois botões |
| `pendentesSemEntregador` | o painel das entregas que ninguém assumiu. Sem entregador elas não entram em acerto nenhum: sumiam do pagamento sem aviso |
| `tornarPadrao` | **não havia como marcar o entregador padrão.** Só o menu suspenso `menuEntregador` chegava nele, e esse menu ninguém abria. `entregadorPadrao()` decide a taxa sugerida — o sistema usava o primeiro da lista |
| `copiarBoleto` | o código de barras já era digitado e sincronizado, e não tinha como sair para a área de transferência |
| `rodapeCaixa` | o rodapé com o saldo da conta filtrada. O CSS dele estava na folha desde sempre |
| `cadastrarMotivoBaixa` | o atalho combinado no `DECISOES.md` desde a V10.4.1. A função existia, o estilo `.incNovo` existia; faltava o elemento entre os dois |
| `fecharDias` | **fechar a semana de uma vez.** `aplicarHorario` reabre os dias; esta é a metade oposta. Sem ela, era desligar dia por dia, sete vezes |
| `totemLigadoNa` | a marcação "o totem vale nesta unidade" não valia nada — dava para abrir o totem em unidade não marcada |
| `puxarCidadesAreas` | traz as cidades das áreas de entrega para as taxas do entregador. Sem ela, digita-se à mão uma lista que o sistema já conhece — e nome escrito diferente faz a taxa nunca casar |

## Um botão que respondia e ia para o lugar errado

No modal do WhatsApp, "Configurar mensagens" fazia `CN.aba='whatsapp'`.
`CN` existe — mas é o filtro de **outra tela** (`{situacao, busca}`, dos
lançamentos). A atribuição criava um campo solto num objeto alheio, e a
tela de Canais, que lê `CN2.aba`, abria na aba padrão.

Botão que responde e vai para o lugar errado é pior do que botão que não
responde: ninguém desconfia dele.

## Apagadas — 30 ao todo

**Duplicatas que perderam.** Em cada par, quem estava ligado continuou:

| Apagada | Quem já fazia |
|---|---|
| `modalMotivo` | `formMotivo` |
| `menuEntregador` | os botões do próprio cartão (menos `tornarPadrao`, que foi religado) |
| `opcoesCategorias` | o mesmo laço, inline, no formulário de lançamento |
| `taxaPorCidade` | `taxaPedido`, que faz isso e mais |
| `pedidosDeSuc` | `vendaDaUnidadeAberta`, chamada direto nos painéis |
| `painelFiltros`, `grupoChips` | os filtros inline (`.fGrupo`) que as telas usam |
| `custoMedio30` | `custoMedioPond` |

**Recurso aposentado de propósito.** `novoUsuarioNa` era o botão da linha
"unidade sem acesso", retirada na V79 — desde então a unidade e o acesso
nascem juntos. Religar contrariaria uma decisão tomada.

**Restos de tela removida.** `salvarChaveZap` (o campo `zpChave` não
existe mais), `telaCargaJSON`, `abrirCfgCardapio`, `semearRedeJolo`,
`semearInsumos`, `semearDemo`, `toggleCego`.

**Ajudantes nunca aproveitados.** `uuidOuNulo`, `limparIds`, `soDom`,
`apelidoLogin`, `_limparMapaInsumos`, `diaDoPedido`, `nomeCanalRel`,
`sucMatrizId`, `empresaDe`, `unidadesDaRede`, `qrDataURL`, `reservado`,
`podeDesconciliar`, `semAcento`, `lerArquivoCarga`.

A remoção foi feita por `ferramentas/podar.js`, que corta por contagem de
chaves e **recusa o corte se o arquivo deixar de compilar sozinho**.
Depois de cada poda, o E2E com DOM real acusou zero ReferenceError.

## As 2 últimas — resolvidas na V205

**`barraKanban` — apagada.** Mostrava o movimento do turno em dinheiro no
PDV, o que confronta a regra do caixa cego. O Rafael decidiu: não faz
sentido, sai.

**`taxaDaZona` — apagada, porque o sistema já faz melhor.** O modelo é
cidade + zonas por raio, cada raio com seu valor. Fui conferir e o PDV já
implementa exatamente isso, em `taxaSugerida()`, com uma ordem que
`taxaDaZona` não tem:

1. a zona guardada no cadastro do cliente (por `zonaId` — casamento exato)
2. a zona pelo nome do bairro informado
3. a taxa padrão da cidade
4. a tabela do entregador, como era antes

`taxaDaZona` fazia só os passos 2 e 3, e por NOME — que é frágil: cidade
escrita diferente não casa. `taxaSugerida` prefere o `zonaId`, que é
exato. Além disso `trocaZonaPDV` guarda a zona escolhida no cadastro do
cliente, então a próxima venda já vem certa sozinha.

Conferido também que **o cardápio digital aplica as mesmas zonas**: ele lê
`areas_entrega` com as zonas aninhadas em `areas_zonas`, a mesma fonte que
o sistema grava. Não há divergência entre o preço do balcão e o do
delivery online.

---

**Zero funções órfãs.** Eram 42.

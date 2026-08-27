# Joia — as funções que ninguém chama

Uma função que ninguém chama não é código morto por definição. Pode ser
resto de tela removida — ou pode ser **a proteção que alguém escreveu e
esqueceu de ligar**, que é o mesmo que não existir. Foi o defeito da V191
(`marcarNovoAqui`), e a V192 existiu só para consertar isso.

Na Fase 6 as 42 foram lidas uma a uma. Duas eram bug de verdade e já
foram corrigidas. Este documento é a lista do que sobrou, classificada,
para o trabalho não se perder.

Regenerar a lista: `node ferramentas/mapear.js` e ler o fim do `MAPA.md`.

## Corrigidas na V202

| Função | O que era |
|---|---|
| `podeSucursal(sid)` | decide se a pessoa opera naquela unidade. **Nunca foi chamada.** `trocarLoja` não conferia o destino — dava para entrar em qualquer unidade da rede. Agora confere |
| `sucursaisDoUsuario()` | filtra as unidades liberadas para a pessoa. **Nunca foi chamada.** O menu do topo listava `lojasCad()`, a rede inteira. Agora lista esta |
| `liberacoesQuebradas()` | diz quais cadastros têm a liberação por unidade quebrada. **Nunca foi chamada** desde a V188 — o diagnóstico existia e nunca aparecia. Agora sai na tela de Diagnóstico, via `pintaLiberacoes()` |

## Achados que ainda não têm correção

### `novoUsuarioNa(sucId)` — meio caminho

`US.novaSuc` é lido em três lugares (o formulário já abre com a unidade
marcada), mas quem deveria escrever esse estado é `novoUsuarioNa`, que
ninguém chama. O atalho "novo usuário nesta unidade" nunca chega a
existir.

### `totemLigadoNa(suc)` — trava de unidade do totem

Mesma forma do `podeSucursal`: decide se o totem vale para aquela
unidade, e não é chamada. Precisa de leitura da tela do totem antes de
ligar — não é mecânico.

## Apagadas na V203 — 19 ao todo

Restos de tela removida: `salvarChaveZap` (o campo `zpChave` não existe
mais em lugar nenhum), `telaCargaJSON`, `semearRedeJolo`, `semearInsumos`
e `semearDemo` (as duas já eram `{ return; }`).

Ajudantes escritos e nunca aproveitados: `uuidOuNulo`, `limparIds`,
`soDom`, `apelidoLogin`, `custoMedio30` (era apelido de
`custoMedioPond`), `_limparMapaInsumos`, `diaDoPedido`, `nomeCanalRel`,
`sucMatrizId`, `empresaDe`, `unidadesDaRede`, `qrDataURL`, `reservado`,
`podeDesconciliar` (era `return true`).

E `toggleCego`, que o Rafael pediu para tirar: o caixa cego virou regra,
sem interruptor.

A remoção foi feita por `ferramentas/podar.js`, que corta por contagem
de chaves e **recusa o corte se o arquivo deixar de compilar sozinho** —
apagar 19 funções à mão num arquivo grande é exatamente como nasceu a
V179. Depois da poda, o E2E com DOM real acusa zero ReferenceError.

## As 21 que sobraram — para o Rafael decidir uma a uma

Nenhuma é lixo. Cada uma foi escrita para alguma coisa e não chegou a ser
ligada. Diga o número das que você quer e eu ligo.

### Financeiro

| | Função | O que ela faria |
|---|---|---|
| 1 | `mudarPago(v)` | marcar **vários lançamentos de uma vez** como pagos ou não pagos, pelas caixinhas da lista |
| 2 | `copiarBoleto(id)` | copiar o código de barras do boleto de um lançamento |
| 3 | `opcoesCategorias()` | lista pronta de categorias para escolher no lançamento |
| 4 | `rodapeCaixa()` | rodapé com o resumo por conta na tela de caixa |

### Delivery e entregadores

| | Função | O que ela faria |
|---|---|---|
| 5 | `pendentesSemEntregador()` | mostrar as entregas **pendentes sem entregador atribuído** |
| 6 | `menuEntregador(ev,id)` | menu de ações do entregador na lista |
| 7 | `taxaPorCidade(e,cidade)` | a taxa daquele entregador para aquela cidade |
| 8 | `taxaDaZona(cidade,zona)` | a taxa da zona de entrega |
| 9 | `puxarCidadesAreas()` | trazer as cidades já cadastradas para o formulário de taxas |

### Estoque e cardápio

| | Função | O que ela faria |
|---|---|---|
| 10 | `modalMotivo(id)` | janela para cadastrar/editar motivo de movimentação |
| 11 | `cadastrarMotivoBaixa()` | atalho da baixa manual direto para cadastrar um motivo novo |
| 12 | `abrirCfgCardapio()` | pular direto para a configuração do cardápio |
| 13 | `fecharDias(dias)` | fechar de uma vez todos os dias marcados, sem desligar um a um |
| 14 | `totemLigadoNa(suc)` | **trava por unidade do totem** — mesma forma do `podeSucursal` que estava quebrado |

### Usuários e painéis

| | Função | O que ela faria |
|---|---|---|
| 15 | `novoUsuarioNa(sucId)` | "novo usuário **nesta unidade**", já com a unidade marcada |
| 16 | `pedidosDeSuc(peds,sucs)` | filtrar pedidos por unidade nos painéis |
| 17 | `barraKanban(peds,abertos)` | barra de resumo do Kanban: valor total e pedidos abertos |
| 18 | `painelFiltros(...)` | painel de filtros que recolhe e mostra o que está ativo |
| 19 | `grupoChips(...)` | grupo de "chips" de filtro (componente do painel acima) |

### Ficaram órfãs por causa da minha poda

| | Função | O que é |
|---|---|---|
| 20 | `semAcento(t)` | tira acentos de um texto. Era usada só por `apelidoLogin`, que apaguei |
| 21 | `lerArquivoCarga(el)` | lê o arquivo de importação. Era usada só por `telaCargaJSON`, que apaguei |

Estas duas são consequência direta da limpeza: apagar uma função deixou
órfã a que ela chamava. Se ninguém for usá-las, saem na próxima poda.

## O caminho para ligar cada uma

Não é mecânico, e é por isso que não fiz sozinho: para cada uma é preciso
abrir a tela onde ela deveria estar e ver se a ação já existe por outro
nome — senão o sistema fica com dois caminhos para a mesma coisa, que foi
como nasceu metade dos defeitos deste arquivo (`cardAtual` × `cardapioAtual`).

Agora isso é possível: cada módulo cabe inteiro numa leitura.

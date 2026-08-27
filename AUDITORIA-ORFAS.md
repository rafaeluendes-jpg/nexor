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

## Manipuladores de tela sem botão

Cada um destes desenha ou trata alguma coisa e não é chamado por nada.
Não dá para saber, sem abrir a tela, se a funcionalidade foi cancelada ou
se o botão se perdeu numa edição. **É aqui que mora o resto da auditoria
de "o botão não funciona".**

`mudarPago` (marcar vários lançamentos como pagos de uma vez),
`copiarBoleto`, `menuEntregador`, `modalMotivo`, `cadastrarMotivoBaixa`,
`abrirCfgCardapio`, `fecharDias`, `painelFiltros`, `grupoChips`,
`opcoesCategorias`, `rodapeCaixa`, `barraKanban`,
`pendentesSemEntregador`, `pedidosDeSuc`, `puxarCidadesAreas`,
`taxaPorCidade`, `taxaDaZona`.

O caminho para cada uma é o mesmo: abrir a tela onde ela deveria estar,
ver se a ação existe por outro nome, e então ligar ou apagar. É trabalho
de tela, não de arquivo — e agora é possível, porque cada módulo cabe
inteiro numa leitura.

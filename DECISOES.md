# Nexor — decisões e combinados

Registro do que foi combinado com Rafael, para não se perder entre sessões.

## Relatórios (a construir)

**Toda tela de relatório precisa ter um ícone de informação no topo.**

- Fica discreto, não aparente — só um "?" ou "i" pequeno ao lado do título
- Ao clicar, abre um painel lateral ou balão explicando **como aquele relatório é calculado**
- O texto deve dizer: de onde vem cada número, quais tabelas alimentam, o que entra
  e o que fica de fora
- Objetivo: quando os sócios olharem o relatório, entenderem a origem do dado e
  confiarem no número

Exemplo do tipo de texto esperado:

> **Como calculamos o CMV**
> Somamos todas as saídas de estoque com motivo de venda no período, usando o custo
> médio de cada item no momento da baixa. Não entram perdas de produção nem ajustes
> de contagem — esses aparecem em Perdas.
> Fonte: movimentações de estoque + fichas técnicas.

## Permissões (a construir)

- Permissão **por sucursal**: o franqueador marca item a item o que cada loja enxerga
- O usuário herda o que a sucursal dele libera, e pode ser restringido ainda mais
- Estrutura já criada no banco: sucursais, usuarios, usuario_sucursais,
  sucursal_permissoes, usuario_permissoes, auditoria

## Regras de negócio já implementadas

- Sabores de gelato geram **Gelato Venda**; não existe estoque por sabor
- Massa de cascão gera **Cascão** com conversão "a receita inteira gera N unidades"
- Venda na frente de caixa nasce direto na fase **entregue**; só delivery passa pelo fluxo
- Motivo de movimentação precisa ser do **tipo Produzir** para gerar produto acabado
- Custo do destino = média ponderada do que foi realmente produzido

## Movimentação de estoque (V10.0.0 — mudança estrutural)

A tela **deixou de ser genérica e virou só baixa manual**. As quatro portas do estoque
ficaram assim, cada uma com o seu lugar:

| Movimento | Onde se faz |
|---|---|
| Entrada | Nota de entrada |
| Produção | Ordem de produção |
| Acerto de saldo | Contagem de estoque |
| **Baixa manual** | **Movimentação de estoque** |

Regras que passam a valer:

- O botão **+** só aceita motivo do **tipo Saída**. Motivos de Entrada e Produzir
  continuam existindo (o sistema e a produção usam), mas não aparecem mais nessa tela
- A **observação saiu do cabeçalho e passou para cada linha** — cada item baixado tem
  a sua própria justificativa. Lançamentos antigos continuam mostrando a observação
  do cabeçalho, sem quebrar
- O **custo não é mais digitado**: é sempre o custo médio ponderado do item, em campo
  de leitura. Trocar a unidade recalcula o custo e **não mexe na quantidade digitada**
- Baixar uma **ficha técnica** tira do estoque da própria ficha. Só a **produção**
  explode a ficha nos ingredientes da receita
- O seletor de itens só oferece o que realmente guarda estoque (insumo com controle
  ligado, ficha marcada como estocável)
- A busca do relatório filtra **a partir de 3 letras**, por nome, código, identificação
  ou observação da linha. Nome inteiro ou código continua travando no item exato
- A **linha do tempo do histórico** ganhou a coluna **Custo médio** e mostra a
  observação de cada linha

## Financeiro: banco e forma pertencem ao pagamento (V10.1.0)

- **Dar entrada num lançamento não pede banco nem forma de pagamento.** Só o dia do
  pagamento. Uma conta a pagar é uma obrigação; o banco só existe quando ela é paga
- **O joinha abre a confirmação de pagamento no meio da tela**, com banco, forma de
  pagamento e dia. Só depois de confirmar o lançamento fica pago
- Desmarcar o pago é direto, sem janela, e o banco fica guardado para a próxima vez
- Editar um lançamento **já pago** continua permitindo corrigir banco e forma
- A nota de entrada continua levando a conta pré-escolhida para os seus boletos
- Na **conciliação bancária**, editar não mostra mais receita/despesa — o tipo do
  movimento aparece fixo, porque o dinheiro já saiu ou entrou no banco
- Editar um lançamento que veio de **nota de entrada** mostra os **itens comprados**
  naquela nota: quantidade, valor unitário, desconto e total

## Estoque Total: totais do filtro e ordenação (V10.2.0)

- Acima da tabela ficou uma barra com **três números**: o valor em dinheiro do que o
  filtro pegou, o valor total do estoque inteiro, e quanto o filtro representa em %
- Sem filtro, a barra avisa que os dois valores são o mesmo. Com filtro, ela destaca
  o valor filtrado e oferece o botão de limpar
- O rodapé da tabela repete os dois totais quando há filtro
- **Todas as 8 colunas ordenam ao clicar** no título; clicar de novo inverte.
  Texto começa em A→Z, número começa do maior para o menor. A seta mostra o sentido
- Empate sempre desempata pelo nome, para a lista nunca "dançar" entre um clique e outro
- A **exportação passou a seguir o filtro e a ordem da tela**, e traz no fim as duas
  linhas de total (do filtro e do estoque inteiro)

## Perda de dados na sincronização — causa e correção (V10.3.0)

Rafael relatou que a cada atualização "some tudo". Foram encontradas quatro falhas
somadas, todas capazes de apagar dados sozinhas:

1. **A rede de proteção do download nunca foi ligada.** A função `volta(linhas,fn,atual)`
   tinha o terceiro parâmetro justamente para manter os dados locais quando a nuvem
   respondesse vazio — e nas 30 chamadas ninguém o passava. Nuvem vazia = coleção local
   zerada. **Correção:** a proteção agora é aplicada uma vez, no fim do download,
   comparando cada coleção com o estado anterior. Não depende mais de lembrar do argumento
2. **O download não era atômico.** `api()` lança erro; se a 12ª tabela falhasse, as 11
   primeiras já tinham sido substituídas. **Correção:** o download inteiro virou
   tudo-ou-nada. Se qualquer tabela falhar, todas as coleções voltam ao estado anterior
3. **O envio apagava na nuvem o que sumia no aparelho.** Depois de um download que zerou
   uma coleção, o próximo envio deletava essas linhas da nuvem — perda definitiva.
   **Correção:** travas em `apagarRemovidos` — nunca esvazia uma tabela inteira, nunca
   apaga mais de 60% de uma vez, e o `_snap` só é atualizado depois de apagar de verdade.
   Os botões de reinício chamam `autorizarEsvaziar()` para poder limpar de propósito
4. **Falha ao gravar no aparelho passava como um toast.** Memória do navegador cheia =
   gravação recusada em silêncio e o próximo F5 voltava ao estado antigo.
   **Correção:** aviso fixo e vermelho na tela, que só some quando a gravação volta

Além disso: **cópia local automática** antes de cada download (`nexor_respaldo`), com
botão de restaurar em Backup e Restauração.

## Atualização de versão

- `location.reload(true)` não força nada nos navegadores atuais — o arquivo antigo vinha
  do cache. Agora recarrega com endereço novo (`?v=timestamp`), que realmente troca
- Checagem a cada 45s (era 180s), na abertura e ao voltar para a aba

## Menu do topo: exigia dois cliques (V10.3.1)

`fecharDrop()` agendava `mnuBox.innerHTML=''` para 200ms depois, para dar tempo da
animação de saída. Como `toggleDrop()` chamava `fecharDrop()` e logo em seguida
desenhava o menu novo, essa limpeza atrasada apagava o menu recém-aberto. O menu
aparecia e sumia sozinho — daí a impressão de precisar clicar duas ou três vezes.

- Trocar de categoria não passa mais por `fecharDrop()`: troca o conteúdo direto
- A limpeza atrasada só executa se, passados os 200ms, nenhum outro menu tiver aberto
- Na troca, o menu aparece na hora, sem esperar o próximo quadro e sem escada de animação
- A escada de animação na abertura caiu de até 416ms para no máximo 150ms

## Baixa manual: sem escolher operação, sem identificação (V10.4.0)

- A tela inteira é baixa manual, então isso virou um **rótulo fixo**, não um campo.
  Não se escolhe mais "Saída manual" numa lista
- **Motivo da baixa** fica ao lado, alimentado pelos motivos do tipo Saída cadastrados
  em Configuração da Loja › Movimentação de Estoque. Já vem com o primeiro escolhido —
  o "Selecione uma opção" saiu
- Link **(cadastrar novo)** ao lado do motivo leva direto para a configuração
- O campo **Identificação** saiu da baixa. A coluna continua no relatório, porque venda,
  nota e ordem de produção preenchem ela sozinhas
- Na configuração, a coluna Saída passou a dizer que é ela que alimenta a baixa manual

## Onde se cadastra o motivo de baixa (V10.4.1)

O cadastro sempre esteve em **Configuração da Loja**, mas o item do menu se chamava
"Movimentação de Estoque" — o mesmo nome da tela de operação, no módulo Estoque.
Rafael achou que o cadastro estava dentro da movimentação. Era só o nome.

- O item passou a se chamar **Motivos de Baixa de Estoque**
- A coluna **Saída** vem primeiro e diz "estes são os seus"; Entrada e Produzir
  explicam que o sistema usa sozinho
- O atalho na baixa manual diz "(cadastrar em Configuração da Loja)"
- Cadastrar, renomear ou inativar ali reflete na baixa na hora seguinte — mesma lista

## Cadastro novo sumia depois de atualizar (V10.5.0)

A V10.3.0 fechou o caso "nuvem responde vazio". Faltava o irmão dele, que foi o que
apagou o motivo "Venda para franqueado":

1. O cadastro nasce no aparelho e fica marcado para enviar
2. O envio não chega a acontecer — ou falha numa tabela **anterior** na fila
3. `NUVEM.sujo` só existia na memória e nascia `false` a cada boot, então o download
   não era bloqueado
4. O download troca a lista inteira pela da nuvem, que ainda não tem o registro novo.
   Ele some, e some em silêncio

Correções:

- **`DB._enviados`** guarda, por coleção, o que a nuvem **confirmou** ter recebido.
  No download, todo registro local ausente da resposta e ausente dessa lista é
  devolvido: é novo, não é apagado. Quem já foi confirmado e sumiu da nuvem continua
  sendo exclusão de verdade, feita em outro aparelho
- **`DB._sujo`** grava a pendência de envio junto com os dados, então ela sobrevive a
  um F5 e o boot seguinte sabe que precisa subir antes de baixar
- **Envio que falha marca a pendência**, bloqueando o download por cima
- O que for segurado agenda o envio sozinho e fica registrado no log da nuvem

Na primeira sincronização depois desta versão, `_enviados` está vazio — de propósito.
Isso faz o sistema tratar tudo que está no aparelho como ainda-não-confirmado e
reenviar, em vez de deixar a nuvem apagar.

## Duas entradas diferentes: a do sistema e a da nuvem (V10.6.0)

Entrar no sistema como "franqueador" **não liga o aparelho na nuvem**. São duas coisas:

| Entrada | O que faz | Onde |
|---|---|---|
| Login do sistema | diz quem é você e o que pode ver | tela de entrada |
| Conexão da nuvem | liga o aparelho no banco de dados | ícone de nuvem › Banco de dados |

Sem a segunda, o aparelho grava só no navegador dele. Nada sobe, nada desce, e ninguém
da rede enxerga. Foi o que aconteceu com o sócio do Rafael: ele cadastrava motivos que
ficavam presos na máquina dele.

Isso aparecia apenas como "Salvo neste aparelho" em letra pequena no rodapé.

- Agora um **aviso vermelho fixo** ocupa o rodapé enquanto o aparelho estiver fora da
  nuvem, com botão "Ligar agora"
- Os três avisos (gravação, sincronização, nuvem) passaram a morar numa barra única e
  empilham, em vez de um cobrir o outro

### Verificado no banco (05/08)

- `motivos_movimentacao` **está** publicada para tempo real — a propagação funciona
- Existe **uma única loja** e **um único usuário de nuvem** (`rafael@nexor.app`)
- A RLS exige sessão autenticada (`minha_loja()` lê de `auth.uid()`), então sem a
  conexão da nuvem nenhuma tabela responde

### Pendente de decisão

Cada pessoa da rede precisa da própria conta de nuvem, ou o login do sistema deve
conectar sozinho usando uma credencial da rede. Hoje só existe a conta do Rafael.

## Um computador não via o outro (V10.7.0)

Os dois aparelhos estavam ligados na nuvem e na versão certa. A propagação dependia de
**um único mecanismo**: o aviso instantâneo por websocket (Supabase Realtime). Se ele
cai — wifi da loja, proxy, roteador, aba em segundo plano — não há erro, não há aviso:
o aparelho simplesmente fica olhando dados velhos por horas.

Conferido no banco (tudo certo do lado do servidor):

- as 36 tabelas do tempo real estão publicadas, com `REPLICA IDENTITY FULL`
- `motivos_movimentacao` está entre elas
- toda tabela do MAPA existe e tem índice único em `ref_local`, então o upsert funciona
- uma loja só, e a RLS exige sessão autenticada

Correções:

- **Conferência periódica a cada 45s**: com ou sem tempo real, o aparelho confere
  sozinho. Dois computadores convergem em menos de um minuto
- Só redesenha a tela se algo mudou de verdade (retrato por contagem + nomes dos
  cadastros pequenos), e nunca no meio de um lançamento ou com janela aberta
- Não consulta nada com a aba em segundo plano
- **Aviso quando o envio trava**: se há coisa pendente que não sobe, o aparelho também
  para de receber. Antes isso era silencioso; agora aparece na barra de avisos
- O rodapé passou a dizer se o tempo real está de pé e a hora da última sincronização

### Tabelas fora do tempo real (propagam só na conferência de 45s)

`cardapio_config`, `clientes_nexor`, `compras_sem_vinculo`, `ordens_producao`,
`sucursais`, `usuarios_sistema`

## Virada de chave da sincronização (V11.0.0)

Três defeitos estruturais, não três sintomas:

### 1. O envio mandava o banco inteiro a cada mudança

Qualquer `salvar()` reenviava todas as 41 tabelas, todas as linhas, e — nas tabelas com
filhos — **uma chamada de rede por pai**. Com milhares de pedidos e movimentações, o
envio demorava, competia consigo mesmo e era interrompido por qualquer F5.

**Agora é incremental.** Cada registro tem uma impressão (`DB._hash`) que inclui os
filhos. Só sobe o que mudou desde o último envio confirmado; o resto é pulado, inclusive
o laço dos filhos e dos vínculos. O identificador que a nuvem deu a cada registro fica
guardado em `DB._uuid`, então pular não quebra o vínculo pai-filho. O que falha não
tem a impressão gravada e é reenviado na tentativa seguinte.

### 2. A trava de exclusão existia mas nunca era conferida

`NUVEM.baixou` era definida com o comentário "daqui em diante este aparelho pode
espelhar exclusões" — e **nunca lida em lugar nenhum**. Um aparelho recém-aberto, com
cópia velha, podia apagar na nuvem o que o outro tinha acabado de criar.
Agora `apagarRemovidos` recusa enquanto o aparelho não tiver baixado na sessão.

### 3. A propagação dependia só do websocket

Ver V10.7.0. Agora há três camadas: aviso instantâneo, **contador de versão a cada 6s**
e conferência completa a cada 45s.

### Contador de versão (no banco)

Tabela `loja_versao` com uma linha por loja e 41 gatilhos que incrementam o número a
cada gravação. O aparelho lê **uma linha** de 6 em 6 segundos; só baixa o banco quando
o número mudou. Custo desprezível, convergência em segundos.

## Busca e ordenação em toda tabela (V11.1.0)

Em vez de mexer nas dezenas de telas uma a uma, o sistema **observa o que foi desenhado
e liga busca e ordenação sozinho**. Toda tela nova nasce com isso funcionando, e não há
o risco de esquecer uma.

- Campo de busca acima de qualquer tabela com 6+ linhas: filtra a partir de **3 letras**,
  olhando a linha inteira, e mostra "X de Y"
- Todo cabeçalho vira clicável. Coluna de texto começa A→Z; coluna de número começa da
  maior para a menor. Clicar de novo inverte. Empate mantém a ordem original
- O tipo é detectado pelo conteúdo: "1.200 g" ordena como 1200, não como texto
- Tabelas com linha de subtotal (célula juntada) **não** são reordenadas, para não
  misturar os grupos
- Telas com busca/ordenação própria (Estoque Total, Movimentação) são reconhecidas e
  não recebem outra por cima. Para excluir uma tabela, basta a classe `semBusca`

## Mapa do Sistema

`Configuração da Loja › Mapa do Sistema` (era "Dados da Loja", que era um placeholder).
Lista todas as telas do plano, módulo por módulo:

- **Bolinha verde** = pronto · **bolinha vermelha** = a construir
- Dentro de cada módulo, os prontos vêm primeiro e os pendentes no fim
- Resumo no topo: quantas prontas, quantas faltam, % concluído
- A lista sai de `AFAZER`, então se mantém correta sozinha conforme as telas ficam prontas

## Janela do navegador substituída (V11.2.0)

`alert()` mostra uma caixa cinza com o endereço do site em cima — muda de cara em cada
navegador e não parece parte do sistema. Agora `window.alert` é substituído por `aviso()`,
que usa a mesma caixa das outras janelas do Nexor, no meio da tela. A primeira linha da
mensagem vira o título; o resto fica no corpo, preservando as quebras de linha. Fecha no
botão, no Escape, no Enter ou clicando fora.

Como a substituição é no `window.alert`, **toda tela do sistema passou a usar a janela
própria** — inclusive as que ainda não foram escritas.

## Ficha técnica

- **Subgrupo** e **Grupo de conta** saíram do cadastro. O que já estava gravado nesses
  campos é preservado ao editar; a tela só não pergunta mais
- Na composição, **Preço** e **Margem** viraram **Preço do kg** = custo total ÷ rendimento.
  A margem mostrava −100% enquanto não houvesse preço de venda, o que era só ruído.
  O preço de venda gravado continua intacto

## Uma tabela com problema paralisava as outras 40 (V11.3.0)

Diagnóstico no banco: `fichas_tecnicas` tinha **1 registro no aparelho e 0 na nuvem**.
Como o envio era uma fila única dentro de um `try` só, o primeiro registro recusado pelo
banco abortava tudo — as 40 tabelas seguintes nunca subiam, e o aparelho ficava
"travado" sem dizer onde. Schema, índices e RLS estavam corretos; era um dado.

- Cada tabela passou a subir **por conta própria**. Uma falhando, as outras continuam
- O aviso agora **nomeia a tabela e mostra a mensagem que o banco devolveu**
- O aparelho deixa de ficar travado: o download volta a funcionar, porque o que ainda
  não foi confirmado já está protegido por `_enviados`

## Sem estoque, sem custo

`custoDoItem` devolve **0 quando o saldo é zero ou negativo**. Custo médio é o preço do
que está dentro do estoque; sem nada dentro, não há custo. Ele volta a existir na
próxima entrada, que é quem forma o preço. Itens que não controlam estoque mantêm o
custo. O preço da **última compra** continua aparecendo — é histórico, não saldo.

## Códigos: numeração única, em ordem alfabética

- **Ingrediente e ficha dividem a mesma numeração** — é a mesma lista do estoque
- Botão **Renumerar códigos** no Estoque Total: dá 1, 2, 3... na ordem alfabética
- Cadastro novo pega **o próximo número livre**, sem renumerar os existentes. Inserir
  alfabeticamente empurraria milhares de códigos a cada cadastro e quebraria etiqueta,
  planilha e nota fiscal

## De onde vinham os códigos 700002 (V11.4.0)

Havia **dois contadores separados**: o de ingrediente começava em 700000 e o de ficha
em 1, para não colidirem. Era a única razão do número grande — e ela deixou de existir
quando as duas listas passaram a dividir a mesma numeração.

O acerto agora **roda sozinho, uma vez**, na primeira vez que uma tela de estoque abre
(`arrumarCodigos()`, marcado por `DB._codOk`). Não fica renumerando a cada tela. O botão
**Renumerar códigos** continua no Estoque Total para reorganizar depois de um lote de
cadastros.

## Colunas que faltavam no banco (V11.5.0)

A mensagem "Could not find the 'cfg_dre' column of 'config_loja'" era literal: o cliente
mandava campos que **não existiam no banco**. Comparei, campo a campo, o que cada tabela
do MAPA envia com as colunas reais. Faltavam quatro:

| Tabela | Coluna |
|---|---|
| `config_loja` | `cfg_dre`, `cfg_pdv` |
| `lancamentos_financeiros` | `cancelado` |
| `compras_sem_vinculo` | `itens` |

Criadas. A mensagem culpava `lancamentos_financeiros` porque `etapa` ficava na última
tabela do laço e o bloco de `config_loja` rodava fora dele — agora esse bloco também é
isolado e nomeia a si mesmo.

### Falha isolada x falha sistêmica

Uma ou duas tabelas com problema de dado não paralisam o aparelho. Mas se metade delas
falhar (ou 3+), é rede ou credencial caindo — aí a pendência continua marcada e nada é
baixado por cima.

## Juros e multa no pagamento

- Campos de **Juros** e **Multa** na confirmação de pagamento, com o total recalculado ao vivo
- Ao confirmar, o **valor do lançamento passa a ser o que realmente saiu da conta**, e o
  valor de antes fica em `valorOriginal`. Assim fluxo de caixa, DRE e conciliação batem
  com o extrato, sem precisar mexer em cada relatório
- Zerar os juros devolve o valor original — não acumula a cada pagamento
- Em pagamento de vários lançamentos os campos não aparecem: juros são de cada conta

## "All object keys must match" (V11.6.0)

O banco exige que **todos os registros de um envio tenham exatamente as mesmas chaves**.
Alguns mapeamentos escreviam `fk(...)||undefined` para um vínculo inexistente — e um
campo `undefined` simplesmente some do registro. Um grupo com destino subia com 3 chaves,
outro sem destino com 2, e o lote inteiro era recusado.

- `igualarChaves()` no `enviar()` **iguala todo lote antes de subir**: quem não tem o
  campo sobe com ele em branco. Vale para as 41 tabelas, inclusive as futuras
- Os dois mapeamentos que usavam `||undefined` passaram a usar `||null`

## Do boleto para a nota

No lançamento vindo de nota de entrada, o cabeçalho do bloco de itens virou **link**:
clicar abre a nota de entrada que gerou aquele boleto. Se a nota tiver sido apagada,
avisa em vez de quebrar.

O link "(cadastrar novo)" do Fornecedor saiu — não sobrou nenhum atalho de cadastro
dentro das telas de lançamento.

## Valor do boleto x valor pago (V11.7.0)

Dois números diferentes que não podem ser confundidos: o que foi combinado com o
fornecedor e o que realmente saiu da conta.

- Lista de lançamentos: **duas colunas** — "Valor do boleto" (discreto) e "Valor pago"
  (em destaque, com a cor do tipo). Quando houve encargo, uma linha embaixo mostra
  "+ R$ 20,00 juros/multa". Conta não paga mostra "em aberto"
- Conciliação bancária usa **exatamente as mesmas duas colunas** do lançamento
  financeiro: "Valor do boleto" e "Valor pago". O saldo acumulado segue o valor pago,
  que é o que aparece no extrato (V11.8.1)
- Exportação: colunas separadas de boleto, juros, multa e valor pago
- Helpers: `valorBoleto(l)`, `encargos(l)`, `valorPago(l)`

## Nova tela de acesso (V11.8.0)

Refeita conforme o desenho: painel da marca à esquerda, cartão de acesso à direita com
selo NEXOR ACCESS, indicador de sistema disponível, campos com ícone, "Manter conectado",
"Esqueci minha senha" e o rodapé de segurança. Os identificadores antigos (`lgC`, `lgU`,
`lgP`, `lgE`, `lgB`, `tg`) foram mantidos, então toda a lógica de entrada continua a mesma.

**Manter conectado** funciona de verdade:
- ligado → sessão em `localStorage`, o aparelho volta direto
- desligado → sessão em `sessionStorage`, vale só enquanto a aba estiver aberta
- a escolha fica lembrada em `nexor_manter`; `sair()` limpa os dois lugares

## A nota abre por cima do lançamento

`abrirNotaDoLanc` deixou de navegar para Notas de Entrada. A nota se desenha na própria
camada `mdOv`, então o lançamento é renomeado por um instante, a nota nasce separada e
vira `mdOv2` acima dele. O nó é clonado para descartar o clique-fora herdado (que
fecharia o lançamento de trás), os botões de fechar passam a chamar `fecharNotaSobre()`
e o "Excluir nota" é retirado — ali a nota é consulta.

## O bloco da nota não aparecia (V11.9.0)

O vínculo do lançamento com a nota (`l.ref`) **nunca era enviado nem baixado** — não
havia coluna para ele. A nota era criada, o vínculo existia no aparelho, e a primeira
sincronização o apagava. Sem `ref`, o bloco simplesmente não renderizava.

- Coluna `origem_ref` criada em `lancamentos_financeiros`; `l.ref` sobe e volta
- `notaDoLanc(l)` acha a nota por **três caminhos**: pelo `ref`, pela lista `lancIds`
  guardada na nota, e por nº do documento + fornecedor. Ao achar, **religa o `ref`**,
  então lançamentos antigos se consertam sozinhos ao serem abertos
- O mesmo `ref` é usado pelo fechamento de caixa, que também deixa de perder o vínculo

## Nenhuma janela do navegador sobrou (V11.10.0)

A V11.2.0 trocou o `alert`. Faltava o `confirm`, que estava em **38 lugares** — e ele
não dá para substituir por cima, porque o do navegador devolve o resultado na hora e o
do Nexor precisa esperar a resposta.

- `pergunta(msg, ok, tipo)` — mesma caixa do aviso, com dois botões. O tipo é deduzido
  do texto: excluir/apagar/remover/limpar/sair abrem em vermelho
- 35 funções viraram `async` e passaram a usar `await pergunta(...)`
- As 3 restantes eram validações dentro de janelas, que devolvem `false` para impedir o
  fechamento. Para elas, `modal()` passou a **esperar validação assíncrona**:
  `if(f && typeof f.then==='function') f = await f`. Isso vale para qualquer janela do
  sistema daqui em diante
- O recibo do entregador, que perguntava depois de gravar, virou `.then()` — não precisa
  segurar o retorno da janela

Nenhuma chamada ao `confirm` do navegador restou no arquivo.

## Identidade oficial (V12.0.0)

Rafael enviou o arquivo `Nexor_Login_Funcional.html` com a tela oficial e a arte da marca.

- As duas imagens embutidas foram extraídas para arquivos do repositório:
  **`nexor-marca.png`** (painel da esquerda) e **`nexor-n.png`** (símbolo)
- O estilo do arquivo foi portado **inteiro**, com cada seletor preso a `#login` e as
  variáveis renomeadas com prefixo `nx-`, para não vazar no resto do sistema
- A marcação também é a do arquivo; só os identificadores dos campos viraram os do
  sistema (`lgC`, `lgU`, `lgP`, `lgK`, `lgB`, `lgE`, `tg`), então `entrar()` não mudou
- O `<form>` virou `<div>`: o sistema já trata Enter e o clique do botão
- **Cabe em uma tela só**: dois pontos de ajuste (900px e 760px de altura) encolhem
  cartão, campos e botão em vez de deixar rolar
- As mensagens de erro passaram a usar o estilo `.feedback` do arquivo (`lgAviso()`)
- O símbolo `nexor-n.png` substituiu o "N" desenhado no topo do sistema

## Ícone do sistema (V12.1.0)

O sistema **não declarava ícone nenhum** — por isso, ao salvar ou instalar no computador,
o navegador inventava um símbolo genérico.

- `nexor-icone.png` (512), `nexor-icone-192.png` e `nexor-n.png` (64) gerados a partir do
  símbolo oficial, recortados no quadrado central
- `<link rel="icon">` em dois tamanhos, `apple-touch-icon` e **`manifest.json`** — é o
  manifesto que dá o ícone e o nome corretos ao instalar no computador ou no celular.
  Inclui o ícone `maskable`, que o Android usa sem cortar em quadrado
- `theme-color` da marca na barra do navegador
- O "N" desenhado saiu dos três lugares que ainda o usavam: topo do sistema, marca da
  tela inicial e ícone na lista de aplicativos

## Tela de acesso sem rolagem (V12.1.1)

A causa da barra horizontal não estava no estilo novo: a regra **antiga** do `#login`
sobreviveu no arquivo — `display:flex; padding:16px; min-height:100dvh` — e transformava
a grade num item flex com folga, estourando a largura. Removida.

- `minmax(560px, 41.75fr)` virou `minmax(0, 41.75fr)`: a coluna direita pode encolher
- `100dvh` virou `height:100%` nos três painéis (o `dvh` somava com a barra do navegador)
- O cartão deixou de rolar por dentro (`overflow:visible`) e o painel centraliza
- Abaixo de 980px de largura, a marca sai e fica só o acesso
- Título de 43px para 31px no máximo; campos de 68px para 54px; espaçamento entre campos
  reduzido — as informações ficaram compactas sem perder a estética
- **"Sistema disponível" removido**

## Tela de acesso sem rolagem (V12.2.0)

O arquivo oficial foi desenhado para telas grandes: botão de 72px, campos de 54px,
cabeçalho de 58px. Num notebook comum isso estourava a altura e aparecia barra de
rolagem — e a regra `minmax(560px, ...)` do arquivo forçava largura mínima, gerando
barra horizontal também.

- Compactação por `clamp()`: cabeçalho, cartão, título, campos e botão encolhem com a
  tela em vez de transbordar. Dois pontos extras em 1100px e 980px de largura, e um em
  700px de altura
- `overflow:hidden` na estrutura; só o cartão rola, e apenas em tela muito baixa, com a
  barra escondida
- `body.semRolagem` enquanto a entrada está aberta: a página não rola por baixo
- O bloco **"Sistema disponível"** saiu — era informação que não ajuda quem vai entrar
- Os ajustes precisaram entrar nas **duas** folhas de estilo, senão a segunda cópia das
  regras originais sobrescrevia a compactação

## Proporção da tela de acesso (V12.3.0)

O desenho original enche a coluna da direita. Quando a marca sai da tela, essa coluna
vira a tela inteira e o cartão estica junto: campos larguíssimos para 46px de altura,
texto perdido no meio do branco. Parecia formulário de celular esticado.

- **Coluna de leitura com largura máxima** (`--nx-col: min(432px,100%)`), centralizada,
  valendo para o cabeçalho e o cartão. É a correção que resolve a desproporção
- A marca só some abaixo de **820px** (era 980), então na maioria das janelas ela aparece
- Ritmo vertical apertado: rótulo colado no campo, campos de 46px, título 25px,
  botão 50px, selo e lista de segurança proporcionais

Os ajustes vão nas **duas** folhas de estilo — a segunda cópia das regras originais
desfaria a primeira.

## Ordem dos relatórios (definida por Rafael)

1. Faturamento por Dia
2. Itens Consumidos
3. Itens Vendidos
4. Vendas por Área de Entrega
5. Vendas por Forma de Pagamento
6. Vendas por Período
7. Relatório CMV
8. DRE
9. Cupons

Removido: "Vendas Geradas" (redundante).

## Dashboard

- Canais de Venda
- Faturamento
- Venda por Data e Hora
- **Comparativo Anual** (novo)

Removido: "Acompanhamento de Venda".

## Pendências

- [ ] Gestão de Relatórios (com a explicação de cada um)
- [ ] Gestão e Dashboard
- [ ] Configuração da Loja: sucursais, usuários, permissões
- [ ] Cardápio digital
- [ ] Robô do WhatsApp
- [ ] Integração fiscal (via empresa contratada)
- [ ] Integração iFood (após homologação como parceiro)

## Totem de autoatendimento (avaliado, a construir depois)

O cardápio digital já é a maior parte do que um totem precisa. A diferença:
tela cheia, sem escolher loja, botões maiores, volta ao início sozinho.

**Duas versões possíveis:**

1. **Sem pagamento no totem** (recomendado para começar) — o cliente monta o
   pedido, sai uma senha, ele paga no caixa. Elimina a fila de escolher.
   Dá para testar num tablet de ~R$ 1.500 antes de comprar totem.

2. **Com pagamento** — exige integração TEF com a adquirente e um programa
   instalado na máquina. É a parte cara e demorada.

**Ordem sugerida:** depois de usuários e permissões.

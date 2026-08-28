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

## Design System Nexor — base (V13.0.0)

Primeira etapa do redesenho. **Nenhuma função, rota, permissão ou regra foi tocada.**

### Tokens

O sistema já lia tudo de variáveis CSS — bastou realinhá-las com a paleta da marca para
todas as telas mudarem ao mesmo tempo. Descoberta importante: havia **três blocos
`:root`**, e o segundo reafinava as cores por cima do primeiro. Era ele que valia. Os
dois primeiros agora falam a mesma língua.

| Token | Valor |
|---|---|
| `--deep` | `#0B2B3B` azul-marinho |
| `--acc-d` | `#0E7475` verde-petróleo (ação principal) |
| `--acc` | `#159A9C` teal (destaque) |
| `--bg` | `#F3F7F8` · `--line` `#D6E1E4` |
| `--ink` / `--ink-2` | `#17262F` / `#667780` |
| `--ok` / `--amber` / `--red` | `#238A63` / `#C88A27` / `#C94B4B` |
| `--r` / `--r-s` | 8px / 6px · `--t` 170ms |

### Componentes globais

Raio limitado a 8px (6px em botões e campos), botões de 36px com hierarquia
petróleo/branco/vermelho, foco em teal com anel de 3px, tabelas com cabeçalho fixo,
zebra sutil e destaque no hover, sombras quase imperceptíveis, rolagem fina de 9px.

### Configuração do PDV

`repeat(auto-fit, ...)` fazia um item sozinho ocupar a coluna inteira e esticar a
miniatura. Trocado por `auto-fill` com `aspect-ratio`, e as colunas ganharam largura
mínima de 320px para não espremer.

### Pendente

Menu lateral agrupado e recolhível, barra superior com busca global e trilha, dashboard
como central de controle, e a varredura tela a tela.

## Estoque Total mais enxuto (V13.1.0)

A barra de três cartões abaixo dos filtros saiu inteira. O valor do filtro subiu para a
fileira de números do topo, ao lado do valor total do estoque, com destaque em teal e a
contagem "x de y itens" embaixo. Ele **só aparece quando há filtro** — sem filtro seria
o mesmo número duas vezes.

Os outros dois cartões ("Valor total do estoque" e "O filtro representa") foram
removidos: o primeiro repetia o do topo, o segundo era informação que ninguém usava.

A tabela também ganhou a classe `semBusca`: ela já tem busca e ordenação próprias, e
estava recebendo a busca automática por cima, duplicando o campo.

## A ficha que "sumiu" (V13.2.0)

Conferido no banco: **as 12 fichas estão lá**, inclusive a "BELGA GELATO" com os 2 itens.
Nada foi perdido. O que aconteceu foi pior de diagnosticar: ela ficou com
`grupo_id = null` e a tela de ficha técnica **só desenha por grupo** — então ela existia
e não aparecia em lugar nenhum.

Causa: no envio, `fk('fichaCats', categoriaId)` não resolveu o vínculo e gravou `null`
em silêncio. Com o envio incremental, a impressão do registro foi dada como boa e ele
nunca mais foi reenviado — o `null` virou permanente.

Duas correções estruturais:

- **Nenhum registro pode ficar invisível.** A árvore ganhou a pasta **Sem grupo**, com
  contagem em âmbar, que aparece só quando existe ficha órfã. O que estiver lá pode ser
  visto, aberto e corrigido
- **Vínculo que não resolve não passa batido.** `fk()` anota a falha, o log da nuvem
  registra qual vínculo faltou, e a impressão do registro **não é gravada** — ele volta
  a subir na próxima sincronização, quando o vínculo já existir

## Por que a ficha "mudava de lugar" (V13.3.0)

Rafael foi preciso: ela **estava no lugar certo** e se perdeu ao atualizar. O mecanismo:

1. O vínculo com o grupo subiu vazio por uma falha momentânea de resolução
2. O download seguinte trouxe esse vazio e **apagou o grupo correto que ainda estava
   no aparelho** — o dado bom foi destruído pelo dado ruim

**Terceira rede de proteção:** no download, **vínculo cheio ganha de vínculo vazio**.
Se a nuvem traz um vínculo em branco e o registro local tem um, o local é mantido e o
sistema agenda o reenvio para corrigir a nuvem. Se a nuvem traz um vínculo **diferente**,
ela manda — a troca feita em outro aparelho continua valendo.

Vale para 13 campos de ligação: categoria, subgrupo, grupo, conta, destino, fornecedor,
forma de pagamento, conta destino, cliente, entregador, origem, caixa e motivo.

## Paleta creme, verde, dourado e azul (V14.0.0)

Só as cores mudaram — estrutura, telas e funções ficaram idênticas. **Quatro cores,
quatro trabalhos, e ninguém usa cor por decoração:**

| Cor | Token | Trabalho |
|---|---|---|
| Verde profundo `#1E4634` | `--deep` | identidade e navegação (barras do sistema) |
| Dourado `#8A6A32` | `--acc-d` | a ação principal |
| Azul petróleo `#1C6E97` | `--blue` | o que se clica e o que informa |
| Terracota `#9A4A3C` | `--red` | o que exige atenção |

Fundo creme `#FAF6EF` na área de trabalho, branco no conteúdo, bordas `#EAE4D9`.

- O rodapé virou verde, fechando a tela como aplicativo em vez de página que rola
- A faixa de módulos ficou branca, sem degradê
- Azul entrou onde faltava cor com função: link, linha sob o mouse, linha selecionada,
  ícone de aviso informativo

A quinta cor é o limite: se aparecer uma sexta sem trabalho definido, a regra quebra.

## "Evitou apagar 18 de 24 de cardapio_config" (V14.0.1)

A trava funcionou, mas o motivo era um defeito: `DB.cardapioL` é um **espelho derivado**
de `DB.cardapio`, gerado no envio com id `cc_<sucursal>`. O download sobrescrevia esse
espelho com as **linhas cruas da nuvem**, cujo id é o uuid do banco. No envio seguinte,
nenhum id batia e o sistema concluía que tudo tinha sido excluído.

- O download **não toca mais** no espelho — ele é derivado, não vem da nuvem
- Regra geral em `apagarRemovidos`: **zero identificadores em comum entre o antes e o
  agora é troca de formato, não exclusão**. A lista nova é adotada sem apagar nada
- `arrumarEspelhoCardapio()` zera uma vez a marca antiga, que estava com os dois
  formatos misturados

## O Mapa do Sistema mentia (V14.1.0)

Rafael abriu Usuários e Permissões e a tela estava lá — mas o Mapa marcava como
pendente. O mapa lia de `AFAZER`, uma **lista escrita à mão** que envelhece toda vez que
uma tela é construída e ninguém lembra de tirar da lista.

`telaPronta(mid,iid)` agora **pergunta ao roteador**: lê o código de `abrir()` e monta a
relação de telas que ele sabe abrir. Se o roteador atende, está pronta — a lista à mão
vira só o texto explicativo do que ainda falta. O mapa não pode mais mentir.

Duas entradas saíram da lista por já existirem: **Usuários e Permissões** e
**Canais de Venda e Integração**. Restam **7 pendentes**.

## Nova tela de acesso e grupos com editar/excluir visíveis (V15.0.0)

- Tela de acesso trocada pelo arquivo `Nexor_Login.html`. As três imagens viraram
  arquivos (`nexor-logo-h.png` e `nexor-marca-lado.png`), o estilo foi preso a `#login`
  e as variáveis ganharam prefixo `lg-`. Os identificadores dos campos continuam os do
  sistema, então `entrar()` não mudou
- O campo **Cliente** virou digitação, não lista fixa: o sistema compara com a rede
  cadastrada na loja, e uma lista com opções fixas travaria o acesso de outras redes
- Restos da tela anterior (marcação e estilo, nas duas folhas) foram removidos
- Na ficha técnica, **editar e excluir grupo já existiam, mas só apareciam ao passar o
  mouse** — ninguém encontrava. Agora ficam visíveis, com opacidade reduzida, e cheios
  ao passar o mouse ou no grupo ativo

## O aviso da leitura da nuvem passou a dizer onde parou (V15.1.0)

O aviso de download interrompido era genérico — "tente de novo quando a internet
estabilizar" — e não dava como diagnosticar nada. Agora:

- `api()` carrega no erro **a tabela** e o status, e distingue **queda de rede**
  (o `fetch` falha) de **erro do banco** (resposta com status ruim)
- Queda de rede: **tenta de novo sozinho** depois de 900ms antes de reclamar, e o texto
  fala de internet
- Erro do banco: o aviso nomeia a tabela e repete a mensagem exata do banco, e pede que
  seja enviada — é ela que resolve em minutos. Não há repetição automática, porque erro
  de dado não melhora tentando de novo

## Categoria financeira separada por tipo (V16.0.0)

Categoria de receita e de despesa não se misturam mais.

- Coluna `tipo` em `categorias_financeiras`; categorias antigas entram como **despesa**
  e não somem
- A tela virou **duas colunas** — Receita em verde, Despesa — cada uma com o seu botão
  "Cadastrar receita" / "Cadastrar despesa". O tipo é fixo depois de criado
- O lançamento **só oferece as categorias do tipo que está sendo lançado**, e trocar
  receita/despesa descarta a categoria escolhida se ela for do outro lado
- Compras sem Vínculo ganhou largura máxima e centralização — estava colado na borda

### Ainda pendente deste pedido

- Relatório de entradas (só existe o de despesas)
- Melhoria visual do cadastro de contas de banco

## Contas bancárias: lista e cadastro (V16.1.0)

**A lista** era um cartão grande por conta, com botões escritos. Com três contas já
rolava a tela. Virou **uma lista**: selo do banco, nome com agência e conta embaixo,
saldo à direita, ações como ícone. Rodapé com contagem e total. Os cartões de indicador
saíram do meio da tela — o saldo total subiu para o cabeçalho.

**O cadastro** tinha uma grade de 14 botões grandes de banco que ocupava mais espaço que
o formulário inteiro. Virou **pastilha**, com os 5 mais usados à mostra e "+ 9 bancos"
sob demanda. Se a conta editada usa um banco fora dos 5, ele entra na frente.

Campos reordenados: **Nome e Saldo inicial** na primeira linha (o saldo estava espremido
entre agência e conta, sendo o campo que mais importa), agência e conta na segunda, como
opcionais. A explicação do saldo virou caixa de informação azul.

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

## Chave do robô: fechada dos dois lados (V17.3.0)

O robô do WhatsApp estava **aberto**. A exigência de chave dependia da variável
`EXIGIR_CHAVE=sim` no Render, que nunca foi ligada — então `protege` deixava tudo
passar. Quem descobrisse o endereço do Render conseguia mandar mensagem pelo WhatsApp
das lojas e derrubar as conexões. E a chave que o sistema enviava (`NexorZap2026`)
estava escrita dentro do `index.html`, num repositório público.

**No robô (`server.js`):**

- A chave passou a ser exigida **sempre que existir chave configurada**. Só fica aberto
  quem não configurou nenhuma — e agora isso aparece no log da inicialização
- `CORS` deixou de aceitar qualquer origem: só os domínios do Nexor e `localhost`
- `/diagnostico`, `/envios` e `/testeia` estavam **sem proteção**. `/diagnostico`
  mostrava os números conectados e os nomes das variáveis de ambiente; `/envios` listava
  telefones de clientes. Os três passaram por `protege`, e a lista de variáveis saiu
  da resposta
- Freio de **20 envios por minuto por loja**, porque o WhatsApp bane número que dispara
  em rajada

**No sistema (`index.html`):**

- `ZAP_KEY` saiu do código. A chave é digitada **uma vez por aparelho** e guardada
  em `localStorage` — não sobe para a nuvem e não viaja com o sistema. Cada computador
  que for comandar o robô precisa digitar
- Campo novo em Robô do WhatsApp › Conexão, com guardar e apagar
- `zapApi()` agora distingue **falta de chave**, **chave recusada** (401) e
  **limite de envio** (429), cada um com o seu recado
- `desconectarZap()` e `desconectarZapPdv()` eram as duas únicas chamadas sem
  `try/catch` — passariam a quebrar sozinhas agora que a função pode recusar

**O que continua valendo:** o Nexor roda no navegador, então a chave é visível para
quem já está logado e abre as ferramentas do navegador. Isso protege contra quem está
de fora, não contra quem já tem acesso ao sistema. A proteção completa exige passar as
chamadas por uma função no Supabase — fica para depois.

## Próxima obra: ligar o login no Supabase Auth (mapa levantado em 07/08)

Levantamento feito direto no banco. Corrige duas crenças antigas que estavam erradas:

- **O RLS não está desligado.** Está ligado nas 61 tabelas, e a arquitetura certa **já existe**:
  tabela `perfis` ligada a `auth.uid()`, e as funções `minha_loja()`, `minha_empresa()` e
  `sou_admin()`. 29 tabelas usam a regra
  `loja_id = minha_loja() OR (sou_admin() AND loja da minha empresa)`
- **A chave do Supabase no `index.html` não é vazamento.** É a `publishable`, pública por
  desenho. O que a torna inofensiva é o RLS — que está lá

**O que falta é a ligação.** O sistema ainda faz login comparando senha em texto puro na
tabela `usuarios`. Como ninguém entra pelo Auth, `auth.uid()` fica vazio e as regras das
29 tabelas não têm em quem se apoiar.

### Buracos concretos

| Tabela | Aberto para | Gravidade |
|---|---|---|
| `whatsapp_config` | leitura e escrita por qualquer um | alta |
| `whatsapp_mensagens` | leitura e escrita — 70 conversas de cliente | **alta** |
| `whatsapp_sessoes` | leitura e escrita | alta |
| `pedidos`, `app_usuarios` | leitura | média |
| `produtos`, `categorias`, `areas_entrega`, `areas_zonas`, `formas_pagamento`, `grupos_opcoes`, `opcoes`, `sucursais` | leitura | proposital — o cardápio digital lê sem login |

As três do WhatsApp não precisam de acesso pelo navegador: quem escreve nelas é o robô,
pelo servidor. Fechar é seguro.

### Ordem

1. Criar o usuário do Rafael no Supabase Auth + linha em `perfis` com `cargo='admin'`
2. Trocar `entrar()` para autenticar no Auth; `api()` passa a levar o token da sessão
3. Fechar `whatsapp_config`, `whatsapp_mensagens`, `whatsapp_sessoes`
4. Tirar `pedidos` e `app_usuarios` da leitura pública
5. Criação de usuário por Edge Function (a chave de administrador **não pode** ir para o
   navegador — senão qualquer cliente vira admin de todas as redes)
6. Chave do robô por cliente, guardada no servidor, via Edge Function. Remover o campo de
   digitar chave criado na V17.3.0

### O que NÃO se perde

Insumos (326), fichas (12 + 4.391 itens), fornecedores (53), sucursais (6) e toda a
configuração continuam. Só os 7 usuários são recriados — começando pelo do Rafael, e os
demais pela própria tela depois.

### Risco a vigiar

Se o token não for junto nas chamadas, as telas abrem **vazias**. Não é perda de dado, é
o banco recusando. Testar tela por tela depois do passo 2, antes de seguir.

## Vazamento entre redes: cinco tabelas fechadas (07/08)

O levantamento da véspera apontou três tabelas do WhatsApp abertas ao público. Conferindo
política por política no `pg_policies`, apareceram **outras cinco**, de gravidade maior,
que ninguém tinha visto: `usuarios_sistema`, `app_usuarios`, `pedidos_online`,
`whatsapp_gestores` e `whatsapp_pendentes` estavam com `ALL / true` para **authenticated**.

Não é acesso público — é pior no contexto de um sistema vendido a várias redes: qualquer
cliente logado enxergava os dados de **todos os outros clientes**. Em `usuarios_sistema`
isso inclui login e senha em texto puro de toda a base.

- Função nova `minha_rede(loja_id)`, para as políticas não repetirem a expressão
- As cinco passaram a valer a mesma regra das outras 29
- `whatsapp_pendentes` não tem `loja_id` e guarda a sucursal como texto — pode ser o uuid
  do banco ou o código local (`suc_sfs`), então a política aceita os dois caminhos
- Conferido nos dois sentidos: o usuário do Rafael continua vendo 7 usuários, 326 insumos
  e 9 pedidos online; um usuário de outra rede vê zero

### O que ficou aberto de propósito

`app_usuarios` (leitura pública) e `pedidos` (política "app le pedidos") **alimentam o
aplicativo do franqueado**, em `rafaeluendes-jpg.github.io/nexor-app/`, que entra sem
sessão. Tirar derruba o aplicativo. O certo não é tirar: é trocar por função no banco que
devolva a linha só quando a senha bate — como já faz a `login_nexor`. Fica para quando o
repositório do `nexor-app` for mexido.

## Correções ao mapa da obra do Auth (07/08)

- **O passo 1 já estava feito.** `rafael@nexor.app` existe no Auth desde 28/07, com perfil,
  loja e empresa. O cargo é `plataforma`, não `admin` — e `sou_admin()` só aceita `'admin'`.
  Com uma loja só não atrapalha, porque `minha_loja()` resolve; na segunda rede o ramo de
  admin nunca dispararia
- **`login_nexor` está aberta ao anônimo.** É um endereço público que confere senha em
  texto puro, sem freio, e devolve `loja_id`, permissões, `tudo` e `mestre` quando acerta.
  Com senha de 3 caracteres é questão de minutos. Some no passo 2, junto com a tabela
- **O passo 2 esbarra nas senhas.** Os 7 usuários têm senha de 3 caracteres; o Auth exige 6.
  E o login `franqueador` não é e-mail, que o Auth exige. Os outros 6 já são
- **O robô não está conectado.** `whatsapp_sessoes` vazia e nada em `whatsapp_mensagens`
  desde 02/08 — fechar as três do WhatsApp não interrompe operação nenhuma

## Uma entrada só: o login virou Supabase Auth (V17.4.0)

Eram duas entradas — a do sistema (senha em texto puro em `usuarios_sistema`) e a da
nuvem (ícone de nuvem › Banco de dados). Como ninguém entrava pelo Auth, `auth.uid()`
ficava vazio e as regras de RLS das 29 tabelas não tinham em quem se apoiar: estavam
escritas e não valiam nada. Agora **quem entra no sistema entra na nuvem**.

### No banco

- As **7 contas criadas no Auth**, com e-mail confirmado e identidade. O login
  `franqueador` não era e-mail, que o Auth exige — virou `franqueador@jologelato.com`
- Uma linha em `perfis` para cada: os dois `mestre` como `admin`, as 5 unidades como
  `gerente`. `rafael@nexor.app` continua como `plataforma`, com a senha antiga — é a
  conta de conexão, separada das de pessoas
- **`login_nexor` removida.** Era executável pelo anônimo e conferia senha em texto
  puro sem freio nenhum. Conferido no repositório `nexor-app`: ninguém mais a chama

### No sistema

- `entrarPeloAuth()` distingue **senha recusada** de **internet caída**. A diferença é
  o que impede uma recusa do servidor de virar entrada pela conferência local
- Sem internet, a entrada **cai para o cadastro do aparelho** e abre em modo local, com
  o aviso vermelho do rodapé. Uma loja não pode parar de vender porque o wifi caiu
- `abrirSessao()` não religa a nuvem quando a entrada já ligou — só busca o que mudou
- `sair()` encerra também a sessão do Auth; deixá-la de pé manteria o token válido
- A senha `'123'` embutida do administrador mestre **saiu do `baseUsr()`**. Era a mesma
  em toda instalação do Nexor: porta destrancada em todo cliente futuro

### Consequência que ficou registrada na tela

Criar usuário em Usuários e Permissões **não cria a conta no Auth** — a chave de
administrador não pode ir para o navegador, senão qualquer cliente vira admin de todas
as redes. Até a Edge Function existir, a tela avisa em caixa âmbar que a conta precisa
ser criada no banco, e o login passou a exigir formato de e-mail.

**O passo 5 deixou de ser opcional:** sem ele, ninguém cadastra usuário novo sozinho.

### Ainda aberto

O `nexor-app` lê `app_usuarios` inteira e **compara a senha dentro do navegador**, e puxa
`pedidos` com limite de 20 mil linhas, sem sessão. São as duas últimas políticas públicas.
Fecham quando aquele repositório for mexido — troca por função no banco, como era a
`login_nexor`.

### Testado e funcionando (07/08, 12:02 → 12:10)

Entrada confirmada pelas duas contas, com o banco registrando `last_sign_in_at`:
`rafael@uendes.com` às 12:02 e `franqueador@jologelato.com` às 12:10. Estoque Total
(R$ 19.632,63 em 337 itens), Ficha Técnica, Lançamentos, PDV e Usuários abriram cheias —
é o que prova que o token está indo junto e o RLS reconheceu `auth.uid()`. Na sessão do
franqueador o menu **Administração não aparece**: a diferença de cargo funcionando.

### Três coisas que o teste levantou

**1. `clientes_nexor` recusava o envio.** É a tabela do contrato — plano, módulos, situação
da rede — e a regra dela exige `sou_plataforma()`. A regra está certa: num sistema vendido,
o cliente não pode gravar o próprio contrato, senão se dá o plano que quiser. Faltava o
Rafael ser reconhecido como dono da plataforma. `rafael@uendes.com` passou a `plataforma`,
e `sou_admin()` foi ampliada para `cargo in ('admin','plataforma')` — senão trocar o cargo
tiraria dele o ramo de admin das 29 tabelas.

**2. Mexer por SQL em tabela espelhada não gruda.** Eu troquei `franqueador` para
`franqueador@jologelato.com` direto no banco; o aparelho subiu a cópia local por cima e
desfez. Resultado: a conta do Auth existia com um nome e o cadastro do sistema com outro,
e ninguém entrava por aquele acesso. **A correção tem de ser feita pela tela**, que é quem
manda em `usuarios_sistema`. É também o motivo de o passo 5 (Edge Function) não ter
alternativa: não há como criar usuário por fora sem a sincronização desfazer.

**3. "Sem grupo 1" na Ficha Técnica não era falha do Auth.** É ficha duplicada:
**BELGA GELATO código 84** sem grupo e **Belga Gelato código 85** dentro de Produzido. A
pasta âmbar da V13.2.0 fazendo o trabalho dela — mostrando o que ficaria invisível.

### Gordura que sobrou

O cadastro ainda guarda a senha em texto puro, e ela sobe para `usuarios_sistema`. Depois
do Auth isso é **sobra**: só serve para a conferência local quando a internet cai. O certo
é guardar uma marca no aparelho, que não viaja para a nuvem. Fica para depois do `nexor-app`.

## O aplicativo do franqueado fala só por função (V17.5.0)

Eram as duas últimas portas abertas, e as piores que restavam:

- `app_usuarios` com leitura pública — o aplicativo **baixava a tabela inteira e comparava
  a senha dentro do navegador**. Qualquer pessoa com o endereço lia nome, login e senha em
  texto puro de todos os acessos de todas as redes
- `pedidos` com leitura pública, até 20 mil linhas, sem login nenhum

**Achado no caminho:** a consulta de pedidos do aplicativo filtrava por uma coluna `data`
que **não existe** na tabela — o nome certo é `data_venda`. Ela vinha falhando em silêncio,
então os números do franqueado nunca carregaram. Corrigido junto.

### No banco

- `senha_hash` em `app_usuarios`, cifrada com bcrypt. A coluna `senha` foi esvaziada
- `app_sessoes`: token de 64 caracteres, validade de 30 dias. RLS ligada **sem política
  nenhuma**, de propósito — só as funções abaixo entram lá
- `app_entrar(login,senha)` devolve token e perfil, **nunca a senha**. Freio de 5 tentativas
  e 15 minutos de bloqueio, com meio segundo de espera em cada erro para travar varredura.
  Durante o bloqueio nem a senha certa passa
- `app_dados(token,dias)` devolve lojas, produtos e pedidos **já filtrados pelas sucursais
  daquele acesso** — antes o franqueado de Jales lia os pedidos de São Paulo
- `app_definir_senha(login,senha)` cifra dentro do banco, e só aceita acesso da própria rede
- As políticas `login publico` e `app le pedidos` foram removidas

### No aplicativo

Zero consultas diretas a tabela: são só chamadas de função. A senha **deixou de ser
guardada no aparelho** — fica só o token, que vence e pode ser cortado pelo banco.

## Criação de acesso por Edge Function (V17.5.0)

`criar-usuario`, no servidor. É a única coisa que tem a chave de administrador — ela não
pode ir para o navegador, senão qualquer cliente vira admin de todas as redes.

- Confere a sessão de quem chamou com `getUser()`, e lê o perfil **com a sessão dele**,
  então o RLS continua valendo
- Só `admin` e `plataforma` criam. Gerente recebe recusa
- **A loja é sempre a de quem chamou**, nunca a que vem no pedido — senão um admin criaria
  usuário dentro da rede do vizinho
- E-mail válido e senha de 6+ obrigatórios. Se o e-mail já existir em outra rede, recusa
- `verify_jwt` desligado de propósito: com ele ligado, a vistoria do navegador (OPTIONS),
  que vai sem cabeçalho, seria recusada antes de chegar na função. O rigor está no `getUser()`

Testada nos quatro caminhos: sem sessão recusa, gerente recusa, admin cria, senha curta
recusa. A tela de Usuários e Permissões perdeu o aviso âmbar — agora a conta nasce ao salvar.

### O que sobrou aberto ao anônimo

Só o que o cardápio digital precisa ler sem login: `produtos`, `categorias`,
`areas_entrega`, `areas_zonas`, `formas_pagamento`, `grupos_opcoes`, `opcoes`, `sucursais`
e `cardapio_config`. Mais as três do WhatsApp, que esperam saber qual chave o robô usa
no Render.

`sucursais` merece uma volta depois: ela expõe CNPJ, endereço e telefone de todas as redes,
e o cardápio precisa de bem menos que isso.

## As três do WhatsApp, fechadas (V17.5.1)

Estavam abertas há meses porque o **robô usava a chave pública do banco** — sem as
políticas `ALL/true`, ele não conseguiria gravar. Fechar antes de resolver isso teria
derrubado o robô no meio do expediente.

Descoberto ao olhar o Render: a variável se chama `CHAVE_BANCO`, que **não está na lista
de nomes que o `server.js` procura**. Funcionava só porque o robô acha a chave **pelo
formato** (`acharPorConteudo`), com uma regra que reconhecia `sb_publishable_` ou `eyJ` —
e por isso nunca reconheceria uma chave secreta.

**No robô:** a chave secreta passou a ter preferência (`sb_secret_`, ou um JWT cujo corpo
diga `service_role`). O log da inicialização agora diz qual está em uso, e reclama quando
for a pública. Rafael trocou o valor de `CHAVE_BANCO` no Render; o log confirmou
`chave do banco: SECRETA (correta)`.

**No banco:**

- `whatsapp_mensagens` e `whatsapp_config` passaram a valer pela sucursal, que chega na
  loja — nenhuma das duas tem `loja_id` próprio, e a sucursal é texto, então as políticas
  aceitam tanto o uuid quanto o código local
- `whatsapp_sessoes` ficou **com RLS ligada e nenhuma política**. Ela guarda a credencial
  da conexão do WhatsApp e o navegador não tem o que fazer ali — só o robô, pelo servidor,
  com a chave secreta que passa por cima do RLS

Conferido nos dois sentidos: o anônimo recebe lista vazia e é recusado ao escrever; a
sessão do Rafael continua vendo as 70 mensagens e as 5 configurações.

### Chaves queimadas nesta série de sessões

Tudo que passou por conversa ou por repositório público deve ser considerado exposto:
`NexorZap2026` (já trocada), a chave publishable do Supabase (é pública por desenho, sem
problema), o token do GitHub `[token do GitHub — removido deste arquivo]`, a `CHAVE_API` do robô e a `GROQ_KEY`. As três
últimas continuam pendentes de troca.

## O robô reconhece a sessão, não uma chave digitada (V17.6.0)

Rafael cortou certo: **um sistema vendido a várias redes não pode depender de alguém
distribuir senha para cada loja de cada cliente.** O campo de digitar chave da V17.3.0 foi
um remendo de quando o robô estava aberto e ainda não havia login de verdade. Hoje há —
cada pessoa tem sessão no Auth e o sistema já carrega um token em toda chamada.

Era o passo 6 do mapa, e ele chegou antes do previsto porque o passo 2 o destravou.

**No robô:** `autorizado()` tem duas portas. Primeiro o cabeçalho `Authorization: Bearer`
— o robô pergunta ao Supabase de quem é o token e lê `perfis`, com cache de 60 segundos
para não consultar a cada clique. A chave fixa continua como segunda porta, para chamada
de máquina (script, agendador) que não tem sessão de gente.

**Ganho que a chave nunca deu:** `daMinhaLoja` entrou em `/conectar`, `/estado`,
`/desconectar` e `/enviar`. Antes, quem tivesse a chave comandava **qualquer** loja de
**qualquer** rede — era uma só para todo mundo. Agora o gerente de Jales não desconecta o
WhatsApp de São Paulo. Quem entra pela chave fixa não tem perfil e passa reto: já foi
autenticado pela chave.

**No sistema:** `zapApi()` manda o token da sessão. Sem nuvem, ainda aceita a chave fixa,
se houver. O bloco "Chave de acesso ao robô" saiu da tela de Conexão e virou um aviso do
estado da autorização — não há mais nada a configurar por aparelho.

**Consequência prática:** cliente novo não recebe chave nenhuma. Entra no sistema e o robô
já obedece.

## Assistente Nexor — canal e lançamento (parte 1 de 2)

Duas coisas diferentes que eu tinha confundido numa resposta: a **atendente (Carla)** é um
número por loja, no celular da sorveteria, por QR/Baileys. A **Assistente Nexor** é **um
número só para toda a plataforma**, atendendo todas as redes vendidas — e por isso vai pela
Cloud API da Meta. Baileys não serve ali: é uso não oficial, e um número disparando cobrança
para dezenas de gestores é o perfil que o WhatsApp bane.

### A decisão que estruturou tudo

**O robô não calcula estoque.** No Nexor o estoque é um número guardado no insumo, somado
por `aplicarMovimento()` quando alguém lança pela tela — não há reconstrução a partir dos
movimentos. Se o robô também somasse, seriam duas contas em lugares diferentes, e é assim
que nasce divergência. Ele grava o lançamento **já confirmado** em `whatsapp_pendentes`, e
o sistema aplica pelo mesmo caminho de uma pessoa digitando.

O atraso que isso criaria não existe na prática: o PDV fica aberto o dia todo. Foi o que
dispensou reescrever o cálculo de estoque — o caminho de maior risco do sistema.

### `canal.js`

Esconde a diferença dos dois canais. Quem envia chama `enviarPara()` e não sabe por onde
saiu. Trata o **nono dígito** brasileiro, que faz mensagem sumir quando o número está
gravado no formato antigo. As rotas `/meta/webhook` já respondem à vistoria da Meta; sem
`META_TOKEN` e `META_PHONE_NUMBER_ID` a assistente cai no Baileys — o que permite testar
tudo antes de o número sair da aprovação.

### `lancamento.js`

Conversa de conferência item a item. Entende foto (modelo com visão) ou texto, casa cada
item com o cadastro de insumos, e **pergunta quando há dúvida** em vez de escolher sozinha.
Aceita correção escrita (_12 kg por 58,00_), permite pular item, e só grava depois do sim
no total. A IA só extrai — instrução explícita para nunca inventar valor, quantidade ou
fornecedor; o que não achar volta em branco e vira pergunta.

**A trilha:** a conversa inteira vai junto no campo `conversa`, com hora de cada fala. Se um
dia alguém disser que o sistema lançou errado, está registrado o que foi perguntado e o que
ele respondeu. `whatsapp_pendentes` ganhou política restritiva: **só a plataforma apaga** —
o franqueado não pode remover a própria confirmação.

Testado de ponta a ponta em simulação: desambiguação entre dois açúcares, correção de
quantidade e valor, total e gravação.

### Falta (parte 2)

- Caixa de entrada no sistema, que consome os pendentes e aplica
- PDF do relatório de checklist e envio a cada X dias

## Caixa de entrada da assistente (V18.0.0 — parte 2)

O que fecha o ciclo: o robô confirma e grava; **quem aplica é o sistema**.

`aplicarPendenteAssistente()` monta a nota de entrada com a mesma forma da tela, cria o
lançamento financeiro no mesmo formato, e chama **`aplicarMovimento()` — a mesma função
que a tela chama**. Era esse o ponto: uma conta só. O custo médio, o histórico de compra e
o preço da última compra saem todos pelo caminho de sempre.

**Decisões dentro dele:**

- O fornecedor é achado pelo nome ou **criado**, para a nota não nascer solta
- O lançamento entra **em aberto, sem banco e sem forma de pagamento**. Banco e forma
  pertencem ao pagamento (V10.1.0) — a assistente não decide de onde o dinheiro sai
- O item é procurado por `ref_local`, depois por id, depois por nome. Se não achar,
  **falha e diz qual item** em vez de lançar errado
- **Erro de dado não é repetido**: o pendente é marcado como `erro` e a fila segue. Senão
  um item defeituoso travaria todos os outros atrás dele
- O laço roda de 60 em 60 segundos, e **nunca com janela aberta ou aba em segundo plano** —
  aplicar uma nota no meio de um lançamento redesenharia a tela debaixo da mão da pessoa
- Ligado nos dois caminhos de entrada: quem faz login e quem volta com sessão guardada

**Na fila do banco** ficou um pendente de teste (`TESTE ASSISTENTE`, 100 copinhos por
R$ 100,00) para conferir de ponta a ponta na primeira abertura.

## Relatório do checklist em PDF (V18.1.0 — parte 3)

### A trilha era furada em dois pontos

Conferindo as políticas antes de construir, apareceram duas falhas que esvaziavam o
sentido do relatório:

- **A matriz da rede conseguia apagar.** A regra dizia `sou_admin()`, e essa função foi
  ampliada hoje. Mas a matriz é parte interessada no que o relatório mostra. Passou a ser
  `sou_plataforma()` — apagar é só do dono do Nexor
- **O franqueado podia reescrever uma resposta já dada.** A regra de UPDATE deixava alterar
  qualquer linha da loja dele: dava para trocar um "não" por "sim" no dia seguinte. Agora a
  regra exige `respondida_em is null`, e um **gatilho no banco** recusa a alteração mesmo
  para quem chegar por fora do RLS. Testado: a troca foi barrada

### `relatorio.js`

PDF escrito à mão, sem biblioteca. Uma tabela de texto não justifica arrastar 2 MB de
pacote para um serviço que roda sozinho, e menos dependência é menos coisa para quebrar.
Validado com um leitor de PDF de verdade: paginação, fontes e xref corretos.

- Uma seção por sucursal; quem não tem registro aparece como "sem registro", em vez de
  sumir. O que não casar com sucursal nenhuma cai em "Sem unidade identificada" — dado
  órfão não pode desaparecer do relatório
- Quem não respondeu aparece como **SEM RESPOSTA**, que é informação, não ausência
- Acento é trocado por equivalente sem acento: o PDF base usa WinAnsi e mostraria caractere
  quebrado num documento que vai para o franqueador
- Rodapé diz que o PDF é cópia e que o original está no Nexor, sem poder ser alterado

**O envio** roda de hora em hora e respeita a frequência de cada rede (`relatorio_freq`),
com **um relatório por rede, não por unidade**. Período vazio não gera envio. Rota
`/relatorio/:loja` dispara na hora, para conferir sem esperar o prazo.

**Limite conhecido:** o PDF vai pelo Baileys, que aceita o arquivo direto. A Cloud API da
Meta exige URL pública para documento — quando o número da Meta existir, o PDF precisará
subir para algum lugar antes. Fica anotado.

## A descoberta do fim do dia: o modelo de rede (07/08, a decidir)

Ao construir a tela de rotinas apareceram **seis rotinas idênticas**. Não eram cópias:
eram **seis lojas diferentes** no banco. Cinco delas estão completamente vazias — zero
usuários, zero sucursais, zero insumos, zero pedidos. Tudo vive na `Jolô Franqueadora`.

Não são lixo. **São o modelo certo, nunca preenchido.**

### O que o Rafael descreveu

Cada cliente é uma rede, com uma matriz. Loja única? Essa loja é a matriz. A matriz dá
permissão, enxerga as unidades, cadastra as rotinas — e **replica estoque e ficha técnica
para as filhas**. Cada unidade tem os dados dela; cliente novo nasce zerado.

**Replicar só faz sentido se cada unidade tiver a própria cópia.** Se fossem sucursais
dentro de uma loja, haveria uma lista só e não haveria o que replicar. Logo:
**uma `loja` por unidade, todas sob a mesma `empresa`, que é a rede.**

### Isso já está no banco

A regra das 29 tabelas é `loja_id = minha_loja() OR (sou_admin() AND loja da minha empresa)`.
É a frase do Rafael escrita em SQL: cada um vê a própria loja, e o admin da matriz vê todas
as lojas da empresa dele. Alguém pensou nisso e construiu — e depois o sistema seguiu por
outro caminho.

### O desvio, medido

| | Hoje no sistema | O modelo |
|---|---|---|
| Unidade | sucursal (**120 lugares** no código) | uma `loja` por unidade |
| Dados | uma lista de insumos para todas | cada unidade com a sua |
| Replicação | não faz sentido | a matriz empurra para as filhas |
| Separação entre franqueados | regra de tela | regra de banco, **já escrita** |

O seletor "LOJA" no topo troca de **sucursal**, não de loja.

### Ordem proposta

1. **Fechar o modelo no papel** antes de uma linha de código: o que é empresa, loja e
   sucursal, e se sucursal continua existindo (uma loja com dois pontos físicos) ou some
2. **A replicação da matriz para as filhas** — é o coração do produto
3. **Só então a tela de rotinas**, que fica trivial: vai listar lojas, não sucursais

**Aviso:** mexer nos 120 lugares é a maior obra do sistema até hoje. Se sair torta, quebra
estoque, financeiro e relatórios de uma vez. Não começar no cansaço.

### Correções já feitas nesta descoberta

- `assistente_rotinas` ganhou `sucursais jsonb` (vazio = todas)
- `assistente_conversas` ganhou `sucursal_id` — sem ele o relatório de checklist agrupava
  por um campo que guarda outra coisa, e sairia errado. Defeito meu, do mesmo dia
- Anotado: a tela de cadastro de rotinas **não existe**; as seis foram inseridas direto no
  banco. Sem ela não se cumpre a promessa de "rotina é cadastro, não código"

---

# 17/08/2026 — Nexor vira Joia; Pro assinado; contas fechadas

## O nome mudou: Nexor → Joia (V68 a V70)

**Joia** = "Jô" da Jolô + IA. Passou a ser o nome da empresa do Rafael e do produto.
Subtítulo da marca: *plataforma de gestão inteligente*. Grafia sem acento.
Em texto corrido, tratar como feminino: **a Joia**.

**Paleta oficial**, tirada da própria logo:

| Cor | Valor | Uso |
|---|---|---|
| Verde profundo | `#0F2016` | fundo da entrada, `--deep` |
| Dourado claro | `#ECC474` | título, brilho |
| Dourado médio | `#DDB467` | botão principal, `--acc-l` |
| Dourado escuro | `#AF7F38` | `--acc`, texto sobre fundo claro |

**Decisão de interface, tomada por mockup antes de codar:** entrada com fundo
verde escuro; telas de trabalho com **fundo claro e texto escuro**. O motivo é
prático — a entrada dura cinco segundos e é o momento da marca; a lista de
insumos é lida por horas, e fundo escuro com muito número cansa a vista.

**Arquivos de imagem:** `joia-icone.png` na raiz do repositório, recortado só o
monograma (sem o texto, que vira borrão em ícone de celular).

### O que NÃO mudou, e não pode mudar

Nomes internos permanecem com "nexor": `nexor_dados`, `nexor_sessao`,
`clientes_nexor`, `telaFinanceiroNexor`, `telaClientesNexor`, `clientesNexor`.
São chaves de armazenamento do navegador, nomes de tabela e de função. Trocar
apaga o que está salvo no aparelho de todo mundo.

O repositório continua se chamando `nexor`.

## O `pages.yml` estava quebrado havia dois dias (V70)

A publicação parou em 15/08 e ninguém notou — o site no ar era de dois dias
antes, e todo envio novo parecia funcionar.

**Causa:** o workflow tinha `cp CNAME _site/`. O arquivo CNAME foi removido do
repositório no dia 15 para destravar o domínio. Sem ele, o comando falha, a
etapa inteira para e **nada é publicado**. Falha silenciosa: o commit entra, o
Actions fica vermelho, mas o site continua servindo a versão velha.

**Correção:** arquivos opcionais agora são copiados só se existirem, e as
imagens entram por curinga (`cp *.png`), sem depender do nome da marca.

**Regra que fica:** conferir o Actions depois de publicar. Verde não é detalhe.

## Administração liberada por item para a franqueadora (V67)

O `MOD_PLATAFORMA=['tecnico']` bloqueava o módulo Administração inteiro,
passando por cima do `SO_PLATAFORMA`, que já fazia o controle item por item.
Marreta anulando bisturi.

`MOD_PLATAFORMA` virou lista vazia. O filtro fino voltou a valer.

| Item de Administração | rafael@uendes.com | jolo@franqueadora.com |
|---|---|---|
| Mensalidades das Unidades | sim | **sim** |
| Sincronização | sim | **sim** |
| Mapa do Sistema | sim | não |
| Empresas Clientes | sim | não |
| Diagnóstico do Sistema | sim | não |
| Backup e Restauração | sim | não |
| Layout do Menu | sim | não |
| Reinício de Dados | sim | não |

"Financeiro da Nexor" virou **"Mensalidades das Unidades"** — o módulo trabalha
por unidade, com mensalidade e marcação de pago mês a mês. Serve direto para a
franqueadora cobrar as seis unidades.

## Domínio: joiagest.com.br

Registrado em 17/08/2026, válido até 17/08/2027. **Sem acento** (a versão com
til estava disponível, mas domínio acentuado dá atrito em teclado de celular e
vira punycode em configuração).

| Ponta | Estado |
|---|---|
| Registro.br | servidores `gloria` e `jasper` da Cloudflare |
| Cloudflare | dois CNAME → `rafaeluendes-jpg.github.io`, ambos **Somente DNS** |
| GitHub Pages | arquivo `CNAME` + Custom domain |

**Nuvem cinza, sempre.** Se ligar o proxy (nuvem laranja), o certificado do
GitHub conflita e o site quebra.

`nexorapp.com.br` continua registrado. Não apagar enquanto o novo não estiver
firme.

### Armadilha que consumiu horas, duas vezes

Quando o Custom domain está configurado e o domínio ainda não resolve, o GitHub
**redireciona o `github.io` para o domínio novo** — e os dois caminhos fecham ao
mesmo tempo. O Chrome guarda esse redirecionamento com teimosia.

Sintoma: você clica no link do `github.io` e cai no domínio novo dando 404.

Contorno: **janela anônima**. Limpeza definitiva em `chrome://net-internals/#hsts`,
apagando as políticas dos dois domínios.

## Supabase Pro assinado

Organização `jcnmdlvzyqtuixtnsjqm`, plano `pro`. Projeto renomeado para
**"Joia Gestão Inteligente"** (id segue `cevghkndzpzvnzwifhnm`).

Custo ~US$ 35/mês: US$ 25 da assinatura + ~US$ 10 do segundo projeto ativo
(`rafaellos-gestao`). Projeto pausado não gera custo — `assistente-pessoal` e
`gerente-financeiro` seguem pausados de propósito.

**O que se compra com isso:** backup diário automático e fim da pausa por
inatividade. Não é capacidade — o banco usa 71 MB de 8 GB.

Cobrança **só por cartão de crédito**, não tem Pix. Se o cartão falhar, a conta
volta para o gratuito e **o backup some**. Manter cartão válido é parte da
segurança do dado.

**Região:** `us-east-2` (Ohio), enquanto o `rafaellos-gestao` está em São Paulo.
Adiciona latência em cada consulta feita do Brasil. Não vale mexer hoje — mudar
região é migrar o banco. Reavaliar na obra de estrutura.

## Contas fechadas (as quatro portas)

| Conta | O que foi feito |
|---|---|
| GitHub | dois tokens revogados (`Nexor` e `nexor-claude`); 2FA por SMS |
| Google | verificação em duas etapas **ativada** |
| Cloudflare | entra pela conta Google — protegida por consequência |
| Supabase | 2FA por aplicativo ("Google Motorola") |

**Descoberta importante:** a conta Google (`usacademyadm@gmail.com`) é a
chave-mestra. Cloudflare entra por ela. Proteger o Gmail foi o passo de maior
retorno do dia.

**Pendências desta frente:**
- Supabase 2FA tem **um único aparelho** cadastrado. Perder o celular = perder a
  conta em definitivo, sem código de recuperação. Cadastrar um segundo aparelho
  antes de a Jolô operar
- GitHub está em SMS, que é vulnerável a clonagem de chip. Migrar para
  aplicativo autenticador quando der
- Guardar os códigos de recuperação do Google e do GitHub junto do zip do sistema

## Proteção contra senha vazada: ativada

Supabase → Authentication → Sign In / Providers → Email →
*Prevent use of leaked passwords*.

Confere senha nova contra a base do HaveIBeenPwned. **Não é bloqueio por
tentativa** — age só no momento de escolher ou trocar senha. Senhas que já
existem não são afetadas.

Também disponíveis na mesma tela, ainda desligadas: *Secure password change* e
*Require current password when updating*. Valem para o cenário de balcão, com
aparelho compartilhado e sessão aberta.

---

# A obra que falta: login por Supabase Auth

O plano técnico está na seção **"Próxima obra: ligar o login no Supabase Auth"**,
mais acima. Continua válido. O que segue é o que se somou a ele em 17/08.

## Por que continua sendo a peça central

As 66 tabelas têm RLS ligado e políticas escritas. Mas `auth.uid()` é sempre
nulo, porque o login compara senha em texto do lado do navegador. As políticas
existem e não têm em quem se apoiar.

**Nenhuma configuração de painel resolve isso.** É código.

## Bloqueio por tentativa — desenho aprovado pelo Rafael

Pedido: errar a senha bloqueia o acesso; só a franqueadora desbloqueia; se a
própria franqueadora perder a senha, recupera por e-mail.

**A trava tem que ficar no banco, não no navegador.** Se a contagem viver no
código do lado do usuário, quem quiser atacar chama o banco direto e ignora a
trava. É o mesmo erro de `trava` que o Rafael já apontou em outras ocasiões:
guarda no navegador não é proteção, é decoração.

Modelo a seguir: os campos `falhas` e `bloqueado_ate` que já existem no
aplicativo do franqueado.

**Número de tentativas:** o Rafael pediu três. Registrado que a recomendação é
**cinco, com desbloqueio automático em 15 minutos** — três gera chamado toda
semana (dedo molhado, teclado de tablet, Caps Lock) e protege igual, já que um
ataque real precisa de milhares de tentativas. Decisão final do Rafael.

**Recuperação por e-mail** depende do Supabase Auth funcionando. Não dá para
fazer antes — é a mesma obra.

## Escopo completo da obra

1. Migrar `entrar()` para o Supabase Auth; `api()` passa a levar o token
2. Migrar os usuários existentes sem ninguém perder acesso
3. Bloqueio por tentativa no banco (`falhas` / `bloqueado_ate`)
4. Tela de desbloqueio para a franqueadora
5. Recuperação de senha por e-mail
6. **Limpar os usuários de teste** do Auth: `admin@teste.local`,
   `gestor.a@teste.local`, `gestor.b@teste.local`, `p20a@teste.com`,
   `p20b@teste.com`. Conta de teste com senha fraca em produção é porta aberta
7. Rever `exportar_schema()`, hoje chamável sem login — devolve a estrutura do
   banco. Não expõe dado de cliente, mas entrega o mapa da casa. Conferir antes
   se o Diagnóstico depende dela

## Condições para fazer

Esta é a **única obra que, se quebrar, tranca todo mundo do lado de fora** —
inclusive o Rafael. Diferente de tudo que foi feito até aqui, onde o pior caso
era uma tela errada.

Exige: sessão dedicada, começar descansado, testar tela por tela depois do
passo 1, e caminho de volta pronto.

**Prazo:** antes da primeira venda real da Jolô. Hoje o risco é baixo porque não
há operação nem dado de cliente — o sistema está em pré-operação.

---

# Estado em 17/08/2026, fim do dia

Sistema **V70**, inteiro Joia, publicando normalmente.

**Aberto e à espera:**
- `joiagest.com.br` propagando. Quando abrir: Settings → Pages → **Check again**,
  e marcar **Enforce HTTPS**
- Pasta `Joia-Sistema Inteligente` e imagens `nexor-*.png` sobraram no
  repositório. Não atrapalham; limpar quando der
- Backup automático em segundo lugar e **importação a partir de arquivo** — o
  sistema exporta `.json` mas não sabe ler de volta. Se o Supabase sumisse, o
  arquivo seria inútil. É a peça que falta no plano de recuperação
- Instância do Rafaelo's: um `index.html` só, escolhendo banco e marca pelo
  endereço. Não duplicar arquivo — duplicar significa consertar dois

**Princípio reforçado hoje:** o `pages.yml` mostrou que falha silenciosa é a
pior espécie. Publicar e não conferir o verde do Actions custou dois dias.

---

# 18/08/2026 — V72: entrada corrigida e ícone do aplicativo refeito

## O cartão de entrada saiu de cima do letreiro

A foto de fundo (`joia-fundo.jpg`) tem o letreiro na **direita**. O cartão de
login estava caindo no meio da tela e cobrindo a marca.

Correção, no fim do bloco de estilo do `#login` (regra `@media(min-width:821px)`):
o `.shell` volta a ser **linha**, o `.stage` recebe `flex:0 0 min(56%,860px)`
e centraliza o cartão dentro dessa faixa. Resultado: o cartão fica no meio da
metade esquerda, na altura do meio, e a parede com o letreiro fica livre.

O cartão também cresceu: largura `min(100%,505px)` (era 470) e fontes,
campos e botão um degrau maiores.

**No celular nada muda.** A regra é presa a `min-width:821px`. Abaixo disso
continua valendo o que já existia: foto escurecida e cartão centralizado.

## O ícone do aplicativo agora é a marca nova

O `joia-icone.png` ainda era o **monograma J dourado sobre verde**, que é a
marca antiga. O certo é a marca do letreiro: **a oval com o sorvete e o nome
Joia embaixo**.

O ícone foi recortado do próprio `joia-fundo.jpg`, apagando o `2 0 2 1` e o
subtítulo "plataforma de gestão inteligente" — texto pequeno vira borrão em
ícone de celular. O apagamento reconstrói a parede interpolando as faixas de
cima e de baixo da área (interpolar na horizontal não serve: a fonte encostava
na oval e sujava o remendo).

Arquivos: `joia-icone.png` (512) e `joia-icone-192.png` (192, novo).
O `<link rel="icon" sizes="192x192">` ainda apontava para `nexor-icone-192.png`
e foi corrigido. O `manifest.json` passou a usar o arquivo de 192 no lugar certo.

**`sw.js` foi para `joia-v2`.** Sem trocar o número do cache, o celular que já
instalou continua mostrando o ícone velho para sempre.

## Duas pendências de arrumação do repositório

1. **`DECISOES .md` com espaço no nome** é o arquivo bom e completo.
   O `DECISOES.md` sem espaço é uma cópia velha (para no dia 1º). Renomear o
   bom para `DECISOES.md` e apagar a cópia, antes que uma sessão futura leia
   a errada.
2. **Pasta `Joia-Sistema Inteligente/`** guarda um `index.html` na V68 e um
   `joia-icone.png`. Não é servida por ninguém e só ocupa espaço e confunde.
   Pode apagar.

## V72.1 — a troca de domínio quebrou a criação de acessos

Ao salvar um acesso em `joiagest.com.br` aparecia **"Failed to fetch"**.

**Causa:** a lista de origens permitidas (CORS) fica escrita **dentro** da
Edge Function `criar-usuario`, não no painel do Supabase. Ela ainda listava
`rafaeluendes-jpg.github.io` e `nexorapp.com.br`. O navegador confere essa
lista **antes** de enviar o pedido — por isso o erro é "Failed to fetch" e não
uma resposta do servidor: a chamada nunca chegou lá.

**Correção:** `criar-usuario` foi para a versão 7 com `joiagest.com.br` e
`www.joiagest.com.br` na lista. Os endereços antigos foram mantidos.
Testado: domínio inventado continua barrado.

**Regra que fica:** *toda vez que o domínio mudar, a lista `ORIGENS` de cada
Edge Function muda junto.* Levantamento feito nesta data — das oito funções do
projeto, só a `criar-usuario` tinha lista fechada; as outras aceitam qualquer
origem. O `index.html` só chama `criar-usuario`.

**Segundo erro, logo depois:** *"Password is known to be weak and easy to
guess"*. Não é defeito — é a proteção de senha vazada do Supabase funcionando.
A senha escolhida está na lista pública de vazamentos.

Foi criada a função `traduzAuth()` no `index.html`: o Supabase Auth responde em
inglês e quem lê é o franqueado. Traduz senha vazada, senha curta, e-mail
repetido, e-mail inválido, credencial errada, excesso de tentativas, falha de
rede e sessão vencida. Mensagem fora da lista passa como veio — texto estranho
em inglês ainda é melhor que erro escondido.

---

# 18/08/2026 — V73: posição na rede deixou de ser permissão de tela

## O problema

Rafael quis esconder módulos da franqueadora (ex.: Administração é só do dono
da Joia). O caminho existia — tirar o "acesso total" e marcar tela por tela —
mas **quebrava outra coisa**: `ehFranqueadora()` e `ehMatriz()` eram definidas
pela marca `tudo`. Tirar o acesso total fazia a franqueadora **deixar de ser
matriz**: perdia a Liberação por Unidade, a lista de acessos das unidades e as
Bases e Valores.

**São duas coisas diferentes e estavam amarradas:**
*ser matriz* é POSIÇÃO na rede; *ver tudo* é PERMISSÃO de tela.

## O que mudou

**1. `ehFranqueadora()`** passa a olhar onde o acesso está na rede: sem unidade
nenhuma (= empresa inteira) ou unidade marcada como matriz. `tudo`/`mestre`
continuam valendo, para não mexer em quem já funciona.

**2. `ehMatriz()`** usa a mesma regra.

**3. `SO_PLATAFORMA` e `SO_FRANQUEADORA` viraram TRAVA, não passe-livre.**
Estavam **depois** do atalho `if(u.tudo)return true` — ou seja, a franqueadora,
por ter acesso total, **enxergava as telas do dono da Joia**. E eram
`return true`, então uma tela dessas aparecia mesmo com a marcação desligada.
Agora elas só barram quem não é do grupo; quem é segue o caminho normal e
**obedece à marcação**.

**4. `tirarAcessoTotal()` não derruba mais ninguém.** Um acesso total tem a
lista de marcações vazia — nunca precisou dela. Tirar o acesso total nesse
estado deixava a pessoa sem nenhuma tela, e o aviso mandava "marque antes",
numa tela onde as marcações ainda não valiam: ordem impossível. Agora, com a
lista vazia, o sistema marca tudo o que aquele acesso já enxerga. Nada muda no
instante da troca; a partir dali o dono desmarca o que quiser.

## Teste feito antes de subir

Com os três acessos reais do banco:

| | é matriz | Administração | Importar Dados | Liberação | PDV |
|---|---|---|---|---|---|
| Rafael (dono) | sim | vê | vê | vê | vê |
| Franqueadora hoje (total) | sim | **não vê** | vê | vê | vê |
| Franqueadora tela por tela | **sim** | não vê | vê | vê | vê |
| Jales (franqueado) | não | não vê | não vê | vê | vê |

Jales tinha `tecnico/central-tecnica` marcada na permissão e **continuou
bloqueado** — a trava vence a marcação.

## Como o Rafael esconde um módulo da franqueadora

Configuração da Loja → Usuários e Permissões → pasta **Empresa** → acesso
`Jolô Franqueadora` (aparece no topo da pasta, antes das unidades, porque não
tem unidade) → aba **O que pode ver** → botão **Escolher tela por tela** →
desmarcar. A partir daí ela continua matriz e vê só o marcado.

---

# 18/08/2026 — V74: a tela não volta mais para o topo sozinha

## O sintoma

Rafael, no fim de uma página longa, clicava numa caixa de marcar e a tela
saltava para o topo. Acontecia em **várias telas**, não em uma.

## A causa

Dezenas de botões chamam `telaXxx()` de novo para se redesenhar — marcar uma
caixa, mudar filtro, trocar de aba. O desenho refaz o `innerHTML` inteiro, e a
barra de rolagem volta a zero.

Já existia o `semPular()`, criado para Usuários e Permissões, mas ele era usado
em **12 lugares** de mais de noventa telas.

## Por que não corrigi chamada por chamada

São 93 funções `tela*` e dezenas de pontos de chamada — e a próxima tela criada
nasceria com o mesmo defeito. O conserto foi na raiz: **toda função `telaXxx`
passa a guardar e devolver a rolagem sozinha** (`_envolverTelas()`, que embrulha
cada uma no `semPular`).

A exceção é o roteador: clicar no menu para ir a **outra** tela deve começar no
topo — daí `_trocandoTela`, que desliga o comportamento nesse caminho.

## Dois defeitos encontrados durante o teste

**1. Erro de tela ficava escondido.** A primeira versão do embrulho engolia
exceções da tela: a pessoa via tela quebrada e o console limpo. Corrigido — o
erro da tela sobe igual a antes; só falha do próprio `semPular` é silenciada,
e nesse caso a tela é desenhada mesmo sem guardar a rolagem.

**2. `semPular` era lento a ponto de travar.** Ele montava o caminho de TODOS
os elementos da página para localizar os poucos que interessavam — e repetia
cinco vezes (agora, dois quadros, 60ms, 150ms). Com o `semPular` usado em 12
lugares isso passava; **usado em todo clique, travava**. Numa tela simulada de
12 mil elementos o teste não terminou.
Trocado por descida direta pelo caminho (do body até o elemento, pelos índices
dos filhos). Mesma tela: **~33ms no simulador**, que é bem mais lento que um
navegador de verdade.

## Testes feitos (jsdom)

| caso | resultado |
|---|---|
| redesenho no fim da página | devolve a rolagem |
| troca de tela pelo menu | começa no topo, como deve |
| chamada dentro de `semPular` | não aninha |
| tela que dá erro | o erro chega a quem chamou |
| envolver duas vezes | não empilha |
| duas barras internas roladas | as duas voltam ao lugar |

---

# 18/08/2026 — V75: o que foi excluído para de aparecer, e acesso pode ser excluído

## Três coisas que estavam erradas na ficha da empresa (Administração)

**1. Sucursal excluída continuava na lista, como "Inativa".**
A `Jolô Jales` estava com `excluida_em` preenchido no banco e mesmo assim
aparecia. A função `painel_empresas()` lia `sucursais` sem filtrar excluídas.

**2. O mesmo acesso aparecia duas vezes.**
Rafael entrou como franqueadora e criou o acesso da unidade em Usuários e
Permissões. O acesso antigo (`jolo@jales.com`) foi **desligado** ali —
`ativo=false` — mas desligar só marca a linha; a conta continua no Auth e o
perfil continua existindo. `painel_empresas()` listava todo perfil da loja,
sem olhar se ele estava desligado. Resultado: "Jolô Jales" duas vezes.

**3. Não havia como excluir um acesso.** Só editar.

## O que foi feito

**`painel_empresas()` agora filtra na origem** — sucursal com `excluida_em`
não vem, e perfil cujo `usuarios_sistema` está excluído ou inativo não vem.
Filtrar na função, e não em cada tela, evita que a próxima tela criada esqueça
o filtro. Perfil **sem** linha correspondente continua aparecendo: sumir com um
acesso por falta de cadastro seria pior que mostrar demais.
A soma da mensalidade também passou a ignorar unidade excluída.

**Botão de excluir acesso** na lista, chamando a Edge Function `criar-usuario`
(versão 9) com `acao:'excluir'`. A conta sai do Auth, do `perfis` e é marcada
como excluída em `usuarios_sistema`.

**Ordem da exclusão importa.** `perfis.id` tem FK para `auth.users` com
ON DELETE CASCADE: apagar a conta já leva o perfil. Por isso a conta vai
primeiro — se falhar no meio, nada foi destruído e dá para repetir. Na ordem
inversa, uma falha depois de apagar o perfil deixaria conta órfã no Auth, que
é exatamente o tipo de sobra que criou o problema das listas duplicadas.

Travas: ninguém exclui o próprio acesso; o acesso `plataforma` não pode ser
excluído; administrador de rede só alcança acessos da própria empresa.

**Recriar acesso com e-mail já usado agora reativa a linha.** Sem isso, o
acesso recriado nasceria invisível — a linha antiga continuaria marcada como
excluída e o novo filtro o esconderia.

## Divisão de quem cria o quê (pedido do Rafael)

Na Administração, o formulário passou a criar **um só tipo de acesso**: o da
franqueadora, que enxerga a empresa inteira. Os campos Papel e Unidade saíram —
viraram fixos (`admin` / empresa inteira).

Regra: **a Joia cria o acesso da franqueadora; a franqueadora cria o resto**,
em Configuração da Loja › Usuários e Permissões. Cada rede cuida da própria
equipe, e o dono não vira operador de cadastro dos clientes.

## V75.1 — a tela de contrato oferecia chave que não abre porta

Rafael marcou quatro itens de ADMINISTRAÇÃO para a matriz da Jolô — Empresas
Clientes, Layout do Menu, Mensalidades e Diagnóstico — salvou, e **nada
apareceu** para a franqueadora.

**Causa:** três dos quatro estão em `SO_PLATAFORMA`, a lista das telas que
administram o próprio produto. A trava do `podeVer` (V73) recusa essas telas
para quem não é plataforma — corretamente. Mas a tela onde o dono define o
contrato listava **todas** as telas do sistema, inclusive essas. O dono
marcava, salvava, e a marcação morria na trava.

Oferecer uma chave que nunca abre a porta é pior que não oferecer.

**Correção:** `chavesDoSistema()` passa a pular os itens de `SO_PLATAFORMA`.
Em ADMINISTRAÇÃO sobram os dois que fazem sentido para uma rede:
**Mensalidades das Unidades** e **Sincronização**.

Foram apagadas do banco as seis linhas de `sucursal_permissoes` dessas telas
para a matriz da Jolô — não tinham efeito, e ficariam confundindo a leitura.

**Regra que fica:** o que entra em `SO_PLATAFORMA` some da tela de contrato
automaticamente. Não existe lista para manter em dois lugares.

---

# 18/08/2026 — V76: a franqueadora cadastra as próprias sucursais

## O pedido

A franqueadora precisa cadastrar Santa Fé, Sorocaba, Petrópolis — com todos os
campos. A tela que faz isso é **Empresas Clientes**, que era exclusiva do dono.

Rafael observou, com razão, que **este banco só tem a Jolô**: a instância do
Rafaelo's é outro projeto Supabase (`rafaellos-gestao`), conforme decidido em
17/08. Não haveria vazamento hoje.

## Por que não bastou liberar a tela

Segurança que depende de uma promessa sobre o futuro não é segurança. Se um dia
uma segunda rede entrar neste banco, a franqueadora da Jolô passaria a ver o
nome, o CNPJ, o plano e a mensalidade da concorrente — e ninguém lembraria que
foi uma liberação feita hoje.

**O limite ficou no banco, não no menu.** `painel_empresas()` agora devolve
todas as empresas para `sou_plataforma()` e **só a própria loja** para os
demais (`l.id = minha_loja()`). O contrato e a mensalidade vêm nulos para quem
não é plataforma — são assunto entre a Joia e o cliente.

## O que mudou no `index.html`

- `tecnico/instalacao` saiu de `SO_PLATAFORMA` e entrou em `SO_FRANQUEADORA`:
  continua fora do alcance de franqueado e obedece à marcação do contrato
- A trava da tela passou de `ehPlataforma()` para `ehPlataforma()||ehFranqueadora()`
- Somem para o cliente: bloco **Contrato com a Joia** (com o *Excluir empresa*),
  botão **Definir o que esta empresa pode usar**, card **Cadastrar nova
  empresa**, a linha e a **coluna Mensalidade**, e o total no cabeçalho
- Título vira **"Minha rede"**; o voltar deixa de dizer "todas as empresas"

## Camadas, na ordem em que barram

1. **Banco** — `painel_empresas()` só devolve a própria loja
2. **Menu** — `SO_FRANQUEADORA` esconde o item de franqueado
3. **Tela** — a trava recusa quem não é franqueadora nem plataforma

Testado por perfil: franqueadora, gerente e admin de unidade enxergam **1
empresa** e **nenhum dado de contrato**; a plataforma vê tudo.

---

# 18/08/2026 — V77: o 403 que travou a sincronização nos dois sentidos

## O sintoma, que parecia dois problemas

1. As permissões marcadas na franqueadora não salvavam — saía da tela, voltava, tudo desmarcado
2. O acesso da Jolô Jales, criado na nuvem, não descia para o navegador dela

Rafael reclamou, com razão, de eu ter mandado "forçar a sincronização":
num ERP para 30 lojas, sincronização forçada não existe.

## A causa, única

O Console mostrou `403` repetido no upsert de `usuarios_sistema`. O banco
recusava a gravação.

O acesso da franqueadora estava com **`sucursal_ref = 'suc_matriz'`**. A regra
`sou_admin()` exige `cargo in ('admin','plataforma') AND sucursal_ref IS NULL`
— quem tem unidade é gestor **daquela** unidade, não da rede. Com a unidade
preenchida, ela foi rebaixada e a política passou a recusar toda linha cujo
`sucursais` não contivesse `suc_matriz`.

**E é aí que os dois sintomas se juntam:** o sistema não baixa nada enquanto há
pendência de envio — regra certa, senão o download atropelaria o que ainda não
subiu. Como o envio falhava sempre, a marca de pendente nunca saía. Um único
403 travou a subida **e** a descida.

Corrigido no banco: `perfis.sucursal_ref = null` e `usuarios_sistema.sucursais
= []` para `jolo@jologelato.com.br`. Voltou a sincronizar sozinha — 3 acessos,
66 telas.

**Erro meu, registrado:** quando Rafael mostrou a coluna Unidade com "Matriz",
eu disse que era só estética e "funcionava igual". Não funcionava — é regra de
segurança do banco. Eu deveria ter conferido antes de responder.

## Ainda em aberto

A tela de editar acesso **deixa prender a franqueadora a uma unidade** e
quebrar tudo de novo, sem aviso nenhum. Falta impedir: acesso de cargo `admin`
sem unidade é o que define a franqueadora.

## Também nesta versão

Acesso desligado sumiu da árvore de Usuários e Permissões. Ele continua no
cadastro — o histórico do que a pessoa fez depende disso — mas não polui a
tela de trabalho. Um link "mostrar N desligados" traz de volta; escondê-los de
vez tiraria a única forma de reativar alguém. O acesso aberto na tela nunca
some, mesmo desligado.

## V77.1 — "não está interligado" era uma unidade que não existe

Rafael viu, na sessão da franqueadora: o **Trocar de Loja** mostrando só uma
loja, a **Liberação por Unidade** sem a Jales, e concluiu que as telas não
conversavam entre si.

Não era isso. **Só existe uma unidade ativa.** A `Jolô Jales` está no banco com
`ativa=false` e `excluida_em` preenchido desde 11/08 — foi excluída. Por isso
não aparece no seletor de loja nem na liberação: as duas telas estão certas.

O que mentia era a **árvore de Usuários e Permissões**, que contava e desenhava
tudo que estivesse em `DB.sucursais`, inclusive a excluída — daí o "2 unidades"
numa empresa com uma só, e a unidade morta aparecendo como se pudesse receber
acesso. Corrigido: a árvore passa a ignorar unidade excluída ou inativa.

**Lição:** a tela que mostra a mais é a que faz duvidar das que estão certas.
Um número errado num canto criou a impressão de que o sistema inteiro estava
desligado por dentro.

---

# 18/08/2026 — V78: uma dona por assunto

## O diagnóstico do Rafael, e ele está certo

"Tem vários lugares fazendo a mesma coisa — é isso que está dando erro."

Sucursal podia ser cadastrada em **dois** lugares (Administração › Empresas
Clientes e Configuração da Loja › Sucursais da Franquia). Login e senha em
**outros dois** (Administração e Usuários e Permissões). Nenhuma tela era dona
do cadastro inteiro; cada uma gravava um pedaço. Foi isso que produziu o dia
inteiro de dados desencontrados — o acesso preso a uma unidade excluída, a
franqueadora rebaixada a gestora de unidade, o 403 travando a sincronização.

## O desenho combinado

| Tela | De quem é | Do que é dona |
|---|---|---|
| **Administração › Empresas Clientes** | só Rafael | cria a empresa e o acesso da franqueadora |
| **Config. da Loja › Sucursais da Franquia** | franqueadora | tudo da unidade: nome, CNPJ, telefone, ativar/desativar **e o login e senha do responsável** |
| **Usuários e Permissões** | franqueadora | só o que cada um enxerga. Mais **Novo usuário** para a equipe (caixa, produção), com login e senha ali — **sem** escolher unidade, que vem da loja aberta |

## Feito nesta versão (passo 1 de 3)

`tecnico/instalacao` voltou para `SO_PLATAFORMA` e a trava de `telaInstalacao`
voltou a exigir `ehPlataforma()` — desfazendo a V76 no mesmo dia.

O limite no banco (`painel_empresas()` só devolve a própria loja para quem não
é plataforma) **fica de pé**: não atrapalha e protege se a tela for reaberta.

## Falta fazer (passos 2 e 3)

2. **Sucursais da Franquia ganha login e senha** do responsável da unidade,
   gravando pela Edge Function `criar-usuario` (que já sabe criar e editar).
3. **Usuários e Permissões perde** a edição de login de unidade; fica só com
   permissões e com o Novo usuário da equipe, sem seletor de unidade.

## V79 — passos 2 e 3: o cadastro da unidade virou dono do acesso dela

**Cadastrar/Editar sucursal** (Configuração da Loja › Sucursais da Franquia)
ganhou **E-mail (login)** e **Senha** do responsável. Salvar grava a unidade e,
em seguida, cria ou atualiza o acesso pela Edge Function `criar-usuario`, com
`cargo:'gerente'` e `sucursal_ref` da própria unidade. Editando, senha em
branco mantém a atual.

**Ordem:** a unidade é gravada primeiro, porque o acesso aponta para ela. Se o
acesso falhar, **a unidade fica** — desfazer o cadastro por causa do login
perderia tudo o que a pessoa digitou. O erro aparece, e a unidade está lá.

**Usuários e Permissões:** para o responsável de uma unidade, o botão *Editar*
virou **"Editar em Sucursais"** e leva ao formulário de lá. Dois lugares
editando o mesmo login foi o que espalhou o cadastro. A equipe da loja (caixa,
produção) continua sendo criada e editada ali — essa gente não tem cadastro de
unidade, e o formulário dela já não pede unidade nenhuma: vem da loja aberta.

**`acessoDaSuc()` precisa ser determinística.** A primeira versão pegava o
primeiro acesso ativo daquela unidade — e o caixa da loja virava "o
responsável" dependendo da ordem da lista, o que faria editar a sucursal
trocar a senha da pessoa errada. Agora o responsável é quem tem função
**gerente**; sem gerente, nenhum. Testado com o caixa listado primeiro.

## V79.1 — a matriz voltou a aparecer como "sem acesso criado"

A regra que escondia unidade sem login olhava só o **acesso total**. Quando a
franqueadora passou a ser tela por tela (V73), ela deixou de contar — e a
matriz voltou a aparecer como "sem acesso criado", sendo que a franqueadora
chega nela todos os dias.

**O que alcança a empresa inteira não é ver todas as telas: é não estar preso
a nenhuma unidade.** A regra passou a considerar isso.

A linha continua aparecendo quando é verdade — rede só com gerentes de unidade
e ninguém cobrindo a empresa. Testado nos três casos.

## V80 — quem é o responsável da unidade virou fato gravado

Rafael clicou em Editar no `jales@jologelato.com.br` dentro de Usuários e
Permissões e o formulário de login e senha abriu — exatamente o que o combinado
tirava dali.

**Por quê:** eu estava *deduzindo* quem é o responsável da unidade. Primeira
tentativa: o primeiro acesso daquela unidade — e o caixa virava responsável
conforme a ordem da lista. Segunda: quem tem função "gerente" — e o `jales@`,
salvo como **Atendente**, deixou de ser reconhecido.

Deduzir errado aqui **troca a senha da pessoa errada**. Então o vínculo passou
a ser escrito: coluna nova `sucursais.login_responsavel`, preenchida no
cadastro da sucursal e sincronizada como qualquer outro campo. As unidades que
já existiam foram preenchidas por migração.

**`formUsuario()` agora desvia:** se o login editado é o responsável de alguma
unidade, ele fecha e abre o cadastro da sucursal. Não existe mais um segundo
formulário do mesmo dado — nem pelo botão, nem por caminho indireto.

Em Usuários e Permissões fica a **equipe**: caixa, produção, sócio.

## Em aberto, e vale decidir logo

Rafael quer que a equipe entre com **nome e senha simples, sem e-mail**. Hoje o
login é o Auth do Supabase, que **só aceita e-mail** — o formulário recusa
qualquer coisa sem arroba. Ou se adota um e-mail interno automático
(`caixa1@jolo.local`, escondido da tela), ou a equipe passa a ser autenticada
por outro caminho. Não dá para prometer "senha simples" sem resolver isso.

## V80.1 — a matriz é a exceção, e o conserto virou automático

A linha "sem acesso criado · matriz" continuava aparecendo. A causa não era a
árvore: **a franqueadora seguia presa a uma unidade** (o topo da tela dizia
"unidade" ao lado do e-mail dela). Uma unidade sem ninguém de empresa inteira
para cobri-la aparece como sem acesso — corretamente.

E a V80 tinha piorado: a matriz ganhou "responsável", e o cadastro de sucursal
prende o responsável àquela unidade. Para a matriz isso está errado.

**O responsável de uma filial responde por aquela loja. O da matriz responde
pela rede.** O cadastro da matriz passou a gravar `cargo:'admin'` e **sem**
unidade.

**E o conserto deixou de depender de alguém lembrar.** Hoje esse mesmo defeito
apareceu três vezes por caminhos diferentes: edição manual, aba "Lojas que
acessa" e cadastro de sucursal. Cada vez custou o mesmo 403 e a mesma
sincronização travada nos dois sentidos. Agora o `baseUsr()` solta o acesso da
matriz na abertura do sistema, e registra no log da nuvem quando faz isso.

Testado: solta a franqueadora, esconde a linha vazia, e **não** mexe no gerente
de filial, que deve mesmo continuar preso à loja dele.

## V81 — a linha da unidade sem acesso foi removida de vez

Rafael pediu três vezes que a linha "Jolo Gelato · sem acesso criado · matriz"
sumisse. Nas duas primeiras eu tentei consertar a *condição* que a fazia
aparecer, e nas duas ela voltou por um caminho diferente.

**Ela foi removida.** Aquela lista é de **acessos**; unidade se vê em Sucursais
da Franquia. A linha existia para a franqueadora achar uma unidade recém
cadastrada e criar o login dela — necessidade que acabou na V79, quando a
unidade e o acesso passaram a nascer juntos no mesmo formulário. Virou ruído,
e pior: parecia um login excluído que não saía da tela, com um botão de
excluir que não existia.

**Por que a V80.1 não resolveu:** o conserto automático depende de
`sucursais.login_responsavel`, e o aparelho que ainda não tinha baixado esse
campo mandava `null` no envio — apagando o vínculo na nuvem antes de recebê-lo.
Como o envio acontece antes do download, o vazio vencia sempre. Agora o campo
é **omitido** quando vazio, em vez de enviado como nulo.

**Padrão para lembrar:** em tabela sincronizada, campo novo nunca sobe como
`null` a partir de um aparelho que talvez não o conheça. Vazio não quer dizer
"apague".

## V82 — a franqueadora presa numa loja que não existe mais

Ela aparecia como **"unidade"** no topo e caía em **"Área restrita"** nas
próprias telas (Mensalidades das Unidades). Causa: o acesso dela apontava para
`suc_jales` — **depois** de a Jales ter sido excluída. Presa a uma loja que não
existe, deixava de ser reconhecida como matriz.

**Apontar para o vazio não é apontar para uma unidade.** O `baseUsr()` agora
limpa, na abertura, todo vínculo com unidade inexistente. Não depende de campo
novo nem de download — conserta mesmo com envio pendente, que era o caso.
Proteção: se a lista de sucursais ainda não foi carregada, nada é apagado.

**O rótulo do topo também estava para trás.** Dizia "franqueadora" só para quem
tinha acesso total; tela por tela virava "acesso limitado". Agora diz a
**posição na rede** — matriz — e a permissão vem depois. Mesma separação da V73.

## Mensalidade no cadastro da sucursal

O cadastro ganhou **Mensalidade (R$)** e **Dia do vencimento** (1 a 28), que
sobem e descem na sincronização. É o que alimenta Mensalidades das Unidades.

**Falta:** o financeiro completo de recebimento dessas mensalidades pela
franqueadora — baixa, atraso, histórico. Pedido registrado, não construído.

## V83 — desfazendo a V82: vínculo morto não pode virar acesso a tudo

**Erro meu, e grave.** Na V82 apaguei o vínculo de quem apontava para uma
unidade excluída, para soltar a franqueadora. Só que o gerente de Jales também
apontava para a Jales excluída. Sem unidade, ele passou a valer como
**empresa inteira** — o rodapé dele passou a dizer "matriz — franqueadora".
Um gerente de loja virou franqueadora por causa de uma limpeza minha.

A regra estava invertida: sem unidade significa "alcança tudo". Então apagar um
vínculo quebrado **promove** quem o tinha. O certo é o contrário — quem perdeu
a unidade não alcança nada até alguém dizer onde ele fica.

A limpeza foi removida. A franqueadora continua sendo resolvida pelo caminho
próprio, que só mexe em quem está registrado como responsável da matriz.

Dado corrigido no banco: `jales@jologelato.com.br` voltou a `cargo=gerente`,
`sucursal_ref=suc_2157f764d972`.

## O estrago do dia, para não repetir

A conta `jolo@jologelato.com.br` foi **excluída** às 20h55. Antes disso tinha
sido renomeada para "Jolô Jales" e amarrada à unidade Jales — porque o vínculo
morto fez o cadastro de sucursal reconhecê-la como responsável daquela loja.
Na lista ela apareceu como duplicata e foi apagada.

**Travas que faltam, na ordem:**
1. Acesso que responde pela rede não pode ser excluído pela tela
2. Cadastro de sucursal nunca adota como responsável um acesso sem unidade
3. Unidade excluída não deve continuar referenciada por acesso nenhum — a
   exclusão precisa tratar quem apontava para ela, na hora

## V83.1 — editar a mensalidade pedia a senha

Editar só o valor da mensalidade da loja mandava o acesso junto, com a senha
vazia — e o servidor recusava dizendo que a senha era curta demais. Quem edita
o cadastro da loja não está mexendo em senha nenhuma.

O acesso agora só é gravado quando **algo nele** mudou: senha digitada, e-mail
diferente, ou primeiro acesso da unidade. Testado nos cinco casos.

## V83.2 / V83.3 — Mensalidades: botão a menos, unidade a mais

Saiu o botão **Nova empresa** da tela de Mensalidades. Ali se acompanha a
cobrança das unidades que existem; cadastrar empresa é outro assunto e tem
lugar próprio.

**A Jolô Jales não aparecia** mesmo com R$ 350 e vencimento gravados. Ela
estava `ativa=true` **e** com `excluida_em` preenchido — reativar pela tela
nunca apagava essa marca, porque o envio não mexia nesse campo. E a consulta
esconde tudo que está marcado como excluído.

Agora o envio manda `excluida_em: null` quando a unidade está ativa — aqui o
nulo é intencional, quer dizer "está viva". Com a unidade inativa o campo é
**omitido**, para não apagar a data de quem foi excluído de verdade. É a mesma
regra da V81, aplicada ao contrário quando o vazio tem significado.

## Mensalidades — quem manda é a matriz, não a plataforma

Rafael marcou pago e o servidor recusou: `painel_marcar_pago` exigia
`sou_plataforma()`. Está errado para o desenho combinado — **a franqueadora
administra a cobrança das próprias unidades; o dono da Joia observa.**

A função passou a aceitar `sou_plataforma()` **ou** administrador da rede
(`sou_admin()`) cuja loja seja a dona da unidade. O limite não sumiu, mudou de
lugar: ela alcança só as unidades da própria loja. Passou a gravar também
**quem** deu a baixa.

Desmarcar já funciona pela mesma porta (`p_pago = false` remove a marca do mês).

**Falta, e é o pedido inteiro do "financeiro completo":**
1. Botão de **desfazer** a baixa na tela (a função já aceita; falta a interface)
2. **Histórico mês a mês** com pago / a vencer / atrasado, virando a página
3. A baixa **gerando lançamento no financeiro** da franqueadora — hoje o
   recebimento fica só nesta tela e não entra no caixa dela
4. `tecnico/financeiro-nexor` precisa estar marcado para o acesso da matriz,
   senão a tela nem abre ("Sem acesso a esta tela")

---

# 18/08/2026 — V85: Estoque Total no fim de qualquer dia

Faltava saber quanto havia em estoque num dia específico — para fechar o mês,
para conferir uma contagem, para entender uma compra.

**Não existe foto guardada de cada dia, e não precisa.** Existe o razão de
movimentos, com data. O saldo de uma data é o saldo de hoje **desfazendo tudo
o que se moveu depois dela**.

Filtro **"Estoque no fim do dia"** na tela Estoque Total. Escolhida a data, a
quantidade, o valor de cada item, o total do rodapé e os filtros "abaixo do
mínimo" e "zerado" passam todos a falar daquele dia. Um botão volta para hoje.

**Por que funciona com contagem no meio:** a contagem não grava o total
contado — grava a **diferença** entre o contado e o que havia, como entrada ou
saída. É um movimento comum e entra na mesma conta. Se gravasse o total, esta
reconstrução estaria errada e a contagem teria de ser tratada como marco.
Conferido no código que finaliza a contagem antes de escrever a conta.

**Por unidade:** movimento de outra loja é ignorado. Cada loja tem seu saldo.

**Limite conhecido, e está escrito no código:** o VALOR usa o custo médio de
**hoje**, não o daquele dia. Reconstruir custo médio para trás exige refazer a
média ponderada compra a compra — outra obra. Então: quantidade é exata; valor
é "a quantidade daquele dia ao custo de hoje". Para fechamento contábil isso
importa; para gestão do dia a dia, resolve.

**Teste:** história com entrada, saída, contagem e movimento de outra loja —
sete datas conferidas uma a uma, todas batendo, incluindo o dia anterior à
primeira entrada (zero) e uma data futura (saldo de hoje).

## V86 — a sugestão sumia na hora de clicar, e o custo médio no rodapé

**A lista de sugestão.** Em Movimentação de Estoque, digitar "gelato" abria a
lista e ela sumia ao clicar. Causa: a cada letra, 260 ms depois, a tela inteira
era redesenhada para filtrar a tabela — e redesenhar troca o `<input>` por um
novo, o que faz o navegador fechar a lista junto. O clique caía no vazio.

Agora **digitar não redesenha nada**. O redesenho acontece quando a escolha
está feita: nome exato (que é o que acontece ao clicar na sugestão), Enter, ou
ao sair do campo. A lista fica de pé o tempo todo.

**Custo médio.** Nova linha no rodapé, ao lado do subtotal: valor movimentado
dividido pela **quantidade** movimentada — média **ponderada**, não a média dos
custos unitários. A diferença não é detalhe: 1 kg a R$ 80 mais 500 kg a R$ 10
dão custo médio de R$ 10,14/kg; a média simples diria R$ 45,00 — quatro vezes
mais. A unidade só é rotulada quando todas as linhas usam a mesma; com
unidades misturadas o número aparece sem rótulo, porque somar kg com litro não
significa nada.

## V86.1 — o custo médio na coluna certa

O valor estava na coluna **Custo total**, ao lado do subtotal. Lugar errado:
aquela coluna é soma, e média não se soma. Passou para a coluna **Custo**, que
é a do preço por unidade — é com esses números que ele se compara. O rótulo
"Custo médio" fica à esquerda, na mesma linha.

## V87 — rodapé da movimentação: cada total sob a sua coluna

Eram três linhas: o subtotal, o custo médio jogado à esquerda e
"Entradas/Consumo" solto embaixo. Número longe da coluna não se compara com
nada — "4,8 kg" ao lado da palavra "Custo médio" chegava a parecer dinheiro.

Agora é **uma linha só**, com cada total debaixo da própria coluna e o nome em
letra miúda embaixo do valor:

| coluna | total |
|---|---|
| Qtd / un. entrada | quanto entrou |
| Qtd / un. consumo | quanto saiu |
| Custo | **custo médio** (ponderado) |
| Custo total | soma do período |

A linha "Entradas R$ · Consumo R$" saiu: virou redundante, já que as
quantidades agora aparecem nas colunas certas.

## V87 — rodapé refeito, e um erro meu que apagou 33 funções

**O erro primeiro, porque é o que importa.** Para trocar o rodapé eu recortei o
arquivo entre duas marcas de texto. A marca final (`'</tfoot></table>'`)
aparece em mais de um lugar, e o corte pegou a ocorrência errada: **levou 33
funções junto** — `itensEstoque`, `telaEstoqueTotal`, `listaEstoque`,
`modalMovimento`, `verMovimento`, entre outras. A tela de Contagem quebrou com
"itensEstoque is not defined", e a validação de sintaxe passou, porque o
arquivo continuava sintaticamente válido — só que sem metade das funções.

Restaurado do commit anterior e refeito com substituição de **texto exato**,
não recorte por posição.

**Regra que fica: nunca cortar por marca que pode se repetir.** Substituição
tem de casar o bloco inteiro, do começo ao fim. E depois de qualquer edição
grande, comparar a lista de funções antes/depois — foi assim que o estrago
apareceu.

**O rodapé**, agora em uma linha só, cada total sob a sua coluna, com o nome em
letra miúda embaixo do valor: média de entrada, média de consumo, custo médio,
custo total. A linha "Entradas R$ · Consumo R$" saiu, virou redundante.

## V87.1 — média é soma dividida pelo número de lançamentos

Três entradas de 10 kg somam 30 e a média é **10**, não 30. O rodapé mostrava a
soma com o nome de média — pior que não mostrar, porque o número parece
conferido e não é o que diz ser.

Agora divide pelo número de lançamentos daquela direção, e o rótulo diz quantos
são: "média de 3 entradas". Assim o número se explica sozinho.

O **custo médio** continua ponderado (valor ÷ quantidade), que é o certo para
dinheiro: 1 kg a R$ 80 com 500 kg a R$ 10 dá R$ 10,14/kg, não R$ 45.
São duas médias diferentes na mesma linha, de propósito — quantidade se divide
por lançamentos, dinheiro se divide por quantidade.

## V87.2 — custo médio olha a entrada, não o consumo

Rafael descreveu a conta: soma do custo de entrada ÷ soma da quantidade de
entrada. É isso mesmo — e não existe "vezes mil"; isso só apareceria em
conversão de unidade (grama para quilo), que aqui não acontece.

Eu estava calculando sobre **todas** as linhas. Errado: o mesmo material era
contado duas vezes, uma ao entrar e outra ao sair, e o número deixava de ser o
custo do quilo. Custo médio responde "quanto me custa o quilo deste item", e
quem responde isso é a compra/produção.

Quando o filtro mostra só consumo, a conta usa o consumo e o rótulo avisa
"(consumo)" — melhor que uma linha zerada sem explicação.

Testado: R$ 300 em 30 kg dá R$ 10,00/kg; com consumo junto continua R$ 10,00;
1 kg a R$ 80 com 500 kg a R$ 10 dá R$ 10,14 (ponderado, não R$ 45).

---

# 18/08/2026 — V88: Movimentação de Mercadoria

"Histórico de Posição de Estoque" virou **Movimentação de Mercadoria**, com
outra ideia por trás. A pergunta que a tela responde agora é: **neste dia,
quanto entrou, quanto saiu, com quanto o item terminou — e por quê.**

Uma linha por dia e por item, com entrada, saída e saldo do dia. O **+** abre
os lançamentos daquele dia, em ordem de hora, cada um com o saldo depois dele:
começou com X, a venda tirou tanto, a produção pôs tanto, terminou com Y.

Cada lançamento diz a origem em português — venda no PDV, pedido do cardápio,
totem, fiado, produção, nota de entrada, transferência, ajuste de contagem
(sobra ou falta), Assistente, ou o motivo cadastrado da baixa manual.

Filtros: data inicial, data final e ingrediente (vazio = todos).

**O saldo não é guardado em lugar nenhum** — é reconstruído do razão de
movimentos com `saldoNaData()`, o mesmo cálculo da V85. Por isso vale para
qualquer dia do passado.

**A tela antiga (`telaHistPosicao`) continua no arquivo, intacta.** Só o
roteador mudou. Se faltar algo na nova, é uma linha para voltar. Depois do
susto das 33 funções, tela nova entra ao lado, não por cima.

**Teste:** dois dias com nota, venda e produção — o saldo corrido lançamento a
lançamento bateu com o saldo calculado de forma independente nos dois dias.

## V88.1 — a entrada aparecia na coluna de saída

A tabela do detalhe tinha **4 colunas** e a de fora tem **5**. Tudo andava uma
casa: uma entrada de +4,8 kg aparecia debaixo de "Qtde saída".

Número na coluna errada não é detalhe de layout — é informação errada. Quem
olhasse rápido leria uma produção como se fosse consumo.

O detalhe passou a ter as mesmas cinco colunas, com **entrada e saída
separadas**, iguais às de cima: entrada em verde na coluna de entrada, saída em
vermelho na coluna de saída, e o saldo corrido na última.

**Princípio, para as próximas telas:** tabela aninhada tem de repetir a
estrutura de colunas da tabela que a contém. Se não repetir, os números mentem.

---

# 19/08/2026 — V89: telas de lista usam a tela inteira

O `.finWrap` tinha `max-width:1240px; margin:0 auto` — o conteúdo ficava
centralizado com duas faixas cinzas nas laterais. Numa lista de 250
ingredientes isso é espaço jogado fora: as colunas espremidas no meio enquanto
sobra tela dos dois lados.

Limite removido do estilo base, e removido também das telas que declaravam
1250/1300/1350px. **Dez telas de lista** passaram a ocupar a largura toda:
Ingredientes e Insumos, Clientes, Cupons, Cupons Fiscais, Formas de Pagamento,
Fornecedores, Frente de Caixa, Acertos, Cancelamentos e Mesas.

**Formulários continuam estreitos** (820 a 1000px), de propósito: campo largo
demais é ruim de ler e de preencher. A regra é a natureza da tela — lista se
espalha, formulário não.

**Padrão para telas novas:** o cabeçalho e os filtros ficam fixos no topo, numa
linha só, e a lista ocupa todo o resto com a rolagem só nela — como a
Movimentação de Mercadoria.

## V89.1 — Ingredientes e Insumos com a casca da Movimentação de Mercadoria

Tirar o limite de largura (V89) não bastou: a tela continuava feita de
**cartões brancos flutuando sobre fundo cinza** — um para o título, um para os
filtros, outro para a lista. Com 250 ingredientes, isso é moldura em volta do
que interessa.

Trocada a casca: `finWrap` + `filtroCard` + `pnl2` viraram
`mvWrap` + `mvTopo` + `mvFiltros` + `mvTabW`, a mesma estrutura da Movimentação
de Mercadoria. Título fixo, filtros fixos numa faixa, lista de fora a fora com
a rolagem só nela.

**Nota de método:** ao fechar as tags eu tentei "igualar o número de `</div>` da
versão anterior". Errado — a versão anterior tinha um cartão a mais, então o
número dela não servia de referência. A conta certa é pela estrutura: no fim
só restam `mvTabW` e `mvWrap` abertos, logo dois fechamentos. Verificado
montando o HTML e contando: zero divs em aberto.

As outras telas de lista seguem o mesmo caminho quando forem tocadas.

## V89.2 — casca é uma coisa, campo é outra

Ao trocar a casca da tela de Ingredientes, troquei junto o `filtroCard` por
`mvFiltros` — e os campos perderam a forma: rótulo colado na caixa, tudo
desalinhado. Os campos daquela tela são `.fl`; `mvFiltros` é feito para `.f2`.

**Trocar a casca não pode trocar o estilo do que está dentro.** O filtro voltou
a ser `filtroCard`, com a classe `emCheia` que só remove as bordas arredondadas
e as laterais, para a faixa encostar de lado a lado.

Vale para as próximas telas que forem migradas: mudar o contêiner, não os
componentes.

## V89.3 — duas buscas na mesma tela

Existe uma busca **automática** que o sistema injeta em qualquer tabela com 6
linhas ou mais. Em Ingredientes e Insumos ela aparecia logo abaixo do campo
"Buscar" do filtro: duas caixas fazendo a mesma coisa, e a de baixo ainda
empurrava a lista para baixo.

Ela passou a entrar **só quando a tela não tem campo de busca próprio** na
faixa de filtros. Campo de data e seletor não contam — filtram, mas não
procuram por nome.

Testado com jsdom em quatro casos: tela com campo Buscar (não põe), tela só com
data e seletor (põe), tela sem filtro (põe), tabela pequena (não põe).

---

# 19/08/2026 — V90: excluir ordem de produção

Botão de lixeira ao lado do imprimir, na linha da ordem.

**A ordem não é só um registro — ela já mexeu no estoque.** Produzir consome os
ingredientes da ficha e dá entrada no item produzido; a diferença de pesagem
gera um segundo movimento, de perda ou ganho.

Apagar só a ordem deixaria o estoque com uma produção que ninguém mais consegue
explicar, e o Estoque Total e a Movimentação de Mercadoria continuariam
mostrando o resultado dela para sempre.

Por isso a exclusão desfaz na ordem inversa: primeiro os movimentos
(`aplicarMovimento(m,true)` devolve o que foi tirado e tira o que foi posto),
depois a ordem. Os movimentos são achados por dois caminhos: o principal pelo
`movId` guardado na ordem, e os de ajuste de pesagem pela identificação
"OP &lt;número&gt;".

A confirmação diz quantos movimentos serão desfeitos e **avisa que o saldo pode
ficar negativo** se o que foi produzido já tiver sido vendido.

**Teste:** produção de 5 kg de base gerando 4,8 kg com 0,3 kg de diferença —
os dois movimentos foram encontrados e o estoque voltou exatamente ao original.

---

# 19/08/2026 — V91: o subgrupo virou cadastro de verdade

## Combinado com o Rafael (continua valendo)

**Quando ele pede, é para fazer agora.** Só adiar quando ele mesmo disser
"anota e faz amanhã". Registrar em vez de executar não é resposta.

## O que estava errado

`ficha_grupos` tinha só `nome` e `destino_id` — **não existia campo de pai**. Os
subgrupos da árvore não eram cadastro: eram remontados a partir do `subgrupo_id`
de cada ficha. Subgrupo sem ficha dentro sumia no carregamento seguinte, porque
não havia onde ficar gravado.

E havia um segundo furo, que sozinho já impedia tudo: **o `subgrupoId` da ficha
nunca subia para a nuvem.** O download lia `subgrupo_id`, o envio não escrevia.
Escolher o subgrupo no cadastro não sobrevivia à primeira sincronização.

Por isso BASE BELGA e BASE MORANGO apareciam soltas dentro de "Produzido".

## As quatro peças, feitas

1. **Banco:** `ficha_grupos.pai_id uuid references ficha_grupos(id) on delete
   set null`, com índice. Pasta é a linha sem pai; subgrupo é a linha com pai.
   Subgrupo agora existe vazio, pode ser renomeado e recebe fichas depois.
2. **Sincronização:** `pai_id` sobe e desce. **Nunca sobe como `null`** (regra da
   V81): quando o pai ainda não tem uuid na rodada, o campo é omitido e o
   vínculo é gravado no fim do envio, no mesmo passe dos vínculos de produção.
   O `subgrupo_id` da ficha passou a subir.
3. **Estrutura criada**, com a grafia exata pedida:
   - **Produzido** → Artesanal · Base de Gelato · Cascao · Recheio · Sorbet · Zero Acucar
   - **Vendas** → Bebidas_venda · Cascao_Venda · Gelato_Venda · Parceiro_Venda · Sobremesas_Venda
4. **Migração:** BASE BELGA e BASE MORANGO em *Produzido › Base de Gelato*.

## Na tela

- A árvore lista **só pastas** no primeiro nível; subgrupo aparece dentro, com a
  contagem de fichas do lado, e a pasta mostra o total dela
- **Clicar no subgrupo lista as fichas dele à direita.** Só continua pendurada na
  pasta a ficha que não tem subgrupo — de propósito, para nenhuma ficar invisível
- O cadastro da ficha voltou a ter **Subgrupo**, alimentado pela pasta escolhida.
  Subgrupo de outra pasta é recusado na hora de salvar: deixaria a ficha invisível
- Excluir grupo ou subgrupo **vai à nuvem primeiro**; se a nuvem recusar, não some
  daqui. `ficha_grupos` tem `espelha:false`, então apagar só localmente fazia a
  linha voltar no download seguinte
- Grupo com subgrupo dentro não é excluído sem esvaziar antes

`c.subs` continua existindo porque há tela que lê dele, mas agora é **derivado**
das linhas, nunca fonte.

**Testes:** 14 casos da árvore e do filtro, 6 casos do envio. Funções antes: 1346;
depois: 1349, mais `excluirLinhaGrupoFicha` — nenhuma perdida.

## Cuidado que já custou caro

Editar `index.html` **só por substituição de texto exato**, nunca por corte
entre marcas que podem se repetir — foi assim que 33 funções sumiram na V87.
Conferir a lista de funções antes e depois de cada edição.

## Pendente de segurança (combinado: fazer depois)

- Apagar o token `joia-v72` no GitHub
- O token antigo **não está mais escrito no `DECISOES.md` atual**, mas continua no
  **histórico do repositório** — revogar no GitHub é o que resolve, não editar o arquivo

## V92 — foto de produto: reduzir em vez de recusar

Rafael tentou subir foto no cardápio e a tela recusou: "Imagem muito grande
(máx. 1 MB)". Celular nenhum tira foto abaixo disso — qualquer câmera entrega
3 a 8 MB. Na prática o sistema pedia uma foto pior, e não havia como obedecer.

O tamanho do **arquivo** nunca foi o problema: o que pesa no banco e na
sincronização é a imagem depois de convertida em data URL. `lerImagem()` passou
a aceitar qualquer imagem e reduzir para no máximo **1200px de largura, JPEG
0.82** — o mesmo tratamento que o fundo do totem (`lerFundoTotem`) e o logo do
cardápio (`comprimir`) já faziam. Se ainda passar de 900 KB, cai para 0.6.

Vale para foto de produto e de categoria do cardápio. Foto de 8 MB entra como
~200 KB, com qualidade de sobra para PDV e cardápio digital. O toast mostra o
tamanho final, para não haver dúvida do que foi gravado.

## V93 — nome do cardápio padronizado e foto preenchendo o card do PDV

Dois pedidos do Rafael, olhando a tela do PDV.

**Nomes.** Os produtos vindos da importação estavam em CAIXA ALTA e os do
cadastro manual em Maiúscula/minúscula, na mesma tela. Produtos e categorias
do cardápio passaram para `initcap`: primeira letra de cada palavra maiúscula,
o resto minúsculo. **Só o cardápio** — o nome das fichas técnicas continua
exatamente como veio das planilhas, que é o combinado.

**Foto.** `.prodGrid .ph2 img` estava com `object-fit:contain`, então a foto
aparecia pequena e centralizada, com barras cinza dos dois lados, dentro de uma
faixa de 76px de largura total. Passou para `object-fit:cover` e os `padding`
de 6px (quadro) e 3px (linha) foram a zero — a foto preenche a faixa inteira,
cortando o excedente pelas laterais. A regra estava repetida em 8 blocos de
tema; todos foram alterados.

## V94 — a foto do produto aparece inteira, e o card não fica com barra cinza

A V93 trocou `contain` por `cover` para tirar as barras cinza. Resolveu o
cinza e criou outro: a faixa tinha 76px de altura e a largura do card
inteiro, então o `cover` ampliava a foto e **cortava o produto** — o copo
aparecia sem o topo.

Duas mudanças juntas:

- A faixa deixou de ser uma tira baixa e virou **4:3** (`aspect-ratio:4/3`,
  altura automática). Numa grade de 4 colunas isso dá cerca de 150px de
  altura em vez de 76px — espaço para o produto aparecer de corpo inteiro.
- A foto voltou para `contain`, e o que sobra nas laterais é preenchido por
  **uma cópia da própria foto, ampliada e desfocada** (`blur(16px)`,
  `scale(1.25)`). Nada é cortado e não existe barra cinza: o fundo é sempre
  da cor da própria foto.

O `<img class="bgf">` é a cópia de fundo, marcada `aria-hidden`. Vale para os
três layouts do PDV.

## V95 — o borrão vazava por cima do nome; card menor e nome legível

Três coisas na mesma tela:

- **A cópia desfocada do fundo estava passando por cima do nome.** `.prodBox .ph2`
  não tinha `overflow:hidden` — só os layouts quadro e linha tinham — e o
  `transform:scale(1.25)` da `.bgf` derramava para fora da faixa. Era por isso
  que "Copo P" aparecia sobre um borrão marrom, ilegível. Corrigido com
  `overflow:hidden` na faixa e `z-index:2` + fundo branco no bloco `.inf`.
- **Card alto demais.** Com poucas colunas, `aspect-ratio:4/3` gerava faixas de
  250px. Entrou `max-height:150px` (190px no modo botão grande) — cerca de um
  terço menor, sem voltar a cortar a foto, porque o `contain` continua.
- **Nome e preço com mais peso:** nome 12,2 → 14px em `--ink` e negrito;
  preço 13,5 → 16px. O `min-height:32px` do nome saiu, que só empurrava o card.

E a **foto da categoria**: o ícone tinha 30px no trilho do PDV e a foto ficava
minúscula. Passou para 52px, e o nome deixou de ter `min-height:26px` (que o
empurrava para cima do ícone) — agora corta com reticências quando é longo.

## V96 — foto grande enchendo a memória do navegador

Rafael recebeu a faixa vermelha "o navegador recusou a gravação — memória
cheia (5099 KB)". Causa: **as fotos**. Todo o banco local mora no
`localStorage`, que tem cerca de 5 MB, e as imagens são guardadas ali dentro
em base64. Conferido no banco naquele momento: 20 fotos de produto (3,2 MB),
5 de categoria (1 MB) e 13 de ficha (0,4 MB) — **4,6 MB só de foto**. Não
sobrava espaço para mais nada, e o F5 voltava ao estado anterior.

A V92 tinha resolvido a recusa de upload reduzindo para 1200px/0.82, mas
1200px é grande demais para um card de 200px: cada foto ficava com ~160 KB.

- **Foto nova entra em 520px, qualidade 0.72**, com dois degraus de aperto se
  ainda passar de 90 KB. Fica em torno de 40 KB — quatro vezes menor.
- **`encolherFotos()`** trata as que já estavam gravadas: percorre produtos,
  categorias, fichas e insumos, reduz o que passa de 90 KB, grava e sincroniza,
  para que os outros aparelhos recebam a versão leve. Roda sozinha 9 segundos
  após o carregamento, uma vez por aparelho (`DB._fotosLeves`).

**E o botão do aviso levava a uma tela sem permissão.** "Abrir backup" aponta
para `tecnico/backup`, que é `SO_PLATAFORMA` — a franqueadora clicava e caía
em "Sem acesso a esta tela". Agora o botão consulta `podeVer()`: quem tem
acesso vê "Abrir backup", quem não tem vê **"Liberar espaço"**, que chama a
redução das fotos — a ação que de fato resolve o problema dela.

## V97 — na Produção, o sabor vem antes da base

"Ver todos os sabores" na Nova Ordem de Produção jogava as 42 bases junto com
os 44 sabores, em lista única alfabética. Como quase toda base começa com
"BASE", elas ocupavam a tela inteira e o sabor sumia. Quem vai produzir
procura ABACAXI GELATO, não BASE ABACAXI.

As bases **continuam na lista** — a matriz produz base de verdade (açúcar,
dextrose, leite em pó, embalagem), e tirá-las deixaria essa produção sem tela.
O que mudou é a ordem e a separação: `fichasProduziveis()` agora ordena pelo
subgrupo antes do nome, na sequência **Artesanal › Sorbet › Zero Acucar ›
Recheio › Cascao › Base de Gelato**, e a lista sai com um cabeçalho por
subgrupo. A busca por texto continua plana, porque ali a lista já é curta.

Testado com 7 casos: sabor em primeiro, base depois do sorbet, ficha de venda
fora, ficha sem receita fora, bases ainda disponíveis, ordem dos grupos e
nenhum cabeçalho repetido.

## V98 — a lista de sabores não empurra mais a tela da produção

Com o agrupamento da V97 a lista ficou legível, mas o painel `.opSug` era um
`flex-wrap` que crescia sem limite. Com 44 sabores ele ocupava a página
inteira, empurrava a tabela das cubas para fora e as últimas linhas ficavam
cortadas ao meio pelo rodapé — e cada sabor novo piorava.

- O painel virou **grade de colunas iguais** (`auto-fill, minmax(186px)`) com
  **rolagem própria** e teto de `38vh`. Cresce até ali e depois rola por
  dentro; a tabela das cubas nunca sai do lugar.
- Os cabeçalhos de subgrupo ganharam `grid-column:1/-1` para continuarem
  ocupando a linha inteira dentro da grade.
- O texto de cada botão dizia "gera 4,8 kg **de BELGA GELATO**" dentro do
  botão BELGA GELATO. O destino agora só aparece quando tem nome diferente do
  da ficha — cada item ficou com metade da largura.

## V99 — "Aparece na ordem de produção": chave por ficha

Nem toda ficha do grupo Produzido é uma ordem de produção. A base de gelato, a
base da calda e o cascão assado saem junto de outra produção — não se abre
ordem para eles. A tela listava tudo do grupo Produzido, e quem ia bater gelato
tinha de achar o sabor no meio de 50 itens que nunca produz.

Em vez de esconder por nome ou por subgrupo no código (que quebraria no dia em
que uma base virasse produção própria), entrou uma **chave por ficha**:
`fichas_tecnicas.na_producao boolean not null default true`, sobe e desce na
sincronização, e aparece no cadastro da ficha como **"Aparece na ordem de
produção"**, ao lado de Estocável e Disponível para venda. Desligada, a ficha
sai da lista de Produção sem perder receita, custo nem estoque.

Desligada agora, a pedido do Rafael: as **42 bases** de Base de Gelato, as duas
**BASE CALDA** que estavam em Recheio, e **CASCAO TRADICIONAL, CASCAO CHOCOLATE,
CESTINHA CASCÃO e BOLACHA CASCAO** — sobra só a massa, que é o que se produz.

Sobra na tela: Artesanal 30 · Zero Acucar 9 · Sorbet 5 · Recheio 3 · Cascao 2.

## Em aberto por causa disso

Com as quatro fichas de cascão fora da produção, **nada dá entrada no estoque
dos itens CASCAO TRADICIONAL, CASCAO CHOCOLATE, CESTINHA CASCÃO e BOLACHA
CASCAO** — e CASCAO 1 BOLA, 2 BOLAS e as de chocolate consomem esses itens na
venda. Hoje a MASSA produz estoque de MASSA. Para fechar, a massa precisa
gerar o cascão direto, com "a receita inteira gera N unidades": 2,46 kg de
massa → 40 cascões, 40 cestinhas ou 300 bolachas. Só que uma ficha tem um
destino só, e a mesma massa vira três coisas — falta o Rafael dizer como
decide, na hora de produzir, o que aquela massa vai virar.

## V100 — foto de fora a fora, e ícone de categoria maior

Terceira e última volta na foto do card do PDV. O histórico, para não repetir:

1. `cover` numa faixa de 76px — preenchia, mas a faixa era tão baixa que
   cortava o produto no meio (V93);
2. `contain` — mostrava a foto inteira e deixava duas barras cinza;
3. `contain` com uma cópia desfocada no fundo — sem cinza, mas as laterais
   foscas não agradaram (V94/V95).

**O que resolvia era a altura, não o encaixe.** Com a faixa em 4:3 (V94) o
corte do `cover` é mínimo, porque quase toda foto de celular já é 4:3 ou 3:2.
Então voltou o `cover` puro: ocupa de ponta a ponta, mantém a proporção (não
estica) e não tem tarja. A cópia `.bgf` saiu do markup e do CSS.

**Ícone da categoria:** 52 → 66px no trilho do PDV e 52 → 62px na grade
(78px no modo botão grande). O cartão foi de 104 para 118px de largura e a
seta de rolagem acompanhou a altura.

## V101 — totem: categoria que não filtrava e cartão virando tarja

**As categorias do totem nunca filtraram nada.** A faixa era desenhada como
`<div class="tcCat">` sem `onclick`, e `produtosTotem()` devolvia sempre a
lista inteira. Tocar em "Copo" não mudava a tela — continuavam os 32 produtos
da loja — e a primeira pastilha ficava acesa para sempre. Agora a pastilha
filtra de verdade (`TMC.cat`), com um **"Todos"** na frente para voltar, e
`reiniciarTotem()` limpa a escolha.

**O cartão colapsado.** A altura da moldura da foto vem de `aspect-ratio`, que
existe a partir do Chrome 88 / Safari 15. Onde a regra é ignorada, a moldura
fica com altura zero e o cartão inteiro vira uma tarja de ~30px mostrando uma
faixa do meio da foto — exatamente o que apareceu na tela do Rafael. Entrou
`.tcGrade .tcIm{min-height:clamp(130px,13vw,230px)}`, que garante altura útil
em qualquer navegador e não atrapalha onde `aspect-ratio` funciona.

**Ressalva honesta:** a segunda causa não foi confirmada em aparelho — foi
deduzida do formato do defeito. Se voltar a acontecer depois desta versão,
pedir o Console e a versão do navegador antes de mexer de novo.

## V102 — Plano de Contas ocupando a tela

A tela de Categorias Financeiras era uma caixa de 1000px no meio de um fundo
cinza. Com um plano de contas de verdade — 174 linhas — sobrava moldura e
faltava lista. Agora são **duas metades exatas, do canto ao canto**, cada uma
com rolagem própria: o cabeçalho e o botão de cadastrar ficam parados enquanto
a árvore rola. Abaixo de 820px de largura as colunas empilham.

O título da tela passou a ser **Plano de Contas**, que é o nome que o Rafael e
o contador usam. O item de menu continua "Categorias Financeiras".

## V103 — a causa real do cartão do totem virar tarja (medida em navegador)

Duas versões tentaram consertar isso por dedução. Desta vez o defeito foi
**reproduzido em Chrome headless** e medido com `getComputedStyle`:

    com poucos produtos:  cartão 361px, tudo certo
    com dez ou mais:      cartão 131px, foto cortada, nome e preço sumidos
    linhas da grade:      131.09px cada — altura da grade dividida pelas linhas

Causa, que é a soma de duas coisas:

- `.tcGrade` tem **altura definida** (`flex:1` dentro de `.tmC`) e linhas `auto`;
- `.tcCard` tem `overflow:hidden`, o que **zera o tamanho mínimo automático**
  dele.

Com o mínimo em zero e a altura da grade fechada, o algoritmo de grid
**encolhe as linhas até caberem** em vez de deixar transbordar. Por isso só
aparecia com muitos produtos — em Bebidas, com 15 itens.

`grid-auto-rows:max-content` tira essa liberdade: a linha fica do tamanho do
conteúdo e o excedente rola. Medido depois: 361px por cartão com qualquer
quantidade. `.tcLI{flex:none}` fecha a mesma armadilha no layout lista.

O `min-height` da V101 fica como está — não atrapalha e protege navegador sem
`aspect-ratio`.

**Lição:** dava para ter reproduzido na primeira vez. Há Chrome headless no
ambiente (`~/.cache/puppeteer`); extrair o CSS do `index.html`, montar a tela
com dados de exemplo e medir leva dez minutos e evita duas versões no escuro.

## Também nesta versão

A pastilha **"Todos"** saiu do totem, a pedido do Rafael: a tela abre já na
primeira categoria (`catInicialTotem()`, chamada em `irTotem(2)`).

## V104 — a rolagem do Plano de Contas, e a tela de fora a fora

**Por que não aparecia barra de rolagem.** A coluna era flex e a lista tinha
`overflow-y:auto`, mas entre as duas existe `.arvore`, que não era item
flexível. A corrente de altura quebrava ali: a lista nunca recebia altura
definida, crescia para fora do quadro e o navegador não tinha o que rolar.
Agora `.arvore` também é `flex:1;min-height:0`, e a rolagem cai em `.arvBody`,
que é onde a lista mora. A barra ficou visível de propósito (10px, com trilho),
porque numa lista de 125 itens ela precisa ser vista.

**De fora a fora.** Saíram o respiro de 16px, a borda, o canto arredondado e a
sombra das colunas. Ficou um risco só no meio separando receita de despesa. O
título mantém o respiro dele.

Conferido em Chrome headless com as pastas abertas: as duas colunas rolam
sozinhas e o cabeçalho e o botão de cadastrar ficam parados.

## V105 — telas financeiras de fora a fora

Várias telas ficavam numa faixa estreita no meio de um fundo cinza — em
monitor de 1900px sobrava moldura e faltava conteúdo. O limite de largura
estava em dois lugares: no atributo `style` de quatro telas e no CSS de dois
contêineres.

Tirado de:

- `telaContas` (Contas Bancárias) — `max-width:920px`
- `telaComprasSemVinculo` — `max-width:1080px;margin:0 auto`
- `telaGruposIng` (Grupo de Ingredientes) — `max-width:860px`
- `telaGerarDemo` — `max-width:820px`
- `.cxWrap` — `max-width:1180px;margin:0 auto`
- `.cfgWrap` — `max-width:1080px;margin:0 auto`

E o respiro lateral do `.finWrap` foi a zero: o painel encosta na borda da
tela, sem canto arredondado e sem borda nos lados. Só o título mantém o
respiro dele, para não ficar colado.

Continuam com largura limitada, de propósito: a **janela da ficha técnica**
(`.fichaMod`, 1180px) e a grade do **"Leve também"** do totem (980px) — as
duas são caixas sobre a tela, não telas.

## V106 — Fornecedores: busca no topo e tela cheia sem cartão

Tirar o limite de largura (V105) não bastou. Sobrava a borda cinza dos dois
lados e embaixo, e quem rolava era a **página inteira** — o painel branco
passeava como um cartão dentro do fundo cinza.

Entrou a classe `.telaCheia`, que muda três coisas:

- a página não rola (`overflow:hidden`) e a rolagem passa a ser da **tabela**,
  via `.pnl2B{flex:1;min-height:0;overflow:auto}`;
- o painel deixa de ser cartão: sem borda, sem canto arredondado e sem sombra,
  com um risco só separando do cabeçalho;
- a linha do título fica parada no topo.

O campo de busca saiu de baixo do título e foi para a **mesma linha**, entre o
título e o botão de cadastrar (`.buscaTopo`).

Medido em navegador: `#content` 700px → `.finWrap` 700 → `.pnl2` 629 →
`.pnl2B` 593 com 1196 de conteúdo. A tabela rola por dentro e nada transborda.

Abaixo de 820px a página volta a rolar inteira, que é o certo no celular.

## V107 — largura total não é texto colado na quina

A V105 tirou a faixa central de Compras sem Vínculo levando junto o
`padding-left/right:22px` que estava no mesmo atributo `style`. Resultado: o
"De" do calendário encostou na borda esquerda e o total ficou rente à direita,
quase cortado no notebook.

**Largura total é uma coisa; margem interna é outra.** A tela ganhou um corpo
próprio (`.mvCorpo`) com 18px dos dois lados — 12px abaixo de 820px — que rola
sozinho, com a faixa do título parada em cima. E o cabeçalho dos painéis
`.pnl2` dentro de `.finWrap` também recebeu os mesmos 18px, para alinhar com o
título da tela.

Conferido em navegador antes de publicar, em 1600px: nada encostando na quina
e o total inteiro na tela.

**Lição, para valer nas próximas:** ao tirar `max-width` de uma tela, conferir
se o mesmo atributo não carregava o respiro lateral — e olhar a tela renderizada
depois, não só o código.

## V108 — custo médio editável na contagem de estoque

Pedido do Rafael: durante a contagem, quem está com o produto na mão vê a
etiqueta e sabe o preço de hoje. A banana está a R$ 5,00 no cadastro e ele
acabou de pagar R$ 6,00 — quer corrigir ali mesmo.

**Isso é uma exceção deliberada à regra do sistema.** Custo de insumo não se
digita: sai da nota de entrada pela média ponderada. A contagem é a exceção
legítima, porque é uma conferência física do que existe e do que vale.

Como ficou:

- A coluna **Custo médio** virou campo. Em branco mostra o custo do cadastro
  como marca-d'água; digitado, fica destacado em dourado.
- `custoCont(item)` é o custo que vale **na tela**: o digitado, se houver,
  senão o do cadastro. Todas as contas — diferença, sobra, perda, resultado,
  rodapé — passaram a usar essa função.
- **Nada muda no cadastro enquanto se digita.** O valor fica em `CT2.custo` e
  só é gravado ao **finalizar a contagem**, junto do ajuste de estoque.
- Antes de finalizar, a confirmação lista item por item o que vai mudar
  (`Banana Fruta: R$ 5,00 → R$ 6,00`) e avisa que o novo custo passa a valer em
  todas as fichas técnicas que usam o item.
- O histórico da contagem guarda `custoAnterior`, `custo` e a lista `precos`,
  e a tela de detalhe mostra "custo corrigido: R$ 5,00 → R$ 6,00".

O efeito em cascata é automático: o custo da ficha técnica é calculado a partir
de `custoAtual()` de cada ingrediente na hora de exibir, então basta gravar no
insumo para todas as fichas, o CMV e os relatórios seguirem o valor novo.

Também nesta versão: o cabeçalho e os filtros da contagem ficaram mais baixos
(classe `.ctCheia`, só nesta tela) para a lista de insumos levar a maior parte
da altura.

Testes: 9 casos de `custoCont` — campo vazio, valor digitado, apagado, texto
inválido, zero, item sem custo e item inexistente.

## V109 — a regra da rede invertida: sem liberação, a unidade não vê

Até aqui, item sem marcação ia para **todas** as unidades sozinho. Era o
padrão que eu tinha escolhido, "para item novo chegar em todo lugar sem
ninguém precisar liberar". O Rafael apontou que isso inverte o propósito da
tela: a matriz não liberava — ela **tirava**. E franquia nova nascia
enxergando o cardápio inteiro, inclusive sabor que ela não vende.

A regra passou a ser a de um ERP com matriz por cima:

1. **A matriz enxerga tudo**, sempre. A marcação nem é consultada.
2. **Unidade não vê nada de outra unidade.**
3. **Sem liberação, a unidade não vê.** Lista vazia significa *ninguém* —
   não significa todos.

Para dizer "todas, inclusive as futuras" entrou a marca `'*'` na lista
(`TODAS_UN`), com o helper `marcadoTodas()`. O checkbox "Todas as unidades"
passou a gravar `['*']` em vez de `[]`, no formulário de cadastro e na tela
de Liberação por Unidade. Item que não foi liberado para ninguém aparece na
lista com a etiqueta **"só a matriz"**, e o contador de "restritos" passou a
significar "não está em Todas".

**Nada quebrou na virada** porque, naquele momento, todo o cadastro da Jolô já
estava marcado explicitamente para Santa Fé do Sul: 290 insumos, 139 fichas,
32 produtos, 6 categorias, 13 grupos de ficha. Santa Fé continuou vendo o que
via; Jales continuou sem ver, que era o esperado.

**Efeito no dia a dia, e é intencional:** produto novo criado na matriz nasce
invisível para as unidades até ser liberado.

Testes: 13 casos — item novo, liberado para uma, liberado para todas, sabor de
outra unidade, matriz, unidade criada depois e contagem de restritos.

## Em aberto

`fornecedores` está em `CADASTROS_LIB`, mas a tabela **não tem coluna
`sucursais`** — a liberação de fornecedor funciona no aparelho e se perde na
sincronização. Conferir as demais coleções da lista antes de confiar na
liberação delas.

## V110 — a Contagem lia o saldo da unidade errada

O Rafael abriu duas abas, uma na matriz e outra em Santa Fé do Sul, e as duas
mostravam o mesmo saldo — 5 unidades de BASE CHOCOLATE, que é o número da
matriz. Santa Fé tem 21.

O saldo real mora em `estoque_unidade`, uma linha por item **por unidade**.
`insumo.estoqueAtual` e `insumo.custo` são só o **espelho** da unidade aberta,
preenchido por `espelharEstoque()`. A tela de Estoque chamava a função; a de
**Contagem, não**. Ela mostrava o que tivesse sobrado do último espelho — na
prática o saldo da matriz, mesmo com Santa Fé selecionada.

`telaContagem()` passou a chamar `espelharEstoque()` logo depois de
`baseMov()`. Vale para as duas abas da tela, histórico e nova contagem.

**Gravidade:** contar com o número da unidade errada gera ajuste errado. Se a
contagem tivesse sido finalizada assim, o estoque de Santa Fé seria corrigido
contra o saldo da matriz.

**Vale conferir o resto:** outras telas que leem `estoqueAtual` sem chamar
`espelharEstoque()` têm o mesmo defeito. Varrer as chamadas antes de confiar.

## V111 — cada unidade conta a sua, e isso passa a sobreviver à sincronização

Auditoria pedida pelo Rafael: "cada loja faz a contagem dela, tem que ficar
salvo em cada loja, não pode misturar". O saldo e o custo médio já eram por
unidade de verdade (`estoque_unidade`, uma linha por item por loja, e a nota
de entrada já recalcula o custo médio só de quem comprou). **O que falhava era
o carimbo de quem fez o quê:**

- **Contagem** — o aparelho sabia a loja, mas o campo **não subia**: chegava
  vazio na nuvem. E o histórico da tela listava **todas as contagens sem
  filtrar** — o inventário de Santa Fé apareceria em Jales, com itens e valores.
- **Movimentação** — o envio mandava `sucursal_id`, o **download não lia de
  volta**. Depois da primeira sincronização todo movimento ficava sem dono na
  memória.
- **Ordem de produção** — mesmo defeito.

Corrigido: `sucursal_id` entra no `campos` da contagem, e as três coleções
passam a ler a unidade no download. A contagem nasce com `sucursalId`, e o
histórico só mostra a da unidade aberta — contagem antiga sem carimbo fica
com a matriz, para não sumir de vista.

As 4 linhas órfãs que já existiam (3 movimentações e 1 ordem) foram carimbadas
com a matriz, que é onde foram feitas.

Testes: 6 casos do histórico — Santa Fé, Jales, matriz, registro sem carimbo,
vazamento entre unidades e o filtro de data junto com o de unidade.

## V112 — o login da unidade abre na unidade dele

O Rafael entrou com `santafe@jologelato.com.br` e o seletor mostrava **Matriz**.
Estava vendo o estoque da matriz achando que era o de Santa Fé — e foi isso, e
não a carga, que fez o saldo "não atualizar" por horas.

**Causa.** `perfis.sucursal_ref` do login apontava para `suc_mt1unjwjn3tq`,
unidade que não existe: sobra do duplo clique que criou e apagou a primeira
Santa Fé. A referência quebrada estava em **dois lugares** —
`usuarios_sistema.sucursais`, que eu já tinha corrigido, e `perfis`, que eu não
tinha conferido. Como a unidade não era encontrada, `lojaAtual()` caía em
`a[0]`, a primeira da lista, que é a Matriz. **Sem nenhum aviso.**

`lojaAtual()` passou a escolher com ordem, e a última palavra não é mais a
Matriz:

1. a unidade do perfil, **se existir**;
2. a única unidade liberada para o usuário (`unidadeDoUsuario()`), que cobre
   perfil quebrado ou ausente;
3. só então a primeira da lista — e apenas para quem circula entre unidades,
   que na prática é a matriz.

E se o perfil apontar para unidade inexistente, aparece um aviso na tela em vez
de trocar de loja em silêncio.

Testes: 9 casos — login de unidade, perfil quebrado, sem perfil, franqueadora,
matriz que escolheu outra loja, gerente com memória apontando para a matriz,
usuário com duas unidades, e quem pode trocar.

**Lição:** a mesma referência de unidade vive em `usuarios_sistema.sucursais`
e em `perfis.sucursal_ref`. Corrigir uma e não a outra deixa o acesso
meio-quebrado, do jeito mais difícil de perceber.

## V113 — a venda também precisa saber de qual loja é

Descoberto ao subir o faturamento de Santa Fé: o envio de `pedidos` **não
mandava `sucursal_id`** e o download **não lia**. Na memória a venda ficava sem
unidade, e todo relatório que faz `p.sucursalId||'suc_matriz'` jogava a venda
inteira na matriz. Com duas lojas operando, o faturamento de Santa Fé
apareceria na matriz e Santa Fé ficaria zerada.

Corrigido nos dois sentidos. Atenção ao tipo: `pedidos.sucursal_id` é **uuid**,
não `ref_local` como nas outras tabelas — por isso vai por `fk('sucursais',…)`
na subida e por um mapa uuid→ref_local (`mapaSucPed`) na descida.

## Carga do faturamento de 18/08 — Santa Fé do Sul

19 vendas, 211 itens, **R$ 4.777,40**, todas em Santa Fé do Sul, fase
`entregue`, canal `pdv`, origem `importado`, pagamento em Dinheiro.

**Sem baixa de estoque, por decisão do Rafael.** A posição de estoque que ele
mandou é de 20/08, ou seja, já depois dessas vendas: o consumo já está
descontado nela. Lançar pela porta do banco não dispara `aplicarMovimento`,
então o estoque continuou exatamente em R$ 22.820,12.

Preços corrigidos no cardápio, todos com divisão exata no relatório: Copo P
15 → **18,00**, Copo M 20 → **22,00**, Coca Zero 0 → **6,00**, Batido 300 →
**22,65**, Batido 500 → **29,95**. Cascão 1 Bola e 2 Bolas ficaram como estavam
(22 e 25): as médias deram 20,25 e 25,67, número quebrado, sinal de desconto.

Criados 5 produtos que existiam no PDV antigo e não no cardápio: Cascão
Chocolate 1 Bola, Cascão Chocolate 2 Bolas, Cascão Tradicional Avulso, Cascão
Chocolate Avulso e Taxa de Entrega.

**Ficaram de fora as 3 bordas** (Nutella, Creme Ninho, Creme Pistache), R$ 15,00
no total — o Rafael disse que criaria os adicionais. Por isso o faturamento
lançado é R$ 4.777,40 contra R$ 4.792,40 do relatório.

## V114 — trava de unidade nos painéis de venda

O Rafael trocou o seletor para Jales e o faturamento de Santa Fé continuou na
tela. Os painéis filtravam **só pelo seletor de sucursais do próprio painel**,
que nasce em "Todos" — a unidade aberta não era consultada em lugar nenhum.

O corte por unidade não pode depender de cada painel lembrar de filtrar. Passou
a ser feito **na porta**, junto com o período, em `pedsPeriodo()` e
`pedidosDeSuc()`, via `vendaDaUnidadeAberta()`:

- **matriz aberta** → vê a rede inteira; é para ela que existe a comparação
  por loja e o filtro de sucursais do painel;
- **qualquer outra unidade** → só a própria venda, e o filtro do painel não
  consegue trazer a de outra.

Testes: 8 casos — matriz, Santa Fé, Jales, venda cancelada, filtro do painel na
matriz, e tentativa de pedir a venda de outra unidade estando dentro de uma.

**Ainda a conferir:** há 46 lugares que varrem `DB.pedidos` direto. Os painéis
principais passam por `pedsPeriodo`/`pedidosDeSuc` e estão cobertos; os demais
(caixa, comandas, entregadores, cupons) precisam ser auditados um a um.

## V115 — a venda multiplicava os itens a cada sincronização

Descoberto ao apagar a carga de 18/08: as 19 vendas tinham **528 itens** e
**494 pagamentos** em vez de 19 e 19. E a venda de teste que já existia,
`ped_mt0twvxrnleb` — um Copo P cancelado de R$ 15,00 — tinha **10.024 itens e
14.522 pagamentos**, somando R$ 150.360 no relatório por produto.

**Causa.** No envio, o item que ainda não tem identificador ganha um
(`o.id = pai_j_random`) e esse id é gravado no próprio objeto. Mas o
**download reconstruía a lista de itens sem o `id`**. A cada sincronização os
itens voltavam "novos", ganhavam um `ref_local` aleatório no envio seguinte e
eram **inseridos de novo**. O índice único é por `ref_local`, então nada
barrava: cada rodada de sync criava uma cópia de todos os itens de todas as
vendas.

A ficha técnica já lia `id:i2.ref_local` — por isso nunca duplicou. Faltava o
mesmo no pedido.

Corrigido em `pedido_itens`, `pedido_pagamentos`, `entregador_taxas` e
`caixa_movimentos`, que tinham o mesmo defeito. `opcoes`,
`subcategorias_financeiras` e `areas_zonas` já liam o id de volta.

Limpeza: 10.023 itens e 14.521 pagamentos duplicados apagados, mantendo uma
linha de cada combinação. A venda de teste voltou a 1 item e 1 pagamento.

**Padrão a checar em toda lista-filha nova:** se o download não devolve o
`id`/`ref_local` do filho, ele duplica em toda sincronização — silenciosamente,
porque o total do pai continua certo e só o detalhe por produto incha.

## V116 — varredura das listas-filhas e rede de segurança

Pedido do Rafael depois da V115: "vê se pode acontecer de novo em outro lugar e
já resolve, não dá para descobrir no meio da operação".

**Varredura das 8 listas-filhas do mapa de sincronização** — `ficha_itens`,
`pedido_itens`, `pedido_pagamentos`, `pedido_base_itens`, `opcoes`,
`entregador_taxas`, `caixa_movimentos`, `areas_zonas`,
`subcategorias_financeiras`:

- **Devolvem o `id` no download?** Todas, agora. As quatro que não devolviam
  foram corrigidas na V115.
- **Têm índice único no `ref_local`?** Todas menos `pedido_base_itens`, que
  estava sem trava — criado `uq_pedido_base_itens_ref`. Sem ele, o item do
  Pedido de Base duplicaria do mesmo jeito assim que a franquia começasse a
  pedir base, e essa tela ainda não rodou em produção.
- **Já existe duplicata gravada?** Nenhuma, nas 8 tabelas. Conferido por
  chave de negócio, não por `ref_local`.

Fora das listas-filhas, as únicas tabelas com `ref_local` sem trava são as de
backup (`bkp_*`), o `audit_log` — que é histórico e deve aceitar repetição — e
`whatsapp_config`, que está vazia.

**Rede de segurança:** `conferirFilhosRepetidos()` roda depois de cada download
e avisa no registro da nuvem (e num toast, para a matriz) se alguma venda,
ficha ou caixa voltar com a mesma linha repetida. Não apaga nada — só acende a
luz. O defeito da V115 não dava erro nenhum: o total do pai continuava certo e
só o detalhe inchava. Foi descoberto por acaso.

Duas linhas iguais do mesmo produto com quantidades diferentes **não** contam
como duplicata — isso é venda legítima.

Testes: 7 casos da rede de segurança.

## V117 — o cardápio digital não gravava nada

O Rafael preencheu WhatsApp, Instagram e endereço, trocou de aba e voltou: em
branco. **Os campos da tela nunca foram gravados.** `ligarCardapio()` só tinha
`oninput` para atualizar a prévia; nada escrevia na configuração, e não havia
botão de salvar. Tudo que era digitado morria na troca de aba.

- Entrou `salvarCardapio()`, que lê os campos das quatro abas — título,
  slogan, WhatsApp, Instagram, endereço, aviso, cores, chave Pix, tempos,
  pedido mínimo, e as chaves de ativo/entrega/retirada/CPF. O que não está na
  tela é ignorado.
- **Barra de salvar fixa no rodapé**, visível nas quatro abas.
- Trocar de aba e trocar de loja passam a salvar antes, para nada se perder no
  caminho.

**O interruptor "No cardápio" estava invisível.** `.miniSw` é um `label`, que é
inline — largura e altura não valem em elemento inline. Dentro de um flex ele
virava item flexível e funcionava; solto numa célula de tabela ficava com
tamanho zero, e só aparecia a bolinha branca do `:before`. Era o que o Rafael
via na aba Produtos: um pontinho branco no vazio. Resolvido com
`display:inline-block`, mais um contorno leve para o estado desligado ficar
visível.

A caixa da logo e da capa foi de 118px para 96px de altura.

**Pendente:** o Rafael pediu um controle de zoom/enquadramento para a foto de
capa. Não foi feito nesta versão.

## V118 — horário do cardápio preenchido de uma vez

Preencher sete dias um a um é trabalho à toa: na prática a loja abre no mesmo
horário a semana quase inteira e muda só no domingo. Digitar catorze horários
para mudar dois é o tipo de coisa que faz ninguém manter o cadastro em dia.

Entrou uma barra no topo da lista: um horário de abertura, um de fechamento, e
quatro botões — **Seg a Sex · Seg a Sáb · Sáb e Dom · Todos os dias**. Aplica no
conjunto escolhido e **reabre quem estava fechado**, porque quem escolhe um
horário para o dia está dizendo que ele funciona. Depois é só ajustar a exceção
no dia certo.

Entrou também `fecharDias()`, que marca um conjunto como fechado **sem apagar o
horário** — assim reabrir depois não exige redigitar.

Testes: 10 casos — cada conjunto, dias não tocados, reabertura, fechar sem
perder o horário, e campo vazio não alterando nada.

## Link curto por loja — joiagest.com.br/santafe

O cardápio abria numa tela de "escolha a loja". O Rafael queria um link por
unidade, para divulgar em cartão e no Instagram.

No `delivery`, o `?loja=` passou a aceitar **o apelido e o nome da loja**, sem
acento e sem espaço, além do código interno: `?loja=santafe`, `?loja=jales`.
Quem entra por esse link não passa pela tela de escolha, mas continua podendo
trocar de unidade pelo seletor do topo.

E, para o link ficar curto, entraram três pastas no repositório do **sistema**
— `santafe/`, `jales/`, `alphaville/` —, cada uma com um `index.html` que só
redireciona. Como `joiagest.com.br` já é servido por esse repositório, os
endereços saem de graça, sem subdomínio, sem mexer no Cloudflare e sem tocar
na entrada do sistema. O workflow do Pages precisou de um `cp -r` próprio: ele
copiava só arquivos soltos e ignoraria as pastas.

Também no `delivery`: sem loja escolhida, a capa e a logo caíam nas imagens de
exemplo do repositório (`img/capa.jpg`) — quem tinha acabado de subir a própria
capa via outra foto na abertura. Agora vale a marca da rede (`cfgRede()`). E a
logo saiu do meio da capa, onde tapava o produto e repetia o que já está na
barra de cima.

## V119 — o cardápio perdia o que tinha sido salvo, e o link agora é o curto

**O nome do cardápio voltava sozinho ao valor antigo.** A descida de
`cardapio_config` escrevia por cima de `DB.cardapio[sid]` **sem olhar nada** —
sem `volta()`, sem `_ANT`, sem comparação. Quem salvava e ficava um instante
sem enviar (offline, fila de envio, ou só o intervalo entre uma coisa e outra)
via o campo voltar. Foi o que aconteceu com "Jolô Gelato SFS": o Rafael salvou,
a descida veio antes do envio e restaurou o título antigo.

Agora a configuração local guarda `_salvoEm`. Se ela for mais nova que o
`atualizado_em` da nuvem, a descida não encosta e o envio seguinte leva a
versão do aparelho. `salvarCardapio()` também passou a chamar `agendarSync()`,
para o envio sair na hora em vez de esperar o próximo ciclo.

**O link público** passou a ser o atalho curto por loja
(`linkCardapio()`): `joiagest.com.br/santafedosul`, `/jales`, `/matriz` — do
apelido da unidade, sem acento e sem espaço. O botão Copiar link e o Ver o
cardápio seguem o mesmo endereço. Loja sem apelido usa o nome; loja
desconhecida cai no endereço completo.

Como o apelido de Santa Fé é "Santa Fé do Sul", o atalho é `/santafedosul`.
A pasta `/santafe` ficou como apelido alternativo — as duas funcionam.

Testes: 5 casos de `linkCardapio`.

## V120 — a medida da foto escrita embaixo, e as colunas destrocadas

Sem a medida, cada um manda uma foto de um jeito e o resultado no cardápio sai
torto. Abaixo de cada moldura agora está escrito o que se espera:

- **Logo — quadrada, 512 × 512 px, fundo claro**
- **Foto de capa — deitada, 1200 × 600 px, o produto no meio**

**E a moldura da logo era enorme por um motivo bobo:** as duas imagens estavam
numa `.row2`, que é `1fr 240px`. Como a logo vem primeiro no HTML, ela ficava
com a coluna larga e a capa com a estreita — o contrário do que faz sentido.
Entrou `.rowImgs` (`132px 1fr`): a logo num quadradinho do tamanho em que ela
aparece de verdade, a capa larga, na proporção 2:1 do topo do cardápio.

Assim o que se vê no cadastro é o que vai para o ar.

## V121 — a configuração do cardápio nunca subia

O Rafael salvava o nome e a frase do cardápio, o campo aceitava, e a nuvem
continuava com o valor antigo. A V119 tratou um sintoma — a descida apagando o
que ainda não tinha subido —, mas a causa era outra e estava mais fundo.

**O envio descarta todo registro sem `_loja`**, marcando-o como "tenant
desconhecido". Em silêncio: sem erro na tela, sem entrada no log. Quem põe esse
carimbo é `carimbarOrigem()`, que percorre o DB e **só entra em coleção que é
array**. `DB.cardapio` é um **mapa por unidade**, não um array — nunca foi
carimbado. E `DB.cardapioL`, derivado dele na hora do envio, nascia igualmente
sem carimbo, e era filtrado fora **toda vez**.

Ou seja: desde que a trava de tenant entrou, **nenhuma configuração de cardápio
jamais chegou à nuvem**. O que está lá veio de antes.

O carimbo agora é posto na montagem de `DB.cardapioL`: da própria configuração,
se ela já tiver, senão da sessão aberta.

**Padrão a checar:** qualquer coleção que seja mapa e não array está fora do
`carimbarOrigem()` e, portanto, fora do envio. Vale varrer o DB atrás de outras.

Testes: 7 casos da montagem e do filtro do envio.

## V122 — o robô do WhatsApp: caminho de volta, salvar por loja e o link curto

**O botão "Canais" sumia.** `telaZap(dentro)` só mostrava o caminho de volta
quando recebia o argumento — e toda troca de aba, de loja ou salvamento chama
`telaZap()` sem ele. Quem entrava por Canais, clicava numa aba e queria voltar
ficava sem saída. A origem agora fica em `ZP.dentro`.

**O nome da atendente "não salvava".** Salvava sim — na loja errada. A
configuração é por unidade, e o Rafael digitou "Carla" dez vezes com o seletor
na Matriz, conferindo depois em Santa Fé, que continuava "Nina". O banco
confirmou: `zap.suc_matriz.iaNome = Carla`, `zap.suc_mt1unhbx2xrb.iaNome =
Nina`. O botão ficava no topo, longe do campo, e nada dizia para qual unidade
ia. Agora há uma **barra fixa no rodapé com o nome da loja escrito**, e trocar
de aba ou de loja salva antes.

**O link que o robô manda** passou a ser o atalho curto da unidade
(`linkCardapio`), em vez do endereço fixo do GitHub.

## O que travava a conexão do WhatsApp — e não era nada do que parecia

Quatro camadas, descobertas nesta ordem:

1. **CORS** — `joiagest.com.br` não estava entre as origens liberadas do robô.
2. **`daMinhaLoja`** comparava `req.params.loja` com `perfil.loja_id`. O
   primeiro é a **unidade** (`suc_...`), o segundo é o **uuid da empresa**:
   403 para todo mundo, sempre. A tela traduzia isso como "não consegui falar
   com o robô", o que mandou a investigação para o Render.
3. **`whatsapp_sessoes` com RLS ligado e nenhuma política** — o Postgres
   recusa tudo nesse estado.
4. **A causa real:** o gatilho `bump_loja_versao`, presente em 40 tabelas,
   converte `loja_id` para uuid. `whatsapp_sessoes` é a **única** em que essa
   coluna é `text` e guarda a referência da **unidade**. A conversão falhava e
   **derrubava a gravação inteira** — a sessão nunca era salva e o pareamento
   morria em `408` depois de cinco QRs. O gatilho passou a ignorar valor que
   não seja uuid; nas outras 39 nada muda.

Depois disso: **42 chaves de sessão gravadas**, WhatsApp conectado no
5517996546445.

**Lição:** o log do Render mostrava `QR gerado` cinco vezes e `caiu (408)` —
o padrão exato de "pareamento não fecha". O que fechou o diagnóstico foi
tentar a gravação direto no banco e ler o erro do Postgres.

## V123 — a trava da V119 congelou a configuração do cardápio

O Rafael dizia que o horário e o endereço "voltavam sozinhos" depois de salvar.
O banco mostrava o contrário: **os dados estavam lá e corretos** — endereço
"Avenida Navarro Andrade", horários 12:30–23:00 de segunda a sábado, domingo
13:00–23:00. O que estava errado era a tela.

**Defeito meu, criado na V119.** Aquela versão pôs uma trava: a descida não
escreve por cima quando o aparelho tem algo mais novo, comparando `_salvoEm`
local com `atualizado_em` da nuvem. Só que o envio **nunca mandou
`atualizado_em`** — o campo ficava congelado na data de criação da linha. Com
a nuvem sempre "mais velha" que qualquer edição local, a trava passou a valer
para sempre: o aparelho parou de aceitar o que vinha da nuvem, cada aba ficou
com a sua própria versão, e a aba com dado velho gravava por cima da nova.

Duas correções:

- `atualizado_em` passa a subir junto, com a hora do envio;
- a trava **expira em 5 minutos**. Passado esse tempo, o que veio da nuvem
  manda — senão um aparelho com relógio adiantado, ou com envio falhando,
  fica ilhado para sempre.

**Padrão:** trava baseada em comparação de data só funciona se a data do outro
lado for realmente atualizada. E toda trava desse tipo precisa de prazo.

## V124 — o Salvar das respostas lia a memória, não a tela

O Rafael cadastrou a resposta sobre franquia, clicou em Salvar, e o banco
gravou `respostas: []`. A linha foi atualizada — o Salvar rodou —, mas a lista
subiu vazia.

Cada campo de palavra-chave gravava no objeto pelo `onchange`, que só dispara
quando o campo perde o foco. Quem digitava e clicava direto em Salvar, ou
trocava de aba, podia perder o que tinha acabado de escrever. E sem erro
nenhum: o banco recebia lista vazia e aceitava.

`salvarZap()` agora **varre os campos da tela**, do mesmo jeito que já fazia
com o nome da atendente e as regras. Linha sem palavra-chave e sem texto é
descartada.

**Padrão:** onde o Salvar depende de `onchange` para ter capturado o valor, o
usuário perde dado ao clicar direto no botão. Ler da tela no momento de salvar
é o único jeito confiável.

## V125 — as perguntas e respostas do robô ficaram legíveis

Eram dois campos nus lado a lado, dentro de uma coluna com altura travada em
`calc(100vh - 300px)`: o texto da resposta aparecia cortado em duas linhas e
não dava para saber o que já estava cadastrado. O Rafael quase cadastrou de
novo uma resposta que já existia.

- Cada resposta virou um **bloco numerado**, com rótulos em palavras —
  *"Quando o cliente falar em"* e *"Responder"* — e a caixa de texto com
  altura para o texto inteiro.
- O cabeçalho mostra **quantas existem**.
- A coluna cresce com o conteúdo em vez de espremer numa janelinha.
- Depois de salvar, o rodapé passa a dizer **"salvo às 09:34"** no lugar da
  frase da loja — confirmação de que gravou, que era o que faltava.

## V126 — a opção escolhida baixa estoque, e a tela para de pular

Três coisas apontadas pelo Rafael enquanto vinculava as fichas ao cardápio.

**A opção não saía do estoque.** `baixarEstoqueVenda()` olhava só o produto e a
ficha dele. Borda de Nutella, cobertura, Ovomaltine: o cliente escolhia, o
insumo sumia do pote e **não sumia do sistema** — perda invisível, que só
apareceria na contagem, sem ninguém saber de onde veio.

- `opcoes.ficha_id` (uuid → fichas_tecnicas) entrou no banco, sobe e desce na
  sincronização.
- O cadastro da opção ganhou o campo **ficha técnica**, ao lado do nome e do
  valor adicional.
- A baixa da venda passa a explodir cada opção escolhida, na quantidade do
  item. Opção antiga, sem vínculo gravado, é procurada **pelo nome** da ficha —
  assim as quatro bordas já funcionam sem recadastro.

**A tela pulava para o topo** a cada marcação em Produtos no cardápio. A tela é
redesenhada a cada clique e o navegador volta a rolagem ao começo; com 42
produtos, quem estava no fim era jogado para o início toda vez. `semPular()` já
existia para isso — faltava usar em `togProdCard` e `togCatCard`.

**O grupo de opções** já aparece em todos os produtos, desmarcado, e só vale
onde for marcado. Ficou escrito no próprio cadastro, que antes não dizia.

Testes: 7 casos da baixa por opção — uma borda, três itens, opção sem vínculo
achada pelo nome, opção sem ficha, item sem opções, duas opções no mesmo item e
conversão de unidade.

## V127 — a escolha da ficha na opção virou campo de busca

O `<select>` da V126 era impraticável com 139 fichas: digitar não filtra, o
navegador pula para a primeira ficha que começa com aquela letra, e cada tecla
pula de novo. Quem digitava "borda" ia parar em B, O, R, D, A — cinco fichas
diferentes, sem conseguir apagar nem corrigir.

Virou **campo de texto com sugestão** (`datalist`): digita parte do nome, a
lista filtra, e o vínculo é resolvido pelo nome ao salvar. A comparação ignora
maiúscula e espaço sobrando, o que importa porque as fichas da Jolô estão em
caixa alta e as opções são digitadas em caixa baixa.

Digitou algo que não é ficha? **Avisa na tela** em vez de descartar em silêncio:
*"Não achei a ficha X — a opção ficou sem baixa de estoque."*

Testes: 9 casos — nome exato, caixa alta e baixa, espaço sobrando, campo vazio,
nome pela metade e ficha apagada.

## V128 — cada grupo de opções diz onde é perguntado

O sabor do pote e do batido precisa ser perguntado no **cardápio digital** — o
cliente escolhe sozinho, ninguém está ali para anotar. Na **frente de caixa**,
não: quem atende já ouviu o sabor e serviu, e ser obrigado a marcar de novo na
tela só atrasa a fila.

O cadastro do grupo ganhou **"Onde perguntar"**, com três caixas: Frente de
caixa · Cardápio digital · Totem. `grupoValeEm(g,canal)` decide, e
`gruposDoProduto(p,canal)` passou a receber o canal — o PDV pede `'pdv'`, o
totem pede `'totem'`, e a tela de cadastro não passa canal nenhum, para mostrar
todos.

Regras de borda: **lista vazia = vale nos três**, então tudo que já existe
continua funcionando igual; marcar os três também grava vazio, que é o mesmo
significado; e **nenhum marcado é recusado**, com aviso, porque um grupo que não
aparece em lugar nenhum é só confusão.

Na lista de grupos aparece uma etiqueta — *só cardápio*, *só caixa* — quando o
grupo não vale nos três.

Testes: 9 casos — cada canal, grupo sem escolha, grupo antigo sem o campo,
grupo sem opções e produto sem grupo.

**Pendente:** a coluna `grupos_opcoes.canais` (jsonb, default `'[]'`) **não foi
criada** — a ferramenta do banco falhou em cinco tentativas seguidas. Sem ela, a
escolha funciona no aparelho e se perde na sincronização. Criar assim que a
conexão voltar.

## V129 — o cadastro central de grupos já existia, escondido atrás do nome

O Rafael pediu uma tela para cadastrar e editar todos os grupos num lugar só.
Ela existe desde sempre: é o `abrirGrupos()`, atrás do botão **"Editar
opções"**. O nome não dizia o que fazia — dava a entender que editava as opções
de um produto, não que ali se criam e gerenciam todos os grupos da rede.

- O botão virou **"Grupos de opções"**, com a contagem ao lado.
- O painel passou a mostrar, em cada opção, **qual ficha técnica está
  vinculada** — ou um aviso vermelho *"sem ficha"*, porque opção sem ficha não
  baixa estoque e isso precisa ser visível sem abrir o grupo.
- Cada grupo mostra **em quantos produtos está sendo usado**.

**Lição:** o Rafael pediu uma funcionalidade que já existia. Nome de botão que
descreve a ação errada custa o mesmo que a funcionalidade não existir.

## V129 — "Editar opções" virou "Grupos de opções"

O Rafael pediu uma tela central para cadastrar e editar todos os grupos —
sabores, bordas, coberturas — num lugar só. **Ela já existia**, atrás do botão
"Editar opções", em Gestão de Cardápio. O nome não dizia o que fazia, e ele
procurou uma coisa que estava na frente dele.

- O botão passou a se chamar **Grupos de opções**, com a contagem ao lado.
- Cada opção mostra, embaixo do nome, a **ficha técnica ligada** — verde quando
  tem, "sem ficha" em vermelho quando não tem. Assim dá para conferir a baixa de
  estoque sem abrir grupo por grupo.
- Cada grupo mostra **em quantos produtos está sendo usado**.

**Lição:** o nome do botão é parte da funcionalidade. Uma tela que ninguém acha
é uma tela que não existe.

## V130 — a venda do balcão nascia sem unidade, e isso quebrou três coisas

Primeiro dia de operação real em Santa Fé. O Rafael notou uma venda que "sumiu
ao atualizar". No banco estavam as oito, mas com defeitos em cadeia — todos com
**uma causa só**: `finalizarVenda()` não carimbava `sucursalId`. O totem
carimbava; a frente de caixa, não.

O estrago:

1. **Relatório errado** — quem lê usa `p.sucursalId||'suc_matriz'`, então toda
   venda do balcão contava como da matriz.
2. **Número travado** — `proxNumPedido()` só olha as vendas **da unidade
   aberta**. Como as novas nasciam sem unidade, ficavam fora da conta e o
   número parava: sete vendas seguidas com o número 317.
3. **A venda que sumiu** — duas vendas com o mesmo número aparecem como uma só
   na tela. Estava gravada, escondida atrás da outra.

Correções: a venda passa a carimbar `sucursalId`, `canal` e `origem`; e
`proxNumPedido()` respeita o maior número existente em qualquer venda —
**prefere-se um salto na sequência a dois pedidos com o mesmo número**.

Dados do dia arrumados: sete vendas carimbadas com Santa Fé do Sul e
renumeradas de 317 a 323, na ordem em que saíram.

**Em aberto:** três vendas ficaram **sem forma de pagamento** (13:22, 13:42 e
13:44), sendo que o Rafael marcou em todas. A de 13:22 gravou o *valor* com a
forma vazia, o que aponta para o `fk('formasPag',...)` não resolvendo. Investigar.

## V131 — duas funções para a mesma configuração, e elas discordavam

A Carla dizia "fechada, abre às 14h de terça a domingo" enquanto a tela mostrava
segunda a sábado 12:30 às 23:00. A nuvem dava razão à Carla: horários 14:00–22:30
com **segunda fechada** — e hoje é segunda.

**Causa: eu criei `cardapioAtual()` na V117 sem ver que `cardAtual()` já existia
e fazia o mesmo.** As duas escolhiam a loja por caminhos diferentes:

- `cardAtual()` — se `DB.cardapio[CD.suc]` ainda **não existe**, cai na primeira
  loja da lista, mesmo com `CD.suc` apontando para outra;
- `cardapioAtual()` — cria a entrada da loja escolhida e devolve ela.

O horário é gravado por `setHora()` via `cardAtual()`; o título e o resto por
`salvarCardapio()` via `cardapioAtual()`. Quem trocava da Matriz para Santa Fé
e mexia no horário **escrevia na Matriz** — a tela mostrava Santa Fé, e a nuvem
devolvia o horário antigo dela.

Correção: `cardapioAtual()` virou apelido de `cardAtual()`, e a troca de loja
passa por `trocarLojaCardapio()`, que **cria a entrada da loja escolhida antes**
de qualquer leitura.

Horário de Santa Fé corrigido no banco: 12:30–23:00 de segunda a sábado, domingo
13:00–23:00, nenhum dia fechado.

**Lição, e é a segunda vez nesta semana:** antes de criar uma função de acesso,
procurar se já existe. Duas funções para o mesmo dado é garantia de divergência
— e a divergência aparece longe, num robô de WhatsApp dizendo que a loja está
fechada.

## V132 — receber a mais em dinheiro não é erro, é troco

O caixa lançava uma venda de R$ 20, o cliente entregava R$ 100, e o operador
digitava 100 **justamente para o sistema calcular o troco**. A tela mostrava
"Troco R$ 80" — e logo abaixo recusava a venda: *"pagamentos somam R$ 100 e o
total é R$ 20"*. O campo existe para o caixa não fazer conta de cabeça, e era
essa mesma conta que travava o fechamento.

A conferência exigia soma **exata**. Agora:

- **Faltar continua barrando** — venda paga a menos é erro de verdade.
- **Sobrar só é aceito quando há forma que dá troco** (dinheiro). Cartão e Pix
  continuam exigindo valor exato: ali sobra é erro de digitação, não troco.
- **O pedido guarda o valor da venda, não o que entrou na mão.** O excedente é
  descontado da forma que dá troco antes de gravar. Sem isso o faturamento do
  dia sairia inflado pelo troco, e o fechamento de caixa não bateria.

Testes: 8 casos — R$ 100 numa venda de 20, valor exato, faltando, Pix a mais,
cartão exato, cartão + dinheiro com troco saindo do dinheiro, e diferença de
centavo.

## V133 — caixa aberto é o que não tem data de fechamento

A tabela `caixas` tem **dois campos** para o fechamento: `fechado_txt`, um texto
como "24/08/2026 13:01", e `fechado_em`, uma data de verdade. Só o texto era
gravado; a data ficava sempre vazia. O mesmo valia para `aberto_em`.

Quem consulta pela data — relatório, conferência, qualquer coisa fora do
aparelho — via **todos os caixas como abertos**, inclusive os fechados dias
atrás. Foi o que me fez concluir errado que havia três caixas abertos ao mesmo
tempo e sugerir ao Rafael fechar dois que já estavam fechados.

`dataDoTexto()` converte "24/08/2026 13:01" em data com fuso de Brasília, e o
envio passa a mandar `aberto_em` e `fechado_em` junto com os textos.

Os dois caixas antigos foram corrigidos no banco. Situação real agora: **um
aberto** (24/08, R$ 556,05) e dois fechados.

**Padrão:** dois campos para o mesmo fato é a mesma armadilha da V131 — um
sempre fica para trás, e quem lê pelo campo errado tira conclusão errada.

## V134 — o detalhe do pedido quebrava justamente nos pedidos com problema

Clicar no olho no kanban dava *"Cannot read properties of undefined (reading
'n')"* e a tela não abria. Causa: `FORMAS.find(...)` devolve `undefined` quando
o pagamento chegou **sem forma**, e o código lia `f.n` direto.

A ironia: quebrava exatamente nos pedidos com pagamento incompleto — os que
mais precisam ser olhados. Os outros abriam normal, o que explica o "uns
aparece, outros não".

Agora forma desconhecida aparece como **"forma não informada"**, em vermelho, e
a tela abre. Pedido sem nenhum pagamento mostra **"Sem forma de pagamento
registrada"** com o valor total. Ver o problema vale mais do que escondê-lo.

O detalhe também ganhou o que o Rafael pediu: **situação**, **caixa** de origem
e **troco devolvido**, quando houve. O troco passou a ser guardado no pedido
(`troco`) — sem ele, quem confere depois não entende por que o cliente entregou
mais do que o valor da venda.

## V135 — a forma de pagamento não depende mais do mapa do aparelho

**Causa das 8 vendas sem forma no primeiro dia de operação em Santa Fé.**

`fk('formasPag', o.forma)` traduz a referência local (`fp_debito`) no
identificador da nuvem, usando um mapa que o aparelho monta **antes de cada
envio**. Esse mapa é relido no máximo a cada 5 minutos, e só é forçado quando um
vínculo já falhou antes. Quando ele não está montado — aparelho recém-aberto,
releitura vencida, tabela não lida —, `fk()` devolve **null**.

E aí está o problema: gravava `forma_id: null` **em silêncio**. O caixa fechava
a venda achando que estava tudo certo, e à noite o fechamento não batia. Pior:
a cada nova sincronização o envio reescrevia os filhos do pedido, então
pagamentos que **já estavam corretos** eram zerados de novo — foi o que
aconteceu entre duas conferências minhas no mesmo dia.

Correção em duas pontas:

- o envio manda **`forma_ref`** junto (a referência, que o aparelho sempre tem);
- um gatilho no banco (`resolve_forma_pagamento`) preenche `forma_id` quando ele
  chega vazio, buscando por `ref_local` dentro da loja do pedido.

Assim a forma deixa de depender de o aparelho ter o mapa montado. Testado: um
pagamento inserido com vínculo nulo e `forma_ref='fp_pix'` saiu resolvido como
Pix.

Os 8 pagamentos do dia foram preenchidos com a referência, para não voltarem a
zerar na próxima sincronização.

**Padrão, e é o terceiro caso hoje:** vínculo que falha silenciosamente e grava
nulo é pior do que erro na tela. Onde `fk()` puder devolver null num campo que
importa, mandar também a referência e resolver no banco.

## V136 — a causa real: o pagamento voltava com o campo trocado

A V135 tratou um sintoma. **A causa era outra, e mais simples.**

O sistema inteiro lê a forma em `pagamento.forma` — o detalhe do pedido
(`FORMAS.find(y=>y.id===x.forma)`), o fechamento de caixa (`movimentoCaixa`), o
relatório. Mas a descida da nuvem gravava em **`formaId`**.

O efeito em cadeia:

1. depois de **qualquer download**, todo pagamento ficava na memória sem
   `forma`;
2. a tela mostrava "forma não informada" — inclusive nas vendas que estavam
   corretas na nuvem;
3. e o envio seguinte reescrevia o registro com `fk('formasPag', undefined)` =
   **nulo**, apagando na nuvem o que estava certo.

Ou seja: **o aparelho destruía o próprio dado a cada volta**. Foi por isso que
três vendas apareceram corretas às 14h e zeradas às 15h — não era o mapa de
vínculos, era o campo trocado.

A descida agora devolve `forma`, com `forma_ref` como reserva quando o mapa não
souber traduzir, e mantém `formaId` por compatibilidade. O `equipamento`
também voltou a descer — sem ele, o fechamento não separava balcão de totem.

O gatilho da V135 continua valendo como rede de segurança: se algum dia o
vínculo chegar vazio com a referência preenchida, o banco resolve.

**Lição:** nome de campo diferente entre a subida e a descida é um dado que se
apaga sozinho, sem erro em lugar nenhum. Vale varrer as outras coleções atrás
do mesmo padrão.

## V137 — o padrão da tela sobrescrevia o horário de verdade

**Causa dos horários que "somem" a cada atualização — quinze vezes, segundo o
Rafael.**

`baseCard()` cria uma configuração padrão para toda unidade que ainda não tem
uma: 14:00 às 22:30 com segunda fechada. Isso é certo — a tela precisa ter o que
mostrar. O erro era essas configurações entrarem no **envio** como se fossem
escolha do lojista.

A sequência do estrago:

1. Ctrl+Shift+R — o aparelho abre vazio;
2. `baseCard()` semeia o padrão nas quatro unidades;
3. o envio sai antes de a descida terminar;
4. o padrão sobrescreve na nuvem o horário de verdade.

O resultado apareceu no banco: **Matriz, Jales, Alphaville e Santa Fé com o
horário idêntico** — exatamente `horariosPadrao()`. Inclusive Santa Fé, que eu
tinha corrigido para 12:30–23:00 poucas horas antes.

Agora o que nasce padrão fica marcado com `_padrao` e **não sobe**. A marca cai
no primeiro salvamento de verdade — `salvarCardapio`, `setHora`,
`aplicarHorario`, `fecharDias` — e a partir dali a configuração é do lojista e
sobe normalmente.

Testes: 6 casos — depois do recarregamento nada sobe, só a loja mexida sobe, as
outras continuam padrão, e recarregar não apaga o que foi salvo.

**Padrão, e vale para todo o sistema:** dado semeado pelo próprio sistema nunca
pode ser tratado como dado do cliente. Foi a mesma raiz do episódio dos 27
insumos da Rafaelo's — lá a trava foi `NUVEM.zerado`; aqui faltava marca
equivalente.

## V138 — o PDV cabe na tela, e a pastilha "Todos" saiu

Duas coisas pedidas depois do primeiro dia de operação real.

**A pastilha "Todos" saiu.** Mostrar os 42 produtos de uma vez é a lista mais
longa possível, com rolagem garantida — e cada rolagem é tempo na fila. O caixa
trabalha por categoria. A tela agora **abre na primeira categoria**, e a busca
cobre o caso de procurar um item sem saber onde ele está.

**A grade ficou densa o bastante para caber sem rolar:** largura mínima do
cartão de 144px para 118px, foto de 4:3 para 1:1 com no máximo 104px, ícone da
categoria de 62px para 44px, e a coluna da comanda de 360px para 308px. Textos
e margens proporcionalmente menores.

`grid-auto-rows:max-content` entrou junto — sem ele, grade com `overflow:hidden`
nos itens e altura definida no container comprime as linhas e o cartão vira
tarja. Foi o defeito do totem na V103.

## Cardápio digital — vínculo de grupos e ordem das seções

**Os sabores não apareciam no pote nem no batido.** A configuração do Rafael
estava certa; faltava **permissão**. A tabela `produto_grupos` — que liga o
grupo ao produto — tinha uma única política, e ela exige `minha_loja()`, ou
seja, estar logado. Para o cliente do cardápio a consulta voltava **vazia**: os
grupos chegavam, o vínculo não, e nenhuma pergunta era feita. Entrou a política
`cardapio publico - vinculo de grupos`, só de leitura e só para produto de loja
com cardápio no ar. É o mesmo caso da lista de lojas, resolvido dias antes.

**As bebidas abriam o cardápio.** As seções eram montadas na ordem em que os
produtos apareciam na lista — ordem dos **produtos**, não das **categorias**. O
primeiro produto era uma água. A ordem cadastrada em Gestão de Cardápio já
existia (Copo, Cascão, Potes, Bebidas, Sobremesas, Parceiro) e era ignorada.
Agora as seções são ordenadas pelo índice da categoria; categoria desconhecida
vai para o fim.

**Pendente do Rafael:** os três grupos de sabores estão como **opcional** — dá
para fechar um pote de 1 kg sem escolher sabor. Precisa marcar *Pergunta
forçada*. E "Sabores Gelatos 1 Sabor" está com máximo 2.

## V139 — reordenar categoria por setas, porque arrastar não funciona no toque

O Rafael reordenava as categorias e o cardápio continuava abrindo pelas
bebidas. O banco explicou: a ordem **nunca mudou** — continuava a de criação
(Copo 0, Cascão 1, Potes 2, Bebidas 3, Sobremesas 4).

A única forma de reordenar era **arrastar**, e o computador da loja é de
**toque**. O arrasto nativo do navegador não responde ao dedo: ele arrastava e
nada acontecia, sem erro nenhum.

Entraram setas ▲▼ em cada linha, que funcionam no dedo e no mouse. A primeira
não sobe, a última não desce, e a numeração é refeita sem buraco a cada
movimento. `agendarSync()` é chamado junto, para a ordem subir na hora.

Testes: 7 casos — subir, descer, extremos, id inexistente e integridade da
numeração.

**Padrão a checar:** todo lugar que só permite arrastar está quebrado no
aparelho da loja. Vale varrer as outras listas com `ativarArrasto`.

## V140 — o sistema desistia da nuvem no primeiro erro

Dia de instabilidade do Supabase (incidente aberto: *"Erros 401 devido a
rejeições de JWT"*). Testado por fora, sem passar pelo sistema: três consultas
seguidas deram **sem resposta**, **erro 500** e **23 segundos**. As duas contas
do Rafael — Santa Fé e franqueadora — caíram para offline ao mesmo tempo.

Três correções, todas do nosso lado:

**A leitura do perfil era feita uma vez.** Falhou, o sistema se declarava
desconectado e a loja passava a trabalhar só no aparelho. Agora tenta **três
vezes**, com espera crescente — na prática a segunda já passa.

**A reconexão automática era a cada 30 segundos.** Com a loja aberta isso é
tempo demais. Passou para **8 segundos**.

**A tela de pedidos ficava em branco.** `baseStatus()` não semeia as colunas
quando o aparelho está ligado na nuvem e ainda não baixou — trava certa, para o
padrão não subir por cima do que a loja configurou (V137). Mas com o download
falhando, `_baixouUmaVez` nunca ficava verdadeiro e a lista de colunas ficava
vazia: kanban sem coluna nenhuma, com 326 pedidos no rodapé. Entrou
`FASES_SOCORRO`, usada **só para desenhar** — não entra no DB e não sobe.

**E a mensagem mentia.** Dizia "Sem conexão com a internet" quando a internet
estava boa e quem não respondeu foi o servidor. Isso mandou o Rafael procurar
problema no lugar errado. Agora distingue os dois casos.

**Lição:** num sistema que roda em loja aberta, toda chamada de rede precisa de
nova tentativa antes de mudar o estado do sistema. Um erro isolado é normal;
tratá-lo como queda é que derruba a operação.

## V141 — o horário voltava porque existem DUAS descidas do cardápio

O horário de Santa Fé foi corrigido de manhã e **voltou ao padrão às 18:36**,
depois da V137. A trava daquela versão estava certa; o furo era outro.

**Existem duas descidas da configuração do cardápio no mesmo carregamento.** A
primeira traz tudo, inclusive `horarios`. A segunda, mais abaixo, faz
`Object.assign` com uma lista de campos onde **`horarios` não estava** — a
entrada ficava sem horário nenhum.

E aí a armadilha: `cardAtual()` preenche horário vazio com o padrão (14:00 às
22:30, segunda fechada), e essa entrada **não tem a marca `_padrao`**, porque
veio da nuvem. O padrão então subia por cima do horário de verdade.

Duas correções:

- a segunda descida passou a trazer `horarios` (e `endereco`), preservando o que
  já existe quando a nuvem vier vazia;
- `cardAtual()` marca `_padrao` ao preencher horário vazio, para o padrão
  **nunca** subir — a marca cai no primeiro salvamento de verdade.

**Lição:** duas rotinas escrevendo no mesmo objeto, com listas de campos
diferentes, é a mesma armadilha da V131 (duas funções para a mesma
configuração). Vale procurar outros pontos onde isso se repete.

## V142 — abrir a tela de horários gravava o padrão sozinho

Depois da V141 o horário de Santa Fé **voltou de novo ao padrão**, às 22:12.
Havia mais um caminho, e era o pior de todos.

Em `abaLoja()`:

    if(!c.horarios||!c.horarios.length){c.horarios=horariosPadrao();salvar();}

Aquele `salvar()` fazia com que **só abrir a aba de horários** gravasse o padrão
(14:00 às 22:30, segunda fechada) e o mandasse para a nuvem. Ninguém clicava em
nada. E como o objeto não recebia a marca `_padrao`, a trava da V137 não pegava.

Segundo caminho: a primeira descida preenchia `horarios` com o padrão quando a
nuvem vinha vazia, também sem marca.

Correções:

- `abaLoja()` não salva mais; preenche só para a tela, marcando `_padrao`;
- a descida marca `_padrao` quando a nuvem não trouxe horário;
- **trava no banco** (`tg_trava_horario`): se alguém tentar gravar exatamente o
  padrão por cima de um horário já cadastrado e diferente, a atualização é
  recusada e o horário existente é mantido. Horário vazio também é recusado.

**Lição maior:** tapar os caminhos um a um não resolveu — foram três versões.
O que resolve é a trava no banco, que vale independente do que o navegador faça.
Onde existe dado que o sistema semeia sozinho, a proteção precisa estar do lado
do banco, não só do lado da tela.

**Regra de diagnóstico (do incidente de 24/08):** antes de culpar o fornecedor,
verificar o próprio projeto — status, tamanho da máquina, limites, cobrança.
A página de status geral não diz nada sobre um projeto específico, e um
incidente aberto do fornecedor não prova que ele é a causa. "Não tem o que
fazer" é conclusão, nunca ponto de partida. No dia 24/08 a loja ficou horas
parada por causa da máquina Nano marcada como Unhealthy — visível no painel
desde o primeiro minuto.

## V143 — a ficha da opção não subia, e a lista vazia virava "matriz"

**1. O trabalho de vincular fichas às opções sumia a cada atualização.**

A tela deixa vincular uma ficha técnica a cada opção (borda, cobertura, sabor)
para a venda baixar estoque. A descida lê `ficha_id`. Mas a subida mandava só
`nome`, `preco_adicional` e `ordem` — **`ficha_id` não ia junto**.

Consequência: a pessoa vinculava as 58 opções, o botão Salvar dizia que salvou —
e estava certo, salvou no aparelho. Na nuvem o campo ficava nulo. No download
seguinte o aparelho recebia nulo e apagava o próprio trabalho. Sem erro nenhum.

O botão Salvar nunca esteve quebrado. O envio é que estava incompleto.

Mesma armadilha da V135 e da V136. **É a terceira vez.** Campo que existe na
tela e na descida mas falta na subida apaga dado em silêncio. Vale varrer todas
as coleções comparando os campos das duas pontas.

**2. Enquanto carregava, o sistema se declarava matriz.**

Nos primeiros segundos a lista de unidades está vazia. Como nenhuma unidade
"existe", `lojaAtual()` caía na regra do `a[0]` e **gravava** `suc_matriz` em
`DB.lojaAtual` e `S.loja`. Segundos depois os dados chegavam e a tela se
corrigia — daí o nome trocar de Matriz para Santa Fé no canto.

O nome errado era o sintoma visível. O risco real: durante esses segundos o
sistema inteiro se considerava matriz, e o que fosse gravado ali nascia com a
loja errada — exatamente a origem da V130 (vendas do balcão sem unidade).

Agora lista vazia significa "ainda não sei": devolve o que já estava e espera.
`nomeLojaAtual()` também deixou de inventar "Matriz" quando não sabe.

**Lição:** ausência de dado não é resposta. Toda escolha automática feita
enquanto o sistema carrega precisa distinguir "não tem" de "ainda não chegou".

## V144 — a tela de configuração abria na loja errada

O fechamento de segunda foi salvo às 22:37 e o robô continuou dizendo "fechada".
O salvamento tinha funcionado — **mas gravou no Alphaville**, enquanto Santa Fé
seguia com o horário antigo.

Causa: `cardAtual()` e a tela do robô abriam em `sucAtivas()[0]` — a primeira da
lista, que na prática é a Matriz ou o Alphaville. Quem entrava pelo login de uma
unidade abria a tela já apontando para outra loja, sem perceber.

Pergunta do Rafael, que é a regra certa: *"se a loja de Santa Fé entrou pelo
login de Santa Fé, por que aparece para ela salvar na loja do Alphaville? Esse
campo só tem que aparecer na matriz."*

Correções, nas duas telas (cardápio e robô):

- quem não circula entre unidades (`podeTrocarUnidade()` falso) abre **travado**
  na unidade dele, e não consegue apontar para outra;
- o **seletor de loja desaparece** para o franqueado — no lugar, o nome da loja
  dele escrito;
- o botão passou a dizer **"Salvar «nome da loja»"**, para quem circula não
  gravar na unidade errada sem ver.

**Lição:** onde uma tela grava dado por unidade, a unidade tem que estar escrita
no botão que grava. Já tinha sido aprendido na V122 (barra de salvar do robô com
o nome da loja) e não foi aplicado às demais telas por unidade. Vale varrer as
outras.

## V145 — o aviso de fase não chegava ao cliente (Meta recusava)

O pedido chegava no PDV, mas ao mover para "em preparo" o celular do cliente não
recebia nada e aparecia erro dizendo que a Meta não deixou enviar.

Causa: a rota `/enviar` do robô mandava **tudo** pela Meta quando ela estava
disponível. Mas a Meta só permite mensagem livre para quem escreveu para o
número nas últimas 24 horas. O cliente do delivery pede **pelo site** e nunca
escreveu — então a Meta recusa.

Quem fala com cliente é a **Carla (Baileys)**, que não tem essa restrição. Quem
fala com gerente pode continuar na Meta, porque o gerente conversa com o
Assistente todo dia.

- `/enviar` passou a aceitar `destino`; `destino:'cliente'` obriga Baileys;
- os dois envios do ERP que vão para o cliente (confirmação do pedido e avisos
  de fase) passaram a mandar `destino:'cliente'`;
- o aviso ao gerente continua como estava;
- se a Carla estiver desconectada, a resposta diz isso com todas as letras em
  vez de falhar em silêncio.

**Lição:** dois canais de WhatsApp com regras diferentes não podem ser
escolhidos por disponibilidade. Tem que ser escolhido por **para quem é a
mensagem**.

## Cardápio digital — três campos lidos com o nome errado

O cascão adicional está cadastrado a R$ 3,00 no ERP, mas no cardápio aparecia
sem preço e **não somava no total**: o cliente levava dois cascões de graça e o
pedido chegava na loja com valor menor do que devia.

Causa: o banco guarda `preco_adicional` e o cardápio lia `o.preco`, que não
existe. Mesmo defeito do `maximo` lido como `max`.

Varredura comparando todos os campos lidos pelo cardápio com as colunas reais
das tabelas encontrou três divergências:

- `opcoes.preco` → é `preco_adicional` (preço não aparecia nem somava)
- `grupos_opcoes.max` / `.min` → são `maximo` / `minimo` (já corrigido antes)
- `areas_zonas.cidade` → não existe; a cidade é o nome da **área**

Corrigido com funções-ponte (`precoOp`, `cidadeZona`) usadas em todos os pontos,
aceitando os dois nomes. Um lugar só para ler cada campo evita que volte a
divergir.

**Lição:** esta é a quarta ocorrência da mesma família (V135, V136, V143, esta).
Campo com nome diferente entre quem grava e quem lê **nunca dá erro na tela** —
dá zero, nulo ou vazio, e o prejuízo passa despercebido. Vale rodar a mesma
varredura automática nas outras pontas do sistema.

## V146 — "enviada" na tela e nada no celular do cliente

O PDV escrevia "Confirmação enviada" a cada mudança de fase e o cliente não
recebia nada — nem o resumo do pedido, nem "em preparo", nem "saiu para
entrega", nem a avaliação.

Causa, no `enviarPeloBaileys`: a função percorria as variações do telefone e
parava **na primeira que não lançasse erro**. Mas `sendMessage` para um número
que não existe no WhatsApp **não lança erro** — o servidor aceita o envio para
um destino inexistente e devolve sucesso.

O cliente cadastra o telefone como `17997677339`, sem o 55. Essa era a primeira
tentativa, "dava certo", e a função retornava ok. As variações corretas nunca
chegavam a ser tentadas.

Correções:

- antes de enviar, o robô pergunta ao WhatsApp **quem existe** (`onWhatsApp`) e
  só envia para o número confirmado; sem confirmação, erro explícito;
- a ordem das variações mudou: número brasileiro sem o 55 passa a tentar
  `55+número` primeiro, que é o caso mais comum do cadastro;
- variações novas: com e sem o nono dígito;
- o robô devolve o número confirmado, e **a tela só escreve "entregue" quando
  recebe esse número**. Sem ele, diz que não confirmou.

**Lição:** sucesso de chamada não é prova de entrega. Toda integração externa
precisa devolver *o que* foi feito, não apenas que "não deu erro" — senão a
tela mente com a melhor das intenções e ninguém descobre por dias.

## V147 — a tela de cancelamento saía espremida numa linha só

Ao cancelar um pedido pelo kanban, o cartão aparecia todo em colunas lado a
lado — data, cliente, total, motivo, observação, senha — com barra de rolagem
horizontal e campos de um dedo de largura.

Causa: `.cvCard` existe em **três telas diferentes**. A do resumo do caixa usa
`display:flex;align-items:center` e força `display:block` em `span` e `b`
filhos. A do cancelamento não redefinia `display`, então o flex do caixa
continuava valendo. (O bloco de CSS ainda aparece repetido 8× no arquivo, o que
torna a ordem de precedência difícil de prever — vale limpar isso depois.)

As duas telas de cancelamento (o cartão e o detalhe no relatório) passaram a
usar `cnc*`, nome exclusivo, com `display` explícito em cada regra para não
depender de ordem. Os campos ganharam classe própria em vez de estilo solto, e
a dupla operador+senha vira uma coluna em tela estreita.

**Lição:** nome de classe repetido entre telas é a mesma armadilha das duas
funções para a mesma coisa (V131, V141) e dos campos com nome divergente
(V135, V136, V143). Funciona até alguém abrir as duas. Onde uma tela depende de
estilo compartilhado, `display` precisa ser explícito.

## V148 — a senha do usuário nunca chegava à tela de cancelamento

Em `operAtivos()` a senha era lida de `u.senhaCaixa` — campo que **não existe**.
A tabela `usuarios_sistema` guarda `senha` (a mesma do login), e a descida monta
o usuário com `senha`.

Como `senhaCaixa` vinha sempre vazio, `op.senha` ficava vazio e a conferência
era **pulada por completo**: qualquer pessoa cancelava sem digitar nada, e quem
tinha senha designada não conseguia usá-la.

`funcao` também não existe nessa tabela — o que existe é o par `tudo`/`mestre`.
Passou a ser traduzido para o rótulo da tela (administrador / gerente / caixa).

Além disso, a conferência agora exige a senha quando ela existe (antes, campo
vazio passava direto) e avisa quando o operador não tem senha cadastrada, em vez
de aceitar em silêncio.

Os sete motivos de cancelamento estão corretos no banco e ativos; o que impedia
de vê-los era o layout quebrado da V147, que espremia o campo de escolha.

**Quinta ocorrência da mesma família** (V135, V136, V143, cardápio, esta): campo
com nome diferente entre quem grava e quem lê. Aqui o efeito foi pior que perder
dado — foi **desativar uma conferência de segurança sem que ninguém percebesse**.
Vale rodar a varredura automática de campos em todo o `index.html`.

## V149 — cancelamento pergunta se foi produzido, e o estoque segue a resposta

**Regra definida pelo Rafael:**

- ao levar a venda para cancelado, a **primeira** pergunta é *"esse pedido já foi
  produzido?"*;
- **Sim** → o insumo já foi consumido: o estoque **não volta**;
- **Não** → nada saiu da cuba: o estoque **volta**;
- o valor **sai do faturamento nos dois casos**;
- o cancelamento é **sempre da nota inteira** — nunca parcial.

Antes o estoque voltava sempre, sem perguntar. Para gelato montado, cascão
recheado e batido pronto isso inventava saldo que a loja não tem, e o erro só
aparecia na contagem semanas depois.

Não há resposta padrão: sem escolher, o cancelamento é barrado. Chutar qualquer
um dos dois lados produz erro de estoque silencioso.

A decisão fica registrada em `cancelamentos.produzido` e
`cancelamentos.estoque_voltou` (colunas novas), e **sobe e desce** — conferido
por teste de ida e volta, para não repetir o esquecimento da V143. Cancelamento
antigo, sem os campos, continua válido com valor nulo.

## V150 — senha de autorização, separada da senha de entrar

O cancelamento dizia "não tem senha cadastrada em usuários" mesmo para quem
entra normalmente no sistema. Causa: **a senha de entrar não fica no banco**.
Desde a migração, ela vive no serviço de login (Supabase Auth), criptografada —
`usuarios_sistema.senha` está vazia para os logins ativos, e o navegador não
consegue (nem deve) lê-la.

Ou seja: a V148 corrigiu o nome do campo, mas o campo certo também está vazio.
Conferir a senha de login no navegador é impossível por construção.

Criada a coluna `usuarios_sistema.senha_caixa` e um campo próprio no cadastro de
usuários: **senha para autorizar cancelamento**. Curta de propósito (mínimo 4),
para digitar rápido no balcão, e pode ser entregue ao gerente sem dar a senha de
entrar no sistema. Usuário sem essa senha simplesmente não autoriza.

O campo sobe e desce nas **duas** descidas de usuários — a segunda estava, como
sempre, esquecida (mesmo padrão da V141 e da V143).

**Pendências de segurança anotadas:** três usuários ainda têm senha em texto
plano na tabela (`Jolo Alphaville`, `Jolo Gelato`, `Jolô Jales` inativo) —
resquício de antes do Auth, devem ser limpos. E a senha de autorização também
fica em texto plano; para uso no balcão é aceitável, mas vale revisar quando o
login for todo migrado.

## V151 — a tela de Operadores existia e não estava em menu nenhum

`telaOperadores()` estava escrita e funcionando, sem nenhuma porta de entrada:
não havia item de menu nem rota apontando para ela. Quem precisava cadastrar
alguém só para assinar cancelamento e abrir caixa era obrigado a criar um
**usuário**, com e-mail e senha de acesso ao sistema — um login a mais só para
digitar uma senha no balcão.

Adicionada em **Configuração da Loja › Operadores do Caixa**, com o texto
deixando claro que operador **não entra no sistema**: só nome, função e uma
senha curta para autorizar.

Corrigida também uma armadilha achada por teste: quando a mesma pessoa existe
como usuário e como operador, a versão de usuário vencia por vir primeiro. Como
é comum o usuário estar sem senha de autorização e o operador ter, o nome
aparecia mas a assinatura ficava sem senha — valendo qualquer coisa digitada.
Agora, para nomes repetidos, a senha do operador preenche a lacuna do usuário.

**Lição:** tela sem porta de entrada é o mesmo que tela inexistente, e pior —
alguém a mantém no código achando que está em uso. Vale varrer outras funções
`tela*()` sem rota.

## V152 — ITEM 1 da auditoria do PDV: pagamento não era gravado

**Causa raiz encontrada.** A venda subia por `rpc/venda_registrar`, que grava
numa única transação: pedido, itens e movimentação de estoque. **Pagamento não
estava nessa transação** — nem no pacote enviado pelo navegador, nem na função
do banco.

Os pagamentos subiam **depois**, pela sincronização comum, numa segunda viagem.
Entre uma viagem e outra cabe rede que cai, aba fechada, aparelho desligado no
fim do expediente. Quando isso acontecia, a nuvem ficava com a venda
**concluída e sem nenhum pagamento** — e ninguém percebia, porque o aparelho que
fez a venda mostra tudo certo (ele tem o dado local).

**Evidência no banco:** 10 vendas concluídas sem pagamento, R$ 531 — as 6
conhecidas do dia 24 (R$ 379) e mais 4 do dia 25 (nº 341, 345, 346, 348).

Correções:

- o pacote da venda passou a levar `pagamentos` (referência estável, forma,
  valor, equipamento);
- `venda_registrar` grava os pagamentos **na mesma transação** do pedido, com
  `on conflict do update` — reenvio não duplica (teste P4);
- índice único `(pedido_id, ref_local)` em `pedido_pagamentos`;
- a função devolve `pagamentos`, `pago` e `fecha`; quando não fecha, o
  Diagnóstico registra na hora, e não no fechamento do caixa à noite;
- view `vw_vendas_sem_pagamento` para conferência permanente.

Testes contra o banco real: P1 (débito), P3 (dinheiro + Pix), P4 (reenvio sem
duplicar) — todos passaram. 13 testes de unidade no pacote.

**Pendente deste item:** as 10 vendas já gravadas sem pagamento precisam ser
lançadas manualmente — o sistema não tem como adivinhar a forma.

## V153 — ITENS 2 e 3 da auditoria do PDV: dinheiro, troco e pagamento misto

A regra de troco já estava certa desde a V132 — recebido maior que a venda é
aceito quando há forma que dá troco, o pedido grava o valor da venda (não o
recebido), e o troco não entra no faturamento. Os testes P2 e os de pagamento
misto confirmaram isso contra a regra real do código.

Três defeitos reais foram encontrados **na tela**:

1. **o valor só era lido no `onchange`**, que dispara ao sair do campo. Quem
   digitava 100 e tocava direto em Finalizar dependia de o navegador disparar o
   evento antes do clique — no toque, às vezes não dispara. Mesma armadilha da
   V124 (o robô salvando `[]`). Passou a ler a cada tecla, preservando a posição
   do cursor;
2. **não havia ENTER para confirmar** — no balcão, tirar a mão do teclado para
   achar o botão custa tempo em toda venda. Enter no campo de valor finaliza;
3. **o troco aparecia numa linha discreta**, do mesmo tamanho do resto. É o
   número que o operador lê em voz alta para o cliente: agora sai em destaque,
   em caixa verde, com o valor grande.

O rótulo do campo mudou para **"recebido"** nas formas que dão troco, porque o
que se digita ali é o que veio da mão do cliente, não o valor da venda.

24 testes cobrindo: troco simples, valor exato, falta, sobra em Pix/débito
(barrada — ali sobra é erro de digitação), misto dinheiro+Pix com e sem troco,
débito+crédito, e centavos. Em todos, **a receita registrada é a da venda** e o
troco sai apenas da parcela em dinheiro.

## V154 — ITEM 4 da auditoria do PDV: fechamento às cegas

O fechamento cego **já existia no código**, mas com dois furos:

1. **vinha desligado por padrão**, e estava desligado na Jolô (`config_loja.
   caixa_cego = false`). Com ele desligado a tela mostra, antes de o operador
   contar, quanto o sistema espera em cada forma. Conferência com o gabarito na
   frente não é conferência: quem confere ajusta o que conta ao número que está
   vendo, sem má intenção, só por viés. A diferença deixa de existir no papel e
   passa a existir só na gaveta;
2. **o resultado saía num aviso passageiro no rodapé** ("Diferença no dinheiro:
   R$ −10"), que some em segundos. No caixa cego esse é justamente o único
   momento em que o operador pode ver o esperado.

Correções:

- `caixaCego` passou a nascer **ligado**; continua possível desligar em
  Configuração, mas quem desliga faz por escolha e não por descuido;
- ligado agora na Jolô;
- criada a **tela de resultado do fechamento**, que abre depois de confirmar:
  diferença em destaque (verde quando bate, vermelho quando não), esperado,
  informado, vendas do turno, e uma tabela forma a forma com esperado,
  informado e diferença. Forma não informada aparece como "não informado" e
  **não vira diferença falsa**.

O fluxo pedido no documento já estava atendido no resto: fechar → autenticar
operador (nome + senha) → conferência cega → confirmar → resultado.

16 testes. **Pendente:** o botão "Imprimir fechamento" é o item 9 — a tela de
resultado já está pronta para recebê-lo.

## V155 — ITEM 5 da auditoria do PDV: a matemática do caixa

**A matemática já estava correta.** Verificado com os cenários exatos do
documento:

- `esperadoCaixa` = abertura + vendas em dinheiro + suprimentos − sangrias;
- faturamento = **somente vendas**; a abertura nunca entra;
- sangria **não** reduz faturamento, só a gaveta;
- venda cancelada não conta em nenhum dos dois;
- em pagamento misto, só a parcela em dinheiro vai para a gaveta.

Testes C1/C2/C3 do documento passaram como especificado: abre com R$ 200, vende
R$ 200 em dinheiro → faturamento R$ 200 e gaveta R$ 400; sangria de R$ 200 →
faturamento continua R$ 200 e gaveta cai para R$ 200.

**O buraco estava em outro lugar**, e é herança do item 1: quando um pagamento
fica sem forma, o valor entra em `total` (que soma os pedidos) e **não entra em
nenhuma forma**. O fechamento mostrava "vendas R$ 300" com as formas somando
R$ 225, e os R$ 75 restantes não apareciam em linha nenhuma. O operador contava
a gaveta, batia com o esperado e fechava — com R$ 75 de venda fora de controle,
sem aviso.

`movimentoCaixa` passou a devolver `semForma` (pagamento com forma nula) e
`descoberto` (venda sem pagamento algum), e a tela de fechamento mostra um
alerta somando os dois.

**Decisão:** esse alerta **não** é ocultado pelo caixa cego. O cego esconde
quanto o sistema espera, para a contagem ser honesta; esconder que existe venda
sem forma não protege a contagem, só garante que o problema passe despercebido
de novo.

28 testes entre os dois blocos.

## V156 — ITEM 6 da auditoria do PDV: fechar o caixa encerra o PDV

Ao confirmar o fechamento o código chamava `telaPDV()` e mais nada. Redesenhar a
tela **não apaga o que está na memória**: comanda em andamento, cliente
escolhido, mesa em pagamento, pagamentos montados, cupom aplicado e troco
pendente continuavam todos lá.

Na prática: o operador fechava o caixa e o pedido anterior seguia na tela.
Bastava tocar em Finalizar para nascer uma venda **nova, sem caixa aberto** —
venda órfã, que não entra em fechamento nenhum e só reaparece num relatório
amplo, dias depois.

Criada `encerrarSessaoPDV()`, chamada ao confirmar o fechamento: limpa comanda,
cliente, tipo, aba, categoria, busca, comanda aberta, mesa em pagamento,
`MESA_PAG`, pagamentos, total, cupom, cidade, troco e tipo de desconto, e fecha
qualquer janela aberta por cima. Não toca em dado gravado — o que está ali é
rascunho de tela; a venda finalizada já está em `DB.pedidos`.

**Segunda trava, independente da primeira:** `irPagamento()` agora recusa
finalizar quando não há caixa aberto. A venda carimba
`caixaId:(caixaAberto()||{}).id` — sem caixa isso grava vazio. Fechar essa porta
vale mesmo que algum estado escape no futuro.

18 testes, cobrindo C5, C6 e C7 do documento.

**Observado para o item 7:** `caixaAberto()` procura qualquer caixa sem
`fechadoEm` **sem filtrar por unidade** — um caixa aberto no Alphaville é visto
como aberto em Santa Fé. Será tratado no próximo item.

## V157 — ITEM 7 da auditoria do PDV: caixa fantasma

Três causas somadas, todas confirmadas no banco.

**1. A tabela `caixas` não tinha unidade.** `caixaAberto()` pegava qualquer caixa
sem fechamento. Com quatro lojas no mesmo banco, o caixa aberto no Alphaville
valia como caixa aberto em Santa Fé — e podia ser fechado de outra loja. Coluna
`sucursal_id` criada, carimbada na abertura, e os registros antigos atribuídos a
Santa Fé (única unidade que operou até aqui).

**2. Havia um remendo que escondia o problema.** Ao baixar da nuvem, o código
fechava sozinho todos os caixas abertos menos o mais recente — e datava o
fechamento com a hora da **abertura**, apagando o rastro. Foi assim que o caixa
de 20/08 apareceu "fechado" em 24/08 sem ninguém ter fechado, com vendas
zeradas; e o de 24/08 foi fechado junto com o de 25/08 às 12:18.

Isso não era segurança, era varrer para baixo do tapete: um caixa aberto por
engano não pode ser encerrado em silêncio por um aparelho que sincronizou.
Agora a duplicidade é resolvida **dentro da mesma unidade** e o caixa que sobra
é **marcado como pendente**, não fechado — o operador vê e decide.

**3. Nada avisava que o caixa era de outro dia.** Gelato fecha às 22:30: caixa
de dia anterior é esquecimento, nunca turno que atravessa a noite. O botão do
PDV agora mostra em vermelho "ficou aberto do dia anterior — feche antes de
vender", com a data.

**Duplicidade por clique repetido** também fechada: abrir caixa verifica antes
se já existe um aberto na unidade. Duas unidades podem ter caixa ao mesmo tempo,
como deve ser.

16 testes, cobrindo C6, C7 e C8 do documento.

## V158 — ITEM 9 da auditoria do PDV: comprovante de fechamento

Não existia impressão do fechamento: o operador contava, fechava, e não ficava
papel nenhum. Sem via impressa, qualquer conferência posterior depende de abrir
o sistema — e uma diferença de caixa discutida dias depois vira palavra contra
palavra.

Criado `linhasFechamento()` + `imprimirFechamento()`, usando a mesma bobina das
outras vias (58mm ou 80mm, conforme o modelo cadastrado). O comprovante traz
tudo o que o documento pediu: unidade, caixa, operador (e quem fechou, se for
outro), abertura, fechamento, valor de abertura, vendas por forma, total,
quantidade, cancelamentos, sangrias, suprimentos, esperado, informado,
diferença, conferência por forma com diferença individual, observação e linha
para assinatura. **Não imprime senha nem nada sensível.**

Dois pontos de acesso: botão na tela de resultado logo após fechar, e botão
Imprimir no detalhe de qualquer caixa já fechado (reimpressão pelo histórico).

**Achado no caminho — sexta ocorrência do mesmo erro:** `resumoDoCaixa()` lia
`g.formaId` nos pagamentos, mas o campo é `g.forma`. Toda linha do aviso de
fechamento enviado ao gerente pelo WhatsApp saía como "Não informado".
Corrigido aceitando os dois nomes.

17 testes, incluindo largura de linha nas duas bobinas e ausência de senha.

## V159 — ITENS 10, 11 e 12: uma fonte só de autorização do caixa

**Item 10 — havia duas listas paralelas.** Abertura e fechamento liam
`DB.operadores` (só operadores); cancelamento lia `operAtivos()` (usuários +
operadores). Quem estava cadastrado como usuário não aparecia para abrir caixa,
e a mesma pessoa podia ter senha num lugar e não no outro.

**E sangria/suprimento não pediam senha nenhuma.** Havia um campo de **texto
livre** chamado "Responsável", já preenchido com o nome de quem abriu o caixa.
Retirar dinheiro da gaveta exigia digitar um nome — qualquer nome, inclusive o
de outra pessoa. Sem senha, sem lista, sem permissão. Dinheiro que sai sem
assinatura não tem como ser auditado depois: o fechamento mostra a sangria, mas
nada liga aquela retirada a uma pessoa de verdade. **Era o buraco mais sério do
módulo.**

Criada `autorizar(acao, id, senha)`, porta única usada em **abrir caixa, fechar
caixa, sangria, suprimento e cancelar venda**. Usa `operAtivos()` (lista única),
confere senha e permissão, e devolve o operador ou nulo.

**Item 12 — permissões por função:**

- abrir/fechar caixa → caixa, gerente, administrador
- sangria/suprimento → gerente, administrador
- cancelar venda → gerente, administrador

Atendente e produção vendem, mas não mexem em dinheiro nem cancelam. A lista de
cada tela mostra **apenas quem pode** aquela ação (`operadoresPara`), e a
verificação é refeita na confirmação — botão escondido não é permissão.

A sangria passou a gravar `responsavelId`, ligando a retirada a um cadastro.

24 testes cobrindo O1 a O6 do documento.

**Item 11 — pendência registrada:** as senhas ainda ficam em texto plano
(`usuarios_sistema.senha_caixa` e `operadores`). Para uma senha curta de balcão
o risco é diferente do de uma senha de acesso, mas o correto é guardar o hash.
Depende de mover a conferência para o banco (Edge Function ou RPC), porque hash
conferido no navegador não protege nada. **Fica para a migração do login para o
Supabase Auth**, já na fila.

## V160 — ITENS 13, 19 e mudança de regra de permissão

**Regra de permissão, decidida pelo Rafael:** a primeira versão amarrava cada
ação a um cargo — só gerente fazia sangria, só gerente cancelava. Numa loja com
duas ou três pessoas por turno isso trava a operação: o gerente não está no
balcão às 21h de um sábado, e a venda para.

Passa a valer: **qualquer operador pode, desde que tenha senha de autorização
cadastrada e a digite.** O que assina a operação é a senha, não o cargo.

Consequência registrada: com todos podendo tudo, **a senha vira o único
controle**. Quem não deve autorizar sangria simplesmente não recebe senha — o
cadastro em Operadores do Caixa passa a ser a ferramenta de controle. Voltar a
separar por cargo é uma linha (`PERM_CAIXA`).

Abrir caixa não exige senha (é o início do turno, e travar isso deixa a loja
sem vender). Fechar, sangria, suprimento e cancelar exigem.

**Item 13 — estado local.** O aparelho guardar tudo é proposital (funciona sem
rede). Mas o caixa tem uma particularidade: fechado em **outro** aparelho, a
cópia local continuava achando que estava aberto, e o operador seguia vendendo
num turno encerrado. Agora, ao baixar, caixa fechado na nuvem fecha aqui — o
contrário não vale, fechamento feito aqui nunca é desfeito.

**Item 19 — atomicidade.** Conferido: `venda_registrar`, `estoque_aplicar` e
`confere_origem` são plpgsql sem `exception when others`, portanto a transação
é atômica de verdade — não há como gravar metade.

**Mas a venda subia sem o caixa.** O pacote não mandava `caixa_ref`: **80 de 115
vendas dos últimos dez dias estão sem caixa vinculado na nuvem**. No aparelho a
venda pertence ao turno; na nuvem, a nenhum. Qualquer conferência de fechamento
feita fora do aparelho que vendeu dava resultado errado. Corrigido nas duas
pontas — o pacote leva a referência e a função resolve, preservando o vínculo
existente em reenvio.

17 testes.

## V161 — ITEM 2 (rodada 2): senha de operador em hash, conferida no banco

Pendência que ficou aberta na auditoria anterior. Guardar hash sozinho não
resolveria nada: se a comparação continua no navegador, o dado precisa chegar
até ele — e quem abre o console vê. Por isso as duas coisas foram feitas juntas.

- tabela `operador_senhas` guarda **bcrypt** (`gen_salt('bf',10)`), fechada por
  RLS `using(false)`: **nenhuma consulta do cliente lê aquela tabela**;
- `senha_operador_conferir(op_ref, senha)` compara no banco e devolve **apenas
  sim ou não**;
- `senha_operador_definir` grava; `senha_operador_quem_tem` devolve só a lista de
  identificadores, para a tela saber quando desenhar o campo de senha;
- as senhas que estavam em texto puro em `usuarios_sistema.senha_caixa` foram
  migradas para hash e a coluna foi **zerada**; ela não sobe nem desce mais;
- os formulários deixaram de exibir a senha atual (o navegador não a conhece
  mais): vazio mantém a que está no cofre.

Verificado no banco: hash não contém a senha, senha certa confere, senha errada
não confere, zero registros em texto puro.

**Decisão sobre falta de conexão:** sem rede o aparelho não consegue conferir.
Nesse caso a ação é **recusada**, dizendo o motivo na tela, em vez de liberar por
omissão — liberar sem conferir é o mesmo buraco que estamos fechando. Abrir
caixa continua sem exigir senha, então a loja nunca fica impedida de vender.

12 testes.

## V162 — ITEM 3 (rodada 2): o banco manda no estado do caixa

`caixaAberto()` lê a cópia local, e isso é proposital: sem rede a loja precisa
vender. Mas quando **há** rede a cópia local pode estar errada — o caixa pode ter
sido fechado no outro computador ou encerrado administrativamente. Até aqui o
aparelho só descobria na próxima sincronização completa, e até lá seguia
vendendo num turno encerrado.

`conferirCaixaNoBanco()` consulta uma linha e uma coluna, no máximo uma vez por
minuto, em segundo plano (não trava o desenho da tela). Se o banco disser que
fechou: encerra a sessão do PDV e mostra ABRIR CAIXA.

Três guardas deliberados:

- caixa que **ainda não subiu** (sem linha na nuvem) não é encerrado — ausência
  de registro não é prova de fechamento;
- fechamento feito **aqui** nunca é desfeito pelo banco;
- **offline não encerra nada**.

**Caixa de teste encerrado:** `cx_mt8t8cl769kj`, aberto 25/08 às 12:18,
R$ 0,00 de abertura, zero vendas, zero pedidos ligados. Encerramento
administrativo registrado na observação do próprio caixa. Nenhuma venda foi
tocada.

11 testes.

## V163 — ITEM 4 (rodada 2): varredura automática de campos

Escrita uma varredura que compara, contra o esquema real do banco (77 tabelas,
extraído do `information_schema`):

- **a subida**: todas as chaves de primeiro nível dos objetos `campos:function(){
  return {...}}` do MAPA, incluindo blocos `filhos:`;
- **as consultas**: cada `order=` e cada filtro `campo=eq.` das URLs;
- **a descida**: todo `x.coluna` lido nos blocos que seguem cada `baixarTab`.

**Resultado da subida: zero divergências.** Nenhum campo enviado ao banco com
nome que não existe na tabela.

**Resultado das consultas: zero divergências.**

**Resultado da leitura: uma divergência real**, em `insumos`:

    custoMedio:Number(x.custo_medio)||0,
    destinoNome:x.destino_nome||'',

`custo_medio` e `destino_nome` existem em `fichas_tecnicas` e **não** em
`insumos` — código copiado de um bloco para o outro. Resultado sempre 0 e '',
sem erro. Não houve prejuízo até hoje porque o insumo usa `custo`/`custoUltima`,
e o custo médio por unidade vive em `estoque_unidade` (490 linhas), lida logo
abaixo. Mas campo que finge vir do banco e sempre vale zero é armadilha: basta
alguém confiar nele.

Corrigido com valor explícito (`custoMedio:0, destinoNome:''`) — **zero mudança
de comportamento**, conforme a regra de alteração mínima; agora está claro que
não vem do banco.

Os demais candidatos (`impressao`, `imposto`, `cor`, `imagem`, `ativa` sob
`grupos_opcoes`) foram verificados um a um e são **falsos positivos**: pertencem
a `categorias`, `status_venda` e `formas_pagamento`, que os têm. O recorte da
varredura atravessava blocos vizinhos.

**Confirmado de passagem:** o sistema traduz `minimo/maximo` → `min/max` na
descida e usa `min/max` internamente, de forma consistente. Era o **cardápio
digital** que lia direto do banco sem a tradução — a causa do grupo de 2 sabores
aceitar só 1, já corrigida.

A varredura ficou em `/home/claude/varre/` e pode ser reexecutada a cada rodada.

## V164 — ITENS 5 a 10 (rodada 2): o horário da Carla

**Causa raiz do problema relatado: não estava no robô.** A lógica de leitura foi
reproduzida com os dados reais do banco e responde certo — testada às 18:10 de
terça, devolveu ABERTO, com o dia da semana e a hora corretos.

O que fazia a Carla dizer "fechado" era **o painel gravando errado**: o horário
padrão subindo sozinho (V141/V142) e o salvamento indo para a unidade errada
(V144). Corrigidos, mais a trava no banco que recusa o padrão.

Quatro riscos que continuavam abertos e foram fechados:

**1. Fonte dupla do horário (itens 5 e 6).** `whatsapp_config.texto_horario` é um
campo livre, escrito à mão, e vinha **antes** do horário do cardápio nas duas
listas do contexto da IA. Bastava alguém ter digitado ali "seg a sáb, 14h às
22h30" uma vez para a Carla repetir isso para sempre, mesmo depois de o horário
mudar no painel. **Fonte única agora:** manda sempre `cardapio_config.horarios`
da unidade; o texto manual entra depois, identificado como observação do
lojista. (Na Jolô o campo está vazio, então não houve efeito — mas era uma
armadilha armada.)

**2. Fuso escrito na mão (item 8).** `Date.now() - 3*3600*1000`. Funciona hoje
porque o Brasil não tem horário de verão, mas é uma conta no código: se voltar,
ou se uma unidade abrir em outro fuso, a Carla erra uma hora e ninguém liga uma
coisa à outra. Agora o fuso é **nomeado** (`America/Sao_Paulo` por padrão, campo
por unidade), com queda para o padrão se o cadastro tiver fuso inválido.
Aplicado também em `hojeSP()` e no disparo das rotinas do assistente.

**3. Madrugada (item 8).** Se a segunda vai das 12:00 às 02:00, à 01:00 de terça
a loja está aberta — mas quem está aberto é o turno de segunda. O código somava
1440 ao fechamento e **nunca chegava a usar essa soma**, porque à 01:00 de terça
consultava a faixa de terça. Agora consulta também o dia anterior.

**4. Unidade obrigatória (item 10).** A consulta filtrava só por `sucursal_id`.
Se esse campo viesse vazio, o filtro deixava de existir e a consulta devolvia a
**primeira linha da tabela** — o horário de outra unidade, possivelmente de outra
rede. Agora: sem unidade não se consulta nada, e o filtro leva também `loja_id`.

**Item 7 — sobrevive a deploy:** verificado que horário, configuração da Carla,
unidade, telefone e gestores vivem todos em tabelas do banco. Nada em arquivo
local nem em variável de memória.

30 testes, incluindo os cenários exatos do item 9 (segunda 12:00–23:00 →
aberto às 15:00, fechado às 23:30; alterado para 00:00 → aberto às 23:30),
madrugada, domingo, virada de semana, e quatro fusos brasileiros.

**ACHADO URGENTE — fora do escopo, mas precisa de ação:** `whatsapp_sessoes`
está **vazia** (zero chaves). A última mensagem foi às 09:12 de hoje. A Carla
provavelmente está desconectada e precisa reler o QR — sem isso os avisos de
fase não chegam ao cliente.

## ITENS 11 a 15 (rodada 2): a causa do salto para o topo

**Causa raiz — e não era nenhuma das suspeitas da lista.** Não era `scrollTo`,
nem `<a href="#">`, nem submit de formulário, nem troca de rota, nem foco
automático. Era:

    ov.innerHTML = '...';

Cada toque num sabor redesenhava o painel **inteiro**. `innerHTML` destrói todos
os filhos e cria outros: o elemento que guardava a rolagem — a `.pnlB` — deixava
de existir, e a nova nascia em zero. **O navegador não voltou ao topo; o lugar
onde a pessoa estava foi apagado.**

Isso explica por que o remendo anterior (guardar e devolver a posição) só
funcionava às vezes: entre destruir e recriar, o navegador ainda não recalculou
a altura da caixa, e devolver 1800px numa caixa que ainda não tem 1800px de
conteúdo simplesmente não pega.

**Correção: não destruir.** O painel é montado uma vez; a cada escolha
atualizamos só o que mudou — a marca da opção, o contador do grupo e o rodapé
(preço e o que falta). A `.pnlB` nunca é recriada, então a rolagem fica onde
estava **por consequência, não por conserto**.

Detalhe que quase passou: o botão "não quero" também tem a classe `.op` e vem
**antes** das opções. Sem `:not(.naoq)` no seletor, o índice de cada opção
andava um, e tocar no primeiro sabor marcaria o segundo.

**Item 15 — mesmo padrão na sacola, e pior.** Cada toque no + ou no − fazia
`fechar()` + `abrirSacola()` + **dois** `render()`. Com três ou quatro itens o
cliente via a lista piscar e voltar ao topo a cada ajuste — bem no momento de
decidir quanto vai gastar. Agora o miolo foi extraído para `mioloSacola()` e só
ele é trocado; fecha e reabre apenas quando a sacola esvazia.

**Verificados e mantidos:** os dois `window.scrollTo(0,0)` restantes são
legítimos (trocar de loja e concluir pedido devem ir ao topo). Nenhum `<form>`,
nenhum `href="#"`, nenhum `scrollIntoView` indevido no cardápio.

27 testes.

## ITEM 17 (rodada 2): regressão

Bateria completa reexecutada: **314 testes, zero falhas**, distribuídos por
todas as versões desta rodada e da anterior.

Verificação contra o banco real:

- vendas sem pagamento **depois** da correção (V152): **0**
- as 10 históricas continuam intocadas, conforme o escopo
- pedidos duplicados: 0 · pagamentos duplicados: 0
- caixas abertos: 0 · caixas sem unidade: 0
- senha em texto puro: 0 · RLS ativa em 78 de 78 tabelas
- **P20: 7/7** — pedidos, pagamentos, caixas, produtos, clientes, usuários e o
  cofre de senhas, todos isolando por empresa

**Regressão que eu mesmo introduzi e corrigi antes de fechar:** a migração de
senhas para o cofre olhou apenas `usuarios_sistema.senha_caixa`, que estava
vazia. A senha do operador Administrador vivia dentro do jsonb
`config_operacao.operadores` e não foi migrada — o cofre ficou com zero
registros, o que impediria qualquer autorização de sangria, cancelamento ou
fechamento. Migrada para hash e o texto puro apagado de dentro do jsonb.

Lição registrada: quando um dado existe em dois lugares (coluna e jsonb),
migrar um e esquecer o outro é o mesmo erro de campo divergente, com outra
roupa.

## V165 — PERFORMANCE: as três causas medidas

Nada foi otimizado por suposição. Cada mudança tem medição antes e depois.

**Causa nº 1 — 50 consultas uma esperando a outra (4,7 s).** O carregamento fazia
`await baixarTab(...)` cinquenta vezes seguidas. Cada ida e volta ao banco (que
está em Ohio) custa 0,15 a 0,50 s; a soma passa de 5 segundos antes de a
primeira tela aparecer.

Medido contra o banco real, com as 49 consultas do startup:

| | tempo |
|---|---|
| sequencial (como estava) | **5,67 s** |
| paralelo (como ficou) | **0,98 s** |

Ganho de **5,8×**. As consultas passam a ser disparadas juntas e aguardadas na
ordem original — o processamento continua na mesma sequência, então os mapas de
identificador que uma etapa monta para a seguinte seguem prontos na hora certa.
Verificado uma a uma: **nenhuma URL depende do resultado de outra**, todas usam
filtro fixo de loja e unidade.

**Quatro tabelas eram baixadas duas vezes** no mesmo carregamento
(`cardapio_config`, `sucursais`, `usuarios_sistema`, `clientes_nexor`). Agora a
segunda reaproveita a mesma resposta.

**Causa nº 2 — a checagem de versão baixava o sistema inteiro (201 MB/hora).**
`fetch(location.pathname, {cache:'no-store'})` a cada 45 s, num arquivo de
2,5 MB. Isso dá 3,4 MB por minuto, **2 GB por loja num turno de 10 horas** —
quase 8 GB por dia com as quatro unidades. E cada descarga ocupa rede e thread
com a loja vendendo.

Agora pergunta primeiro com `HEAD` e compara a etiqueta do arquivo. Medido no
servidor real: **HEAD devolve 895 bytes; GET devolve 2.635.473**. O arquivo só é
baixado quando a etiqueta muda. Intervalo passou de 45 s para 2 min, e para em
aba escondida. **De 201 MB/hora para ~2,5 MB/hora.**

**Causa nº 3 — o medidor de travamento atrapalhava o que media.** Acordava
4 vezes por segundo (240×/min), para sempre, mesmo em segundo plano. Cada
acordada é uma tarefa na mesma fila onde o sistema desenha as telas. Passou para
1 s e parou em aba escondida: **de 240 para 60 acordadas por minuto, e zero em
segundo plano**. A detecção não perde nada — travas de meio segundo para cima
continuam aparecendo.

**O que NÃO era a causa, e por isso não foi mexido:** o volume de dados. A maior
tabela tem 758 linhas; insumos, 290; fichas, 145. A lentidão vinha do **número de
viagens**, não do tamanho da carga — por isso adiar módulos traria pouco ganho e
não foi feito, conforme a regra de alteração mínima.

## V167 — RECONCILIAÇÃO PDV × DASHBOARDS

**Duas causas raiz, ambas medidas no banco.**

### Causa 1 — o dia da venda era o dia de Greenwich

`pedido.data` vem de `data_venda`, que o banco entrega em UTC. Os relatórios
faziam `String(p.data).slice(0,10)` — cortavam os 10 primeiros caracteres e
ficavam com o dia **em UTC**.

Uma venda às 21:43 de 25/08 em São Paulo é `2026-08-26T00:43Z`. O relatório a
carimbava como **dia 26**. Toda venda feita depois das 21:00 caía no dia
seguinte — e some do "hoje".

O PDV mostrava certo porque ele conta o **caixa aberto**, não a data. Os dois
liam a mesma tabela; um deles lia a data errada.

**Medido:** R$ 1.370,00 fora do lugar, sendo R$ 1.070,00 das vendas de hoje.
E é o pior horário possível para uma gelateria — das 21h até fechar é o
movimento forte.

Criada `diaLocal()`, que converte para o dia da unidade (America/Sao_Paulo)
antes de comparar, e aceita tanto a data com fuso (nuvem) quanto a data simples
(aparelho). Aplicada em **28 pontos**: faturamento, itens vendidos, ticket
médio, vendas por forma, por unidade, por período, cancelamentos, cupons
fiscais, transferências e a data da movimentação de estoque.

### Causa 2 — pagamento gravado duas vezes (defeito meu)

Na correção dos pagamentos (V152) escrevi a referência como `ped.id+'_pg'+i`,
enquanto a sincronização comum usa `ped.id+'_'+i`. O banco só evita repetição
quando a referência bate — então o **mesmo pagamento entrava duas vezes**, uma
por cada caminho.

**Medido:** 30 pares duplicados, **R$ 1.046,00 a mais** nos pagamentos. O
faturamento continuava certo (soma os pedidos), mas a conferência por forma e o
fechamento de caixa viam quase o dobro.

Corrigido: a mesma chave nos dois caminhos. As 30 duplicatas foram removidas
(as duas cópias eram idênticas; ficou a da sincronização comum). Criada a trava
`tg_pagamento_repetido`, que recusa pagamento igual vindo pelo outro caminho —
testada e funcionando.

**Reconciliação depois da correção:** faturamento R$ 1.070,00 · pagamentos
R$ 1.070,00 · **diferença R$ 0,00**.

### Item 10 — a tela de Faturamento abre neutra

`periodoPadrao()` preenchia sozinho o mês inteiro ao abrir. Agora não se presume
período: a tela mostra os filtros e os atalhos (Hoje, Ontem, 7 dias, Este mês,
Mês anterior) e os números só aparecem depois da escolha. Atalho "Ontem" criado.

### Verificações contra o banco

- vendas de hoje: 27 · todas com caixa, unidade, pagamento e fase entregue
- itens sem produto vinculado: **0**
- vendas sem baixa de estoque: **0** (as 35 vendas têm movimentação)
- vendas duplicadas: **0**
- unidades misturadas: **0**

## V169 — duas senhas diferentes, e a tela não dizia isso

Observação do Rafael: *"pra acessar esse aplicativo tem a mesma senha pra
acessar o Joia? essas lojas já têm login... ali está confuso."*

Ele estava certo. Existem **dois acessos separados**:

- **sistema** (computador da loja): criado no cadastro da sucursal, vai para o
  Supabase Auth;
- **aplicativo** (celular): tabela `app_usuarios`, com senha própria, publicada
  em Canais de Venda.

A tela da sucursal dizia apenas "Quem entra nesta loja". Quem cadastrava ali
achava — com razão — que tinha liberado o celular também, e depois batia no erro
"este acesso está sem senha" sem entender por quê, já que tinha acabado de
cadastrar uma.

Pior: para publicar o app era preciso sair da tela, abrir Usuários, digitar a
senha, salvar, voltar e publicar. **Três telas para uma coisa só** — e a senha
digitada lá era a do sistema, não a do aplicativo.

Correções:

- o bloco da sucursal passou a se chamar **"Acesso ao sistema (computador da
  loja)"**, dizendo em seguida que o aplicativo tem senha própria e onde ela
  fica;
- a lista do aplicativo ganhou a coluna **"Senha do app"**: digita na linha e
  clica em Publicar, sem sair da tela;
- o texto explica que essa senha é só do aplicativo e **pode ser simples**,
  porque serve apenas para ver os números no celular;
- a mensagem de erro passou a dizer exatamente onde digitar, em vez de mandar
  editar o usuário.

## V170 — o login do aplicativo pode ser simples

Observação do Rafael: *"não era legal colocar o login também? um login simples,
o nome da pessoa — porque ali não tem nada pra ninguém roubar."*

Ele tem razão. O aplicativo é **somente leitura**: quem entra vê os números da
loja dele e mais nada — não lança, não apaga, não cancela. Exigir
`santafe@jologelato.com.br` num teclado de celular, todo dia, é atrito à toa.

`app_entrar` procura pelo login como texto livre; nunca exigiu e-mail.

- o login virou **editável na própria linha**, com o e-mail do sistema como
  sugestão. Quem quiser deixa "santafe"; quem preferir o e-mail, mantém;
- validação: mínimo 3 caracteres, sem espaço, e **não pode repetir** — dois
  logins iguais no aplicativo se atropelam, e um entraria na conta do outro sem
  erro nenhum;
- a busca na publicação passou a ser pela **referência do usuário**, não pelo
  login: se o login mudou, procurar pelo login novo não acharia a linha antiga e
  nasceria um acesso duplicado, com a pessoa aparecendo duas vezes;
- `login_app` sobe e desce (coluna nova em `usuarios_sistema`). Sem isso, o
  login só existiria no aparelho onde foi digitado, e o outro computador
  republicaria com o e-mail de volta — a pessoa deixaria de entrar sem ninguém
  entender.

13 testes.

## V171 — o aplicativo não mostrava faturamento, e o botão voltava para "Publicar"

**Problema 1 — faturamento zerado. Sétima ocorrência do mesmo padrão.**

O `app.js` lia `p.data`, `p.itens` e `p.pagamentos`. Na tabela `pedidos` **os
três não existem**: a data chama-se `data_venda`, e itens e pagamentos moram em
tabelas separadas.

Como `p.data` vinha vazio, **nenhum pedido batia com nenhum período** — o app
mostrava "nenhuma venda" e faturamento zero, com a loja tendo vendido
R$ 1.291,00 no dia.

`app_dados` passou a devolver os três campos prontos. E o campo `data` já sai
como o **dia da loja** (America/Sao_Paulo), não em UTC — senão a venda das 21:43
apareceria no dia seguinte, o mesmo defeito corrigido na V167. O `app.js` também
ganhou `diaDoPedido()`, que entende o formato novo e o antigo.

**Problema 2 — o botão voltava para "Publicar".**

`publicadoEm` era gravado só no aparelho e nunca subia. Bastava recarregar, ou
abrir o sistema no outro computador, para todos voltarem a "não publicado" —
mesmo com o acesso funcionando no celular.

Pior que o incômodo: quem visse aquilo publicaria de novo achando que não tinha
dado certo. A verdade é a tabela `app_usuarios` — é ela que o aplicativo
consulta para deixar alguém entrar. Criada a função `app_publicados()`, e a tela
passou a perguntar ao banco em vez de acreditar no aparelho.

## V173 — o troco em dinheiro estava bloqueado

Venda de R$ 18, cliente entrega R$ 20: a tela calculava e mostrava "Troco
R$ 2,00", e o botão de finalizar recusava com "Recebido a mais em forma que não
dá troco". Trava na forma mais usada da loja.

**Causa raiz.** A conferência pergunta `forma.troco`. A lista **antiga**, escrita
no código, trazia `{id:'dinheiro', n:'Dinheiro', troco:true}`.

Quando as formas passaram a vir do banco, `syncFormas()` virou a fonte da lista —
e ela monta o objeto campo a campo, **sem `troco`**. O banco guarda `tipo`
('dinheiro', 'pix', 'debito'…) e nunca teve coluna `troco`.

Resultado: `f.troco` passou a ser **sempre indefinido**. Nem o dinheiro dava
troco. A regra da V132 estava correta; o dado que ela consultava é que deixou de
existir.

**Oitava ocorrência do mesmo padrão** — campo que existe de um lado e não do
outro, falhando em silêncio.

Correções:

- `formaDaTroco(f)` deduz do **tipo**, que o banco realmente guarda, e respeita
  um `troco` explícito se alguém definir um dia;
- os três pontos que liam `f.troco` passaram a chamar a função — se a lista for
  montada em outro lugar amanhã e esquecer o campo, a venda em dinheiro não
  trava de novo;
- o pagamento passou a guardar **`recebido`** (o que o cliente entregou) ao lado
  de **`valor`** (o que quita a venda). Só o `valor` entra em faturamento, caixa
  e conferência.

Venda R$ 18 com R$ 20: faturamento R$ 18, caixa +R$ 18, troco R$ 2, recebido
R$ 20 registrado.

21 testes acrescentados à suíte permanente, rodando a função real extraída do
`index.html` — inclusive o misto (Pix 40 + dinheiro 100 numa venda de 100 dá
troco 40, dinheiro aplicado 60, Pix inteiro, faturamento 100).

## V174 — a conferência de senha travava o cancelamento

Depois da V161 o cancelamento passou a recusar com "Sem conexão para conferir a
senha", mesmo com a senha certa e a nuvem ligada.

**Duas causas somadas, ambas introduzidas por mim.**

**1. `crypt` não era encontrado.** As funções foram criadas com
`search_path = 'public'`, mas o **pgcrypto vive no esquema `extensions`**. Sem
ele no caminho, `crypt` não existe e a função falha. Testado: o erro real era
`function crypt(text, text) does not exist`.

**2. A conferência dependia da sessão estar perfeita.** `senha_operador_conferir`
chamava `confere_origem`, que exige `minha_loja()` — e essa depende de
`auth.uid()`, do perfil e do horário de emissão do token. Qualquer um desses
tropeçando, a função lançava "sessão sem empresa", o sistema traduzia como "sem
conexão", e **ninguém conseguia cancelar venda**.

Travar a operação da loja por causa de um detalhe de sessão é pior que o risco
que se queria evitar.

Correções:

- `search_path` passou a incluir `extensions` nas três funções;
- a empresa vem da sessão **quando existe**; senão, de um parâmetro que o próprio
  sistema já conhece e não é segredo;
- **a proteção real virou o limite de tentativas**: cinco erros seguidos e o
  operador fica cinco minutos bloqueado (tabela `operador_tentativas`, fechada
  por RLS). É o que impede alguém de ficar testando senhas — que era o ponto;
- a mensagem passou a dizer o **motivo real**. "Sem conexão" mandava a loja
  procurar problema de internet quando o defeito era outro.

Testado de ponta a ponta contra o banco: senha certa confere, errada não
confere, e a senha `1234` foi definida para o Administrador.

## O fechamento de caixa comparava gaveta com venda (V175)

Rodamos o sistema antigo e o Joia em paralelo, com as **mesmas vendas** lançadas
nos dois. Deu diferença grande de caixa. O teste que o Rafael fez para provar que
havia defeito é o certo e vale como regra: **a soma das diferenças de cartão tem
de espelhar a diferença do dinheiro**. Se um cartão sobra R$ 100, é porque o
dinheiro faltou R$ 100 — a venda foi para a forma errada, mas o total não muda.
Quando não espelha, o defeito não está na contagem: está no que foi gravado.

Não espelhou. Eram **quatro defeitos somados**, três deles a mesma família.

### 1. `f.id === 'dinheiro'` — a comparação que nunca dava certo

Aparecia em três lugares: no esperado por forma do fechamento, no destaque da
tabela de recebimentos e (por consequência) no comprovante. **Nenhuma forma de
pagamento tem o identificador `dinheiro`** — o banco grava `fp_dinheiro`.

A comparação dava falso sempre. Efeito: a linha do dinheiro recebia só as vendas
em espécie, sem fundo de troco, sem suprimento, sem sangria — enquanto o bloco do
topo usava `cx.esperado`, que é a gaveta inteira. **Dois números da mesma tela,
saídos de bases diferentes.** E o operador informa a gaveta contada, que tem o
fundo dentro: comparava-se gaveta com venda.

Medido no fechamento de 25/08 em Santa Fe: topo dizia R$ 1.350,05, tabela dizia
R$ 851,00 na mesma linha. A diferença eram exatamente os R$ 499,05 de fundo.

Corrigido com `f.troco`, que `formaDaTroco` já resolvia pelo tipo desde a V173.

### 2. `cx.contado = conf.dinheiro` — chave que não existe

`conf` é montado com as chaves reais das formas, lidas do `data-f` de cada campo.
Lia-se `conf.dinheiro`. O `||0` engolia o vazio **sem erro nenhum**, e todo caixa
fechava com contado zero. Na tela: "Informado pelo operador R$ 0,00" ao lado de
uma tabela mostrando R$ 673,05 informados.

Pior que a tela: `contado` alimenta o histórico de fechamentos e os lançamentos
no financeiro. **Todo fechamento anterior a esta correção está gravado com contado
zero.** A tela "Editar fechamento" já fazia certo — era o caminho principal que
estava errado.

### 3. R$ 278,00 de pagamento duplicado (rastro da V152→V167)

Sete vendas seguidas (353–359) tinham a linha de pagamento gravada duas vezes,
com dois nomes para a mesma coisa: `ped_xxx_0` e `ped_xxx_pg0`. É o defeito que a
V167 já corrigiu no código, mas **os dados duplicados continuaram no banco** e
entraram no fechamento de ontem. Removidos: 7 pares, R$ 278,00. Depois da limpeza,
pagamentos e pedidos fecham em R$ 1.377,00 exatos.

### 4. Faltava a linha de total no comprovante

Sem ela não dava para ver que o esperado somado (R$ 1.637,00) não fechava com as
vendas do turno (R$ 1.359,00). Foi por isso que R$ 278,00 passaram um turno
inteiro sem ninguém notar. Agora o comprovante tem total e avisa, com o valor,
quando a soma por forma não bate com `vendas + fundo + suprimentos − sangrias`.

### Trava no banco: `tg_pagamento_nao_duplica`

O índice único de `pedido_pagamentos` é por `ref_local`. Ele só protege quando os
dois caminhos de gravação usam **exatamente** a mesma chave — e chave igual é
acordo entre dois trechos de código, que já quebrou uma vez.

A trava nova é regra do banco e vale para qualquer caminho, inclusive os que ainda
não existem. É deliberadamente estreita: só recusa quando existe um gêmeo (mesma
venda, mesma forma, mesmo valor) **e** a soma passaria do total da venda. Pagamento
dividido legítimo — dois de R$ 50 numa venda de R$ 100 — continua passando.

### O que ainda não está explicado

Depois de tudo corrigido, a distribuição por forma **continua muito diferente** do
sistema antigo, e isso não é defeito de fechamento:

| Forma | Joia (limpo) | Antigo | Gaveta física |
|---|---|---|---|
| Dinheiro | 758,00 | 179,00 | 174,00 |
| Débito | 194,00 | 260,00 | — |
| Crédito | 345,00 | 562,00 | — |
| Pix | 80,00 | 310,00 | — |

A contagem física dá razão ao antigo: R$ 673,05 na gaveta menos R$ 499,05 de fundo
são **R$ 174 de dinheiro real**. O Joia acha que entraram R$ 758. **A forma de
pagamento está sendo gravada errada no momento da venda** — provável seleção que
não persiste, ou queda para dinheiro por padrão. É a próxima obra, e é maior que
todas as quatro acima.

**Regra que fica:** campo que existe de um lado e não do outro já apareceu **dez
vezes** neste sistema. Antes de comparar identificador de forma de pagamento em
qualquer lugar novo, usar `formaDaTroco`/`f.troco` — nunca `f.id === 'dinheiro'`.

## V176 — a lógica financeira do caixa, corrigida por inteiro

Documento de origem: "Correção definitiva da lógica de caixa, fechamento, sangria
e conciliação", 26 itens. O que segue é o registro do que estava errado e do que
passou a valer. **Nada fora do PDV/caixa/financeiro foi tocado** (item 25).

### Itens 1 a 3 — as três grandezas eram uma só

O sistema tratava **faturamento**, **saldo físico da gaveta** e **fundo de caixa**
como se fossem a mesma coisa em vários pontos. As fórmulas agora são explícitas e
aparecem separadas na tela, no cupom e na fotografia:

```
FATURAMENTO      = vendas válidas (canceladas fora)
DINHEIRO_ESPERADO = fundo + vendas_dinheiro + suprimentos − sangrias
DIFERENÇA        = físico_informado − dinheiro_esperado
```

Abertura não é faturamento. Sangria não reduz faturamento. Suprimento não é venda.
Os três aparecem escritos no comprovante, porque foi exatamente aí que a confusão
aconteceu na conferência com o sistema antigo.

### Item 5 — a diferença por forma não é a diferença do caixa

**Este era o defeito central**, e o teste que o Rafael fez para prová-lo virou
regra: se a soma das diferenças de cartão não espelha a do dinheiro, o problema
não está na contagem.

Uma venda no crédito lançada como dinheiro produz −5 no dinheiro e +5 no crédito.
O dinheiro está todo lá. O sistema tratava isso como **falta de caixa** e o
operador levava a culpa por um buraco que não existia.

Agora são dois números com pesos diferentes: **diferença geral** (é ela que diz se
falta dinheiro na loja) e **diferença por forma** (mostra onde a classificação
errou). Quando a geral é zero e as formas divergem, o cabeçalho diz
`FECHAMENTO TOTAL CONCILIADO / DIVERGÊNCIA ENTRE FORMAS: SIM`.

### Item 6 — e nenhuma venda é alterada por causa disso

Adivinhar qual pagamento foi lançado errado e reescrever o histórico seria pior
que o problema. A divergência é **registrada**, não corrigida. Ajuste automático
de venda histórica não existe e não vai existir sem autorização e trilha.

### Itens 9 a 13 — a sangria não tinha para onde ir

O defeito mais grave do módulo. A sangria mexia **só na gaveta**: R$ 500 saíam do
caixa e não entravam em conta nenhuma. Dinheiro que evapora do sistema e reaparece,
se reaparecer, como lançamento manual digitado dias depois — criando a **segunda
metade** de uma operação que já tinha uma metade. Sangria contada duas vezes.

Agora:

- **motivo é lista fechada** (envio ao cofre, depósito, retirada administrativa,
  pagamento autorizado, outro). Texto livre não se agrupa em relatório nenhum;
- **destino é obrigatório**, escolhido entre as contas cadastradas da unidade;
- a operação gera **um** lançamento `tipo:'transferencia'`, que o financeiro já
  entende: soma no destino, subtrai na origem, **não entra em receita nem em
  despesa**;
- `lancarTransferenciaCaixa` procura por `ref` antes de criar. Chamada três vezes,
  gera um lançamento (item 12);
- sangria maior que o dinheiro da gaveta é recusada na hora.

Suprimento é o mesmo caminho invertido: sai da conta escolhida, entra na gaveta.

### Item 14 — o saldo final não vira fundo de amanhã sozinho

Quem deixa R$ 200 e manda R$ 300 ao cofre precisa poder dizer isso. O fechamento
tem campo próprio e a abertura seguinte **sugere** — não impõe — o valor declarado.
Começar de zero por padrão fazia o caixa nascer com sobra inexplicável.

### Itens 15 a 18 — o cupom

Bobina térmica, no formato da referência: cabeçalho com unidade/caixa/turno/
operador; **DINHEIRO com a composição embaixo** (fundo, vendas, suprimentos,
sangrias — "Sistema R$ 1.350,05" sozinho não diz nada a quem confere);
CARTÃO/PIX; TOTAIS com diferença geral; FATURAMENTO com o lembrete de que abertura
e sangria não entram; e **SANGRIAS detalhadas** com horário, motivo, destino e
operador.

### Item 19 — a fotografia do fechamento

A reimpressão **recalculava** a partir dos dados de hoje. Uma venda cancelada na
semana seguinte mudava o cupom antigo — que já estava assinado e arquivado.
Comprovante que muda depois de emitido não prova nada.

`montarSnapshot()` congela tudo no instante da confirmação: esperado e informado
por forma, diferenças, sangrias com motivo e destino, quem abriu, quem fechou,
horários. A reimpressão lê de lá. Caixa fechado antes da V176 não tem fotografia:
nesses casos a conta é refeita e **o cupom avisa que foi reconstruído**.

Editar um fechamento refaz a fotografia, mas **guarda a anterior** com quem alterou
e quando. Sem isso, ajustar o informado para bater com o esperado faria a diferença
desaparecer da história da loja.

### Itens 7, 8 e 20 — travas no banco

- `tg_pagamento_nao_duplica` (V175): gêmeo que estouraria o total da venda é
  recusado; pagamento dividido legítimo passa;
- `tg_caixa_fechado_trava_movimento` (novo): caixa fechado não aceita movimento
  novo, **não perde os que tem**, e valor/tipo são imutáveis. Uma sangria apagada
  depois do fechamento faria o esperado subir R$ 500 sem nada na tela explicar —
  e o operador levaria a culpa;
- índices únicos por `ref_local` já existiam em pedidos, itens, pagamentos,
  movimentos de caixa e lançamentos. Todos exercitados por teste.

### Colunas novas

`caixas`: `snapshot`, `esperado_por_forma`, `fundo_proximo`, `fechado_por`,
`fechado_por_id`, `diferenca_total`, `conciliado`.
`caixa_movimentos`: `destino_conta_id`, `destino_nome`, `responsavel_id`,
`lanc_ref`, `hora`, `data_hora`.

Todas sobem **e descem** no sync. Campo que sobe e não desce é o defeito que já
apareceu dez vezes neste arquivo — a reimpressão de outro aparelho não acharia a
fotografia e voltaria a recalcular.

### Testes

`testes/caixa.js`, ligado ao `npm test`. As funções de regra são **extraídas do
index.html**, não copiadas: se alguém mudar `esperadoCaixa` ou `montarSnapshot`
amanhã, o teste roda a versão nova e quebra.

**53 de 53 no código** (testes A a E do item 21, sangria do 22, duplicidade do 23,
estado do PDV do 24, base única do dinheiro, snapshot imutável, trilha de auditoria)
e **9 de 9 no Postgres** (reenvio de venda, pagamento, sangria; caixa fechado
contra exclusão, inserção e alteração).

### O que continua em aberto

A distribuição por forma do turno de 25/08 continua divergindo do sistema antigo
mesmo depois de tudo isto: o Joia registrou R$ 758 em dinheiro onde a gaveta física
tinha R$ 174. **Não é defeito de fechamento** — é a forma de pagamento sendo
gravada errada no momento da venda. É a próxima obra, e é maior que as 26 acima.

## V177 — o primeiro botão tocado ficava com a venda inteira

Esta é a causa que faltava do dinheiro inflado, e não era do fechamento: era do
**momento da venda**.

### O mecanismo

`addPag(f)` lançava a forma nova com **o que falta receber**. Na primeira forma
isso é o total; da segunda em diante, **zero** — porque a venda já está coberta.

No balcão: o operador toca Dinheiro por hábito, percebe que é cartão, toca Débito.
O Débito entra com R$ 0,00. A tela mostra as duas linhas, nada reclama, a venda
finaliza — e o valor inteiro ficou gravado em **Dinheiro**. Do lado de fora parece
que funcionou.

A venda 371 do turno de 25/08 é a prova gravada: R$ 18,00 em Dinheiro mais três
linhas de R$ 0,00 (dinheiro, débito, crédito). O operador tocou quatro botões; o
valor ficou no primeiro.

### As linhas de R$ 0,00 eram o rastro, e ninguém as via

A limpeza de zerados existia, mas só rodava **dentro** do `if(_troco>0.009)` — ou
seja, apenas quando havia troco. Sem troco, subiam para o banco.

Não movem dinheiro, mas sujam tudo o que conta transação: a taxa fixa por transação
no fechamento (`taxaFixa * qtd`) cobrava por linhas que não existiram. E eram a
**prova** de que a venda tinha sido classificada errado.

14 linhas em 10 vendas, de 01/08 a 26/08. Removidas — mas guardadas antes na tabela
`pagamentos_zerados_removidos`, porque apagar a evidência de uma classificação
errada seria repetir o problema.

### O que mudou

- quando a venda já está coberta e há **uma** forma só, tocar outra **troca a
  forma** em vez de criar linha morta, com aviso na tela. É o que a pessoa quis
  dizer, e continua reversível com outro toque;
- com pagamento **dividido** em duas ou mais formas, adivinhar seria pior: o sistema
  recusa e explica;
- a limpeza de zerados virou **incondicional**, e a venda não finaliza se sobrar
  nenhuma forma com valor;
- na tela, a linha zerada fica apagada e marcada **"sem valor"**. Com fila no
  balcão ninguém lê linha por linha — o defeito precisa saltar aos olhos;
- `tg_pagamento_sem_valor` no banco: linha zerada é recusada em qualquer caminho,
  inclusive robô, sincronização e cardápio.

### Honestidade sobre o alcance

O rastro de linhas zeradas explica **R$ 18** dos R$ 584 de diferença do turno de
25/08. O mecanismo está provado e corrigido, mas quando o operador toca Dinheiro e
**não** toca mais nada, não fica rastro nenhum no banco — é indistinguível de uma
venda que foi mesmo em dinheiro. Os totais dos dois sistemas naquele dia também
diferem (R$ 1.377 contra R$ 1.311), então os conjuntos de venda lançados não eram
idênticos.

**Conclusão:** o defeito era real e está fechado daqui para a frente. O turno de
25/08 não dá para reconstruir, e o Rafael já decidiu deixá-lo como está. A prova
de que a correção funciona vem do próximo turno.

## V178 — auditoria completa da gravação das formas de pagamento

Documento: "Correção crítica da gravação das formas de pagamento no PDV", 24 itens.
**Nada do fechamento aprovado foi tocado** (item 22).

### O que a auditoria NÃO encontrou

Não existe, em nenhum ponto do sistema, conversão de Pix, débito ou crédito em
dinheiro. Foram percorridos os seis identificadores, os dois caminhos de gravação,
a RPC e os gatilhos. **Não há `forma || 'dinheiro'`, não há fallback por tipo, e
nenhuma regra escolhe forma por texto de tela.** A correspondência
`fp_pix → uuid` é 1:1 e resolvida sempre dentro da loja.

Isso está agora protegido por teste: a suíte varre o código sem comentários
procurando fallback, e quebra se algum aparecer.

### A causa raiz, que é outra

`addPag(f)` lançava a forma nova com **o que falta receber** — total na primeira,
**zero** da segunda em diante. Já registrado na V177; este documento confirmou por
rastreio ponta a ponta que é a única causa.

### As travas que faltavam

1. **Forma inválida bloqueia a venda** (item 5). Antes, forma fora do cadastro
   subia com a referência solta, o gatilho não achava o vínculo e o pagamento era
   gravado com `forma_id` nulo. Não virava dinheiro — mas sumia da conferência,
   que dá no mesmo para quem fecha o caixa.
2. **Reconciliação antes de gravar** (item 18). O banco já devolvia `fecha:false`,
   mas isso virava aviso no Diagnóstico com a venda **já gravada**. Aviso depois do
   fato não é trava.
3. **`resolve_forma_pagamento` endurecida** (itens 5, 16 e 17): levanta exceção
   quando não resolve, e recusa forma de outra empresa mesmo com o id correto.
4. **Gatilho duplicado removido.** `tg_resolve_forma` já existia; criar
   `tg_resolve_forma_pagamento` fez a mesma função rodar duas vezes por linha.
   Lição repetida: conferir os gatilhos existentes antes de criar um.

### Testes

`testes/formas-pagamento.js` (novo, no `npm test`): **67/67**. Percorre botão →
`_pagos` → dedução do troco → limpeza → payload → resolução no banco → leitura do
caixa, com o `addPag` real extraído do index.html.

22 vendas distribuídas entre as quatro formas, quatro com troco e duas mistas:
**R$ 0,00 de diferença** entre selecionado e banco, verificado duas vezes — na
suíte JS e por consulta agregada direta no Postgres.

Regressão: caixa **67/67**, banco **9/9**, reconciliação aprovada.

### Achado adicional: 314 pagamentos sem forma

R$ 50.853,38 com `forma_id` nulo. **312 são da carga histórica de 01 a 19/08** —
pedidos sem caixa, importados, que nunca tiveram forma. Apenas **2 vieram de venda
real** (20/08 R$ 15, 25/08 R$ 75).

**Nada foi migrado**, conforme o item 2: não se adivinha forma de pagamento
passada. Ficam como evidência. Da V178 em diante o banco recusa gravar pagamento
sem forma, então a lista não cresce mais.

## V179 — campo de dinheiro, teclado touch, fechamento rápido e relatório gerencial

Documento: "Evolução final do PDV", partes A a G. **Nada das regras matemáticas
aprovadas foi reescrito** — esperadoCaixa, montarSnapshot, sangria, suprimento,
fechamento cego, snapshot, conciliação e travas de duplicidade continuam como
estavam.

### Parte A — um campo de dinheiro para o sistema inteiro

Havia 18 campos de valor espalhados, cada um `type="number"` com `value="0"`. Três
problemas, todos os dias:

1. **o zero era valor, não rótulo.** Quem tocava e digitava 25 obtinha "025" ou
   tinha de apagar o zero antes;
2. **trocar 125,90 por 80** exigia apagar dígito por dígito;
3. `type="number"` num aparelho em português aceita vírgula **e** ponto, e
   `parseFloat("1.234,56")` devolve **1.234** — silenciosamente.

`moedaHTML()` / `moedaValor()` / `moedaSet()` resolvem os três, e são o **único**
lugar onde texto vira número. O valor real vive em `data-v`; o que aparece é
apresentação. Nenhum cálculo sai de string formatada.

Os três comportamentos são ligados **uma vez no documento**, por delegação. As
telas são redesenhadas o tempo todo (333 pontos chamam `telaX()` depois de salvar);
ligar evento em cada campo criado significaria religar em cada redesenho e esquecer
em algum.

Migrados nesta rodada: fechamento (conferência por forma), abertura, sangria,
suprimento, fundo do próximo caixa e edição de fechamento. Os campos de cardápio,
produto e financeiro continuam funcionando como antes e migram na sequência — o
componente já está pronto para eles.

### Parte B — teclado numérico de toque

Só no PDV e no fechamento. Abrir isto na tela de cadastro de produto, onde a pessoa
está num computador com teclado de verdade, seria estorvo.

O teclado do sistema operacional cobre metade da tela do tablet — inclusive o botão
de finalizar — e some sem avisar. Este fica ancorado embaixo, e
`body.comTeclado .mdBox` garante que não cubra o rodapé do modal. ESC devolve o
valor anterior; ENTER recolhe; OK avança para o próximo campo de dinheiro. **O
teclado físico continua funcionando o tempo todo.**

### Parte C — fechamento muito mais rápido

**ENTER percorre as formas.** A ordem é a das formas efetivamente cadastradas e
ativas na unidade — forma desabilitada não entra no caminho, porque a lista vem de
`FORMAS`, que já filtra por `ativa!==false`. No último campo, ENTER leva ao botão
de fechar. O primeiro campo já nasce focado.

**A tela intermediária foi removida.** `resultadoFechamento()` abria depois de
fechar o caixa e mostrava previsto × físico para o operador "confirmar". Ela não
confirmava nada — o caixa já estava gravado quando abria — e mostrava o esperado
justamente a quem o fechamento cego existe para não mostrar.

Ficou só: **"Caixa fechado com sucesso. Deseja imprimir?"**

A função foi **apagada, não desligada**: função que ninguém chama volta a ser
chamada por engano seis meses depois.

**A conferência não se perdeu** (item 12): vive no snapshot e aparece inteira no
relatório gerencial, no histórico e na impressão, para gestor e administrador.

### Parte D — relatório de frente de caixa

Oito abas: Resumo, Recebimentos, Movimentações, Cancelamentos, Descontos, Vendas,
Operadores, Auditoria.

**A regra que mais importa aqui é negativa: nenhuma aba faz conta própria.** Todas
leem `dadosDoCaixa()`, que monta o retrato uma vez. Sem isso, uma venda vale R$ 100
no Resumo e R$ 90 em Recebimentos — e quando os dois divergem ninguém sabe qual
acreditar.

Para caixa fechado a fonte é o **snapshot** (item 26). Testado: cancelar uma venda
depois não muda os recebimentos do relatório.

Em Recebimentos, a linha do dinheiro **expande** e mostra de onde o número saiu:
fundo + vendas em dinheiro + suprimentos − sangrias = esperado.

### Parte E — impressão

O cupom térmico continua objetivo. A impressão **gerencial** é folha A4 e traz
movimentações, cancelamentos e descontos detalhados. Quem confere a gaveta no fim
da noite não precisa da lista de descontos; quem audita o mês, sim.

### Parte F — duplo toque

`travarOperacao()` cobre FECHAR CAIXA, SANGRIA e SUPRIMENTO (FINALIZAR VENDA já
tinha a sua). Em tela de toque o duplo toque acidental é comum, e uma sangria de
R$ 200 tocada duas vezes vira R$ 400 fora da gaveta.

**Isto é a primeira barreira, não a única.** As travas do banco continuam valendo,
porque confiar só no botão seria confiar no navegador — e o robô, a sincronização e
o cardápio não passam por botão nenhum.

### Testes

`testes/pdv-ux.js` (novo, no `npm test`): **99/99**.

Regressão: caixa **67/67**, formas **67/67**, Postgres **9/9**, reconciliação
aprovada, sintaxe ok.

## V180 — a migração dos campos monetários, terminada

A V179 criou o componente e migrou cinco telas. Faltavam duas coisas, e uma delas
era grave.

### O que estava faltando: o próprio PDV

A prioridade 1 do documento era o PDV, e eu tinha migrado o fechamento, a abertura
e a sangria — mas **não a tela de pagamento**, que é onde o operador digita mais.
Taxa, desconto e o valor de cada forma continuavam em `type="number"` com
`parseFloat`. Corrigido.

**O campo em edição não pode ser formatado por baixo.** `recalcPag` redesenha a
lista de pagamentos a **cada tecla**. Se o campo sendo digitado voltasse formatado,
quem digita "18" veria "1,00" depois do primeiro toque e não conseguiria terminar o
número. A solução: `_pgEditando` e `_pgTexto` guardam qual campo está em edição e
com que texto cru; os demais saem formatados. `data-v` carrega o valor real nos
dois casos.

### Migração completa

Além do PDV: cardápio (preço na grade), produto (preço de venda), variações,
grupos de opção, taxa por cidade do entregador, acerto (desconto e acréscimo),
taxa fixa da forma de pagamento, transferência entre contas, limite de fiado,
valor a pagar do fiado e desconto do item na nota de entrada.

Todos os leitores acompanharam — `parseFloat` direto em campo de dinheiro **é** o
defeito que a migração existe para eliminar. Um teste varre os identificadores
migrados e falha se algum voltar a usar `parseFloat`.

### Dois campos ficaram de fora, de propósito

**`ntItVl` — custo unitário do insumo.** Tem `step="0.0001"`. Farinha a
R$ 0,0043 o grama é valor normal, e é este número que alimenta a média ponderada
do custo, que alimenta a ficha técnica e o CMV. `moedaFmt` arredonda para duas
casas: passar este campo pelo componente truncaria R$ 0,0043 para R$ 0,00 e o custo
iria a zero **em silêncio** — exatamente o estrago que este arquivo já documentou
dez vezes. Migra quando o componente ganhar casas configuráveis. O motivo está
escrito no código, e um teste verifica que continua escrito.

**`lnVp` — total calculado, só leitura.** Não recebe digitação.

### Testes

`testes/pdv-ux.js` subiu de 99 para **134**, com 26 verificações de cobertura da
migração e a simulação de digitar "18" com o redesenho no meio.

Regressão: caixa 67/67, formas 67/67, Postgres 9/9, reconciliação aprovada.

## V181 — auditoria geral: contexto de unidade e isolamento multiempresa

### O bug do item 98, reproduzido e corrigido

Evidência: login `santafe@jologelato.com.br` mostrando **LOJA: Matriz**, a mensagem
"A unidade do seu acesso não existe mais" e a Gestão de Cardápio vazia.

**No banco estava tudo certo.** O perfil aponta para `suc_mt1unhbx2xrb`, a sucursal
existe, está ativa e pertence à loja correta. O defeito era do frontend.

**Causa raiz:** `baseSuc()` cria uma Matriz local quando a lista está vazia, para o
sistema ter alguma unidade no primeiro uso. Ela nasce **antes de a nuvem
responder**. A sequência:

1. o perfil carrega e diz `sucursal_ref = suc_mt1unhbx2xrb`;
2. as sucursais da nuvem ainda não chegaram;
3. `lojasCad()` devolve **uma** unidade: a Matriz semeada;
4. `existe(fixa)` dá falso — Santa Fé não está na lista;
5. o sistema avisa "não existe mais" e cai na Matriz.

O guarda `if(!a.length)` da V130 não pegava este caso, porque a lista **não estava
vazia**: tinha exatamente a unidade errada dentro.

Consequência grave: durante esses segundos o gerente de Santa Fé opera como Matriz.
Qualquer coisa gravada nasce com a unidade errada, e o cardápio aparece vazio
porque não há produto na Matriz.

**Correção:** a semente ganha marca `_semente`. Enquanto a lista for só semente, o
sistema assume que **ainda não sabe** — não avisa, não decide, não grava. É o mesmo
princípio que a V130 aplicou para lista vazia: ausência de dado não é resposta.

### Item 100 — fallback silencioso eliminado

Mesmo com o aviso, o gerente **caía na Matriz assim mesmo**. O aviso deixava a
consciência limpa; o acesso continuava errado.

Isso é risco de isolamento, não detalhe de tela: erro ao resolver a unidade virava
permissão para ver outra. Agora quem tem unidade fixa no perfil e não pode circular
fica **sem unidade ativa**, com `DB._contextoInvalido` marcado.

**Preferir tela bloqueada a tela com o dado da loja errada.**

### Defeito meu, corrigido

`pagamentos_zerados_removidos`, criada por mim na V177, era a **única tabela
pública do banco sem RLS**. Não guarda dado sensível, mas guarda número de pedido e
data de venda — que é dado de cliente. Tabela de auditoria sem RLS é o tipo de
porta que ninguém lembra de fechar. Corrigida com política pela própria loja.

### O que a auditoria encontrou de BOM (e contraria o registro anterior)

Este arquivo dizia, desde agosto, que **`auth.uid()` era sempre nulo e as políticas
de RLS eram ineficazes**. **Isso não é mais verdade.** Verificado nesta auditoria:

- o sistema autentica por `signInWithPassword` de verdade;
- a chave exposta no HTML é a **publishable** (`sb_publishable_...`), não a service
  role — é a chave que deve mesmo estar no cliente;
- 85 das 86 tabelas públicas têm RLS ligada (a 86ª era a minha, agora corrigida);
- as três tabelas de WhatsApp **já estão fechadas**; `whatsapp_sessoes` só aceita
  `service_role`.

O registro estava desatualizado. Fica corrigido aqui.

### Isolamento testado com sessão real

Não por leitura de política: com `set_config('request.jwt.claims')` e
`set role authenticated`, simulando a sessão do gerente de Santa Fé contra uma
segunda empresa criada para o teste. **12 de 12**:

leitura, gravação, alteração e exclusão cruzadas — todas negadas; a própria empresa
continua visível; autopromoção a `plataforma` recusada; `perfis` devolve só o
próprio; o dado da Empresa B sobreviveu intacto; nada de teste ficou no banco.

`testes/tenant.js` (novo, no `npm test`): **33 testes**, incluindo o cenário exato
do item 104 — F5, novo login e nuvem atrasada.

## V182 — auditoria: senhas, funções duplicadas e superfície exposta

### "A senha do operador some depois da atualização" — resolvido

**A senha nunca some.** Ela vive como hash no banco e não depende de arquivo,
build ou navegador. O que some é a **lista de quem tem senha**.

`carregarQuemTemSenha` engolia qualquer erro num `catch` silencioso e deixava
`_quemTemSenha` nulo. Aí `temSenhaCadastrada` caía no `!!op.senha`, que é **sempre
falso de propósito** — o cadastro local não guarda senha, por segurança.

Na tela: todo mundo aparece sem senha, a lista de autorizadores fica vazia e o
sistema diz "Ninguém com senha de autorização cadastrada". Sangria, cancelamento e
fechamento ficam impossíveis. Parece que a atualização apagou as senhas. Não
apagou: a consulta falhou e ninguém foi avisado.

Correção: três estados distintos (nunca carregou / falhou / carregou), nova
tentativa antes de desistir, e `motivoSemOperador()` — cada motivo com a sua frase.
"Sem conexão", "não consegui carregar a lista, as senhas continuam no banco" e
"ninguém com permissão" são coisas diferentes e agora dizem coisas diferentes.

### Havia duas `salvarCardapio` — e a boa estava morta

Em JavaScript a segunda declaração vence, em silêncio. A versão `async`, que
esperava `sincronizar()` confirmar antes de dizer "publicado" e abria um aviso
claro quando a nuvem recusava, era a **primeira** — e portanto nunca rodava. A que
valia dizia "Cardápio salvo." e agendava o envio; se a nuvem recusasse, a página
pública continuava a antiga e ninguém ficava sabendo.

É o mesmo padrão que já derrubou 33 funções neste sistema. As duas foram fundidas,
e a varredura de nomes duplicados entrou no `npm test`: quebra se acontecer de novo.

### Regra de segurança escrita ao contrário

`exportar_schema` começava com:

```
if auth.uid() is not null and not sou_plataforma() then bloqueia
```

Lido em voz alta: "se estiver logado E não for plataforma, bloqueia". O que sobra é
**não estar logado passa**. A função devolve o schema inteiro — tabelas, restrições,
o corpo de todas as funções e o texto de todas as políticas de RLS.

No teste empírico ela bloqueou, então **não houve vazamento**. Mas passou por
acidente, não por regra. Regra de segurança que funciona por sorte é defeito.
Agora é afirmativa: só a plataforma exporta.

E o `EXECUTE` foi revogado do `anon` nas funções que nunca precisam de chamada sem
sessão, e de `anon` e `authenticated` nas **funções de gatilho** — que não são para
ser chamadas por RPC nenhuma. Testado depois: os gatilhos continuam funcionando
normalmente, porque gatilho roda por evento, não por permissão de EXECUTE.

### O que a auditoria confirmou como correto

- 86 de 86 tabelas com RLS ligada (a última era minha, corrigida na V181);
- `app_definir_senha` como anônimo: recusado — `minha_rede()` falha fechado;
- chave no HTML é a **publishable**, não a service role;
- nenhum segredo no código, no bundle ou no histórico do Git;
- `href="#"` e `<form>`: **zero** ocorrências — as causas clássicas de salto ao
  topo não existem neste sistema.

### Auditoria geral — o que ficou de fora (registro honesto)

A auditoria pedia 116 itens. Foram executados os P0 e P1 de segurança, isolamento,
persistência e integridade. **Não foram executados**, e estão na planilha de
pendências: performance e N+1 (exigem medição com dados reais), padrão de layout e
corte de conteúdo (exigem inspeção visual), cardápio digital (repositório separado),
LGPD (exige validação jurídica), revogação de sessão (exige dois navegadores),
backup e restore (exigem acesso ao painel e autorização), vulnerabilidades de
dependências, health check administrativo e pesquisa externa de boas práticas
(sem acesso nesta sessão).

**Veredicto: PRONTO PARA PRODUÇÃO COM RESSALVAS.** Nenhum bloqueador P0 do item 96
está presente. As ressalvas, em ordem de peso: (1) nada está publicado — a loja roda
a V174; (2) backup não verificado e restore não testado; (3) revogação de sessão de
usuário desativado não testada; (4) nenhum teste de navegador executado.

## V183 — fechamento final: senha, performance e isolamento

### P0 — a senha viajava em texto puro

O login offline comparava `x.senha === sn`. Para isso funcionar, a senha de cada
pessoa era gravada em `usuarios_sistema.senha`, **subia para a nuvem e descia para
todos os aparelhos da loja**. Quatro estavam preenchidas.

Três consequências, todas sérias:

1. quem abrisse a tabela via API com a sessão de qualquer usuário da loja lia a
   senha de todo mundo em claro;
2. são as **mesmas senhas do Supabase Auth** — vazar aqui é vazar o sistema inteiro;
3. cada aparelho novo recebia uma cópia.

A capacidade offline não podia acabar: a loja não para quando a internet cai. Então
ela continua — comparando **hash**, não texto. `crypto.subtle` é nativo do navegador
e o login entra como sal.

SHA-256 não é bcrypt, não tem custo ajustável. Mas isto é o segundo fator de um
acesso que já passou pelo Supabase Auth, e a alternativa real era **texto puro**.

No banco: `tg_senha_nunca_em_claro` anula qualquer senha que chegue, em qualquer
caminho. As quatro foram limpas. Aparelho legado ainda entra uma vez e converte.

### Performance — medida, não estimada

`pg_stat_statements` mostrou que **mais de metade do tempo do banco** estava em
quatro operações de escrita:

| Operação | Chamadas | Média | % do tempo |
|---|---|---|---|
| INSERT pedido_itens | 37.322 | 1.342 ms | 27,9% |
| INSERT ficha_itens | 25.754 | 962 ms | 13,8% |
| INSERT pedido_pagamentos | 19.508 | 978 ms | 10,6% |
| DELETE ficha_itens | 25.669 | 326 ms | 4,7% |

**Causa: chave estrangeira sem índice.** Toda gravação de linha filha exige conferir
a FK; sem índice, essa conferência varre a tabela inteira — e essas tabelas crescem
a cada venda. `ficha_itens` era o pior: salvar uma ficha apaga todos os itens e
regrava, e cada um dos 25 mil DELETEs varria tudo.

10 índices criados. Prova: `EXPLAIN ANALYZE` passou de varredura para
`Index Only Scan`, 1,17 ms.

Também corrigidos: `auth.uid()` reavaliado linha a linha na política de `perfis`
(agora `(select auth.uid())`, calculado uma vez) e **7 pares de índices idênticos**
removidos — cada par custava tempo de escrita em toda inserção.

### Reconciliação com dados reais

PDV × ITENS: **bate exato** (R$ 53.277,38 dos dois lados).

PDV × PAGAMENTOS: divergência de **R$ 531,00** em 10 vendas de 24–25/08 sem nenhuma
linha de pagamento. **Verificado que não foi causado pelas limpezas desta sessão** —
zero sobreposição com a tabela de evidência. São anteriores à V152, que corrigiu
exatamente isto ("pagamentos sobem na mesma transação da venda").

Conforme a Fase 20, **nenhuma forma foi adivinhada**. Confirmado: zero vendas sem
pagamento criadas após as correções, e a view `vw_vendas_sem_pagamento` monitora.

### Backup

`wal_level=logical` e `archive_mode=on` — a base para PITR existe. Restore em schema
separado **comprovado**: `bkp_jolo_20260811` com 61 tabelas e 12 MB. Plano
contratado, retenção e PITR continuam pendentes por dependerem do painel de billing.

## V184 — fechamento GL-01 a GL-14

### GL-11 — o defeito que esta rodada encontrou

Uma diferença de **um centavo entre a tela e o banco**, no mesmo cálculo:

```
250 g de insumo a R$ 0,0043
valor exato .......... 1,075
no binário do JS ..... 1,0749999999999999556
toFixed(2) ........... 1,07
Postgres (numeric) ... 1,08
```

JavaScript guarda número em binário e nem todo decimal cabe. Na ficha técnica isso
multiplica: cada insumo erra um centavo **para baixo**, o CMV fica menor do que é, e
a margem parece maior do que é.

Criada `arred(v, casas)` com correção de `Number.EPSILON`, aplicada nos quatro
cálculos de custo. Agora bate com o banco. Testado com 0,0043 · 0,0157 · 0,1250 ·
1,2345 · 10,0000 e o caso clássico 1,005 (que `toFixed` erra).

As colunas do banco já estavam certas: `insumos.custo` com 4 casas,
`fichas_tecnicas.custo_medio` com 6. **Nenhuma migration foi necessária.**

### GL-14 — 156 tabelas sem PK eram 150 falsos positivos

O advisor conta **todos** os schemas. Em `public` há 86 tabelas reais, **80 com
chave primária**. As 6 sem PK são `bkp_*`, cópias de segurança. Os outros 150 estão
nos schemas `bkp_jolo_20260811`, `bkp_rafaelos_20260811` e afins — snapshots, onde
PK não faz sentido.

**Zero tabelas de produção sem chave primária. Nenhuma PK foi adicionada, e essa é
a resposta certa** — adicionar PK em cópia de segurança só criaria risco.

### GL-04 — a lógica de senha estava em dois lugares

`telaOperadores` e `Usuários e Permissões` continuam existindo: quem só assina no
balcão é diferente de quem entra no sistema, e juntar seria pior. O que não podia
continuar era o **código** duplicado — dois blocos parecidos divergem com o tempo.

Agora as duas chamam `definirSenhaOperador()`. A RPC é invocada de **um lugar só**.

### GL-03 — revogação de sessão testada

O mecanismo já existia (`conta_ativa()` confere `usuarios_sistema.ativo` e
`perfis.sessoes_desde` contra o `iat` do token). Faltava prova. Testado com a
**mesma sessão e o mesmo token**: desativar o usuário corta consulta, gravação e
tudo mais na hora. Token emitido antes de uma revogação também é recusado.

### GL-10 — carga de 20 lojas

300 vendas completas (pedido + item + pagamento) em 20 lojas, **zero erros**:

| Operação | P50 | P95 | P99 |
|---|---|---|---|
| Venda completa | 0,66 ms | 1,61 ms | 2,33 ms |
| Abrir caixa | 0,40 ms | 0,85 ms | 2,44 ms |
| Relatório por forma | 0,45 ms | 0,84 ms | 1,11 ms |
| Dashboard | 0,16 ms | 0,24 ms | 0,38 ms |

Isolamento durante a carga: 20 lojas distintas, **zero** pagamento com forma de
outra loja, zero venda duplicada, zero venda sem pagamento. Tudo removido no fim.

**Ressalva:** isto mede o **banco**, não a rede nem o navegador. O caminho completo
do operador ainda depende de teste em aparelho real.

### GL-12 — health check que não finge

Regra: o que não pode ser verificado diz **"não verificado"**, nunca verde. O backup
é o exemplo — `wal_level` e `archive_mode` são lidos do banco, mas plano e retenção
vivem no painel, então a linha aponta onde olhar em vez de mentir.

### GL-05 — minutas jurídicas

`juridico/POLITICA_DE_PRIVACIDADE.md` e `juridico/TERMOS_DE_USO.md`, escritos a
partir das 57 tabelas com dado pessoal levantadas no banco. **21 marcações
`[VALIDAR]`** nos pontos que exigem advogado — entre eles a transferência
internacional (o banco fica nos Estados Unidos) e a ausência de expurgo automático.

Os termos **não prometem SLA** e **não prometem backup não comprovado**. Um teste
verifica que continuam sem prometer.

## GL-02 — backup comprovado em 26/08/2026

Verificado no painel do Supabase pelo proprietário, com evidência visual.

| | |
|---|---|
| Provedor / plano | Supabase **Pro** |
| Projeto | Joia Gestão Inteligente · `cevghkndzpzvnzwifhnm` · us-east-2 |
| Backup automático | **SIM** — diário, por volta da meia-noite da região |
| Retenção | **7 dias** (19 a 25/08 visíveis) |
| Último backup | **25/08/2026 09:34:24 UTC** |
| Tipo | físico |
| Falhas | nenhuma na janela |
| PITR | **não contratado** |
| **RPO** | **até 24 horas** |
| **RTO** | 15 a 60 min (restore de um clique no painel) |

Somado ao que já estava comprovado por SQL — `wal_level=logical`, `archive_mode=on`
e restore em schema separado (`bkp_jolo_20260811`, 61 tabelas, 12 MB) — o item **sai
de "não comprovado" para COMPROVADO**.

### Duas ressalvas que a evidência trouxe

**1. Storage não entra no backup.** O próprio painel avisa: os backups cobrem o banco,
não os objetos enviados pela API de Armazenamento. **Fotos de produto e arquivos do
cardápio não são recuperáveis por restore.** Registrado como pendência nova.

**2. RPO de 24 h é uma decisão, não um esquecimento.** Se o banco cair às 20h, volta
com os dados das 06:34 — um dia de vendas. Com seis lojas isso é aceitável, e o risco
real é menor porque cada aparelho guarda os dados localmente e ressincroniza. Passando
de ~20 unidades, PITR (RPO de minutos, ~US$ 100/mês) deixa de ser opcional.

## V186 — "liberei e não apareceu, e ainda perdi tudo"

Dois defeitos somados, um deles meu, desta mesma semana.

### 1. O cadastro nascia sem liberação (defeito antigo)

Desde a V109 vale: cadastro sem marcação de unidade fica **só na matriz**. Todo
formulário de cadastro ganhou o bloco "Quem enxerga este item" — **menos três**:
grupo de ingredientes, categoria do cardápio e categoria de ficha.

Efeito: item criado nesses três nascia com `sucursais` ausente, e a unidade nunca
via. Pior — salvar o item de novo **apagava a liberação** feita na tela de Liberação
por Unidade, porque o salvamento reatribuía nome e demais campos sem preservar
`sucursais`. Era isso que fazia a liberação "não pegar": ela pegava, e o salvamento
seguinte desfazia.

Os três ganharam o bloco. Um teste verifica que `blocoUnidades` e `lerUnidades`
aparecem o mesmo número de vezes — se alguém criar um cadastro liberável novo e
esquecer o bloco, a suíte quebra.

### 2. Contexto sem unidade apagava o cadastro inteiro (regressão minha, V181)

Na V181 corrigi o contexto para **não cair na Matriz** quando a unidade do perfil
não resolve: `lojaAtual()` passou a devolver string vazia. Aquilo estava certo —
melhor sem unidade do que na unidade errada.

**O que eu não previ foi o efeito em `filtrarCadastroDaUnidade`.** Ela recebe a
unidade vazia, `ehSucMatriz('')` dá falso, e então pergunta se cada cadastro está
liberado para `""` — que nunca está. Resultado: **apaga da memória do aparelho os
grupos, as categorias, os produtos, os insumos e as fichas. Todos.**

Foi isso que o Rafael viu: *"atualizou e eu perdi tudo"*. Na nuvem nada se perdeu —
`espelha:false` protege esses cadastros contra remoção em massa, e a conferência
confirmou 33 grupos, 290 insumos, 145 fichas e 42 produtos intactos. Mas a tela
ficou vazia, e a liberação recém-feita parecia não ter funcionado.

**Filtrar é operação destrutiva na memória local. Fazer isso sem saber para qual
unidade é o pior dos mundos: apaga tudo por não saber nada.** Ausência de contexto
não autoriza remoção — mesma lição da V130 e da V181, agora no terceiro lugar.

`soLiberados` também passou a devolver a lista inteira quando não há unidade, em vez
de esvaziar.

### O que a auditoria não pegou, e por quê

Os 484 testes estavam verdes. Nenhum deles chamava `filtrarCadastroDaUnidade` com
contexto vazio — porque eu escrevi os testes da V181 provando que `lojaAtual()`
devolve vazio, sem perguntar **quem consome esse vazio**. Corrigir uma função e não
percorrer quem depende dela é o mesmo erro em outra forma.

## V187 — a liberação por unidade evaporava no caminho

O Rafael liberou os grupos pela matriz e a unidade continuou vendo "Nenhum grupo
cadastrado". A liberação **funcionava na tela e sumia antes de chegar ao banco**.

### A causa, e ela era maior do que o sintoma

`CADASTROS_LIB` tem 18 cadastros. A tela de Liberação por Unidade deixa a matriz
liberar item por item em todos, e `filtrarCadastroDaUnidade` filtra a unidade por
`sucursais`.

**Sete tinham a coluna no banco. Onze não tinham.** Nesses onze:

1. a matriz libera e o valor fica no aparelho dela;
2. a sincronização sobe o item — sem o campo, que não tem coluna;
3. o download devolve sem o campo;
4. `liberadoNa()` lê lista vazia como "ninguém";
5. a unidade abre a tela e não vê nada.

Sem erro em lugar nenhum. O campo não tinha onde pousar.

`grupos_opcoes` — o caso que ele reportou — era um dos onze. E tinha um agravante:
o salvamento fazia `Object.assign(g,obj)` sem `sucursais`, então **editar o grupo
apagava a liberação**. Liberar funcionava; editar desfazia.

### O que foi feito

- **11 colunas `sucursais` criadas**, todas com `["*"]` nos registros existentes.
  Lista vazia esconderia forma de pagamento, conta bancária e motivo de cancelamento
  de todas as unidades ao mesmo tempo — quebraria a operação para consertar um
  defeito de visibilidade. A matriz restringe depois, item a item.
- `grupos_opcoes` passou a **subir e descer** com o campo.
- Formulário do grupo de opções ganhou o bloco "Quem enxerga este item", e o
  salvamento deixou de apagar a liberação.
- Somados à V186: **7 formulários** com o bloco, contra 4 antes.

### A verificação que faltava

Um teste agora exige que `blocoUnidades` e `lerUnidades` apareçam o mesmo número de
vezes, e verifica os 7 formulários por nome. **Mas isso é frontend.** O que este
defeito ensina é outra coisa: um cadastro pode estar na lista de liberáveis e não ter
a coluna no banco, e nenhum teste de JavaScript pegaria.

Regra que fica: **cadastro entra em `CADASTROS_LIB` só depois de a coluna
`sucursais` existir na tabela.** As duas pontas, ou nenhuma.

## V188 — o botão de liberar tem de funcionar. Sempre.

Três versões seguidas quebraram no mesmo ponto:

- **V186** — três formulários sem o bloco "Quem enxerga este item"
- **V187** — onze tabelas sem a coluna `sucursais` no banco
- **V187** — `grupos_opcoes` não subia nem descia com o campo

Sempre o mesmo desenho: a tela oferece o botão, a matriz clica, e o valor morre em
algum ponto do caminho. Ninguém vê erro. A loja abre a tela e não encontra nada.

Corrigir o terceiro caso não resolve. O que faltava era garantia estrutural.

### O que tornava isso grave não era o bug — era a regra de leitura

`liberadoNa()` trata ausência de dado como "ninguém liberou". Numa liberação de
verdade isso está certo: lista vazia significa lista vazia.

**Mas quando o campo não chega por defeito de encanamento, a mesma regra transforma
um problema técnico invisível em cadastro invisível para a loja inteira.** Foi
exatamente o que aconteceu: o Rafael liberou, o sistema não guardou, e a unidade
concluiu que nada tinha sido liberado.

### As três camadas da correção

**1. O cano foi aberto nos 18.** Todos os cadastros liberáveis agora sobem **e
descem** com `sucursais`. Meia correção é pior que nenhuma — campo que sobe e não
desce faz a liberação parecer salva e sumir no próximo download.

**2. Cano quebrado não esconde mais nada.** `canaisDeLiberacao()` pergunta ao próprio
`MAPA` — a configuração real de sincronização — se o campo sobe para aquele cadastro.
Não consulta o banco, não depende de internet. Se o cano estiver quebrado,
`filtrarCadastroDaUnidade` **não filtra aquele cadastro**: a unidade vê tudo.

Esconder por engano é pior do que mostrar demais. **Dado escondido parece perda de
dado, e a loja para.**

**3. O defeito é denunciado, não engolido.** Fica no Diagnóstico com o nome do
cadastro e a frase "a liberação por unidade não está funcionando em X".

### O teste que impede a quarta vez

`testes/tenant.js` percorre os 18 cadastros liberáveis, monta um item de mentira,
**roda a função de envio de verdade** e confere se `sucursais` sai. Depois faz o
mesmo com a descida. Não é verificação de texto — é execução.

Se alguém acrescentar um cadastro à lista sem ligar o campo, a suíte quebra **antes**
de chegar na loja.

### Regra que fica

**Cadastro só entra em `CADASTROS_LIB` depois que o campo sobe, desce e tem coluna.
As duas pontas, ou nenhuma.** Está escrita no código, no ponto onde a próxima pessoa
vai mexer.

## V189/V190 — `ci is not defined`: a loja não conseguiu fechar o caixa

### O defeito

`FORMAS.map(function(f){ ... data-i="'+ci+'" ... })` — o `map` não tem segundo
parâmetro. **`ci` nunca existiu em lugar nenhum.** Toda montagem da tela de
fechamento estourava `ReferenceError` antes de desenhar, e o modal não abria.

Introduzido por mim na **V179**, ao migrar o campo para o componente monetário:
copiei `data-i` de outro `map` que tinha o índice e não acrescentei o parâmetro.
**Dez dias no ar.**

Patch: `function(f)` → `function(f,ci)`. Uma palavra. E o índice serve — é por ele
que o ENTER encontra o próximo campo.

Verificado no banco antes de qualquer coisa: o caixa real continuava aberto e
íntegro, sem snapshot parcial, sem movimento ou fechamento duplicado. O erro
impedia a tela de abrir, então nada chegou a ser gravado.

### Por que 523 testes verdes não pegaram — medido, não suposto

| Suíte | Uso de DOM | Verificações por regex |
|---|---|---|
| caixa.js | **0** | 0 |
| formas-pagamento.js | **0** | 2 |
| pdv-ux.js | **0** | 50 |
| tenant.js | **0** | 59 |

E `fecharCaixa()` **nunca era executada por teste nenhum**.

As suítes faziam duas coisas, e nenhuma delas era executar a tela:

1. **Extraíam funções** com `corpoDaFuncao` e rodavam a matemática isolada. Isso
   pega erro de conta, e pegou muitos. Mas `montarSnapshot` calcular certo não diz
   nada sobre a tela conseguir abrir.
2. **Verificavam o texto** do arquivo com expressão regular. Isso confirma que um
   trecho está escrito — não que ele roda. **`ci` estava escrito exatamente como eu
   queria. O regex teria aprovado.**

E a varredura de "funções críticas presentes", que eu criei na V186 depois do
apagão do `fundoSugerido`, confere que a **função** existe. `ci` é variável. Passou
reto.

### A prova de que a correção resolve o mecanismo, não só o caso

Reintroduzi o defeito exato e rodei tudo:

- `test:sintaxe` → **verde**
- `test:caixa` → **67/67 verde**
- `test:ux` → **134/134 verde**
- `test:e2e` → **reprova em 5 pontos**, com `ci is not defined`

### `testes/e2e.js` — o que faltava

Carrega o `index.html` inteiro num DOM real (jsdom), deixa o sistema inicializar e
**clica**. Recolhe `window.onerror`, `unhandledrejection`, `console.error` e erros
do jsdom. **Qualquer `ReferenceError` ou `TypeError` reprova a suíte, mesmo que a
tela pareça ter aberto.**

Cobre: carga sem erro; fechamento de caixa montando com os 4 campos e os índices
0,1,2,3; abrir caixa, sangria, suprimento e PDV montando; e handlers apontando para
funções que existem.

Achou na primeira execução três handlers de atribuição tardia (`_respAviso`,
`_respConfirma`) — legítimos, a varredura foi refinada para distinguir isso de
função que não existe em lugar nenhum.

### Regra que fica

**Teste que não executa a tela não prova que a tela abre.** Matemática isolada e
verificação de texto são úteis e continuam — mas nenhuma versão é aprovada sem a
E2E, que agora está no `npm test`.

jsdom entrou como `devDependency`. O sistema publicado continua sem dependência
nenhuma.

## V191 — o cadastro sumia de quem o criou

Santa Fé criou a categoria "Taxa de Entrega", viu no cadastro e no PDV, e o item
sumiu dos dois. **No banco esteve sempre lá**, com `sucursais: []`.

### Causa raiz

O bloco "Quem enxerga este item" **só aparece para a matriz** — e isso está certo, é
ela quem decide o alcance. Mas `lerUnidades` fazia `if(!t)return;`: quando o bloco
não estava na tela, desistia sem gravar nada, e o item nascia com liberação vazia.

Para a matriz é inofensivo — ela vê tudo. **Para a unidade é absurdo:** ela cadastra,
o item aparece na hora (está na memória), e some na primeira sincronização, porque
`filtrarCadastroDaUnidade` pergunta se está liberado para ela e a resposta é "não".

Pior efeito: a pessoa não sabe se salvou, cadastra de novo, e a rede ganha duplicata.
Foi exatamente o que aconteceu — "Taxa de Entrega" virou **duas** categorias, e
"COBERTURA CHOCOLATE" virou **duas** fichas.

### Duas camadas de correção

**1. Cadastro nasce enxergando quem o criou.** Sem o bloco na tela, `lerUnidades`
grava a unidade atual (ou `["*"]` se for matriz). A matriz pode ampliar ou restringir
depois — mas ninguém cria uma coisa para ela desaparecer sozinha.

**2. `soLiberados` nunca apaga o que ainda não subiu.** Se por qualquer motivo um
item criado neste aparelho estiver sem liberação — versão antiga, falha ao ler — o
`_novoAqui` o mantém visível até a nuvem conhecê-lo.

### Dados corrigidos

7 registros com `sucursais` vazio, liberados para todas as unidades: as 2 categorias
"Taxa de Entrega", o grupo "Calda_Coberturas" e 4 fichas de calda e cobertura — que
são exatamente os itens reclamados nos dias anteriores.

**As duplicatas não foram apagadas.** Qual cópia fica é decisão de quem opera: uma
delas pode já ter vínculo de produto ou de estoque.

### O scroll

Investigado: **zero** `href="#"`, **zero** `<form>`, **zero** `scrollTo(0,0)` no
código. O `_rolChave` guarda e devolve a posição. Teste E2E confirma que redesenhar
a lista de categorias e produtos **não** zera a rolagem.

O relato provavelmente vinha do próprio sumiço: a lista encolhia ao perder os itens,
e a página subia por falta de conteúdo. Corrigida a causa, o sintoma some — mas o
teste fica, para o caso de ser outra coisa.

### A prova de que a E2E resolve o mecanismo

Reintroduzi o defeito e rodei tudo:

- `test:caixa` → **67/67 verde**
- `test:tenant` → **130/130 verde**
- `test:e2e` → **reprova em 4 pontos**, com "a categoria sobrevive ao filtro: 0 de 1"

Mais uma vez: teste que não executa o fluxo não prova que o fluxo funciona.

## V192 — o cadastro morria antes de subir. E a correção da V191 era código morto.

A V191 foi publicada, o Rafael atualizou, e o defeito continuou. **A conclusão
anterior estava errada e não deve ser reaproveitada.**

### O que o banco mostrou desta vez

| Registro | No banco? |
|---|---|
| Categoria "Taxa de Entrega" (17:05) | SIM — 0 produtos vinculados |
| Categoria "Taxa de Entrega" (17:15) | SIM — 0 produtos vinculados |
| **O produto criado dentro dela** | **NÃO EXISTE** |

O único "Taxa de Entrega" produto é de 20/08, inativo, na categoria Sobremesas.
**O produto que ele criou nunca chegou ao Postgres.**

### Causa raiz — duas, somadas

**1. `filtrarCadastroDaUnidade()` rodava no BOOT**, antes de qualquer download e
antes de qualquer envio. E ela **apaga da memória do aparelho**.

Sequência real: a unidade cadastra → fecha a tela → no próximo carregamento o filtro
apaga os dois **antes de subirem**. A categoria sobreviveu porque uma sincronização
aconteceu no meio; o produto não teve essa sorte.

**Apagar dado que ainda não subiu é perda definitiva.** E o filtro não tem pressa:
ele já roda logo depois do download, que é quando se sabe o que a nuvem tem. O boot
não precisa dele.

**2. A proteção da V191 nunca existiu.** Escrevi `if(x._novoAqui===true)return true`
em `soLiberados` e registrei como feito. Mas `marcarNovoAqui()` — a função que põe
essa marca — **está escrita no arquivo e não é chamada de lugar nenhum**. Código
morto. A proteção que eu documentei nunca rodou.

Agora a pergunta é feita direto ao `DB._uuid[col][ref]`, o mapa de identificadores
que a nuvem devolve a cada envio confirmado — e que é preenchido de verdade.

### A prova

Reverti só os dois pontos para o estado da V191 e rodei a E2E: **reprova**, com
"o cadastro que a nuvem NÃO conhece sobrevive ao filtro". Com a V192: passa.

### O que fica

**Filtrar é operação destrutiva. Nunca antes de falar com a nuvem, e nunca sobre o
que a nuvem ainda não conhece.** É a terceira vez que este arquivo registra uma
variação disso — V130 (lista vazia), V181 (unidade não resolvida), agora V192
(registro não enviado).

E uma lição sobre mim: **escrever a proteção não é o mesmo que ligá-la.** Passei a
V191 inteira confiando numa marca que nunca era aplicada, e o teste que escrevi
passava porque eu mesmo punha a marca no cenário de teste.

## V193 — o registro criado sem sessão ficava preso para sempre

Terceira tentativa neste defeito. As duas anteriores trataram sintomas; esta achou a
causa medindo, sem hipótese.

### O que os dados mostraram, antes de qualquer alteração

Três categorias "Taxa de Entrega": 17:05, 17:15 e 17:43. Intervalos de 10 e 28
minutos. **Não há duplicação automática** — foram três criações manuais, uma a cada
vez que o item sumia. `replicado_de` nulo em todas; nenhuma rotina de replicação
envolvida.

E as três com **zero produtos**. O produto nunca chegou ao banco, nas três vezes.

### Causa raiz

`carimbarOrigem()` — chamada por `salvar()` — desiste quando `NUVEM.loja` ainda não
está resolvida. Isso acontece nos primeiros segundos após abrir o sistema, e sempre
que a sessão demora.

O registro nasce sem `_loja`. No envio, o motor faz o certo: marca
`_tenantDesconhecido` e o retira da lista, para não adotar dado órfão dando a ele a
empresa de quem está logado agora.

**Mas essa marca nunca era limpa.** Não havia caminho de volta. O registro ficava
retido em silêncio, para sempre, e a única pista era um contador numa tela de
diagnóstico que ninguém abre.

A categoria subia porque era criada com a sessão já pronta; o produto, criado na
sequência dentro da mesma tela, pegava a janela ruim. Ou o contrário. **Loteria** —
o que explica por que o comportamento parecia aleatório e por que as correções
anteriores "funcionavam" em teste e falhavam na loja.

### Correção

Quando a sessão aparece, o registro órfão **é adotado** pela empresa da sessão — com
a condição de que tenha nascido neste aparelho e ainda não conheça a nuvem. Dado de
outra empresa tem `_loja` preenchido e **continua retido**, exatamente como antes: a
regra de isolamento não foi afrouxada.

E o motor **avisa** quando retém, em vez de calar. O silêncio foi o que fez o produto
sumir sem deixar rastro.

### Correção a um registro meu

A V192 afirmou que `marcarNovoAqui()` era código morto. **Estava errado** — ela é
chamada por `carimbarOrigem()`, que é chamada por `salvar()`. Eu procurei pelo nome
da função em vez de seguir a cadeia de chamadas. A troca por `aNuvemNaoConhece` que
fiz na V192 continua correta e mais direta, mas o diagnóstico que a justificou estava
errado, e fica registrado assim.

### Contraprova

Reintroduzi o defeito (removi a limpeza da marca) e a suíte **reprovou** em
"E A MARCA DE RETIDO É LIMPA". Com a correção: 52/52.

## V194 — o aviso de versão nova podia nunca aparecer

O Rafael atualizou e o aviso de versão nova não apareceu.

`checarVersao()` usa a etiqueta do arquivo (etag) para economizar banda: se a
etiqueta não mudou, não vale baixar o arquivo inteiro. Correto — foi o que derrubou
o consumo de 201 MB/hora para menos de 1 MB/hora.

Mas a **primeira** checagem fazia:

```js
if(_etiquetaArquivo===null){ _etiquetaArquivo=et; mudou=false; }
```

Guardava a etiqueta e voltava **sem comparar a versão**. Só comparava da segunda vez
em diante, e só se a etiqueta mudasse.

**Efeito:** se a página foi aberta logo depois de uma publicação, a primeira checagem
guarda a etiqueta já nova, nunca vê mudança, e o aviso **nunca aparece**. A loja fica
numa versão velha sem saber — e sem pista nenhuma, porque não há erro.

A economia de banda continua: etiqueta igual segue sem baixar. O que mudou é que a
primeira vez baixa e compara de verdade.

**Regra:** otimização não pode custar a correção. Quando as duas brigam, a correção
ganha — e aqui nem era preciso escolher: bastava a primeira checagem ser honesta.

## V195 — a atualização não chegava, e a culpa era do mecanismo

O Rafael atualizou, e o rodapé continuou mostrando **V192** com a V194 publicada. A
resposta que eu dei — abrir com `?v=194` — estava errada como solução: link
diferente por pessoa não funciona para quatro lojas, muito menos para sessenta. Ele
apontou isso, e tinha razão.

### Três defeitos somados

**1. O `sw.js` nunca mudava.** O navegador só instala um service worker novo se o
**arquivo** mudar — ele compara byte a byte. Como o `sw.js` era idêntico entre
versões, o service worker antigo continuava servindo o sistema antigo do cache,
indefinidamente. Esta era a causa principal.

**2. Ninguém pedia atualização ao service worker.** Ele era registrado e esquecido.
`registration.update()` nunca era chamado; o navegador faz isso por conta própria
raramente e sem garantia.

**3. `aplicarAtualizacao()` trocava de endereço em vez de limpar o cache.**
`location.replace(pathname+'?v='+Date.now())` ia buscar num endereço diferente em vez
de jogar fora o arquivo guardado. A pessoa ficava com `?v=1787…` na barra para
sempre, e o service worker passava a guardar esse endereço também — **duplicando o
problema em vez de resolver**. E o `sw.js` já sabia limpar o cache desde que foi
criado: responde à mensagem `'limpar-cache'`, e ninguém nunca mandava.

### Correção

- `VERSAO_SW` dentro do `sw.js`, subindo a cada publicação, e o nome do cache
  carrega a versão — o `activate` apaga o antigo automaticamente
- `reg.update()` na carga e a cada 5 minutos
- `controllerchange` recarrega a página uma vez quando o service worker novo assume
- `aplicarAtualizacao()` manda limpar o cache de verdade e recarrega no **mesmo**
  endereço, com prazo de 1,2 s para não travar se o service worker não responder

### A verificação que impede a repetição

`test:sintaxe` agora exige que a versão do `sw.js` seja **idêntica** à do
`index.html`. Contraprova: coloquei `V192` no `sw.js` com `V195` no index e a suíte
reprovou com a mensagem exata do problema real.

**Regra:** publicar sem subir a versão do `sw.js` é publicar para ninguém.

## V196 — os dois 403 da sincronização

O Console mostrou dois `403 (Forbidden)` a cada ciclo de sincronização.

### O UPSERT DO SYNC PRECISA DE POLITICA DE UPDATE

`cancelamentos` tinha política de INSERT e de SELECT. **Faltava UPDATE.**

A sincronização usa `on conflict (loja_id,ref_local) do update` — o padrão de todas
as tabelas. Na **primeira** vez a linha não existe, é INSERT puro e passa. Da
**segunda** em diante ela existe, o comando vira UPDATE, e o Postgres recusa.

Provado na mesma sessão, mesmo comando, duas vezes seguidas:

- 1ª vez → passou
- 2ª vez → `new row violates row-level security policy`

Efeito: todo cancelamento ficava só no aparelho e nunca se consolidava na nuvem. Em
silêncio, porque 403 no sync não chega ao operador.

Política de UPDATE criada, repetindo a de INSERT — não afrouxa nada, apenas deixa a
pessoa reenviar o dado que ela mesma pode criar.

Varri as demais tabelas: nenhuma outra com INSERT sem UPDATE.

### `usuarios_sistema`: a recusa estava certa, a tentativa é que não

Só gestor grava — e isso é correto, usuário é administrado pela matriz. Mas o motor
enviava a tabela de todo aparelho, a cada ciclo. O gerente de unidade tomava 403
sempre.

`soGestor:true` faz o motor **pular** a tabela quando quem está logado não é matriz.
A política no banco continua idêntica: só se parou de bater numa porta que a própria
regra manda manter fechada. Mesmo padrão que já existia para `clientes_nexor`.

**Regra:** 403 repetido no Console não é ruído — ou a regra está errada, ou o
sistema está tentando o que não devia. Aqui era um de cada.

## V197 — parei de corrigir por hipótese

Três versões tentaram consertar o sumiço do cadastro e nenhuma acertou, porque eu
estava corrigindo hipóteses. **No meu ambiente o ciclo passa; no aparelho da loja o
cadastro some.** Enquanto eu não souber quem apaga e quando, qualquer correção é
chute.

### O registrador de sumiços

Instrumentação dentro do próprio sistema. Toda vez que uma coleção de cadastro
**encolhe**, ele anota: quando, qual coleção, quantos sumiram, quais eram, o
`sucursais` de cada um, a unidade ativa, se `ehMatriz()` era verdadeiro, e as três
linhas de pilha de quem chamou.

Ligado em dois pontos — os únicos que podem encolher uma coleção:

- `filtrarCadastroDaUnidade` → motivo "filtro de liberação por unidade"
- `volta()` no download → motivo "download substituiu a lista"

Aparece na tela de Diagnóstico com botão de copiar. **Não muda comportamento nenhum.
Só observa.**

### O scroll — a causa real, e não era `scrollTo`

Procurei `scrollTo` três vezes e não existe. O que acontece é mais simples, e por
isso passou despercebido:

**Selecionar uma categoria filtra a lista de produtos de 42 para um ou dois. A altura
do conteúdo despenca, o container fica menor que a rolagem atual, e o navegador puxa
a rolagem para caber.** Do lado de quem usa: "a tela subiu sozinha".

Por isso só acontecia clicando numa categoria lá embaixo — é onde a diferença de
altura é grande. E por isso nenhum teste de `window.scrollTo` pegou: **o culpado é o
layout, não o código.**

Correção: `selCat` segura a altura mínima do painel antes de trocar o conteúdo,
devolve a rolagem ao lugar e traz a categoria clicada de volta ao campo de visão com
`block:'nearest'` — que só mexe se ela tiver saído da tela.

**Ressalva:** jsdom não calcula layout, então não reproduz o clamp. O teste verifica
que a guarda existe e não estraga a rolagem; o clamp em si só o navegador real
mostra. Está na lista do teste manual, marcado como tal.

### O que os dados dizem até aqui

Quatro categorias "Taxa de Entrega" no banco (17:05, 17:15, 17:43, 18:26) — quatro
criações manuais, uma a cada sumiço. **Zero produtos criados hoje.** A categoria sobe;
o produto nunca. As duas últimas categorias já subiram com a liberação correta
(`suc_mt1unhbx2xrb`), o que confirma que a V191/V193 funcionaram nessa parte.

O que falta descobrir é por que o **produto** não sobe — e é para isso que o
registrador existe.

## V197.1 — o 400 do PostgREST: coluna nova que ele não conhecia

O Console mostrou `400 Bad Request` em `caixa_movimentos`. Erro meu, e de um tipo que
eu não conhecia neste sistema.

### A causa

O **PostgREST** — a camada REST do Supabase — guarda o schema em **cache**. Quando uma
migration acrescenta coluna, ele continua com a lista antiga até alguém mandar
recarregar. Enquanto isso, **todo envio que inclua a coluna nova volta 400**.

A V176 acrescentou seis colunas em `caixa_movimentos` (`destino_conta_id`,
`destino_nome`, `responsavel_id`, `lanc_ref`, `hora`, `data_hora`). O sync passou a
mandar esses campos e o PostgREST recusou o lote inteiro. **Sangria e suprimento
pararam de subir, em silêncio.**

O SQL direto passava — testei e passou. Por isso demorei a achar: o defeito não está
no banco, está na camada entre o navegador e o banco.

Esqueci o `NOTIFY` nas migrations da V176, V187 e V188 — e a V187/V188 acrescentaram
`sucursais` em **onze** tabelas.

### Correção

`NOTIFY pgrst, 'reload schema'` executado, e a regra registrada como comentário do
schema `public`, onde quem mexer no banco vai ler:

> Toda migration que acrescenta ou remove coluna deve terminar com
> `NOTIFY pgrst, 'reload schema';`

### As quatro "Taxa de Entrega"

Todas com zero produtos e zero itens vendidos — eram recadastros do mesmo item, um a
cada sumiço. Removidas as três primeiras, **guardadas antes** em
`categorias_removidas_duplicadas`. Ficou a de 18:26, que já nasceu com a liberação
correta para Santa Fé.

## V199 — mostrar a fila em vez de adivinhar

Três versões tentando descobrir por que um produto não chega ao banco, olhando o
código de fora. `auditarFila()` existe desde a V148 e classifica cada registro que
não subiu — válido, sem permissão, tenant desconhecido, de outra empresa, legado.
**Mas só aparecia num relatório técnico que ninguém abre.**

A resposta estava dentro do sistema o tempo todo. Bastava mostrar.

`pintaFilaPendente()` na tela de Diagnóstico, com botão de copiar, trazendo:

- quantos registros estão parados e em qual classificação
- os nomes e as tabelas de cada um
- **o último erro de cada envio** — que hoje some da tela em segundos

Junto com o registrador de sumiços da V197, o aparelho passa a poder responder
sozinho: *o que não subiu, por quê, e o que sumiu, quando*.

### Sobre o canal do produto

Verificado: `disponivelNo()` está **correto**. Produto marcado só para Delivery
retorna `false` para o canal `pdv` e `true` para `cardapio`. É o comportamento
esperado — quem marca só Delivery não quer o item no balcão.

O que a loja relatou não é defeito de canal: o produto **não existe no banco**.
Nenhum produto foi criado hoje, nas quatro tentativas.

### Lição

Quando a reprodução local passa e a produção falha, o caminho não é mais uma
hipótese: é **instrumentar e pedir o dado**. Levei três versões para fazer isso.

## V200 — dois defeitos reais, e "salvo" passa a significar "está na nuvem"

**Nenhum produto foi criado no banco desde 20/08.** Sete dias, várias tentativas, e a
tela dizendo "Produto salvo." toda vez.

### 1. O produto nascia com canais que não existem

O padrão era `{delivery, salao, online, digital}`. Os canais reais do sistema, em
`CANAIS`, são: **pdv, delivery, cardapio, mesa, totem**. `salao`, `online` e
`digital` **não existem em lugar nenhum** — sobraram de uma versão antiga.

`disponivelNo()` só devolve "aparece em todo lugar" quando **nenhum** canal está
marcado. Aqui havia três marcados, todos inválidos — então o produto nascia
**invisível na frente de caixa**. No cardápio digital aparecia só por causa do
`d.online` legado, que a função ainda aceita.

Era exatamente o que a loja via: some no PDV, aparece no Delivery.

### 2. Editar produto fora da lista o fazia evaporar

```js
var i = DB.produtos.findIndex(...);
DB.produtos[i] = p;          // i === -1
```

`DB.produtos[-1] = p` **não insere nada**: cria uma propriedade solta no array e o
produto desaparece. Acontece quando o produto sai da lista entre abrir o formulário e
salvar — que é justamente o cenário destas últimas versões.

### 3. "Salvo" era mentira, e agora não é

O botão dizia "Produto salvo." assim que gravava no aparelho. O envio ficava agendado
para depois, e quando falhava **ninguém ficava sabendo**. O produto sumia na
sincronização seguinte e a pessoa jurava que tinha salvado — porque tinha.

`confirmarNaNuvem()` espera a sincronização e consulta `DB._uuid[col][id]`, o mapa de
identificadores que só é preenchido quando a nuvem devolve o registro. **É a única
prova que vale.**

- confirmou → "salvo e enviado"
- não confirmou → aviso na hora, **com o motivo** (permissão, sem empresa, recusa da
  nuvem), e a orientação de abrir a fila de envio

**Nada é desfeito**: o registro continua no aparelho e sobe sozinho quando der. O que
muda é a pessoa **saber**.

Aplicado a produto e categoria. Serve para qualquer cadastro.

### A regra

**Interface não pode prometer o que não verificou.** "Salvo" sem confirmação é uma
afirmação sobre o futuro, não sobre o presente — e quando ela falha, a pessoa perde a
confiança no sistema inteiro, com razão.

## V201 — o produto era APAGADO da nuvem, e a causa estava no espelhamento

Sete versões tentando entender por que o produto não chegava ao banco. A pergunta
estava errada: **ele chegava, e era apagado logo depois.**

### O que os dados mostraram

Os 42 produtos do banco foram criados **todos em 20/08 às 21:09:32** — no mesmo
segundo. Foi uma importação em massa. **Nenhum produto criado pela tela jamais
sobreviveu no banco.**

### A causa

`apagarRemovidos` tratava **ausência na lista local como exclusão**. As travas
existentes cobrem o caso grosseiro — lista vazia, mais de 200 de uma vez, mais de 60%
do total. Nenhuma cobre **um registro só**.

A sequência:

1. o produto é criado e sobe para a nuvem;
2. `filtrarCadastroDaUnidade` o tira da lista local por algum motivo;
3. no ciclo seguinte, `apagarRemovidos` vê que ele "sumiu" e conclui que foi
   **excluído por você**;
4. `DELETE` na nuvem. Um registro, dentro de todos os limites, sem disparar trava.

E o log dizia `"1 excluído(s) por você"` — o sistema afirmando com confiança algo que
nunca aconteceu.

### A correção

**Exclusão precisa ser declarada.** Quem apaga pela tela chama
`declararExclusao(col, id)`. O espelhamento apaga da nuvem **somente** o que está
declarado. Sumir da lista por filtro, por erro, por contexto errado ou por qualquer
outro motivo deixa de significar exclusão — e o sistema **avisa** quando isso
acontece, em vez de apagar calado.

Aplicado a 12 cadastros: categorias, produtos, grupos de opções, grupos de
ingredientes, insumos, fichas, fornecedores, contas, formas de pagamento,
entregadores, cupons e mesas.

### Contraprova

Reintroduzi o defeito (`deVerdade = sumiram`) e a suíte reprovou em "o espelhamento
só apaga o que foi declarado". Com a correção: 625 testes verdes.

### A regra, pela quarta vez

**Ausência de dado não é resposta.** Este arquivo já registrou isso na V130 (lista
vazia não é "sou a matriz"), na V181 (unidade não resolvida não é "não vê nada") e na
V192 (registro não enviado não é "pode apagar"). Agora: **sumir da lista não é ter
sido excluído.**

Eu deveria ter procurado aqui na segunda versão, não na sétima. O sinal estava no
próprio log — "excluído por você" aparecendo sem ninguém ter excluído nada.

---

## V207 — o pedido de base passa a fechar dos dois lados

O fluxo combinado, descrito pelo Rafael, é este:

| Quem | Ação | O que o sistema faz |
|---|---|---|
| unidade | faz e envia o pedido | sobe para a matriz |
| matriz | confirma | só muda de fase |
| matriz | lança produção | baixa os insumos da ficha, põe a base no estoque da matriz |
| matriz | **marca entregue** | a base **sai** do estoque da matriz **e** nasce a conta a **receber** |
| unidade | **"Recebi as bases"** | entra no estoque dela **e** nasce a conta a **pagar** |

Estava implementado pela metade, e a metade que faltava não era a que eu tinha
relatado. Os botões da matriz existiam e funcionavam. Os defeitos eram outros dois.

### 1. A cobrança nascia como despesa quitada

`faturarPedido` gravava em `DB.lancamentos` — a coleção **legada**. Ela não sobe
para a nuvem, e a migração do bloco 13 a converte para `DB.lancFin` com
`pago:true` e com o tipo virado, porque só trata `'entrada'` como receita. O
lançamento era criado com `tipo:'receita'`, que não é `'entrada'`. Resultado: a
conta a **receber** da matriz virava uma **despesa já paga**, com a data de hoje
no lugar do vencimento digitado, presa no aparelho de quem clicou.

E existia, no mesmo arquivo, uma segunda versão da função — `faturarPedidoBase` —
que gravava certo em `DB.lancFin`. Nenhum botão a chamava. **A versão certa estava
desligada e a errada estava no botão.**

### 2. A base entrava no estoque da matriz e nunca saía

A produção põe a base no estoque; nada a tirava de lá. O estoque da matriz só
crescia, e não havia como responder quanto cada unidade tinha levado — a saída
que responderia isso nunca foi escrita.

### O que passou a valer

**O vencimento não se pergunta mais.** Era um `prompt` a cada pedido e a resposta
era sempre a mesma conta: pedido até segunda ao meio-dia, retirada na quinta.
Três dias depois da data do pedido é o dia da retirada, e é quando a unidade
paga. O sistema faz a conta.

**"Entregue" é um clique só, e mexe nas duas pontas.** A saída do estoque e a
cobrança nascem juntas porque são o mesmo fato. Se só uma acontecesse, o estoque
ou o financeiro ficaria mentindo, e ninguém descobriria isso olhando a tela do
pedido.

**A saída espelha a entrada.** As linhas saem de `montarLinhas(...,'producao')` e
fica só a entrada do produto acabado, com a direção virada. Assim a quantidade
que sai é, por construção, exatamente a que entrou — inclusive quando a ficha tem
fator de rendimento e o destino está em outra unidade de medida. Recalcular por
fora daria diferença no dia em que alguém mexesse no fator.

**A trava contra repetir mora no movimento, não no pedido.** Um campo novo em
`DB.pedidosBase` não sobreviveria à sincronização: a tabela da nuvem não tem
coluna para ele e o pedido voltaria de lá sem a marca. A marca fica na
`identificacao` do próprio movimento, que sobe e desce inteiro — mesmo caminho
que a ordem de produção já usava para se reconhecer. **Nenhuma migration foi
necessária.**

**Dar entrada é da unidade, e só dela.** Tinha botão para isso na tela da matriz
também. Quem abrisse por engano poria a mercadoria no estoque de quem não a
recebeu, e o pedido apareceria conferido sem ninguém ter conferido nada.

**Ficha chamada `BASE <SABOR>` já nasce no catálogo de pedido, vinculada.** O
nome basta como gatilho — não precisa de campo novo nem de cadastrar a mesma
coisa duas vezes em duas telas. Cadastrar duas vezes era como o vínculo entre a
base e a ficha deixava de existir, e sem vínculo não há baixa de estoque nenhuma.
Nasce **inativa**: sem preço, a unidade pediria a R$ 0,00 e a cobrança nasceria
zerada — erro silencioso, do tipo que só aparece no fechamento do mês.

**Relatório de Pedidos de Base**, por sabor, por unidade e por mês, com os preços
que valiam no dia de cada pedido. Recalcular pelo preço de hoje daria um número
diferente do que foi cobrado.

### Removidas

`faturarPedido` (coleção legada), `produzirPedidoBase`, `darEntradaPedido` e
`pagarPedido` — as três últimas eram gêmeas das que ficaram. Com elas saíram
`diasFrenteISO` e `brParaISO`, que só existiam para servi-las.

### Contraprova

72 testes novos em `testes/pedido-base.js`, e o fluxo inteiro rodado em Chromium
real: leite 500 → 492 na produção (20 caixas ÷ rendimento 10 × 4 l = 8 l), base
0 → 20; na entrega base 20 → 0, conta a receber de R$ 500 **em aberto** vencendo
três dias depois do pedido, e **zero** linhas na coleção legada. Clicar em
"Entregue" duas vezes não dobra nada. Total: 13 suítes, 612 asserções, zero
falhas.

---

## V207.1 — o sino passou a avisar

Ele respondia sempre a mesma frase, dizendo que não havia aviso nenhum, com
um zero fixo escrito no HTML ao lado. Não havia nada por trás dele. O
franqueado só descobria que o pedido tinha ficado pronto se abrisse a tela e
olhasse o selo.

### Não existe tabela de notificações, e isso é a decisão

O aviso é **derivado do próprio pedido**. Cada mudança de fase já grava a hora
— `enviadoEm`, `confirmadoEm`, `entregueEm`, `pagoEm` — e essa hora é o aviso.
Uma tabela de notificações seria um segundo lugar onde a verdade mora, e no
dia em que os dois discordassem ninguém saberia qual acreditar. Também
dispensa migration: os campos já sobem e descem.

| Quem | É avisado de |
|---|---|
| matriz | chegou pedido novo · a unidade conferiu o recebimento |
| unidade | confirmado · pronto para retirar · pago · recusado |

O franqueado só vê pedido da **unidade dele** — a mesma regra da V202, agora
também no sino.

### O "já li" é do aparelho, não da nuvem

É a lista de avisos que **esta pessoa** já viu **nesta máquina**, em
`localStorage`, por usuário. Guardar isso no banco faria abrir o sino no
caixa apagar o aviso do celular do dono. A lista guarda os 300 mais recentes
e para de crescer.

### A estreia é quieta

Na primeira vez num aparelho, o histórico inteiro é marcado como visto. Sem
isso, quem abrisse hoje veria quarenta avisos de pedidos de meses atrás e
aprenderia, no primeiro dia, a ignorar o sino — que é a única maneira de um
alerta deixar de funcionar de vez.

Marca de identificação: o aviso é identificado por `pedido:tipo`, não por
horário. Um aviso que nasce com data antiga (a conferência da unidade, que
não tem hora própria e toma emprestada a da entrega) apareceria como já lido
se a comparação fosse por tempo.

### Contraprova

43 testes em `testes/sino.js`, incluindo `localStorage` que lança exceção — em
navegador com dados de site bloqueados a tela não pode cair por causa do sino.
E no Chromium: matriz com zero na estreia, `1` ao chegar pedido novo, painel
abre com os dois, número volta a zero ao ler; franqueado vê `1` ao confirmar e
`2` ao ficar pronto, e nenhum aviso da outra unidade. Total: 14 suítes, 757
asserções, zero falhas.

---

## V208 — auditoria do trilho quente, e um defeito no relatório de formas

O Rafael pediu, antes de publicar: auditar o caminho que as seis lojas
percorrem todo dia — cardápio → PDV → pagamento → venda → estoque →
fechamento → relatórios — e só subir se estivesse inteiro.

### O que a auditoria mediu

**As 60 funções do trilho quente são texto IDÊNTICO à V201**, a versão que
está na loja hoje. `finalizarVenda`, `baixarEstoqueVenda`, `fecharCaixa`,
`movimentoCaixa`, `esperadoCaixa`, `renderVenda`, `irPagamento`, `addPag`,
`montarSnapshot`, `telaPDV`, `telaCardapio` — nenhuma foi tocada em
nenhuma das versões desde então. Função cujo texto não mudou não pode ter
mudado de comportamento.

Depois disso, o trilho foi **percorrido de verdade**, clicando: abrir
caixa com operador e turno, achar o produto na grade pelo nome, abrir a
pergunta de opções, marcar a borda, digitar quantidade 2, aplicar desconto,
dividir o pagamento entre dinheiro e pix editando o valor, finalizar,
conferir o estoque item a item, fazer uma entrega com taxa de zona e
entregador, assinar uma sangria, fechar o caixa cego contando a gaveta, e
abrir os relatórios. Em jsdom (suíte permanente) e em Chromium de verdade.

Os números batem exatamente: comanda R$ 50 → desconto R$ 5 → R$ 45 pagos
em 25 + 20; casquinha 200 → 198; Gelato Venda 50 → 49,9 (pote de 100 g de
uma ficha que rende 10 kg em 100 unidades); Nutella 5 → 4,96 (borda de
1 kg para 50 unidades, duas vezes). Gaveta = fundo + dinheiro − sangria.

### O defeito encontrado

**"Vendas por Forma de Pagamento" mostrava a venda do dia como "Não
informado".** O PDV grava a forma em `pagamento.forma` — e sempre gravou,
`addPag()` faz `_pagos.push({forma:f,valor:...})`. O relatório lia só
`formaId`.

Por que ninguém achou: a **descida** da nuvem devolve o pagamento com os
dois campos preenchidos (`forma` e `formaId`, arrumado na V136). Então a
venda de ontem, que já foi e voltou, aparecia certa; a de hoje, que ainda
não voltou, aparecia sem forma. **O relatório se consertava sozinho de um
dia para o outro** — e por isso o defeito atravessou tudo.

Cinco lugares liam só `formaId`: Vendas por Forma de Pagamento, Vendas por
Período (o filtro e a exibição), o detalhe do pedido no relatório e o DRE.
Passaram a ler os dois, como o fechamento de caixa e o detalhe do pedido já
faziam. É pré-existente: está na loja hoje, na V201.

### O que a auditoria confirmou que É assim mesmo

**A opção do produto acha a ficha técnica PELO NOME.** Quando a opção vai
para a comanda ela leva só nome e preço — `modalOpcoes` monta
`{grupo,nome,preco}`, sem o vínculo. A baixa então procura uma ficha com
aquele nome exato. Se a matriz renomear a ficha e não a opção, o insumo da
borda para de sair do estoque, em silêncio. Está testado nos dois sentidos.

**Sangria, suprimento, cancelamento e fechamento exigem senha, e a senha
só é conferida na nuvem.** Sem internet, o caixa vende normalmente, mas não
fecha. Vem da V201 — não é regressão.

### Contraprova

`testes/frente-de-caixa.js`, 98 verificações, o trilho inteiro num DOM
real. Ela fixa o fuso em `America/Sao_Paulo`: `hojeISO()` força o horário
de Brasília e `caixa.aberto` usa o relógio do aparelho, então num servidor
em UTC, entre 21h e meia-noite, o caixa fechado não aparecia no próprio
relatório. Na loja isso não acontece — mas o teste tem de medir o sistema,
não a máquina.

Total: 15 suítes, 851 asserções, zero falhas.

---

## V209 — a opção levava o nome, não o vínculo

Pergunta do Rafael, ao ler a auditoria da V208: *"toda opção de grupo,
exceto sabores — bordas, coberturas, caldas, cascões, creme de avelã —
tem ficha técnica vinculada. Ela está sem a vinculação?"*

**Não estava.** O vínculo está cadastrado, sobe e desce da nuvem em
`ficha_id`, e a tela de Gestão de Cardápio mostra o nome da ficha ao lado
de cada opção. Nada se corrompeu.

O que acontecia é que **a venda jogava o vínculo fora**. `modalOpcoes`
montava a opção da comanda com `{grupo, nome, preco}` — sem `fichaId`. A
baixa de estoque lê `o.fichaId` e, quando não acha, cai num plano B:
procurar a ficha **pelo nome da opção**. Como o nome nunca vinha, o plano B
virou o único caminho — e ele só acerta quando o nome da opção é igual ao
nome da ficha.

### Medido no banco da Jolô, 28/08/2026

Das 12 opções fora de sabores:

| Situação | Quantas | Baixava estoque? |
|---|---|---|
| nome da opção igual ao da ficha | 3 | sim |
| **vinculada, nome diferente** | **7** | **não** |
| sem ficha cadastrada | 2 | não |

As sete que não baixavam: Borda Creme de Pistache (`BORDA CREME
PISTACHE`), Borda de Creme de Ninho (`BORDA CREME NINHO`), Borda de Doce
de Leite (`BORDA DOCE LEITE`), Creme de Avelã (`CALDA CREME DE AVELÃ`),
Creme de Ninho (`CALDA CREME DE NINHO`), Cascão Chocolate (`CASCAO
CHOCOLATE`) e Cascão Tradicional (`CASCAO TRADICIONAL`). A diferença é
sempre a mesma coisa: um "de", um acento, a caixa das letras.

Era a perda invisível que o próprio comentário do código dizia estar
resolvida: *"Borda de Nutella, cobertura, Ovomaltine: o cliente escolhe e
o insumo some do pote, mas não saía do sistema"*. Saía para a Borda
Nutella, cujo nome por acaso batia. Para as outras sete, não.

### A correção

A opção passa a levar `fichaId` para a comanda. O identificador não depende
de como cada nome foi escrito. O plano B por nome fica de pé, só para as
comandas gravadas antes desta versão.

### O que muda na loja

Depois de publicar, esses sete insumos **passam a sair do estoque a cada
venda**. O saldo atual deles está inflado — nunca baixou. Uma contagem
desses itens logo depois de publicar põe o estoque no lugar; sem ela, o
sistema vai continuar partindo de um número que nunca foi verdade.

E ficam duas opções para o Rafael decidir: **Cobertura de Chocolate** e
**Cobertura de Morango** não têm ficha nenhuma. Repare que existe também
uma **Cobertura Morango** (sem o "de"), essa com ficha — provavelmente a
mesma coisa cadastrada duas vezes.

### Contraprova

`testes/frente-de-caixa.js` passou a 101 verificações. Três novas fecham
exatamente este caso: a opção leva a ficha para a comanda; baixa pelo
identificador mesmo com o nome sem nenhuma parecença; e a comanda antiga,
sem vínculo, continua sendo resolvida pelo nome exato. Total: 15 suítes,
854 asserções, zero falhas.

---

## V210 — o horário abria a loja só na tela

Pedido do Rafael: *"o robô do WhatsApp está vinculado, quando coloca o
horário está funcionando, publicar o cardápio, o cardápio digital
respeita o horário — dê uma vasculhada nisso também."*

### Onde essas telas moram

`telaCfgCardapio` e `telaZap` não são itens de menu: são **abas de
Configuração da Loja › Canais de Venda e Integração**, ao lado de Canais
de venda, Aplicativo Joia, API de dados e Integração TEF. Foi neste mesmo
caminho que a V204 corrigiu o botão que gravava `CN.aba` em vez de
`CN2.aba` e abria na aba errada.

As seis abas abrem, as cinco do cardápio montam, as quatro do robô
montam. Zero erro de runtime.

### Quem consome o horário não está neste repositório

O horário mora em `DB.cardapio[sucursal].horarios` e sobe para
`cardapio_config.horarios`. Quem lê são o cardápio digital e o robô do
WhatsApp (`nexor-whatsapp`), de fora. Então "funcionar", aqui, significa
uma coisa só: **o que a pessoa marca na tela tem de subir e sobreviver ao
próximo download.**

Duas marcas decidem isso:

| | |
|---|---|
| `_padrao` | configuração que o lojista nunca salvou nasce com ela, e o envio **filtra essas fora de propósito** — config padrão subindo apagaria o horário de verdade |
| `_salvoEm` | é o que a trava da V119 compara com `atualizado_em` da nuvem para decidir quem é mais novo |

### O defeito

Cinco caminhos mexem no horário. `setHora`, `aplicarHorario` e
`fecharDias` sempre gravaram as duas marcas. **`abrirHojeAgora` e `togDia`
não gravavam nenhuma.**

Cada uma sozinha já bastava para o botão não valer:

- sem apagar `_padrao`, o `sincronizar()` que o próprio `abrirHojeAgora`
  chama na linha seguinte **saía sem levar nada** — a loja abria na tela e
  continuava fechada para o robô e para o cardápio;
- sem `_salvoEm`, o download seguinte escrevia por cima e **desfazia** a
  abertura.

`abrirHojeAgora` é o atalho do balcão — "Abrir hoje até 23:59" — e `togDia`
é o interruptor de cada dia. São justamente os dois botões de quem precisa
resolver na hora. O código já contava essa história em `cardAtual()`: *"o
fechamento de segunda foi parar no Alphaville enquanto Santa Fe seguia com
o horário antigo e o robô respondia fechada"*.

### O estado real, medido na nuvem

Quatro unidades ativas, todas com cardápio configurado e sete dias de
horário salvos. Nenhuma está com a configuração padrão. Alphaville está
com `22:38` de segunda a sábado — parece digitação de teste, mas é
cadastro, não defeito.

### E as opções que faltavam

`Cobertura de Chocolate` e `Cobertura de Morango` foram vinculadas às
fichas, com autorização do Rafael. Existiam **duas fichas chamadas
`COBERTURA CHOCOLATE`** — uma sem nenhum ingrediente e sem uso, outra com
ingrediente; foi usada a que tem. As doze opções fora de sabores estão
vinculadas; nenhuma sem ficha.

Fica registrado que `Cobertura de Morango` e `Cobertura Morango` apontam
para a mesma ficha — é a mesma coisa cadastrada duas vezes, e apagar uma é
decisão de cadastro do Rafael.

### Contraprova

`testes/cardapio-horario.js`, 29 verificações: os cinco caminhos do
horário, as duas marcas em cada um, a regra que filtra a config padrão do
envio, o cálculo de "aberto agora" (inclusive quem fecha depois da
meia-noite) e a porta de entrada das duas telas.
`testes/vinculo-opcao.js`, 19 verificações, prende o vínculo da opção.
Total: 17 suítes, 902 asserções, zero falhas.

---

## V211 — a varredura de todas as telas

O Rafael pediu a auditoria dos módulos restantes: *"entra em cada módulo,
testa tudo, vê onde está interligado, se tiver alguma coisa quebrada,
algum botão, e principalmente bug de tela — tem muita tela que você está
lá no final, clica pra mexer alguma coisa, ela sobe automático pra cima."*

### A ferramenta

`ferramentas/varrer.js` monta as **94 telas** num DOM de verdade, lê os
`onclick` que cada uma gerou, confere se a função existe e **clica** em
cada um, anotando qualquer erro de runtime. Confirmações respondem NÃO e
`prompt` responde nulo: o caminho do botão é exercitado até a pergunta e
para ali, sem apagar nada.

Resultado: nenhuma tela deixa de montar, nenhum handler aponta para função
inexistente. Três defeitos reais apareceram.

### 1. Uma tela congelava o navegador

`telaFinanceiroNexor` — Mensalidades das Unidades. A guarda era
`!INS.nuvem && !INS.carregando`. O `catch` devolvia `carregando` para
falso, gravava o erro e chamava a tela de novo; como `INS.nuvem` seguia
vazio, a guarda voltava a ser verdadeira. Nova chamada, nova falha, nova
chamada: **laço infinito, navegador travado, em qualquer falha de rede.**

O `INS.erro` era gravado e nunca lido. A tela gêmea, `telaInstalacao`, já
fazia certo desde sempre: põe o erro na guarda **e** o mostra na tela com
um botão de tentar de novo. A terceira condição tinha ficado para trás na
cópia.

### 2. Quatro botões de exportar, quebrados

`baixarCSV(nome, linhas)` — nesta ordem. Quatro chamadas passavam ao
contrário: **Vendas por Mesa, Cancelamentos, Cupons Gerados** e o **Baixar
modelo** da importação. Dentro da função, `linhas` recebia o texto do nome
do arquivo, `linhas.map` não existia, e o clique estourava sem aviso na
tela — só um erro no console, que ninguém abre no balcão. Os outros oito
exportadores sempre chamaram na ordem certa.

### 3. O pulo de rolagem: eram 28 telas, não algumas

A guarda existia desde antes e resolvia o problema por inteiro — mas
olhava **duas** caixas: `.etScroll` e `.finWrap`. Medindo tela a tela,
**28 rolam em outra**:

| Caixa | Telas |
|---|---|
| `.ctWrap` | backup, CMV, central técnica, clientes, diagnóstico, mensalidades, empresas, permissões, rede, reinício, restrita |
| `.mvWrap` | movimentação de estoque, insumos, mercadoria |
| `.cardB` | gestão de cardápio |
| `.ftWrap` | ficha técnica |
| `.lfScroll` | lançamentos financeiros |
| `.cbWrap` | conciliação bancária |
| `.ntWrap` | notas de entrada |
| `.fxWrap` | fluxo de caixa |

Nessas o defeito estava inteiro: quem estava no fim da lista e clicava em
qualquer coisa voltava para o topo. É exatamente o que o Rafael descreveu.

Crescer a lista de classes seria repetir o erro que o próprio comentário
da guarda já alertava — *"tapar um a um seria garantir esquecer algum"*.
Então a posição passou a ser guardada para **toda caixa que role dentro do
`#content`**, identificada por uma marca estável (o identificador do
elemento, ou a etiqueta com as duas primeiras classes mais a posição entre
os iguais) e devolvida junto. Duas caixas na mesma tela guardam posições
separadas. Trocar de tela continua começando do topo.

### Contraprova

`testes/rolagem.js`, 21 verificações: as oito caixas que ficavam de fora,
as duas que já funcionavam, a troca de tela, duas caixas na mesma tela, e
a marca sobrevivendo ao redesenho. Total: 18 suítes, 927 asserções, zero
falhas.

---

## V212 — o resto do sistema, módulo por módulo

Continuação da varredura da V211, agora nas duas camadas que a primeira
não alcança: os formulários que moram dentro de janela, e as ligações
entre um módulo e outro.

### Os formulários

`ferramentas/varrer-modais.js` abre cada janela que uma tela oferece e
aperta o confirmar **de campos vazios**. O certo é recusar com um aviso; o
que não pode é estourar — formulário que quebra com campo vazio quebra
igual com campo preenchido errado, e é assim que a pessoa no balcão
descobre.

**54 janelas abertas e confirmadas. Nenhuma quebra.**

### As ligações

Isto a máquina não descobre sozinha: que um módulo mexe no outro do jeito
certo. `testes/ligacoes.js` chama as funções de verdade contra um banco
semeado e confere o saldo antes e depois, item a item.

| Cadeia | O que foi conferido |
|---|---|
| Nota de entrada | entra no estoque, atualiza o custo da última compra, grava a compra no histórico do ingrediente, amarra o movimento à NF — e nota marcada como *não recebida* não encosta no estoque |
| Transferência | sai da origem no envio, **não** entra no destino ainda, abre a conferência do que chegou, e só então entra — e não volta a mexer na origem |
| Cancelamento | respondendo **não produzido**, o insumo volta; respondendo **já produzido**, não volta; nos dois casos a venda sai do faturamento |
| Contagem | ajusta o saldo para o que foi contado, gera movimento com motivo próprio, registra a diferença apurada e carimba a unidade |

32 verificações, todas passando.

### Zero funções mortas

Três funções ficaram sem chamador e saíram: `areaRolagem`, que a
generalização da rolagem aposentou; e `limparChaveZap` com
`gravarZapChave`, restos do tempo em que era preciso colar uma chave em
cada aparelho para comandar o robô — a própria tela explica que aquilo
foi um remendo de antes do login de verdade. A leitura da chave antiga
(`zapChave`) fica, como reserva para aparelho fora da nuvem.

**Pela primeira vez o MAPA.md acusa zero funções nunca chamadas.** Eram 45
quando esta modularização começou.

### Estado

94 telas varridas, todas montam, nenhum botão aponta para função que não
existe, nenhum clique estoura. 19 suítes, 959 asserções, zero falhas. O
trilho da frente de caixa reconferido em Chromium de verdade: gaveta,
caixa cego, fechamento e relatórios com os mesmos números de antes.

---

## V215 — a V213 derrubou a loja, e o motivo é uma lição

A V213 subiu com três correções e **deixou a loja na tela branca**: não
chegava nem no login, com "Sincronizando 1510 alterações…" parado no
rodapé. Voltei ao conteúdo da V212 (publicado como V214) em poucos
minutos, e só então fui entender.

### O que aconteceu

O "manter conectado" é **código de topo**: roda enquanto o navegador
ainda está lendo o arquivo, na altura do bloco 5. Ele chama
`abrirSessao()` → `boot()` → `baseCanc()`, que é do **bloco 28**. E
`baseCanc` usa `var MOTIVOS_CANC`, declarada também no bloco 28.

Função o navegador iça: pode ser chamada antes de aparecer no arquivo.
**Variável de topo, não.** `var` reserva o nome; o valor só chega quando a
linha roda. Então `MOTIVOS_CANC` valia `undefined` e `.forEach` estourava:

```
sair: Cannot read properties of undefined (reading 'forEach')
```

O `catch` engolia. A tela ficava com o login escondido, o app visível e
**tudo vazio** — sem cabeçalho, sem menu, sem conteúdo.

### Por que a V213 acordou isso

Antes dela, `SESSAO` também morava no bloco 28. A **primeira linha** do
restauro já estourava, e o resto nem chegava a rodar. Consertar `SESSAO`
destravou um caminho que **nunca havia rodado inteiro** — e ele estava
quebrado desde sempre, esperando.

É a lição: corrigir a primeira pedra de um caminho que ninguém percorria
faz o resto do caminho ser percorrido pela primeira vez. Uma correção
certa pode expor três defeitos que estavam dormindo atrás dela.

### A correção

Não é declarar variável mais cedo — são dezenas, e amanhã aparece a
próxima. É **rodar o restauro depois do arquivo inteiro**, com
`setTimeout(…,0)`: ele espera o script terminar, e aí todo `var` de todo
bloco já tem valor.

E o `catch` deixou de ser mudo: se o restauro falhar, o sistema **volta
para o login** — uma tela em que dá para trabalhar — e escreve o motivo no
Diagnóstico. Tela vazia sem explicação não pode ser um estado possível.

### Por que nenhuma das 20 suítes pegou

Todas escondiam o login na mão e chamavam as telas direto. **Nenhuma
abria o sistema como a loja abre**: com uma sessão guardada no aparelho,
deixando o arranque acontecer sozinho. O caminho que quebrou nunca era
percorrido — nem pelos testes, nem, até a V213, pelo próprio sistema.

`testes/arranque.js` passou a ser a **primeira** suíte a rodar. Ela abre o
sistema dos dois jeitos — sem sessão e com sessão guardada — e exige que
cabeçalho, menu e conteúdo apareçam. Rodada contra a V213, ela reprova
com as palavras exatas: *"ficou vazio — é a tela branca"* e *"sair: Cannot
read properties of undefined (reading 'forEach')"*.

### As três correções da V213, agora de pé

Voltaram inteiras: `SESSAO` declarada no primeiro bloco, a marca
`_novoAqui` posta sem depender de sessão, e o remapeamento de vínculo
quando um cadastro repetido é descartado. Total: 21 suítes, 1.003
asserções, zero falhas.

---

## V216 — dois envios ao mesmo tempo, e o produto que nunca chegava

O Rafael não conseguia cadastrar um produto: "ainda não chegou à nuvem",
toda vez. O Diagnóstico da loja mostrou o que era, com hora:

```
06:35:18  ficha_itens: 3 item(ns), 3 confirmado(s)
06:35:19  envio anterior travou — liberando e tentando de novo
06:35:19  ficha_itens: 4 item(ns), 4 confirmado(s)
06:35:20  ficha_itens: 5 item(ns), 5 confirmado(s)
06:35:22  enviando...
06:35:22  ficha_itens: 5 item(ns), 5 confirmado(s)
```

**O envio estava subindo bem.** As fichas passavam uma atrás da outra. O
que apareceu no meio foi a trava de segurança soltando um envio saudável.

### A trava confundia preso com demorado

Ela liberava depois de **15 segundos**, sem perguntar nada. O aparelho
tinha **1.510 alterações** na fila — passar de 15 segundos era o normal,
não a exceção. Então ela soltava o envio que estava trabalhando, um
segundo envio começava por cima, e os dois passavam a rodar juntos.

### Por que dois envios juntos quebram o cadastro

`_ids` é o mapa que traduz o identificador local para o da nuvem — é ele
que transforma "categoria cat_xyz" no identificador que o banco entende.
E ele é **zerado no começo de cada envio**.

O segundo envio zerava o mapa que o primeiro estava usando no meio do
caminho. Dali para a frente, `fk()` não achava nada e devolvia `null`:
todo vínculo subia vazio. O produto ia para a nuvem sem categoria, ou não
ia.

Não era recusa do banco. **Era o próprio aparelho enviando duas vezes ao
mesmo tempo.**

### A correção

A trava passou a olhar o **sinal de vida**: cada lote que a nuvem
confirma carimba a hora em `NUVEM._batimento`. Enquanto houver lote
subindo, o envio está trabalhando e não é solto — a trava só volta a
olhar mais tarde. Ela solta apenas no silêncio de verdade: 45 segundos
**sem nada chegar na nuvem**, que é coisa diferente de um envio grande
demorar minutos.

O carimbo mora dentro de `enviar()`, que é a porta única por onde tudo
sobe — não há como um caminho novo esquecer de dar sinal de vida.

### Também nesta versão

A "Taxa de Entrega" foi apagada do banco a pedido do Rafael: **três**
categorias com esse nome e um produto. O produto estava na nuvem o tempo
todo — mas pendurado na categoria **Sobremesas**, não em nenhuma das
três. Por isso ele nunca aparecia onde deveria.

### Contraprova

`testes/envio-concorrente.js`, 14 verificações: o carimbo dentro do laço
dos lotes, a trava medindo silêncio e não tempo total, e a decisão rodada
de verdade nos três casos — lote de 3 segundos atrás (não solta), 44
segundos (ainda espera), um minuto (solta). Total: 22 suítes, 1.017
asserções, zero falhas.

---

## V217 — o alarme era falso, e a categoria não respeitava o canal

### 1. "Produto ainda não chegou à nuvem" — sem motivo nenhum

O Rafael mandou a foto: a janela aparecia **sem a linha "Motivo:"**. Sem
motivo quer dizer nenhum erro, nenhuma recusa do banco, nenhum registro
retido. Nada tinha dado errado.

E não tinha mesmo. **O produto chegava na nuvem, poucos segundos depois.
Quem desistia era a tela.**

`confirmarNaNuvem()` pedia a sincronização e olhava o mapa de
identificadores. Só que `sincronizar()` começa com uma guarda: se já
existe um envio em andamento, ela marca `pendente`, escreve "envio
adiado" e **retorna na hora** — sem enviar nada. Então o `await` voltava
imediatamente, o mapa ainda não tinha o registro, e a janela abria.

Medido no navegador, antes da correção:

```
confirmarNaNuvem devolveu false em 1 ms
janela: "Produto ainda não chegou à nuvem"
…e o produto chegou na nuvem no envio seguinte
```

Com fila grande isso era o estado **normal**: o aparelho dele tinha 1.510
alterações esperando, então sempre havia envio em andamento — e a janela
aparecia em toda gravação.

Agora a tela **espera** o envio em andamento terminar antes de julgar,
com teto de 30 segundos. Se passar do teto e o envio ainda estiver
trabalhando, o aviso diz a verdade — *"salvo — ainda subindo, a fila está
grande"* — em vez de *"não chegou à nuvem"*.

### 2. A categoria aparecia num canal onde não tem nada para vender

O "Disponível em" já valia para o **produto**: marcado só para delivery,
ele não aparecia na grade do balcão. Mas a faixa de **categorias** não
olhava canal nenhum — filtrava só por `ativo`.

Resultado: "Taxa de Entrega", com um único produto marcado só para
Delivery, aparecia em "Pedido na loja" com a pastilha dizendo **1**. Quem
clicava achava a categoria vazia.

Agora: categoria que **tem** produto, mas nenhum disponível naquele
canal, não aparece naquele canal. Categoria ainda **sem produto nenhum**
continua aparecendo — quem acabou de criá-la precisa vê-la para pendurar
o primeiro produto. E a pastilha conta pelo mesmo critério: o número é o
que a pessoa vai encontrar ao clicar.

### E um defeito na própria ferramenta de teste

`corpoDaFuncao()` procurava `"function nome("`, que casa **dentro** de
`"async function nome("` — e o corte começava depois do `async`. Quem
extraísse uma função assíncrona recebia o corpo com `await` dentro e sem
o `async` na frente. Mesma família do defeito que o `mapear.js` teve:
regra escrita sem contar com o `async`. Corrigido.

### Contraprova

`testes/salvar-confirma.js`, 13 verificações, com a decisão rodada nos
três estados: nuvem livre (confirma, sem janela), fila que termina
enquanto espera (confirma, sem janela) e fila que passa do tempo (avisa
que está subindo, e **não** que não chegou). Mais 6 na suíte do trilho
para a regra do canal. Total: 23 suítes, 1.049 asserções, zero falhas.

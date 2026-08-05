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

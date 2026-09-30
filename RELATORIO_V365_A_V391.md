# O que foi feito de 29/09 (17h) a 30/09 — V365 a V391

Tudo o que entrou no sistema nesse período, em português de gente, e o que
quebrou junto.

## 29/09 — cupom fiscal (V365–V370)
| Versão | O que mudou |
|---|---|
| V365 | Cadastrar a loja na conta nova da Spedy sem redigitar nada |
| V366 | Ligar a produção fiscal: a confirmação saiu da janelinha que travava |
| V367 | Cupom fiscal passou a sair na bobina (a opção nem existia na tela) |
| V368 | Duas vias: primeiro a fiscal, depois a da cozinha |
| V369 | Cupom fiscal mostra só o nome do produto |
| V370 | Adicional e forma de pagamento aparecem no cupom fiscal |

## 30/09 madrugada/manhã — correções e itens da RDS (V371–V388)
| Versão | O que mudou |
|---|---|
| V371 | "Voltar" do Kanban baixava o estoque duas vezes |
| V372 | DRE de um ano mostrava só 30 dias |
| V373 | Cancelar a venda desfazia só o estoque (agora desfaz tudo) |
| V374 | Tela de Sincronização mostrava informações erradas |
| V375 | Cupom fiscal preso só saía se alguém abrisse a tela de Cupons |
| V376 | Financeiro aceitava lançamento incompleto |
| V377 | Lançamentos automáticos (caixa, sangria, acerto…) passam a entrar no DRE — **criou o bloco "O que o sistema lança sozinho" na tela do Plano de Contas** |
| V378 | Relatório somava a rede inteira; o valor estimado parecia lançado |
| V379 | Trilha de auditoria (quem mudou o quê) |
| V380 | Nota paga sumia com um clique |
| V381 | Anular nota passou a guardar o motivo em vez de apagar |
| V382 | Permissão por ação (fechar contagem, ajustar estoque, desconciliar, anular nota, cancelar venda) |
| V383 | Pagamento com situação (pendente/pago) |
| V384 | Custo médio guarda o histórico |
| V385 | Produção automática na venda |
| V386 | Unidade de compra no insumo |
| V387 | Lote e validade |
| V388 | Cupom fiscal saía 30 s depois; agora sai na hora |

## 30/09 tarde — telas que pareciam vazias (V389–V391)
| Versão | O que mudou |
|---|---|
| V389 | Conta do banco "sumia" da tela antes do download terminar |
| V390 | Aviso "lista ainda chegando" em 27 telas de cadastro |
| V391 | **Plano de Contas espremido corrigido** (ver abaixo) |

## O que veio quebrado e já foi corrigido
1. **Plano de Contas espremido (V377 → corrigido na V391).** O bloco novo
   entrou dentro da área de altura fixa: a árvore ficou com 2 linhas e os
   botões de ver/editar/excluir ficaram escondidos. Nada foi apagado.
2. **Contas e fichas sumidas em Santa Fé.** Não era código: o Itaú, o
   Caixa, o Cofre e as 3 fichas de cheesecake estavam marcados "liberado
   para nenhuma unidade". Liberados em 30/09 — contas para todas as lojas,
   cheesecakes para Santa Fé. Nada foi apagado.

## Por que voltar para a V370 não era a saída
Os dados moram no banco, não na versão. E entre a V370 e a V390 o banco
recebeu 6 mudanças (auditoria, custo, lote e validade, pagamento, nota
anulada, pendências) que a V370 não conhece.

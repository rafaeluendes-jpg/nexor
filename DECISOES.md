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

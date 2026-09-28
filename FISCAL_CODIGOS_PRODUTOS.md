# Códigos fiscais dos produtos — para o contador conferir

Preenchidos em 28/09/2026 por ordem do Rafael ("pode preencher tudo, pesquisa
no mercado"). São os padrões de sorveteria; **quem confirma é o contador**. Tudo
se corrige na tela **Fiscal › Impostos dos Produtos** (editar e Salvar).

Premissas usadas:
- Lojas no **Simples Nacional**, PIS/COFINS CST 07.
- Gelato e bebidas das lojas são **revenda com ICMS já retido por substituição
  tributária** (compra da matriz/fornecedor) → CFOP 5405, CSOSN 500, CEST obrigatório.
- O que é feito na loja (café) → produção própria, CFOP 5101, CSOSN 102.
- O restante → revenda comum, CFOP 5102, CSOSN 102.
- "Taxa de Entrega" não é mercadoria: vai no cupom como *outras despesas*, sem código.

| Produto | NCM | CEST | CFOP | CSOSN | Observação |
|---|---|---|---|---|---|
| Cascão 1 e 2 bolas (tradicional e chocolate) | 2105.00.10 | 23.001.00 | 5405 | 500 | sorvete em casquinha |
| Copo P, Copo M | 2105.00.10 | 23.001.00 | 5405 | 500 | |
| Gelato 500 g, Gelato 1 kg | 2105.00.10 | 23.001.00 | 5405 | 500 | embalagem até 2 kg |
| Batido di Gelato 300 g / 500 g | 2105.00.10 | 23.001.00 | 5405 | 500 | tratado como sorvete — confirmar |
| Fatiatto di Gelato, Petit Jolo | 2105.00.10 | 23.001.00 | 5405 | 500 | sobremesa à base de gelato — confirmar |
| Copo Jolo Parceiro (R$ 0) | 2105.00.10 | 23.001.00 | 5405 | 500 | sai do cupom por ser R$ 0 |
| Água, Água com gás | 2201.10.00 | 03.005.00 | 5405 | 500 | embalagem plástica até 500 ml — confirmar tamanho |
| Coca, Coca Zero, Fanta Guaraná, Fanta Laranja, Sprite (lata) | 2202.10.00 | 03.010.02 | 5405 | 500 | refrigerante em lata |
| Energético | 2202.99.00 | 03.013.00 | 5405 | 500 | energético em lata |
| Café Expresso | 2202.99.00 | — | 5101 | 102 | bebida preparada na loja |
| Brownie Gourmet | 1905.90.90 | — | 5102 | 102 | confirmar se leva gelato |
| Bordas (Ninho, Pistache, Doce de Leite, Nutella) | 2106.90.90 | — | 5102 | 102 | adicional de preparação |
| Cascão avulso (tradicional e chocolate) | 1905.32.00 | — | 5102 | 102 | casquinha sem sorvete |
| Folder Surpresa (R$ 0) | 4911.10.90 | — | 5102 | 400 | impresso — sai do cupom por ser R$ 0 |

Perguntas para o contador:
1. As lojas estão todas no Simples? A matriz também?
2. O gelato que as lojas compram da matriz vem com ICMS-ST retido (CSOSN 500)?
3. Na **NF-e da matriz** (venda de gelato fabricado para as lojas), qual CFOP e
   CSOSN usar — 5401/201 com cálculo de ST, ou outro? A tela deixa escolher por item.
4. Batido, Fatiatto, Petit Jolo e Brownie: sorvete (2105) ou outra classificação?

Teste real no ambiente de homologação da SEFAZ-SP (28/09/2026):
- Cupom (NFC-e) de Santa Fé: autorizado.
- Nota (NF-e) com frete, desconto, transportadora e boleto: autorizada
  (feita pela empresa de Santa Fé, só para validar o formato).
- NF-e da matriz: recusada por falta da **inscrição estadual da matriz** no
  emissor — cadastrar em Fiscal › Configuração Fiscal, com a matriz escolhida no alto.

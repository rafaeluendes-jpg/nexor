-- Definições fiscais dos produtos (planilha "Definições Fiscais" de
-- 28/09/2026, CNPJ 50.058.498/0001-11 — Santa Fé do Sul), por ordem do
-- Rafael em 01/10/2026. Só os campos fiscais; preço, nome e o resto do
-- cadastro não mudam.
with def(nome, ncm, cest, cfop, csosn) as (values
  -- bebidas
  ('Agua',                              '22011000','0301100','5102','102'),
  ('Agua Com Gas',                      '22011000','0301100','5102','102'),
  ('Agua Sprite Saborizada',            '22021000','0301100','5405','500'),
  ('Coca Cola Lata',                    '22021000','0301100','5405','500'),
  ('Energetico',                        '22021000','0301100','5405','500'),
  ('Fanta Uva Lata',                    '22021000','0301100','5405','500'),
  ('Coca Zero Lata',                    '22021000','0301100','5405','500'),
  ('Fanta Guarana Lata',                '22021000','0301100','5405','500'),
  ('Fanta Lata',                        '22021000','0301100','5405','500'),
  ('Fanta Laranja Lata',                '22021000','0301100','5405','500'),
  ('Kuat Lata',                         '22021000','0301100','5405','500'),
  ('Schweppes Lata',                    '22021000','0301100','5405','500'),
  ('Sprite Lata',                       '22021000','0301100','5405','500'),
  ('Del Vale Uva',                      '22021000','0301100','5405','500'),
  ('Coca Litro',                        '22021000','0301100','5405','500'),
  ('Cafe Expresso',                     '22021000','0301100','5405','500'),
  -- gelato
  ('Copo M',                            '21050090',null,'5102','102'),
  ('Copo P',                            '21050090',null,'5102','102'),
  ('Copo Jolo Parceiro',                '21050090',null,'5102','102'),
  ('Cascão 1 Bola',                     '21050090',null,'5102','102'),
  ('Cascão Chocolate 1 Bola',           '21050090',null,'5102','102'),
  ('Cascão 2 Bolas',                    '21050090',null,'5102','102'),
  ('Cascão Chocolate 2 Bolas',          '21050090',null,'5102','102'),
  ('Gelato 1 Kg',                       '21050090',null,'5102','102'),
  ('Gelato 500 Gramas',                 '21050090',null,'5102','102'),
  ('Cascão Tradicional Avulso',         '21050090',null,'5102','102'),
  ('Cascão Tradicional Avulso (cópia)', '21050090',null,'5102','102'),
  ('Cascão Chocolate Avulso',           '21050090',null,'5102','102'),
  ('Cascão Chocolate Avulso (cópia)',   '21050090',null,'5102','102'),
  ('Taxa de Entrega',                   '21050090',null,'5102','102'),
  ('Fatiatto Di Gelato',                '22011000',null,'5102','102'),
  -- sobremesas, bordas e brindes
  ('Folder Surpresa',                   '18063110',null,'5102','102'),
  ('Fondue',                            '18063110',null,'5102','102'),
  ('Brownie Gourmet',                   '18063110',null,'5102','102'),
  ('Batido Di Gelato 300 Gramas',       '18063110',null,'5102','102'),
  ('Batido Di Gelato 500 Gramas',       '18063110',null,'5102','102'),
  ('Petit Jolo',                        '18063110',null,'5102','102'),
  ('Afogatto Jolo',                     '18063110',null,'5102','102'),
  ('Borda Nutella',                     '18063110',null,'5102','102'),
  ('Borda Doce Leite',                  '18063110',null,'5102','102'),
  ('Borda Creme Ninho',                 '18063110',null,'5102','102'),
  ('Borda Creme Pistache',              '18063110',null,'5102','102')
)
update public.produtos p
   set ncm = d.ncm, cest = d.cest, cfop = d.cfop, csosn = d.csosn,
       cst = case d.csosn when '500' then '60' else '00' end,
       origem_fiscal = coalesce(nullif(p.origem_fiscal,''),'0'),
       unidade_tributavel = coalesce(nullif(p.unidade_tributavel,''),'UN')
  from def d
 where p.nome = d.nome;

-- PIS e COFINS da unidade emissora: CST 99, como na planilha
update public.fiscal_unidades
   set pis_cst = '99', cofins_cst = '99', atualizado_em = now()
 where cnpj = '50058498000111';

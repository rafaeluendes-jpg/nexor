-- ============================================================
-- O CUSTO MEDIO PERDIA A MEMORIA (RDS 11 e 15)
--
-- ---------- 1. o ultimo custo medio com saldo ----------
-- Quando o saldo de um item chega a zero, o Joia ZERA o custo medio —
-- e esta certo: custo medio e o preco do que esta la dentro, e sem nada
-- dentro ele e zero. A regra 11.2 da RDS confirma isso e acrescenta uma
-- segunda metade que faltava: "preservar o ultimo custo medio
-- conhecido".
--
-- Sem ela, um item que zerou perde a unica referencia de quanto ele
-- custava. O sistema cai em `custoUltima` (o preco da ultima COMPRA),
-- que e outra coisa — e numa rede com compras de precos diferentes por
-- unidade, e a coisa errada.
--
-- ---------- 2. de onde veio um custo ajustado a mao ----------
-- O fechamento da contagem pode mudar o custo do item. Ele gravava
-- `modoCusto='manual'`, e `normModo()` convertia isso de volta para
-- 'media' na leitura seguinte: a contagem achava que tinha fixado o
-- custo e o sistema descartava a intencao, em silencio.
--
-- O valor em si ficava (e continua ficando). O que nao existia era o
-- RASTRO: quem mudou, quando, de quanto para quanto. Estas quatro
-- colunas sao esse rastro — e sao o que a RDS 15 pede quando diz que
-- nenhum movimento altera custo sem regra explicita.
--
-- Todas opcionais, aditivas, sem efeito sobre nada que ja exista.
-- ============================================================
alter table public.estoque_unidade
  add column if not exists ultimo_custo_medio_com_saldo numeric;

alter table public.insumos
  add column if not exists custo_ajustado_em     timestamptz,
  add column if not exists custo_ajustado_por    text,
  add column if not exists custo_ajustado_de     numeric,
  add column if not exists custo_ajustado_origem text;

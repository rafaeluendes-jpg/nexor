-- =====================================================================
-- JOIA — O PAINEL DE FATURAMENTO QUE A CENTRAL JOLÔ MOSTRA
-- (Rafael, 25/09/2026)
--
-- "Joga esse aplicativo como um ícone lá dentro da central... o mesmo
-- login, a mesma senha de cada loja... tem os gráficos, tem que colocar
-- igual ao aplicativo."
--
-- A Central é outro sistema, com outro banco. Para ela mostrar os mesmos
-- números do aplicativo de faturamento sem receber a base da loja, quem
-- calcula é AQUI: esta função devolve, numa só leitura, tudo o que a tela
-- do aplicativo mostra — destaque com a variação, os quatro números,
-- mais vendidos com CMV, evolução (7 dias e 12 meses), detalhamento e
-- formas de pagamento.
--
-- O cálculo é o MESMO do aplicativo (`app_dados`) e do resto da API:
--   - pedido cancelado não conta;
--   - o dia é o dia da loja (America/Sao_Paulo);
--   - entrega é `tipo = 'entrega'`; o resto é frente de caixa;
--   - o custo do produto é o da ficha técnica, por unidade de venda, e
--     produto sem ficha não tem custo (aparece "—", nunca R$ 0,00).
--
-- Nada de dado pessoal sai daqui: nem nome, nem telefone, nem comanda.
-- Só a CONTAGEM de clientes atendidos.
-- =====================================================================
create or replace function public.api_central_painel(
  p_loja uuid, p_suc text, p_de date, p_ate date,
  p_de_ant date default null, p_ate_ant date default null)
returns json language sql stable security definer set search_path to 'public' as $$
/* o gráfico não depende do período escolhido: o aplicativo mostra sempre
   os últimos 7 dias (ou 12 meses). Por isso a janela lida aqui vai até o
   primeiro dia do 12º mês atrás — antes os meses antigos vinham zerados. */
with todos as (
  select p.id, p.tipo, p.total, p.taxa, p.cliente_id,
         (p.data_venda at time zone 'America/Sao_Paulo')::date as dia
    from pedidos p
    left join sucursais s on s.id = p.sucursal_id
   where p.loja_id = p_loja
     and p.fase <> 'cancelado'
     and (p_suc is null or s.ref_local = p_suc)
     and (p.data_venda at time zone 'America/Sao_Paulo')::date
         between least(p_de, coalesce(p_de_ant, p_de),
                       (date_trunc('month', p_ate::timestamp) - interval '11 months')::date)
             and p_ate
),
periodo as (select * from todos where dia between p_de and p_ate),
anterior as (
  select * from todos
   where p_de_ant is not null and dia between p_de_ant and coalesce(p_ate_ant, p_de_ant)
),
/* o custo por unidade de venda de cada produto — a mesma conta do
   relatório de CMV e do aplicativo */
custo as (
  select pr.id, lower(pr.nome) as nome,
         case when coalesce(f.unidades_venda,0) > 0 then s2.tot / f.unidades_venda
              when coalesce(f.rendimento,0)     > 0 then s2.tot / f.rendimento
              else 0 end as custo
    from produtos pr
    join fichas_tecnicas f on f.id = pr.ficha_id
    cross join lateral (
      select coalesce(sum(
        (case
           when lower(coalesce(fi.unidade,'')) in ('g','kg','mg')
            and lower(coalesce(ins.unidade,'')) in ('g','kg','mg')
             then fi.quantidade
                  * (case lower(fi.unidade) when 'g' then 1 when 'kg' then 1000 when 'mg' then 0.001 else 1 end)
                  / (case lower(ins.unidade) when 'g' then 1 when 'kg' then 1000 when 'mg' then 0.001 else 1 end)
           when lower(coalesce(fi.unidade,'')) in ('ml','l')
            and lower(coalesce(ins.unidade,'')) in ('ml','l')
             then fi.quantidade
                  * (case lower(fi.unidade) when 'ml' then 1 when 'l' then 1000 else 1 end)
                  / (case lower(ins.unidade) when 'ml' then 1 when 'l' then 1000 else 1 end)
           else fi.quantidade
         end)
        * (case when lower(coalesce(ins.modo_custo,'media')) = 'ultima'
                then (case when coalesce(ins.custo_ultima,0) > 0 then ins.custo_ultima else ins.custo end)
                else (case when coalesce(ins.custo,0) > 0 then ins.custo else ins.custo_ultima end) end)
      ),0) as tot
      from ficha_itens fi join insumos ins on ins.id = fi.insumo_id
      where fi.ficha_id = f.id) s2
   where pr.loja_id = p_loja
),
itens as (
  select coalesce(i.nome,'—') as nome, i.quantidade as qtd, i.total as valor,
         coalesce(c1.custo, c2.custo) as custo
    from pedido_itens i
    join periodo pe on pe.id = i.pedido_id
    left join custo c1 on c1.id = i.produto_id
    left join custo c2 on c2.nome = lower(coalesce(i.nome,''))
),
produtos as (
  select nome, sum(qtd)::numeric as qtd, round(sum(coalesce(valor,0)),2) as valor,
         round(sum(case when custo is not null then custo * qtd else 0 end),2) as cmv,
         bool_or(custo is not null) as tem_custo
    from itens group by nome order by 2 desc limit 5
),
formas as (
  select coalesce(f.nome,'não informado') as nome, round(sum(g.valor),2) as valor
    from pedido_pagamentos g
    join periodo pe on pe.id = g.pedido_id
    left join formas_pagamento f on f.id = g.forma_id
   group by 1 order by 2 desc
),
dias as (
  select d::date as dia,
         coalesce((select round(sum(total),2) from todos x where x.dia = d::date),0) as total
    from generate_series(p_ate - 6, p_ate, interval '1 day') d
),
meses as (
  select to_char(m,'YYYY-MM') as mes,
         coalesce((select round(sum(total),2) from todos x
                    where date_trunc('month', x.dia) = m),0) as total
    from generate_series(date_trunc('month', p_ate::timestamp) - interval '11 months',
                         date_trunc('month', p_ate::timestamp), interval '1 month') m
)
select json_build_object(
  'periodo', json_build_object('de', p_de, 'ate', p_ate),
  'total',   (select round(coalesce(sum(total),0),2) from periodo),
  'pedidos', (select count(*) from periodo),
  'ticket',  (select round(coalesce(avg(total),0),2) from periodo),
  'anterior', json_build_object(
     'total',   (select round(coalesce(sum(total),0),2) from anterior),
     'pedidos', (select count(*) from anterior)),
  'entregas', json_build_object(
     'qtd',   (select count(*) from periodo where tipo = 'entrega'),
     'valor', (select round(coalesce(sum(total),0),2) from periodo where tipo = 'entrega')),
  'balcao', json_build_object(
     'qtd',   (select count(*) from periodo where tipo is distinct from 'entrega'),
     'valor', (select round(coalesce(sum(total),0),2) from periodo where tipo is distinct from 'entrega')),
  'taxas',    (select round(coalesce(sum(taxa),0),2) from periodo),
  'clientes', (select count(distinct cliente_id) from periodo where cliente_id is not null),
  'produtos', (select coalesce(json_agg(x),'[]'::json) from produtos x),
  'formas',   (select coalesce(json_agg(x),'[]'::json) from formas x),
  'dias',     (select coalesce(json_agg(x order by x.dia),'[]'::json) from dias x),
  'meses',    (select coalesce(json_agg(x order by x.mes),'[]'::json) from meses x));
$$;

revoke all on function public.api_central_painel(uuid, text, date, date, date, date)
  from public, anon, authenticated;
grant execute on function public.api_central_painel(uuid, text, date, date, date, date)
  to service_role;

comment on function public.api_central_painel(uuid, text, date, date, date, date) is
  'Painel de faturamento da Central Jolô: os mesmos números do aplicativo, calculados aqui. Sem dado pessoal.';

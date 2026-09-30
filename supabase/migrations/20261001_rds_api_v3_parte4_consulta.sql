-- =====================================================================
-- JOIA — API ANALÍTICA RDS v3 · PARTE 4: AGREGAÇÕES E A PORTA ÚNICA
--
-- rds_consulta(loja, unidade_da_chave, rota, parametros) devolve a
-- resposta INTEIRA da API — envelope, avisos, página e dados. A função de
-- borda só confere a chave, conta o uso e repassa. Por isso toda
-- evidência tirada aqui é exatamente o que a RDS recebe.
-- =====================================================================

-- ---------- faturamento consolidado (por dia ou por mês) ----------
create or replace function public.rds_a_faturamento(p_vendas jsonb, p_pag jsonb, p_agrupar text)
returns jsonb language sql stable security definer set search_path = public as $$
  with v as (
    select r, r->>'sucursal_id' suc,
           case when p_agrupar = 'mes' then to_char((r->>'dia_comercial')::date, 'YYYY-MM') else r->>'dia_comercial' end per,
           (r->>'cancelada')::boolean canc
      from jsonb_array_elements(p_vendas) r
  ), tx as (
    select g->>'sucursal_id' suc,
           case when p_agrupar = 'mes' then to_char((g->>'dia_comercial')::date, 'YYYY-MM') else g->>'dia_comercial' end per,
           sum((g->>'taxa_calculada')::numeric) taxa
      from jsonb_array_elements(p_pag) g
     where not (g->>'venda_cancelada')::boolean and not (g->>'estornado')::boolean
     group by 1, 2
  ), base as (
    select suc, per,
      sum((r->>'valor_bruto')::numeric) filter (where not canc) bruto,
      sum((r->>'desconto')::numeric) filter (where not canc) descontos,
      sum((r->>'acrescimo')::numeric) filter (where not canc) acrescimos,
      sum((r->>'taxa_entrega')::numeric) filter (where not canc) entrega,
      sum((r->>'valor_liquido')::numeric) filter (where canc) cancelado_valor,
      count(*) filter (where canc) cancelado_qtd,
      sum((r->>'valor_liquido')::numeric) filter (where not canc) liquido,
      count(*) filter (where not canc) pedidos,
      sum((r->>'itens_quantidade')::numeric) filter (where not canc) itens,
      count(distinct coalesce(r->>'cliente_ref', rds_norm(r->>'cliente')))
        filter (where not canc and coalesce(r->>'cliente_ref', '') <> ''
                or (not canc and rds_norm(r->>'cliente') not in ('', 'consumidor'))) clientes,
      sum((r->>'cpv_teorico')::numeric) filter (where not canc) cpv
      from v group by 1, 2
  ), dim as (
    select suc, per, 'canal' d, coalesce(r->>'canal','—') k, sum((r->>'valor_liquido')::numeric) val from v where not canc group by 1,2,3,4
    union all
    select suc, per, 'hora', lpad(split_part(r->>'hora', ':', 1), 2, '0') || 'h', sum((r->>'valor_liquido')::numeric) from v where not canc group by 1,2,3,4
    union all
    select suc, per, 'turno', coalesce(r->>'turno', 'sem turno'), sum((r->>'valor_liquido')::numeric) from v where not canc group by 1,2,3,4
    union all
    select suc, per, 'operador', coalesce(r->>'operador', 'sem caixa'), sum((r->>'valor_liquido')::numeric) from v where not canc group by 1,2,3,4
  ), dj as (
    select suc, per, d, jsonb_object_agg(k, round(val, 2)) o from dim group by 1, 2, 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'sucursal_id', b.suc, 'periodo', b.per,
      'faturamento_bruto', round(coalesce(b.bruto,0),2), 'descontos', round(coalesce(b.descontos,0),2),
      'acrescimos', round(coalesce(b.acrescimos,0),2), 'taxa_entrega', round(coalesce(b.entrega,0),2),
      'cancelamentos_valor', round(coalesce(b.cancelado_valor,0),2), 'cancelamentos_quantidade', coalesce(b.cancelado_qtd,0),
      'devolucoes', 'não_disponível',
      'faturamento_liquido', round(coalesce(b.liquido,0),2),
      'pedidos', coalesce(b.pedidos,0), 'itens', coalesce(b.itens,0),
      'clientes_identificados', coalesce(b.clientes,0), 'pessoas_atendidas', 'não_disponível',
      'ticket_medio', case when b.pedidos > 0 then round(b.liquido / b.pedidos, 2) end,
      'venda_media_por_item', case when b.itens > 0 then round(b.bruto / b.itens, 2) end,
      'por_canal', (select o from dj where dj.suc = b.suc and dj.per = b.per and d = 'canal'),
      'por_hora', (select o from dj where dj.suc = b.suc and dj.per = b.per and d = 'hora'),
      'por_turno', (select o from dj where dj.suc = b.suc and dj.per = b.per and d = 'turno'),
      'por_operador', (select o from dj where dj.suc = b.suc and dj.per = b.per and d = 'operador'),
      'taxa_cartao_calculada', round(coalesce(tx.taxa,0),2),
      'cpv_teorico', round(coalesce(b.cpv,0),2),
      'impostos_calculados', 'não_disponível', 'royalties', 'não_disponível', 'fundo_marketing', 'não_disponível'
    ) order by b.suc, b.per), '[]'::jsonb)
    from base b left join tx on tx.suc = b.suc and tx.per = b.per;
$$;

-- ---------- desempenho dos produtos ----------
create or replace function public.rds_a_produtos(p_itens jsonb, p_nivel text, p_rede boolean, p_dias int)
returns jsonb language sql stable security definer set search_path = public as $$
  with i as (
    select case when p_rede then null else r->>'sucursal_id' end suc,
           case p_nivel when 'grupo' then coalesce(r->>'grupo','sem grupo') when 'categoria' then coalesce(r->>'grupo','sem grupo')
                else coalesce(r->>'produto_ref', 'nome:' || (r->>'produto')) end chave,
           case p_nivel when 'grupo' then coalesce(r->>'grupo','sem grupo') when 'categoria' then coalesce(r->>'grupo','sem grupo')
                else r->>'produto' end nome,
           r->>'grupo' grupo, r->>'venda_ref' venda,
           (r->>'quantidade')::numeric qtd, (r->>'valor_liquido')::numeric valor, (r->>'cpv_teorico_total')::numeric cpv
      from jsonb_array_elements(p_itens) r where not (r->>'venda_cancelada')::boolean
  ), a as (
    select suc, chave, max(nome) nome, max(grupo) grupo, sum(qtd) qtd, sum(valor) valor, sum(coalesce(cpv,0)) cpv,
           count(distinct venda) pedidos
      from i group by 1, 2
  ), t as (select suc, sum(valor) tot, count(*) n from a group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
      'sucursal_id', a.suc, 'escopo', case when p_rede then 'rede consolidada' else 'unidade' end,
      'nivel', coalesce(p_nivel,'produto'),
      'produto_ref', case when coalesce(p_nivel,'produto') = 'produto' and a.chave not like 'nome:%' then a.chave end,
      'produto', case when coalesce(p_nivel,'produto') = 'produto' then a.nome end,
      'grupo', case when coalesce(p_nivel,'produto') = 'produto' then a.grupo else a.nome end,
      'quantidade', round(a.qtd, 4), 'media_diaria', round(a.qtd / greatest(p_dias,1), 2),
      'faturamento', round(a.valor, 2),
      'participacao_faturamento_pct', case when t.tot > 0 then round(a.valor / t.tot * 100, 2) end,
      'pedidos_com_o_produto', a.pedidos,
      'preco_medio', case when a.qtd > 0 then round(a.valor / a.qtd, 2) end,
      'desconto_medio', 'não_disponível',
      'cpv_teorico', round(a.cpv, 2),
      'margem_contribuicao', round(a.valor - a.cpv, 2),
      'margem_pct', case when a.valor > 0 then round((a.valor - a.cpv) / a.valor * 100, 2) end
    ) order by a.suc nulls first, a.valor desc), '[]'::jsonb)
    from a join t on t.suc is not distinct from a.suc;
$$;

-- ---------- curva ABC ----------
-- A = até 80% acumulado do critério; B = até 95%; C = o resto.
create or replace function public.rds_a_abc(p_atual jsonb, p_anterior jsonb, p_criterio text)
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (select case p_criterio when 'quantidade' then 'quantidade' when 'margem' then 'margem_contribuicao'
                                     when 'pedidos' then 'pedidos_com_o_produto' else 'faturamento' end k),
  a as (
    select r, r->>'sucursal_id' suc, coalesce(r->>'produto_ref', r->>'produto', r->>'grupo') chave,
           greatest(coalesce((r->>(select k from c))::numeric, 0), 0) v
      from jsonb_array_elements(p_atual) r
  ), o as (
    select a.*, row_number() over (partition by suc order by v desc, chave) pos,
           sum(v) over (partition by suc) tot,
           sum(v) over (partition by suc order by v desc, chave rows unbounded preceding) acum
      from a
  ), ant as (
    select r->>'sucursal_id' suc, coalesce(r->>'produto_ref', r->>'produto', r->>'grupo') chave,
           greatest(coalesce((r->>(select k from c))::numeric, 0), 0) v,
           row_number() over (partition by r->>'sucursal_id' order by greatest(coalesce((r->>(select k from c))::numeric, 0), 0) desc) pos
      from jsonb_array_elements(coalesce(p_anterior,'[]'::jsonb)) r
  )
  select coalesce(jsonb_agg(o.r || jsonb_build_object(
      'criterio', coalesce(p_criterio,'faturamento'), 'posicao', o.pos,
      'classe', case when o.tot = 0 then 'C' when (o.acum - o.v) / o.tot < 0.80 then 'A'
                     when (o.acum - o.v) / o.tot < 0.95 then 'B' else 'C' end,
      'participacao_pct', case when o.tot > 0 then round(o.v / o.tot * 100, 2) end,
      'participacao_acumulada_pct', case when o.tot > 0 then round(o.acum / o.tot * 100, 2) end,
      'periodo_anterior', jsonb_build_object('posicao', ant.pos, 'valor', ant.v,
          'variacao_pct', case when coalesce(ant.v,0) > 0 then round((o.v / ant.v - 1) * 100, 2) end))
    order by o.suc nulls first, o.pos), '[]'::jsonb)
    from o left join ant on ant.suc is not distinct from o.suc and ant.chave = o.chave;
$$;

-- ---------- histórico de custos ----------
create or replace function public.rds_a_custos(p_loja uuid, p_sucs text[], p_de date, p_ate date, p_compras jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (
    select r->>'sucursal_id' suc, r->>'insumo_ref' item, r->>'item' nome, r->>'fornecedor' forn,
           (r->>'data_emissao')::date dia, (r->>'custo_unitario_estoque')::numeric preco, r->>'unidade_estoque' un
      from jsonb_array_elements(p_compras) r where r->>'insumo_ref' is not null
  ), a as (
    select suc, item, max(nome) nome, max(un) un,
           (array_agg(preco order by dia))[1] primeiro, (array_agg(preco order by dia desc))[1] ultimo,
           min(preco) menor, max(preco) maior, count(*) compras,
           jsonb_agg(jsonb_build_object('data', dia, 'preco', preco, 'fornecedor', forn) order by dia) historico
      from c group by 1, 2
  ), cp as (
    select sucursal_id suc, item_ref item, sum(valor) filter (where tipo = 'cpv_teorico') cpv
      from rds_cpv_linhas(p_loja, p_sucs, p_de, p_ate) group by 1, 2
  ), e as (select sucursal_id suc, item_ref item, custo_medio from estoque_unidade where loja_id = p_loja and sucursal_id = any(p_sucs))
  select coalesce(jsonb_agg(jsonb_build_object(
      'sucursal_id', a.suc, 'insumo_ref', a.item, 'item_ref', a.item, 'item', a.nome, 'unidade', a.un,
      'compras_no_periodo', a.compras, 'preco_primeira_compra', a.primeiro, 'preco_ultima_compra', a.ultimo,
      'menor_preco', a.menor, 'maior_preco', a.maior,
      'variacao_pct', case when a.primeiro > 0 then round((a.ultimo / a.primeiro - 1) * 100, 2) end,
      'custo_medio_atual', e.custo_medio,
      'cpv_teorico_do_item_no_periodo', round(coalesce(cp.cpv,0), 2),
      'impacto_estimado_no_cpv', case when a.primeiro > 0 then round(coalesce(cp.cpv,0) * (a.ultimo / a.primeiro - 1), 2) end,
      'impacto_formula', 'cpv do item no período × variação entre a primeira e a última compra (estimativa)',
      'historico', a.historico
    ) order by abs(coalesce(cp.cpv,0) * (a.ultimo / nullif(a.primeiro,0) - 1)) desc nulls last), '[]'::jsonb)
    from a left join cp on cp.suc = a.suc and cp.item = a.item left join e on e.suc = a.suc and e.item = a.item;
$$;

-- ---------- CRM por unidade ----------
create or replace function public.rds_a_crm(p_loja uuid, p_sucs text[], p_de date, p_ate date, p_cli jsonb, p_vendas jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (select r->>'sucursal_id' suc, r from jsonb_array_elements(p_cli) r),
  v as (select r->>'sucursal_id' suc, count(*) filter (where not (r->>'cancelada')::boolean) pedidos,
               count(*) filter (where not (r->>'cancelada')::boolean and (coalesce(r->>'cliente_ref','') <> ''
                                 or rds_norm(r->>'cliente') not in ('','consumidor'))) identificados
          from jsonb_array_elements(p_vendas) r group by 1),
  ant as (
    select s.ref_local suc, count(distinct coalesce(cl.ref_local, lower(p.cliente_nome))) n
      from pedidos p join sucursais s on s.id = p.sucursal_id left join clientes cl on cl.id = p.cliente_id
     where p.loja_id = p_loja and s.ref_local = any(p_sucs) and p.fase <> 'cancelado'
       and (p.cliente_id is not null or rds_norm(p.cliente_nome) not in ('','consumidor'))
       and (p.data_venda at time zone 'America/Sao_Paulo')::date between p_de - (p_ate - p_de + 1) and p_de - 1
     group by 1
  ), ret as (
    select s.ref_local suc, count(distinct coalesce(cl.ref_local, lower(p.cliente_nome))) n
      from pedidos p join sucursais s on s.id = p.sucursal_id left join clientes cl on cl.id = p.cliente_id
     where p.loja_id = p_loja and s.ref_local = any(p_sucs) and p.fase <> 'cancelado'
       and (p.cliente_id is not null or rds_norm(p.cliente_nome) not in ('','consumidor'))
       and (p.data_venda at time zone 'America/Sao_Paulo')::date between p_de - (p_ate - p_de + 1) and p_de - 1
       and exists (select 1 from pedidos p2 where p2.loja_id = p.loja_id and p2.sucursal_id = p.sucursal_id and p2.fase <> 'cancelado'
                     and coalesce(p2.cliente_id::text, lower(p2.cliente_nome)) = coalesce(p.cliente_id::text, lower(p.cliente_nome))
                     and (p2.data_venda at time zone 'America/Sao_Paulo')::date between p_de and p_ate)
     group by 1
  ), u as (select unnest(p_sucs) suc)
  select coalesce(jsonb_agg(jsonb_build_object(
      'sucursal_id', u.suc,
      'clientes_unicos', (select count(*) from c where c.suc = u.suc),
      'novos', (select count(*) from c where c.suc = u.suc and c.r->>'segmento' = 'novo'),
      'recorrentes', (select count(*) from c where c.suc = u.suc and c.r->>'segmento' = 'recorrente'),
      'reativados', (select count(*) from c where c.suc = u.suc and c.r->>'segmento' = 'reativado'),
      'ticket_medio_identificados', (select round(sum((c.r->>'valor_no_periodo')::numeric) / nullif(sum((c.r->>'compras_no_periodo')::numeric),0), 2) from c where c.suc = u.suc),
      'valor_medio_por_cliente', (select round(avg((c.r->>'valor_no_periodo')::numeric), 2) from c where c.suc = u.suc),
      'frequencia_media_no_periodo', (select round(avg((c.r->>'compras_no_periodo')::numeric), 2) from c where c.suc = u.suc),
      'recencia_media_dias', (select round(avg((c.r->>'recencia_dias')::numeric), 1) from c where c.suc = u.suc),
      'vendas_com_cliente_identificado_pct', case when coalesce(v.pedidos,0) > 0 then round(v.identificados::numeric / v.pedidos * 100, 2) end,
      'clientes_periodo_anterior', coalesce(ant.n, 0), 'voltaram_neste_periodo', coalesce(ret.n, 0),
      'retencao_pct', case when coalesce(ant.n,0) > 0 then round(coalesce(ret.n,0)::numeric / ant.n * 100, 2) end,
      'campanhas', 'não_disponível',
      'cupons_de_desconto', (select coalesce(sum((c.r->>'compras_com_desconto_de_cupom')::numeric),0) from c where c.suc = u.suc),
      'observacao', 'só entram vendas com cliente identificado (cadastro ou nome diferente de Consumidor)'
    ) order by u.suc), '[]'::jsonb)
    from u left join v on v.suc = u.suc left join ant on ant.suc = u.suc left join ret on ret.suc = u.suc;
$$;

-- ---------- pendências: só sinalizar, nunca corrigir ----------
create or replace function public.rds_a_pendencias(p_loja uuid, p_sucs text[], p_tipo text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_info jsonb := '{
    "lancamentos-sem-categoria": {"impacto":"DRE: o valor cai em sem_plano_de_contas e não na linha certa","onde":"Financeiro › Contas a pagar/receber › abrir o lançamento › Categoria"},
    "insumos-sem-custo": {"impacto":"CPV subavaliado: o consumo do insumo sai a custo zero","onde":"Estoque › Insumos › Custo"},
    "produtos-sem-vinculo": {"impacto":"venda que não baixa estoque nem gera CPV","onde":"Cardápio › Produtos › Ficha técnica ou insumo"},
    "motivos-sem-classe": {"impacto":"perda × consumo depende de classificação derivada por regra, não do cadastro","onde":"Estoque › Motivos de movimentação"},
    "estoque-negativo": {"impacto":"CPV e valor de estoque distorcidos; a causa está no último movimento","onde":"Estoque › Movimentação (ver ultimo_movimento)"},
    "fiscal-divergente": {"impacto":"venda sem documento fiscal válido, ou documento recusado","onde":"PDV › Cupons Fiscais"},
    "caixas-com-pendencia": {"impacto":"fechamento e fluxo de caixa não conferem","onde":"Financeiro › Fechamentos de caixa"},
    "titulos-movimentados-sem-conta": {"impacto":"saldo da conta financeira e extrato não fecham: dinheiro movimentado sem dizer em qual conta","onde":"Financeiro › Contas a pagar/receber › abrir o lançamento › Conta"}}'::jsonb;
  v_tipos text[]; t text; v_dados jsonb; v_res jsonb := '{}'::jsonb; v_all jsonb := '[]'::jsonb;
begin
  if p_tipo is not null and not v_info ? p_tipo then
    return jsonb_build_object('_status', 404, 'erro', 'Pendência "' || p_tipo || '" não existe.',
                              'pendencias', (select jsonb_agg(k) from jsonb_object_keys(v_info) k));
  end if;
  v_tipos := case when p_tipo is null then array(select jsonb_object_keys(v_info)) else array[p_tipo] end;
  foreach t in array v_tipos loop
    if t = 'titulos-movimentados-sem-conta' then
      v_dados := (select coalesce(jsonb_agg(r), '[]'::jsonb) from jsonb_array_elements(
                    rds_x_titulos(p_loja, p_sucs, '2000-01-01', '2100-12-31', 'pagamento')) r
                   where r->'inconsistencias' ? 'movimentado sem conta financeira');
    else
      v_dados := (select coalesce(jsonb_agg(r), '[]'::jsonb)
                    from jsonb_array_elements(coalesce(to_jsonb(api_pendencias(p_loja, null, t)), '[]'::jsonb)) r
                   where r->>'unidade' is null or r->>'unidade' = any(p_sucs));
    end if;
    v_dados := (select coalesce(jsonb_agg(r || jsonb_build_object(
        'pendencia', t,
        'sucursal_id', coalesce(r->>'sucursal_id', r->>'unidade'),
        'registro_ref', coalesce(r->>'titulo_ref', r->>'identificador', r->>'pedido_ref', r->>'caixa_ref', r->>'item_ref', r->>'id'),
        'valor_ou_quantidade', coalesce(r->'valor', r->'valor_negativo', r->'saldo', r->'diferenca', r->'total', r->'usos'),
        'data_referencia', coalesce(r->'data_pagamento_ou_recebimento', r->'emissao', r->'data_venda', r->'aberto_em',
                                    r->'atualizado_em', r->'ultimo_uso', r->'alterado_em'),
        'situacao_pendencia', 'aberta — some da lista quando corrigida no Joia',
        'possivel_impacto', v_info->t->>'impacto', 'onde_corrigir_no_joia', v_info->t->>'onde',
        'correcao_automatica', false)), '[]'::jsonb)
      from jsonb_array_elements(v_dados) r);
    v_res := v_res || jsonb_build_object(t, jsonb_build_object(
        'registros', jsonb_array_length(v_dados),
        'por_unidade', (select coalesce(jsonb_object_agg(coalesce(k,'rede'), n), '{}'::jsonb) from (
                          select r->>'sucursal_id' k, count(*) n from jsonb_array_elements(v_dados) r group by 1) z),
        'possivel_impacto', v_info->t->>'impacto', 'onde_corrigir_no_joia', v_info->t->>'onde'));
    v_all := v_all || v_dados;
  end loop;
  if p_tipo is null then
    return jsonb_build_object('pendencias', v_res,
      'regra', 'A API só sinaliza. Nada é corrigido, classificado ou excluído automaticamente: a correção é de usuário autorizado, dentro do Joia, e fica em /historico.');
  end if;
  return jsonb_build_object('pendencia', p_tipo, 'resumo', v_res->p_tipo, 'dados', v_all);
end;
$$;

-- ---------- comparativo entre unidades: indicadores, não ranking ----------
create or replace function public.rds_a_comparativo(p_loja uuid, p_sucs text[], p_de date, p_ate date, p_q jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  u text; v_res jsonb := '[]'::jsonb; v_dias int := p_ate - p_de + 1;
  v_v jsonb; v_vant jsonb; v_it jsonb; v_prod jsonb; v_abc jsonb; v_cpv jsonb; v_dre jsonb; v_crm jsonb;
  v_liq numeric; v_liq_ant numeric; v_ped int; v_canc_q int; v_canc_v numeric; v_func numeric;
  v_est jsonb; v_cx jsonb; v_prod_q numeric; v_prod_nome text := nullif(p_q->>'produto','');
begin
  foreach u in array p_sucs loop
    v_v := rds_x_vendas(p_loja, array[u], p_de, p_ate);
    v_vant := rds_x_vendas(p_loja, array[u], p_de - v_dias, p_de - 1);
    v_it := rds_x_itens_venda(p_loja, array[u], p_de, p_ate);
    v_prod := rds_a_produtos(v_it, 'produto', false, v_dias);
    v_abc := rds_a_abc(v_prod, null, 'faturamento');
    v_cpv := rds_a_cpv_perdas(p_loja, array[u], p_de, p_ate, null)->'por_unidade'->0;
    v_dre := rds_a_dre(p_loja, array[u], p_de, p_ate)->0->'linhas';
    v_crm := rds_a_crm(p_loja, array[u], p_de, p_ate, rds_x_clientes(p_loja, array[u], p_de, p_ate), v_v)->0;
    select coalesce(sum((r->>'valor_liquido')::numeric) filter (where not (r->>'cancelada')::boolean),0),
           count(*) filter (where not (r->>'cancelada')::boolean),
           count(*) filter (where (r->>'cancelada')::boolean),
           coalesce(sum((r->>'valor_liquido')::numeric) filter (where (r->>'cancelada')::boolean),0)
      into v_liq, v_ped, v_canc_q, v_canc_v from jsonb_array_elements(v_v) r;
    select coalesce(sum((r->>'valor_liquido')::numeric) filter (where not (r->>'cancelada')::boolean),0)
      into v_liq_ant from jsonb_array_elements(v_vant) r;
    select avg(funcionarios) into v_func from indicadores_manuais
     where loja_id = p_loja and sucursal_id = u and mes between to_char(p_de,'YYYY-MM') and to_char(p_ate,'YYYY-MM') and funcionarios > 0;
    select jsonb_build_object('valor', round(coalesce(sum(estoque * custo_medio) filter (where estoque > 0),0),2),
             'itens_negativos', count(*) filter (where estoque < 0))
      into v_est from estoque_unidade where loja_id = p_loja and sucursal_id = u;
    select jsonb_build_object('caixas', count(*), 'com_diferenca', count(*) filter (where abs(coalesce(diferenca_total,0)) >= 0.01),
             'soma_absoluta_diferencas', round(coalesce(sum(abs(coalesce(diferenca_total,0))),0),2))
      into v_cx from caixas where loja_id = p_loja and sucursal_id = u
       and (aberto_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate;
    if v_prod_nome is not null then
      select coalesce(sum((r->>'quantidade')::numeric),0) into v_prod_q from jsonb_array_elements(v_it) r
       where not (r->>'venda_cancelada')::boolean
         and (rds_norm(r->>'produto') = rds_norm(v_prod_nome) or rds_norm(r->>'produto_ref') = rds_norm(v_prod_nome));
    end if;
    v_res := v_res || jsonb_build_array(jsonb_build_object(
      'sucursal_id', u,
      'faturamento_liquido', round(v_liq,2), 'faturamento_periodo_anterior', round(v_liq_ant,2),
      'crescimento_pct', case when v_liq_ant > 0 then round((v_liq / v_liq_ant - 1) * 100, 2) end,
      'pedidos', v_ped, 'ticket_medio', case when v_ped > 0 then round(v_liq / v_ped, 2) end,
      'faturamento_por_pessoa_atendida', 'não_disponível',
      'funcionarios_informados', v_func,
      'faturamento_por_colaborador', case when v_func > 0 then to_jsonb(round(v_liq / v_func, 2)) else to_jsonb('não_disponível'::text) end,
      'faturamento_por_hora_trabalhada', 'não_disponível', 'produtividade', 'não_disponível',
      'produto_consultado', case when v_prod_nome is null then null else
         jsonb_build_object('produto', v_prod_nome, 'quantidade', v_prod_q, 'media_diaria', round(v_prod_q / v_dias, 2)) end,
      'top_produtos_quantidade', (select jsonb_agg(x) from (select jsonb_build_object('produto', r->>'produto', 'quantidade', r->'quantidade',
                                   'faturamento', r->'faturamento') x from jsonb_array_elements(v_prod) r
                                   order by (r->>'quantidade')::numeric desc limit 5) z),
      'classe_a', (select jsonb_agg(r->>'produto' order by (r->>'posicao')::int) from jsonb_array_elements(v_abc) r where r->>'classe' = 'A'),
      'mix_por_grupo_pct', (select jsonb_object_agg(g, pct) from (
          select coalesce(r->>'grupo','sem grupo') g, round(sum((r->>'faturamento')::numeric) / nullif(v_liq,0) * 100, 2) pct
            from jsonb_array_elements(v_prod) r group by 1) z),
      'cpv_teorico', v_cpv->'cpv_teorico', 'perdas_totais', v_cpv->'perdas_totais', 'indice_perdas', v_cpv->'indice_perdas',
      'cpv_sobre_faturamento', v_cpv->'cpv_sobre_faturamento',
      'margem_contribuicao', (select l->'valor' from jsonb_array_elements(v_dre) l where l->>'linha' = 'margem_contribuicao'),
      'despesas_lancadas', (select -sum((l->>'valor')::numeric) from jsonb_array_elements(v_dre) l
                             where l->>'origem' = 'lançada' and (l->>'valor')::numeric < 0),
      'resultado_liquido_gerencial', (select l->'valor' from jsonb_array_elements(v_dre) l where l->>'linha' = 'resultado_liquido_gerencial'),
      'estoque_valor', v_est->'valor', 'estoque_itens_negativos', v_est->'itens_negativos',
      'giro_aproximado', case when coalesce((v_est->>'valor')::numeric,0) > 0
                              then round(coalesce((v_cpv->>'cpv_teorico')::numeric,0) / (v_est->>'valor')::numeric, 2) end,
      'giro_formula', 'CPV teórico do período ÷ valor do estoque de HOJE (o Joia não guarda estoque médio histórico)',
      'ruptura_itens_abaixo_do_minimo', (select count(*) from estoque_unidade e join insumos i on i.ref_local = e.item_ref and i.loja_id = e.loja_id
                                          where e.loja_id = p_loja and e.sucursal_id = u and coalesce(i.estoque_min,0) > 0 and e.estoque < i.estoque_min),
      'cancelamentos_quantidade', v_canc_q, 'cancelamentos_valor', round(v_canc_v,2),
      'cancelamentos_pct', case when (v_ped + v_canc_q) > 0 then round(v_canc_q::numeric / (v_ped + v_canc_q) * 100, 2) end,
      'diferencas_de_caixa', v_cx,
      'recorrencia_clientes', jsonb_build_object('retencao_pct', v_crm->'retencao_pct', 'recorrentes', v_crm->'recorrentes',
                                'clientes_unicos', v_crm->'clientes_unicos', 'vendas_identificadas_pct', v_crm->'vendas_com_cliente_identificado_pct')));
  end loop;
  return v_res;
end;
$$;

-- ---------- a porta única ----------
create or replace function public.rds_consulta(p_loja uuid, p_rota text, p_q jsonb, p_chave_suc text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q jsonb := coalesce(p_q, '{}'::jsonb);
  v_ids jsonb := rds_unidades(p_loja);
  v_rede jsonb := rds_rede(p_loja);
  v_todas text[]; v_sucs text[]; v_pedidas text[]; v_inval text[];
  v_escopo text; v_de date; v_ate date; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_rota text := trim(both '/' from coalesce(p_rota, ''));
  v_lista jsonb; v_obj jsonb; v_avisos text[] := '{}'; v_sinc jsonb; v_x jsonb; v_y jsonb;
  v_sem_escopo boolean := false; v_precisa_escopo boolean; v_usa_periodo boolean := true;
  v_rede_bool boolean := lower(coalesce(q->>'rede','')) in ('1','true','sim');
  v_tipo text; v_dias int;
  v_chave_suc text := nullif(trim(coalesce(p_chave_suc, '')), '');
begin
  if v_ids = '{}'::jsonb then
    return jsonb_build_object('_status', 403, 'erro', 'Esta chave não enxerga nenhuma unidade.');
  end if;
  select array_agg(k order by k) into v_todas
    from jsonb_object_keys(v_ids) k where v_ids->k->>'situacao_unidade' <> 'excluída';

  -- ---------- escopo: qual unidade, ou a rede, dito expressamente ----------
  if v_chave_suc is not null then
    v_sucs := array[v_chave_suc];
    v_escopo := 'unidade';
    if coalesce(q->>'loja', q->>'unidades', '') <> '' and coalesce(q->>'loja', q->>'unidades') <> v_chave_suc then
      v_avisos := v_avisos || 'Esta chave é de uma unidade só: o filtro de unidade pedido foi ignorado.'::text;
    end if;
  elsif coalesce(q->>'loja','') <> '' then
    v_pedidas := array[trim(q->>'loja')];
  elsif coalesce(q->>'unidades','') <> '' then
    v_pedidas := array(select distinct trim(x) from unnest(string_to_array(q->>'unidades', ',')) x where trim(x) <> '');
  elsif v_rede_bool then
    v_sucs := v_todas; v_escopo := 'rede_consolidada';
  else
    v_sem_escopo := true;
  end if;
  if v_pedidas is not null then
    v_inval := array(select x from unnest(v_pedidas) x where not v_ids ? x);
    if array_length(v_inval, 1) > 0 then
      return jsonb_build_object('_status', 400, 'erro', 'Unidade desconhecida: ' || array_to_string(v_inval, ', '),
        'unidades_validas', (select jsonb_agg(jsonb_build_object('sucursal_id', k, 'sucursal_nome', v_ids->k->>'sucursal_nome',
                              'tipo_unidade', v_ids->k->>'tipo_unidade')) from unnest(v_todas) k));
    end if;
    v_sucs := v_pedidas;
    v_escopo := case when array_length(v_sucs,1) = 1 then 'unidade' else 'unidades_selecionadas' end;
  end if;

  v_precisa_escopo := not (v_rota in ('', 'ajuda', 'lojas', 'metas', 'jornadas', 'analises/realizado-versus-meta',
                                      'cadastros', 'cadastros/plano-de-contas', 'cadastros/formas-pagamento',
                                      'cadastros/fornecedores', 'cadastros/motivos-estoque', 'cadastros/pessoas', 'analitico/fichas'));
  if v_sem_escopo and v_precisa_escopo then
    return jsonb_build_object('_status', 400,
      'erro', 'Diga de qual unidade é a consulta (loja=suc_... ou unidades=suc_a,suc_b) ou peça a rede expressamente (rede=1). Sem isso a API não mistura unidades.',
      'unidades_validas', (select jsonb_agg(jsonb_build_object('sucursal_id', k, 'sucursal_nome', v_ids->k->>'sucursal_nome',
                            'tipo_unidade', v_ids->k->>'tipo_unidade')) from unnest(v_todas) k));
  end if;
  if v_sem_escopo then v_sucs := v_todas; v_escopo := 'rede (cadastro compartilhado)'; end if;

  -- ---------- período ----------
  begin
    v_ate := coalesce(nullif(q->>'ate','')::date, v_hoje);
    v_de := coalesce(nullif(q->>'de','')::date, v_ate - 29);
  exception when others then
    return jsonb_build_object('_status', 400, 'erro', 'Datas devem estar no formato AAAA-MM-DD.');
  end;
  if v_de > v_ate then return jsonb_build_object('_status', 400, 'erro', 'A data inicial (de) é depois da final (ate).'); end if;
  if v_ate - v_de > 400 then return jsonb_build_object('_status', 400, 'erro', 'Período máximo por consulta: 400 dias. Use páginas de período (de/ate) ou alterados_desde.'); end if;
  v_dias := v_ate - v_de + 1;
  if coalesce(q->>'alterados_desde','') <> '' then
    begin perform (q->>'alterados_desde')::timestamptz;
    exception when others then return jsonb_build_object('_status', 400, 'erro', 'alterados_desde deve ser data e hora ISO-8601 (ex.: 2026-09-30T00:00:00Z).'); end;
  end if;

  -- ---------- a rota ----------
  case v_rota
    when '', 'ajuda' then
      v_usa_periodo := false;
      v_obj := jsonb_build_object('catalogo', jsonb_build_object(
        'unidades', jsonb_build_array('GET /lojas'),
        'cadastros', jsonb_build_array('GET /cadastros/produtos','GET /cadastros/plano-de-contas','GET /cadastros/contas-financeiras',
          'GET /cadastros/formas-pagamento','GET /cadastros/fornecedores','GET /cadastros/motivos-estoque','GET /cadastros/pessoas','GET /jornadas'),
        'vendas', jsonb_build_array('GET /faturamento','GET /analitico/vendas','GET /analitico/itens-venda','GET /produtos','GET /analises/curva-abc'),
        'estoque', jsonb_build_array('GET /estoque','GET /analitico/movimentos-estoque','GET /analitico/inventarios','GET /analises/cpv-perdas'),
        'compras', jsonb_build_array('GET /analitico/compras','GET /analitico/itens-compra','GET /analises/historico-custos'),
        'producao', jsonb_build_array('GET /analitico/fichas','GET /analitico/producoes'),
        'caixa_e_pagamentos', jsonb_build_array('GET /analitico/pagamentos','GET /analitico/caixas'),
        'financeiro', jsonb_build_array('GET /analitico/titulos','GET /analitico/extrato-financeiro','GET /analises/dre','GET /analises/fluxo-caixa'),
        'clientes', jsonb_build_array('GET /analitico/clientes','GET /analises/crm'),
        'comparacao', jsonb_build_array('GET /analises/comparativo-unidades'),
        'metas', jsonb_build_array('GET /metas','GET /analises/realizado-versus-meta'),
        'qualidade', jsonb_build_array('GET /pendencias','GET /pendencias/{tipo}'),
        'sincronizacao', jsonb_build_array('GET /sincronizacao/unidades','GET /sincronizacao/aparelhos','GET /alteracoes','GET /historico')),
        'parametros', jsonb_build_object('de','AAAA-MM-DD (padrão: 29 dias antes de ate)','ate','AAAA-MM-DD (padrão: hoje, no fuso da unidade)',
          'loja','uma unidade (suc_...)','unidades','várias unidades separadas por vírgula','rede','1 = a rede inteira, expressamente',
          'pagina','a partir de 1','limite','registros por página (padrão 200, máximo 1000)','ordenar_por','qualquer campo do registro',
          'ordem','asc | desc','alterados_desde','ISO-8601: só o que mudou desde o instante',
          'situacao','—','categoria','—','produto','ref ou nome exato','grupo','—','canal','—','forma_pagamento','—','operador','—','turno','—'),
        'somente_leitura', 'Esta API só lê. Nenhum método além de GET é aceito e nenhuma consulta altera o Joia.');

    when 'lojas' then
      v_usa_periodo := false;
      v_lista := (select jsonb_agg(jsonb_build_object('sucursal_id', k) || (select s from jsonb_array_elements(rds_sincronizacao(p_loja, array[k])) s)
                     order by k) from unnest(case when v_chave_suc is null then v_todas else array[v_chave_suc] end) k);

    when 'cadastros' then
      v_usa_periodo := false;
      v_obj := jsonb_build_object('cadastros', jsonb_build_array('produtos','plano-de-contas','contas-financeiras','formas-pagamento',
                'fornecedores','motivos-estoque','pessoas'));
    when 'cadastros/produtos' then v_usa_periodo := false; v_lista := rds_c_produtos(p_loja, v_sucs);
    when 'cadastros/plano-de-contas' then v_usa_periodo := false; v_lista := rds_c_plano(p_loja);
    when 'cadastros/contas-financeiras' then v_usa_periodo := false; v_lista := rds_c_contas(p_loja, v_sucs);
    when 'cadastros/formas-pagamento' then v_usa_periodo := false; v_lista := rds_c_formas(p_loja);
    when 'cadastros/fornecedores' then v_usa_periodo := false; v_lista := rds_c_fornecedores(p_loja);
    when 'cadastros/motivos-estoque' then v_usa_periodo := false; v_lista := rds_c_motivos(p_loja);
    when 'cadastros/pessoas' then
      v_usa_periodo := false; v_lista := rds_c_pessoas(p_loja);
      v_avisos := v_avisos || 'As lojas usam uma conta por unidade no caixa: nem todo usuário é uma pessoa.'::text;
    when 'jornadas' then
      v_usa_periodo := false;
      v_obj := jsonb_build_object('disponivel', false, 'motivo', 'O Joia não registra jornada, ponto nem horas trabalhadas. Nenhum indicador por hora trabalhada é calculado — sem denominador verdadeiro não há indicador.',
               'o_que_existe', 'quadro de funcionários informado por mês na tela Indicadores do Mês (tabela indicadores_manuais), quando preenchido: ver /analises/comparativo-unidades');
    when 'metas', 'analises/realizado-versus-meta' then
      v_usa_periodo := false;
      v_obj := jsonb_build_object('disponivel', false, 'motivo', 'O Joia ainda não tem cadastro de metas. A API não cria meta fictícia.');

    when 'faturamento' then
      v_obj := jsonb_build_object('agrupamento', case when q->>'agrupar' = 'mes' then 'mês' else 'dia' end);
      v_lista := rds_a_faturamento(rds_x_vendas(p_loja, v_sucs, v_de, v_ate), rds_x_pagamentos(p_loja, v_sucs, v_de, v_ate), q->>'agrupar');
    when 'analitico/vendas' then v_lista := rds_x_vendas(p_loja, v_sucs, v_de, v_ate);
    when 'analitico/itens-venda' then
      v_lista := rds_x_itens_venda(p_loja, v_sucs, v_de, v_ate);
      v_avisos := v_avisos || 'Alteração e exclusão de item durante a montagem do pedido não são gravadas: não viram venda, cancelamento, CPV nem estoque.'::text;
    when 'produtos' then
      v_lista := rds_a_produtos(rds_x_itens_venda(p_loja, v_sucs, v_de, v_ate), coalesce(q->>'nivel','produto'),
                                v_escopo = 'rede_consolidada' and lower(coalesce(q->>'agrupar','')) <> 'unidade', v_dias);
    when 'analises/curva-abc' then
      v_x := rds_a_produtos(rds_x_itens_venda(p_loja, v_sucs, v_de, v_ate), coalesce(q->>'nivel','produto'),
                            v_escopo = 'rede_consolidada' and lower(coalesce(q->>'agrupar','')) <> 'unidade', v_dias);
      v_y := rds_a_produtos(rds_x_itens_venda(p_loja, v_sucs, v_de - v_dias, v_de - 1), coalesce(q->>'nivel','produto'),
                            v_escopo = 'rede_consolidada' and lower(coalesce(q->>'agrupar','')) <> 'unidade', v_dias);
      v_lista := rds_a_abc(v_x, v_y, q->>'criterio');
      v_obj := jsonb_build_object('regra', 'A = itens que somam até 80% do critério; B = até 95%; C = o resto',
                                  'periodo_anterior', jsonb_build_object('de', v_de - v_dias, 'ate', v_de - 1));
    when 'estoque' then v_usa_periodo := false; v_lista := rds_x_estoque(p_loja, v_sucs);
    when 'analitico/movimentos-estoque' then v_lista := rds_x_movimentos(p_loja, v_sucs, v_de, v_ate);
    when 'analitico/inventarios' then v_lista := rds_x_inventarios(p_loja, v_sucs, v_de, v_ate);
    when 'analises/cpv-perdas' then
      v_obj := rds_a_cpv_perdas(p_loja, v_sucs, v_de, v_ate, q->>'detalhe');
      v_lista := v_obj->'por_unidade';
      v_obj := v_obj - 'por_unidade';
    when 'analitico/compras' then v_lista := rds_x_compras(p_loja, v_sucs, v_de, v_ate);
    when 'analitico/itens-compra' then v_lista := rds_x_itens_compra(p_loja, v_sucs, v_de, v_ate);
    when 'analises/historico-custos' then v_lista := rds_a_custos(p_loja, v_sucs, v_de, v_ate, rds_x_itens_compra(p_loja, v_sucs, v_de, v_ate));
    when 'analitico/fichas' then
      v_usa_periodo := false; v_lista := rds_x_fichas(p_loja);
      v_avisos := v_avisos || 'A ficha técnica não é versionada: o CPV histórico das vendas usa o custo gravado NA HORA da venda, mas a composição exibida aqui é a de hoje.'::text;
    when 'analitico/producoes' then v_lista := rds_x_producoes(p_loja, v_sucs, v_de, v_ate);
    when 'analitico/pagamentos' then
      v_lista := rds_x_pagamentos(p_loja, v_sucs, v_de, v_ate);
      v_avisos := v_avisos || 'Não há integração com maquininha (TEF/adquirente): taxa e data prevista saem do cadastro da forma de pagamento; nada aqui é "aprovado pela adquirente".'::text;
    when 'analitico/caixas' then v_lista := rds_x_caixas(p_loja, v_sucs, v_de, v_ate);
    when 'analitico/titulos' then
      v_tipo := lower(coalesce(q->>'data', 'vencimento'));
      if v_tipo not in ('emissao','vencimento','pagamento','competencia') then
        return jsonb_build_object('_status', 400, 'erro', 'data deve ser emissao, competencia, vencimento ou pagamento.');
      end if;
      v_obj := jsonb_build_object('periodo_pela_data_de', v_tipo);
      v_lista := rds_x_titulos(p_loja, v_sucs, v_de, v_ate, v_tipo);
      v_avisos := v_avisos || 'Título em aberto sem conta financeira NÃO é inconsistência: a conta é exigida na movimentação. Movimentado sem plano de contas ou sem conta aparece em `inconsistencias`.'::text;
    when 'analitico/extrato-financeiro' then v_lista := rds_x_extrato(p_loja, v_sucs, v_de, v_ate);
    when 'analises/dre' then v_lista := rds_a_dre(p_loja, v_sucs, v_de, v_ate);
    when 'analises/fluxo-caixa' then
      v_obj := rds_a_fluxo(p_loja, v_sucs, v_de, v_ate, coalesce(q->>'visao','diaria'));
    when 'analitico/clientes' then
      v_lista := rds_x_clientes(p_loja, v_sucs, v_de, v_ate);
      v_avisos := v_avisos || 'Nome de cliente sai mascarado (iniciais). Telefone, CPF e endereço não saem.'::text;
    when 'analises/crm' then
      v_lista := rds_a_crm(p_loja, v_sucs, v_de, v_ate, rds_x_clientes(p_loja, v_sucs, v_de, v_ate), rds_x_vendas(p_loja, v_sucs, v_de, v_ate));
    when 'analises/comparativo-unidades' then
      v_lista := rds_a_comparativo(p_loja, v_sucs, v_de, v_ate, q);
      v_obj := jsonb_build_object('metodologia', 'A API entrega indicadores comparáveis, no mesmo período e pelas mesmas regras. Ela não escolhe a melhor unidade: pesos e ranking são da RDS.');
    when 'pendencias' then
      v_usa_periodo := false;
      v_obj := rds_a_pendencias(p_loja, v_sucs, null);
    when 'sincronizacao/unidades' then v_usa_periodo := false; v_lista := rds_sincronizacao(p_loja, v_sucs);
    when 'sincronizacao/aparelhos' then
      v_usa_periodo := false;
      v_lista := (select coalesce(jsonb_agg(a || jsonb_build_object('sucursal_id', s->>'sucursal_id')), '[]'::jsonb)
                    from jsonb_array_elements(rds_sincronizacao(p_loja, v_sucs)) s, jsonb_array_elements(s->'aparelhos') a);
    when 'alteracoes' then
      v_usa_periodo := false;
      v_lista := (select coalesce(jsonb_agg(jsonb_build_object('tabela', a.tabela, 'ref', a.ref, 'sucursal_id', a.unidade,
                     'updated_at', a.alterado_em)), '[]'::jsonb)
                    from api_alteracoes(p_loja, case when array_length(v_sucs,1) = 1 then v_sucs[1] end,
                                        coalesce(nullif(q->>'alterados_desde','')::timestamptz, now() - interval '1 day'), 1000, 0) a
                   where a.unidade is null or a.unidade = any(v_sucs));
      q := q - 'alterados_desde';
    when 'historico' then
      v_lista := (select coalesce(jsonb_agg(jsonb_build_object('quando', h.quando, 'usuario', h.usuario, 'tabela', h.tabela,
                     'operacao', h.operacao, 'ref', h.ref, 'sucursal_id', h.unidade, 'campos_alterados', h.campos_alterados,
                     'antes', h.antes, 'depois', h.depois, 'updated_at', h.quando)), '[]'::jsonb)
                    from api_historico(p_loja, case when array_length(v_sucs,1) = 1 then v_sucs[1] end, v_de, v_ate,
                                       nullif(q->>'tabela',''), 1000, 0) h
                   where h.unidade is null or h.unidade = any(v_sucs));
    else
      if v_rota like 'pendencias/%' then
        v_usa_periodo := false;
        v_obj := rds_a_pendencias(p_loja, v_sucs, substr(v_rota, 12));
        if v_obj ? '_status' then return v_obj; end if;
        v_lista := v_obj->'dados'; v_obj := v_obj - 'dados';
      else
        return jsonb_build_object('_status', 404, 'erro', 'Caminho "' || v_rota || '" não existe. GET / traz o catálogo.');
      end if;
  end case;

  -- ---------- sincronização e avisos de completude ----------
  v_sinc := rds_sincronizacao(p_loja, v_sucs);
  select v_avisos || coalesce(array_agg(msg), '{}') into v_avisos from (
    select 'Unidade ' || (s->>'sucursal_nome') || ' está OFFLINE (último sinal ' ||
           coalesce(to_char((s->>'ultimo_sinal_de_aparelho')::timestamptz at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), 'nunca') ||
           '): o que ela fez depois disso ainda não está aqui.' msg
      from jsonb_array_elements(v_sinc) s where (s->>'offline')::boolean
    union all
    select 'Unidade ' || (s->>'sucursal_nome') || ' tem aparelho com dado ainda não enviado (pendência local).'
      from jsonb_array_elements(v_sinc) s where (s->>'pendencia_local')::boolean
    union all
    select 'Unidade ' || (s->>'sucursal_nome') || ' tem aparelho parado há mais de 7 dias com pendência local: pode haver dado que nunca chegou.'
      from jsonb_array_elements(v_sinc) s where (s->>'aparelho_parado_com_pendencia')::boolean
  ) z;
  if v_usa_periodo and v_ate >= v_hoje and exists (select 1 from jsonb_array_elements(v_sinc) s
                                                    where (s->>'offline')::boolean or (s->>'pendencia_local')::boolean) then
    v_avisos := v_avisos || 'Período parcialmente sincronizado: ele chega até hoje e há unidade offline ou com pendência local.'::text;
  end if;

  if v_lista is not null then
    v_x := rds_lista(p_loja, v_lista, q, v_ids, v_rede);
    v_avisos := v_avisos || coalesce(array(select jsonb_array_elements_text(v_x->'avisos_lista')), '{}');
  end if;

  return jsonb_build_object(
      'api_versao', '3.0.0', 'regra_versao', '2026-10-01',
      'extraido_em', now(), 'fuso', 'America/Sao_Paulo', 'moeda', 'BRL',
      'precisao', jsonb_build_object('valores', 2, 'quantidades', 4, 'custos', 6),
      'rota', '/' || v_rota,
      'periodo', case when v_usa_periodo then jsonb_build_object('de', v_de, 'ate', v_ate, 'dias', v_dias) else null end,
      'escopo', v_escopo,
      'filtros', q - 'pagina' - 'limite',
      'unidades_incluidas', (select jsonb_agg(jsonb_build_object('sucursal_id', k, 'sucursal_nome', v_ids->k->>'sucursal_nome',
                               'tipo_unidade', v_ids->k->>'tipo_unidade') order by k) from unnest(v_sucs) k),
      'unidades_excluidas', coalesce((select jsonb_agg(jsonb_build_object('sucursal_id', k, 'sucursal_nome', v_ids->k->>'sucursal_nome',
                               'tipo_unidade', v_ids->k->>'tipo_unidade') order by k) from unnest(v_todas) k where not k = any(v_sucs)), '[]'::jsonb),
      'sincronizacao', v_sinc,
      'dado_completo', not exists (select 1 from jsonb_array_elements(v_sinc) s
                                   where (s->>'offline')::boolean or (s->>'pendencia_local')::boolean or (s->>'aparelho_parado_com_pendencia')::boolean),
      'avisos', to_jsonb(v_avisos))
    || coalesce(v_obj, '{}'::jsonb)
    || case when v_x is null then '{}'::jsonb else jsonb_build_object(
         'paginacao', v_x->'paginacao', 'total_registros', v_x->'paginacao'->'total_registros',
         'filtros_aplicados', v_x->'filtros_aplicados', 'filtros_que_nao_se_aplicam', v_x->'filtros_que_nao_se_aplicam',
         'dados', v_x->'dados') end;
end;
$$;

-- ---------- ninguém de fora chama: só a função de borda (service_role) ----------
revoke all on function public.rds_a_faturamento(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.rds_a_faturamento(jsonb, jsonb, text) to service_role;
revoke all on function public.rds_a_produtos(jsonb, text, boolean, int) from public, anon, authenticated;
grant execute on function public.rds_a_produtos(jsonb, text, boolean, int) to service_role;
revoke all on function public.rds_a_abc(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.rds_a_abc(jsonb, jsonb, text) to service_role;
revoke all on function public.rds_a_custos(uuid, text[], date, date, jsonb) from public, anon, authenticated;
grant execute on function public.rds_a_custos(uuid, text[], date, date, jsonb) to service_role;
revoke all on function public.rds_a_crm(uuid, text[], date, date, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.rds_a_crm(uuid, text[], date, date, jsonb, jsonb) to service_role;
revoke all on function public.rds_a_pendencias(uuid, text[], text) from public, anon, authenticated;
grant execute on function public.rds_a_pendencias(uuid, text[], text) to service_role;
revoke all on function public.rds_a_comparativo(uuid, text[], date, date, jsonb) from public, anon, authenticated;
grant execute on function public.rds_a_comparativo(uuid, text[], date, date, jsonb) to service_role;
revoke all on function public.rds_consulta(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.rds_consulta(uuid, text, jsonb, text) to service_role;

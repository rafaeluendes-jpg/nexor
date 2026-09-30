-- =====================================================================
-- JOIA — API ANALÍTICA RDS v3 · PARTE 2: VENDAS, ESTOQUE, COMPRAS,
-- PRODUÇÃO E CAIXAS (extração registro a registro, somente leitura)
-- =====================================================================

-- ---------- as linhas de consumo de cada venda (a base do CPV teórico) ----------
-- Toda venda concluída gera um movimento de estoque "Pedido #N" com o que
-- a ficha técnica consumiu, ao custo médio da hora. Estas linhas SÃO o
-- CPV teórico: o que deveria ter saído do estoque pelas vendas.
-- Venda cancelada: se o estoque voltou, existe o movimento "Estorno do
-- pedido #N" e as linhas se anulam; se o pedido já tinha sido produzido,
-- não há estorno e o consumo vira PERDA POR CANCELAMENTO.
create or replace function public.rds_linhas_venda(p_loja uuid, p_sucs text[], p_de date, p_ate date)
returns table(sucursal_id text, numero int, mov_ref text, dia date, pedido_ref text, pedido_cancelado boolean,
              tem_estorno boolean, produto_ref text, ficha_ref text, ficha_nome text, insumo_ref text, item text,
              unidade text, quantidade numeric, custo_unitario numeric, valor numeric, producao_auto boolean,
              produzido_qtd numeric)
language sql stable security definer set search_path = public as $$
  with m as (
    select m.sucursal_id suc, substring(m.identificacao from '#(\d+)')::int num, m.ref_local, m.data, m.linhas
      from movimentacoes_estoque m
     where m.loja_id = p_loja and m.origem = 'venda' and m.sucursal_id = any(p_sucs)
       and m.data between p_de - 2 and p_ate + 2
  ), est as (
    select distinct m.sucursal_id suc, substring(m.identificacao from '#(\d+)')::int num
      from movimentacoes_estoque m
     where m.loja_id = p_loja and m.origem = 'estorno' and m.sucursal_id = any(p_sucs)
  ), ped as (
    select distinct on (s.ref_local, p.numero) s.ref_local suc, p.numero num, p.ref_local,
           (p.data_venda at time zone 'America/Sao_Paulo')::date dia, p.fase
      from pedidos p join sucursais s on s.id = p.sucursal_id
     where p.loja_id = p_loja and s.ref_local = any(p_sucs)
       and (p.data_venda at time zone 'America/Sao_Paulo')::date between p_de - 2 and p_ate + 2
     order by s.ref_local, p.numero, p.data_venda desc
  )
  select m.suc, m.num, m.ref_local, coalesce(ped.dia, m.data), ped.ref_local,
         coalesce(ped.fase = 'cancelado', false), (est.num is not null),
         l->>'produtoRef', l->>'fichaId', l->>'fichaNome', l->>'insumoId', l->>'nome',
         coalesce(nullif(l->>'unidade',''), 'un'),
         coalesce((l->>'qtd')::numeric, 0), coalesce((l->>'custo')::numeric, 0),
         coalesce((l->>'qtd')::numeric, 0) * coalesce((l->>'custo')::numeric, 0),
         coalesce((l->>'producaoAuto')::boolean, false), (l->>'produzidoQtd')::numeric
    from m
    cross join lateral jsonb_array_elements(coalesce(m.linhas,'[]'::jsonb)) l
    left join ped on ped.suc = m.suc and ped.num = m.num
    left join est on est.suc = m.suc and est.num = m.num
   where coalesce(l->>'direcao','saida') = 'saida'
     and coalesce(ped.dia, m.data) between p_de and p_ate;
$$;

-- ---------- vendas: uma linha por venda ----------
create or replace function public.rds_x_vendas(p_loja uuid, p_sucs text[], p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path = public as $$
  with p as (
    select p.*, s.ref_local suc_ref, (p.data_venda at time zone 'America/Sao_Paulo') dt
      from pedidos p join sucursais s on s.id = p.sucursal_id
     where p.loja_id = p_loja and s.ref_local = any(p_sucs)
       and (p.data_venda at time zone 'America/Sao_Paulo')::date between p_de and p_ate
  ), it as (
    select i.pedido_id, sum(i.quantidade) qtd, count(*) linhas, sum(i.total) soma_itens
      from pedido_itens i where i.pedido_id in (select id from p) group by 1
  ), pg as (
    select g.pedido_id,
           jsonb_agg(jsonb_build_object('pagamento_ref', g.ref_local, 'forma_pagamento', coalesce(f.nome,'—'),
                     'valor', round(g.valor,2), 'situacao', coalesce(g.situacao,'recebido')) order by g.ref_local) formas,
           sum(g.valor) filter (where coalesce(g.situacao,'recebido') <> 'estornado') pago
      from pedido_pagamentos g left join formas_pagamento f on f.id = g.forma_id
     where g.pedido_id in (select id from p) group by 1
  ), cf as (
    select distinct on (c.pedido_ref) c.pedido_ref, c.status, c.numero, c.serie, c.chave, c.ambiente
      from cupons_fiscais c
     where c.loja_id = p_loja and c.pedido_ref in (select ref_local from p)
     order by c.pedido_ref, (c.status in ('autorizado','cancelado')) desc, (c.ambiente = 'producao') desc, c.criado_em desc
  ), cpv as (
    select l.sucursal_id, l.numero, sum(l.valor) cpv
      from rds_linhas_venda(p_loja, p_sucs, p_de, p_ate) l group by 1, 2
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'venda_ref', p.ref_local, 'pedido_ref', p.ref_local, 'sucursal_id', p.suc_ref,
      'numero', p.numero,
      'data_hora_pedido', p.data_venda,
      'data_hora_confirmacao', 'não_disponível',
      'dia_comercial', p.dt::date, 'hora', to_char(p.dt, 'HH24:MI'),
      'canal', coalesce(p.canal, p.tipo), 'tipo', p.tipo, 'origem_venda', p.origem_venda,
      'mesa', p.mesa_numero, 'comanda', p.comanda_nome,
      'operador', cx.operador, 'operador_ref', cx.operador_id,
      'caixa_ref', cx.ref_local, 'turno', cx.turno_nome,
      'cliente', p.cliente_nome, 'cliente_ref', cl.ref_local,
      'pessoas_atendidas', 'não_disponível',
      'valor_bruto', round(coalesce(p.total,0) + coalesce(p.desconto,0) + coalesce(p.cupom_valor,0)
                           - coalesce(p.taxa,0) - coalesce(p.taxa_servico,0), 2),
      'desconto', round(coalesce(p.desconto,0) + coalesce(p.cupom_valor,0), 2),
      'acrescimo', round(coalesce(p.taxa_servico,0), 2),
      'taxa_entrega', round(coalesce(p.taxa,0), 2),
      'valor_liquido', round(coalesce(p.total,0), 2),
      'soma_dos_itens', round(coalesce(it.soma_itens,0), 2),
      'itens_quantidade', coalesce(it.qtd,0), 'itens_linhas', coalesce(it.linhas,0),
      'situacao', case when p.fase = 'cancelado' then 'cancelada'
                       when p.fase = 'entregue' then 'concluída' else p.fase end,
      'demonstracao', 'não_disponível',
      'cancelada', p.fase = 'cancelado',
      'motivo_cancelamento', cn.motivo_nome, 'cancelada_em', nullif(concat_ws(' ', cn.data, cn.hora), ''),
      'cancelada_por', cn.operador_nome, 'cancelamento_produzido', cn.produzido,
      'estoque_voltou', cn.estoque_voltou,
      'venda_original_ref', 'não_disponível',
      'documento_fiscal', case when cf.pedido_ref is null then null else jsonb_build_object(
          'modelo', 'NFC-e', 'numero', cf.numero, 'serie', cf.serie, 'chave', cf.chave, 'ambiente', cf.ambiente) end,
      'situacao_fiscal', case when cf.pedido_ref is null then 'sem cupom'
                              when cf.ambiente is distinct from 'producao' then 'homologação (não é documento)'
                              else cf.status end,
      'valor_pago', round(coalesce(pg.pago,0), 2),
      'pagamentos', coalesce(pg.formas, '[]'::jsonb),
      'cpv_teorico', round(coalesce(cpv.cpv,0), 2),
      'sincronizacao', jsonb_build_object('recebido_na_nuvem_em', p.criado_em, 'equipamento', p.equipamento),
      'updated_at', coalesce(p.alterado_em, p.criado_em)
    ) order by p.data_venda, p.numero), '[]'::jsonb)
    from p
    left join it on it.pedido_id = p.id
    left join pg on pg.pedido_id = p.id
    left join cf on cf.pedido_ref = p.ref_local
    left join caixas cx on cx.id = p.caixa_id
    left join clientes cl on cl.id = p.cliente_id
    left join cancelamentos cn on cn.pedido_ref = p.ref_local and cn.loja_id = p.loja_id
    left join cpv on cpv.sucursal_id = p.suc_ref and cpv.numero = p.numero;
$$;

-- ---------- itens vendidos: uma linha por item ----------
-- O CPV do item vem das linhas de consumo da venda com o MESMO produto
-- (ou, nas vendas antigas sem o produto na linha, a mesma ficha). Dois
-- itens do mesmo produto no pedido dividem pela quantidade.
create or replace function public.rds_x_itens_venda(p_loja uuid, p_sucs text[], p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path = public as $$
  with p as (
    select p.id, p.ref_local, p.numero, p.fase, p.canal, p.tipo, p.caixa_id, s.ref_local suc_ref,
           (p.data_venda at time zone 'America/Sao_Paulo')::date dia
      from pedidos p join sucursais s on s.id = p.sucursal_id
     where p.loja_id = p_loja and s.ref_local = any(p_sucs)
       and (p.data_venda at time zone 'America/Sao_Paulo')::date between p_de and p_ate
  ), i as (
    select i.*, p.ref_local ped_ref, p.numero, p.fase, p.suc_ref, p.dia, coalesce(p.canal,p.tipo) canal, p.caixa_id,
           pr.ref_local prod_ref, pr.nome prod_nome, pr.pesado, pr.vincula_estoque, c.nome grupo, c.ref_local grupo_ref,
           f.ref_local ficha_ref, f.nome ficha_nome,
           sum(i.quantidade) over (partition by i.pedido_id, coalesce(pr.ref_local, i.nome)) qtd_mesmo_produto
      from pedido_itens i join p on p.id = i.pedido_id
      left join produtos pr on pr.id = i.produto_id
      left join categorias c on c.id = pr.categoria_id
      left join fichas_tecnicas f on f.id = pr.ficha_id
  ), lv as (
    select l.sucursal_id, l.numero, coalesce(l.produto_ref, '') produto_ref, coalesce(l.ficha_ref,'') ficha_ref,
           sum(l.valor) valor, bool_or(l.producao_auto) auto
      from rds_linhas_venda(p_loja, p_sucs, p_de, p_ate) l group by 1,2,3,4
  )
  select coalesce(jsonb_agg(x.o order by x.dia, x.numero, x.ref), '[]'::jsonb) from (
    select i.dia, i.numero, i.ref_local ref, jsonb_build_object(
      'item_venda_ref', i.ref_local, 'venda_ref', i.ped_ref, 'pedido_ref', i.ped_ref, 'sucursal_id', i.suc_ref,
      'numero', i.numero, 'dia_comercial', i.dia, 'canal', i.canal, 'caixa_ref', cx.ref_local, 'turno', cx.turno_nome,
      'operador', cx.operador,
      'produto_ref', i.prod_ref, 'produto', i.nome, 'descricao_cadastro', i.prod_nome,
      'grupo', i.grupo, 'grupo_ref', i.grupo_ref, 'classe', 'produto vendido',
      'quantidade', i.quantidade, 'unidade', case when i.pesado then 'kg' else 'un' end,
      'preco_unitario', round(coalesce(i.unitario,0), 4),
      'valor_bruto', round(coalesce(i.total,0), 2),
      'desconto_item', 'não_disponível',
      'valor_liquido', round(coalesce(i.total,0), 2),
      'adicionais', coalesce(i.opcoes, '[]'::jsonb), 'observacao', i.observacao,
      'cpv_teorico_total', round(coalesce(cpv.v,0) * i.quantidade / nullif(i.qtd_mesmo_produto,0), 4),
      'cpv_teorico_unitario', round(coalesce(cpv.v,0) / nullif(i.qtd_mesmo_produto,0), 6),
      'cpv_origem', case when cpv.v is null then 'sem consumo registrado para este produto na venda'
                         else 'linhas de consumo da venda (ficha técnica × custo médio da hora)' end,
      'ficha_ref', i.ficha_ref, 'ficha', i.ficha_nome,
      'ficha_versao', 'não_versionada',
      'ficha_versionada', false,
      'producao_automatica', coalesce(cpv.auto, false),
      'baixa_estoque', coalesce(i.vincula_estoque, false),
      'cancelado_durante_o_pedido', 'não_disponível',
      'venda_cancelada', i.fase = 'cancelado',
      'updated_at', i.alterado_em) o
      from i
      left join caixas cx on cx.id = i.caixa_id
      left join lateral (
        select sum(lv.valor) v, bool_or(lv.auto) auto from lv
         where lv.sucursal_id = i.suc_ref and lv.numero = i.numero
           and ((i.prod_ref is not null and lv.produto_ref = i.prod_ref)
             or (lv.produto_ref = '' and i.ficha_ref is not null and lv.ficha_ref = i.ficha_ref))
      ) cpv on true
  ) x;
$$;

-- ---------- pagamentos: uma linha por transação ----------
create or replace function public.rds_x_pagamentos(p_loja uuid, p_sucs text[], p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'pagamento_ref', g.ref_local, 'venda_ref', p.ref_local, 'pedido_ref', p.ref_local,
      'sucursal_id', s.ref_local, 'numero', p.numero,
      'dia_comercial', (p.data_venda at time zone 'America/Sao_Paulo')::date,
      'forma_pagamento', coalesce(f.nome, '—'), 'forma_pagamento_ref', f.ref_local, 'forma_tipo', f.tipo,
      'bandeira', f.bandeira, 'valor', round(coalesce(g.valor,0), 2),
      'parcelas', 'não_disponível',
      'taxa_pct', coalesce(f.taxa_pct,0), 'taxa_fixa', coalesce(f.taxa_fixa,0),
      'taxa_calculada', round(coalesce(g.valor,0) * coalesce(f.taxa_pct,0) / 100 + coalesce(f.taxa_fixa,0), 2),
      'valor_liquido_calculado', round(coalesce(g.valor,0) - (coalesce(g.valor,0) * coalesce(f.taxa_pct,0) / 100
                                     + coalesce(f.taxa_fixa,0)), 2),
      'data_prevista', (p.data_venda at time zone 'America/Sao_Paulo')::date + coalesce(f.dias_recebimento,0),
      'data_efetiva', 'não_disponível',
      'aprovacao_adquirente', 'não_disponível',
      'caixa_ref', cx.ref_local, 'operador', cx.operador, 'turno', cx.turno_nome,
      'situacao', coalesce(g.situacao, 'recebido'),
      'estornado', coalesce(g.situacao,'') = 'estornado', 'estornado_em', g.estornado_em,
      'estornado_por', g.estornado_por,
      'cancelamento_ref', cn.ref_local, 'venda_cancelada', p.fase = 'cancelado',
      'equipamento', g.equipamento,
      'updated_at', g.alterado_em
    ) order by p.data_venda, p.numero, g.ref_local), '[]'::jsonb)
    from pedido_pagamentos g
    join pedidos p on p.id = g.pedido_id
    join sucursais s on s.id = p.sucursal_id
    left join formas_pagamento f on f.id = g.forma_id
    left join caixas cx on cx.id = p.caixa_id
    left join cancelamentos cn on cn.pedido_ref = p.ref_local and cn.loja_id = p.loja_id
   where p.loja_id = p_loja and s.ref_local = any(p_sucs)
     and (p.data_venda at time zone 'America/Sao_Paulo')::date between p_de and p_ate;
$$;

-- ---------- razão do estoque: uma linha por movimento de item ----------
create or replace function public.rds_x_movimentos(p_loja uuid, p_sucs text[], p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path = public as $$
  with m as (
    select m.*, mo.nome motivo_nome, mo.tipo motivo_tipo,
           substring(m.identificacao from '#(\d+)')::int num
      from movimentacoes_estoque m left join motivos_movimentacao mo on mo.id = m.motivo_id
     where m.loja_id = p_loja and m.sucursal_id = any(p_sucs) and m.data between p_de and p_ate
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'movimento_ref', m.ref_local || ':' || l.o, 'documento_ref', m.ref_local, 'linha', l.o,
      'sucursal_id', m.sucursal_id, 'data', m.data, 'hora', m.hora,
      'insumo_ref', l.r->>'insumoId', 'item_ref', l.r->>'insumoId', 'item', l.r->>'nome',
      'unidade', coalesce(nullif(l.r->>'unidade',''),'un'),
      'tipo', coalesce(l.r->>'direcao','saida'),
      'origem', m.origem, 'motivo', m.motivo_nome,
      'classificacao_motivo', rds_classe_motivo(m.motivo_nome, m.motivo_tipo, m.origem, l.r->>'direcao'),
      'classificacao_origem', 'derivada por regra da API (o cadastro de motivo não tem classe)',
      'quantidade_entrada', case when l.r->>'direcao' = 'entrada' then round(coalesce((l.r->>'qtd')::numeric,0),4) else 0 end,
      'quantidade_saida', case when coalesce(l.r->>'direcao','saida') <> 'entrada' then round(coalesce((l.r->>'qtd')::numeric,0),4) else 0 end,
      'saldo_anterior', (l.r->>'saldoAntes')::numeric, 'saldo_posterior', (l.r->>'saldoDepois')::numeric,
      'custo_anterior', (l.r->>'custoMedioAntes')::numeric,
      'custo_do_movimento', round(coalesce((l.r->>'custo')::numeric,0), 6),
      'custo_posterior', (l.r->>'custoMedioDepois')::numeric,
      'valor', round(coalesce((l.r->>'qtd')::numeric,0) * coalesce((l.r->>'custo')::numeric,0), 2),
      'saldo_e_custo_gravados', (l.r ? 'saldoAntes'),
      'documento_origem', m.identificacao, 'observacao', coalesce(nullif(l.r->>'obs',''), m.observacao),
      'usuario', 'não_disponível',
      'venda_ref', case when m.origem in ('venda','estorno') then pv.ref_local end,
      'ficha_ref', l.r->>'fichaId', 'produto_ref', l.r->>'produtoRef',
      'producao_automatica', coalesce((l.r->>'producaoAuto')::boolean, false),
      'contagem_sistema', (l.r->>'sistema')::numeric, 'contagem_conferido', (l.r->>'conferido')::numeric,
      'origem_online_offline', 'não_disponível',
      'sincronizacao', jsonb_build_object('recebido_na_nuvem_em', m.criado_em),
      'updated_at', coalesce(m.alterado_em, m.criado_em)
    ) order by m.data, m.hora, m.ref_local, l.o), '[]'::jsonb)
    from m
    cross join lateral jsonb_array_elements(coalesce(m.linhas,'[]'::jsonb)) with ordinality l(r, o)
    left join lateral (
      select p.ref_local from pedidos p join sucursais s on s.id = p.sucursal_id
       where p.loja_id = p_loja and s.ref_local = m.sucursal_id and p.numero = m.num
       order by p.data_venda desc limit 1) pv on m.origem in ('venda','estorno');
$$;

-- ---------- estoque atual por item e unidade ----------
create or replace function public.rds_x_estoque(p_loja uuid, p_sucs text[])
returns jsonb language sql stable security definer set search_path = public as $$
  with mv as (
    select m.sucursal_id suc, l->>'insumoId' item,
           max(m.data) ult, max(m.data) filter (where l->>'direcao' = 'entrada') ult_ent,
           max(m.data) filter (where coalesce(l->>'direcao','saida') <> 'entrada') ult_sai,
           max(m.data) filter (where m.origem = 'contagem') ult_cont
      from movimentacoes_estoque m cross join lateral jsonb_array_elements(coalesce(m.linhas,'[]'::jsonb)) l
     where m.loja_id = p_loja and m.sucursal_id = any(p_sucs) group by 1, 2
  ), lt as (
    select sucursal_id suc, item_ref, jsonb_agg(jsonb_build_object('lote', lote, 'validade', validade,
             'quantidade', quantidade, 'fabricacao', fabricacao) order by validade nulls last) lotes
      from lotes_estoque where loja_id = p_loja and sucursal_id = any(p_sucs) group by 1, 2
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'sucursal_id', e.sucursal_id, 'item_ref', e.item_ref, 'insumo_ref', e.item_ref,
      'item', coalesce(i.nome, f.nome, e.item_ref),
      'tipo', case when i.id is not null then 'insumo' when f.id is not null then 'produto produzido' else e.tipo end,
      'unidade', coalesce(i.unidade, f.unidade, 'un'),
      'saldo', round(e.estoque, 4),
      'custo_medio', round(e.custo_medio, 6),
      'ultimo_custo_medio_com_saldo', round(e.ultimo_custo_medio_com_saldo, 6),
      'valor_estoque', round(e.estoque * e.custo_medio, 2),
      'minimo', round(coalesce(i.estoque_min, 0), 4),
      'maximo', round(coalesce(i.estoque_max, 0), 4),
      'abaixo_do_minimo', coalesce(i.estoque_min,0) > 0 and e.estoque < coalesce(i.estoque_min,0),
      'estoque_negativo', e.estoque < 0,
      'data_ultima_movimentacao', mv.ult, 'data_ultima_entrada', mv.ult_ent,
      'data_ultima_saida', mv.ult_sai, 'data_ultima_contagem', mv.ult_cont,
      'controla_lote', coalesce(i.controla_lote, false), 'controla_validade', coalesce(i.controla_validade, false),
      'lotes', coalesce(lt.lotes, '[]'::jsonb),
      'updated_at', coalesce(e.alterado_em, e.atualizado_em)
    ) order by e.sucursal_id, coalesce(i.nome, f.nome, e.item_ref)), '[]'::jsonb)
    from estoque_unidade e
    left join insumos i on i.ref_local = e.item_ref and i.loja_id = e.loja_id
    left join fichas_tecnicas f on f.ref_local = e.item_ref and f.loja_id = e.loja_id
    left join mv on mv.suc = e.sucursal_id and mv.item = e.item_ref
    left join lt on lt.suc = e.sucursal_id and lt.item_ref = e.item_ref
   where e.loja_id = p_loja and e.sucursal_id = any(p_sucs);
$$;

-- ---------- inventários: uma linha por item contado ----------
create or replace function public.rds_x_inventarios(p_loja uuid, p_sucs text[], p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'inventario_ref', c.ref_local, 'linha', l.o, 'sucursal_id', c.sucursal_id,
      'data', c.data, 'hora', c.hora, 'lancado_em', c.lancada_em, 'retroativo', coalesce(c.retroativa,false),
      'item_ref', l.r->>'insumoId', 'insumo_ref', l.r->>'insumoId', 'item', l.r->>'nome',
      'unidade', coalesce(nullif(l.r->>'unidade',''),'un'),
      'estoque_esperado', (l.r->>'sistema')::numeric, 'quantidade_contada', (l.r->>'conferido')::numeric,
      'diferenca', (l.r->>'diferenca')::numeric,
      'custo_aplicado', (l.r->>'custo')::numeric,
      'valor_diferenca', round(coalesce((l.r->>'diferenca')::numeric,0) * coalesce((l.r->>'custo')::numeric,0), 2),
      'ajuste_positivo', greatest(coalesce((l.r->>'diferenca')::numeric,0), 0),
      'ajuste_negativo', greatest(-coalesce((l.r->>'diferenca')::numeric,0), 0),
      'custo_corrigido_na_contagem', coalesce((l.r->>'custoCorrigido')::boolean, false),
      'movimento_ref', c.mov_ref,
      'responsavel', 'não_disponível', 'aprovacao', 'não_disponível',
      'updated_at', c.alterado_em
    ) order by c.data, c.hora, c.ref_local, l.o), '[]'::jsonb)
    from contagens_estoque c
    cross join lateral jsonb_array_elements(coalesce(c.itens,'[]'::jsonb)) with ordinality l(r, o)
   where c.loja_id = p_loja and c.sucursal_id = any(p_sucs) and c.data between p_de and p_ate;
$$;

-- ---------- compras: uma linha por nota de entrada ----------
create or replace function public.rds_x_compras(p_loja uuid, p_sucs text[], p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'compra_ref', n.ref_local, 'sucursal_id', n.sucursal_id,
      'fornecedor_ref', fo.ref_local, 'fornecedor', coalesce(n.fornecedor_nome, fo.empresa),
      'documento', n.numero, 'data_emissao', n.data, 'data_competencia', 'não_disponível',
      'data_entrada', (n.criado_em at time zone 'America/Sao_Paulo')::date,
      'recebida', n.recebida, 'valor_mercadorias', round(coalesce(n.valor_mercadorias,0),2),
      'valor_total', round(coalesce(n.valor_total,0),2),
      'frete_e_despesas', round(coalesce(n.valor_total,0) - coalesce(n.valor_mercadorias,0), 2),
      'itens', jsonb_array_length(coalesce(n.itens,'[]'::jsonb)),
      'condicao_pagamento', n.pagamento,
      'titulos_gerados', coalesce((select jsonb_agg(lf.ref_local order by lf.vencimento) from lancamentos_financeiros lf
                                    where lf.loja_id = p_loja and lf.origem = 'nota-entrada'
                                      and (lf.origem_ref = n.ref_local or lf.ref_local_origem = n.ref_local)), '[]'::jsonb),
      'excluida', n.excluida_em is not null, 'excluida_em', n.excluida_em, 'motivo_exclusao', n.excluida_motivo,
      'updated_at', coalesce(n.alterado_em, n.criado_em)
    ) order by n.data, n.numero), '[]'::jsonb)
    from notas_entrada n left join fornecedores fo on fo.id = n.fornecedor_id
   where n.loja_id = p_loja and n.sucursal_id = any(p_sucs) and n.data between p_de and p_ate;
$$;

-- ---------- itens das compras ----------
create or replace function public.rds_x_itens_compra(p_loja uuid, p_sucs text[], p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path = public as $$
  with it as (
    select n.ref_local nota, n.numero, n.sucursal_id, n.data, n.criado_em, n.fornecedor_id, n.fornecedor_nome,
           n.excluida_em, l.o, l.r, l.r->>'insumoId' item
      from notas_entrada n cross join lateral jsonb_array_elements(coalesce(n.itens,'[]'::jsonb)) with ordinality l(r, o)
     where n.loja_id = p_loja and n.sucursal_id = any(p_sucs)
  ), h as (
    select it.*, lag(coalesce((r->>'valorUn')::numeric,0)) over (partition by sucursal_id, item order by data, criado_em, o) preco_anterior
      from it where excluida_em is null
  ), mv as (
    select m.sucursal_id suc, m.identificacao, l->>'insumoId' item,
           (l->>'custoMedioAntes')::numeric antes, (l->>'custoMedioDepois')::numeric depois
      from movimentacoes_estoque m cross join lateral jsonb_array_elements(coalesce(m.linhas,'[]'::jsonb)) l
     where m.loja_id = p_loja and m.origem = 'nota' and m.sucursal_id = any(p_sucs)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'item_compra_ref', h.nota || ':' || h.o, 'compra_ref', h.nota, 'sucursal_id', h.sucursal_id,
      'fornecedor_ref', fo.ref_local, 'fornecedor', coalesce(h.fornecedor_nome, fo.empresa),
      'documento', h.numero, 'data_emissao', h.data, 'data_competencia', 'não_disponível',
      'data_entrada', (h.criado_em at time zone 'America/Sao_Paulo')::date,
      'insumo_ref', h.item, 'item_ref', h.item, 'item', h.r->>'nome',
      'quantidade', coalesce((h.r->>'qtdCompra')::numeric, (h.r->>'qtd')::numeric),
      'unidade_compra', coalesce(nullif(h.r->>'unidadeCompra',''), h.r->>'unidade'),
      'fator_conversao', coalesce((h.r->>'fatorCompra')::numeric, 1),
      'quantidade_unidade_estoque', (h.r->>'qtd')::numeric, 'unidade_estoque', h.r->>'unidade',
      'custo_unitario', coalesce((h.r->>'valorUnCompra')::numeric, (h.r->>'valorUn')::numeric),
      'custo_unitario_estoque', (h.r->>'valorUn')::numeric,
      'desconto', coalesce((h.r->>'desconto')::numeric, 0),
      'frete', 'não_disponível', 'despesas_acessorias', 'não_disponível',
      'custo_de_entrada', round(coalesce((h.r->>'total')::numeric,0), 2),
      'custo_medio_anterior', mv.antes, 'custo_medio_posterior', mv.depois,
      'preco_da_compra_anterior', h.preco_anterior,
      'variacao_sobre_compra_anterior_pct', case when coalesce(h.preco_anterior,0) > 0
         then round(((h.r->>'valorUn')::numeric / h.preco_anterior - 1) * 100, 2) end,
      'lote', nullif(h.r->>'lote',''), 'validade', nullif(h.r->>'validade',''),
      'titulo_financeiro_gerado', 'ver /analitico/compras (titulos_gerados)'
    ) order by h.data, h.numero, h.o), '[]'::jsonb)
    from h
    left join fornecedores fo on fo.id = h.fornecedor_id
    left join lateral (select mv.antes, mv.depois from mv where mv.suc = h.sucursal_id and mv.item = h.item
                         and mv.identificacao = 'NF ' || h.numero limit 1) mv on true
   where h.data between p_de and p_ate;
$$;

-- ---------- fichas técnicas com componentes e custo ----------
create or replace function public.rds_x_fichas(p_loja uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with comp as (
    select fi.ficha_id, jsonb_agg(jsonb_build_object(
             'componente_ref', coalesce(i.ref_local, sf.ref_local),
             'componente', coalesce(i.nome, sf.nome),
             'tipo', case when i.id is not null then 'insumo' else 'subficha' end,
             'quantidade', fi.quantidade, 'unidade', coalesce(nullif(fi.unidade,''), i.unidade, sf.unidade),
             'unidade_do_cadastro', coalesce(i.unidade, sf.unidade),
             'fator_conversao', rds_fator(coalesce(i.unidade, sf.unidade), coalesce(nullif(fi.unidade,''), i.unidade, sf.unidade)),
             'perda_prevista_pct', coalesce(fi.perda, 0),
             'custo_unitario_cadastro', coalesce(nullif(i.custo,0), i.custo_unitario, sf.custo_medio, 0),
             'custo_total', round(fi.quantidade * coalesce(nullif(i.custo,0), i.custo_unitario, sf.custo_medio, 0)
                                  / nullif(rds_fator(coalesce(i.unidade, sf.unidade), coalesce(nullif(fi.unidade,''), i.unidade, sf.unidade)),0)
                                  * (1 + coalesce(fi.perda,0) / 100), 6)
           ) order by coalesce(i.nome, sf.nome)) itens,
           sum(fi.quantidade * coalesce(nullif(i.custo,0), i.custo_unitario, sf.custo_medio, 0)
               / nullif(rds_fator(coalesce(i.unidade, sf.unidade), coalesce(nullif(fi.unidade,''), i.unidade, sf.unidade)),0)
               * (1 + coalesce(fi.perda,0) / 100)) custo
      from ficha_itens fi
      left join insumos i on i.id = fi.insumo_id
      left join fichas_tecnicas sf on sf.id = fi.ficha_ref
     where fi.ficha_id in (select id from fichas_tecnicas where loja_id = p_loja)
     group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'ficha_ref', f.ref_local, 'codigo', f.codigo, 'ficha', f.nome,
      'produto_produzido', coalesce(f.destino_nome, f.nome), 'produto_ref', pr.ref_local, 'produto', pr.nome,
      'rendimento', f.rendimento, 'unidade_rendimento', coalesce(f.rend_unidade, f.unidade),
      'estocavel', f.estocavel, 'na_producao', f.na_producao, 'disponivel_venda', f.disponivel_venda,
      'componentes', coalesce(comp.itens, '[]'::jsonb),
      'custo_total_calculado', round(coalesce(comp.custo,0), 4),
      'custo_unitario_calculado', round(coalesce(comp.custo,0) / nullif(coalesce(f.rendimento,0),0), 6),
      'custo_medio_gravado', f.custo_medio,
      'versao', 'não_versionada', 'vigencia', 'não_disponível',
      'ficha_versionada', false,
      'calculo_historico_reprocessado_com_ficha_atual', true,
      'situacao', case when coalesce(f.disponivel_venda, true) then 'ativa' else 'fora de venda' end,
      'unidades_do_cadastro', f.sucursais,
      'updated_at', f.alterado_em
    ) order by f.nome), '[]'::jsonb)
    from fichas_tecnicas f
    left join comp on comp.ficha_id = f.id
    left join produtos pr on pr.ficha_id = f.id
   where f.loja_id = p_loja;
$$;

-- ---------- produções: ordens manuais e produção automática na venda ----------
create or replace function public.rds_x_producoes(p_loja uuid, p_sucs text[], p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path = public as $$
  with op as (
    select jsonb_build_object(
      'producao_ref', o.ref_local || ':' || l.o, 'ordem_ref', o.ref_local, 'tipo_producao', 'ordem manual',
      'sucursal_id', o.sucursal_id, 'numero', o.numero, 'data', o.data, 'hora', o.hora,
      'responsavel', o.responsavel, 'situacao', o.situacao,
      'ficha_ref', l.r->>'fichaId', 'produto_produzido', coalesce(l.r->>'destinoNome', l.r->>'nome'),
      'unidade', l.r->>'unidade',
      'quantidade_prevista', (l.r->>'previsto')::numeric, 'quantidade_produzida', (l.r->>'real')::numeric,
      'diferenca', (l.r->>'diferenca')::numeric,
      'consumos', coalesce((select jsonb_agg(jsonb_build_object('insumo_ref', c->>'insumoId', 'item', c->>'nome',
                            'quantidade', (c->>'qtd')::numeric, 'unidade', c->>'unidade', 'custo', (c->>'custo')::numeric,
                            'valor', round(coalesce((c->>'qtd')::numeric,0)*coalesce((c->>'custo')::numeric,0),4)))
                     from movimentacoes_estoque m, jsonb_array_elements(coalesce(m.linhas,'[]'::jsonb)) c
                    where m.loja_id = p_loja and m.ref_local = o.mov_id and c->>'fichaId' = l.r->>'fichaId'
                      and coalesce(c->>'direcao','saida') = 'saida'), '[]'::jsonb),
      'movimento_ref', o.mov_id,
      'updated_at', coalesce(o.alterado_em, o.criado_em)) j, o.data, o.hora
      from ordens_producao o
      cross join lateral jsonb_array_elements(coalesce(o.itens,'[]'::jsonb)) with ordinality l(r, o)
     where o.loja_id = p_loja and o.sucursal_id = any(p_sucs) and o.data between p_de and p_ate
  ), au as (
    select jsonb_build_object(
      'producao_ref', l.mov_ref || ':' || coalesce(l.ficha_ref,''), 'tipo_producao', 'automática na venda',
      'sucursal_id', l.sucursal_id, 'numero', l.numero, 'data', l.dia, 'venda_ref', l.pedido_ref,
      'ficha_ref', l.ficha_ref, 'produto_produzido', max(l.ficha_nome), 'produto_ref', max(l.produto_ref),
      'quantidade_produzida', max(l.produzido_qtd),
      'consumos', jsonb_agg(jsonb_build_object('insumo_ref', l.insumo_ref, 'item', l.item, 'quantidade', l.quantidade,
                            'unidade', l.unidade, 'custo', l.custo_unitario, 'valor', round(l.valor,4))),
      'custo_total', round(sum(l.valor), 4),
      'venda_cancelada', bool_or(l.pedido_cancelado),
      'movimento_ref', l.mov_ref) j, l.dia data, null::text hora
      from rds_linhas_venda(p_loja, p_sucs, p_de, p_ate) l
     where l.producao_auto
     group by l.mov_ref, l.ficha_ref, l.sucursal_id, l.numero, l.dia, l.pedido_ref
  )
  select coalesce(jsonb_agg(j order by data, hora nulls last), '[]'::jsonb)
    from (select * from op union all select * from au) x;
$$;

-- ---------- caixas ----------
create or replace function public.rds_x_caixas(p_loja uuid, p_sucs text[], p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path = public as $$
  with cx as (
    select c.* from caixas c
     where c.loja_id = p_loja and c.sucursal_id = any(p_sucs)
       and (c.aberto_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
  ), mv as (
    select m.caixa_id, sum(m.valor) filter (where m.tipo = 'sangria') sangrias,
           sum(m.valor) filter (where m.tipo = 'suprimento') suprimentos,
           jsonb_agg(jsonb_build_object('tipo', m.tipo, 'valor', m.valor, 'motivo', m.motivo, 'destino', m.destino_nome,
                     'responsavel', m.responsavel, 'hora', coalesce(m.data_hora, m.criado_em)) order by coalesce(m.data_hora, m.criado_em)) lista
      from caixa_movimentos m where m.caixa_id in (select id from cx) group by 1
  ), pd as (
    select p.caixa_id, count(*) filter (where p.fase <> 'cancelado') vendas_qtd,
           sum(p.total) filter (where p.fase <> 'cancelado') vendas_valor,
           count(*) filter (where p.fase = 'cancelado') canc_qtd,
           sum(p.total) filter (where p.fase = 'cancelado') canc_valor,
           count(*) filter (where p.fase <> 'cancelado' and not exists (select 1 from pedido_pagamentos g where g.pedido_id = p.id)) sem_pag,
           count(*) filter (where p.fase <> 'cancelado' and exists (select 1 from cupons_fiscais f where f.loja_id = p.loja_id
                                  and f.pedido_ref = p.ref_local and f.status = 'autorizado' and f.ambiente = 'producao')) com_cupom
      from pedidos p where p.caixa_id in (select id from cx) group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'caixa_ref', cx.ref_local, 'sucursal_id', cx.sucursal_id,
      'abertura', cx.aberto_em, 'fechamento', cx.fechado_em,
      'dia_comercial', (cx.aberto_em at time zone 'America/Sao_Paulo')::date,
      'operador', cx.operador, 'operador_ref', cx.operador_id, 'fechado_por', cx.fechado_por,
      'turno', cx.turno_nome, 'situacao', case when cx.fechado_em is null then 'aberto' else 'fechado' end,
      'saldo_inicial', cx.valor_inicial,
      'vendas', round(coalesce(pd.vendas_valor, cx.vendas, 0), 2), 'vendas_quantidade', coalesce(pd.vendas_qtd, cx.qtd_pedidos, 0),
      'recebimentos_por_forma_sistema', cx.esperado_por_forma, 'recebimentos_por_forma_informado', cx.conferencia,
      'sangrias', round(coalesce(mv.sangrias,0),2), 'suprimentos', round(coalesce(mv.suprimentos,0),2),
      'movimentos', coalesce(mv.lista, '[]'::jsonb),
      'cancelamentos_quantidade', coalesce(pd.canc_qtd,0), 'cancelamentos_valor', round(coalesce(pd.canc_valor,0),2),
      'saldo_esperado', cx.esperado, 'saldo_informado', coalesce(cx.contado, cx.total_informado),
      'total_informado_todas_as_formas', cx.total_informado,
      'diferenca', cx.diferenca_total, 'justificativa', cx.observacao, 'conciliado', cx.conciliado,
      'pendencias', to_jsonb(array_remove(array[
          case when cx.fechado_em is null and cx.aberto_em < now() - interval '1 day' then 'aberto há mais de um dia' end,
          case when coalesce(abs(cx.diferenca_total),0) >= 0.01 then 'fechado com diferença' end,
          case when coalesce(pd.sem_pag,0) > 0 then 'venda sem pagamento' end], null)),
      'situacao_fiscal', jsonb_build_object('vendas', coalesce(pd.vendas_qtd,0), 'com_cupom_autorizado', coalesce(pd.com_cupom,0)),
      'sincronizacao', jsonb_build_object('atualizado_na_nuvem_em', cx.alterado_em),
      'updated_at', cx.alterado_em
    ) order by cx.aberto_em), '[]'::jsonb)
    from cx left join mv on mv.caixa_id = cx.id left join pd on pd.caixa_id = cx.id;
$$;

-- ---------- ninguém de fora chama: só a função de borda (service_role) ----------
revoke all on function public.rds_linhas_venda(uuid, text[], date, date) from public, anon, authenticated;
grant execute on function public.rds_linhas_venda(uuid, text[], date, date) to service_role;
revoke all on function public.rds_x_vendas(uuid, text[], date, date) from public, anon, authenticated;
grant execute on function public.rds_x_vendas(uuid, text[], date, date) to service_role;
revoke all on function public.rds_x_itens_venda(uuid, text[], date, date) from public, anon, authenticated;
grant execute on function public.rds_x_itens_venda(uuid, text[], date, date) to service_role;
revoke all on function public.rds_x_pagamentos(uuid, text[], date, date) from public, anon, authenticated;
grant execute on function public.rds_x_pagamentos(uuid, text[], date, date) to service_role;
revoke all on function public.rds_x_movimentos(uuid, text[], date, date) from public, anon, authenticated;
grant execute on function public.rds_x_movimentos(uuid, text[], date, date) to service_role;
revoke all on function public.rds_x_estoque(uuid, text[]) from public, anon, authenticated;
grant execute on function public.rds_x_estoque(uuid, text[]) to service_role;
revoke all on function public.rds_x_inventarios(uuid, text[], date, date) from public, anon, authenticated;
grant execute on function public.rds_x_inventarios(uuid, text[], date, date) to service_role;
revoke all on function public.rds_x_compras(uuid, text[], date, date) from public, anon, authenticated;
grant execute on function public.rds_x_compras(uuid, text[], date, date) to service_role;
revoke all on function public.rds_x_itens_compra(uuid, text[], date, date) from public, anon, authenticated;
grant execute on function public.rds_x_itens_compra(uuid, text[], date, date) to service_role;
revoke all on function public.rds_x_fichas(uuid) from public, anon, authenticated;
grant execute on function public.rds_x_fichas(uuid) to service_role;
revoke all on function public.rds_x_producoes(uuid, text[], date, date) from public, anon, authenticated;
grant execute on function public.rds_x_producoes(uuid, text[], date, date) to service_role;
revoke all on function public.rds_x_caixas(uuid, text[], date, date) from public, anon, authenticated;
grant execute on function public.rds_x_caixas(uuid, text[], date, date) to service_role;

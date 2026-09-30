-- =====================================================================
-- JOIA — API ANALÍTICA RDS v3 · PARTE 3: FINANCEIRO, CADASTROS E
-- ANÁLISES (DRE, fluxo de caixa, CPV e perdas, CRM, comparativo)
-- Somente leitura. Linha LANÇADA = soma de lançamentos do Joia (com a
-- lista deles); linha CALCULADA = fórmula da API (com a fórmula escrita).
-- =====================================================================

-- ---------- títulos: contas a pagar e a receber ----------
create or replace function public.rds_x_titulos(p_loja uuid, p_sucs text[], p_de date, p_ate date, p_campo text)
returns jsonb language sql stable security definer set search_path = public as $$
  with t as (
    select lf.*, sc.nome sub_nome, sc.ref_local sub_ref, cf.nome cat_nome, cf.tipo cat_tipo, cf.ref_local cat_ref,
           ct.nome conta_nome, ct.ref_local conta_ref, ct.tipo conta_tipo, cd.nome conta_destino_nome,
           fp.nome forma_nome, fo.ref_local forn_ref, coalesce(lf.fornecedor_nome, fo.empresa) forn_nome,
           (now() at time zone 'America/Sao_Paulo')::date hoje
      from lancamentos_financeiros lf
      left join subcategorias_financeiras sc on sc.id = lf.subcategoria_id
      left join categorias_financeiras cf on cf.id = sc.categoria_id
      left join contas_capital ct on ct.id = lf.conta_id
      left join contas_capital cd on cd.id = lf.conta_destino_id
      left join formas_pagamento fp on fp.id = lf.forma_id
      left join fornecedores fo on fo.id = lf.fornecedor_id
     where lf.loja_id = p_loja
       and (lf.sucursal_id = any(p_sucs) or lf.sucursal_id is null)
       and (case p_campo when 'emissao' then lf.emissao when 'competencia' then lf.emissao
                         when 'pagamento' then lf.pagamento else lf.vencimento end) between p_de and p_ate
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'titulo_ref', t.ref_local, 'sucursal_id', t.sucursal_id,
      'natureza', case t.tipo when 'despesa' then 'pagar' when 'receita' then 'receber' else t.tipo end,
      'tipo', t.tipo,
      'fornecedor_ref', t.forn_ref, 'fornecedor_ou_cliente', t.forn_nome,
      'descricao', t.descricao, 'documento', t.documento,
      'data_emissao', t.emissao, 'data_competencia', t.emissao,
      'competencia_origem', 'o Joia não tem campo de competência: vale a data de emissão',
      'data_vencimento', t.vencimento, 'data_pagamento_ou_recebimento', t.pagamento,
      'valor_original', round(coalesce(t.valor_original, t.valor, 0), 2),
      'juros', round(coalesce(t.juros,0), 2), 'multa', round(coalesce(t.multa,0), 2),
      'desconto', 'não_disponível',
      'valor_movimentado', case when t.pago then round(coalesce(t.valor,0), 2) else 0 end,
      'valor', round(coalesce(t.valor,0), 2),
      'saldo', case when t.pago or coalesce(t.cancelado,false) then 0 else round(coalesce(t.valor,0), 2) end,
      'situacao', case when coalesce(t.cancelado,false) then 'cancelado'
                       when t.pago then case when t.tipo = 'receita' then 'recebido' else 'pago' end
                       when t.vencimento < t.hoje then 'vencido' else 'em aberto' end,
      'plano_de_contas', coalesce(t.cat_nome || ' › ' || t.sub_nome, t.categoria_texto),
      'categoria', t.cat_nome, 'categoria_ref', t.cat_ref, 'subcategoria', t.sub_nome, 'subcategoria_ref', t.sub_ref,
      'categoria_do_sistema', t.categoria_texto,
      'classificacao_gerencial', rds_linha_dre(t.cat_nome, t.cat_tipo, t.sub_nome, t.categoria_texto, t.tipo),
      'conta_financeira', t.conta_nome, 'conta_financeira_ref', t.conta_ref, 'conta_financeira_tipo', t.conta_tipo,
      'conta_destino', t.conta_destino_nome,
      'forma_pagamento', t.forma_nome,
      'titulo_de_origem_ref', t.ref_local_origem, 'origem', coalesce(t.origem, 'manual'), 'origem_ref', t.origem_ref,
      'conciliado', coalesce(t.conciliado,false), 'data_conciliacao', t.data_conciliacao,
      'responsavel', 'não_disponível',
      'inconsistencias', to_jsonb(array_remove(array[
          case when t.pago and not coalesce(t.cancelado,false) and t.subcategoria_id is null
                    and coalesce(t.categoria_texto,'') = '' and t.tipo in ('despesa','receita')
               then 'movimentado sem plano de contas' end,
          case when t.pago and not coalesce(t.cancelado,false) and t.conta_id is null
               then 'movimentado sem conta financeira' end], null)),
      'updated_at', coalesce(t.alterado_em, t.criado_em)
    ) order by t.vencimento, t.ref_local), '[]'::jsonb)
    from t;
$$;

-- ---------- extrato financeiro: o que entrou e saiu de cada conta ----------
create or replace function public.rds_x_extrato(p_loja uuid, p_sucs text[], p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path = public as $$
  with mov as (
    -- cada lançamento pago é uma perna; a transferência entre contas tem duas
    select lf.ref_local, lf.sucursal_id, lf.pagamento dia, lf.conta_id conta, lf.descricao, lf.tipo,
           case when lf.tipo = 'receita' then lf.valor when lf.tipo = 'despesa' then -lf.valor
                when lf.tipo = 'transferencia' then -lf.valor else 0 end valor,
           lf.subcategoria_id, lf.categoria_texto, lf.criado_em, lf.alterado_em
      from lancamentos_financeiros lf
     where lf.loja_id = p_loja and lf.pago and not coalesce(lf.cancelado,false)
       and (lf.sucursal_id = any(p_sucs) or lf.sucursal_id is null)
    union all
    select lf.ref_local || ':destino', lf.sucursal_id, lf.pagamento, lf.conta_destino_id, lf.descricao, lf.tipo,
           lf.valor, lf.subcategoria_id, lf.categoria_texto, lf.criado_em, lf.alterado_em
      from lancamentos_financeiros lf
     where lf.loja_id = p_loja and lf.pago and not coalesce(lf.cancelado,false) and lf.tipo = 'transferencia'
       and lf.conta_destino_id is not null
       and (lf.sucursal_id = any(p_sucs) or lf.sucursal_id is null)
  ), s as (
    select mov.*, ct.nome conta_nome, ct.ref_local conta_ref, coalesce(ct.saldo_inicial,0) saldo_ini,
           sum(mov.valor) over (partition by mov.conta order by mov.dia, mov.criado_em, mov.ref_local) acumulado
      from mov left join contas_capital ct on ct.id = mov.conta
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'movimento_ref', s.ref_local, 'titulo_ref', split_part(s.ref_local, ':', 1), 'sucursal_id', s.sucursal_id,
      'data', s.dia, 'conta_financeira', coalesce(s.conta_nome, 'sem conta financeira'), 'conta_financeira_ref', s.conta_ref,
      'descricao', s.descricao,
      'tipo_movimento', case when s.tipo = 'transferencia' then 'transferência entre contas'
                             when s.valor >= 0 then 'entrada' else 'saída' end,
      'entrada', greatest(s.valor, 0), 'saida', greatest(-s.valor, 0), 'valor', round(s.valor, 2),
      'saldo_apos', case when s.conta is null then null else round(s.saldo_ini + s.acumulado, 2) end,
      'saldo_apos_escopo', 'soma do saldo inicial da conta com os lançamentos das unidades do filtro',
      'updated_at', coalesce(s.alterado_em, s.criado_em)
    ) order by s.dia, s.criado_em, s.ref_local), '[]'::jsonb)
    from s where s.dia between p_de and p_ate;
$$;

-- ---------- cadastros ----------
create or replace function public.rds_c_produtos(p_loja uuid, p_sucs text[])
returns jsonb language sql stable security definer set search_path = public as $$
  with vis as (select p_sucs s),
  ult_venda as (
    select i.produto_id, max((p.data_venda at time zone 'America/Sao_Paulo')::date) d
      from pedido_itens i join pedidos p on p.id = i.pedido_id join sucursais s on s.id = p.sucursal_id
     where p.loja_id = p_loja and s.ref_local = any(p_sucs) and p.fase <> 'cancelado' group by 1
  ), ult_compra as (
    select l->>'insumoId' item, max(n.data) d,
           (array_agg((l->>'valorUn')::numeric order by n.data desc, n.criado_em desc))[1] preco
      from notas_entrada n join rds_notas_unidade(p_loja) nu on nu.nota_id = n.id
      cross join lateral jsonb_array_elements(coalesce(n.itens,'[]'::jsonb)) l
     where n.loja_id = p_loja and nu.sucursal_id = any(p_sucs) and n.excluida_em is null group by 1
  ), ult_mov as (
    select l->>'insumoId' item, max(m.data) d
      from movimentacoes_estoque m cross join lateral jsonb_array_elements(coalesce(m.linhas,'[]'::jsonb)) l
     where m.loja_id = p_loja and m.sucursal_id = any(p_sucs) group by 1
  ), est as (
    select item_ref, round(sum(estoque * custo_medio) / nullif(sum(estoque),0), 6) cm,
           max(ultimo_custo_medio_com_saldo) ucm
      from estoque_unidade where loja_id = p_loja and sucursal_id = any(p_sucs) group by 1
  ), linhas as (
    select jsonb_build_object(
      'produto_ref', pr.ref_local, 'codigo', pr.codigo, 'descricao', pr.nome, 'descricao_comercial', coalesce(pr.nome_online, pr.nome),
      'tipo', case when pr.ficha_id is not null then 'produto (com ficha técnica)' else 'produto' end,
      'grupo', c.nome, 'grupo_ref', c.ref_local, 'subgrupo', 'não_disponível', 'categoria', c.nome, 'marca', 'não_disponível',
      'unidade_medida', case when pr.pesado then 'kg' else 'un' end,
      'controla_estoque', coalesce(pr.vincula_estoque,false), 'producao_automatica', pr.ficha_id is not null,
      'controla_lote', false, 'controla_validade', false, 'ativo', coalesce(pr.ativo,true),
      'preco', pr.preco, 'custo_medio', 'ver ficha técnica (/analitico/fichas)',
      'ultimo_custo_medio_com_saldo', 'não_disponível', 'custo_ultima_entrada', 'não_disponível',
      'preco_ultima_compra', 'não_disponível', 'data_ultima_compra', 'não_disponível',
      'data_ultima_venda', uv.d, 'data_ultima_movimentacao', uv.d,
      'ficha_ref', f.ref_local, 'ficha', f.nome, 'insumo_vinculado_ref', ins.ref_local,
      'unidades_do_cadastro', pr.sucursais, 'updated_at', coalesce(pr.alterado_em, pr.atualizado_em)) j, pr.nome n
      from produtos pr
      left join categorias c on c.id = pr.categoria_id
      left join fichas_tecnicas f on f.id = pr.ficha_id
      left join insumos ins on ins.id = pr.insumo_id
      left join ult_venda uv on uv.produto_id = pr.id
     where pr.loja_id = p_loja
    union all
    select jsonb_build_object(
      'produto_ref', i.ref_local, 'insumo_ref', i.ref_local, 'codigo', i.codigo, 'descricao', i.nome,
      'descricao_comercial', coalesce(i.descricao, i.nome), 'tipo', 'insumo',
      'grupo', 'não_disponível', 'subgrupo', 'não_disponível', 'categoria', 'não_disponível', 'marca', 'não_disponível',
      'unidade_medida', i.unidade, 'fator', i.fator,
      'controla_estoque', coalesce(i.controla_estoque,true), 'compoe_cmv', coalesce(i.compoe_cmv,true),
      'producao_automatica', false,
      'controla_lote', coalesce(i.controla_lote,false), 'controla_validade', coalesce(i.controla_validade,false),
      'ativo', 'não_disponível', 'preco', null,
      'custo_medio', coalesce(est.cm, nullif(i.custo,0), i.custo_unitario),
      'ultimo_custo_medio_com_saldo', est.ucm,
      'custo_ultima_entrada', nullif(i.custo_ultima, 0), 'preco_ultima_compra', uc.preco, 'data_ultima_compra', uc.d,
      'data_ultima_venda', 'não se aplica (insumo)', 'data_ultima_movimentacao', um.d,
      'ficha_ref', null, 'unidades_do_cadastro', i.sucursais, 'updated_at', coalesce(i.alterado_em, i.atualizado_em)), i.nome
      from insumos i
      left join est on est.item_ref = i.ref_local
      left join ult_compra uc on uc.item = i.ref_local
      left join ult_mov um on um.item = i.ref_local
     where i.loja_id = p_loja
    union all
    select jsonb_build_object(
      'produto_ref', f.ref_local, 'ficha_ref', f.ref_local, 'codigo', f.codigo, 'descricao', f.nome,
      'descricao_comercial', coalesce(f.destino_nome, f.nome), 'tipo', 'produto produzido',
      'grupo', 'não_disponível', 'subgrupo', 'não_disponível', 'categoria', 'não_disponível', 'marca', 'não_disponível',
      'unidade_medida', coalesce(f.rend_unidade, f.unidade), 'controla_estoque', coalesce(f.estocavel,false),
      'producao_automatica', 'ver /analitico/producoes', 'controla_lote', false, 'controla_validade', false,
      'ativo', coalesce(f.disponivel_venda, true), 'preco', f.preco,
      'custo_medio', coalesce(est.cm, f.custo_medio), 'ultimo_custo_medio_com_saldo', est.ucm,
      'custo_ultima_entrada', 'não se aplica (produzido)', 'preco_ultima_compra', 'não se aplica (produzido)',
      'data_ultima_compra', null, 'data_ultima_venda', null, 'data_ultima_movimentacao', um.d,
      'unidades_do_cadastro', f.sucursais, 'updated_at', f.alterado_em), f.nome
      from fichas_tecnicas f
      left join est on est.item_ref = f.ref_local
      left join ult_mov um on um.item = f.ref_local
     where f.loja_id = p_loja
  )
  select coalesce(jsonb_agg(j order by j->>'tipo', n), '[]'::jsonb) from linhas;
$$;

create or replace function public.rds_c_plano(p_loja uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(j order by o1, o2 nulls first, n), '[]'::jsonb) from (
    select jsonb_build_object(
      'codigo', c.ref_local, 'plano_ref', c.ref_local, 'descricao', c.nome, 'nivel', 1, 'conta_pai', null,
      'natureza', c.tipo, 'entrada_ou_saida', case when c.tipo = 'receita' then 'entrada' else 'saída' end,
      'analitica', false, 'sintetica', true,
      'classificacao_gerencial', 'ver subcategorias',
      'compoe_dre', 'depende da subcategoria', 'compoe_fluxo_de_caixa', true, 'compoe_balanco_gerencial', 'não_disponível',
      'ativa', 'não_disponível', 'vigencia', 'não_disponível',
      'unidades_do_cadastro', c.sucursais, 'updated_at', c.alterado_em) j, c.ordem o1, null::int o2, c.nome n
      from categorias_financeiras c where c.loja_id = p_loja
    union all
    select jsonb_build_object(
      'codigo', s.ref_local, 'plano_ref', s.ref_local, 'descricao', s.nome, 'nivel', 2,
      'conta_pai', c.ref_local, 'conta_pai_descricao', c.nome,
      'natureza', c.tipo, 'entrada_ou_saida', case when c.tipo = 'receita' then 'entrada' else 'saída' end,
      'analitica', true, 'sintetica', false,
      'classificacao_gerencial', rds_linha_dre(c.nome, c.tipo, s.nome, null, c.tipo),
      'classificacao_origem', 'regra da API v3 (regra_versao) — não gravada no Joia',
      'compoe_dre', not (rds_linha_dre(c.nome, c.tipo, s.nome, null, c.tipo) like 'fora_%'
                         or rds_linha_dre(c.nome, c.tipo, s.nome, null, c.tipo) = 'taxas_cartao_lancadas'),
      'compoe_fluxo_de_caixa', true, 'compoe_balanco_gerencial', 'não_disponível',
      'ativa', 'não_disponível', 'vigencia', 'não_disponível', 'updated_at', s.alterado_em), c.ordem, s.ordem, s.nome
      from subcategorias_financeiras s join categorias_financeiras c on c.id = s.categoria_id
     where c.loja_id = p_loja
  ) x;
$$;

-- saldo da conta financeira: saldo inicial + tudo o que foi pago nela
create or replace function public.rds_c_contas(p_loja uuid, p_sucs text[])
returns jsonb language sql stable security definer set search_path = public as $$
  with mv as (
    select conta_id conta, sum(case when tipo = 'receita' then valor when tipo in ('despesa','transferencia') then -valor else 0 end) v,
           max(pagamento) ult
      from lancamentos_financeiros
     where loja_id = p_loja and pago and not coalesce(cancelado,false) and conta_id is not null
       and (sucursal_id = any(p_sucs) or sucursal_id is null) group by 1
    union all
    select conta_destino_id, sum(valor), max(pagamento)
      from lancamentos_financeiros
     where loja_id = p_loja and pago and not coalesce(cancelado,false) and tipo = 'transferencia' and conta_destino_id is not null
       and (sucursal_id = any(p_sucs) or sucursal_id is null) group by 1
  ), t as (select conta, sum(v) v, max(ult) ult from mv group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
      'conta_financeira_ref', c.ref_local, 'conta', c.nome, 'tipo', c.tipo, 'banco', c.banco,
      'agencia_mascarada', case when coalesce(c.agencia,'') = '' then null else '•••' || right(c.agencia, 2) end,
      'conta_mascarada', case when coalesce(c.numero,'') = '' then null else '•••' || right(c.numero, 3) end,
      'unidades_do_cadastro', c.sucursais, 'conta_fixa_do_sistema', c.fixa,
      'ativa', 'não_disponível',
      'saldo_inicial', round(coalesce(c.saldo_inicial,0), 2), 'data_saldo_inicial', 'não_disponível',
      'movimentado', round(coalesce(t.v,0), 2),
      'saldo_atual', round(coalesce(c.saldo_inicial,0) + coalesce(t.v,0), 2),
      'data_do_saldo', (now() at time zone 'America/Sao_Paulo')::date, 'ultima_movimentacao', t.ult,
      'permite_pagamento', 'não_disponível', 'permite_recebimento', 'não_disponível',
      'observacao', 'conta financeira = ONDE o dinheiro está; não confundir com o plano de contas (a natureza)',
      'updated_at', c.alterado_em
    ) order by c.nome), '[]'::jsonb)
    from contas_capital c left join t on t.conta = c.id
   where c.loja_id = p_loja;
$$;

create or replace function public.rds_c_formas(p_loja uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'forma_pagamento_ref', f.ref_local, 'forma_pagamento', f.nome, 'tipo', f.tipo, 'bandeira', f.bandeira,
      'taxa_pct', f.taxa_pct, 'taxa_fixa', f.taxa_fixa, 'dias_recebimento', f.dias_recebimento,
      'conta_financeira', c.nome, 'conta_financeira_ref', c.ref_local,
      'ativa', f.ativa, 'online', f.online, 'unidades_do_cadastro', f.sucursais, 'updated_at', f.alterado_em
    ) order by f.ordem, f.nome), '[]'::jsonb)
    from formas_pagamento f left join contas_capital c on c.id = f.conta_id
   where f.loja_id = p_loja;
$$;

create or replace function public.rds_c_fornecedores(p_loja uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'fornecedor_ref', f.ref_local, 'fornecedor', f.empresa, 'cnpj', f.cnpj, 'contato', f.contato,
      'telefone', f.telefone, 'email', case when coalesce(f.email,'') = '' then null
                                            else left(f.email,2) || '•••@' || split_part(f.email,'@',2) end,
      'compras', (select count(*) from notas_entrada n where n.fornecedor_id = f.id and n.excluida_em is null),
      'ultima_compra', (select max(n.data) from notas_entrada n where n.fornecedor_id = f.id and n.excluida_em is null),
      'unidades_do_cadastro', f.sucursais, 'updated_at', coalesce(f.alterado_em, f.criado_em)
    ) order by f.empresa), '[]'::jsonb)
    from fornecedores f where f.loja_id = p_loja;
$$;

create or replace function public.rds_c_motivos(p_loja uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'motivo_ref', m.ref_local, 'motivo', m.nome, 'direcao', m.tipo, 'do_sistema', m.sistema, 'ativo', m.ativo,
      'classificacao_gerencial', rds_classe_motivo(m.nome, m.tipo, null, null),
      'classificacao_origem', 'derivada por regra da API (o cadastro de motivo não tem classe — ver /pendencias/motivos-sem-classe)',
      'usos', (select count(*) from movimentacoes_estoque x where x.motivo_id = m.id),
      'ultimo_uso', (select max(x.data) from movimentacoes_estoque x where x.motivo_id = m.id),
      'unidades_do_cadastro', m.sucursais, 'updated_at', m.alterado_em
    ) order by m.nome), '[]'::jsonb)
    from motivos_movimentacao m where m.loja_id = p_loja;
$$;

create or replace function public.rds_c_pessoas(p_loja uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'pessoa_ref', u.ref_local, 'nome', u.nome, 'login', u.login, 'ativo', u.ativo and u.excluido_em is null,
      'cargo', coalesce(pf.cargo, case when u.tudo or u.mestre then 'acesso total' else 'por permissão' end),
      'unidades', u.sucursais, 'tipo_de_conta', case when jsonb_array_length(coalesce(u.sucursais,'[]'::jsonb)) = 1
                    and u.nome ilike 'jol%' then 'conta da unidade (não identifica a pessoa)' else 'pessoa' end,
      'jornada', 'não_disponível', 'equipe', 'não_disponível',
      'updated_at', u.alterado_em
    ) order by u.nome), '[]'::jsonb)
    from usuarios_sistema u
    left join lateral (select p.cargo from perfis p where p.loja_id = p_loja and p.nome = u.nome limit 1) pf on true
   where u.loja_id = p_loja;
$$;

-- ---------- CPV e perdas por unidade (e por item, grupo e motivo) ----------
-- CPV_teorico            = consumo das vendas CONCRETIZADAS (linhas "Pedido #N")
-- baixas                 = perdas conscientes: motivo classificado perda/descarte
--                          + consumo de venda cancelada já produzida
-- ajustes_negativos      = diferença a menor apurada em inventário
-- perdas_totais          = baixas + ajustes_negativos
-- consumo_fisico_total   = CPV_teorico + perdas_totais
-- indice_perdas          = perdas_totais ÷ CPV_teorico
-- perdas_sobre_faturamento = perdas_totais ÷ receita_liquida
-- Compra de insumo NÃO é CPV e não entra aqui.
create or replace function public.rds_cpv_linhas(p_loja uuid, p_sucs text[], p_de date, p_ate date)
returns table(sucursal_id text, tipo text, item_ref text, item text, grupo text, motivo text, classe text,
              quantidade numeric, valor numeric, documento text, dia date)
language sql stable security definer set search_path = public as $$
  select l.sucursal_id,
         case when not l.pedido_cancelado then 'cpv_teorico'
              when l.pedido_cancelado and not l.tem_estorno then 'baixa'
              else 'neutro' end,
         l.insumo_ref, l.item, coalesce(l.ficha_nome, 'sem ficha'),
         case when l.pedido_cancelado and not l.tem_estorno then 'venda cancelada já produzida' else 'venda' end,
         case when l.pedido_cancelado and not l.tem_estorno then 'perda' else 'venda' end,
         l.quantidade, l.valor, 'Pedido #' || l.numero, l.dia
    from rds_linhas_venda(p_loja, p_sucs, p_de, p_ate) l
  union all
  select m.sucursal_id,
         case when m.origem = 'contagem' and coalesce(l->>'direcao','saida') = 'saida' then 'ajuste_negativo'
              when m.origem = 'contagem' then 'ajuste_positivo'
              when rds_classe_motivo(mo.nome, mo.tipo, m.origem, l->>'direcao') in ('perda','descarte')
                   and coalesce(l->>'direcao','saida') = 'saida' then 'baixa'
              when rds_classe_motivo(mo.nome, mo.tipo, m.origem, l->>'direcao') in ('consumo','bonificação')
                   and coalesce(l->>'direcao','saida') = 'saida' then 'consumo_interno'
              else 'outro' end,
         l->>'insumoId', l->>'nome', coalesce(l->>'fichaNome', 'insumo'), mo.nome,
         rds_classe_motivo(mo.nome, mo.tipo, m.origem, l->>'direcao'),
         coalesce((l->>'qtd')::numeric,0), coalesce((l->>'qtd')::numeric,0) * coalesce((l->>'custo')::numeric,0),
         m.identificacao, m.data
    from movimentacoes_estoque m
    cross join lateral jsonb_array_elements(coalesce(m.linhas,'[]'::jsonb)) l
    left join motivos_movimentacao mo on mo.id = m.motivo_id
   where m.loja_id = p_loja and m.sucursal_id = any(p_sucs) and m.data between p_de and p_ate
     and m.origem in ('manual','contagem','fidelidade');
$$;

create or replace function public.rds_a_cpv_perdas(p_loja uuid, p_sucs text[], p_de date, p_ate date, p_detalhe text)
returns jsonb language sql stable security definer set search_path = public as $$
  with l as (select * from rds_cpv_linhas(p_loja, p_sucs, p_de, p_ate)),
  rec as (
    select s.ref_local suc, sum(p.total) filter (where p.fase <> 'cancelado') receita
      from pedidos p join sucursais s on s.id = p.sucursal_id
     where p.loja_id = p_loja and s.ref_local = any(p_sucs)
       and (p.data_venda at time zone 'America/Sao_Paulo')::date between p_de and p_ate group by 1
  ), u as (select unnest(p_sucs) suc),
  tot as (
    select u.suc,
      coalesce(sum(l.valor) filter (where l.tipo = 'cpv_teorico'),0) cpv,
      coalesce(sum(l.valor) filter (where l.tipo = 'baixa'),0) baixas,
      coalesce(sum(l.valor) filter (where l.tipo = 'ajuste_negativo'),0) ajn,
      coalesce(sum(l.valor) filter (where l.tipo = 'ajuste_positivo'),0) ajp,
      coalesce(sum(l.valor) filter (where l.tipo = 'consumo_interno'),0) cons
      from u left join l on l.sucursal_id = u.suc group by 1
  )
  select jsonb_build_object(
    'regras', jsonb_build_object(
      'cpv_teorico', 'consumo das vendas concretizadas, pela ficha técnica, ao custo médio da hora da venda',
      'baixas', 'saídas com motivo classificado perda/descarte + consumo de venda cancelada já produzida',
      'ajustes', 'diferenças apuradas em inventário (contagem)',
      'perdas_totais', 'baixas + ajustes_negativos',
      'consumo_fisico_total', 'cpv_teorico + perdas_totais',
      'indice_perdas', 'perdas_totais ÷ cpv_teorico',
      'perdas_sobre_faturamento', 'perdas_totais ÷ receita_liquida',
      'fora_da_conta', 'compras de insumo (não são CPV), consumo interno e bonificação (informados à parte), ajustes positivos (informados à parte, não abatem perdas)'),
    'por_unidade', coalesce((select jsonb_agg(jsonb_build_object(
        'sucursal_id', t.suc,
        'receita_liquida', round(coalesce(r.receita,0),2),
        'cpv_teorico', round(t.cpv,2), 'baixas', round(t.baixas,2),
        'ajustes_negativos', round(t.ajn,2), 'ajustes_positivos', round(t.ajp,2),
        'perdas_totais', round(t.baixas + t.ajn,2),
        'consumo_fisico_total', round(t.cpv + t.baixas + t.ajn,2),
        'consumo_interno_e_bonificacao', round(t.cons,2),
        'indice_perdas', case when t.cpv > 0 then round((t.baixas + t.ajn) / t.cpv, 4) end,
        'perdas_sobre_faturamento', case when coalesce(r.receita,0) > 0 then round((t.baixas + t.ajn) / r.receita, 4) end,
        'cpv_sobre_faturamento', case when coalesce(r.receita,0) > 0 then round(t.cpv / r.receita, 4) end
      ) order by t.suc) from tot t left join rec r on r.suc = t.suc), '[]'::jsonb),
    'detalhe', case p_detalhe
      when 'item' then (select coalesce(jsonb_agg(x order by (x->>'valor')::numeric desc), '[]'::jsonb) from (
          select jsonb_build_object('sucursal_id', sucursal_id, 'item_ref', item_ref, 'item', item, 'tipo', tipo,
                   'quantidade', round(sum(quantidade),4), 'valor', round(sum(valor),2)) x
            from l where tipo <> 'neutro' group by sucursal_id, item_ref, item, tipo) z)
      when 'grupo' then (select coalesce(jsonb_agg(x order by (x->>'valor')::numeric desc), '[]'::jsonb) from (
          select jsonb_build_object('sucursal_id', sucursal_id, 'grupo', grupo, 'tipo', tipo,
                   'valor', round(sum(valor),2)) x
            from l where tipo <> 'neutro' group by sucursal_id, grupo, tipo) z)
      when 'motivo' then (select coalesce(jsonb_agg(x order by (x->>'valor')::numeric desc), '[]'::jsonb) from (
          select jsonb_build_object('sucursal_id', sucursal_id, 'motivo', motivo, 'classificacao_motivo', classe, 'tipo', tipo,
                   'quantidade_movimentos', count(*), 'valor', round(sum(valor),2)) x
            from l where tipo <> 'neutro' group by sucursal_id, motivo, classe, tipo) z)
      when 'dia' then (select coalesce(jsonb_agg(x order by x->>'dia'), '[]'::jsonb) from (
          select jsonb_build_object('sucursal_id', sucursal_id, 'dia', dia, 'tipo', tipo, 'valor', round(sum(valor),2)) x
            from l where tipo <> 'neutro' group by sucursal_id, dia, tipo) z)
      else null end);
$$;

-- ---------- DRE gerencial por unidade (e consolidado da rede) ----------
create or replace function public.rds_a_dre(p_loja uuid, p_sucs text[], p_de date, p_ate date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_res jsonb := '[]'::jsonb; v_suc text; v_grupos text[]; v_one jsonb;
  v_linhas_rede text[] := array['impostos','royalties','fundo_marketing','despesas_variaveis','despesas_pessoal',
     'despesas_ocupacao','despesas_administrativas','outras_despesas','outras_receitas_operacionais',
     'receitas_financeiras','despesas_financeiras','sem_plano_de_contas','intra_rede_venda_de_base','taxas_cartao_lancadas'];
begin
  -- cada unidade, e a rede (quando há mais de uma unidade no escopo)
  v_grupos := p_sucs;
  if array_length(p_sucs, 1) > 1 then v_grupos := v_grupos || array['__rede__']; end if;
  foreach v_suc in array v_grupos loop
    with esc as (select case when v_suc = '__rede__' then p_sucs else array[v_suc] end s),
    vd as (
      select coalesce(sum(p.total + coalesce(p.desconto,0) + coalesce(p.cupom_valor,0)),0) bruto,
             coalesce(sum(coalesce(p.desconto,0) + coalesce(p.cupom_valor,0)),0) descontos,
             coalesce(sum(p.total) filter (where p.fase = 'cancelado'),0) cancelados,
             coalesce(sum(p.total) filter (where p.fase <> 'cancelado'),0) liquida,
             jsonb_agg(p.ref_local) filter (where p.fase = 'cancelado') refs_canc
        from pedidos p join sucursais s on s.id = p.sucursal_id, esc
       where p.loja_id = p_loja and s.ref_local = any(esc.s)
         and (p.data_venda at time zone 'America/Sao_Paulo')::date between p_de and p_ate
    ), tx as (
      select coalesce(sum(coalesce(g.valor,0) * coalesce(f.taxa_pct,0) / 100 + coalesce(f.taxa_fixa,0)),0) taxa
        from pedido_pagamentos g join pedidos p on p.id = g.pedido_id join sucursais s on s.id = p.sucursal_id
        left join formas_pagamento f on f.id = g.forma_id, esc
       where p.loja_id = p_loja and s.ref_local = any(esc.s) and p.fase <> 'cancelado'
         and coalesce(g.situacao,'recebido') <> 'estornado'
         and (p.data_venda at time zone 'America/Sao_Paulo')::date between p_de and p_ate
    ), cp as (
      select coalesce(sum(valor) filter (where tipo = 'cpv_teorico'),0) cpv,
             coalesce(sum(valor) filter (where tipo in ('baixa','ajuste_negativo')),0) perdas
        from esc, rds_cpv_linhas(p_loja, esc.s, p_de, p_ate)
    ), lc as (
      select rds_linha_dre(cf.nome, cf.tipo, sc.nome, lf.categoria_texto, lf.tipo) linha,
             sum(lf.valor) v, jsonb_agg(lf.ref_local order by lf.emissao) refs
        from lancamentos_financeiros lf
        left join subcategorias_financeiras sc on sc.id = lf.subcategoria_id
        left join categorias_financeiras cf on cf.id = sc.categoria_id, esc
       where lf.loja_id = p_loja and not coalesce(lf.cancelado,false)
         and (lf.sucursal_id = any(esc.s) or (v_suc = '__rede__' and lf.sucursal_id is null))
         and lf.emissao between p_de and p_ate
       group by 1
    )
    select jsonb_build_object(
      'sucursal_id', case when v_suc = '__rede__' then null else v_suc end,
      'escopo', case when v_suc = '__rede__' then 'rede consolidada' else 'unidade' end,
      'unidades', to_jsonb(esc.s),
      'regime', 'competência (venda pelo dia comercial; lançamento pela data de emissão)',
      'linhas', jsonb_build_array(
        jsonb_build_object('linha','faturamento_bruto','valor',round(vd.bruto,2),'origem','calculada',
           'formula','Σ (valor líquido + descontos) de todas as vendas do período, inclusive as depois canceladas','detalhe','/analitico/vendas'),
        jsonb_build_object('linha','descontos','valor',-round(vd.descontos,2),'origem','calculada','formula','Σ descontos e cupons'),
        jsonb_build_object('linha','cancelamentos','valor',-round(vd.cancelados,2),'origem','calculada',
           'formula','Σ valor das vendas canceladas','vendas_ref',coalesce(vd.refs_canc,'[]'::jsonb)),
        jsonb_build_object('linha','receita_liquida','valor',round(vd.liquida,2),'origem','calculada',
           'formula','faturamento_bruto − descontos − cancelamentos'),
        jsonb_build_object('linha','impostos','valor',-round(coalesce((select v from lc where linha='impostos'),0),2),'origem','lançada',
           'lancamentos',coalesce((select refs from lc where linha='impostos'),'[]'::jsonb),
           'observacao','o Joia não calcula imposto por venda: vale o que foi lançado no plano de contas'),
        jsonb_build_object('linha','royalties','valor',-round(coalesce((select v from lc where linha='royalties'),0),2),'origem','lançada',
           'lancamentos',coalesce((select refs from lc where linha='royalties'),'[]'::jsonb)),
        jsonb_build_object('linha','fundo_marketing','valor',-round(coalesce((select v from lc where linha='fundo_marketing'),0),2),'origem','lançada',
           'lancamentos',coalesce((select refs from lc where linha='fundo_marketing'),'[]'::jsonb)),
        jsonb_build_object('linha','taxas_cartao','valor',-round(tx.taxa,2),'origem','calculada',
           'formula','Σ (valor × taxa % + taxa fixa) do CADASTRO da forma de pagamento, nas vendas concretizadas',
           'lancado_no_plano_nao_somado',round(coalesce((select v from lc where linha='taxas_cartao_lancadas'),0),2),
           'lancamentos_nao_somados',coalesce((select refs from lc where linha='taxas_cartao_lancadas'),'[]'::jsonb)),
        jsonb_build_object('linha','cpv_teorico','valor',-round(cp.cpv,2),'origem','calculada','detalhe','/analises/cpv-perdas'),
        jsonb_build_object('linha','perdas','valor',-round(cp.perdas,2),'origem','calculada','formula','baixas + ajustes negativos de inventário'),
        jsonb_build_object('linha','cpv_real','valor',-round(cp.cpv + cp.perdas,2),'origem','calculada','formula','cpv_teorico + perdas'),
        jsonb_build_object('linha','margem_bruta','valor',round(vd.liquida
            - coalesce((select sum(v) from lc where linha in ('impostos','royalties','fundo_marketing')),0)
            - tx.taxa - cp.cpv - cp.perdas,2),'origem','calculada',
           'formula','receita_liquida − impostos − royalties − fundo_marketing − taxas_cartao − cpv_real'),
        jsonb_build_object('linha','despesas_variaveis','valor',-round(coalesce((select v from lc where linha='despesas_variaveis'),0),2),'origem','lançada',
           'lancamentos',coalesce((select refs from lc where linha='despesas_variaveis'),'[]'::jsonb)),
        jsonb_build_object('linha','margem_contribuicao','valor',round(vd.liquida
            - coalesce((select sum(v) from lc where linha in ('impostos','royalties','fundo_marketing','despesas_variaveis')),0)
            - tx.taxa - cp.cpv - cp.perdas,2),'origem','calculada','formula','margem_bruta − despesas_variaveis'),
        jsonb_build_object('linha','despesas_pessoal','valor',-round(coalesce((select v from lc where linha='despesas_pessoal'),0),2),'origem','lançada',
           'lancamentos',coalesce((select refs from lc where linha='despesas_pessoal'),'[]'::jsonb)),
        jsonb_build_object('linha','despesas_ocupacao','valor',-round(coalesce((select v from lc where linha='despesas_ocupacao'),0),2),'origem','lançada',
           'lancamentos',coalesce((select refs from lc where linha='despesas_ocupacao'),'[]'::jsonb)),
        jsonb_build_object('linha','despesas_administrativas','valor',-round(coalesce((select v from lc where linha='despesas_administrativas'),0),2),'origem','lançada',
           'lancamentos',coalesce((select refs from lc where linha='despesas_administrativas'),'[]'::jsonb)),
        jsonb_build_object('linha','outras_despesas','valor',-round(coalesce((select v from lc where linha='outras_despesas'),0),2),'origem','lançada',
           'lancamentos',coalesce((select refs from lc where linha='outras_despesas'),'[]'::jsonb)),
        jsonb_build_object('linha','sem_plano_de_contas','valor',
           -round(coalesce((select v from lc where linha='sem_plano_de_contas'),0),2),'origem','lançada',
           'lancamentos',coalesce((select refs from lc where linha='sem_plano_de_contas'),'[]'::jsonb),
           'observacao','lançamento sem categoria: entra no resultado como despesa e aparece em /pendencias/lancamentos-sem-categoria'),
        jsonb_build_object('linha','outras_receitas_operacionais','valor',round(coalesce((select v from lc where linha='outras_receitas_operacionais'),0)
,2),'origem','lançada',
           'lancamentos',coalesce((select refs from lc where linha='outras_receitas_operacionais'),'[]'::jsonb),
           'observacao','venda de base entre unidades NÃO entra aqui: vai em fora_do_resultado (intra_rede_venda_de_base) — é receita de uma unidade e custo de outra, e o lançamento nem sempre diz qual'),
        jsonb_build_object('linha','ebitda','valor',round(vd.liquida
            - coalesce((select sum(v) from lc where linha in ('impostos','royalties','fundo_marketing','despesas_variaveis',
                  'despesas_pessoal','despesas_ocupacao','despesas_administrativas','outras_despesas','sem_plano_de_contas')),0)
            + coalesce((select v from lc where linha='outras_receitas_operacionais'),0)
            - tx.taxa - cp.cpv - cp.perdas,2),'origem','calculada',
           'formula','margem_contribuicao − pessoal − ocupação − administrativas − outras despesas − sem plano + outras receitas operacionais'),
        jsonb_build_object('linha','depreciacao','valor',null,'origem','não_disponível',
           'observacao','o Joia não tem cadastro de imobilizado nem depreciação'),
        jsonb_build_object('linha','resultado_financeiro','valor',round(coalesce((select v from lc where linha='receitas_financeiras'),0)
            - coalesce((select v from lc where linha='despesas_financeiras'),0),2),'origem','lançada',
           'lancamentos',coalesce((select refs from lc where linha='receitas_financeiras'),'[]'::jsonb)
                       || coalesce((select refs from lc where linha='despesas_financeiras'),'[]'::jsonb)),
        jsonb_build_object('linha','resultado_liquido_gerencial','valor',round(vd.liquida
            - coalesce((select sum(v) from lc where linha in ('impostos','royalties','fundo_marketing','despesas_variaveis',
                  'despesas_pessoal','despesas_ocupacao','despesas_administrativas','outras_despesas','sem_plano_de_contas',
                  'despesas_financeiras')),0)
            + coalesce((select sum(v) from lc where linha in ('outras_receitas_operacionais','receitas_financeiras')),0)
            - tx.taxa - cp.cpv - cp.perdas,2),'origem','calculada','formula','ebitda − depreciação + resultado_financeiro')
      ),
      'fora_do_resultado', coalesce((select jsonb_agg(jsonb_build_object('grupo', linha, 'valor', round(v,2), 'lancamentos', refs))
                                       from lc where linha like 'fora_%' or linha like 'intra_rede%'), '[]'::jsonb)
    ) into v_one
    from vd, tx, cp, esc;
    v_res := v_res || jsonb_build_array(v_one);
  end loop;
  return v_res;
end;
$$;

-- ---------- fluxo de caixa: realizado e previsto ----------
create or replace function public.rds_a_fluxo(p_loja uuid, p_sucs text[], p_de date, p_ate date, p_visao text)
returns jsonb language sql stable security definer set search_path = public as $$
  with lf as (
    select lf.*, ct.nome conta_nome, (now() at time zone 'America/Sao_Paulo')::date hoje
      from lancamentos_financeiros lf left join contas_capital ct on ct.id = lf.conta_id
     where lf.loja_id = p_loja and not coalesce(lf.cancelado,false)
       and (lf.sucursal_id = any(p_sucs) or lf.sucursal_id is null)
  ), ini as (
    select coalesce((select sum(saldo_inicial) from contas_capital where loja_id = p_loja),0)
         + coalesce(sum(case when tipo = 'receita' then valor when tipo = 'despesa' then -valor else 0 end)
             filter (where pago and pagamento < p_de), 0) saldo
      from lf
  ), b as (
    select case p_visao when 'semanal' then date_trunc('week', d)::date when 'mensal' then date_trunc('month', d)::date else d end per,
           x.* from (
      select coalesce(case when pago then pagamento else vencimento end, emissao) d, lf.* from lf) x
     where x.d between p_de and p_ate
  )
  select jsonb_build_object(
    'visao', coalesce(p_visao, 'diaria'),
    'regras', jsonb_build_object(
      'realizado', 'lançamentos pagos/recebidos, pela data do pagamento',
      'previsto', 'lançamentos em aberto, pela data de vencimento',
      'vencido', 'em aberto com vencimento antes de hoje',
      'a_vencer', 'em aberto com vencimento de hoje em diante',
      'vendas', 'as vendas entram no fluxo pelo fechamento de caixa (um lançamento por forma de pagamento); cartão fica previsto até a data de recebimento',
      'transferencias', 'entre contas: não mudam o saldo da unidade, só a conta onde o dinheiro está',
      'competencia', 'o fluxo NÃO usa competência: use /analises/dre para o resultado'),
    'saldo_inicial_realizado', round((select saldo from ini),2),
    'periodos', coalesce((select jsonb_agg(pp.o order by pp.per) from (
      select per, jsonb_build_object(
        'periodo', per,
        'entradas_realizadas', round(coalesce(sum(valor) filter (where pago and tipo='receita'),0),2),
        'saidas_realizadas', round(coalesce(sum(valor) filter (where pago and tipo='despesa'),0),2),
        'transferencias_entre_contas', round(coalesce(sum(valor) filter (where tipo='transferencia'),0),2),
        'entradas_previstas', round(coalesce(sum(valor) filter (where not pago and tipo='receita'),0),2),
        'saidas_previstas', round(coalesce(sum(valor) filter (where not pago and tipo='despesa'),0),2),
        'vencido_a_receber', round(coalesce(sum(valor) filter (where not pago and tipo='receita' and vencimento < hoje),0),2),
        'vencido_a_pagar', round(coalesce(sum(valor) filter (where not pago and tipo='despesa' and vencimento < hoje),0),2),
        'titulos', jsonb_agg(ref_local order by ref_local)) o
      from b group by per) pp), '[]'::jsonb),
    'totais', (select jsonb_build_object(
        'entradas_realizadas', round(coalesce(sum(valor) filter (where pago and tipo='receita'),0),2),
        'saidas_realizadas', round(coalesce(sum(valor) filter (where pago and tipo='despesa'),0),2),
        'saldo_final_realizado', round((select saldo from ini) + coalesce(sum(case when tipo='receita' then valor when tipo='despesa' then -valor else 0 end) filter (where pago),0),2),
        'entradas_previstas', round(coalesce(sum(valor) filter (where not pago and tipo='receita'),0),2),
        'saidas_previstas', round(coalesce(sum(valor) filter (where not pago and tipo='despesa'),0),2),
        'saldo_final_projetado', round((select saldo from ini)
            + coalesce(sum(case when tipo='receita' then valor when tipo='despesa' then -valor else 0 end),0),2)) from b),
    'por_conta_financeira', coalesce((select jsonb_agg(pc.o) from (
      select jsonb_build_object('conta_financeira', coalesce(conta_nome,'sem conta financeira'),
        'entradas_realizadas', round(coalesce(sum(valor) filter (where pago and tipo='receita'),0),2),
        'saidas_realizadas', round(coalesce(sum(valor) filter (where pago and tipo='despesa'),0),2),
        'previsto_liquido', round(coalesce(sum(case when tipo='receita' then valor when tipo='despesa' then -valor else 0 end) filter (where not pago),0),2)) o
      from b group by conta_nome) pc), '[]'::jsonb),
    'abertos_sem_conta_financeira', (select count(*) from b where not pago and conta_id is null),
    'movimentados_sem_conta_financeira', (select count(*) from b where pago and conta_id is null and tipo <> 'transferencia'));
$$;

-- ---------- clientes (dados pessoais sempre mascarados na saída) ----------
create or replace function public.rds_x_clientes(p_loja uuid, p_sucs text[], p_de date, p_ate date)
returns jsonb language sql stable security definer set search_path = public as $$
  with v as (
    select s.ref_local suc, coalesce(c.ref_local, 'nome:' || lower(p.cliente_nome)) cli, c.ref_local cli_ref,
           coalesce(c.nome, p.cliente_nome) nome, (p.data_venda at time zone 'America/Sao_Paulo')::date dia,
           p.total, coalesce(p.canal, p.tipo) canal, p.id, p.cupom_codigo, coalesce(p.cupom_valor,0) cupom_valor
      from pedidos p join sucursais s on s.id = p.sucursal_id left join clientes c on c.id = p.cliente_id
     where p.loja_id = p_loja and s.ref_local = any(p_sucs) and p.fase <> 'cancelado'
       and (p.cliente_id is not null or coalesce(trim(p.cliente_nome),'') not in ('','Consumidor','consumidor'))
       and (p.data_venda at time zone 'America/Sao_Paulo')::date <= p_ate
  ), a as (
    select suc, cli, max(cli_ref) cli_ref, max(nome) nome,
           min(dia) primeira, max(dia) ultima,
           count(*) filter (where dia between p_de and p_ate) compras_periodo,
           sum(total) filter (where dia between p_de and p_ate) valor_periodo,
           count(*) filter (where dia < p_de) compras_antes,
           max(dia) filter (where dia < p_de) ultima_antes,
           count(*) compras_total,
           mode() within group (order by canal) canal,
           count(*) filter (where dia between p_de and p_ate and cupom_valor > 0) com_cupom
      from v group by suc, cli
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'cliente_ref', coalesce(a.cli_ref, 'sem cadastro'), 'sucursal_id', a.suc,
      'cliente', a.nome,
      'primeira_compra', a.primeira, 'ultima_compra', a.ultima,
      'compras_no_periodo', a.compras_periodo, 'valor_no_periodo', round(coalesce(a.valor_periodo,0),2),
      'ticket_medio', case when a.compras_periodo > 0 then round(a.valor_periodo / a.compras_periodo, 2) end,
      'compras_total', a.compras_total,
      'recencia_dias', (p_ate - a.ultima),
      'frequencia_mensal', round(a.compras_total::numeric / greatest(1, ((a.ultima - a.primeira) / 30.0)), 2),
      'canal_preferido', a.canal, 'compras_com_desconto_de_cupom', a.com_cupom,
      'segmento', case
          when a.compras_periodo = 0 then 'sem compra no período'
          when a.primeira between p_de and p_ate then 'novo'
          when a.ultima_antes is not null and (p_de - a.ultima_antes) > 60 then 'reativado'
          else 'recorrente' end,
      'updated_at', null
    ) order by a.suc, a.valor_periodo desc nulls last), '[]'::jsonb)
    from a where a.compras_periodo > 0;
$$;

-- ---------- revogações ----------
revoke all on function public.rds_x_titulos(uuid, text[], date, date, text) from public, anon, authenticated;
grant execute on function public.rds_x_titulos(uuid, text[], date, date, text) to service_role;
revoke all on function public.rds_x_extrato(uuid, text[], date, date) from public, anon, authenticated;
grant execute on function public.rds_x_extrato(uuid, text[], date, date) to service_role;
revoke all on function public.rds_c_produtos(uuid, text[]) from public, anon, authenticated;
grant execute on function public.rds_c_produtos(uuid, text[]) to service_role;
revoke all on function public.rds_c_plano(uuid) from public, anon, authenticated;
grant execute on function public.rds_c_plano(uuid) to service_role;
revoke all on function public.rds_c_contas(uuid, text[]) from public, anon, authenticated;
grant execute on function public.rds_c_contas(uuid, text[]) to service_role;
revoke all on function public.rds_c_formas(uuid) from public, anon, authenticated;
grant execute on function public.rds_c_formas(uuid) to service_role;
revoke all on function public.rds_c_fornecedores(uuid) from public, anon, authenticated;
grant execute on function public.rds_c_fornecedores(uuid) to service_role;
revoke all on function public.rds_c_motivos(uuid) from public, anon, authenticated;
grant execute on function public.rds_c_motivos(uuid) to service_role;
revoke all on function public.rds_c_pessoas(uuid) from public, anon, authenticated;
grant execute on function public.rds_c_pessoas(uuid) to service_role;
revoke all on function public.rds_cpv_linhas(uuid, text[], date, date) from public, anon, authenticated;
grant execute on function public.rds_cpv_linhas(uuid, text[], date, date) to service_role;
revoke all on function public.rds_a_cpv_perdas(uuid, text[], date, date, text) from public, anon, authenticated;
grant execute on function public.rds_a_cpv_perdas(uuid, text[], date, date, text) to service_role;
revoke all on function public.rds_a_dre(uuid, text[], date, date) from public, anon, authenticated;
grant execute on function public.rds_a_dre(uuid, text[], date, date) to service_role;
revoke all on function public.rds_a_fluxo(uuid, text[], date, date, text) from public, anon, authenticated;
grant execute on function public.rds_a_fluxo(uuid, text[], date, date, text) to service_role;
revoke all on function public.rds_x_clientes(uuid, text[], date, date) from public, anon, authenticated;
grant execute on function public.rds_x_clientes(uuid, text[], date, date) to service_role;

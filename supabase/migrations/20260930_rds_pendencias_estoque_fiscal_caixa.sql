-- ============================================================
-- API RDS — as tres pendencias que faltavam (30/09/2026)
--
-- A RDS pediu, no documento de homologacao, que a API deixasse
-- acompanhar: itens negativos e bloqueados, divergencias de venda,
-- pagamento e fiscal, e caixas com pendencias. As outras tres da lista
-- (lancamentos sem plano de contas, insumos sem custo, produtos sem
-- vinculo) ja existiam desde 24/09.
--
-- ---------- o que estas tres NAO fazem ----------
-- Nao bloqueiam nada, nao corrigem nada e nao classificam nada. Sao
-- leitura: dizem o que esta fora do lugar, com o suficiente para
-- alguem achar a causa. As travas pedidas pela RDS (impedir saida de
-- item negativo, impedir fechamento de caixa com pendencia) sao
-- trabalho de outra ordem, no sistema — e enquanto elas nao existem,
-- o valor destas tres e justamente MEDIR o tamanho do problema.
--
-- ---------- por que "divergencia fiscal" nao e so status ----------
-- Um cupom `rejeitado` e obvio. O que escapa e a venda que NUNCA gerou
-- cupom numa loja que emite sempre: nao ha linha em `cupons_fiscais`,
-- entao nenhuma consulta por status a encontra. Por isso a pergunta e
-- feita a partir do PEDIDO, e nao do cupom.
-- ============================================================

-- ---------- as quatro de 24/09, preservadas ----------
-- O corpo provado em 24/09 nao e reescrito: ele e COPIADO do proprio
-- banco para o nome novo. Reescrever a mao um corpo que ja esta provado
-- e arriscar por nada — e o arquivo e o banco divergiriam no primeiro
-- ponto e virgula fora do lugar.
do $migra$
declare d text;
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='public' and p.proname='api_pendencias_v1') then
    select pg_get_functiondef(p.oid) into d
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'api_pendencias';
    d := replace(d, 'FUNCTION public.api_pendencias(', 'FUNCTION public.api_pendencias_v1(');
    execute d;
  end if;
end $migra$;
revoke all on function public.api_pendencias_v1(uuid, text, text) from public, anon, authenticated;
grant execute on function public.api_pendencias_v1(uuid, text, text) to service_role;

create or replace function public.api_pendencias(p_loja uuid, p_suc text, p_tipo text)
returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare r jsonb;
begin
  -- ---------- as quatro que ja existiam ----------
  if p_tipo in ('lancamentos-sem-categoria','insumos-sem-custo',
                'produtos-sem-vinculo','motivos-sem-classe') then
    return public.api_pendencias_v1(p_loja, p_suc, p_tipo);
  end if;

  -- ---------- itens com saldo negativo ----------
  -- O saldo negativo e sempre consequencia de outra coisa: entrada nao
  -- lancada, ficha errada, producao nao registrada. Por isso a linha
  -- leva o ULTIMO movimento do item: e por ele que se comeca a olhar.
  if p_tipo = 'estoque-negativo' then
    select coalesce(jsonb_agg(x order by x->>'unidade_nome', x->>'item_nome'), '[]') into r from (
      select jsonb_build_object(
        'item_ref', e.item_ref,
        'item_nome', coalesce(p.nome, i.nome, e.item_ref),
        'tipo', e.tipo,
        'unidade', e.sucursal_id,
        'unidade_nome', s.nome,
        'saldo', round(e.estoque, 6),
        'custo_medio', round(coalesce(e.custo_medio,0), 6),
        'valor_negativo', round(e.estoque * coalesce(e.custo_medio,0), 2),
        'atualizado_em', e.atualizado_em,
        /* o movimento e um cabecalho com as linhas dentro (`linhas`,
           jsonb): o item se acha pelo insumoId de cada linha */
        'ultimo_movimento', (
          select jsonb_build_object(
            'quando', m.criado_em, 'data', m.data, 'origem', m.origem,
            'identificacao', m.identificacao, 'observacao', m.observacao,
            'linha', (select l from jsonb_array_elements(m.linhas) l
                       where l->>'insumoId' = e.item_ref limit 1))
            from movimentacoes_estoque m
           where m.loja_id = e.loja_id
             and m.sucursal_id = e.sucursal_id
             and m.linhas @> jsonb_build_array(jsonb_build_object('insumoId', e.item_ref))
           order by m.criado_em desc limit 1),
        'obs', 'Saldo negativo nao se resolve acertando o saldo: procure a causa no ultimo movimento e corrija por uma movimentacao real.'
      ) x
      from estoque_unidade e
      left join sucursais s on s.loja_id = e.loja_id and s.ref_local = e.sucursal_id
      left join produtos p on p.loja_id = e.loja_id and p.ref_local = e.item_ref
      left join insumos i on i.loja_id = e.loja_id and i.ref_local = e.item_ref
     where e.loja_id = p_loja
       and (p_suc is null or e.sucursal_id = p_suc)
       and e.estoque < 0
    ) t;
    return coalesce(r, '[]'::jsonb);
  end if;

  -- ---------- venda, pagamento e fiscal que nao fecham ----------
  if p_tipo = 'fiscal-divergente' then
    select coalesce(jsonb_agg(x order by x->>'data_venda' desc, x->>'numero'), '[]') into r from (
      select jsonb_build_object(
        'pedido_ref', pd.ref_local,
        'numero', pd.numero,
        'data_venda', pd.data_venda,
        'hora', pd.hora,
        'unidade', s.ref_local,
        'unidade_nome', s.nome,
        'total', round(coalesce(pd.total,0),2),
        'quis_cupom', coalesce(pd.fiscal,false),
        'emissao_da_loja', fu.modo,
        'ambiente', fu.ambiente,
        'producao_desde', fu.producao_confirmada_em,
        'cupom_status', coalesce(cf.status, 'nao existe'),
        'cupom_numero', cf.numero,
        'cupom_motivo', coalesce(cf.motivo, cf.motivo_cancelamento),
        'cupom_chave', cf.chave,
        'pago', (select round(sum(pp.valor),2) from pedido_pagamentos pp where pp.pedido_id = pd.id),
        'divergencia', case
          when cf.id is null then 'venda sem cupom fiscal'
          when cf.status in ('rejeitado','denegado') then 'cupom recusado pela SEFAZ'
          when cf.status in ('enviando','pendente') then 'cupom pendente de autorizacao'
          when cf.status = 'contingencia' then 'cupom em contingencia, ainda nao transmitido'
          else 'cupom cancelado sem venda cancelada' end,
        'obs', 'Apurada a partir do PEDIDO: venda que nunca gerou cupom nao tem linha em cupons_fiscais e nenhuma consulta por status a encontraria.'
      ) x
      /* em `pedidos` a unidade e o ID da sucursal (uuid); no resto do
         banco e a referencia (`ref_local`, texto). Junta pelo id e
         filtra pela referencia. */
      from pedidos pd
      join sucursais s on s.id = pd.sucursal_id
      join fiscal_unidades fu on fu.loja_id = pd.loja_id and fu.sucursal_ref = s.ref_local
      left join cupons_fiscais cf on cf.loja_id = pd.loja_id and cf.pedido_ref = pd.ref_local
     where pd.loja_id = p_loja
       and (p_suc is null or s.ref_local = p_suc)
       and fu.modo <> 'desligado'
       /* so conta o que e DOCUMENTO: cupom de homologacao nunca foi um.
          Sem este corte davam 2.449 "divergencias" que ninguem pode
          resolver — e numero que ninguem resolve ninguem olha. */
       and fu.ambiente = 'producao'
       and fu.producao_confirmada_em is not null
       and coalesce(pd.fase,'') <> 'cancelado'
       and pd.data_venda >= (fu.producao_confirmada_em at time zone 'America/Sao_Paulo')::date
       and pd.data_venda >= (now() at time zone 'America/Sao_Paulo')::date - 90
       and (cf.id is null or cf.status <> 'autorizado')
    ) t;
    return coalesce(r, '[]'::jsonb);
  end if;

  -- ---------- caixas com pendencia ----------
  -- Um caixa fechado com diferenca e um fato do turno; um caixa aberto
  -- ha dias e outra coisa — normalmente alguem esqueceu de fechar, e o
  -- movimento seguinte entra no turno errado.
  if p_tipo = 'caixas-com-pendencia' then
    select coalesce(jsonb_agg(x order by x->>'aberto_em' desc), '[]') into r from (
      select jsonb_build_object(
        'caixa_ref', c.ref_local,
        'unidade', c.sucursal_id,
        'unidade_nome', s.nome,
        'operador', c.operador,
        'turno', c.turno_nome,
        'aberto_em', c.aberto_em,
        'fechado_em', c.fechado_em,
        'esperado', round(coalesce(c.esperado,0),2),
        'contado', round(coalesce(c.contado,0),2),
        'diferenca', round(coalesce(c.diferenca_total, coalesce(c.contado,0)-coalesce(c.esperado,0)),2),
        'conciliado', coalesce(c.conciliado,false),
        'pedidos', c.qtd_pedidos,
        'vendas_sem_pagamento', (
          select count(*) from pedidos pd
           where pd.caixa_id = c.id and coalesce(pd.fase,'') <> 'cancelado'
             and not exists (select 1 from pedido_pagamentos pp where pp.pedido_id = pd.id)),
        'pendencia', case
          when c.fechado_em is null then 'caixa ainda aberto'
          when abs(coalesce(c.diferenca_total, coalesce(c.contado,0)-coalesce(c.esperado,0))) > 0.009
            then 'fechado com diferenca'
          else 'venda sem pagamento' end
      ) x
      from caixas c
      left join sucursais s on s.loja_id = c.loja_id and s.ref_local = c.sucursal_id
     where c.loja_id = p_loja
       and (p_suc is null or c.sucursal_id = p_suc)
       and c.aberto_em >= now() - interval '90 days'
       and (
         /* aberto ha mais de um dia: normalmente esqueceram de fechar */
         (c.fechado_em is null and c.aberto_em < now() - interval '1 day')
         or abs(coalesce(c.diferenca_total, coalesce(c.contado,0)-coalesce(c.esperado,0))) > 0.009
         or exists (select 1 from pedidos pd
                     where pd.caixa_id = c.id and coalesce(pd.fase,'') <> 'cancelado'
                       and not exists (select 1 from pedido_pagamentos pp where pp.pedido_id = pd.id))
       )
    ) t;
    return coalesce(r, '[]'::jsonb);
  end if;

  return '[]'::jsonb;
end $$;

revoke all on function public.api_pendencias(uuid, text, text) from public, anon, authenticated;
grant execute on function public.api_pendencias(uuid, text, text) to service_role;

-- ---------- a ultima sincronizacao, por unidade ----------
-- A RDS pediu que TODA resposta dissesse ate quando os dados vao. Sem
-- isso, um relatorio tirado com uma loja offline parece completo e nao
-- e — e ninguem tem como saber olhando o numero.
create or replace function public.api_ultima_sincronizacao(p_loja uuid, p_suc text)
returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'unidade', s.ref_local, 'unidade_nome', s.nome,
           'ultimo_recebido_em', x.quando) order by s.ref_local), '[]')
    from (select p.sucursal_id as suc, max(p.criado_em) as quando
            from pedidos p where p.loja_id = p_loja group by p.sucursal_id) x
    join sucursais s on s.id = x.suc
   where p_suc is null or s.ref_local = p_suc
$$;
revoke all on function public.api_ultima_sincronizacao(uuid, text) from public, anon, authenticated;
grant execute on function public.api_ultima_sincronizacao(uuid, text) to service_role;

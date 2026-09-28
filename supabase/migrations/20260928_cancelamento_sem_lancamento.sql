-- =====================================================================
-- VENDA CANCELADA NÃO VAI PARA O LANÇAMENTO FINANCEIRO (28/09/2026)
--
-- Pedido do Rafael: "estorno de pedido não há necessidade de ir para o
-- lançamento financeiro, senão polui demais".
--
-- Cancelar uma venda gerava uma DESPESA "Estorno do pedido #N". Além de
-- poluir a lista, ela contava duas vezes: a venda cancelada já sai do
-- faturamento e do fechamento de caixa (o fechamento soma só vendas não
-- canceladas), e a despesa tirava o mesmo valor de novo do resultado.
--
-- O que continua igual: a venda vira 'cancelado', o registro de
-- cancelamento (motivo, operador) e o estorno de ESTOQUE.
-- O que muda: nenhuma linha em lancamentos_financeiros.
--
-- As 45 despesas antigas (origem 'cancelamento', todas sem conta, sem
-- categoria, sem conciliação e nunca editadas) são removidas. Se um dia
-- precisarem voltar, cada uma se reconstrói da tabela `cancelamentos`
-- (ref_local 'lfest_' || pedido_ref, valor = total do pedido).
-- =====================================================================

create or replace function public.tg_cancelamento_estorna()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare ped record; mv record; ln jsonb; chave text; ambiguos int;
begin
  select * into ped from pedidos
   where loja_id = new.loja_id and ref_local = new.pedido_ref;
  if not found then return new; end if;

  -- sempre vale, independente do estorno
  update pedidos set fase = 'cancelado' where id = ped.id and fase <> 'cancelado';

  begin
    select count(*) into ambiguos from pedidos
     where loja_id = ped.loja_id
       and sucursal_id is not distinct from ped.sucursal_id
       and numero = ped.numero;
    if ambiguos > 1 then
      raise warning 'estorno ignorado: numero % repetido em % pedidos', ped.numero, ambiguos;
      return new;
    end if;

    for mv in select * from movimentacoes_estoque
               where loja_id = new.loja_id and origem = 'venda'
                 and identificacao = 'Pedido #' || ped.numero loop
      chave := 'mvest_' || mv.ref_local;
      if not exists (select 1 from movimentacoes_estoque
                      where loja_id = new.loja_id and ref_local = chave) then
        for ln in select * from jsonb_array_elements(coalesce(mv.linhas,'[]'::jsonb)) loop
          perform estoque_aplicar(mv.sucursal_id, ln->>'insumoId',
            abs(coalesce(nullif(ln->>'qtd','')::numeric,0)),
            coalesce(ln->>'tipo','insumo'), null);
        end loop;
        insert into movimentacoes_estoque(loja_id, ref_local, data, hora, motivo_id,
            identificacao, observacao, origem, linhas, sucursal_id)
        values (new.loja_id, chave, current_date, to_char(now(),'HH24:MI'),
            mv.motivo_id, 'Estorno do pedido #'||ped.numero, 'venda cancelada',
            'estorno', mv.linhas, mv.sucursal_id);
      end if;
    end loop;

    -- venda cancelada NÃO gera lançamento financeiro (28/09/2026)

  exception when others then
    raise warning 'estorno do cancelamento % falhou: %', new.pedido_ref, sqlerrm;
  end;
  return new;
end $function$;

create or replace function public.venda_cancelar(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare lj uuid; ped record; nova boolean; ln jsonb; mv record;
        n_estorno int := 0; suc text;
begin
  lj := minha_loja();
  if lj is null then raise exception 'sessão sem empresa'; end if;
  if coalesce(p->>'pedido_ref','') = '' then raise exception 'cancelamento sem pedido'; end if;

  select * into ped from pedidos where loja_id=lj and ref_local=p->>'pedido_ref';
  if not found then raise exception 'pedido não encontrado nesta empresa'; end if;

  insert into cancelamentos(loja_id, ref_local, pedido_ref, pedido_numero, valor,
      data, hora, motivo_id, motivo_nome, observacao, operador_nome, caixa_ref)
  values (lj, coalesce(nullif(p->>'ref_local',''),'canc_'||(p->>'pedido_ref')),
      ped.ref_local, ped.numero, ped.total,
      to_char(current_date,'YYYY-MM-DD'), to_char(now(),'HH24:MI'),
      (select id from motivos_cancelamento where loja_id=lj and ref_local=p->>'motivo_ref' limit 1),
      p->>'motivo_nome', p->>'observacao', p->>'usuario', p->>'caixa_ref')
  on conflict (loja_id, ref_local) do nothing;
  nova := found;

  if not nova then
    return jsonb_build_object('ok', true, 'ja_cancelado', true, 'estornos', 0);
  end if;

  update pedidos set fase = coalesce(nullif(p->>'fase_cancelado',''),'cancelado')
   where id = ped.id;

  for mv in select * from movimentacoes_estoque
             where loja_id=lj and origem='venda'
               and identificacao = 'Pedido #'||ped.numero loop
    suc := mv.sucursal_id;
    for ln in select * from jsonb_array_elements(coalesce(mv.linhas,'[]'::jsonb)) loop
      perform estoque_aplicar(suc, ln->>'insumoId',
        abs(coalesce(nullif(ln->>'qtd','')::numeric,0)),
        coalesce(ln->>'tipo','insumo'), null);
      n_estorno := n_estorno + 1;
    end loop;
    insert into movimentacoes_estoque(loja_id, ref_local, data, hora, motivo_id,
        identificacao, observacao, origem, linhas, sucursal_id)
    values (lj, 'mvest_'||mv.ref_local, current_date, to_char(now(),'HH24:MI'),
        mv.motivo_id, 'Estorno do pedido #'||ped.numero, 'venda cancelada',
        'estorno', mv.linhas, suc)
    on conflict (loja_id, ref_local) do nothing;
  end loop;

  -- venda cancelada NÃO gera lançamento financeiro (28/09/2026)

  return jsonb_build_object('ok', true, 'ja_cancelado', false, 'estornos', n_estorno);
end $function$;

delete from public.lancamentos_financeiros
 where origem = 'cancelamento'
   and descricao like 'Estorno do pedido #%'
   and conta_id is null and not conciliado;

-- =====================================================================
-- JOIA — pedido da RDS de 24/09/2026
--
-- 1. /pendencias na API: a relação NOMINAL do que falta limpar antes da
--    data de corte (lançamentos sem categoria, insumos sem custo, produtos
--    ativos sem ficha nem insumo, motivos sem classe). Só leitura: nada
--    aqui classifica ou corrige registro nenhum.
-- 2. Foto das pendências de hoje (o "antes" da limpeza), guardada fora da
--    API, em `arquivo`.
-- 3. Chave de integração duradoura: finalidade, limite de chamadas por
--    minuto, máscara de dados pessoais, rotação e revogação registradas.
--    A contagem de uso passa a ser atômica (antes era ler-e-somar).
-- 4. Nunca mais tabela nova sem RLS no esquema público (foi a causa das
--    12 cópias de segurança expostas de 16 a 23/09/2026).
-- =====================================================================

-- ---------- 1. pendências ----------
create or replace function public.api_pendencias(p_loja uuid, p_suc text, p_tipo text)
returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare r jsonb;
begin
  if p_tipo = 'lancamentos-sem-categoria' then
    select coalesce(jsonb_agg(x order by x->>'emissao', x->>'identificador'), '[]') into r from (
      select jsonb_build_object(
        'identificador', l.ref_local,
        'id', l.id,
        'tipo', case l.tipo when 'despesa' then 'a pagar' when 'receita' then 'a receber' else l.tipo end,
        'descricao', l.descricao,
        'documento', l.documento,
        'fornecedor', coalesce(nullif(l.fornecedor_nome,''), fo.empresa),
        'fornecedor_cnpj', fo.cnpj,
        'emissao', l.emissao,
        'vencimento', l.vencimento,
        'pagamento', l.pagamento,
        'pago', coalesce(l.pago,false),
        'conciliado', coalesce(l.conciliado,false),
        'valor', round(coalesce(l.valor,0),2),
        'unidade', l.sucursal_id,
        'unidade_nome', s.nome,
        'conta', cc.nome,
        'forma_pagamento', fp.nome,
        'origem', coalesce(nullif(l.origem,''), 'manual'),
        'origem_ref', l.origem_ref,
        'criado_em', l.criado_em,
        'alterado_em', l.alterado_em,
        'usuario', (select a.usuario_email from audit_log a
                     where a.tabela = 'lancamentos_financeiros' and a.registro_id = l.id
                     order by (a.operacao = 'INSERT') desc, a.quando asc limit 1),
        'usuario_obs', 'conta logada no aparelho; as lojas usam uma conta por unidade'
      ) x
      from lancamentos_financeiros l
      left join sucursais s on s.loja_id = l.loja_id and s.ref_local = l.sucursal_id
      left join fornecedores fo on fo.id = l.fornecedor_id
      left join contas_capital cc on cc.id = l.conta_id
      left join formas_pagamento fp on fp.id = l.forma_id
      where l.loja_id = p_loja
        and (p_suc is null or l.sucursal_id = p_suc)
        and coalesce(l.cancelado,false) = false
        and l.subcategoria_id is null
        and coalesce(l.categoria_texto,'') = ''
    ) q;

  elsif p_tipo = 'insumos-sem-custo' then
    select coalesce(jsonb_agg(x order by x->>'descricao'), '[]') into r from (
      select jsonb_build_object(
        'identificador', i.ref_local,
        'id', i.id,
        'codigo', i.codigo,
        'descricao', i.nome,
        'unidade_medida', i.unidade,
        'fator', i.fator,
        'controla_estoque', i.controla_estoque,
        'compoe_cmv', i.compoe_cmv,
        'custo', coalesce(i.custo, i.custo_unitario, 0),
        'custo_ultima_compra', i.custo_ultima,
        'saldo_atual', coalesce((select jsonb_agg(jsonb_build_object(
                          'unidade', e.sucursal_id,
                          'unidade_nome', (select s.nome from sucursais s where s.loja_id=e.loja_id and s.ref_local=e.sucursal_id),
                          'saldo', round(e.estoque,3),
                          'custo_medio', round(e.custo_medio,4)) order by e.sucursal_id)
                        from estoque_unidade e
                       where e.loja_id = i.loja_id and e.item_ref = i.ref_local
                         and (p_suc is null or e.sucursal_id = p_suc)), '[]'),
        'fichas_que_usam', coalesce((select jsonb_agg(distinct f.nome)
                        from ficha_itens fi join fichas_tecnicas f on f.id = fi.ficha_id
                       where fi.insumo_id = i.id), '[]'),
        'produtos_que_usam_direto', coalesce((select jsonb_agg(distinct p.nome)
                        from produtos p where p.insumo_id = i.id), '[]'),
        'ultima_compra', (select jsonb_build_object('data', m.data, 'documento', m.identificacao,
                                 'quantidade', (l.linha->>'qtd')::numeric,
                                 'custo', (l.linha->>'custo')::numeric,
                                 'unidade', m.sucursal_id)
                        from movimentacoes_estoque m,
                             lateral jsonb_array_elements(coalesce(m.linhas,'[]')) l(linha)
                       where m.loja_id = i.loja_id and m.origem = 'nota'
                         and l.linha->>'insumoId' = i.ref_local
                       order by m.data desc, m.criado_em desc limit 1),
        'unidades_do_cadastro', i.sucursais,
        'alterado_em', i.alterado_em
      ) x
      from insumos i
      where i.loja_id = p_loja
        and coalesce(i.custo, i.custo_unitario, 0) = 0
    ) q;

  elsif p_tipo = 'produtos-sem-vinculo' then
    select coalesce(jsonb_agg(x order by x->>'descricao'), '[]') into r from (
      select jsonb_build_object(
        'identificador', p.ref_local,
        'id', p.id,
        'codigo', p.codigo,
        'descricao', p.nome,
        'preco', p.preco,
        'ativo', p.ativo,
        'baixa_estoque', coalesce(p.vincula_estoque, false),
        'ficha', null, 'insumo', null,
        'vendas', (select jsonb_build_object(
                     'quantidade', coalesce(sum(it.quantidade),0),
                     'faturamento', round(coalesce(sum(it.total),0),2),
                     'pedidos', count(distinct pe.id),
                     'primeira_venda', min((pe.data_venda at time zone 'America/Sao_Paulo')::date),
                     'ultima_venda', max((pe.data_venda at time zone 'America/Sao_Paulo')::date),
                     'dias_com_venda', coalesce(jsonb_agg(distinct (pe.data_venda at time zone 'America/Sao_Paulo')::date)
                                         filter (where pe.id is not null), '[]'))
                   from pedido_itens it
                   join pedidos pe on pe.id = it.pedido_id
                   left join sucursais s on s.id = pe.sucursal_id
                  where it.produto_id = p.id and pe.fase <> 'cancelado'
                    and (p_suc is null or s.ref_local = p_suc)),
        'unidades_do_cadastro', p.sucursais,
        'alterado_em', p.alterado_em
      ) x
      from produtos p
      where p.loja_id = p_loja
        and coalesce(p.ativo, true)
        and p.ficha_id is null and p.insumo_id is null
    ) q;

  elsif p_tipo = 'motivos-sem-classe' then
    select coalesce(jsonb_agg(x order by (x->>'usos')::int desc, x->>'nome'), '[]') into r from (
      select jsonb_build_object(
        'identificador', m.ref_local,
        'id', m.id,
        'nome', m.nome,
        'direcao', m.tipo,
        'do_sistema', coalesce(m.sistema,false),
        'ativo', coalesce(m.ativo,true),
        'classe', null,
        'usos', (select count(*) from movimentacoes_estoque v
                  where v.loja_id = m.loja_id and v.motivo_id = m.id
                    and (p_suc is null or v.sucursal_id = p_suc)),
        'ultimo_uso', (select max(v.data) from movimentacoes_estoque v
                        where v.loja_id = m.loja_id and v.motivo_id = m.id)
      ) x
      from motivos_movimentacao m
      where m.loja_id = p_loja
    ) q;

  else
    r := null;
  end if;
  return r;
end $$;

revoke all on function public.api_pendencias(uuid, text, text) from public, anon, authenticated;
grant execute on function public.api_pendencias(uuid, text, text) to service_role;

-- ---------- 2. foto do "antes" ----------
create table if not exists arquivo.pendencias_foto (
  id bigserial primary key,
  tirada_em timestamptz not null default now(),
  loja_id uuid not null,
  tipo text not null,
  registros int not null,
  dados jsonb not null
);
alter table arquivo.pendencias_foto enable row level security;
revoke all on arquivo.pendencias_foto from anon, authenticated;

insert into arquivo.pendencias_foto (loja_id, tipo, registros, dados)
select l.id, t.tipo,
       jsonb_array_length(public.api_pendencias(l.id, null, t.tipo)),
       public.api_pendencias(l.id, null, t.tipo)
  from (select distinct loja_id id from api_chaves where nome ilike 'RDS%' and loja_id is not null) l,
       (values ('lancamentos-sem-categoria'),('insumos-sem-custo'),
               ('produtos-sem-vinculo'),('motivos-sem-classe')) t(tipo);

-- ---------- 3. chave de integração duradoura ----------
alter table public.api_chaves
  add column if not exists finalidade text,
  add column if not exists limite_por_minuto int not null default 120,
  add column if not exists mascarar_pessoais boolean not null default true,
  add column if not exists janela_inicio timestamptz,
  add column if not exists janela_usos int not null default 0,
  add column if not exists recusas_por_limite bigint not null default 0,
  add column if not exists revogada_em timestamptz,
  add column if not exists revogada_motivo text,
  add column if not exists rotacionada_de uuid references public.api_chaves(id);

-- conta o uso e aplica o limite numa só gravação (sem corrida entre chamadas)
create or replace function public.api_chave_uso(p_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path to 'public' as $$
declare c record; agora timestamptz := now(); ok boolean;
begin
  select * into c from api_chaves where id = p_id and ativa for update;
  if not found then return jsonb_build_object('permitido', false, 'motivo', 'chave desativada'); end if;
  if c.janela_inicio is null or agora - c.janela_inicio >= interval '1 minute' then
    update api_chaves set janela_inicio = agora, janela_usos = 1,
           usos = coalesce(usos,0) + 1, ultimo_uso = agora where id = p_id;
    return jsonb_build_object('permitido', true, 'limite', c.limite_por_minuto, 'restante', c.limite_por_minuto - 1);
  end if;
  ok := c.janela_usos < c.limite_por_minuto;
  if ok then
    update api_chaves set janela_usos = janela_usos + 1,
           usos = coalesce(usos,0) + 1, ultimo_uso = agora where id = p_id;
  else
    update api_chaves set recusas_por_limite = recusas_por_limite + 1 where id = p_id;
  end if;
  return jsonb_build_object('permitido', ok, 'limite', c.limite_por_minuto,
         'restante', greatest(0, c.limite_por_minuto - c.janela_usos - 1),
         'libera_em', c.janela_inicio + interval '1 minute');
end $$;
revoke all on function public.api_chave_uso(uuid) from public, anon, authenticated;
grant execute on function public.api_chave_uso(uuid) to service_role;

-- ---------- 4. tabela nova no esquema público nasce com RLS ----------
create or replace function public.rls_obrigatoria()
returns event_trigger
language plpgsql security definer set search_path to 'public' as $$
declare o record;
begin
  for o in select * from pg_event_trigger_ddl_commands()
           where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
             and schema_name = 'public' and object_type = 'table'
  loop
    execute format('alter table %s enable row level security', o.object_identity);
  end loop;
end $$;

drop event trigger if exists rls_obrigatoria;
create event trigger rls_obrigatoria on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_obrigatoria();

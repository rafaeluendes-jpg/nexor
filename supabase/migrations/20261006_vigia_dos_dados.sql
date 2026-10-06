-- =====================================================================
-- O VIGIA PASSA A OLHAR OS DADOS (Missão integridade, fase 4 — 06/10/2026)
--
-- O vigia (VIGIA_PLANO.md, .claude/skills/vigia) olhava erros de tela e
-- de cupom. O estrago que mais custou — dado que volta sozinho — não dá
-- erro nenhum: fica só no audit_log. Agora ele lê o audit_log e acusa:
--
--   'mao_unica'  estado de mão única que voltou sem desfazer pela tela;
--   'voltou'     campo que um aparelho devolveu ao valor anterior (a
--                mesma conta da régua, ferramentas/regua.sql);
--   'loja'       cadastro da rede (ficha, ingrediente, insumo, grupo) ou
--                liberação mudados por login de LOJA;
--   'rajada'     o mesmo aparelho mudando muitas linhas no mesmo minuto;
--   'exclusao'   exclusão em massa.
--
-- Cada achado vai para a Central de Erros (erros_sistema, tipo 'dado'),
-- como "precisa de você", com o quê, qual loja, qual aparelho e quando.
-- A matriz decide lá: "Devolver como estava" (devolver_como_estava) põe
-- de volta o "antes" do audit_log — só se a linha não mudou de novo
-- desde então — e a devolução entra na auditoria com o motivo.
--
-- E a fotografia dos dados (ferramentas/fotografia-dos-dados.sql) passa
-- a ser guardada no banco antes e uma hora depois de cada publicação
-- (fotografar_dados), para o vigia comparar loja por loja.
-- =====================================================================
set local lock_timeout = '10s';

-- o audit_log é consultado por linha (registro) — sem este índice, achar
-- a mudança anterior de um campo leria a tabela inteira
create index if not exists ix_audit_registro on public.audit_log (tabela, registro_id, quando desc);

-- ---------------------------------------------------------------------
-- 1. o que o vigia acusa
-- ---------------------------------------------------------------------
create or replace function public.vigia_dos_dados(p_desde timestamptz default now() - interval '70 minutes')
returns table (tipo text, tabela text, ref_local text, registro_id uuid, loja_id uuid, sucursal text,
               aparelho text, usuario_email text, quando timestamptz, campos jsonb, antes jsonb,
               audit_id bigint, resumo text)
language sql stable security definer set search_path to 'public'
as $$
  with janela as materialized (
    select a.*, p.sucursal_ref suc_login,
           -- desfazer pela tela (motivo novo) e devolução da matriz são de propósito
           (coalesce(a.depois->>'desfazer_motivo','') <> coalesce(a.antes->>'desfazer_motivo','')
            or coalesce(a.aparelho,'') in ('devolvido pela matriz','decisão da matriz')) de_proposito
      from audit_log a left join perfis p on p.id = a.usuario
     where a.quando >= p_desde and a.usuario is not null
  ),
  servico(k) as (select unnest(array['alterado_em','versao_vista','versao_aparelho','sucursais_vista',
                                     'desfazer_motivo','atualizado_em'])),
  saldo(k) as (select unnest(array['estoque','estoque_atual','custo','custo_medio','custo_ultima',
                                   'ultimo_custo_medio_com_saldo'])),
  mudou as (
    select j.id, j.tabela, k, j.antes->k va, j.depois->k vd
      from janela j, jsonb_object_keys(coalesce(j.depois, '{}'::jsonb)) k
     where j.operacao = 'UPDATE' and j.antes->k is distinct from j.depois->k
       and k not in (select k from servico)
  ),
  -- 1. mão única: voltou sem um motivo NOVO (desfazer pela tela)
  mao as (
    select 'mao_unica'::text tipo, j.id, jsonb_object_agg(m.k, m.vd) campos, jsonb_object_agg(m.k, m.va) antes
      from mudou m join janela j on j.id = m.id
      join estados_mao_unica r on r.tabela = m.tabela and r.coluna = m.k
     where m.va is not null and m.va <> 'null'::jsonb
       and not j.de_proposito
       and case r.regra
             when 'desmarca' then m.va = 'true'::jsonb and (m.vd is null or m.vd in ('null'::jsonb, 'false'::jsonb))
             when 'esvazia'  then m.vd is null or m.vd in ('null'::jsonb, '""'::jsonb)
             when 'ordem'    then coalesce(array_position(r.ordem, m.vd #>> '{}'), 0) > 0
                                  and array_position(r.ordem, m.vd #>> '{}') < coalesce(array_position(r.ordem, m.va #>> '{}'), 0)
             else false end
     group by j.id
  ),
  -- 2. voltou: o campo vai de B para A logo depois de ter ido de A para B
  volta as (
    select 'voltou'::text tipo, m.id, jsonb_object_agg(m.k, m.vd) campos, jsonb_object_agg(m.k, m.va) antes
      from mudou m join janela j on j.id = m.id
     where m.k not in (select k from saldo)
       and not j.de_proposito
       and not exists (select 1 from mao where mao.id = m.id)
       and exists (
         select 1 from (
           select a2.antes->m.k va2, a2.depois->m.k vd2
             from audit_log a2
            where a2.tabela = j.tabela and a2.registro_id = j.registro_id and a2.operacao = 'UPDATE'
              and a2.quando < j.quando and a2.quando > j.quando - interval '30 days'
              and a2.antes->m.k is distinct from a2.depois->m.k
            order by a2.quando desc limit 1) ant
          where ant.va2 is not distinct from m.vd and ant.vd2 is not distinct from m.va)
     group by m.id
  ),
  -- 3. login de loja mexendo no cadastro da rede ou na liberação
  loja as (
    select 'loja'::text tipo, j.id,
           case when j.operacao = 'DELETE' then null
                else (select jsonb_object_agg(m.k, m.vd) from mudou m where m.id = j.id) end campos,
           case when j.operacao = 'INSERT' then null
                else (select jsonb_object_agg(m.k, m.va) from mudou m where m.id = j.id) end antes
      from janela j
     where j.suc_login is not null
       and (j.tabela in (select c.tabela from cadastro_da_rede c)
            or exists (select 1 from mudou m where m.id = j.id and m.k in ('sucursais','lojas')))
  ),
  achados as (select * from mao union all select * from volta union all select * from loja)
  select x.tipo, j.tabela, j.ref_local, j.registro_id, j.loja_id,
         coalesce(j.depois->>'sucursal_id', j.antes->>'sucursal_id', j.suc_login),
         j.aparelho, j.usuario_email, j.quando, x.campos, x.antes, j.id,
         case x.tipo
           when 'mao_unica' then j.tabela || ' ' || coalesce(j.ref_local,'') || ': voltou sem desfazer pela tela ('
                                 || (select string_agg(k || ' ' || coalesce(x.antes->>k,'—') || ' → ' || coalesce(x.campos->>k,'vazio'), ', ')
                                       from jsonb_object_keys(x.campos) k) || ')'
           when 'voltou'    then j.tabela || ' ' || coalesce(j.ref_local,'') || ': voltou ao valor anterior ('
                                 || (select string_agg(k || ' ' || coalesce(x.antes->>k,'—') || ' → ' || coalesce(x.campos->>k,'vazio'), ', ')
                                       from jsonb_object_keys(x.campos) k) || ')'
           else j.tabela || ' ' || coalesce(j.ref_local,'') || ': ' ||
                case j.operacao when 'INSERT' then 'criado' when 'DELETE' then 'excluído' else 'alterado' end ||
                ' por login de loja (' || coalesce(j.usuario_email,'?') || ')'
         end
    from achados x join janela j on j.id = x.id
  union all
  -- 4. rajada: o mesmo aparelho mudando muitas linhas no mesmo minuto
  select 'rajada', j.tabela, null, null, min(j.loja_id::text)::uuid, min(j.suc_login),
         coalesce(j.aparelho, j.usuario_email), min(j.usuario_email), date_trunc('minute', j.quando),
         jsonb_build_object('linhas', count(*)), null, max(j.id),
         j.tabela || ': ' || count(*) || ' linhas alteradas no mesmo minuto pelo mesmo aparelho'
    from janela j where j.operacao in ('INSERT','UPDATE')
   group by j.tabela, coalesce(j.aparelho, j.usuario_email), date_trunc('minute', j.quando)
  having count(*) >= 30
  union all
  -- 5. exclusão em massa (janelas de 5 minutos)
  select 'exclusao', j.tabela, null, null, min(j.loja_id::text)::uuid, min(j.suc_login),
         coalesce(j.aparelho, j.usuario_email), min(j.usuario_email), min(j.quando),
         jsonb_build_object('linhas', count(*)), null, max(j.id),
         j.tabela || ': ' || count(*) || ' linhas excluídas em 5 minutos pelo mesmo aparelho'
    from janela j where j.operacao = 'DELETE'
   group by j.tabela, coalesce(j.aparelho, j.usuario_email), floor(extract(epoch from j.quando) / 300)
  having count(*) >= 10
$$;
revoke execute on function public.vigia_dos_dados(timestamptz) from public, anon, authenticated;

-- o que o vigia acusou vai para a Central de Erros — uma linha por achado
create or replace function public.vigia_registrar_dados(p_desde timestamptz default now() - interval '70 minutes')
returns integer language plpgsql security definer set search_path to 'public'
as $$
declare r record; n int := 0; v_chave text;
begin
  for r in select * from vigia_dos_dados(p_desde) loop
    v_chave := 'dados|' || r.tipo || '|' || r.tabela || '|' || coalesce(r.ref_local, r.aparelho, '') || '|' || r.audit_id;
    if exists (select 1 from erros_sistema e where e.loja_id is not distinct from r.loja_id and e.chave = v_chave) then
      continue;
    end if;
    insert into erros_sistema (loja_id, sucursal_ref, aparelho, usuario, tipo, onde, mensagem, detalhe, chave, status)
    values (r.loja_id, r.sucursal, r.aparelho, r.usuario_email, 'dado', r.tabela, left(r.resumo, 500),
            jsonb_build_object('achado', r.tipo, 'audit_id', r.audit_id, 'tabela', r.tabela, 'ref_local', r.ref_local,
                               'registro_id', r.registro_id, 'campos', r.campos, 'antes', r.antes, 'quando', r.quando),
            v_chave, 'precisa_voce');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.vigia_registrar_dados(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. a matriz devolve como estava
-- ---------------------------------------------------------------------
create or replace function public.devolver_como_estava(p_audit_id bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  a record;
  v_atual jsonb;
  v_ks text[];
  v_sets text;
  v_n int;
  v_motivo text;
begin
  if not vejo_todas_unidades() then
    raise exception 'só a matriz devolve um dado como estava' using errcode = '42501';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'diga o motivo' using errcode = '22023';
  end if;
  select * into a from audit_log where id = p_audit_id;
  if not found or a.loja_id is null or not (a.loja_id = any (minhas_lojas())) then
    raise exception 'registro da auditoria não encontrado' using errcode = 'P0002';
  end if;
  if a.operacao = 'INSERT' then
    raise exception 'o que foi criado se tira pela tela, não por aqui' using errcode = '22023';
  end if;
  v_motivo := 'Devolvido como estava pela matriz (' || coalesce(auth.jwt()->>'email','?') || '): ' || btrim(p_motivo);
  perform set_config('joia.interno', 'devolver:' || p_audit_id, true);
  perform set_config('joia.aparelho', 'devolvido pela matriz', true);
  if a.operacao = 'UPDATE' then
    execute format('select to_jsonb(t) from public.%I t where t.id = $1', a.tabela) into v_atual using a.registro_id;
    if v_atual is null then raise exception 'a linha não existe mais' using errcode = 'P0002'; end if;
    select array_agg(k) into v_ks from jsonb_object_keys(a.depois) k
     where a.antes->k is distinct from a.depois->k
       and k <> all (lei_campos_de_servico() || array['desfazer_motivo','atualizado_em']);
    if v_ks is null then raise exception 'nada a devolver' using errcode = '22023'; end if;
    -- só devolve se ninguém mudou de novo desde então
    if exists (select 1 from unnest(v_ks) k where v_atual->k is distinct from a.depois->k) then
      raise exception 'a linha mudou de novo depois disso — confira antes de devolver' using errcode = '40001';
    end if;
    select string_agg(format('%I = (jsonb_populate_record(null::public.%I, $1)).%I', k, a.tabela, k), ', ')
      into v_sets from unnest(v_ks) k;
    if v_atual ? 'desfazer_motivo' then
      v_sets := v_sets || ', desfazer_motivo = $3';
    end if;
    execute format('update public.%I set %s where id = $2', a.tabela, v_sets) using a.antes, a.registro_id, v_motivo;
    get diagnostics v_n = row_count;
  else
    -- foi excluído: volta a linha inteira, se ela não voltou por outro caminho
    execute format('select to_jsonb(t) from public.%I t where t.id = $1', a.tabela) into v_atual using a.registro_id;
    if v_atual is not null then raise exception 'a linha já existe de novo' using errcode = '23505'; end if;
    execute format('insert into public.%I select (jsonb_populate_record(null::public.%I, $1)).*', a.tabela, a.tabela)
      using (case when a.antes ? 'desfazer_motivo' then a.antes || jsonb_build_object('desfazer_motivo', v_motivo) else a.antes end);
    get diagnostics v_n = row_count;
  end if;
  perform set_config('joia.interno', '', true);
  return jsonb_build_object('audit_id', p_audit_id, 'tabela', a.tabela, 'linhas', v_n);
end $$;
revoke execute on function public.devolver_como_estava(bigint, text) from public, anon;
grant execute on function public.devolver_como_estava(bigint, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. a fotografia dos dados, antes e uma hora depois de cada publicação
-- ---------------------------------------------------------------------
create table if not exists public.fotografias_dados (
  id      bigint generated always as identity primary key,
  quando  timestamptz not null default now(),
  versao  text not null,
  momento text not null check (momento in ('antes','depois')),
  foto    jsonb not null
);
alter table public.fotografias_dados enable row level security;
create policy "a matriz vê as fotografias" on public.fotografias_dados for select to authenticated
  using ((select vejo_todas_unidades()));
revoke all on public.fotografias_dados from anon;
revoke insert, update, delete, truncate, references, trigger on public.fotografias_dados from authenticated;

-- a mesma conta de ferramentas/fotografia-dos-dados.sql (por empresa e por unidade)
create or replace function public.fotografia_dos_dados()
returns jsonb language sql stable security definer set search_path to 'public'
as $$
  with s(x) as (select array['alterado_em','versao_vista','versao_aparelho','sucursais_vista','desfazer_motivo']::text[]),
  lin as (
    select 'contas pagas' o, x.loja_id::text l, x.id::text k, (to_jsonb(x) - (select x from s))::text v
      from lancamentos_financeiros x where x.pago
    union all select 'conciliações', x.loja_id::text, x.id::text, (to_jsonb(x) - (select x from s))::text
      from lancamentos_financeiros x where x.conciliado
    union all select 'caixas fechados', x.loja_id::text, x.id::text, (to_jsonb(x) - (select x from s))::text
      from caixas x where x.fechado_em is not null
    union all select 'fichas', x.loja_id::text, x.id::text, (to_jsonb(x) - (select x from s))::text
      from fichas_tecnicas x
    union all select 'ingredientes das fichas', f.loja_id::text, i.id::text, (to_jsonb(i) - (select x from s))::text
      from ficha_itens i join fichas_tecnicas f on f.id = i.ficha_id
    union all select 'insumos', x.loja_id::text, x.id::text, (to_jsonb(x) - (select x from s))::text
      from insumos x
    union all select 'produtos (com a liberação)', x.loja_id::text, x.id::text, (to_jsonb(x) - (select x from s))::text
      from produtos x
    union all select 'grupos de ficha (com a liberação)', x.loja_id::text, x.id::text, (to_jsonb(x) - (select x from s))::text
      from ficha_grupos x
    union all select 'unidades', x.loja_id::text, x.id::text, (to_jsonb(x) - (select x from s))::text
      from sucursais x
    union all select 'contas pagas · unidade', coalesce(x.sucursal_id, '(sem unidade)'), x.id::text, (to_jsonb(x) - (select x from s))::text
      from lancamentos_financeiros x where x.pago
    union all select 'conciliações · unidade', coalesce(x.sucursal_id, '(sem unidade)'), x.id::text, (to_jsonb(x) - (select x from s))::text
      from lancamentos_financeiros x where x.conciliado
    union all select 'caixas fechados · unidade', coalesce(x.sucursal_id, '(sem unidade)'), x.id::text, (to_jsonb(x) - (select x from s))::text
      from caixas x where x.fechado_em is not null
    union all select 'liberação de fichas · unidade', u.ref_local, f.id::text, f.id::text
      from sucursais u join fichas_tecnicas f on f.loja_id = u.loja_id
     where coalesce(f.sucursais, '[]'::jsonb) @> to_jsonb(u.ref_local)
    union all select 'liberação de insumos · unidade', u.ref_local, i.id::text, i.id::text
      from sucursais u join insumos i on i.loja_id = u.loja_id
     where coalesce(i.sucursais, '[]'::jsonb) @> to_jsonb(u.ref_local)
    union all select 'liberação de produtos · unidade', u.ref_local, p.id::text, p.id::text
      from sucursais u join produtos p on p.loja_id = u.loja_id
     where coalesce(p.sucursais, '[]'::jsonb) @> to_jsonb(u.ref_local)
    union all select 'liberação de grupos de ficha · unidade', u.ref_local, g.id::text, g.id::text
      from sucursais u join ficha_grupos g on g.loja_id = u.loja_id
     where coalesce(g.sucursais, '[]'::jsonb) @> to_jsonb(u.ref_local)
  )
  select coalesce(jsonb_agg(jsonb_build_object('o', o, 'l', l, 'n', n, 'h', h) order by o, l), '[]'::jsonb)
    from (select o, l, count(*)::int n, md5(string_agg(v, '|' order by k)) h from lin group by o, l) z
$$;
revoke execute on function public.fotografia_dos_dados() from public, anon, authenticated;

create or replace function public.fotografar_dados(p_versao text, p_momento text)
returns bigint language sql security definer set search_path to 'public'
as $$
  insert into fotografias_dados (versao, momento, foto) values (p_versao, p_momento, fotografia_dos_dados())
  returning id
$$;
revoke execute on function public.fotografar_dados(text, text) from public, anon, authenticated;

-- o que mudou entre o antes e o depois de uma versão (linha a linha: o quê, de quem)
create or replace function public.fotografia_diferencas(p_versao text)
returns table (o text, l text, n_antes int, n_depois int)
language sql stable security definer set search_path to 'public'
as $$
  with a as (select foto from fotografias_dados where versao = p_versao and momento = 'antes' order by quando desc limit 1),
       d as (select foto from fotografias_dados where versao = p_versao and momento = 'depois' order by quando desc limit 1),
       xa as (select r->>'o' o, r->>'l' l, (r->>'n')::int n, r->>'h' h from a, jsonb_array_elements(a.foto) r),
       xd as (select r->>'o' o, r->>'l' l, (r->>'n')::int n, r->>'h' h from d, jsonb_array_elements(d.foto) r)
  select coalesce(xa.o, xd.o), coalesce(xa.l, xd.l), xa.n, xd.n
    from xa full join xd on xa.o = xd.o and xa.l = xd.l
   where xa.h is distinct from xd.h
$$;
revoke execute on function public.fotografia_diferencas(text) from public, anon, authenticated;

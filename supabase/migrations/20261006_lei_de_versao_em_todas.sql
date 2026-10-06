-- =====================================================================
-- O BANCO VIRA JUIZ EM TODAS AS TABELAS (Missão integridade, fase 2 — 06/10/2026)
--
-- Rafael: "o sistema tem de parar de quebrar o que já funciona e de
-- desfazer dado sozinho." O inventário da fase 1 (MISSAO_INTEGRIDADE.md)
-- mediu ~8.100 gravações de aparelho que devolveram campo a um valor
-- anterior em 30 dias. A lei de versão (20260929_versao_vista) curava,
-- mas valia em 4 tabelas, posta uma a uma depois de cada estrago.
--
-- O que esta migration faz (tudo genérico; nenhuma regra por tabela):
--
-- 1. LEI DE VERSÃO EM TODA TABELA QUE O APARELHO GRAVA. Cada uma ganha
--    alterado_em (carimbo), versao_vista (o recibo: a versão que o
--    aparelho viu) e versao_aparelho (qual aparelho mandou). Gravação de
--    quem não viu a versão de hoje é RECUSADA — e a recusa não é perda:
-- 2. A FILA DE CONFLITOS. O que a nuvem recusa vai para
--    conflitos_sincronizacao, com o que o aparelho queria gravar, o que
--    estava, quem, de qual aparelho e quando. A matriz vê e decide
--    (decidir_conflito: aplicar ou descartar, com motivo). Nada some calado.
-- 3. A EXCLUSÃO TAMBÉM RESPEITA A VERSÃO. Linha que mudou depois que o
--    aparelho a viu não é apagada por ele (apagar_vistos). Exclusão sem
--    versão — de aparelho que ainda roda código velho — vai para a fila.
-- 4. AUDITORIA (tg_auditar) EM TODAS, para todo estrago ter o "antes" e
--    poder ser devolvido; e o audit_log passa a dizer qual aparelho.
--
-- MODO DE CADA TABELA (lei_de_versao.modo):
--   'recusar'  — a lei vale: cópia velha é recusada e vai para a fila;
--   'observar' — a gravação passa, mas o que SERIA recusado vai para a
--                fila como 'observado'. É assim que cada bloco começa: o
--                aparelho novo (que manda o recibo) roda, a fila mostra o
--                que a lei faria, e só então o bloco passa a recusar. Um
--                bloco por vez — dinheiro, estoque, cadastros, o resto —,
--                cada um com backup antes e prova no banco de cópia.
-- As quatro tabelas que já tinham a lei (contas, formas, lançamentos e
-- baixas) entram em 'recusar': para elas nada afrouxa.
--
-- O RECIBO DA RECUSA: a linha recusada volta ao aparelho com
-- versao_vista = alterado_em. É o sinal inequívoco de "recusado" — sem
-- ele, o aparelho teria de adivinhar comparando campo a campo. A linha
-- aceita volta com versao_vista nula.
--
-- Rotina interna do banco (service_role, SQL do administrador, a decisão
-- da matriz) não passa pela lei.
-- =====================================================================

-- se alguma tabela estiver presa por outra consulta, desiste em vez de
-- enfileirar as vendas atrás dela (a migration inteira volta atrás)
set local lock_timeout = '10s';

-- ---------------------------------------------------------------------
-- 0. os campos de serviço: não são conteúdo, não versionam, não auditam
-- ---------------------------------------------------------------------
create or replace function public.lei_campos_de_servico() returns text[]
  language sql immutable set search_path to 'public'
as $$ select array['alterado_em','versao_vista','versao_aparelho','sucursais_vista']::text[] $$;

-- ---------------------------------------------------------------------
-- 1. o modo de cada tabela
-- ---------------------------------------------------------------------
create table if not exists public.lei_de_versao (
  tabela text primary key,
  modo   text not null default 'observar' check (modo in ('observar','recusar')),
  desde  timestamptz not null default now(),
  motivo text
);
-- a exclusão tem o seu próprio modo. Ela nasce em observação em TODA
-- tabela, inclusive nas quatro que já recusam a cópia velha na gravação:
-- o aparelho de versão antiga apaga direto, sem dizer o que viu, e
-- recusar isso já hoje faria o lançamento apagado voltar no download.
-- Vira 'recusar' quando os aparelhos estiverem na versão que apaga pelo
-- apagar_vistos (o sinal do aparelho diz quando).
alter table public.lei_de_versao add column if not exists modo_exclusao text not null default 'observar'
  check (modo_exclusao in ('observar','recusar'));
alter table public.lei_de_versao enable row level security;
drop policy if exists "todos leem a lei" on public.lei_de_versao;
create policy "todos leem a lei" on public.lei_de_versao for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- 2. a fila de conflitos
-- ---------------------------------------------------------------------
create table if not exists public.conflitos_sincronizacao (
  id            bigint generated always as identity primary key,
  criado_em     timestamptz not null default now(),
  ultimo_em     timestamptz not null default now(),
  vezes         integer not null default 1,
  loja_id       uuid,
  sucursal      text,
  tabela        text not null,
  ref_local     text,
  registro_id   uuid,
  operacao      text not null check (operacao in ('UPDATE','DELETE','FILHOS')),
  usuario       uuid,
  usuario_email text,
  cargo         text,
  aparelho      text,
  versao_vista  timestamptz,
  versao_nuvem  timestamptz,
  queria        jsonb,
  estava        jsonb,
  filhos        jsonb,
  modo          text not null,
  situacao      text not null default 'aberto'
                check (situacao in ('aberto','observado','aplicado','descartado')),
  decidido_por  text,
  decidido_em   timestamptz,
  motivo        text,
  impressao     text not null
);
create unique index if not exists uq_conflito_aberto on public.conflitos_sincronizacao
  (tabela, coalesce(ref_local,''), coalesce(loja_id::text,''), impressao)
  where situacao in ('aberto','observado');
create index if not exists ix_conflito_loja on public.conflitos_sincronizacao (loja_id, situacao, ultimo_em desc);
alter table public.conflitos_sincronizacao enable row level security;
drop policy if exists "matriz ve os conflitos, cada login ve os seus" on public.conflitos_sincronizacao;
create policy "matriz ve os conflitos, cada login ve os seus" on public.conflitos_sincronizacao
  for select to authenticated
  using (loja_id = any ((select minhas_lojas())::uuid[])
         and ((select vejo_todas_unidades()) or usuario = (select auth.uid())));
-- nenhuma política de escrita: a fila só muda pelas funções abaixo

create or replace function public.registrar_conflito(
  p_tabela text, p_operacao text, p_linha jsonb, p_queria jsonb, p_estava jsonb,
  p_vista timestamptz, p_aparelho text, p_modo text, p_filhos jsonb default null)
returns bigint language plpgsql security definer set search_path to 'public'
as $$
declare
  v_id   bigint;
  v_loja uuid;
  v_ref  text := p_linha->>'ref_local';
  v_imp  text := md5(p_operacao || coalesce(p_queria::text,'') || coalesce(p_filhos::text,''));
  v_sit  text := case when p_modo = 'recusar' then 'aberto' else 'observado' end;
begin
  begin v_loja := coalesce((p_linha->>'loja_id')::uuid, minha_loja());
  exception when others then v_loja := minha_loja(); end;
  -- o mesmo pedido de novo (aparelho que insiste) não vira linha nova
  update conflitos_sincronizacao
     set vezes = vezes + 1, ultimo_em = now(), aparelho = coalesce(p_aparelho, aparelho)
   where tabela = p_tabela and coalesce(ref_local,'') = coalesce(v_ref,'')
     and coalesce(loja_id::text,'') = coalesce(v_loja::text,'') and impressao = v_imp
     and situacao in ('aberto','observado')
  returning id into v_id;
  if v_id is not null then return v_id; end if;
  insert into conflitos_sincronizacao (loja_id, sucursal, tabela, ref_local, registro_id, operacao,
      usuario, usuario_email, cargo, aparelho, versao_vista, versao_nuvem,
      queria, estava, filhos, modo, situacao, impressao)
  values (v_loja, coalesce(p_linha->>'sucursal_id', minha_sucursal_ref()), p_tabela, v_ref,
      begin_id(p_linha->>'id'), p_operacao, auth.uid(), auth.jwt()->>'email',
      (select cargo from perfis where id = auth.uid()), p_aparelho, p_vista,
      nullif(p_linha->>'alterado_em','')::timestamptz, p_queria, p_estava, p_filhos, p_modo, v_sit, v_imp)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.registrar_conflito(text,text,jsonb,jsonb,jsonb,timestamptz,text,text,jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. a lei de versão, uma só para todas as tabelas
-- ---------------------------------------------------------------------
create or replace function public.tg_versao_vista()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  vista    timestamptz := new.versao_vista;
  aparelho text := new.versao_aparelho;
  papel    text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '');
  modo     text;
  jn jsonb; jo jsonb; queria jsonb; estava jsonb;
begin
  new.versao_vista := null;
  new.versao_aparelho := null;
  if aparelho is not null then perform set_config('joia.aparelho', left(aparelho, 80), true); end if;
  if papel <> 'authenticated' or coalesce(current_setting('joia.interno', true), '') <> '' then
    return new;
  end if;
  -- gravação feita por outro gatilho (o cancelamento marca o pedido, o
  -- estorno mexe no saldo): quem a disparou já foi julgado
  if pg_trigger_depth() > 1 then return new; end if;
  -- viu a versão de hoje (ou a linha ainda não tem versão): passa
  if old.alterado_em is null or (vista is not null and vista >= old.alterado_em) then
    return new;
  end if;
  select l.modo into modo from lei_de_versao l where l.tabela = tg_table_name;
  modo := coalesce(modo, 'recusar');
  -- em observação, aparelho velho (sem recibo) não enche a fila
  if modo = 'observar' and vista is null then return new; end if;
  -- o que o aparelho queria mudar, campo a campo
  jn := to_jsonb(new) - lei_campos_de_servico();
  jo := to_jsonb(old) - lei_campos_de_servico();
  select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb),
         coalesce(jsonb_object_agg(n.key, jo->n.key), '{}'::jsonb)
    into queria, estava
    from jsonb_each(jn) n
   where n.value is distinct from jo->n.key;
  -- não muda nada: não há o que recusar
  if queria = '{}'::jsonb then return new; end if;
  perform registrar_conflito(tg_table_name, 'UPDATE', to_jsonb(old), queria, estava, vista, aparelho, modo);
  if modo = 'observar' then return new; end if;
  raise warning '% %: cópia antiga recusada (o aparelho viu %, a nuvem está em %) — foi para a fila de conflitos',
    tg_table_name, to_jsonb(old)->>'ref_local', vista, old.alterado_em;
  old.versao_vista := old.alterado_em;          -- o recibo da recusa
  return old;
end $$;

-- ---------------------------------------------------------------------
-- 4. a exclusão respeita a versão
-- ---------------------------------------------------------------------
create or replace function public.tg_exclusao_vista()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  papel    text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '');
  vista    timestamptz;
  modo     text;
  aparelho text := nullif(current_setting('joia.aparelho', true), '');
begin
  if papel <> 'authenticated' or coalesce(current_setting('joia.interno', true), '') <> '' then
    return old;
  end if;
  -- exclusão em cascata (o pai foi apagado): o pai já foi julgado
  if pg_trigger_depth() > 1 then return old; end if;
  begin vista := nullif(current_setting('joia.vista', true), '')::timestamptz;
  exception when others then vista := null; end;
  if vista is not null and (old.alterado_em is null or old.alterado_em <= vista) then
    return old;
  end if;
  select l.modo_exclusao into modo from lei_de_versao l where l.tabela = tg_table_name;
  modo := coalesce(modo, 'recusar');
  -- em observação, aparelho que não diz o que viu (versão antiga) não enche a fila
  if modo = 'observar' and vista is null then return old; end if;
  perform registrar_conflito(tg_table_name, 'DELETE', to_jsonb(old), null,
    to_jsonb(old) - lei_campos_de_servico(), vista, aparelho, modo);
  if modo = 'observar' then return old; end if;
  raise warning '% %: exclusão recusada (o aparelho viu %, a linha mudou em %) — foi para a fila de conflitos',
    tg_table_name, to_jsonb(old)->>'ref_local', vista, old.alterado_em;
  return null;
end $$;

-- a porta da exclusão com versão: o aparelho diz até quando viu
create or replace function public.apagar_vistos(
  p_tabela text, p_vista timestamptz, p_aparelho text default null,
  p_refs text[] default null, p_pai_coluna text default null, p_pai uuid default null,
  p_manter text[] default null, p_loja uuid default null)
returns jsonb language plpgsql set search_path to 'public', 'pg_temp'
as $$
declare
  v_apagados text[];
  v_loja text := '';
begin
  if not exists (select 1 from lei_de_versao where tabela = p_tabela) then
    raise exception 'tabela % fora da lei de versão', p_tabela using errcode = '22023';
  end if;
  if p_vista is null then
    raise exception 'apagar_vistos exige a versão vista' using errcode = '22023';
  end if;
  if p_loja is not null and exists (select 1 from information_schema.columns
       where table_schema = 'public' and table_name = p_tabela and column_name = 'loja_id') then
    v_loja := format(' and loja_id = %L', p_loja);
  end if;
  perform set_config('joia.vista', p_vista::text, true);
  if p_aparelho is not null then perform set_config('joia.aparelho', left(p_aparelho, 80), true); end if;
  if p_refs is not null then
    execute format('with x as (delete from public.%I where ref_local = any($1)%s returning ref_local)
                    select coalesce(array_agg(ref_local), ''{}'') from x', p_tabela, v_loja)
      into v_apagados using p_refs;
  elsif p_pai_coluna is not null and p_pai is not null then
    if not exists (select 1 from information_schema.columns
         where table_schema = 'public' and table_name = p_tabela and column_name = p_pai_coluna) then
      raise exception 'coluna % não existe em %', p_pai_coluna, p_tabela using errcode = '22023';
    end if;
    if exists (select 1 from information_schema.columns
         where table_schema = 'public' and table_name = p_tabela and column_name = 'ref_local') then
      execute format('with x as (delete from public.%I where %I = $1 and not (coalesce(ref_local,'''') = any($2))%s
                      returning ref_local) select coalesce(array_agg(ref_local), ''{}'') from x',
                     p_tabela, p_pai_coluna, v_loja)
        into v_apagados using p_pai, coalesce(p_manter, '{}'::text[]);
    else
      execute format('with x as (delete from public.%I where %I = $1%s returning %I::text k)
                      select coalesce(array_agg(k), ''{}'') from x', p_tabela, p_pai_coluna, v_loja, p_pai_coluna)
        into v_apagados using p_pai;
    end if;
  else
    raise exception 'apagar_vistos: diga o que apagar (refs ou pai)' using errcode = '22023';
  end if;
  perform set_config('joia.vista', '', true);
  return jsonb_build_object('apagados', to_jsonb(coalesce(v_apagados, '{}'::text[])));
end $$;

-- ---------------------------------------------------------------------
-- 5. filhos seguem o pai: o aparelho cujo pai foi recusado não manda os
--    filhos — e anexa ao conflito o que queria gravar neles
-- ---------------------------------------------------------------------
create or replace function public.anexar_filhos_ao_conflito(
  p_tabela text, p_ref_local text, p_filhos jsonb, p_aparelho text default null)
returns bigint language plpgsql security definer set search_path to 'public'
as $$
declare v_id bigint;
begin
  if auth.uid() is null or minha_loja() is null then
    raise exception 'sem login de loja' using errcode = '42501';
  end if;
  select id into v_id from conflitos_sincronizacao
   where tabela = p_tabela and ref_local = p_ref_local and usuario = auth.uid()
     and situacao in ('aberto','observado') and operacao = 'UPDATE'
   order by ultimo_em desc limit 1;
  if v_id is not null then
    update conflitos_sincronizacao set filhos = p_filhos, ultimo_em = now() where id = v_id;
    return v_id;
  end if;
  return registrar_conflito(p_tabela, 'FILHOS',
    jsonb_build_object('ref_local', p_ref_local, 'loja_id', minha_loja()),
    null, null, null, p_aparelho, 'recusar', p_filhos);
end $$;

-- ---------------------------------------------------------------------
-- 6. a matriz decide: aplicar o que o aparelho queria, ou descartar
-- ---------------------------------------------------------------------
create or replace function public.decidir_conflito(p_id bigint, p_decisao text, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  c record;
  v_sets text;
  v_onde text;
  v_n int;
begin
  if not vejo_todas_unidades() then
    raise exception 'só a matriz decide conflito' using errcode = '42501';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'diga o motivo da decisão' using errcode = '22023';
  end if;
  if p_decisao not in ('aplicar','descartar') then
    raise exception 'a decisão é aplicar ou descartar' using errcode = '22023';
  end if;
  select * into c from conflitos_sincronizacao where id = p_id for update;
  if not found or not (c.loja_id = any (minhas_lojas())) then
    raise exception 'conflito não encontrado' using errcode = 'P0002';
  end if;
  if c.situacao not in ('aberto','observado') then
    raise exception 'conflito já decidido (%)', c.situacao using errcode = '22023';
  end if;
  if c.registro_id is not null then v_onde := 'id = $2';
  elsif c.ref_local is not null then v_onde := 'loja_id = $3 and ref_local = $4';
  else v_onde := 'loja_id = $3';
  end if;
  if p_decisao = 'aplicar' and c.operacao = 'DELETE' then
    -- a exclusão que foi recusada passa a valer, por decisão da matriz
    perform set_config('joia.interno', 'decisao:' || p_id, true);
    perform set_config('joia.aparelho', 'decisão da matriz', true);
    execute format('delete from public.%I where %s', c.tabela, v_onde)
      using null::jsonb, c.registro_id, c.loja_id, c.ref_local;
    perform set_config('joia.interno', '', true);
  elsif p_decisao = 'aplicar' then
    if c.operacao <> 'UPDATE' or c.queria is null or c.queria = '{}'::jsonb then
      raise exception 'só alteração ou exclusão recusada pode ser aplicada' using errcode = '22023';
    end if;
    select string_agg(format('%I = (jsonb_populate_record(null::public.%I, $1)).%I', k, c.tabela, k), ', ')
      into v_sets from jsonb_object_keys(c.queria) k;
    perform set_config('joia.interno', 'decisao:' || p_id, true);
    perform set_config('joia.aparelho', 'decisão da matriz', true);
    execute format('update public.%I set %s where %s', c.tabela, v_sets, v_onde)
      using c.queria, c.registro_id, c.loja_id, c.ref_local;
    get diagnostics v_n = row_count;
    perform set_config('joia.interno', '', true);
    if v_n = 0 then raise exception 'a linha não existe mais' using errcode = 'P0002'; end if;
  end if;
  update conflitos_sincronizacao
     set situacao = case when p_decisao = 'aplicar' then 'aplicado' else 'descartado' end,
         decidido_por = auth.jwt()->>'email', decidido_em = now(), motivo = p_motivo
   where id = p_id;
  return jsonb_build_object('id', p_id, 'situacao',
    case when p_decisao = 'aplicar' then 'aplicado' else 'descartado' end);
end $$;

-- ---------------------------------------------------------------------
-- 7. carimbo, versão da loja e auditoria ignoram os campos de serviço;
--    a auditoria passa a dizer qual aparelho
-- ---------------------------------------------------------------------
create or replace function public.carimbar_alteracao()
returns trigger language plpgsql set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    new.alterado_em := now();
    -- o aparelho que criou a linha também fica na auditoria
    if to_jsonb(new)->>'versao_aparelho' is not null then
      perform set_config('joia.aparelho', left(to_jsonb(new)->>'versao_aparelho', 80), true);
    end if;
  elsif (to_jsonb(new) - lei_campos_de_servico()) is distinct from (to_jsonb(old) - lei_campos_de_servico()) then
    new.alterado_em := now();
  else
    new.alterado_em := old.alterado_em;
  end if;
  return new;
end $$;

create or replace function public.bump_loja_versao()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare
  v_txt text;
  v_loja uuid;
begin
  -- gravação que não mudou nada não é versão nova (04/10/2026)
  if tg_op = 'UPDATE' and (to_jsonb(new) - lei_campos_de_servico())
                         = (to_jsonb(old) - lei_campos_de_servico()) then
    return new;
  end if;
  v_txt := coalesce(new.loja_id::text, old.loja_id::text);
  if v_txt is null then return coalesce(new, old); end if;
  if v_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then return coalesce(new, old);
  end if;
  v_loja := v_txt::uuid;
  insert into public.loja_versao (loja_id, versao, atualizado_em)
       values (v_loja, 1, now())
  on conflict (loja_id) do update
       set versao = public.loja_versao.versao + 1, atualizado_em = now();
  return coalesce(new, old);
end $$;

alter table public.audit_log add column if not exists aparelho text;

create or replace function public.tg_auditar()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare r record; lj uuid; em text; jantes jsonb; jdepois jsonb; k text;
  sensiveis text[] := array[
    'senha','senha_hash','token','access_token','refresh_token',
    'api_key','apikey','chave','chave_api','secret','app_secret',
    'meta_token','meta_app_secret','webhook_token','verify_token',
    'sessao','session','credencial','credenciais','qr','qrcode'];
begin
  -- gravação que não mudou conteúdo não é alteração: só carimbo e recibo
  -- (alterado_em, versao_vista, versao_aparelho, sucursais_vista) não auditam
  if tg_op = 'UPDATE' and (to_jsonb(old) - lei_campos_de_servico()) = (to_jsonb(new) - lei_campos_de_servico()) then
    return new;
  end if;

  r := coalesce(new, old);
  begin lj := (to_jsonb(r)->>'loja_id')::uuid; exception when others then lj := null; end;
  select email into em from auth.users where id = auth.uid();

  jantes  := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  jdepois := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;

  foreach k in array sensiveis loop
    if jantes ? k or jdepois ? k then
      if tg_op = 'UPDATE'
         and (jantes->>k) is distinct from (jdepois->>k) then
        jdepois := jsonb_set(coalesce(jdepois,'{}'::jsonb), array[k],
                             to_jsonb('(alterado)'::text));
      elsif jdepois ? k then
        jdepois := jdepois - k;
      end if;
      jantes := jantes - k;
    end if;
  end loop;

  insert into audit_log(loja_id, usuario, usuario_email, cargo, tabela, operacao,
                        registro_id, ref_local, antes, depois, aparelho)
  values (lj, auth.uid(), em, (select cargo from perfis where id = auth.uid()),
    tg_table_name, tg_op, begin_id(to_jsonb(r)->>'id'), to_jsonb(r)->>'ref_local',
    jantes, jdepois, nullif(current_setting('joia.aparelho', true), ''));
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------
-- 8. o instalador: uma chamada por tabela, sempre a mesma
-- ---------------------------------------------------------------------
create or replace function public.instalar_lei_de_versao(p_tabela text, p_modo text default 'observar')
returns void language plpgsql set search_path to 'public'
as $$
declare t regclass := ('public.' || quote_ident(p_tabela))::regclass;
begin
  execute format('alter table public.%I add column if not exists alterado_em timestamptz default now()', p_tabela);
  execute format('alter table public.%I add column if not exists versao_vista timestamptz', p_tabela);
  execute format('alter table public.%I add column if not exists versao_aparelho text', p_tabela);
  if not exists (select 1 from pg_trigger where tgrelid = t and tgname = 'zz_carimbar_alteracao') then
    execute format('create trigger zz_carimbar_alteracao before insert or update on public.%I
                    for each row execute function carimbar_alteracao()', p_tabela);
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = t and tgname = 'ab_versao_vista') then
    execute format('create trigger ab_versao_vista before update on public.%I
                    for each row execute function tg_versao_vista()', p_tabela);
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = t and tgname = 'ab_exclusao_vista') then
    execute format('create trigger ab_exclusao_vista before delete on public.%I
                    for each row execute function tg_exclusao_vista()', p_tabela);
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = t and tgname = 'tg_auditar') then
    execute format('create trigger tg_auditar after insert or update or delete on public.%I
                    for each row execute function tg_auditar()', p_tabela);
  end if;
  insert into lei_de_versao (tabela, modo, motivo)
  values (p_tabela, p_modo, 'instalada pela migration 20261006_lei_de_versao_em_todas')
  on conflict (tabela) do nothing;
end $$;
revoke execute on function public.instalar_lei_de_versao(text,text) from public, anon, authenticated;

-- a fila de conflitos também é auditada
drop trigger if exists tg_auditar on public.conflitos_sincronizacao;
create trigger tg_auditar after insert or update or delete on public.conflitos_sincronizacao
  for each row execute function tg_auditar();

-- ---------------------------------------------------------------------
-- 9. as 60 tabelas — as 58 do MAPA do motor (src/js/03-armazenamento,
--    var MAPA) mais config_loja e config_operacao, que o motor grava
--    direto. Lista conferida contra o MAPA por
--    testes/lei-de-versao-em-todas.js; tabela nova no MAPA sem lei
--    reprova no portão (ferramentas/conferir-nuvem.js).
-- ---------------------------------------------------------------------
select public.instalar_lei_de_versao(t, 'recusar')
  from unnest(array['contas_capital','formas_pagamento','lancamentos_financeiros','baixas_pendentes']) t;
select public.instalar_lei_de_versao(t, 'observar')
  from unnest(array[
    'categorias_financeiras','subcategorias_financeiras','usuarios_sistema','fornecedores',
    'unidades_medida','grupos_ingredientes','insumos','ficha_grupos','fichas_tecnicas','ficha_itens',
    'pedidos_base','pedido_base_itens','bases_catalogo','motivos_movimentacao','motivos_cancelamento',
    'status_venda','modelos_impressao','cupons_fiscais','mesa_comandas','transferencias','mesas','turnos',
    'cancelamentos','estoque_unidade','lotes_estoque','movimentacoes_estoque','contagens_estoque',
    'categorias','grupos_opcoes','opcoes','produtos','produto_grupos','clientes','entregadores',
    'entregador_taxas','caixas','caixa_movimentos','pedidos','pedido_itens','pedido_pagamentos',
    'acertos','indicadores_manuais','cupons','cupom_usos','fiado_movimentos','cardapio_config',
    'areas_entrega','areas_zonas','sucursais','ordens_producao','notas_entrada','clientes_nexor',
    'compras_sem_vinculo','lotes_financeiros','config_loja','config_operacao']) t;

-- só quem tem login; o visitante (anon) não chama nada disto, e a fila e a
-- lei só se leem — escrever, só pelas funções
revoke execute on function public.apagar_vistos(text,timestamptz,text,text[],text,uuid,text[],uuid) from public, anon;
revoke execute on function public.decidir_conflito(bigint,text,text) from public, anon;
revoke execute on function public.anexar_filhos_ao_conflito(text,text,jsonb,text) from public, anon;
revoke execute on function public.tg_versao_vista() from public, anon, authenticated;
revoke execute on function public.tg_exclusao_vista() from public, anon, authenticated;
grant execute on function public.apagar_vistos(text,timestamptz,text,text[],text,uuid,text[],uuid) to authenticated;
grant execute on function public.decidir_conflito(bigint,text,text) to authenticated;
grant execute on function public.anexar_filhos_ao_conflito(text,text,jsonb,text) to authenticated;
revoke all on public.lei_de_versao, public.conflitos_sincronizacao from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.lei_de_versao, public.conflitos_sincronizacao from authenticated;
grant select on public.lei_de_versao, public.conflitos_sincronizacao to authenticated;

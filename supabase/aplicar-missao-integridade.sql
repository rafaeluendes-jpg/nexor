-- =====================================================================
-- JOIA — MISSÃO INTEGRIDADE: AS TRÊS MUDANÇAS NO BANCO, DE UMA VEZ
--
-- Para rodar no painel do Supabase (SQL Editor → New query → colar → Run).
-- É tudo ou nada: se qualquer parte falhar, NADA muda (begin … commit).
-- Conteúdo: as três migrations de 06/10/2026, na ordem, sem alteração:
--   supabase/migrations/20261006_lei_de_versao_em_todas.sql
--   supabase/migrations/20261006_mao_unica_e_cadastro_da_rede.sql
--   supabase/migrations/20261006_vigia_dos_dados.sql
-- Antes: backup copia_seguranca."fases20261006_*" (60 de 60 tabelas) e
-- fotografia dos dados (impressão b9a4ff67ca0dabf79bc96429de68d10c).
-- =====================================================================
begin;

-- ===================== 20261006_lei_de_versao_em_todas.sql =====================
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

-- ===================== 20261006_mao_unica_e_cadastro_da_rede.sql =====================
-- =====================================================================
-- O QUE ANDA PARA FRENTE NÃO VOLTA SOZINHO, E A LOJA NÃO GRAVA O
-- CADASTRO DA REDE (Missão integridade, fase 3 — 06/10/2026)
--
-- A régua da fase 1 contou, em 30 dias: lançamento conciliado que voltou
-- a não conciliado (16), pago que voltou a não pago (7), baixa lançada que
-- voltou a pendente (13), pedido de base entregue que voltou a confirmado
-- (1). Nenhuma dessas voltas passou por uma tela de "desfazer": foi
-- aparelho regravando cópia. E 13.500 alterações em insumos e fichas
-- vieram de logins de LOJA, num cadastro que só a matriz edita — a trava
-- era só do navegador.
--
-- 1. ESTADOS DE MÃO ÚNICA (estados_mao_unica): cada regra diz o que é
--    "voltar" numa coluna — 'desmarca' (verdadeiro → falso), 'esvazia'
--    (preenchido → vazio) ou 'ordem' (um passo para trás numa sequência).
--    Voltar só vale com DESFAZER: a gravação traz `desfazer_motivo` novo
--    (a tela pergunta o porquê e põe quem e quando). O motivo fica na
--    própria linha — e por isso na auditoria, no "depois". Sem motivo, em
--    'recusar' a coluna fica como estava e o pedido vai para a fila de
--    conflitos; em 'observar' passa e vai para a fila como observado.
-- 2. CADASTRO DA REDE (cadastro_da_rede): nas tabelas que só a matriz
--    edita, gravação de login de loja vai para a fila; em 'recusar' não
--    muda nada.
--
-- Tudo nasce em 'observar': aparelho de versão antiga ainda desfaz sem
-- motivo e ainda sobe cadastro por login de loja. A fila mostra o que a
-- regra faria; quando os aparelhos estiverem na versão que pergunta o
-- motivo (V428), a regra passa a recusar — um bloco por vez, com backup e
-- prova no banco de cópia.
-- =====================================================================
set local lock_timeout = '10s';

-- a fila ganha os dois tipos novos de pedido
alter table public.conflitos_sincronizacao drop constraint if exists conflitos_sincronizacao_operacao_check;
alter table public.conflitos_sincronizacao add constraint conflitos_sincronizacao_operacao_check
  check (operacao in ('UPDATE','DELETE','FILHOS','VOLTA','CADASTRO'));

-- ---------------------------------------------------------------------
-- 1. as regras de mão única
-- ---------------------------------------------------------------------
create table if not exists public.estados_mao_unica (
  tabela text not null,
  coluna text not null,
  regra  text not null check (regra in ('desmarca','esvazia','ordem')),
  ordem  text[],
  modo   text not null default 'observar' check (modo in ('observar','recusar')),
  desde  timestamptz not null default now(),
  primary key (tabela, coluna)
);
alter table public.estados_mao_unica enable row level security;
drop policy if exists "todos leem as regras" on public.estados_mao_unica;
create policy "todos leem as regras" on public.estados_mao_unica for select to authenticated using (true);

insert into public.estados_mao_unica (tabela, coluna, regra, ordem) values
  ('lancamentos_financeiros','pago','desmarca',null),
  ('lancamentos_financeiros','conciliado','desmarca',null),
  ('lancamentos_financeiros','cancelado','desmarca',null),
  ('baixas_pendentes','situacao','ordem',array['pendente','lancada']),
  ('baixas_pendentes','lancada_em','esvazia',null),
  -- (o fechamento do caixa já tem trava própria e mais forte:
  --  ab_fechamento_nao_se_apaga — nem o desfazer o reabre)
  ('caixas','conciliado','desmarca',null),
  ('pedido_pagamentos','situacao','ordem',array['recebido','estornado']),
  ('pedido_pagamentos','estornado_em','esvazia',null),
  ('pedidos_base','enviado_em','esvazia',null),
  ('pedidos_base','confirmado_em','esvazia',null),
  ('pedidos_base','entregue_em','esvazia',null),
  ('pedidos_base','pago_em','esvazia',null),
  ('notas_entrada','excluida_em','esvazia',null),
  ('lotes_financeiros','desfeito','desmarca',null),
  ('transferencias','situacao','ordem',array['enviada','recebida']),
  ('transferencias','recebida_em','esvazia',null),
  ('contagens_estoque','lancada_em','esvazia',null),
  ('cupons_fiscais','status','ordem',array['pendente','autorizado']),
  ('cupons_fiscais','emitido_em','esvazia',null),
  ('cupons_fiscais','cancelado_em','esvazia',null)
on conflict (tabela, coluna) do nothing;

create or replace function public.tg_mao_unica()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  papel  text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '');
  r      record;
  jn     jsonb;
  jo     jsonb;
  a      jsonb;
  b      jsonb;
  volta  boolean;
  voltas jsonb := '{}'::jsonb;
  antes  jsonb := '{}'::jsonb;
  recusa boolean := false;
  desfaz boolean;
begin
  if papel <> 'authenticated' or coalesce(current_setting('joia.interno', true), '') <> '' then
    return new;
  end if;
  if pg_trigger_depth() > 1 then return new; end if;
  jn := to_jsonb(new);
  jo := to_jsonb(old);
  -- desfazer de verdade: a tela mandou um motivo NOVO
  desfaz := coalesce(btrim(jn->>'desfazer_motivo'), '') <> ''
            and (jn->>'desfazer_motivo') is distinct from (jo->>'desfazer_motivo');
  if desfaz then return new; end if;
  for r in select * from estados_mao_unica e where e.tabela = tg_table_name loop
    a := jo->r.coluna;
    b := jn->r.coluna;
    if a is null or a = 'null'::jsonb or a is not distinct from b then continue; end if;
    volta := case r.regra
      when 'desmarca' then a = 'true'::jsonb and (b is null or b = 'null'::jsonb or b = 'false'::jsonb)
      when 'esvazia'  then b is null or b = 'null'::jsonb or b = '""'::jsonb
      when 'ordem'    then coalesce(array_position(r.ordem, b #>> '{}'), 0) > 0
                           and array_position(r.ordem, b #>> '{}') < coalesce(array_position(r.ordem, a #>> '{}'), 0)
      else false end;
    if volta then
      voltas := voltas || jsonb_build_object(r.coluna, b);
      antes  := antes  || jsonb_build_object(r.coluna, a);
      if r.modo = 'recusar' then
        recusa := true;
        jn := jsonb_set(jn, array[r.coluna], a);
      end if;
    end if;
  end loop;
  if voltas = '{}'::jsonb then return new; end if;
  perform registrar_conflito(tg_table_name, 'VOLTA', jo, voltas, antes,
    nullif(jn->>'versao_vista','')::timestamptz, nullif(current_setting('joia.aparelho', true), ''),
    case when recusa then 'recusar' else 'observar' end);
  if recusa then
    raise warning '% %: estado de mão única voltou sem desfazer (%) — mantido como estava, pedido na fila',
      tg_table_name, jo->>'ref_local', voltas;
    new := jsonb_populate_record(new, jn);
  end if;
  return new;
end $$;
revoke execute on function public.tg_mao_unica() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. o cadastro da rede: só a matriz grava
-- ---------------------------------------------------------------------
create table if not exists public.cadastro_da_rede (
  tabela text primary key,
  modo   text not null default 'observar' check (modo in ('observar','recusar')),
  desde  timestamptz not null default now()
);
alter table public.cadastro_da_rede enable row level security;
drop policy if exists "todos leem o cadastro da rede" on public.cadastro_da_rede;
create policy "todos leem o cadastro da rede" on public.cadastro_da_rede for select to authenticated using (true);
-- as quatro que o aparelho já não sobe por login de loja (V427,
-- TABS_SO_A_MATRIZ_GRAVA) e os ingredientes das fichas
insert into public.cadastro_da_rede (tabela) values
  ('insumos'),('fichas_tecnicas'),('ficha_grupos'),('grupos_ingredientes'),('ficha_itens')
on conflict (tabela) do nothing;

create or replace function public.tg_cadastro_da_rede()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  papel text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '');
  modo  text;
  linha jsonb;
  jn jsonb; jo jsonb; queria jsonb; estava jsonb;
begin
  if papel <> 'authenticated' or coalesce(current_setting('joia.interno', true), '') <> '' then
    return coalesce(new, old);
  end if;
  if pg_trigger_depth() > 1 then return coalesce(new, old); end if;
  if vejo_todas_unidades() or sou_plataforma() then return coalesce(new, old); end if;
  select c.modo into modo from cadastro_da_rede c where c.tabela = tg_table_name;
  if modo is null then return coalesce(new, old); end if;
  -- gravação que não muda conteúdo não é edição do cadastro
  if tg_op = 'UPDATE' and (to_jsonb(new) - lei_campos_de_servico()) = (to_jsonb(old) - lei_campos_de_servico()) then
    return new;
  end if;
  linha := to_jsonb(coalesce(old, new));
  if tg_op = 'UPDATE' then
    -- só o que mudou (a ficha inteira, com foto, encheria a fila)
    jn := to_jsonb(new) - lei_campos_de_servico();
    jo := to_jsonb(old) - lei_campos_de_servico();
    select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb),
           coalesce(jsonb_object_agg(n.key, jo->n.key), '{}'::jsonb)
      into queria, estava
      from jsonb_each(jn) n where n.value is distinct from jo->n.key;
  elsif tg_op = 'INSERT' then
    queria := to_jsonb(new) - lei_campos_de_servico();
  else
    estava := jsonb_build_object('ref_local', linha->>'ref_local', 'id', linha->>'id');
  end if;
  perform registrar_conflito(tg_table_name, 'CADASTRO', linha, queria, estava,
    null, nullif(current_setting('joia.aparelho', true), ''), modo);
  if modo = 'observar' then return coalesce(new, old); end if;
  raise warning '% %: login de loja tentou mudar o cadastro da rede (%) — nada mudou, pedido na fila',
    tg_table_name, linha->>'ref_local', tg_op;
  if tg_op = 'UPDATE' then
    old.versao_vista := old.alterado_em;      -- o recibo da recusa, como na lei de versão
    return old;
  end if;
  return null;
end $$;
revoke execute on function public.tg_cadastro_da_rede() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. instala nas tabelas: a coluna do motivo em todas as da lei (o
--    aparelho a manda em qualquer uma); o gatilho de mão única nas que
--    têm regra; o do cadastro nas da rede
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tabela from lei_de_versao loop
    execute format('alter table public.%I add column if not exists desfazer_motivo text', t);
  end loop;
  for t in select distinct tabela from estados_mao_unica loop
    execute format('drop trigger if exists ac_mao_unica on public.%I', t);
    execute format('create trigger ac_mao_unica before update on public.%I
                    for each row execute function tg_mao_unica()', t);
  end loop;
  for t in select tabela from cadastro_da_rede loop
    execute format('drop trigger if exists aa_cadastro_da_rede on public.%I', t);
    execute format('create trigger aa_cadastro_da_rede before insert or update or delete on public.%I
                    for each row execute function tg_cadastro_da_rede()', t);
  end loop;
end $$;

revoke all on public.estados_mao_unica, public.cadastro_da_rede from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.estados_mao_unica, public.cadastro_da_rede from authenticated;
grant select on public.estados_mao_unica, public.cadastro_da_rede to authenticated;

-- ===================== 20261006_vigia_dos_dados.sql =====================
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
drop policy if exists "a matriz vê as fotografias" on public.fotografias_dados;
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
commit;

-- a resposta que aparece embaixo, depois do Run: as três partes entraram
select (select count(*) from public.lei_de_versao)            as tabelas_sob_a_lei,      -- 60
       (select count(*) from public.estados_mao_unica)        as regras_de_mao_unica,    -- 20
       (select count(*) from public.cadastro_da_rede)         as tabelas_da_rede,        -- 5
       (select count(*) from pg_proc where proname = 'vigia_dos_dados') as vigia_pronto; -- 1

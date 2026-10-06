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

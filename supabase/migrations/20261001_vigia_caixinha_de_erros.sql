-- Vigia: a caixinha de erros (Rafael, 01/10/2026: "pode ligar o vigia").
-- Todo aparelho registra aqui o que deu errado; o vigia de hora em hora
-- le, corrige e escreve o que fez. O mesmo erro nao vira mil linhas: a
-- chave junta as repeticoes e conta as vezes.
create table if not exists public.erros_sistema (
  id            uuid primary key default gen_random_uuid(),
  loja_id       uuid not null,
  sucursal_ref  text,
  aparelho      text,
  usuario       text,
  versao        text,
  tipo          text not null,          -- fiscal | nuvem | tela | rede | interno | vigia
  onde          text,
  mensagem      text not null,
  detalhe       jsonb,
  pedido_ref    text,
  chave         text not null,
  vezes         integer not null default 1,
  primeiro_em   timestamptz not null default now(),
  ultimo_em     timestamptz not null default now(),
  status        text not null default 'aberto'
                check (status in ('aberto','corrigindo','resolvido','precisa_voce')),
  resolucao     text,
  resolvido_em  timestamptz,
  resolvido_por text
);
create index if not exists erros_sistema_loja_status on public.erros_sistema (loja_id, status, ultimo_em desc);
create index if not exists erros_sistema_chave on public.erros_sistema (loja_id, chave);

alter table public.erros_sistema enable row level security;
revoke all on public.erros_sistema from anon;
revoke insert, delete on public.erros_sistema from authenticated;
grant select, update on public.erros_sistema to authenticated;

drop policy if exists erros_ver on public.erros_sistema;
create policy erros_ver on public.erros_sistema for select to authenticated
  using ((public.sou_admin() or public.sou_plataforma()) and loja_id = public.minha_loja());
drop policy if exists erros_resolver on public.erros_sistema;
create policy erros_resolver on public.erros_sistema for update to authenticated
  using ((public.sou_admin() or public.sou_plataforma()) and loja_id = public.minha_loja())
  with check ((public.sou_admin() or public.sou_plataforma()) and loja_id = public.minha_loja());

-- a unica porta de entrada: a loja vem da sessao, nunca do aparelho
create or replace function public.registrar_erro(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loja uuid := public.minha_loja();
  v_chave text := left(coalesce(p->>'chave', ''), 300);
  v_id uuid;
begin
  if auth.uid() is null or v_loja is null or v_chave = '' then return; end if;
  update public.erros_sistema
     set vezes = vezes + greatest(1, least(coalesce((p->>'vezes')::int, 1), 1000)),
         ultimo_em = now(),
         detalhe = coalesce(p->'detalhe', detalhe),
         versao = coalesce(left(p->>'versao', 20), versao)
   where loja_id = v_loja and chave = v_chave and status <> 'resolvido'
   returning id into v_id;
  if v_id is not null then return; end if;
  insert into public.erros_sistema
    (loja_id, sucursal_ref, aparelho, usuario, versao, tipo, onde, mensagem, detalhe, pedido_ref, chave, vezes)
  values
    (v_loja, left(p->>'sucursal', 80), left(p->>'aparelho', 80), left(p->>'usuario', 120),
     left(p->>'versao', 20), left(coalesce(p->>'tipo', 'interno'), 20), left(p->>'onde', 120),
     left(coalesce(p->>'mensagem', '—'), 600), p->'detalhe', left(p->>'pedido', 80), v_chave,
     greatest(1, least(coalesce((p->>'vezes')::int, 1), 1000)));
end $$;
revoke all on function public.registrar_erro(jsonb) from public, anon;
grant execute on function public.registrar_erro(jsonb) to authenticated;

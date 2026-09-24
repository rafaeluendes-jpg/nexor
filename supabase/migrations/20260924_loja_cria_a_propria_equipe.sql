-- =====================================================================
-- JOIA — a loja cria a própria equipe (Rafael, 24/09/2026)
--
-- "A matriz cria o login de Santa Fé. As lojas franqueadas criam os
-- acessos de operador, atendente, produção."
--
-- O login principal da loja é `perfis.cargo = 'gerente'` com
-- `sucursal_ref` (a unidade dele). Até aqui, só admin/plataforma
-- gravavam em usuarios_sistema. Agora o gerente de unidade administra a
-- EQUIPE da unidade dele, com travas no banco (não no navegador):
--   - só linhas cuja unidade é exatamente a dele;
--   - nunca o próprio login, nunca acesso total, nunca mestre;
--   - nunca o login de quem não é operador/caixa daquela unidade;
--   - as telas que ele libera para a equipe são no máximo as que ele tem.
-- E a exclusão de acesso (usuario_excluir), que aceitava qualquer login
-- da empresa, passa a exigir quem pode.
-- =====================================================================

-- a unidade do gerente logado (nulo para qualquer outro cargo)
create or replace function public.minha_unidade_gerente()
returns text language sql stable security definer set search_path to 'public' as $$
  select case when conta_ativa() then
    (select p.sucursal_ref from perfis p
      where p.id = auth.uid() and p.cargo = 'gerente' and p.sucursal_ref is not null)
  end;
$$;

-- o login é da equipe (operador/caixa) da unidade do gerente logado — ou
-- ainda não tem conta nenhuma
create or replace function public.login_da_minha_equipe(p_loja uuid, p_login text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select minha_unidade_gerente() is not null and not exists (
    select 1 from auth.users a join perfis p on p.id = a.id
     where lower(a.email) = lower(p_login)
       and not (p.cargo in ('operador','caixa') and p.loja_id = p_loja
                and p.sucursal_ref = minha_unidade_gerente()));
$$;

revoke all on function public.minha_unidade_gerente() from public, anon;
revoke all on function public.login_da_minha_equipe(uuid, text) from public, anon;
grant execute on function public.minha_unidade_gerente() to authenticated;
grant execute on function public.login_da_minha_equipe(uuid, text) to authenticated;

drop policy if exists "usuarios: gerente da unidade administra a equipe" on public.usuarios_sistema;
create policy "usuarios: gerente da unidade administra a equipe" on public.usuarios_sistema
  for all to authenticated
  using (
    (select minha_unidade_gerente()) is not null
    and loja_id = (select minha_loja())
    and sucursais = jsonb_build_array((select minha_unidade_gerente()))
    and lower(login) <> lower(coalesce((select auth.jwt()) ->> 'email', ''))
    and not coalesce(tudo, false) and not coalesce(mestre, false)
    and login_da_minha_equipe(loja_id, login)
  )
  with check (
    (select minha_unidade_gerente()) is not null
    and loja_id = (select minha_loja())
    and sucursais = jsonb_build_array((select minha_unidade_gerente()))
    and lower(login) <> lower(coalesce((select auth.jwt()) ->> 'email', ''))
    and not coalesce(tudo, false) and not coalesce(mestre, false)
    and login_da_minha_equipe(loja_id, login)
  );

-- o que o gerente grava na equipe: unidade dele, sem acesso total, e só as
-- telas que ele mesmo tem (mais a ação de lançar a baixa manual)
create or replace function public.tg_limitar_gerente_unidade()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare un text; meu record; k text; limpo jsonb := '{}'::jsonb;
begin
  un := minha_unidade_gerente();
  if un is null then return new; end if;          -- admin, plataforma e servidor: sem mudança
  select tudo, mestre, permissoes into meu from usuarios_sistema
   where loja_id = new.loja_id
     and lower(login) = lower(coalesce(auth.jwt() ->> 'email', ''))
     and ativo limit 1;
  new.tudo := false;
  new.mestre := false;
  new.sucursais := jsonb_build_array(un);
  if jsonb_typeof(new.permissoes) = 'object' then
    for k in select jsonb_object_keys(new.permissoes) loop
      if k = 'controle/baixa-manual:lancar'
         or coalesce(meu.tudo, false) or coalesce(meu.mestre, false)
         or coalesce((meu.permissoes -> k)::text = 'true', false) then
        limpo := limpo || jsonb_build_object(k, new.permissoes -> k);
      end if;
    end loop;
  end if;
  new.permissoes := limpo;
  return new;
end $$;

drop trigger if exists tg_limitar_gerente_unidade on public.usuarios_sistema;
create trigger tg_limitar_gerente_unidade before insert or update on public.usuarios_sistema
  for each row execute function public.tg_limitar_gerente_unidade();

-- excluir acesso: admin/plataforma na empresa; gerente só a equipe da unidade
create or replace function public.usuario_excluir(p_ref text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare lj uuid; em text; n int; un text; rede boolean;
begin
  lj := minha_loja();
  if lj is null and not sou_plataforma() then raise exception 'sessão sem empresa'; end if;
  select email into em from auth.users where id = auth.uid();
  rede := coalesce(meu_cargo() in ('admin','plataforma'), false);
  un := minha_unidade_gerente();
  if not rede and un is null then
    raise exception 'seu acesso não exclui outros acessos — fale com o login principal da loja';
  end if;
  update usuarios_sistema
     set ativo = false, excluido_em = now(), excluido_por = em
   where ref_local = p_ref and (loja_id = lj or sou_plataforma())
     and coalesce(mestre,false) = false
     and (rede or (sucursais = jsonb_build_array(un)
                   and lower(login) <> lower(coalesce(em,''))
                   and not coalesce(tudo,false)
                   and login_da_minha_equipe(loja_id, login)));
  get diagnostics n = row_count;
  if n = 0 then raise exception 'acesso não encontrado nesta empresa (ou fora da sua equipe)'; end if;
  return jsonb_build_object('ok', true, 'desativados', n);
end $$;

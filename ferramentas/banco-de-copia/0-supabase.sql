-- O MÍNIMO DO SUPABASE PARA O BANCO DE CÓPIA (06/10/2026)
-- Papéis, o esquema auth (usuários, uid(), jwt()) e as extensões que as
-- tabelas usam. auth.uid() e auth.jwt() leem request.jwt.claims, como no
-- Supabase: o teste "entra" como um login com
--   set request.jwt.claims = '{"role":"authenticated","sub":"<uuid>","email":"…"}'; set role authenticated;
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated;
create sequence if not exists public.audit_log_id_seq;
create or replace function public.tg_audit_imutavel() returns trigger language plpgsql as $$
begin raise exception 'audit_log não aceita alteração nem exclusão'; end $$;
-- como no Supabase: o que nasce em public já nasce acessível aos papéis
-- (a RLS e os revoke de cada migration é que fecham)
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

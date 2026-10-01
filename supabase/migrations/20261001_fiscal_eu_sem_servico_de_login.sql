-- V404 (01/10/2026): quem está logado, conferido pelo próprio banco.
-- O PostgREST confere a assinatura do token sozinho, sem chamar o serviço de
-- login do Supabase. É o plano B da função fiscal quando o login sai do ar
-- (13:34–13:36 de 01/10/2026: 521/522 no /auth/v1/user e o cupom esperou).
create or replace function public.eu()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$ select auth.uid() $$;
revoke execute on function public.eu() from public, anon;
grant execute on function public.eu() to authenticated;

-- =====================================================================
-- OUTROS ENDEREÇOS DE ENTREGA DO CLIENTE (04/10/2026)
--
-- Rafael: "pedido por telefone — na tela de pagamento quero o endereço do
-- cadastro e um + para adicionar outro (casa do pai, da mãe), e poder
-- excluir."
--
-- A lista fica no próprio cliente. Aparelho que ainda não conhece a lista
-- (versão antiga, ou que ainda não baixou) manda nulo — e nulo nunca apaga
-- a lista que está salva. Esvaziar é mandar a lista vazia [], que só a tela
-- faz, ao excluir o último.
-- =====================================================================

alter table public.clientes add column if not exists enderecos jsonb;

create or replace function public.tg_enderecos_nulo_nao_apaga()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.enderecos is null then
    new.enderecos := old.enderecos;
  end if;
  return new;
end $$;

drop trigger if exists ab_enderecos_nulo_nao_apaga on public.clientes;
create trigger ab_enderecos_nulo_nao_apaga before update on public.clientes
  for each row execute function public.tg_enderecos_nulo_nao_apaga();

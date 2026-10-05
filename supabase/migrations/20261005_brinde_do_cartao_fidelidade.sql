-- =====================================================================
-- O BRINDE DO CARTÃO FIDELIDADE É UM PRODUTO MARCADO (05/10/2026)
--
-- Rafael: "Quero vincular a Experiência Jolô ao programa de fidelidade:
-- quando a pessoa ganhar, aparece no caixa para resgatar e dá baixa na
-- ficha técnica dela."
--
-- O produto ganha a marcação "brinde do cartão fidelidade". Aparelho que
-- ainda não conhece o campo manda nulo — e nulo nunca apaga a marcação.
-- =====================================================================

alter table public.produtos add column if not exists brinde_fidelidade boolean;

create or replace function public.tg_brinde_nulo_nao_apaga()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.brinde_fidelidade is null then
    new.brinde_fidelidade := old.brinde_fidelidade;
  end if;
  return new;
end $$;

drop trigger if exists ab_brinde_nulo_nao_apaga on public.produtos;
create trigger ab_brinde_nulo_nao_apaga before update on public.produtos
  for each row execute function public.tg_brinde_nulo_nao_apaga();

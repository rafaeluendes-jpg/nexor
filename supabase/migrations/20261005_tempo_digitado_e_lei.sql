-- =====================================================================
-- O TEMPO DE ENTREGA DIGITADO É LEI (05/10/2026)
--
-- Rafael: "Quando a gente muda o tempo de entrega manual, ele tem que mudar
-- no cardápio e quando o cliente pergunta. Uma vez digitado, ele não muda
-- mais. A gente está colocando e ele está voltando automático, e zerando."
--
-- O tempo de cada unidade mora em cardapio_config (é o que o cardápio
-- digital mostra e o que o robô responde). Qualquer envio da configuração
-- do cardápio, de qualquer aparelho, regravava o tempo que aquele aparelho
-- tinha — inclusive um tempo velho, ou vazio.
--
-- Agora o tempo só troca quando chega com o carimbo de quem DIGITOU
-- (tempos_em) mais novo do que o salvo. Aparelho atrasado, aparelho de
-- versão antiga (que nem manda o carimbo) e envio vazio não mexem no tempo.
-- =====================================================================
alter table public.cardapio_config add column if not exists tempos_em timestamptz;

create or replace function public.tg_tempo_digitado_e_lei()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if (new.tempo_entrega is distinct from old.tempo_entrega
      or new.tempo_retirada is distinct from old.tempo_retirada) then
    if new.tempos_em is null
       or (old.tempos_em is not null and new.tempos_em <= old.tempos_em) then
      new.tempo_entrega := old.tempo_entrega;
      new.tempo_retirada := old.tempo_retirada;
      new.tempos_em := old.tempos_em;
    end if;
  end if;
  -- vazio nunca apaga o tempo que está salvo
  if coalesce(new.tempo_entrega, '') = '' and coalesce(old.tempo_entrega, '') <> '' then
    new.tempo_entrega := old.tempo_entrega;
  end if;
  if coalesce(new.tempo_retirada, '') = '' and coalesce(old.tempo_retirada, '') <> '' then
    new.tempo_retirada := old.tempo_retirada;
  end if;
  -- o carimbo nunca volta para trás
  if old.tempos_em is not null and (new.tempos_em is null or new.tempos_em < old.tempos_em) then
    new.tempos_em := old.tempos_em;
  end if;
  return new;
end $$;

drop trigger if exists ab_tempo_digitado_e_lei on public.cardapio_config;
create trigger ab_tempo_digitado_e_lei before update on public.cardapio_config
  for each row execute function public.tg_tempo_digitado_e_lei();

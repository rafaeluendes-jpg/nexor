-- =====================================================================
-- SALDO ANTIGO NÃO GRAVA POR CIMA DO MAIS NOVO (04/10/2026)
--
-- estoque_unidade guarda um SALDO ABSOLUTO por loja e item. A regra
-- combinada desde 03/09 é "vence a escrita mais recente" (atualizado_em,
-- a hora em que o saldo mudou no aparelho) — mas ela só valia no
-- download do aparelho. Na nuvem, qualquer envio gravava por cima.
--
-- Em 04/10 o aparelho da produção de Santa Fé tinha 495 saldos retidos
-- ("sem empresa identificada"). Liberar esse envio sem esta trava subiria
-- cópias de dias atrás por cima dos saldos corrigidos pela contagem.
--
-- Agora a nuvem confere: se o saldo que chega mudou ANTES do que já está
-- salvo, fica o salvo. Vale para o sistema (papel authenticated); rotina
-- interna do banco não passa por aqui.
-- =====================================================================

create or replace function public.tg_saldo_mais_novo_vence()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  papel text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '');
begin
  if papel <> 'authenticated' then
    return new;
  end if;
  if old.atualizado_em is not null
     and (new.atualizado_em is null or new.atualizado_em < old.atualizado_em) then
    raise warning 'estoque_unidade %: saldo antigo recusado (chegou %, a nuvem está em %)',
      old.ref_local, new.atualizado_em, old.atualizado_em;
    return old;
  end if;
  return new;
end $$;

drop trigger if exists ab_saldo_mais_novo_vence on public.estoque_unidade;
create trigger ab_saldo_mais_novo_vence before update on public.estoque_unidade
  for each row execute function public.tg_saldo_mais_novo_vence();

-- Feito à mão em 04/10/2026, por ordem do Rafael ("corrija e coloque o
-- saldo corretamente"): os saldos de Santa Fé dos itens contados em
-- 30/09 voltaram a ser contagem + movimentos de 01/10 em diante (32
-- itens). Cópia dos saldos anteriores: tabela _backup_saldo_20261004.

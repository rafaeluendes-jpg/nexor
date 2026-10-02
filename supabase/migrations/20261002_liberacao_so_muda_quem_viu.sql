-- =====================================================================
-- A LIBERAÇÃO SÓ MUDA POR QUEM VIU A DE HOJE (02/10/2026)
--
-- Rafael: "Qualquer atualização feita não pode desconfigurar… Santa Fé
-- estava fazendo a produção todo dia… alguma atualização escondeu a
-- parte da produção dos sabores."
--
-- O que o histórico mostrou (audit_log, 01/10, 14h53): a matriz trocou a
-- liberação de 45 fichas e, no mesmo minuto, dois aparelhos que ainda
-- tinham a lista antiga subiram a cópia deles por cima — 40 + 5 fichas
-- voltaram ao que eram. A loja via e deixava de ver a cada envio.
--
-- A regra é a mesma da lei de versão dos bancos e taxas (20260929), mas
-- só para o campo da liberação: cada aparelho diz qual liberação viu por
-- último (sucursais_vista). Se a da nuvem é outra, ninguém a trocou deste
-- aparelho — ele só está atrasado — e a liberação que está salva fica.
-- O resto da linha (estoque, custo, receita) grava normalmente.
--
-- Aparelho em versão antiga não manda o campo: ele pode ampliar a
-- liberação, nunca esconder. Em 02/10 a pasta "Produzido" voltou a ficar
-- só da matriz depois de corrigida, antes de existir a auditoria dela.
--
-- Só de UPDATE de propósito (no upsert, o que um gatilho de INSERT muda vai para o EXCLUDED e
-- apagaria o recibo antes de ser conferido). Vale para o sistema (papel
-- authenticated); rotina interna do banco não passa por aqui.
--
-- ficha_grupos ganha também o registro de auditoria: em 01/10 a pasta
-- "Produzido" ficou só da matriz e não havia como saber por quem.
-- =====================================================================

alter table public.fichas_tecnicas add column if not exists sucursais_vista jsonb;
alter table public.ficha_grupos    add column if not exists sucursais_vista jsonb;

create or replace function public.tg_sucursais_vista()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  vista jsonb := new.sucursais_vista;
  papel text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '');
begin
  new.sucursais_vista := null;
  if papel <> 'authenticated' or new.sucursais is not distinct from old.sucursais then
    return new;
  end if;
  if vista is null then
    -- aparelho que não diz o que viu (versão antiga): pode ampliar, nunca esconder
    if old.sucursais is not null and not (coalesce(new.sucursais,'[]'::jsonb) @> old.sucursais) then
      raise warning '% %: aparelho sem recibo tentou esconder (% -> %)',
        tg_table_name, old.ref_local, old.sucursais, new.sucursais;
      new.sucursais := old.sucursais;
    end if;
    return new;
  end if;
  if old.sucursais is distinct from vista then
    raise warning '% %: liberação antiga recusada (o aparelho viu %, a nuvem está em %)',
      tg_table_name, old.ref_local, vista, old.sucursais;
    new.sucursais := old.sucursais;
  end if;
  return new;
end $$;

drop trigger if exists ab_sucursais_vista on public.fichas_tecnicas;
create trigger ab_sucursais_vista before update on public.fichas_tecnicas
  for each row execute function public.tg_sucursais_vista();

drop trigger if exists ab_sucursais_vista on public.ficha_grupos;
create trigger ab_sucursais_vista before update on public.ficha_grupos
  for each row execute function public.tg_sucursais_vista();

drop trigger if exists tg_auditar on public.ficha_grupos;
create trigger tg_auditar after insert or delete or update on public.ficha_grupos
  for each row execute function public.tg_auditar();

-- A pasta "Produzido" (e "Vendas") voltou a seguir as fichas dela: Santa Fé.
-- Feito à mão em 02/10/2026, por ordem do Rafael ("liberar agora urgente"):
-- update ficha_grupos set sucursais='["suc_mt1unhbx2xrb"]' where pai_id is null
--   and nome in ('Produzido','Vendas') and sucursais='[]';

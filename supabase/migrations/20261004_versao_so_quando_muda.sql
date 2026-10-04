-- =====================================================================
-- GRAVAÇÃO QUE NÃO MUDA NADA NÃO É VERSÃO NOVA (04/10/2026)
--
-- Rafael: "está demorando para entrar no sistema — urgente."
--
-- Todo envio regravava o vínculo de produção de todas as fichas e pastas,
-- mesmo sem mudança (3.571 PATCH em 20 minutos). Cada regravação disparava
-- bump_loja_versao, a versão nova acordava os outros aparelhos, e eles
-- enviavam de novo — um ciclo que deixou o banco lento (consultas
-- canceladas por tempo, conexões caindo). Aplicado direto no banco no mesmo
-- minuto: o tráfego caiu de 655 para 216 pedidos por minuto.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.bump_loja_versao()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_txt text;
  v_loja uuid;
begin
  -- gravação que não mudou nada não é versão nova
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'alterado_em' - 'sucursais_vista' - 'versao_vista')
                         = (to_jsonb(old) - 'alterado_em' - 'sucursais_vista' - 'versao_vista') then
    return new;
  end if;
  v_txt := coalesce(new.loja_id::text, old.loja_id::text);
  if v_txt is null then return coalesce(new, old); end if;
  if v_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then return coalesce(new, old);
  end if;
  v_loja := v_txt::uuid;
  insert into public.loja_versao (loja_id, versao, atualizado_em)
       values (v_loja, 1, now())
  on conflict (loja_id) do update
       set versao = public.loja_versao.versao + 1, atualizado_em = now();
  return coalesce(new, old);
end $function$;

-- =====================================================================
-- FECHAMENTO DE CAIXA CONFERIDO NUNCA É APAGADO POR CÓPIA VAZIA (05/10/2026)
--
-- Rafael: "Do dia 2 para frente não tem nenhum físico, e está tudo lançado
-- e fechado. Depois das correções foi quebrado e sumiu. Corrige agora."
--
-- O que aconteceu: em 05/10 às 13:47 o aparelho de Santa Fé mandou de novo
-- o caixa de 02/10 a partir de uma cópia velha — fechado, mas SEM a
-- conferência (o fechamento tinha sido feito em outro aparelho). O envio
-- gravou por cima: valores informados, fotografia do fechamento, quem
-- fechou, contado, esperado, vendas — tudo zerado. O audit_log guardou o
-- "antes", e é dele que o caixa foi devolvido.
--
-- A trava: o que o fechamento gravou (fechado_em, conferência, fotografia,
-- quem fechou, totais) não volta a vazio. Editar o fechamento continua
-- valendo — a edição manda a conferência preenchida.
-- =====================================================================
create or replace function public.tg_fechamento_nao_se_apaga()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.fechado_em is not null and new.fechado_em is null then
    new.fechado_em := old.fechado_em;
  end if;
  if old.fechado_txt is not null and coalesce(new.fechado_txt,'') = '' then
    new.fechado_txt := old.fechado_txt;
  end if;
  -- cópia sem conferência não apaga o fechamento conferido
  if coalesce(old.conferencia, '{}'::jsonb) <> '{}'::jsonb
     and coalesce(new.conferencia, '{}'::jsonb) = '{}'::jsonb then
    new.conferencia        := old.conferencia;
    new.contado            := old.contado;
    new.total_informado    := old.total_informado;
    new.esperado           := old.esperado;
    new.esperado_por_forma := coalesce(new.esperado_por_forma, old.esperado_por_forma);
    new.diferenca_total    := old.diferenca_total;
    new.conciliado         := old.conciliado;
    new.vendas             := case when coalesce(new.vendas,0) = 0 then old.vendas else new.vendas end;
    new.qtd_pedidos        := case when coalesce(new.qtd_pedidos,0) = 0 then old.qtd_pedidos else new.qtd_pedidos end;
    new.fundo_proximo      := case when coalesce(new.fundo_proximo,0) = 0 then old.fundo_proximo else new.fundo_proximo end;
  end if;
  if old.snapshot is not null and new.snapshot is null then
    new.snapshot := old.snapshot;
  end if;
  if old.fechado_por is not null and new.fechado_por is null then
    new.fechado_por := old.fechado_por;
    new.fechado_por_id := coalesce(new.fechado_por_id, old.fechado_por_id);
  end if;
  return new;
end $$;

drop trigger if exists ab_fechamento_nao_se_apaga on public.caixas;
create trigger ab_fechamento_nao_se_apaga before update on public.caixas
  for each row execute function public.tg_fechamento_nao_se_apaga();

-- Feito em 05/10/2026, por ordem do Rafael ("corrige isso agora"): o caixa
-- de 02/10 de Santa Fé (cx_mur3wz9bmrtf) voltou a ter conferência,
-- fotografia, quem fechou e totais, copiados do "antes" do audit_log de
-- 05/10 16:47:02 UTC.

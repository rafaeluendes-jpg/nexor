-- =====================================================================
-- EDITOU O CAIXA, MUDA NO FINANCEIRO E NA CONCILIAÇÃO — E COPIA VELHA NÃO
-- DESFAZ (05/10/2026)
--
-- Rafael: "Quando fizer qualquer edição de caixa na frente de caixa,
-- automaticamente tem que levar a atualização para a conciliação e para o
-- lançamento financeiro. Tem sangria de R$ 400 no caixa e R$ 200 na
-- conciliação. Corrija isso, que vire lei."
--
-- O que o audit_log mostrou:
--   1. A sangria de 03/10 foi corrigida de 200 para 400 em 05/10 08:13
--      (horário de Brasília). O lançamento foi a 400 — mas o MOVIMENTO do
--      caixa nunca chegou na nuvem: a trava "caixa fechado não aceita novo
--      movimento" barrava o envio (upsert = INSERT ... ON CONFLICT, e o
--      gatilho de INSERT rodava antes de achar a linha existente), e o
--      valor de movimento em caixa fechado era imutável. Erro 400 a cada
--      envio, desde a manhã.
--   2. Às 13:46–13:47 o aparelho de Santa Fé (santafe@) regravou, a partir
--      de cópias velhas: 13 lançamentos (conciliações do dia desfeitas,
--      pagamentos desmarcados, sangria 400→200, dinheiro 537→336,95),
--      13 baixas de estoque (lançada→pendente: lançar de novo baixaria o
--      estoque duas vezes), 1 pedido de base e o caixa de 02/10.
--
-- Correção:
--   - movimento de caixa fechado: o upsert de um movimento que já existe
--     passa (vai para o UPDATE); o valor pode ser corrigido (o tipo não);
--     movimento NOVO e exclusão continuam barrados; tudo auditado.
--   - LEI DE VERSÃO em lancamentos_financeiros e baixas_pendentes (a mesma
--     das contas e formas, 20260929_versao_vista): o aparelho apresenta a
--     versão que viu; se a nuvem tem uma mais nova, fica a da nuvem.
--   - Dados devolvidos do "antes" do audit_log (feito em produção em
--     05/10/2026, por ordem do Rafael): movimento mv_mut6w10ruid1 = 400; os
--     13 lançamentos (os 4 de cartão que o Raylan pagou de novo pela
--     operação em lote mantêm o lote, voltam só conciliação e valor
--     original); as 13 baixas voltam a "lançada"; o pedido de base volta
--     a como estava.
-- =====================================================================

create or replace function public.tg_caixa_fechado_trava_movimento()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_fechado timestamptz;
  v_caixa   uuid;
begin
  v_caixa := coalesce(new.caixa_id, old.caixa_id);
  select fechado_em into v_fechado from caixas where id = v_caixa;
  if v_fechado is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'movimento de caixa ja fechado nao pode ser excluido (caixa %)', v_caixa
      using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    -- o envio do aparelho e um upsert: movimento que JA existe segue para o UPDATE
    if new.ref_local is not null and exists (select 1 from caixa_movimentos where ref_local = new.ref_local) then
      return new;
    end if;
    raise exception 'caixa ja fechado nao aceita novo movimento (caixa %)', v_caixa
      using errcode = '23514';
  end if;
  -- UPDATE: o tipo nao muda; o valor pode ser corrigido pela edicao do
  -- fechamento (Rafael, 05/10/2026) -- e a mudanca fica no audit_log
  if new.tipo is distinct from old.tipo then
    raise exception 'tipo de movimento em caixa fechado nao muda (caixa %)', v_caixa
      using errcode = '23514';
  end if;
  return new;
end $function$;

drop trigger if exists tg_auditar on public.caixa_movimentos;
create trigger tg_auditar after insert or update or delete on public.caixa_movimentos
  for each row execute function tg_auditar();

alter table public.lancamentos_financeiros add column if not exists versao_vista timestamptz;
alter table public.baixas_pendentes        add column if not exists versao_vista timestamptz;

drop trigger if exists ab_versao_vista on public.lancamentos_financeiros;
create trigger ab_versao_vista before update on public.lancamentos_financeiros
  for each row execute function public.tg_versao_vista();
drop trigger if exists ab_versao_vista on public.baixas_pendentes;
create trigger ab_versao_vista before update on public.baixas_pendentes
  for each row execute function public.tg_versao_vista();

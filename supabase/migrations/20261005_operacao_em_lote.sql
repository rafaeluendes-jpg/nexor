-- =====================================================================
-- OPERAÇÃO EM LOTE NO FINANCEIRO (05/10/2026)
--
-- Rafael: "Eu preciso criar uma operação em lote. Tem que ter um número do
-- lote, para a gente colocar a data que está sendo feita."
--
-- Vários lançamentos em aberto pagos (ou recebidos) juntos, como UMA
-- operação, com número AAAAMMDD-NN. O lote nunca é apagado: desfeito, ele
-- fica guardado com quem desfez, quando e o motivo — por isso não há regra
-- de DELETE nesta tabela.
--
-- Tabela nova, com o mesmo padrão das que já funcionam: auditoria, carimbo
-- de alteração, empresa forçada, aviso de versão aos aparelhos e acesso
-- igual ao dos lançamentos financeiros (empresa + unidade + permissão do
-- financeiro). Nos lançamentos entram só duas colunas novas, vazias.
-- =====================================================================
create table if not exists public.lotes_financeiros (
  id            uuid primary key default gen_random_uuid(),
  loja_id       uuid not null,
  ref_local     text not null,
  sucursal_id   text,
  numero        text not null,
  tipo          text,                 -- 'pagar' | 'receber'
  data          date,                 -- dia do pagamento / recebimento
  conta_id      uuid,
  forma_id      uuid,
  observacao    text,
  criado_por    text,
  criado_local  timestamptz,          -- quando o lote foi feito, no aparelho
  total         numeric,
  quantidade    integer,
  itens         jsonb,                -- cada lançamento e o "antes" dele
  desfeito      boolean not null default false,
  desfeito_em   timestamptz,
  desfeito_por  text,
  motivo        text,
  criado_em     timestamptz not null default now(),
  alterado_em   timestamptz,
  unique (loja_id, ref_local)
);

alter table public.lotes_financeiros enable row level security;

create policy "lote financeiro: leitura da rede" on public.lotes_financeiros
  for select using (
    (((select minha_rede_plena())) or (loja_id = any ((select minhas_lojas())::uuid[])))
    and (((select vejo_todas_unidades())) or (sucursal_id = (select minha_sucursal_ref())))
  );
create policy "lote financeiro: grava com permissao" on public.lotes_financeiros
  for insert to authenticated with check (
    (((select minha_rede_plena())) or (loja_id = any ((select minhas_lojas())::uuid[])))
    and (select posso('financeira/lancamentos-financeiros'))
  );
create policy "lote financeiro: altera com permissao" on public.lotes_financeiros
  for update using (
    (((select minha_rede_plena())) or (loja_id = any ((select minhas_lojas())::uuid[])))
    and (select posso('financeira/lancamentos-financeiros'))
    and (((select vejo_todas_unidades())) or (sucursal_id = (select minha_sucursal_ref())))
  ) with check (
    (((select minha_rede_plena())) or (loja_id = any ((select minhas_lojas())::uuid[])))
    and (select posso('financeira/lancamentos-financeiros'))
  );

create trigger tg_forcar_loja before insert or update on public.lotes_financeiros
  for each row execute function forcar_minha_loja();
create trigger zz_carimbar_alteracao before insert or update on public.lotes_financeiros
  for each row execute function carimbar_alteracao();
create trigger tg_auditar after insert or update or delete on public.lotes_financeiros
  for each row execute function tg_auditar();
create trigger trg_versao_lotes_financeiros after insert or update or delete on public.lotes_financeiros
  for each row execute function bump_loja_versao();

grant select, insert, update on public.lotes_financeiros to authenticated;

-- o lançamento sabe em que lote foi pago
alter table public.lancamentos_financeiros add column if not exists lote_ref text;
alter table public.lancamentos_financeiros add column if not exists lote_numero text;

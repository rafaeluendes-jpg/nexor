-- ============================================================
-- LOTE E VALIDADE (RDS 14) — O REGISTRO, E O QUE ELE NAO E
--
-- Ate aqui nao existia NADA: nem flag no item, nem campo na entrada,
-- nem alerta. O que havia era uma data solta no cadastro do insumo
-- (`validade`), cuja dica na tela dizia "do lote em estoque" e que era
-- sobrescrita pela entrada seguinte, e um prazo em dias na ficha
-- tecnica, que nao gerava aviso nenhum.
--
-- ---------- o que esta migracao entrega ----------
-- O item passa a dizer se controla lote e/ou validade. Toda entrada de
-- um item controlado grava um LOTE: numero, fabricacao, validade,
-- quantidade, unidade e o documento de origem. `lotes_estoque` e esse
-- razao — uma linha por entrada, nao um saldo.
--
-- Com ele o sistema responde o que uma gelateria precisa: o que esta
-- vencido, o que vence nos proximos dias, e de qual nota veio.
--
-- ---------- e o que ela NAO entrega, dito aqui para nao se confundir ----------
-- A BAIXA AUTOMATICA POR FEFO/PEPS NAO EXISTE. Para consumir o lote
-- mais proximo do vencimento, o SALDO teria de ser por lote — e hoje o
-- saldo e uma linha por item e unidade (`estoque_unidade`), que e a
-- base de todo o resto: venda, producao, transferencia, contagem, CPV,
-- DRE e a transacao atomica da venda.
--
-- Trocar isso e refazer o motor de estoque de um sistema que esta em
-- producao em seis lojas. Nao e trabalho de uma versao, e nao se faz
-- sem ordem — por isso o lote aqui INFORMA, e nao consome.
-- ============================================================
alter table public.insumos
  add column if not exists controla_lote     boolean not null default false,
  add column if not exists controla_validade boolean not null default false;

create table if not exists public.lotes_estoque(
  id          uuid primary key default gen_random_uuid(),
  loja_id     uuid not null,
  ref_local   text,
  sucursal_id text,
  item_ref    text not null,
  item_nome   text,
  lote        text,
  fabricacao  date,
  validade    date,
  quantidade  numeric not null default 0,
  unidade     text,
  origem      text,
  origem_ref  text,
  documento   text,
  criado_em   timestamptz not null default now(),
  alterado_em timestamptz
);
alter table public.lotes_estoque enable row level security;

create unique index if not exists ux_lotes_ref      on public.lotes_estoque (loja_id, ref_local);
create index        if not exists ix_lotes_validade on public.lotes_estoque (loja_id, sucursal_id, validade);

-- le quem e da rede e enxerga a unidade; grava quem lanca nota ou
-- movimentacao; apaga so gestor. Mesmas regras de movimentacoes_estoque.
drop policy if exists "lote: leitura da rede" on public.lotes_estoque;
create policy "lote: leitura da rede" on public.lotes_estoque
  for select using (
    ((select minha_rede_plena()) or (loja_id = any((select minhas_lojas())::uuid[])))
    and ((select vejo_todas_unidades()) or sucursal_id = (select minha_sucursal_ref())));

drop policy if exists "lote: grava com permissao" on public.lotes_estoque;
create policy "lote: grava com permissao" on public.lotes_estoque
  for insert to authenticated with check (
    ((select minha_rede_plena()) or (loja_id = any((select minhas_lojas())::uuid[])))
    and ((select posso('estoque/notas-entrada')) or (select posso('estoque/movimentacao-estoque'))));

drop policy if exists "lote: atualiza com permissao" on public.lotes_estoque;
create policy "lote: atualiza com permissao" on public.lotes_estoque
  for update using ((select minha_rede_plena()) or (loja_id = any((select minhas_lojas())::uuid[])))
  with check ((select minha_rede_plena()) or (loja_id = any((select minhas_lojas())::uuid[])));

drop policy if exists "lote: apaga so gestor" on public.lotes_estoque;
create policy "lote: apaga so gestor" on public.lotes_estoque
  for delete to authenticated using (
    ((select minha_rede_plena()) or (loja_id = any((select minhas_lojas())::uuid[])))
    and (select sou_gestor()));

drop trigger if exists tg_forcar_loja on public.lotes_estoque;
create trigger tg_forcar_loja before insert or update on public.lotes_estoque
  for each row execute function forcar_minha_loja();
drop trigger if exists zz_carimbar_alteracao on public.lotes_estoque;
create trigger zz_carimbar_alteracao before insert or update on public.lotes_estoque
  for each row execute function carimbar_alteracao();
drop trigger if exists tg_auditar on public.lotes_estoque;
create trigger tg_auditar after insert or update or delete on public.lotes_estoque
  for each row execute function tg_auditar();

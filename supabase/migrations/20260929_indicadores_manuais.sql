-- =====================================================================
-- INDICADORES DO MÊS — O QUE NÃO PASSA PELO SISTEMA (29/09/2026)
--
-- Rafael: "os funcionários, cada loja tem a quantidade, você não vai
-- saber. Deixa um campo para digitar a quantidade, e um botão do lado
-- atualizar; aí pega a receita e divide pelo funcionário. A mesma coisa da
-- quantidade de quilowatts de energia."
--
-- Uma linha por unidade e por mês (ref_local = 'im_<unidade>_<AAAA-MM>'),
-- com o mesmo padrão das tabelas que já funcionam (contagens_estoque):
-- auditoria, carimbo de alteração, empresa forçada e regra de acesso por
-- empresa + unidade. Tabela nova: não toca em nada que já existe.
-- =====================================================================
create table if not exists public.indicadores_manuais (
  id           uuid primary key default gen_random_uuid(),
  loja_id      uuid not null,
  ref_local    text not null,
  sucursal_id  text,
  mes          text not null,                 -- 'AAAA-MM'
  funcionarios integer,
  energia_kwh  numeric,
  criado_em    timestamptz not null default now(),
  alterado_em  timestamptz,
  unique (loja_id, ref_local)
);

alter table public.indicadores_manuais enable row level security;

create policy "acesso por loja - indicadores_manuais" on public.indicadores_manuais
  for all
  using (
    ((loja_id = (select minha_loja()))
      or ((select sou_admin()) and loja_id in
          (select lojas.id from lojas where lojas.empresa_id = (select minha_empresa()))))
    and ((select vejo_todas_unidades()) or sucursal_id = (select minha_sucursal_ref()))
  )
  with check (
    (loja_id = (select minha_loja()))
      or ((select sou_admin()) and loja_id in
          (select lojas.id from lojas where lojas.empresa_id = (select minha_empresa())))
  );

create trigger tg_forcar_loja before insert or update on public.indicadores_manuais
  for each row execute function forcar_minha_loja();
create trigger zz_carimbar_alteracao before insert or update on public.indicadores_manuais
  for each row execute function carimbar_alteracao();
create trigger tg_auditar after insert or update or delete on public.indicadores_manuais
  for each row execute function tg_auditar();

grant select, insert, update, delete on public.indicadores_manuais to authenticated;

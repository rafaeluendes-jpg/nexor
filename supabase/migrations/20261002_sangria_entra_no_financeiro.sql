-- A sangria e o suprimento do caixa entram no financeiro pelo login da
-- loja (Rafael, 02/10/2026: "todos os logins têm permissão de fazer
-- sangria"). O lançamento de transferência que o PDV gera junto com a
-- sangria era recusado pelo banco, porque gravar no financeiro exigia a
-- permissão do módulo Financeiro — que o login do caixa não tem. A
-- sangria saía da gaveta e não chegava à conta de destino nem à
-- conciliação.
--
-- Libera só o que o caixa gera (origem 'mov-caixa', transferência), da
-- própria unidade, a partir de 01/10/2026: nesse dia os saldos de Santa
-- Fé foram acertados pelo valor real, e as sangrias anteriores, se
-- subissem agora, desacertariam o acerto (decisão do Rafael: "quero só a
-- de ontem").
create policy "financeiro: o caixa grava a propria sangria"
  on public.lancamentos_financeiros for insert to authenticated
  with check (
    ((select public.minha_rede_plena()) or loja_id = any((select public.minhas_lojas())::uuid[]))
    and origem = 'mov-caixa' and tipo = 'transferencia'
    and pagamento >= date '2026-10-01'
    and ((select public.vejo_todas_unidades()) or sucursal_id = (select public.minha_sucursal_ref()))
  );
create policy "financeiro: o caixa reenvia a propria sangria"
  on public.lancamentos_financeiros for update to authenticated
  using (
    ((select public.minha_rede_plena()) or loja_id = any((select public.minhas_lojas())::uuid[]))
    and origem = 'mov-caixa' and tipo = 'transferencia'
    and pagamento >= date '2026-10-01'
    and ((select public.vejo_todas_unidades()) or sucursal_id = (select public.minha_sucursal_ref()))
  )
  with check (
    ((select public.minha_rede_plena()) or loja_id = any((select public.minhas_lojas())::uuid[]))
    and origem = 'mov-caixa' and tipo = 'transferencia'
    and pagamento >= date '2026-10-01'
    and ((select public.vejo_todas_unidades()) or sucursal_id = (select public.minha_sucursal_ref()))
  );

-- a sangria de 01/10/2026 23:01 (caixa cx_mupobtvcnmzc, R$ 350,00,
-- Caixa da loja -> Itaú), que o banco recusou: entra como o PDV a gerou
insert into public.lancamentos_financeiros
  (loja_id, tipo, conta_id, conta_destino_id, categoria_texto, descricao, valor,
   emissao, vencimento, pagamento, pago, conciliado, origem, origem_ref, observacao,
   ref_local, sucursal_id, cancelado)
select '6001c62e-26f3-4d81-8b6c-fa367c14146c', 'transferencia',
       '02710425-671a-4dd9-a45d-9ea0ba8325de', '0bb7693c-ee73-4ff4-aac3-86fe9999c232',
       'Transferência', 'Sangria de caixa: Caixa da loja → Itaú — conta corrente', 350.00,
       date '2026-10-01', date '2026-10-01', date '2026-10-01', true, false,
       'mov-caixa', 'mv_muqbh0p9u8ym', 'Envio ao cofre · Administrador · 23:01',
       'lf_muqbh0pbs9aj', 'suc_mt1unhbx2xrb', false
 where not exists (select 1 from public.lancamentos_financeiros
                    where loja_id = '6001c62e-26f3-4d81-8b6c-fa367c14146c' and ref_local = 'lf_muqbh0pbs9aj');

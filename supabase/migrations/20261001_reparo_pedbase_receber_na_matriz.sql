-- REPARO (01/10/2026, V400): as cobranças do pedido de base (#0001, #0005,
-- #0006) são da MATRIZ, mas tinham sido gravadas na unidade de Santa Fé
-- (o envio carimbava a loja aberta no topo). Cópia antes de mexer.
create table if not exists arquivo.bkp_lanc_pedbase_20261001 as
  select * from public.lancamentos_financeiros
  where ref_local in ('lf_mtixhcb7gxjn','lf_muecbfyqx2tg','lf_mulbuj6r73p6');
alter table arquivo.bkp_lanc_pedbase_20261001 enable row level security;
update public.lancamentos_financeiros
   set sucursal_id = 'suc_matriz'
 where ref_local in ('lf_mtixhcb7gxjn','lf_muecbfyqx2tg','lf_mulbuj6r73p6')
   and tipo = 'receita'
   and descricao like 'Pedido de base #%'
   and sucursal_id = 'suc_mt1unhbx2xrb';

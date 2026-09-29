-- =====================================================================
-- A TRANSFERÊNCIA É DAS DUAS UNIDADES (29/09/2026)
--
-- Rafael: "foi feita uma transferência entre lojas e nas atualizações
-- ela sumiu; em movimentação de mercadoria o histórico está lá, em
-- Transferência de Mercadoria sumiu".
--
-- A regra de acesso de `transferencias` só mostrava a linha à unidade de
-- `sucursal_id` — que o sistema nem enviava, então toda transferência era
-- recusada (zero linhas na nuvem). Corrigido o envio (V361), falta a
-- regra: a transferência pertence à ORIGEM e ao DESTINO. Quem recebe
-- precisa enxergá-la para confirmar o recebimento.
--
-- Só a leitura/visibilidade muda; quem pode gravar continua sendo a
-- mesma empresa (with check igual ao de antes).
-- =====================================================================
drop policy if exists "acesso por loja - transferencias" on public.transferencias;
create policy "acesso por loja - transferencias" on public.transferencias
  for all
  using (
    ((loja_id = (select minha_loja()))
      or ((select sou_admin()) and loja_id in
          (select lojas.id from lojas where lojas.empresa_id = (select minha_empresa()))))
    and ((select vejo_todas_unidades())
      or sucursal_id = (select minha_sucursal_ref())
      or origem_suc  = (select minha_sucursal_ref())
      or destino_suc = (select minha_sucursal_ref()))
  )
  with check (
    (loja_id = (select minha_loja()))
      or ((select sou_admin()) and loja_id in
          (select lojas.id from lojas where lojas.empresa_id = (select minha_empresa())))
  );

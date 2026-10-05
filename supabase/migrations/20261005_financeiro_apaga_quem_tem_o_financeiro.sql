-- =====================================================================
-- QUEM TEM O FINANCEIRO APAGA LANÇAMENTO DE VERDADE (05/10/2026)
--
-- Santa Fé: a transferência de R$ 350 (Itaú → Caixa da loja, 02/10) foi
-- excluída várias vezes e sempre voltava, com R$ 350 a mais no caixa.
--
-- A tela de Lançamentos deixa excluir quem tem a permissão do financeiro.
-- O banco só deixava admin ("financeiro: apaga so gestor"). Quando a regra
-- recusa um DELETE, o banco responde "ok" com zero linhas — a tela tirava a
-- linha do aparelho e o download seguinte a trazia de volta.
--
-- Agora apaga quem tem a mesma permissão que já altera e grava lançamento,
-- na própria unidade, e nunca um lançamento conciliado. A regra antiga
-- continua valendo para admin. Toda exclusão fica no audit_log.
-- Aplicada em produção em 05/10/2026, por ordem do Rafael.
-- =====================================================================

drop policy if exists "financeiro: apaga quem tem o financeiro" on public.lancamentos_financeiros;
create policy "financeiro: apaga quem tem o financeiro" on public.lancamentos_financeiros
  for delete to authenticated using (
    ((select minha_rede_plena()) or (loja_id = any ((select minhas_lojas())::uuid[])))
    and (select posso('financeira/lancamentos-financeiros'))
    and coalesce(conciliado, false) = false
    and ((select vejo_todas_unidades()) or (sucursal_id = (select minha_sucursal_ref())))
  );

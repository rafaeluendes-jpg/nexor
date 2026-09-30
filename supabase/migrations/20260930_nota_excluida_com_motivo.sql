-- ============================================================
-- POR QUE A NOTA FOI EXCLUIDA (RDS 19.2)
--
-- `notas_entrada` e auditada: o DELETE ja grava em `audit_log` o ANTES
-- inteiro da nota, com quem apagou e quando. O que faltava era o MOTIVO
-- — a trilha dizia o que sumiu e nunca por que.
--
-- Tres colunas, todas opcionais. O Joia grava o motivo na nota ANTES de
-- exclui-la; o UPDATE entra na trilha com o motivo, e o DELETE seguinte
-- o carrega dentro do `antes`. Sem elas, o motivo morreria no aparelho.
--
-- Aditivo e sem efeito sobre nota nenhuma que ja exista.
-- ============================================================
alter table public.notas_entrada
  add column if not exists excluida_em     timestamptz,
  add column if not exists excluida_por    text,
  add column if not exists excluida_motivo text;

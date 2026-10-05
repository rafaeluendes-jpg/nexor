-- =====================================================================
-- OPÇÃO DO GRUPO LIGADA DIRETO A UM INSUMO (05/10/2026)
--
-- Rafael: "além de vincular a ficha técnica, ter a opção de vincular
-- apenas o insumo, com a quantidade que vai ser debitada, para eu não
-- precisar criar uma ficha técnica só para dar baixa quando vender."
--
-- Mesmas três colunas que o produto já tem (insumo_id, insumo_qtd,
-- insumo_un). Aparelho em versão antiga não manda as colunas e não as
-- toca. Aplicado no banco em 05/10/2026.
-- =====================================================================
alter table public.opcoes add column if not exists insumo_id uuid;
alter table public.opcoes add column if not exists insumo_qtd numeric;
alter table public.opcoes add column if not exists insumo_un text;

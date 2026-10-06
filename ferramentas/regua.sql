-- =====================================================================
-- A RÉGUA DA MISSÃO INTEGRIDADE (06/10/2026)
--
-- Quantas gravações feitas por login de aparelho devolveram algum campo a
-- um valor anterior: o campo foi de A para B, e esta gravação o leva de B
-- para A. Por tabela e por login, separando saldo/custo (que sobem e
-- descem por natureza) do resto.
--
-- A meta é ZERO em "gravacoes_dado" por duas semanas seguidas, medido
-- pelo vigia com esta mesma consulta (Fase 4). Trocar a janela: mude o
-- intervalo nas duas linhas marcadas.
-- =====================================================================
with c as materialized (
  select a.id, a.tabela, coalesce(a.registro_id::text, a.ref_local) rid, k,
         a.antes->k va, a.depois->k vd, a.quando, a.usuario_email
  from audit_log a, jsonb_object_keys(coalesce(a.depois,'{}'::jsonb)) k
  where a.operacao='UPDATE'
    and a.quando > now() - interval '30 days'             -- janela
    and a.usuario_email is not null                      -- só aparelho (login)
    and a.antes->k is distinct from a.depois->k
    and k not in ('alterado_em','versao_vista','versao_aparelho','sucursais_vista','atualizado_em')
), voltas as (
  select c2.* from c c2
  where exists (select 1 from c c1
                where c1.tabela=c2.tabela and c1.rid=c2.rid and c1.k=c2.k
                  and c1.quando<c2.quando
                  and c1.va is not distinct from c2.vd
                  and c1.vd is not distinct from c2.va)
)
select tabela, usuario_email,
  count(distinct id) filter (where k not in ('estoque','estoque_atual','custo','custo_medio',
        'custo_ultima','ultimo_custo_medio_com_saldo')) as gravacoes_dado,
  count(distinct id) filter (where k in ('estoque','estoque_atual','custo','custo_medio',
        'custo_ultima','ultimo_custo_medio_com_saldo')) as gravacoes_saldo_custo
from voltas group by 1,2 order by 3 desc, 4 desc;

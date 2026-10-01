-- SEGURANÇA (01/10/2026): as 7 funções que o Supabase apontava sem
-- search_path fixo passam a ter. Não muda o que elas fazem.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname in ('tg_versao_vista','tg_conta_fabrica_nao_sobrescreve','tg_forma_fabrica_nao_sobrescreve','rds_classe_motivo','rds_linha_dre','rds_fator','rds_norm')
             and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end $$;

-- ==========================================================
-- JOIA — A FOTOGRAFIA DOS DADOS DAS LOJAS (Missão integridade, 06/10/2026)
--
-- Regra 3 do pedido: "Nenhum dado das lojas muda com uma versão nova.
-- Prove que contas pagas, conciliações, fichas com ingredientes, insumos e
-- liberação de cada loja estão iguais antes e depois."
--
-- Esta consulta é a prova. Roda ANTES e DEPOIS de cada publicação e de
-- cada migration; as duas saídas têm de ser iguais linha por linha. Cada
-- linha é (o quê, loja, quantas, impressão): a impressão é o md5 de todas
-- as linhas daquele grupo, sem as colunas de serviço (a versão e o
-- aparelho, que a própria lei carimba). A liberação de cada loja está
-- dentro da linha de cada cadastro (colunas `sucursais`/`lojas`).
--
-- É leve: lê só os grupos protegidos, por índice de loja. Guarde a saída
-- em ferramentas/fotografias/AAAA-MM-DD-HHMM-antes|depois.json.
-- ==========================================================
with s(x) as (select array['alterado_em','versao_vista','versao_aparelho','sucursais_vista']::text[]),
lin as (
  select 'contas pagas' o, x.loja_id::text l, x.id::text k, (to_jsonb(x) - (select x from s))::text v
    from public.lancamentos_financeiros x where x.pago
  union all
  select 'conciliações', x.loja_id::text, x.id::text, (to_jsonb(x) - (select x from s))::text
    from public.lancamentos_financeiros x where x.conciliado
  union all
  select 'caixas fechados', x.loja_id::text, x.id::text, (to_jsonb(x) - (select x from s))::text
    from public.caixas x where x.fechado_em is not null
  union all
  select 'fichas', x.loja_id::text, x.id::text, (to_jsonb(x) - (select x from s))::text
    from public.fichas_tecnicas x
  union all
  select 'ingredientes das fichas', f.loja_id::text, i.id::text, (to_jsonb(i) - (select x from s))::text
    from public.ficha_itens i join public.fichas_tecnicas f on f.id = i.ficha_id
  union all
  select 'insumos', x.loja_id::text, x.id::text, (to_jsonb(x) - (select x from s))::text
    from public.insumos x
  union all
  select 'produtos (com a liberação)', x.loja_id::text, x.id::text, (to_jsonb(x) - (select x from s))::text
    from public.produtos x
  union all
  select 'grupos de ficha (com a liberação)', x.loja_id::text, x.id::text, (to_jsonb(x) - (select x from s))::text
    from public.ficha_grupos x
  union all
  select 'unidades', x.loja_id::text, x.id::text, (to_jsonb(x) - (select x from s))::text
    from public.sucursais x
  -- ---- por loja (unidade): o dinheiro de cada uma e o que cada uma enxerga ----
  union all
  select 'contas pagas · unidade', coalesce(x.sucursal_id, '(sem unidade)'), x.id::text, (to_jsonb(x) - (select x from s))::text
    from public.lancamentos_financeiros x where x.pago
  union all
  select 'conciliações · unidade', coalesce(x.sucursal_id, '(sem unidade)'), x.id::text, (to_jsonb(x) - (select x from s))::text
    from public.lancamentos_financeiros x where x.conciliado
  union all
  select 'caixas fechados · unidade', coalesce(x.sucursal_id, '(sem unidade)'), x.id::text, (to_jsonb(x) - (select x from s))::text
    from public.caixas x where x.fechado_em is not null
  union all
  select 'liberação de fichas · unidade', u.ref_local, f.id::text, f.id::text
    from public.sucursais u join public.fichas_tecnicas f on f.loja_id = u.loja_id
   where coalesce(f.sucursais, '[]'::jsonb) @> to_jsonb(u.ref_local)
  union all
  select 'liberação de insumos · unidade', u.ref_local, i.id::text, i.id::text
    from public.sucursais u join public.insumos i on i.loja_id = u.loja_id
   where coalesce(i.sucursais, '[]'::jsonb) @> to_jsonb(u.ref_local)
  union all
  select 'liberação de produtos · unidade', u.ref_local, p.id::text, p.id::text
    from public.sucursais u join public.produtos p on p.loja_id = u.loja_id
   where coalesce(p.sucursais, '[]'::jsonb) @> to_jsonb(u.ref_local)
  union all
  select 'liberação de grupos de ficha · unidade', u.ref_local, g.id::text, g.id::text
    from public.sucursais u join public.ficha_grupos g on g.loja_id = u.loja_id
   where coalesce(g.sucursais, '[]'::jsonb) @> to_jsonb(u.ref_local)
)
select o, l, count(*)::int n, md5(string_agg(v, '|' order by k)) h
  from lin group by o, l order by o, l;

-- =====================================================================
-- JOIA — API ANALÍTICA RDS v3 · PARTE 1: BASE (identidade, escopo,
-- sincronização, regras de classificação, paginação)
--
-- Pedido da RDS de 30/09/2026 ("API analítica RDS multiunidades, somente
-- leitura"). Tudo aqui é LEITURA:
--   · toda função é STABLE — o Postgres recusa INSERT/UPDATE/DELETE
--     dentro dela ("... is not allowed in a non-volatile function");
--   · a função de borda chama por GET, e o PostgREST roda GET numa
--     transação READ ONLY;
--   · nenhuma função é alcançável pelas chaves públicas (anon/
--     authenticated): só a função de borda, com a chave própria da RDS.
-- Nada é classificado, corrigido ou gravado no Joia. Onde o Joia não
-- tem o dado, a resposta diz "não_disponível" — nunca um valor inventado.
-- =====================================================================

-- ---------- identidade de cada unidade ----------
-- No Joia, a REDE é o cadastro `lojas` (Jolô Gelato) e a loja física é a
-- `sucursal`. loja_id = identificador interno da loja física (uuid);
-- sucursal_id = a referência usada nos filtros (suc_...).
create or replace function public.rds_unidades(p_loja uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(s.ref_local, jsonb_build_object(
      'rede_id', l.id, 'rede_nome', l.nome,
      'empresa_id', coalesce(s.empresa_id, l.empresa_id), 'empresa_nome', e.nome,
      'loja_id', s.id, 'loja_nome', s.nome,
      'sucursal_id', s.ref_local,
      'sucursal_nome', coalesce(nullif(s.apelido, ''), s.nome),
      'tipo_unidade', case when s.matriz then 'matriz' else 'loja' end,
      'cnpj', nullif(s.cnpj, ''), 'cidade', s.cidade, 'uf', s.uf,
      'situacao_unidade', case when s.excluida_em is not null then 'excluída'
                               when s.ativa then 'ativa' else 'inativa' end,
      'data_abertura', 'não_disponível',
      'cadastrada_no_joia_em', s.criado_em,
      'fuso', 'America/Sao_Paulo')), '{}'::jsonb)
    from sucursais s
    join lojas l on l.id = s.loja_id
    left join empresas e on e.id = coalesce(s.empresa_id, l.empresa_id)
   where s.loja_id = p_loja;
$$;

-- identidade de um registro que é da REDE (cadastro compartilhado)
create or replace function public.rds_rede(p_loja uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
      'rede_id', l.id, 'rede_nome', l.nome,
      'empresa_id', l.empresa_id, 'empresa_nome', e.nome,
      'loja_id', null, 'loja_nome', null,
      'sucursal_id', null, 'sucursal_nome', null,
      'tipo_unidade', 'rede', 'cnpj', null, 'cidade', null, 'uf', null,
      'situacao_unidade', case when l.ativa then 'ativa' else 'inativa' end,
      'data_abertura', 'não_disponível', 'fuso', 'America/Sao_Paulo')
    from lojas l left join empresas e on e.id = l.empresa_id
   where l.id = p_loja;
$$;

-- ---------- sincronização por unidade e por aparelho ----------
-- "offline": a unidade inteira sem sinal de nenhum aparelho há mais de
-- 6 h. "pendência local": aparelho que disse ter dado ainda não enviado.
-- Aparelho sem sinal há mais de 7 dias é tratado como aposentado, mas a
-- pendência dele continua sendo avisada — é dado que pode nunca chegar.
create or replace function public.rds_sincronizacao(p_loja uuid, p_sucs text[])
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select s.id, s.ref_local, coalesce(nullif(s.apelido,''), s.nome) nome
      from sucursais s where s.loja_id = p_loja and s.ref_local = any(p_sucs)
  ), rec as (
    select p.sucursal_id, max(p.criado_em) ultimo, max(p.data_venda) ultima_venda
      from pedidos p where p.loja_id = p_loja group by 1
  ), ap as (
    select a.sucursal_ref, jsonb_agg(jsonb_build_object(
             'aparelho', a.aparelho_id, 'versao_instalada', a.versao,
             'ultimo_sinal', a.ultimo_sinal, 'ultimo_envio_ok', a.ultimo_envio_ok,
             'ultimo_download_ok', a.ultimo_download_ok,
             'pendencia_local', coalesce(a.pendente, false),
             'pendencia_mais_antiga', 'não_disponível',
             'ultima_falha_em', a.ultimo_erro_em, 'ultima_falha', a.ultimo_erro,
             'situacao', case
                when a.ultimo_sinal < now() - interval '7 days' then 'aposentado (sem sinal há mais de 7 dias)'
                when coalesce(a.pendente,false) then 'com pendência local'
                when a.ultimo_erro_em is not null and a.ultimo_erro_em > coalesce(a.ultimo_envio_ok,'epoch') then 'com falha no envio'
                when a.ultimo_sinal < now() - interval '6 hours' then 'sem sinal há mais de 6 h'
                else 'em dia' end) order by a.ultimo_sinal desc) aparelhos,
           max(a.ultimo_sinal) ultimo_sinal,
           bool_or(coalesce(a.pendente,false)) algum_pendente,
           bool_or(coalesce(a.pendente,false) and a.ultimo_sinal >= now() - interval '7 days') pendente_ativo,
           bool_or(coalesce(a.pendente,false) and a.ultimo_sinal < now() - interval '7 days') pendente_parado
      from sincronizacao_aparelhos a
     where a.loja_id = p_loja group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'sucursal_id', s.ref_local, 'sucursal_nome', s.nome,
      'ultimo_registro_recebido_em', rec.ultimo,
      'ultima_venda_recebida_em', rec.ultima_venda,
      'ultimo_sinal_de_aparelho', ap.ultimo_sinal,
      'situacao', case
          when ap.sucursal_ref is null and rec.ultimo is null then 'sem movimento'
          when ap.sucursal_ref is null then 'sem aparelho registrado'
          when ap.ultimo_sinal < now() - interval '6 hours' then 'offline'
          when ap.pendente_ativo then 'com pendência local'
          else 'em dia' end,
      'offline', coalesce(ap.ultimo_sinal < now() - interval '6 hours', false),
      'pendencia_local', coalesce(ap.pendente_ativo, false),
      'aparelho_parado_com_pendencia', coalesce(ap.pendente_parado, false),
      'aparelhos', coalesce(ap.aparelhos, '[]'::jsonb)) order by s.ref_local), '[]'::jsonb)
    from s
    left join rec on rec.sucursal_id = s.id
    left join ap on ap.sucursal_ref = s.ref_local;
$$;

-- ---------- classificação gerencial do motivo de estoque ----------
-- O cadastro de motivo NÃO tem classe (ver /pendencias/motivos-sem-classe).
-- A classe devolvida aqui é DERIVADA por regra — da origem do movimento e,
-- no lançamento manual, do nome do motivo — e vem marcada como tal.
create or replace function public.rds_classe_motivo(p_nome text, p_tipo text, p_origem text, p_direcao text)
returns text language sql stable as $$
  select case
    when p_origem = 'venda'      then 'venda'
    when p_origem = 'estorno'    then 'cancelamento'
    when p_origem = 'nota'       then 'compra'
    when p_origem = 'contagem'   then 'inventário'
    when p_origem = 'producao'   then 'produção'
    when p_origem in ('transferencia','pedbase_saida','pedbase_entrada') then 'transferência'
    when p_origem = 'fidelidade' then 'bonificação'
    when p_origem = 'importacao' then 'ajuste'
    else (select case
      when n ~ '(perda|quebra|avaria|vencid|estrag)' then 'perda'
      when n ~ 'descart'                             then 'descarte'
      when n ~ 'devolu'                              then 'devolução'
      when n ~ '(fidelidade|brinde|cortesia|bonific)' then 'bonificação'
      when n ~ '(transfer|outras? unidade|base para)' then 'transferência'
      when n ~ '(contagem|invent)'                   then 'inventário'
      when n ~ '(nota fiscal|compra)'                then 'compra'
      when n ~ '(venda)'                             then 'venda'
      when n ~ '(ganho de produ|produzir)'           then 'produção'
      when n ~ '(consumo|uso|markting|marketing|reuni)' then 'consumo'
      when n ~ '(ajuste|entrada manual)'             then 'ajuste'
      when p_tipo = 'producao'                       then 'produção'
      else 'outro' end
      from (select lower(extensions.unaccent(coalesce(p_nome,''))) n) x)
  end;
$$;

-- ---------- a linha gerencial de uma categoria do plano de contas ----------
-- Plano de contas = NATUREZA do lançamento. Conta financeira = ONDE o
-- dinheiro entrou ou saiu. São cadastros diferentes e esta regra só lê o
-- primeiro. A regra é da API (regra_versao), não é gravada no Joia.
create or replace function public.rds_linha_dre(p_cat text, p_cat_tipo text, p_sub text, p_texto text, p_tipo text)
returns text language sql stable as $$
  select case
    when p_tipo = 'transferencia'                         then 'fora_transferencia_entre_contas'
    when t = 'frente de caixa'                            then 'fora_venda_ja_apurada'
    when t = 'pedido de base'                             then 'intra_rede_venda_de_base'
    when t = 'transferencia'                              then 'fora_transferencia_entre_contas'
    when c = ''                                           then 'sem_plano_de_contas'
    when c = 'impostos diretos'                           then 'impostos'
    when c = 'franqueador' and p_cat_tipo = 'despesa' and s = 'royalties'         then 'royalties'
    when c = 'franqueador' and p_cat_tipo = 'despesa' and s like 'fundo de%'      then 'fundo_marketing'
    when c = 'franqueador' and p_cat_tipo = 'despesa'                             then 'outras_despesas'
    when c in ('franqueador','franqueado jolo')                                   then 'outras_receitas_operacionais'
    when c = 'despesas financeiras variaveis' and s in ('administradoras de cartoes','taxa de administracao')
                                                          then 'taxas_cartao_lancadas'
    when c = 'despesas financeiras variaveis' and s = 'aluguel pos' then 'despesas_administrativas'
    when c = 'despesas financeiras variaveis'             then 'despesas_financeiras'
    when c = 'custos diretos'                             then 'fora_compras_de_mercadoria'
    when c = 'pessoal'                                    then 'despesas_pessoal'
    when c = 'despesas operacionais fixas' and s in ('alugueis','condominio','iptu','luz','agua','gas',
         'seguro de imovel','estacionamento shopping','concessionarias') then 'despesas_ocupacao'
    when c = 'despesas operacionais fixas'                then 'despesas_administrativas'
    when c = 'despesas gerais variaveis'                  then 'despesas_variaveis'
    when c = 'investimento'                               then 'fora_investimento_imobilizado'
    when c = 'despesas nao operacionais' and s = 'dividendos' then 'fora_retiradas'
    when c = 'despesas nao operacionais' and s like '%emprestimo%' then 'fora_emprestimos'
    when c = 'despesas nao operacionais' and s like 'acertos%' then 'fora_emprestimos'
    when c = 'despesas nao operacionais'                  then 'outras_despesas'
    when c = 'vendas diretas'                             then 'fora_venda_ja_apurada'
    when c = 'financeiras' and s like 'rendimento%'       then 'receitas_financeiras'
    when c = 'financeiras' and s like 'aporte%'           then 'fora_aportes'
    when c = 'financeiras'                                then 'fora_emprestimos'
    when c = 'outras receitas' and s like 'aporte%'       then 'fora_aportes'
    when c = 'outras receitas' and (s like 'acertos%' or s like 'emprestimo%') then 'fora_emprestimos'
    when c = 'outras receitas'                            then 'outras_receitas_operacionais'
    when p_tipo = 'receita' or p_cat_tipo = 'receita'     then 'outras_receitas_operacionais'
    else 'outras_despesas' end
  from (select lower(extensions.unaccent(coalesce(p_cat,''))) c, lower(extensions.unaccent(coalesce(p_sub,''))) s,
               lower(extensions.unaccent(coalesce(p_texto,''))) t) x;
$$;

-- ---------- fator entre unidades de medida (g↔kg, ml↔l) ----------
create or replace function public.rds_fator(p_de text, p_para text)
returns numeric language sql immutable as $$
  select case
    when lower(coalesce(p_de,'')) = lower(coalesce(p_para,'')) then 1
    when lower(p_de) = 'kg' and lower(p_para) = 'g'  then 1000
    when lower(p_de) = 'g'  and lower(p_para) = 'kg' then 0.001
    when lower(p_de) in ('l','lt') and lower(p_para) = 'ml' then 1000
    when lower(p_de) = 'ml' and lower(p_para) in ('l','lt') then 0.001
    else 1 end;
$$;

-- ---------- comparação de filtro: sem acento, sem caixa ----------
create or replace function public.rds_norm(p text)
returns text language sql stable as $$ select lower(extensions.unaccent(trim(coalesce(p,'')))) $$;

-- ---------- lista: identidade, filtros, ordem e página ----------
-- p_linhas: array de registros. Cada registro ganha a identidade da
-- unidade (pelo `sucursal_id`) ANTES do filtro — a unidade viaja em
-- CADA registro, não só no cabeçalho.
create or replace function public.rds_lista(p_loja uuid, p_linhas jsonb, p_q jsonb, p_ids jsonb, p_rede jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_filtros jsonb := '{
    "situacao":["situacao","situacao_titulo","situacao_venda"],
    "categoria":["categoria","categoria_ref","subcategoria","plano_de_contas","classificacao_gerencial"],
    "produto":["produto_ref","produto","descricao","item_ref","item"],
    "grupo":["grupo","grupo_ref","subgrupo"],
    "canal":["canal"],
    "forma_pagamento":["forma_pagamento","forma_pagamento_ref","forma"],
    "operador":["operador","operador_ref"],
    "turno":["turno"]}'::jsonb;
  v_lin jsonb; v_aplic jsonb := '{}'::jsonb; v_ign text[] := '{}';
  k text; v_vals text[]; v_campos text[];
  v_ord text := nullif(trim(coalesce(p_q->>'ordenar_por','')),'');
  v_desc boolean := lower(coalesce(p_q->>'ordem','asc')) = 'desc';
  v_lim int := least(1000, greatest(1, coalesce(nullif(p_q->>'limite','')::int, 200)));
  v_pag int := greatest(1, coalesce(nullif(p_q->>'pagina','')::int, 1));
  v_desde timestamptz := nullif(p_q->>'alterados_desde','')::timestamptz;
  v_tot int; v_avisos text[] := '{}';
begin
  -- identidade
  select coalesce(jsonb_agg(
           case when r ? 'sucursal_id' and r->>'sucursal_id' is not null and p_ids ? (r->>'sucursal_id')
                then (p_ids->(r->>'sucursal_id')) || r
                else p_rede || r || jsonb_build_object('escopo_registro','rede') end
           order by o), '[]'::jsonb)
    into v_lin
    from jsonb_array_elements(coalesce(p_linhas,'[]'::jsonb)) with ordinality x(r, o);

  -- filtros de negócio: só valem onde o registro tem o campo
  for k in select jsonb_object_keys(v_filtros) loop
    continue when coalesce(p_q->>k,'') = '';
    v_vals := array(select rds_norm(x) from unnest(string_to_array(p_q->>k, ',')) x);
    v_campos := array(select jsonb_array_elements_text(v_filtros->k));
    if exists (select 1 from jsonb_array_elements(v_lin) r, unnest(v_campos) c where r ? c) then
      select coalesce(jsonb_agg(r order by o), '[]'::jsonb) into v_lin
        from jsonb_array_elements(v_lin) with ordinality x(r, o)
       where exists (select 1 from unnest(v_campos) c
                      where r ? c and rds_norm(r->>c) = any(v_vals));
      v_aplic := v_aplic || jsonb_build_object(k, p_q->>k);
    else
      v_ign := v_ign || k;
    end if;
  end loop;

  -- consulta incremental
  if v_desde is not null then
    select coalesce(jsonb_agg(r order by o), '[]'::jsonb) into v_lin
      from jsonb_array_elements(v_lin) with ordinality x(r, o)
     where (r->>'updated_at') is not null and (r->>'updated_at')::timestamptz >= v_desde;
    v_aplic := v_aplic || jsonb_build_object('alterados_desde', v_desde);
  end if;

  -- ordem
  if v_ord is not null then
    if exists (select 1 from jsonb_array_elements(v_lin) r where r ? v_ord) then
      select coalesce(jsonb_agg(r order by
               case when v_desc then null else r->v_ord end asc nulls last,
               case when v_desc then r->v_ord else null end desc nulls last, o), '[]'::jsonb)
        into v_lin
        from jsonb_array_elements(v_lin) with ordinality x(r, o);
    else
      v_avisos := v_avisos || ('ordenar_por="' || v_ord || '" não é campo destes registros: mantida a ordem padrão.');
    end if;
  end if;

  v_tot := jsonb_array_length(v_lin);
  return jsonb_build_object(
    'dados', coalesce((select jsonb_agg(r order by o) from jsonb_array_elements(v_lin) with ordinality x(r, o)
                        where o > (v_pag - 1) * v_lim and o <= v_pag * v_lim), '[]'::jsonb),
    'paginacao', jsonb_build_object('pagina', v_pag, 'limite', v_lim, 'total_registros', v_tot,
                                    'total_paginas', ceil(v_tot::numeric / v_lim)::int,
                                    'nesta_pagina', greatest(0, least(v_lim, v_tot - (v_pag - 1) * v_lim))),
    'filtros_aplicados', v_aplic,
    'filtros_que_nao_se_aplicam', to_jsonb(v_ign),
    'avisos_lista', to_jsonb(v_avisos));
end;
$$;

-- ---------- ninguém de fora chama: só a função de borda (service_role) ----------
revoke all on function public.rds_unidades(uuid) from public, anon, authenticated;
grant execute on function public.rds_unidades(uuid) to service_role;
revoke all on function public.rds_rede(uuid) from public, anon, authenticated;
grant execute on function public.rds_rede(uuid) to service_role;
revoke all on function public.rds_sincronizacao(uuid, text[]) from public, anon, authenticated;
grant execute on function public.rds_sincronizacao(uuid, text[]) to service_role;
revoke all on function public.rds_classe_motivo(text, text, text, text) from public, anon, authenticated;
grant execute on function public.rds_classe_motivo(text, text, text, text) to service_role;
revoke all on function public.rds_linha_dre(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.rds_linha_dre(text, text, text, text, text) to service_role;
revoke all on function public.rds_fator(text, text) from public, anon, authenticated;
grant execute on function public.rds_fator(text, text) to service_role;
revoke all on function public.rds_norm(text) from public, anon, authenticated;
grant execute on function public.rds_norm(text) to service_role;
revoke all on function public.rds_lista(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.rds_lista(uuid, jsonb, jsonb, jsonb, jsonb) to service_role;

-- FOTOGRAFIA DA PRODUÇÃO, 06/10/2026 — funções dos gatilhos e das regras de acesso, como estão no ar.
CREATE OR REPLACE FUNCTION public.begin_id(t text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
begin return t::uuid; exception when others then return null; end $function$
;
CREATE OR REPLACE FUNCTION public.bump_loja_versao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_txt text;
  v_loja uuid;
begin
  -- gravação que não mudou nada não é versão nova: sem isto, o vínculo de
  -- produção regravado a cada envio virava aviso para todos os aparelhos,
  -- que enviavam de novo — um ciclo sem fim (04/10/2026)
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'alterado_em' - 'sucursais_vista' - 'versao_vista')
                         = (to_jsonb(old) - 'alterado_em' - 'sucursais_vista' - 'versao_vista') then
    return new;
  end if;
  v_txt := coalesce(new.loja_id::text, old.loja_id::text);
  if v_txt is null then return coalesce(new, old); end if;
  if v_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then return coalesce(new, old);
  end if;
  v_loja := v_txt::uuid;
  insert into public.loja_versao (loja_id, versao, atualizado_em)
       values (v_loja, 1, now())
  on conflict (loja_id) do update
       set versao = public.loja_versao.versao + 1, atualizado_em = now();
  return coalesce(new, old);
end $function$
;
CREATE OR REPLACE FUNCTION public.carimbar_alteracao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    new.alterado_em := now();
  elsif (to_jsonb(new) - 'alterado_em') is distinct from (to_jsonb(old) - 'alterado_em') then
    new.alterado_em := now();
  else
    new.alterado_em := old.alterado_em;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.conta_ativa()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    -- 1) o acesso nao pode estar desativado
    coalesce((
      select bool_or(u.ativo and u.excluido_em is null)
        from usuarios_sistema u
        join perfis p on p.loja_id = u.loja_id
       where p.id = auth.uid()
         and lower(u.login) = lower(coalesce(auth.jwt()->>'email',''))
    ), true)
    -- 2) e o token precisa ter sido emitido DEPOIS da ultima revogacao
    and coalesce((
      select to_timestamp((auth.jwt()->>'iat')::bigint) >= p.sessoes_desde
        from perfis p where p.id = auth.uid() and p.sessoes_desde is not null
    ), true);
$function$
;
CREATE OR REPLACE FUNCTION public.forcar_minha_loja()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare minha uuid;
begin
  if auth.uid() is null then
    if new.loja_id is null then
      raise exception 'gravação de servidor sem empresa definida em %', tg_table_name
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if sou_plataforma() then
    if new.loja_id is null then
      raise exception 'a plataforma precisa informar a empresa ao gravar em %', tg_table_name
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  minha := minha_loja();
  if minha is null then
    raise exception 'sessão sem empresa: não é possível gravar em %', tg_table_name
      using errcode = 'check_violation';
  end if;

  -- NAO ADOTA MAIS ORFAO: sem empresa de origem, nao grava
  if new.loja_id is null then
    raise exception 'registro sem empresa de origem não pode ser gravado em % — '
      'a operação deve informar a empresa em que foi criada', tg_table_name
      using errcode = 'check_violation';
  end if;

  if new.loja_id <> minha then
    raise exception 'esta operação foi criada em outra empresa e não pode ser '
      'gravada nesta sessão (%).', tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.login_da_minha_equipe(p_loja uuid, p_login text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select minha_unidade_gerente() is not null and not exists (
    select 1 from auth.users a join perfis p on p.id = a.id
     where lower(a.email) = lower(p_login)
       and not (p.cargo in ('operador','caixa') and p.loja_id = p_loja
                and p.sucursal_ref = minha_unidade_gerente()));
$function$
;
CREATE OR REPLACE FUNCTION public.lojas_com_cardapio()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select array(select distinct c.loja_id from cardapio_config c where c.ativo and c.loja_id is not null);
$function$
;
CREATE OR REPLACE FUNCTION public.meu_cargo()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when conta_ativa()
              then (select cargo from perfis where id = auth.uid())
              else null end;
$function$
;
CREATE OR REPLACE FUNCTION public.minha_empresa()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select empresa_id from perfis where id = auth.uid() $function$
;
CREATE OR REPLACE FUNCTION public.minha_loja()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when conta_ativa()
              then (select loja_id from perfis where id = auth.uid())
              else null end;
$function$
;
CREATE OR REPLACE FUNCTION public.minha_rede_plena()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select conta_ativa() and sou_plataforma();
$function$
;
CREATE OR REPLACE FUNCTION public.minha_sucursal_ref()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select sucursal_ref from perfis where id = auth.uid(); $function$
;
CREATE OR REPLACE FUNCTION public.minha_sucursal_uuid()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id from sucursais s
   join perfis p on p.id = auth.uid()
   where s.ref_local = p.sucursal_ref and s.loja_id = p.loja_id
   limit 1;
$function$
;
CREATE OR REPLACE FUNCTION public.minha_unidade_gerente()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when conta_ativa() then
    (select p.sucursal_ref from perfis p
      where p.id = auth.uid() and p.cargo = 'gerente' and p.sucursal_ref is not null)
  end;
$function$
;
CREATE OR REPLACE FUNCTION public.minhas_lojas()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when conta_ativa() then
    array(select x from (select minha_loja() as x
                         union select l.id from lojas l where sou_admin() and l.empresa_id = minha_empresa()) s
          where x is not null)
  else '{}'::uuid[] end;
$function$
;
CREATE OR REPLACE FUNCTION public.posso(p_chave text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when meu_cargo() in ('admin','plataforma') then true
    else coalesce((
      select (u.tudo or u.mestre
              or coalesce((u.permissoes -> p_chave)::text = 'true', false))
        from usuarios_sistema u
       where u.loja_id = minha_loja()
         and lower(u.login) = lower(coalesce(auth.jwt()->>'email',''))
         and u.ativo
       limit 1), false)
  end;
$function$
;
CREATE OR REPLACE FUNCTION public.resolve_forma_pagamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_loja       uuid;
  v_loja_forma uuid;
begin
  select p.loja_id into v_loja from pedidos p where p.id = new.pedido_id;
  if new.forma_id is null and new.forma_ref is not null and v_loja is not null then
    select f.id into new.forma_id from formas_pagamento f
     where f.loja_id = v_loja and f.ref_local = new.forma_ref limit 1;
  end if;
  if new.forma_id is null then
    raise exception
      'pagamento sem forma de pagamento válida (venda %, referência %)',
      new.pedido_id, coalesce(new.forma_ref, '(vazia)')
      using errcode = '23514',
            hint = 'a forma precisa existir no cadastro desta loja';
  end if;
  select f.loja_id into v_loja_forma from formas_pagamento f where f.id = new.forma_id;
  if v_loja_forma is null then
    raise exception 'forma de pagamento inexistente (venda %)', new.pedido_id
      using errcode = '23514';
  end if;
  if v_loja is not null and v_loja_forma <> v_loja then
    raise exception
      'forma de pagamento de outra empresa recusada (venda %)', new.pedido_id
      using errcode = '42501';
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.sou_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select p.cargo in ('admin','plataforma') and p.sucursal_ref is null
      from perfis p where p.id = auth.uid()), false);
$function$
;
CREATE OR REPLACE FUNCTION public.sou_gestor()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(meu_cargo() in ('admin','plataforma'), false);
$function$
;
CREATE OR REPLACE FUNCTION public.sou_plataforma()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select cargo = 'plataforma' from perfis where id = auth.uid()), false);
$function$
;
CREATE OR REPLACE FUNCTION public.tg_auditar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; lj uuid; em text; jantes jsonb; jdepois jsonb; k text;
  sensiveis text[] := array[
    'senha','senha_hash','token','access_token','refresh_token',
    'api_key','apikey','chave','chave_api','secret','app_secret',
    'meta_token','meta_app_secret','webhook_token','verify_token',
    'sessao','session','credencial','credenciais','qr','qrcode'];
begin
  -- gravacao que nao mudou nada nao e alteracao: nao ha o que auditar
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;

  r := coalesce(new, old);
  begin lj := (to_jsonb(r)->>'loja_id')::uuid; exception when others then lj := null; end;
  select email into em from auth.users where id = auth.uid();

  jantes  := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  jdepois := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;

  foreach k in array sensiveis loop
    -- registra apenas QUE houve alteracao, nunca o valor
    if jantes ? k or jdepois ? k then
      if tg_op = 'UPDATE'
         and (jantes->>k) is distinct from (jdepois->>k) then
        jdepois := jsonb_set(coalesce(jdepois,'{}'::jsonb), array[k],
                             to_jsonb('(alterado)'::text));
      elsif jdepois ? k then
        jdepois := jdepois - k;
      end if;
      jantes := jantes - k;
    end if;
  end loop;

  insert into audit_log(loja_id, usuario, usuario_email, cargo, tabela, operacao,
                        registro_id, ref_local, antes, depois)
  values (lj, auth.uid(), em, (select cargo from perfis where id = auth.uid()),
    tg_table_name, tg_op, begin_id(to_jsonb(r)->>'id'), to_jsonb(r)->>'ref_local',
    jantes, jdepois);
  return coalesce(new, old);
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_brinde_nulo_nao_apaga()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.brinde_fidelidade is null then
    new.brinde_fidelidade := old.brinde_fidelidade;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_caixa_fechado_trava_movimento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_fechado timestamptz;
  v_caixa   uuid;
begin
  v_caixa := coalesce(new.caixa_id, old.caixa_id);
  select fechado_em into v_fechado from caixas where id = v_caixa;
  if v_fechado is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'movimento de caixa ja fechado nao pode ser excluido (caixa %)', v_caixa
      using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if new.ref_local is not null and exists (select 1 from caixa_movimentos where ref_local = new.ref_local) then
      return new;
    end if;
    raise exception 'caixa ja fechado nao aceita novo movimento (caixa %)', v_caixa
      using errcode = '23514';
  end if;
  if new.tipo is distinct from old.tipo then
    raise exception 'tipo de movimento em caixa fechado nao muda (caixa %)', v_caixa
      using errcode = '23514';
  end if;
  return new;
end $function$
;
-- tg_cancelamento_estorna: na produção chama estoque_aplicar() dentro de um bloco
-- que engole falhas; no banco de cópia só marca a venda como cancelada.
CREATE OR REPLACE FUNCTION public.tg_cancelamento_estorna()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ped record;
begin
  select * into ped from pedidos
   where loja_id = new.loja_id and ref_local = new.pedido_ref;
  if not found then return new; end if;
  update pedidos set fase = 'cancelado' where id = ped.id and fase <> 'cancelado';
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_conta_fabrica_nao_sobrescreve()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.ref_local in ('ct_caixa','ct_cofre','ct_banco')
     and new.nome in ('Caixa da loja','Cofre','Banco — conta corrente')
     and new.banco is null and new.agencia is null and new.numero is null
     and (old.nome is distinct from new.nome
          or old.banco is not null or old.agencia is not null or old.numero is not null)
  then
    raise warning 'conta %: valor de fábrica recusado — mantido o que a loja configurou', old.ref_local;
    return old;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_enderecos_nulo_nao_apaga()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.enderecos is null then
    new.enderecos := old.enderecos;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_fechamento_nao_se_apaga()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if old.fechado_em is not null and new.fechado_em is null then
    new.fechado_em := old.fechado_em;
  end if;
  if old.fechado_txt is not null and coalesce(new.fechado_txt,'') = '' then
    new.fechado_txt := old.fechado_txt;
  end if;
  if coalesce(old.conferencia, '{}'::jsonb) <> '{}'::jsonb
     and coalesce(new.conferencia, '{}'::jsonb) = '{}'::jsonb then
    new.conferencia        := old.conferencia;
    new.contado            := old.contado;
    new.total_informado    := old.total_informado;
    new.esperado           := old.esperado;
    new.esperado_por_forma := coalesce(new.esperado_por_forma, old.esperado_por_forma);
    new.diferenca_total    := old.diferenca_total;
    new.conciliado         := old.conciliado;
    new.vendas             := case when coalesce(new.vendas,0) = 0 then old.vendas else new.vendas end;
    new.qtd_pedidos        := case when coalesce(new.qtd_pedidos,0) = 0 then old.qtd_pedidos else new.qtd_pedidos end;
    new.fundo_proximo      := case when coalesce(new.fundo_proximo,0) = 0 then old.fundo_proximo else new.fundo_proximo end;
  end if;
  if old.snapshot is not null and new.snapshot is null then
    new.snapshot := old.snapshot;
  end if;
  if old.fechado_por is not null and new.fechado_por is null then
    new.fechado_por := old.fechado_por;
    new.fechado_por_id := coalesce(new.fechado_por_id, old.fechado_por_id);
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_forma_fabrica_nao_sobrescreve()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fab boolean;
begin
  fab := new.conta_id is null and coalesce(new.taxa_fixa,0) = 0 and (
       (new.ref_local = 'fp_debito'  and new.taxa_pct = 1.99 and new.dias_recebimento = 1)
    or (new.ref_local = 'fp_credito' and new.taxa_pct = 3.49 and new.dias_recebimento = 30)
    or (new.ref_local = 'fp_pix'     and new.taxa_pct = 0    and new.dias_recebimento = 0)
    or (new.ref_local = 'fp_voucher' and new.taxa_pct = 0    and new.dias_recebimento = 30));
  if fab and (old.conta_id is not null
              or old.taxa_pct is distinct from new.taxa_pct
              or old.dias_recebimento is distinct from new.dias_recebimento) then
    raise warning 'forma %: valor de fábrica recusado — mantido o que a loja configurou', old.ref_local;
    return old;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_limitar_gerente_unidade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare un text; meu record; k text; limpo jsonb := '{}'::jsonb;
begin
  un := minha_unidade_gerente();
  if un is null then return new; end if;
  select tudo, mestre, permissoes into meu from usuarios_sistema
   where loja_id = new.loja_id
     and lower(login) = lower(coalesce(auth.jwt() ->> 'email', ''))
     and ativo limit 1;
  new.tudo := false;
  new.mestre := false;
  new.sucursais := jsonb_build_array(un);
  if jsonb_typeof(new.permissoes) = 'object' then
    for k in select jsonb_object_keys(new.permissoes) loop
      if k = 'controle/baixa-manual:lancar'
         or coalesce(meu.tudo, false) or coalesce(meu.mestre, false)
         or coalesce((meu.permissoes -> k)::text = 'true', false) then
        limpo := limpo || jsonb_build_object(k, new.permissoes -> k);
      end if;
    end loop;
  end if;
  new.permissoes := limpo;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_pagamento_nao_duplica()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total   numeric;
  v_pago    numeric;
  v_gemeos  integer;
begin
  select total into v_total from pedidos where id = new.pedido_id;
  if v_total is null or v_total <= 0 then
    return new;
  end if;
  select coalesce(sum(valor),0) into v_pago
    from pedido_pagamentos
   where pedido_id = new.pedido_id;
  if v_pago + new.valor <= v_total + 0.05 then
    return new;
  end if;
  select count(*) into v_gemeos
    from pedido_pagamentos
   where pedido_id = new.pedido_id
     and abs(valor - new.valor) < 0.005
     and (
          (forma_ref is not null and forma_ref is not distinct from new.forma_ref)
       or (forma_id  is not null and forma_id  is not distinct from new.forma_id)
     );
  if v_gemeos > 0 then
    raise warning 'pagamento repetido ignorado: venda %, valor %', new.pedido_id, new.valor;
    return null;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_pagamento_sem_valor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(new.valor, 0) <= 0.009 then
    raise warning 'pagamento sem valor ignorado: venda %, forma %',
      new.pedido_id, coalesce(new.forma_ref, new.forma_id::text, '-');
    return null;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_pedido_preenche_sucursal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.sucursal_id is null and new.caixa_id is not null then
    select s.id into new.sucursal_id
    from caixas c
    join sucursais s
      on s.ref_local = c.sucursal_id or s.id::text = c.sucursal_id
    where c.id = new.caixa_id;
  end if;
  if new.sucursal_id is null then
    new.sucursal_id := minha_sucursal_uuid();
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_saldo_mais_novo_vence()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  papel text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '');
begin
  if papel <> 'authenticated' then
    return new;
  end if;
  if old.atualizado_em is not null
     and (new.atualizado_em is null or new.atualizado_em < old.atualizado_em) then
    raise warning 'estoque_unidade %: saldo antigo recusado (chegou %, a nuvem está em %)',
      old.ref_local, new.atualizado_em, old.atualizado_em;
    return old;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_senha_nunca_em_claro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(new.senha,'') <> '' then
    raise warning 'senha em texto puro descartada no cadastro de % (use o Supabase Auth)', new.login;
    new.senha := null;
  end if;
  if coalesce(new.senha_caixa,'') <> '' then
    raise warning 'senha de caixa em texto puro descartada (%): use operador_senhas', new.login;
    new.senha_caixa := null;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_sucursais_vista()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  vista jsonb := new.sucursais_vista;
  papel text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '');
begin
  new.sucursais_vista := null;
  if papel <> 'authenticated' or new.sucursais is not distinct from old.sucursais then
    return new;
  end if;
  if vista is null then
    if old.sucursais is not null and not (coalesce(new.sucursais,'[]'::jsonb) @> old.sucursais) then
      raise warning '% %: aparelho sem recibo tentou esconder (% -> %)',
        tg_table_name, old.ref_local, old.sucursais, new.sucursais;
      new.sucursais := old.sucursais;
    end if;
    return new;
  end if;
  if old.sucursais is distinct from vista then
    raise warning '% %: liberação antiga recusada (o aparelho viu %, a nuvem está em %)',
      tg_table_name, old.ref_local, vista, old.sucursais;
    new.sucursais := old.sucursais;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_tempo_digitado_e_lei()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if (new.tempo_entrega is distinct from old.tempo_entrega
      or new.tempo_retirada is distinct from old.tempo_retirada) then
    if new.tempos_em is null
       or (old.tempos_em is not null and new.tempos_em <= old.tempos_em) then
      new.tempo_entrega := old.tempo_entrega;
      new.tempo_retirada := old.tempo_retirada;
      new.tempos_em := old.tempos_em;
    end if;
  end if;
  if coalesce(new.tempo_entrega, '') = '' and coalesce(old.tempo_entrega, '') <> '' then
    new.tempo_entrega := old.tempo_entrega;
  end if;
  if coalesce(new.tempo_retirada, '') = '' and coalesce(old.tempo_retirada, '') <> '' then
    new.tempo_retirada := old.tempo_retirada;
  end if;
  if old.tempos_em is not null and (new.tempos_em is null or new.tempos_em < old.tempos_em) then
    new.tempos_em := old.tempos_em;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_versao_vista()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  vista timestamptz := new.versao_vista;
  papel text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '');
begin
  new.versao_vista := null;
  if papel <> 'authenticated' then
    return new;
  end if;
  if old.alterado_em is not null and (vista is null or vista < old.alterado_em) then
    raise warning '% %: cópia antiga recusada (o aparelho viu %, a nuvem está em %)',
      tg_table_name, old.ref_local, vista, old.alterado_em;
    return old;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.trava_horario_padrao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  eh_padrao boolean;
begin
  if NEW.horarios is null or jsonb_array_length(NEW.horarios) = 0 then
    NEW.horarios := OLD.horarios;
    return NEW;
  end if;
  select bool_and(d->>'abre'='14:00' and d->>'fecha'='22:30')
         and bool_or((d->>'dia')::int=1 and (d->>'fechado')::boolean)
    into eh_padrao
  from jsonb_array_elements(NEW.horarios) d;
  if coalesce(eh_padrao,false)
     and OLD.horarios is not null
     and jsonb_array_length(OLD.horarios) > 0
     and OLD.horarios <> NEW.horarios then
    raise warning 'horario padrao recusado: mantido o horario ja cadastrado';
    NEW.horarios := OLD.horarios;
  end if;
  return NEW;
end $function$
;
CREATE OR REPLACE FUNCTION public.trava_pagamento_repetido()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare ja int;
begin
  select count(*) into ja from pedido_pagamentos g
   where g.pedido_id = NEW.pedido_id
     and g.id <> coalesce(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid)
     and g.valor = NEW.valor
     and coalesce(g.forma_ref,'') = coalesce(NEW.forma_ref,'')
     and regexp_replace(coalesce(g.ref_local,''),'_pg(\d+)$','_\1')
       = regexp_replace(coalesce(NEW.ref_local,''),'_pg(\d+)$','_\1');
  if ja > 0 then
    raise warning 'pagamento repetido ignorado: pedido % valor %', NEW.pedido_id, NEW.valor;
    return null;
  end if;
  return NEW;
end $function$
;
CREATE OR REPLACE FUNCTION public.vejo_todas_unidades()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select sou_admin() or sou_plataforma(); $function$
;

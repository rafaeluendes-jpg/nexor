-- ==========================================================
-- FISCAL POR UNIDADE — NFC-e nas lojas, NF-e na matriz (28/09/2026)
--
-- Cada unidade da rede e um EMITENTE: CNPJ, chave da API, CSC, serie e
-- numeracao sao dela. Nada e herdado de outra loja. Foi a mistura entre
-- unidades que fez a Carla de Santa Fe se apresentar como a de
-- Alphaville (26/09/2026); no fiscal a mesma mistura sairia com o CNPJ
-- errado impresso num documento que vale para a Receita.
--
-- Por isso este modulo NAO passa pela sincronizacao comum:
--   * fiscal_conta e fiscal_unidades so sao lidas e escritas pela edge
--     function `joia-fiscal` (service_role). RLS ligada e SEM politica:
--     o navegador nao enxerga nada daqui, nem da propria loja.
--   * as chaves da Spedy moram no cofre (vault). Nesta tabela fica so o
--     NOME do segredo. As duas funcoes abaixo sao a unica porta, e so o
--     service_role executa.
--   * o CSC da SEFAZ tambem vai para o cofre (ver a segunda parte, no
--     fim deste arquivo) e nunca volta para tela nenhuma.
-- ==========================================================

-- a conta da rede na Spedy (a empresa "titular", que cria as demais)
create table if not exists public.fiscal_conta (
  loja_id           uuid primary key references public.lojas(id) on delete cascade,
  segredo_nome      text not null,
  host              text not null check (host in ('sandbox','producao')),
  titular_company_id text,
  titular_cnpj      text,
  titular_nome      text,
  verificada_em     timestamptz,
  atualizado_em     timestamptz not null default now()
);

create table if not exists public.fiscal_unidades (
  loja_id              uuid not null references public.lojas(id) on delete cascade,
  sucursal_ref         text not null,
  sucursal_id          uuid,
  -- o elo com a Spedy. So existe quando o CNPJ da empresa na Spedy e o
  -- MESMO da unidade no Joia — conferido pela funcao, nunca pelo navegador
  spedy_company_id     text,
  segredo_nome         text,
  cnpj                 text,
  razao_social         text,
  -- como a loja emite
  modo                 text not null default 'desligado'
                       check (modo in ('sempre','opcional','desligado')),
  ambiente             text not null default 'homologacao'
                       check (ambiente in ('homologacao','producao')),
  serie                integer not null default 1,
  pede_cpf             text not null default 'perguntar'
                       check (pede_cpf in ('nunca','perguntar','acima')),
  pede_cpf_acima       numeric,
  imprime              text not null default 'perguntar'
                       check (imprime in ('sempre','perguntar','nunca')),
  manda_whatsapp       boolean not null default false,
  contingencia_offline boolean not null default true,
  regime               text check (regime in ('simplesNacional','simplesNacionalExcessoSublimite','simplesNacionalMEI','regimeNormal')),
  pis_cst              text not null default '07',
  cofins_cst           text not null default '07',
  -- producao so com confirmacao escrita (CNPJ digitado de volta)
  producao_confirmada_por text,
  producao_confirmada_em  timestamptz,
  atualizado_por       text,
  atualizado_em        timestamptz not null default now(),
  primary key (loja_id, sucursal_ref)
);

-- trilha: quem fez o que no fiscal
create table if not exists public.fiscal_eventos (
  id           bigserial primary key,
  loja_id      uuid not null,
  sucursal_ref text,
  quem         uuid,
  acao         text not null,
  nota_id      text,
  resultado    text,
  detalhe      jsonb,
  em           timestamptz not null default now()
);
create index if not exists fiscal_eventos_loja_em on public.fiscal_eventos (loja_id, em desc);

alter table public.fiscal_conta    enable row level security;
alter table public.fiscal_unidades enable row level security;
alter table public.fiscal_eventos  enable row level security;
revoke all on public.fiscal_conta, public.fiscal_unidades, public.fiscal_eventos from anon, authenticated;
revoke all on sequence public.fiscal_eventos_id_seq from anon, authenticated;

-- ---------- o cofre: a unica porta das chaves ----------
create or replace function public.fiscal_segredo_ler(p_nome text)
returns text language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_nome limit 1;
$$;

create or replace function public.fiscal_segredo_gravar(p_nome text, p_valor text, p_desc text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_nome is null or p_nome !~ '^spedy_[a-z0-9_]+$' then
    raise exception 'nome de segredo invalido';
  end if;
  select id into v_id from vault.secrets where name = p_nome;
  if v_id is null then
    v_id := vault.create_secret(p_valor, p_nome, p_desc);
  else
    perform vault.update_secret(v_id, p_valor, p_nome, p_desc);
  end if;
  return v_id;
end $$;

revoke all on function public.fiscal_segredo_ler(text) from public, anon, authenticated;
revoke all on function public.fiscal_segredo_gravar(text, text, text) from public, anon, authenticated;
grant execute on function public.fiscal_segredo_ler(text) to service_role;
grant execute on function public.fiscal_segredo_gravar(text, text, text) to service_role;

-- ---------- segunda parte (mesmo dia) ----------
-- A SEFAZ entrega um CSC para homologacao e OUTRO para producao. O ID de
-- cada um fica aqui; o codigo, no cofre (spedy_csc_<unidade>_<ambiente>).
-- Guardar os dois deixa trocar de ambiente sem redigitar nada — e toda
-- alteracao de configuracao na Spedy reenvia o CSC certo, em vez de
-- arriscar apaga-lo mandando o bloco sem ele.
alter table public.fiscal_unidades
  add column if not exists csc_id_homologacao text,
  add column if not exists csc_id_producao    text;

-- uma empresa da Spedy (um CNPJ) nunca serve a duas unidades
create unique index if not exists fiscal_unidades_uma_empresa
  on public.fiscal_unidades (loja_id, spedy_company_id)
  where spedy_company_id is not null;

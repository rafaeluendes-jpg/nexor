-- =====================================================================
-- VALOR DE FÁBRICA NÃO PASSA POR CIMA DO QUE A LOJA CONFIGUROU
-- — A LEI MORA NO BANCO (29/09/2026)
--
-- Rafael: "salvamos os bancos pela 10ª vez e toda atualização some; as
-- taxas de cartão também. Trave tudo; isso tem que ser lei dentro do
-- sistema."
--
-- O audit_log mostra o mesmo desenho desde agosto: um aparelho com a cópia
-- de fábrica ("Banco — conta corrente", sem banco/agência/conta; débito
-- 1,99% e crédito 3,49%/30 dias, sem conta) grava por cima do que a loja
-- configurou. As taxas voltaram sete vezes entre 26/08 e 10/09; o banco
-- "Itaú — conta corrente" voltou em 27/09, 28/09 e de novo em 29/09 às
-- 13:47 — já com a versão V362, que tranca a semente no aparelho. Cada
-- correção no aparelho fechou um caminho; outro aparecia.
--
-- Esta regra não depende do aparelho, da versão nem do caminho: o banco
-- de dados recusa, na gravação, a troca de um registro configurado pela
-- loja pelo valor de fábrica. O registro fica como estava.
--
-- Não bloqueia nada que a pessoa faça de propósito na tela: renomear,
-- trocar agência, mudar taxa, prazo ou banco de destino — tudo passa. Só
-- não passa a volta EXATA ao valor de fábrica apagando o que existia.
-- =====================================================================

create or replace function public.tg_conta_fabrica_nao_sobrescreve()
returns trigger language plpgsql as $$
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
end $$;

drop trigger if exists aa_fabrica_nao_sobrescreve on public.contas_capital;
create trigger aa_fabrica_nao_sobrescreve before update on public.contas_capital
  for each row execute function public.tg_conta_fabrica_nao_sobrescreve();

create or replace function public.tg_forma_fabrica_nao_sobrescreve()
returns trigger language plpgsql as $$
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
end $$;

drop trigger if exists aa_fabrica_nao_sobrescreve on public.formas_pagamento;
create trigger aa_fabrica_nao_sobrescreve before update on public.formas_pagamento
  for each row execute function public.tg_forma_fabrica_nao_sobrescreve();

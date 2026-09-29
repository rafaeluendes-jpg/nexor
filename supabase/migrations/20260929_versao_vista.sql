-- =====================================================================
-- NINGUÉM GRAVA POR CIMA DE UMA VERSÃO QUE NÃO VIU
-- — BANCOS E TAXAS SÓ SAEM POR QUEM APAGA (29/09/2026)
--
-- Rafael: "Se eu cadastrar outro banco, ou outras taxas, isso não vai ser
-- apagado nunca, até eu mesmo apagar manualmente?"
--
-- A lei de fábrica (20260929_fabrica_nao_sobrescreve) só barrava a volta
-- EXATA ao valor de fábrica, e só nos ids fixos (ct_*, fp_*). A auditoria
-- de 29/09 achou caminhos em que um aparelho sobe a SUA cópia antiga — de
-- qualquer banco ou taxa, inclusive um cadastrado depois — por cima do que
-- já está salvo: impressão da tabela apagada por um vínculo de outra
-- tabela, unidade que nunca recebe as contas, cópia de arquivo importada,
-- semente num aparelho de login novo, limpeza de "duplicados" por nome.
--
-- A regra agora não depende de caminho: cada aparelho diz qual versão da
-- linha ele viu por último (versao_vista = o alterado_em que desceu da
-- nuvem). Se a linha na nuvem é mais nova do que isso, a gravação é
-- recusada e a linha fica como está. Quem está vendo o valor de hoje
-- altera normalmente; ninguém grava às cegas. Apagar continua sendo só a
-- exclusão feita pela tela (declararExclusao).
--
-- versao_vista é só o recibo do envio: na atualização o gatilho a esvazia
-- antes de gravar, então ela não muda o conteúdo da linha nem o
-- alterado_em. O gatilho é só de UPDATE de propósito: no upsert, o que um
-- gatilho de INSERT muda passa para o EXCLUDED, e esvaziar ali apagaria o
-- recibo antes de ele ser conferido. Banco e taxa NOVOS entram sempre.
-- Vale para o sistema (papel authenticated); rotina interna do banco
-- (service_role, SQL do administrador) não passa por aqui.
-- =====================================================================

alter table public.contas_capital   add column if not exists versao_vista timestamptz;
alter table public.formas_pagamento add column if not exists versao_vista timestamptz;

create or replace function public.tg_versao_vista()
returns trigger language plpgsql as $$
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
end $$;

drop trigger if exists ab_versao_vista on public.contas_capital;
create trigger ab_versao_vista before update on public.contas_capital
  for each row execute function public.tg_versao_vista();

drop trigger if exists ab_versao_vista on public.formas_pagamento;
create trigger ab_versao_vista before update on public.formas_pagamento
  for each row execute function public.tg_versao_vista();

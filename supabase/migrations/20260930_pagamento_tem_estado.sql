-- ============================================================
-- O PAGAMENTO NAO TINHA ESTADO (RDS 9)
--
-- A RDS pede maquina de estados independente para venda, pagamento e
-- documento fiscal. No Joia o fiscal tem onze estados e e a mais madura
-- do sistema; a venda tem um campo de fase; e o PAGAMENTO nao tinha
-- nada — `{forma, valor, recebido, equipamento}` e mais nada.
--
-- Consequencia pratica: cancelar uma venda deixava o pagamento intacto,
-- do mesmo jeito que deixava o cupom fiscal autorizado (corrigido na
-- V373). Nao havia como perguntar ao banco "quais pagamentos foram
-- estornados", porque a resposta nao existia em lugar nenhum.
--
-- ---------- os estados que EXISTEM de verdade ----------
--   recebido  — o operador conferiu o dinheiro, a maquininha ou o Pix
--               e fechou a venda. E o estado de nascimento.
--   estornado — a venda foi cancelada; o pagamento deixou de valer.
--
-- ---------- e o que NAO da para ter ----------
-- A tabela da RDS tem linhas com "pagamento nao aprovado" e "estorno
-- pendente". Elas dependem de o sistema FALAR com a maquininha — TEF ou
-- integracao de adquirente — e o Joia nao fala: o operador digita o
-- valor e confirma. Inventar esses estados seria criar campo que nunca
-- muda de valor, o pior tipo de mentira num relatorio de auditoria: a
-- que parece controle.
--
-- O padrao `recebido` vale para todo pagamento que ja existe — e o que
-- eles sao, desde sempre.
-- ============================================================
alter table public.pedido_pagamentos
  add column if not exists situacao      text not null default 'recebido',
  add column if not exists estornado_em  timestamptz,
  add column if not exists estornado_por text;

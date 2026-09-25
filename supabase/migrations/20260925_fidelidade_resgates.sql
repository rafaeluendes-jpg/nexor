-- =====================================================================
-- JOIA — O CARTÃO FIDELIDADE VIAJA COM O CLIENTE (Rafael, 25/09/2026)
--
-- "Quando ela fizer 10 compras, ela ganha um cascão de uma bola. Eu
-- preciso ter acesso a isso, que ela resgatou tal dia."
--
-- A contagem NÃO é guardada: ela é lida dos pedidos toda vez (contador
-- guardado mente assim que um pedido é cancelado ou entra por outro
-- aparelho). O que precisa ser guardado é o RESGATE — dia, hora, loja,
-- quem entregou e qual movimento de estoque ele gerou.
--
-- Uma coluna jsonb no próprio cliente, e não uma tabela nova: são
-- poucos por cliente, sempre lidos junto com ele, e assim o resgate
-- feito em Santa Fé aparece na ficha dele em qualquer aparelho sem
-- mais uma consulta em toda abertura de tela.
-- =====================================================================
alter table public.clientes
  add column if not exists fidelidade_resgates jsonb not null default '[]'::jsonb;

comment on column public.clientes.fidelidade_resgates is
  'Resgates do programa de fidelidade: [{id, em, data, hora, sucursalId, por, brinde, produtoId, movId, compras}]. A contagem atual não mora aqui — ela é lida dos pedidos.';

-- ==========================================================
-- SEGURANÇA (01/10/2026)
--
-- 1. Quem NÃO fez login (o cardápio digital) lia a linha inteira da
--    unidade: mensalidade, plano, cobrança e o login do responsável.
--    Passa a ler só o que a vitrine mostra. Das formas de pagamento,
--    sai a taxa do cartão e a conta bancária.
--    O cardápio (rafaeluendes-jpg/delivery, 9826e92) já pede só estas
--    colunas. Logado, nada muda: a regra é só para o papel anon.
--
-- 2. A conferência antiga da senha do operador (2 parâmetros) não tem a
--    trava de 5 erros. O sistema usa a de 3 parâmetros. A antiga fica
--    sem acesso de fora; o próprio banco continua podendo usá-la.
-- ==========================================================

revoke select on public.sucursais from anon;
grant select (id, loja_id, nome, apelido, nome_fantasia, endereco, numero,
              complemento, cidade, uf, cep, telefone, cor, ativa, matriz,
              ref_local)
  on public.sucursais to anon;

revoke select on public.formas_pagamento from anon;
grant select (id, loja_id, nome, tipo, bandeira, ativa, online, ordem, sucursais)
  on public.formas_pagamento to anon;

revoke execute on function public.senha_operador_conferir(text, text) from public, anon, authenticated;
revoke execute on function public.senha_operador_definir(text, text) from public, anon, authenticated;

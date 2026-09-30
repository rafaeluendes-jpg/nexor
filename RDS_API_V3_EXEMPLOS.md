# Joia — API analítica RDS v3 · exemplos

Base: `https://cevghkndzpzvnzwifhnm.supabase.co/functions/v1/joia-rds`
Cabeçalho: `Authorization: Bearer <chave RDS Inteligência e Gestão>`
(ou `x-api-key: <chave>`). Só `GET`.

Unidades da rede hoje: `suc_mt1unhbx2xrb` (Santa Fé do Sul),
`suc_2157f764d972` (Jales), `suc_mt1npcg7b3m3` (Alphaville),
`suc_matriz` (Matriz). A lista viva está em `GET /lojas`.

## Requisições

```bash
B=https://cevghkndzpzvnzwifhnm.supabase.co/functions/v1/joia-rds
H="Authorization: Bearer $CHAVE_RDS"

# catálogo e unidades
curl -H "$H" "$B/"
curl -H "$H" "$B/lojas"

# Copo P em Santa Fé, últimos 10 dias
curl -H "$H" "$B/produtos?loja=suc_mt1unhbx2xrb&de=2026-09-21&ate=2026-09-30&produto=Copo%20P"

# Copo P em todas as unidades
curl -H "$H" "$B/analises/comparativo-unidades?rede=1&de=2026-09-21&ate=2026-09-30&produto=Copo%20P"

# curva ABC por unidade, por margem
curl -H "$H" "$B/analises/curva-abc?rede=1&agrupar=unidade&criterio=margem&de=2026-09-01&ate=2026-09-30"

# faturamento por dia e por mês
curl -H "$H" "$B/faturamento?rede=1&de=2026-09-01&ate=2026-09-30"
curl -H "$H" "$B/faturamento?rede=1&agrupar=mes&de=2026-08-01&ate=2026-09-30"

# vendas, itens e pagamentos (paginados)
curl -H "$H" "$B/analitico/vendas?loja=suc_mt1unhbx2xrb&de=2026-09-30&ate=2026-09-30&limite=500&pagina=1"
curl -H "$H" "$B/analitico/itens-venda?loja=suc_mt1unhbx2xrb&de=2026-09-30&ate=2026-09-30&grupo=Copo"
curl -H "$H" "$B/analitico/pagamentos?loja=suc_mt1unhbx2xrb&de=2026-09-30&ate=2026-09-30&forma_pagamento=Pix"

# estoque, razão, inventário, CPV e perdas
curl -H "$H" "$B/estoque?loja=suc_mt1unhbx2xrb&ordenar_por=valor_estoque&ordem=desc"
curl -H "$H" "$B/analitico/movimentos-estoque?loja=suc_mt1unhbx2xrb&de=2026-09-30&ate=2026-09-30"
curl -H "$H" "$B/analitico/inventarios?loja=suc_mt1unhbx2xrb&de=2026-08-01&ate=2026-09-30"
curl -H "$H" "$B/analises/cpv-perdas?rede=1&de=2026-09-01&ate=2026-09-30&detalhe=motivo"

# financeiro
curl -H "$H" "$B/analitico/titulos?rede=1&data=vencimento&de=2026-10-01&ate=2026-10-07&situacao=em%20aberto"
curl -H "$H" "$B/analises/dre?loja=suc_mt1unhbx2xrb&de=2026-09-01&ate=2026-09-30"
curl -H "$H" "$B/analises/fluxo-caixa?rede=1&de=2026-09-01&ate=2026-10-31&visao=mensal"

# qualidade e sincronização
curl -H "$H" "$B/pendencias?rede=1"
curl -H "$H" "$B/pendencias/estoque-negativo?loja=suc_mt1unhbx2xrb"
curl -H "$H" "$B/sincronizacao/unidades?rede=1"

# incremental: só o que mudou desde um instante
curl -H "$H" "$B/analitico/vendas?loja=suc_mt1unhbx2xrb&de=2026-09-01&ate=2026-09-30&alterados_desde=2026-09-30T21:00:00Z"
```

## Resposta (forma)

```json
{
  "api_versao": "3.0.0",
  "regra_versao": "2026-10-01",
  "extraido_em": "2026-09-30T23:24:42Z",
  "fuso": "America/Sao_Paulo",
  "moeda": "BRL",
  "precisao": { "valores": 2, "quantidades": 4, "custos": 6 },
  "rota": "/produtos",
  "periodo": { "de": "2026-09-21", "ate": "2026-09-30", "dias": 10 },
  "escopo": "unidade",
  "filtros": { "loja": "suc_mt1unhbx2xrb", "produto": "Copo P", "de": "2026-09-21", "ate": "2026-09-30" },
  "unidades_incluidas": [ { "sucursal_id": "suc_mt1unhbx2xrb", "sucursal_nome": "Santa Fé do Sul", "tipo_unidade": "loja" } ],
  "unidades_excluidas": [ { "sucursal_id": "suc_2157f764d972", "sucursal_nome": "Jales", "tipo_unidade": "loja" } ],
  "sincronizacao": [ { "sucursal_id": "suc_mt1unhbx2xrb", "situacao": "com pendência local", "offline": false,
                       "pendencia_local": true, "ultimo_registro_recebido_em": "…", "aparelhos": [ "…" ] } ],
  "dado_completo": false,
  "avisos": [ "Unidade Santa Fé do Sul tem aparelho com dado ainda não enviado (pendência local)." ],
  "paginacao": { "pagina": 1, "limite": 200, "total_registros": 1, "total_paginas": 1, "nesta_pagina": 1 },
  "filtros_aplicados": { "produto": "Copo P" },
  "filtros_que_nao_se_aplicam": [],
  "dados": [
    { "rede_id": "6001c62e-…", "rede_nome": "Jolô Gelato", "empresa_nome": "Jolô Gelato",
      "loja_id": "f0de0748-…", "loja_nome": "Jolo Santa Fe do Sul",
      "sucursal_id": "suc_mt1unhbx2xrb", "sucursal_nome": "Santa Fé do Sul", "tipo_unidade": "loja",
      "cnpj": "50058498000111", "cidade": "Santa Fé do Sul", "uf": "SP", "situacao_unidade": "ativa",
      "data_abertura": "não_disponível", "fuso": "America/Sao_Paulo",
      "produto_ref": "prod_msudv7ylgk00", "produto": "Copo P", "grupo": "Copo",
      "quantidade": 166, "media_diaria": 16.6, "faturamento": 3008, "participacao_faturamento_pct": 13.01,
      "pedidos_com_o_produto": 111, "preco_medio": 18.12, "cpv_teorico": 640.04,
      "margem_contribuicao": 2367.96, "margem_pct": 78.72, "desconto_medio": "não_disponível" }
  ]
}
```

## Erro (forma)

```json
{ "api_versao": "3.0.0", "extraido_em": "…",
  "erro": "Diga de qual unidade é a consulta (loja=suc_... ou unidades=suc_a,suc_b) ou peça a rede expressamente (rede=1). Sem isso a API não mistura unidades.",
  "unidades_validas": [ { "sucursal_id": "suc_mt1unhbx2xrb", "sucursal_nome": "Santa Fé do Sul", "tipo_unidade": "loja" } ] }
```

---
name: vigia
description: Vigia do Joia — confere o sistema em produção, lê a caixinha de erros (tabela erros_sistema), acha a causa de cada erro e corrige. Use na rotina de hora em hora ou quando pedirem "rodar o vigia", "ver a caixinha de erros" ou "conferir o sistema".
---

# Vigia do Joia

Roteiro aprovado pelo Rafael em 01/10/2026 (`VIGIA_PLANO.md`). Antes de
tudo, leia `CLAUDE.md` e `JOIA_PROTOCOLO_PERMANENTE_DE_ENGENHARIA.md`. As
regras deles valem aqui inteiras.

O sistema roda em produção em seis lojas. O vigia conserta, mas nunca
arrisca.

Supabase: projeto `cevghkndzpzvnzwifhnm`. Use as ferramentas MCP do
Supabase.

## 1. Ler

Rode cada consulta e guarde o resultado.

**a) Caixinha: o que está aberto.**

```sql
select id, sucursal_ref, tipo, onde, mensagem, vezes, versao, pedido_ref,
       detalhe, primeiro_em at time zone 'America/Sao_Paulo' primeiro,
       ultimo_em at time zone 'America/Sao_Paulo' ultimo, status
  from erros_sistema
 where status in ('aberto','corrigindo')
 order by (tipo='fiscal') desc, vezes desc, ultimo_em desc
 limit 100;
```

**b) Cupons que não terminaram autorizados nas últimas 36 h.**

```sql
select pedido_numero, numero, serie, status, motivo, sucursal_id,
       criado_em at time zone 'America/Sao_Paulo' criado
  from cupons_fiscais
 where criado_em > now() - interval '36 hours'
   and status not in ('autorizado','cancelado')
 order by criado_em desc;
```

**c) Recusas fiscais no servidor, última hora.**

```sql
select em at time zone 'America/Sao_Paulo', acao, resultado, detalhe
  from fiscal_eventos
 where em > now() - interval '70 minutes'
   and resultado not in ('ok','enqueued','authorized','pedido')
 order by em desc;
```

**d) Função fiscal: respostas 4xx/5xx e tempo, última hora.** Use
`query_logs`, com `source='function_edge_logs'` e `function_id` da
`joia-fiscal`.

**e) Vendas sem cupom em loja que emite sempre**, últimas 2 h. Junte
`pedidos` com `cupons_fiscais` por `pedido_ref`/`ref_local`. Considere só
as unidades com `fiscal_unidades.modo='sempre'` e `ambiente='producao'`.

**f) Bateria.** Rode `npm test` no repositório. Vermelho na `main` é erro
de primeira prioridade.

## 2. Decidir

Para cada erro, ache a **causa**, não o sintoma. Leia o código em `src/`
(rode `node ferramentas/mapear.js` e use o `MAPA.md`), os registros e os
dados.

Muitas vezes não há nada a corrigir:

- Internet da loja que caiu (`Failed to fetch`, "sem conexão").
- Cupom recente que a fila do aparelho ainda vai reconferir.
- Algo que já se resolveu sozinho.

Nesses casos, marque como resolvido e escreva por quê:

```sql
update erros_sistema
   set status='resolvido', resolvido_em=now(), resolvido_por='vigia',
       resolucao='<uma frase em português de gente>'
 where id='<id>';
```

## 3. Corrigir

**Defeito no código.**

1. Marque o erro como `corrigindo`.
2. Corrija em `src/`, nunca no `index.html`, e rode `npm run montar`.
3. Escreva um guardião em `testes/`, registre-o no `package.json` e rode
   `node ferramentas/travar.js --gravar`.
4. Suba `VERSAO` e `VERSAO_SW` juntas. Sem versão nova, a loja continua
   com o erro no cache.
5. Escreva a entrada no `DECISOES.md`.
6. Rode `node ferramentas/portao.js`. Só com **todas** as etapas verdes:
   1. commit;
   2. `git fetch origin main && git merge-base --is-ancestor origin/main HEAD`;
   3. `git push origin HEAD:main`.

   Defeito do que já está publicado sobe direto: o Rafael autorizou.
7. Marque o erro como `resolvido`, com a frase do que foi feito.

**Dado ou operação.** Só o que a regra do Rafael permite:

- Cupom preso, ou cupom que não imprimiu: quem reenvia e reimprime é o
  próprio aparelho da loja (`fiscalReprocessar`). Confira se ele está
  conseguindo. Se não está, a causa é código e cai no caso acima.
- Lançamento ou registro que não subiu: confira na nuvem. Se o aparelho
  ainda tem a fila, ele reenvia sozinho.

## 4. O que o vigia NUNCA faz

Esses casos vão para `status='precisa_voce'`, com o passo a passo na
`resolucao`:

- mudar configuração da loja: taxas, contas, preços, liberação, cadastro
  fiscal;
- apagar venda, caixa, lançamento ou cupom;
- migration, ou SQL de escrita fora da tabela `erros_sistema`;
- regra de negócio nova ou recurso novo;
- publicar com qualquer etapa do portão vermelha;
- enfraquecer ou desligar guardião.

## 5. Avisar

Mande mensagem ao Rafael só quando houver algo para ele. Português, até 3
linhas, sem termo técnico:

- Corrigiu algo importante: "Pronto: 3 cupons de Santa Fé voltaram a
  imprimir."
- Precisa dele: "Isso depende de você: …"
- Nada aconteceu: nenhuma mensagem.

Todo o detalhe técnico vai na coluna `resolucao` e no `DECISOES.md`, nunca
na mensagem.

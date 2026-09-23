import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/* =====================================================================
   JOIA — API DE LEITURA (resumos, análise e auditoria)

   Porta oficial para outro sistema PERGUNTAR ao Joia. Só LÊ: não existe
   caminho de escrita aqui, e qualquer método diferente de GET é recusado.

   v1   — consolidados (faturamento, produtos, estoque, financeiro...)
   v2   — camada analítica para auditoria: os registros que formaram cada
          total, paginados, com ordem determinada.
   v2.1 — Etapa 2 da RDS (23/09/2026): extração dos cadastros, saúde da
          sincronização por unidade e por aparelho, e a lista do que foi
          alterado desde um instante (carimbo `alterado_em`, gerido só
          pelo banco).

   Autenticação: `Authorization: Bearer <chave>` (ou `x-api-key`).
   A chave nunca é guardada em texto — o banco tem só o sha-256 dela.
   Cada chave vale para UMA rede e, se quiser, para UMA unidade; quando a
   chave tem unidade, o parâmetro `loja` NÃO a tira de lá.

   Fonte guardada no repositório em supabase/functions/joia-api/index.ts.
   Publicar: deploy da função `joia-api` com verify_jwt = false (a porta é
   conferida pela chave própria, não pelo login do Supabase).
   ===================================================================== */

const API_VERSAO = "2.1";
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}
const erro = (msg: string, status: number, extra?: Record<string, unknown>) =>
  json({ erro: msg, api_versao: API_VERSAO, gerado_em: new Date().toISOString(), ...(extra || {}) }, status);

async function sha256(txt: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function rest(caminho: string, init?: RequestInit) {
  const r = await fetch(`${URL_SB}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: SERVICO,
      Authorization: `Bearer ${SERVICO}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return await r.json();
}
const chamar = (nome: string, args: Record<string, unknown>) =>
  rest(`rpc/${nome}`, { method: "POST", body: JSON.stringify(args) });

/* ---- datas: por padrão, os últimos 30 dias, no fuso da loja ---- */
function diaLoja(recuo = 0) {
  return new Date(Date.now() - 3 * 3600 * 1000 - recuo * 86400000)
    .toISOString().slice(0, 10);
}
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const soma = (l: any[], c: string) =>
  +l.reduce((a, x) => a + Number(x[c] || 0), 0).toFixed(2);

const CADASTROS: Record<string, string> = {
  "unidades": "código, CNPJ, cidade, fuso, matriz/franquia, situação, caixas, aparelhos e último sinal",
  "usuarios": "usuário, cargo, unidades autorizadas e o que pode fazer (vender, baixar, ajustar, contar, fechar...)",
  "itens": "insumos, embalagens, fichas, subfichas, produtos acabados e produtos vendidos, com unidade, fator, custo e vínculo",
  "unidades-medida": "unidades de medida cadastradas e o fator para a base",
  "motivos": "motivos de movimentação de estoque, com quantas vezes cada um foi usado",
  "formas-pagamento": "formas de pagamento com taxa, prazo e conta de destino",
  "contas": "contas financeiras (caixa, bancos, contas digitais) com saldo inicial",
  "fornecedores": "fornecedores com CNPJ e possíveis duplicados",
};

const AJUDA = {
  api: "Joia — API de leitura e auditoria",
  api_versao: API_VERSAO,
  como_usar: "Todas as chamadas são GET, com o cabeçalho Authorization: Bearer SUA_CHAVE",
  observacao: "Esta API só lê. Nada aqui altera o sistema.",
  parametros_comuns: {
    de: "data inicial (AAAA-MM-DD) — padrão: 30 dias atrás",
    ate: "data final (AAAA-MM-DD) — padrão: hoje",
    loja: "referência da unidade (ex.: suc_mt1unhbx2xrb). Sem isso, a rede toda",
    pagina: "página, começando em 1 (só nos caminhos analíticos)",
    por_pagina: "registros por página (padrão 200, máximo 1000)",
  },
  consolidados: {
    "GET /lojas": "as unidades da rede",
    "GET /faturamento": "venda por dia",
    "GET /produtos": "o que mais vendeu",
    "GET /pagamentos": "venda por forma de pagamento",
    "GET /estoque": "saldo atual, custo médio, valor e quem está abaixo do mínimo",
    "GET /financeiro": "a pagar e a receber por categoria",
    "GET /producao": "ordens de produção",
    "GET /contagens": "contagens de estoque",
    "GET /resumo": "tudo junto, para uma leitura rápida",
  },
  analiticos: {
    "GET /pedidos": "venda a venda, com cancelamento, motivo e operador",
    "GET /itens": "item a item das vendas, com adicionais",
    "GET /pagamentos-analitico": "pagamento a pagamento, com taxa e data prevista",
    "GET /movimentacoes": "o razão do estoque, linha a linha, classificado",
    "GET /inventarios": "contagem item a item: sistema × contado × diferença",
    "GET /producao-analitico": "produção item a item: previsto × realizado",
    "GET /titulos": "título a título (parâmetro data=emissao|vencimento|pagamento)",
    "GET /extrato": "o que entrou e saiu de caixa e banco",
    "GET /plano-de-contas": "as categorias e subcategorias como estão hoje",
    "GET /fichas": "ficha técnica com ingredientes (parâmetro ficha=fi_...)",
    "GET /reconciliacao/estoque": "saldo inicial + entradas − saídas = saldo final",
  },
  etapa2: {
    "GET /cadastros": "a lista dos cadastros que dá para extrair",
    "GET /cadastros/{tipo}": "um cadastro inteiro: " + Object.keys(CADASTROS).join(", "),
    "GET /saude-sincronizacao": "por unidade: vendas sem pagamento, sem caixa, sem baixa de estoque, último registro recebido, caixas abertos; e por aparelho: último sinal, último envio e download, erro e pendência",
    "GET /alteracoes": "o que foi criado ou alterado desde um instante (parâmetro desde=AAAA-MM-DDTHH:MM:SSZ, padrão: últimas 24 h)",
    "GET /historico": "quem mudou o quê, com o antes e o depois dos campos alterados (parâmetros de, ate e tabela=)",
  },
  limites: {
    metodo: "somente GET",
    por_pagina_maximo: 1000,
    ordenacao: "determinística em todos os caminhos analíticos",
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") {
    return erro("Esta API só responde GET: ela lê, não escreve.", 405);
  }

  const u = new URL(req.url);
  const partes = u.pathname.split("/").filter(Boolean);
  const i = partes.indexOf("joia-api");
  const rota = (i >= 0 ? partes.slice(i + 1) : partes).join("/") || "";

  /* ---- a chave ---- */
  const cab = req.headers.get("authorization") || "";
  const bruta = (cab.toLowerCase().startsWith("bearer ")
    ? cab.slice(7)
    : req.headers.get("x-api-key") || "").trim();
  if (!bruta) {
    return erro("Falta a chave. Use o cabeçalho Authorization: Bearer SUA_CHAVE.", 401);
  }

  let chave: any = null;
  try {
    const achadas = await rest(
      `api_chaves?chave_hash=eq.${await sha256(bruta)}&ativa=is.true&select=*`
    );
    chave = achadas?.[0] || null;
  } catch (e) {
    return erro("Não consegui conferir a chave.", 500, { detalhe: String(e) });
  }
  if (!chave) return erro("Chave inválida ou desativada.", 401);

  rest(`api_chaves?id=eq.${chave.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ultimo_uso: new Date().toISOString(), usos: (chave.usos || 0) + 1 }),
  }).catch(() => {});

  /* a unidade: a chave manda; se ela vale para a rede, o parâmetro escolhe */
  const pedida = (u.searchParams.get("loja") || "").trim();
  const suc = chave.sucursal_id || (pedida || null);
  const loja = chave.loja_id;
  const onde = suc || "rede toda";

  const de = (u.searchParams.get("de") || "").slice(0, 10) || diaLoja(30);
  const ate = (u.searchParams.get("ate") || "").slice(0, 10) || diaLoja(0);
  if (!ISO.test(de) || !ISO.test(ate)) {
    return erro("Datas devem estar no formato AAAA-MM-DD.", 400);
  }
  if (de > ate) return erro("A data inicial é depois da final.", 400);

  const base = { p_loja: loja, p_suc: suc, p_de: de, p_ate: ate };

  /* paginação dos caminhos analíticos */
  const pagina = Math.max(1, parseInt(u.searchParams.get("pagina") || "1") || 1);
  const porPagina = Math.min(1000, Math.max(1,
    parseInt(u.searchParams.get("por_pagina") || "200") || 200));
  const offset = (pagina - 1) * porPagina;

  const envelope = (extra: Record<string, unknown>) => ({
    api_versao: API_VERSAO,
    gerado_em: new Date().toISOString(),
    periodo: { de, ate },
    loja: onde,
    ...extra,
  });

  /* roda a função analítica e monta a página. `total_registros` viaja na
     própria linha e é retirado antes de entregar: é dado de paginação,
     não do negócio. */
  async function analitico(nome: string, args: Record<string, unknown>, campo: string,
                           avisos?: string[], extraEnvelope?: Record<string, unknown>) {
    const linhas = await chamar(nome, { ...args, p_limite: porPagina, p_offset: offset });
    const total = Number(linhas?.[0]?.total_registros || 0);
    const dados = (linhas || []).map((x: any) => {
      const { total_registros, ...resto } = x;
      return resto;
    });
    return json(envelope({
      ...(extraEnvelope || {}),
      pagina: {
        pagina, por_pagina: porPagina, nesta_pagina: dados.length,
        total_registros: total,
        total_paginas: total ? Math.ceil(total / porPagina) : (dados.length ? 1 : 0),
      },
      ...(avisos && avisos.length ? { avisos } : {}),
      [campo]: dados,
    }));
  }

  try {
    /* ---------------- cadastros (v2.1) ---------------- */
    if (rota === "cadastros") {
      return json(envelope({ cadastros: CADASTROS }));
    }
    if (rota.startsWith("cadastros/")) {
      const tipo = rota.slice("cadastros/".length);
      if (!CADASTROS[tipo]) {
        return erro(`Cadastro "${tipo}" não existe.`, 404, { cadastros: Object.keys(CADASTROS) });
      }
      const dados = await chamar("api_cadastro", { p_loja: loja, p_suc: suc, p_tipo: tipo });
      const avisos: string[] = [];
      if (tipo === "usuarios") {
        avisos.push("O Joia controla permissão por TELA, não por ação. O campo `pode` é derivado das telas liberadas. Senhas não saem por esta API.");
      }
      if (tipo === "itens") {
        avisos.push("Unidade de compra e unidade de consumo não são campos próprios: o que existe é a unidade de estoque e o fator. O insumo não tem situação ativa/inativa.");
      }
      if (tipo === "unidades-medida") {
        avisos.push("As conversões kg/g, L/mL e un estão no código do sistema, não em cadastro — por isso a lista pode vir vazia.");
      }
      if (tipo === "motivos") {
        avisos.push("A classe do motivo (baixa identificada, ajuste, consumo...) ainda não existe no cadastro: aguarda a classificação do Rafael e do Raylan.");
      }
      if (tipo === "contas") {
        avisos.push("O cadastro de conta não guarda a data do saldo inicial nem a situação ativa/inativa.");
      }
      return json(envelope({
        cadastro: tipo,
        registros: Array.isArray(dados) ? dados.length : 0,
        ...(avisos.length ? { avisos } : {}),
        dados: dados || [],
      }));
    }

    switch (rota) {
      /* ---------------- ajuda ---------------- */
      case "":
        return json(AJUDA);

      /* ---------------- consolidados (v1, sem mudança) ---------------- */
      case "lojas": {
        const ls = await rest(
          `sucursais?loja_id=eq.${loja}&select=ref_local,nome,cidade,uf,matriz,ativa&order=nome`
        );
        return json({
          lojas: chave.sucursal_id
            ? ls.filter((x: any) => x.ref_local === chave.sucursal_id)
            : ls,
        });
      }
      case "faturamento": {
        const d = await chamar("api_faturamento", base);
        const tot = soma(d, "total");
        const ped = d.reduce((a: number, x: any) => a + Number(x.pedidos || 0), 0);
        return json({
          periodo: { de, ate }, loja: onde,
          total: tot, pedidos: ped,
          ticket_medio: ped ? +(tot / ped).toFixed(2) : 0,
          dias: d,
        });
      }
      case "produtos":
        return json({
          periodo: { de, ate }, loja: onde,
          produtos: await chamar("api_produtos", {
            ...base, p_limite: Number(u.searchParams.get("limite") || 50),
          }),
        });
      case "pagamentos":
        return json({
          periodo: { de, ate }, loja: onde,
          formas: await chamar("api_pagamentos", base),
        });
      case "estoque": {
        const tudo = await chamar("api_estoque", { p_loja: loja, p_suc: suc });
        const faltando = tudo.filter((x: any) => x.abaixo_do_minimo);
        const soAbaixo = u.searchParams.get("abaixo") === "1";
        return json({
          loja: onde,
          itens: tudo.length,
          valor_total_em_estoque: soma(tudo, "valor"),
          abaixo_do_minimo: faltando.length,
          filtro: soAbaixo ? "somente os abaixo do mínimo" : "todos os itens",
          estoque: soAbaixo ? faltando : tudo,
        });
      }
      case "financeiro": {
        const f = await chamar("api_financeiro", base);
        const pega = (t: string, s: string) =>
          soma(f.filter((x: any) => x.tipo === t && x.situacao === s), "total");
        return json({
          periodo: { de, ate }, loja: onde,
          a_pagar: { em_aberto: pega("despesa", "em aberto"), pago: pega("despesa", "pago") },
          a_receber: { em_aberto: pega("receita", "em aberto"), recebido: pega("receita", "pago") },
          lancamentos: f,
        });
      }
      case "producao":
        return json({
          periodo: { de, ate }, loja: onde,
          ordens: await chamar("api_producao", base),
        });
      case "contagens":
        return json({
          periodo: { de, ate }, loja: onde,
          contagens: await chamar("api_contagens", base),
        });
      case "resumo": {
        const [fat, prod, pag, est, fin, op, ct] = await Promise.all([
          chamar("api_faturamento", base),
          chamar("api_produtos", { ...base, p_limite: 20 }),
          chamar("api_pagamentos", base),
          chamar("api_estoque", { p_loja: loja, p_suc: suc }),
          chamar("api_financeiro", base),
          chamar("api_producao", base),
          chamar("api_contagens", base),
        ]);
        const tot = soma(fat, "total");
        const ped = fat.reduce((a: number, x: any) => a + Number(x.pedidos || 0), 0);
        const pega = (t: string, s: string) =>
          soma(fin.filter((x: any) => x.tipo === t && x.situacao === s), "total");
        return json({
          periodo: { de, ate }, loja: onde,
          venda: {
            total: tot, pedidos: ped,
            ticket_medio: ped ? +(tot / ped).toFixed(2) : 0,
            por_dia: fat, por_forma_de_pagamento: pag, mais_vendidos: prod,
          },
          estoque: {
            itens: est.length,
            valor_total: soma(est, "valor"),
            abaixo_do_minimo: est.filter((x: any) => x.abaixo_do_minimo),
          },
          financeiro: {
            a_pagar_em_aberto: pega("despesa", "em aberto"),
            a_receber_em_aberto: pega("receita", "em aberto"),
            por_categoria: fin,
          },
          producao: op,
          contagens: ct,
        });
      }

      /* ---------------- analíticos (v2) ---------------- */
      case "pedidos":
        return await analitico("api_pedidos", base, "pedidos");

      case "itens":
        return await analitico("api_itens", base, "itens", [
          "Desconto por item, cortesia e cancelamento de item ainda não são " +
          "gravados pelo Joia — ver DIAGNOSTICO_API_AUDITORIA_RDS.md.",
        ]);

      case "pagamentos-analitico":
        return await analitico("api_pagamentos_analitico", base, "pagamentos", [
          "A taxa e a data prevista saem do CADASTRO da forma de pagamento. " +
          "O Joia não recebe retorno de adquirente: não há data efetiva de " +
          "recebimento nem estorno por transação.",
        ]);

      case "movimentacoes":
        return await analitico("api_movimentacoes", base, "movimentacoes", [
          "A classe é derivada da origem do movimento; a origem crua também " +
          "vai na resposta para conferência. Saldo anterior/posterior por " +
          "movimento ainda não é gravado.",
        ]);

      case "inventarios":
        return await analitico("api_inventarios", base, "inventarios");

      case "producao-analitico":
        return await analitico("api_producao_itens", base, "producao", [
          "Insumos previstos × efetivamente baixados item a item ainda não é " +
          "gravado pela ordem de produção.",
        ]);

      case "titulos": {
        const campo = (u.searchParams.get("data") || "vencimento").toLowerCase();
        if (["emissao", "vencimento", "pagamento"].indexOf(campo) < 0) {
          return erro("data deve ser emissao, vencimento ou pagamento.", 400);
        }
        return await analitico("api_titulos", { ...base, p_campo_data: campo }, "titulos", [
          "O Joia ainda não tem campo de COMPETÊNCIA próprio nem centro de " +
          "resultado; a emissão é a data mais próxima da competência.",
        ]);
      }

      case "extrato":
        return await analitico("api_extrato", base, "extrato", [
          "Transferência entre contas vem com classe própria: não é receita " +
          "nem despesa. Saldo anterior/posterior por conta não é gravado.",
        ]);

      case "plano-de-contas":
        return json(envelope({
          avisos: ["Dois níveis (categoria › subcategoria). Código, natureza, " +
                   "posição na DRE e vigência ainda não existem no cadastro."],
          plano_de_contas: await chamar("api_plano_contas", { p_loja: loja }),
        }));

      case "fichas":
        return json(envelope({
          avisos: ["A ficha técnica NÃO tem vigência: o que sai aqui é a receita " +
                   "de HOJE. Para CPV histórico é preciso congelar o cálculo na " +
                   "venda — ver DIAGNOSTICO_API_AUDITORIA_RDS.md, decisão 2."],
          fichas: await chamar("api_fichas", {
            p_loja: loja, p_ficha: (u.searchParams.get("ficha") || "").trim() || null,
          }),
        }));

      case "reconciliacao/estoque":
        return json(envelope({
          regra: "saldo_inicial + entradas − saidas = saldo_final",
          avisos: ["A equação fecha por construção: o razão é a fonte do saldo. " +
                   "A divergência entre sistema e contagem física está em /inventarios."],
          itens: await chamar("api_reconciliacao_estoque", base),
        }));

      /* ---------------- Etapa 2 (v2.1) ---------------- */
      case "saude-sincronizacao": {
        const s = await chamar("api_saude_sincronizacao", base);
        return json(envelope({
          avisos: [
            "Vendas sem baixa de estoque incluem as de produto sem ficha ou insumo vinculado, que de fato não baixam nada.",
            "O sinal por aparelho começa a chegar quando as lojas atualizarem para a versão do Joia que o envia; antes disso a lista de aparelhos vem vazia.",
          ],
          ...(s || { unidades: [], aparelhos: [] }),
        }));
      }

      case "alteracoes": {
        const bruto = (u.searchParams.get("desde") || "").trim();
        let desde: string;
        if (!bruto) {
          desde = new Date(Date.now() - 86400000).toISOString();
        } else {
          const t = Date.parse(bruto);
          if (isNaN(t)) {
            return erro("desde deve ser uma data e hora ISO-8601 (ex.: 2026-09-23T00:00:00Z).", 400);
          }
          desde = new Date(t).toISOString();
        }
        return await analitico("api_alteracoes",
          { p_loja: loja, p_suc: suc, p_desde: desde }, "alteracoes", [
            "O carimbo de alteração (alterado_em) passou a existir em 23/09/2026. Registro anterior que nunca mais foi mexido não aparece aqui.",
            "Regravação sem mudança real não conta como alteração.",
          ], { desde });
      }

      case "historico": {
        const tabela = (u.searchParams.get("tabela") || "").trim() || null;
        if (tabela && !/^[a-z_]+$/.test(tabela)) {
          return erro("tabela deve ser o nome de uma tabela (ex.: fichas_tecnicas).", 400);
        }
        return await analitico("api_historico", { ...base, p_tabela: tabela }, "historico", [
          "Vem do registro de auditoria do banco: só as tabelas de negócio, e só os campos que mudaram. Senhas e chaves nunca entram nesse registro.",
          "`usuario` é a conta que estava logada no aparelho. As lojas usam uma conta por unidade, então ele identifica a UNIDADE, não a pessoa.",
          "Ficha técnica, insumo e produto passaram a ser registrados em 23/09/2026.",
        ], tabela ? { tabela } : undefined);
      }

      default:
        return erro(`Caminho "${rota}" não existe.`, 404, AJUDA);
    }
  } catch (e) {
    return erro("Não consegui buscar os dados.", 500, { detalhe: String(e) });
  }
});

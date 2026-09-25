/* ==========================================================
   JOIA — A PORTA DA CENTRAL JOLÔ (25/09/2026)

   "Joga esse aplicativo de faturamento como um ícone lá dentro da
   central... o mesmo login, a mesma senha de cada loja... tem os
   gráficos, tem que colocar igual ao aplicativo." (Rafael)

   A Central é outro sistema, com outro banco. Esta função é a única
   porta entre os dois, e ela faz UMA coisa: devolver o painel de
   faturamento de uma unidade, já calculado (`api_central_painel`).

   Por que não entrou na `joia-api`: aquela é a API de auditoria da RDS,
   com dezenas de caminhos e uma integração rodando em cima. Uma porta
   separada para um uso separado quebra menos e se revoga sozinha.

   O que ela NÃO faz, de propósito:
     - não escreve nada (só GET);
     - não devolve dado pessoal — nem nome de cliente, nem telefone,
       nem comanda. Só números e a CONTAGEM de clientes atendidos;
     - não aceita pedir outra empresa: a chave manda na empresa.

   A chave vive na mesma tabela das outras (`api_chaves`), com o mesmo
   limite por minuto e a mesma revogação: desligar a Central é desativar
   a linha dela lá, e nada mais.
   ========================================================== */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
const erro = (msg: string, status: number, extra?: Record<string, unknown>) =>
  json({ erro: msg, ...(extra || {}) }, status);

async function sha256(txt: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
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
  const t = await r.text();
  if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
  return t ? JSON.parse(t) : null;
}
const chamar = (nome: string, args: Record<string, unknown>) =>
  rest(`rpc/${nome}`, { method: "POST", body: JSON.stringify(args) });

const ISO = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return erro("Esta porta só lê: use GET.", 405);

  const cab = req.headers.get("authorization") || "";
  const bruta = (cab.toLowerCase().startsWith("bearer ")
    ? cab.slice(7)
    : req.headers.get("x-api-key") || "").trim();
  if (!bruta) return erro("Falta a chave.", 401);

  let chave: { id: string; loja_id: string; sucursal_id: string | null } | null = null;
  try {
    const achadas = await rest(
      `api_chaves?chave_hash=eq.${await sha256(bruta)}&ativa=is.true&select=id,loja_id,sucursal_id`,
    );
    chave = achadas?.[0] || null;
  } catch (_e) {
    return erro("Não consegui conferir a chave.", 500);
  }
  if (!chave) return erro("Chave inválida ou desativada.", 401);

  /* o mesmo limite por minuto das outras chaves */
  try {
    const uso = await chamar("api_chave_uso", { p_id: chave.id });
    if (uso && uso.permitido === false) {
      return erro("Muitas chamadas seguidas. Tente de novo em instantes.", 429, {
        libera_em: uso.libera_em,
      });
    }
  } catch (_e) { /* a contagem nunca derruba a leitura */ }

  const u = new URL(req.url);
  /* a chave manda na unidade; se ela vale para a rede, o parâmetro escolhe */
  const suc = chave.sucursal_id || (u.searchParams.get("loja") || "").trim() || null;

  const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const de = (u.searchParams.get("de") || "").slice(0, 10) || hoje;
  const ate = (u.searchParams.get("ate") || "").slice(0, 10) || hoje;
  const deAnt = (u.searchParams.get("de_ant") || "").slice(0, 10);
  const ateAnt = (u.searchParams.get("ate_ant") || "").slice(0, 10);
  for (const d of [de, ate, deAnt, ateAnt]) {
    if (d && !ISO.test(d)) return erro("Datas devem estar no formato AAAA-MM-DD.", 400);
  }
  if (de > ate) return erro("A data inicial é depois da final.", 400);

  try {
    const painel = await chamar("api_central_painel", {
      p_loja: chave.loja_id,
      p_suc: suc,
      p_de: de,
      p_ate: ate,
      p_de_ant: deAnt || null,
      p_ate_ant: ateAnt || deAnt || null,
    });
    return json({ gerado_em: new Date().toISOString(), loja: suc || "rede toda", painel });
  } catch (e) {
    return erro("Não consegui montar o painel agora.", 502, { detalhe: String(e).slice(0, 300) });
  }
});

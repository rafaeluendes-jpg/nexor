import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/* =====================================================================
   JOIA — API ANALÍTICA RDS v3 (somente leitura)

   Pedido da RDS de 30/09/2026: a fonte analítica da RDS, multiunidade,
   sem depender de tela nem da equipe de desenvolvimento. O Joia continua
   sendo o sistema transacional e a autoridade dos dados.

   Esta função é FINA de propósito. Ela só:
     1. recusa qualquer método que não seja GET (405);
     2. confere a chave (sha-256 em api_chaves) e conta o uso/limite;
     3. repassa a rota e os parâmetros para `rds_consulta`, POR GET — e o
        PostgREST roda GET numa transação READ ONLY: mesmo que alguém
        mudasse uma função para tentar gravar, o banco recusaria;
     4. mascara dado pessoal quando a chave pede.
   Toda a regra de apuração mora em `rds_consulta` (migrations
   20261001_rds_api_v3_parte1..4). Assim a resposta que a RDS recebe é
   exatamente a que se prova rodando a função no banco.

   Publicar: deploy da função `joia-rds` com verify_jwt = false (a porta
   é conferida pela chave própria, não pelo login do Supabase).
   ===================================================================== */

const API_VERSAO = "3.0.0";
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(corpo: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(corpo, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}
const erro = (msg: string, status: number, extra?: Record<string, unknown>) =>
  json({ erro: msg, api_versao: API_VERSAO, extraido_em: new Date().toISOString(), ...(extra || {}) }, status);

async function sha256(txt: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function rest(caminho: string, init?: RequestInit) {
  const r = await fetch(`${URL_SB}/rest/v1/${caminho}`, {
    ...init,
    headers: { apikey: SERVICO, Authorization: `Bearer ${SERVICO}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return await r.json();
}

/* ---- dados pessoais: nome vira iniciais; contato, documento e endereço
   não saem. Operador e conta da unidade NÃO são mascarados: são o "quem
   fez" que a análise precisa. ---- */
const PESSOAIS_NOME = new Set(["cliente", "cliente_nome", "comanda", "consumidor_nome"]);
const PESSOAIS_CONTATO = new Set(["telefone", "celular", "whatsapp", "cliente_tel"]);
const PESSOAIS_DOC = new Set(["cpf", "cliente_cpf", "consumidor_doc"]);
const PESSOAIS_ENDERECO = new Set(["endereco", "cliente_endereco", "rua", "bairro"]);
const iniciais = (v: string) => v.trim().split(/\s+/).map((p) => (p ? p[0].toUpperCase() + "." : "")).join(" ");
const soFinal = (v: string, n: number) => {
  const d = v.replace(/\D/g, "");
  return d.length > n ? "•••" + d.slice(-n) : "•••";
};
export function mascarar(x: any, campo = ""): any {
  if (x === null || x === undefined) return x;
  const k = campo.toLowerCase();
  if (typeof x === "string" && x) {
    if (PESSOAIS_NOME.has(k)) return iniciais(x);
    if (PESSOAIS_CONTATO.has(k)) return soFinal(x, 4);
    if (PESSOAIS_DOC.has(k)) return soFinal(x, 2);
    if (PESSOAIS_ENDERECO.has(k)) return "(omitido)";
    return x;
  }
  if (Array.isArray(x)) return x.map((y) => mascarar(y, campo));
  if (typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [c, v] of Object.entries(x)) o[c] = mascarar(v, c);
    return o;
  }
  return x;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return erro("Esta API só responde GET: ela lê, não escreve.", 405);

  const u = new URL(req.url);
  const partes = u.pathname.split("/").filter(Boolean);
  const i = partes.indexOf("joia-rds");
  const rota = (i >= 0 ? partes.slice(i + 1) : partes).join("/");

  /* ---- a chave ---- */
  const cab = req.headers.get("authorization") || "";
  const bruta = (cab.toLowerCase().startsWith("bearer ") ? cab.slice(7) : req.headers.get("x-api-key") || "").trim();
  if (!bruta) return erro("Falta a chave. Use o cabeçalho Authorization: Bearer SUA_CHAVE.", 401);

  let chave: any = null;
  try {
    const achadas = await rest(`api_chaves?chave_hash=eq.${await sha256(bruta)}&ativa=is.true&select=*`);
    chave = achadas?.[0] || null;
  } catch (_e) {
    return erro("Não consegui conferir a chave.", 500);
  }
  if (!chave) return erro("Chave inválida ou desativada.", 401);

  /* registro de uso e limite por minuto — a única gravação do caminho, e
     só na tabela das chaves */
  try {
    const uso = await rest("rpc/api_chave_uso", { method: "POST", body: JSON.stringify({ p_id: chave.id }) });
    if (uso && uso.permitido === false) {
      return erro("Limite de chamadas por minuto atingido. Tente de novo em instantes.", 429, {
        limite_por_minuto: uso.limite, libera_em: uso.libera_em,
      });
    }
  } catch (_e) { /* o limite protege o banco; não derruba a leitura */ }

  /* ---- parâmetros: todos viram texto; a validação é da consulta ---- */
  const q: Record<string, string> = {};
  u.searchParams.forEach((v, k) => { q[k] = v; });

  let resposta: any;
  try {
    const qs = new URLSearchParams({
      p_loja: chave.loja_id,
      p_rota: rota,
      p_q: JSON.stringify(q),
    });
    if (chave.sucursal_id) qs.set("p_chave_suc", chave.sucursal_id);
    /* GET = transação somente leitura no PostgREST */
    resposta = await rest(`rpc/rds_consulta?${qs.toString()}`);
  } catch (e) {
    return erro("Não consegui buscar os dados.", 500, { detalhe: String(e).slice(0, 300) });
  }

  if (resposta && typeof resposta === "object" && resposta._status) {
    const { _status, ...resto } = resposta;
    return json({ api_versao: API_VERSAO, extraido_em: new Date().toISOString(), ...resto }, Number(_status));
  }
  const saida = chave.mascarar_pessoais === false ? resposta : mascarar(resposta);
  return json(saida, 200, { "X-Joia-Api-Versao": API_VERSAO });
});

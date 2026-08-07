/* ==========================================================
   NEXOR — criar / alterar acesso do sistema
   A chave de administrador do banco NAO pode ir para o navegador:
   com ela, qualquer cliente viraria admin de todas as redes.
   Entao a criacao de conta mora aqui, no servidor, e so aceita
   quem ja esta logado e e admin da propria rede.
   ========================================================== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL   = Deno.env.get("SUPABASE_URL")!;
const ANON  = Deno.env.get("SUPABASE_ANON_KEY")!;
const ADMIN = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ORIGENS = [
  "https://rafaeluendes-jpg.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:5500",
];
function cors(origem: string | null) {
  const ok = origem && ORIGENS.some((o) => origem.startsWith(o));
  return {
    "Access-Control-Allow-Origin": ok ? origem! : ORIGENS[0],
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
const responde = (c: number, corpo: unknown, h: HeadersInit) =>
  new Response(JSON.stringify(corpo), {
    status: c,
    headers: { ...h, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return responde(405, { erro: "Método não aceito." }, h);

  /* ---- 1. quem esta chamando? ---- */
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return responde(401, { erro: "Entre no sistema primeiro." }, h);

  const comoUsuario = createClient(URL, ANON, {
    global: { headers: { Authorization: auth } },
  });
  const { data: quem, error: eU } = await comoUsuario.auth.getUser();
  if (eU || !quem?.user) return responde(401, { erro: "Sessão inválida ou vencida." }, h);

  /* ---- 2. ele pode? o perfil e lido com a sessao dele, entao o RLS vale ---- */
  const { data: perfil } = await comoUsuario
    .from("perfis").select("cargo, loja_id, empresa_id").eq("id", quem.user.id).maybeSingle();

  if (!perfil) return responde(403, { erro: "Seu acesso não está ligado a nenhuma loja." }, h);
  if (!["admin", "plataforma"].includes(perfil.cargo))
    return responde(403, { erro: "Só o administrador da rede cria acessos." }, h);

  /* ---- 3. o pedido ---- */
  let corpo: any;
  try { corpo = await req.json(); } catch { return responde(400, { erro: "Pedido malformado." }, h); }

  const email = String(corpo.email || "").trim().toLowerCase();
  const senha = String(corpo.senha || "");
  const nome  = String(corpo.nome  || "").trim();
  const cargo = ["admin", "gerente", "operador", "caixa"].includes(corpo.cargo) ? corpo.cargo : "gerente";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return responde(400, { erro: "O login precisa ser um e-mail válido." }, h);
  if (senha.length < 6)
    return responde(400, { erro: "A senha precisa ter ao menos 6 caracteres." }, h);

  /* a loja e SEMPRE a de quem chamou — nunca a que vem no pedido.
     Senao um admin poderia criar usuario dentro da rede do vizinho. */
  const loja = perfil.loja_id, empresa = perfil.empresa_id;

  /* ---- 4. agora sim, com a chave de administrador ---- */
  const comoAdmin = createClient(URL, ADMIN, { auth: { persistSession: false } });

  const { data: lista } = await comoAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existente = lista?.users?.find((u) => u.email?.toLowerCase() === email);

  let uid: string;
  if (existente) {
    /* ja existe: so troca a senha, e apenas se ele for da mesma loja */
    const { data: p2 } = await comoAdmin
      .from("perfis").select("loja_id").eq("id", existente.id).maybeSingle();
    if (p2 && p2.loja_id !== loja)
      return responde(403, { erro: "Este e-mail já é usado em outra rede." }, h);

    const { error } = await comoAdmin.auth.admin.updateUserById(existente.id, { password: senha });
    if (error) return responde(400, { erro: error.message }, h);
    uid = existente.id;
  } else {
    const { data, error } = await comoAdmin.auth.admin.createUser({
      email, password: senha, email_confirm: true, user_metadata: { nome },
    });
    if (error || !data?.user) return responde(400, { erro: error?.message || "Não consegui criar." }, h);
    uid = data.user.id;
  }

  const { error: eP } = await comoAdmin.from("perfis").upsert({
    id: uid, nome: nome || email, cargo, loja_id: loja, empresa_id: empresa,
  });
  if (eP) return responde(400, { erro: eP.message }, h);

  return responde(200, { ok: true, id: uid, criado: !existente }, h);
});

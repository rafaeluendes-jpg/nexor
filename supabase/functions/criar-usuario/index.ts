/* ==========================================================
   JOIA — criar / editar / excluir acesso do sistema
   A chave de administrador do banco NAO pode ir para o navegador. Tudo mora aqui.

   A SENHA NUNCA E DEVOLVIDA. O Supabase guarda so o hash.

   AUDITORIA DE AUTENTICACAO — troca de senha derruba sessao aberta:
   o signOut do Auth revoga o refresh token, mas o token de acesso ja emitido
   valeria ate expirar (ate 1 hora), porque JWT nao e consultado a cada
   requisicao. Por isso, alem do signOut, gravamos no banco o momento a partir
   do qual as sessoes daquela conta valem (perfis.sessoes_desde). As funcoes de
   identidade comparam com o 'iat' do token e recusam o que for anterior.
   Resultado: trocar a senha tira a pessoa AGORA, nao daqui a pouco.

   verify_jwt fica desligado de proposito: com ele ligado a vistoria OPTIONS
   do navegador seria recusada antes de chegar aqui. A sessao e conferida
   abaixo, com getUser().

   24/09/2026 — A LOJA CRIA A EQUIPE DELA (Rafael)
   "A matriz cria o login de Santa Fé. As lojas franqueadas criam os acessos
   de operador, atendente, produção." Antes, so admin/plataforma passavam
   daqui ("Só o administrador da rede cria acessos"), e o login da loja —
   cargo gerente, amarrado a uma unidade — era recusado.

   Agora o GERENTE DE UNIDADE (cargo gerente com sucursal_ref) tambem entra,
   com travas que o servidor impoe, nao o navegador:
   - o acesso criado e sempre OPERADOR (ou caixa) da unidade DELE;
   - nunca admin, nunca gerente, nunca acesso total, nunca outra unidade;
   - editar, trocar senha e excluir so alcanca operador/caixa da unidade
     dele — nunca o proprio login, nunca a matriz, nunca outra loja;
   - e-mail que ja pertence a outro acesso nao e "adotado" (senao bastaria
     digitar o e-mail do dono para trocar a senha dele).
   ========================================================== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL   = Deno.env.get("SUPABASE_URL")!;
const ANON  = Deno.env.get("SUPABASE_ANON_KEY")!;
const ADMIN = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/* 18/08/2026 — o sistema mudou de endereco: nexorapp.com.br virou
   joiagest.com.br. Esta lista e conferida pelo NAVEGADOR antes do pedido
   sair; endereco que nao esta aqui recebe "Failed to fetch" e nem chega
   ao servidor. Toda vez que o dominio mudar, esta lista muda junto. */
const ORIGENS = [
  "https://joiagest.com.br",
  "https://www.joiagest.com.br",
  "https://rafaeluendes-jpg.github.io",
  "https://nexorapp.com.br",
  "https://www.nexorapp.com.br",
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

const EQUIPE = ["operador", "caixa"];

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return responde(405, { erro: "Método não aceito." }, h);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return responde(401, { erro: "Entre no sistema primeiro." }, h);

  const comoUsuario = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: quem, error: eU } = await comoUsuario.auth.getUser();
  if (eU || !quem?.user) return responde(401, { erro: "Sessão inválida ou vencida." }, h);

  const comoAdmin = createClient(URL, ADMIN, { auth: { persistSession: false } });

  const { data: perfil } = await comoAdmin
    .from("perfis").select("cargo, loja_id, empresa_id, sucursal_ref").eq("id", quem.user.id).maybeSingle();
  if (!perfil) return responde(403, { erro: "Seu acesso não está cadastrado." }, h);

  const ehRede = ["admin", "plataforma"].includes(perfil.cargo);
  /* o login principal da loja: gerente amarrado a UMA unidade */
  const ehGerenteUnidade = perfil.cargo === "gerente" && !!perfil.sucursal_ref;
  if (!ehRede && !ehGerenteUnidade)
    return responde(403, { erro: "Seu acesso não pode criar outros acessos. Fale com o login principal da loja." }, h);
  const minhaUnidade: string | null = ehGerenteUnidade ? String(perfil.sucursal_ref) : null;

  /* o gerente de unidade so alcanca operador/caixa da unidade dele, e nunca a si mesmo */
  async function alvoDaMinhaEquipe(uid: string) {
    if (uid === quem!.user!.id) return false;
    const { data: a } = await comoAdmin
      .from("perfis").select("loja_id, cargo, sucursal_ref").eq("id", uid).maybeSingle();
    return !!a && a.loja_id === perfil!.loja_id && EQUIPE.includes(a.cargo) &&
      a.sucursal_ref === minhaUnidade;
  }

  let corpo: any;
  try { corpo = await req.json(); } catch { return responde(400, { erro: "Pedido malformado." }, h); }

  /* ==========================================================
     EXCLUIR ACESSO — some de verdade
     Desligar em Usuarios e Permissoes so marca ativo=false: a conta continua
     no Auth e o perfil continua na lista da Administracao, aparecendo
     duplicada com a conta nova da mesma pessoa. Aqui ela sai dos tres
     lugares: Auth, perfis e usuarios_sistema.

     ORDEM IMPORTA. perfis.id tem chave estrangeira para auth.users com
     ON DELETE CASCADE: apagar a conta do Auth JA leva o perfil junto. Por
     isso a conta vai primeiro — se algo falhar no meio, nada foi destruido
     e da para tentar de novo.

     Travas: nao se exclui a si mesmo, nao se exclui o dono da plataforma,
     um administrador de rede so alcanca acessos da propria empresa, e o
     gerente de unidade so a equipe (operador/caixa) da propria unidade.
     ========================================================== */
  if (corpo.acao === "excluir") {
    const uid = String(corpo.perfil_id || "").trim();
    if (!uid) return responde(400, { erro: "Informe qual acesso excluir." }, h);
    if (uid === quem.user.id) return responde(400, { erro: "Você não pode excluir o próprio acesso." }, h);

    const { data: alvo } = await comoAdmin
      .from("perfis").select("loja_id, cargo, nome").eq("id", uid).maybeSingle();
    if (!alvo) return responde(404, { erro: "Acesso não encontrado." }, h);
    if (alvo.cargo === "plataforma")
      return responde(403, { erro: "O acesso da plataforma não pode ser excluído." }, h);
    if (perfil.cargo !== "plataforma" && alvo.loja_id !== perfil.loja_id)
      return responde(403, { erro: "Este acesso pertence a outra empresa." }, h);
    if (ehGerenteUnidade && !(await alvoDaMinhaEquipe(uid)))
      return responde(403, { erro: "A loja só exclui acessos da própria equipe (operador, caixa)." }, h);

    const { data: contaAuth } = await comoAdmin.auth.admin.getUserById(uid);
    const emailAlvo = (contaAuth?.user?.email || "").toLowerCase();

    try { await comoAdmin.auth.admin.signOut(uid, "global"); } catch (_e) { /* segue */ }
    const { error: eD } = await comoAdmin.auth.admin.deleteUser(uid);
    if (eD) return responde(400, { erro: eD.message }, h);

    await comoAdmin.from("perfis").delete().eq("id", uid);

    if (alvo.loja_id && emailAlvo) {
      await comoAdmin.from("usuarios_sistema")
        .update({ ativo: false, excluido_em: new Date().toISOString() })
        .eq("loja_id", alvo.loja_id).ilike("login", emailAlvo);
    }

    return responde(200, { ok: true, excluido: true, email: emailAlvo }, h);
  }

  const editando = !!corpo.perfil_id;
  const email = String(corpo.email || "").trim().toLowerCase();
  const senha = String(corpo.senha || "");
  const nome  = String(corpo.nome  || "").trim();
  /* o gerente de unidade so cria equipe: o cargo pedido nao sobe acima disso */
  const cargo = ehGerenteUnidade
    ? (EQUIPE.includes(corpo.cargo) ? corpo.cargo : "operador")
    : (["admin", "gerente", "operador", "caixa"].includes(corpo.cargo) ? corpo.cargo : "gerente");

  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return responde(400, { erro: "O login precisa ser um e-mail válido." }, h);
  if (!editando && !email) return responde(400, { erro: "Informe o e-mail do acesso." }, h);
  if (senha && senha.length < 6)
    return responde(400, { erro: "A senha precisa ter ao menos 6 caracteres." }, h);
  if (!editando && !senha) return responde(400, { erro: "Informe a senha inicial." }, h);

  let loja: string | null = perfil.loja_id;
  let empresa: string | null = perfil.empresa_id;
  if (perfil.cargo === "plataforma") {
    const pedida = String(corpo.loja_id || "").trim();
    if (!pedida) return responde(400, { erro: "Informe a empresa do acesso." }, h);
    const { data: lj } = await comoAdmin
      .from("lojas").select("id, empresa_id, plataforma").eq("id", pedida).maybeSingle();
    if (!lj) return responde(400, { erro: "Empresa não encontrada." }, h);
    if (lj.plataforma) return responde(400, { erro: "Esta não é uma empresa cliente." }, h);
    loja = lj.id; empresa = lj.empresa_id;
  } else if (corpo.loja_id && corpo.loja_id !== perfil.loja_id) {
    return responde(403, { erro: "Você só administra acessos da sua própria empresa." }, h);
  }
  if (!loja) return responde(400, { erro: "Não sei em qual empresa gravar este acesso." }, h);

  /* a unidade do gerente e a unica que ele alcanca — a pedida e ignorada */
  const sucRef = ehGerenteUnidade ? minhaUnidade : (String(corpo.sucursal_ref || "").trim() || null);
  let nomeUnidade: string | null = null;
  if (sucRef) {
    const { data: sc } = await comoAdmin
      .from("sucursais").select("nome").eq("loja_id", loja).eq("ref_local", sucRef).maybeSingle();
    if (sc) nomeUnidade = sc.nome;
  }

  let uid: string;
  let trocouSenha = false;

  if (editando) {
    uid = String(corpo.perfil_id);
    const { data: alvo } = await comoAdmin
      .from("perfis").select("loja_id, cargo").eq("id", uid).maybeSingle();
    if (!alvo) return responde(404, { erro: "Acesso não encontrado." }, h);
    if (alvo.loja_id !== loja)
      return responde(403, { erro: "Este acesso pertence a outra empresa." }, h);
    if (alvo.cargo === "plataforma")
      return responde(403, { erro: "O acesso da plataforma não é editado por aqui." }, h);
    if (ehGerenteUnidade && !(await alvoDaMinhaEquipe(uid)))
      return responde(403, { erro: "A loja só altera acessos da própria equipe (operador, caixa)." }, h);

    const mudanca: any = {};
    if (email) mudanca.email = email;
    if (senha) mudanca.password = senha;
    if (Object.keys(mudanca).length) {
      if (email) {
        const { data: lista } = await comoAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const outro = lista?.users?.find((u) => u.email?.toLowerCase() === email && u.id !== uid);
        if (outro) return responde(400, { erro: "Já existe um acesso com este e-mail." }, h);
      }
      mudanca.email_confirm = true;
      const { error } = await comoAdmin.auth.admin.updateUserById(uid, mudanca);
      if (error) return responde(400, { erro: error.message }, h);
      if (senha) trocouSenha = true;
    }
  } else {
    const { data: lista } = await comoAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existente = lista?.users?.find((u) => u.email?.toLowerCase() === email);
    if (existente) {
      const { data: p2 } = await comoAdmin
        .from("perfis").select("loja_id").eq("id", existente.id).maybeSingle();
      if (p2 && p2.loja_id && p2.loja_id !== loja)
        return responde(403, { erro: "Este e-mail já é usado em outra empresa." }, h);
      /* o gerente de unidade nao "adota" conta que nao e da equipe dele —
         senao trocaria a senha do dono so digitando o e-mail */
      if (ehGerenteUnidade && (!p2 || !(await alvoDaMinhaEquipe(existente.id))))
        return responde(403, { erro: "Este e-mail já é usado por outro acesso. Use outro e-mail." }, h);
      const { error } = await comoAdmin.auth.admin.updateUserById(existente.id, { password: senha });
      if (error) return responde(400, { erro: error.message }, h);
      uid = existente.id;
      trocouSenha = true;
    } else {
      const { data, error } = await comoAdmin.auth.admin.createUser({
        email, password: senha, email_confirm: true, user_metadata: { nome },
      });
      if (error || !data?.user) return responde(400, { erro: error?.message || "Não consegui criar." }, h);
      uid = data.user.id;
    }
  }

  const { error: eP } = await comoAdmin.from("perfis").upsert({
    id: uid, nome: nome || email, cargo, loja_id: loja, empresa_id: empresa,
    sucursal_ref: sucRef, nome_unidade: nomeUnidade,
  });
  if (eP) return responde(400, { erro: eP.message }, h);

  const tudo = !ehGerenteUnidade && cargo === "admin";
  const refLocal = "usr_" + email.replace(/[^a-z0-9]/g, "").slice(0, 12);
  const { data: linha } = await comoAdmin
    .from("usuarios_sistema").select("id").eq("loja_id", loja).ilike("login", email || "@").maybeSingle();
  if (!linha && email) {
    await comoAdmin.from("usuarios_sistema").insert({
      loja_id: loja, ref_local: refLocal,
      nome: nome || email, login: email, senha: "", ativo: true,
      tudo, mestre: false,
      sucursais: sucRef ? [sucRef] : [], permissoes: {},
    });
  } else if (linha && email) {
    /* reativa: se a pessoa foi desligada antes e o acesso esta sendo
       recriado com o mesmo e-mail, a linha precisa voltar a valer —
       senao o acesso some da lista por causa do filtro de excluidos */
    await comoAdmin.from("usuarios_sistema")
      .update({ nome: nome || email, tudo, sucursais: sucRef ? [sucRef] : [],
                ativo: true, excluido_em: null })
      .eq("id", linha.id);
  }

  /* ---- TROCOU A SENHA: derruba as sessoes ja abertas ----
     Dois passos, porque um so nao basta:
       1. signOut global   -> revoga o refresh token
       2. sessoes_desde    -> invalida o token de acesso ja emitido, que
                              senao valeria ate uma hora depois */
  if (trocouSenha) {
    try { await comoAdmin.auth.admin.signOut(uid, "global"); } catch (_e) { /* segue */ }
    try {
      await comoAdmin.from("perfis")
        .update({ sessoes_desde: new Date().toISOString() }).eq("id", uid);
    } catch (_e) { /* segue */ }
  }

  return responde(200, {
    ok: true, id: uid, editado: editando,
    ref_local: refLocal, cargo, unidade: sucRef,
    sessoes_encerradas: trocouSenha,
  }, h);
});

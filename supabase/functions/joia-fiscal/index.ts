/* ==========================================================
   JOIA — FISCAL (NFC-e nas lojas, NF-e na matriz) · 28/09/2026

   A unica porta entre o Joia e a Spedy, que assina e transmite para a
   SEFAZ. Tudo que e segredo mora aqui dentro ou no cofre:

   * a chave da API de cada unidade, o CSC da SEFAZ e o certificado NUNCA
     chegam ao navegador. O navegador manda o pedido com a sessao de quem
     esta logado; esta funcao confere quem e, de que loja e, e so entao
     busca a chave DAQUELA unidade no cofre.

   * cada unidade e um emitente. A chave de uma unidade e a chave da
     empresa (CNPJ) dela na Spedy — emitir com ela so pode sair com aquele
     CNPJ. O elo unidade <-> empresa so e feito quando o CNPJ bate; e uma
     empresa nunca serve a duas unidades (indice unico no banco). Foi a
     mistura entre lojas que fez a Carla de Santa Fe se apresentar como a
     de Alphaville em 26/09/2026. No fiscal a mesma mistura imprimiria o
     CNPJ errado num documento que vale para a Receita.

   * producao so com confirmacao escrita: o CNPJ digitado de volta.

   * a venda nunca depende daqui. Se esta funcao, a Spedy ou a SEFAZ
     falharem, o caixa ja gravou a venda antes; o cupom fica pendente e e
     reenviado depois, com o MESMO integrationId — a Spedy atualiza a nota
     em vez de criar outra.

   verify_jwt desligado pelo mesmo motivo do criar-usuario: a vistoria
   OPTIONS do navegador seria recusada antes de chegar aqui. A sessao e
   conferida abaixo, com getUser().
   ========================================================== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL   = Deno.env.get("SUPABASE_URL")!;
const ANON  = Deno.env.get("SUPABASE_ANON_KEY")!;
const ADMIN = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

const BASES: Record<string, string> = {
  sandbox: "https://sandbox-api.spedy.com.br/v1",
  producao: "https://api.spedy.com.br/v1",
};

const digitos = (x: unknown) => String(x ?? "").replace(/\D/g, "");
const nomeSegredo = (tipo: string, ref: string, extra = "") =>
  ("spedy_" + tipo + "_" + ref + (extra ? "_" + extra : "")).toLowerCase().replace(/[^a-z0-9_]/g, "_");

/* O que a Spedy devolve vira o que o Joia entende. Nunca repassa nada
   alem disto para o navegador. */
const STATUS: Record<string, string> = {
  created: "enviando", enqueued: "enviando", received: "enviando",
  authorized: "autorizado", inContingent: "contingencia", rejected: "rejeitado",
  canceled: "cancelado", denied: "denegado", disabled: "inutilizado", removed: "removido",
};
function nota(base: string, n: any) {
  const pd = n?.processingDetail || {};
  const st = STATUS[n?.status] || "enviando";
  return {
    spedyId: n?.id || null,
    integrationId: n?.integrationId || null,
    status: st,
    statusSpedy: n?.status || null,
    numero: n?.number || null,
    serie: n?.series || null,
    chave: n?.accessKey || null,
    protocolo: n?.authorization?.protocol || null,
    autorizadaEm: n?.authorization?.date || null,
    emitidaEm: n?.issuedOn || null,
    ambiente: n?.environmentType || null,
    motivo: st === "rejeitado" || st === "denegado" ? (pd.message || null) : null,
    codigo: pd.code || null,
    cancelamento: n?.cancellation || null,
    /* PDF e XML nao exigem chave (documentacao da Spedy): o endereco pode
       ir direto para a impressora e para o WhatsApp do cliente */
    pdf: n?.id && (st === "autorizado" || st === "contingencia" || st === "cancelado")
      ? `${base}/consumer-invoices/${n.id}/pdf` : null,
    xml: n?.id && (st === "autorizado" || st === "contingencia" || st === "cancelado")
      ? `${base}/consumer-invoices/${n.id}/xml` : null,
  };
}

/* erros da Spedy em portugues de gente, sem codigo cru */
function erroSpedy(d: any, status: number) {
  const lista = Array.isArray(d?.errors) ? d.errors : [];
  const msg = lista.map((e: any) => e?.message).filter(Boolean).join(" · ");
  if (status === 401 || status === 403) return "A chave da API foi recusada pela Spedy.";
  if (status === 429) return "Muitos pedidos em pouco tempo — tente de novo em um minuto.";
  return msg || `A Spedy recusou o pedido (${status}).`;
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return responde(405, { erro: "Método não aceito." }, h);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return responde(401, { erro: "Entre no sistema primeiro." }, h);
  const comoUsuario = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: quem, error: eU } = await comoUsuario.auth.getUser();
  if (eU || !quem?.user) return responde(401, { erro: "Sessão inválida ou vencida." }, h);

  const db = createClient(URL, ADMIN, { auth: { persistSession: false } });
  const { data: perfil } = await db.from("perfis")
    .select("cargo, loja_id, sucursal_ref, nome").eq("id", quem.user.id).maybeSingle();
  if (!perfil?.loja_id) return responde(403, { erro: "Seu acesso não está cadastrado." }, h);

  const ehRede = ["admin", "plataforma"].includes(perfil.cargo);
  const ehGerente = perfil.cargo === "gerente" && !!perfil.sucursal_ref;
  const loja = perfil.loja_id as string;

  let corpo: any;
  try { corpo = await req.json(); } catch { return responde(400, { erro: "Pedido malformado." }, h); }
  const acao = String(corpo?.acao || "");

  /* ---------- a conta da rede na Spedy ---------- */
  const { data: conta } = await db.from("fiscal_conta").select("*").eq("loja_id", loja).maybeSingle();
  const base = conta ? BASES[conta.host] : BASES.producao;

  async function segredo(nome: string | null | undefined) {
    if (!nome) return null;
    const { data } = await db.rpc("fiscal_segredo_ler", { p_nome: nome });
    return (data as string) || null;
  }
  async function guardarSegredo(nome: string, valor: string, desc: string) {
    const { error } = await db.rpc("fiscal_segredo_gravar", { p_nome: nome, p_valor: valor, p_desc: desc });
    if (error) throw new Error("não consegui guardar no cofre");
  }
  async function spedy(chave: string, metodo: string, caminho: string, dados?: unknown, bruto?: BodyInit) {
    const r = await fetch(base + caminho, {
      method: metodo,
      headers: bruto ? { "X-Api-Key": chave } :
        { "X-Api-Key": chave, "Content-Type": "application/json", "Accept": "application/json" },
      body: bruto ?? (dados === undefined ? undefined : JSON.stringify(dados)),
    });
    let d: any = null;
    try { d = await r.json(); } catch { /* corpo vazio */ }
    return { ok: r.ok, status: r.status, d };
  }
  async function registrar(sucursal: string | null, acaoR: string, resultado: string, detalhe: unknown, notaId?: string | null) {
    try {
      await db.from("fiscal_eventos").insert({
        loja_id: loja, sucursal_ref: sucursal, quem: quem!.user!.id, acao: acaoR,
        nota_id: notaId ?? null, resultado, detalhe,
      });
    } catch { /* a trilha nunca derruba a operacao */ }
  }

  /* ---------- a unidade pedida: da MESMA empresa, e alcancavel ---------- */
  const ref = String(corpo?.sucursal || "");
  let unidadeJoia: any = null;
  if (ref) {
    const { data } = await db.from("sucursais")
      .select("id, ref_local, nome, cnpj, razao_social, matriz, loja_id")
      .eq("loja_id", loja).eq("ref_local", ref).maybeSingle();
    unidadeJoia = data;
    if (!unidadeJoia) return responde(404, { erro: "Unidade não encontrada nesta rede." }, h);
    if (!ehRede && perfil.sucursal_ref !== ref)
      return responde(403, { erro: "Seu acesso é de outra unidade." }, h);
  }
  const podeGerir = ehRede || (ehGerente && perfil.sucursal_ref === ref);

  async function unidadeFiscal() {
    const { data } = await db.from("fiscal_unidades").select("*")
      .eq("loja_id", loja).eq("sucursal_ref", ref).maybeSingle();
    return data;
  }
  async function chaveDaUnidade(u: any) {
    return u?.segredo_nome ? await segredo(u.segredo_nome) : null;
  }
  /* ==========================================================
     DUAS CHAVES, DOIS PAPEIS (conferido no sandbox, 28/09/2026)
     A chave de uma empresa secundaria so EMITE: `/companies/...` com ela
     volta 403 "Acesso nao autorizado". Configurar a empresa — CSC, serie,
     ambiente, certificado, consultar cadastro — e com a chave da CONTA
     (a titular). Nota fiscal sai sempre com a chave da UNIDADE, que e o
     que prende o CNPJ.
     ========================================================== */
  async function chaveDaConta() {
    return conta ? await segredo(conta.segredo_nome) : null;
  }

  /* a configuracao de NFC-e da empresa na Spedy, sempre com o CSC do
     ambiente em uso — nunca mandar o bloco sem ele (poderia apaga-lo) */
  async function aplicarNaSpedy(u: any, _chaveUnidade: string) {
    const chave = await chaveDaConta();
    if (!chave) return { ok: false, status: 409, d: { errors: [{ message: "A chave da conta não está no cofre." }] } };
    const amb = u.ambiente === "producao" ? "producao" : "homologacao";
    const cscId = amb === "producao" ? u.csc_id_producao : u.csc_id_homologacao;
    const csc = await segredo(nomeSegredo("csc", ref, amb));
    const bloco: Record<string, unknown> = {
      series: String(u.serie || 1),
      environmentType: amb === "producao" ? "production" : "development",
      allowOfflineContingency: !!u.contingencia_offline && !!cscId && !!csc,
    };
    if (cscId && csc) { bloco.tokenId = cscId; bloco.csc = csc; }
    return await spedy(chave, "PUT", `/companies/${u.spedy_company_id}/settings`, { consumerInvoice: bloco });
  }

  try {
    /* ======================================================
       ESTADO — o que a tela precisa saber, sem segredo nenhum
       ====================================================== */
    if (acao === "estado") {
      if (!ref) return responde(400, { erro: "Informe a unidade." }, h);
      const u = await unidadeFiscal();
      const saida: any = {
        ok: true,
        conta: conta ? { host: conta.host, titularNome: conta.titular_nome,
          titularCnpj: conta.titular_cnpj } : null,
        base: conta ? base : null,
        unidade: {
          ref, nome: unidadeJoia.nome, matriz: !!unidadeJoia.matriz,
          cnpjJoia: unidadeJoia.cnpj || null,
          vinculada: !!(u?.spedy_company_id && u?.segredo_nome),
          empresaId: u?.spedy_company_id || null, cnpj: u?.cnpj || null,
          razao: u?.razao_social || null,
          modo: u?.modo || "desligado", ambiente: u?.ambiente || "homologacao",
          serie: u?.serie || 1, pedeCpf: u?.pede_cpf || "perguntar",
          pedeCpfAcima: u?.pede_cpf_acima ?? null, imprime: u?.imprime || "perguntar",
          mandaWhatsapp: !!u?.manda_whatsapp, contingencia: u ? !!u.contingencia_offline : true,
          regime: u?.regime || null, pisCst: u?.pis_cst || "07", cofinsCst: u?.cofins_cst || "07",
          cscHomologacao: !!u?.csc_id_homologacao, cscProducao: !!u?.csc_id_producao,
          producaoConfirmadaEm: u?.producao_confirmada_em || null,
        },
        spedy: null,
        podeGerir,
      };
      if (ehRede) {
        const { data: todas } = await db.from("fiscal_unidades")
          .select("sucursal_ref, modo, ambiente, spedy_company_id, cnpj").eq("loja_id", loja);
        saida.rede = todas || [];
      }
      const chave = (await chaveDaUnidade(u)) ? await chaveDaConta() : null;
      if (chave && u?.spedy_company_id) {
        const [emp, cfg, cert] = await Promise.all([
          spedy(chave, "GET", `/companies/${u.spedy_company_id}`),
          spedy(chave, "GET", `/companies/${u.spedy_company_id}/settings`),
          spedy(chave, "GET", `/companies/${u.spedy_company_id}/certificates`),
        ]);
        const ci = cfg.d?.consumerInvoice || {};
        const certs = Array.isArray(cert.d) ? cert.d : (cert.d?.items || []);
        const ativo = certs.find((c: any) => c?.isActive) || null;
        saida.spedy = {
          alcancavel: emp.ok,
          nome: emp.d?.legalName || emp.d?.name || null,
          cnpj: emp.d?.federalTaxNumber || null,
          ie: emp.d?.stateTaxNumber || null,
          regime: emp.d?.taxRegime || null,
          nfceSerie: ci.series ?? null,
          nfceProximo: ci.nextNumber ?? null,
          nfceAmbiente: ci.environmentType ?? null,
          nfceToken: !!ci.tokenId,
          contingencia: !!ci.allowOfflineContingency,
          certificado: ativo ? { validade: ativo.expirationAt || null } : null,
          erro: emp.ok ? null : erroSpedy(emp.d, emp.status),
        };
      }
      return responde(200, saida, h);
    }

    /* ======================================================
       EMPRESAS DA CONTA — para a rede ligar cada unidade
       ====================================================== */
    if (acao === "empresas") {
      if (!ehRede) return responde(403, { erro: "Só a matriz vê as empresas da conta." }, h);
      if (!conta) return responde(409, { erro: "A conta da Spedy ainda não foi ligada." }, h);
      const chave = await segredo(conta.segredo_nome);
      if (!chave) return responde(409, { erro: "A chave da conta não está no cofre." }, h);
      const r = await spedy(chave, "GET", "/companies?page=1&pageSize=50");
      if (!r.ok) return responde(502, { erro: erroSpedy(r.d, r.status) }, h);
      const { data: ligadas } = await db.from("fiscal_unidades")
        .select("sucursal_ref, spedy_company_id").eq("loja_id", loja);
      const lista = (r.d?.items || []).map((e: any) => ({
        id: e.id, nome: e.legalName || e.name, cnpj: e.federalTaxNumber,
        cidade: e.address?.city?.name || null, uf: e.address?.city?.state || null,
        titular: e.id === conta.titular_company_id,
        ligadaA: (ligadas || []).find((x: any) => x.spedy_company_id === e.id)?.sucursal_ref || null,
      }));
      return responde(200, { ok: true, empresas: lista }, h);
    }

    /* ======================================================
       LIGAR a unidade a uma empresa da conta
       So a rede. O CNPJ tem de bater com o da unidade; quando a unidade
       ainda nao tem CNPJ no Joia, quem liga digita o CNPJ de volta — e a
       confirmacao escrita, a mesma de producao.
       ====================================================== */
    if (acao === "vincular") {
      if (!ref) return responde(400, { erro: "Informe a unidade." }, h);
      if (!ehRede) return responde(403, { erro: "Só a matriz liga uma unidade à Spedy." }, h);
      if (!conta) return responde(409, { erro: "A conta da Spedy ainda não foi ligada." }, h);
      const empresaId = String(corpo.empresaId || "");
      const donoChave = await segredo(conta.segredo_nome);
      if (!donoChave) return responde(409, { erro: "A chave da conta não está no cofre." }, h);
      const r = await spedy(donoChave, "GET", `/companies/${empresaId}`);
      if (!r.ok) return responde(404, { erro: "Essa empresa não está na conta da Spedy." }, h);
      const cnpjEmp = digitos(r.d?.federalTaxNumber);
      const cnpjUni = digitos(unidadeJoia.cnpj);
      if (cnpjUni && cnpjUni !== cnpjEmp)
        return responde(409, { erro: `Esta empresa é do CNPJ ${cnpjEmp}, e a unidade ${unidadeJoia.nome} é do CNPJ ${cnpjUni}. Uma unidade só emite com o próprio CNPJ.` }, h);
      if (!cnpjUni && digitos(corpo.confirmaCnpj) !== cnpjEmp)
        return responde(409, { erro: "Digite o CNPJ da empresa para confirmar que ela é desta unidade." }, h);

      /* a chave: a da propria conta, se for a empresa titular; senao a que
         a Spedy entregou quando a empresa foi criada por aqui */
      let segredoNome: string | null = null;
      if (empresaId === conta.titular_company_id) segredoNome = conta.segredo_nome;
      else {
        const nomeS = nomeSegredo("key", ref);
        if (!(await segredo(nomeS)))
          return responde(409, { erro: "Esta empresa foi criada fora do Joia: cole a chave da API dela em Credenciais." }, h);
        segredoNome = nomeS;
      }
      const { error: eV } = await db.from("fiscal_unidades").upsert({
        loja_id: loja, sucursal_ref: ref, sucursal_id: unidadeJoia.id,
        spedy_company_id: empresaId, segredo_nome: segredoNome, cnpj: cnpjEmp,
        razao_social: r.d?.legalName || r.d?.name || null,
        regime: r.d?.taxRegime || null,
        atualizado_por: perfil.nome || quem.user.email, atualizado_em: new Date().toISOString(),
      }, { onConflict: "loja_id,sucursal_ref" });
      if (eV) {
        const dup = /fiscal_unidades_uma_empresa|duplicate/i.test(eV.message);
        return responde(409, { erro: dup ? "Essa empresa já está ligada a outra unidade." : eV.message }, h);
      }
      await registrar(ref, "vincular", "ok", { empresaId, cnpj: cnpjEmp });
      return responde(200, { ok: true, cnpj: cnpjEmp }, h);
    }

    /* ======================================================
       CHAVE de uma empresa criada fora do Joia — colada na tela
       ====================================================== */
    if (acao === "chave") {
      if (!ref || !ehRede) return responde(403, { erro: "Só a matriz cadastra a chave de uma unidade." }, h);
      const chave = String(corpo.chave || "").trim();
      if (chave.length < 20) return responde(400, { erro: "Essa chave parece incompleta." }, h);
      /* a chave de uma secundaria nao le cadastro: prova-se que ela vale
         listando notas, e a empresa e achada pela chave da conta, pelo CNPJ
         da unidade. Se a chave for de outro CNPJ, a primeira emissao pega
         (ver "emitir") e desliga a unidade. */
      const r = await spedy(chave, "GET", "/consumer-invoices?page=1&pageSize=1");
      if (!r.ok) return responde(400, { erro: erroSpedy(r.d, r.status) + " Confira se a chave é do mesmo ambiente (teste ou produção) da conta." }, h);
      const dono = await chaveDaConta();
      const lista = dono ? await spedy(dono, "GET", "/companies?page=1&pageSize=50") : { ok: false, d: null };
      const cnpjUni = digitos(unidadeJoia.cnpj);
      const emp = (lista.d?.items || []).find((e: any) => digitos(e.federalTaxNumber) === cnpjUni);
      if (!cnpjUni || !emp)
        return responde(409, { erro: "Esta chave não é do CNPJ desta unidade. Confira o CNPJ em Sucursais da Franquia." }, h);
      const nomeS = nomeSegredo("key", ref);
      await guardarSegredo(nomeS, chave, `Chave Spedy da unidade ${unidadeJoia.nome}`);
      const { error: eV } = await db.from("fiscal_unidades").upsert({
        loja_id: loja, sucursal_ref: ref, sucursal_id: unidadeJoia.id,
        spedy_company_id: emp.id, segredo_nome: nomeS, cnpj: cnpjUni,
        razao_social: emp.legalName || emp.name || null, regime: emp.taxRegime || null,
        atualizado_por: perfil.nome || quem.user.email, atualizado_em: new Date().toISOString(),
      }, { onConflict: "loja_id,sucursal_ref" });
      if (eV) return responde(409, { erro: /duplicate|uma_empresa/i.test(eV.message) ? "Essa empresa já está ligada a outra unidade." : eV.message }, h);
      await registrar(ref, "chave", "ok", { empresaId: emp.id });
      return responde(200, { ok: true }, h);
    }

    /* ======================================================
       CRIAR a empresa da unidade na conta (chave da titular)
       ====================================================== */
    if (acao === "criar_empresa") {
      if (!ref || !ehRede) return responde(403, { erro: "Só a matriz cria empresas na Spedy." }, h);
      if (!conta) return responde(409, { erro: "A conta da Spedy ainda não foi ligada." }, h);
      const donoChave = await segredo(conta.segredo_nome);
      const e = corpo.empresa || {};
      const cnpj = digitos(e.cnpj || unidadeJoia.cnpj);
      if (cnpj.length !== 14) return responde(400, { erro: "Informe o CNPJ da unidade (14 dígitos)." }, h);
      if (digitos(unidadeJoia.cnpj) && digitos(unidadeJoia.cnpj) !== cnpj)
        return responde(409, { erro: "O CNPJ informado não é o cadastrado para esta unidade." }, h);
      const pedido = {
        name: e.fantasia || unidadeJoia.nome, legalName: e.razao,
        federalTaxNumber: cnpj, stateTaxNumber: digitos(e.ie) || null,
        email: e.email || null, phone: digitos(e.telefone) || null,
        taxRegime: e.regime || "simplesNacional",
        address: {
          street: e.rua, number: e.numero, district: e.bairro,
          postalCode: digitos(e.cep), additionalInformation: e.complemento || null,
          city: e.ibge ? { code: digitos(e.ibge) } : { name: e.cidade, state: e.uf },
        },
      };
      const r = await spedy(donoChave!, "POST", "/companies", pedido);
      if (!r.ok) return responde(400, { erro: erroSpedy(r.d, r.status) }, h);
      const chaveNova = r.d?.apiCredentials?.apiKey;
      if (!chaveNova) return responde(502, { erro: "A Spedy criou a empresa mas não devolveu a chave." }, h);
      const nomeS = nomeSegredo("key", ref);
      await guardarSegredo(nomeS, chaveNova, `Chave Spedy da unidade ${unidadeJoia.nome}`);
      await db.from("fiscal_unidades").upsert({
        loja_id: loja, sucursal_ref: ref, sucursal_id: unidadeJoia.id,
        spedy_company_id: r.d.id, segredo_nome: nomeS, cnpj,
        razao_social: r.d.legalName || e.razao || null, regime: r.d.taxRegime || pedido.taxRegime,
        atualizado_por: perfil.nome || quem.user.email, atualizado_em: new Date().toISOString(),
      }, { onConflict: "loja_id,sucursal_ref" });
      await registrar(ref, "criar_empresa", "ok", { empresaId: r.d.id, cnpj });
      return responde(200, { ok: true, empresaId: r.d.id }, h);
    }

    /* ======================================================
       SALVAR como a unidade emite
       ====================================================== */
    if (acao === "salvar") {
      if (!ref || !podeGerir) return responde(403, { erro: "Só a matriz ou o responsável pela unidade mudam o fiscal." }, h);
      const c = corpo.config || {};
      const u = (await unidadeFiscal()) || {};
      const mudar: Record<string, unknown> = {};
      if (["sempre", "opcional", "desligado"].includes(c.modo)) mudar.modo = c.modo;
      if (["nunca", "perguntar", "acima"].includes(c.pedeCpf)) mudar.pede_cpf = c.pedeCpf;
      if (c.pedeCpfAcima !== undefined) mudar.pede_cpf_acima = c.pedeCpfAcima === null ? null : Number(c.pedeCpfAcima) || null;
      if (["sempre", "perguntar", "nunca"].includes(c.imprime)) mudar.imprime = c.imprime;
      if (c.mandaWhatsapp !== undefined) mudar.manda_whatsapp = !!c.mandaWhatsapp;
      if (c.contingencia !== undefined) mudar.contingencia_offline = !!c.contingencia;
      if (c.serie !== undefined) {
        const s = parseInt(String(c.serie), 10);
        if (!(s >= 1 && s <= 999)) return responde(400, { erro: "A série vai de 1 a 999." }, h);
        mudar.serie = s;
      }
      if (/^\d{2}$/.test(String(c.pisCst || ""))) mudar.pis_cst = String(c.pisCst);
      if (/^\d{2}$/.test(String(c.cofinsCst || ""))) mudar.cofins_cst = String(c.cofinsCst);
      if (["simplesNacional", "simplesNacionalExcessoSublimite", "simplesNacionalMEI", "regimeNormal"].includes(c.regime))
        mudar.regime = c.regime;
      if (c.ambiente === "homologacao") mudar.ambiente = "homologacao";
      if (c.ambiente === "producao" && (u as any).ambiente !== "producao") {
        if (conta?.host !== "producao")
          return responde(409, { erro: "A chave cadastrada é de TESTE. Para emitir de verdade, a conta de produção da Spedy precisa estar ligada." }, h);
        const cnpj = digitos((u as any).cnpj);
        if (!cnpj || digitos(c.confirmaCnpj) !== cnpj)
          return responde(409, { erro: "Para ligar a produção, digite o CNPJ da unidade — é a confirmação de que as notas passam a valer para a Receita." }, h);
        if (!(u as any).csc_id_producao)
          return responde(409, { erro: "Falta o CSC de produção (portal da SEFAZ) para esta unidade." }, h);
        mudar.ambiente = "producao";
        mudar.producao_confirmada_por = perfil.nome || quem.user.email;
        mudar.producao_confirmada_em = new Date().toISOString();
      }
      mudar.atualizado_por = perfil.nome || quem.user.email;
      mudar.atualizado_em = new Date().toISOString();
      const { error: eS } = await db.from("fiscal_unidades").upsert({
        loja_id: loja, sucursal_ref: ref, sucursal_id: unidadeJoia.id, ...mudar,
      }, { onConflict: "loja_id,sucursal_ref" });
      if (eS) return responde(400, { erro: eS.message }, h);
      const u2 = await unidadeFiscal();
      let aviso: string | null = null;
      const chave = await chaveDaUnidade(u2);
      if (chave && u2?.spedy_company_id && ("serie" in mudar || "ambiente" in mudar || "contingencia_offline" in mudar)) {
        const r = await aplicarNaSpedy(u2, chave);
        if (!r.ok) aviso = "Salvo no Joia, mas a Spedy não aceitou a mudança: " + erroSpedy(r.d, r.status);
      }
      await registrar(ref, "salvar", aviso ? "parcial" : "ok",
        Object.fromEntries(Object.entries(mudar).filter(([k]) => !/confirma/.test(k))));
      return responde(200, { ok: true, aviso }, h);
    }

    /* ======================================================
       CSC da SEFAZ — para o cofre e para a Spedy; nunca volta
       ====================================================== */
    if (acao === "csc") {
      if (!ref || !podeGerir) return responde(403, { erro: "Só a matriz ou o responsável pela unidade cadastram o CSC." }, h);
      const amb = corpo.ambiente === "producao" ? "producao" : "homologacao";
      const id = digitos(corpo.cscId);
      const csc = String(corpo.csc || "").trim();
      if (!id) return responde(400, { erro: "Informe o ID do CSC (o número ao lado do código, no portal da SEFAZ)." }, h);
      if (csc.length < 16) return responde(400, { erro: "O código CSC parece incompleto." }, h);
      await guardarSegredo(nomeSegredo("csc", ref, amb), csc, `CSC ${amb} da unidade ${unidadeJoia.nome}`);
      await db.from("fiscal_unidades").upsert({
        loja_id: loja, sucursal_ref: ref, sucursal_id: unidadeJoia.id,
        [amb === "producao" ? "csc_id_producao" : "csc_id_homologacao"]: id,
        atualizado_por: perfil.nome || quem.user.email, atualizado_em: new Date().toISOString(),
      }, { onConflict: "loja_id,sucursal_ref" });
      const u = await unidadeFiscal();
      const chave = await chaveDaUnidade(u);
      let aviso: string | null = null;
      if (chave && u?.spedy_company_id && (u.ambiente || "homologacao") === amb) {
        const r = await aplicarNaSpedy(u, chave);
        if (!r.ok) aviso = "Guardado, mas a Spedy não aceitou: " + erroSpedy(r.d, r.status);
      }
      await registrar(ref, "csc", aviso ? "parcial" : "ok", { ambiente: amb });
      return responde(200, { ok: true, aviso }, h);
    }

    /* ======================================================
       CERTIFICADO A1 — do navegador direto para a Spedy
       ====================================================== */
    if (acao === "certificado") {
      if (!ref || !podeGerir) return responde(403, { erro: "Só a matriz ou o responsável pela unidade enviam o certificado." }, h);
      const u = await unidadeFiscal();
      const chave = (await chaveDaUnidade(u)) ? await chaveDaConta() : null;
      if (!chave || !u?.spedy_company_id) return responde(409, { erro: "Ligue a unidade à Spedy antes de enviar o certificado." }, h);
      const bin = Uint8Array.from(atob(String(corpo.arquivo || "")), (ch) => ch.charCodeAt(0));
      if (bin.length < 500 || bin.length > 200000) return responde(400, { erro: "Arquivo de certificado inválido (.pfx)." }, h);
      const fd = new FormData();
      fd.append("certificateFile", new Blob([bin], { type: "application/x-pkcs12" }), "certificado.pfx");
      fd.append("password", String(corpo.senha || ""));
      const r = await spedy(chave, "POST", `/companies/${u.spedy_company_id}/certificates`, undefined, fd);
      await registrar(ref, "certificado", r.ok ? "ok" : "recusado", { status: r.status });
      if (!r.ok) return responde(400, { erro: erroSpedy(r.d, r.status) }, h);
      return responde(200, { ok: true }, h);
    }

    /* ======================================================
       EMITIR o cupom de uma venda
       Qualquer pessoa da unidade (o caixa emite). O que decide o CNPJ e
       a chave da unidade — nunca o corpo do pedido.
       ====================================================== */
    if (acao === "emitir") {
      if (!ref) return responde(400, { erro: "Informe a unidade." }, h);
      const u = await unidadeFiscal();
      if (!u?.spedy_company_id) return responde(409, { erro: "Esta loja ainda não está ligada à Spedy.", status: "pendente" }, h);
      if (u.modo === "desligado") return responde(409, { erro: "A emissão está desligada nesta loja.", status: "pendente" }, h);
      const chave = await chaveDaUnidade(u);
      if (!chave) return responde(409, { erro: "A chave desta loja não está no cofre.", status: "pendente" }, h);
      const n = corpo.nota || {};
      const integ = String(n.integrationId || "");
      if (!/^[A-Za-z0-9_.:\-]{4,36}$/.test(integ))
        return responde(400, { erro: "Venda sem identificação válida." }, h);
      /* o que nunca muda numa NFC-e — o navegador nao decide */
      n.isFinalCustomer = true;
      n.operationType = "outgoing";
      n.destination = "internal";
      if (!["presence", "internet", "delivery"].includes(n.presenceType)) n.presenceType = "presence";
      if (!Array.isArray(n.items) || !n.items.length) return responde(400, { erro: "Cupom sem itens." }, h);
      const r = await spedy(chave, "POST", "/consumer-invoices", n);
      if (!r.ok) {
        await registrar(ref, "emitir", "recusado", { status: r.status, integ }, integ);
        return responde(r.status === 429 ? 429 : 400,
          { erro: erroSpedy(r.d, r.status), status: r.status === 429 ? "pendente" : "rejeitado" }, h);
      }
      /* a ultima tranca: a Spedy diz com que CNPJ a nota saiu. Se nao for o
         da unidade, a chave e de outra empresa — a unidade e desligada na
         hora, para nenhuma outra venda sair com o CNPJ errado */
      const cnpjNota = digitos(r.d?.company?.federalTaxNumber);
      if (cnpjNota && u.cnpj && cnpjNota !== digitos(u.cnpj)) {
        await db.from("fiscal_unidades").update({ modo: "desligado", atualizado_por: "trava de CNPJ",
          atualizado_em: new Date().toISOString() }).eq("loja_id", loja).eq("sucursal_ref", ref);
        await registrar(ref, "emitir", "cnpj_errado", { integ, cnpjNota, cnpjUnidade: u.cnpj }, r.d?.id);
        return responde(409, { erro: "A chave desta loja é de outro CNPJ. A emissão foi desligada — fale com a matriz.", status: "pendente" }, h);
      }
      await registrar(ref, "emitir", r.d?.status || "ok", { integ }, r.d?.id);
      return responde(200, { ok: true, nota: nota(base, r.d) }, h);
    }

    /* ======================================================
       CONSULTAR — acompanhar pelo GET, nunca pelo check-status
       ====================================================== */
    if (acao === "consultar") {
      if (!ref) return responde(400, { erro: "Informe a unidade." }, h);
      const u = await unidadeFiscal();
      const chave = await chaveDaUnidade(u);
      if (!chave) return responde(409, { erro: "Esta loja não está ligada à Spedy." }, h);
      const id = String(corpo.id || "");
      let r;
      if (id) r = await spedy(chave, "GET", `/consumer-invoices/${encodeURIComponent(id)}`);
      else {
        /* pedido que caiu no meio (timeout): acha a nota pela venda */
        const integ = String(corpo.integrationId || "");
        const l = await spedy(chave, "GET", `/consumer-invoices?integrationId=${encodeURIComponent(integ)}&page=1&pageSize=1`);
        const achou = l.d?.items?.[0];
        if (!achou) return responde(200, { ok: true, nota: null }, h);
        r = await spedy(chave, "GET", `/consumer-invoices/${achou.id}`);
      }
      if (!r.ok) return responde(r.status === 404 ? 404 : 502, { erro: erroSpedy(r.d, r.status) }, h);
      return responde(200, { ok: true, nota: nota(base, r.d) }, h);
    }

    /* ======================================================
       CANCELAR — so gerente da unidade ou a rede, com motivo
       ====================================================== */
    if (acao === "cancelar") {
      if (!ref || !podeGerir) return responde(403, { erro: "Cancelar cupom é com o gerente ou a matriz." }, h);
      const motivo = String(corpo.motivo || "").trim();
      if (motivo.length < 15) return responde(400, { erro: "Escreva o motivo com pelo menos 15 letras." }, h);
      const u = await unidadeFiscal();
      const chave = await chaveDaUnidade(u);
      if (!chave) return responde(409, { erro: "Esta loja não está ligada à Spedy." }, h);
      const id = String(corpo.id || "");
      const r = await spedy(chave, "DELETE", `/consumer-invoices/${encodeURIComponent(id)}`, { reason: motivo });
      await registrar(ref, "cancelar", r.ok ? "pedido" : "recusado", { status: r.status }, id);
      if (!r.ok) return responde(400, { erro: erroSpedy(r.d, r.status) }, h);
      const g = await spedy(chave, "GET", `/consumer-invoices/${encodeURIComponent(id)}`);
      return responde(200, { ok: true, nota: g.ok ? nota(base, g.d) : null }, h);
    }

    /* ======================================================
       REEMITIR — depois de corrigir a configuracao (ex.: o CSC)
       ====================================================== */
    if (acao === "reemitir") {
      if (!ref || !podeGerir) return responde(403, { erro: "Reenviar é com o gerente ou a matriz." }, h);
      const u = await unidadeFiscal();
      const chave = await chaveDaUnidade(u);
      if (!chave) return responde(409, { erro: "Esta loja não está ligada à Spedy." }, h);
      const id = String(corpo.id || "");
      const r = await spedy(chave, "POST", `/consumer-invoices/${encodeURIComponent(id)}/issue`, {});
      await registrar(ref, "reemitir", r.ok ? "ok" : "recusado", { status: r.status }, id);
      if (!r.ok) return responde(400, { erro: erroSpedy(r.d, r.status) }, h);
      const g = await spedy(chave, "GET", `/consumer-invoices/${encodeURIComponent(id)}`);
      return responde(200, { ok: true, nota: g.ok ? nota(base, g.d) : null }, h);
    }

    return responde(400, { erro: "Ação desconhecida." }, h);
  } catch (e) {
    return responde(500, { erro: "O fiscal não respondeu agora: " + ((e as Error)?.message || "falha") }, h);
  }
});

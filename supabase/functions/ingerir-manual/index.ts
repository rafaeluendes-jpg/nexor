// Ingestao de manual da marca.
//
// O navegador abre o PDF com pdf.js e manda, por pagina, a camada de texto
// quando ela existe. Pagina sem texto e enviada como imagem: e ai que entra
// o OCR, feito pela capacidade multimodal do proprio modelo.
//
// Regras do OCR, que valem tanto quanto o resultado:
//   - transcrever, nunca completar o que nao esta escrito;
//   - quando um trecho estiver ilegivel, marcar [ilegivel] e baixar a confianca;
//   - a pagina de origem acompanha cada trecho e cada regra extraida.
//
// Toda regra nasce SUGERIDA. Nenhuma entra em analise sem curadoria humana.
//
// Cada ingestao cria uma VERSAO nova do manual. A regra pertence a versao que
// a gerou (marca + codigo + versao), e por isso uma versao nova pode reescrever
// uma regra antiga sem apagar a anterior: a analise velha continua apontando
// para a versao que a produziu.

import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const CHAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CHAVE_SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODELO = "claude-sonnet-5";
const VERSAO_PROMPT = "jolo-ingestao-v1";
const MIN_TEXTO_CAMADA = 120;   // menos que isso, a pagina e tratada como imagem
const CONFIANCA_BAIXA = 0.7;

const CABECALHOS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Content-Type": "application/json; charset=utf-8",
};

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: CABECALHOS });

function extrairJson(bruto: string) {
  const limpo = bruto.replace(/```json|```/g, "").trim();
  const i = limpo.indexOf("{"), f = limpo.lastIndexOf("}");
  if (i === -1 || f <= i) return null;
  try { return JSON.parse(limpo.slice(i, f + 1)); } catch { return null; }
}

async function chamarIA(chave: string, conteudo: unknown[], sistema: string, teto = 3000) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": chave,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELO, max_tokens: teto, system: sistema,
      messages: [{ role: "user", content: conteudo }],
    }),
  });
  if (!r.ok) throw new Error(`IA respondeu ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const d = await r.json();
  const texto = (d.content ?? []).filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text).join("\n");
  return { texto, uso: d.usage ?? {}, truncou: d.stop_reason === "max_tokens" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CABECALHOS });
  if (req.method !== "POST") return responder({ erro: "metodo_invalido" }, 405);

  const autorizacao = req.headers.get("Authorization") ?? "";
  if (!autorizacao) return responder({ erro: "sem_credencial" }, 401);

  let corpo: {
    titulo?: string; tipo?: string; storage_path?: string;
    paginas?: { pagina: number; texto?: string | null; imagem_path?: string | null }[];
  };
  try { corpo = await req.json(); } catch { return responder({ erro: "corpo_invalido" }, 400); }

  const paginas = (corpo.paginas ?? []).sort((a, b) => a.pagina - b.pagina);
  if (!corpo.titulo || !corpo.storage_path || !paginas.length) {
    return responder({ erro: "faltam titulo, arquivo ou paginas" }, 400);
  }

  // Somente administrador ingere manual. Quem responde e a RLS.
  const comoUsuario = createClient(URL_SB, CHAVE_ANON, {
    db: { schema: "mkt" },
    global: { headers: { Authorization: autorizacao } },
  });
  const { data: { user } } = await comoUsuario.auth.getUser();
  if (!user) return responder({ erro: "sem_credencial" }, 401);

  const { data: perfil } = await comoUsuario.from("perfis")
    .select("id, org_id, funcao").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.funcao !== "admin_geral") {
    return responder({ erro: "somente_administrador" }, 403);
  }

  const servidor = createClient(URL_SB, CHAVE_SERVICO, { db: { schema: "mkt" } });
  const inicio = Date.now();

  // Guardados fora do try: se a ingestao falhar no meio, a versao pela metade
  // e desfeita e a versao anterior volta a vigorar.
  let versaoCriada: string | null = null;
  let versaoAnteriorAtiva: string | null = null;

  try {
    const { data: marca } = await servidor.from("marcas")
      .select("id").eq("org_id", perfil.org_id).limit(1).single();

    const { data: chave } = await servidor.rpc("chave_ia");
    if (!chave) throw new Error("chave da IA indisponivel");

    // ---------------------------------------------------------- manual
    const tipo = ["identidade_visual", "estrategia", "operacional", "outro"]
      .includes(corpo.tipo ?? "") ? corpo.tipo! : "outro";

    let { data: manual } = await servidor.from("manuais").select("id")
      .eq("marca_id", marca.id).eq("titulo", corpo.titulo).maybeSingle();

    if (!manual) {
      const { data: novo, error } = await servidor.from("manuais").insert({
        org_id: perfil.org_id, marca_id: marca.id, tipo, titulo: corpo.titulo,
      }).select("id").single();
      if (error) throw new Error("nao foi possivel criar o manual");
      manual = novo;
    }

    // Nova versao. A anterior deixa de ser a vigente, mas continua no banco:
    // analise antiga segue apontando para a versao que a gerou.
    const { data: jaAtiva } = await servidor.from("manual_versoes")
      .select("id").eq("manual_id", manual.id).eq("ativa", true).maybeSingle();
    versaoAnteriorAtiva = jaAtiva?.id ?? null;

    const { data: anteriores } = await servidor.from("manual_versoes")
      .select("versao").eq("manual_id", manual.id)
      .order("versao", { ascending: false }).limit(1);
    const numeroVersao = (anteriores?.[0]?.versao ?? 0) + 1;

    await servidor.from("manual_versoes")
      .update({ ativa: false }).eq("manual_id", manual.id);

    const { data: versao, error: erroVersao } = await servidor.from("manual_versoes").insert({
      org_id: perfil.org_id, manual_id: manual.id, versao: numeroVersao,
      storage_path: corpo.storage_path, paginas: paginas.length,
      ativa: true, publicada_em: new Date().toISOString(), publicada_por: perfil.id,
    }).select("id").single();
    if (erroVersao || !versao) throw new Error("nao foi possivel criar a versao");
    versaoCriada = versao.id;

    // ---------------------------------------------------------- leitura
    const trechos: {
      pagina: number; secao: string | null; conteudo: string;
      tecnologia: string; confianca: number | null; incerto: boolean;
    }[] = [];
    let tokensOcr = { entrada: 0, saida: 0 };
    let paginasPorOcr = 0;

    for (const p of paginas) {
      const temCamada = (p.texto ?? "").trim().length >= MIN_TEXTO_CAMADA;

      if (temCamada) {
        trechos.push({
          pagina: p.pagina, secao: null, conteudo: p.texto!.trim(),
          tecnologia: "camada de texto do PDF (pdf.js)",
          confianca: 1, incerto: false,
        });
        continue;
      }

      if (!p.imagem_path) {
        trechos.push({
          pagina: p.pagina, secao: null,
          conteudo: "[pagina sem camada de texto e sem imagem enviada]",
          tecnologia: "nenhuma", confianca: 0, incerto: true,
        });
        continue;
      }

      // OCR pela capacidade multimodal do modelo.
      const { data: blob } = await servidor.storage.from("mkt-manuais").download(p.imagem_path);
      if (!blob) throw new Error(`pagina ${p.pagina}: imagem nao encontrada`);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));

      const r = await chamarIA(chave, [
        { type: "image", source: { type: "base64", media_type: "image/png", data: btoa(bin) } },
        { type: "text", text: [
          `Esta e a pagina ${p.pagina} de um manual de marca digitalizado.`,
          "Transcreva TODO o texto visivel, na ordem em que aparece.",
          "NAO complete, NAO resuma e NAO escreva nada que nao esteja na imagem.",
          "Trecho ilegivel vira exatamente [ilegivel].",
          "Se a pagina tiver titulo de secao, informe em 'secao'.",
          "Responda so com JSON: {\"secao\":\"titulo da secao ou null\",\"texto\":\"transcricao\",\"confianca\":0.0}",
          "A confianca vai de 0 a 1 e deve cair quando houver trecho ilegivel ou duvida de leitura.",
        ].join("\n") },
      ], "Responda sempre com um unico objeto JSON valido e nada mais.");

      tokensOcr = {
        entrada: tokensOcr.entrada + (r.uso.input_tokens ?? 0),
        saida: tokensOcr.saida + (r.uso.output_tokens ?? 0),
      };
      paginasPorOcr++;

      const lido = extrairJson(r.texto);
      const conteudo = String(lido?.texto ?? "").trim();
      const confianca = Number(lido?.confianca);
      const incerto = !conteudo || !Number.isFinite(confianca) ||
        confianca < CONFIANCA_BAIXA || conteudo.includes("[ilegivel]") || r.truncou;

      trechos.push({
        pagina: p.pagina,
        secao: lido?.secao ? String(lido.secao) : null,
        conteudo: conteudo || "[nao foi possivel ler esta pagina]",
        tecnologia: `OCR multimodal ${MODELO}`,
        confianca: Number.isFinite(confianca) ? confianca : null,
        incerto,
      });
    }

    if (paginasPorOcr) {
      await servidor.from("ia_execucoes").insert({
        org_id: perfil.org_id, capacidade: "ocr", provedor: "anthropic",
        modelo: MODELO, prompt_versao: VERSAO_PROMPT,
        tokens_entrada: tokensOcr.entrada, tokens_saida: tokensOcr.saida,
        latencia_ms: Date.now() - inicio, sucesso: true,
      });
    }

    await servidor.from("manual_chunks").insert(trechos.map((t) => ({
      org_id: perfil.org_id, manual_versao_id: versao.id,
      pagina: t.pagina,
      secao: t.secao ? `${t.secao} | leitura: ${t.tecnologia}${t.incerto ? " | LEITURA INCERTA" : ""}`
                     : `leitura: ${t.tecnologia}${t.incerto ? " | LEITURA INCERTA" : ""}`,
      conteudo: t.conteudo,
    })));

    // ---------------------------------------------------------- regras
    const inicioRegras = Date.now();
    const corpoManual = trechos
      .map((t) => `--- PAGINA ${t.pagina}${t.secao ? " | SECAO: " + t.secao : ""} ---\n${t.conteudo}`)
      .join("\n\n");

    const r2 = await chamarIA(chave, [{ type: "text", text: [
      "Abaixo esta o conteudo lido de um manual da marca Jolo Gelato, pagina a pagina.",
      "Extraia dele as regras objetivas que podem ser conferidas em uma peca de marketing.",
      "",
      "NAO invente regra. Toda regra precisa estar escrita no texto.",
      "O campo trecho_origem deve ser copiado do texto da pagina, sem reescrever.",
      "Se a pagina estiver marcada como leitura incerta, marque a regra com incerta = true.",
      "Ignore trechos de apresentacao, agradecimento e institucional que nao viram regra.",
      "",
      corpoManual,
      "",
      "Responda so com JSON:",
      '{"regras":[{"codigo":"EMB-01","categoria":"cor|tipografia|logo|texto|fotografia|grafismo|tecnica|estrategia","titulo":"curto","descricao":"a regra em uma ou duas frases","como_corrigir":"o que fazer","severidade":"bloqueante|obrigatoria|sugestao","pagina":1,"secao":"titulo da secao","trecho_origem":"copia literal","incerta":false}]}',
      "Use o codigo que ja aparece no manual quando houver. Caso contrario, crie um codigo curto.",
    ].join("\n") }], "Responda sempre com um unico objeto JSON valido e nada mais.", 4000);

    const extraido = extrairJson(r2.texto);
    const propostas = Array.isArray(extraido?.regras) ? extraido.regras : [];

    await servidor.from("ia_execucoes").insert({
      org_id: perfil.org_id, capacidade: "extracao_regras", provedor: "anthropic",
      modelo: MODELO, prompt_versao: VERSAO_PROMPT,
      tokens_entrada: r2.uso.input_tokens ?? null, tokens_saida: r2.uso.output_tokens ?? null,
      latencia_ms: Date.now() - inicioRegras, sucesso: true,
    });

    const categorias = ["cor", "tipografia", "logo", "texto", "fotografia",
                        "grafismo", "tecnica", "estrategia"];
    const paginasValidas = new Set(trechos.map((t) => t.pagina));

    // Regra que aponta pagina inexistente e descartada: rastreabilidade primeiro.
    const paraGravar = propostas
      .filter((r: Record<string, unknown>) => r.codigo && r.descricao && paginasValidas.has(Number(r.pagina)))
      .map((r: Record<string, unknown>) => ({
        org_id: perfil.org_id, marca_id: marca.id,
        manual_versao_id: versao.id,
        codigo: String(r.codigo).slice(0, 20),
        categoria: categorias.includes(String(r.categoria)) ? String(r.categoria) : "texto",
        titulo: String(r.titulo ?? r.codigo).slice(0, 120),
        descricao: String(r.descricao) + (r.incerta === true ? " [LEITURA INCERTA: confira no manual]" : ""),
        como_corrigir: r.como_corrigir ? String(r.como_corrigir) : null,
        severidade: ["bloqueante", "obrigatoria", "sugestao"].includes(String(r.severidade))
          ? String(r.severidade) : "obrigatoria",
        bloqueia_aprovacao: String(r.severidade) === "bloqueante",
        status: "sugerida",          // nunca entra em analise sem curadoria
        pagina: Number(r.pagina),
        secao: r.secao ? String(r.secao).slice(0, 200) : null,
        trecho_origem: r.trecho_origem ? String(r.trecho_origem).slice(0, 2000) : null,
      }));

    // Sem upsert, e de proposito. Toda ingestao cria uma versao NOVA, entao
    // nao existe linha anterior para resolver conflito: as regras desta versao
    // sao todas ineditas. Alem disso o indice de unicidade por versao e parcial
    // (so vale quando manual_versao_id nao e nulo), e indice parcial nao pode
    // ser inferido por ON CONFLICT sem declarar o predicado - coisa que o
    // cliente REST nao permite. O unico conflito real possivel e o modelo
    // propor o mesmo codigo duas vezes no mesmo lote, e isso se resolve aqui.
    const vistos = new Set<string>();
    const semRepetidas = paraGravar.filter((r: { codigo: string }) => {
      if (vistos.has(r.codigo)) return false;
      vistos.add(r.codigo);
      return true;
    });

    let gravadas = 0;
    if (semRepetidas.length) {
      const { data, error } = await servidor.from("regras_marca")
        .insert(semRepetidas).select("id");
      if (error) throw new Error("nao foi possivel gravar as regras: " + error.message);
      gravadas = data?.length ?? 0;
    }

    return responder({
      ok: true,
      manual_id: manual.id,
      manual_versao_id: versao.id,
      versao: numeroVersao,
      versao_anterior_id: versaoAnteriorAtiva,
      paginas: paginas.length,
      paginas_por_ocr: paginasPorOcr,
      paginas_por_camada_de_texto: paginas.length - paginasPorOcr,
      paginas_com_leitura_incerta: trechos.filter((t) => t.incerto).map((t) => t.pagina),
      tecnologia_ocr: paginasPorOcr ? `OCR multimodal ${MODELO}` : "nao foi necessario",
      regras_propostas: propostas.length,
      regras_sugeridas_gravadas: gravadas,
      regras_descartadas: propostas.length - paraGravar.length,
      regras_repetidas_no_lote: paraGravar.length - semRepetidas.length,
      latencia_ms: Date.now() - inicio,
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "falha desconhecida";

    // Ingestao que falha nao deixa versao pela metade nem derruba a versao que
    // estava no ar. Ordem importa: a nova sai antes de a anterior voltar,
    // porque o banco so admite uma versao vigente por manual.
    let revertido = false;
    if (versaoCriada) {
      try {
        await servidor.from("regras_marca").delete().eq("manual_versao_id", versaoCriada);
        await servidor.from("manual_chunks").delete().eq("manual_versao_id", versaoCriada);
        await servidor.from("manual_versoes").delete().eq("id", versaoCriada);
        if (versaoAnteriorAtiva) {
          await servidor.from("manual_versoes").update({ ativa: true }).eq("id", versaoAnteriorAtiva);
        }
        revertido = true;
      } catch (e) {
        console.error("falha ao reverter a ingestao:", e);
      }
    }

    await servidor.from("ia_execucoes").insert({
      org_id: perfil.org_id, capacidade: "ingestao_manual", provedor: "anthropic",
      modelo: MODELO, prompt_versao: VERSAO_PROMPT,
      latencia_ms: Date.now() - inicio, sucesso: false, erro: mensagem.slice(0, 400),
    });
    console.error("falha na ingestao:", mensagem);
    return responder({ erro: "falha_na_ingestao", detalhe: mensagem, revertido }, 500);
  }
});

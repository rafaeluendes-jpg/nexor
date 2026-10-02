// Legendas e referencias — item 7 da auditoria.
//
// Antes: a legenda saia junto com o laudo e ficava la, sem ninguem poder
// ajustar nem aprovar. Os campos editada/aprovada/aprovada_por existiam no
// banco desde o inicio e nunca tinham sido usados.
//
// Agora a legenda tem ciclo: gerada -> editada pela unidade -> aprovada pela
// franqueadora. E o tom da marca saiu do codigo e virou configuracao, com o
// que e proibido dito de forma explicita e conferido por regra, nao por
// opiniao do modelo.
//
// Divisao igual a do resto do sistema: o modelo escreve, a REGRA barra. Uma
// legenda com palavra proibida nao e "corrigida com jeitinho" - ela e recusada
// com o motivo, e o modelo tenta de novo sabendo o que errou.
//
// Referencia tem duas naturezas: visual (tem imagem, ensina luz e cor) e texto
// (nao tem imagem, ensina tom e escrita). As duas podem ser exemplo do que
// fazer ou contraexemplo - e o contraexemplo ensina tanto quanto.

import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const CHAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CHAVE_SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODELO = "claude-sonnet-5";
const VERSAO_PROMPT = "jolo-legenda-v1";
const TENTATIVAS_DE_ESCRITA = 2;

const CABECALHOS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Content-Type": "application/json; charset=utf-8",
};
const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: CABECALHOS });

type Config = {
  tom: string; tamanho_maximo: number; assinatura: string | null;
  chamada_final: string | null; hashtags_fixas: string[];
  hashtags_proibidas: string[]; palavras_proibidas: string[];
  permite_emoji: boolean; permite_preco: boolean; exige_aprovacao: boolean;
};

function conferir(texto: string, cfg: Config) {
  const problemas: string[] = [];
  const limpo = texto.trim();

  if (!limpo) problemas.push("a legenda esta vazia");
  if (limpo.length > cfg.tamanho_maximo) {
    problemas.push(`a legenda tem ${limpo.length} caracteres; o limite da marca e ${cfg.tamanho_maximo}`);
  }
  if (!cfg.permite_emoji && /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(limpo)) {
    problemas.push("a marca nao usa emoji");
  }
  if (/!{2,}/.test(limpo)) problemas.push("exclamacao repetida foge do tom calmo");
  if (!cfg.permite_preco && /(\d+\s*%|R\$\s*\d|\bpre[c\u00e7]o\b)/i.test(limpo)) {
    problemas.push("a marca nao comunica preco nem porcentagem na legenda");
  }
  for (const palavra of cfg.palavras_proibidas ?? []) {
    if (!palavra) continue;
    if (new RegExp(`\\b${palavra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(limpo)) {
      problemas.push(`a palavra "${palavra}" nao e usada pela marca`);
    }
  }
  for (const tag of cfg.hashtags_proibidas ?? []) {
    if (tag && limpo.toLowerCase().includes(tag.toLowerCase())) {
      problemas.push(`a hashtag ${tag} nao e permitida`);
    }
  }
  return problemas;
}

function montarFinal(texto: string, cfg: Config) {
  const partes = [texto.trim()];
  if (cfg.chamada_final && !texto.toLowerCase().includes(cfg.chamada_final.toLowerCase().slice(0, 8))) {
    partes.push(cfg.chamada_final);
  }
  if (cfg.assinatura && !texto.toLowerCase().includes(cfg.assinatura.toLowerCase().slice(0, 10))) {
    partes.push(cfg.assinatura);
  }
  const tags = (cfg.hashtags_fixas ?? []).filter((t) =>
    t && !texto.toLowerCase().includes(t.toLowerCase()));
  if (tags.length) partes.push(tags.join(" "));
  return partes.join("\n\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CABECALHOS });
  if (req.method !== "POST") return responder({ erro: "metodo_invalido" }, 405);

  const autorizacao = req.headers.get("Authorization") ?? "";
  if (!autorizacao) return responder({ erro: "sem_credencial" }, 401);

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return responder({ erro: "corpo_invalido" }, 400); }
  const acao = String(corpo.acao ?? "gerar");

  const comoUsuario = createClient(URL_SB, CHAVE_ANON, {
    db: { schema: "mkt" },
    global: { headers: { Authorization: autorizacao } },
  });
  const { data: { user } } = await comoUsuario.auth.getUser();
  if (!user) return responder({ erro: "sem_credencial" }, 401);

  const { data: eu } = await comoUsuario.from("perfis")
    .select("id, org_id, unidade_id, funcao").eq("id", user.id).maybeSingle();
  if (!eu) return responder({ erro: "sem_perfil" }, 403);
  const ehAdmin = eu.funcao === "admin_geral";

  const servidor = createClient(URL_SB, CHAVE_SERVICO, { db: { schema: "mkt" } });

  const lerConfig = async (marcaId: string): Promise<Config> => {
    const { data } = await servidor.from("legenda_config")
      .select("*").eq("marca_id", marcaId).maybeSingle();
    return (data ?? {
      tom: "calmo, acolhedor, sensorial; nunca pomposo", tamanho_maximo: 300,
      assinatura: null, chamada_final: null, hashtags_fixas: [],
      hashtags_proibidas: [], palavras_proibidas: [],
      permite_emoji: false, permite_preco: false, exige_aprovacao: true,
    }) as Config;
  };

  try {
    switch (acao) {
      // ------------------------------------------------------- configuracao
      case "ver_config": {
        const { data: marca } = await servidor.from("marcas")
          .select("id").eq("org_id", eu.org_id).limit(1).single();
        return responder({ ok: true, config: await lerConfig(marca.id) });
      }

      case "salvar_config": {
        if (!ehAdmin) return responder({ erro: "somente_administrador" }, 403);
        const { data: marca } = await servidor.from("marcas")
          .select("id").eq("org_id", eu.org_id).limit(1).single();

        const campos: Record<string, unknown> = { atualizado_em: new Date().toISOString(), atualizado_por: eu.id };
        for (const c of ["tom", "assinatura", "chamada_final"]) {
          if (corpo[c] !== undefined) campos[c] = corpo[c];
        }
        for (const c of ["hashtags_fixas", "hashtags_proibidas", "palavras_proibidas"]) {
          if (Array.isArray(corpo[c])) campos[c] = corpo[c];
        }
        for (const c of ["permite_emoji", "permite_preco", "exige_aprovacao"]) {
          if (typeof corpo[c] === "boolean") campos[c] = corpo[c];
        }
        if (Number.isFinite(Number(corpo.tamanho_maximo))) {
          campos.tamanho_maximo = Math.max(60, Math.min(2000, Number(corpo.tamanho_maximo)));
        }

        const { data, error } = await servidor.from("legenda_config")
          .update(campos).eq("marca_id", marca.id).select("*").single();
        if (error) throw new Error(error.message);
        return responder({ ok: true, config: data });
      }

      // ------------------------------------------------------------ gerar
      case "gerar": {
        const materialId = String(corpo.material_id ?? "");
        if (!materialId) return responder({ erro: "material_id_ausente" }, 400);

        const { data: material, error: erroMat } = await comoUsuario.from("materiais")
          .select("id, org_id, unidade_id, marca_id, titulo, formato, objetivo, publico")
          .eq("id", materialId).single();
        if (erroMat || !material) return responder({ erro: "material_nao_encontrado" }, 404);

        const cfg = await lerConfig(material.marca_id);

        const { data: analise } = await servidor.from("analises")
          .select("resumo, pontos_corretos").eq("material_id", materialId)
          .not("resumo", "is", null)
          .order("criado_em", { ascending: false }).limit(1).maybeSingle();

        // Referencias curadas: as aprovadas ensinam o que fazer, as reprovadas
        // o que evitar. Antes so as aprovadas eram usadas.
        const { data: refs } = await servidor.from("exemplos_referencia")
          .select("aprovado, explicacao, natureza").eq("marca_id", material.marca_id).limit(12);
        const bons = (refs ?? []).filter((r) => r.aprovado).map((r) => "- " + r.explicacao);
        const ruins = (refs ?? []).filter((r) => !r.aprovado).map((r) => "- " + r.explicacao);

        const { data: chave } = await servidor.rpc("chave_ia");
        if (!chave) throw new Error("chave da IA indisponivel");

        let texto = "", problemas: string[] = [], tentativas = 0;
        let tokens = { entrada: 0, saida: 0 };

        while (tentativas < TENTATIVAS_DE_ESCRITA) {
          tentativas++;
          const instrucao = [
            "Escreva a legenda de uma publicacao da Jolo Gelato, gelateria italiana artesanal.",
            `TOM DA MARCA: ${cfg.tom}.`,
            `LIMITE: ${cfg.tamanho_maximo} caracteres, contando espacos.`,
            cfg.permite_emoji ? "" : "NAO use emoji.",
            cfg.permite_preco ? "" : "NAO cite preco, porcentagem nem desconto.",
            (cfg.palavras_proibidas ?? []).length
              ? `NAO use estas palavras: ${cfg.palavras_proibidas.join(", ")}.` : "",
            "NAO escreva a assinatura nem as hashtags: o sistema acrescenta depois.",
            "",
            `MATERIAL: ${material.titulo ?? "sem titulo"} | formato: ${material.formato ?? "-"} | objetivo: ${material.objetivo ?? "-"}`,
            analise?.resumo ? `O QUE A PECA MOSTRA: ${analise.resumo}` : "",
            bons.length ? "ASSIM A MARCA ESCREVE:\n" + bons.join("\n") : "",
            ruins.length ? "ASSIM A MARCA NAO ESCREVE:\n" + ruins.join("\n") : "",
            problemas.length
              ? "\nA TENTATIVA ANTERIOR FOI RECUSADA POR ISTO:\n- " + problemas.join("\n- ")
              : "",
            "",
            "Responda so com JSON: {\"legenda\":\"o texto\"}",
          ].filter(Boolean).join("\n");

          const r = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json", "x-api-key": chave,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: MODELO, max_tokens: 600,
              system: "Responda sempre com um unico objeto JSON valido e nada mais.",
              messages: [{ role: "user", content: instrucao }],
            }),
          });
          if (!r.ok) throw new Error(`IA respondeu ${r.status}`);
          const d = await r.json();
          tokens = {
            entrada: tokens.entrada + (d.usage?.input_tokens ?? 0),
            saida: tokens.saida + (d.usage?.output_tokens ?? 0),
          };
          const bruto = (d.content ?? []).filter((b: { type: string }) => b.type === "text")
            .map((b: { text: string }) => b.text).join("\n");
          const limpo = bruto.replace(/```json|```/g, "").trim();
          const i = limpo.indexOf("{"), f = limpo.lastIndexOf("}");
          let escrito: { legenda?: string } | null = null;
          if (i !== -1 && f > i) { try { escrito = JSON.parse(limpo.slice(i, f + 1)); } catch { /* ignora */ } }

          texto = String(escrito?.legenda ?? "").trim();
          problemas = conferir(texto, cfg);
          if (!problemas.length) break;
        }

        await servidor.from("ia_execucoes").insert({
          org_id: material.org_id, unidade_id: material.unidade_id,
          capacidade: "escrita_legenda", provedor: "anthropic", modelo: MODELO,
          prompt_versao: VERSAO_PROMPT,
          tokens_entrada: tokens.entrada, tokens_saida: tokens.saida,
          sucesso: problemas.length === 0,
          erro: problemas.length ? problemas.join("; ").slice(0, 400) : null,
        });

        if (problemas.length) {
          return responder({
            erro: "legenda_fora_do_manual", problemas, tentativas,
            texto_recusado: texto,
            detalhe: "O texto foi recusado pela conferencia da marca. Escreva a legenda a mao ou ajuste a configuracao.",
          }, 422);
        }

        const final = montarFinal(texto, cfg);
        const { data: legenda, error } = await servidor.from("legendas").insert({
          org_id: material.org_id, unidade_id: material.unidade_id,
          material_id: materialId, tipo: "sugerida", texto: final,
          modelo: MODELO, criado_por: eu.id,
          aprovada: cfg.exige_aprovacao ? null : true,
        }).select("id, texto, aprovada").single();
        if (error) throw new Error(error.message);

        return responder({
          ok: true, legenda_id: legenda.id, texto: legenda.texto,
          tentativas, caracteres: final.length,
          precisa_aprovacao: cfg.exige_aprovacao,
          referencias_usadas: { exemplos: bons.length, contraexemplos: ruins.length },
          observacao: cfg.exige_aprovacao
            ? "A legenda foi gravada como sugestao. So vale depois que a franqueadora aprovar."
            : "A marca dispensa aprovacao de legenda.",
        });
      }

      // ------------------------------------------------------------ editar
      case "editar": {
        const id = String(corpo.legenda_id ?? "");
        const novo = String(corpo.texto ?? "").trim();
        if (!id || !novo) return responder({ erro: "legenda_id_e_texto_obrigatorios" }, 400);

        const { data: atual, error: erroAtual } = await comoUsuario.from("legendas")
          .select("id, material_id, aprovada, materiais(marca_id)").eq("id", id).single();
        if (erroAtual || !atual) return responder({ erro: "legenda_nao_encontrada" }, 404);
        if (atual.aprovada === true && !ehAdmin) {
          return responder({ erro: "legenda_ja_aprovada", detalhe:
            "Legenda aprovada nao e editada pela unidade. Peca uma nova a franqueadora." }, 400);
        }

        const cfg = await lerConfig((atual.materiais as { marca_id: string }).marca_id);
        const problemas = conferir(novo, cfg);
        if (problemas.length) return responder({ erro: "legenda_fora_do_manual", problemas }, 422);

        const { data, error } = await servidor.from("legendas").update({
          texto: novo, editada: true,
          aprovada: cfg.exige_aprovacao ? null : true,
          aprovada_por: null,
        }).eq("id", id).select("id, texto, editada, aprovada").single();
        if (error) throw new Error(error.message);

        return responder({ ok: true, legenda: data, observacao:
          "Texto alterado. A aprovacao anterior foi desfeita: aprovacao vale para o texto que foi lido." });
      }

      // ----------------------------------------------------------- aprovar
      case "aprovar":
      case "recusar": {
        if (!ehAdmin) return responder({ erro: "somente_administrador" }, 403);
        const id = String(corpo.legenda_id ?? "");
        if (!id) return responder({ erro: "legenda_id_ausente" }, 400);

        const { data, error } = await servidor.from("legendas").update({
          aprovada: acao === "aprovar", aprovada_por: eu.id,
        }).eq("id", id).eq("org_id", eu.org_id).select("id, texto, aprovada").single();
        if (error) throw new Error(error.message);
        return responder({ ok: true, legenda: data });
      }

      case "listar": {
        const materialId = String(corpo.material_id ?? "");
        if (!materialId) return responder({ erro: "material_id_ausente" }, 400);
        const { data } = await comoUsuario.from("legendas")
          .select("id, texto, tipo, editada, aprovada, criado_em")
          .eq("material_id", materialId).order("criado_em", { ascending: false });
        return responder({ ok: true, legendas: data ?? [] });
      }

      case "aguardando": {
        if (!ehAdmin) return responder({ erro: "somente_administrador" }, 403);
        const { data } = await servidor.from("legendas")
          .select("id, texto, editada, criado_em, materiais(titulo), unidades(codigo)")
          .eq("org_id", eu.org_id).is("aprovada", null)
          .order("criado_em", { ascending: false }).limit(50);
        return responder({ ok: true, aguardando: data ?? [] });
      }

      // -------------------------------------------------------- referencias
      case "listar_referencias": {
        const { data: marca } = await servidor.from("marcas")
          .select("id").eq("org_id", eu.org_id).limit(1).single();
        const { data } = await comoUsuario.from("exemplos_referencia")
          .select("id, titulo, explicacao, aprovado, natureza, formato, storage_path, curado_em")
          .eq("marca_id", marca.id).order("aprovado", { ascending: false });
        return responder({ ok: true, referencias: data ?? [] });
      }

      case "salvar_referencia": {
        if (!ehAdmin) return responder({ erro: "somente_administrador" }, 403);
        const explicacao = String(corpo.explicacao ?? "").trim();
        if (!explicacao) {
          return responder({ erro: "explicacao_obrigatoria", detalhe:
            "Referencia sem explicacao nao ensina nada: diga por que esta peca serve de exemplo." }, 400);
        }
        const natureza = corpo.natureza === "visual" ? "visual" : "texto";
        const caminho = corpo.storage_path ? String(corpo.storage_path) : null;
        if (natureza === "visual" && !caminho) {
          return responder({ erro: "referencia_visual_sem_arquivo", detalhe:
            "Exemplo visual precisa da imagem. Para ensinar so o jeito de escrever, use natureza 'texto'." }, 400);
        }

        const { data: marca } = await servidor.from("marcas")
          .select("id").eq("org_id", eu.org_id).limit(1).single();

        const { data, error } = await servidor.from("exemplos_referencia").insert({
          org_id: eu.org_id, marca_id: marca.id, natureza,
          titulo: corpo.titulo ? String(corpo.titulo).slice(0, 120) : null,
          explicacao, aprovado: corpo.aprovado !== false, storage_path: caminho,
          curado_por: eu.id, curado_em: new Date().toISOString(), criado_por: eu.id,
        }).select("*").single();
        if (error) throw new Error(error.message);

        return responder({ ok: true, referencia: data, observacao:
          data.aprovado
            ? "Exemplo do que fazer: entra na escrita das proximas legendas."
            : "Contraexemplo: entra na escrita como o que a marca NAO faz." });
      }

      case "remover_referencia": {
        if (!ehAdmin) return responder({ erro: "somente_administrador" }, 403);
        const id = String(corpo.referencia_id ?? "");
        if (!id) return responder({ erro: "referencia_id_ausente" }, 400);
        const { data, error } = await servidor.from("exemplos_referencia")
          .delete().eq("id", id).eq("org_id", eu.org_id).select("id");
        if (error) throw new Error(error.message);
        return responder({ ok: true, removidas: data?.length ?? 0 });
      }

      default:
        return responder({ erro: "acao_desconhecida", acoes: [
          "ver_config", "salvar_config", "gerar", "editar", "aprovar", "recusar",
          "listar", "aguardando", "listar_referencias", "salvar_referencia",
          "remover_referencia",
        ] }, 400);
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "falha desconhecida";
    console.error("falha em legendas:", mensagem);
    return responder({ erro: "falha_em_legendas", detalhe: mensagem }, 500);
  }
});

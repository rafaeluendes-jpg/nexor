// Geracao de arte — fase 4 + item 3 da auditoria (arte com a foto enviada).
//
// A arte NAO e desenhada por modelo generativo. Ela e montada por regra, com
// os arquivos oficiais cadastrados: a cor vem do HEX de marca_cores e o logo
// vem do arquivo oficial. A peca sai certa por construcao, nao por sorte.
//
// O modelo entra so onde texto e texto: escrever a frase no tom da marca,
// e a frase passa por conferencia antes de virar arte.
//
// COM FOTO DO FRANQUEADO (item 3): quando vem material_id, a foto enviada pela
// unidade entra na composicao. Tres decisoes de projeto:
//   1. O texto NUNCA e escrito por cima da foto. Vai numa faixa solida da cor
//      da marca. Texto sobre foto depende da foto para ter contraste, e foto
//      de unidade e imprevisivel - a legibilidade deixaria de ser garantida.
//   2. A foto e recortada, nunca esticada (preserveAspectRatio slice).
//   3. A FAIXA E DIMENSIONADA PELO CONTEUDO, nao por uma fracao fixa. A versao
//      anterior usava fracao fixa e o resultado nao cabia: sobravam 215px para
//      um conteudo que pedia 336px, e o texto ora invadia a foto ora atropelava
//      o logo. Agora a altura da faixa e a soma dos pedacos que vao dentro dela,
//      e quando a frase e longa demais o corpo do texto encolhe ate a foto
//      manter pelo menos 45% da peca.
//
// A foto usada e sempre a VERSAO MAIS RECENTE do material: se passou pela
// correcao automatica, a arte ja nasce da versao corrigida.
//
// Saida: SVG. O navegador transforma em PNG e reenvia para analise.

import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const CHAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CHAVE_SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODELO = "claude-sonnet-5";
const VERSAO_PROMPT = "jolo-arte-v5-faixa-dimensionada";
const TETO_FOTO_BYTES = 5 * 1024 * 1024;
const MIN_FRACAO_FOTO = 0.45;

const SERIFA = "Bodoni Moda, Didot, Georgia, Times New Roman, serif";
const SEM_SERIFA = "Jost, Futura, Avenir, Helvetica, Arial, sans-serif";

const FORMATOS: Record<string, { largura: number; altura: number; rotulo: string }> = {
  feed: { largura: 1080, altura: 1080, rotulo: "Feed 1:1" },
  carrossel: { largura: 1080, altura: 1350, rotulo: "Carrossel 4:5" },
  story: { largura: 1080, altura: 1920, rotulo: "Story 9:16" },
  reels: { largura: 1080, altura: 1920, rotulo: "Reels 9:16" },
};

const FUNDOS: Record<string, {
  nome: string; fundo: string; texto: string; apoio: string; logo: string;
}> = {
  verde: { nome: "Bosco Nobile", fundo: "#344929", texto: "#F7F1E6", apoio: "#DCD1BC", logo: "logo-jolo-creme.png" },
  noite: { nome: "Notte Verde", fundo: "#1E3420", texto: "#F7F1E6", apoio: "#DCD1BC", logo: "logo-jolo-creme.png" },
  creme: { nome: "Latte di Crema", fundo: "#F7F1E6", texto: "#1E3420", apoio: "#917140", logo: "logo-jolo.png" },
};

const CABECALHOS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Content-Type": "application/json; charset=utf-8",
};

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: CABECALHOS });

const escaparXml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function extrairJson(bruto: string) {
  const limpo = bruto.replace(/```json|```/g, "").trim();
  const i = limpo.indexOf("{"), f = limpo.lastIndexOf("}");
  if (i === -1 || f <= i) return null;
  try { return JSON.parse(limpo.slice(i, f + 1)); } catch { return null; }
}

function conferirFrase(frase: string) {
  const problemas: string[] = [];
  const palavras = frase.trim().split(/\s+/).filter(Boolean);

  if (!frase.trim()) problemas.push("a frase esta vazia");
  if (palavras.length > 6) problemas.push(`a frase tem ${palavras.length} palavras; o padrao e ate 5 ou 6`);
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(frase)) problemas.push("a marca nao usa emoji");
  if (/!{2,}/.test(frase)) problemas.push("exclamacao repetida foge do tom calmo");
  if (/(\d+\s*%|R\$|desconto|promo(cao|\u00e7\u00e3o)|gr[a\u00e1]tis|off\b|barat)/i.test(frase)) {
    problemas.push("a Jolo nao compete por preco: tire desconto, porcentagem e valor");
  }
  if (/(luxo|luxuos|sofisticad|exclusiv)/i.test(frase)) {
    problemas.push("a marca nao se descreve como luxuosa, sofisticada nem exclusiva");
  }
  return problemas;
}

function quebrar(frase: string, porLinha: number) {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of frase.trim().split(/\s+/)) {
    if ((atual + " " + palavra).trim().length <= porLinha) {
      atual = (atual + " " + palavra).trim();
    } else {
      if (atual) linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

type Logo = { base64: string; largura: number; altura: number } | null;
type Foto = { base64: string; mime: string } | null;

// ---------------------------------------------------------- arte so com cor
function montarSvg(frase: string, apoio: string, formato: string, tema: string, logo: Logo) {
  const { largura, altura } = FORMATOS[formato] ?? FORMATOS.feed;
  const cor = FUNDOS[tema] ?? FUNDOS.verde;

  const margem = Math.round(largura * 0.10);
  const corpo = Math.round(largura * 0.105);
  const entreLinhas = Math.round(corpo * 1.2);
  const linhas = quebrar(frase, 16);

  const larguraLogo = Math.round(largura * 0.22);
  const alturaLogo = logo ? Math.round(larguraLogo * (logo.altura / logo.largura)) : 0;
  const respiroLogo = Math.round(largura * 0.06);
  const topoLogo = altura - margem - alturaLogo;

  const limiteInferior = logo ? topoLogo - respiroLogo : altura - margem;
  const alturaTexto = linhas.length * entreLinhas + (apoio ? corpo * 0.6 : 0);
  const centro = margem + (limiteInferior - margem) / 2;
  const inicioY = Math.round(centro - alturaTexto / 2 + corpo * 0.72);

  const versos = linhas.map((linha, i) =>
    `<text x="${largura / 2}" y="${inicioY + i * entreLinhas}" text-anchor="middle" font-family="${SERIFA}" font-size="${corpo}" fill="${cor.texto}">${escaparXml(linha)}</text>`,
  ).join("\n  ");

  const linhaApoio = apoio
    ? `<text x="${largura / 2}" y="${inicioY + linhas.length * entreLinhas + Math.round(corpo * 0.1)}" text-anchor="middle" font-family="${SEM_SERIFA}" font-size="${Math.round(corpo * 0.28)}" letter-spacing="${Math.round(corpo * 0.035)}" fill="${cor.apoio}">${escaparXml(apoio)}</text>`
    : "";

  const marca = logo
    ? `<image href="data:image/png;base64,${logo.base64}" x="${Math.round(largura / 2 - larguraLogo / 2)}" y="${topoLogo}" width="${larguraLogo}" height="${alturaLogo}" preserveAspectRatio="xMidYMid meet"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">
  <rect width="${largura}" height="${altura}" fill="${cor.fundo}"/>
  <rect x="${Math.round(margem * 0.55)}" y="${Math.round(margem * 0.55)}" width="${largura - Math.round(margem * 1.1)}" height="${altura - Math.round(margem * 1.1)}" fill="none" stroke="${cor.apoio}" stroke-width="2" opacity="0.3"/>
  ${versos}
  ${linhaApoio}
  ${marca}
</svg>`;
}

// ------------------------------------------------------- arte com a foto
function montarSvgComFoto(
  frase: string, apoio: string, formato: string, tema: string, logo: Logo, foto: Foto,
) {
  const { largura, altura } = FORMATOS[formato] ?? FORMATOS.feed;
  const cor = FUNDOS[tema] ?? FUNDOS.verde;

  const margem = Math.round(largura * 0.09);
  const larguraLogo = Math.round(largura * 0.17);
  const alturaLogo = logo ? Math.round(larguraLogo * (logo.altura / logo.largura)) : 0;
  const respiroBase = Math.round(margem * 0.7);
  const corpoMinimo = Math.round(largura * 0.045);

  // A faixa e a SOMA do que vai dentro dela. Se nao couber sem espremer a foto,
  // o corpo do texto encolhe - e o texto que cede, nunca a legibilidade nem a
  // area de protecao do logo.
  let corpo = Math.round(largura * 0.072);
  let linhas = quebrar(frase, 18);
  let entreLinhas = 0, apoioTam = 0, respiroTopo = 0, respiroLogo = 0;
  let alturaFaixa = 0, alturaFoto = 0;

  for (let tentativa = 0; tentativa < 12; tentativa++) {
    entreLinhas = Math.round(corpo * 1.15);
    apoioTam = Math.round(corpo * 0.30);
    respiroTopo = Math.round(corpo * 0.6);
    respiroLogo = Math.round(corpo * 0.55);

    alturaFaixa = respiroTopo + linhas.length * entreLinhas +
      (apoio ? Math.round(corpo * 0.25) + apoioTam : 0) +
      respiroLogo + alturaLogo + respiroBase;
    alturaFoto = altura - alturaFaixa;

    if (alturaFoto / altura >= MIN_FRACAO_FOTO || corpo <= corpoMinimo) break;
    corpo = Math.round(corpo * 0.93);
    linhas = quebrar(frase, Math.round(18 * (Math.round(largura * 0.072) / corpo)));
  }

  const baseTexto = alturaFoto + respiroTopo;
  const primeiraBase = baseTexto + Math.round(corpo * 0.78);
  const fimLinhas = baseTexto + linhas.length * entreLinhas;
  const baseApoio = fimLinhas + Math.round(corpo * 0.25) + apoioTam;
  const topoLogo = altura - respiroBase - alturaLogo;

  const versos = linhas.map((linha, i) =>
    `<text x="${largura / 2}" y="${primeiraBase + i * entreLinhas}" text-anchor="middle" font-family="${SERIFA}" font-size="${corpo}" fill="${cor.texto}">${escaparXml(linha)}</text>`,
  ).join("\n  ");

  const linhaApoio = apoio
    ? `<text x="${largura / 2}" y="${baseApoio}" text-anchor="middle" font-family="${SEM_SERIFA}" font-size="${apoioTam}" letter-spacing="${Math.round(corpo * 0.04)}" fill="${cor.apoio}">${escaparXml(apoio)}</text>`
    : "";

  const marca = logo
    ? `<image href="data:image/png;base64,${logo.base64}" x="${Math.round(largura / 2 - larguraLogo / 2)}" y="${topoLogo}" width="${larguraLogo}" height="${alturaLogo}" preserveAspectRatio="xMidYMid meet"/>`
    : "";

  const imagem = foto
    ? `<image href="data:${foto.mime};base64,${foto.base64}" x="0" y="0" width="${largura}" height="${alturaFoto}" preserveAspectRatio="xMidYMid slice" clip-path="url(#areaFoto)"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">
  <defs><clipPath id="areaFoto"><rect x="0" y="0" width="${largura}" height="${alturaFoto}"/></clipPath></defs>
  <rect width="${largura}" height="${altura}" fill="${cor.fundo}"/>
  ${imagem}
  <rect x="0" y="${alturaFoto}" width="${largura}" height="${altura - alturaFoto}" fill="${cor.fundo}"/>
  <rect x="0" y="${alturaFoto}" width="${largura}" height="3" fill="${cor.apoio}" opacity="0.55"/>
  ${versos}
  ${linhaApoio}
  ${marca}
</svg>`;
}

// ---------------------------------------------------------------- rota
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CABECALHOS });
  if (req.method !== "POST") return responder({ erro: "metodo_invalido" }, 405);

  const autorizacao = req.headers.get("Authorization") ?? "";
  if (!autorizacao) return responder({ erro: "sem_credencial" }, 401);

  let corpo: {
    tema?: string; formatos?: string[]; assunto?: string; frase?: string;
    apoio?: string; material_id?: string;
  };
  try { corpo = await req.json(); } catch { return responder({ erro: "corpo_invalido" }, 400); }

  const comoUsuario = createClient(URL_SB, CHAVE_ANON, {
    db: { schema: "mkt" },
    global: { headers: { Authorization: autorizacao } },
  });

  const { data: perfil } = await comoUsuario.from("perfis")
    .select("id, org_id, unidade_id").limit(1).maybeSingle();
  if (!perfil) return responder({ erro: "sem_perfil" }, 403);

  const servidor = createClient(URL_SB, CHAVE_SERVICO, { db: { schema: "mkt" } });
  const inicio = Date.now();

  try {
    const tema = FUNDOS[corpo.tema ?? "verde"] ? (corpo.tema ?? "verde") : "verde";
    const formatos = (corpo.formatos?.length ? corpo.formatos : ["feed"])
      .filter((f) => FORMATOS[f]).slice(0, 4);

    // ------------------------------------------------ foto enviada (item 3)
    let foto: Foto = null;
    let origemFoto: Record<string, unknown> | null = null;

    if (corpo.material_id) {
      const { data: material, error: erroMat } = await comoUsuario.from("materiais")
        .select("id, titulo").eq("id", corpo.material_id).single();
      if (erroMat || !material) return responder({ erro: "material_nao_encontrado" }, 404);

      const { data: versao } = await servidor.from("material_versoes")
        .select("id, versao, origem").eq("material_id", corpo.material_id)
        .order("versao", { ascending: false }).limit(1).maybeSingle();
      if (!versao) return responder({ erro: "material_sem_versao" }, 400);

      const { data: arquivo } = await servidor.from("arquivos")
        .select("bucket, storage_path, mime, bytes, largura, altura")
        .eq("material_versao_id", versao.id).is("timestamp_ms", null).limit(1).maybeSingle();
      if (!arquivo) return responder({ erro: "versao_sem_arquivo" }, 400);
      if ((arquivo.mime ?? "").startsWith("video/")) {
        return responder({ erro: "foto_invalida", detalhe:
          "A arte usa foto. Para video, use o roteiro de edicao do laudo." }, 400);
      }
      if ((arquivo.bytes ?? 0) > TETO_FOTO_BYTES) {
        return responder({ erro: "foto_grande_demais", detalhe:
          `A foto tem ${Math.round((arquivo.bytes ?? 0) / 1024)} KB. O limite para compor arte e ${
            TETO_FOTO_BYTES / 1024 / 1024} MB.` }, 400);
      }

      const { data: blob } = await servidor.storage
        .from(arquivo.bucket ?? "mkt-materiais").download(arquivo.storage_path);
      if (!blob) return responder({ erro: "nao_foi_possivel_ler_a_foto" }, 400);

      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      foto = { base64: btoa(bin), mime: arquivo.mime ?? "image/jpeg" };

      origemFoto = {
        material_id: corpo.material_id,
        titulo: material.titulo,
        versao_usada: versao.versao,
        origem_da_versao: versao.origem,
        dimensoes: arquivo.largura && arquivo.altura
          ? `${arquivo.largura}x${arquivo.altura}` : null,
        observacao: versao.origem === "corrigido"
          ? "A arte usou a versao corrigida automaticamente, nao o envio original."
          : "A arte usou o arquivo enviado pela unidade, sem correcao.",
      };
    }

    // ------------------------------------------------------------- o texto
    let frase = (corpo.frase ?? "").trim();
    let apoio = (corpo.apoio ?? "").trim();
    let escritaPorIa = false;
    let tokens = { entrada: 0, saida: 0 };

    if (!frase) {
      const { data: chave } = await servidor.rpc("chave_ia");
      if (!chave) throw new Error("chave da IA indisponivel");

      const { data: regrasTexto } = await servidor.from("regras_marca")
        .select("codigo, titulo, descricao")
        .eq("status", "ativa").in("categoria", ["texto", "estrategia"]);

      const instrucao = [
        "Escreva o texto de uma peca da Jolo Gelato, gelateria italiana artesanal.",
        "Tom: calmo, acolhedor, sensorial. Nunca pomposo, sem emoji, sem preco, sem exclamacao repetida.",
        "Exemplos do proprio perfil da marca: 'Pode entrar.', 'Sem pressa. Sem culpa.', 'Pausa.', 'E gelato.'",
        "",
        "REGRAS DE TEXTO DA MARCA:",
        (regrasTexto ?? []).map((r) => `${r.codigo} ${r.titulo}: ${r.descricao}`).join("\n"),
        "",
        `ASSUNTO DA PECA: ${corpo.assunto ?? "convite para visitar a loja"}`,
        foto ? "A peca traz uma foto real da unidade acima do texto. O texto acompanha a foto, " +
               "nao descreve a foto." : "",
        "",
        "Responda so com JSON: {\"frase\":\"ate 5 palavras\",\"apoio\":\"uma linha curta de apoio, ate 8 palavras\"}",
      ].join("\n");

      const resposta = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": chave,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODELO, max_tokens: 400,
          system: "Responda sempre com um unico objeto JSON valido e nada mais.",
          messages: [{ role: "user", content: instrucao }],
        }),
      });

      if (!resposta.ok) throw new Error(`IA respondeu ${resposta.status}`);
      const dados = await resposta.json();
      const texto = (dados.content ?? []).filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text).join("\n");
      const escrito = extrairJson(texto);
      if (!escrito?.frase) throw new Error("a IA nao devolveu a frase");

      frase = String(escrito.frase).trim();
      apoio = apoio || String(escrito.apoio ?? "").trim();
      escritaPorIa = true;
      tokens = { entrada: dados.usage?.input_tokens ?? 0, saida: dados.usage?.output_tokens ?? 0 };
    }

    const problemas = conferirFrase(frase);
    if (problemas.length) {
      return responder({ erro: "frase_fora_do_manual", problemas, frase }, 422);
    }

    let logo: Logo = null;
    const { data: blobLogo } = await servidor.storage.from("mkt-site")
      .download(FUNDOS[tema].logo);
    if (blobLogo) {
      const bytes = new Uint8Array(await blobLogo.arrayBuffer());
      const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const larguraPng = vista.getUint32(16);
      const alturaPng = vista.getUint32(20);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      logo = { base64: btoa(bin), largura: larguraPng || 900, altura: alturaPng || 871 };
    }

    const artes = formatos.map((formato) => ({
      formato,
      rotulo: FORMATOS[formato].rotulo,
      largura: FORMATOS[formato].largura,
      altura: FORMATOS[formato].altura,
      com_foto: foto !== null,
      svg: foto
        ? montarSvgComFoto(frase, apoio, formato, tema, logo, foto)
        : montarSvg(frase, apoio, formato, tema, logo),
    }));

    if (escritaPorIa) {
      await servidor.from("ia_execucoes").insert({
        org_id: perfil.org_id, unidade_id: perfil.unidade_id,
        capacidade: "escrita_texto", provedor: "anthropic", modelo: MODELO,
        prompt_versao: VERSAO_PROMPT,
        tokens_entrada: tokens.entrada, tokens_saida: tokens.saida,
        latencia_ms: Date.now() - inicio, sucesso: true,
      });
    }

    return responder({
      ok: true, frase, apoio, tema,
      cor_de_fundo: FUNDOS[tema].nome,
      logo_usado: FUNDOS[tema].logo,
      escrita_por_ia: escritaPorIa,
      com_logo_oficial: logo !== null,
      com_foto_da_unidade: foto !== null,
      origem_da_foto: origemFoto,
      nota_de_composicao: foto
        ? "Texto em faixa solida da cor da marca, nunca sobre a foto: o contraste e " +
          "garantido por construcao. A faixa e dimensionada pelo conteudo e a foto e " +
          "recortada para preencher, nunca esticada."
        : "Arte sem foto: fundo solido da paleta oficial.",
      artes,
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "falha desconhecida";
    console.error("falha ao gerar arte:", mensagem);
    return responder({ erro: "falha_ao_gerar", detalhe: mensagem }, 500);
  }
});

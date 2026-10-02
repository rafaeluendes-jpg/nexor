// Analise de video — fase 3, com pontuacao deterministica.
//
// O ffmpeg nao roda neste ambiente. Em vez de fingir que roda, a extracao de
// quadros acontece no navegador, que decodifica video nativamente: ele pula
// para cada instante e copia a imagem daquele momento. Aqui chegam os quadros
// ja extraidos, cada um com o instante de origem.
//
// Cada quadro e medido (paleta, exposicao, nitidez) e todo achado herda o
// instante do quadro — e isso que produz "00:08 - texto sem contraste".
//
// Mesma divisao de responsabilidade da analise de imagem:
//   - a MEDICAO acha o que se calcula no pixel;
//   - o MODELO identifica achados que exigem leitura e diz em que instante;
//   - a REGRA define a gravidade;
//   - o SISTEMA calcula a nota, com a conta gravada em analises.pontuacao.
//
// So entram regras da versao VIGENTE de cada manual, mais as avulsas.
//
// Esta funcao atende dois chamadores: a tela (com token de usuario, sujeito a
// RLS) e a fila de video (com credencial de servidor). No segundo caso a
// autorizacao ja foi conferida na hora de enfileirar - quem enfileira precisa
// ser dono do material -, entao aqui o material e lido direto pelo servidor.

import { createClient } from "jsr:@supabase/supabase-js@2";
import jpeg from "npm:jpeg-js@0.4.4";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const CHAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CHAVE_SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODELO = "claude-sonnet-5";
const VERSAO_PROMPT = "jolo-video-v3-fila";
const TETO_SAIDA = 4000;
const CERTEZA_MINIMA = 0.7;
const TETO_QUADROS = 8;

const DUVIDOSO =
  /(n[a\u00e3]o (e|\u00e9) poss[i\u00ed]vel|n[a\u00e3]o foi poss[i\u00ed]vel|n[a\u00e3]o d[a\u00e1] para|n[a\u00e3]o consigo|n[a\u00e3]o h[a\u00e1] como|aparentemente|talvez|pode ser que|dif[i\u00ed]cil (afirmar|dizer)|incerto|sem certeza)/i;

const LIMIAR = {
  fatiaMinima: 0.05,
  fatiaForaTolerada: 0.15,
  deltaEFoto: 20,
  cromaAlheia: 30,
  baldesArteChapada: 8,
  lumaEscura: 45,
  lumaEstourada: 215,
  nitidezMinima: 15,
};

// Cada categoria de regra pesa sobre uma dimensao da nota.
const DIMENSAO: Record<string, string> = {
  cor: "identidade", logo: "identidade", tipografia: "identidade", grafismo: "identidade",
  tecnica: "tecnica", fotografia: "tecnica",
  texto: "texto",
  estrategia: "estrategia",
};

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

const relogio = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// ---------------------------------------------------------------- cor
function paraLab(r: number, g: number, b: number) {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE2000(lab1: number[], lab2: number[]) {
  const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2;
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cm, 7) / (Math.pow(Cm, 7) + Math.pow(25, 7))));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp = (b: number, a: number) => {
    if (b === 0 && a === 0) return 0;
    const h = Math.atan2(b, a) * deg;
    return h >= 0 ? h : h + 360;
  };
  const hp1 = hp(b1, ap1), hp2 = hp(b2, ap2);
  const dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = 0;
  if (Cp1 * Cp2 !== 0) {
    dh = hp2 - hp1;
    if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad);
  const Lm = (L1 + L2) / 2, Cpm = (Cp1 + Cp2) / 2;
  let hpm = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hpm += hpm < 360 ? 360 : -360;
    hpm /= 2;
  }
  const T = 1 - 0.17 * Math.cos((hpm - 30) * rad) + 0.24 * Math.cos(2 * hpm * rad) +
    0.32 * Math.cos((3 * hpm + 6) * rad) - 0.20 * Math.cos((4 * hpm - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((hpm - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(Cpm, 7) / (Math.pow(Cpm, 7) + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lm - 50, 2)) / Math.sqrt(20 + Math.pow(Lm - 50, 2));
  const Sc = 1 + 0.045 * Cpm;
  const Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(Math.pow(dL / Sl, 2) + Math.pow(dC / Sc, 2) + Math.pow(dH / Sh, 2) +
    Rt * (dC / Sc) * (dH / Sh));
}

const doHex = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const paraHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

// ---------------------------------------------------------------- medicao
function medirQuadro(
  bytes: Uint8Array,
  oficiaisLab: { nome: string; lab: number[]; tolerancia: number }[],
) {
  const img = jpeg.decode(bytes, { useTArray: true });
  const { width: largura, height: altura, data: dados } = img;
  const passo = Math.max(1, Math.floor(Math.sqrt((largura * altura) / 60000)));

  const baldes = new Map<number, { n: number; r: number; g: number; b: number }>();
  let somaLuma = 0, estourados = 0, amostrados = 0;

  for (let y = 0; y < altura; y += passo) {
    for (let x = 0; x < largura; x += passo) {
      const o = (y * largura + x) * 4;
      const r = dados[o], g = dados[o + 1], b = dados[o + 2];
      somaLuma += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (0.2126 * r + 0.7152 * g + 0.0722 * b > 245) estourados++;
      amostrados++;
      const chave = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const at = baldes.get(chave) ?? { n: 0, r: 0, g: 0, b: 0 };
      at.n++; at.r += r; at.g += g; at.b += b;
      baldes.set(chave, at);
    }
  }

  const ordenados = [...baldes.values()].sort((a, b) => b.n - a.n);
  let acumulado = 0, baldesAte80 = 0;
  for (const b of ordenados) {
    acumulado += b.n / amostrados; baldesAte80++;
    if (acumulado >= 0.8) break;
  }
  const arteChapada = baldesAte80 <= LIMIAR.baldesArteChapada;

  const paleta = ordenados.slice(0, 6).map((b) => {
    const r = b.r / b.n, g = b.g / b.n, az = b.b / b.n;
    const lab = paraLab(r, g, az);
    const croma = Math.hypot(lab[1], lab[2]);
    let melhor = { nome: "-", delta: Infinity, tolerancia: 5 };
    for (const of of oficiaisLab) {
      const d = deltaE2000(lab, of.lab);
      if (d < melhor.delta) melhor = { nome: of.nome, delta: d, tolerancia: of.tolerancia };
    }
    const dentro = arteChapada
      ? melhor.delta <= melhor.tolerancia
      : melhor.delta <= LIMIAR.deltaEFoto || croma < LIMIAR.cromaAlheia;
    return {
      hex: paraHex(r, g, az), fatia: Number((b.n / amostrados).toFixed(3)),
      cor_oficial_mais_proxima: melhor.nome, delta_e: Number(melhor.delta.toFixed(1)),
      dentro_da_paleta: dentro,
    };
  }).filter((c) => c.fatia >= LIMIAR.fatiaMinima);

  // nitidez
  const largRed = Math.min(largura, 360);
  const escala = largura / largRed;
  const altRed = Math.max(3, Math.floor(altura / escala));
  const cinza = new Float32Array(largRed * altRed);
  for (let y = 0; y < altRed; y++) {
    for (let x = 0; x < largRed; x++) {
      const o = ((Math.floor(y * escala) * largura) + Math.floor(x * escala)) * 4;
      cinza[y * largRed + x] = 0.2126 * dados[o] + 0.7152 * dados[o + 1] + 0.0722 * dados[o + 2];
    }
  }
  let soma = 0, soma2 = 0, n = 0;
  for (let y = 1; y < altRed - 1; y++) {
    for (let x = 1; x < largRed - 1; x++) {
      const i = y * largRed + x;
      const lap = -4 * cinza[i] + cinza[i - 1] + cinza[i + 1] + cinza[i - largRed] + cinza[i + largRed];
      soma += lap; soma2 += lap * lap; n++;
    }
  }

  return {
    largura, altura,
    tipo_de_peca: arteChapada ? "arte chapada" : "fotografia",
    luminancia_media: Math.round(somaLuma / amostrados),
    fracao_estourada: Number((estourados / amostrados).toFixed(3)),
    nitidez_laplaciano: Math.round(n ? soma2 / n - Math.pow(soma / n, 2) : 0),
    paleta,
    fatia_fora_da_paleta: Number(
      paleta.filter((c) => !c.dentro_da_paleta).reduce((s, c) => s + c.fatia, 0).toFixed(3),
    ),
  };
}

// ---------------------------------------------------------------- pontuacao
// Identica a da analise de imagem, de proposito: o mesmo achado tem que custar
// a mesma coisa, seja ele encontrado numa foto ou num quadro de video.
function pontuar(
  achados: { codigo_regra: string; severidade: string; medido: boolean; timestamp_ms?: number | null }[],
  regras: Map<string, { categoria: string; peso: number | null; severidade: string }>,
  cfg: {
    nota_base: number; penalidade_bloqueante: number; penalidade_obrigatoria: number;
    penalidade_sugestao: number; teto_penalidade_dimensao: number;
    teto_nota_com_bloqueante: number; peso_identidade: number; peso_tecnica: number;
    peso_texto: number; peso_estrategia: number;
  },
  categoriasAvaliadas: Set<string>,
  quadros: number,
) {
  const fator: Record<string, number> = {
    bloqueante: cfg.penalidade_bloqueante,
    obrigatoria: cfg.penalidade_obrigatoria,
    sugestao: cfg.penalidade_sugestao,
  };
  const pesoFormula: Record<string, number> = {
    identidade: Number(cfg.peso_identidade), tecnica: Number(cfg.peso_tecnica),
    texto: Number(cfg.peso_texto), estrategia: Number(cfg.peso_estrategia),
  };

  const detalhe: Record<string, unknown>[] = [];
  const acumulado: Record<string, number> = {
    identidade: 0, tecnica: 0, texto: 0, estrategia: 0,
  };

  for (const a of achados) {
    const regra = regras.get(a.codigo_regra);
    if (!regra) continue;
    const dimensao = DIMENSAO[regra.categoria] ?? "identidade";
    const peso = Number(regra.peso ?? 1);
    const base = fator[a.severidade] ?? fator.obrigatoria;
    const penalidade = Math.round(base * peso);
    acumulado[dimensao] += penalidade;
    detalhe.push({
      regra: a.codigo_regra, dimensao, severidade: a.severidade,
      severidade_definida_por: "curadoria da regra",
      peso_da_regra: peso, penalidade_base: base, penalidade_aplicada: penalidade,
      origem: a.medido ? "medicao" : "leitura do modelo",
      instante: a.timestamp_ms != null ? relogio(Number(a.timestamp_ms)) : null,
    });
  }

  const dimensoesVivas = new Set<string>();
  for (const categoria of categoriasAvaliadas) {
    dimensoesVivas.add(DIMENSAO[categoria] ?? "identidade");
  }

  const notas: Record<string, number | null> = {};
  for (const d of ["identidade", "tecnica", "texto", "estrategia"]) {
    if (!dimensoesVivas.has(d)) { notas[d] = null; continue; }
    const desconto = Math.min(acumulado[d], cfg.teto_penalidade_dimensao);
    notas[d] = Math.max(0, cfg.nota_base - desconto);
  }

  let somaPesos = 0, somaNotas = 0;
  for (const d of Object.keys(notas)) {
    if (notas[d] === null) continue;
    somaPesos += pesoFormula[d];
    somaNotas += notas[d]! * pesoFormula[d];
  }
  let geral = somaPesos > 0 ? Math.round(somaNotas / somaPesos) : cfg.nota_base;

  const temBloqueante = achados.some((a) => a.severidade === "bloqueante");
  const tetoAplicado = temBloqueante && geral > cfg.teto_nota_com_bloqueante;
  if (tetoAplicado) geral = cfg.teto_nota_com_bloqueante;

  return {
    notas, geral,
    memoria: {
      nota_base: cfg.nota_base,
      penalidade_por_severidade: fator,
      pesos_da_formula: pesoFormula,
      teto_penalidade_por_dimensao: cfg.teto_penalidade_dimensao,
      dimensoes_avaliadas: [...dimensoesVivas],
      quadros_analisados: quadros,
      penalizacoes: detalhe,
      penalizacao_por_dimensao: acumulado,
      notas_por_dimensao: notas,
      teto_por_bloqueante: temBloqueante ? cfg.teto_nota_com_bloqueante : null,
      teto_aplicado: tetoAplicado,
      nota_geral: geral,
      formula: "nota_dimensao = base - min(soma das penalizacoes, teto); " +
               "nota_geral = media ponderada das dimensoes avaliadas; " +
               "achado bloqueante limita a nota geral ao teto configurado",
    },
  };
}

// ---------------------------------------------------------------- rota
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CABECALHOS });
  if (req.method !== "POST") return responder({ erro: "metodo_invalido" }, 405);

  const autorizacao = req.headers.get("Authorization") ?? "";
  if (!autorizacao) return responder({ erro: "sem_credencial" }, 401);

  let material_id: string;
  let quadros: { path: string; timestamp_ms: number }[];
  let duracao_ms = 0;
  try {
    const corpo = await req.json();
    material_id = corpo.material_id;
    quadros = (corpo.quadros ?? []).slice(0, TETO_QUADROS);
    duracao_ms = Number(corpo.duracao_ms) || 0;
    if (!material_id || !quadros.length) throw new Error();
  } catch {
    return responder({ erro: "material_id_ou_quadros_ausentes" }, 400);
  }

  const servidor = createClient(URL_SB, CHAVE_SERVICO, { db: { schema: "mkt" } });

  // Chamada vinda da fila usa credencial de servidor: a autorizacao ja foi
  // conferida no enfileiramento, onde a RLS respondeu quem podia mandar
  // analisar este material. Chamada da tela continua sujeita a RLS.
  const chamadaInterna = autorizacao === `Bearer ${CHAVE_SERVICO}`;
  const leitor = chamadaInterna ? servidor : createClient(URL_SB, CHAVE_ANON, {
    db: { schema: "mkt" },
    global: { headers: { Authorization: autorizacao } },
  });

  const { data: material, error: erroMaterial } = await leitor
    .from("materiais")
    .select("id, org_id, unidade_id, marca_id, titulo, formato, objetivo")
    .eq("id", material_id).single();
  if (erroMaterial || !material) return responder({ erro: "material_nao_encontrado" }, 404);

  const inicio = Date.now();
  let versaoId: string | null = null;

  await servidor.from("materiais").update({ status: "processando" }).eq("id", material_id);

  try {
    const { data: versao } = await servidor.from("material_versoes")
      .select("id").eq("material_id", material_id)
      .order("versao", { ascending: false }).limit(1).maybeSingle();
    if (!versao) throw new Error("material sem versao");
    versaoId = versao.id;

    // ------------------------------------------- versao vigente dos manuais
    const { data: manuaisDaMarca } = await servidor.from("manuais")
      .select("id").eq("marca_id", material.marca_id);
    const idsManuais = (manuaisDaMarca ?? []).map((m) => m.id);

    const { data: vigentes } = idsManuais.length
      ? await servidor.from("manual_versoes")
          .select("id, manual_id, versao").in("manual_id", idsManuais).eq("ativa", true)
      : { data: [] as { id: string; manual_id: string; versao: number }[] };

    const idsVigentes = (vigentes ?? []).map((v) => v.id);

    let consultaRegras = servidor.from("regras_marca")
      .select("id, codigo, categoria, titulo, descricao, como_corrigir, severidade, bloqueia_aprovacao, peso, manual_versao_id")
      .eq("marca_id", material.marca_id).eq("status", "ativa");

    consultaRegras = idsVigentes.length
      ? consultaRegras.or(`manual_versao_id.is.null,manual_versao_id.in.(${idsVigentes.join(",")})`)
      : consultaRegras.is("manual_versao_id", null);

    const [{ data: regras }, { data: cores }, { data: exemplos }, { data: cfgLida }] =
      await Promise.all([
        consultaRegras,
        servidor.from("marca_cores").select("nome, hex, tolerancia_delta_e").eq("marca_id", material.marca_id),
        servidor.from("exemplos_referencia").select("explicacao")
          .eq("marca_id", material.marca_id).eq("aprovado", true).limit(3),
        servidor.from("pontuacao_config").select("*").eq("org_id", material.org_id).maybeSingle(),
      ]);

    const cfg = cfgLida ?? {
      nota_base: 100, penalidade_bloqueante: 40, penalidade_obrigatoria: 18,
      penalidade_sugestao: 6, teto_penalidade_dimensao: 100, teto_nota_com_bloqueante: 40,
      peso_identidade: 0.35, peso_tecnica: 0.25, peso_texto: 0.20, peso_estrategia: 0.20,
    };

    const oficiaisLab = (cores ?? []).map((c) => ({
      nome: c.nome,
      lab: paraLab(...(doHex(c.hex) as [number, number, number])),
      tolerancia: c.tolerancia_delta_e ?? 5,
    }));

    // Baixa e mede cada quadro.
    const conteudo: unknown[] = [];
    const medidosPorQuadro: { timestamp_ms: number; medicao: ReturnType<typeof medirQuadro> | null }[] = [];

    for (const q of quadros.sort((a, b) => a.timestamp_ms - b.timestamp_ms)) {
      const { data: blob } = await servidor.storage.from("mkt-materiais").download(q.path);
      if (!blob) continue;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));

      let medicao: ReturnType<typeof medirQuadro> | null = null;
      try { medicao = medirQuadro(bytes, oficiaisLab); } catch (e) {
        console.error("quadro sem medicao:", e instanceof Error ? e.message : e);
      }
      medidosPorQuadro.push({ timestamp_ms: q.timestamp_ms, medicao });

      conteudo.push({ type: "text", text: `Quadro em ${relogio(q.timestamp_ms)} (${q.timestamp_ms} ms):` });
      conteudo.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: btoa(bin) },
      });
    }

    if (!conteudo.length) throw new Error("nenhum quadro pode ser lido");

    // Achados medidos, ja com o instante de origem.
    const achadosMedidos: { codigo_regra: string; criterio: string; descricao: string; timestamp_ms: number }[] = [];
    for (const { timestamp_ms, medicao } of medidosPorQuadro) {
      if (!medicao) continue;
      if (medicao.fatia_fora_da_paleta >= LIMIAR.fatiaForaTolerada) {
        const fora = medicao.paleta.filter((c) => !c.dentro_da_paleta)
          .map((c) => `${c.hex} (${Math.round(c.fatia * 100)}%, distancia ${c.delta_e} da ${c.cor_oficial_mais_proxima})`).join("; ");
        achadosMedidos.push({
          codigo_regra: "COR-01", criterio: "cor", timestamp_ms,
          descricao: `${relogio(timestamp_ms)} - medicao: ${Math.round(medicao.fatia_fora_da_paleta * 100)}% do quadro fora da paleta. Cores: ${fora}.`,
        });
      }
      if (medicao.luminancia_media < LIMIAR.lumaEscura) {
        achadosMedidos.push({
          codigo_regra: "TEC-03", criterio: "tecnica", timestamp_ms,
          descricao: `${relogio(timestamp_ms)} - medicao: quadro escuro demais (luminancia ${medicao.luminancia_media}).`,
        });
      } else if (medicao.luminancia_media > LIMIAR.lumaEstourada) {
        achadosMedidos.push({
          codigo_regra: "TEC-03", criterio: "tecnica", timestamp_ms,
          descricao: `${relogio(timestamp_ms)} - medicao: quadro claro demais (luminancia ${medicao.luminancia_media}).`,
        });
      }
      if (medicao.tipo_de_peca === "fotografia" && medicao.nitidez_laplaciano < LIMIAR.nitidezMinima) {
        achadosMedidos.push({
          codigo_regra: "TEC-01", criterio: "tecnica", timestamp_ms,
          descricao: `${relogio(timestamp_ms)} - medicao: quadro pouco nitido (indice ${medicao.nitidez_laplaciano}).`,
        });
      }
    }

    const listaRegras = (regras ?? [])
      .map((r) => `${r.codigo} [${r.severidade}] ${r.titulo}: ${r.descricao}`).join("\n");
    const referencia = (exemplos ?? []).map((e) => "- " + e.explicacao).join("\n");
    const resumoMedicao = medidosPorQuadro.filter((q) => q.medicao).map((q) =>
      `${relogio(q.timestamp_ms)}: luminancia ${q.medicao!.luminancia_media}, nitidez ${q.medicao!.nitidez_laplaciano}, ${Math.round(q.medicao!.fatia_fora_da_paleta * 100)}% fora da paleta`).join("\n");

    const { data: chave } = await servidor.rpc("chave_ia");
    if (!chave) throw new Error("chave da IA indisponivel");

    conteudo.push({
      type: "text",
      text: [
        `Acima estao ${medidosPorQuadro.length} quadros de um video da Jolo Gelato, em ordem de tempo. Duracao total: ${relogio(duracao_ms)}.`,
        "Confira o video contra as regras do manual. Julgue SOMENTE pelas regras listadas.",
        "REGRA DE OURO: duvida nao e reprovacao. Nao aponte o que nao enxerga com clareza.",
        "Todo achado precisa dizer em qual instante ele acontece, em milissegundos, usando os instantes dos quadros.",
        "Este sistema NAO analisa audio: nao comente trilha, narracao nem musica.",
        "NAO atribua nota e NAO classifique gravidade: a nota e calculada pelo sistema e a severidade ja vem da regra.",
        "",
        "REGRAS ATIVAS (versao vigente do manual):", listaRegras,
        "",
        referencia ? "PADRAO DE REFERENCIA:\n" + referencia : "",
        "",
        "MEDICAO JA FEITA (use como fato):", resumoMedicao,
        achadosMedidos.length
          ? "Ja registrados por medicao: " + [...new Set(achadosMedidos.map((a) => a.codigo_regra))].join(", ") + ". NAO repita."
          : "A medicao nao encontrou problema de cor, exposicao ou nitidez. NAO crie achado sobre esses pontos.",
        "",
        `MATERIAL: ${material.titulo ?? "sem titulo"} | formato: ${material.formato ?? "-"} | objetivo: ${material.objetivo ?? "-"}`,
        "",
        "Escreva tambem um roteiro de edicao curto, em linhas com marcacao de tempo, dizendo o que ajustar em cada trecho.",
        "Responda com um unico objeto JSON, de { a }, sem texto fora dele.",
        'Formato: {"confianca":0.0,"resumo":"ate duas frases","pontos_corretos":["ate 3 itens"],"roteiro":"00:02 ...\\n00:08 ...","legenda_sugerida":"legenda pronta","achados":[{"codigo_regra":"COR-01","criterio":"cor","certeza":0.9,"timestamp_ms":8000,"descricao":"uma frase","como_corrigir":"uma frase"}]}',
        "No maximo 6 achados. Lista vazia se estiver tudo certo.",
      ].join("\n"),
    });

    const respostaIA = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": chave,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELO, max_tokens: TETO_SAIDA,
        system: "Responda sempre com um unico objeto JSON valido e nada mais.",
        messages: [{ role: "user", content: conteudo }],
      }),
    });

    if (!respostaIA.ok) {
      throw new Error(`IA respondeu ${respostaIA.status}: ${(await respostaIA.text()).slice(0, 200)}`);
    }

    const dados = await respostaIA.json();
    const texto = (dados.content ?? []).filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text).join("\n");
    const laudo = extrairJson(texto);
    if (!laudo) throw new Error("a IA nao devolveu JSON");

    const porCodigo = new Map((regras ?? []).map((r) => [r.codigo, r]));
    let descartados = 0;

    const doModelo = (Array.isArray(laudo.achados) ? laudo.achados : [])
      .filter((a: Record<string, unknown>) => porCodigo.has(String(a.codigo_regra)))
      .filter((a: Record<string, unknown>) => {
        const certeza = Number(a.certeza);
        const duvida = DUVIDOSO.test(String(a.descricao ?? "")) ||
          (Number.isFinite(certeza) && certeza < CERTEZA_MINIMA);
        if (duvida) descartados++;
        return !duvida;
      })
      .map((a: Record<string, unknown>) => ({ ...a, medido: false }));

    const codigosMedidos = new Set(achadosMedidos.map((a) => a.codigo_regra));
    const inocentadas = new Set<string>();
    for (const c of ["COR-01", "TEC-01", "TEC-03"]) if (!codigosMedidos.has(c)) inocentadas.add(c);

    const medidos = achadosMedidos.filter((a) => porCodigo.has(a.codigo_regra))
      .map((a) => ({ ...a, medido: true }));

    // A severidade e atributo da REGRA, vinda da curadoria humana, e nao
    // classificacao do modelo.
    const validos = [
      ...medidos,
      ...doModelo.filter((a: { codigo_regra: string }) =>
        !codigosMedidos.has(a.codigo_regra) && !inocentadas.has(a.codigo_regra)),
    ].map((a: Record<string, unknown>) => {
      const regra = porCodigo.get(String(a.codigo_regra))!;
      return {
        ...a,
        severidade: regra.severidade,
        como_corrigir: a.como_corrigir ?? regra.como_corrigir,
      };
    });

    // ------------------------------------------------------ pontuacao
    const mapaRegras = new Map((regras ?? []).map((r) =>
      [r.codigo, { categoria: r.categoria, peso: r.peso, severidade: r.severidade }]));
    const categoriasAtivas = new Set((regras ?? []).map((r) => r.categoria));
    const p = pontuar(
      validos.map((a) => ({
        codigo_regra: String(a.codigo_regra),
        severidade: String(a.severidade),
        medido: a.medido === true,
        timestamp_ms: Number.isFinite(Number(a.timestamp_ms)) ? Number(a.timestamp_ms) : null,
      })),
      mapaRegras, cfg, categoriasAtivas, medidosPorQuadro.length,
    );

    const temBloqueio = validos.some((a) => porCodigo.get(String(a.codigo_regra))!.bloqueia_aprovacao);
    const temObrigatoria = validos.some((a) => a.severidade === "obrigatoria");
    const status = temBloqueio ? "reprovado"
      : temObrigatoria ? "correcao_necessaria"
      : validos.length ? "aprovado_com_observacoes" : "aprovado_automatico";

    const { data: analise, error: erroAnalise } = await servidor.from("analises").insert({
      org_id: material.org_id, unidade_id: material.unidade_id,
      material_id, material_versao_id: versao.id,
      manual_versao_id: idsVigentes.length === 1 ? idsVigentes[0] : null,
      nota_geral: p.geral,
      nota_identidade: p.notas.identidade,
      nota_tecnica: p.notas.tecnica,
      nota_estrategia: p.notas.estrategia,
      nota_texto: p.notas.texto,
      pontuacao: p.memoria,
      confianca: Number.isFinite(Number(laudo.confianca)) ? Number(laudo.confianca) : null,
      resumo: laudo.resumo ?? null,
      pontos_corretos: Array.isArray(laudo.pontos_corretos) ? laudo.pontos_corretos : [],
      roteiro: laudo.roteiro ?? null,
      quadros_analisados: medidosPorQuadro.length,
      medicoes: { por_quadro: medidosPorQuadro, duracao_ms },
      status_sugerido: status,
      modelo: MODELO, prompt_versao: VERSAO_PROMPT,
      tokens_entrada: dados.usage?.input_tokens ?? null,
      tokens_saida: dados.usage?.output_tokens ?? null,
      latencia_ms: Date.now() - inicio,
    }).select("id").single();

    if (erroAnalise || !analise) throw new Error("nao foi possivel gravar a analise");

    if (validos.length) {
      await servidor.from("analise_itens").insert(validos.map((a) => ({
        org_id: material.org_id, unidade_id: material.unidade_id,
        analise_id: analise.id, regra_id: porCodigo.get(String(a.codigo_regra))!.id,
        criterio: a.criterio ?? porCodigo.get(String(a.codigo_regra))!.categoria,
        severidade: a.severidade,
        descricao: a.descricao ?? "-",
        como_corrigir: a.como_corrigir,
        timestamp_ms: Number.isFinite(Number(a.timestamp_ms)) ? Number(a.timestamp_ms) : null,
        confianca: Number.isFinite(Number(a.certeza)) ? Number(a.certeza) : null,
        medido: a.medido === true,
      })));
    }

    if (laudo.legenda_sugerida) {
      await servidor.from("legendas").insert({
        org_id: material.org_id, unidade_id: material.unidade_id, material_id,
        tipo: "sugerida", texto: String(laudo.legenda_sugerida).slice(0, 2000), modelo: MODELO,
      });
    }

    await servidor.from("ia_execucoes").insert({
      org_id: material.org_id, unidade_id: material.unidade_id,
      capacidade: "analise_video", provedor: "anthropic", modelo: MODELO,
      prompt_versao: VERSAO_PROMPT,
      tokens_entrada: dados.usage?.input_tokens ?? null,
      tokens_saida: dados.usage?.output_tokens ?? null,
      latencia_ms: Date.now() - inicio, sucesso: true,
    });

    await servidor.from("materiais").update({ status }).eq("id", material_id);

    return responder({
      ok: true, analise_id: analise.id, status,
      quadros: medidosPorQuadro.length, achados: validos.length,
      medidos: medidos.length, descartados_por_duvida: descartados,
      nota_geral: p.geral, notas: p.notas,
      chamada_interna: chamadaInterna,
      manual_versoes_vigentes: (vigentes ?? []).map((v) => ({ id: v.id, versao: v.versao })),
      regras_consideradas: (regras ?? []).length,
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "falha desconhecida";
    await servidor.from("materiais").update({ status: "precisa_informacao" }).eq("id", material_id);
    if (versaoId) {
      await servidor.from("analises").insert({
        org_id: material.org_id, unidade_id: material.unidade_id,
        material_id, material_versao_id: versaoId,
        modelo: MODELO, prompt_versao: VERSAO_PROMPT,
        erro: mensagem.slice(0, 400), latencia_ms: Date.now() - inicio,
      });
    }
    console.error("falha na analise de video:", mensagem);
    return responder({ erro: "falha_na_analise", detalhe: mensagem }, 500);
  }
});

// Analise de material — medicao + regras da versao vigente + pontuacao deterministica.
//
// Divisao de responsabilidade, e ela e o ponto central deste arquivo:
//   - a MEDICAO acha o que se calcula no pixel (cor, exposicao, nitidez, proporcao);
//   - o MODELO identifica achados que exigem leitura;
//   - a REGRA define a gravidade. O modelo nao classifica severidade;
//   - o SISTEMA calcula a nota. O modelo nao escolhe numero nenhum.
//
// A nota antes era escrita pelo modelo e variava entre execucoes do mesmo
// arquivo. Agora e conta: nota base menos penalizacao por achado, com peso da
// regra e fator de severidade, tudo gravado em analises.pontuacao para que
// qualquer auditor refaca na mao.
//
// Desde que cada versao de manual passou a ter seu proprio conjunto de regras,
// a analise usa SOMENTE as regras da versao vigente de cada manual, mais as
// regras avulsas. Regra de versao antiga nao julga material novo.

import { createClient } from "jsr:@supabase/supabase-js@2";
import jpeg from "npm:jpeg-js@0.4.4";
import { decode as decodePng } from "npm:fast-png@6.1.0";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const CHAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CHAVE_SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODELO = "claude-sonnet-5";
const VERSAO_PROMPT = "jolo-v8-severidade-da-regra";
const TETO_SAIDA = 4000;
const CERTEZA_MINIMA = 0.7;

const DUVIDOSO =
  /(n[a\u00e3]o (e|\u00e9) poss[i\u00ed]vel|n[a\u00e3]o foi poss[i\u00ed]vel|n[a\u00e3]o d[a\u00e1] para|n[a\u00e3]o consigo|n[a\u00e3]o h[a\u00e1] como|aparentemente|talvez|pode ser que|dif[i\u00ed]cil (afirmar|dizer)|incerto|sem certeza)/i;

const LIMIAR = {
  fatiaMinima: 0.05, fatiaForaTolerada: 0.15, deltaEFoto: 20, cromaAlheia: 30,
  baldesArteChapada: 8, lumaEscura: 45, lumaEstourada: 215, estouroTolerado: 0.20,
  nitidezMinima: 15, faixaQuadrado: [0.78, 1.02], faixaVertical: [0.54, 0.58],
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

// ---------------------------------------------------------------- cor
function paraLab(r: number, g: number, b: number) {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
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
  if (Cp1 * Cp2 !== 0) { dh = hp2 - hp1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad);
  const Lm = (L1 + L2) / 2, Cpm = (Cp1 + Cp2) / 2;
  let hpm = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) { if (Math.abs(hp1 - hp2) > 180) hpm += hpm < 360 ? 360 : -360; hpm /= 2; }
  const T = 1 - 0.17 * Math.cos((hpm - 30) * rad) + 0.24 * Math.cos(2 * hpm * rad) +
    0.32 * Math.cos((3 * hpm + 6) * rad) - 0.20 * Math.cos((4 * hpm - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((hpm - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(Cpm, 7) / (Math.pow(Cpm, 7) + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lm - 50, 2)) / Math.sqrt(20 + Math.pow(Lm - 50, 2));
  const Sc = 1 + 0.045 * Cpm, Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(Math.pow(dL / Sl, 2) + Math.pow(dC / Sc, 2) + Math.pow(dH / Sh, 2) +
    Rt * (dC / Sc) * (dH / Sh));
}

const paraHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const doHex = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// ---------------------------------------------------------------- medicao
function decodificar(bytes: Uint8Array, mime: string) {
  if (mime.includes("png")) {
    const img = decodePng(bytes);
    const canais = img.channels ?? 4;
    const dados = img.data as Uint8Array;
    const rgba = new Uint8Array(img.width * img.height * 4);
    for (let i = 0, p = 0; p < img.width * img.height; p++) {
      const o = p * canais;
      rgba[i++] = dados[o];
      rgba[i++] = dados[o + (canais > 2 ? 1 : 0)];
      rgba[i++] = dados[o + (canais > 2 ? 2 : 0)];
      rgba[i++] = 255;
    }
    return { largura: img.width, altura: img.height, dados: rgba };
  }
  const img = jpeg.decode(bytes, { useTArray: true });
  return { largura: img.width, altura: img.height, dados: img.data as Uint8Array };
}

function medir(
  imagem: { largura: number; altura: number; dados: Uint8Array },
  oficiais: { nome: string; hex: string; tolerancia_delta_e: number | null }[],
  formato: string | null,
) {
  const { largura, altura, dados } = imagem;
  const passo = Math.max(1, Math.floor(Math.sqrt((largura * altura) / 120000)));
  const baldes = new Map<number, { n: number; r: number; g: number; b: number }>();
  let somaLuma = 0, escuros = 0, estourados = 0, amostrados = 0;

  for (let y = 0; y < altura; y += passo) {
    for (let x = 0; x < largura; x += passo) {
      const o = (y * largura + x) * 4;
      const r = dados[o], g = dados[o + 1], b = dados[o + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      somaLuma += luma;
      if (luma < 10) escuros++;
      if (luma > 245) estourados++;
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

  const oficiaisLab = oficiais.map((c) => ({
    nome: c.nome, lab: paraLab(...(doHex(c.hex) as [number, number, number])),
    tolerancia: c.tolerancia_delta_e ?? 5,
  }));

  const paleta = ordenados.slice(0, 8).map((b) => {
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
      croma: Number(croma.toFixed(1)), cor_oficial_mais_proxima: melhor.nome,
      delta_e: Number(melhor.delta.toFixed(1)), dentro_da_paleta: dentro,
    };
  }).filter((c) => c.fatia >= LIMIAR.fatiaMinima);

  const largRed = Math.min(largura, 480);
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

  const proporcao = largura / altura;
  const faixa = ["story", "reels", "capa_video"].includes(formato ?? "") ? LIMIAR.faixaVertical
    : ["feed", "carrossel", "anuncio"].includes(formato ?? "") ? LIMIAR.faixaQuadrado : null;

  return {
    largura, altura, tipo_de_peca: arteChapada ? "arte chapada" : "fotografia",
    proporcao: Number(proporcao.toFixed(3)), faixa_esperada: faixa,
    fora_da_faixa: faixa ? proporcao < faixa[0] || proporcao > faixa[1] : false,
    luminancia_media: Math.round(somaLuma / amostrados),
    fracao_estourada: Number((estourados / amostrados).toFixed(3)),
    fracao_apagada: Number((escuros / amostrados).toFixed(3)),
    nitidez_laplaciano: Math.round(n ? soma2 / n - Math.pow(soma / n, 2) : 0),
    paleta,
    fatia_fora_da_paleta: Number(
      paleta.filter((c) => !c.dentro_da_paleta).reduce((s, c) => s + c.fatia, 0).toFixed(3)),
    metodo: "CIEDE2000 sobre paleta dominante; tolerancia estrita em arte chapada e de gradiente em fotografia; laplaciano para nitidez",
  };
}

function acharPorMedicao(m: ReturnType<typeof medir>) {
  const achados: { codigo_regra: string; criterio: string; descricao: string }[] = [];
  if (m.fatia_fora_da_paleta >= LIMIAR.fatiaForaTolerada) {
    const fora = m.paleta.filter((c) => !c.dentro_da_paleta)
      .map((c) => `${c.hex} (${Math.round(c.fatia * 100)}%, distancia ${c.delta_e} da ${c.cor_oficial_mais_proxima})`).join("; ");
    achados.push({ codigo_regra: "COR-01", criterio: "cor",
      descricao: `Medicao em ${m.tipo_de_peca}: ${Math.round(m.fatia_fora_da_paleta * 100)}% da imagem fora da paleta oficial. Cores: ${fora}.` });
  }
  if (m.luminancia_media < LIMIAR.lumaEscura) {
    achados.push({ codigo_regra: "TEC-03", criterio: "tecnica",
      descricao: `Medicao: imagem escura demais (luminancia media ${m.luminancia_media} de 255).` });
  } else if (m.luminancia_media > LIMIAR.lumaEstourada || m.fracao_estourada > LIMIAR.estouroTolerado) {
    achados.push({ codigo_regra: "TEC-03", criterio: "tecnica",
      descricao: `Medicao: imagem clara demais (luminancia media ${m.luminancia_media}, ${Math.round(m.fracao_estourada * 100)}% estourado).` });
  }
  if (m.tipo_de_peca === "fotografia" && m.nitidez_laplaciano < LIMIAR.nitidezMinima) {
    achados.push({ codigo_regra: "TEC-01", criterio: "tecnica",
      descricao: `Medicao: imagem pouco nitida (indice ${m.nitidez_laplaciano}, minimo ${LIMIAR.nitidezMinima}).` });
  }
  if (m.fora_da_faixa && m.faixa_esperada) {
    achados.push({ codigo_regra: "TEC-02", criterio: "tecnica",
      descricao: `Medicao: proporcao ${m.proporcao} (${m.largura}x${m.altura}) fora da faixa (${m.faixa_esperada[0]} a ${m.faixa_esperada[1]}).` });
  }
  return achados;
}

// ---------------------------------------------------------------- pontuacao
// Conta aberta: nota base por dimensao, menos a soma das penalizacoes dos
// achados daquela dimensao, com teto. A nota geral e a media ponderada das
// dimensoes que foram efetivamente avaliadas. Achado sempre reduz a nota;
// remover achado nunca reduz.
function pontuar(
  achados: { codigo_regra: string; severidade: string; medido: boolean }[],
  regras: Map<string, { categoria: string; peso: number | null; severidade: string }>,
  cfg: {
    nota_base: number; penalidade_bloqueante: number; penalidade_obrigatoria: number;
    penalidade_sugestao: number; teto_penalidade_dimensao: number;
    teto_nota_com_bloqueante: number; peso_identidade: number; peso_tecnica: number;
    peso_texto: number; peso_estrategia: number;
  },
  categoriasAvaliadas: Set<string>,
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
    });
  }

  // Dimensao so entra na media se houver regra ativa capaz de avalia-la.
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
  try {
    ({ material_id } = await req.json());
    if (!material_id) throw new Error();
  } catch { return responder({ erro: "material_id_ausente" }, 400); }

  const comoUsuario = createClient(URL_SB, CHAVE_ANON, {
    db: { schema: "mkt" },
    global: { headers: { Authorization: autorizacao } },
  });

  const { data: material, error: erroMaterial } = await comoUsuario
    .from("materiais")
    .select("id, org_id, unidade_id, marca_id, titulo, formato, objetivo, publico")
    .eq("id", material_id).single();
  if (erroMaterial || !material) return responder({ erro: "material_nao_encontrado" }, 404);

  const servidor = createClient(URL_SB, CHAVE_SERVICO, { db: { schema: "mkt" } });
  const inicio = Date.now();
  let versaoId: string | null = null;

  await servidor.from("materiais").update({ status: "processando" }).eq("id", material_id);

  try {
    const { data: versao } = await servidor.from("material_versoes")
      .select("id, versao").eq("material_id", material_id)
      .order("versao", { ascending: false }).limit(1).maybeSingle();
    if (!versao) throw new Error("material sem versao");
    versaoId = versao.id;

    const { data: arquivo } = await servidor.from("arquivos")
      .select("id, bucket, storage_path, mime")
      .eq("material_versao_id", versao.id).is("timestamp_ms", null).limit(1).maybeSingle();
    if (!arquivo) throw new Error("versao sem arquivo");

    const { data: blob, error: erroBaixa } = await servidor.storage
      .from(arquivo.bucket ?? "mkt-materiais").download(arquivo.storage_path);
    if (erroBaixa || !blob) throw new Error("nao foi possivel ler o arquivo");

    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const base64 = btoa(bin);

    // ------------------------------------------- versao vigente dos manuais
    // Cada versao de manual tem seu proprio conjunto de regras. A analise so
    // pode usar as regras da versao VIGENTE de cada manual, mais as regras
    // avulsas (cadastradas a mao, sem manual de origem). Sem este filtro, uma
    // regra reescrita por uma versao nova continuaria julgando pela redacao
    // velha, e o carimbo de versao na analise seria mentira.
    const { data: manuaisDaMarca } = await servidor.from("manuais")
      .select("id").eq("marca_id", material.marca_id);
    const idsManuais = (manuaisDaMarca ?? []).map((m) => m.id);

    const { data: vigentes } = idsManuais.length
      ? await servidor.from("manual_versoes")
          .select("id, manual_id, versao").in("manual_id", idsManuais).eq("ativa", true)
      : { data: [] as { id: string; manual_id: string; versao: number }[] };

    const idsVigentes = (vigentes ?? []).map((v) => v.id);

    let consultaRegras = servidor.from("regras_marca")
      .select("id, codigo, categoria, titulo, descricao, como_corrigir, severidade, bloqueia_aprovacao, peso, pagina, manual_versao_id")
      .eq("marca_id", material.marca_id).eq("status", "ativa");

    consultaRegras = idsVigentes.length
      ? consultaRegras.or(`manual_versao_id.is.null,manual_versao_id.in.(${idsVigentes.join(",")})`)
      : consultaRegras.is("manual_versao_id", null);

    const [{ data: regras }, { data: cores }, { data: exemplos }, { data: cfgLida }] =
      await Promise.all([
        consultaRegras,
        servidor.from("marca_cores").select("nome, hex, tolerancia_delta_e").eq("marca_id", material.marca_id),
        servidor.from("exemplos_referencia").select("explicacao")
          .eq("marca_id", material.marca_id).eq("aprovado", true).limit(5),
        servidor.from("pontuacao_config").select("*").eq("org_id", material.org_id).maybeSingle(),
      ]);

    const cfg = cfgLida ?? {
      nota_base: 100, penalidade_bloqueante: 40, penalidade_obrigatoria: 18,
      penalidade_sugestao: 6, teto_penalidade_dimensao: 100, teto_nota_com_bloqueante: 40,
      peso_identidade: 0.35, peso_tecnica: 0.25, peso_texto: 0.20, peso_estrategia: 0.20,
    };

    let medicoes: ReturnType<typeof medir> | null = null;
    let achadosMedidos: { codigo_regra: string; criterio: string; descricao: string }[] = [];
    try {
      const imagem = decodificar(bytes, arquivo.mime ?? "image/jpeg");
      medicoes = medir(imagem, cores ?? [], material.formato);
      achadosMedidos = acharPorMedicao(medicoes);
      await servidor.from("arquivos")
        .update({ largura: imagem.largura, altura: imagem.altura }).eq("id", arquivo.id);
    } catch (e) {
      console.error("medicao indisponivel:", e instanceof Error ? e.message : e);
    }

    const listaRegras = (regras ?? [])
      .map((r) => `${r.codigo} [${r.severidade}] ${r.titulo}: ${r.descricao}`).join("\n");
    const referencia = (exemplos ?? []).map((e) => "- " + e.explicacao).join("\n");

    const blocoMedicao = medicoes ? [
      "MEDICAO JA FEITA NO PIXEL (use como fato, nao recalcule):",
      `Tipo de peca: ${medicoes.tipo_de_peca}. ${medicoes.largura}x${medicoes.altura}, proporcao ${medicoes.proporcao}.`,
      `Luminancia media ${medicoes.luminancia_media}/255, ${Math.round(medicoes.fracao_estourada * 100)}% estourado, nitidez ${medicoes.nitidez_laplaciano}.`,
      "Paleta: " + medicoes.paleta.map((c) =>
        `${c.hex} ${Math.round(c.fatia * 100)}% ${c.dentro_da_paleta ? "dentro" : "FORA"} (${c.cor_oficial_mais_proxima}, distancia ${c.delta_e})`).join("; "),
      achadosMedidos.length
        ? "Ja registrados por medicao: " + achadosMedidos.map((a) => a.codigo_regra).join(", ") + ". NAO repita."
        : "A medicao nao encontrou problema de cor, exposicao, nitidez ou proporcao. NAO crie achado sobre esses pontos.",
    ].join("\n") : "MEDICAO: nao foi possivel medir esta imagem.";

    const { data: chave } = await servidor.rpc("chave_ia");
    if (!chave) throw new Error("chave da IA indisponivel");

    // O modelo NAO recebe pedido de nota nem de severidade: quem pontua e o
    // sistema, e quem define gravidade e a curadoria humana da regra.
    const instrucao = [
      "Voce confere pecas de marketing da Jolo Gelato contra o manual da marca.",
      "Julgue SOMENTE pelas regras listadas. Nao invente regra nem cite regra fora da lista.",
      "REGRA DE OURO: duvida nao e reprovacao. Se nao enxerga o problema com clareza, nao crie achado.",
      "Cada achado leva um campo certeza de 0 a 1. Abaixo de 0.7 o achado e descartado.",
      "NAO atribua nota e NAO classifique gravidade: a severidade ja vem da regra.",
      "",
      "REGRAS ATIVAS (versao vigente do manual):", listaRegras, "",
      referencia ? "PADRAO DE REFERENCIA DA MARCA:\n" + referencia : "", "",
      blocoMedicao, "",
      `MATERIAL: ${material.titulo ?? "sem titulo"} | formato: ${material.formato ?? "-"} | objetivo: ${material.objetivo ?? "-"}`,
      "",
      "Escreva tambem uma legenda curta no tom da marca (calma, sensorial, sem emoji, sem preco).",
      "Responda com um unico objeto JSON, de { a }, sem texto fora dele.",
      'Formato: {"confianca":0.0,"resumo":"ate duas frases","pontos_corretos":["ate 3 itens"],"legenda_sugerida":"legenda","achados":[{"codigo_regra":"COR-01","criterio":"cor","certeza":0.9,"descricao":"uma frase","como_corrigir":"uma frase"}]}',
      "No maximo 6 achados.",
    ].join("\n");

    const respostaIA = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json", "x-api-key": chave,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELO, max_tokens: TETO_SAIDA,
        system: "Responda sempre com um unico objeto JSON valido e nada mais.",
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: arquivo.mime ?? "image/jpeg", data: base64 } },
          { type: "text", text: instrucao },
        ] }],
      }),
    });

    if (!respostaIA.ok) {
      throw new Error(`IA respondeu ${respostaIA.status}: ${(await respostaIA.text()).slice(0, 200)}`);
    }

    const dados = await respostaIA.json();
    const texto = (dados.content ?? []).filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text).join("\n");
    const laudo = extrairJson(texto);
    if (!laudo) {
      const motivo = dados.stop_reason === "max_tokens" ? "resposta truncada" : "formato inesperado";
      throw new Error(`a IA nao devolveu JSON (${motivo})`);
    }

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
      .map((a: Record<string, string>) => ({ ...a, medido: false }));

    const codigosMedidos = new Set(achadosMedidos.map((a) => a.codigo_regra));
    const inocentadas = new Set<string>();
    if (medicoes) {
      for (const c of ["COR-01", "TEC-01", "TEC-02", "TEC-03"]) {
        if (!codigosMedidos.has(c)) inocentadas.add(c);
      }
    }

    const medidos = achadosMedidos.filter((a) => porCodigo.has(a.codigo_regra))
      .map((a) => ({ ...a, medido: true }));

    // A severidade e atributo da REGRA, vinda da curadoria humana, e nao
    // classificacao do modelo. Sem isto, o modelo podia escalar a gravidade de
    // uma regra que a franqueadora tinha rebaixado numa versao nova do manual:
    // a decisao humana virava sugestao e o teto de bloqueante voltava sozinho.
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
      })),
      mapaRegras, cfg, categoriasAtivas,
    );

    const temBloqueio = validos.some((a) => porCodigo.get(String(a.codigo_regra))!.bloqueia_aprovacao);
    const temObrigatoria = validos.some((a) => a.severidade === "obrigatoria");
    const status = temBloqueio ? "reprovado"
      : temObrigatoria ? "correcao_necessaria"
      : validos.length ? "aprovado_com_observacoes" : "aprovado_automatico";

    const { data: analise, error: erroAnalise } = await servidor.from("analises").insert({
      org_id: material.org_id, unidade_id: material.unidade_id,
      material_id, material_versao_id: versao.id,
      // Carimbo explicito quando ha uma unica versao vigente. Com mais de um
      // manual publicado, o gatilho do banco resolve pela mais recente.
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
      medicoes, status_sugerido: status, modelo: MODELO, prompt_versao: VERSAO_PROMPT,
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
      capacidade: "analise_imagem", provedor: "anthropic", modelo: MODELO,
      prompt_versao: VERSAO_PROMPT,
      tokens_entrada: dados.usage?.input_tokens ?? null,
      tokens_saida: dados.usage?.output_tokens ?? null,
      latencia_ms: Date.now() - inicio, sucesso: true,
    });

    await servidor.from("materiais").update({ status }).eq("id", material_id);

    return responder({
      ok: true, analise_id: analise.id, status,
      achados: validos.length, medidos: medidos.length,
      descartados_por_duvida: descartados,
      nota_geral: p.geral, notas: p.notas,
      tipo: medicoes?.tipo_de_peca ?? "nao medido",
      manual_versoes_vigentes: (vigentes ?? []).map((v) => ({ id: v.id, versao: v.versao })),
      regras_consideradas: (regras ?? []).length,
      regras_avulsas: (regras ?? []).filter((r) => !r.manual_versao_id).length,
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "falha desconhecida";
    await servidor.from("materiais").update({ status: "precisa_informacao" }).eq("id", material_id);
    if (versaoId) {
      await servidor.from("analises").insert({
        org_id: material.org_id, unidade_id: material.unidade_id,
        material_id, material_versao_id: versaoId, modelo: MODELO,
        prompt_versao: VERSAO_PROMPT, erro: mensagem.slice(0, 400),
        latencia_ms: Date.now() - inicio,
      });
    }
    console.error("falha na analise:", mensagem);
    return responder({ erro: "falha_na_analise", detalhe: mensagem }, 500);
  }
});

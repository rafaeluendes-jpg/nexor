// Correcao automatica de imagem — item 2 da auditoria. Versao 4.
//
// Principio: o sistema so corrige o que ele mede e sabe justificar, e registra
// tudo o que mexeu. O original NUNCA e sobrescrito - a correcao entra como uma
// versao nova do material, marcada como 'corrigido', e a decisao de usar ou nao
// continua humana.
//
// O QUE MUDOU NA VERSAO 4 (dois defeitos medidos na versao 3):
//
// 1) CONTRASTE. A versao 3 esticava com (v - p1) * ganho. Esse mapa joga o
//    percentil 1 para zero e, com ganho acima de 1, empurra tudo abaixo dele
//    para preto puro: no material 500cf09b a fracao apagada foi de 0 para
//    0,103. Agora o esticamento e em torno do ponto medio,
//    (v - 128) * ganho + 128, que abre sombras e altas luzes de forma
//    simetrica em vez de comer so as sombras. E o ganho deixou de ser fixo no
//    teto: ele e escolhido por simulacao sobre o histograma ja medido e
//    reduzido de 0,05 em 0,05 ate o corte previsto ficar abaixo de 2%. Se
//    nenhum ganho util respeitar esse limite, o contraste e RECUSADO com
//    motivo, em vez de aplicado com dano.
//
// 2) EXPOSICAO. O limiar de imagem escura era 45, baixo demais para peca de
//    marca em creme e verde, que vive em tom medio-claro: peca legitimamente
//    subexposta passava batida. Subiu para 70.
//
// Ordem dos ajustes, e ela importa: exposicao, contraste, saturacao,
// temperatura e por fim enquadramento. Corrigir cor antes da exposicao daria
// resultado errado, porque a medicao de cor muda quando a luz muda.
//
// Todos os ajustes sao GLOBAIS de tom e cor. Nenhum age sobre regiao, entao
// produto, embalagem, logotipo e texto nao sao redesenhados, recortados por
// dentro nem deformados. O unico ajuste geometrico e recorte centralizado -
// nunca esticamento, que deformaria o produto e o logotipo.
//
// NITIDEZ continua recusada de proposito: foto tremida nao tem conserto
// honesto, e forcar contorno cria aparencia de nitidez que nao existe.

import { createClient } from "jsr:@supabase/supabase-js@2";
import jpeg from "npm:jpeg-js@0.4.4";
import { decode as decodePng } from "npm:fast-png@6.1.0";

const VERSAO_ALGORITMO = 4;

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const CHAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CHAVE_SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALVO_LUMA = 138;
const LUMA_ESCURA = 70;          // era 45 na v3 - baixo demais para creme e verde
const LUMA_ESTOURADA = 215;
const ESTOURO_TOLERADO = 0.20;

const GAMA_MIN = 0.22;
const GAMA_MAX = 3.0;
const LUMA_IRRECUPERAVEL_BAIXA = 8;
const LUMA_IRRECUPERAVEL_ALTA = 250;

// Tetos conservadores. Ajuste forte demais vira maquiagem e descaracteriza a
// peca; o objetivo e devolver a peca ao aceitavel, nao "melhorar" a foto.
const CONTRASTE_FAIXA_MINIMA = 140;   // abaixo disso a peca esta chapada
const CONTRASTE_FAIXA_ALVO = 150;     // alvo do esticamento: so sair do chapado
const CONTRASTE_GANHO_MAX = 1.8;
const CONTRASTE_GANHO_MIN = 1.05;     // abaixo disso o ganho nao muda nada util
const CONTRASTE_PIVO = 128;           // ponto medio: eixo do esticamento
const CONTRASTE_PASSO = 0.05;         // reducao do ganho a cada tentativa
const CORTE_TOLERADO = 0.02;          // teto de 2% apagado e 2% estourado
const LIMIAR_APAGADO = 10;            // mesma regra usada em medir()
const LIMIAR_ESTOURADO = 245;

const SATURACAO_MINIMA = 18;          // croma medio aceitavel
const SATURACAO_MAXIMA = 90;
const SATURACAO_FATOR_MAX = 1.45;
const SATURACAO_FATOR_MIN = 0.75;
const TEMPERATURA_DESVIO_TOLERADO = 12;  // diferenca media entre R e B
const TEMPERATURA_GANHO_MAX = 0.14;
const NITIDEZ_MINIMA = 15;

const FAIXA_QUADRADO: [number, number] = [0.78, 1.02];
const FAIXA_VERTICAL: [number, number] = [0.54, 0.58];
const QUALIDADE_JPEG = 92;

const CABECALHOS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Content-Type": "application/json; charset=utf-8",
};
const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: CABECALHOS });

const paraLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const paraSrgb = (v: number) => {
  const x = Math.min(1, Math.max(0, v));
  return (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055) * 255;
};
const limitar = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
const pct = (v: number, casas = 1) => `${(v * 100).toFixed(casas)}%`;

type Imagem = { largura: number; altura: number; dados: Uint8Array };

function decodificar(bytes: Uint8Array, mime: string): Imagem {
  if ((mime ?? "").includes("png")) {
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

// Medicao completa: e ela que decide o que sera corrigido e comprova o efeito.
// Devolve tambem o histograma e o numero de amostras, porque o contraste
// precisa simular o efeito da curva ANTES de aplicar. Esses dois campos sao
// removidos por semHistograma() antes de qualquer gravacao ou resposta.
function medir(im: Imagem) {
  const { largura, altura, dados } = im;
  const passo = Math.max(1, Math.floor(Math.sqrt((largura * altura) / 120000)));
  const histograma = new Uint32Array(256);
  let soma = 0, estourados = 0, apagados = 0, n = 0;
  let somaR = 0, somaG = 0, somaB = 0, somaCroma = 0;

  for (let y = 0; y < altura; y += passo) {
    for (let x = 0; x < largura; x += passo) {
      const o = (y * largura + x) * 4;
      const r = dados[o], g = dados[o + 1], b = dados[o + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      soma += l;
      histograma[limitar(l)]++;
      if (l > LIMIAR_ESTOURADO) estourados++;
      if (l < LIMIAR_APAGADO) apagados++;
      somaR += r; somaG += g; somaB += b;
      somaCroma += Math.max(r, g, b) - Math.min(r, g, b);
      n++;
    }
  }

  // Percentis 1 e 99: ignoram o pixel isolado e descrevem a faixa util.
  const corte = Math.max(1, Math.round(n * 0.01));
  let acc = 0, p1 = 0, p99 = 255;
  for (let v = 0; v < 256; v++) { acc += histograma[v]; if (acc >= corte) { p1 = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += histograma[v]; if (acc >= corte) { p99 = v; break; } }

  return {
    largura, altura,
    proporcao: Number((largura / altura).toFixed(3)),
    luminancia_media: Math.round(soma / n),
    fracao_estourada: Number((estourados / n).toFixed(3)),
    fracao_apagada: Number((apagados / n).toFixed(3)),
    faixa_tonal: p99 - p1,
    percentil_1: p1,
    percentil_99: p99,
    croma_medio: Math.round(somaCroma / n),
    media_r: Math.round(somaR / n),
    media_g: Math.round(somaG / n),
    media_b: Math.round(somaB / n),
    desvio_temperatura: Math.round((somaR - somaB) / n),
    histograma,
    amostras: n,
  };
}

type Medicao = ReturnType<typeof medir>;

// O histograma e um Uint32Array de 256 posicoes: util para decidir, lixo para
// gravar. Sai antes de ir para o banco ou para a resposta.
function semHistograma(m: Medicao) {
  const { histograma: _h, amostras: _a, ...resto } = m;
  return resto;
}

function nitidezDe(im: Imagem) {
  const { largura, altura, dados } = im;
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
  let s = 0, s2 = 0, n = 0;
  for (let y = 1; y < altRed - 1; y++) {
    for (let x = 1; x < largRed - 1; x++) {
      const i = y * largRed + x;
      const lap = -4 * cinza[i] + cinza[i - 1] + cinza[i + 1] + cinza[i - largRed] + cinza[i + largRed];
      s += lap; s2 += lap * lap; n++;
    }
  }
  return Math.round(n ? s2 / n - Math.pow(s / n, 2) : 0);
}

// ---------------------------------------------------------------- ajustes
function aplicarCurva(im: Imagem, tabela: Uint8Array) {
  const d = im.dados;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = tabela[d[i]]; d[i + 1] = tabela[d[i + 1]]; d[i + 2] = tabela[d[i + 2]];
  }
  return im;
}

function aplicarGama(im: Imagem, gama: number) {
  const tabela = new Uint8Array(256);
  for (let v = 0; v < 256; v++) tabela[v] = limitar(paraSrgb(Math.pow(paraLinear(v), gama)));
  return aplicarCurva(im, tabela);
}

// Contraste por esticamento em torno do ponto medio: (v - 128) * ganho + 128.
// O ponto medio fica parado e sombras e altas luzes se afastam dele na mesma
// proporcao. O mapa e identico nos tres canais, entao a cor nao se desloca -
// so ganha separacao. Como a luminancia e uma soma ponderada dos canais cujos
// pesos somam 1, aplicar esta reta em R, G e B equivale a aplica-la na propria
// luminancia. E por isso que da para simular o resultado sobre o histograma
// medido, sem tocar em um pixel sequer.
function curvaContraste(ganho: number) {
  const t = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    t[v] = limitar((v - CONTRASTE_PIVO) * ganho + CONTRASTE_PIVO);
  }
  return t;
}

function simularCorte(histograma: Uint32Array, amostras: number, ganho: number) {
  const t = curvaContraste(ganho);
  let apagados = 0, estourados = 0;
  for (let v = 0; v < 256; v++) {
    const quantos = histograma[v];
    if (!quantos) continue;
    if (t[v] < LIMIAR_APAGADO) apagados += quantos;
    if (t[v] > LIMIAR_ESTOURADO) estourados += quantos;
  }
  const n = Math.max(amostras, 1);
  return {
    apagada: Number((apagados / n).toFixed(4)),
    estourada: Number((estourados / n).toFixed(4)),
  };
}

// Comeca no ganho necessario para tirar a peca do chapado e desce de 0,05 em
// 0,05 ate o corte previsto caber no orcamento de 2%. Devolve null quando nem
// o menor ganho util cabe - nesse caso esticar destruiria mais do que revela.
function escolherGanhoContraste(m: Medicao, ganhoMax: number) {
  const faixa = Math.max(1, m.percentil_99 - m.percentil_1);
  const inicial = Number(Math.min(ganhoMax, CONTRASTE_FAIXA_ALVO / faixa).toFixed(3));
  if (inicial < CONTRASTE_GANHO_MIN) return null;

  const tentativas: { ganho: number; apagada: number; estourada: number }[] = [];
  for (let i = 0; ; i++) {
    const ganho = Number((inicial - i * CONTRASTE_PASSO).toFixed(3));
    if (ganho < CONTRASTE_GANHO_MIN) break;
    const previsto = simularCorte(m.histograma, m.amostras, ganho);
    tentativas.push({ ganho, ...previsto });
    if (previsto.apagada <= CORTE_TOLERADO && previsto.estourada <= CORTE_TOLERADO) {
      return { ganho, inicial, previsto, tentativas };
    }
  }
  return null;
}

// Saturacao por interpolacao em torno da luminancia do proprio pixel.
// Como o deslocamento e proporcional em cada canal, o matiz nao muda:
// um creme continua creme, um verde continua o mesmo verde.
function aplicarSaturacao(im: Imagem, fator: number) {
  const d = im.dados;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    d[i] = limitar(l + (d[i] - l) * fator);
    d[i + 1] = limitar(l + (d[i + 1] - l) * fator);
    d[i + 2] = limitar(l + (d[i + 2] - l) * fator);
  }
  return im;
}

// Temperatura por ganho de canal, com teto. Corrige dominante fria ou quente
// sem tocar no verde, que e o canal que carrega a maior parte da luminancia.
function aplicarTemperatura(im: Imagem, ganhoR: number, ganhoB: number) {
  const tabelaR = new Uint8Array(256), tabelaB = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    tabelaR[v] = limitar(v * ganhoR);
    tabelaB[v] = limitar(v * ganhoB);
  }
  const d = im.dados;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = tabelaR[d[i]]; d[i + 2] = tabelaB[d[i + 2]];
  }
  return im;
}

function recortarPara(im: Imagem, alvo: number): Imagem {
  const { largura, altura, dados } = im;
  let novaL = largura, novaA = altura;
  if (largura / altura > alvo) novaL = Math.round(altura * alvo);
  else novaA = Math.round(largura / alvo);
  const x0 = Math.floor((largura - novaL) / 2);
  const y0 = Math.floor((altura - novaA) / 2);
  const saida = new Uint8Array(novaL * novaA * 4);
  for (let y = 0; y < novaA; y++) {
    const oOrig = ((y + y0) * largura + x0) * 4;
    saida.set(dados.subarray(oOrig, oOrig + novaL * 4), y * novaL * 4);
  }
  return { largura: novaL, altura: novaA, dados: saida };
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

  const { data: { user } } = await comoUsuario.auth.getUser();
  if (!user) return responder({ erro: "sem_credencial" }, 401);

  const { data: perfil } = await comoUsuario.from("perfis")
    .select("id, org_id").eq("id", user.id).maybeSingle();
  if (!perfil) return responder({ erro: "sem_perfil" }, 403);

  const { data: material, error: erroMat } = await comoUsuario.from("materiais")
    .select("id, org_id, unidade_id, formato").eq("id", material_id).single();
  if (erroMat || !material) return responder({ erro: "material_nao_encontrado" }, 404);

  const servidor = createClient(URL_SB, CHAVE_SERVICO, { db: { schema: "mkt" } });

  try {
    const { data: versao } = await servidor.from("material_versoes")
      .select("id, versao").eq("material_id", material_id)
      .order("versao", { ascending: false }).limit(1).maybeSingle();
    if (!versao) throw new Error("material sem versao");

    const { data: arquivo } = await servidor.from("arquivos")
      .select("id, bucket, storage_path, mime, nome_original")
      .eq("material_versao_id", versao.id).is("timestamp_ms", null).limit(1).maybeSingle();
    if (!arquivo) throw new Error("versao sem arquivo");
    if ((arquivo.mime ?? "").startsWith("video/")) {
      return responder({ erro: "video_nao_e_corrigido", detalhe:
        "Video nao passa por correcao automatica. O laudo aponta o instante a ajustar na edicao." }, 400);
    }

    const { data: blob, error: erroBaixa } = await servidor.storage
      .from(arquivo.bucket ?? "mkt-materiais").download(arquivo.storage_path);
    if (erroBaixa || !blob) throw new Error("nao foi possivel ler o arquivo");

    let imagem = decodificar(new Uint8Array(await blob.arrayBuffer()), arquivo.mime ?? "image/jpeg");
    const antes = medir(imagem);
    const nitidezAntes = nitidezDe(imagem);
    const ajustes: { tipo: string; descricao: string; dados?: Record<string, unknown> }[] = [];
    const recusas: { tipo: string; motivo: string; dados?: Record<string, unknown> }[] = [];

    // -------------------------------------------------------- 1) exposicao
    const escura = antes.luminancia_media < LUMA_ESCURA;
    const clara = antes.luminancia_media > LUMA_ESTOURADA ||
                  antes.fracao_estourada > ESTOURO_TOLERADO;

    if (escura || clara) {
      const irrecuperavel = antes.luminancia_media < LUMA_IRRECUPERAVEL_BAIXA ||
                            antes.luminancia_media > LUMA_IRRECUPERAVEL_ALTA;
      if (irrecuperavel) {
        recusas.push({ tipo: "exposicao", motivo:
          `Luminancia media ${antes.luminancia_media} de 255. Nesta faixa nao ha informacao ` +
          "suficiente para recuperar: corrigir so maquiaria a peca. Refaca a foto com mais luz." });
      } else {
        const a = paraLinear(antes.luminancia_media), b = paraLinear(ALVO_LUMA);
        const gama = Math.min(GAMA_MAX, Math.max(GAMA_MIN,
          Math.log(Math.max(b, 1e-6)) / Math.log(Math.max(a, 1e-6))));
        imagem = aplicarGama(imagem, gama);
        const conf = medir(imagem);
        ajustes.push({ tipo: "exposicao", descricao:
          `Imagem ${escura ? "escura" : "clara"} demais: luminancia media ${antes.luminancia_media} ` +
          `de 255, contra o limiar de ${escura ? LUMA_ESCURA : LUMA_ESTOURADA}. Curva de gama ` +
          `${gama.toFixed(3)} levou a luminancia para ${conf.luminancia_media} (alvo ${ALVO_LUMA}). ` +
          `Estourados depois: ${pct(conf.fracao_estourada, 0)}.`,
          dados: { limiar_escura: LUMA_ESCURA, limiar_clara: LUMA_ESTOURADA,
            gama: Number(gama.toFixed(3)), luma_antes: antes.luminancia_media,
            luma_depois: conf.luminancia_media } });
      }
    }

    // -------------------------------------------------------- 2) contraste
    const medidoPosExposicao = medir(imagem);
    if (medidoPosExposicao.faixa_tonal < CONTRASTE_FAIXA_MINIMA) {
      const escolha = escolherGanhoContraste(medidoPosExposicao, CONTRASTE_GANHO_MAX);

      if (!escolha) {
        recusas.push({ tipo: "contraste", motivo:
          `Imagem chapada: faixa tonal de apenas ${medidoPosExposicao.faixa_tonal} de 255 ` +
          `(entre ${medidoPosExposicao.percentil_1} e ${medidoPosExposicao.percentil_99}). ` +
          `Nenhum ganho a partir de ${CONTRASTE_GANHO_MIN} manteve o corte previsto abaixo de ` +
          `${pct(CORTE_TOLERADO, 0)}. Esticar aqui apagaria detalhe em vez de revelar. ` +
          "A origem e a captura: refaca a foto com mais separacao de luz.",
          dados: { faixa_tonal: medidoPosExposicao.faixa_tonal, pivo: CONTRASTE_PIVO,
            limite_corte: CORTE_TOLERADO, ganho_minimo: CONTRASTE_GANHO_MIN } });
      } else {
        imagem = aplicarCurva(imagem, curvaContraste(escolha.ganho));
        const conf = medir(imagem);
        const reduziu = escolha.ganho < escolha.inicial;
        const parcial = conf.faixa_tonal < CONTRASTE_FAIXA_MINIMA;

        ajustes.push({ tipo: "contraste", descricao:
          `Imagem chapada: faixa tonal de apenas ${medidoPosExposicao.faixa_tonal} de 255 ` +
          `(entre ${medidoPosExposicao.percentil_1} e ${medidoPosExposicao.percentil_99}). ` +
          `Esticamento em torno do ponto medio ${CONTRASTE_PIVO}: (v - ${CONTRASTE_PIVO}) x ganho ` +
          `+ ${CONTRASTE_PIVO}, o mesmo mapa nos tres canais, entao a cor nao se desloca. ` +
          `Ganho ${escolha.ganho}` +
          (reduziu
            ? `, reduzido a partir de ${escolha.inicial} em ${escolha.tentativas.length - 1} passo(s) ` +
              `de ${CONTRASTE_PASSO} ate o corte previsto caber no limite de ${pct(CORTE_TOLERADO, 0)}`
            : ` (teto ${CONTRASTE_GANHO_MAX}), ja dentro do limite de ${pct(CORTE_TOLERADO, 0)}`) +
          `. Previsto: ${pct(escolha.previsto.apagada)} apagado e ${pct(escolha.previsto.estourada)} ` +
          `estourado. Medido depois: ${pct(conf.fracao_apagada)} apagado e ` +
          `${pct(conf.fracao_estourada)} estourado. Faixa foi de ${medidoPosExposicao.faixa_tonal} ` +
          `para ${conf.faixa_tonal}.` +
          (parcial
            ? ` Correcao parcial: o limite de corte impediu chegar aos ${CONTRASTE_FAIXA_MINIMA} ` +
              "de faixa considerados aceitaveis. O que falta nao esta no arquivo - esta na captura."
            : ""),
          dados: {
            pivo: CONTRASTE_PIVO,
            ganho_inicial: escolha.inicial,
            ganho_aplicado: escolha.ganho,
            limite_corte: CORTE_TOLERADO,
            corte_previsto: escolha.previsto,
            corte_medido: { apagada: conf.fracao_apagada, estourada: conf.fracao_estourada },
            faixa_antes: medidoPosExposicao.faixa_tonal,
            faixa_depois: conf.faixa_tonal,
            correcao_parcial: parcial,
            tentativas: escolha.tentativas,
          } });
      }
    }

    // -------------------------------------------------------- 3) saturacao
    const medidoPosContraste = medir(imagem);
    const croma = medidoPosContraste.croma_medio;
    if (croma < SATURACAO_MINIMA || croma > SATURACAO_MAXIMA) {
      const alvo = croma < SATURACAO_MINIMA ? SATURACAO_MINIMA + 12 : SATURACAO_MAXIMA - 10;
      const fator = Math.min(SATURACAO_FATOR_MAX, Math.max(SATURACAO_FATOR_MIN,
        alvo / Math.max(croma, 1)));
      imagem = aplicarSaturacao(imagem, fator);
      const conf = medir(imagem);
      ajustes.push({ tipo: "saturacao", descricao:
        `Cor ${croma < SATURACAO_MINIMA ? "lavada" : "exagerada"}: croma medio ${croma}. ` +
        `Fator ${fator.toFixed(3)} (teto ${SATURACAO_FATOR_MIN} a ${SATURACAO_FATOR_MAX}) ` +
        `levou o croma para ${conf.croma_medio}. Ajuste proporcional em torno da luminancia ` +
        "de cada pixel: o matiz nao muda." });
    }

    // ------------------------------------------------------ 4) temperatura
    const medidoPosSaturacao = medir(imagem);
    const desvio = medidoPosSaturacao.desvio_temperatura;
    if (Math.abs(desvio) > TEMPERATURA_DESVIO_TOLERADO) {
      const mediaRB = (medidoPosSaturacao.media_r + medidoPosSaturacao.media_b) / 2;
      let gR = mediaRB / Math.max(medidoPosSaturacao.media_r, 1);
      let gB = mediaRB / Math.max(medidoPosSaturacao.media_b, 1);
      gR = Math.min(1 + TEMPERATURA_GANHO_MAX, Math.max(1 - TEMPERATURA_GANHO_MAX, gR));
      gB = Math.min(1 + TEMPERATURA_GANHO_MAX, Math.max(1 - TEMPERATURA_GANHO_MAX, gB));
      imagem = aplicarTemperatura(imagem, gR, gB);
      const conf = medir(imagem);
      ajustes.push({ tipo: "temperatura", descricao:
        `Dominante ${desvio > 0 ? "quente" : "fria"}: diferenca media entre vermelho e azul ` +
        `de ${desvio}. Ganho ${gR.toFixed(3)} no vermelho e ${gB.toFixed(3)} no azul ` +
        `(teto ${Math.round(TEMPERATURA_GANHO_MAX * 100)}%) reduziu a diferenca para ` +
        `${conf.desvio_temperatura}. O canal verde nao foi tocado.` });
    }

    // ---------------------------------------------------------- 5) nitidez
    if (nitidezAntes < NITIDEZ_MINIMA) {
      recusas.push({ tipo: "nitidez", motivo:
        `Indice de nitidez ${nitidezAntes} (minimo ${NITIDEZ_MINIMA}). A correcao automatica nao ` +
        "aplica realce: forcar contorno cria aparencia de nitidez que a foto nao tem. " +
        "A orientacao e refazer a foto com foco no produto." });
    }

    // ---------------------------------------------------- 6) enquadramento
    const faixa = ["story", "reels", "capa_video"].includes(material.formato ?? "")
      ? FAIXA_VERTICAL
      : ["feed", "carrossel", "anuncio"].includes(material.formato ?? "")
      ? FAIXA_QUADRADO : null;

    if (faixa && (antes.proporcao < faixa[0] || antes.proporcao > faixa[1])) {
      const alvo = (faixa[0] + faixa[1]) / 2;
      const antesDoCorte = `${imagem.largura}x${imagem.altura}`;
      imagem = recortarPara(imagem, alvo);
      ajustes.push({ tipo: "enquadramento", descricao:
        `Proporcao ${antes.proporcao} fora da faixa do formato ${material.formato} ` +
        `(${faixa[0]} a ${faixa[1]}). Recorte centralizado de ${antesDoCorte} para ` +
        `${imagem.largura}x${imagem.altura}. Nada foi esticado.` });
    }

    if (!ajustes.length) {
      return responder({
        ok: true, corrigida: false, versao_algoritmo: VERSAO_ALGORITMO,
        motivo: recusas.length
          ? "A peca tem problema, mas nao do tipo que a correcao automatica deva consertar."
          : "A medicao nao encontrou nada que a correcao automatica saiba consertar.",
        recusas, medicao: semHistograma(antes),
      });
    }

    // ------------------------------------------------------------ gravacao
    const depois = medir(imagem);
    const jpg = jpeg.encode({
      data: imagem.dados, width: imagem.largura, height: imagem.altura,
    }, QUALIDADE_JPEG);

    const novoNumero = (versao.versao ?? 1) + 1;
    const caminho = `${material.org_id}/${material.unidade_id}/${material_id}/v${novoNumero}-corrigida.jpg`;

    const { error: erroUp } = await servidor.storage.from("mkt-materiais")
      .upload(caminho, jpg.data, { contentType: "image/jpeg", upsert: true });
    if (erroUp) throw new Error("nao foi possivel guardar a imagem corrigida: " + erroUp.message);

    const { data: novaVersao, error: erroVer } = await servidor.from("material_versoes").insert({
      org_id: material.org_id, unidade_id: material.unidade_id,
      material_id, versao: novoNumero, origem: "corrigido",
      criado_por: perfil.id, marcado_ia: true,
    }).select("id").single();
    if (erroVer || !novaVersao) throw new Error("nao foi possivel criar a versao corrigida");

    await servidor.from("arquivos").insert({
      org_id: material.org_id, unidade_id: material.unidade_id,
      material_versao_id: novaVersao.id, bucket: "mkt-materiais",
      storage_path: caminho, mime: "image/jpeg",
      nome_original: `corrigida-${arquivo.nome_original ?? "peca"}.jpg`,
      bytes: jpg.data.length, largura: imagem.largura, altura: imagem.altura,
    });

    const medicaoAntes = { ...semHistograma(antes), nitidez: nitidezAntes };
    const medicaoDepois = { ...semHistograma(depois), nitidez: nitidezDe(imagem) };

    const { data: registro } = await servidor.from("correcoes_imagem").insert({
      org_id: material.org_id, unidade_id: material.unidade_id,
      material_id, versao_origem_id: versao.id, versao_corrigida_id: novaVersao.id,
      ajustes: { versao_algoritmo: VERSAO_ALGORITMO, aplicados: ajustes, recusados: recusas },
      medicao_antes: medicaoAntes,
      medicao_depois: medicaoDepois,
      criado_por: perfil.id,
    }).select("id").single();

    return responder({
      ok: true, corrigida: true, versao_algoritmo: VERSAO_ALGORITMO,
      correcao_id: registro?.id ?? null,
      versao_original: versao.versao,
      versao_corrigida: novoNumero,
      ajustes, recusas,
      medicao_antes: medicaoAntes,
      medicao_depois: medicaoDepois,
      preservado: "Todos os ajustes sao globais de tom e cor. Produto, embalagem, logotipo e " +
                  "texto nao foram redesenhados nem deformados. O unico ajuste geometrico e " +
                  "recorte centralizado, nunca esticamento.",
      aviso: "O arquivo original foi preservado. A correcao entrou como versao nova e precisa " +
             "de aceite humano antes de valer como a peca oficial.",
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "falha desconhecida";
    console.error("falha na correcao:", mensagem);
    return responder({ erro: "falha_na_correcao", detalhe: mensagem }, 500);
  }
});

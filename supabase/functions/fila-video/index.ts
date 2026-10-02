// Fila de analise de video — item 6 da auditoria.
//
// A analise de video era sincrona: o navegador mandava os quadros e ficava
// esperando quase um minuto, com risco de estourar o tempo da funcao de borda.
// Agora o envio so ENFILEIRA e responde na hora; o processamento acontece
// depois, e a tela acompanha o estado.
//
// Tres acoes:
//   enfileirar - confere o dono do material e poe o trabalho na fila
//   processar  - pega o proximo da fila e roda a analise (chamado pela tela ou
//                por um agendador externo)
//   estado     - devolve em que pe esta o trabalho
//
// Por que a analise em si nao foi reescrita aqui: ela ja existe, testada, na
// funcao analisar-video. Duplicar aquele codigo criaria duas versoes da mesma
// regra para manter em sincronia - e a hora que elas divergissem, ninguem ia
// perceber. Este arquivo orquestra; quem julga continua sendo o analisar-video.
//
// Limite declarado: sem pg_cron e sem pg_net neste projeto, o banco nao acorda
// um trabalhador sozinho. Quem chama 'processar' e a tela (logo apos enfileirar
// e a cada consulta de estado) ou um agendador externo. A fila em si e segura:
// trabalho preso volta sozinho depois de 10 minutos.

import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const CHAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CHAVE_SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TETO_QUADROS = 8;

const CABECALHOS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Content-Type": "application/json; charset=utf-8",
};
const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: CABECALHOS });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CABECALHOS });
  if (req.method !== "POST") return responder({ erro: "metodo_invalido" }, 405);

  const autorizacao = req.headers.get("Authorization") ?? "";
  if (!autorizacao) return responder({ erro: "sem_credencial" }, 401);

  let corpo: {
    acao?: string; material_id?: string; trabalho_id?: string;
    quadros?: { path: string; timestamp_ms: number }[]; duracao_ms?: number;
  };
  try { corpo = await req.json(); } catch { return responder({ erro: "corpo_invalido" }, 400); }
  const acao = corpo.acao ?? "enfileirar";

  const comoUsuario = createClient(URL_SB, CHAVE_ANON, {
    db: { schema: "mkt" },
    global: { headers: { Authorization: autorizacao } },
  });
  const { data: { user } } = await comoUsuario.auth.getUser();
  if (!user) return responder({ erro: "sem_credencial" }, 401);

  const servidor = createClient(URL_SB, CHAVE_SERVICO, { db: { schema: "mkt" } });

  try {
    // ---------------------------------------------------------- enfileirar
    if (acao === "enfileirar") {
      const quadros = (corpo.quadros ?? []).slice(0, TETO_QUADROS);
      if (!corpo.material_id || !quadros.length) {
        return responder({ erro: "material_id_ou_quadros_ausentes" }, 400);
      }

      // A RLS responde por quem pode mandar analisar este material.
      const { data: material, error: erroMat } = await comoUsuario.from("materiais")
        .select("id, org_id, unidade_id").eq("id", corpo.material_id).single();
      if (erroMat || !material) return responder({ erro: "material_nao_encontrado" }, 404);

      const { data: versao } = await servidor.from("material_versoes")
        .select("id").eq("material_id", corpo.material_id)
        .order("versao", { ascending: false }).limit(1).maybeSingle();

      // Trabalho ja esperando para o mesmo material nao entra duas vezes:
      // toque duplo no botao nao pode virar analise cobrada duas vezes.
      const { data: jaNaFila } = await servidor.from("trabalhos_video")
        .select("id, estado").eq("material_id", corpo.material_id)
        .in("estado", ["na_fila", "processando"]).limit(1).maybeSingle();
      if (jaNaFila) {
        return responder({
          ok: true, ja_estava_na_fila: true, trabalho_id: jaNaFila.id,
          estado: jaNaFila.estado,
          observacao: "Este material ja tem uma analise em andamento.",
        });
      }

      const { data: trabalho, error } = await servidor.from("trabalhos_video").insert({
        org_id: material.org_id, unidade_id: material.unidade_id,
        material_id: corpo.material_id, material_versao_id: versao?.id ?? null,
        quadros, duracao_ms: corpo.duracao_ms ?? null, criado_por: user.id,
      }).select("id, estado, criado_em").single();
      if (error) throw new Error("nao foi possivel enfileirar: " + error.message);

      await servidor.from("materiais").update({ status: "processando" }).eq("id", corpo.material_id);

      const { count } = await servidor.from("trabalhos_video")
        .select("id", { count: "exact", head: true }).eq("estado", "na_fila");

      return responder({
        ok: true, trabalho_id: trabalho.id, estado: trabalho.estado,
        posicao_na_fila: count ?? 1,
        observacao: "O video entrou na fila. Pode fechar a tela: o laudo fica " +
                    "guardado no material quando terminar.",
      });
    }

    // ------------------------------------------------------------- estado
    if (acao === "estado") {
      if (!corpo.trabalho_id && !corpo.material_id) {
        return responder({ erro: "informe trabalho_id ou material_id" }, 400);
      }
      // Leitura pelo usuario: a RLS decide se ele pode ver este trabalho.
      let consulta = comoUsuario.from("trabalhos_video")
        .select("id, estado, tentativas, max_tentativas, analise_id, erro, criado_em, iniciado_em, terminado_em")
        .order("criado_em", { ascending: false }).limit(1);
      consulta = corpo.trabalho_id
        ? consulta.eq("id", corpo.trabalho_id)
        : consulta.eq("material_id", corpo.material_id!);

      const { data: trabalho } = await consulta.maybeSingle();
      if (!trabalho) return responder({ erro: "trabalho_nao_encontrado" }, 404);

      return responder({ ok: true, trabalho });
    }

    // ---------------------------------------------------------- processar
    if (acao === "processar") {
      // Antes de pegar trabalho novo, devolve para a fila o que travou.
      const { data: destravados } = await servidor.rpc("destravar_trabalhos_video");

      const { data: trabalho } = await servidor.rpc("proximo_trabalho_video");
      if (!trabalho) {
        return responder({
          ok: true, havia_trabalho: false, destravados: destravados ?? 0,
          observacao: "Nada na fila.",
        });
      }

      const inicio = Date.now();
      try {
        // Chama a analise que ja existe, com credencial de servidor. A
        // autorizacao ja foi conferida na hora de enfileirar.
        const resposta = await fetch(`${URL_SB}/functions/v1/analisar-video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": CHAVE_SERVICO,
            "Authorization": `Bearer ${CHAVE_SERVICO}`,
          },
          body: JSON.stringify({
            material_id: trabalho.material_id,
            quadros: trabalho.quadros,
            duracao_ms: trabalho.duracao_ms ?? 0,
          }),
        });

        const resultado = await resposta.json();
        if (!resposta.ok || !resultado.ok) {
          throw new Error(resultado.detalhe || resultado.erro || "a analise nao concluiu");
        }

        await servidor.from("trabalhos_video").update({
          estado: "concluido", analise_id: resultado.analise_id ?? null,
          erro: null, terminado_em: new Date().toISOString(),
        }).eq("id", trabalho.id);

        return responder({
          ok: true, havia_trabalho: true, trabalho_id: trabalho.id,
          estado: "concluido", analise_id: resultado.analise_id,
          nota_geral: resultado.nota_geral, achados: resultado.achados,
          latencia_ms: Date.now() - inicio, destravados: destravados ?? 0,
        });
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : "falha desconhecida";
        // Ainda ha tentativa sobrando? Volta para a fila. Senao, falha de vez
        // e o material fica marcado para a pessoa saber que precisa reenviar.
        const acabou = (trabalho.tentativas ?? 1) >= (trabalho.max_tentativas ?? 3);
        await servidor.from("trabalhos_video").update({
          estado: acabou ? "falhou" : "na_fila",
          erro: mensagem.slice(0, 400),
          terminado_em: acabou ? new Date().toISOString() : null,
        }).eq("id", trabalho.id);

        if (acabou) {
          await servidor.from("materiais")
            .update({ status: "precisa_informacao" }).eq("id", trabalho.material_id);
        }

        return responder({
          ok: false, havia_trabalho: true, trabalho_id: trabalho.id,
          estado: acabou ? "falhou" : "na_fila",
          tentativa: trabalho.tentativas, de: trabalho.max_tentativas,
          detalhe: mensagem,
        }, acabou ? 500 : 202);
      }
    }

    return responder({ erro: "acao_desconhecida", acoes: ["enfileirar", "processar", "estado"] }, 400);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "falha desconhecida";
    console.error("falha na fila de video:", mensagem);
    return responder({ erro: "falha_na_fila", detalhe: mensagem }, 500);
  }
});

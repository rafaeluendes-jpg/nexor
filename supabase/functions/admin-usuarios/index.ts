// Administracao de unidades e usuarios — item 4 da auditoria.
//
// Ate aqui so existia criar usuario. Faltava o resto do ciclo de vida:
// desativar, reativar, trocar papel, mover de unidade, redefinir senha, e a
// gestao das unidades em si. Sem isso, franqueado que sai da rede continua com
// acesso - que e exatamente o buraco que uma auditoria de acesso procura.
//
// Principios que valem para tudo aqui:
//   - So admin_geral executa. A conferencia e feita com o token do usuario,
//     e a RLS continua valendo como segunda barreira.
//   - Ninguem se rebaixa nem se desativa sozinho, e a organizacao nunca fica
//     sem administrador ativo.
//   - Nada e apagado. Usuario sai por desativacao, unidade sai por suspensao.
//     Historico de material e decisao continua de pe e continua rastreavel.
//   - Toda acao vai para mkt.audit_log com antes e depois. Se o registro
//     falhar, a acao falha junto: acao administrativa sem rastro nao pode ser
//     dada como feita.
//
// O corte de acesso de verdade e feito no banco, nao aqui: as funcoes de
// contexto (current_org_id, current_unidade_id, current_role_app) exigem perfil
// ativo e unidade nao suspensa. O signOut abaixo e conveniencia, para a pessoa
// nao ficar com uma tela meio viva na mao.

import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const CHAVE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CHAVE_SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PAPEIS = ["admin_geral", "gestor_unidade", "usuario_unidade"];

const CABECALHOS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Content-Type": "application/json; charset=utf-8",
};
const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: CABECALHOS });

const senhaProvisoria = () => {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("") + "@1";
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CABECALHOS });
  if (req.method !== "POST") return responder({ erro: "metodo_invalido" }, 405);

  const autorizacao = req.headers.get("Authorization") ?? "";
  if (!autorizacao) return responder({ erro: "sem_credencial" }, 401);

  let corpo: Record<string, string | boolean | undefined>;
  try { corpo = await req.json(); } catch { return responder({ erro: "corpo_invalido" }, 400); }
  const acao = String(corpo.acao ?? "");

  const comoUsuario = createClient(URL_SB, CHAVE_ANON, {
    db: { schema: "mkt" },
    global: { headers: { Authorization: autorizacao } },
  });
  const { data: { user } } = await comoUsuario.auth.getUser();
  if (!user) return responder({ erro: "sem_credencial" }, 401);

  const { data: eu } = await comoUsuario.from("perfis")
    .select("id, org_id, funcao, ativo").eq("id", user.id).maybeSingle();
  if (!eu || eu.funcao !== "admin_geral" || !eu.ativo) {
    return responder({ erro: "somente_administrador" }, 403);
  }

  const servidor = createClient(URL_SB, CHAVE_SERVICO, { db: { schema: "mkt" } });

  // Falha aqui derruba a acao de proposito. A primeira versao desta funcao
  // escrevia na tabela errada e o erro passou despercebido porque estava
  // engolido: dez acoes administrativas rodaram sem deixar rastro nenhum.
  const registrar = async (
    acaoNome: string, entidade: string, entidadeId: string,
    antes: unknown, depois: unknown, unidadeId?: string | null,
  ) => {
    const { error } = await servidor.from("audit_log").insert({
      org_id: eu.org_id, unidade_id: unidadeId ?? null, ator_id: eu.id,
      acao: acaoNome, entidade, entidade_id: entidadeId,
      antes: antes ?? null, depois: depois ?? null,
      user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    });
    if (error) throw new Error("acao feita mas nao registrada na auditoria: " + error.message);
  };

  const encerrarSessao = async (id: string) => {
    const r = await servidor.auth.admin.signOut(id, "global")
      .catch((e) => ({ error: e }));
    return !(r as { error?: unknown })?.error;
  };

  try {
    switch (acao) {
      // ------------------------------------------------------- unidades
      case "listar_unidades": {
        const { data } = await servidor.from("unidades")
          .select("id, codigo, nome, cidade, uf, ativo, suspensa, criado_em")
          .eq("org_id", eu.org_id).order("codigo");
        const ids = (data ?? []).map((u) => u.id);
        const { data: pessoas } = await servidor.from("perfis")
          .select("unidade_id, ativo").eq("org_id", eu.org_id).in("unidade_id", ids.length ? ids : [""]);
        const conta = new Map<string, { ativos: number; inativos: number }>();
        for (const p of pessoas ?? []) {
          const c = conta.get(p.unidade_id!) ?? { ativos: 0, inativos: 0 };
          p.ativo ? c.ativos++ : c.inativos++;
          conta.set(p.unidade_id!, c);
        }
        return responder({
          ok: true,
          unidades: (data ?? []).map((u) => ({
            ...u, pessoas: conta.get(u.id) ?? { ativos: 0, inativos: 0 },
          })),
        });
      }

      case "criar_unidade": {
        const codigo = String(corpo.codigo ?? "").trim().toUpperCase();
        const nome = String(corpo.nome ?? "").trim();
        if (!codigo || !nome) return responder({ erro: "codigo_e_nome_obrigatorios" }, 400);

        const { data: jaExiste } = await servidor.from("unidades")
          .select("id").eq("org_id", eu.org_id).eq("codigo", codigo).maybeSingle();
        if (jaExiste) return responder({ erro: "codigo_ja_usado", detalhe:
          `Ja existe uma unidade com o codigo ${codigo}.` }, 409);

        const { data: marca } = await servidor.from("marcas")
          .select("id").eq("org_id", eu.org_id).limit(1).maybeSingle();

        const { data: nova, error } = await servidor.from("unidades").insert({
          org_id: eu.org_id, marca_id: marca?.id ?? null, codigo, nome,
          cidade: corpo.cidade ? String(corpo.cidade).trim() : null,
          uf: corpo.uf ? String(corpo.uf).trim().toUpperCase().slice(0, 2) : null,
          ativo: true, suspensa: false,
        }).select("*").single();
        if (error) throw new Error("nao foi possivel criar a unidade: " + error.message);

        await registrar("unidade_criada", "unidades", nova.id, null, nova, nova.id);
        return responder({ ok: true, unidade: nova });
      }

      case "suspender_unidade":
      case "reativar_unidade": {
        const id = String(corpo.unidade_id ?? "");
        if (!id) return responder({ erro: "unidade_id_ausente" }, 400);
        const suspender = acao === "suspender_unidade";

        const { data: antes } = await servidor.from("unidades")
          .select("*").eq("id", id).eq("org_id", eu.org_id).maybeSingle();
        if (!antes) return responder({ erro: "unidade_nao_encontrada" }, 404);

        const { data: depois, error } = await servidor.from("unidades")
          .update({ suspensa: suspender, ativo: !suspender })
          .eq("id", id).eq("org_id", eu.org_id).select("*").single();
        if (error) throw new Error(error.message);

        let sessoesDerrubadas = 0;
        if (suspender) {
          const { data: pessoas } = await servidor.from("perfis")
            .select("id").eq("unidade_id", id).eq("ativo", true);
          for (const p of pessoas ?? []) {
            if (await encerrarSessao(p.id)) sessoesDerrubadas++;
          }
        }

        await registrar(suspender ? "unidade_suspensa" : "unidade_reativada",
                        "unidades", id, antes, depois, id);
        return responder({
          ok: true, unidade: depois, sessoes_derrubadas: sessoesDerrubadas,
          observacao: suspender
            ? "Unidade suspensa. Quem pertence a ela perde o acesso na hora, por regra do " +
              "banco, mesmo com token ja emitido. Nada foi apagado: material e historico " +
              "continuam visiveis para o administrador."
            : "A unidade voltou a operar. As pessoas precisam entrar de novo.",
        });
      }

      // ------------------------------------------------------- usuarios
      case "listar_usuarios": {
        let consulta = servidor.from("perfis")
          .select("id, nome, email, funcao, unidade_id, ativo, senha_provisoria, ultimo_acesso_em, criado_em, unidades(codigo, nome, suspensa)")
          .eq("org_id", eu.org_id).order("nome");
        if (corpo.unidade_id) consulta = consulta.eq("unidade_id", String(corpo.unidade_id));
        const { data } = await consulta;
        return responder({ ok: true, usuarios: data ?? [] });
      }

      case "desativar_usuario":
      case "reativar_usuario": {
        const id = String(corpo.perfil_id ?? "");
        if (!id) return responder({ erro: "perfil_id_ausente" }, 400);
        const desativar = acao === "desativar_usuario";

        if (desativar && id === eu.id) {
          return responder({ erro: "nao_pode_desativar_a_si", detalhe:
            "Um administrador nao desativa a propria conta: a organizacao ficaria sem dono." }, 400);
        }

        const { data: antes } = await servidor.from("perfis")
          .select("*").eq("id", id).eq("org_id", eu.org_id).maybeSingle();
        if (!antes) return responder({ erro: "usuario_nao_encontrado" }, 404);

        if (desativar && antes.funcao === "admin_geral") {
          const { count } = await servidor.from("perfis")
            .select("id", { count: "exact", head: true })
            .eq("org_id", eu.org_id).eq("funcao", "admin_geral").eq("ativo", true);
          if ((count ?? 0) <= 1) {
            return responder({ erro: "ultimo_administrador", detalhe:
              "Este e o unico administrador ativo. Promova outra pessoa antes de desativar." }, 400);
          }
        }

        const { data: depois, error } = await servidor.from("perfis")
          .update({ ativo: !desativar }).eq("id", id).eq("org_id", eu.org_id)
          .select("*").single();
        if (error) throw new Error(error.message);

        const sessaoDerrubada = desativar ? await encerrarSessao(id) : false;

        await registrar(desativar ? "usuario_desativado" : "usuario_reativado",
                        "perfis", id, antes, depois, antes.unidade_id);
        return responder({
          ok: true, usuario: depois, sessao_derrubada: sessaoDerrubada,
          observacao: desativar
            ? "Acesso cortado por regra do banco: token ja emitido para de valer e login " +
              "novo nao devolve nada. O historico da pessoa continua no sistema."
            : "Acesso devolvido.",
        });
      }

      case "mudar_papel": {
        const id = String(corpo.perfil_id ?? "");
        const papel = String(corpo.funcao ?? "");
        if (!id || !PAPEIS.includes(papel)) return responder({ erro: "papel_invalido" }, 400);

        const { data: antes } = await servidor.from("perfis")
          .select("*").eq("id", id).eq("org_id", eu.org_id).maybeSingle();
        if (!antes) return responder({ erro: "usuario_nao_encontrado" }, 404);

        if (id === eu.id && papel !== "admin_geral") {
          return responder({ erro: "nao_pode_rebaixar_a_si", detalhe:
            "Um administrador nao se rebaixa sozinho. Peca a outro administrador." }, 400);
        }
        if (antes.funcao === "admin_geral" && papel !== "admin_geral") {
          const { count } = await servidor.from("perfis")
            .select("id", { count: "exact", head: true })
            .eq("org_id", eu.org_id).eq("funcao", "admin_geral").eq("ativo", true);
          if ((count ?? 0) <= 1) {
            return responder({ erro: "ultimo_administrador", detalhe:
              "Este e o unico administrador ativo. Promova outra pessoa antes." }, 400);
          }
        }
        if (papel !== "admin_geral" && !antes.unidade_id && !corpo.unidade_id) {
          return responder({ erro: "unidade_obrigatoria", detalhe:
            "Gestor e usuario de unidade precisam estar ligados a uma unidade." }, 400);
        }

        const mudanca: Record<string, unknown> = { funcao: papel };
        if (papel === "admin_geral") mudanca.unidade_id = null;
        else if (corpo.unidade_id) mudanca.unidade_id = String(corpo.unidade_id);

        const { data: depois, error } = await servidor.from("perfis")
          .update(mudanca).eq("id", id).eq("org_id", eu.org_id).select("*").single();
        if (error) throw new Error(error.message);

        await encerrarSessao(id);
        await registrar("papel_alterado", "perfis", id, antes, depois, depois.unidade_id);
        return responder({ ok: true, usuario: depois, observacao:
          "A sessao foi encerrada para o novo papel valer no proximo acesso." });
      }

      case "mover_unidade": {
        const id = String(corpo.perfil_id ?? "");
        const destino = String(corpo.unidade_id ?? "");
        if (!id || !destino) return responder({ erro: "perfil_id_e_unidade_id_obrigatorios" }, 400);

        const { data: antes } = await servidor.from("perfis")
          .select("*").eq("id", id).eq("org_id", eu.org_id).maybeSingle();
        if (!antes) return responder({ erro: "usuario_nao_encontrado" }, 404);
        if (antes.funcao === "admin_geral") {
          return responder({ erro: "admin_nao_pertence_a_unidade" }, 400);
        }

        const { data: unidade } = await servidor.from("unidades")
          .select("id, suspensa").eq("id", destino).eq("org_id", eu.org_id).maybeSingle();
        if (!unidade) return responder({ erro: "unidade_nao_encontrada" }, 404);
        if (unidade.suspensa) return responder({ erro: "unidade_suspensa", detalhe:
          "Nao da para mover alguem para uma unidade suspensa." }, 400);

        const { data: depois, error } = await servidor.from("perfis")
          .update({ unidade_id: destino }).eq("id", id).eq("org_id", eu.org_id)
          .select("*").single();
        if (error) throw new Error(error.message);

        await encerrarSessao(id);
        await registrar("usuario_movido", "perfis", id, antes, depois, destino);
        return responder({ ok: true, usuario: depois, observacao:
          "Material antigo continua na unidade de origem: historico nao se muda de lugar." });
      }

      case "redefinir_senha": {
        const id = String(corpo.perfil_id ?? "");
        if (!id) return responder({ erro: "perfil_id_ausente" }, 400);

        const { data: antes } = await servidor.from("perfis")
          .select("id, nome, email, unidade_id").eq("id", id).eq("org_id", eu.org_id).maybeSingle();
        if (!antes) return responder({ erro: "usuario_nao_encontrado" }, 404);

        const nova = senhaProvisoria();
        const { error } = await servidor.auth.admin.updateUserById(id, { password: nova });
        if (error) throw new Error("nao foi possivel trocar a senha: " + error.message);

        await servidor.from("perfis").update({ senha_provisoria: true }).eq("id", id);
        await encerrarSessao(id);

        // A senha nao entra na auditoria. O registro guarda que houve troca.
        await registrar("senha_redefinida", "perfis", id,
                        { senha_provisoria: false }, { senha_provisoria: true }, antes.unidade_id);

        return responder({
          ok: true, email: antes.email, senha_provisoria: nova,
          aviso: "Entregue esta senha pessoalmente. Ela e provisoria, o sistema exige troca " +
                 "no primeiro acesso e ela nao fica guardada em lugar nenhum.",
        });
      }

      default:
        return responder({ erro: "acao_desconhecida", acoes: [
          "listar_unidades", "criar_unidade", "suspender_unidade", "reativar_unidade",
          "listar_usuarios", "desativar_usuario", "reativar_usuario",
          "mudar_papel", "mover_unidade", "redefinir_senha",
        ] }, 400);
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "falha desconhecida";
    console.error("falha na administracao:", mensagem);
    return responder({ erro: "falha_na_administracao", detalhe: mensagem }, 500);
  }
});

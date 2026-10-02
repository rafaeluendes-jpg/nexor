// Entrega a interface da plataforma.
// Os arquivos ficam no balde `mkt-site`; esta funcao apenas os devolve
// com o tipo correto, porque o armazenamento entrega .html como texto puro
// e nao preserva o tipo das imagens.
// Para atualizar o site, basta reenviar o arquivo ao balde.

const BALDE = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/mkt-site`;

const ROTAS: Record<string, [string, string]> = {
  "logo":    ["logo-jolo.png", "image/png"],
  "simbolo": ["simbolo-jolo.png", "image/png"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const partes = new URL(req.url).pathname.split("/").filter(Boolean);
  const rota = partes[partes.length - 1] ?? "";
  const [arquivo, tipo] = ROTAS[rota] ?? ["index.html", "text/html; charset=utf-8"];

  try {
    const resposta = await fetch(`${BALDE}/${arquivo}`, { cache: "no-store" });

    if (!resposta.ok) {
      return new Response(
        "A pagina nao esta disponivel no momento. Tente novamente em instantes.",
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }

    return new Response(await resposta.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": tipo,
        "Cache-Control": "public, max-age=60",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
      },
    });
  } catch (_erro) {
    return new Response(
      "A pagina nao esta disponivel no momento. Tente novamente em instantes.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
});

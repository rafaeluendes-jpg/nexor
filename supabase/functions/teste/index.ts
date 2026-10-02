Deno.serve(() => {
  const h = new Headers();
  h.set("content-type", "text/html; charset=utf-8");
  return new Response("<!DOCTYPE html><html><body style='background:#0E1524;color:#fff;font-family:sans-serif;text-align:center;padding-top:80px'><h1 style='color:#4F46E5'>TESTE OK</h1><p>Se voce esta lendo isso com fundo escuro, o site funciona.</p></body></html>", { headers: h });
});

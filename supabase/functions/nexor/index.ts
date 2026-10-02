import { CSS_TEXT } from "./styles.ts";
import { CONFIG_JS } from "./config.ts";
import { APP_JS } from "./app.ts";

const HTML = `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Nexor</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/functions/v1/nexor/style.css">
</head>
<body>

<section id="login">
  <div class="lg-card" id="lgCard">
    <div class="lg-brand">
      <div class="lg-mark">N</div>
      <h1>NEXOR</h1>
      <p>Gestão simples, lucro visível</p>
    </div>
    <form id="lgForm">
      <div class="fld">
        <label>Login</label>
        <div class="wrap"><input id="lgUser" type="text" autocomplete="username" placeholder="Digite seu login" required></div>
      </div>
      <div class="fld">
        <label>Senha</label>
        <div class="wrap">
          <input id="lgPwd" type="password" autocomplete="current-password" placeholder="Digite sua senha" required>
          <button type="button" class="eye" id="togglePwd"></button>
        </div>
      </div>
      <div class="lg-row">
        <label><input type="checkbox" id="lgKeep"> Manter conectado</label>
        <a href="#" onclick="return false">Esqueci minha senha</a>
      </div>
      <div class="err" id="lgErr"></div>
      <button type="submit" class="btn btn-primary btn-full">Entrar</button>
    </form>
    <div class="lg-foot">Versão de demonstração · acesso: Rafa / 123</div>
  </div>
</section>

<div id="app" class="hide">
  <aside class="side" id="side"></aside>
  <div class="scrim" id="scrim"></div>
  <div class="main">
    <header class="top" id="top"></header>
    <div class="content" id="content"></div>
  </div>
</div>

<script src="/functions/v1/nexor/config.js"></script>
<script src="/functions/v1/nexor/app.js"></script>
</body>
</html>`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve((req: Request) => {
  const path = new URL(req.url).pathname;
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (path.endsWith("/style.css")) {
    return new Response(CSS_TEXT, { headers: { ...CORS, "Content-Type": "text/css; charset=utf-8" } });
  }
  if (path.endsWith("/config.js")) {
    return new Response(CONFIG_JS, { headers: { ...CORS, "Content-Type": "application/javascript; charset=utf-8" } });
  }
  if (path.endsWith("/app.js")) {
    return new Response(APP_JS, { headers: { ...CORS, "Content-Type": "application/javascript; charset=utf-8" } });
  }
  return new Response(HTML, { headers: { ...CORS, "Content-Type": "text/html; charset=utf-8" } });
});

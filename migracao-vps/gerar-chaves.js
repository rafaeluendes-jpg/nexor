#!/usr/bin/env node
/* Gera os segredos do Supabase da VPS e grava no .env do docker.
   Uso (na VPS):  node gerar-chaves.js /opt/joia/supabase/.env
   Nada é impresso na tela — os valores só existem no arquivo, com permissão 600. */
const fs = require('fs'), crypto = require('crypto');
const arq = process.argv[2];
if (!arq || !fs.existsSync(arq)) { console.error('informe o caminho do .env do docker'); process.exit(1); }
const aleat = (n) => crypto.randomBytes(n).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, n);
const b64u = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
function jwt(role, segredo) {
  const cab = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const agora = Math.floor(Date.now() / 1000);
  const corpo = b64u(JSON.stringify({ role, iss: 'supabase', iat: agora, exp: agora + 10 * 365 * 24 * 3600 }));
  const ass = b64u(crypto.createHmac('sha256', segredo).update(cab + '.' + corpo).digest());
  return cab + '.' + corpo + '.' + ass;
}
const JWT_SECRET = aleat(48);
const valores = {
  POSTGRES_PASSWORD: aleat(32),
  JWT_SECRET,
  ANON_KEY: jwt('anon', JWT_SECRET),
  SERVICE_ROLE_KEY: jwt('service_role', JWT_SECRET),
  DASHBOARD_USERNAME: 'joia',
  DASHBOARD_PASSWORD: aleat(24),
  SECRET_KEY_BASE: aleat(64),
  VAULT_ENC_KEY: aleat(32),
  PG_META_CRYPTO_KEY: aleat(32),
  LOGFLARE_PUBLIC_ACCESS_TOKEN: aleat(32),
  LOGFLARE_PRIVATE_ACCESS_TOKEN: aleat(32),
  SITE_URL: 'https://joiagest.com.br',
  ADDITIONAL_REDIRECT_URLS: 'https://www.joiagest.com.br,https://app.joiagest.com.br',
  API_EXTERNAL_URL: 'https://api.joiagest.com.br',
  SUPABASE_PUBLIC_URL: 'https://api.joiagest.com.br',
  ENABLE_EMAIL_SIGNUP: 'false',
  DISABLE_SIGNUP: 'true',
  FUNCTIONS_VERIFY_JWT: 'false'
};
let txt = fs.readFileSync(arq, 'utf8');
for (const [k, v] of Object.entries(valores)) {
  const re = new RegExp('^' + k + '=.*$', 'm');
  txt = re.test(txt) ? txt.replace(re, k + '=' + v) : txt + '\n' + k + '=' + v;
}
fs.writeFileSync(arq, txt, { mode: 0o600 });
fs.chmodSync(arq, 0o600);
console.log('ok: segredos gravados em ' + arq + ' (permissão 600). Nenhum valor foi mostrado.');

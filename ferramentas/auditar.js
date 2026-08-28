/* ==========================================================
   AUDITAR — o sistema num navegador de verdade

   `varrer.js` roda num DOM de mentira (jsdom). Ele acha defeito de
   ligação e de runtime, e é rápido, mas não enxerga o que só existe
   quando há tela: largura, corte no celular, rolagem horizontal,
   elemento fora da área visível. E acusa como erro coisas que o jsdom
   simplesmente não implementa — `innerText` é a principal.

   Esta ferramenta abre o index.html no Chromium, com uma loja semeada,
   em duas telas (computador e celular), e mede o que só o navegador
   sabe responder:

     1. erro no console e promessa rejeitada, por tela;
     2. rolagem horizontal na página (nunca pode existir);
     3. elemento estourando a largura da tela (corte no celular);
     4. botão menor que o dedo (alvo de toque abaixo de 32 px);
     5. texto técnico vazando para a interface;
     6. fotografia da tela, para conferência visual.

   Rodar:  node ferramentas/auditar.js [filtro]
   Saída:  /tmp/auditoria/*.png  e  o resumo em JSON no terminal.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..');
const FILTRO = process.argv[2] || '';
const FOTOS = process.env.AUDIT_FOTOS || '/tmp/auditoria';
fs.mkdirSync(FOTOS, { recursive: true });

const TIPOS = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.json':'application/json' };

function servir() {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(RAIZ, p);
      if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404); return res.end('nao encontrado');
      }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
      res.end(fs.readFileSync(f));
    });
    s.listen(0, '127.0.0.1', () => ok({ s, porta: s.address().port }));
  });
}

const SEMENTE = fs.readFileSync(path.join(__dirname, 'semente-loja.js'), 'utf8');
/* ruído do ambiente: sem rede e sem service worker num servidor de teste */
const ruido = m => /Failed to fetch|NetworkError|sem conexão|offline|ServiceWorker|net::ERR|Manifest|favicon|Download the React/i.test(String(m));
/* o que NUNCA pode aparecer escrito na tela para o operador */
const TECNIQUES = /undefined|NaN|\[object Object\]|TypeError|ReferenceError|null,|PGRST|violates row-level/;

const VISTAS = [
  { nome: 'computador', largura: 1440, altura: 900, movel: false },
  { nome: 'celular',    largura: 390,  altura: 844, movel: true  }
];

(async function () {
  const { s, porta } = await servir();
  const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const achados = { erroDeTela: [], rolagemHorizontal: [], estouraLargura: [],
                    alvoPequeno: [], textoTecnico: [], telas: 0, fotos: [] };

  for (const v of VISTAS) {
    const ctx = await navegador.newContext({
      viewport: { width: v.largura, height: v.altura },
      deviceScaleFactor: 1, hasTouch: v.movel, isMobile: v.movel,
      locale: 'pt-BR', timezoneId: 'America/Sao_Paulo'
    });
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('console', m => { if (m.type() === 'error' && !ruido(m.text())) erros.push(m.text().slice(0, 160)); });
    pg.on('pageerror', e => { if (!ruido(e.message)) erros.push(e.message.slice(0, 160)); });
    /* ==========================================================
       OFFLINE DE PROPOSITO, MAS SEM CORTAR A LINHA

       A auditoria nao pode tocar no banco de producao. A primeira
       versao ABORTAVA todo pedido externo — e o sistema nao carregava:
       o index.html traz a biblioteca do Supabase por `document.write`,
       e abortar esse pedido no meio da leitura da pagina interrompe o
       resto do documento. O sistema ficava so com a tela de login e
       nenhuma funcao.

       Responder vazio, com 200, deixa a leitura seguir. Nada sai
       daqui para a rede, e o sistema monta inteiro.
       ========================================================== */
    await pg.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith('http://127.0.0.1:' + porta)) return r.continue();
      return r.fulfill({ status: 200, contentType: 'text/javascript',
                         body: '/* bloqueado na auditoria */' });
    });
    await pg.goto('http://127.0.0.1:' + porta + '/index.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(1200);

    await pg.evaluate(() => {
      window.confirmar = async () => false;
      window.pergunta  = async () => false;
      window.confirm = () => false; window.alert = () => {}; window.prompt = () => null;
      window.print = () => {};
      /* a sessao e aberta pelo caminho do sistema: `abrirSessao()` e quem
         chama carregar() e boot(). Esconder a tela de login com CSS deixa
         o sistema de pe mas sem as colecoes prontas. */
      try { SESSAO.login = 'admin'; SESSAO.usuarioId = 'usr_mestre'; } catch (e) {}
      abrirSessao();
    });
    await pg.waitForTimeout(400);
    await pg.evaluate(SEMENTE);
    await pg.evaluate(() => { try { topo(); faixa(); } catch (e) {} });

    const telas = (await pg.evaluate(() =>
      Object.keys(window).filter(k => /^tela[A-Z]/.test(k) && typeof window[k] === 'function').sort()
    )).filter(n => !FILTRO || n.toLowerCase().includes(FILTRO.toLowerCase()));

    for (const n of telas) {
      erros.length = 0;
      const r = await pg.evaluate(async (nome) => {
        var out = { montou: true, erro: '' };
        try {
          if (!document.getElementById('content')) {
            var d = document.createElement('div'); d.id = 'content'; document.body.appendChild(d);
          }
          window[nome]();
        } catch (e) { out.montou = false; out.erro = String(e.message).slice(0, 120); }
        return out;
      }, n);
      await pg.waitForTimeout(60);
      if (!r.montou) { achados.erroDeTela.push(v.nome + ' · ' + n + ' — ' + r.erro); continue; }

      const medida = await pg.evaluate((movel) => {
        var doc = document.documentElement, larg = doc.clientWidth;
        var res = { rolagem: doc.scrollWidth - larg, estoura: [], pequenos: [], tecnico: '' };
        var cont = document.getElementById('content');
        if (cont) {
          var els = cont.querySelectorAll('*');
          for (var i = 0; i < els.length && res.estoura.length < 4; i++) {
            var e = els[i], b = e.getBoundingClientRect();
            if (!b.width || !b.height) continue;
            var est = getComputedStyle(e);
            if (est.position === 'fixed' || est.overflowX === 'auto' || est.overflowX === 'scroll') continue;
            if (b.right > larg + 2 || b.left < -2) {
              /* só interessa quem não está dentro de uma caixa que rola */
              var p = e.parentElement, dentroDeRolagem = false;
              while (p && p !== cont) {
                var ep = getComputedStyle(p);
                if (ep.overflowX === 'auto' || ep.overflowX === 'scroll') { dentroDeRolagem = true; break; }
                p = p.parentElement;
              }
              if (!dentroDeRolagem)
                res.estoura.push(e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '') +
                  ' → ' + Math.round(b.right) + 'px de ' + larg);
            }
          }
          /* alvo de toque so faz sentido onde se toca: no computador o
             mesmo botao de 24 px e clicado com o ponteiro do mouse */
          var bts = movel ? cont.querySelectorAll('button,a[onclick],input[type=button]') : [];
          for (var j = 0; j < bts.length && res.pequenos.length < 4; j++) {
            var bb = bts[j].getBoundingClientRect();
            if (bb.width && bb.height && bb.height < 32)
              res.pequenos.push((bts[j].textContent || '').trim().slice(0, 24) + ' — ' + Math.round(bb.height) + 'px');
          }
          var txt = cont.innerText || '';
          var m = txt.match(/undefined|NaN|\[object Object\]|TypeError|ReferenceError|PGRST\d+|violates row-level/);
          if (m) {
            var i2 = txt.indexOf(m[0]);
            res.tecnico = txt.slice(Math.max(0, i2 - 40), i2 + 40).replace(/\n/g, ' ');
          }
        }
        return res;
      }, v.movel);

      if (v.nome === 'computador') achados.telas++;
      if (erros.length) achados.erroDeTela.push(v.nome + ' · ' + n + ' — ' + erros[0]);
      if (medida.rolagem > 2) achados.rolagemHorizontal.push(v.nome + ' · ' + n + ' — sobra ' + medida.rolagem + 'px');
      medida.estoura.forEach(x => achados.estouraLargura.push(v.nome + ' · ' + n + ' — ' + x));
      medida.pequenos.forEach(x => achados.alvoPequeno.push(v.nome + ' · ' + n + ' — ' + x));
      if (medida.tecnico) achados.textoTecnico.push(v.nome + ' · ' + n + ' — "' + medida.tecnico.trim() + '"');
    }
    await ctx.close();
  }

  await navegador.close();
  s.close();
  console.log(JSON.stringify(achados, null, 1));
  process.exit(achados.erroDeTela.length || achados.rolagemHorizontal.length ||
               achados.textoTecnico.length ? 1 : 0);
})();
